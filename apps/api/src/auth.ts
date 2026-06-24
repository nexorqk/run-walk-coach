import { createHash, randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import type { Prisma, User } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { DEFAULT_USER_PROFILE } from "@run-walk-coach/shared";
import { env } from "./env.js";
import { prisma } from "./prisma.js";

const SESSION_DURATION_DAYS = 365;
const GOOGLE_STATE_DURATION_MINUTES = 10;
const GOOGLE_STATE_COOKIE = `${env.sessionCookieName}_google_state`;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function sessionCookieOptions(expires: Date) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.nodeEnv === "production",
    expires
  };
}

function googleStateCookieOptions(expires: Date) {
  return {
    path: "/api/auth/google",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.nodeEnv === "production",
    expires
  };
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function createOAuthState() {
  return randomBytes(32).toString("base64url");
}

function googleOAuthClient() {
  if (!env.googleAuthEnabled || !env.googleClientId || !env.googleClientSecret) {
    return undefined;
  }

  return new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
}

async function createSession(userId: string, reply: FastifyReply) {
  const token = createSessionToken();
  const expiresAt = addDays(new Date(), SESSION_DURATION_DAYS);

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashSecret(`session:${token}`),
      expiresAt
    }
  });

  reply.setCookie(env.sessionCookieName, token, sessionCookieOptions(expiresAt));
}

function clearGoogleStateCookie(reply: FastifyReply) {
  reply.clearCookie(GOOGLE_STATE_COOKIE, {
    path: "/api/auth/google"
  });
}

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(env.sessionCookieName, {
    path: "/"
  });
}

async function mergeAnonymousUser(
  tx: Prisma.TransactionClient,
  sourceUserId: string,
  targetUserId: string
) {
  const sessions = await tx.workoutSession.findMany({
    where: {
      userId: sourceUserId
    },
    select: {
      id: true,
      clientSessionId: true
    }
  });

  for (const session of sessions) {
    const existingSession = session.clientSessionId
      ? await tx.workoutSession.findUnique({
          where: {
            userId_clientSessionId: {
              userId: targetUserId,
              clientSessionId: session.clientSessionId
            }
          }
        })
      : undefined;

    if (existingSession) {
      await tx.workoutSession.delete({
        where: {
          id: session.id
        }
      });
      continue;
    }

    await tx.workoutSession.update({
      where: {
        id: session.id
      },
      data: {
        userId: targetUserId
      }
    });
  }

  await tx.workoutTemplate.updateMany({
    where: {
      userId: sourceUserId
    },
    data: {
      userId: targetUserId
    }
  });

  const sourceRecoveryCode = await tx.recoveryCode.findUnique({
    where: {
      userId: sourceUserId
    }
  });
  const targetRecoveryCode = await tx.recoveryCode.findUnique({
    where: {
      userId: targetUserId
    }
  });

  if (sourceRecoveryCode && !targetRecoveryCode) {
    await tx.recoveryCode.update({
      where: {
        id: sourceRecoveryCode.id
      },
      data: {
        userId: targetUserId
      }
    });
  }

  await tx.user.delete({
    where: {
      id: sourceUserId
    }
  });
}

function googleUserUpdateData(target: User, googleId: string, email: string | undefined, emailOwner?: User) {
  return {
    googleId,
    googleLinkedAt: new Date(),
    ...(email && (!emailOwner || emailOwner.id === target.id) ? { email } : {})
  };
}

async function getCurrentSession(request: FastifyRequest) {
  const token = request.cookies[env.sessionCookieName];

  if (!token) {
    return undefined;
  }

  return prisma.authSession.findFirst({
    where: {
      tokenHash: hashSecret(`session:${token}`),
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: true
    }
  });
}

export async function getCurrentUser(request: FastifyRequest) {
  return (await getCurrentSession(request))?.user;
}

export async function requireCurrentUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getCurrentUser(request);

  if (!user) {
    void reply.status(401).send({ error: "AuthenticationRequired" });
    return undefined;
  }

  if (!user.googleId) {
    void reply.status(401).send({ error: "GoogleAuthenticationRequired" });
    return undefined;
  }

  return user;
}

export function googleAuthStatus() {
  return {
    enabled: env.googleAuthEnabled,
    redirectUri: env.googleRedirectUri
  };
}

export function beginGoogleLogin(reply: FastifyReply) {
  const client = googleOAuthClient();

  if (!client) {
    return reply.status(503).send({ error: "GoogleAuthNotConfigured" });
  }

  const state = createOAuthState();
  reply.setCookie(
    GOOGLE_STATE_COOKIE,
    state,
    googleStateCookieOptions(addMinutes(new Date(), GOOGLE_STATE_DURATION_MINUTES))
  );

  return reply.redirect(
    client.generateAuthUrl({
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      state
    })
  );
}

async function linkGoogleUser(
  googleId: string,
  email: string | undefined,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const currentUser = await getCurrentUser(request);
  const googleUser = await prisma.user.findUnique({
    where: {
      googleId
    }
  });
  const emailUser = email
    ? await prisma.user.findUnique({
        where: {
          email
        }
      })
    : undefined;
  const targetUser = googleUser ?? emailUser;

  if (targetUser) {
    const linkedUser = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: targetUser.id
        },
        data: googleUserUpdateData(targetUser, googleId, email, emailUser ?? undefined)
      });

      if (
        currentUser &&
        currentUser.id !== updatedUser.id &&
        currentUser.email === null &&
        currentUser.googleId === null
      ) {
        await mergeAnonymousUser(tx, currentUser.id, updatedUser.id);
      }

      return updatedUser;
    });

    await createSession(linkedUser.id, reply);
    return linkedUser;
  }

  if (currentUser) {
    const linkedUser = await prisma.user.update({
      where: {
        id: currentUser.id
      },
      data: {
        googleId,
        email: email ?? currentUser.email,
        googleLinkedAt: new Date()
      }
    });

    await createSession(linkedUser.id, reply);
    return linkedUser;
  }

  const user = await prisma.user.create({
    data: {
      ...DEFAULT_USER_PROFILE,
      googleId,
      email: email ?? null,
      googleLinkedAt: new Date()
    }
  });

  await createSession(user.id, reply);
  return user;
}

export async function completeGoogleLogin(
  query: { code?: string; state?: string; error?: string },
  request: FastifyRequest,
  reply: FastifyReply
) {
  const client = googleOAuthClient();

  if (!client) {
    return reply.status(503).send({ error: "GoogleAuthNotConfigured" });
  }

  const appOrigin = env.corsOrigins[0];
  const redirectToSettings = (status: "connected" | "error") =>
    reply.redirect(`${appOrigin}/settings?google=${status}`);
  const expectedState = request.cookies[GOOGLE_STATE_COOKIE];
  clearGoogleStateCookie(reply);

  if (query.error || !query.code || !query.state || !expectedState || query.state !== expectedState) {
    return redirectToSettings("error");
  }

  try {
    const { tokens } = await client.getToken(query.code);

    if (!tokens.id_token || !env.googleClientId) {
      return redirectToSettings("error");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.googleClientId
    });
    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = payload?.email?.toLowerCase();

    if (!googleId || !email || payload.email_verified !== true) {
      return redirectToSettings("error");
    }

    await linkGoogleUser(googleId, email, request, reply);
    return redirectToSettings("connected");
  } catch {
    return redirectToSettings("error");
  }
}

export async function logoutCurrentSession(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[env.sessionCookieName];

  if (token) {
    await prisma.authSession.deleteMany({
      where: {
        tokenHash: hashSecret(`session:${token}`)
      }
    });
  }

  clearSessionCookie(reply);
}

export async function deleteCurrentUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await requireCurrentUser(request, reply);

  if (!user) {
    return false;
  }

  await prisma.user.delete({
    where: {
      id: user.id
    }
  });

  clearSessionCookie(reply);
  return true;
}

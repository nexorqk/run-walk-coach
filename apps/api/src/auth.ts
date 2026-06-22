import { createHash, randomBytes, randomInt } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { DEFAULT_USER_PROFILE } from "@run-walk-coach/shared";
import { env } from "./env.js";
import { prisma } from "./prisma.js";

const SESSION_DURATION_DAYS = 365;
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
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

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashRecoveryCode(code: string) {
  return hashSecret(`recovery:${normalizeRecoveryCode(code)}`);
}

function generateRecoveryCode() {
  const chars = Array.from({ length: 20 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]);
  const groups = [];

  for (let index = 0; index < chars.length; index += 5) {
    groups.push(chars.slice(index, index + 5).join(""));
  }

  return `RW-${groups.join("-")}`;
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

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(env.sessionCookieName, {
    path: "/"
  });
}

async function createAnonymousUser(reply: FastifyReply) {
  const user = await prisma.user.create({
    data: DEFAULT_USER_PROFILE
  });

  await createSession(user.id, reply);
  return user;
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

export async function getOrCreateCurrentUser(request: FastifyRequest, reply: FastifyReply) {
  return (await getCurrentUser(request)) ?? createAnonymousUser(reply);
}

export async function createRecoveryCode(userId: string) {
  const recoveryCode = generateRecoveryCode();
  const codeHash = hashRecoveryCode(recoveryCode);
  const now = new Date();
  const record = await prisma.recoveryCode.upsert({
    where: {
      userId
    },
    create: {
      userId,
      codeHash
    },
    update: {
      codeHash,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null
    }
  });

  return {
    recoveryCode,
    createdAt: record.createdAt.toISOString()
  };
}

export async function recoveryCodeStatus(userId: string) {
  const record = await prisma.recoveryCode.findUnique({
    where: {
      userId
    }
  });

  return {
    exists: Boolean(record && record.revokedAt === null),
    createdAt: record?.createdAt.toISOString() ?? null,
    lastUsedAt: record?.lastUsedAt?.toISOString() ?? null,
    revokedAt: record?.revokedAt?.toISOString() ?? null
  };
}

export async function revokeRecoveryCode(userId: string) {
  const record = await prisma.recoveryCode.findUnique({
    where: {
      userId
    }
  });

  if (!record || record.revokedAt !== null) {
    return recoveryCodeStatus(userId);
  }

  await prisma.recoveryCode.update({
    where: {
      id: record.id
    },
    data: {
      revokedAt: new Date()
    }
  });

  return recoveryCodeStatus(userId);
}

export async function recoverUserWithCode(recoveryCode: string, reply: FastifyReply) {
  const record = await prisma.recoveryCode.findUnique({
    where: {
      codeHash: hashRecoveryCode(recoveryCode)
    },
    include: {
      user: true
    }
  });

  if (!record || record.revokedAt !== null) {
    return undefined;
  }

  await prisma.recoveryCode.update({
    where: {
      id: record.id
    },
    data: {
      lastUsedAt: new Date()
    }
  });
  await createSession(record.userId, reply);

  return record.user;
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
  const session = await getCurrentSession(request);

  if (session) {
    await prisma.user.delete({
      where: {
        id: session.userId
      }
    });
  }

  clearSessionCookie(reply);
}

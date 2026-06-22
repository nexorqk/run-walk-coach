import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]) {
  if (!origin) {
    return false;
  }

  return allowedOrigins.includes(origin);
}

function requestOrigin(request: FastifyRequest) {
  const origin = headerValue(request.headers.origin);

  if (origin) {
    return origin;
  }

  const referer = headerValue(request.headers.referer);

  if (!referer) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export async function enforceTrustedOrigin(request: FastifyRequest, reply: FastifyReply) {
  if (SAFE_METHODS.has(request.method)) {
    return;
  }

  const origin = requestOrigin(request);

  if (!origin && !env.requireOriginCheck) {
    return;
  }

  if (!isAllowedOrigin(origin, env.corsOrigins)) {
    return reply.status(403).send({ error: "ForbiddenOrigin" });
  }
}

export function corsOriginAllowed(origin: string | undefined) {
  if (!origin) {
    return true;
  }

  return isAllowedOrigin(origin, env.corsOrigins);
}

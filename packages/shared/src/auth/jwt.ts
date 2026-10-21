import { createHash, randomUUID } from "node:crypto";
import jwt, { SignOptions } from "jsonwebtoken";

export type TokenType = "access" | "refresh";

export interface TokenPayload {
  sub: string;
  type: TokenType;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: Date;
}

const DEFAULT_ACCESS_TTL = "15m";
const DEFAULT_REFRESH_TTL = "30d";
const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/;
const DURATION_UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function getSecret(secret?: string): string {
  const value = secret ?? process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }
  return value;
}

function getTtl(type: TokenType): string {
  if (type === "access") {
    return process.env.JWT_ACCESS_EXPIRES_IN ?? DEFAULT_ACCESS_TTL;
  }
  return process.env.JWT_REFRESH_EXPIRES_IN ?? DEFAULT_REFRESH_TTL;
}

export function parseDurationMs(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`INVALID_DURATION:${value}`);
  }
  return Number(match[1]) * DURATION_UNIT_MS[match[2]];
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function jwtSign(userId: string, type: TokenType, secret?: string): string {
  return jwt.sign({ sub: userId, type }, getSecret(secret), {
    expiresIn: getTtl(type) as SignOptions["expiresIn"],
    jwtid: randomUUID(),
  });
}

export function jwtVerify(token: string, expectedType?: TokenType, secret?: string): TokenPayload {
  const payload = jwt.verify(token, getSecret(secret)) as Partial<TokenPayload>;

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }

  if (payload.type !== "access" && payload.type !== "refresh") {
    throw new jwt.JsonWebTokenError("Invalid token type");
  }

  if (expectedType && payload.type !== expectedType) {
    throw new jwt.JsonWebTokenError("Invalid token type");
  }

  return payload as TokenPayload;
}

export function createTokenPair(userId: string): TokenPair {
  const accessTtl = getTtl("access");
  const refreshTtl = getTtl("refresh");

  return {
    accessToken: jwtSign(userId, "access"),
    refreshToken: jwtSign(userId, "refresh"),
    tokenType: "Bearer",
    accessTokenExpiresIn: Math.floor(parseDurationMs(accessTtl) / 1_000),
    refreshTokenExpiresAt: new Date(Date.now() + parseDurationMs(refreshTtl)),
  };
}

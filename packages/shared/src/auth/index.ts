import argon2 from "argon2";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { toPublicUser, type PublicUser } from "../users/select";
import { createTokenPair, hashToken, jwtVerify, type TokenPair, type TokenPayload } from "./jwt";

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

async function issueTokens(userId: string): Promise<TokenPair> {
  const tokens = createTokenPair(userId);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: tokens.refreshTokenExpiresAt,
    },
  });

  return tokens;
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await argon2.hash(input.password),
    },
  });

  return {
    user: toPublicUser(user),
    tokens: await issueTokens(user.id),
  };
}

export async function login(input: { email: string; password: string }): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user?.passwordHash) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordValid = await argon2.verify(user.passwordHash, input.password);

  if (!passwordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.status === "SUSPENDED") {
    throw new Error("ACCOUNT_SUSPENDED");
  }

  return {
    user: toPublicUser(user),
    tokens: await issueTokens(user.id),
  };
}

export async function googleLogin(input: { idToken: string }): Promise<AuthResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("GOOGLE_AUTH_NOT_CONFIGURED");
  }

  let payload;
  let timeout: NodeJS.Timeout | undefined;

  try {
    const client = new OAuth2Client(clientId);
    const ticket = await Promise.race([
      client.verifyIdToken({ idToken: input.idToken, audience: clientId }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("GOOGLE_VERIFY_TIMEOUT")), 10_000);
      }),
    ]);
    payload = ticket.getPayload();
  } catch {
    throw new Error("INVALID_GOOGLE_TOKEN");
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  if (!payload?.sub || !payload.email) {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  if (!payload.email_verified) {
    throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
  }

  const email = payload.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
          name: user.name ?? payload.name ?? null,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          googleId: payload.sub,
          name: payload.name ?? null,
        },
      });
    }
  }

  if (user.status === "SUSPENDED") {
    throw new Error("ACCOUNT_SUSPENDED");
  }

  return {
    user: toPublicUser(user),
    tokens: await issueTokens(user.id),
  };
}

export async function refreshSession(refreshToken: string): Promise<AuthResult> {
  const payload = jwtVerify(refreshToken, "refresh");
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.userId !== payload.sub) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const now = new Date();

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    throw new Error("REFRESH_TOKEN_REUSED");
  }

  if (stored.expiresAt.getTime() <= now.getTime()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: now },
    });
    throw new Error("TOKEN_EXPIRED");
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (user.status === "SUSPENDED") {
    await revokeAllTokensForUser(user.id);
    throw new Error("ACCOUNT_SUSPENDED");
  }

  const tokens = createTokenPair(user.id);

  const rotated = await prisma.$transaction(async tx => {
    const claimed = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now },
    });

    if (claimed.count === 0) {
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return false;
    }

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt: tokens.refreshTokenExpiresAt,
      },
    });

    return true;
  });

  if (!rotated) {
    throw new Error("REFRESH_TOKEN_REUSED");
  }

  return { user: toPublicUser(user), tokens };
}

export async function logoutByRefreshToken(
  refreshToken: string,
  userId?: string,
): Promise<{ revoked: number }> {
  const result = await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashToken(refreshToken),
      ...(userId ? { userId } : {}),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  return { revoked: result.count };
}

export async function logout(
  userId: string,
  options: { refreshToken?: string; allSessions?: boolean } = {},
): Promise<{ revoked: number }> {
  if (options.allSessions || !options.refreshToken) {
    const result = await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      tokenHash: hashToken(options.refreshToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  return { revoked: result.count };
}

export async function revokeAllTokensForUser(userId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count;
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwtVerify(token, "access");
}

export function verifyToken(token: string): TokenPayload {
  return verifyAccessToken(token);
}

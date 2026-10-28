import { prisma } from "../lib/prisma";

const pushTokenPublicSelect = {
  id: true,
  platform: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface PushTokenInput {
  token: string;
  platform: string;
}

/** Tokens are bearer-ish credentials, so listings only show enough to tell them apart. */
function preview(token: string): string {
  return token.length <= 12 ? `${token.slice(0, 4)}…` : `${token.slice(0, 8)}…${token.slice(-4)}`;
}

/**
 * Registers a device token for push delivery. Registering the same token again only
 * refreshes its platform, so a phone that reinstalls the app does not accumulate rows.
 */
export async function registerPushToken(userId: string, input: PushTokenInput) {
  const existing = await prisma.pushToken.findUnique({
    where: { userId_token: { userId, token: input.token } },
    select: { id: true },
  });

  if (existing) {
    return await prisma.pushToken.update({
      where: { id: existing.id },
      data: { platform: input.platform },
      select: pushTokenPublicSelect,
    });
  }

  return await prisma.pushToken.create({
    data: { userId, token: input.token, platform: input.platform },
    select: pushTokenPublicSelect,
  });
}

export async function listPushTokens(userId: string) {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { ...pushTokenPublicSelect, token: true },
    orderBy: { createdAt: "desc" },
  });

  return tokens.map(({ token, ...rest }) => ({ ...rest, preview: preview(token) }));
}

export async function revokePushToken(userId: string, tokenId: string) {
  const deleted = await prisma.pushToken.deleteMany({
    where: { id: tokenId, userId },
  });

  if (deleted.count === 0) {
    throw new Error("PUSH_TOKEN_NOT_FOUND");
  }

  return { revoked: true };
}

/** Raw tokens for the push sender; never exposed over HTTP. */
export async function listPushTokenStrings(userId: string): Promise<string[]> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });

  return tokens.map(row => row.token);
}

/** Removes a token Expo reports as no longer installed. */
export async function revokePushTokenById(userId: string, token: string): Promise<void> {
  await prisma.pushToken.deleteMany({
    where: { userId, token },
  });
}

import { prisma } from "../lib/prisma";

export const CONSENT_KINDS = [
  "MICROPHONE",
  "CONTACTS",
  "DOCUMENTS",
  "CLOUD_AI",
] as const;

export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const CONSENT_POLICY_VERSION = "2026-10";

export function isConsentKind(value: string): value is ConsentKind {
  return (CONSENT_KINDS as readonly string[]).includes(value);
}

export async function listConsentRecords(userId: string) {
  return prisma.userConsent.findMany({
    where: { userId },
    orderBy: { kind: "asc" },
  });
}

export async function recordConsent(
  userId: string,
  kind: ConsentKind,
  input: {
    granted: boolean;
    policyVersion?: string;
    source?: string | null;
  }
) {
  const now = new Date();

  return prisma.userConsent.upsert({
    where: { userId_kind: { userId, kind } },
    create: {
      userId,
      kind,
      granted: input.granted,
      policyVersion: input.policyVersion ?? CONSENT_POLICY_VERSION,
      source: input.source ?? null,
      grantedAt: input.granted ? now : null,
      revokedAt: input.granted ? null : now,
    },
    update: {
      granted: input.granted,
      policyVersion: input.policyVersion ?? CONSENT_POLICY_VERSION,
      source: input.source ?? null,
      grantedAt: input.granted ? now : undefined,
      revokedAt: input.granted ? null : now,
    },
  });
}

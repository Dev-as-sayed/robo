import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  userConsent: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));

const {
  CONSENT_POLICY_VERSION,
  isConsentKind,
  listConsentRecords,
  recordConsent,
} = await import("@robo/shared/consents");

describe("consent records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts only known consent kinds", () => {
    expect(isConsentKind("MICROPHONE")).toBe(true);
    expect(isConsentKind("microphone")).toBe(false);
    expect(isConsentKind("LOCATION")).toBe(false);
  });

  it("scopes listing to the current user", async () => {
    db.userConsent.findMany.mockResolvedValue([]);
    await listConsentRecords("user-1");
    expect(db.userConsent.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { kind: "asc" },
    });
  });

  it("grants with an audit timestamp and policy version", async () => {
    db.userConsent.upsert.mockResolvedValue({});
    await recordConsent("user-1", "DOCUMENTS", {
      granted: true,
      source: "document-upload",
    });

    const call = db.userConsent.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({
      userId_kind: { userId: "user-1", kind: "DOCUMENTS" },
    });
    expect(call.create).toMatchObject({
      userId: "user-1",
      kind: "DOCUMENTS",
      granted: true,
      source: "document-upload",
      policyVersion: CONSENT_POLICY_VERSION,
      revokedAt: null,
    });
    expect(call.create.grantedAt).toBeInstanceOf(Date);
  });

  it("revokes without overwriting the original grant timestamp", async () => {
    db.userConsent.upsert.mockResolvedValue({});
    await recordConsent("user-1", "CLOUD_AI", {
      granted: false,
      source: "settings",
    });

    const call = db.userConsent.upsert.mock.calls[0]![0];
    expect(call.update).toMatchObject({
      granted: false,
      source: "settings",
      grantedAt: undefined,
      revokedAt: expect.any(Date),
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  PENDING_ACTION_TTL_MS,
  confirmPendingAction,
  createPendingAction,
  pendingActionUri,
  rejectPendingAction,
  type PendingAction,
  type PendingActionWithUri,
} from "@robo/shared/pending-actions";
import { PendingActionScheduler } from "../src/modules/actions/pending-scheduler";

type Store = NonNullable<Parameters<typeof confirmPendingAction>[3]>;

const NOW = new Date("2026-10-23T12:00:00.000Z");
const CONTACT = {
  id: "contact-1",
  name: "Mom",
  phone: "+1 (555) 010-2000",
  email: "mom@example.com",
};

interface MemoryStore {
  store: Store;
  current: () => PendingAction | null;
}

function memoryStore(): MemoryStore {
  let action: PendingAction | null = null;

  const matches = (where: Record<string, unknown>): boolean => {
    if (!action) return false;
    if (where.id && action.id !== where.id) return false;
    if (where.userId && action.userId !== where.userId) return false;
    if (where.status && action.status !== where.status) return false;
    if (where.contactId && action.contactId !== where.contactId) return false;

    const expiry = where.expiresAt as
      | { gt?: Date; lte?: Date }
      | undefined;
    if (expiry?.gt && !(action.expiresAt > expiry.gt)) return false;
    if (expiry?.lte && !(action.expiresAt <= expiry.lte)) return false;

    return true;
  };

  const store = {
    contact: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === CONTACT.id ? CONTACT : null
      ),
    },
    pendingAction: {
      create: vi.fn(async ({ data }: { data: Partial<PendingAction> }) => {
        action = {
          id: "action-1",
          userId: data.userId!,
          contactId: data.contactId ?? null,
          kind: data.kind!,
          recipientName: data.recipientName!,
          recipientPhone: data.recipientPhone ?? null,
          recipientEmail: data.recipientEmail ?? null,
          body: data.body ?? null,
          status: "PENDING",
          expiresAt: data.expiresAt!,
          confirmedAt: null,
          rejectedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        };
        return action;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<PendingAction>;
        }) => {
          if (!matches(where)) return { count: 0 };
          action = { ...action!, ...data, updatedAt: NOW };
          return { count: 1 };
        }
      ),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        matches(where) ? action : null
      ),
      findMany: vi.fn(async () =>
        action && action.status === "PENDING" ? [action] : []
      ),
    },
  };

  return {
    store: store as unknown as Store,
    current: (): PendingAction | null => action,
  };
}

describe("pendingActionUri", () => {
  it("builds a dial URI from a formatted phone number", () => {
    expect(
      pendingActionUri({
        kind: "CALL",
        recipientPhone: "+1 (555) 010-2000",
        recipientEmail: null,
        body: null,
      })
    ).toBe("tel:+15550102000");
  });

  it("encodes a text body", () => {
    expect(
      pendingActionUri({
        kind: "MESSAGE",
        recipientPhone: "555-0100",
        recipientEmail: null,
        body: "Running late & on my way",
      })
    ).toBe("sms:5550100?body=Running%20late%20%26%20on%20my%20way");
  });

  it("builds mailto and WhatsApp links", () => {
    expect(
      pendingActionUri({
        kind: "EMAIL",
        recipientPhone: null,
        recipientEmail: "mom@example.com",
        body: "Hi",
      })
    ).toContain("mailto:mom@example.com?subject=Message%20from%20Robo&body=Hi");

    expect(
      pendingActionUri({
        kind: "WHATSAPP",
        recipientPhone: "+1 555 0100",
        recipientEmail: null,
        body: "Hi",
      })
    ).toBe("https://wa.me/15550100?text=Hi");
  });

  it("refuses a channel that has no address", () => {
    expect(() =>
      pendingActionUri({
        kind: "CALL",
        recipientPhone: null,
        recipientEmail: null,
        body: null,
      })
    ).toThrow("PENDING_ACTION_MISSING_PHONE");
  });
});

describe("PendingAction lifecycle", () => {
  it("prepares a call with the exact contact recipient and a five-minute expiry", async () => {
    const { store } = memoryStore();
    const action = await createPendingAction(
      "user-1",
      { kind: "CALL", contactId: CONTACT.id },
      NOW,
      store
    );

    expect(action.recipientName).toBe("Mom");
    expect(action.recipientPhone).toBe(CONTACT.phone);
    expect(action.expiresAt.getTime() - NOW.getTime()).toBe(PENDING_ACTION_TTL_MS);
    expect(action.status).toBe("PENDING");
  });

  it("confirms once and returns the recipient's dial URI", async () => {
    const { store } = memoryStore();
    const created = await createPendingAction(
      "user-1",
      { kind: "CALL", contactId: CONTACT.id },
      NOW,
      store
    );
    const confirmed: PendingActionWithUri = await confirmPendingAction(
      "user-1",
      created.id,
      new Date(NOW.getTime() + 1_000),
      store
    );

    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.uri).toBe("tel:+15550102000");
  });

  it("rejects a duplicate confirm", async () => {
    const { store } = memoryStore();
    const created = await createPendingAction(
      "user-1",
      { kind: "CALL", contactId: CONTACT.id },
      NOW,
      store
    );

    await confirmPendingAction("user-1", created.id, NOW, store);
    await expect(
      confirmPendingAction("user-1", created.id, NOW, store)
    ).rejects.toThrow("PENDING_ACTION_ALREADY_RESOLVED");
  });

  it("rejects a confirmation after a rejection", async () => {
    const { store } = memoryStore();
    const created = await createPendingAction(
      "user-1",
      { kind: "CALL", contactId: CONTACT.id },
      NOW,
      store
    );

    await rejectPendingAction("user-1", created.id, NOW, store);
    await expect(
      confirmPendingAction("user-1", created.id, NOW, store)
    ).rejects.toThrow("PENDING_ACTION_ALREADY_RESOLVED");
  });

  it("expires an over-five-minute action and refuses to confirm it", async () => {
    const { store, current } = memoryStore();
    const created = await createPendingAction(
      "user-1",
      { kind: "CALL", contactId: CONTACT.id },
      NOW,
      store
    );

    await expect(
      confirmPendingAction(
        "user-1",
        created.id,
        new Date(NOW.getTime() + PENDING_ACTION_TTL_MS + 1),
        store
      )
    ).rejects.toThrow("PENDING_ACTION_EXPIRED");
    expect(current()?.status).toBe("EXPIRED");
  });

  it("does not let another user confirm the action", async () => {
    const { store } = memoryStore();
    const created = await createPendingAction(
      "user-1",
      { kind: "CALL", contactId: CONTACT.id },
      NOW,
      store
    );

    await expect(
      confirmPendingAction("user-2", created.id, NOW, store)
    ).rejects.toThrow("PENDING_ACTION_NOT_FOUND");
  });

  it("refuses to prepare a message without a body", async () => {
    const { store } = memoryStore();
    await expect(
      createPendingAction(
        "user-1",
        { kind: "MESSAGE", contactId: CONTACT.id, body: "   " },
        NOW,
        store
      )
    ).rejects.toThrow("PENDING_ACTION_BODY_REQUIRED");
  });
});

describe("PendingActionScheduler", () => {
  it("reports how many stale actions were expired", async () => {
    const expire = vi.fn(async () => 3);
    const scheduler = new PendingActionScheduler({ expire, intervalMs: 1_000 });

    await expect(scheduler.tick(NOW)).resolves.toEqual({ expired: 3 });
    expect(expire).toHaveBeenCalledWith(NOW);
  });
});

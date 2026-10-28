import { describe, expect, it } from "vitest";
import { matchContacts, nextClassEnd } from "@robo/shared/contacts";

const now = new Date("2026-10-23T12:00:00.000Z");

function contact(overrides: Record<string, unknown>) {
  return {
    id: "contact-1",
    userId: "user-1",
    name: "Mom",
    phone: "+1 (555) 010-2000",
    email: "mom@example.com",
    group: "Family",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("matchContacts", () => {
  it("prefers an exact match over partial matches", () => {
    const result = matchContacts(
      [
        contact({ id: "a", name: "Ahmed Ali" }),
        contact({ id: "b", name: "Ahmed" }),
        contact({ id: "c", name: "Sara" }),
      ],
      "Ahmed"
    );

    expect(result.ambiguous).toBe(false);
    expect(result.matches[0]?.contact.id).toBe("b");
  });

  it("flags multiple partial matches as ambiguous", () => {
    const result = matchContacts(
      [
        contact({ id: "a", name: "Ahmed Ali" }),
        contact({ id: "b", name: "Ahmed Hassan" }),
      ],
      "Ahmed"
    );

    expect(result.ambiguous).toBe(true);
    expect(result.matches).toHaveLength(2);
  });

  it("matches phone numbers regardless of formatting", () => {
    const result = matchContacts(
      [contact({ id: "a", name: "Mom" })],
      "5550102000"
    );

    expect(result.ambiguous).toBe(false);
    expect(result.matches).toHaveLength(1);
  });

  it("returns no matches for an unknown name", () => {
    expect(matchContacts([contact({})], "Nobody")).toEqual({
      matches: [],
      ambiguous: false,
    });
  });
});

describe("nextClassEnd", () => {
  it("uses the earliest class that has not ended", () => {
    const result = nextClassEnd(
      [
        {
          id: "ended",
          title: "Old",
          startAt: new Date(now.getTime() - 2 * 60 * 60_000),
          endAt: new Date(now.getTime() - 60 * 60_000),
          allDay: false,
        },
        {
          id: "next",
          title: "Physics",
          startAt: new Date(now.getTime() + 30 * 60_000),
          endAt: new Date(now.getTime() + 90 * 60_000),
          allDay: false,
        },
      ],
      now
    );

    expect(result?.id).toBe("next");
  });

  it("defaults a missing end to one hour after the start", () => {
    const startAt = new Date(now.getTime() + 30 * 60_000);
    const result = nextClassEnd(
      [{ id: "class", title: "Physics", startAt, endAt: null, allDay: false }],
      now
    );

    expect(result?.endAt).toEqual(
      new Date(startAt.getTime() + 60 * 60_000)
    );
  });
});

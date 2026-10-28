import { expect } from "vitest";

type Owned = { id: string; userId: string };

export function findOwned<T extends Owned>(
  rows: readonly T[],
  where: { id?: string; userId?: string }
): T | null {
  return (
    rows.find(
      row =>
        (!where.id || row.id === where.id) &&
        (!where.userId || row.userId === where.userId)
    ) ?? null
  );
}

export function filterOwned<T extends Owned>(
  rows: readonly T[],
  userId: string
): T[] {
  return rows.filter(row => row.userId === userId);
}

/**
 * Asserts that `read(owner, id)` returns the resource and that `read(other, id)`
 * cannot see it. Shared readers either return null or throw a *_NOT_FOUND error.
 */
export async function expectOwnershipIsolation<T>(options: {
  ownerId: string;
  otherId: string;
  id: string;
  read: (userId: string, id: string) => Promise<T | null>;
  missingError?: string;
}): Promise<void> {
  await expect(options.read(options.ownerId, options.id)).resolves.toBeTruthy();

  if (options.missingError) {
    await expect(
      options.read(options.otherId, options.id)
    ).rejects.toThrow(options.missingError);
    return;
  }

  await expect(options.read(options.otherId, options.id)).resolves.toBeNull();
}

import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  refreshToken: { updateMany: vi.fn() },
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));

const { logoutByRefreshToken } = await import("@robo/shared/auth");
const { default: authRoutes } = await import("../src/modules/auth/routes");
const { errorHandler } = await import("../src/middleware/error-handler");

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("logoutByRefreshToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes the presented refresh token without an access token", async () => {
    db.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(logoutByRefreshToken("refresh-token")).resolves.toEqual({
      revoked: 1,
    });
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken("refresh-token"),
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("scopes the revocation to the authenticated user", async () => {
    db.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(logoutByRefreshToken("refresh-token", "user-1")).resolves.toEqual({ revoked: 1 });
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken("refresh-token"),
        userId: "user-1",
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("is idempotent when the token is already revoked or unknown", async () => {
    db.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(logoutByRefreshToken("used-token")).resolves.toEqual({
      revoked: 0,
    });
  });
});

describe("POST /auth/logout", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/auth", authRoutes);
    app.use(errorHandler);

    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("no test port");
    }
    baseUrl = `http://127.0.0.1:${address.port}/api/v1/auth`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("revokes a refresh token without an access token", async () => {
    db.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const response = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "refresh-token" }),
    });
    const body = (await response.json()) as {
      success: boolean;
      data: { revoked: number };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: { revoked: 1 },
      }),
    );
  });

  it("requires an access token to revoke all sessions", async () => {
    const response = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "refresh-token", allSessions: true }),
    });

    expect(response.status).toBe(401);
    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a logout request without any credential", async () => {
    const response = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(401);
  });
});

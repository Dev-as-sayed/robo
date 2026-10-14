import { v4 as uuidv4 } from "uuid";
import argon2 from "argon2";
import { jwtSign, jwtVerify } from "./jwt";

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

const users = new Map<string, User>();

export async function register(input: { email: string; password: string; name: string }) {
  const existing = users.get(input.email);
  if (existing) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const hashedPassword = await argon2.hash(input.password);
  const user: User = {
    id: uuidv4(),
    email: input.email,
    name: input.name,
    createdAt: new Date(),
  };

  // Store hashed password securely (in production, use a database)
  users.set(input.email, { ...user, passwordHash: hashedPassword });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token: jwtSign(user.id),
  };
}

export async function login(input: { email: string; password: string }) {
  const user = users.get(input.email);
  if (!user || !user.passwordHash) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordValid = await argon2.verify(user.passwordHash, input.password);
  if (!passwordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token: jwtSign(user.id),
  };
}

export function verifyToken(token: string) {
  return jwtVerify(token);
}

export function revokeToken(userId: string) {
  // In production, mark token as revoked in DB
  // For now, just acknowledge
  return { success: true };
}
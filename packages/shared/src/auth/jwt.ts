import { sign, verify } from "jsonwebtoken";

export function jwtSign(userId: string, secret?: string) {
  const s = secret || process.env.JWT_SECRET || "secret";
  return sign({ sub: userId, iat: Math.floor(Date.now() / 1000) }, s, { expiresIn: "7d" });
}

export function jwtVerify(token: string, secret?: string) {
  const s = secret || process.env.JWT_SECRET || "secret";
  return verify(token, s) as { sub: string; iat: number };
}
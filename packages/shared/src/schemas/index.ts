import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(50),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const devicePairingSchema = z.object({
  deviceId: z.string().uuid(),
  token: z.string().min(1),
  firmwareVersion: z.string().optional(),
  locale: z.string().optional(),
});

export const chatMessageSchema = z.object({
  content: z.string().min(1),
  type: z.enum(["text", "voice"]).default("text"),
  conversationId: z.string().uuid().optional(),
});

export const quietHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^([01]\\d|2[0-3]):([0-5]\\d)$/),
  end: z.string().regex(/^([01]\\d|2[0-3]):([0-5]\\d)$/),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DevicePairingInput = z.infer<typeof devicePairingSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type QuietHoursInput = z.infer<typeof quietHoursSchema>;
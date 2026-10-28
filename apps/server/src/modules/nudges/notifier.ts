import type { NudgeCandidate } from "@robo/shared/nudges";
import type { DeviceServerMessage } from "@robo/shared/realtime";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";
import { sendPushToUser } from "../reminders/expo-push";

interface NudgeNotifierOptions {
  notifyUser: (userId: string, message: DeviceServerMessage) => number;
  push?: typeof sendPushToUser;
  logger?: RealtimeLogger;
}

export function createNudgeNotifier(
  options: NudgeNotifierOptions
): (userId: string, nudge: NudgeCandidate) => Promise<string[]> {
  const log = options.logger ?? logger;
  const push = options.push ?? sendPushToUser;

  return async (userId, nudge): Promise<string[]> => {
    const channels: string[] = [];
    const message: DeviceServerMessage = {
      type: "display",
      kind: "text",
      title: nudge.title,
      body: nudge.body,
    };

    const sockets = options.notifyUser(userId, message);
    if (sockets > 0) {
      channels.push("device");
    }

    const result = await push({
      userId,
      title: nudge.title,
      body: nudge.body,
      data: { kind: "nudge", nudgeType: nudge.type },
    });

    if (result.sent > 0) {
      channels.push("push");
    }
    if (result.failed > 0) {
      log.warn({ userId, type: nudge.type, failed: result.failed }, "nudge push failed");
    }

    return channels;
  };
}

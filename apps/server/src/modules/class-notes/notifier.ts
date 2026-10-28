import type { DueClassNotePrompt } from "@robo/shared/class-notes";
import type { DeviceServerMessage } from "@robo/shared/realtime";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";
import { sendPushToUser } from "../reminders/expo-push";

interface ClassNoteNotifierOptions {
  notifyUser: (userId: string, message: DeviceServerMessage) => number;
  push?: typeof sendPushToUser;
  logger?: RealtimeLogger;
}

export function createClassNoteNotifier(
  options: ClassNoteNotifierOptions
): (due: DueClassNotePrompt) => Promise<boolean> {
  const log = options.logger ?? logger;
  const push = options.push ?? sendPushToUser;

  return async (due): Promise<boolean> => {
    const title = `How was ${due.title}?`;
    const body = "Tap to save a quick class note while it is fresh.";
    const message: DeviceServerMessage = {
      type: "display",
      kind: "text",
      title,
      body,
    };

    const sockets = options.notifyUser(due.userId, message);
    const result = await push({
      userId: due.userId,
      title,
      body,
      data: {
        kind: "class_note",
        scheduleEntryId: due.id,
        subject: due.subject ?? "",
      },
    }).catch((error: unknown) => {
      log.warn(
        { err: error, userId: due.userId, scheduleId: due.id },
        "class note prompt push failed"
      );
      return { sent: 0, failed: 1 };
    });

    return sockets > 0 || result.sent > 0;
  };
}

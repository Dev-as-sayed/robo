import { prisma } from "@robo/shared/lib/prisma";
import { claimDueReminders, type DueReminder } from "@robo/shared/reminders";
import { ReminderScheduler } from "../modules/reminders/scheduler";

const TARGET_LATENCY_MS = 30_000;
const TICK_INTERVAL_MS = 15_000;

const silentLogger = {
  info: (): void => undefined,
  warn: (): void => undefined,
  error: (): void => undefined,
  debug: (): void => undefined,
};

/**
 * Measures the worst-case gap between a reminder's due slot and the scheduler tick
 * that claims it. A reminder that becomes due just after a tick is the worst case:
 * it waits one full interval, so the default 15 s poll must stay below the 30 s target.
 */
async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");

  console.log(
    `Checks reminder delivery latency against a ${TARGET_LATENCY_MS / 1_000} s target ` +
      `with a ${TICK_INTERVAL_MS / 1_000} s scheduler interval.`
  );

  if (!execute) {
    console.log("Dry run. Pass --execute with DATABASE_URL set.");
    return;
  }

  const email = `reminder-latency-${Date.now()}@example.test`;
  const user = await prisma.user.create({
    data: { email, timezone: "UTC" },
    select: { id: true },
  });

  let reminderId: string | null = null;

  try {
    const previousTick = new Date(Date.now() - TICK_INTERVAL_MS);
    const dueAt = new Date(previousTick.getTime() + 1);
    const reminder = await prisma.reminder.create({
      data: {
        userId: user.id,
        text: "Reminder latency verification",
        at: dueAt,
        nextAt: dueAt,
        status: "active",
        channels: ["device"],
      },
      select: { id: true },
    });
    reminderId = reminder.id;

    const delivered: string[] = [];
    const scheduler = new ReminderScheduler({
      intervalMs: TICK_INTERVAL_MS,
      claim: (now, limit) => claimDueReminders(now, limit),
      deliver: (due: DueReminder): string[] => {
        delivered.push(due.id);
        return ["verify"];
      },
      logger: silentLogger,
    });

    const beforeDue = await scheduler.tick(previousTick);
    if (beforeDue.claimed !== 0) {
      throw new Error("A reminder was claimed before its due slot.");
    }

    const now = new Date(previousTick.getTime() + TICK_INTERVAL_MS);
    const summary = await scheduler.tick(now);

    if (!delivered.includes(reminder.id)) {
      throw new Error("The due reminder was not delivered.");
    }

    if (summary.maxLatencyMs > TARGET_LATENCY_MS) {
      throw new Error(
        `Reminder latency ${summary.maxLatencyMs} ms exceeds the ${TARGET_LATENCY_MS} ms target.`
      );
    }

    const stored = await prisma.reminder.findUnique({
      where: { id: reminder.id },
      select: { status: true, lastFiredAt: true },
    });

    if (stored?.status !== "completed" || !stored.lastFiredAt) {
      throw new Error("The reminder was not marked complete after delivery.");
    }

    console.log(
      `Worst-case latency: ${summary.maxLatencyMs} ms (target ${TARGET_LATENCY_MS} ms).`
    );
    console.log("Reminder latency verification passed.");
  } finally {
    if (reminderId) {
      await prisma.reminderDelivery.deleteMany({ where: { reminderId } });
      await prisma.reminder.deleteMany({ where: { id: reminderId } });
    }
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

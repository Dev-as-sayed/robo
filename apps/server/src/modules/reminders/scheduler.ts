import logger from "../../lib/logger";
import { claimDueReminders, type DueReminder } from "@robo/shared/reminders";
import type { RealtimeLogger } from "../realtime/gateway";

/** How many due rows one tick takes. A full batch is logged, never silently dropped. */
export const DUE_REMINDER_BATCH_SIZE = 50;

export interface TickSummary {
  claimed: number;
  delivered: number;

  /** Worst gap between the due slot and the tick that claimed it. */
  maxLatencyMs: number;
}

/** `deliver` returns the channels that accepted the reminder. */
export interface ReminderSchedulerOptions {
  deliver: (due: DueReminder) => Promise<string[]> | string[];
  claim?: (now: Date, limit: number) => Promise<DueReminder[]>;
  retry?: (now: Date) => Promise<number>;
  intervalMs?: number;
  logger?: RealtimeLogger;
}

/**
 * Fires reminders by polling the database on a fixed interval. The database is the
 * source of truth, so a restart loses nothing: rows still hold their `nextAt` slot and
 * the next tick picks them up. Claiming is atomic per row, so running two processes
 * against the same database does not double-fire.
 */
export class ReminderScheduler {
  private readonly deliver: (due: DueReminder) => Promise<string[]> | string[];
  private readonly claim: (now: Date, limit: number) => Promise<DueReminder[]>;
  private readonly retry: ((now: Date) => Promise<number>) | null;
  private readonly intervalMs: number;
  private readonly log: RealtimeLogger;
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<TickSummary> | null = null;
  private stopped = false;

  constructor(options: ReminderSchedulerOptions) {
    this.deliver = options.deliver;
    this.claim = options.claim ?? claimDueReminders;
    this.retry = options.retry ?? null;
    this.intervalMs = options.intervalMs ?? 15_000;
    this.log = options.logger ?? logger;
  }

  start(): void {
    if (this.timer || this.stopped) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        this.log.error({ err: error }, "reminder tick failed");
      });
    }, this.intervalMs);
    this.timer.unref();
    this.log.info({ intervalMs: this.intervalMs }, "reminder scheduler started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.stopped = true;
  }

  /** Overlapping calls share one pass, so a slow delivery never stacks ticks. */
  tick(now = new Date()): Promise<TickSummary> {
    if (this.ticking) {
      return this.ticking;
    }

    this.ticking = this.run(now);
    void this.ticking.finally(() => {
      this.ticking = null;
    });

    return this.ticking;
  }

  private async run(now: Date): Promise<TickSummary> {
    const due = await this.claim(now, DUE_REMINDER_BATCH_SIZE);
    let delivered = 0;
    let maxLatencyMs = 0;

    for (const reminder of due) {
      const latencyMs = now.getTime() - reminder.dueAt.getTime();
      maxLatencyMs = Math.max(maxLatencyMs, latencyMs);

      try {
        // The row left the due set when it was claimed, so a delivery failure loses
        // this fire rather than replaying it on the next tick.
        const channels = await this.deliver(reminder);
        if (channels.length > 0) {
          delivered += 1;
        }

        this.log.info(
          {
            userId: reminder.userId,
            reminderId: reminder.id,
            channels,
            latencyMs,
            recurring: Boolean(reminder.rrule),
          },
          "reminder fired"
        );
      } catch (error) {
        this.log.error(
          { err: error, userId: reminder.userId, reminderId: reminder.id },
          "reminder delivery failed"
        );
      }
    }

    if (due.length === DUE_REMINDER_BATCH_SIZE) {
      this.log.warn({ batch: due.length }, "due reminders filled the batch; more may be waiting");
    }

    if (this.retry) {
      try {
        const retried = await this.retry(now);
        if (retried > 0) {
          this.log.info({ retried }, "failed reminder deliveries retried");
        }
      } catch (error) {
        this.log.warn({ err: error }, "failed delivery retry pass failed");
      }
    }

    return { claimed: due.length, delivered, maxLatencyMs };
  }
}

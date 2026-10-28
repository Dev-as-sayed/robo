import { claimDueClassAlerts, type DueClass } from "@robo/shared/schedule";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";

const CLASS_ALERT_BATCH_SIZE = 50;

export interface ClassAlertSchedulerOptions {
  deliver: (due: DueClass) => Promise<boolean> | boolean;
  claim?: (now: Date, limit: number) => Promise<DueClass[]>;
  intervalMs?: number;
  logger?: RealtimeLogger;
}

/** Polls `ScheduleEntry.alertAt` and clears each slot exactly once. */
export class ClassAlertScheduler {
  private readonly deliver: ClassAlertSchedulerOptions["deliver"];
  private readonly claim: NonNullable<ClassAlertSchedulerOptions["claim"]>;
  private readonly intervalMs: number;
  private readonly log: RealtimeLogger;
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<number> | null = null;
  private stopped = false;

  constructor(options: ClassAlertSchedulerOptions) {
    this.deliver = options.deliver;
    this.claim = options.claim ?? claimDueClassAlerts;
    this.intervalMs = options.intervalMs ?? 15_000;
    this.log = options.logger ?? logger;
  }

  start(): void {
    if (this.timer || this.stopped) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        this.log.error({ err: error }, "class alert tick failed");
      });
    }, this.intervalMs);
    this.timer.unref();
    this.log.info({ intervalMs: this.intervalMs }, "class alert scheduler started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.stopped = true;
  }

  tick(now = new Date()): Promise<number> {
    if (this.ticking) {
      return this.ticking;
    }

    this.ticking = this.run(now);
    void this.ticking.finally(() => {
      this.ticking = null;
    });

    return this.ticking;
  }

  private async run(now: Date): Promise<number> {
    const due = await this.claim(now, CLASS_ALERT_BATCH_SIZE);
    let delivered = 0;

    for (const alert of due) {
      const latencyMs = now.getTime() - alert.dueAt.getTime();

      try {
        const accepted = await this.deliver(alert);
        if (accepted) {
          delivered += 1;
        }

        this.log.info(
          {
            userId: alert.userId,
            scheduleId: alert.id,
            accepted,
            latencyMs,
            startsAt: alert.startsAt.toISOString(),
          },
          "class alert fired"
        );
      } catch (error) {
        this.log.error(
          { err: error, userId: alert.userId, scheduleId: alert.id },
          "class alert delivery failed"
        );
      }
    }

    return delivered;
  }
}

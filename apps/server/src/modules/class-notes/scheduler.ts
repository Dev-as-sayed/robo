import {
  claimDueClassNotePrompts,
  type DueClassNotePrompt,
} from "@robo/shared/class-notes";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";

const BATCH_SIZE = 50;

export interface ClassNoteSchedulerOptions {
  deliver: (due: DueClassNotePrompt) => Promise<boolean> | boolean;
  claim?: (now: Date, limit: number) => Promise<DueClassNotePrompt[]>;
  intervalMs?: number;
  logger?: RealtimeLogger;
}

/** Asks for a short note shortly after a class ends, once per class occurrence. */
export class ClassNoteScheduler {
  private readonly deliver: ClassNoteSchedulerOptions["deliver"];
  private readonly claim: NonNullable<ClassNoteSchedulerOptions["claim"]>;
  private readonly intervalMs: number;
  private readonly log: RealtimeLogger;
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<number> | null = null;
  private stopped = false;

  constructor(options: ClassNoteSchedulerOptions) {
    this.deliver = options.deliver;
    this.claim = options.claim ?? claimDueClassNotePrompts;
    this.intervalMs = options.intervalMs ?? 60_000;
    this.log = options.logger ?? logger;
  }

  start(): void {
    if (this.timer || this.stopped) return;

    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        this.log.error({ err: error }, "class note prompt tick failed");
      });
    }, this.intervalMs);
    this.timer.unref();
    this.log.info(
      { intervalMs: this.intervalMs },
      "class note prompt scheduler started"
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopped = true;
  }

  tick(now = new Date()): Promise<number> {
    if (this.ticking) return this.ticking;

    this.ticking = this.run(now);
    void this.ticking.finally(() => {
      this.ticking = null;
    });

    return this.ticking;
  }

  private async run(now: Date): Promise<number> {
    const due = await this.claim(now, BATCH_SIZE);
    let delivered = 0;

    for (const prompt of due) {
      try {
        const accepted = await this.deliver(prompt);
        if (accepted) delivered += 1;
        this.log.info(
          {
            userId: prompt.userId,
            scheduleId: prompt.id,
            accepted,
            endedAt: prompt.endedAt.toISOString(),
          },
          "class note prompt fired"
        );
      } catch (error) {
        this.log.error(
          { err: error, userId: prompt.userId, scheduleId: prompt.id },
          "class note prompt failed"
        );
      }
    }

    return delivered;
  }
}

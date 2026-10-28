import { claimDueTodoDeadlines, type DueTodoDeadline } from "@robo/shared/todos";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";

const DEADLINE_BATCH_SIZE = 50;

export interface TodoDeadlineSchedulerOptions {
  deliver: (due: DueTodoDeadline) => Promise<boolean> | boolean;
  claim?: (now: Date, limit: number) => Promise<DueTodoDeadline[]>;
  intervalMs?: number;
  logger?: RealtimeLogger;
}

/** Polls pending todos for the 24-hour and 2-hour warning slots. */
export class TodoDeadlineScheduler {
  private readonly deliver: TodoDeadlineSchedulerOptions["deliver"];
  private readonly claim: NonNullable<TodoDeadlineSchedulerOptions["claim"]>;
  private readonly intervalMs: number;
  private readonly log: RealtimeLogger;
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<number> | null = null;
  private stopped = false;

  constructor(options: TodoDeadlineSchedulerOptions) {
    this.deliver = options.deliver;
    this.claim = options.claim ?? claimDueTodoDeadlines;
    this.intervalMs = options.intervalMs ?? 15_000;
    this.log = options.logger ?? logger;
  }

  start(): void {
    if (this.timer || this.stopped) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        this.log.error({ err: error }, "deadline tick failed");
      });
    }, this.intervalMs);
    this.timer.unref();
    this.log.info({ intervalMs: this.intervalMs }, "deadline scheduler started");
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
    const due = await this.claim(now, DEADLINE_BATCH_SIZE);
    let delivered = 0;

    for (const deadline of due) {
      try {
        const accepted = await this.deliver(deadline);
        if (accepted) {
          delivered += 1;
        }

        this.log.info(
          {
            userId: deadline.userId,
            todoId: deadline.id,
            window: deadline.window,
            accepted,
            dueAt: deadline.dueAt.toISOString(),
          },
          "deadline warning fired"
        );
      } catch (error) {
        this.log.error(
          { err: error, userId: deadline.userId, todoId: deadline.id },
          "deadline warning delivery failed"
        );
      }
    }

    return delivered;
  }
}

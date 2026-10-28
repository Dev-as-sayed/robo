import { expirePendingActions } from "@robo/shared/pending-actions";
import type { Logger } from "pino";

interface PendingActionSchedulerOptions {
  intervalMs?: number;
  logger?: Pick<Logger, "info" | "warn" | "error">;
  expire?: (now: Date) => Promise<number>;
}

export class PendingActionScheduler {
  private readonly intervalMs: number;
  private readonly logger?: Pick<Logger, "info" | "warn" | "error">;
  private readonly expire: (now: Date) => Promise<number>;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: PendingActionSchedulerOptions = {}) {
    this.intervalMs = options.intervalMs ?? 30_000;
    this.logger = options.logger;
    this.expire = options.expire ?? ((now: Date): Promise<number> => expirePendingActions(now));
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) => {
        this.logger?.error({ err: error }, "pending action expiry tick failed");
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(now: Date = new Date()): Promise<{ expired: number }> {
    const expired = await this.expire(now);
    if (expired > 0) {
      this.logger?.info({ expired }, "expired pending actions");
    }

    return { expired };
  }
}

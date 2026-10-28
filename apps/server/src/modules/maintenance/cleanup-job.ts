import {
  runDataCleanup,
  type CleanupCounts,
} from "@robo/shared/maintenance";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";

export interface DataCleanupJobOptions {
  retentionDays: number;
  intervalMs?: number;
  run?: (options: { retentionDays: number; now: Date }) => Promise<CleanupCounts>;
  logger?: RealtimeLogger;
}

/** Deletes data older than the retention window once a day. */
export class DataCleanupJob {
  private readonly retentionDays: number;
  private readonly intervalMs: number;
  private readonly runCleanup: NonNullable<DataCleanupJobOptions["run"]>;
  private readonly log: RealtimeLogger;
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<CleanupCounts | null> | null = null;
  private stopped = false;

  constructor(options: DataCleanupJobOptions) {
    this.retentionDays = options.retentionDays;
    this.intervalMs = options.intervalMs ?? 86_400_000;
    this.runCleanup = options.run ?? runDataCleanup;
    this.log = options.logger ?? logger;
  }

  start(): void {
    if (this.timer || this.stopped) return;

    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        this.log.error({ err: error }, "data cleanup failed");
      });
    }, this.intervalMs);
    this.timer.unref();
    this.log.info(
      { intervalMs: this.intervalMs, retentionDays: this.retentionDays },
      "data cleanup job started"
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopped = true;
  }

  tick(now = new Date()): Promise<CleanupCounts | null> {
    if (this.ticking) return this.ticking;

    this.ticking = this.run(now).finally(() => {
      this.ticking = null;
    });
    return this.ticking;
  }

  private async run(now: Date): Promise<CleanupCounts> {
    const counts = await this.runCleanup({
      retentionDays: this.retentionDays,
      now,
    });
    this.log.info(
      { ...counts, retentionDays: this.retentionDays },
      "data cleanup completed"
    );
    return counts;
  }
}

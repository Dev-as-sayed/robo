import { aggregateYesterdayForAllUsers } from "@robo/shared/analytics";
import logger from "../../lib/logger";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Nightly rollup in an in-process timer. The upsert is idempotent, so an hourly pass
 * is harmless and lets a restarted server catch up without a separate cron.
 */
export class DailyStatsJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly intervalMs = HOUR_MS) {}

  start(): void {
    if (this.timer) return;

    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(now = new Date()): Promise<number> {
    if (this.running) return 0;

    this.running = true;
    try {
      const aggregated = await aggregateYesterdayForAllUsers(now);
      logger.info({ users: aggregated }, "daily stats aggregated");
      return aggregated;
    } catch (error) {
      logger.error({ err: error }, "daily stats aggregation failed");
      return 0;
    } finally {
      this.running = false;
    }
  }
}

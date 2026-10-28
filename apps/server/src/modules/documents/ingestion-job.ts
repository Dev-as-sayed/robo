import type { Document } from "@robo/shared/documents";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";
import type { IngestionResult } from "./ingestion";
import { createDocumentIngestionRunner } from "./ingestion-runner";
import {
  claimDocumentForIngestion,
  markIngestionFailure,
  queueEmbeddingReindexes,
} from "./queue";

export interface IngestionTickSummary {
  claimed: number;
  indexed: number;
  failed: number;
  retried: number;
  reindexed: number;
}

export interface DocumentIngestionJobOptions {
  intervalMs?: number;
  staleAfterMs?: number;
  maxAttempts?: number;
  backoffBaseMs?: number;
  reindexEnabled?: boolean;
  reindexIntervalMs?: number;
  embeddingModel: string;
  claim?: (options: { now: Date; staleAfterMs: number }) => Promise<Document | null>;
  fail?: (
    document: Pick<Document, "id" | "userId" | "attempts">,
    error: unknown,
    options: { now: Date; maxAttempts: number; backoffBaseMs: number }
  ) => Promise<"retry" | "failed">;
  reindex?: (embeddingModel: string, now: Date) => Promise<number>;
  run?: (document: Document) => Promise<IngestionResult>;
  logger?: RealtimeLogger;
}

/**
 * Polls the database for uploaded documents and indexes them one at a time. The
 * database is the queue, matching the reminder job: restarts lose nothing and stale
 * locks are reclaimed after a timeout.
 */
export class DocumentIngestionJob {
  private readonly intervalMs: number;
  private readonly staleAfterMs: number;
  private readonly maxAttempts: number;
  private readonly backoffBaseMs: number;
  private readonly reindexEnabled: boolean;
  private readonly reindexIntervalMs: number;
  private readonly embeddingModel: string;
  private readonly claim: NonNullable<DocumentIngestionJobOptions["claim"]>;
  private readonly fail: NonNullable<DocumentIngestionJobOptions["fail"]>;
  private readonly reindex: NonNullable<DocumentIngestionJobOptions["reindex"]>;
  private readonly run: NonNullable<DocumentIngestionJobOptions["run"]>;
  private readonly log: RealtimeLogger;
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<IngestionTickSummary> | null = null;
  private stopped = false;
  private lastReindexAt = 0;

  constructor(options: DocumentIngestionJobOptions) {
    this.intervalMs = options.intervalMs ?? 5_000;
    this.staleAfterMs = options.staleAfterMs ?? 15 * 60_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.backoffBaseMs = options.backoffBaseMs ?? 30_000;
    this.reindexEnabled = options.reindexEnabled ?? true;
    this.reindexIntervalMs = options.reindexIntervalMs ?? 3_600_000;
    this.embeddingModel = options.embeddingModel;
    this.claim = options.claim ?? claimDocumentForIngestion;
    this.fail = options.fail ?? markIngestionFailure;
    this.reindex = options.reindex ?? queueEmbeddingReindexes;
    this.run = options.run ?? createDocumentIngestionRunner();
    this.log = options.logger ?? logger;
  }

  start(): void {
    if (this.timer || this.stopped) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        this.log.error({ err: error }, "document ingestion tick failed");
      });
    }, this.intervalMs);
    this.timer.unref();
    this.log.info(
      { intervalMs: this.intervalMs, embeddingModel: this.embeddingModel },
      "document ingestion job started"
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopped = true;
  }

  tick(now = new Date()): Promise<IngestionTickSummary> {
    if (this.ticking) {
      return this.ticking;
    }

    this.ticking = this.runTick(now).finally(() => {
      this.ticking = null;
    });
    return this.ticking;
  }

  private async runTick(now: Date): Promise<IngestionTickSummary> {
    const summary: IngestionTickSummary = {
      claimed: 0,
      indexed: 0,
      failed: 0,
      retried: 0,
      reindexed: 0,
    };

    if (
      this.reindexEnabled &&
      now.getTime() - this.lastReindexAt >= this.reindexIntervalMs
    ) {
      this.lastReindexAt = now.getTime();
      try {
        summary.reindexed = await this.reindex(this.embeddingModel, now);
        if (summary.reindexed > 0) {
          this.log.info(
            { count: summary.reindexed, embeddingModel: this.embeddingModel },
            "documents queued for embedding re-index"
          );
        }
      } catch (error) {
        this.log.warn({ err: error }, "embedding re-index scan failed");
      }
    }

    const document = await this.claim({ now, staleAfterMs: this.staleAfterMs });
    if (!document) {
      return summary;
    }

    summary.claimed = 1;

    try {
      const result = await this.run(document);
      summary.indexed = 1;
      this.log.info(
        {
          documentId: document.id,
          userId: document.userId,
          pageCount: result.pageCount,
          chunkCount: result.chunkCount,
          usedOcr: result.usedOcr,
        },
        "document indexed"
      );
    } catch (error) {
      const outcome = await this.fail(document, error, {
        now,
        maxAttempts: this.maxAttempts,
        backoffBaseMs: this.backoffBaseMs,
      });
      if (outcome === "retry") {
        summary.retried = 1;
        this.log.warn(
          { err: error, documentId: document.id, attempts: document.attempts },
          "document ingestion failed; retry scheduled"
        );
      } else {
        summary.failed = 1;
        this.log.error(
          { err: error, documentId: document.id, attempts: document.attempts },
          "document ingestion failed permanently"
        );
      }
    }

    return summary;
  }
}

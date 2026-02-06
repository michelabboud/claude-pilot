import { EventEmitter } from "events";
import { PendingMessageStore, PersistentPendingMessage } from "../sqlite/PendingMessageStore.js";
import type { PendingMessageWithId } from "../worker-types.js";
import { logger } from "../../utils/logger.js";

export const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
export const DEFAULT_BATCH_SIZE = 10;

export interface CreateIteratorOptions {
  sessionDbId: number;
  signal: AbortSignal;
  onIdleTimeout?: () => void;
  idleTimeoutMs?: number;
}

export interface CreateBatchIteratorOptions extends CreateIteratorOptions {
  maxBatchSize?: number;
}

export class SessionQueueProcessor {
  constructor(
    private store: PendingMessageStore,
    private events: EventEmitter,
  ) {}

  /**
   * Create an async iterator that yields messages as they become available.
   * Uses atomic claim-and-delete to prevent duplicates.
   * The queue is a pure buffer: claim it, delete it, process in memory.
   * Waits for 'message' event when queue is empty, with idle timeout to prevent zombie processes.
   */
  async *createIterator(options: CreateIteratorOptions): AsyncIterableIterator<PendingMessageWithId> {
    const { sessionDbId, signal, onIdleTimeout, idleTimeoutMs = IDLE_TIMEOUT_MS } = options;
    let lastActivityTime = Date.now();

    while (!signal.aborted) {
      try {
        const persistentMessage = this.store.claimAndDelete(sessionDbId);

        if (persistentMessage) {
          lastActivityTime = Date.now();
          yield this.toPendingMessageWithId(persistentMessage);
        } else {
          const messageReceived = await this.waitForMessage(signal, idleTimeoutMs);

          if (!messageReceived && !signal.aborted) {
            const idleDuration = Date.now() - lastActivityTime;
            if (idleDuration >= idleTimeoutMs) {
              logger.info("SESSION", "Iterator exiting due to idle timeout", {
                sessionDbId,
                idleMs: idleDuration,
                thresholdMs: idleTimeoutMs,
              });
              onIdleTimeout?.();
              return;
            }
            lastActivityTime = Date.now();
          }
        }
      } catch (error) {
        if (signal.aborted) return;
        logger.error("SESSION", "Error in queue processor loop", { sessionDbId }, error as Error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Create an async iterator that yields batches of messages.
   * Drains all available messages (up to maxBatchSize) before yielding.
   * When queue is empty, waits for 'message' event then drains again.
   */
  async *createBatchIterator(options: CreateBatchIteratorOptions): AsyncIterableIterator<PendingMessageWithId[]> {
    const {
      sessionDbId,
      signal,
      onIdleTimeout,
      idleTimeoutMs = IDLE_TIMEOUT_MS,
      maxBatchSize = DEFAULT_BATCH_SIZE,
    } = options;
    let lastActivityTime = Date.now();

    while (!signal.aborted) {
      try {
        const persistentMessages = this.store.claimAndDeleteBatch(sessionDbId, maxBatchSize);

        if (persistentMessages.length > 0) {
          lastActivityTime = Date.now();
          yield persistentMessages.map((m) => this.toPendingMessageWithId(m));
        } else {
          const messageReceived = await this.waitForMessage(signal, idleTimeoutMs);

          if (!messageReceived && !signal.aborted) {
            const idleDuration = Date.now() - lastActivityTime;
            if (idleDuration >= idleTimeoutMs) {
              logger.info("SESSION", "Batch iterator exiting due to idle timeout", {
                sessionDbId,
                idleMs: idleDuration,
                thresholdMs: idleTimeoutMs,
              });
              onIdleTimeout?.();
              return;
            }
            lastActivityTime = Date.now();
          }
        }
      } catch (error) {
        if (signal.aborted) return;
        logger.error("SESSION", "Error in batch queue processor loop", { sessionDbId }, error as Error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private toPendingMessageWithId(msg: PersistentPendingMessage): PendingMessageWithId {
    const pending = this.store.toPendingMessage(msg);
    return {
      ...pending,
      _persistentId: msg.id,
      _originalTimestamp: msg.created_at_epoch,
    };
  }

  private waitForMessage(signal: AbortSignal, timeoutMs?: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const onMessage = () => {
        cleanup();
        resolve(true);
      };

      const onAbort = () => {
        cleanup();
        resolve(false);
      };

      let timer: ReturnType<typeof setTimeout> | undefined;

      const onTimeout = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        this.events.off("message", onMessage);
        signal.removeEventListener("abort", onAbort);
        if (timer !== undefined) clearTimeout(timer);
      };

      this.events.once("message", onMessage);
      signal.addEventListener("abort", onAbort, { once: true });

      if (timeoutMs !== undefined) {
        timer = setTimeout(onTimeout, timeoutMs);
      }
    });
  }
}

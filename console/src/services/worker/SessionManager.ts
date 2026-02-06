/**
 * SessionManager: Event-driven session lifecycle
 *
 * Responsibility:
 * - Manage active session lifecycle
 * - Handle event-driven message queues
 * - Coordinate between HTTP requests and SDK agent
 * - Zero-latency event notification (no polling)
 */

import { EventEmitter } from "events";
import { DatabaseManager } from "./DatabaseManager.js";
import { logger } from "../../utils/logger.js";
import type { ActiveSession, PendingMessage, PendingMessageWithId, ObservationData } from "../worker-types.js";
import { PendingMessageStore } from "../sqlite/PendingMessageStore.js";
import { SessionQueueProcessor } from "../queue/SessionQueueProcessor.js";

export class SessionManager {
  private dbManager: DatabaseManager;
  private sessions: Map<number, ActiveSession> = new Map();
  private sessionQueues: Map<number, EventEmitter> = new Map();
  private onSessionDeletedCallback?: () => void;
  private pendingStore: PendingMessageStore | null = null;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Get or create PendingMessageStore (lazy initialization to avoid circular dependency)
   */
  private getPendingStore(): PendingMessageStore {
    if (!this.pendingStore) {
      const sessionStore = this.dbManager.getSessionStore();
      this.pendingStore = new PendingMessageStore(sessionStore.db, 3);
    }
    return this.pendingStore;
  }

  /**
   * Set callback to be called when a session is deleted (for broadcasting status)
   */
  setOnSessionDeleted(callback: () => void): void {
    this.onSessionDeletedCallback = callback;
  }

  /**
   * Initialize a new session or return existing one
   */
  initializeSession(sessionDbId: number, currentUserPrompt?: string, promptNumber?: number): ActiveSession {
    logger.debug("SESSION", "initializeSession called", {
      sessionDbId,
      promptNumber,
      has_currentUserPrompt: !!currentUserPrompt,
    });

    let session = this.sessions.get(sessionDbId);
    if (session) {
      logger.debug("SESSION", "Returning cached session", {
        sessionDbId,
        contentSessionId: session.contentSessionId,
        lastPromptNumber: session.lastPromptNumber,
      });

      const dbSession = this.dbManager.getSessionById(sessionDbId);
      if (dbSession.project && dbSession.project !== session.project) {
        logger.debug("SESSION", "Updating project from database", {
          sessionDbId,
          oldProject: session.project,
          newProject: dbSession.project,
        });
        session.project = dbSession.project;
      }

      if (currentUserPrompt) {
        logger.debug("SESSION", "Updating userPrompt for continuation", {
          sessionDbId,
          promptNumber,
          oldPrompt: session.userPrompt.substring(0, 80),
          newPrompt: currentUserPrompt.substring(0, 80),
        });
        session.userPrompt = currentUserPrompt;
        session.lastPromptNumber = promptNumber || session.lastPromptNumber;
      } else {
        logger.debug("SESSION", "No currentUserPrompt provided for existing session", {
          sessionDbId,
          promptNumber,
          usingCachedPrompt: session.userPrompt.substring(0, 80),
        });
      }
      return session;
    }

    const dbSession = this.dbManager.getSessionById(sessionDbId);

    logger.debug("SESSION", "Fetched session from database", {
      sessionDbId,
      content_session_id: dbSession.content_session_id,
      memory_session_id: dbSession.memory_session_id,
    });

    const userPrompt = currentUserPrompt || dbSession.user_prompt;

    if (!currentUserPrompt) {
      logger.debug("SESSION", "No currentUserPrompt provided for new session, using database", {
        sessionDbId,
        promptNumber,
        dbPrompt: dbSession.user_prompt.substring(0, 80),
      });
    } else {
      logger.debug("SESSION", "Initializing session with fresh userPrompt", {
        sessionDbId,
        promptNumber,
        userPrompt: currentUserPrompt.substring(0, 80),
      });
    }

    const now = Date.now();
    session = {
      sessionDbId,
      contentSessionId: dbSession.content_session_id,
      memorySessionId: dbSession.memory_session_id || null,
      project: dbSession.project,
      userPrompt,
      pendingMessages: [],
      abortController: new AbortController(),
      generatorPromise: null,
      lastPromptNumber:
        promptNumber || this.dbManager.getSessionStore().getPromptNumberFromUserPrompts(dbSession.content_session_id),
      startTime: now,
      lastActivityTime: now,
      cumulativeInputTokens: 0,
      cumulativeOutputTokens: 0,
      earliestPendingTimestamp: null,
      conversationHistory: [],
      currentProvider: null,
      consecutiveRestarts: 0,
    };

    logger.debug("SESSION", "Creating new session object", {
      sessionDbId,
      contentSessionId: dbSession.content_session_id,
      memorySessionId: dbSession.memory_session_id || "(none - fresh session)",
      lastPromptNumber:
        promptNumber || this.dbManager.getSessionStore().getPromptNumberFromUserPrompts(dbSession.content_session_id),
    });

    this.sessions.set(sessionDbId, session);

    const emitter = new EventEmitter();
    this.sessionQueues.set(sessionDbId, emitter);

    logger.info("SESSION", "Session initialized", {
      sessionId: sessionDbId,
      project: session.project,
      contentSessionId: session.contentSessionId,
      queueDepth: 0,
      hasGenerator: false,
    });

    return session;
  }

  /**
   * Get active session by ID
   */
  getSession(sessionDbId: number): ActiveSession | undefined {
    return this.sessions.get(sessionDbId);
  }

  /**
   * Queue an observation for processing (zero-latency notification)
   * Auto-initializes session if not in memory but exists in database
   *
   * CRITICAL: Persists to database FIRST before adding to in-memory queue.
   * This ensures observations survive worker crashes.
   */
  queueObservation(sessionDbId: number, data: ObservationData): void {
    let session = this.sessions.get(sessionDbId);
    if (!session) {
      session = this.initializeSession(sessionDbId);
    }

    session.lastActivityTime = Date.now();

    const message: PendingMessage = {
      type: "observation",
      tool_name: data.tool_name,
      tool_input: data.tool_input,
      tool_response: data.tool_response,
      prompt_number: data.prompt_number,
      cwd: data.cwd,
    };

    try {
      const messageId = this.getPendingStore().enqueue(sessionDbId, session.contentSessionId, message);
      const queueDepth = this.getPendingStore().getPendingCount(sessionDbId);
      const toolSummary = logger.formatTool(data.tool_name, data.tool_input);
      logger.info(
        "QUEUE",
        `ENQUEUED | sessionDbId=${sessionDbId} | messageId=${messageId} | type=observation | tool=${toolSummary} | depth=${queueDepth}`,
        {
          sessionId: sessionDbId,
        },
      );
    } catch (error) {
      logger.error(
        "SESSION",
        "Failed to persist observation to DB",
        {
          sessionId: sessionDbId,
          tool: data.tool_name,
        },
        error,
      );
      throw error;
    }

    const emitter = this.sessionQueues.get(sessionDbId);
    emitter?.emit("message");
  }

  /**
   * Queue a summarize request (zero-latency notification)
   * Auto-initializes session if not in memory but exists in database
   *
   * CRITICAL: Persists to database FIRST before adding to in-memory queue.
   * This ensures summarize requests survive worker crashes.
   */
  queueSummarize(sessionDbId: number, lastAssistantMessage?: string): void {
    let session = this.sessions.get(sessionDbId);
    if (!session) {
      session = this.initializeSession(sessionDbId);
    }

    session.lastActivityTime = Date.now();

    const message: PendingMessage = {
      type: "summarize",
      last_assistant_message: lastAssistantMessage,
    };

    try {
      const messageId = this.getPendingStore().enqueue(sessionDbId, session.contentSessionId, message);
      const queueDepth = this.getPendingStore().getPendingCount(sessionDbId);
      logger.info(
        "QUEUE",
        `ENQUEUED | sessionDbId=${sessionDbId} | messageId=${messageId} | type=summarize | depth=${queueDepth}`,
        {
          sessionId: sessionDbId,
        },
      );
    } catch (error) {
      logger.error(
        "SESSION",
        "Failed to persist summarize to DB",
        {
          sessionId: sessionDbId,
        },
        error,
      );
      throw error;
    }

    const emitter = this.sessionQueues.get(sessionDbId);
    emitter?.emit("message");
  }

  /**
   * Delete a session (abort SDK agent and cleanup)
   */
  async deleteSession(sessionDbId: number): Promise<void> {
    const session = this.sessions.get(sessionDbId);
    if (!session) {
      return;
    }

    const sessionDuration = Date.now() - session.startTime;

    session.abortController.abort();

    if (session.generatorPromise) {
      await session.generatorPromise.catch((error) => {
        logger.debug("SYSTEM", "Generator already failed, cleaning up", { sessionId: session.sessionDbId });
      });
    }

    this.sessions.delete(sessionDbId);
    this.sessionQueues.delete(sessionDbId);

    logger.info("SESSION", "Session deleted", {
      sessionId: sessionDbId,
      duration: `${(sessionDuration / 1000).toFixed(1)}s`,
      project: session.project,
    });

    if (this.onSessionDeletedCallback) {
      this.onSessionDeletedCallback();
    }
  }

  /**
   * Shutdown all active sessions
   */
  async shutdownAll(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map((id) => this.deleteSession(id)));
  }

  /**
   * Check if any session has pending messages (for spinner tracking)
   */
  hasPendingMessages(): boolean {
    return this.getPendingStore().hasAnyPendingWork();
  }

  /**
   * Get number of active sessions (for stats)
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get total queue depth across all sessions (for activity indicator)
   */
  getTotalQueueDepth(): number {
    let total = 0;
    for (const session of this.sessions.values()) {
      total += this.getPendingStore().getPendingCount(session.sessionDbId);
    }
    return total;
  }

  /**
   * Get total active work (queued + currently processing)
   * Counts both pending messages and items actively being processed by SDK agents
   */
  getTotalActiveWork(): number {
    return this.getTotalQueueDepth();
  }

  /**
   * Check if any session is actively processing (has pending messages OR active generator)
   * Used for activity indicator to prevent spinner from stopping while SDK is processing
   */
  isAnySessionProcessing(): boolean {
    return this.getPendingStore().hasAnyPendingWork();
  }

  /**
   * Get message iterator for SDKAgent to consume (event-driven, no polling)
   * Auto-initializes session if not in memory but exists in database
   *
   * CRITICAL: Uses PendingMessageStore for crash-safe message persistence.
   * Messages are marked as 'processing' when yielded and must be marked 'processed'
   * by the SDK agent after successful completion.
   */
  async *getMessageIterator(sessionDbId: number): AsyncIterableIterator<PendingMessageWithId> {
    let session = this.sessions.get(sessionDbId);
    if (!session) {
      session = this.initializeSession(sessionDbId);
    }

    const emitter = this.sessionQueues.get(sessionDbId);
    if (!emitter) {
      throw new Error(`No emitter for session ${sessionDbId}`);
    }

    const processor = new SessionQueueProcessor(this.getPendingStore(), emitter);

    for await (const message of processor.createIterator({
      sessionDbId,
      signal: session.abortController.signal,
      onIdleTimeout: () => {
        logger.info("SESSION", "Idle timeout reached, aborting session", { sessionId: sessionDbId });
        session.abortController.abort();
      },
    })) {
      if (session.earliestPendingTimestamp === null) {
        session.earliestPendingTimestamp = message._originalTimestamp;
      } else {
        session.earliestPendingTimestamp = Math.min(session.earliestPendingTimestamp, message._originalTimestamp);
      }

      yield message;
    }
  }

  /**
   * Get batch message iterator for SDKAgent to consume (event-driven, no polling)
   * Yields arrays of messages for batch processing, reducing SDK API calls.
   */
  async *getMessageBatchIterator(sessionDbId: number, maxBatchSize?: number): AsyncIterableIterator<PendingMessageWithId[]> {
    let session = this.sessions.get(sessionDbId);
    if (!session) {
      session = this.initializeSession(sessionDbId);
    }

    const emitter = this.sessionQueues.get(sessionDbId);
    if (!emitter) {
      throw new Error(`No emitter for session ${sessionDbId}`);
    }

    const processor = new SessionQueueProcessor(this.getPendingStore(), emitter);

    for await (const batch of processor.createBatchIterator({
      sessionDbId,
      signal: session.abortController.signal,
      maxBatchSize,
      onIdleTimeout: () => {
        logger.info("SESSION", "Idle timeout reached, aborting session", { sessionId: sessionDbId });
        session.abortController.abort();
      },
    })) {
      for (const message of batch) {
        if (session.earliestPendingTimestamp === null) {
          session.earliestPendingTimestamp = message._originalTimestamp;
        } else {
          session.earliestPendingTimestamp = Math.min(session.earliestPendingTimestamp, message._originalTimestamp);
        }
      }

      yield batch;
    }
  }

  /**
   * Get the PendingMessageStore (for SDKAgent to mark messages as processed)
   */
  getPendingMessageStore(): PendingMessageStore {
    return this.getPendingStore();
  }

  /**
   * Cleanup stale sessions that have no activity for longer than the threshold.
   * Sessions with active generators are skipped unless force is true.
   * @param thresholdMs Sessions idle longer than this are considered stale (default 30 minutes)
   * @param force If true, also cleanup sessions with active generators
   * @returns Number of sessions cleaned up
   */
  async cleanupStaleSessions(thresholdMs: number = 30 * 60 * 1000, force: boolean = false): Promise<number> {
    const now = Date.now();
    const cutoff = now - thresholdMs;
    let cleanedUp = 0;

    const staleSessionIds: number[] = [];
    for (const [sessionId, session] of this.sessions) {
      if (session.lastActivityTime < cutoff) {
        if (session.generatorPromise && !force) {
          logger.debug("SESSION", "Skipping stale session with active generator", {
            sessionId,
            idleMinutes: Math.round((now - session.lastActivityTime) / 60000),
          });
          continue;
        }
        staleSessionIds.push(sessionId);
      }
    }

    for (const sessionId of staleSessionIds) {
      const session = this.sessions.get(sessionId);
      if (!session) continue;

      const idleMinutes = Math.round((now - session.lastActivityTime) / 60000);
      logger.info("SESSION", "Cleaning up stale session", {
        sessionId,
        project: session.project,
        idleMinutes,
        hadGenerator: !!session.generatorPromise,
      });

      await this.deleteSession(sessionId);
      cleanedUp++;
    }

    if (cleanedUp > 0) {
      logger.info("SESSION", `Cleaned up ${cleanedUp} stale sessions`);
    }

    return cleanedUp;
  }

  /**
   * Get session statistics for monitoring
   */
  getSessionStats(): {
    activeSessions: number;
    totalQueueDepth: number;
    oldestSessionAge: number | null;
    sessionsWithGenerators: number;
  } {
    const now = Date.now();
    let oldestAge: number | null = null;
    let sessionsWithGenerators = 0;

    for (const session of this.sessions.values()) {
      const age = now - session.startTime;
      if (oldestAge === null || age > oldestAge) {
        oldestAge = age;
      }
      if (session.generatorPromise) {
        sessionsWithGenerators++;
      }
    }

    return {
      activeSessions: this.sessions.size,
      totalQueueDepth: this.getTotalQueueDepth(),
      oldestSessionAge: oldestAge,
      sessionsWithGenerators,
    };
  }
}

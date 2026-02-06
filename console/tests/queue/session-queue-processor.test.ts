import { describe, it, expect, beforeEach } from "bun:test";
import { EventEmitter } from "events";
import { SessionQueueProcessor } from "../../src/services/queue/SessionQueueProcessor.js";

/**
 * Minimal mock for PendingMessageStore.
 * Only implements methods used by SessionQueueProcessor.
 */
function createMockStore(messages: Array<{ id: number; session_id: number; payload: string; created_at_epoch: number }> = []) {
  const queue = [...messages];
  return {
    claimAndDelete(sessionDbId: number) {
      const idx = queue.findIndex((m) => m.session_id === sessionDbId);
      if (idx === -1) return null;
      return queue.splice(idx, 1)[0];
    },
    claimAndDeleteBatch(sessionDbId: number, limit: number) {
      const result: typeof messages = [];
      while (result.length < limit) {
        const idx = queue.findIndex((m) => m.session_id === sessionDbId);
        if (idx === -1) break;
        result.push(queue.splice(idx, 1)[0]);
      }
      return result;
    },
    toPendingMessage(msg: { payload: string }) {
      return JSON.parse(msg.payload);
    },
  };
}

function makeMessage(sessionDbId: number, id = 1) {
  return {
    id,
    session_id: sessionDbId,
    payload: JSON.stringify({ type: "test", content: `msg-${id}` }),
    created_at_epoch: Date.now(),
  };
}

describe("SessionQueueProcessor", () => {
  let events: EventEmitter;
  const SESSION_ID = 42;

  beforeEach(() => {
    events = new EventEmitter();
  });

  describe("createIterator", () => {
    it("yields messages normally when queue has items", async () => {
      const store = createMockStore([
        makeMessage(SESSION_ID, 1),
        makeMessage(SESSION_ID, 2),
        makeMessage(SESSION_ID, 3),
      ]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();

      const results: any[] = [];
      for await (const msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
      })) {
        results.push(msg);
        if (results.length === 3) controller.abort();
      }

      expect(results.length).toBe(3);
    });

    it("exits immediately when signal is pre-aborted", async () => {
      const store = createMockStore([makeMessage(SESSION_ID)]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();
      controller.abort();

      const results: any[] = [];
      for await (const msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
      })) {
        results.push(msg);
      }

      expect(results.length).toBe(0);
    });

    it("yields message when event fires while waiting", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();

      setTimeout(() => {
        (store as any).claimAndDelete = () => makeMessage(SESSION_ID, 1) as any;
        events.emit("message");
      }, 10);

      const results: any[] = [];
      for await (const msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        idleTimeoutMs: 500,
      })) {
        results.push(msg);
        controller.abort();
      }

      expect(results.length).toBe(1);
    });

    it("exits when signal is aborted while waiting", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();

      setTimeout(() => controller.abort(), 30);

      const results: any[] = [];
      for await (const msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        idleTimeoutMs: 500,
      })) {
        results.push(msg);
      }

      expect(results.length).toBe(0);
    });

    it("yields multiple messages across events", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();

      setTimeout(() => {
        (store as any).claimAndDelete = () => {
          (store as any).claimAndDelete = () => null;
          return makeMessage(SESSION_ID, 1);
        };
        events.emit("message");
      }, 10);

      setTimeout(() => {
        (store as any).claimAndDelete = () => {
          (store as any).claimAndDelete = () => null;
          return makeMessage(SESSION_ID, 2);
        };
        events.emit("message");
      }, 30);

      setTimeout(() => controller.abort(), 60);

      const results: any[] = [];
      for await (const msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        idleTimeoutMs: 500,
      })) {
        results.push(msg);
      }

      expect(results.length).toBe(2);
    });
  });

  describe("idle timeout", () => {
    it("exits after idle timeout with no messages", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();

      const start = Date.now();
      const results: any[] = [];
      for await (const msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        idleTimeoutMs: 50,
      })) {
        results.push(msg);
      }
      const elapsed = Date.now() - start;

      expect(results.length).toBe(0);
      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(500);
    });

    it("calls onIdleTimeout callback on idle exit", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();
      let callbackCalled = false;

      for await (const _msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        idleTimeoutMs: 50,
        onIdleTimeout: () => {
          callbackCalled = true;
        },
      })) {
      }

      expect(callbackCalled).toBe(true);
    });

    it("does not call onIdleTimeout when aborted before timeout", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();
      let callbackCalled = false;

      setTimeout(() => controller.abort(), 20);

      for await (const _msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        idleTimeoutMs: 200,
        onIdleTimeout: () => {
          callbackCalled = true;
        },
      })) {
      }

      expect(callbackCalled).toBe(false);
    });

    it("resets idle timer on each yielded message", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();
      let callbackCalled = false;

      setTimeout(() => {
        (store as any).claimAndDelete = () => {
          (store as any).claimAndDelete = () => null;
          return makeMessage(SESSION_ID, 1);
        };
        events.emit("message");
      }, 20);

      setTimeout(() => {
        (store as any).claimAndDelete = () => {
          (store as any).claimAndDelete = () => null;
          return makeMessage(SESSION_ID, 2);
        };
        events.emit("message");
      }, 60);

      setTimeout(() => controller.abort(), 100);

      const results: any[] = [];
      for await (const msg of processor.createIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        idleTimeoutMs: 50,
        onIdleTimeout: () => {
          callbackCalled = true;
        },
      })) {
        results.push(msg);
      }

      expect(results.length).toBe(2);
      expect(callbackCalled).toBe(false);
    });
  });

  describe("createBatchIterator", () => {
    it("yields all available messages as a single batch", async () => {
      const store = createMockStore([
        makeMessage(SESSION_ID, 1),
        makeMessage(SESSION_ID, 2),
        makeMessage(SESSION_ID, 3),
      ]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();

      const batches: any[][] = [];
      for await (const batch of processor.createBatchIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        maxBatchSize: 10,
      })) {
        batches.push(batch);
        controller.abort();
      }

      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(3);
    });

    it("respects maxBatchSize limit", async () => {
      const store = createMockStore([
        makeMessage(SESSION_ID, 1),
        makeMessage(SESSION_ID, 2),
        makeMessage(SESSION_ID, 3),
        makeMessage(SESSION_ID, 4),
        makeMessage(SESSION_ID, 5),
      ]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();

      const batches: any[][] = [];
      for await (const batch of processor.createBatchIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        maxBatchSize: 2,
      })) {
        batches.push(batch);
        if (batches.length === 3) controller.abort();
      }

      expect(batches.length).toBe(3);
      expect(batches[0].length).toBe(2);
      expect(batches[1].length).toBe(2);
      expect(batches[2].length).toBe(1);
    });

    it("exits immediately when signal is pre-aborted", async () => {
      const store = createMockStore([makeMessage(SESSION_ID)]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();
      controller.abort();

      const batches: any[][] = [];
      for await (const batch of processor.createBatchIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
      })) {
        batches.push(batch);
      }

      expect(batches.length).toBe(0);
    });

    it("waits for event when empty then drains batch", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();

      setTimeout(() => {
        (store as any).claimAndDeleteBatch = (_sid: number, limit: number) => {
          (store as any).claimAndDeleteBatch = () => [];
          return [makeMessage(SESSION_ID, 1), makeMessage(SESSION_ID, 2), makeMessage(SESSION_ID, 3)].slice(0, limit);
        };
        events.emit("message");
      }, 10);

      const batches: any[][] = [];
      for await (const batch of processor.createBatchIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        maxBatchSize: 10,
        idleTimeoutMs: 500,
      })) {
        batches.push(batch);
        controller.abort();
      }

      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(3);
    });

    it("calls onIdleTimeout on idle exit", async () => {
      const store = createMockStore([]);
      const processor = new SessionQueueProcessor(store as any, events);
      const controller = new AbortController();
      let callbackCalled = false;

      for await (const _batch of processor.createBatchIterator({
        sessionDbId: SESSION_ID,
        signal: controller.signal,
        idleTimeoutMs: 50,
        onIdleTimeout: () => {
          callbackCalled = true;
        },
      })) {
      }

      expect(callbackCalled).toBe(true);
    });
  });
});

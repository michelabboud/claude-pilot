/**
 * Tests for plan-scoped observation queries (cross-session isolation).
 *
 * Mock Justification: NONE (0% mock code)
 * - Uses real SQLite with ':memory:' - tests actual SQL joins and filtering
 * - All query operations tested against real database behavior
 *
 * Value: Validates that observations from other plans are excluded during context injection.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionStore } from "../../src/services/sqlite/SessionStore.js";
import {
  queryObservations,
  queryObservationsExcludingOtherPlans,
  querySummaries,
  querySummariesExcludingOtherPlans,
  queryObservationsMultiExcludingOtherPlans,
  querySummariesMultiExcludingOtherPlans,
} from "../../src/services/context/ObservationCompiler.js";
import { associatePlan } from "../../src/services/sqlite/plans/store.js";
import type { ContextConfig } from "../../src/services/context/types.js";

function makeConfig(overrides: Partial<ContextConfig> = {}): ContextConfig {
  return {
    totalObservationCount: 50,
    fullObservationCount: 5,
    sessionCount: 5,
    showReadTokens: false,
    showWorkTokens: false,
    showSavingsAmount: false,
    showSavingsPercent: false,
    observationTypes: new Set(["discovery", "bugfix", "feature", "change"]),
    observationConcepts: new Set(["general"]),
    fullObservationField: "narrative",
    showLastSummary: false,
    showLastMessage: false,
    ...overrides,
  };
}

function insertObservation(
  store: SessionStore,
  memorySessionId: string,
  project: string,
  title: string,
  epoch: number,
): void {
  store.db
    .prepare(
      `INSERT INTO observations
      (memory_session_id, project, text, type, title, subtitle, narrative, facts, concepts,
       files_read, files_modified, discovery_tokens, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, 0, ?, ?)`,
    )
    .run(
      memorySessionId,
      project,
      title,
      "discovery",
      title,
      "narrative",
      '["fact1"]',
      '["general"]',
      new Date(epoch).toISOString(),
      epoch,
    );
}

function insertSummary(
  store: SessionStore,
  memorySessionId: string,
  project: string,
  request: string,
  epoch: number,
): void {
  store.db
    .prepare(
      `INSERT INTO session_summaries
      (memory_session_id, project, request, investigated, learned, completed, next_steps,
       created_at, created_at_epoch)
      VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
    )
    .run(memorySessionId, project, request, new Date(epoch).toISOString(), epoch);
}

describe("Plan-scoped observation queries", () => {
  let store: SessionStore;
  const PROJECT = "test-project";
  const config = makeConfig();

  beforeEach(() => {
    store = new SessionStore(":memory:");

    store.createSDKSession("content-session-a", PROJECT, "prompt a");
    store.createSDKSession("content-session-b", PROJECT, "prompt b");
    store.createSDKSession("content-session-c", PROJECT, "prompt c");

    store.updateMemorySessionId(1, "memory-a");
    store.updateMemorySessionId(2, "memory-b");
    store.updateMemorySessionId(3, "memory-c");

    associatePlan(store.db, 1, "docs/plans/plan-a.md", "PENDING");
    associatePlan(store.db, 2, "docs/plans/plan-b.md", "PENDING");

    insertObservation(store, "memory-a", PROJECT, "obs-from-plan-a", 1000);
    insertObservation(store, "memory-b", PROJECT, "obs-from-plan-b", 2000);
    insertObservation(store, "memory-c", PROJECT, "obs-from-quick-mode", 3000);
  });

  afterEach(() => {
    store.close();
  });

  describe("queryObservationsExcludingOtherPlans", () => {
    it("returns only observations from the specified plan and unassociated sessions", () => {
      const results = queryObservationsExcludingOtherPlans(store, PROJECT, config, "docs/plans/plan-a.md");

      const titles = results.map((o) => o.title);
      expect(titles).toContain("obs-from-plan-a");
      expect(titles).toContain("obs-from-quick-mode");
      expect(titles).not.toContain("obs-from-plan-b");
    });

    it("excludes plan-a observations when querying for plan-b", () => {
      const results = queryObservationsExcludingOtherPlans(store, PROJECT, config, "docs/plans/plan-b.md");

      const titles = results.map((o) => o.title);
      expect(titles).toContain("obs-from-plan-b");
      expect(titles).toContain("obs-from-quick-mode");
      expect(titles).not.toContain("obs-from-plan-a");
    });

    it("includes all observations when no plan path matches any session", () => {
      const results = queryObservationsExcludingOtherPlans(store, PROJECT, config, "docs/plans/nonexistent.md");

      const titles = results.map((o) => o.title);
      expect(titles).toContain("obs-from-quick-mode");
      expect(titles).not.toContain("obs-from-plan-a");
      expect(titles).not.toContain("obs-from-plan-b");
    });
  });

  describe("querySummariesExcludingOtherPlans", () => {
    beforeEach(() => {
      insertSummary(store, "memory-a", PROJECT, "summary-plan-a", 1000);
      insertSummary(store, "memory-b", PROJECT, "summary-plan-b", 2000);
      insertSummary(store, "memory-c", PROJECT, "summary-quick-mode", 3000);
    });

    it("returns only summaries from the specified plan and unassociated sessions", () => {
      const results = querySummariesExcludingOtherPlans(store, PROJECT, config, "docs/plans/plan-a.md");

      const requests = results.map((s) => s.request);
      expect(requests).toContain("summary-plan-a");
      expect(requests).toContain("summary-quick-mode");
      expect(requests).not.toContain("summary-plan-b");
    });
  });

  describe("queryObservationsMultiExcludingOtherPlans", () => {
    beforeEach(() => {
      insertObservation(store, "memory-a", "other-project", "obs-a-other", 4000);
      insertObservation(store, "memory-b", "other-project", "obs-b-other", 5000);
    });

    it("filters across multiple projects", () => {
      const results = queryObservationsMultiExcludingOtherPlans(
        store,
        [PROJECT, "other-project"],
        config,
        "docs/plans/plan-a.md",
      );

      const titles = results.map((o) => o.title);
      expect(titles).toContain("obs-from-plan-a");
      expect(titles).toContain("obs-a-other");
      expect(titles).toContain("obs-from-quick-mode");
      expect(titles).not.toContain("obs-from-plan-b");
      expect(titles).not.toContain("obs-b-other");
    });
  });

  describe("querySummariesMultiExcludingOtherPlans", () => {
    beforeEach(() => {
      insertSummary(store, "memory-a", PROJECT, "summary-plan-a", 1000);
      insertSummary(store, "memory-b", PROJECT, "summary-plan-b", 2000);
      insertSummary(store, "memory-a", "other-project", "summary-a-other", 3000);
    });

    it("filters summaries across multiple projects", () => {
      const results = querySummariesMultiExcludingOtherPlans(
        store,
        [PROJECT, "other-project"],
        config,
        "docs/plans/plan-a.md",
      );

      const requests = results.map((s) => s.request);
      expect(requests).toContain("summary-plan-a");
      expect(requests).toContain("summary-a-other");
      expect(requests).not.toContain("summary-plan-b");
    });
  });

  describe("backward compatibility", () => {
    it("original queryObservations returns all observations (no plan filtering)", () => {
      const results = queryObservations(store, PROJECT, config);

      expect(results).toHaveLength(3);
      const titles = results.map((o) => o.title);
      expect(titles).toContain("obs-from-plan-a");
      expect(titles).toContain("obs-from-plan-b");
      expect(titles).toContain("obs-from-quick-mode");
    });

    it("original querySummaries returns all summaries", () => {
      insertSummary(store, "memory-a", PROJECT, "summary-a", 1000);
      insertSummary(store, "memory-b", PROJECT, "summary-b", 2000);

      const results = querySummaries(store, PROJECT, config);
      expect(results).toHaveLength(2);
    });
  });
});

/**
 * Tests for PlanStore - session→plan association CRUD
 *
 * Mock Justification: NONE (0% mock code)
 * - Uses real SQLite with ':memory:' - tests actual SQL and schema
 * - All CRUD operations are tested against real database behavior
 *
 * Value: Validates plan association persistence layer
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionStore } from "../../src/services/sqlite/SessionStore.js";
import {
  associatePlan,
  getPlanForSession,
  getPlanByContentSessionId,
  getAllActivePlans,
  getDashboardSessions,
  updatePlanStatus,
  clearPlanAssociation,
} from "../../src/services/sqlite/plans/store.js";

describe("PlanStore", () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  function createSession(contentId: string): number {
    return store.createSDKSession(contentId, "test-project", "initial prompt");
  }

  it("should associate a plan with a session", () => {
    const sessionDbId = createSession("session-1");
    const result = associatePlan(store.db, sessionDbId, "docs/plans/test.md", "PENDING");

    expect(result).not.toBeNull();
    expect(result!.plan_path).toBe("docs/plans/test.md");
    expect(result!.plan_status).toBe("PENDING");
  });

  it("should get plan for session by DB ID", () => {
    const sessionDbId = createSession("session-2");
    associatePlan(store.db, sessionDbId, "docs/plans/feature.md", "PENDING");

    const plan = getPlanForSession(store.db, sessionDbId);
    expect(plan).not.toBeNull();
    expect(plan!.plan_path).toBe("docs/plans/feature.md");
    expect(plan!.plan_status).toBe("PENDING");
  });

  it("should get plan by content session ID", () => {
    const contentId = "content-session-3";
    const sessionDbId = createSession(contentId);
    associatePlan(store.db, sessionDbId, "docs/plans/by-content.md", "COMPLETE");

    const plan = getPlanByContentSessionId(store.db, contentId);
    expect(plan).not.toBeNull();
    expect(plan!.plan_path).toBe("docs/plans/by-content.md");
    expect(plan!.plan_status).toBe("COMPLETE");
  });

  it("should return null for session without plan", () => {
    const sessionDbId = createSession("session-no-plan");

    const plan = getPlanForSession(store.db, sessionDbId);
    expect(plan).toBeNull();
  });

  it("should return null for unknown content session ID", () => {
    const plan = getPlanByContentSessionId(store.db, "nonexistent");
    expect(plan).toBeNull();
  });

  it("should get all active plans", () => {
    const id1 = createSession("session-a");
    const id2 = createSession("session-b");
    const id3 = createSession("session-c");

    associatePlan(store.db, id1, "docs/plans/plan-a.md", "PENDING");
    associatePlan(store.db, id2, "docs/plans/plan-b.md", "COMPLETE");

    const active = getAllActivePlans(store.db);
    expect(active.length).toBe(2);
  });

  it("should update plan status", () => {
    const sessionDbId = createSession("session-update");
    associatePlan(store.db, sessionDbId, "docs/plans/update.md", "PENDING");

    updatePlanStatus(store.db, sessionDbId, "COMPLETE");

    const plan = getPlanForSession(store.db, sessionDbId);
    expect(plan!.plan_status).toBe("COMPLETE");
  });

  it("should clear plan association", () => {
    const sessionDbId = createSession("session-clear");
    associatePlan(store.db, sessionDbId, "docs/plans/clear.md", "PENDING");

    clearPlanAssociation(store.db, sessionDbId);

    const plan = getPlanForSession(store.db, sessionDbId);
    expect(plan).toBeNull();
  });

  it("should upsert on duplicate session", () => {
    const sessionDbId = createSession("session-upsert");
    associatePlan(store.db, sessionDbId, "docs/plans/first.md", "PENDING");
    associatePlan(store.db, sessionDbId, "docs/plans/second.md", "COMPLETE");

    const plan = getPlanForSession(store.db, sessionDbId);
    expect(plan!.plan_path).toBe("docs/plans/second.md");
    expect(plan!.plan_status).toBe("COMPLETE");
  });

  describe("getDashboardSessions", () => {
    it("should return active sessions with plan associations", () => {
      const id1 = createSession("dash-session-1");
      const id2 = createSession("dash-session-2");
      associatePlan(store.db, id1, "docs/plans/plan-a.md", "PENDING");

      const sessions = getDashboardSessions(store.db);

      expect(sessions.length).toBe(2);
      const withPlan = sessions.find((s) => s.session_db_id === id1);
      const withoutPlan = sessions.find((s) => s.session_db_id === id2);

      expect(withPlan).toBeDefined();
      expect(withPlan!.plan_path).toBe("docs/plans/plan-a.md");
      expect(withPlan!.plan_status).toBe("PENDING");
      expect(withPlan!.project).toBe("test-project");

      expect(withoutPlan).toBeDefined();
      expect(withoutPlan!.plan_path).toBeNull();
      expect(withoutPlan!.plan_status).toBeNull();
    });

    it("should only return active sessions", () => {
      const id1 = createSession("active-session");
      const id2 = createSession("completed-session");
      store.db.run("UPDATE sdk_sessions SET status = 'completed' WHERE id = ?", [id2]);

      const sessions = getDashboardSessions(store.db);

      expect(sessions.length).toBe(1);
      expect(sessions[0].session_db_id).toBe(id1);
    });

    it("should return empty array when no active sessions", () => {
      const sessions = getDashboardSessions(store.db);
      expect(sessions).toEqual([]);
    });
  });

  it("should cascade delete when session is deleted", () => {
    const contentId = "session-cascade";
    const sessionDbId = createSession(contentId);
    associatePlan(store.db, sessionDbId, "docs/plans/cascade.md", "PENDING");

    store.db.run("DELETE FROM sdk_sessions WHERE id = ?", [sessionDbId]);

    const plan = getPlanForSession(store.db, sessionDbId);
    expect(plan).toBeNull();
  });
});

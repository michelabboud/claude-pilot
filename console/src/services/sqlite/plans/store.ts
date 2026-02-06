/**
 * Plan association store - session→plan CRUD operations.
 */

import { Database } from "bun:sqlite";
import type { SessionPlan, ActivePlan, DashboardSession } from "./types.js";

/** Associate a plan with a session (upsert). */
export function associatePlan(
  db: Database,
  sessionDbId: number,
  planPath: string,
  status: string,
): SessionPlan | null {
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO session_plans (session_db_id, plan_path, plan_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_db_id)
     DO UPDATE SET plan_path = excluded.plan_path,
                   plan_status = excluded.plan_status,
                   updated_at = excluded.updated_at`,
  ).run(sessionDbId, planPath, status, now, now);

  return getPlanForSession(db, sessionDbId);
}

/** Get plan for session by database ID. */
export function getPlanForSession(db: Database, sessionDbId: number): SessionPlan | null {
  return (
    db
      .prepare("SELECT * FROM session_plans WHERE session_db_id = ?")
      .get(sessionDbId) as SessionPlan | null
  );
}

/** Get plan by content session ID (joins sdk_sessions). */
export function getPlanByContentSessionId(
  db: Database,
  contentSessionId: string,
): SessionPlan | null {
  return (
    db
      .prepare(
        `SELECT sp.* FROM session_plans sp
         JOIN sdk_sessions ss ON sp.session_db_id = ss.id
         WHERE ss.content_session_id = ?`,
      )
      .get(contentSessionId) as SessionPlan | null
  );
}

/** Get all active plan associations. */
export function getAllActivePlans(db: Database): ActivePlan[] {
  return db
    .prepare(
      `SELECT sp.session_db_id, ss.content_session_id, sp.plan_path, sp.plan_status, ss.project
       FROM session_plans sp
       JOIN sdk_sessions ss ON sp.session_db_id = ss.id`,
    )
    .all() as ActivePlan[];
}

/** Update plan status for a session. */
export function updatePlanStatus(db: Database, sessionDbId: number, status: string): void {
  const now = new Date().toISOString();
  db.prepare("UPDATE session_plans SET plan_status = ?, updated_at = ? WHERE session_db_id = ?").run(
    status,
    now,
    sessionDbId,
  );
}

/** Clear plan association for a session. */
export function clearPlanAssociation(db: Database, sessionDbId: number): void {
  db.prepare("DELETE FROM session_plans WHERE session_db_id = ?").run(sessionDbId);
}

/** Get all active sessions with optional plan associations for dashboard. */
export function getDashboardSessions(db: Database): DashboardSession[] {
  return db
    .prepare(
      `SELECT ss.id AS session_db_id, ss.content_session_id, ss.project,
              ss.status, ss.started_at, sp.plan_path, sp.plan_status
       FROM sdk_sessions ss
       LEFT JOIN session_plans sp ON sp.session_db_id = ss.id
       WHERE ss.status = 'active'
       ORDER BY ss.started_at_epoch DESC`,
    )
    .all() as DashboardSession[];
}

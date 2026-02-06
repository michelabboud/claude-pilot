/**
 * Type definitions for session→plan association operations.
 */

/** Row returned from session_plans table. */
export interface SessionPlan {
  id: number;
  session_db_id: number;
  plan_path: string;
  plan_status: string;
  created_at: string;
  updated_at: string;
}

/** Active plan with session context. */
export interface ActivePlan {
  session_db_id: number;
  content_session_id: string;
  plan_path: string;
  plan_status: string;
  project: string;
}

/** Dashboard session row with optional plan association. */
export interface DashboardSession {
  session_db_id: number;
  content_session_id: string;
  project: string;
  status: string;
  started_at: string;
  plan_path: string | null;
  plan_status: string | null;
}

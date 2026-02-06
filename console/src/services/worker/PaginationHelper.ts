/**
 * PaginationHelper: DRY pagination utility
 *
 * Responsibility:
 * - DRY helper for paginated queries
 * - Eliminates copy-paste across observations/summaries/prompts endpoints
 * - Efficient LIMIT+1 trick to avoid COUNT(*) query
 */

import { DatabaseManager } from "./DatabaseManager.js";
import { logger } from "../../utils/logger.js";
import type { PaginatedResult, Observation, Summary, UserPrompt } from "../worker-types.js";

export class PaginationHelper {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Strip project path from file paths using heuristic
   * Converts "/Users/user/project/src/file.ts" -> "src/file.ts"
   * Uses first occurrence of project name from left (project root)
   */
  private stripProjectPath(filePath: string, projectName: string): string {
    const marker = `/${projectName}/`;
    const index = filePath.indexOf(marker);

    if (index !== -1) {
      return filePath.substring(index + marker.length);
    }

    return filePath;
  }

  /**
   * Strip project path from JSON array of file paths
   */
  private stripProjectPaths(filePathsStr: string | null, projectName: string): string | null {
    if (!filePathsStr) return filePathsStr;

    try {
      const paths = JSON.parse(filePathsStr) as string[];

      const strippedPaths = paths.map((p) => this.stripProjectPath(p, projectName));

      return JSON.stringify(strippedPaths);
    } catch (err) {
      logger.debug("WORKER", "File paths is plain string, using as-is", {}, err as Error);
      return filePathsStr;
    }
  }

  /**
   * Sanitize observation by stripping project paths from files
   */
  private sanitizeObservation(obs: Observation): Observation {
    return {
      ...obs,
      files_read: this.stripProjectPaths(obs.files_read, obs.project),
      files_modified: this.stripProjectPaths(obs.files_modified, obs.project),
    };
  }

  /**
   * Get paginated observations
   */
  getObservations(offset: number, limit: number, project?: string): PaginatedResult<Observation> {
    const result = this.paginate<Observation>(
      "observations",
      "id, memory_session_id, project, type, title, subtitle, narrative, text, facts, concepts, files_read, files_modified, prompt_number, created_at, created_at_epoch",
      offset,
      limit,
      project,
    );

    return {
      ...result,
      items: result.items.map((obs) => this.sanitizeObservation(obs)),
    };
  }

  /**
   * Get paginated summaries
   */
  getSummaries(offset: number, limit: number, project?: string): PaginatedResult<Summary> {
    const db = this.dbManager.getSessionStore().db;

    let query = `
      SELECT
        ss.id,
        s.content_session_id as session_id,
        ss.request,
        ss.investigated,
        ss.learned,
        ss.completed,
        ss.next_steps,
        ss.project,
        ss.created_at,
        ss.created_at_epoch
      FROM session_summaries ss
      JOIN sdk_sessions s ON ss.memory_session_id = s.memory_session_id
    `;
    const params: any[] = [];

    if (project) {
      query += " WHERE ss.project = ?";
      params.push(project);
    }

    query += " ORDER BY ss.created_at_epoch DESC LIMIT ? OFFSET ?";
    params.push(limit + 1, offset);

    const stmt = db.prepare(query);
    const results = stmt.all(...params) as Summary[];

    return {
      items: results.slice(0, limit),
      hasMore: results.length > limit,
      offset,
      limit,
    };
  }

  /**
   * Get paginated user prompts
   */
  getPrompts(offset: number, limit: number, project?: string): PaginatedResult<UserPrompt> {
    const db = this.dbManager.getSessionStore().db;

    let query = `
      SELECT up.id, up.content_session_id, s.project, up.prompt_number, up.prompt_text, up.created_at, up.created_at_epoch
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    `;
    const params: any[] = [];

    if (project) {
      query += " WHERE s.project = ?";
      params.push(project);
    }

    query += " ORDER BY up.created_at_epoch DESC LIMIT ? OFFSET ?";
    params.push(limit + 1, offset);

    const stmt = db.prepare(query);
    const results = stmt.all(...params) as UserPrompt[];

    return {
      items: results.slice(0, limit),
      hasMore: results.length > limit,
      offset,
      limit,
    };
  }

  /**
   * Generic pagination implementation (DRY)
   */
  private paginate<T>(
    table: string,
    columns: string,
    offset: number,
    limit: number,
    project?: string,
  ): PaginatedResult<T> {
    const db = this.dbManager.getSessionStore().db;

    let query = `SELECT ${columns} FROM ${table}`;
    const params: any[] = [];

    if (project) {
      query += " WHERE project = ?";
      params.push(project);
    }

    query += " ORDER BY created_at_epoch DESC LIMIT ? OFFSET ?";
    params.push(limit + 1, offset);

    const stmt = db.prepare(query);
    const results = stmt.all(...params) as unknown as T[];

    return {
      items: results.slice(0, limit),
      hasMore: results.length > limit,
      offset,
      limit,
    };
  }
}

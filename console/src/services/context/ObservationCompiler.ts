/**
 * ObservationCompiler - Query building and data retrieval for context
 *
 * Handles database queries for observations and summaries, plus transcript extraction.
 */

import path from "path";
import { homedir } from "os";
import { existsSync, readFileSync } from "fs";
import { SessionStore } from "../sqlite/SessionStore.js";
import { logger } from "../../utils/logger.js";
import type {
  ContextConfig,
  Observation,
  SessionSummary,
  SummaryTimelineItem,
  TimelineItem,
  PriorMessages,
} from "./types.js";
import { SUMMARY_LOOKAHEAD } from "./types.js";

/**
 * Query observations from database with type and concept filtering
 */
export function queryObservations(db: SessionStore, project: string, config: ContextConfig): Observation[] {
  const typeArray = Array.from(config.observationTypes);
  const typePlaceholders = typeArray.map(() => "?").join(",");
  const conceptArray = Array.from(config.observationConcepts);
  const conceptPlaceholders = conceptArray.map(() => "?").join(",");

  return db.db
    .prepare(
      `
    SELECT
      id, memory_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified, discovery_tokens,
      created_at, created_at_epoch
    FROM observations
    WHERE project = ?
      AND type IN (${typePlaceholders})
      AND EXISTS (
        SELECT 1 FROM json_each(concepts)
        WHERE value IN (${conceptPlaceholders})
      )
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(project, ...typeArray, ...conceptArray, config.totalObservationCount) as Observation[];
}

/**
 * Query recent session summaries from database
 */
export function querySummaries(db: SessionStore, project: string, config: ContextConfig): SessionSummary[] {
  return db.db
    .prepare(
      `
    SELECT id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(project, config.sessionCount + SUMMARY_LOOKAHEAD) as SessionSummary[];
}

/**
 * Query observations from multiple projects (for worktree support)
 *
 * Returns observations from all specified projects, interleaved chronologically.
 * Used when running in a worktree to show both parent repo and worktree observations.
 */
export function queryObservationsMulti(db: SessionStore, projects: string[], config: ContextConfig): Observation[] {
  const typeArray = Array.from(config.observationTypes);
  const typePlaceholders = typeArray.map(() => "?").join(",");
  const conceptArray = Array.from(config.observationConcepts);
  const conceptPlaceholders = conceptArray.map(() => "?").join(",");

  const projectPlaceholders = projects.map(() => "?").join(",");

  return db.db
    .prepare(
      `
    SELECT
      id, memory_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified, discovery_tokens,
      created_at, created_at_epoch, project
    FROM observations
    WHERE project IN (${projectPlaceholders})
      AND type IN (${typePlaceholders})
      AND EXISTS (
        SELECT 1 FROM json_each(concepts)
        WHERE value IN (${conceptPlaceholders})
      )
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(...projects, ...typeArray, ...conceptArray, config.totalObservationCount) as Observation[];
}

/**
 * Query session summaries from multiple projects (for worktree support)
 *
 * Returns summaries from all specified projects, interleaved chronologically.
 * Used when running in a worktree to show both parent repo and worktree summaries.
 */
export function querySummariesMulti(db: SessionStore, projects: string[], config: ContextConfig): SessionSummary[] {
  const projectPlaceholders = projects.map(() => "?").join(",");

  return db.db
    .prepare(
      `
    SELECT id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch, project
    FROM session_summaries
    WHERE project IN (${projectPlaceholders})
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(...projects, config.sessionCount + SUMMARY_LOOKAHEAD) as SessionSummary[];
}

/**
 * Query observations excluding those from sessions associated with OTHER plans.
 * Includes: observations from the specified plan's sessions + unassociated sessions (quick mode).
 * Excludes: observations from sessions associated with a different plan.
 */
export function queryObservationsExcludingOtherPlans(
  db: SessionStore,
  project: string,
  config: ContextConfig,
  planPath: string,
): Observation[] {
  const typeArray = Array.from(config.observationTypes);
  const typePlaceholders = typeArray.map(() => "?").join(",");
  const conceptArray = Array.from(config.observationConcepts);
  const conceptPlaceholders = conceptArray.map(() => "?").join(",");

  return db.db
    .prepare(
      `
    SELECT
      o.id, o.memory_session_id, o.type, o.title, o.subtitle, o.narrative,
      o.facts, o.concepts, o.files_read, o.files_modified, o.discovery_tokens,
      o.created_at, o.created_at_epoch
    FROM observations o
    LEFT JOIN sdk_sessions s ON o.memory_session_id = s.memory_session_id
    LEFT JOIN session_plans sp ON s.id = sp.session_db_id
    WHERE o.project = ?
      AND o.type IN (${typePlaceholders})
      AND EXISTS (
        SELECT 1 FROM json_each(o.concepts)
        WHERE value IN (${conceptPlaceholders})
      )
      AND (sp.plan_path IS NULL OR sp.plan_path = ?)
    ORDER BY o.created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(project, ...typeArray, ...conceptArray, planPath, config.totalObservationCount) as Observation[];
}

/**
 * Query summaries excluding those from sessions associated with OTHER plans.
 */
export function querySummariesExcludingOtherPlans(
  db: SessionStore,
  project: string,
  config: ContextConfig,
  planPath: string,
): SessionSummary[] {
  return db.db
    .prepare(
      `
    SELECT ss.id, ss.memory_session_id, ss.request, ss.investigated, ss.learned,
           ss.completed, ss.next_steps, ss.created_at, ss.created_at_epoch
    FROM session_summaries ss
    LEFT JOIN sdk_sessions s ON ss.memory_session_id = s.memory_session_id
    LEFT JOIN session_plans sp ON s.id = sp.session_db_id
    WHERE ss.project = ?
      AND (sp.plan_path IS NULL OR sp.plan_path = ?)
    ORDER BY ss.created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(project, planPath, config.sessionCount + SUMMARY_LOOKAHEAD) as SessionSummary[];
}

/**
 * Query observations from multiple projects, excluding those from OTHER plans (worktree support).
 */
export function queryObservationsMultiExcludingOtherPlans(
  db: SessionStore,
  projects: string[],
  config: ContextConfig,
  planPath: string,
): Observation[] {
  const typeArray = Array.from(config.observationTypes);
  const typePlaceholders = typeArray.map(() => "?").join(",");
  const conceptArray = Array.from(config.observationConcepts);
  const conceptPlaceholders = conceptArray.map(() => "?").join(",");
  const projectPlaceholders = projects.map(() => "?").join(",");

  return db.db
    .prepare(
      `
    SELECT
      o.id, o.memory_session_id, o.type, o.title, o.subtitle, o.narrative,
      o.facts, o.concepts, o.files_read, o.files_modified, o.discovery_tokens,
      o.created_at, o.created_at_epoch, o.project
    FROM observations o
    LEFT JOIN sdk_sessions s ON o.memory_session_id = s.memory_session_id
    LEFT JOIN session_plans sp ON s.id = sp.session_db_id
    WHERE o.project IN (${projectPlaceholders})
      AND o.type IN (${typePlaceholders})
      AND EXISTS (
        SELECT 1 FROM json_each(o.concepts)
        WHERE value IN (${conceptPlaceholders})
      )
      AND (sp.plan_path IS NULL OR sp.plan_path = ?)
    ORDER BY o.created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(...projects, ...typeArray, ...conceptArray, planPath, config.totalObservationCount) as Observation[];
}

/**
 * Query summaries from multiple projects, excluding those from OTHER plans (worktree support).
 */
export function querySummariesMultiExcludingOtherPlans(
  db: SessionStore,
  projects: string[],
  config: ContextConfig,
  planPath: string,
): SessionSummary[] {
  const projectPlaceholders = projects.map(() => "?").join(",");

  return db.db
    .prepare(
      `
    SELECT ss.id, ss.memory_session_id, ss.request, ss.investigated, ss.learned,
           ss.completed, ss.next_steps, ss.created_at, ss.created_at_epoch, ss.project
    FROM session_summaries ss
    LEFT JOIN sdk_sessions s ON ss.memory_session_id = s.memory_session_id
    LEFT JOIN session_plans sp ON s.id = sp.session_db_id
    WHERE ss.project IN (${projectPlaceholders})
      AND (sp.plan_path IS NULL OR sp.plan_path = ?)
    ORDER BY ss.created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(...projects, planPath, config.sessionCount + SUMMARY_LOOKAHEAD) as SessionSummary[];
}

/**
 * Convert cwd path to dashed format for transcript lookup
 */
function cwdToDashed(cwd: string): string {
  return cwd.replace(new RegExp("/", "g"), "-");
}

/**
 * Extract prior messages from transcript file
 */
export function extractPriorMessages(transcriptPath: string): PriorMessages {
  try {
    if (!existsSync(transcriptPath)) {
      return { userMessage: "", assistantMessage: "" };
    }

    const content = readFileSync(transcriptPath, "utf-8").trim();
    if (!content) {
      return { userMessage: "", assistantMessage: "" };
    }

    const lines = content.split("\n").filter((line) => line.trim());
    let lastAssistantMessage = "";

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const line = lines[i];
        if (!line.includes('"type":"assistant"')) {
          continue;
        }

        const entry = JSON.parse(line);
        if (entry.type === "assistant" && entry.message?.content && Array.isArray(entry.message.content)) {
          let text = "";
          for (const block of entry.message.content) {
            if (block.type === "text") {
              text += block.text;
            }
          }
          text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
          if (text) {
            lastAssistantMessage = text;
            break;
          }
        }
      } catch (parseError) {
        logger.debug("PARSER", "Skipping malformed transcript line", { lineIndex: i }, parseError as Error);
        continue;
      }
    }

    return { userMessage: "", assistantMessage: lastAssistantMessage };
  } catch (error) {
    logger.failure("WORKER", `Failed to extract prior messages from transcript`, { transcriptPath }, error as Error);
    return { userMessage: "", assistantMessage: "" };
  }
}

/**
 * Get prior session messages if enabled
 */
export function getPriorSessionMessages(
  observations: Observation[],
  config: ContextConfig,
  currentSessionId: string | undefined,
  cwd: string,
): PriorMessages {
  if (!config.showLastMessage || observations.length === 0) {
    return { userMessage: "", assistantMessage: "" };
  }

  const priorSessionObs = observations.find((obs) => obs.memory_session_id !== currentSessionId);
  if (!priorSessionObs) {
    return { userMessage: "", assistantMessage: "" };
  }

  const priorSessionId = priorSessionObs.memory_session_id;
  const dashedCwd = cwdToDashed(cwd);
  const transcriptPath = path.join(homedir(), ".claude", "projects", dashedCwd, `${priorSessionId}.jsonl`);
  return extractPriorMessages(transcriptPath);
}

/**
 * Prepare summaries for timeline display
 */
export function prepareSummariesForTimeline(
  displaySummaries: SessionSummary[],
  allSummaries: SessionSummary[],
): SummaryTimelineItem[] {
  const mostRecentSummaryId = allSummaries[0]?.id;

  return displaySummaries.map((summary, i) => {
    const olderSummary = i === 0 ? null : allSummaries[i + 1];
    return {
      ...summary,
      displayEpoch: olderSummary ? olderSummary.created_at_epoch : summary.created_at_epoch,
      displayTime: olderSummary ? olderSummary.created_at : summary.created_at,
      shouldShowLink: summary.id !== mostRecentSummaryId,
    };
  });
}

/**
 * Build unified timeline from observations and summaries
 */
export function buildTimeline(observations: Observation[], summaries: SummaryTimelineItem[]): TimelineItem[] {
  const timeline: TimelineItem[] = [
    ...observations.map((obs) => ({ type: "observation" as const, data: obs })),
    ...summaries.map((summary) => ({ type: "summary" as const, data: summary })),
  ];

  timeline.sort((a, b) => {
    const aEpoch = a.type === "observation" ? a.data.created_at_epoch : a.data.displayEpoch;
    const bEpoch = b.type === "observation" ? b.data.created_at_epoch : b.data.displayEpoch;
    return aEpoch - bEpoch;
  });

  return timeline;
}

/**
 * Get set of observation IDs that should show full details
 */
export function getFullObservationIds(observations: Observation[], count: number): Set<number> {
  return new Set(observations.slice(0, count).map((obs) => obs.id));
}

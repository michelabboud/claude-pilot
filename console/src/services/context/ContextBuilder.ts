/**
 * ContextBuilder - Main orchestrator for context generation
 *
 * Coordinates all context generation components to build the final output.
 * This is the primary entry point for context generation.
 */

import path from "path";
import { homedir } from "os";
import { unlinkSync } from "fs";
import { SessionStore } from "../sqlite/SessionStore.js";
import { logger } from "../../utils/logger.js";
import { getProjectName } from "../../utils/project-name.js";

import type { ContextInput, ContextConfig, Observation, SessionSummary } from "./types.js";
import { loadContextConfig } from "./ContextConfigLoader.js";
import { calculateTokenEconomics } from "./TokenCalculator.js";
import {
  queryObservations,
  queryObservationsMulti,
  queryObservationsExcludingOtherPlans,
  queryObservationsMultiExcludingOtherPlans,
  querySummaries,
  querySummariesMulti,
  querySummariesExcludingOtherPlans,
  querySummariesMultiExcludingOtherPlans,
  getPriorSessionMessages,
  prepareSummariesForTimeline,
  buildTimeline,
  getFullObservationIds,
} from "./ObservationCompiler.js";
import { renderHeader } from "./sections/HeaderRenderer.js";
import { renderTimeline } from "./sections/TimelineRenderer.js";
import { shouldShowSummary, renderSummaryFields } from "./sections/SummaryRenderer.js";
import { renderPreviouslySection, renderFooter } from "./sections/FooterRenderer.js";
import { renderMarkdownEmptyState } from "./formatters/MarkdownFormatter.js";
import { renderColorEmptyState } from "./formatters/ColorFormatter.js";

const VERSION_MARKER_PATH = path.join(
  homedir(),
  ".claude",
  "plugins",
  "marketplaces",
  "pilot",
  "plugin",
  ".install-version",
);

/**
 * Initialize database connection with error handling
 */
function initializeDatabase(): SessionStore | null {
  try {
    return new SessionStore();
  } catch (error: any) {
    if (error.code === "ERR_DLOPEN_FAILED") {
      try {
        unlinkSync(VERSION_MARKER_PATH);
      } catch (unlinkError) {
        logger.debug("SYSTEM", "Marker file cleanup failed (may not exist)", {}, unlinkError as Error);
      }
      logger.error("SYSTEM", "Native module rebuild needed - restart Claude Code to auto-fix");
      return null;
    }
    throw error;
  }
}

/**
 * Render empty state when no data exists
 */
function renderEmptyState(project: string, useColors: boolean): string {
  return useColors ? renderColorEmptyState(project) : renderMarkdownEmptyState(project);
}

/**
 * Build context output from loaded data
 */
function buildContextOutput(
  project: string,
  observations: Observation[],
  summaries: SessionSummary[],
  config: ContextConfig,
  cwd: string,
  sessionId: string | undefined,
  useColors: boolean,
): string {
  const output: string[] = [];

  const economics = calculateTokenEconomics(observations);

  output.push(...renderHeader(project, economics, config, useColors));

  const displaySummaries = summaries.slice(0, config.sessionCount);
  const summariesForTimeline = prepareSummariesForTimeline(displaySummaries, summaries);
  const timeline = buildTimeline(observations, summariesForTimeline);
  const fullObservationIds = getFullObservationIds(observations, config.fullObservationCount);

  output.push(...renderTimeline(timeline, fullObservationIds, config, cwd, useColors));

  const mostRecentSummary = summaries[0];
  const mostRecentObservation = observations[0];

  if (shouldShowSummary(config, mostRecentSummary, mostRecentObservation)) {
    output.push(...renderSummaryFields(mostRecentSummary, useColors));
  }

  const priorMessages = getPriorSessionMessages(observations, config, sessionId, cwd);
  output.push(...renderPreviouslySection(priorMessages, useColors));

  output.push(...renderFooter(economics, config, useColors));

  return output.join("\n").trimEnd();
}

/**
 * Generate context for a project
 *
 * Main entry point for context generation. Orchestrates loading config,
 * querying data, and rendering the final context string.
 */
export async function generateContext(input?: ContextInput, useColors: boolean = false): Promise<string> {
  const config = loadContextConfig();
  const cwd = input?.cwd ?? process.cwd();
  const project = getProjectName(cwd);

  const projects = input?.projects || [project];

  const db = initializeDatabase();
  if (!db) {
    return "";
  }

  try {
    const planPath = input?.planPath;
    let observations;
    let summaries;

    if (planPath) {
      observations =
        projects.length > 1
          ? queryObservationsMultiExcludingOtherPlans(db, projects, config, planPath)
          : queryObservationsExcludingOtherPlans(db, project, config, planPath);
      summaries =
        projects.length > 1
          ? querySummariesMultiExcludingOtherPlans(db, projects, config, planPath)
          : querySummariesExcludingOtherPlans(db, project, config, planPath);
    } else {
      observations =
        projects.length > 1 ? queryObservationsMulti(db, projects, config) : queryObservations(db, project, config);
      summaries =
        projects.length > 1 ? querySummariesMulti(db, projects, config) : querySummaries(db, project, config);
    }

    if (observations.length === 0 && summaries.length === 0) {
      return renderEmptyState(project, useColors);
    }

    return buildContextOutput(project, observations, summaries, config, cwd, input?.session_id, useColors);
  } finally {
    db.close();
  }
}

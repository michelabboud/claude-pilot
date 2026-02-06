/**
 * Context Handler - SessionStart
 *
 * Extracted from context-hook.ts - calls worker to generate context.
 * Returns context as hookSpecificOutput for Claude Code to inject.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { homedir } from "os";
import type { EventHandler, NormalizedHookInput, HookResult } from "../types.js";
import { getWorkerEndpointConfig } from "../../shared/remote-endpoint.js";
import { fetchWithAuth } from "../../shared/fetch-with-auth.js";
import { getProjectContext } from "../../utils/project-name.js";
import { logger } from "../../utils/logger.js";

export const contextHandler: EventHandler = {
  async execute(input: NormalizedHookInput): Promise<HookResult> {
    if (process.env.CLAUDE_PILOT_NO_CONTEXT === "1" || process.env.CLAUDE_PILOT_NO_CONTEXT === "true") {
      return {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: "",
        },
      };
    }

    const endpointConfig = getWorkerEndpointConfig();
    const cwd = input.cwd ?? process.cwd();
    const context = getProjectContext(cwd);

    const projectsParam = context.allProjects.join(",");
    let url = `${endpointConfig.baseUrl}/api/context/inject?projects=${encodeURIComponent(projectsParam)}`;

    const pilotSessionId = process.env.PILOT_SESSION_ID;
    if (pilotSessionId) {
      const planFilePath = path.join(homedir(), ".pilot", "sessions", pilotSessionId, "active_plan.json");
      try {
        if (existsSync(planFilePath)) {
          const planData = JSON.parse(readFileSync(planFilePath, "utf-8"));
          if (planData.plan_path) {
            url += `&planPath=${encodeURIComponent(planData.plan_path)}`;
          }
        }
      } catch (err) {
        logger.debug("HOOK", "Failed to read active plan file", { planFilePath }, err as Error);
      }
    }

    const response = await fetchWithAuth(url, undefined, { endpointConfig });

    if (!response.ok) {
      throw new Error(`Context generation failed: ${response.status}`);
    }

    const result = await response.text();
    const additionalContext = result.trim();

    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    };
  },
};

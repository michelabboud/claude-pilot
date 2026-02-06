/**
 * Observation Handler - PostToolUse
 *
 * Extracted from save-hook.ts - sends tool usage to worker for storage.
 */

import type { EventHandler, NormalizedHookInput, HookResult } from "../types.js";
import { getWorkerEndpointConfig } from "../../shared/remote-endpoint.js";
import { fetchWithAuth } from "../../shared/fetch-with-auth.js";
import { isProjectExcluded, isMemoryDisabledByProjectConfig } from "../../shared/project-exclusion.js";
import { getProjectName } from "../../utils/project-name.js";
import { logger } from "../../utils/logger.js";

export const observationHandler: EventHandler = {
  async execute(input: NormalizedHookInput): Promise<HookResult> {
    const endpointConfig = getWorkerEndpointConfig();
    const { sessionId, cwd, toolName, toolInput, toolResponse } = input;

    if (!toolName) {
      throw new Error("observationHandler requires toolName");
    }

    if (isMemoryDisabledByProjectConfig(cwd)) {
      logger.debug("HOOK", "observation: Memory disabled by .pilot/memory.json", { cwd });
      return { continue: true, suppressOutput: true };
    }

    const project = getProjectName(cwd);
    if (isProjectExcluded(project)) {
      logger.debug("HOOK", "observation: Project excluded by CLAUDE_PILOT_EXCLUDE_PROJECTS", { project });
      return { continue: true, suppressOutput: true };
    }

    const toolStr = logger.formatTool(toolName, toolInput);

    logger.dataIn("HOOK", `PostToolUse: ${toolStr}`, {
      workerUrl: endpointConfig.baseUrl,
      mode: endpointConfig.mode,
    });

    if (!cwd) {
      throw new Error(`Missing cwd in PostToolUse hook input for session ${sessionId}, tool ${toolName}`);
    }

    const response = await fetchWithAuth(
      `${endpointConfig.baseUrl}/api/sessions/observations`,
      {
        method: "POST",
        body: JSON.stringify({
          contentSessionId: sessionId,
          tool_name: toolName,
          tool_input: toolInput,
          tool_response: toolResponse,
          cwd,
        }),
      },
      { endpointConfig },
    );

    if (!response.ok) {
      throw new Error(`Observation storage failed: ${response.status}`);
    }

    logger.debug("HOOK", "Observation sent successfully", {
      toolName,
      mode: endpointConfig.mode,
    });

    return { continue: true, suppressOutput: true };
  },
};

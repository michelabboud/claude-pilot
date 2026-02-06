/**
 * Summarize Handler - Stop
 *
 * Extracted from summary-hook.ts - sends summary request to worker.
 * Transcript parsing stays in the hook because only the hook has access to
 * the transcript file path.
 */

import type { EventHandler, NormalizedHookInput, HookResult } from "../types.js";
import { getWorkerEndpointConfig } from "../../shared/remote-endpoint.js";
import { fetchWithAuth } from "../../shared/fetch-with-auth.js";
import { isProjectExcluded, isMemoryDisabledByProjectConfig } from "../../shared/project-exclusion.js";
import { getProjectName } from "../../utils/project-name.js";
import { logger } from "../../utils/logger.js";
import { extractLastMessage } from "../../shared/transcript-parser.js";

export const summarizeHandler: EventHandler = {
  async execute(input: NormalizedHookInput): Promise<HookResult> {
    const endpointConfig = getWorkerEndpointConfig();
    const { sessionId, cwd, transcriptPath } = input;

    if (isMemoryDisabledByProjectConfig(cwd)) {
      logger.debug("HOOK", "summarize: Memory disabled by .pilot/memory.json", { cwd });
      return { continue: true, suppressOutput: true };
    }

    const project = getProjectName(cwd);
    if (isProjectExcluded(project)) {
      logger.debug("HOOK", "summarize: Project excluded by CLAUDE_PILOT_EXCLUDE_PROJECTS", { project });
      return { continue: true, suppressOutput: true };
    }

    if (!transcriptPath) {
      throw new Error(`Missing transcriptPath in Stop hook input for session ${sessionId}`);
    }

    const lastAssistantMessage = extractLastMessage(transcriptPath, "assistant", true);

    logger.dataIn("HOOK", "Stop: Requesting summary", {
      workerUrl: endpointConfig.baseUrl,
      mode: endpointConfig.mode,
      hasLastAssistantMessage: !!lastAssistantMessage,
    });

    const response = await fetchWithAuth(
      `${endpointConfig.baseUrl}/api/sessions/summarize`,
      {
        method: "POST",
        body: JSON.stringify({
          contentSessionId: sessionId,
          last_assistant_message: lastAssistantMessage,
        }),
      },
      { endpointConfig },
    );

    if (!response.ok) {
      return { continue: true, suppressOutput: true };
    }

    logger.debug("HOOK", "Summary request sent successfully", {
      mode: endpointConfig.mode,
    });

    return { continue: true, suppressOutput: true };
  },
};

/**
 * Worker Endpoint Configuration
 *
 * Provides resolved endpoint configuration for hooks and services.
 */

import type { WorkerEndpointConfig } from "../types/remote/index.js";
import { getWorkerHost, getWorkerPort } from "./worker-utils.js";
import { HOOK_TIMEOUTS, getTimeout } from "./hook-constants.js";

/** Cached endpoint configuration */
let cachedEndpoint: WorkerEndpointConfig | null = null;

/**
 * Format host for URL (handles IPv6 addresses correctly)
 * IPv6 addresses need to be wrapped in brackets: [::1]
 */
function formatHostForUrl(host: string): string {
  if (host.includes(":") && !host.startsWith("[")) {
    return `[${host}]`;
  }
  return host;
}

/**
 * Get resolved worker endpoint configuration
 * This is the primary function hooks should use to get worker connection details
 */
export function getWorkerEndpointConfig(): WorkerEndpointConfig {
  if (cachedEndpoint !== null) {
    return cachedEndpoint;
  }

  const host = getWorkerHost();
  const port = getWorkerPort();
  cachedEndpoint = {
    mode: "local",
    baseUrl: `http://${formatHostForUrl(host)}:${port}`,
    authHeaders: {},
    timeoutMs: getTimeout(HOOK_TIMEOUTS.DEFAULT),
    verifySsl: true,
  };

  return cachedEndpoint;
}

/**
 * Ensure the worker daemon is running, starting it if necessary.
 * Extracted to its own module for testability.
 */

import {
  writePidFile,
  removePidFile,
  getPlatformTimeout,
  spawnDaemon,
} from "./ProcessManager.js";
import {
  isPortInUse,
  waitForHealth,
  waitForPortFree,
  httpShutdown,
  checkVersionMatch,
} from "./HealthMonitor.js";
import { logger } from "../../utils/logger.js";

export interface EnsureWorkerDeps {
  waitForHealth: (port: number, timeout: number) => Promise<boolean>;
  checkVersionMatch: (port: number) => Promise<{ matches: boolean; pluginVersion: string; workerVersion: string | null }>;
  httpShutdown: (port: number) => Promise<boolean>;
  waitForPortFree: (port: number, timeout: number) => Promise<boolean>;
  isPortInUse: (port: number) => Promise<boolean>;
  spawnDaemon: (scriptPath: string, port: number) => number | undefined;
  writePidFile: (info: { pid: number; port: number; startedAt: string }) => void;
  removePidFile: () => void;
  getPlatformTimeout: (baseMs: number) => number;
}

const defaultDeps: EnsureWorkerDeps = {
  waitForHealth,
  checkVersionMatch,
  httpShutdown,
  waitForPortFree,
  isPortInUse,
  spawnDaemon,
  writePidFile,
  removePidFile,
  getPlatformTimeout,
};

/**
 * Ensure the worker daemon is running, starting it if necessary.
 * Handles health checks, version mismatch restarts, and daemon spawning.
 */
export async function ensureWorkerDaemon(
  port: number,
  scriptPath: string,
  deps: EnsureWorkerDeps = defaultDeps,
): Promise<{ ready: boolean; error?: string }> {
  if (await deps.waitForHealth(port, 1000)) {
    const versionCheck = await deps.checkVersionMatch(port);
    if (!versionCheck.matches) {
      logger.info("SYSTEM", "Worker version mismatch detected - auto-restarting", {
        pluginVersion: versionCheck.pluginVersion,
        workerVersion: versionCheck.workerVersion,
      });

      await deps.httpShutdown(port);
      const freed = await deps.waitForPortFree(port, deps.getPlatformTimeout(15000));
      if (!freed) {
        return { ready: false, error: "Port did not free after version mismatch restart" };
      }
      deps.removePidFile();
    } else {
      return { ready: true };
    }
  }

  if (await deps.isPortInUse(port)) {
    logger.info("SYSTEM", "Port in use, waiting for worker to become healthy");
    const healthy = await deps.waitForHealth(port, deps.getPlatformTimeout(15000));
    if (healthy) return { ready: true };
    return { ready: false, error: "Port in use but worker not responding" };
  }

  logger.info("SYSTEM", "Starting worker daemon");
  const pid = deps.spawnDaemon(scriptPath, port);
  if (pid === undefined) {
    return { ready: false, error: "Failed to spawn worker daemon" };
  }

  deps.writePidFile({ pid, port, startedAt: new Date().toISOString() });

  const healthy = await deps.waitForHealth(port, deps.getPlatformTimeout(30000));
  if (!healthy) {
    deps.removePidFile();
    return { ready: false, error: "Worker failed to start (health check timeout)" };
  }

  return { ready: true };
}

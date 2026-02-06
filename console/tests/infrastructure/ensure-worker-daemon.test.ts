import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ensureWorkerDaemon, type EnsureWorkerDeps } from "../../src/services/infrastructure/EnsureWorkerDaemon.js";

const PORT = 41777;
const SCRIPT_PATH = "/fake/worker-service.js";

function createMockDeps(): EnsureWorkerDeps {
  return {
    waitForHealth: mock(() => Promise.resolve(false)),
    checkVersionMatch: mock(() => Promise.resolve({ matches: true, pluginVersion: "1.0.0", workerVersion: "1.0.0" })),
    httpShutdown: mock(() => Promise.resolve(true)),
    waitForPortFree: mock(() => Promise.resolve(true)),
    isPortInUse: mock(() => Promise.resolve(false)),
    spawnDaemon: mock(() => 12345 as number | undefined),
    writePidFile: mock(() => {}),
    removePidFile: mock(() => {}),
    getPlatformTimeout: mock((ms: number) => ms),
  };
}

describe("ensureWorkerDaemon", () => {
  let deps: EnsureWorkerDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  describe("already healthy worker", () => {
    it("should return ready when worker is healthy and version matches", async () => {
      (deps.waitForHealth as ReturnType<typeof mock>).mockResolvedValueOnce(true);

      const result = await ensureWorkerDaemon(PORT, SCRIPT_PATH, deps);

      expect(result).toEqual({ ready: true });
      expect(deps.spawnDaemon).not.toHaveBeenCalled();
      expect(deps.writePidFile).not.toHaveBeenCalled();
    });
  });

  describe("version mismatch restart", () => {
    it("should restart worker on version mismatch and spawn new daemon", async () => {
      (deps.waitForHealth as ReturnType<typeof mock>)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      (deps.checkVersionMatch as ReturnType<typeof mock>).mockResolvedValueOnce({
        matches: false,
        pluginVersion: "2.0.0",
        workerVersion: "1.0.0",
      });

      const result = await ensureWorkerDaemon(PORT, SCRIPT_PATH, deps);

      expect(result).toEqual({ ready: true });
      expect(deps.httpShutdown).toHaveBeenCalledWith(PORT);
      expect(deps.removePidFile).toHaveBeenCalled();
      expect(deps.spawnDaemon).toHaveBeenCalled();
      expect(deps.writePidFile).toHaveBeenCalled();
    });

    it("should fail when port does not free after version mismatch shutdown", async () => {
      (deps.waitForHealth as ReturnType<typeof mock>).mockResolvedValueOnce(true);
      (deps.checkVersionMatch as ReturnType<typeof mock>).mockResolvedValueOnce({
        matches: false,
        pluginVersion: "2.0.0",
        workerVersion: "1.0.0",
      });
      (deps.waitForPortFree as ReturnType<typeof mock>).mockResolvedValueOnce(false);

      const result = await ensureWorkerDaemon(PORT, SCRIPT_PATH, deps);

      expect(result).toEqual({
        ready: false,
        error: "Port did not free after version mismatch restart",
      });
      expect(deps.spawnDaemon).not.toHaveBeenCalled();
    });
  });

  describe("port in use by another process", () => {
    it("should wait for health when port is in use and succeed", async () => {
      (deps.waitForHealth as ReturnType<typeof mock>)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      (deps.isPortInUse as ReturnType<typeof mock>).mockResolvedValueOnce(true);

      const result = await ensureWorkerDaemon(PORT, SCRIPT_PATH, deps);

      expect(result).toEqual({ ready: true });
      expect(deps.spawnDaemon).not.toHaveBeenCalled();
    });

    it("should fail when port is in use but worker never becomes healthy", async () => {
      (deps.waitForHealth as ReturnType<typeof mock>)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      (deps.isPortInUse as ReturnType<typeof mock>).mockResolvedValueOnce(true);

      const result = await ensureWorkerDaemon(PORT, SCRIPT_PATH, deps);

      expect(result).toEqual({
        ready: false,
        error: "Port in use but worker not responding",
      });
    });
  });

  describe("cold start spawn", () => {
    it("should spawn daemon and return ready on successful health check", async () => {
      (deps.waitForHealth as ReturnType<typeof mock>)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      (deps.spawnDaemon as ReturnType<typeof mock>).mockReturnValueOnce(99999);

      const result = await ensureWorkerDaemon(PORT, SCRIPT_PATH, deps);

      expect(result).toEqual({ ready: true });
      expect(deps.spawnDaemon).toHaveBeenCalledWith(SCRIPT_PATH, PORT);
      expect(deps.writePidFile).toHaveBeenCalled();
      const pidArg = (deps.writePidFile as ReturnType<typeof mock>).mock.calls[0][0] as {
        pid: number;
        port: number;
        startedAt: string;
      };
      expect(pidArg.pid).toBe(99999);
      expect(pidArg.port).toBe(PORT);
    });

    it("should fail when spawn returns undefined", async () => {
      (deps.spawnDaemon as ReturnType<typeof mock>).mockReturnValueOnce(undefined);

      const result = await ensureWorkerDaemon(PORT, SCRIPT_PATH, deps);

      expect(result).toEqual({
        ready: false,
        error: "Failed to spawn worker daemon",
      });
      expect(deps.writePidFile).not.toHaveBeenCalled();
    });

    it("should fail and clean up pid file when health check times out after spawn", async () => {
      (deps.waitForHealth as ReturnType<typeof mock>)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const result = await ensureWorkerDaemon(PORT, SCRIPT_PATH, deps);

      expect(result).toEqual({
        ready: false,
        error: "Worker failed to start (health check timeout)",
      });
      expect(deps.writePidFile).toHaveBeenCalled();
      expect(deps.removePidFile).toHaveBeenCalled();
    });
  });
});

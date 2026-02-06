/**
 * Tests for context handler plan path injection.
 *
 * Mock Justification: fetchWithAuth and filesystem (mandatory for unit test - external I/O)
 * - fetchWithAuth: HTTP call to worker service
 * - fs: reads active_plan.json from session directory
 *
 * Value: Validates that plan path is correctly appended to context inject URL
 * when PILOT_SESSION_ID is set and active_plan.json exists.
 */
import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import path from "path";
import { homedir } from "os";

describe("contextHandler plan path injection", () => {
  const TEST_PID = "99999";
  const sessionDir = path.join(homedir(), ".pilot", "sessions", TEST_PID);
  const planFile = path.join(sessionDir, "active_plan.json");
  let capturedUrl: string | null = null;
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    capturedUrl = null;
    originalEnv = {
      PILOT_SESSION_ID: process.env.PILOT_SESSION_ID,
      CLAUDE_PILOT_NO_CONTEXT: process.env.CLAUDE_PILOT_NO_CONTEXT,
    };
    rmSync(sessionDir, { recursive: true, force: true });
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(sessionDir, { recursive: true, force: true });
  });

  it("appends planPath to URL when active_plan.json exists", async () => {
    process.env.PILOT_SESSION_ID = TEST_PID;
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(planFile, JSON.stringify({ plan_path: "docs/plans/my-plan.md", status: "PENDING" }));

    const { contextHandler } = await import("../../src/cli/handlers/context.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response("test context output", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const result = await contextHandler.execute({
        sessionId: "test-session",
        cwd: "/test/project",
      });

      expect(capturedUrl).not.toBeNull();
      expect(capturedUrl).toContain("planPath=");
      expect(capturedUrl).toContain(encodeURIComponent("docs/plans/my-plan.md"));
      expect(result.hookSpecificOutput?.additionalContext).toBe("test context output");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not append planPath when no active_plan.json exists", async () => {
    process.env.PILOT_SESSION_ID = TEST_PID;

    const { contextHandler } = await import("../../src/cli/handlers/context.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response("test context output", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      await contextHandler.execute({
        sessionId: "test-session",
        cwd: "/test/project",
      });

      expect(capturedUrl).not.toBeNull();
      expect(capturedUrl).not.toContain("planPath=");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not append planPath when PILOT_SESSION_ID is not set", async () => {
    delete process.env.PILOT_SESSION_ID;

    const { contextHandler } = await import("../../src/cli/handlers/context.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response("test context output", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      await contextHandler.execute({
        sessionId: "test-session",
        cwd: "/test/project",
      });

      expect(capturedUrl).not.toBeNull();
      expect(capturedUrl).not.toContain("planPath=");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not append planPath when active_plan.json contains invalid JSON", async () => {
    process.env.PILOT_SESSION_ID = TEST_PID;
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(planFile, "{invalid json}");

    const { contextHandler } = await import("../../src/cli/handlers/context.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response("test context output", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      await contextHandler.execute({
        sessionId: "test-session",
        cwd: "/test/project",
      });

      expect(capturedUrl).not.toBeNull();
      expect(capturedUrl).not.toContain("planPath=");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not append planPath when active_plan.json has no plan_path key", async () => {
    process.env.PILOT_SESSION_ID = TEST_PID;
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(planFile, JSON.stringify({ status: "PENDING" }));

    const { contextHandler } = await import("../../src/cli/handlers/context.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response("test context output", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      await contextHandler.execute({
        sessionId: "test-session",
        cwd: "/test/project",
      });

      expect(capturedUrl).not.toBeNull();
      expect(capturedUrl).not.toContain("planPath=");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

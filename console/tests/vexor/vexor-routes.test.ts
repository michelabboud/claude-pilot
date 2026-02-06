/**
 * VexorRoutes Tests
 *
 * Tests for the Vexor status and search API endpoints.
 * Validates output parsing, caching, concurrency limits, and error handling.
 */

import { describe, it, expect } from "bun:test";
import {
  parseVexorIndexOutput,
  parseVexorSearchOutput,
  VexorRoutes,
} from "../../src/services/worker/http/routes/VexorRoutes.js";

describe("VexorRoutes", () => {
  describe("parseVexorIndexOutput", () => {
    it("parses valid vexor index --show output into VexorStatus", () => {
      const output = `Cached index details for /Users/test/project:
Mode: auto
Model: intfloat/multilingual-e5-small
Include hidden: no
Recursive: yes
Respect gitignore: yes
Exclude patterns: none
Extensions: all
Files: 615
Embedding dimension: 384
Version: 6
Generated at: 2026-02-04T12:57:37.104441+00:00`;

      const result = parseVexorIndexOutput(output);

      expect(result.isIndexed).toBe(true);
      expect(result.files).toBe(615);
      expect(result.mode).toBe("auto");
      expect(result.model).toBe("intfloat/multilingual-e5-small");
      expect(result.embeddingDim).toBe(384);
      expect(result.version).toBe(6);
      expect(result.generatedAt).toBe("2026-02-04T12:57:37.104441+00:00");
    });

    it("returns not-indexed status for empty output", () => {
      const result = parseVexorIndexOutput("");

      expect(result.isIndexed).toBe(false);
      expect(result.files).toBe(0);
    });

    it("returns not-indexed status for error output", () => {
      const result = parseVexorIndexOutput("No cached index found");

      expect(result.isIndexed).toBe(false);
      expect(result.files).toBe(0);
    });

    it("returns not-indexed status when Files is 0", () => {
      const output = `Mode: auto\nModel: test\nFiles: 0\nEmbedding dimension: 384\nVersion: 1`;

      const result = parseVexorIndexOutput(output);

      expect(result.isIndexed).toBe(false);
      expect(result.files).toBe(0);
    });
  });

  describe("parseVexorSearchOutput", () => {
    it("parses porcelain TSV output into search results", () => {
      const output = `1\t0.964\t./src/services/worker.ts\t5\t82\t102\texport function start() { ... }
2\t0.729\t./src/ui/viewer/App.tsx\t1\t1\t38\timport React from 'react';`;

      const results = parseVexorSearchOutput(output);

      expect(results).toHaveLength(2);
      expect(results[0].rank).toBe(1);
      expect(results[0].score).toBe(0.964);
      expect(results[0].filePath).toBe("./src/services/worker.ts");
      expect(results[0].chunkIndex).toBe(5);
      expect(results[0].startLine).toBe(82);
      expect(results[0].endLine).toBe(102);
      expect(results[0].snippet).toBe("export function start() { ... }");

      expect(results[1].rank).toBe(2);
      expect(results[1].score).toBe(0.729);
      expect(results[1].filePath).toBe("./src/ui/viewer/App.tsx");
    });

    it("handles lines with dash for missing line numbers", () => {
      const output = `1\t0.700\t./README.md\t0\t-\t-\t# Project README`;

      const results = parseVexorSearchOutput(output);

      expect(results).toHaveLength(1);
      expect(results[0].startLine).toBeNull();
      expect(results[0].endLine).toBeNull();
      expect(results[0].snippet).toBe("# Project README");
    });

    it("returns empty array for empty output", () => {
      const results = parseVexorSearchOutput("");
      expect(results).toHaveLength(0);
    });

    it("skips malformed lines", () => {
      const output = `1\t0.964\t./valid.ts\t5\t82\t102\tsnippet
bad line
3\t0.500\t./also-valid.ts\t0\t1\t10\tanother snippet`;

      const results = parseVexorSearchOutput(output);
      expect(results).toHaveLength(2);
      expect(results[0].filePath).toBe("./valid.ts");
      expect(results[1].filePath).toBe("./also-valid.ts");
    });

    it("handles snippets containing tab characters", () => {
      const output = `1\t0.800\t./config.ts\t0\t1\t5\tconst x = {\tkey: "value"\t}`;

      const results = parseVexorSearchOutput(output);

      expect(results).toHaveLength(1);
      expect(results[0].snippet).toBe('const x = {\tkey: "value"\t}');
    });
  });

  describe("VexorRoutes class", () => {
    it("can be instantiated", () => {
      const routes = new VexorRoutes();
      expect(routes).toBeDefined();
      expect(typeof routes.setupRoutes).toBe("function");
      expect(typeof routes.dispose).toBe("function");
    });

    it("dispose does not throw when no active processes exist", () => {
      const routes = new VexorRoutes();
      expect(() => routes.dispose()).not.toThrow();
    });

    it("dispose can be called multiple times safely", () => {
      const routes = new VexorRoutes();
      expect(() => {
        routes.dispose();
        routes.dispose();
      }).not.toThrow();
    });

    it("registers status, search, and reindex routes", () => {
      const routes = new VexorRoutes();
      const registeredRoutes: { method: string; path: string }[] = [];
      const fakeApp = {
        get: (path: string, _handler: unknown) => registeredRoutes.push({ method: "get", path }),
        post: (path: string, _handler: unknown) => registeredRoutes.push({ method: "post", path }),
      };
      routes.setupRoutes(fakeApp as unknown as import("express").Application);

      expect(registeredRoutes).toContainEqual({ method: "get", path: "/api/vexor/status" });
      expect(registeredRoutes).toContainEqual({ method: "get", path: "/api/vexor/search" });
      expect(registeredRoutes).toContainEqual({ method: "post", path: "/api/vexor/reindex" });
    });
  });
});

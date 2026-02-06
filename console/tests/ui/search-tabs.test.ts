/**
 * Search Tabs Tests
 *
 * Tests for the tabbed search UI with Memories and Codebase modes.
 * Validates component exports, rendering, and tab structure.
 */

import { describe, it, expect } from "bun:test";
import { renderToString } from "react-dom/server";
import React from "react";

describe("Search Tabs", () => {
  describe("CodebaseResultCard component", () => {
    it("exports CodebaseResultCard function", async () => {
      const mod = await import(
        "../../src/ui/viewer/views/Search/CodebaseResultCard.js"
      );
      expect(mod.CodebaseResultCard).toBeDefined();
      expect(typeof mod.CodebaseResultCard).toBe("function");
    });

    it("renders file path, score, and snippet", async () => {
      const { CodebaseResultCard } = await import(
        "../../src/ui/viewer/views/Search/CodebaseResultCard.js"
      );

      const html = renderToString(
        React.createElement(CodebaseResultCard, {
          result: {
            rank: 1,
            score: 0.85,
            filePath: "./src/services/worker.ts",
            chunkIndex: 0,
            startLine: 10,
            endLine: 25,
            snippet: "export function start() { }",
          },
        })
      );

      expect(html).toContain("src/services/worker.ts");
      expect(html).toContain("85");
      expect(html).toContain("% match");
      expect(html).toContain("export function start()");
      expect(html).toContain("badge-ghost");
    });

    it("renders without line numbers when null", async () => {
      const { CodebaseResultCard } = await import(
        "../../src/ui/viewer/views/Search/CodebaseResultCard.js"
      );

      const html = renderToString(
        React.createElement(CodebaseResultCard, {
          result: {
            rank: 1,
            score: 0.5,
            filePath: "./README.md",
            chunkIndex: 0,
            startLine: null,
            endLine: null,
            snippet: "# README",
          },
        })
      );

      expect(html).toContain("README.md");
      expect(html).not.toContain("L null");
    });
  });

  describe("SearchInput accepts placeholder prop", () => {
    it("exports SearchInput function", async () => {
      const mod = await import(
        "../../src/ui/viewer/views/Search/SearchInput.js"
      );
      expect(mod.SearchInput).toBeDefined();
      expect(typeof mod.SearchInput).toBe("function");
    });

    it("renders custom placeholder text", async () => {
      const { SearchInput } = await import(
        "../../src/ui/viewer/views/Search/SearchInput.js"
      );

      const html = renderToString(
        React.createElement(SearchInput, {
          onSearch: () => {},
          isSearching: false,
          placeholder: "Search your codebase files...",
        })
      );

      expect(html).toContain("Search your codebase files...");
    });

    it("renders default placeholder when none provided", async () => {
      const { SearchInput } = await import(
        "../../src/ui/viewer/views/Search/SearchInput.js"
      );

      const html = renderToString(
        React.createElement(SearchInput, {
          onSearch: () => {},
          isSearching: false,
        })
      );

      expect(html).toContain("Search your memories semantically...");
    });
  });

  describe("SearchView has tab support", () => {
    it("exports SearchView function", async () => {
      const mod = await import(
        "../../src/ui/viewer/views/Search/index.js"
      );
      expect(mod.SearchView).toBeDefined();
      expect(typeof mod.SearchView).toBe("function");
    });

    it("renders both Memories and Codebase tabs", async () => {
      const { SearchView } = await import(
        "../../src/ui/viewer/views/Search/index.js"
      );

      const html = renderToString(React.createElement(SearchView));

      expect(html).toContain("Memories");
      expect(html).toContain("Codebase");
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
    });

    it("renders Memories tab as active by default", async () => {
      const { SearchView } = await import(
        "../../src/ui/viewer/views/Search/index.js"
      );

      const html = renderToString(React.createElement(SearchView));

      expect(html).toContain("tab-active");
      expect(html).toContain("Search your memories semantically...");
    });

    it("renders the search page header", async () => {
      const { SearchView } = await import(
        "../../src/ui/viewer/views/Search/index.js"
      );

      const html = renderToString(React.createElement(SearchView));

      expect(html).toContain("Search");
      expect(html).toContain("Find memories and code using AI-powered semantic similarity");
    });
  });
});

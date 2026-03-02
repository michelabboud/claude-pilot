---
description: Sync project rules and skills with codebase - reads existing rules/skills, explores code, updates documentation, creates new skills
user-invocable: true
model: sonnet
---

# /sync - Sync Project Rules & Skills

**Sync custom rules and skills with the current codebase.** Reads existing rules/skills, explores code patterns, identifies gaps, updates documentation, creates new skills.

**Flow:** Read existing → Index → Explore → Compare → Sync project/MCP/skills → Discover new rules/skills → Summary

**Team sharing:** Use `/vault` after sync to push/pull assets via sx.

---

## Phase 0: Reference

### Guidelines

- **Always use AskUserQuestion** when asking the user anything
- **Read before writing** — check existing rules before creating
- **Write concise rules** — every word costs tokens in context
- **Idempotent** — running multiple times produces consistent results

### Output Locations

**Custom rules** in `.claude/rules/`: `project.md` (tech stack, structure), `mcp-servers.md` (custom MCP servers), `[pattern-name].md` (tribal knowledge).

**Custom skills** in `.claude/skills/[name]/SKILL.md`: workflows, tool integrations, domain expertise.

Use unique names (not `plan`, `implement`, `verify`, `standards-*`) for custom skills.

### Error Handling

| Issue | Action |
|-------|--------|
| Vexor not installed | Use Grep/Glob, skip indexing |
| No MCP servers | Skip MCP documentation |
| No README.md | Ask user for description |
| No package.json/pyproject.toml | Infer from file extensions |

### Writing Concise Rules

Rules load every session — every word costs tokens.

- **Lead with the rule** — what to do first, why second
- **Code examples over prose** — show, don't tell
- **Skip the obvious** — don't document standard framework behavior
- **One concept per rule** — don't combine unrelated patterns
- **Bullet points > paragraphs** — scannable beats readable
- **Max ~100 lines per file** — split large topics

---

## Phase 1: Read Existing Rules & Skills

**MANDATORY FIRST STEP.**

1. `ls -la .claude/rules/*.md 2>/dev/null` — read each rule file
2. `ls -la .claude/skills/*/SKILL.md 2>/dev/null` — read each skill file
3. Check for legacy CLAUDE.md: `ls CLAUDE.md claude.md .claude.md 2>/dev/null` — read if found
4. Build mental inventory: documented rules, documented skills, CLAUDE.md contents (if any), potential gaps, possibly outdated items

## Phase 2: Initialize Vexor Index

1. Check: `vexor --version` — if not installed, inform user, use Grep/Glob instead
2. Build index (use `timeout: 900000` for first run): `vexor index --path /absolute/path/to/project`
3. Verify: `vexor search "main entry point" --top 3`

> First-time indexing can take 5-15 minutes. Subsequent syncs are faster due to caching.

## Phase 3: Explore Codebase

1. **Directory structure:** `tree -L 3 -I 'node_modules|.git|__pycache__|dist|build|.venv|.next|coverage|.cache|cdk.out'`
2. **Technologies:** Check `package.json`, `pyproject.toml`, `tsconfig.json`, `go.mod`
3. **Vexor searches:** API patterns, test patterns, configuration, gaps from Phase 1
4. **Grep:** Response structures, naming conventions, import patterns
5. **Read** 5-10 representative files in key areas

## Phase 4: Compare & Identify Gaps

1. For each existing rule: still accurate? new patterns? tech stack changed? commands/paths correct?
2. Identify gaps: undocumented tribal knowledge, new conventions, changed patterns
3. AskUserQuestion to confirm findings: "Update all" | "Review each" | "Show details" | "Skip updates"

## Phase 5: Sync Project Rule

**Update `.claude/rules/project.md` with current project state.**

### Step 5.0: Handle Existing CLAUDE.md — CONDITIONAL

**Only if Phase 1 found a CLAUDE.md file (any variant).**

If both CLAUDE.md AND `.claude/rules/project.md` exist: read both, check for redundant content. If CLAUDE.md has unique content not in project.md, offer to merge it in. If fully redundant, suggest removing CLAUDE.md.

If CLAUDE.md exists but NO `.claude/rules/project.md`: AskUserQuestion:
- "Migrate to modular rules (Recommended)" — Split CLAUDE.md into `.claude/rules/project.md` + topic-specific rule files. Advantages: smaller context per session, topic-specific loading, survives Pilot updates, team-shareable via `/vault`.
- "Keep CLAUDE.md as-is" — Skip creating project.md. CLAUDE.md stays as the single source of project context.
- "Create project.md alongside CLAUDE.md" — Keep both. project.md gets tech stack/structure, CLAUDE.md keeps custom instructions.

**If migrating:** Read CLAUDE.md, identify logical sections (project overview, tech stack, conventions, patterns, etc.). Create `project.md` from overview/stack/structure sections. Create additional rule files for distinct topics (e.g., `conventions.md`, `api-patterns.md`). AskUserQuestion to confirm the split before writing. After writing, ask: "Remove CLAUDE.md?" | "Rename to CLAUDE.md.bak" | "Keep both".

### Step 5.1: Create or Update project.md

If exists: compare tech stack, verify structure/commands, update timestamp, preserve custom sections.

If doesn't exist (and user didn't choose to keep CLAUDE.md only), create using this structure:

```markdown
# Project: [Name]

**Last Updated:** [Date]

## Overview
[Brief description from README or ask user]

## Technology Stack
- **Language / Framework / Build Tool / Testing / Package Manager**

## Directory Structure
[Simplified tree — key directories only]

## Key Files
- **Configuration / Entry Points / Tests**

## Development Commands
| Task | Command |
|------|---------|
| Install / Dev / Build / Test / Lint | `[command]` |

## Architecture Notes
[Brief patterns description]
```

## Phase 6: Sync MCP Rules

**Document user-configured MCP servers (skip Pilot core: context7, mem-search, web-search, web-fetch, grep-mcp).**

#### Step 6.1: Discover

Parse `.mcp.json`, exclude Pilot core servers.

#### Step 6.2: Smoke-Test

For each user server:
1. `ToolSearch(query="+server-name keyword")` to discover tools
2. Call each tool with minimal read-only arguments (**safety: only read-only tools**)
3. Record per-tool: success | auth error | connection error | schema error | timeout
4. Report health check:
   ```
   ✅ polar — 3/3 tools working
   ⚠️ typefully — 4/5 working, 1 permission error
   ❌ my-api — 0/2 working (connection refused)
   ```
5. If issues: AskUserQuestion "Document working tools only" | "Document all with status notes" | "Skip MCP sync"

#### Step 6.3: Document

Compare against existing `mcp-servers.md`. If changes detected, ask user: "Update all" | "Review each" | "Skip"

#### Step 6.4: Write

Create/update `.claude/rules/mcp-servers.md`:

```markdown
### [server-name]
**Source:** `.mcp.json`
**Purpose:** [Brief description]
**Status:** ✅ All working | ⚠️ Partial | ❌ Broken

| Tool | Status | Description |
|------|--------|-------------|

**Example:** `ToolSearch(query="+server-name keyword")` then call directly.
```

**Skip if:** no `.mcp.json`, only Pilot core servers, user declines.

## Phase 7: Sync Existing Skills

For each skill from Phase 1:
1. **Relevance:** Does the workflow/tool still exist? Has process changed?
2. **Currency:** Steps accurate? APIs changed? Examples working?
3. **Triggers:** Description still accurate for discovery?

If updates needed: AskUserQuestion (multiSelect) with what changed and why. For each selected: update content, bump version (e.g., 1.0.0 → 1.0.1). Confirm each: "Yes, update it" | "Edit first" | "Skip this one".

If obsolete: AskUserQuestion "Yes, remove it" | "Keep it" | "Update instead". If removing: delete the skill directory.

## Phase 8: Discover New Rules

1. List undocumented areas (comparing Phase 1 + Phase 3)
2. Prioritize by: frequency, uniqueness, mistake likelihood
3. AskUserQuestion (multiSelect): which areas to document
4. For each: ask clarifying questions, draft rule, confirm before creating
5. Write to `.claude/rules/[pattern-name].md`

**Rule format:** Standard Name → When to Apply → The Pattern (code) → Why (if not obvious) → Common Mistakes → Good/Bad examples.

## Phase 9: Discover & Create Skills

Skills are appropriate for: multi-step workflows, tool integrations, reusable scripts, domain expertise.

1. Identify candidates from exploration: repeated workflows, complex tool usage, bundled scripts
2. AskUserQuestion (multiSelect): which to create
3. For each: invoke `Skill(skill="learn")` to handle creation
4. Verify: skill directory exists, SKILL.md has proper frontmatter

## Phase 10: Summary

Report: Vexor index status, rules updated, new rules created, skills updated, new skills created, skills removed, unchanged items.

Then offer: "Share via Team Vault" (`Skill(skill='vault')`) | "Discover more standards" | "Create more skills" | "Done"

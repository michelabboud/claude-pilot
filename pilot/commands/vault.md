---
description: Manage Team Vault - share and install rules, commands, skills across your team via sx
user-invocable: true
model: sonnet
---

# /vault - Team Vault Management

**Share and install AI assets (rules, commands, skills, agents, hooks, MCP configs) across your team using sx.** sx uses a private Git repository as a shared vault with automatic versioning. Assets can be scoped globally or per-repository.

---

## Step 0: Check Prerequisites

1. **Check sx:** `which sx 2>/dev/null && sx --version` — if not installed, inform user (install via Pilot installer or [skills.new](https://skills.new))

2. **Disable non-Claude clients** (idempotent, safe to run every time):
   ```bash
   sx clients disable cursor 2>/dev/null; sx clients disable github-copilot 2>/dev/null; sx clients disable gemini 2>/dev/null
   ```

3. **Check vault config:** `sx config 2>&1` — if "Repository URL" present → [Main Menu](#step-2-main-menu). If "configuration not found" → [Setup](#step-1-setup).

---

## Step 1: Setup

1. AskUserQuestion: "Git repository (Recommended)" | "Local directory" | "Skills.new"
2. Collect URL/path via AskUserQuestion
3. Initialize:
   ```bash
   sx init --type git --repo-url <url>      # Git
   sx init --type path --repo-url <path>     # Local
   sx init --type sleuth --server-url <url>  # Skills.new
   ```
4. Verify: `sx config && sx vault list`
5. **If init fails:** Check repo URL/access permissions. For SSH: ensure SSH key is configured (`--ssh-key` flag). Try `sx init` manually for interactive setup.

---

## Step 2: Main Menu

AskUserQuestion: "Pull" | "Push" | "Browse" | "Manage"

Execute selected operation, then loop: "Back to menu" | "Done"

---

## Pull: Install Team Assets

```bash
sx install --repair --target .
```

`--target .` installs to current project's `.claude/`. `--repair` verifies and fixes discrepancies.

**CI/automation:** `sx install --repair --target /path/to/project`

Show results: `sx config 2>&1 | grep -A 100 "^Assets"`

---

## Push: Share Assets

### Discover & Select

```bash
ls .claude/rules/*.md .claude/skills/*/SKILL.md .claude/commands/*.md .claude/agents/*.md 2>/dev/null
```

Filter out standard Pilot assets. AskUserQuestion (multiSelect) with discovered assets.

### Detect Remote & Ask Scope

```bash
git remote get-url origin 2>/dev/null
```

For each asset, AskUserQuestion: "This project (Recommended)" | "Global" | "Custom repos"

### Push

```bash
# Project-scoped (recommended)
sx add <path> --yes --type <type> --name "<name>" --scope-repo <repo-url>

# Global
sx add <path> --yes --type <type> --name "<name>" --scope-global
```

**Types:** `skill`, `rule`, `command`, `agent`, `hook` (script-based or command-based), `mcp` (config-only or packaged with server code), `claude-code-plugin`

**Warning:** Do NOT use `--no-install` — it skips the vault lockfile, making assets invisible to teammates.

**Gitignore non-Claude client dirs if not already ignored:**
```bash
echo -e '.cursor/\n.github/skills/\n.github/instructions/\n.gemini/' >> .gitignore 2>/dev/null
```

### Verify

`sx vault list` — confirm asset appears with incremented version.

---

## Browse: Explore Vault

- **List all:** `sx vault list`
- **Show details:** AskUserQuestion which asset to inspect, then `sx vault show <asset-name>`
- **Installation status:** `sx config 2>&1 | grep -A 100 "^Assets"` — compare vault vs installed

---

## Manage: Administration

AskUserQuestion: "Remove an asset" | "Manage clients" | "Manage roles" | "Switch profile" | "Update sx" | "Uninstall all assets"

### Remove Asset

`sx remove <asset-name> --yes` — only affects local installation, stays in vault for teammates.

### Manage Clients

```bash
sx clients                          # List detected clients
sx clients disable <client-id>      # Stop receiving assets
sx clients enable <client-id>       # Re-enable
sx clients reset                    # Reset to defaults (all enabled)
```

Client IDs: `claude-code`, `cursor`, `github-copilot`, `gemini`

| Asset Type | Claude Code | Cursor | Copilot | Gemini (CLI/VS Code) | Gemini (JetBrains) |
|-----------|:-----------:|:------:|:-------:|:--------------------:|:------------------:|
| skill | ✓ | ✓ | ✓ | ✓ | — |
| rule | ✓ | ✓ | ✓ | ✓ | ✓ |
| command | ✓ | ✓ | ✓ | ✓ | — |
| agent | ✓ | — | ✓ | — | — |
| hook | ✓ | ✓ | — | ✓ | — |
| mcp | ✓ | ✓ | ✓ | ✓ | ✓ |
| claude-code-plugin | ✓ | — | — | — | — |

### Profiles

```bash
sx profile list | use <name> | add <name> | remove <name>
```

### Roles (Skills.new Only)

```bash
sx role list | set <slug> | current | clear
```

### Update sx

```bash
sx update --check    # Check for updates
sx update            # Install update
```

### Uninstall All Assets

**Confirm before proceeding:**

AskUserQuestion: "Yes, uninstall from current scope" | "Yes, uninstall from ALL scopes" | "Preview only" | "Cancel"

```bash
sx uninstall --dry-run    # Preview
sx uninstall --yes        # Current scope
sx uninstall --all --yes  # All scopes
```

---

## Scoping

| Scope | Installs to | Use When |
|-------|-------------|----------|
| `--scope-repo <url>` | `project/.claude/` | **Default.** Assets stay with project. |
| `--scope-global` | `~/.claude/` | Personal tools needed everywhere. |
| `--scope-repo "url#path"` | `project/path/.claude/` | Monorepo — different per service. |

To change scope: run `sx add <name>` again to reconfigure interactively.

## Versioning

sx auto-increments vault versions on each `sx add` (v1 → v2 → v3). `sx vault show <name>` shows all versions. Use `sx remove <name> -v <version>` to remove a specific version from your lock file.

## Error Handling

| Error | Action |
|-------|--------|
| "configuration not found" | Run setup flow |
| "authentication failed" | See Git Auth Fix below |
| "repository not found" | Verify URL and access |
| "asset already exists" | Expected — sx auto-increments version |
| "failed to install" | `sx install --repair` |

### Git Authentication Fix

**GitHub:** `gh auth status` → if not authenticated: `gh auth login` → `gh auth setup-git` → retry.

**GitLab/Bitbucket:** Suggest SSH URL re-init (`sx init --type git --repo-url git@...`) or configure PAT (`git config --global credential.helper store`).

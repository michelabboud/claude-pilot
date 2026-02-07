## Team Vault (sx)

Share AI assets (rules, skills, commands, agents, hooks) across your team using `sx` and a private Git repository.

### When to Use

| Situation | Action |
|-----------|--------|
| User says "share", "push", "vault" | Use `/vault` command |
| After `/sync` creates new rules/skills | Suggest `/vault` to share |
| User wants team consistency | Set up vault + push standards |
| New team member onboarding | `sx install --repair` |

### Quick Reference

```bash
# Check status
sx config                              # Show config, vault URL, installed assets
sx vault list                          # List all vault assets with versions

# Pull team assets
sx install --repair                    # Fetch and install, fix discrepancies

# Push assets to team
sx add .claude/skills/my-skill --yes --type skill --name "my-skill" --no-install
sx add .claude/rules/my-rule.md --yes --type rule --name "my-rule" --no-install

# Browse
sx vault show <asset-name>             # Show asset details and versions

# Remove
sx remove <asset-name> --yes           # Remove from lock file (stays in vault)
```

### Asset Types

| Type | Flag | Source Path |
|------|------|-------------|
| `skill` | `--type skill` | `.claude/skills/<name>/` |
| `rule` | `--type rule` | `.claude/rules/<name>.md` |
| `command` | `--type command` | `.claude/commands/<name>.md` |
| `agent` | `--type agent` | `.claude/agents/<name>.md` |
| `hook` | `--type hook` | Hook scripts |
| `mcp` | `--type mcp` | MCP server configs |

### Scoping

Assets can be installed globally or per-repository:

```bash
# All repos (default for --yes)
sx add ./asset --yes --scope-global

# Specific repo
sx add ./asset --yes --scope-repo git@github.com:org/repo.git

# Specific paths within repo
sx add ./asset --yes --scope-repo "git@github.com:org/repo.git#backend,frontend"
```

### Versioning

- Vault auto-increments versions: v1 -> v2 -> v3 on each `sx add`
- `sx vault list` shows latest version and total version count
- `sx vault show <name>` shows all versions
- `--no-install` flag prevents re-installing locally when you're the author

### Setup (First Time)

```bash
# Git repo (most common)
sx init --type git --repo-url git@github.com:org/team-vault.git

# Local directory
sx init --type path --repo-url /path/to/vault

# Verify
sx vault list
```

### Tips

- Always use `--no-install` when pushing your own assets (they're already local)
- Use `--name` to control the asset name in the vault
- Run `sx install --repair` after pulling to fix any missing installations
- Multiple profiles supported via `--profile` flag or `SX_PROFILE` env var

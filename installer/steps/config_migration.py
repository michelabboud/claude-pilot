"""One-time migrations for ~/.pilot/config.json (model preferences).

Uses a _configVersion field to track which migrations have been applied.
Each migration runs exactly once, even across repeated installer runs.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

CURRENT_CONFIG_VERSION = 1

# Old agent names removed in v7.1 (merged into plan-reviewer + spec-reviewer)
_STALE_AGENT_KEYS = frozenset(
    {
        "plan-challenger",
        "plan-verifier",
        "spec-reviewer-compliance",
        "spec-reviewer-quality",
        "spec-reviewer-goal",
    }
)


def migrate_model_config(config_path: Path | None = None) -> bool:
    """Run pending one-time migrations on ~/.pilot/config.json.

    Returns True if any migration was applied, False otherwise.
    Safe to call repeatedly — already-applied migrations are skipped.
    """
    if config_path is None:
        config_path = Path.home() / ".pilot" / "config.json"

    if not config_path.exists():
        return False

    try:
        raw: dict[str, Any] = json.loads(config_path.read_text())
    except (OSError, json.JSONDecodeError):
        return False

    version = raw.get("_configVersion", 0)
    if not isinstance(version, int):
        version = 0

    if version >= CURRENT_CONFIG_VERSION:
        return False

    modified = False

    if version < 1:
        modified = _migration_v1(raw) or modified

    raw["_configVersion"] = CURRENT_CONFIG_VERSION
    modified = True

    if modified:
        _write_atomic(config_path, raw)

    return modified


def _migration_v1(raw: dict[str, Any]) -> bool:
    """v0 → v1: Update model routing defaults from v7.0 to v7.1.

    - spec-verify: opus → sonnet (new recommended default)
    - Remove stale agent keys (plan-challenger, plan-verifier, etc.)
    - Ensure new agent keys exist (plan-reviewer, spec-reviewer)
    """
    modified = False

    commands = raw.get("commands")
    if isinstance(commands, dict):
        if commands.get("spec-verify") == "opus":
            commands["spec-verify"] = "sonnet"
            modified = True

    agents = raw.get("agents")
    if isinstance(agents, dict):
        for stale_key in _STALE_AGENT_KEYS:
            if stale_key in agents:
                del agents[stale_key]
                modified = True

        if "plan-reviewer" not in agents:
            agents["plan-reviewer"] = "sonnet"
            modified = True
        if "spec-reviewer" not in agents:
            agents["spec-reviewer"] = "sonnet"
            modified = True

    return modified


def _write_atomic(path: Path, data: dict[str, Any]) -> None:
    """Write JSON atomically using temp file + os.rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(data, indent=2))
    os.rename(tmp_path, path)

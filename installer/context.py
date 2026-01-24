"""InstallContext - Shared state for installation pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from installer.ui import Console


@dataclass
class InstallContext:
    """Context object that flows through all installation steps."""

    project_dir: Path
    enable_python: bool = True
    enable_typescript: bool = True
    enable_golang: bool = True
    enable_agent_browser: bool = True
    non_interactive: bool = False
    skip_env: bool = False
    local_mode: bool = False
    local_repo_dir: Path | None = None
    is_local_install: bool = False
    target_version: str | None = None
    completed_steps: list[str] = field(default_factory=list)
    config: dict[str, Any] = field(default_factory=dict)
    ui: Console | None = None

    def mark_completed(self, step_name: str) -> None:
        """Mark a step as completed."""
        if step_name not in self.completed_steps:
            self.completed_steps.append(step_name)

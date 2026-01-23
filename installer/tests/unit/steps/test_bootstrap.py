"""Tests for bootstrap step."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestBootstrapStep:
    """Test BootstrapStep class."""

    def test_bootstrap_step_has_correct_name(self):
        """BootstrapStep has name 'bootstrap'."""
        from installer.steps.bootstrap import BootstrapStep

        step = BootstrapStep()
        assert step.name == "bootstrap"

    def test_bootstrap_check_returns_false_for_fresh_install(self):
        """BootstrapStep.check returns False for fresh install."""
        from installer.context import InstallContext
        from installer.steps.bootstrap import BootstrapStep
        from installer.ui import Console

        step = BootstrapStep()
        with tempfile.TemporaryDirectory() as tmpdir:
            ctx = InstallContext(
                project_dir=Path(tmpdir),
                ui=Console(non_interactive=True),
            )
            # No .claude directory exists
            assert step.check(ctx) is False

    def test_bootstrap_detects_upgrade(self):
        """BootstrapStep detects when upgrading existing install."""
        from installer.context import InstallContext
        from installer.steps.bootstrap import BootstrapStep
        from installer.ui import Console

        step = BootstrapStep()
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create existing .claude directory
            claude_dir = Path(tmpdir) / ".claude"
            claude_dir.mkdir()

            ctx = InstallContext(
                project_dir=Path(tmpdir),
                ui=Console(non_interactive=True),
            )
            # Should still return False (needs to run), but detect upgrade
            assert step.check(ctx) is False

    def test_bootstrap_run_creates_directories(self):
        """BootstrapStep.run creates necessary directories."""
        from installer.context import InstallContext
        from installer.steps.bootstrap import BootstrapStep
        from installer.ui import Console

        step = BootstrapStep()
        with tempfile.TemporaryDirectory() as tmpdir:
            ctx = InstallContext(
                project_dir=Path(tmpdir),
                ui=Console(non_interactive=True),
            )
            step.run(ctx)

            # Should create .claude directory
            assert (Path(tmpdir) / ".claude").exists()

    def test_bootstrap_sets_upgrade_flag(self):
        """BootstrapStep sets is_upgrade flag when upgrading."""
        from installer.context import InstallContext
        from installer.steps.bootstrap import BootstrapStep
        from installer.ui import Console

        step = BootstrapStep()
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create existing .claude directory with content
            claude_dir = Path(tmpdir) / ".claude"
            claude_dir.mkdir()
            (claude_dir / "test.txt").write_text("existing content")

            ctx = InstallContext(
                project_dir=Path(tmpdir),
                ui=Console(non_interactive=True),
            )
            step.run(ctx)

            # Should set is_upgrade flag and preserve existing content
            assert ctx.config.get("is_upgrade") is True
            assert (claude_dir / "test.txt").exists()
            assert (claude_dir / "test.txt").read_text() == "existing content"

    def test_bootstrap_creates_skills_directory(self):
        """BootstrapStep creates skills directory."""
        from installer.context import InstallContext
        from installer.steps.bootstrap import BootstrapStep
        from installer.ui import Console

        step = BootstrapStep()
        with tempfile.TemporaryDirectory() as tmpdir:
            ctx = InstallContext(
                project_dir=Path(tmpdir),
                ui=Console(non_interactive=True),
            )
            step.run(ctx)

            # Should create skills directory
            assert (Path(tmpdir) / ".claude" / "skills").exists()

"""Tests for dependencies step."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestDependenciesStep:
    """Test DependenciesStep class."""

    def test_dependencies_step_has_correct_name(self):
        """DependenciesStep has name 'dependencies'."""
        from installer.steps.dependencies import DependenciesStep

        step = DependenciesStep()
        assert step.name == "dependencies"

    def test_dependencies_check_returns_false(self):
        """DependenciesStep.check returns False (always runs)."""
        from installer.context import InstallContext
        from installer.steps.dependencies import DependenciesStep
        from installer.ui import Console

        step = DependenciesStep()
        with tempfile.TemporaryDirectory() as tmpdir:
            ctx = InstallContext(
                project_dir=Path(tmpdir),
                ui=Console(non_interactive=True),
            )
            # Dependencies always need to be checked
            assert step.check(ctx) is False

    @patch("installer.steps.dependencies.install_dotenvx")
    @patch("installer.steps.dependencies.run_qlty_check")
    @patch("installer.steps.dependencies.install_qlty")
    @patch("installer.steps.dependencies.install_local_milvus")
    @patch("installer.steps.dependencies.install_claude_mem")
    @patch("installer.steps.dependencies.install_typescript_lsp")
    @patch("installer.steps.dependencies.run_lsp_fix")
    @patch("installer.steps.dependencies.install_claude_code")
    @patch("installer.steps.dependencies.install_nodejs")
    def test_dependencies_run_installs_core(
        self,
        mock_nodejs,
        mock_claude,
        mock_lsp_fix,
        mock_typescript_lsp,
        mock_claude_mem,
        mock_milvus,
        mock_qlty,
        mock_qlty_check,
        mock_dotenvx,
    ):
        """DependenciesStep installs core dependencies."""
        from installer.context import InstallContext
        from installer.steps.dependencies import DependenciesStep
        from installer.ui import Console

        # Setup mocks
        mock_nodejs.return_value = True
        mock_claude.return_value = True
        mock_lsp_fix.return_value = True
        mock_typescript_lsp.return_value = True
        mock_claude_mem.return_value = True
        mock_milvus.return_value = True
        mock_qlty.return_value = (True, False)
        mock_dotenvx.return_value = True

        step = DependenciesStep()
        with tempfile.TemporaryDirectory() as tmpdir:
            ctx = InstallContext(
                project_dir=Path(tmpdir),
                install_python=False,
                ui=Console(non_interactive=True),
            )

            step.run(ctx)

            # Core dependencies should be installed
            mock_nodejs.assert_called_once()
            mock_typescript_lsp.assert_called_once()
            mock_claude.assert_called_once()
            mock_lsp_fix.assert_called_once()

    @patch("installer.steps.dependencies.install_dotenvx")
    @patch("installer.steps.dependencies.run_qlty_check")
    @patch("installer.steps.dependencies.install_qlty")
    @patch("installer.steps.dependencies.install_local_milvus")
    @patch("installer.steps.dependencies.install_claude_mem")
    @patch("installer.steps.dependencies.install_pyright_lsp")
    @patch("installer.steps.dependencies.install_typescript_lsp")
    @patch("installer.steps.dependencies.run_lsp_fix")
    @patch("installer.steps.dependencies.install_claude_code")
    @patch("installer.steps.dependencies.install_python_tools")
    @patch("installer.steps.dependencies.install_uv")
    @patch("installer.steps.dependencies.install_nodejs")
    def test_dependencies_installs_python_when_enabled(
        self,
        mock_nodejs,
        mock_uv,
        mock_python_tools,
        mock_claude,
        mock_lsp_fix,
        mock_typescript_lsp,
        mock_pyright_lsp,
        mock_claude_mem,
        mock_milvus,
        mock_qlty,
        mock_qlty_check,
        mock_dotenvx,
    ):
        """DependenciesStep installs Python tools when enabled."""
        from installer.context import InstallContext
        from installer.steps.dependencies import DependenciesStep
        from installer.ui import Console

        # Setup mocks
        mock_nodejs.return_value = True
        mock_uv.return_value = True
        mock_python_tools.return_value = True
        mock_claude.return_value = True
        mock_lsp_fix.return_value = True
        mock_typescript_lsp.return_value = True
        mock_pyright_lsp.return_value = True
        mock_claude_mem.return_value = True
        mock_milvus.return_value = True
        mock_qlty.return_value = (True, False)
        mock_dotenvx.return_value = True

        step = DependenciesStep()
        with tempfile.TemporaryDirectory() as tmpdir:
            ctx = InstallContext(
                project_dir=Path(tmpdir),
                install_python=True,
                ui=Console(non_interactive=True),
            )

            step.run(ctx)

            # Python tools should be installed
            mock_uv.assert_called_once()
            mock_python_tools.assert_called_once()
            mock_pyright_lsp.assert_called_once()


class TestDependencyInstallFunctions:
    """Test individual dependency install functions."""

    def test_install_nodejs_exists(self):
        """install_nodejs function exists."""
        from installer.steps.dependencies import install_nodejs

        assert callable(install_nodejs)

    def test_install_claude_code_exists(self):
        """install_claude_code function exists."""
        from installer.steps.dependencies import install_claude_code

        assert callable(install_claude_code)

    def test_install_uv_exists(self):
        """install_uv function exists."""
        from installer.steps.dependencies import install_uv

        assert callable(install_uv)

    def test_install_python_tools_exists(self):
        """install_python_tools function exists."""
        from installer.steps.dependencies import install_python_tools

        assert callable(install_python_tools)

    def test_install_dotenvx_exists(self):
        """install_dotenvx function exists."""
        from installer.steps.dependencies import install_dotenvx

        assert callable(install_dotenvx)


class TestDotenvxInstall:
    """Test dotenvx installation."""

    @patch("installer.steps.dependencies.command_exists")
    @patch("subprocess.run")
    def test_install_dotenvx_calls_native_installer(self, mock_run, mock_cmd_exists):
        """install_dotenvx calls native shell installer."""
        from installer.steps.dependencies import install_dotenvx

        mock_cmd_exists.return_value = False
        mock_run.return_value = MagicMock(returncode=0)

        result = install_dotenvx()

        # Should call curl shell installer
        mock_run.assert_called()
        call_args = mock_run.call_args[0][0]
        assert "bash" in call_args
        assert "dotenvx.sh" in call_args[2]  # The curl command is the 3rd arg

    @patch("installer.steps.dependencies.command_exists")
    def test_install_dotenvx_skips_if_exists(self, mock_cmd_exists):
        """install_dotenvx skips if already installed."""
        from installer.steps.dependencies import install_dotenvx

        mock_cmd_exists.return_value = True

        result = install_dotenvx()

        assert result is True


class TestTypescriptLspInstall:
    """Test TypeScript language server plugin installation."""

    def test_install_typescript_lsp_exists(self):
        """install_typescript_lsp function exists."""
        from installer.steps.dependencies import install_typescript_lsp

        assert callable(install_typescript_lsp)

    @patch("subprocess.run")
    def test_install_typescript_lsp_calls_npm_and_plugin(self, mock_run):
        """install_typescript_lsp calls npm install and claude plugin install."""
        from installer.steps.dependencies import install_typescript_lsp

        mock_run.return_value = MagicMock(returncode=0)

        result = install_typescript_lsp()

        assert mock_run.call_count >= 2
        # Check npm install call
        first_call = mock_run.call_args_list[0][0][0]
        assert "bash" in first_call
        assert "typescript-language-server" in first_call[2]
        # Check plugin install call
        second_call = mock_run.call_args_list[1][0][0]
        assert "claude plugin install typescript-lsp" in second_call[2]


class TestPyrightLspInstall:
    """Test Pyright language server plugin installation."""

    def test_install_pyright_lsp_exists(self):
        """install_pyright_lsp function exists."""
        from installer.steps.dependencies import install_pyright_lsp

        assert callable(install_pyright_lsp)

    @patch("subprocess.run")
    def test_install_pyright_lsp_calls_npm_and_plugin(self, mock_run):
        """install_pyright_lsp calls npm install and claude plugin install."""
        from installer.steps.dependencies import install_pyright_lsp

        mock_run.return_value = MagicMock(returncode=0)

        result = install_pyright_lsp()

        assert mock_run.call_count >= 2
        # Check npm install call
        first_call = mock_run.call_args_list[0][0][0]
        assert "bash" in first_call
        assert "pyright" in first_call[2]
        # Check plugin install call
        second_call = mock_run.call_args_list[1][0][0]
        assert "claude plugin install pyright-lsp" in second_call[2]


class TestLspFix:
    """Test LSP fix script execution."""

    def test_run_lsp_fix_exists(self):
        """run_lsp_fix function exists."""
        from installer.steps.dependencies import run_lsp_fix

        assert callable(run_lsp_fix)

    @patch("subprocess.run")
    def test_run_lsp_fix_runs_script_from_project_dir(self, mock_run):
        """run_lsp_fix runs the script from the project directory."""
        from installer.steps.dependencies import run_lsp_fix

        mock_run.return_value = MagicMock(returncode=0)

        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            script_dir = project_dir / ".claude" / "scripts"
            script_dir.mkdir(parents=True)
            script_path = script_dir / "lsp-fix.sh"
            script_path.write_text("#!/bin/bash\necho 'test'")

            result = run_lsp_fix(project_dir)

            assert result is True
            mock_run.assert_called_once()
            call_args = mock_run.call_args[0][0]
            assert call_args[0] == "bash"
            assert "lsp-fix.sh" in call_args[1]

    @patch("subprocess.run")
    def test_run_lsp_fix_treats_exit_code_2_as_success(self, mock_run):
        """run_lsp_fix treats exit code 2 (already patched) as success."""
        from installer.steps.dependencies import run_lsp_fix

        mock_run.return_value = MagicMock(returncode=2)

        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            script_dir = project_dir / ".claude" / "scripts"
            script_dir.mkdir(parents=True)
            script_path = script_dir / "lsp-fix.sh"
            script_path.write_text("#!/bin/bash\necho 'test'")

            result = run_lsp_fix(project_dir)

            assert result is True

    def test_run_lsp_fix_returns_false_if_script_missing(self):
        """run_lsp_fix returns False if script doesn't exist."""
        from installer.steps.dependencies import run_lsp_fix

        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            result = run_lsp_fix(project_dir)
            assert result is False


class TestClaudeMemInstall:
    """Test claude-mem plugin installation."""

    def test_install_claude_mem_exists(self):
        """install_claude_mem function exists."""
        from installer.steps.dependencies import install_claude_mem

        assert callable(install_claude_mem)

    @patch("subprocess.run")
    def test_install_claude_mem_uses_plugin_system(self, mock_run):
        """install_claude_mem uses claude plugin marketplace and install."""
        from installer.steps.dependencies import install_claude_mem

        mock_run.return_value = MagicMock(returncode=0)

        result = install_claude_mem()

        assert mock_run.call_count >= 2
        # Check marketplace add call
        first_call = mock_run.call_args_list[0][0][0]
        assert "claude plugin marketplace add" in first_call[2]
        assert "thedotmack/claude-mem" in first_call[2]
        # Check plugin install call
        second_call = mock_run.call_args_list[1][0][0]
        assert "claude plugin install claude-mem" in second_call[2]

"""Dependencies step - installs required tools and packages."""

from __future__ import annotations

import re
import subprocess
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any

from installer.platform_utils import command_exists
from installer.steps.base import BaseStep

if TYPE_CHECKING:
    from installer.context import InstallContext

MAX_RETRIES = 3
RETRY_DELAY = 2

ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07")


def _strip_ansi(text: str) -> str:
    """Strip ANSI escape codes from text."""
    return ANSI_ESCAPE_PATTERN.sub("", text)


def _run_bash_with_retry(command: str, cwd: Path | None = None) -> bool:
    """Run a bash command with retry logic for transient failures."""
    for attempt in range(MAX_RETRIES):
        try:
            subprocess.run(
                ["bash", "-c", command],
                check=True,
                capture_output=True,
                cwd=cwd,
            )
            return True
        except subprocess.CalledProcessError:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            continue
    return False


def _get_nvm_source_cmd() -> str:
    """Get the command to source NVM for nvm-specific commands.

    Only needed for `nvm install`, `nvm use`, etc. - not for npm/node/claude.
    """
    nvm_locations = [
        Path.home() / ".nvm" / "nvm.sh",
        Path("/usr/local/share/nvm/nvm.sh"),
    ]

    for nvm_path in nvm_locations:
        if nvm_path.exists():
            return f"source {nvm_path} && "

    return ""


def install_nodejs() -> bool:
    """Install Node.js via NVM if not present."""
    if command_exists("node"):
        return True

    nvm_dir = Path.home() / ".nvm"
    if not nvm_dir.exists():
        if not _run_bash_with_retry("curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"):
            return False

    nvm_src = _get_nvm_source_cmd()
    return _run_bash_with_retry(f"{nvm_src}nvm install 22 && nvm use 22")


def install_uv() -> bool:
    """Install uv package manager if not present."""
    if command_exists("uv"):
        return True

    return _run_bash_with_retry("curl -LsSf https://astral.sh/uv/install.sh | sh")


def install_python_tools() -> bool:
    """Install Python development tools."""
    tools = ["ruff", "mypy", "basedpyright"]

    try:
        for tool in tools:
            if not command_exists(tool):
                subprocess.run(
                    ["uv", "tool", "install", tool],
                    check=True,
                    capture_output=True,
                )
        return True
    except subprocess.CalledProcessError:
        return False


def install_claude_code() -> bool:
    """Install Claude Code CLI via npm."""
    if command_exists("claude"):
        return True

    return _run_bash_with_retry("npm install -g @anthropic-ai/claude-code")


def install_qlty(project_dir: Path) -> tuple[bool, bool]:
    """Install qlty code quality tool. Returns (success, was_fresh_install)."""
    qlty_bin = Path.home() / ".qlty" / "bin" / "qlty"

    if command_exists("qlty") or qlty_bin.exists():
        return True, False

    success = _run_bash_with_retry("curl https://qlty.sh | bash", cwd=project_dir)
    return success, success


def run_qlty_check(project_dir: Path, ui) -> bool:
    """Run qlty check to download prerequisites (linters)."""
    import os

    qlty_bin = Path.home() / ".qlty" / "bin" / "qlty"
    if not qlty_bin.exists():
        return False

    env = os.environ.copy()
    env["PATH"] = f"{qlty_bin.parent}:{env.get('PATH', '')}"

    try:
        process = subprocess.Popen(
            [str(qlty_bin), "check", "--no-fix", "--no-formatters", "--no-fail", "--install-only"],
            cwd=project_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        if process.stdout:
            for line in process.stdout:
                line = line.rstrip()
                if line and ui:
                    if "Installing" in line or "Downloading" in line or "✔" in line:
                        ui.print(f"  {line}")

        process.wait()
        return True
    except Exception:
        return False


def install_dotenvx() -> bool:
    """Install dotenvx (environment variable management) via native shell installer."""
    if command_exists("dotenvx"):
        return True

    return _run_bash_with_retry("curl -sfS https://dotenvx.sh | sh")


def run_lsp_fix(project_dir: Path) -> bool:
    """Run the LSP fix script to patch Claude Code.

    The script is expected to be at project_dir/.claude/scripts/lsp-fix.sh,
    having been installed by ClaudeFilesStep which runs before DependenciesStep.

    Exit codes: 0 = patched, 1 = error, 2 = already patched (success)
    """
    lsp_fix_script = project_dir / ".claude" / "scripts" / "lsp-fix.sh"

    if not lsp_fix_script.exists():
        return False

    lsp_fix_script.chmod(0o755)
    try:
        result = subprocess.run(
            ["bash", str(lsp_fix_script)],
            capture_output=True,
        )
        return result.returncode in (0, 2)
    except subprocess.SubprocessError:
        return False


def install_typescript_lsp() -> bool:
    """Install TypeScript language server and plugin via npm and claude plugin."""
    if not _run_bash_with_retry("npm install -g typescript-language-server typescript"):
        return False

    return _run_bash_with_retry("claude plugin install typescript-lsp")


def install_pyright_lsp() -> bool:
    """Install pyright language server and plugin via npm and claude plugin."""
    if not _run_bash_with_retry("npm install -g pyright"):
        return False

    return _run_bash_with_retry("claude plugin install pyright-lsp")


def install_claude_mem() -> bool:
    """Install claude-mem plugin via claude plugin marketplace."""
    if not _run_bash_with_retry("claude plugin marketplace add thedotmack/claude-mem"):
        return False

    return _run_bash_with_retry("claude plugin install claude-mem")


MILVUS_COMPOSE_URL = (
    "https://raw.githubusercontent.com/maxritter/claude-codepro/main/.claude/scripts/milvus/docker-compose.yml"
)
MILVUS_COMPOSE_LOCAL_PATH = ".claude/scripts/milvus/docker-compose.yml"


def _milvus_containers_running() -> bool:
    """Check if Milvus containers are already running."""
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=milvus-standalone", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
        )
        return "milvus-standalone" in result.stdout
    except Exception:
        return False


def install_local_milvus(ui: Any = None, local_mode: bool = False, local_repo_dir: Path | None = None) -> bool:
    """Start local Milvus via docker compose in ~/.claude/milvus/."""
    import shutil

    if _milvus_containers_running():
        return True

    milvus_dir = Path.home() / ".claude" / "milvus"
    compose_file = milvus_dir / "docker-compose.yml"

    milvus_dir.mkdir(parents=True, exist_ok=True)

    if local_mode and local_repo_dir:
        source_file = local_repo_dir / MILVUS_COMPOSE_LOCAL_PATH
        if source_file.exists():
            shutil.copy2(source_file, compose_file)
        else:
            return False
    else:
        if not _run_bash_with_retry(f"curl -fsSL -o {compose_file} {MILVUS_COMPOSE_URL}"):
            return False

    try:
        process = subprocess.Popen(
            ["sudo", "docker", "compose", "--progress=plain", "up", "-d"],
            cwd=milvus_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        output_lines = []
        if process.stdout:
            for line in process.stdout:
                line = _strip_ansi(line.rstrip())
                output_lines.append(line)
                if line and ui:
                    ui.print(f"  {line}")

        process.wait()

        if process.returncode != 0:
            output_text = "\n".join(output_lines)
            if "is already in use" in output_text or "Conflict" in output_text:
                return True

        return process.returncode == 0
    except Exception:
        return False


def _install_with_spinner(ui: Any, name: str, install_fn: Any, *args: Any) -> bool:
    """Run an installation function with a spinner."""
    if ui:
        with ui.spinner(f"Installing {name}..."):
            result = install_fn(*args) if args else install_fn()
        if result:
            ui.success(f"{name} installed")
        else:
            ui.warning(f"Could not install {name} - please install manually")
        return result
    else:
        return install_fn(*args) if args else install_fn()


class DependenciesStep(BaseStep):
    """Step that installs all required dependencies."""

    name = "dependencies"

    def check(self, ctx: InstallContext) -> bool:
        """Always returns False - dependencies should always be checked."""
        return False

    def run(self, ctx: InstallContext) -> None:
        """Install all required dependencies."""
        ui = ctx.ui
        installed: list[str] = []

        if _install_with_spinner(ui, "Node.js", install_nodejs):
            installed.append("nodejs")

        if ctx.install_python:
            if _install_with_spinner(ui, "uv", install_uv):
                installed.append("uv")

            if _install_with_spinner(ui, "Python tools", install_python_tools):
                installed.append("python_tools")

        if _install_with_spinner(ui, "Claude Code", install_claude_code):
            installed.append("claude_code")

            if ui:
                with ui.spinner("Applying LSP fix..."):
                    lsp_fix_result = run_lsp_fix(ctx.project_dir)
                if lsp_fix_result:
                    ui.success("LSP fix applied")
                else:
                    ui.warning("Could not apply LSP fix - LSP plugins may not work")
            else:
                run_lsp_fix(ctx.project_dir)

        if _install_with_spinner(ui, "TypeScript LSP", install_typescript_lsp):
            installed.append("typescript_lsp")

        if ctx.install_python:
            if _install_with_spinner(ui, "Pyright LSP", install_pyright_lsp):
                installed.append("pyright_lsp")

        if _install_with_spinner(ui, "claude-mem plugin", install_claude_mem):
            installed.append("claude_mem")

        if ui:
            ui.status("Starting local Milvus for Claude Context...")
        if install_local_milvus(ui, ctx.local_mode, ctx.local_repo_dir):
            installed.append("local_milvus")
            if ui:
                ui.success("Local Milvus started")
        else:
            if ui:
                ui.warning("Could not start Milvus - please install manually")

        qlty_result = install_qlty(ctx.project_dir)
        if qlty_result[0]:
            installed.append("qlty")
            if ui:
                ui.success("qlty installed")
                ui.status("Downloading qlty prerequisites (linters)...")
            run_qlty_check(ctx.project_dir, ui)
            if ui:
                ui.success("qlty prerequisites ready")
        else:
            if ui:
                ui.warning("Could not install qlty - please install manually")

        if _install_with_spinner(ui, "dotenvx", install_dotenvx):
            installed.append("dotenvx")

        ctx.config["installed_dependencies"] = installed

    def rollback(self, ctx: InstallContext) -> None:
        """Dependencies are not rolled back (would be too disruptive)."""
        pass

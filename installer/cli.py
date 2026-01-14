"""CLI entry point and step orchestration using Typer."""

from __future__ import annotations

import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import typer

from installer import __build__
from installer.config import load_config, save_config
from installer.context import InstallContext
from installer.errors import FatalInstallError
from installer.steps.base import BaseStep
from installer.steps.bootstrap import BootstrapStep
from installer.steps.claude_files import ClaudeFilesStep
from installer.steps.config_files import ConfigFilesStep
from installer.steps.dependencies import DependenciesStep
from installer.steps.environment import EnvironmentStep
from installer.steps.finalize import FinalizeStep
from installer.steps.git_setup import GitSetupStep
from installer.steps.shell_config import ShellConfigStep
from installer.steps.vscode_extensions import VSCodeExtensionsStep
from installer.ui import Console

app = typer.Typer(
    name="installer",
    help="Claude CodePro Installer",
    add_completion=False,
)


def get_all_steps() -> list[BaseStep]:
    """Get all installation steps in order."""
    return [
        BootstrapStep(),
        GitSetupStep(),
        ClaudeFilesStep(),
        ConfigFilesStep(),
        DependenciesStep(),
        EnvironmentStep(),
        ShellConfigStep(),
        VSCodeExtensionsStep(),
        FinalizeStep(),
    ]


def rollback_completed_steps(ctx: InstallContext, steps: list[BaseStep]) -> None:
    """Rollback all completed steps in reverse order."""
    ui = ctx.ui
    if ui:
        ui.warning("Rolling back installation...")

    completed_names = set(ctx.completed_steps)

    for step in reversed(steps):
        if step.name in completed_names:
            try:
                if ui:
                    ui.status(f"Rolling back {step.name}...")
                step.rollback(ctx)
            except Exception as e:
                if ui:
                    ui.error(f"Rollback failed for {step.name}: {e}")


def run_installation(ctx: InstallContext) -> None:
    """Execute all installation steps."""
    ui = ctx.ui
    steps = get_all_steps()

    if ui:
        ui.set_total_steps(len(steps))

    for step in steps:
        if ui:
            ui.step(step.name.replace("_", " ").title())

        if step.check(ctx):
            if ui:
                ui.info(f"Already complete, skipping")
            continue

        try:
            step.run(ctx)
            ctx.mark_completed(step.name)
        except FatalInstallError:
            rollback_completed_steps(ctx, steps)
            raise


@app.command()
def install(
    non_interactive: bool = typer.Option(False, "--non-interactive", "-n", help="Run without interactive prompts"),
    skip_env: bool = typer.Option(False, "--skip-env", help="Skip environment setup (API keys)"),
    local: bool = typer.Option(False, "--local", help="Use local files instead of downloading"),
    local_repo_dir: Optional[Path] = typer.Option(None, "--local-repo-dir", help="Local repository directory"),
    skip_python: bool = typer.Option(False, "--skip-python", help="Skip Python support installation"),
    skip_typescript: bool = typer.Option(False, "--skip-typescript", help="Skip TypeScript support installation"),
) -> None:
    """Install Claude CodePro."""
    console = Console(non_interactive=non_interactive)

    console.banner()
    console.info(f"Build: {__build__}")

    effective_local_repo_dir = local_repo_dir if local_repo_dir else (Path.cwd() if local else None)

    skip_prompts = non_interactive
    project_dir = Path.cwd()
    saved_config = load_config(project_dir)

    if not skip_prompts and not saved_config.get("license_acknowledged"):
        console.print()
        console.print("  [bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
        console.print("  [bold]📜 License Agreement[/bold]")
        console.print("  [bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
        console.print()
        console.print("  Claude CodePro is [bold green]FREE[/bold green] for:")
        console.print("    • Individuals (personal projects, learning)")
        console.print("    • Freelancers (client work, consulting)")
        console.print("    • Open Source Projects (AGPL-3.0 compatible)")
        console.print()
        console.print("  [bold yellow]Commercial License REQUIRED[/bold yellow] for:")
        console.print("    • Companies with closed-source/proprietary software")
        console.print("    • Internal tools at companies not willing to open-source")
        console.print("    • SaaS products using Claude CodePro")
        console.print()
        console.print("  [bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
        console.print("  [bold]💡 Why Support Claude CodePro?[/bold]")
        console.print("  [bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
        console.print()
        console.print("  Your license supports continuous development of:")
        console.print("    ✨ Pre-configured professional development environment")
        console.print("    ✨ Endless Mode for unlimited context sessions")
        console.print("    ✨ TDD enforcement, quality hooks, and LSP integration")
        console.print("    ✨ Semantic search, persistent memory, and MCP servers")
        console.print("    ✨ Regular updates with latest Claude Code best practices")
        console.print()
        console.print("  [dim]Save your team countless hours of setup, configuration,[/dim]")
        console.print("  [dim]and keeping up with the rapidly evolving AI tooling landscape.[/dim]")
        console.print()
        console.print("  [bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
        console.print()

        license_choices = [
            "Free tier (individual/freelancer/open-source)",
            "Commercial - I want to evaluate first",
            "Commercial - I need a license",
        ]
        choice = console.select("How will you use Claude CodePro?", license_choices)

        if choice == license_choices[2]:
            console.print()
            console.print("  [bold]To obtain a commercial license, please contact:[/bold]")
            console.print()
            console.print("  [bold cyan]✉️  mail@maxritter.net[/bold cyan]")
            console.print()
            console.print("  [dim]Include your company name and expected number of users.[/dim]")
            console.print()
            raise typer.Exit(0)

        use_type = "free" if choice == license_choices[0] else "commercial_eval"

        if use_type == "commercial_eval":
            console.print()
            console.print("  [bold green]✓ Evaluation mode enabled[/bold green]")
            console.print()
            console.print("  You may proceed with installation to evaluate Claude CodePro.")
            console.print("  [bold yellow]Please acquire a license before production use.[/bold yellow]")
            console.print()
            console.print("  [bold]Contact:[/bold] [cyan]mail@maxritter.net[/cyan]")
            console.print()

        console.print("  [bold]Please type the following to confirm:[/bold]")
        console.print()
        console.print('  [cyan]"I acknowledge the Claude CodePro license terms"[/cyan]')
        console.print()

        confirmation = console.input("Your confirmation").strip().lower()
        expected = "i acknowledge the claude codepro license terms"

        if confirmation != expected:
            console.print()
            console.error("Confirmation text did not match. Installation cancelled.")
            console.print("  [dim]Please type the exact phrase shown above.[/dim]")
            raise typer.Exit(1)

        console.print()
        console.success("License terms acknowledged. Thank you!")
        console.print()

        saved_config["license_acknowledged"] = True
        saved_config["license_type"] = use_type
        save_config(project_dir, saved_config)

    claude_dir = Path.cwd() / ".claude"
    if claude_dir.exists() and not skip_prompts:
        console.print()
        console.print("  [bold yellow]⚠️  Existing .claude folder detected[/bold yellow]")
        console.print()
        console.print("  The following will be [bold red]overwritten[/bold red] during installation:")
        console.print("    • .claude/commands/")
        console.print("    • .claude/hooks/")
        console.print("    • .claude/skills/")
        console.print("    • .claude/scripts/")
        console.print("    • .claude/rules/standard/")
        console.print("    • .claude/settings.json")
        console.print()
        console.print("  [dim]Your custom rules in .claude/rules/custom/ will NOT be touched.[/dim]")
        console.print()
        create_backup = console.confirm("Create backup before proceeding?", default=False)

        if create_backup:
            timestamp = datetime.now().strftime("%Y%m%d.%H%M%S")
            backup_dir = Path.cwd() / f".claude.backup.{timestamp}"
            console.status(f"Creating backup at {backup_dir}...")

            def ignore_special_files(directory: str, files: list[str]) -> list[str]:
                """Ignore pipes, sockets, and other special files."""
                ignored = []
                for f in files:
                    path = Path(directory) / f
                    if path.is_fifo() or path.is_socket() or path.is_block_device() or path.is_char_device():
                        ignored.append(f)
                    if f == "tmp":
                        ignored.append(f)
                return ignored

            shutil.copytree(claude_dir, backup_dir, ignore=ignore_special_files)
            console.success(f"Backup created: {backup_dir}")

    install_python = not skip_python
    if not skip_python and not skip_prompts:
        if "install_python" in saved_config:
            install_python = saved_config["install_python"]
            console.print()
            console.print(f"  [dim]Using saved preference: Python support = {install_python}[/dim]")
        else:
            console.print()
            console.print("  [bold]Do you want to install advanced Python features?[/bold]")
            console.print("  This includes: uv, ruff, mypy, basedpyright, and Python quality hooks")
            install_python = console.confirm("Install Python support?", default=True)

    install_typescript = not skip_typescript
    if not skip_typescript and not skip_prompts:
        if "install_typescript" in saved_config:
            install_typescript = saved_config["install_typescript"]
            console.print(f"  [dim]Using saved preference: TypeScript support = {install_typescript}[/dim]")
        else:
            console.print()
            console.print("  [bold]Do you want to install TypeScript features?[/bold]")
            console.print("  This includes: TypeScript quality hooks (eslint, tsc, prettier)")
            install_typescript = console.confirm("Install TypeScript support?", default=True)

    install_agent_browser = True
    if not skip_prompts:
        if "install_agent_browser" in saved_config:
            install_agent_browser = saved_config["install_agent_browser"]
            console.print(f"  [dim]Using saved preference: Agent browser = {install_agent_browser}[/dim]")
        else:
            console.print()
            console.print("  [bold]Do you want to install agent-browser?[/bold]")
            console.print("  This includes: Headless Chromium browser for web automation and testing")
            console.print("  [dim]Note: Installation takes 1-2 minutes[/dim]")
            install_agent_browser = console.confirm("Install agent-browser?", default=True)

    if not skip_prompts:
        save_config(
            project_dir,
            {
                "install_python": install_python,
                "install_typescript": install_typescript,
                "install_agent_browser": install_agent_browser,
            },
        )

    ctx = InstallContext(
        project_dir=project_dir,
        install_python=install_python,
        install_typescript=install_typescript,
        install_agent_browser=install_agent_browser,
        non_interactive=non_interactive,
        skip_env=skip_env,
        local_mode=local,
        local_repo_dir=effective_local_repo_dir,
        ui=console,
    )

    try:
        run_installation(ctx)
    except FatalInstallError as e:
        console.error(f"Installation failed: {e}")
        raise typer.Exit(1) from e
    except KeyboardInterrupt:
        console.warning("Installation cancelled")
        raise typer.Exit(130) from None


@app.command()
def version() -> None:
    """Show version information."""
    typer.echo(f"ccp-installer (build: {__build__})")


def find_wrapper_script() -> Path | None:
    """Find the wrapper.py script in .claude/scripts/."""
    wrapper_path = Path.cwd() / ".claude" / "scripts" / "wrapper.py"
    if wrapper_path.exists():
        return wrapper_path

    module_path = Path(__file__).parent.parent / ".claude" / "scripts" / "wrapper.py"
    if module_path.exists():
        return module_path

    return None


def run_with_wrapper(args: list[str]) -> int:
    """Run Claude via the wrapper script."""
    wrapper_path = find_wrapper_script()
    if wrapper_path is None:
        typer.echo("Error: wrapper.py not found in .claude/scripts/", err=True)
        return 1

    cmd = [sys.executable, str(wrapper_path)] + args
    return subprocess.call(cmd)


@app.command()
def launch(
    no_wrapper: bool = typer.Option(False, "--no-wrapper", help="Bypass wrapper, run claude directly"),
    args: Optional[list[str]] = typer.Argument(None, help="Arguments to pass to claude"),
) -> None:
    """Launch Claude Code (via wrapper by default)."""
    claude_args = args or []

    if no_wrapper:
        cmd = ["claude"] + claude_args
        exit_code = subprocess.call(cmd)
    else:
        exit_code = run_with_wrapper(claude_args)

    raise typer.Exit(exit_code)


def main() -> None:
    """Main entry point."""
    app()


if __name__ == "__main__":
    main()

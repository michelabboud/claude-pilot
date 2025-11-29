#!/usr/bin/env bash

set -e

# =============================================================================
# Dev Container Post-Create Setup
# Runs automatically after dev container is created
# =============================================================================

echo "=================================================="
echo "Dev Container Post-Create Setup"
echo "=================================================="
echo ""

# =============================================================================
# Git Configuration (required for qlty)
# =============================================================================

# Check if git user.name is configured
if ! git config --global user.name &>/dev/null; then
    echo "Git requires your name and email for commits."
    echo ""
    read -p "Enter your name for git commits: " GIT_NAME
    git config --global user.name "$GIT_NAME"
    echo "✓ Git user.name set to: $GIT_NAME"
fi

# Check if git user.email is configured
if ! git config --global user.email &>/dev/null; then
    read -p "Enter your email for git commits: " GIT_EMAIL
    git config --global user.email "$GIT_EMAIL"
    echo "✓ Git user.email set to: $GIT_EMAIL"
fi

echo ""

# Configure zsh with fzf (idempotent - only add if not present)
echo "Configuring zsh with fzf..."
if ! grep -q "source <(fzf --zsh)" ~/.zshrc 2>/dev/null; then
    echo -e "\nsource <(fzf --zsh)" >>~/.zshrc
    echo "✓ Added fzf configuration"
else
    echo "✓ fzf already configured"
fi

# Enable dotenv plugin for automatic .env loading (idempotent)
if ! grep -q "plugins=.*dotenv" ~/.zshrc 2>/dev/null; then
    # Add dotenv to plugins array if not already present
    sed -i 's/plugins=(/plugins=(dotenv /' ~/.zshrc
    echo "✓ Added dotenv plugin"
else
    echo "✓ dotenv plugin already configured"
fi

# Set ZSH_DOTENV_PROMPT (idempotent)
if ! grep -q "ZSH_DOTENV_PROMPT" ~/.zshrc 2>/dev/null; then
    echo -e "\n# Auto-load .env files without prompting" >>~/.zshrc
    echo 'export ZSH_DOTENV_PROMPT=false' >>~/.zshrc
    echo "✓ Added ZSH_DOTENV_PROMPT setting"
else
    echo "✓ ZSH_DOTENV_PROMPT already configured"
fi

# Make zsh the default shell (idempotent - only if not already zsh)
if [ "$SHELL" != "$(which zsh)" ]; then
    chsh -s $(which zsh)
    echo "✓ Set zsh as default shell"
else
    echo "✓ zsh already default shell"
fi

echo "✓ Shell configuration complete"
echo ""

# =============================================================================
# Install Claude CodePro (latest version)
# =============================================================================

echo "=================================================="
echo "Installing Claude CodePro..."
echo "=================================================="
echo ""

# Download and run the latest installer
curl -sSL https://raw.githubusercontent.com/maxritter/claude-codepro/main/scripts/install.py -o /tmp/claude-codepro-install.py
python3 /tmp/claude-codepro-install.py

# Get project slug from workspace folder name (matches container name)
PROJECT_SLUG=$(basename "$PWD")

echo ""
echo "=================================================="
echo "Dev Container Setup Complete!"
echo "=================================================="
echo ""
echo "To continue Claude Code setup in your favorite terminal:"
echo ""
echo "  1. Open your preferred terminal (iTerm, Terminal, etc.)"
echo ""
echo "  2. Connect to the dev container:"
echo "     docker exec -it \$(docker ps --filter \"name=${PROJECT_SLUG}\" -q) zsh"
echo ""
echo "  3. Start Claude CodePro:"
echo "     ccp"
echo ""
echo "  4. In Claude Code, run: /config"
echo "     - Set 'Auto-connect to IDE' = true"
echo "     - Set 'Auto-compact' = false"
echo ""
echo "  5. Initialize your project:"
echo "     /setup"
echo ""
echo "=================================================="

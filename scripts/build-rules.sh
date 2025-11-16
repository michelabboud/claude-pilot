#!/bin/bash

# =============================================================================
# Rule Builder - Assembles slash commands and skills from markdown rules
#
# Reads rules from .claude/rules/ and generates:
# - Slash commands in .claude/commands/
# - Skills in .claude/skills/*/SKILL.md
#
# Compatible with Bash 3.2+ (default on macOS)
# =============================================================================

set -e

# Color codes
BLUE='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Find .claude directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR=""

# Try to find .claude directory
if [[ -d "$SCRIPT_DIR/../.claude" ]]; then
    CLAUDE_DIR="$(cd "$SCRIPT_DIR/../.claude" && pwd)"
elif [[ -d "$(pwd)/.claude" ]]; then
    CLAUDE_DIR="$(cd "$(pwd)/.claude" && pwd)"
else
    echo "Error: Could not find .claude directory"
    exit 1
fi

RULES_DIR="$CLAUDE_DIR/rules"
COMMANDS_DIR="$CLAUDE_DIR/commands"
SKILLS_DIR="$CLAUDE_DIR/skills"

# Use temp directory for storing rules (Bash 3.2 compatible)
TEMP_RULES_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_RULES_DIR"' EXIT

# Array for available skills
declare -a AVAILABLE_SKILLS

# -----------------------------------------------------------------------------
# Logging Functions
# -----------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}$1${NC}" >&2
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}" >&2
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}" >&2
}

# -----------------------------------------------------------------------------
# Load Rules
# -----------------------------------------------------------------------------

load_rules() {
    log_info "Loading rules..."

    local rule_count=0

    for category in core workflow extended; do
        local category_dir="$RULES_DIR/$category"
        [[ ! -d "$category_dir" ]] && continue

        while IFS= read -r -d '' md_file; do
            local rule_id
            rule_id=$(basename "$md_file" .md)
            # Store rule content in temp file instead of associative array
            cat "$md_file" > "$TEMP_RULES_DIR/$rule_id"
            log_success "Loaded $category/$(basename "$md_file")"
            ((rule_count++)) || true
        done < <(find "$category_dir" -maxdepth 1 -name "*.md" -print0 2>/dev/null)
    done

    log_info "Total rules loaded: $rule_count"
}

# -----------------------------------------------------------------------------
# Discover Skills
# -----------------------------------------------------------------------------

discover_skills() {
    log_info "Discovering skills..."

    local extended_dir="$RULES_DIR/extended"
    [[ ! -d "$extended_dir" ]] && return

    local skill_count=0

    while IFS= read -r -d '' md_file; do
        local skill_name
        skill_name=$(basename "$md_file" .md)

        # Extract first non-empty, non-heading line as description
        local description=""
        while IFS= read -r line; do
            line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            if [[ -n "$line" && ! "$line" =~ ^# ]]; then
                description="$line"
                break
            fi
        done < "$md_file"

        AVAILABLE_SKILLS+=("$skill_name|${description:-No description}")
        log_success "Discovered @$skill_name"
        ((skill_count++)) || true
    done < <(find "$extended_dir" -maxdepth 1 -name "*.md" -print0 2>/dev/null | sort -z)

    log_info "Total skills discovered: $skill_count"
}

# -----------------------------------------------------------------------------
# Format Skills Section
# -----------------------------------------------------------------------------

format_skills_section() {
    [[ ${#AVAILABLE_SKILLS[@]} -eq 0 ]] && return

    echo "## Available Skills"
    echo ""

    local -a testing=()
    local -a global=()
    local -a backend=()
    local -a frontend=()

    for skill_info in "${AVAILABLE_SKILLS[@]}"; do
        local name="${skill_info%%|*}"

        if [[ "$name" == testing-* ]]; then
            testing+=("@$name")
        elif [[ "$name" == global-* ]]; then
            global+=("@$name")
        elif [[ "$name" == backend-* ]]; then
            backend+=("@$name")
        elif [[ "$name" == frontend-* ]]; then
            frontend+=("@$name")
        fi
    done

    [[ ${#testing[@]} -gt 0 ]] && echo "**Testing:** ${testing[*]}" | sed 's/ / | /g'
    [[ ${#global[@]} -gt 0 ]] && echo "**Global:** ${global[*]}" | sed 's/ / | /g'
    [[ ${#backend[@]} -gt 0 ]] && echo "**Backend:** ${backend[*]}" | sed 's/ / | /g'
    [[ ${#frontend[@]} -gt 0 ]] && echo "**Frontend:** ${frontend[*]}" | sed 's/ / | /g'

    echo ""
}

# -----------------------------------------------------------------------------
# Parse YAML Config (Pure Shell Parser)
# -----------------------------------------------------------------------------

parse_yaml_commands() {
    local config_file="$RULES_DIR/config.yaml"

    local current_command=""
    local description=""
    local model=""
    local inject_skills="false"
    local -a rules_list=()
    local in_commands=false
    local in_rules=false

    while IFS= read -r line; do
        # Remove leading/trailing whitespace
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^# ]] && continue

        # Check if we're in commands section
        if [[ "$line" == "commands:" ]]; then
            in_commands=true
            continue
        fi

        if [[ "$in_commands" == true ]]; then
            # Rules section
            if [[ "$line" == "rules:" ]]; then
                in_rules=true

            # New command (no leading spaces before command name, and not "rules:")
            elif [[ "$line" =~ ^([a-z_-]+):$ && "$line" != "rules:" ]]; then
                # Output previous command if exists
                if [[ -n "$current_command" ]]; then
                    echo "$current_command|$description|$model|$inject_skills|${rules_list[*]}"
                fi

                # Start new command
                current_command="${BASH_REMATCH[1]}"
                description=""
                model="sonnet"
                inject_skills="false"
                rules_list=()
                in_rules=false

            # Description field
            elif [[ "$line" =~ ^description:[[:space:]]*(.+)$ ]]; then
                description="${BASH_REMATCH[1]}"

            # Model field
            elif [[ "$line" =~ ^model:[[:space:]]*(.+)$ ]]; then
                model="${BASH_REMATCH[1]}"

            # inject_skills field
            elif [[ "$line" =~ ^inject_skills:[[:space:]]*(true|false)$ ]]; then
                inject_skills="${BASH_REMATCH[1]}"

            # Rule item
            elif [[ "$in_rules" == true && "$line" =~ ^-[[:space:]]*(.+)$ ]]; then
                rules_list+=("${BASH_REMATCH[1]}")
            fi
        fi
    done < "$config_file"

    # Output last command
    if [[ -n "$current_command" ]]; then
        echo "$current_command|$description|$model|$inject_skills|${rules_list[*]}"
    fi
}

# -----------------------------------------------------------------------------
# Build Commands
# -----------------------------------------------------------------------------

build_commands() {
    log_info ""
    log_info "Building commands..."

    mkdir -p "$COMMANDS_DIR"

    local command_count=0

    while IFS='|' read -r cmd_name description model inject_skills rules_list; do
        local command_file="$COMMANDS_DIR/${cmd_name}.md"

        # Write frontmatter
        {
            echo "---"
            echo "description: $description"
            echo "model: $model"
            echo "---"
        } > "$command_file"

        # Add rules content
        for rule_id in $rules_list; do
            if [[ -f "$TEMP_RULES_DIR/$rule_id" ]]; then
                cat "$TEMP_RULES_DIR/$rule_id" >> "$command_file"
                echo "" >> "$command_file"
            else
                log_warning "Rule '$rule_id' not found"
            fi
        done

        # Add skills section if needed
        if [[ "$inject_skills" == "True" || "$inject_skills" == "true" ]]; then
            format_skills_section >> "$command_file"
        fi

        if [[ "$inject_skills" == "True" || "$inject_skills" == "true" ]]; then
            log_success "Generated ${cmd_name}.md (with skills)"
        else
            log_success "Generated ${cmd_name}.md"
        fi

        ((command_count++)) || true
    done < <(parse_yaml_commands)

    echo "$command_count"
}

# -----------------------------------------------------------------------------
# Build Skills
# -----------------------------------------------------------------------------

build_skills() {
    log_info ""
    log_info "Building skills..."

    mkdir -p "$SKILLS_DIR"

    local skill_count=0
    local extended_dir="$RULES_DIR/extended"

    [[ ! -d "$extended_dir" ]] && echo "0" && return

    while IFS= read -r -d '' md_file; do
        local rule_id
        rule_id=$(basename "$md_file" .md)

        [[ ! -f "$TEMP_RULES_DIR/$rule_id" ]] && continue

        local skill_dir="$SKILLS_DIR/$rule_id"
        mkdir -p "$skill_dir"

        local skill_file="$skill_dir/SKILL.md"
        cat "$TEMP_RULES_DIR/$rule_id" > "$skill_file"

        log_success "Generated $rule_id/SKILL.md"
        ((skill_count++)) || true
    done < <(find "$extended_dir" -maxdepth 1 -name "*.md" -print0 2>/dev/null)

    echo "$skill_count"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    log_info "═══════════════════════════════════════════════════════"
    log_info "  Claude CodePro Rule Builder"
    log_info "═══════════════════════════════════════════════════════"
    log_info ""

    # Check if .claude/rules exists
    if [[ ! -d "$RULES_DIR" ]]; then
        echo "Error: Rules directory not found at $RULES_DIR"
        exit 1
    fi

    # Load everything
    load_rules
    discover_skills

    # Build commands and skills
    local command_count
    command_count=$(build_commands)
    local skill_count
    skill_count=$(build_skills)

    # Summary
    log_info ""
    log_info "═══════════════════════════════════════════════════════"
    log_success "Claude CodePro Build Complete!"
    log_info "   Commands: $command_count files"
    log_info "   Skills: $skill_count files"
    log_info "   Available skills: ${#AVAILABLE_SKILLS[@]}"
    log_info "═══════════════════════════════════════════════════════"
}

# Run main
main "$@"

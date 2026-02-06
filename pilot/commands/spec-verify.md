---
description: "Spec verification phase - tests, execution, rules audit, code review"
argument-hint: "<path/to/plan.md>"
user-invocable: false
model: opus
---
# /spec-verify - Verification Phase

**Phase 3 of the /spec workflow.** Runs comprehensive verification: tests, program execution, rules audit, coverage, code review, and E2E tests.

**Input:** Path to a plan file with `Status: COMPLETE`
**Output:** Plan status set to VERIFIED (success) or looped back to implementation (failure)
**On success:** Workflow complete
**On failure:** → `Skill(skill='spec-implement', args='<plan-path>')` to fix issues

---

## ⛔ KEY CONSTRAINTS (Rules Summary)

| # | Rule |
|---|------|
| 1 | **NEVER SKIP verification** - Code verification (Step 3.8) is mandatory. No exceptions. |
| 2 | **NO stopping** - Everything is automatic. Never ask "Should I fix these?" |
| 3 | **Fix ALL findings automatically** - must_fix AND should_fix. No permission needed. |
| 4 | **Quality over speed** - Never rush due to context pressure |
| 5 | **Plan file is source of truth** - Survives session clears |

---

## The Process

**Unit tests → Integration tests → Program execution (with log inspection) → Rules audit → Coverage → Quality → Code review → E2E tests → Final verification**

**All test levels are MANDATORY:** Unit tests alone are insufficient. You must run integration tests AND E2E tests AND execute the actual program with real data.

### Step 3.1: Run & Fix Unit Tests

Run unit tests and fix any failures immediately.

**If failures:** Identify → Read test → Fix implementation → Re-run → Continue until all pass

### Step 3.2: Run & Fix Integration Tests

Run integration tests and fix any failures immediately.

**Common issues:** Database connections, mock configuration, missing test data

### Step 3.3: Build and Execute the Actual Program (MANDATORY)

**⚠️ CRITICAL: Tests passing ≠ Program works**

Run the actual program and verify real output.

**Execution checklist:**
- [ ] Build/compile succeeds without warnings
- [ ] Program starts without errors
- [ ] **Inspect logs** - Check for errors, warnings, stack traces
- [ ] **Verify output correctness** - Fetch source data independently, compare against program output
- [ ] Test with real/sample data, not just mocks

**⛔ Output Correctness - MANDATORY:**
If code processes external data, ALWAYS verify by fetching source data and comparing:
```bash
# Fetch actual source data
aws <service> get-<resource> --output json

# Compare counts/content with what your code logged
# If mismatch → BUG (don't trust logs alone)
```

**If bugs are found:**

| Bug Type | Action |
|----------|--------|
| **Minor** (typo, off-by-one, missing import) | Fix immediately, re-run, continue verification |
| **Major** (logic error, missing function, architectural issue) | Add task to plan, set PENDING, **⛔ Context Guard** (spec.md 0.3), then `Skill(skill='spec-implement', args='<plan-path>')` |

**Rule of thumb:** If you can fix it in < 5 minutes without writing new tests, fix inline. Otherwise, add a task.

### Step 3.3a: Feature Parity Check (if applicable)

**For refactoring/migration tasks:** Verify ALL original functionality is preserved.

**Process:**
1. Compare old implementation with new implementation
2. Create checklist of features from old code
3. Verify each feature exists in new code
4. Run new code and verify same behavior as old code

**If features are MISSING:**

This is a serious issue - the implementation is incomplete.

1. **Add new tasks to the plan file:**
   - Read the existing plan
   - Add new tasks for each missing feature (follow existing task format)
   - Mark new tasks with `[MISSING]` prefix in task title
   - Update the Progress Tracking section with new task count
   - Add note: `> Extended [Date]: Tasks X-Y added for missing features found during verification`

2. **Set plan status to PENDING and increment Iterations:**
   ```
   Edit the plan file:
   Status: COMPLETE  →  Status: PENDING
   Iterations: N     →  Iterations: N+1
   ```

3. **Inform user:**
   ```
   🔄 Iteration N+1: Missing features detected, looping back to implement...

   Found [N] missing features that need implementation:
   - [Feature 1]
   - [Feature 2]

   The plan has been updated with [N] new tasks.
   ```

4. **⛔ Phase Transition Context Guard:** Run `~/.pilot/bin/pilot check-context --json`. If >= 70%, hand off instead (see spec.md Section 0.3).
5. **Invoke implementation phase:** `Skill(skill='spec-implement', args='<plan-path>')`

### Step 3.4: Rules Compliance Audit

**⚠️ MANDATORY: Actually READ every rule file and verify compliance. Don't skip this.**

This step exists because we often forget our own rules. By re-reading each rule file and explicitly checking compliance, we catch mistakes before they ship.

#### Process

**Step 3.4a: Discover and read ALL rules (BOTH standard AND custom)**

**⛔ CRITICAL: You MUST check BOTH directories. Checking only custom rules is NOT sufficient.**

```bash
# List ALL rule files - BOTH directories are MANDATORY
ls -la ~/.claude/rules/*.md    # Standard rules (global) - REQUIRED
ls -la .claude/rules/*.md      # Custom rules (project) - REQUIRED
```

Then use `Read` tool to read EACH file completely from BOTH directories:

| Directory | What It Contains | Required? |
|-----------|------------------|-----------|
| `~/.claude/rules/*.md` | Core development standards (TDD, testing, execution, Python/TS/Go rules, etc.) | **YES - MANDATORY** |
| `.claude/rules/*.md` | Project-specific rules (git commits, project conventions) | **YES - MANDATORY** |

**DO NOT skip standard rules. They contain critical requirements like TDD enforcement, execution verification, and testing standards.**

**Step 3.4b: For EACH rule file, create a compliance checklist**

After reading each rule file, extract the key requirements and check each one:

```markdown
## Rules Compliance Report

### [rule-filename.md]
- [ ] Requirement 1: [description] → ✅ Compliant / ❌ Violation
- [ ] Requirement 2: [description] → ✅ Compliant / ❌ Violation
...

### [next-rule-filename.md]
...
```

#### Common Rules to Check (examples)

| Rule File | Key Requirements to Verify |
|-----------|---------------------------|
| `execution-verification.md` | Did you RUN the actual program (not just tests)? Show output. |
| `tdd-enforcement.md` | Did each test FAIL before you wrote the code? |
| `verification-before-completion.md` | Did you show actual command output as evidence? |
| `testing-strategies-coverage.md` | Is coverage ≥ 80%? Did you mock external calls in unit tests? |
| `python-rules.md` | Did you use `uv` (not pip)? Did you run `ruff` and `basedpyright`? |
| `typescript-rules.md` | Did you detect the package manager? Run `tsc --noEmit`? |
| `git-commits.md` | Using `fix:` prefix? No AI attribution footers? |

**Step 3.4c: Fix ALL violations immediately**

For each violation found:

1. **Fixable Now** (missing command, missing test, formatting):
   - Execute the fix immediately
   - Show the fix output
   - Re-verify the requirement passes

2. **Structural** (missed TDD cycle, wrong architecture):
   - Document the violation
   - If critical, add fix task to plan and loop back

**Step 3.4d: Output brief compliance report**

```
## Rules Compliance Audit
- Standard rules (~/.claude/rules/): [N] checked ✅
- Custom rules (.claude/rules/): [N] checked ✅
- Violations found: [N] | Fixed: [N]
```

**⛔ DO NOT proceed until BOTH directories are checked and all fixable violations are fixed.**

### Step 3.5: Call Chain Analysis

**Perform deep impact analysis for all changes:**

1. **Trace Upwards (Callers):**
   - Identify all code that calls modified functions
   - Verify they handle new return values/exceptions
   - Check for breaking changes in interfaces

2. **Trace Downwards (Callees):**
   - Identify all dependencies of modified code
   - Verify correct parameter passing
   - Check error handling from callees

3. **Side Effect Analysis:**
   - Database state changes
   - Cache invalidation needs
   - External system impacts
   - Global state modifications

### Step 3.6: Check Coverage

Verify test coverage meets requirements.

**If insufficient:** Identify uncovered lines → Write tests for critical paths → Verify improvement

### Step 3.7: Run Quality Checks

Run automated quality tools and fix any issues found.

### Step 3.8: Code Review Verification

**⛔ THIS STEP IS NON-NEGOTIABLE. You MUST run code verification.**

**⚠️ SKIPPING THIS STEP IS FORBIDDEN.** Even if:
- You're confident the code is correct
- Context is getting high (do handoff AFTER verification, not instead of it)
- Tests pass (tests don't catch everything)
- The implementation seems simple

**None of these are valid reasons to skip. ALWAYS VERIFY.**

#### 3.8a: Identify Changed Files

Get list of files changed in this implementation:
```bash
git status --short  # Shows staged and unstaged changes
```

#### 3.8b: Launch Code Verification

Spawn 1 `spec-verifier` agent using the Task tool:

```
Task(
  subagent_type="pilot:spec-verifier",
  prompt="""
  **Plan file:** <plan-path>
  **Changed files:** [file list from git status]

  Review the implementation against the plan. Read the plan file first to understand
  the requirements, then verify the changed files implement them correctly.
  You may read related files for context as needed.
  """
)
```

The verifier:
- Receives the plan file path as source of truth
- Reviews changed files against plan requirements
- Can read related files for context (imports, dependencies, etc.)
- Runs with fresh context (no anchoring bias)
- Returns structured JSON findings

#### 3.8c: Report Findings

Present findings briefly:

```
## Code Verification Complete

**Issues Found:** X

### Must Fix (N) | Should Fix (N) | Suggestions (N)

Implementing fixes automatically...
```

#### 3.8d: Automatically Implement ALL Findings

**⛔ DO NOT ask user for permission. Fix everything automatically.**

This is part of the automated /spec workflow. The user approved the plan - verification fixes are part of that approval. Never stop to ask "Should I fix these?" or "Want me to address these findings?"

**Implementation order (by severity):**

1. **must_fix issues** - Fix immediately (security, crashes, TDD violations)
2. **should_fix issues** - Fix immediately (spec deviations, missing tests, error handling)
3. **suggestions** - Implement if reasonable and quick (< 5 min each)

**For each fix:**
1. Implement the fix
2. Run relevant tests to verify
3. Log: "✅ Fixed: [issue title]"

**After all fixes:**
1. Re-run verification (spawn new verifier) to catch any regressions
2. Repeat until no must_fix or should_fix issues remain (max 3 iterations)
3. If iterations exhausted with remaining issues, add them to plan. **⛔ Phase Transition Context Guard** (spec.md Section 0.3) before invoking `Skill(skill='spec-implement', args='<plan-path>')`

**The only stopping point in /spec is plan approval. Everything else is automatic.**

### Step 3.9: E2E Verification (MANDATORY for apps with UI/API)

**⚠️ Unit + Integration tests are NOT enough. You MUST also run E2E tests.**

Run end-to-end tests to verify the complete user workflow works.

#### For APIs
Test endpoints with curl. Verify status codes, response content, and error handling.

#### For Frontend/UI
Use `agent-browser` to verify UI renders and workflows complete. See `~/.claude/rules/agent-browser.md`.

### Step 3.10: Final Verification

**Run everything one more time:**
- All tests
- Program build and execution
- Diagnostics
- Call chain validation

**Success criteria:**
- All tests passing
- No diagnostics errors
- Program builds and executes successfully with correct output
- Coverage ≥ 80%
- All Definition of Done criteria met
- Code review checklist complete
- No breaking changes in call chains

### Step 3.11: Update Plan Status

**Status Lifecycle:** `PENDING` → `COMPLETE` → `VERIFIED`

**When ALL verification passes (no missing features, no bugs, rules compliant):**

1. **MANDATORY: Update plan status to VERIFIED**
   ```
   Edit the plan file and change the Status line:
   Status: COMPLETE  →  Status: VERIFIED
   ```
2. Read the Iterations count from the plan file
3. Report completion:
   ```
   ✅ Workflow complete! Plan status: VERIFIED

   Summary:
   - [Brief summary of what was implemented]
   - [Key files created/modified]
   - [Test results]

   Is there anything else you'd like me to help with?
   ```

**When verification FAILS (missing features, serious bugs, or unfixed rule violations):**

1. Add new tasks to the plan for missing features/bugs
2. **Set status back to PENDING and increment Iterations:**
   ```
   Edit the plan file:
   Status: COMPLETE  →  Status: PENDING
   Iterations: N     →  Iterations: N+1
   ```
3. Inform user: "🔄 Iteration N+1: Issues found, fixing and re-verifying..."
4. **⛔ Phase Transition Context Guard:** Run `~/.pilot/bin/pilot check-context --json`. If >= 70%, hand off instead (see spec.md Section 0.3).
5. **Invoke implementation phase:** `Skill(skill='spec-implement', args='<plan-path>')`

---

## Context Management (90% Handoff)

After each major operation, check context:

```bash
~/.pilot/bin/pilot check-context --json
```

**Between iterations:**
1. If context >= 90%: hand off cleanly (don't rush!)
2. If context 80-89%: continue but wrap up current task with quality
3. If context < 80%: continue the loop freely

If response shows `"status": "CLEAR_NEEDED"` (context >= 90%):

**⚠️ CRITICAL: Execute ALL steps below in a SINGLE turn. DO NOT stop or wait for user response between steps.**

**Step 1: Write continuation file (GUARANTEED BACKUP)**

Write to `~/.pilot/sessions/$PILOT_SESSION_ID/continuation.md`:

```markdown
# Session Continuation (/spec)

**Plan:** <plan-path>
**Phase:** verification
**Current Task:** Step 3.N - [description]

**Completed This Session:**
- [x] [What was finished]

**Next Steps:**
1. [What to do immediately when resuming]

**Context:**
- [Key decisions or blockers]
```

**Step 2: Trigger session clear**

```bash
~/.pilot/bin/pilot send-clear <plan-path>
```

Pilot will restart with `/spec --continue <plan-path>`

ARGUMENTS: $ARGUMENTS

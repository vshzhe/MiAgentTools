### 1.4 Keyword Detection and Analysis

**Scan user input for keywords** before or during grill-with-docs questioning.

#### Keyword Detection Rules

**Layer 1: Category Keywords** (trigger analysis category)

| Category | Keywords |
|----------|----------|
| Security | security, authentication, auth, login, password, token, session, vulnerability, xss, sql injection, csrf, sanitization, validation, sanitize, escape |
| Architecture | architecture, refactor, restructure, migrate, move, rename, extract, merge, split, component, module, service, api, endpoint, route, call chain, dependency, integration |
| Business | business, workflow, process, flow, state, transition, rule, logic, validation, trigger, event, handler, step, procedure |
| Impact | impact, change, modify, update, delete, remove, add, replace, rename, signature, parameter, return type, breaking |

**Layer 2: Sub-category Keywords** (refine analysis type)

| Sub-category | Keywords |
|--------------|----------|
| Security.InputValidation | input, validate, sanitize, escape, user input, form, request, parameter |
| Security.Authentication | login, signin, authenticate, password, token, jwt, oauth, session |
| Security.DataFlow | data flow, track, trace, source, sink, propagate, tainted |
| Architecture.CallChain | call chain, caller, callee, invocation, dependency, reference, import |
| Architecture.DataFlow | data flow, model, entity, dto, vo, database, query, dao, mapper |
| Architecture.API | api, endpoint, route, handler, controller, request, response |
| Business.StateTransition | state, transition, status, change, trigger, event, condition |
| Business.Validation | validate, rule, check, constraint, requirement, condition |

**Layer 3: Context Modifier Keywords** (adjust analysis scope)

| Modifier | Keywords |
|----------|----------|
| Scope.Modify | modify, update, change, edit, refactor, enhance |
| Scope.Add | add, create, new, introduce, implement |
| Scope.Remove | remove, delete, drop, deprecate |
| Depth.Deep | deep, comprehensive, thorough, full, complete |
| Depth.Targeted | targeted, specific, particular, focused |

#### Detection Logic

```
1. Exact match priority: Check exact keyword match first
2. Substring match: If no exact match, check substring presence
3. Case-insensitive: Match regardless of case
4. Multi-category: Allow multiple categories detected simultaneously
```

#### Analysis Auto-Execution

**Single or multiple categories detected**:
> "Detected [Security/Architecture/Business] keywords. Running corresponding analyses automatically."

**Modifier detected**:
> "Detected [Modify] scope with [Deep] depth. Running deep analysis automatically."

Analyses execute directly upon keyword detection — do NOT offer run/skip options to the user. The recommended option ("Run all") is the default behavior.

#### Analysis Execution

**Security Analysis (Semgrep)**:
Semgrep MCP 为可选增强：不可用时该分析跳过并记录，不阻塞工作流。

```bash
# Use MCP tool for security scanning
mcp__plugin_semgrep_semgrep__semgrep_scan --code-files <paths>

# Or for findings from platform:
mcp__plugin_semgrep_semgrep__semgrep_findings --repos <repo> --issue-type ISSUE_TYPE_SAST
```

**Architecture Analysis (CodeGraph)**:
```bash
# Use symbols from 1.2.1 base scan results (already searched)
# Find callers/callees for deeper understanding
mcp__codegraph__codegraph_callers --symbol <symbol>
mcp__codegraph__codegraph_callees --symbol <symbol>

# Build context after questioning (task description now clearer)
mcp__codegraph__codegraph_context --task <description>
```

**Business Analysis (CodeGraph)**:
```bash
# Use symbols from 1.2.1 base scan results (already searched)
# Build context from task description (after questioning, now clearer)
mcp__codegraph__codegraph_context --task <business-flow>

# Deep exploration of business logic
mcp__codegraph__codegraph_explore --query <topic>
```

#### Analysis Results in Exploration File

Add Analysis section after Background:

```markdown
## Analysis

### Security Findings
- <Vulnerability type>: <Affected area>
  Recommended fix: <Approach>

### Architecture Flow
<ASCII call chain diagram>

### Business Flow
<ASCII business process diagram>

### Identified Symbols
- <Symbol name> (<File location>)
  Reason: <Why identified>
  Priority: <Level>

## Questions
...
```

#### Pending Section Enhancement

Add categorized subsections for Phase 2 attention:

```markdown
## Pending

### For Phase 2 Impact Analysis
- <Symbol name> (<File location>) - Priority: HIGH

### Security Concerns
- <Vulnerability type>: <Affected area> - Fix: <Approach>

### Business Validation
- <Validation question>: <Context>
```

#### Analysis-Driven Follow-Up Questions (NEW)

**After analysis completes**, automatically generate follow-up questions:

```
Algorithm: generateFollowUpQuestions(analysisResults)

1. Security Findings → Generate questions:
   - HIGH/CRITICAL: "Fix XSS in <file>:<line>?" (auto-ask)
   - MEDIUM: "Address SQL injection in <file>?" (on request)
   - Include: vulnerability type, file path, fix recommendation

2. Architecture Symbols → Generate questions:
   - HIGH callers: "Update N callers of <symbol>?" (auto-ask)
   - MEDIUM callers: "Check callers of <symbol>?" (on request)
   - Include: call chain, impact scope, migration plan

3. Business Steps → Generate questions:
   - Decision triggers: "Is <trigger> correct?" (auto-ask)
   - State transitions: "Validate transition rules?" (on request)
   - Include: state change, validation rule, edge cases
```

**Question Priority Logic**:
- **HIGH priority**: Automatically ask (Security CRITICAL, Architecture breaking changes, Business decisions)
- **MEDIUM/LOW priority**: Ask only when user requests: "Show me all follow-up questions"

**Depth-First Questioning**:
- From discovered vulnerability → ask about related security areas
- From breaking change → ask about migration strategy and deprecation timeline
- From decision point → ask about edge cases and error handling

**Example**:
```
After Security analysis finds XSS vulnerability:

AI: "Security analysis found XSS vulnerability in sanitizeInput() at user-utils.ts:45.
    How should we fix it?
    My recommendation: Use DOMPurify for HTML sanitization in this area.

    [Depth-first]
    Should we also check other sanitization points in the authentication flow?
    My recommendation: Yes - review all input validation in auth module."
```

### 1.4.5 Implementation Deep-Dive Analysis (NEW)

**Trigger**: When layered trigger mechanism detects Scope.Modify, Scope.Add + existing code touch, or Depth.Deep keywords.

**Purpose**: Go beyond surface analysis ("what calls what") to understand WHY the code is designed this way before making changes.

**Analysis Dimensions**:

| Dimension | Primary Source | Backup Source |
|-----------|---------------|---------------|
| Design Rationale | Code comments, JavaDoc/docstring | ADR docs, README, design docs |
| Constraints | package.json engines, tsconfig, linter configs | .browserslistrc, CI configs |
| Trade-offs | TODO/FIXME/HACK comments | Code review records, benchmarks |
| Pattern Usage | Class/interface structure, naming conventions | Design pattern library matching |
| Historical Context | `git log --follow`, `git blame` | CHANGELOG.md, version tags |
| Implicit Assumptions | Type guards, default values, missing null checks | Env var dependencies, magic numbers |

**Scope Control** (by trigger level):

| Trigger Level | Dimensions | Max Symbols |
|--------------|------------|-------------|
| 🔴 Auto (Scope.Modify) | All 6 dimensions | 10 core symbols |
| 🟡 Prompt (Scope.Add) | Rationale + Constraints + Assumptions | 10 core symbols |
| 🟢 Manual (Depth.Deep) | User-selected | 10 core symbols |

**Confidence Marking**:
- `HIGH`: Found in code comments, ADRs, or design docs — explicitly documented
- `MEDIUM`: Inferred from git history, naming patterns, or structural analysis
- `LOW`: AI inference from code patterns — MUST generate follow-up question for user confirmation

**Integration with Grill-With-Docs**:
- LOW confidence findings → auto-generate follow-up questions
- Implicit assumptions → always generate confirmation questions
- Trade-offs → ask if they still hold for current requirements

**Output**: Write findings to exploration.md `## Implementation Deep-Dive` section.
Sub-sections with no findings are marked `<!-- No findings -->`.
The entire section is conditionally shown — only when deep analysis is triggered.


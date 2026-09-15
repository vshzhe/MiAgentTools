/**
 * spec 类型技能模板：提案验证门（实现前量化评分）。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';

export function getSpecVerifyProposalSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_spec_verify_proposal',
        description: '提案验证门。在变更提案生成后、实现开始前，对制品做量化评分（D1-D5 核心维度 + D6-D9 条件维度，统一 90% 阈值），检测技术栈并按需执行技术特定检查，通过后可做内联只读深度复查。用于确保提案质量后再进入实现。',
        allowedTools: 'Read, Glob, Grep, Bash(venus:*)',
        type: 'spec',
        instructions: `**Before verifying, read openspec/rules/ai-coding.md for verification criteria.**

Verify artifacts against exploration results before implementation.

This skill performs enhanced 9-dimension verification with quantified scoring and tech stack detection.

**Read-only verification steps execute without confirmation**: artifact reading, file scanning, CodeGraph queries, and D1-D9 scoring analysis run directly without mid-flow confirmation prompts. Only the verification report (and genuinely user-owned choices, e.g., choosing a fix path after a FAIL verdict) is surfaced to the user.

---

## Prerequisites

**Required files**:
- \`openspec/changes/<change-name>/exploration.md\` - Exploration results
- \`openspec/changes/<change-name>/proposal.md\` - Change proposal
- \`openspec/changes/<change-name>/design.md\` - Technical design
- \`openspec/changes/<change-name>/specs/*.md\` - Feature specifications
- \`openspec/changes/<change-name>/tasks.md\` - Implementation tasks
- \`openspec/config.yaml\` - Project configuration (for tech stack detection)

**If no exploration.md exists**: Report "No exploration file found, cannot verify" and exit.

---

## Tech Stack Detection

### Detection Method

Parse \`openspec/config.yaml\` context field for keywords:

| Tech Stack | Detection Keywords |
|------------|---------------------|
| TypeScript | "TypeScript" |
| Java/JSP | "Java", "JSP" |
| Python | "Python" |
| Go | "Go", "Golang" |
| Rust | "Rust" |

### Tech Stack Prompt

If tech stack detected:
> "Detected tech stack: [TypeScript]. Run tech-specific validation?"
> [Yes - apply tech rules] [No - basic only]

### Tech Stack Specific Checks

**TypeScript**:
- ESM import patterns (\`import ... from ...\`)
- \`path.join()\` usage for file operations
- Cross-platform path handling in specs

**Java/JSP**:
- DataStore/DataObject column name lowercase
- Pagination tag structure (html:page + html:pageForm)
- IE compatibility (no ES6+ syntax)

**Python**:
- Import statement ordering
- Type annotation presence
- f-string usage consistency

---

## Change Type Auto-Detection

Before executing D6-D9, detect the change type by scanning design.md and specs:

**Detection Rules** (scan design.md and specs/*.md for keywords):

| Trigger Dimension | Keywords | If Detected |
|-------------------|----------|-------------|
| D6: Interaction Detail | page, component, UI, Vue, React, JSP, template, field, component, 表单, 页面 | Execute D6 |
| D7: API Contract | endpoint, route, handler, controller, POST, GET, PUT, DELETE, API, request, response | Execute D7 |
| D8: Database Mapping | table, column, schema, DDL, migration, 表, 字段, 数据库, database, SQL | Execute D8 |
| D9: Business Steps | 流程, 状态机, 多步骤, 条件分支, 事务, transaction, workflow, state machine, conditional | Execute D9 |

**Detection Output**:
\`\`\`
Detected Change Type: [Full-Stack / Backend-Only / Frontend-Only / DB-Schema]
Enabled Dimensions: D6 [✓/✗], D7 [✓/✗], D8 [✓/✗], D9 [✓/✗]
\`\`\`

Non-triggered dimensions are marked "不适用" and skipped in scoring.

---

## 9-Dimension Verification with Scoring

### Dimension 1: Requirement Coverage

**Check**: Every decision in exploration Decisions section → corresponding spec requirement.

**PASS condition**:
- Each decision has matching spec requirement
- Decision features fully covered in specs

**Coverage calculation**:
\`\`\`
D1 Score = (matched decisions / total decisions) * 100%
\`\`\`

**FAIL examples**:
- "Missing: 'Use email verification' decision has no spec requirement"
- "Partial: 'OAuth + email' decision covers only email in specs"

### Dimension 2: Technical Consistency

**Check**: Technical choices in exploration → reflected in design.md.

**PASS condition**:
- All technical decisions appear in design
- No conflicts between exploration and design

**Coverage calculation**:
\`\`\`
D2 Score = (matched tech choices / total tech choices) * 100%
\`\`\`

**FAIL examples**:
- "Conflict: exploration decided 'SQLite', design specifies 'Redis caching'"
- "Missing: exploration chose 'email/password auth', design doesn't mention authentication"

### Dimension 3: Task Completeness

**Check**: Every spec requirement → at least one corresponding task.

**PASS condition**:
- Each spec requirement has task referencing it
- All scenarios covered by tasks

**Coverage calculation**:
\`\`\`
D3 Score = (requirements with tasks / total requirements) * 100%
\`\`\`

**FAIL examples**:
- "Missing task: 'User can export data' requirement has no implementation task"

### Dimension 4: Boundary Coverage

**Check**: Questions/edge cases in exploration Questions → addressed in specs.

**PASS condition**:
- Each question has spec scenario coverage
- Error conditions from exploration covered in specs

**Coverage calculation**:
\`\`\`
D4 Score = (addressed questions / total questions) * 100%
\`\`\`

**FAIL examples**:
- "Unaddressed: 'What happens if email verification fails?' has no spec scenario"

### Dimension 5: Pending Resolution

**Check**: Items in exploration Pending section → resolved before proposal.

**PASS condition**:
- Pending section empty OR all items have confirmed answers
- Answers reflected in Decisions section

**Coverage calculation**:
\`\`\`
D5 Score = (resolved items / total pending items) * 100%
If pending section empty: D5 Score = 100%
\`\`\`

### Dimension 6: Interaction Detail Completeness [Auto-triggered by frontend keywords]

**Trigger**: Frontend keywords detected in design.md or specs.

**Check**: design.md contains the standardized interaction detail matrix sections:
- **字段-UI组件映射矩阵**: Map each data field to UI component, validation rules, and interaction behavior
- **API 交互契约**: Each endpoint — Method, URL, Request/Response, error codes
- **数据库表-字段映射**: Each table — column name, type, constraints, defaults, business meaning
- **UI 状态覆盖**: Each data-display component — Loading/Empty/Error/Data states

**PASS condition**:
- All four matrix sections present and populated (not empty table templates)
- Each section has at least one row with concrete data
- Coverage rate ≥ 70%

**Coverage calculation**:
\`\`\`
D6 Score = (populated sections / 4) * 100%
Each section counts fully populated if it has ≥ 1 non-placeholder row
\`\`\`

**Legacy Handling** (Backward Compatible):
- If design.md does NOT contain the interaction detail matrix sections (check for section headers):
  - Report WARNING (NOT FAIL): "交互细节矩阵缺失。建议补充以提升实现质量。"
  - WARNING does NOT block apply workflow
- If design.md contains the sections but content is incomplete (new change):
  - Report FAIL (blocks apply): "交互细节矩阵不完整。请补充缺失内容。"

**FAIL examples**:
- "D6 FAIL: 字段-UI组件映射矩阵为空 —— 需要列出字段与组件的对应关系"
- "D6 WARNING: 交互细节矩阵缺失。建议补充以提升实现质量。"

**FAIL handling**:
> Missing or incomplete interaction detail matrix.
> [1] Add interaction detail to design.md [2] Confirm intentional skip [3] Return to design phase

### Dimension 7: API Contract Completeness [Auto-triggered by API keywords]

**Trigger**: API keywords detected in design.md or specs.

**Check**: Each API endpoint listed in design.md has complete contract definition:
- Method (GET/POST/PUT/DELETE)
- URL path
- Request body/params with types
- Response body shape with types
- Error codes (at minimum: 200, 400, 404, 500)

**PASS condition**:
- ≥ 80% of detected endpoints have complete contracts
- Each endpoint has: Method, URL, Request, Response, at least 2 error codes

**Coverage calculation**:
\`\`\`
D7 Score = (endpoints with complete contracts / total endpoints) * 100%
\`\`\`

**Legacy Handling**:
- If no API contracts section found in design.md: WARNING, not FAIL
- WARNING message: "API 交互契约缺失。建议补充端点定义。"

**FAIL examples**:
- "D7 FAIL: POST /api/v1/orders 缺少 Response body 定义"
- "D7 WARNING: API 交互契约缺失。建议补充端点定义。"

### Dimension 8: Database Mapping Completeness [Auto-triggered by DB keywords]

**Trigger**: Database keywords detected in design.md or specs.

**Check**: Each database table referenced has complete field mapping:
- Field name
- Type (VARCHAR, INT, etc.)
- Constraints (NOT NULL, UNIQUE, etc.)
- Default value
- Business meaning

**PASS condition**:
- ≥ 80% of detected tables have complete field mappings
- Each field has at least: name, type, constraints

**Coverage calculation**:
\`\`\`
D8 Score = (tables with complete mappings / total tables) * 100%
\`\`\`

**Legacy Handling**:
- If no DB mapping section found: WARNING, not FAIL
- WARNING message: "数据库表-字段映射缺失。建议补充字段定义以避免实现时猜测。"

**FAIL examples**:
- "D8 FAIL: orders 表字段定义不完整 —— amount 字段缺少类型和约束"
- "D8 WARNING: 数据库表-字段映射缺失。建议补充字段定义以避免实现时猜测。"

### Dimension 9: Business Step Completeness [Auto-triggered by business keywords]

**Trigger**: Business process keywords detected in design.md or specs.

**Check**: Complex business operations (3+ steps or conditional branches) in tasks.md have explicit step decomposition:
- Steps numbered sequentially
- Each step labeled with execution layer [前端]/[后端]/[API]/[DB]
- Error paths documented per step
- Transaction boundaries marked

**PASS condition**:
- ≥ 80% of detected complex operations have step decomposition
- Each decomposition has: numbered steps, layer labels, error paths

**Coverage calculation**:
\`\`\`
D9 Score = (complex ops with decomposition / total complex ops) * 100%
\`\`\`

**Legacy Handling**:
- If no complex operations detected: mark as "不适用", skip
- If complex operations detected but not decomposed: FAIL (no WARNING — this is new behavior)
- FAIL message: "复杂业务操作 X 需要步骤拆解。请添加前端→API→后端→DB 步骤标注。"

**FAIL examples**:
- "D9 FAIL: 用户下单流程 (4步骤, 含事务) 未拆解 —— 需要标注执行层和异常路径"

---

## Overall Score Calculation

\`\`\`
Core D1-D5 Score = (D1 + D2 + D3 + D4 + D5) / 5
Interaction D6-D9 Score = average of triggered dimensions only
Non-triggered dimensions excluded from calculation

Overall Score = (D1 + D2 + D3 + D4 + D5 + sum(triggered D6-D9)) / (5 + triggered_count)

Threshold interpretation (unified 90% — the previous 70%/90% dual-band is removed):
- ≥90%: High quality, ready for implementation (PASS — auto-trigger inline deep review per "Pass Handling")
- <90%: Needs revision before implementation (FAIL — auto-fix and re-run; no skip-to-apply path)
\`\`\`

**WARNING vs FAIL distinction**:
- **WARNING**: Legacy change missing interaction detail sections → does NOT count toward score or block apply
- **FAIL**: New change with incomplete interaction detail sections → counts toward score and blocks apply

---

<!-- CMD:SKIP -->
## Score Report Output

\`\`\`
## Verification Report

**Change**: <change-name>
**Change Type**: Full-Stack (auto-detected)
**Tech Stack**: TypeScript (detected)

| Dimension | Coverage | Status | Issues |
|-----------|----------|--------|--------|
| D1: Requirements | 85% | PASS | 0 |
| D2: Technical | 90% | PASS | 0 |
| D3: Tasks | 100% | PASS | 0 |
| D4: Boundaries | 70% | FAIL | 2 |
| D5: Pending | 100% | PASS | 0 |

**Core Score (D1-D5)**: 89% (Good quality)

### Interaction Detail Verification (Auto-triggered)

| Dimension | Coverage | Status | Issues |
|-----------|----------|--------|--------|
| D6: Interaction Detail | 75% | PASS | 0 |
| D7: API Contract | 80% | PASS | 0 |
| D8: Database Mapping | N/A | SKIP | — |
| D9: Business Steps | 100% | PASS | 0 |

**Overall Score (with triggered D6-D9)**: 87% (Good quality)

### D4 Details (FAIL)
- Missing: "Email verification timeout" scenario
- Missing: "Network failure handling" scenario

### Legacy Warnings (not blocking)
- (none)
\`\`\`

### Report with Legacy Warnings

\`\`\`
## Verification Report

**Change**: legacy-change
**Change Type**: Full-Stack (auto-detected)

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1-D5 (Core) | ... | ... |
| D6: Interaction Detail | — | WARNING |
| D7: API Contract | — | WARNING |

### Legacy Warnings (not blocking apply)
- ⚠ D6 WARNING: 交互细节矩阵缺失。建议补充以提升实现质量。
- ⚠ D7 WARNING: API 交互契约缺失。建议补充端点定义。
\`\`\`
<!-- /CMD:SKIP -->

---

## Pass Handling: Inline Read-Only Deep Review

When ALL dimensions PASS (≥90%):

> "Verification passed! Overall score: XX%"
> "Auto-running inline read-only deep review..."

After scoring PASS, perform an inline read-only deep review of the proposal (not relying on a dedicated skill name). The deep review runs automatically (no [Yes/No] prompt). User MAY interrupt to skip; otherwise it runs.

### Inline Deep Review Steps

Run additional read-only checks inline (no skill invocation):
- Codebase exploration (call chain, data flow)
- Multi-dimensional completeness (8 dimensions)
- Implementation compliance (tech stack, architecture, naming)
- Special feature scenarios (export/import, concurrency)
- Page design details (JSP structure, form elements)
- Logic implementation (business rules, data consistency)
- Quantified scoring with P0/P1/P2 recommendations

---

## Fail Handling: Auto-Fix Loop with Options

When ANY dimension FAILS:

### Step 1: Auto-Fix and Re-Score

AI auto-generates specific fix suggestions, applies them, then re-runs verification:

\`\`\`
## Suggested Fixes for D4

1. Add scenario to specs/auth/spec.md:
   #### Scenario: Email verification timeout
   - WHEN verification takes longer than 30 seconds
   - THEN system shows retry option

2. Add scenario to specs/auth/spec.md:
   #### Scenario: Network failure handling
   - WHEN network connection lost during auth
   - THEN system queues request for retry
\`\`\`

After fixes applied, re-run verification. If still FAIL, proceed to Step 2.

### Step 2: Options (if still FAIL after auto-fix)

\`\`\`
## Verification Failed (after auto-fix)

**Overall Score**: XX% (still below threshold)

### Options (no skip-to-apply path):
[1] 手动编辑 - Fix artifacts yourself
[2] 返回探索 - Return to exploration, add missing decisions
[3] 查看差异 - View diff between artifacts and exploration
\`\`\`

---

<!-- CMD:SKIP -->
## Verification Output

\`\`\`
## Verification Report

**Change**: <change-name>

### Scores

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirement Coverage | XX% | PASS/FAIL |
| D2: Technical Consistency | XX% | PASS/FAIL |
| D3: Task Completeness | XX% | PASS/FAIL |
| D4: Boundary Coverage | XX% | PASS/FAIL |
| D5: Pending Resolution | XX% | PASS/FAIL |

**Overall Score**: XX%

### Threshold (unified 90%)
- ≥90%: High quality ✓ (PASS — auto-run inline deep review)
- <90%: Needs revision ✗ (FAIL — auto-fix and re-run)

---

**Result**: ALL PASS ✓ / FAILED [X]

[If passed]: Auto-run inline read-only deep review
[If failed]: Auto-fix → re-score → if still FAIL, present options [1-3]
\`\`\`

---

## Invocation

\`\`\`bash
# Resolve change name
venus spec status --json

# Read config for tech stack detection (use Read tool on openspec/config.yaml)

# If user specified change:
venus spec status --change "<name>" --json
\`\`\`

Check for \`exploration.md\` in change directory using \`artifactPaths\` from status.
<!-- /CMD:SKIP -->

---

## Guardrails

- **Quantified scoring**: Every dimension has coverage percentage
- **Tech stack detection**: Parse openspec/config.yaml context field
- **Inline deep review**: After pass, run read-only deep check inline (no dedicated skill)
- **Auto-fix loop**: On FAIL, auto-generate and apply fixes, re-score; if still FAIL, offer [手动编辑]/[返回探索]/[查看差异]
- **No exploration**: Cannot verify, report and exit
- **Cross-platform**: Use \`path.join()\` for file paths`,
        license: 'MIT',
        compatibility: '依赖 venus CLI（spec 命令组）。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getSpecVerifyProposalCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 提案验证门',
        description: 'Verify artifacts with quantified scoring - 9-dimension check with tech stack detection',
        category: 'Venus / 规格',
        tags: ['venus', 'spec', 'verify', 'proposal'],
        content: deriveCommandContent(getSpecVerifyProposalSkillTemplate().instructions),
    };
}

/**
 * spec 类型技能模板：提案验证门（实现前量化评分）。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';

const CONDITIONAL_DIMENSIONS_FULL = `### Dimension 6: Interaction Detail Completeness [Auto-triggered by frontend keywords]

**Trigger**: Frontend keywords detected in design.md or specs/**/*.md.

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

**Trigger**: API keywords detected in design.md or specs/**/*.md.

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

**Trigger**: Database keywords detected in design.md or specs/**/*.md.

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

**Trigger**: Business process keywords detected in design.md or specs/**/*.md.

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

### Dimension 10: Flowchart Node Coverage (流程图节点覆盖度) [Auto-triggered by 功能流程图 段]

**Trigger**: 探索产物 \`exploration.md\` 含 \`## 功能流程图\` 段时触发（该段由探索阶段产出并经流程最终确认门确认）。

**Check**: \`## 功能流程图\` 段的**关键操作节点清单**中的每个节点，是否被 \`design\` 段（节点清单引用 / 关键操作节点描述）或 \`tasks.md\`（任务标注的节点 id）覆盖
—— 检查提案与**外部流程基准**的偏差，而非提案自身的完整性（JSON 缺失降级 MD 解析时按对应 MD 制品读取，WARN）。

**Coverage calculation**:
\`\`\`
D10 Score = (被 design/tasks 覆盖的节点数 / 流程图总节点数) * 100%
\`\`\`

**覆盖判定（两级，优先显式标注）**:
1. **显式标注匹配（优先，可复现）**：\`tasks.md\` 任务标注了对应节点 id（\`[N4]\` 形）即视为该节点被覆盖；\`design\` 段显式引用该节点 id 或节点操作名亦计入
2. **语义等价判定（补充）**：节点未被显式标注时，MAY 以 AI **语义等价判定**补充 —— 同一操作的**不同措辞**算命中（如节点"扣减库存"与任务"库存预占"视为同一操作）；
   语义判定 MUST 能指出具体对应之处，MUST NOT 笼统放行

**PASS condition**: 覆盖度 ≥ 90%（与统一阈值一致）。

**纳入既有总分（triggered 集合）**: 本维度纳入既有总分公式的 \`triggered\` 集合，与 D1-D5 核心维度、D6-D10 条件维度**同权重**参与平均分：
\`Overall Score = (D1 + … + D5 + sum(triggered)) / (5 + triggered_count)\`。既有核心+条件维度累加的算法核心与公式本身 MUST NOT 被本维度改动。

**与 D9 的职责分离（自证 vs 他证）**: D9（Business Steps）检查提案**自身**是否拆解复杂操作（**自证**，SHALL 保留不动，MUST NOT 被本维度替换或缩窄）；
本维度检查提案与**外部流程基准**（经用户确认的功能流程图）的偏差（**他证**）。两者互补：D9 查"是否拆了"，本维度查"是否拆对 / 拆全"。

**缺失处理（SKIP，向后兼容）**: 无 \`## 功能流程图\` 段（含该段存在但**未获用户确认**）时，本维度 SHALL 标 **SKIP** 并从总分**分母中排除**（不计入 \`triggered_count\`），
MUST NOT 按 0 分拉低总分、MUST NOT 据此判 FAIL —— 保证归档期既有变更、纯文档 / 纯配置变更不被误伤。

**FAIL 输出（偏差可定位）**: 本维度低于阈值时，报告 MUST **逐条列出未被 design/tasks 覆盖的节点标识与操作名**（如 \`N5 分批查询 — 无对应任务\`），
使偏差定位到具体节点，MUST NOT 仅给出覆盖度百分比。

**只读约束**: 本维度为**只读评分** —— 本技能 \`allowedTools\` 为 \`Read, Glob, Grep, Bash(iagent:*)\`（无 Write/Edit），MUST NOT 要求本技能自行编辑 design.md / specs/**/*.md / tasks.md 修复；
修复建议仅呈现给调用方，由 propose 阶段或用户处置。

**FAIL examples**:
- "D10 FAIL: 节点 N5 分批查询 未被 design/tasks 覆盖（覆盖度 83% = 5/6）"

---

`;

export function getSpecVerifyProposalSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_verify_proposal',
        description: '提案验证门。在变更提案生成后、实现开始前，对制品做量化评分（D1-D5 核心维度 + D6-D10 条件维度，统一 90% 阈值），检测技术栈并按需执行技术特定检查，通过后可做内联只读深度复查。用于确保提案质量后再进入实现。触发词"提案验证 / verify proposal / 评分门 / D1-D10"；NOT for 实现完成后的实现验证（改用 iagent_spec_verify）。',
        allowedTools: 'Read, Glob, Grep, Bash(iagent:*)',
        type: 'spec',
        instructions: `**Before verifying, read openspec/rules/ai-coding.md for verification criteria.**

Verify artifacts against exploration results before implementation.

This skill performs enhanced 10-dimension verification with quantified scoring and tech stack detection.

**Read-only verification steps execute without confirmation**: artifact reading, file scanning, CodeGraph queries, and D1-D10 scoring analysis run directly without mid-flow confirmation prompts. Only the verification report (and genuinely user-owned choices, e.g., choosing a fix path after a FAIL verdict) is surfaced to the user.

---

## Prerequisites

**Required files**:
- \`openspec/changes/<change-name>/proposal.md\` / \`design.md\` / \`specs/**/*.md\` - OpenSpec Markdown primary source
- \`openspec/changes/<change-name>/tasks.md\` - Structured task list (specRef / node annotations)
- \`openspec/changes/<change-name>/exploration.md\` - Exploration results
- \`openspec/config.yaml\` - Project configuration (for tech stack detection)

**Legacy JSON (WARN, non-blocking, 仅存量 / 已归档变更)** - only when the Markdown artifacts are missing: the legacy \`change.json\` / \`tasks.json\` JSON files.

**If no exploration.md exists**: Report "No exploration file found, cannot verify" and exit.

---

## Evidence Reading (Markdown-first)

All dimension checks below read scoring evidence from the OpenSpec Markdown artifacts:

- \`proposal.md\` (change directory) - source of truth: Why / What Changes / Capabilities
- \`design.md\`: Context / Goals / Non-Goals / Decisions / Risks
- \`specs/**/*.md\`: Requirement (\`### Requirement:\`) + Scenario (\`#### Scenario:\` / WHEN / THEN)
- \`tasks.md\` (change directory root) - task entries with \`specRef\` and flowchart node annotations

**Legacy JSON fallback (WARN, 仅存量 / 已归档变更)**: if Markdown artifacts are missing and only historical \`change.json\` / \`tasks.json\` exist, log a WARN ("Markdown artifacts missing - falling back to legacy JSON parsing") and read them read-only. For new changes Markdown is the only source of truth. Fallback is non-blocking but MUST be noted in the verification report.

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
- 数据访问列名/字段名大小写与项目既有实现一致
- 分页标签结构与既有页面一致
- 浏览器兼容级别按项目声明（兼容旧浏览器时不使用其不支持的语法）

**Python**:
- Import statement ordering
- Type annotation presence
- f-string usage consistency

---

## Change Type Auto-Detection

Before executing D6-D10, detect the change type by scanning design.md and specs/**/*.md:

**Detection Rules** (scan design.md and specs/**/*.md for keywords):

| Trigger Dimension | Keywords | If Detected |
|-------------------|----------|-------------|
| D6: Interaction Detail | page, component, UI, Vue, React, JSP, template, field, component, 表单, 页面 | Execute D6 |
| D7: API Contract | endpoint, route, handler, controller, POST, GET, PUT, DELETE, API, request, response | Execute D7 |
| D8: Database Mapping | table, column, schema, DDL, migration, 表, 字段, 数据库, database, SQL | Execute D8 |
| D9: Business Steps | 流程, 状态机, 多步骤, 条件分支, 事务, transaction, workflow, state machine, conditional | Execute D9 |
| D10: Flowchart Node Coverage | 探索产物含 \`## 功能流程图\` 段 | Execute D10 |

**Detection Output**:
\`\`\`
Detected Change Type: [Full-Stack / Backend-Only / Frontend-Only / DB-Schema]
Enabled Dimensions: D6 [✓/✗], D7 [✓/✗], D8 [✓/✗], D9 [✓/✗], D10 [✓/✗]
\`\`\`

Non-triggered dimensions are marked "不适用" and skipped in scoring.

---

## Dimension Verification with Scoring (D1-D10)

### Dimension 1: Requirement Coverage

**Check**: Every declared change item in \`proposal.md\` (Why / What Changes / Capabilities) → corresponding requirement in \`specs/**/*.md\`.

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

**Check**: Technical choices → reflected in \`design.md\` (Context / Goals / Decisions).

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

**Check**: Every requirement in \`specs/**/*.md\` → at least one task in \`tasks.md\` whose \`Spec Ref\` matches it.

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

**Check**: Boundary questions / edge cases → addressed by \`#### Scenario:\` blocks in \`specs/**/*.md\`.

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

> **D6-D10 条件维度下沉**：完整细则见 \`references/conditional-dimensions.md\`；评分前 MUST 先 \`Read\` 该文件。

## Overall Score Calculation

\`\`\`
Core D1-D5 Score = (D1 + D2 + D3 + D4 + D5) / 5
Interaction D6-D10 Score = average of triggered dimensions only
Non-triggered dimensions excluded from calculation

Overall Score = (D1 + D2 + D3 + D4 + D5 + sum(triggered D6-D10)) / (5 + triggered_count)

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

**Overall Score (with triggered D6-D10)**: 87% (Good quality)

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
iagent spec status --json

# Read config for tech stack detection (use Read tool on openspec/config.yaml)

# If user specified change:
iagent spec status --change "<name>" --json
\`\`\`

Check for \`exploration.md\` in change directory using \`artifactPaths\` from status.
Read structured evidence first: \`<change-dir>/proposal.md\`, \`design.md\`, \`specs/**/*.md\` and \`tasks.md\`; if missing, fall back to legacy JSON with a WARN.
<!-- /CMD:SKIP -->

---

## Guardrails

- **Quantified scoring**: Every dimension has coverage percentage
- **Tech stack detection**: Parse openspec/config.yaml context field
- **Inline deep review**: After pass, run read-only deep check inline (no dedicated skill)
- **Auto-fix loop**: On FAIL, auto-generate and apply fixes, re-score; if still FAIL, offer [手动编辑]/[返回探索]/[查看差异]
- **Markdown-first evidence**: Read proposal.md / design.md / specs/**/*.md / tasks.md; missing Markdown degrades to legacy JSON read-only with a WARN (non-blocking)
- **No exploration**: Cannot verify, report and exit
- **Cross-platform**: Use \`path.join()\` for file paths`,
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）。',
        metadata: { author: 'mi-agent-tools' },
        references: [
            { path: 'references/conditional-dimensions.md', content: CONDITIONAL_DIMENSIONS_FULL },
        ],
    };
}

export function getSpecVerifyProposalCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 提案验证门',
        description: 'Verify artifacts with quantified scoring - 10-dimension check with tech stack detection',
        category: 'iAgent / 规格',
        tags: ['iagent', 'spec', 'verify', 'proposal'],
        content: deriveCommandContent(getSpecVerifyProposalSkillTemplate().instructions),
    };
}

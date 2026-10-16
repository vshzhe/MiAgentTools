/**
 * impl 类型技能模板：一站式引导工作流（探索→提案→验证→实现→归档）。
 * 引导式工作流 —— 结构化探索（grill 追问 L1-L5）→ 提案委派生成 → 自动验证门 → 深度复查收束
 * → 实现（委派 spec_apply）→ 归档（委派 spec_archive）。合并自原 iagent_full_workflow。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { GATE_PROTOCOL_PREAMBLE } from '../prompt-gate.js';
import { CODEGRAPH_MCP, SUBAGENT_DISPATCH, skillDelegation } from '../tool-whitelist.js';

const VERIFICATION_PROTOCOL_FULL = `### 3.1 Auto-Execute Verification (No User Prompt)

**⚠️ Verification is now AUTOMATIC — no user choice prompt**

After all artifacts are generated and validated in Phase 2.5, system MUST automatically enter Phase 3 verification without asking the user:

1. **Skip method-specific prompt** — Do NOT show "Propose 方式一步生成，建议运行验证" or "已通过逐步迭代创建，验证可选"
2. **Skip user choice** — Do NOT ask [立即验证] / [跳过验证]
3. **Execute directly** — Proceed to 3.2 Verification Execution

### 3.2 Verification Execution

Execute D1-D5 core verification by **invoking the \`iagent_spec_verify_proposal\` skill** (NOT a CLI instruction):

\`\`\`bash
# Resolve change status first
iagent spec status --change "<name>" --json
# Then invoke the verification skill (iagent_spec_verify_proposal is a SKILL name, not a valid
# \`iagent spec instructions\` artifact ID — valid artifact IDs are proposal/specs/design/tasks only.
# Running \`iagent spec instructions iagent_spec_verify_proposal\` errors with "Artifact not found".)
\`\`\`

Invoke the skill: use the Skill tool to call \`iagent_spec_verify_proposal\` for change \`<name>\`. The skill performs inline D1-D5 scoring by reading the artifacts and exploration.md; it does not depend on any CLI verify command (none exists — the iagent CLI only has \`validate\` for schema-level checks).

**Fallback (skill unavailable)**: If the \`iagent_spec_verify_proposal\` skill is not installed or its invocation fails, fall back to AI inline reading of proposal/specs/design/tasks + D1-D5 manual scoring, and emit WARN log: "iagent_spec_verify_proposal skill unavailable, degraded to inline scoring". Do NOT silently skip verification.

Execute 5-dimension verification:
1. **D1: Requirement Coverage** — Decisions → spec requirements
2. **D2: Technical Consistency** — Technical choices → \`design.md\`
3. **D3: Task Completeness** — Spec requirements → tasks
4. **D4: Boundary Coverage** — Questions/edge cases → spec scenarios
5. **D5: Pending Resolution** — Pending items → resolved
6. **D6-D10: 条件维度** — Interaction Detail / API Contract / DB Mapping / Business Steps / Flowchart Node Coverage，由 \`iagent_spec_verify_proposal\` 按变更类型自动触发；未触发维度不计分

### 3.3 Quantified Score Report

Display verification results with scores:

\`\`\`
## Verification Report

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6-D10: 条件维度 | N/A | SKIP（无触发） |

**Overall Score**: 89%
\`\`\`

Score interpretation (unified 90% threshold — the previous 70%/90% dual-band is removed):
- ≥90%: High quality, ready for implementation (PASS — auto-trigger deep review per 3.5)
- <90%: Needs revision before implementation (FAIL — auto-fix per 3.6)

### 3.4 Tech Stack Detection

Detect tech stack from \`openspec/config.yaml\` context field:

\`\`\`bash
# Read config.yaml and parse context field
# Match keywords: TypeScript, Java/JSP, Python, Go, Rust
\`\`\`

If tech stack detected:
> "Detected tech stack: [TypeScript]. Run tech-specific validation?"
> [Yes] [No - basic only]

### 3.5 Verification Pass → Auto-Trigger Deep Review → Auto-Generate Requirement Doc

When ALL dimensions PASS (≥90%):

1. **Auto-execute deep review** — Invoke the \`iagent_proposal_review\` **skill** (via Skill tool) — Do NOT ask user, auto-execute (user can interrupt to skip)
2. Deep review scope: codebase deep exploration + multi-dimensional completeness
3. Display results alongside verification report
4. **Fallback (skill unavailable or call fails)**: degrade to main-workflow inline read-only deep review + WARN log — never silently skip

> "Verification passed! All D1-D5 ≥90%. Auto-running iagent_proposal_review..."
> [deep review results displayed]

If user wants to skip the deep review, they can interrupt. Otherwise it runs automatically.

5. **Converge — generate the requirement document** — after the deep review converges, invoke \`iagent_requirement_doc\` in non-interactive mode (via Skill tool) to generate the requirement document at \`openspec/changes/<change-name>/需求文档.md\`. The document is generated from the CURRENT artifacts (proposal/specs/design/tasks) before implementation begins — the user can review it during the apply phase. Generation failure is non-blocking (WARN log + continue). MUST NOT ask the user for document basic information. After generation, proceed to the Phase 3.7 implementation bridge (do not stop at apply-ready).
   - Rationale: generating the document at verification time gives the user a review-ready document before implementation starts; the archive phase performs in-place incremental alignment on the existing document

> "Deep review complete."
> "Requirement document: generated at openspec/changes/<name>/需求文档.md."

### 3.6 Verification Fail → Auto-Fix and Re-run

**On FAIL, do NOT generate the requirement document.** Generation happens only after fixes pass re-verification (then 3.5 step 5 runs).

When ANY dimension FAILS (<90%), system MUST auto-fix:

1. **Auto-generate fix suggestions**:
   - For each FAIL dimension, generate specific fixes (missing scenarios, incomplete sections)
   - Example: D4 missing boundary scenario → add scenario to spec

2. **Apply fixes** to artifact files using Edit tool

3. **Auto re-run verification** after fixes applied

4. **Display fix summary**:
   \`\`\`
   ## Auto-Fix Applied
   - D4: Added 2 boundary scenarios to specs/auth/spec.md
   - D1: Added 1 requirement scenario to specs

   Re-running verification...
   \`\`\`

5. **If re-run passes**: Proceed to 3.5 (auto-trigger deep review)
6. **If re-run still fails**: Show remaining issues and offer options (no skip-to-apply path):
   > [1] Manual edit — Fix artifacts yourself
   > [2] Return to exploration — Add missing decisions
   > [3] View detailed diff report

---
`;

export function getWorkflowSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_workflow',
        description: 'One-stop guided workflow from exploration to archive. Creates persistent exploration files, asks clarifying questions until clear (grill-with-docs, L1-L5 per-level gates), delegates artifact generation (iagent_spec_propose), auto-verifies, then delegates implementation (iagent_spec_apply) and archive (iagent_spec_archive) with confirmation bridges. Use when the user wants a guided end-to-end pipeline with追问 (grill-with-docs) questioning and automatic quality verification (triggers: 一站式引导工作流 / guided workflow / workflow from exploration / 引导式全流程). NOT for fully automated no-gate pipeline (use iagent_auto_workflow), single-stage exploration (use iagent_spec_explore), or debugging (use iagent_debug).',
        instructions: `
**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

One-stop guided workflow from exploration to archive with verification and confirmation bridges.

This workflow guides you through:
1. **Exploration phase** - Persistent file + grill-with-docs questioning
2. **Proposal phase** - Create change with all artifacts
3. **Verification phase** - Automatic quality check (D1-D10) + deep review + requirement doc
4. **Implementation phase** - Confirmation bridge → delegate iagent_spec_apply（条件测试子阶段）
5. **Archive phase** - Confirmation bridge → delegate iagent_spec_archive

探索与提案内联执行（无 Skill 委派断层），验证通过后委派阶段 SKILL 实现与归档，阶段间以确认桥保证完整性。区别于 iagent_auto_workflow（全自动无门）。

${GATE_PROTOCOL_PREAMBLE}

---
## Phase 1: Exploration（委派 iagent_spec_explore）

Phase 1 SHALL 经 Skill 工具委派 \`iagent_spec_explore\`（传 \`mode=delegated\`）执行强制 checkpoint 体系探索（强制建探索文件、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。

委派完成后 SHALL 消费 \`iagent_spec_explore\` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号）并据此推进 Phase 2。

**退出守卫**：被委派的 \`iagent_spec_explore\` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

## Phase 2: Proposal

**TodoWrite tracking**: Add Phase 2 items to TodoWrite:
\`\`\`
- [ ] Phase 2: 预迁移验证
- [ ] Phase 2: 委派 iagent_spec_propose 生成全部制品
\`\`\`

### 2.0 Pre-Migration Verification (MANDATORY CHECKPOINT)

**⚠️ MANDATORY: Migration verification before Phase 2 proceeds**

Before creating change directory and migrating exploration file:

#### Verification Steps

1. **Check exploration file exists**
   \`\`\`bash
   # Read exploration.md from openspec/explorations/
   # If file missing, system MUST warn user
   \`\`\`

2. **CONTEXT.md validation (MANDATORY CHECKPOINT)**
   - Check if \`openspec/CONTEXT.md\` exists
   - If EXISTS: Validate all terms from exploration.md 术语表 are in CONTEXT.md
     - If terms missing, auto-sync them
   - If NOT EXISTS: Auto-generate from exploration.md 术语表 section
     - Create \`openspec/CONTEXT.md\` with all resolved terms
   - **Compatibility (Task 12.1, narrowed)**: If no exploration file exists (after 1 path-resolution retry), log WARN "Skipping CONTEXT.md check: no exploration file" and skip the CONTEXT.md check ONLY. This skip does NOT exempt the delegated spec_explore 的聚合一致性门.
   - Log: "CONTEXT.md validated/created — <N> terms"

3. **Validate file content**
   - Check file has minimum required sections (Background, Decisions)
   - If sections missing, warn user and offer recovery options

4. **Handle missing file**
   - **Option A**: Create new file from exploration memory
   - **Option B**: Abort transition and return to exploration
   - User MUST choose before proceeding

#### Migration Failure Recovery

**If migration fails**:
- Preserve source file (MUST NOT delete it on the failure path)
- Clean up partial destination file
- Report error with specific failure reason
- Offer retry or manual migration instructions
- Log failure for user tracking

**Failure Handling Process**:
\`\`\`
1. Source file locked → Unlock or retry
2. Permission denied → Request permissions or manual migration
3. Disk full → Clean up space or manual migration
4. Network error → Retry or manual migration
\`\`\`

**Checkpoint Enforcement**:
- System MUST NOT proceed to artifact generation without valid migration
- If migration fails, system MUST preserve source file
- User MUST be informed of migration status and any errors

#### Impact Trigger Detection

Read exploration.md Pending section:
\`\`\`
If "### For Phase 2 Impact Analysis" section exists AND has symbols:
  Run impact analysis directly (no prompt)
\`\`\`

#### Impact Auto-Execution

> "Found symbols for impact analysis in exploration — running impact analysis automatically. Ensures artifacts include impact context."

Impact analysis always runs when the Pending section contains symbols. No user prompt.

#### Impact Execution

**Use CodeGraph impact tool**:
\`\`\`bash
mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream --maxDepth 3
\`\`\`

**Parallel execution for multiple symbols**: When two or more impact symbols are identified, issue the impact queries in parallel (multiple tool calls in a single response round) instead of one at a time. Merge all results into the artifact impact sections. A single symbol keeps the existing single-query behavior.

**Impact result structure**:
\`\`\`
{
  risk: "HIGH" | "MEDIUM" | "LOW" | "CRITICAL",
  summary: { directCallers, processesAffected, modulesAffected },
  affected_processes: [...],
  affected_modules: [...],
  byDepth: {
    d1: [direct callers],
    d2: [indirect callers],
    d3: [transitive callers]
  }
}
\`\`\`

#### Store Impact Results

Store results for artifact generation:
- \`proposal.md\` Impact: Impact Analysis section
- \`design.md\` Context: Architecture Impact section
- tasks.md: Include ### Caller Updates section

#### Impact Skip Handling

If no impact symbols are found:
- Proceed with artifact generation without impact sections
- \`proposal.md\` Impact / \`design.md\` 与 \`tasks.md\` 不含 Impact 内容

#### Direct Transition to Delegated Proposal Generation

**⚠️ Complexity assessment and generation-method selection are REMOVED from Phase 2.**

After Phase 2.0 impact analysis completes (or is skipped):
- Proceed DIRECTLY to Phase 2.3: delegate iagent_spec_propose (mode=delegated + exploration-file) for migration and artifact generation
- Do NOT compute a complexity score and do NOT display generation-method options
- Step-by-step creation remains available outside this workflow via iagent spec new

**Checkpoint Enforcement**:
- System MUST NOT prompt the user to select a generation method
- System MUST NOT display complexity evaluation results
- System MUST proceed directly from Phase 2.0 to the Phase 2.3 delegation

### 2.3 提案生成（委派 iagent_spec_propose）

Phase 2.0 预迁移验证与影响分析完成后，探索文件迁移与全部制品生成（proposal.md / specs/**/*.md / design.md / tasks.md）SHALL 经 Skill 工具委派 \`iagent_spec_propose\`（传 \`mode=delegated\` + \`exploration-file=<Phase 1 探索文件路径>\`）完成，MUST NOT 内联生成提案制品。制品生成遵循 Markdown-first 共享协议（openspec/rules/artifact-generation.md）。规则注入、schema 验证与 CLI 降级由 \`spec_propose\` 承担。

**退出守卫**：被委派的 \`iagent_spec_propose\` 完成后 MUST NOT 自行进入实现或推进阶段；阶段推进主权归 \`iagent_workflow\`。其结构化回执（change-name / 制品清单 / apply-ready）用于进入 Phase 3 与后续确认桥。

## Phase 3: Verification

**Phase 3 executes automatically after the delegated iagent_spec_propose completes. Phase 3 runs the verification superset (iagent_spec_verify_proposal + iagent_proposal_review + non-interactive iagent_requirement_doc); the delegated spec_propose suppressed its own Phase 3 to avoid duplicate scoring.**

**TodoWrite tracking**: Add Phase 3 items to TodoWrite:
\`\`\`
- [ ] Phase 3: D1 需求覆盖
- [ ] Phase 3: D2 技术一致性
- [ ] Phase 3: D3 任务完整性
- [ ] Phase 3: D4 边界覆盖
- [ ] Phase 3: D5 Pending 解决
- [ ] Phase 3: D6 深度分析覆盖
\`\`\`

After all artifacts are generated and validated in Phase 2.5, automatically enter Phase 3 verification.

> **Phase 3 细则下沉**：自动执行、量化评分、技术栈检测、通过/失败处理见 \`references/verification-protocol.md\`；执行 Phase 3 前 MUST 先 \`Read\` 该文件。

## Phase 3.7: Implementation + Test Bridge (MANDATORY CHECKPOINT)

**⛔ GATE: 实现 + 测试桥（强制停止，单一阻塞门）** — 验证与深度复查收束后，**一次呈现**「提案摘要 + 验证评分 + 深度复查结论 + 实现方案 + 测试计划预告」，等待用户**一次确认**后进入实现（含条件测试生成）。MUST NOT 在实现阶段再设第二个确认门（测试计划确认已并入本桥）。

- 就绪检查：proposal.md / design.md / specs/**/*.md / tasks.md 齐全；验证 PASS（≥90%）；深度复查完成；apply instruction = ready（\`iagent spec instructions apply --change "<name>" --json\`；CLI 不可用读 tasks.md 推断）
- workspace-planning 变更不支持 apply/archive：在此停止，仅保留探索+提案+深度复查结果
- 出口：确认（进入 Phase 4，含条件测试生成）／修改（回 Phase 2 调整制品或回 Phase 1 补决策）／拒绝（记录未确认状态并停止，不进入实现）
- 需求文档已在 Phase 3.5 生成，不在此重复，也不作为本桥阻塞项

---
## Phase 4: Implementation（委派 iagent_spec_apply）

**委派 \`iagent_spec_apply\` 技能**（via Skill tool）执行实现：
- 传入 change-name + \`auto-mode=true\`（跳过 apply 内部的设计确认门——确认已由 Phase 3.7 实现桥承载，避免重复确认）
- apply 内部完成：分层代码生成（Entity/DTO → Mapper/DAO → Service → Controller）、tasks.md 勾选更新、编译检查
- 后端架构规则由 apply 按 \`openspec/rules/ai-coding.md\` 自行处理，workflow 不干预

### 4.1 条件测试子阶段（tasks.md 含 \`[测试]\` 任务时；计划已在 3.7「实现 + 测试桥」一次确认）

- 委派 \`iagent_test\` 技能（via Skill tool，多 schema 自动检测 Java/Node）
- **计划确认已在 Phase 3.7 实现 + 测试桥完成**：本子阶段 MUST NOT 再设独立确认门，直接生成测试代码
- 输出测试代码到项目测试源树并运行验证

### 4.2 实现错误处理

- 编译失败（apply 自动修复 3 次后）：暂停等待用户，不进入归档
- 测试生成阶段拒绝：回退到 Phase 3.7 实现 + 测试桥重新确认实现范围
- 子代理失败：retry 一次，仍失败暂停报告

### 4.3 实现验证桥接（apply → archive 之间，MANDATORY）

- 实现与条件测试完成后，MUST 委派 \`iagent_spec_verify\` 技能（via Skill tool）验证实现与制品（specs/tasks/design）一致性
- 通过 → 进入 Phase 5 归档桥；失败 → 回 Phase 4 修复，MUST NOT 进入归档
- **省略声明（fallback）**：若 \`iagent_spec_verify\` 不可用或项目约定不单独跑实现验证，MUST 在归档桥就绪检查中显式声明「实现验证由 apply 编译检查 + 归档一致性承担」并记录该决策；MUST NOT 静默省略

---
## Phase 5: Archive（委派 iagent_spec_archive）

### 5.1 Archive Bridge (MANDATORY CHECKPOINT)

**⛔ GATE: 归档确认门（强制停止）**
- 就绪检查：tasks.md 全部 \`- [x]\`；编译检查通过；条件测试子阶段完成；实现验证（\`iagent_spec_verify\`）通过或已显式声明省略
- 呈现：实现摘要 + 编译结果 + 测试通过率 + 条件子阶段产物
- 出口：确认（进入归档）／拒绝（返回 Phase 4 继续实现，不归档）

### 5.2 委派 \`iagent_spec_archive\`

- 传入 change-name（跳过选择 prompt）
- archive 内部完成：delta spec 合并主规格、CONTEXT.md 同步、探索记忆同步到 \`specs/<cap>/explorations.md\`、需求文档就地增量对齐（步骤 4.8，保人工域）、目录迁移 \`archive/\`、ARCHIVE-INDEX.md 更新、需求文档迁移 \`devdocs/\`
- sync 检查点 non-blocking（失败 WARN 不阻断）

### 5.3 记忆闭环

- archive 写 \`specs/<cap>/explorations.md\`，供下一轮提案读取
- 输出全流程总结

---
## Output During Workflow

### Example 1: Propose Method (Low Complexity)

\`\`\`
## Exploration Phase

**Checkpoint: Creating exploration file**
✓ Created: openspec/explorations/user-auth-explore-001.md
✓ Verified: File exists and is writable
✓ Ready to proceed with exploration

Question 1: What authentication methods?
Your answer: Email/password + OAuth
→ Recorded in Decisions

Question 2: OAuth providers needed?
Your answer: Google, GitHub
→ Recorded in Decisions

[Continues until clear...]

## Exploration Complete ✓

Checks passed — generating proposal directly

## Proposal Phase

**Checkpoint: Pre-migration verification**
✓ Verified: openspec/explorations/user-auth-explore-001.md exists
✓ Validated: File has Background and Decisions sections

**Checkpoint: Delegated proposal generation (Phase 2.3)**
✓ Skipped complexity evaluation (removed)
✓ Skipped method selection (removed)
✓ Delegating iagent_spec_propose (mode=delegated + exploration-file)

**Checkpoint: Artifact generation (delegated spec_propose)**
✓ Created change directory: openspec/changes/add-user-auth/
✓ Delegated skill generated artifacts
✓ Generated: proposal.md (1/4)
✓ Generated: specs/auth/spec.md (2/4)
✓ Generated: design.md (3/4)
✓ Generated: tasks.md (4/4)
✓ All artifacts complete

## Verification Phase

Phase 3 验证自动执行，无询问（不因 Propose 方式而询问 [立即验证]/[跳过验证]）

Auto-invoking \`iagent_spec_verify_proposal\` skill for D1-D5 scoring...

Running 5-dimension verification...

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6-D10: 条件维度 | N/A | SKIP（无触发） |

Overall Score: 89% (<90%, FAIL)

D4 auto-fix: adding missing boundary scenarios to specs/auth/spec.md...
Artifacts updated. Re-running verification...

Re-run Overall Score: 92% (≥90%, PASS) → auto-triggering iagent_proposal_review deep check...

[deep review results displayed]

Requirement document: generated at openspec/changes/<name>/需求文档.md.

## Verification Complete ✓

All artifacts ready! Proceeding to the Phase 4 implementation bridge...
\`\`\`

### Example 2: Direct Pass (Requirement Document Generated After Verification)

\`\`\`
## Exploration Phase

**Checkpoint: Creating exploration file**
✓ Created: openspec/explorations/complex-refactor-explore-001.md
✓ Verified: File exists and is writable

[Complex exploration with multiple modules...]

## Exploration Complete ✓

Checks passed — generating proposal directly

## Proposal Phase

**Checkpoint: Pre-migration verification**
✓ Verified: exploration.md exists

**Checkpoint: Delegated proposal generation (Phase 2.3)**
✓ Skipped complexity evaluation (removed)
✓ Skipped method selection (removed)

**Checkpoint: Artifact generation (delegated spec_propose)**
✓ Created change: openspec/changes/complex-refactor/
✓ Delegated skill generated artifacts
✓ Generated: proposal.md (1/4)
✓ Generated: specs/module1/spec.md (2/4)
✓ Generated: specs/module2/spec.md (3/4)
✓ Generated: design.md (4/4)
✓ All artifacts complete

## Verification Phase

Phase 3 验证自动执行，无询问

Auto-invoking \`iagent_spec_verify_proposal\` skill for D1-D5 scoring...

Running 5-dimension verification...

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 92% | PASS |
| D2: Technical | 95% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 90% | PASS |
| D5: Pending | 100% | PASS |
| D6-D10: 条件维度 | N/A | SKIP（无触发） |

Overall Score: 95% (≥90%, PASS) → auto-triggering iagent_proposal_review deep check...

[deep review results displayed]

Deep review complete.
Requirement document: generated at openspec/changes/<name>/需求文档.md.

## Verification Complete ✓

All artifacts ready! Proceeding to the Phase 4 implementation bridge...
\`\`\`

**Checkpoint Log Format**:
- Each checkpoint shows: ✓/✗ status, file path, verification result
- Failures show: ✗ operation, error reason, recovery options
- All operations logged for transparency

---
## Cross-Platform Considerations

- Always use \`path.join()\` for file paths
- Never hardcode forward/backward slashes
- Test path operations on Windows, macOS, Linux
- Use \`path.resolve()\` for absolute paths when needed

---
## Guardrails

- **Don't skip questioning** - Keep asking until truly clear
- **Don't auto-proceed on conflict** - Phase transitions proceed automatically when the 1.6 consistency checks pass (consistency passthrough); ask the user only when a hard conflict is detected
- **Do execute read-only operations directly** - File reading, CodeGraph queries, and analysis steps (Semgrep, impact analysis) run without asking the user for confirmation
- **Read-only passthrough does not cover clarification gates** - grill L1-L5 requirement-clarification gates still wait for user confirmation
- **Do auto-verify** - Automatically verify after proposal without user prompt
- **Don't lose exploration** - File persists even on abandon (unless deleted)
- **Don't force fixes** - Offer options on verification fail, user decides
- **MUST create file before questioning** - Phase 1 checkpoint is mandatory
- **MUST validate prompt before exploring** - 委派的 spec_explore（delegated）提示词校验门是强制 checkpoint：清晰输入一句话复述理解后直通（不输出校验表、不要求确认）；不明确输入须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 推进到后续步骤
- **Don't deadlock on the confirmation gate** - 委派的 spec_explore 提示词门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认而陷入等待死循环
- **Do persist the prompt baseline** - 原始提示词与确认后的基线一并写入探索文件 \`## 提示词基线\` 段；基线变更 MUST 回到委派的 spec_explore 提示词门重新确认
- **MUST produce the functional flowchart** - 委派的 spec_explore 流程最终确认门是强制 checkpoint：探索分析完成后 MUST 产出探索文件 \`## 功能流程图\` 段（Mermaid + 节点清单）并执行流程最终确认门；用户确认前 MUST NOT 进入完成检测，MUST NOT 把未确认流程图当作提案锚点
- **Don't deadlock on the flowchart gate** - 委派的 spec_explore 流程确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），拒绝时 propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP，不得反复要求确认
- **MUST NOT silently add nodes in tasks** - 发现遗漏节点 MUST 回到委派的 spec_explore 更新流程图并重新经用户确认，MUST NOT 在 tasks.md 中静默补节点
- **MUST verify file before migration** - Phase 2 checkpoint is mandatory
- **MUST preserve source on migration failure** - Never lose user data
- **MUST NOT offer method selection** - Phase 2 proceeds directly to delegated spec_propose generation (complexity evaluation and method selection removed)
- **MUST delegate artifact generation** - Phase 2.3 delegates \`iagent_spec_propose\` (mode=delegated + exploration-file) for artifact generation; MUST NOT inline-generate proposal artifacts
- **Do explore codebase** - Before asking, check if codebase answers the question
- **Do provide recommendations** - Every question includes AI's recommendation
- **Do update file real-time** - After each exchange, write to exploration file
- **Do use structured format** - Background, Questions, Decisions, Pending sections
- **Do show quantified scores** - Verification results include coverage percentages
- **Do auto-execute deep review** - After pass, auto-trigger iagent_proposal_review skill (user can interrupt to skip); fallback to inline read-only deep review + WARN on skill unavailable or call failure — never silently skip
- **Do log checkpoint status** - Inform user of file creation, verification, migration status
- **Do inject capability memory** - Phase 1 reads specs/<capability>/explorations.md when it exists
- **Do scan other projects with CodeGraph** - When exploration context contains other project paths, spawn sub-agent to scan them using CodeGraph projectPath parameter; fall back to Glob/Grep on failure
- **Do converge after the deep review** - After full pass (D1-D5 + deep review), generate the requirement document (non-interactive \`iagent_requirement_doc\`; failure is non-blocking WARN), then proceed to the Phase 3.7 implementation bridge
- **Do enforce exit guard on delegation** - 委派的阶段子技能（spec_apply / spec_archive / test）完成后 MUST NOT 自行进入 plan/design 模式或推进阶段；workflow 是唯一有权判定阶段完成并推进下一阶段（桥梁）的角色
- **Do pass auto-mode to apply** - Phase 4 向 spec_apply 传 auto-mode=true，由 Phase 3.7 实现桥承载确认，避免 apply 内部设计确认门重复
- **Do pass change-name to archive** - Phase 5 向 spec_archive 传 change-name 跳过选择
- **Do conditional test delegation** - tasks.md 含 \`[测试]\` 任务时委派 iagent_test；测试计划已在 Phase 3.7 实现 + 测试桥一次确认，MUST NOT 再设独立门
`,
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(git:*), Bash(ls:*), ${CODEGRAPH_MCP}, ${skillDelegation(['spec_explore', 'spec_propose', 'spec_verify_proposal', 'proposal_review', 'requirement_doc', 'spec_apply', 'spec_verify', 'test', 'spec_archive'])}, ${SUBAGENT_DISPATCH}`,
        type: 'impl',
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）与阶段技能（iagent_spec_apply / iagent_spec_archive，条件 iagent_test）；CLI 缺失时探索/提案降级为 AI 内联生成（CLI-degraded generation）。',
        metadata: { author: 'mi-agent-tools', version: '1.0' },
        references: [
            { path: 'references/verification-protocol.md', content: VERIFICATION_PROTOCOL_FULL },
        ],
    };
}

export function getWorkflowCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 引导工作流',
        description: '一站式引导工作流：结构化探索（grill 追问 L1-L5）→ 提案内联生成 → 自动验证门 → 深度复查收束 + 需求文档生成 → 委派实现（spec_apply）→ 委派归档（spec_archive）',
        category: 'iAgent / 实现',
        tags: ['iagent', 'impl', 'workflow', 'exploration', 'verification', 'orchestrator'],
        content: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

One-stop guided workflow from exploration to archive with verification and confirmation bridges.

This workflow guides you through:
1. **Exploration phase** - Keyword detection + analysis + grill-with-docs questioning
2. **Proposal phase** - Impact analysis + artifact generation
3. **Verification phase** - Automatic quality check (D1-D10) + deep review + requirement doc
4. **Implementation phase** - Confirmation bridge → delegate iagent_spec_apply（条件测试子阶段）
5. **Archive phase** - Confirmation bridge → delegate iagent_spec_archive

---
**Input**: The argument after \`/iagent:workflow\` is the user's topic description (what they want to build).

---
## Phase 1: Exploration（委派 iagent_spec_explore）

Phase 1 SHALL 经 Skill 工具委派 \`iagent_spec_explore\`（传 \`mode=delegated\`）执行强制 checkpoint 体系探索（强制建探索文件、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。

委派完成后 SHALL 消费 \`iagent_spec_explore\` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号）并据此推进 Phase 2。

**退出守卫**：被委派的 \`iagent_spec_explore\` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

## Phase 2: Proposal

### 2.0 Pre-Migration Verification + Impact Analysis

**Pre-migration check (MANDATORY)**: verify the exploration file exists; if present, validate \`openspec/CONTEXT.md\` against the exploration 术语表 (auto-sync missing terms; auto-generate if absent). If no exploration file exists (after one path-resolution retry), log a WARN and skip the CONTEXT.md check only — the delegated spec_explore consistency gate is NOT exempted. On migration failure, preserve the source file and report the reason.

**Check for impact symbols** in Pending "For Phase 2 Impact Analysis".

If symbols exist:
**Auto-execute impact analysis**:
> "Found symbols for impact analysis. Running impact analysis automatically."

**Tool**: \`mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream\`

**Parallel execution for multiple symbols**: When two or more impact symbols are identified, issue the impact queries in parallel (multiple tool calls in a single response round). Merge all results into the artifact impact sections; a single symbol keeps the existing single-query behavior.

**Results stored for**:
- \`proposal.md\` Impact: Impact Analysis section
- \`design.md\` Context: Architecture Impact section
- tasks.md: Caller Updates section

### 2.1 Direct Transition to Delegated Generation

**⚠️ Complexity assessment and generation-method selection are REMOVED.**

After Phase 2.0 impact analysis (completed or skipped):
- Proceed directly to the Phase 2.3 delegation of iagent_spec_propose (mode=delegated + exploration-file) for migration and artifact generation
- Do NOT compute complexity score or display method options
- Step-by-step creation remains available via iagent spec new

### 2.3 提案生成（委派 iagent_spec_propose）

Phase 2.0 预迁移验证与影响分析完成后，探索文件迁移与全部制品生成（proposal.md / specs/**/*.md / design.md / tasks.md）SHALL 经 Skill 工具委派 \`iagent_spec_propose\`（传 \`mode=delegated\` + \`exploration-file=<Phase 1 探索文件路径>\`）完成，MUST NOT 内联生成提案制品。制品生成遵循 Markdown-first 共享协议（openspec/rules/artifact-generation.md）。规则注入、schema 验证与 CLI 降级由 \`spec_propose\` 承担。

**退出守卫**：被委派的 \`iagent_spec_propose\` 完成后 MUST NOT 自行进入实现或推进阶段；阶段推进主权归 \`iagent_workflow\`。其结构化回执（change-name / 制品清单 / apply-ready）用于进入 Phase 3 与后续确认桥。

## Phase 3: Verification

**Phase 3 executes automatically after the delegated iagent_spec_propose completes. Phase 3 runs the verification superset (iagent_spec_verify_proposal + iagent_proposal_review + non-interactive iagent_requirement_doc); the delegated spec_propose suppressed its own Phase 3 to avoid duplicate scoring. No user choice prompt — verification runs automatically.**

### 3.1 Auto-Execute Verification

- **Skip method-specific prompt** — Do NOT show "Propose 方式一步生成" or "已通过逐步迭代创建"
- **Skip user choice** — Do NOT ask [立即验证] / [跳过验证]
- **Execute directly** — Run D1-D5 verification automatically

### 3.2 Run Verification

- Invoke the \`iagent_spec_verify_proposal\` **skill** (via Skill tool) for D1-D5 scoring — \`iagent_spec_verify_proposal\` is a skill name, NOT a valid \`iagent spec instructions\` artifact ID
- Fallback to AI inline scoring + WARN log if the skill is unavailable; never silently skip
- Calculate coverage rates and overall score (unified 90% threshold)
- Detect tech stack from config.yaml context

### 3.3 Handle Results

**PASS (≥90%)**:
- Auto-execute deep review (\`iagent_proposal_review\` skill via Skill tool, no [Yes/No] prompt, user can interrupt to skip; fallback to main-workflow inline read-only deep review + WARN on skill unavailable or call failure — never silently skip)
- Display results alongside verification report
- **Converge — generate the requirement document**: after the deep review converges, invoke \`iagent_requirement_doc\` in non-interactive mode (via Skill tool); generation failure is non-blocking WARN; then proceed to the Phase 4 implementation bridge

**FAIL (<90%)**:
- Auto-generate fix suggestions and apply fixes
- Re-run verification automatically
- If still FAIL: [Manual edit] [Return to exploration] [View detailed diff] (no skip-to-apply path)

## Phase 4: Implementation（委派 iagent_spec_apply）

⛔ GATE 实现 + 测试桥（单一阻塞门）：验证 + 深度复查收束后，一次呈现「提案摘要 + 评分 + 复查结论 + 实现方案 + 测试计划预告」，等待一次确认后进入实现（含条件测试生成）。就绪检查：proposal.md / design.md / specs/**/*.md / tasks.md 齐全、验证 PASS、apply instruction = ready；workspace-planning 变更在此停止。

- 委派 iagent_spec_apply（via Skill tool，传 change-name + auto-mode=true；确认由本桥承载，避免 apply 内部设计确认门重复）：分层代码生成、tasks.md 勾选更新、编译检查
- 条件测试子阶段（tasks.md 含 [测试] 任务时）：委派 iagent_test（多 schema 自动检测）；测试计划已在上述实现 + 测试桥一次确认，MUST NOT 再设独立门
- 实现验证桥接（MANDATORY）：实现与条件测试完成后委派 iagent_spec_verify（via Skill tool）验证实现与制品一致性；失败回 Phase 4 修复、不进入归档；不可用时 MUST 在归档桥就绪检查中显式声明「由 apply 编译检查 + 归档一致性承担」并记录决策
- 错误处理：编译失败（3 次后）暂停不归档；拒绝回退本桥；子代理失败 retry 一次

## Phase 5: Archive（委派 iagent_spec_archive）

⛔ GATE 归档确认门：tasks.md 全 \`- [x]\` + 编译通过 + 条件子阶段完成 + 实现验证通过（或已显式声明省略），呈现实现摘要后确认进入归档。

- 委派 iagent_spec_archive（via Skill tool，传 change-name 跳过选择）：delta spec 合并主规格、CONTEXT.md 与探索记忆同步、需求文档就地增量对齐（步骤 4.8）、目录迁移 archive/、ARCHIVE-INDEX.md 更新、需求文档迁移 devdocs/；sync 检查点 non-blocking
- 记忆闭环：archive 写 specs/<cap>/explorations.md 供下一轮提案读取，输出全流程总结

## Output

\`\`\`
## Exploration Phase
Created: openspec/explorations/<topic>-explore-001.md
[Questioning until clear...]

## Exploration Complete ✓
Checks passed — generating proposal directly

## Proposal Phase
Created change: <name>
Migrated: exploration.md
Created: proposal.md / design.md / specs/**/*.md / tasks.md

## Verification Phase
Auto-verification running...

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6-D10: 条件维度 | N/A | SKIP（无触发） |

Overall: 89%

[Options on fail or deep check prompt on pass]

Proceeding to Phase 4 implementation bridge...

---
## Output (Full Pass with Requirement Document)

\`\`\`
## Verification Phase

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 95% | PASS |
| D2: Technical | 100% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 100% | PASS |
| D5: Pending | 100% | PASS |

Overall: 99% → deep review complete →
Requirement document: generated at openspec/changes/<name>/需求文档.md.

Proceeding to Phase 4/5: implementation + archive...

## Full Pipeline Complete ✓
Phase 4 实现 + Phase 5 归档完成
\`\`\`

---
## Guardrails

- Don't skip questioning - ask until truly clear
- Don't auto-proceed on conflict - phase transitions proceed automatically when the 1.6 consistency checks pass (consistency passthrough); ask the user only when a hard conflict is detected
- Do execute read-only operations directly - file reading, CodeGraph queries, and analysis steps (Semgrep, impact analysis) run without asking the user for confirmation
- Read-only passthrough does not cover clarification gates - grill L1-L5 clarification gates still wait for user confirmation
- Don't offer method selection - Phase 2 proceeds directly to delegated spec_propose generation
- Do auto-verify - automatically verify after proposal
- Do converge after the deep review - after full pass, generate the requirement document (non-interactive iagent_requirement_doc; failure non-blocking WARN) and proceed to the Phase 4 implementation bridge
- Do inject capability memory - Phase 1 reads specs/<capability>/explorations.md when it exists
- Do scan other projects with CodeGraph - When exploration context contains other project paths, spawn sub-agent to scan them using CodeGraph projectPath parameter; fall back to Glob/Grep on failure

- **Do enforce exit guard on sub-agents** - sub-agents（Agent/Task）完成分配任务后 MUST NOT enter plan mode / design mode / propose next steps；编排器是唯一有权判停和推进阶段的角色
- **Do enforce data sharing** - sub-agents MUST FIRST read shared context before any action and MUST NOT re-derive information already available
- Don't lose exploration - file persists
- Do explore codebase before asking
- Do provide recommendations
- Do update file real-time
- Do use structured format
- Must produce the functional flowchart - 委派的 spec_explore 强制产出探索文件 \`## 功能流程图\` 段并执行流程最终确认门；确认前不进入完成检测、不把未确认流程图当作提案锚点
- Don't deadlock on the flowchart gate - 四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续）
- Don't silently add flowchart nodes in tasks - 遗漏节点 MUST 回到委派的 spec_explore 更新并重新确认
- Do show quantified scores
- **Do enforce exit guard on stage delegation** - 委派的阶段子技能（spec_apply / spec_archive / test）完成后 MUST NOT 自行进入 plan/design 模式或推进阶段；workflow 是唯一有权判定阶段完成并推进的角色
- **Do pass auto-mode to apply** - Phase 4 向 spec_apply 传 auto-mode=true，由实现桥承载确认
- **Do pass change-name to archive** - Phase 5 向 spec_archive 传 change-name 跳过选择
- **Do conditional test delegation** - tasks.md 含 [测试] 任务时委派 iagent_test；测试计划已在实现 + 测试桥一次确认，MUST NOT 再设独立门
`,
    };
}

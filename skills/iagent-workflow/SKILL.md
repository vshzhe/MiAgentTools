---
name: iagent-workflow
description: "一站式引导工作流：从探索到归档。创建持久化探索文件，追问澄清直至明确（grill-with-docs、L1-L5 逐级门），委派制品生成（iagent_spec_propose），自动验证，再委派实现（iagent_spec_apply）与归档（iagent_spec_archive），阶段间以确认桥衔接。当用户需要带追问（grill-with-docs）问答与自动质量验证的引导式端到端管道时使用；触发词\"一站式引导工作流 / guided workflow / workflow from exploration / 引导式全流程\"；NOT for 全自动无门管道（改用 iagent_auto_workflow）、单一阶段探索（改用 iagent_spec_explore）或调试（改用 iagent_debug）。"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(git:*), Bash(ls:*), mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(spec_explore), Skill(spec_propose), Skill(spec_verify_proposal), Skill(proposal_review), Skill(requirement_doc), Skill(spec_apply), Skill(spec_verify), Skill(test), Skill(spec_archive), Agent, Task
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）与阶段技能（iagent_spec_apply / iagent_spec_archive，条件 iagent_test）；CLI 缺失时探索/提案降级为 AI 内联生成（CLI-degraded generation）。
metadata:
  author: mi-agent-tools
  type: impl
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:efe89781acec2cf2754bdaf9780ab2488be7769af60cb876f897eae8324a104b"
---


**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

一站式引导工作流（探索 → 归档），内置验证与确认桥。

**Input**: `/iagent:workflow` 之后的参数是用户的主题描述（想构建什么）。

本工作流将引导你完成：
1. **探索阶段** - 持久化探索文件 + grill-with-docs 追问
2. **提案阶段** - 创建变更并生成全部制品
3. **验证阶段** - 自动质量校验（D1-D10）+ 深度复查 + 需求文档桥（生成 / 跳过）
4. **实现阶段** - 确认桥 → 委派 iagent_spec_apply（条件测试子阶段）
5. **归档阶段** - 确认桥 → 委派 iagent_spec_archive（携带需求文档状态）

阶段之间直接推进（无委派断层），验证通过后委派阶段实现与归档，阶段间以确认桥保证完整性。区别于 iagent_auto_workflow（全自动无门）。

## ⛔ GATE PROTOCOL — ACTIVE

本技能包含以 **⛔ GATE:** 标记的**确认门**。每个门都是硬性停止点：
- 走到 ⛔ GATE 时，**本次响应到此结束** —— 输出门内容后立即停止
- 不得执行、描述或预生成门之后的任何步骤
- 用户的下一则消息即为确认信号 —— 仅在其响应后从门之后继续
- **非门动作 MUST NOT 停止，也 MUST NOT 请求确认**：阶段宣告 / 技能委派（含「是否调用 <技能>」）/ 只读扫描 / CodeGraph 查询 / 状态查询 / 只读校验的「是否运行 <校验>？」询问，均不是确认门
- **只有**门白名单（见「门白名单与 MUST NOT 确认清单」段）声明的 5 类门可以阻断推进；白名单外的动作 MUST NOT 被实现为停止点
- **违规**：未经用户确认而执行门之后的步骤，是破坏工作流的严重错误

## 门白名单与 MUST NOT 确认清单

**必留门（正向枚举 5 类，缺一即流程安全缺陷）**：
- **需求澄清（需求 / 方案歧义）**：prompt-gate / grill-batch-confirmation / diagnostic-confirmation / fix-option-confirmation（可按条件豁免）
- **功能流程图门（流程基准确认）**：flow-final-confirmation（不可豁免）
- **实现 + 测试桥**：implementation-bridge（不可豁免）
- **归档桥**：archive-confirmation（不可豁免）
- **破坏性改动确认（动作级，不可豁免：删除目录 / 覆盖既有制品 / 改写版本库跟踪 / 不可逆命令）**（不可豁免）

**MUST NOT 请求确认（非门动作，MUST NOT 被实现为停止点）**：
- 阶段宣告（如「进入 Phase N」「本阶段开始」）
- 技能委派（含「是否调用 <技能>」类询问）—— 已授权的 nextAllowed 技能直接委派
- 只读扫描（Glob / Grep / Read 与只读查询）
- CodeGraph 查询与能力探测（含锁阶梯只读复用）
- 状态查询（`iagent spec status` / `getChangeStatus` 等）
- 只读校验的「是否运行 <校验>？」询问（如技术栈专项校验）—— 直接执行并在报告中说明校验项

> 跨变更索引重建类动作已随索引能力退役（DEC-2），不构成任何门或动作。

**handoff 包（跨阶段只读复用）**：`iagent_spec_propose` 在 Phase 2 定稿时产出 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`；Phase 3 / 4 / 5 的阶段入口读取该包（`sourceFingerprint` 与制品不一致 → 重建 + WARN），各阶段收尾只向 `## 阶段结论` 追加一行（`phase` / `status` / `artifact` / `nextAllowed`）；MUST NOT 另立包格式或重产整包。

---
## Phase 1: 探索（委派 iagent_spec_explore）

Phase 1 SHALL 委派阶段 `iagent_spec_explore`（传 `mode=delegated`）执行强制检查点体系探索（强制建探索文件、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。

委派完成后 SHALL 消费 `iagent_spec_explore` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号）并据此推进 Phase 2。

**退出守卫**：被委派的 `iagent_spec_explore` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

## Phase 2: 提案

**⚠️ Phase 1 完成后本阶段立即开始 —— 不停顿、不宣告、不向用户提问。** 下一个动作 MUST 是 Phase 2.0 预迁移验证，MUST NOT 输出「探索完成」类单独消息等待确认。

**TodoWrite 跟踪**：把 Phase 2 事项加入 TodoWrite：
```
- [ ] Phase 2: 预迁移验证
- [ ] Phase 2: 委派 iagent_spec_propose 生成全部制品
```

### 2.0 预迁移验证（强制检查点）

**⚠️ 强制：Phase 2 推进前必须完成迁移验证**

在创建变更目录并迁移探索文件之前：

#### 验证步骤

1. **检查探索文件是否存在**
   ```bash
   # Read exploration.md from openspec/explorations/
   # If file missing, system MUST warn user
   ```

2. **CONTEXT.md 校验（强制检查点）**
   - 检查 `openspec/CONTEXT.md` 是否存在
   - 已存在时：校验 exploration.md 术语表中的全部术语都在 CONTEXT.md 中
     - 若有术语缺失，自动同步
   - 不存在时：从 exploration.md 的术语表段自动生成
     - 创建 `openspec/CONTEXT.md`，写全已消解的术语
   - **兼容（Task 12.1，已收窄）**：若探索文件不存在（经 1 次路径解析重试后），记录 WARN 日志"跳过 CONTEXT.md 检查：无探索文件"并**仅**跳过 CONTEXT.md 检查。该跳过不豁免委派的 spec_explore 聚合一致性门。
   - 记录："CONTEXT.md 已校验/已创建 — <N> 个术语"

3. **校验文件内容**
   - 检查文件是否含最低必需小节（Background、Decisions）
   - 若小节缺失，向用户告警并给出恢复选项

4. **处理文件缺失**
   - **选项 A**：依据探索记忆新建文件
   - **选项 B**：中止迁移并返回探索
   - 用户 MUST 先选定再推进

#### 迁移失败恢复

**迁移失败时**：
- 保留源文件（失败路径上 MUST NOT 删除它）
- 清理残缺的目标文件
- 报告错误并给出具体失败原因
- 提供重试或手动迁移指引
- 记录失败以便用户追踪

**失败处理流程**：
```
1. Source file locked → Unlock or retry
2. Permission denied → Request permissions or manual migration
3. Disk full → Clean up space or manual migration
4. Network error → Retry or manual migration
```

**强制检查点**：
- 无有效迁移时，系统 MUST NOT 进入制品生成
- 迁移失败时，系统 MUST 保留源文件
- 用户 MUST 被告知迁移状态与任何错误

#### 影响面触发检测

读取 exploration.md 的 Pending 段：
```
If "### For Phase 2 Impact Analysis" section exists AND has symbols:
  Run impact analysis directly (no prompt)
```

#### 影响分析自动执行

> "在探索文件中发现可做影响分析的符号——自动运行影响分析。确保制品包含影响面上下文。"

Pending 段含符号时，影响分析始终运行，不询问用户。

#### 影响分析执行

**使用 CodeGraph 影响面工具**：
```bash
mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream --maxDepth 3
```

**多符号并行执行**：识别出两个及以上影响面符号时，把影响面查询并行发起（单轮响应内多个工具调用），而不是逐个串行。全部结果合并进制品的影响面小节；单个符号沿用既有的单次查询行为。

**影响面结果结构**：
```
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
```

#### 落盘影响面结果

为制品生成存好结果：
- `proposal.md` 的 Impact：影响面分析小节
- `design.md` 的 Context：架构影响小节
- tasks.md：包含 ### Caller Updates 小节

#### 影响面跳过处理

若未发现影响面符号：
- 不带影响面小节继续生成制品
- `proposal.md` 的 Impact / `design.md` 与 `tasks.md` 不含 Impact 内容

#### 直接转入委派提案生成

**⚠️ 复杂度评估与生成方式选择已从 Phase 2 移除。**

Phase 2.0 影响面分析完成（或跳过）后：
- 直接进入 Phase 2.3：委派 iagent_spec_propose（mode=delegated + exploration-file）完成迁移与制品生成
- 不要计算复杂度评分，也不要展示生成方式选项
- 逐步式创建在本工作流之外仍可用（通过 iagent spec new）

**强制检查点**：
- 系统 MUST NOT 提示用户选择生成方式
- 系统 MUST NOT 展示复杂度评估结果
- 系统 MUST 从 Phase 2.0 直接推进到 Phase 2.3 的委派

### 2.3 提案生成（委派 iagent_spec_propose）

Phase 2.0 预迁移验证与影响分析完成后，探索文件迁移与全部制品生成（proposal.md / specs/**/*.md / design.md / tasks.md）SHALL 委派阶段 `iagent_spec_propose`（传 `mode=delegated` + `exploration-file=<Phase 1 探索文件路径>`）完成，MUST NOT 内联生成提案制品。制品生成遵循**项目规范** `.iagent/rules/spec.md` 的制品协议要点（Markdown-first 共享协议；该文件缺失时以 spec_propose 的内联要点为准并记 WARN，MUST NOT 阻断）。规则注入、schema 验证与 CLI 降级由 `spec_propose` 承担。

**退出守卫**：被委派的 `iagent_spec_propose` 完成后 MUST NOT 自行进入实现或推进阶段；阶段推进主权归 `iagent_workflow`。其结构化回执（change-name / 制品清单 / apply-ready）用于进入 Phase 3 与后续确认桥。

## Phase 3: 验证

**⚠️ 提案制品生成完成后本阶段立即开始 —— 不停顿、不宣告、不向用户提问。**

**委派的 iagent_spec_propose 完成后 Phase 3 自动执行。Phase 3 运行验证超集（iagent_spec_verify_proposal + iagent_proposal_review + 需求文档"生成 / 跳过"桥）；被委派的 spec_propose 已抑制自身的 Phase 3 以避免重复评分，且其独立调用不生成需求文档（文档桥只属于本父流程）。**

**TodoWrite 跟踪**：把 Phase 3 事项加入 TodoWrite：
```
- [ ] Phase 3: D1 需求覆盖
- [ ] Phase 3: D2 技术一致性
- [ ] Phase 3: D3 任务完整性
- [ ] Phase 3: D4 边界覆盖
- [ ] Phase 3: D5 Pending 解决
- [ ] Phase 3: D6 深度分析覆盖
```

全部制品在 Phase 2.5 生成并校验后，自动进入 Phase 3 验证。

> **Phase 3 细则下沉**：自动执行、量化评分、技术栈检测、通过/失败处理见 `references/verification-protocol.md`；执行 Phase 3 前 MUST 先 `Read` 该文件。

## Phase 3.7: 实现 + 测试桥（强制检查点）

**⛔ GATE: 实现 + 测试桥（强制停止，单一阻塞门）** — 验证与深度复查收束后，**一次呈现**「提案摘要 + 验证评分 + 深度复查结论 + 实现方案 + 测试计划预告」，等待用户**一次确认**后进入实现（含条件测试生成）。MUST NOT 在实现阶段再设第二个确认门（测试计划确认已并入本桥）。

- 就绪检查：proposal.md / design.md / specs/**/*.md / tasks.md 齐全；验证 PASS（≥90%）；深度复查完成；apply instruction 状态 = ready（`iagent spec instructions apply --change "<name>" --json`；CLI 不可用读 tasks.md 推断）
- workspace-planning 变更不支持 apply/archive：在此停止，仅保留探索+提案+深度复查结果
- 出口：确认（进入 Phase 4，含条件测试生成）／修改（回 Phase 2 调整制品或回 Phase 1 补决策）／拒绝（记录未确认状态并停止，不进入实现）
- 需求文档桥已在 Phase 3.5 收束（`generated` / `skipped-by-user` / `generation-failed` 已持久化），本桥不重复询问文档，且不因文档失败而阻塞；状态写入失败时已在 Phase 3.5 停止，不得进入本桥

---
## Phase 4: 实现（委派 iagent_spec_apply）

**⚠️ Phase 3.7 实现桥确认后本阶段立即开始 —— 不停顿、不宣告、不向用户提问。** MUST NOT 再输出对该技能的调用确认询问（确认已由 3.7 桥承载）。

**委派 `iagent_spec_apply` 技能**执行实现：
- 传入 change-name + `auto-mode=true`（跳过 apply 内部的设计确认门——确认已由 Phase 3.7 实现桥承载，避免重复确认）
- apply 内部完成：分层代码生成（Entity/DTO → Mapper/DAO → Service → Controller）、tasks.md 勾选更新、编译检查
- 后端架构规则由 apply 按 `.iagent/rules/coding-rules.md` 自行处理，workflow 不干预

### 4.1 条件测试子阶段（tasks.md 含 `[测试]` 任务时；计划已在 3.7「实现 + 测试桥」一次确认）

- 委派 `iagent_test` 技能（多 schema 自动检测 Java/Node）
- **计划确认已在 Phase 3.7 实现 + 测试桥完成**：本子阶段 MUST NOT 再设独立确认门，直接生成测试代码
- 输出测试代码到项目测试源树并运行验证

### 4.2 实现错误处理

- 编译失败（apply 自动修复 3 次后）：暂停等待用户，不进入归档
- 测试生成阶段拒绝：回退到 Phase 3.7 实现 + 测试桥重新确认实现范围
- 子代理失败：retry 一次，仍失败暂停报告

### 4.3 实现验证桥接（apply → archive 之间，强制）

- 实现与条件测试完成后，MUST 委派 `iagent_spec_verify` 技能验证实现与制品（specs/tasks/design）一致性
- 通过 → 进入 Phase 5 归档桥；失败 → 回 Phase 4 修复，MUST NOT 进入归档
- **省略声明（fallback）**：若 `iagent_spec_verify` 不可用或项目约定不单独跑实现验证，MUST 在归档桥就绪检查中显式声明「实现验证由 apply 编译检查 + 归档一致性承担」并记录该决策；MUST NOT 静默省略

---
## Phase 5: 归档（委派 iagent_spec_archive）

**⚠️ 实现验证通过后本阶段立即开始 —— 不停顿、不宣告、不向用户提问**，直至 5.1 归档确认门（唯一的归档阻塞门）。

### 5.1 归档桥（强制检查点）

**⛔ GATE: 归档确认门（强制停止）**
- 就绪检查：tasks.md 全部 `- [x]`；编译检查通过；条件测试子阶段完成；实现验证（`iagent_spec_verify`）通过或已显式声明省略
- 呈现：实现摘要 + 编译结果 + 测试通过率 + 条件子阶段产物
- 出口：确认（进入归档）／拒绝（返回 Phase 4 继续实现，不归档）

### 5.2 委派 `iagent_spec_archive`

- 传入 change-name（跳过选择提示）与 `requirementDocStatus`（Phase 3.5 桥的持久状态：`generated` / `skipped-by-user` / `generation-failed` / `absent`）
- archive 以"文件存在优先、状态裁决缺失分支"分流：已存在文档就地增量对齐并保护人工域；`absent` 才走历史兼容生成（archive 亦从变更 `exploration.md` 读取同一状态，跨会话可恢复）
- archive 内部完成：delta spec 合并主规格、CONTEXT.md 同步、探索记忆同步到 `specs/<cap>/explorations.md`、需求文档就地增量对齐（步骤 4.8，保人工域）、目录迁移 `archive/`、ARCHIVE-INDEX.md 更新、需求文档迁移 `devdocs/`
- sync 检查点非阻断（失败 WARN 不阻断）

### 5.3 记忆闭环

- archive 写 `specs/<cap>/explorations.md`，供下一轮提案读取
- 输出全流程总结

---
## Output（工作流输出示例）

### 示例 1：提案方式（低复杂度）

```
## Exploration Phase

**检查点：创建探索文件**
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

**检查点：预迁移验证**
✓ Verified: openspec/explorations/user-auth-explore-001.md exists
✓ Validated: File has Background and Decisions sections

**检查点：委派提案生成（Phase 2.3）**
✓ Skipped complexity evaluation (removed)
✓ Skipped method selection (removed)
✓ Delegating iagent_spec_propose (mode=delegated + exploration-file)

**检查点：制品生成（委派 spec_propose）**
✓ Created change directory: openspec/changes/add-user-auth/
✓ Delegated skill generated artifacts
✓ Generated: proposal.md (1/4)
✓ Generated: specs/auth/spec.md (2/4)
✓ Generated: design.md (3/4)
✓ Generated: tasks.md (4/4)
✓ All artifacts complete

## Verification Phase

Phase 3 验证自动执行，无询问（不因 Propose 方式而询问 [立即验证]/[跳过验证]）

Auto-invoking `iagent_spec_verify_proposal` skill for D1-D5 scoring...

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

需求文档桥：生成 → 已生成 openspec/changes/<name>/需求文档.md（状态 generated）；跳过 → 状态 skipped-by-user

## Verification Complete ✓

All artifacts ready! Proceeding to the Phase 4 implementation bridge...
```

### 示例 2：直接通过（验证后经需求文档桥）

```
## Exploration Phase

**检查点：创建探索文件**
✓ Created: openspec/explorations/complex-refactor-explore-001.md
✓ Verified: File exists and is writable

[Complex exploration with multiple modules...]

## Exploration Complete ✓

Checks passed — generating proposal directly

## Proposal Phase

**检查点：预迁移验证**
✓ Verified: exploration.md exists

**检查点：委派提案生成（Phase 2.3）**
✓ Skipped complexity evaluation (removed)
✓ Skipped method selection (removed)

**检查点：制品生成（委派 spec_propose）**
✓ Created change: openspec/changes/complex-refactor/
✓ Delegated skill generated artifacts
✓ Generated: proposal.md (1/4)
✓ Generated: specs/module1/spec.md (2/4)
✓ Generated: specs/module2/spec.md (3/4)
✓ Generated: design.md (4/4)
✓ All artifacts complete

## Verification Phase

Phase 3 验证自动执行，无询问

Auto-invoking `iagent_spec_verify_proposal` skill for D1-D5 scoring...

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
需求文档桥：生成 → 已生成 openspec/changes/<name>/需求文档.md（状态 generated）；跳过 → 状态 skipped-by-user

## Verification Complete ✓

All artifacts ready! Proceeding to the Phase 4 implementation bridge...
```

**检查点日志格式**：
- 每个检查点展示：✓/✗ 状态、文件路径、校验结果
- 失败展示：✗ 操作、错误原因、恢复选项
- 所有操作均记录日志以便追溯

---
## 跨平台注意事项

- 文件路径一律用 `path.join()`
- 不要硬编码正斜杠 / 反斜杠
- 在 Windows、macOS、Linux 上验证路径操作
- 需要绝对路径时用 `path.resolve()`

---
## Guardrails

- **不要跳过追问** - 一直问到真正清晰为止
- **冲突时不要自动推进** - 1.6 一致性检查通过（一致性直通）时阶段自动推进；仅在检测到硬冲突时才询问用户
- **只读操作直接执行** - 文件读取、CodeGraph 查询与分析步骤（Semgrep、影响面分析）无需征得用户确认即可运行
- **只读直通不覆盖澄清门** - grill L1-L5 需求澄清门仍须等待用户确认
- **自动验证** - 提案完成后自动验证，不询问用户
- **不要丢失探索成果** - 即使用户放弃，探索文件依然保留（除非被删除）
- **不要强制修复** - 验证失败时给出选项，由用户决定
- **MUST 先建文件再追问** - Phase 1 检查点为强制项
- **MUST 先校验提示词再探索** - 委派的 spec_explore（delegated）提示词校验门是强制检查点：清晰输入一句话复述理解后直通（不输出校验表、不要求确认）；不明确输入须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 推进到后续步骤
- **确认门不要死锁** - 委派的 spec_explore 提示词门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认而陷入等待死循环
- **落盘提示词基线** - 原始提示词与确认后的基线一并写入探索文件 `## 提示词基线` 段；基线变更 MUST 回到委派的 spec_explore 提示词门重新确认
- **MUST 产出功能流程图** - 委派的 spec_explore 流程最终确认门是强制检查点：探索分析完成后 MUST 产出探索文件 `## 功能流程图` 段（Mermaid + 节点清单）并执行流程最终确认门；用户确认前 MUST NOT 进入完成检测，MUST NOT 把未确认流程图当作提案锚点
- **流程门不要死锁** - 委派的 spec_explore 流程确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），拒绝时 propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP，不得反复要求确认
- **MUST NOT 在 tasks 中静默补节点** - 发现遗漏节点 MUST 回到委派的 spec_explore 更新流程图并重新经用户确认，MUST NOT 在 tasks.md 中静默补节点
- **MUST 先校验文件再迁移** - Phase 2 检查点为强制项
- **MUST 在迁移失败时保留源文件** - 绝不丢失用户数据
- **MUST NOT 提供生成方式选择** - Phase 2 直接进入委派的 spec_propose 生成（复杂度评估与方式选择已移除）
- **MUST 委派制品生成** - Phase 2.3 委派 `iagent_spec_propose`（mode=delegated + exploration-file）生成制品；MUST NOT 内联生成提案制品
- **先探索代码库** - 提问前先确认代码库是否已能回答该问题
- **必须给出建议** - 每个问题都附带 AI 的建议
- **实时更新文件** - 每轮交流后写入探索文件
- **使用结构化格式** - Background、Questions、Decisions、Pending 小节
- **展示量化评分** - 验证结果包含覆盖率百分比
- **自动执行深度复查** - 通过后自动触发 iagent_proposal_review 技能（用户可中断跳过）；技能不可用或调用失败时降级为内联只读深度复查 + WARN——永不静默跳过
- **记录检查点状态** - 告知用户文件创建、校验与迁移状态
- **注入能力记忆** - Phase 1 在 specs/<capability>/explorations.md 存在时读取它
- **用 CodeGraph 扫描其他项目** - 探索上下文含其他项目路径时，派发子代理用 CodeGraph 的 projectPath 参数扫描；失败时降级为 Glob/Grep
- **深度复查后收束** - 全量通过（D1-D5 + 深度复查）后展示**一次**需求文档"生成 / 跳过"桥：生成 → 直接非交互委派 `iagent_requirement_doc`（失败记 `generation-failed` + WARN 并继续）、跳过 → 记 `skipped-by-user`；状态写入变更 `exploration.md` 的 `## 需求文档状态` 段（写入失败重试一次仍失败即停止，不进入 Phase 3.7），随后进入 Phase 3.7 实现桥
- **FAIL 不出文档桥** - 验证失败或重验循环中 MUST NOT 生成需求文档、MUST NOT 展示生成/跳过桥
- **文档状态跨阶段传递** - 桥结果（`generated` / `skipped-by-user` / `generation-failed` / `absent`）持久化于变更探索文件并经 apply 传至 archive；archive 以文件存在优先、状态裁决缺失分支，不因新会话退回兼容生成
- **对委派执行退出守卫** - 委派的阶段子技能（spec_apply / spec_archive / test）完成后 MUST NOT 自行进入 plan 模式 / 设计模式或推进阶段；workflow 是唯一有权判定阶段完成并推进下一阶段（桥梁）的角色
- **向 apply 传 auto-mode** - Phase 4 向 spec_apply 传 auto-mode=true，由 Phase 3.7 实现桥承载确认，避免 apply 内部设计确认门重复
- **向 archive 传 change-name** - Phase 5 向 spec_archive 传 change-name 跳过选择
- **条件委派测试** - tasks.md 含 `[测试]` 任务时委派 iagent_test；测试计划已在 Phase 3.7 实现 + 测试桥一次确认，MUST NOT 再设独立门


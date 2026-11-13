# 变更提案：improve-verify-review

## Why

探索与影响分析（exploration.md）证实验证链存在三类能力缺口，且用户已确认以「并入既有维度」策略补齐（D1-D4）：

1. **影响面三制品生成侧已有、验证侧零消费**：workflow / auto-workflow 编排已产出影响面三制品——`proposal.md` Impact 影响面分析小节、`design.md` 架构影响小节、`tasks.md` Caller Updates 小节（workflow.ts:273-279），但 spec-verify-proposal（D1-D10 评分）与 spec-verify（三维度）没有任何维度消费它们——提案漏影响面 / 实现越出声明影响面均无法被验证发现。
2. **review 无提案↔实现一致性能力点**：review.ts 只有五维度检查（review.ts:23-27），不看活跃变更制品；「根据 apply 实现结果与提案内容做一致性检查」无落点。
3. **spec-verify.ts:39 双语义**：正文同时声明「一次合并执行 D1-D10 核心维度 + B1-B7 边界清单」与后文三维度（Completeness / Correctness / Coherence）步骤，父编排内联调用与独立调用的分工未显式化。

本变更把上述缺口落地为三个技能模板的检查段扩展：全部检查点**并入既有维度**（不新增 D 编号）、总分公式与 90% 统一阈值不变、CLI 校验代码零改动。

## What Changes

- **spec-verify-proposal.ts（D3 评分段）**：D3（任务完整性）并入「待实现功能覆盖检查点」——对 proposal.md What Changes 的每个声明项，核查「变更项 → specs Requirement → tasks 承接任务」链路逐级存在（D2 决策）
- **spec-verify-proposal.ts（新增检查步骤）**：变更类型检测后新增「影响面制品存在性判定」（流程节点 N3）→ 三制品存在时并入 D2/D3 执行「影响范围一致性检查」（N5，脱节 FAIL 逐条可定位、缺失 SKIP 排除分母、JSON-only 降级 SKIP+WARN）（D4/BS-1..BS-5）
- **spec-verify.ts**：Correctness 检查段并入「实现影响面 vs 提案声明影响面」对比（N12，越面 WARNING 逐条列出）；执行方式段双语义显式化（合并清单模式 vs 三维度 report-only 模式，判定信号明确）（D2/D3）
- **review.ts**：执行步骤新增「变更关联检测」（N17，条件触发）与「提案↔实现一致性检查」（N19，语义层——设计决策遵循 / 场景实现 / 影响面越界；结构层证据引用 `iagent spec conformance`，分工不重复）；无变更关联时五维度行为不变（BS-3）（D2/D5）
- **细则下沉**：影响范围一致性判定矩阵写入 spec-verify-proposal 新增 `references/impact-consistency.md`（CONDITIONAL_DIMENSIONS_FULL 之外的新常量 + references 数组条目），保持 SKILL.md 行数预算（D6）
- **评估留痕**：全部「保留 / 调整 / 不改」评估结论写入 design.md 评估记录段（D3/BS-6）：总分公式（spec-verify-proposal.ts:147/:386-390）、90% 统一阈值（:392-395）、D9 自证职责（:149-150）、review 五维度、维度名枚举消费点均为**不改**
- **不动项（硬约束）**：不新增维度编号（D11+）、不改总分公式与 90% 阈值、不动 CLI 校验代码（src/core/spec/ 等）、不改 workflow.ts / auto-workflow.ts / debug.ts / proposal-review.ts（维度名枚举在「扩展不改名」下保持有效）、不新增 allowedTools 权限（review 现有 `Bash(iagent:*)` 已隐含放行 conformance，review.ts:11）

## Capabilities

### New Capabilities
- `spec-verify-proposal`: 提案验证门新增「待实现功能覆盖」与「影响范围一致性」检查能力点（并入 D2/D3 评估，不新增维度编号）
- `spec-verify`: 后置验证 Correctness 并入实现影响面对比；执行方式双语义显式化；report-only 权限边界保持
- `review`: 提案↔实现一致性条件检查点（语义层，与结构层 conformance 分工）

### Modified Capabilities

（无既有 spec 能力被修改——openspec/specs/ 当前无已归档能力规格，本变更以新增能力承载）

## Impact

### Impact Analysis

影响分析（Phase 2.0，按 exploration.md Pending 符号逐一执行，codegraph_explore 上游爆炸半径 + Grep 调用点枚举）：6 个目标模板工厂符号均为 `registry.ts` WORKFLOW_PAIRS（registry.ts:105-134）注册 + 对应测试引用，改动收敛在模板正文 / 常量层，不触碰注册表与调用方签名：

| 符号 | 定义处 | 上游调用方 | 测试引用 | Priority |
| :--- | :--- | :--- | :--- | :--- |
| getSpecVerifyChangeSkillTemplate | spec-verify.ts:8 | registry.ts WORKFLOW_PAIRS 条目 | test/stage-continuation.test.ts、test/template-derivation.test.ts | HIGH |
| getSpecVerifyProposalSkillTemplate | spec-verify-proposal.ts:168 | registry.ts WORKFLOW_PAIRS 条目 | test/stage-continuation.test.ts、test/template-derivation.test.ts | HIGH |
| getReviewSkillTemplate | review.ts:7 | registry.ts WORKFLOW_PAIRS 条目 | test/stage-continuation.test.ts、test/template-derivation.test.ts | HIGH |
| getWorkflowSkillTemplate | workflow.ts:133 | registry.ts WORKFLOW_PAIRS 条目 | test/stage-continuation.test.ts、test/template-derivation.test.ts | HIGH |
| getAutoWorkflowSkillTemplate | auto-workflow.ts:16 | registry.ts WORKFLOW_PAIRS 条目 | test/template-derivation.test.ts | MEDIUM |
| getProposalReviewSkillTemplate | proposal-review.ts:415 | registry.ts WORKFLOW_PAIRS 条目 | test/template-derivation.test.ts | MEDIUM |

- **零改动约束源**：维度名枚举点（workflow.ts:31-39、auto-workflow.ts:30/:90-100、debug.ts:285、proposal-review.ts:438、spec-verify.ts:39）在「扩展不改名」策略下保持有效；registry.ts / derive-command.ts 无需改动（command 版自动派生）；CLI 校验代码（src/core/spec/ 等）零触及
- **白名单结论**：review 现有 allowedTools（review.ts:11）已含 `Bash(iagent:*)`，语义层引用 conformance 无需扩权；spec-verify / spec-verify-proposal 白名单不变
- **构建链**：模板改动后必须 `pnpm build && pnpm generate:skills`（skills/ 快照由 test/skills-parity.test.ts 消费）

### 直接影响的文件

- `src/core/templates/workflows/spec-verify-proposal.ts`: D3 检查段并入待实现功能覆盖检查点；新增影响面制品存在性判定步骤（N3）与影响范围一致性检查段（N5）；新增 references 常量与 references 数组条目
- `src/core/templates/workflows/spec-verify.ts`: Correctness 检查段并入实现影响面对比；执行方式段双语义显式化
- `src/core/templates/workflows/review.ts`: 执行步骤新增变更关联检测（N17）与提案↔实现一致性检查（N19）；allowedTools 维持现状
- `skills/`: 静态快照由 `pnpm generate:skills` 再生成（非手工编辑）
- `test/`: 新增检查点单测（新测试文件）+ 既有 stage-continuation / template-derivation / allowed-tools / skills-parity / skill-size-budget 回归同步

### 向后兼容

无破坏性变更：仅模板正文检查段扩展，派生 command 版由 derive-command.ts 自动再生成；维度编号、总分公式、90% 统一阈值、门白名单、allowedTools 均不变；存量 JSON-only 降级路径以 SKIP+WARN 兼容（BS-5）。

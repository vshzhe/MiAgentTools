## Why

首轮技能体系审计（`openspec/explorations/skill-orchestration-audit-explore-001.md`）识别出三项 P2 级问题，当时作为后续独立变更留待处理，本轮专项复核后确认其规模与影响：

1. **F-17 上游复制面**：`iagent_spec_explore` 与上游 `openspec-explore` 共享 11 个同名 section；主 SKILL.md 中约 **290/409 行**为上游衍生散文（`The Stance` / `What You Might Do` / `OpenSpec Awareness` / `Handling Different Entry Points` / `Ending Discovery` / `What We Figured Out`）。复制面大且无来源标注，上游演进时无法感知漂移。
2. **F-18 门密度**：单次「委派探索 + 编排流程」最多触及 **约 10 次用户停顿**（提示词门 1 + grill L1-L5 ≤5 + 流程确认门 1 + 聚合一致性门 1 + 实现桥 1 + 测试计划门 1 + 归档桥 1）。其中 grill 逐决策增量确认与「实现桥 + 测试计划门」两处存在可合并空间，违背"引导式工作流应当流畅"的体验目标。
3. **F-19 体量**：`iagent_spec_explore` 单技能 73.8KB（主 409 行 + `exploration-protocol.md` 874 行），为全库最大技能；协议文件是单一巨石，未按关注点分层，`Read` 时全量加载。

本变更把 F-17/F-18/F-19 一次性收敛：**内容下沉**（缓解 F-17/F-19）与**门控合并**（缓解 F-18）。

## What Changes

1. **探索指导下沉（F-17/F-19）**：把 `iagent_spec_explore` 主 SKILL.md 中上游衍生的探索散文下沉 `references/exploration-guidance.md`，主文件仅保留「触发 / 确认门 / 阶段骨架 / 委派 / Guardrails」；主文件行数预算收紧至 **≤ 250 行**。
2. **探索协议分层（F-19）**：把 `references/exploration-protocol.md`（874 行）按关注点拆分为协议主文件 + 子 references（`multi-project-scan.md` / `grill-playbook.md` / `deep-analysis.md`），执行对应步骤前按需 `Read`。
3. **上游来源标注与漂移防护（F-17）**：衍生参考文件标注"源自上游 openspec-explore"，并新增回归测试锁定 iagent 专有断言（GATE / 门 / 委派）不因上游同步而丢失。
4. **门预算（F-18）**：定义"每阶段 ≤ 1 个阻塞确认门"并新增结构断言；据此合并下两项。
5. **grill L1-L5 批量确认（F-18）**：逐决策增量门合并为 **≤ 2 批**（L1-L3 一批、L4-L5 一批），保留最低确认深度 L3。
6. **实现桥合并（F-18）**：`iagent_workflow` 的实现确认桥（3.7）与测试计划确认门（4.1）合并为单一「实现 + 测试桥」。
7. **聚合一致性门直通语义（F-18）**：无硬冲突时自动直通（non-blocking），仅在检测到硬冲突时暂停；在正文显式声明该语义，避免被当作第 N 个停顿。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `spec-workflow-skills`: spec-explore 主文件渐进披露与预算收紧、探索协议分层、上游衍生内容来源标注与漂移防护测试。
- `workflow-suite-skills`: 门预算约束、grill L1-L5 批量确认、实现桥合并、聚合一致性门直通语义。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-explore.ts`: 主文件下沉衍生散文；协议拆子 references；来源标注
- `src/core/templates/workflows/workflow.ts`: 实现桥与测试计划门合并
- `src/core/templates/workflows/auto-workflow.ts`: 同步实现桥语义（若其引用测试计划门）
- `src/core/templates/workflows/debug.ts`: grill/门表述与共享协议保持一致（如引用）
- `src/core/templates/index.ts` / `types.ts`: 如需引用清单元数据（无结构变更则不动）
- `test/skill-size-budget.test.ts`: 预算收紧 + 分层 references 存在性
- `test/template-consistency.test.ts`: 新增门预算与来源标注断言
- `skills/`: 快照重新生成
- `package.json` / `CHANGELOG.md`: 版本递增（技能模板行为变更 → minor）

### 向后兼容

- **行为变更（用户可见）**：grill 确认轮次由"逐决策"变为"≤2 批"、实现桥与测试计划门合并——均为**减少停顿**，不放松任何确认语义（最低深度 L3、实现/测试确认仍存在，只是合并呈现）。属 minor。
- **内容位置变更**：仅文本从主文件/巨石文件移动到 references，技能语义不变。
- **上游依赖**：**不引入**对上游 `openspec-explore` 技能的运行时依赖——iagent 技能保持自包含；衍生内容仍内联于 references，仅增加来源标注。
- **与在飞变更**：`improve-skill-orchestration-consistency`（已实现未归档）也触及 spec_explore/workflow；建议**先归档它**，再实现本变更，避免 references 结构冲突。

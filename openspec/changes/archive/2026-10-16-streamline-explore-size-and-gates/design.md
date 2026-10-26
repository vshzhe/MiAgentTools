## Context

- `iagent_spec_explore` 是探索阶段唯一技能，主 SKILL.md 409 行、`references/exploration-protocol.md` 874 行，合计 73.8KB（全库最大）。
- 该技能由上游 OpenSpec 的 `openspec-explore` 派生，共享 11 个同名 section；iagent 在其上叠加了提示词门、功能流程图门、强制 checkpoint 体系（delegated）。
- 门控清单（专项复核见探索报告 §6）：单次委派探索 + 编排流程最多约 10 次用户停顿。
- 渐进披露机制已存在（`SkillTemplate.references` + `test/skill-size-budget.test.ts` 预算 500 行），但 spec_explore 的主文件尚未充分下沉，且协议文件本身是巨石。

## Goals / Non-Goals

**Goals**:
- 把 spec_explore 主文件与协议文件按关注点分层，降低单次 `Read` 的上下文占用。
- 为上游衍生内容建立来源标注与漂移防护，避免静默分叉。
- 把单次流程的阻塞确认门收敛到"每阶段 ≤ 1"。

**Non-Goals**:
- 不引入对上游 `openspec-explore` 技能的运行时依赖，不改为"引用上游"实现。
- 不删除任何确认门语义（只合并/明确直通），不降低最低确认深度。
- 不改 `iagent spec` CLI 命令契约、不改技能类型体系、不改 allowedTools 授权面。
- 不重写探索协议的行为逻辑（仅移动文本位置与合并门呈现）。

## Decisions

### D1: 上游衍生散文下沉，而非引用上游

- **选择**: 把 `The Stance` / `What You Might Do` / `OpenSpec Awareness` / `Handling Different Entry Points` / `Ending Discovery` / `What We Figured Out` 移入 `references/exploration-guidance.md`，主文件保留一行指针；参考文件头部标注"源自上游 openspec-explore 的探索指南"。
- **理由**: iagent 技能安装在 `.claude`/`.pi`，上游 skill 不保证存在；引用上游会引入运行时依赖，违反自包含。下沉既减重又保留内容。
- **备选**: 直接引用上游 skill。否决——依赖不可控 + 上游文案不含 iagent 门控。

### D2: `exploration-protocol.md` 按关注点拆分

- **选择**: 拆为协议主 `exploration-protocol.md`（1.1 建文件/结构/门、1.5 收尾、1.6 完成检测）+ 子 references：`multi-project-scan.md`（1.2.1.5 多项目扫描）、`grill-playbook.md`（1.3 追问问题库与 L1-L5 细则）、`deep-analysis.md`（1.4 关键词分析与实现深潜）。
- **理由**: 874 行巨石每次 `Read` 全量加载；拆后仅在到达对应步骤时加载。
- **备选**: 保持单文件。否决——与渐进披露目标冲突。

### D3: 门预算 = 每阶段 ≤ 1 个阻塞确认门

- **选择**: 定义"阶段"为 探索 / 提案 / 实现 / 归档；每阶段至多一个阻塞确认门；用结构测试断言门清单。
- **理由**: 给体验一个可测试的上限，为后续新增门提供纪律。
- **备选**: 不做预算，仅逐项合并。否决——合并易反弹。

### D4: grill L1-L5 合并为 ≤ 2 批

- **选择**: L1-L3 在第一批集中确认，L4-L5 在第二批确认；保留最低深度 L3（L1-L3 确认后决策即视为完整）。若用户表示"够了"，可提前结束。
- **理由**: 逐决策增量门在多变更时产生大量停顿；批量确认保留全部维度但减少轮次。
- **备选**: 保持逐决策。否决——F-18 主因。
- **风险**: 批量可能降低逐条确认的颗粒度 → 以"每批内逐条列出待确认项"缓解。

### D5: 实现桥合并（实现确认 + 测试计划）

- **选择**: `iagent_workflow` 3.7 实现确认桥与 4.1 测试计划确认门合并为单一「实现 + 测试桥」，一次呈现实现方案 + 测试计划，一次确认；拒绝时回退范围明确。
- **理由**: 两者都在"实现开始前"，语义相邻，可一次决策。
- **备选**: 保持两个门。否决——相邻阶段重复停顿。

### D6: 聚合一致性门默认直通

- **选择**: `1.6.6 聚合一致性门` 显式声明"无硬冲突自动直通（non-blocking），仅检测到硬冲突时暂停"，不再作为常规停顿点。
- **理由**: 该门是"跨决策矛盾"的兜底，绝大多数正常流程无冲突；显式直通语义消除隐性停顿。
- **备选**: 删除该门。否决——它是 L4 增量检查的兜底，删掉会丢失交叉矛盾检测。

### D7: 漂移防护测试

- **选择**: 新增/扩展测试：① spec_explore 主文件行数 ≤ 250；② 拆分的子 references 均存在且被主文件引用；③ 衍生参考文件含来源标注；④ iagent 专有断言（GATE PROTOCOL / 提示词门 / 流程图门 / 强制 checkpoint）仍在；⑤ 门预算断言（每阶段 ≤1 阻塞门清单）。
- **理由**: 内容下沉 + 门合并都是结构变化，需回归锁防回弹。
- **备选**: 仅人工评审。否决。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 拆分子 references 后 AI 跳读导致步骤遗漏 | 协议主文件在每处保留"执行前 MUST 先 Read references/<x>.md"强制指针；`test/skill-size-budget` 校验引用存在性 |
| grill 批量确认降低颗粒度 | 每批内逐条列出待确认项与 AI 建议；最低深度 L3 不变 |
| 门合并后实现/测试确认被弱化 | 合并仅减少轮次，确认内容不减；拒绝出口与回退范围在单门内显式 |
| 与在飞 `improve-skill-orchestration-consistency` 的 spec_explore/workflow 改动冲突 | 建议先归档该变更再实现本变更；本变更以 MODIFIED/ADDED 明确新契约，避免叙述性重写 |
| 上游同步时衍生参考文件再次分叉 | 来源标注 + 专有断言测试；上游变更时以"专有断言不丢"为底线 |

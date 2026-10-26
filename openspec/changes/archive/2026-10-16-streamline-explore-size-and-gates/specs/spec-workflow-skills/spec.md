## ADDED Requirements

### Requirement: spec-explore 主文件渐进披露与预算

`iagent_spec_explore` 主 SKILL.md MUST 只保留「触发 / 确认门 / 阶段骨架 / 委派清单 / Guardrails」；上游衍生的探索散文（The Stance / What You Might Do / OpenSpec Awareness / Handling Different Entry Points / Ending Discovery / What We Figured Out）MUST 下沉 `references/exploration-guidance.md`，主文件以一行指针引用。主文件行数预算 SHALL 收紧至 **≤ 250 行**。

#### Scenario: 主文件在预算内

- **WHEN** 运行 `test/skill-size-budget.test.ts`
- **THEN** `iagent_spec_explore` 主 SKILL.md 行数 SHALL ≤ 250
- **AND** 主文件 MUST 以一行 `references/exploration-guidance.md` 指针引用衍生指南

#### Scenario: 衍生指南独立可读且被引用

- **WHEN** 检查 `iagent_spec_explore` 的 references
- **THEN** `references/exploration-guidance.md` SHALL 存在且内容非空
- **AND** 主文件 MUST NOT 内联 The Stance / What You Might Do / Handling Different Entry Points 全文

### Requirement: 探索协议按关注点分层

`iagent_spec_explore` 的探索协议 MUST 从单一 874 行巨石拆分为协议主文件 + 子 references，按执行步骤按需加载：`exploration-protocol.md`（建文件 / 结构 / 门 / 收尾 / 完成检测）、`multi-project-scan.md`（多项目 CodeGraph 扫描）、`grill-playbook.md`（grill 问题库与 L1-L5 细则）、`deep-analysis.md`（关键词分析与实现深潜）。

#### Scenario: 拆分后子文件齐备

- **WHEN** 检查 spec-explore 的 references 目录
- **THEN** SHALL 存在 `exploration-protocol.md` / `multi-project-scan.md` / `grill-playbook.md` / `deep-analysis.md`
- **AND** 每个子文件内容非空

#### Scenario: 主协议按需引用子文件

- **WHEN** 检查 `exploration-protocol.md`
- **THEN** 到达多项目扫描 / grill / 深度分析步骤处 SHALL 以 `Read references/<x>.md` 引导按需加载
- **AND** MUST NOT 在主协议中重复内联子文件全文

### Requirement: 上游衍生内容来源标注与漂移防护

上游衍生内容（探索指南与协议中的衍生段落）MUST 标注来源（"源自上游 openspec-explore"）。新增回归测试 MUST 锁定 iagent 专有断言（GATE PROTOCOL / 提示词校验门 / 功能流程图门 / 强制 checkpoint 体系）在内容下沉后仍然存在。

#### Scenario: 衍生内容标注来源

- **WHEN** 检查 `references/exploration-guidance.md`
- **THEN** 文件头部 SHALL 含上游来源标注（openspec-explore）

#### Scenario: 专有断言不因下沉丢失

- **WHEN** 运行回归测试
- **THEN** `iagent_spec_explore` 主文件 SHALL 仍含 GATE PROTOCOL 导言引用、提示词校验门、功能流程图门、强制 checkpoint 体系指针
- **AND** 任一专有断言缺失时 SHALL 失败

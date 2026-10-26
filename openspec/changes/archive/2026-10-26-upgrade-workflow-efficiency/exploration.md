# 探索记录（变更级状态载体）

> **本文件不是探索内容真源**（design D8：避免第二份真源）。
> 探索内容与流程图基准的唯一真源：`openspec/explorations/iagent-workflow-efficiency-upgrade-explore-001.md`
> 本文件仅承载 `iagent-workflow` 协议要求的**变更级持久状态**（`## 需求文档状态`），供 apply / archive 跨会话读取。

## 探索文件指针

- canonical: `openspec/explorations/iagent-workflow-efficiency-upgrade-explore-001.md`
- 流程图基准：N1–N11 + N2F / N4F / N5A / N5B / N7F（已由用户确认）
- 决策：DEC-1…DEC-6（同上文件 `## Decisions` 段）

## 需求文档状态

- requirementDocStatus: skipped-by-user
- 决定时间: 2026-10-26
- 决定来源: `iagent-workflow` Phase 3.5 需求文档桥（用户在「生成 / 跳过」二选一中选择跳过）
- 文档路径: `openspec/changes/upgrade-workflow-efficiency/需求文档.md`（未生成）
- 约束: archive MUST NOT 为该状态静默生成需求文档（走分支 B：报告跳过并继续归档）

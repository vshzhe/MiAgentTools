## ADDED Requirements

### Requirement: 编排技能的委派与派发白名单齐备性

编排类技能（`venus_tr_impl_workflow` / `venus_tr_impl_auto_workflow` / `venus_tr_impl_genfull` / `venus_tr_impl_debug` / `venus_tr_impl_auto_migration`）的 `allowedTools` SHALL 覆盖其正文的实际调用面——**经 Skill 工具委派的每一个子技能**写入 `Skill(<技能名>)` 精确条目，**派发的子代理**写入 `Agent` 与 `Task` 双写条目，**调用的 CodeGraph MCP 工具**写入 `mcp__codegraph` 与具名工具双写条目。

本要求是既有委派需求的**可执行性前提**：正文要求经 Skill 工具委派、而白名单无对应条目时，委派在 Claude Code 中被权限拦截，编排流程无法执行——委派需求在纸面成立而运行时失效。

`tr-impl-auto-workflow` 现存此缺口（正文要求派发子代理但白名单无派发条目，且 1.2.1.5 多项目扫描与 Phase 4 批调度均依赖派发），SHALL 随本变更修复。

#### Scenario: auto-workflow 派发条目缺口修复

- **WHEN** 检查 `venus_tr_impl_auto_workflow` 的 `allowedTools`
- **THEN** 含 `Agent` 与 `Task` 条目，与正文 1.2.1.5 多项目扫描及 Phase 4 批调度的派发要求一致

#### Scenario: auto-workflow 委派条目齐备

- **WHEN** 检查 `venus_tr_impl_auto_workflow` 的 `allowedTools`
- **THEN** 含其正文经 Skill 工具委派的全部子技能条目（`venus_spec_verify_proposal` / `venus_tr_impl_review_proposal` / `venus_tr_docs_requirement_doc` / `venus_spec_apply` / `venus_spec_archive`）

#### Scenario: genfull 阶段委派条目齐备

- **WHEN** 检查 `venus_tr_impl_genfull` 的 `allowedTools`
- **THEN** 含其四个 Stage 经 Skill 工具委派的全部子技能条目（`venus_spec_explore` / `venus_tr_impl_frontend` / `venus_spec_propose` / `venus_tr_impl_review_proposal` / `venus_tr_docs_requirement_doc` / `venus_spec_apply` / `venus_tr_test_generate` / `venus_spec_archive`）

#### Scenario: debug 委派条目齐备

- **WHEN** 检查 `venus_tr_impl_debug` 的 `allowedTools`
- **THEN** 含其正文委派的 `venus_tr_test_generate` 条目

#### Scenario: auto-migration 委派条目齐备

- **WHEN** 检查 `venus_tr_impl_auto_migration` 的 `allowedTools`
- **THEN** 含其正文委派的 `venus_tr_docs_feature_doc` 与 `venus_tr_impl_migration_check` 条目

#### Scenario: 调用 CodeGraph 的编排技能含 MCP 条目

- **WHEN** 检查正文引用 `codegraph_*` 工具的编排技能（如 `venus_tr_impl_workflow` / `venus_tr_impl_debug`）的 `allowedTools`
- **THEN** 含 `mcp__codegraph` 与具名 CodeGraph 工具双写条目

#### Scenario: 委派链路不再被权限拦截打断

- **WHEN** 编排技能在完整管线中依次委派子技能、派发子代理并调用 CodeGraph MCP
- **THEN** 上述调用均免权限弹窗连续执行，管线不因工具级弹窗中断（对话级确认门仍照常阻塞）

## MODIFIED Requirements

### Requirement: auto-migration 编排技能模板

系统 SHALL 提供 `iagent_migration` 技能模板（指令 `migration`，type `impl`），四阶段一站式迁移编排。技能正文 SHALL 定义：Step 0 六项输入收集（源项目、功能入口、目标项目默认当前、双端框架档案、迁移范围说明；路径无效显式报错重新收集禁止猜测纠正）；Phase 1 源需求文档生成（先按项目命名约定定变更名、建 `attachments/source-feature-doc/`、非交互调用 `iagent_feature_doc` 技能）+ 蒸馏确认门（清单可裁剪、差异用户裁决、空清单 BLOCKS、确认后写入 `exploration.md` 的 `## 蒸馏核心功能清单`；裁剪项排除出 Phase 4 检查范围）；Phase 2 目标探索（CodeGraph 优先 + Glob/Grep 自动降级；source-scan 由**主 agent 内联**执行）+ 目标规范加载（CLAUDE.md / AGENTS.md / openspec specs 蒸馏为 `## 目标项目规范要点`，BINDING 约束）+ 制品生成（`iagent spec status` / `iagent spec instructions` 循环，proposal → specs → design → tasks 依赖序）+ CLI 降级（command-not-found 签名判定一次声明，改纯 AI 生成中途不重试）+ 无中途确认直通；Phase 3 实现确认门（统一实现计划 + 一问「是否需要调整」；不调整按 apply 协议**单 agent 分批**执行、checkbox 集中管理、每批注入规范要点——Phase 3 实现改为主 agent 内联，MUST NOT 派发子代理；需要调整呈现制品编辑后重回此门；失败任务串行重试一次）；Phase 4 **主 agent 内联复查**（主 agent 注入全部输入并直接以非交互方式调用 `iagent_migration_check` 技能 + 核心功能覆盖矩阵 + B组检查 C11 异常体系融入 P0 / C12 工具类复用 P1 / C13 架构一致性 P2，语言无关表述；每条结论 MUST 带 `文件:行` 证据）+ P0/P1 修复循环（用户确认修复 → 同步变更 tasks → 重查；终止条件：无 P0/P1、用户停止、重试上限——后两者快照+WARN 完成）+ **复查失败降级链**（串行重试一次 → 仍失败输出 WARN 以完成告警结束，绝不静默跳过）；**上下文阈值降级**：内联阶段在 source-scan 后判定，计划读取文件数 > 300 或制品总行数 > 15k 时 SHALL 降级为子代理执行并记 WARN（这是唯一保留的子代理逃生口）；产物路由规则（SQL → `attachments/sql/`、配置示例 → `attachments/config/`、对抗检查报告 → `attachments/migration-check/07_对抗检查/`、其余 → `attachments/`）。

#### Scenario: 蒸馏确认门阻断空清单
- **WHEN** Phase 1 从需求文档蒸馏出的核心功能清单为空
- **THEN** 阻断流程，要求重新扫描源项目或收窄功能入口，绝不带空清单继续

#### Scenario: 目标规范作为绑定约束
- **WHEN** Phase 2 完成目标项目规范加载
- **THEN** 规范要点写入 `exploration.md` 的 `## 目标项目规范要点`，作为 design/tasks 推导与 Phase 3 实现的 BINDING 约束，使迁移代码遵循目标项目规范

#### Scenario: CLI 降级生成
- **WHEN** 首次 `iagent spec status` 调用失败且错误签名匹配 command-not-found（"command not found" / "不是内部或外部命令" / "not recognized"）
- **THEN** 声明 CLI 不可用结论一次，改按内置依赖顺序（proposal → specs → design → tasks）纯 AI 生成全部制品，流程中不再重试 CLI 调用

#### Scenario: 内联复查修复循环
- **WHEN** Phase 4 检查报告存在 P0/P1 问题
- **THEN** 呈现问题清单与修复建议，用户确认后修复（同步变更 tasks.md）并在同一上下文重新执行迁移检查；循环直到无 P0/P1、用户停止或达到重试上限（后两者输出快照+WARN 以完成告警结束，不静默）

#### Scenario: 复查失败降级链
- **WHEN** Phase 4 内联复查执行失败
- **THEN** 串行重试一次，仍失败输出 WARN 以完成告警结束——绝不静默跳过检查

#### Scenario: 上下文阈值降级
- **WHEN** source-scan 后判定计划读取文件数 > 300 或制品总行数 > 15k
- **THEN** 后续内联阶段 SHALL 降级为子代理执行并记 WARN
- **AND** MUST NOT 在上下文不足时静默继续内联

#### Scenario: Phase 3 内联分批
- **WHEN** Phase 3 按 apply 协议执行实现批次
- **THEN** 主 agent SHALL 按批内联实现并集中更新 checkbox
- **AND** MUST NOT 派发子代理；与 `apply` 阶段的内联决策一致

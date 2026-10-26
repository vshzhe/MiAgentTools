# Proposal: add-spec-workflow

## Why

VenusAgentTools 目前提供 7 类 `tr_*` 生命周期技能（init/impl/test/commit/review/release/tools），覆盖代码交付环节，但缺少**规格驱动开发（Spec-Driven Development）**能力——从需求探索、变更提案、规格实现到归档验证的完整闭环。用户在 OpenSpec 自定义分支已沉淀增强版 explore/propose/apply/archive/verify 五大功能（含 CodeGraph 集成、持久化探索记忆、D1-D9 量化评分门等增强），需要将其迁移到 VenusAgentTools 并按 venus 命名体系重新命名，且**不依赖 openspec CLI**（由 venus CLI 自研状态校验，全流程自持）。

## What Changes

- 新增第 8 个生命周期类型 `spec`（规格），扩展 `SkillType` 联合类型与 `SKILL_TYPES` 注册表
- 新增 6 个 spec 技能模板（成对注册 `WORKFLOW_PAIRS`）：
  - `venus_spec_explore` → `/venus:spec-explore`（探索：CodeGraph 首动作 + 持久化探索文件）
  - `venus_spec_propose` → `/venus:spec-propose`（提案：能力记忆注入 + 命名引擎 + 前置验证门）
  - `venus_spec_apply` → `/venus:spec-apply`（实现：设计确认门 + 编译检查 + 任务勾选推进）
  - `venus_spec_archive` → `/venus:spec-archive`（归档：spec 智能合并 + 探索记忆同步 + CodeGraph 索引同步）
  - `venus_spec_verify` → `/venus:spec-verify`（后置验证：三维度问题清单）
  - `venus_spec_verify_proposal` → `/venus:spec-verify-proposal`（前置验证：D1-D9 评分门，90% 阈值）
- venus CLI 新增 `spec` 子命令组（自研替代 openspec CLI，内置硬编码 spec-driven 依赖图）：
  - `venus spec new "<name>"`：创建变更骨架（写 .openspec.yaml 兼容元数据）
  - `venus spec status --change <name> --json`：artifact 状态校验（done/skipped/ready/blocked + applyRequires + progress）
  - `venus spec instructions <artifact-id> --change <name> --json`：模板分发（proposal/specs/design/tasks 内置模板）
  - `venus spec archive <name> --yes`：状态检查 + 目录归档移动（spec 合并由 spec-archive 技能 AI 执行）
- `init`/`update`/`list`/`validate` 适配第 8 类（安装、刷新、分组展示、类型校验）
- 目录约定沿用 `openspec/`（changes/、specs/、explorations/、CONTEXT.md），.openspec.yaml 元数据与 openspec CLI 互认

## Capabilities

### New Capabilities

- `spec-workflow-cli`: venus CLI 的 spec 子命令组——变更骨架创建、artifact 状态校验、模板分发、目录归档，内置 spec-driven 依赖图（proposal→specs/design→tasks），零 openspec CLI 依赖
- `spec-workflow-skills`: 6 个规格驱动工作流技能的完整行为——探索（CodeGraph 强制首动作 + 探索文件持久化）、提案（能力记忆 + 命名规范 + 验证门）、实现（确认门 + 编译检查）、归档（AI spec 合并 + 记忆同步）、双重验证（后置三维度 + 前置 D1-D9 评分）

### Modified Capabilities

（无 —— openspec/specs/ 当前为空，全部为新增能力）

## Impact

### 涉及页面/屏幕

| 页面/屏幕 | 变更类型 | 说明 |
|-----------|----------|------|
| 无 | - | 纯 CLI 工具变更，无 Web UI（终端输出为唯一交互面） |

### 涉及 API

| Method | URL | 变更类型 | 说明 |
|--------|-----|----------|------|
| 无 | - | - | 无 HTTP API；新增的是 CLI 子命令 `venus spec <action>` 与其 `--json` 输出契约 |

### 涉及数据库表

| 表名 | 字段/操作 | 变更类型 | 说明 |
|------|-----------|----------|------|
| 无 | - | - | 无数据库；运行时数据为文件系统（openspec/ 目录 + .openspec.yaml） |

### 直接影响的文件

- `src/core/config.ts`: SkillType 联合类型新增 'spec'，SKILL_TYPES 注册表追加
- `src/core/templates/registry.ts`: WORKFLOW_PAIRS 注册 6 个新技能对
- `src/core/templates/workflows/spec-*.ts`: 6 个新模板文件（工厂函数对）
- `src/core/spec/`: 新目录（schema.ts 依赖图定义、status.ts 状态校验、instructions.ts 模板分发、new-change.ts 骨架创建、archive.ts 归档移动、templates/ 内置 artifact 模板）
- `src/cli/index.ts`: 注册 spec 子命令组
- `src/commands/init.ts` / `update.ts` / `list.ts` / `validate.ts`: 适配第 8 类
- `test/`: 新增 spec 命令与模板注册测试

### 向后兼容

- `SkillType` 联合类型**新增值**（非破坏）：现有 `isSkillType` 校验自然兼容
- `WORKFLOW_PAIRS` 追加条目：`list` 分组展示新增"规格"组（countSkillsByType 已预留占位逻辑，8 类自动展示）
- 现有 7 类 `tr_*` 技能行为不变；`venus init` 已安装项目重新运行 init 可增量获得 6 个新技能（skip 已存在逻辑）
- 无破坏性变更（**无 BREAKING**）

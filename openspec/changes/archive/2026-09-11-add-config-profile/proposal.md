## Why

VenusAgentTools 现有生成链路（`venus init` / `venus update`）将全部 14 个内置技能（8 个 `tr_*` + 6 个 `spec_*`）无差别安装到项目 `.claude/` 目录，缺乏"按需选择生成哪些指令"的能力。

实际问题：
- 不同项目对指令集需求不同（小工具项目不需要 spec 工作流；纯后端项目不需要前端相关技能），全量安装带来噪声
- 新增技能会持续膨胀全量清单，用户无法裁剪
- 缺乏配置入口，用户只能装完再手动删除不需要的技能/指令

需引入 config profile 机制，让用户通过 `.venus/config.yaml` 的 `workflows` 字段声明本项目需要哪些 workflow，`init`/`update` 据此过滤生成。默认集为 `tr-init-project` + spec 全 6 个核心工作流（explore/propose/apply/archive/verify/verify-proposal），覆盖最常见的规格驱动开发闭环。

## What Changes

### 新增

- **DEFAULT_WORKFLOWS 默认集**（7 个）：`tr-init-project` + `spec-explore` / `spec-propose` / `spec-apply` / `spec-archive` / `spec-verify` / `spec-verify-proposal`。`.venus/config.yaml` 未声明 `workflows` 字段时生效。
- **依赖注入规则**：用户在 `workflows` 列出某 workflow 但漏掉其依赖时自动补全并提示
  - `spec-propose` ⇒ `spec-verify-proposal`（规则文件明写"提案实现前必须通过评分门"）
  - `spec-archive` ⇒ `spec-verify`（verify 职责为"实现完成后、归档前验证"）
  - `spec-apply` 不注入（apply 时假设 propose 阶段已过评分门，避免冗余）
- **`workflows` 配置字段**：`.venus/config.yaml` 新增 `workflows:` 列表字段（workflow id 复用现有 `deriveCommandId` 派生结果）。字段缺失=默认集；字段存在=用户配置。与现有 `rules` 字段正交（rules 管规则注入按 `SkillType`，workflows 管装哪些按 workflowId）。
- **`venus config` 命令**（交互式）：
  - `venus config` → `@inquirer/prompts` checkbox 勾选全部 14 个 workflow，确认后写回 config.yaml
  - `venus config show` → 打印当前配置与生效 workflow 列表
  - `venus config --set <comma-list>` → 非交互设置（脚本/CI 用）
- **reconcile 检测提示**：`init`/`update` 扫描已安装但不在当前 `workflows` 配置集内的技能/指令，**保留不删**，输出提示引导手工处理（`venus uninstall` 或手动删除）。

### 修改

- `init` / `update`：从全量安装改为按 `workflows` 字段过滤生成（仅动选中的 workflow）
- 模板注册表：每个 `WORKFLOW_PAIRS` 项挂 `workflowId`，`getSkillTemplates` / `getCommandTemplates` 增加 `workflowFilter` 参数
- `onboarding` 提示：按默认集过滤，只提示默认的 workflow

### 行为变化（**BREAKING**）

`venus init` 默认行为从"全量安装 14 个"变为"安装默认集 7 个"。

**迁移策略**：
- 已有项目（已装 14 个）重新 `init`/`update` 时，默认集 7 个正常刷新，其余 7 个保留不动并提示"不在配置中"，不会被删除
- 若需保持全量行为：`venus config --set <全部 14 个 workflow id>`，或直接在 config.yaml 的 `workflows` 填全量列表

## Capabilities

### New Capabilities

- `skill-profile`: 通过 `.venus/config.yaml` 的 `workflows` 字段声明本项目需要的 workflow 集合，含默认集、依赖注入规则、`venus config` 配置入口、`init`/`update` 过滤生成与 reconcile 检测提示。

### Modified Capabilities

无（`openspec/specs/` 当前为空，无既有归档能力可修改）。

## Impact

### 直接影响的文件

- `src/core/templates/registry.ts`：`WORKFLOW_PAIRS` 每项挂 `workflowId`；`getSkillTemplates` / `getCommandTemplates` 增加 `workflowFilter?: readonly string[]` 参数
- `src/core/profiles.ts`（新建）：`DEFAULT_WORKFLOWS` 常量、依赖注入规则表、`resolveWorkflows(config)` 解析函数
- `src/core/project-config.ts`：`ProjectConfig` 增加 `workflows?: string[]` 字段；`parseProjectConfig` 解析 `workflows` 列表；`defaultConfigFileContent` 默认含默认集
- `src/commands/init.ts`：按 `workflows` 过滤安装 + reconcile 检测提示
- `src/commands/update.ts`：按 `workflows` 过滤刷新 + reconcile 检测提示
- `src/commands/config.ts`（新建）：交互式/非交互式 config 命令实现
- `src/cli/index.ts`：注册 `config` 命令
- `src/commands/onboarding.ts`：onboarding hints 按默认集过滤
- `package.json`：新增 `@inquirer/prompts` 运行依赖
- `test/`：profiles 解析、依赖注入、init 过滤、config 命令的测试

### 向后兼容

**BREAKING**：`venus init` 默认行为变化（全量 14 → 默认集 7）。

迁移策略见上文"What Changes → 行为变化"。核心保证：已安装的技能/指令永不被自动删除（reconcile 仅提示），用户数据安全；通过 `venus config --set` 可恢复任意子集/全量。

# Tasks: add-opencode-tool-adapter

<!-- 任务类型标签：[代码] / [测试] / [使用说明] -->

## 1. 配置与工具集

- [x] 1.1 [代码] `AIToolOption` 增 `optIn?: boolean` 与 `sessionPermissions?: boolean` 字段，并在 `AI_TOOLS` 追加 opencode 条目（`skillsDir='.opencode'`、`commandsDir='.opencode/commands'`、`commandsLayout='prefixed-file'`、`optIn=true`、`sessionPermissions=false`）
  - 文件：`src/core/config.ts`
  - 验证：TypeScript 编译通过；`AI_TOOLS` 含 4 条，opencode 字段符合规范
  - Spec Ref：`opencode-tool-adapter / OpenCode 工具注册与产物布局`
  - Scenario Ref：工具条目字段正确
  - Spec Ref：`ai-tool-selection / 可选（opt-in）工具`
  - Scenario Ref：未配置不生成 opt-in 产物

- [x] 1.2 [代码] `resolveActiveTools` 默认回退改为排除 opt-in 工具；`config.yaml` 模板注释标注 opencode 为可选工具
  - 文件：`src/core/project-config.ts`
  - 验证：无 `tools` 配置时回退 `['claude','pi','codex']`；`config.yaml` 注释含 opencode opt-in 说明
  - Spec Ref：`ai-tool-selection / 目标工具集解析优先级`
  - Scenario Ref：CLI 参数覆盖配置
  - Scenario Ref：无 CLI 参数时读取配置
  - Scenario Ref：未配置时用默认工具集
  - Scenario Ref：显式指定 opt-in 工具

- [x] 1.3 [代码] `src/cli/index.ts` 的 `--tools` 帮助文案区分默认工具集与 opt-in 工具
  - 文件：`src/cli/index.ts`
  - 验证：`node bin/iagent.js init --help` 文案含 opencode 的 opt-in 说明
  - Spec Ref：`ai-tool-selection / 可选（opt-in）工具`

## 2. OpenCode 指令适配器

- [x] 2.1 [代码] 新建 `opencodeAdapter`：`toolId='opencode'`；`getFilePath` 走 `commandFilePath('opencode', id)`；`formatFile` 输出 `description` + `metadata` 记账 frontmatter，并在满足条件时注入 `**Provided arguments**: $ARGUMENTS`
  - 文件：`src/core/command-generation/adapters/opencode.ts`
  - 验证：产物路径 `.opencode/commands/iagent-<id>.md`；frontmatter 无 Claude 专有字段
  - Spec Ref：`opencode-tool-adapter / OpenCode 指令 frontmatter 与参数注入`
  - Scenario Ref：极简 frontmatter 且去 Claude 专有字段
  - Scenario Ref：参数占位符注入
  - Scenario Ref：无参数指令不注入
  - Scenario Ref：已含占位符不重复注入
  - Scenario Ref：指纹自洽

- [x] 2.2 [代码] `CommandAdapterRegistry` 注册 `opencodeAdapter` 并于 `command-generation/index.ts` 导出
  - 文件：`src/core/command-generation/adapters/registry.ts`、`src/core/command-generation/index.ts`
  - 依赖：2.1
  - 验证：`CommandAdapterRegistry.has('opencode')` 为 true
  - Spec Ref：`opencode-tool-adapter / OpenCode 工具注册与产物布局`
  - Scenario Ref：指令安装路径与调用形式
  - Scenario Ref：技能安装路径

- [x] 2.3 [代码] `iagent generate` 的安装目标改用 `resolveActiveTools(undefined, projectConfig?.tools, AI_TOOLS)`
  - 文件：`src/commands/generate.ts`
  - 依赖：1.1、1.2
  - 验证：未配置 opencode 时 `.opencode/skills/` 不被写入
  - Spec Ref：`ai-tool-selection / 可选（opt-in）工具`
  - Scenario Ref：generate 尊重 opt-in

- [x] 2.4 [代码] `init` / `update` 的会话级权限合并跳过 `sessionPermissions === false` 的工具
  - 文件：`src/commands/init.ts`、`src/commands/update.ts`
  - 依赖：1.1
  - 验证：`--tools opencode` 时 `.opencode/settings.json` 不被创建；默认工具集权限合并结果不变
  - Spec Ref：`opencode-tool-adapter / OpenCode 会话级权限载体不适用`
  - Scenario Ref：OpenCode 不生成权限载件
  - Scenario Ref：既有工具权限载体不变

## 3. 边界收敛

- [x] 3.1 [代码] `project-scan` 的 `EXCLUDED_DIR_NAMES` 增 `.opencode`
  - 文件：`src/core/project-scan.ts`
  - 验证：含 `.opencode/` 产物时不被采集为项目信号
  - Spec Ref：`opencode-tool-adapter / OpenCode 扫描排除与旧装机边界`
  - Scenario Ref：预扫描排除 OpenCode 产物

- [x] 3.2 [代码] `LEGACY_COMMAND_DIRS` 增 `opencode: ''`；`.gitignore` 增 `.opencode/`
  - 文件：`src/core/legacy-migration.ts`、`.gitignore`
  - 验证：旧装机迁移遍历键集完整且不触碰 `.opencode` 用户文件
  - Spec Ref：`opencode-tool-adapter / OpenCode 扫描排除与旧装机边界`
  - Scenario Ref：旧装机迁移不误删 OpenCode 内容

## 4. 测试

- [x] 4.1 [测试][单元][P0] OpenCode 适配器测试：路径、极简 frontmatter、参数注入（含注入/不注入/不重复）、指纹自洽
  - 文件：`test/generation.test.ts`
  - 依赖：2.1
  - 验证：`pnpm test` 通过
  - Spec Ref：`opencode-tool-adapter / OpenCode 指令 frontmatter 与参数注入`
  - Scenario Ref：参数占位符注入
  - Scenario Ref：无参数指令不注入
  - Scenario Ref：指纹自洽

- [x] 4.2 [测试][单元][P0] opt-in 与工具选择测试：默认回退排除 opencode；`--tools opencode` 生成 `.opencode/` 产物；未配置时 `init` 不创建 `.opencode/`
  - 文件：`test/commands.test.ts`
  - 依赖：1.1、1.2、2.2
  - 验证：`pnpm test` 通过
  - Spec Ref：`ai-tool-selection / 可选（opt-in）工具`
  - Scenario Ref：未配置不生成 opt-in 产物
  - Scenario Ref：显式配置才生成 opt-in 产物

- [x] 4.3 [测试][单元][P1] `command-artifacts` 边界测试：OpenCode `prefixed-file` 路径、归属识别仅认 `iagent-` 前缀、删除保留用户文件
  - 文件：`test/command-artifacts.test.ts`
  - 依赖：2.1、2.2
  - 验证：`pnpm test` 通过
  - Spec Ref：`opencode-tool-adapter / OpenCode 工具注册与产物布局`
  - Scenario Ref：与用户文件共目录时的删除边界

- [x] 4.4 [测试][单元][P1] 权限跳过测试：`--tools opencode` 不生成 `.opencode/settings.json` 且 `permissionSettings` 无 opencode 项；默认工具集权限结果不变
  - 文件：`test/commands.test.ts`
  - 依赖：2.4
  - 验证：`pnpm test` 通过
  - Spec Ref：`opencode-tool-adapter / OpenCode 会话级权限载体不适用`
  - Scenario Ref：OpenCode 不生成权限载件
  - Scenario Ref：既有工具权限载体不变

## 5. 文档与版本

- [x] 5.1 [代码] 更新 `README.md`（支持工具表、产物结构、工具选择说明）与 `AGENTS.md`（仓库地图/约定中提及 opencode opt-in 与 OpenCode 布局）
  - 文件：`README.md`、`AGENTS.md`
  - 验证：文档含 opencode opt-in 与 `.opencode/` 布局说明
  - Spec Ref：`opencode-tool-adapter / OpenCode 工具注册与产物布局`

- [x] 5.2 [代码] 版本号 6.2.0 → 6.3.0；`CHANGELOG.md` 归档 `[Unreleased]` 并补链接
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`（如有版本引用）
  - 验证：`node -e "console.log(require('./package.json').version)"` 输出 6.3.0
  - Spec Ref：`ai-tool-selection / 可选（opt-in）工具`

> 进度: 15/15 (100%)

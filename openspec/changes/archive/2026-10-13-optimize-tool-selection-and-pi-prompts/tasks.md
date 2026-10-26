# Tasks

## 1. AI 工具选择持久化

- [x] 1.1 在 `src/commands/init.ts` 解析出生效工具集后调用 `ensureProjectConfig` + `writeToolsToConfig` 回写 `.iagent/config.yaml`；验证：`test/commands.test.ts` 新增用例断言 `init --tools claude` 后 config 的 `tools` 为 `[claude]`，且不带 `--tools` 再次 init 仍为 `[claude]`
- [x] 1.2 在 `src/commands/update.ts` 仅当 `options.tools` 存在时调用 `writeToolsToConfig`；验证：新增用例断言不带 `--tools` 时 config 字节不变，带 `--tools claude,pi` 时写入 `[claude, pi]`
- [x] 1.3 更新 `src/core/project-config.ts` 的 `defaultConfigFileContent()` 中 `tools` 段注释，说明其作用与“删除该字段回退全部工具”；验证：新建项目 init 后生成的 `config.yaml` 含该注释
- [x] 1.4 补充解析优先级回归用例（CLI > config > 全部、非法 id 报错）；验证：`pnpm test` 相关用例通过
- [x] 1.5 同步 `README.md` 的“工具选择配置”章节：说明 init 持久化、update 仅显式 `--tools` 回写、优先级不变；验证：文中命令与生成行为一致

## 2. 指令布局单一源与 Pi prompt 适配

- [x] 2.1 在 `src/core/config.ts` 的 `AIToolOption` 新增 **可选** `commandsLayout?: 'namespace-dir' | 'prefixed-file'`，为 claude/pi 赋值、codex 省略；Pi 的 `commandsDir` 改为 `.pi/prompts`；验证：`pnpm build` 通过，类型检查覆盖全部工具条目且空 `commandsDir` 工具不携带该字段
- [x] 2.2 新建 `src/core/command-artifacts.ts`，提供按工具枚举/删除本工具命名指令产物的纯函数（两种布局），并导出；所有函数 MUST 先判空 `commandsDir` 再解析布局；验证：新增单测覆盖 namespace-dir 与 prefixed-file 的枚举、`iagent-` 前缀过滤、`opsx-*.md`/用户文件不被识别、空 `commandsDir` 工具（codex）被跳过
- [x] 2.3 改写 `src/core/command-generation/adapters/pi.ts`：路径为 `.pi/prompts/iagent-<id>.md`，`formatFile` 去除 Claude 专有字段（name/allowed-tools/category/tags）但保留 `description` 与 `metadata.generatedBy`/`metadata.generatedFingerprint`；验证：`test/generation.test.ts` 新增 Pi 路径、frontmatter 字段与指纹自洽断言（update 手改保护可用）
- [x] 2.4 确认 `claudeAdapter` 路径/格式不变（仍 `.claude/commands/iagent/<id>.md` 全字段）；验证：既有 Claude 指令用例保持通过

## 3. reconcile / uninstall / 旧装机清理适配新布局

- [x] 3.1 改 `src/core/reconcile.ts` 使用 `command-artifacts.ts` 枚举指令产物；验证：新增用例断言 `.pi/prompts/` 下仅 `iagent-*` 进入孤立列表，`opsx-*` 不进入
- [x] 3.2 改 `src/commands/uninstall.ts` 使用共享删除函数；验证：新增用例断言删除后 `opsx-*.md` 与 `.pi/prompts/` 目录保留，`.claude/commands/iagent/` 仍整体删除
- [x] 3.3 在 `src/core/legacy-migration.ts` 用显式旧指令根常量（claude→`.claude/commands`、pi→`.pi/commands`）替代对 `tool.commandsDir` 的依赖；验证：`test/legacy-migration.test.ts` 中 `.pi/commands/venus/*` 仍被检测并清理

## 4. 旧错误位置清理

- [x] 4.1 在 `command-artifacts.ts` 实现 `.pi/commands/iagent/` 清理函数（幂等、失败仅告警），并在 `init` 与 `update` 入口调用；验证：新增用例断言存量 `.pi/commands/iagent/pwd.md` 被移除，重复执行无副作用，主流程不中断

## 5. 集成校验与发版收口

- [x] 5.1 运行 `pnpm build && pnpm test && pnpm lint` 全绿；确认指令安装总数仍为 9 模板 × 2 适配器 = 18、技能数不变
- [x] 5.2 更新 `README.md` Pi 调用示例（`/iagent-<id>`）与架构图中 pi 适配器路径说明；验证：文档与产物路径一致
- [x] 5.3 更新 `AGENTS.md` 中涉及 Pi 指令目录/布局的描述（若有）；验证：文中路径与实际一致
- [x] 5.4 按修改守则递增 `package.json` 版本号（minor）并把 `CHANGELOG.md` 的 Unreleased 条目归档为对应版本小节；验证：版本号与 CHANGELOG 同步且随本次提交

## Workflow follow-up

- 归档本变更（`iagent_spec_archive`），归档后确认主 spec 的 `agent-tool-identity` 与新建 `ai-tool-selection` 已同步。
- 本机执行一次 `iagent update` 验证 dogfood：`.pi/prompts/iagent-*.md` 生成、`.pi/commands/iagent/` 被清理。
- （登记，非本次范围）是否让 `reconcile` 感知 `tools` 变更，以提示「切换到其它工具后遗留的产物」——已列入 design Non-Goals，按需另立变更。

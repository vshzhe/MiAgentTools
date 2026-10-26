# Design

## Context

参见 `proposal.md` 的 Why。实现相关的现状约束：

- `AIToolOption`（`src/core/config.ts`）目前用 `skillsDir` / `commandsDir` 描述工具目录，
  `commandsDir` 被 `pi.ts`、`reconcile.ts`、`uninstall.ts`、`legacy-migration.ts` 四处各自
  拼接 `<commandsDir>/<TOOL_COMMANDS_SUBDIR>/`。
- Pi 与 OpenSpec 共用 `.pi/prompts/` 目录，OpenSpec 产物为 `opsx-*.md`。
- `legacy-migration.ts` 是旧品牌 token（`venus` 系）的唯一落点；旧 Pi 指令位于
  `.pi/commands/venus/`，其定位当前依赖 `tool.commandsDir`。
- 工具选择解析已存在（`resolveActiveTools`），只缺回写。

## Goals / Non-Goals

**Goals:**

- 工具选择在 init 后持久化，update 默认不改配置。
- Pi 指令产物落到 Pi 实际加载的 `.pi/prompts/iagent-<id>.md`。
- 指令产物的“落点 + 归属识别 + 清理”三处逻辑收敛为单一来源，避免布局知识散落。
- 保持 Claude Code 行为与既有指令/技能数量不变。

**Non-Goals:**

- 不新增目标工具，不改变指令 id 派生规则。
- 不给 `iagent config` 增加 tools 交互式勾选（本次仅走 init/update 回写）。
- 不改动 `.pi/settings.json` 的权限合并逻辑。
- 不改变 `reconcile` 的判定依据：它仍只按 `workflows` 识别孤立产物、不感知 `tools`；因此切换工具后
  其它工具目录的既装产物不会被列为孤立（登记为已知落差，非本次范围）。

## Decisions

### D1. 用 `commandsLayout` 字段表达两种指令布局

`AIToolOption` 增加 **可选** `commandsLayout?: 'namespace-dir' | 'prefixed-file'`：

- `namespace-dir`（claude）：`<commandsDir>/<namespace>/<id>.md`
- `prefixed-file`（pi）：`<commandsDir>/<namespace>-<id>.md`
- 无指令产物的工具（codex，`commandsDir === ''`）**不携带该字段**

`commandsDir` 对 Pi 改为 `.pi/prompts`，`TOOL_COMMANDS_SUBDIR`（`iagent`）继续作为命名空间。
所有消费方（`command-artifacts.ts`、适配器、reconcile/uninstall/legacy）MUST 先判空
`commandsDir` 再解析布局，否则 `path.join` 会退化为项目根下的同名目录。

**备选**：为 Pi 增加独立的 `promptsDir` 字段，保留 `commandsDir` 指向 `.pi/commands` 供旧逻辑用。
否决——会让两套路径并存且语义含糊，后续每处遍历都要判断用哪个；一个布局标识即可表达差异。

### D2. 新增共享模块 `core/command-artifacts.ts` 收敛布局逻辑

提供按工具枚举/删除本工具命名指令产物的函数（如 `listManagedCommands(projectRoot, tool)`、
`removeManagedCommands(projectRoot, tool)`），`reconcile.ts`、`uninstall.ts` 与
`legacy-migration.ts` 复用。适配器侧沿用 `getFilePath`。

**理由**：布局从“一种”变“两种”后，若继续在四处手写路径拼接，任何一处漏改都会导致误删
（尤其 Pi 目录含 `opsx-*`）。单一模块使归属识别只有一份实现。

**备选**：把识别逻辑放进每个适配器接口。否决——`reconcile` / `legacy-migration` 目前不依赖
适配器注册表，引入会增加耦合；共享纯函数更简单。

### D3. Pi frontmatter 去除 Claude 专有字段，保留 iagent 记账字段

Pi 产物 frontmatter MUST NOT 含 Claude 专有字段（`name` / `allowed-tools` / `category` / `tags`）——
Pi 权限由 `.pi/settings.json` 的会话级允许清单承担，这些字段在 prompt 模板中无意义且会误导用户。
但 MUST 保留 iagent 自身的记账字段 `metadata.generatedBy` 与 `metadata.generatedFingerprint`：
`generateCommand` 的两趟指纹拼装与 `update` 的手改保护都依赖后者（AGENTS.md 明确「生成路径必须
写全该字段」），缺失会让 Pi prompt 每次被无条件覆盖。Pi 忽略未知 frontmatter 键，`opsx-*` 极简
只是不写，并不禁止额外键。

**备选**：完全对齐 `opsx-*` 的「仅 description」。否决——会让 Pi prompt 丧失手改保护，与项目指纹
契约冲突（本条为验证门 P1 修正）。

### D4. 工具回写规则

- `runInit`：解析生效集后 `ensureProjectConfig` + `writeToolsToConfig(resolved)`（始终写显式列表）。
- `runUpdate`：仅当 `options.tools` 存在时回写；否则只读。

**理由**：init 是“选择动作”，update 是“刷新动作”。显式列表保证选择可见可复现，与
`iagent config` 对 workflows 的“总是写显式列表”一致。

### D5. 旧 Pi 指令位置清理归属

旧 `.pi/commands/iagent/` 是**同一 iagent 口径下的错误落点**，不是 venus 旧品牌 token，
故：

- 在 `legacy-migration.ts` 中的 venus 指令定位改为显式旧路径常量（`LEGACY_COMMAND_DIRS` 映射
  `claude → .claude/commands`、`pi → .pi/commands`），不再复用当前 `tool.commandsDir`
  （它已变成 `.pi/prompts`，会让 venus 清理失效）。
- 错误位置 `.pi/commands/iagent/` 的清理由 `command-artifacts.ts` 提供的专用函数承担，
  init/update 各调用一次，幂等、失败仅告警。

**备选**：把两件事都塞进 legacy-migration。否决——会让 legacy 模块同时承担 venus 旧品牌与
iagent 自身历史错误两种语义，且旧 token 约束是针对 venus 的。

## Risks / Trade-offs

- [Pi 目录与 OpenSpec/用户 prompt 混放，误删风险] → D2 的共享模块严格按 `iagent-` 前缀识别，
  且明确不删除承载目录；补充单测断言 `opsx-*.md` 不被触碰。
- [update 不再回写导致“改了 config 没生效”困惑] → 文档明确：改工具选择用 `init --tools` 或
  `update --tools`；只改 config.yaml 时下次 init/update 按该字段生效（读路径本就支持）。
- [always-persist init 会冻结未来新增工具] → 选择显式化是预期行为；新增工具时用户需显式
  加入 `tools`（或删除该字段回退全部）。在默认配置注释中说明。
- [存量 `.pi/commands/iagent/` 中若有用户手写文件会被清] → 该目录是本工具专用命名空间，
  清理前仅处理其中的 `.md` 指令文件；风险低且与 uninstall 语义一致。
- [Pi frontmatter 若一并省略记账字段会丢失手改保护] → D3 明确保留
  `metadata.generatedBy` / `metadata.generatedFingerprint`，仅剔除 Claude 专有字段。

## Migration Plan

1. 升级后执行一次 `iagent update`（或 `init`）：清理 `.pi/commands/iagent/`，生成
   `.pi/prompts/iagent-*.md`，并按需回写 `tools`。
2. 回滚：旧版本仍可运行，仅不会清理新位置产物；无破坏性数据迁移。
3. 无需用户手工操作；Pi 重新加载项目后 `/iagent-<id>` 指令可用。

## Open Questions

无（设计级未知已在探索阶段澄清）。

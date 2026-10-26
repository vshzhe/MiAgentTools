# Proposal: iagent-legacy-migration

## Why

伴生变更 iagent-rebrand 是破坏性重命名：技能名前缀、指令命名空间、配置目录、CLI 二进制名全部改变。既有装机在改名后处于无人处理的状态——`uninstall` 与 `reconcile` 都以 SKILL_PREFIX 过滤产物，新前缀上线后旧的 27 个 `venus_*` 技能目录既不在更新范围、也不在卸载范围，成为永久孤儿；同时 `.venus/config.yaml` 中用户自写的 context 与 rules 会静默失效，没有任何提示。用户会在完全无感的情况下既丢失自写的项目规则，又留下无法清理的旧产物。

## What Changes

- 新增遗留装机迁移能力：`iagent init` 与 `iagent update` 入口内置一次性迁移，自动完成旧配置搬运与旧产物清理
- 配置内容搬运：检测 `.venus/` 存在时，读取其 `config.yaml` 的 context 多行块与 `rules/` 下规则文件内容，按类型改名映射（tr_impl→impl、tr_test→test、tr_docs→docs 等）写入 `.iagent/`；config 的 `rules:` 列表与规则文件名同步改写，`workflows:` 列表按旧→新指令 id 映射改写（旧 id 无法匹配任何技能模板，不改写则搬运后首次 init 装 0 个技能）。用户自写的规则行与注释行 MUST 逐字保留；扫描基线随目录搬移；内容全部搬运完成后旧配置目录被移除（未处理项存在时保留并告警）
- 旧产物清理：删除各工具目录下旧前缀的技能与指令（`<tool>/skills/venus_*`、`<tool>/commands/venus/`）。按已定决策一律删除，含用户手工修改过的旧技能——以显式告警替代保留
- 迁移报告：输出迁移项（配置段与规则文件）、删除项（技能与指令计数及明细）、跳过项（已迁移或无旧物）三类的计数与明细；旧技能被删除时附带显式告警，提示其中可能包含的手工修改已丢失
- 幂等性：重复执行 MUST 无副作用。判定依据为「`.venus/` 不存在且无旧前缀产物」时静默跳过，不输出迁移段落
- 新增 `--no-migrate` 开关，供需要手工控制迁移时机的场景跳过该步骤
- 边界容错：`.venus/` 不存在、配置解析失败、仅部分旧产物存在时 MUST NOT 阻断 init/update 主流程；配置解析失败时保留原始文件并告警，不静默丢弃用户规则
- 既有新配置目录保护：当 `.iagent/` 已存在（用户已按新口径自建）时，MUST NOT 覆盖其 config.yaml，SHALL 保留既有内容并告警，行为与既有 ensureProjectConfig 的「已存在则保留」语义一致；旧配置目录同时保留不删
- 删除操作的边界安全：清理 SHALL 限制在目标工具目录的对应子目录内——删除前校验目标路径位于该子目录之下，MUST NOT 跟随符号链接，清理旧指令后 SHALL 移除遗留的空目录；对 commandsDir 为空字符串的工具（codex）MUST NOT 拼接指令路径，直接跳过指令侧清理
- 配置搬运范围界定：`.venus/config.yaml` 中除 context 与 rules 外的字段（含 auto_package.runtime_dir 等技能运行时依赖的自定义字段）SHALL 逐字保留，MUST NOT 因类型改名而丢弃任何未知段与自定义字段
- 旧版品牌产物清理（实施期新增范围）：伴生变更把品牌命名从 4 类磁盘产物上移除后，旧产物成为孤儿，本变更 SHALL 一并清理——旧 shell 补全脚本文件（用户主目录下的旧 bash 补全脚本与 PowerShell profile 脚本）、rc/profile 中的旧标记块、变更目录下的旧遗留 sidecar 目录、跨变更索引目录下的旧索引库。旧补全脚本的残留尤为关键：旧标记块不被新工具识别时仍会 source 旧脚本，导致补全项重复与冲突

## Capabilities

### New Capabilities

- `legacy-install-migration`: 旧装机一次性迁移：检测旧版标识产物（旧配置目录、旧前缀技能与指令），搬运配置内容并做类型改名映射，清理旧产物，输出迁移报告；含幂等性与边界容错约束

### Modified Capabilities


## Impact

### 直接影响的文件

- `src/core/legacy-migration.ts`: 新建：旧标识常量、遗留产物检测、类型改名映射表、配置搬运、旧产物清理、报告结构装配
- `src/commands/init.ts`: 入口接入迁移步骤（在配置创建/技能生成之前执行），输出迁移报告段落；接入 --no-migrate 开关
- `src/commands/update.ts`: 入口接入迁移步骤，输出迁移报告段落；接入 --no-migrate 开关
- `src/cli/index.ts`: init 与 update 命令注册 --no-migrate 选项与说明文案
- `src/core/project-config.ts`: 复用既有 replaceConfigSection 的逐行段替换语义完成配置搬运，避免重新序列化 YAML 而丢失注释
- `src/core/reconcile.ts`: 确认迁移清理先于 reconcile 执行，避免旧产物被 reconcile 误报为「不在当前 workflows 配置中」的孤立产物
- `test/legacy-migration.test.ts`: 新建：检测、映射、配置搬运保真、幂等、边界容错的单元测试
- `test/`: 既有 init/update 相关测试补充迁移报告断言；旧装机夹具的端到端测试
- `docs/`: 补充旧装机升级指引（迁移会做什么、告警含义、--no-migrate 用法）
- `AGENTS.md`: 修改守则与项目约定中记录迁移行为的边界（旧产物一律删除的取舍与告警语义）

### 向后兼容

本变更本身为新增能力，不改动任何既有对外契约。但它对旧装机具有破坏性副作用：迁移会删除旧前缀技能与指令（含用户手工修改过的内容，按已定决策一律删除），因此实际影响取决于调用时机。缓解措施为：迁移报告显式列出删除明细并对可能丢失的手工修改给出告警；提供 --no-migrate 开关供手工控制。配置内容搬运是保真的——用户自写的 context 与 rules 行逐字保留，仅按类型映射改名文件与列表项。本变更依赖 iagent-rebrand 先落地（引用的新 token 与类型映射表由该变更定义）。

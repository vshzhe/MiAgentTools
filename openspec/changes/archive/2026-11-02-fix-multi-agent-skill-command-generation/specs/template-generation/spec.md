## ADDED Requirements

### Requirement: 技能与参考文件宿主技能 ID 统一归一化及宿主路径去耦合

`generateSkillContent` SHALL 对技能模板的 `description`、`compatibility`、`instructions` 以及 `references[].content` 统一执行 `normalizeHostSkillRefs`，将所有已知工作流的内部技能名 `iagent_<id>` 归一化为 canonical 宿主技能 ID `iagent-<workflowId>`（不依赖调用方是否显式传入 `options.hostId`），确保 `skills/` 静态快照、`iagent init`、`iagent update` 与 `iagent generate` 产出的 `SKILL.md` 及 `references/*.md` 均不含内部下划线技能名残留。

内置技能模板（如 `project-init.ts`、`test.ts`）的正文与 `references/*.md` MUST NOT 硬编码 Claude 专属目录路径（如 `.claude/skills/iagent-.../references/...`）或 Claude 专属工具名（如 `经 Skill 工具委派`），SHALL 使用宿主无关的本技能目录相对路径（`references/<topic>.md`）与宿主中立的委派表述。

#### Scenario: generateSkillContent 全字段与 references 统一归一化

- **WHEN** 调用 `generateSkillContent` 生成任一技能产物（无论是否传入 `options.hostId`）
- **THEN** 返回的 `SKILL.md` 的 `description`、`compatibility`、正文以及 `references[].content` 中所有已知 `iagent_<id>` 引用 SHALL 全部归一化为 `iagent-<id>`

#### Scenario: 模板正文与 references 无硬编码宿主路径及专属工具名

- **WHEN** 扫描全部内置技能模板的 `instructions` 与 `references[].content`
- **THEN** MUST NOT 出现硬编码的 `.claude/skills/` 路径或 `经 Skill 工具` 宿主专属表述，参考文件引导 SHALL 使用相对路径 `references/<topic>.md`

## MODIFIED Requirements

### Requirement: 模板正文指令引用 SHALL 单一源并可生成期校验

模板正文（`SkillTemplate.instructions`、`SkillTemplate.references[].content` 与 `CommandTemplate.content`）中的斜杠指令引用 SHALL 以**规范形** `/iagent:<id>` 书写，其中 `<id>` 为技能名经 `deriveCommandId` 派生的指令 id。系统 SHALL 提供单一源模块 `src/core/templates/command-references.ts`，导出 `commandRef(id)`（产出规范形引用）、`prefixedCommandRef(id)`（产出 `/iagent-<id>`）、`codexSkillRef(id)`（产出 `$iagent-<id>`）、`KNOWN_COMMAND_IDS`（从注册表 `WORKFLOW_PAIRS` 派生，MUST NOT 手工维护）与 `rewriteCommandRefs(text, layout, knownIds)`（生成期按工具指令布局改写）。

生成期改写规则：`namespace-dir` 布局（Claude Code）输出 `/iagent:<id>`；`prefixed-file` 布局（Pi、OpenCode）输出 `/iagent-<id>`；`skills-only` 布局（Codex）输出 Codex CLI 原生技能引用 `$iagent-<id>`；当 `layout` 为 `undefined` 时保持返回 `/iagent:<id>`。`skills-only` 改写 SHALL 与宿主编档保持同源一致：`src/core/host-orchestration/hosts.ts` 的 `codex.native.skillLoading` 与 `src/core/host-orchestration/actions.ts` 的 `renderLoadSkill('codex', ...)` MUST NOT 继续声明「Codex 无宿主级技能调用工具」而与本规则冲突，且该改写 MUST NOT 被解释为授予 Codex `delegate` / `gate` 能力（`capabilities` 仍仅含 `skill-load` / `argument-passing`，degraded 边界不变）。改写 MUST 同时作用于 `SKILL.md` 主正文与 `references/*.md` 附加参考文件，且 MUST 仅作用于 `KNOWN_COMMAND_IDS` 内的 id，未知名 MUST 保持原样（MUST NOT 静默改写为另一个不存在的命令）。当 `iagent update` 检测到目标技能的主 `SKILL.md` 已被用户手改且未传入 `--force` 时，SHALL 跳过该技能并保留其既有 `SKILL.md` 与 `references/` 目录不被覆盖。

测试 MUST 在源码侧拦截死引用：模板正文中出现的每个 `/iagent:<id>` 之 id MUST ∈ `KNOWN_COMMAND_IDS`；每个 `Skill(iagent-<workflowId>)` 条目 MUST 对应已注册技能；每个**无条件**委派技能 MUST 由 `profiles.ts` 的 `DEPS` 依赖注入覆盖（保证随装，不产生指向未安装技能的死引用）。含运行时降级路径的**条件委派**（如 `project-init → feature-doc`、`workflow → test`、`debug → proposal-review`）不受 `DEPS` 覆盖约束，但其正文 MUST 声明降级路径。

#### Scenario: 引用以规范形书写并由单一源产出

- **WHEN** 某模板正文需要引用 `iagent_spec_apply` 的指令
- **THEN** 正文 SHALL 书写规范形 `/iagent:spec-apply`（或经 `commandRef('spec-apply')` 产出），MUST NOT 硬编码与 `deriveCommandId` 结果不一致的字符串

#### Scenario: 生成期按工具布局改写

- **WHEN** 为 `prefixed-file` 布局的工具（Pi、OpenCode）生成含 `/iagent:spec-apply` 的产物
- **THEN** 产物正文 SHALL 为 `/iagent-spec-apply`；为 `namespace-dir` 布局的工具（Claude）生成时 SHALL 保持 `/iagent:spec-apply`

#### Scenario: Codex skills-only 布局改写与 undefined 向后兼容

- **WHEN** 为 `skills-only` 布局的工具（Codex）生成含已知 `/iagent:spec-apply` 与未知 `/iagent:unknown-cmd` 的 `SKILL.md` 与 `references/*.md`
- **THEN** 已知引用 SHALL 改写为 `$iagent-spec-apply`，未知 `/iagent:unknown-cmd` SHALL 保持原样；而当 `rewriteCommandRefs(text, undefined, knownIds)` 以 `layout === undefined` 调用时 SHALL 仍返回 `/iagent:spec-apply`
- **AND** `hosts.ts` 的 `codex.native.skillLoading`、`actions.ts` 的 `renderLoadSkill('codex', ...)` 与 `README.md` 对照表的 Codex 技能触发形式 SHALL 与 `$iagent-<id>` 一致，且 `HOST_PROFILES.codex.capabilities` MUST NOT 因本改写新增 `delegate` / `gate`

#### Scenario: references 附加文件同步改写且遵循手改保护

- **WHEN** 执行 `iagent init`、`iagent update` 或 `iagent generate` 生成含 `references/*.md` 的技能
- **THEN** 落盘的 `references/*.md` SHALL 同步完成 `rewriteCommandRefs` 与 `normalizeHostSkillRefs` 改写；若 `iagent update` 判定主 `SKILL.md` 已手改且未带 `--force`，SHALL 跳过该技能且 MUST NOT 覆盖其 `references/` 目录

#### Scenario: 未注册 id 被测试拦截

- **WHEN** 某模板正文出现 `/iagent:commit-change` 而注册表中不存在 id `commit-change`（真实 id 为 `commit`）
- **THEN** 引用校验测试 MUST 失败并指出该未注册 id；生成期改写 MUST NOT 将其改写为任何命令（未知名保持原样）

#### Scenario: 历史断链修复

- **WHEN** 本变更落地后检查 `commit.ts` 与 `review.ts` 的正文引用
- **THEN** 二者 SHALL 分别为 `/iagent:commit` 与 `/iagent:review`（真实 id），生成产物正文 MUST NOT 再含 `/iagent:commit-change` 或 `/iagent:review-code`

#### Scenario: 无条件委派技能由 DEPS 覆盖

- **WHEN** 某技能经 `Skill(iagent-<workflowId>)` **无条件**委派子技能
- **THEN** 该子技能对应的 workflow id MUST 出现在 `DEPS` 依赖注入闭包中，确保安装该技能时子技能随装；测试 MUST 断言覆盖性

#### Scenario: 条件委派声明降级路径

- **WHEN** 某技能**条件委派**子技能（如 `project-init → feature-doc`、`workflow → test`、`debug → proposal-review`）
- **THEN** 其正文 MUST 声明"委派不可得时自行降级"的路径；该委派不受 `DEPS` 覆盖约束，但测试 MUST 以显式例外清单标注

#### Scenario: 引用改写适用于全部派生正文

- **WHEN** 检查各技能 `CommandTemplate.content` 的生成方式
- **THEN** 全部 20 个内置配对的指令正文均由 `deriveCommandContent` 从 skill instructions 派生
- **AND** 引用改写对全部派生正文同等适用

### Requirement: frontmatter 元数据字段 SHALL NOT 含 metadata.version

技能模板 frontmatter 的 `metadata` 段 SHALL 仅含 `author`、`type`、`generatedBy`、`generatedFingerprint` 等有消费者或记账职责的字段；SHALL NOT 含游离的 `metadata.version`。经代码取证，当前实际残留 `version: '1.0'` 的模板为 `workflow`、`auto-workflow`、`spec-explore`、`spec-propose` 四个，全部 20 个内置技能模板与 `iagent generate` 骨架在该项落地后 MUST NOT 再含该字段（`generateSkillContent` 从不渲染 `metadata.version`，故本项为源码卫生，产物字节不变；`iagent generate` 骨架当前已无该字段，仅需回归断言）。

`metadata.generatedBy`（产物版本号，CLI 写入）与 `metadata.generatedFingerprint`（内容指纹，手改保护）语义 MUST 保持不变。

#### Scenario: 模板与生成器不再写入 version

- **WHEN** 检查任一内置技能模板对象、`iagent generate` 生成产物或 `SKILL.md` 的 frontmatter `metadata` 段
- **THEN** MUST NOT 含 `version:` 行或 `metadata.version` 属性；`SkillTemplate.metadata` 类型契约 MUST NOT 声明 `version` 字段

#### Scenario: 存量产物移除 version 后仍可安全升级

- **WHEN** 对含旧 `metadata.version` 的存量产物运行 `iagent update`
- **THEN** 手改保护判定基于内容指纹自洽比对（`readGeneratedFingerprint(existing) === fingerprintOf(existing)`），与模板内容无关——产物 SHALL 判为"未手改"并被正常覆盖升级，MUST NOT 需要 `--force`

#### Scenario: 记账字段不受影响

- **WHEN** 生成技能或指令产物
- **THEN** frontmatter SHALL 仍含 `metadata.generatedBy` 与 `metadata.generatedFingerprint`，取值与语义与移除 version 前一致

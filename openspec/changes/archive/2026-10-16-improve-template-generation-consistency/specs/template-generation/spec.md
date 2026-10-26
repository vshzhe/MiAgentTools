## ADDED Requirements

### Requirement: 模板正文指令引用 SHALL 单一源并可生成期校验

模板正文（`SkillTemplate.instructions` 与 `CommandTemplate.content`）中的斜杠指令引用 SHALL 以**规范形** `/iagent:<id>` 书写，其中 `<id>` 为技能名经 `deriveCommandId` 派生的指令 id。系统 SHALL 提供单一源模块 `src/core/templates/command-references.ts`，导出 `commandRef(id)`（产出规范形引用）、`KNOWN_COMMAND_IDS`（从注册表 `WORKFLOW_PAIRS` 派生，MUST NOT 手工维护）与 `rewriteCommandRefs(text, layout)`（生成期按工具指令布局改写）。

生成期改写规则：`namespace-dir` 布局（Claude Code）输出 `/iagent:<id>`；`prefixed-file` 布局（Pi）输出 `/iagent-<id>`。改写 MUST 仅作用于 `KNOWN_COMMAND_IDS` 内的 id，未知名 MUST 保持原样（MUST NOT 静默改写为另一个不存在的命令）。

测试 MUST 在源码侧拦截死引用：模板正文中出现的每个 `/iagent:<id>` 之 id MUST ∈ `KNOWN_COMMAND_IDS`；每个 `Skill(<裸名>)` 条目 MUST 对应已注册技能 `iagent_<裸名>`；每个**无条件**委派技能 MUST 由 `profiles.ts` 的 `DEPS` 依赖注入覆盖（保证随装，不产生指向未安装技能的死引用）。含运行时降级路径的**条件委派**（如 `project-init → feature-doc`、`workflow → test`、`debug → proposal-review`）不受 `DEPS` 覆盖约束，但其正文 MUST 声明降级路径。

#### Scenario: 引用以规范形书写并由单一源产出

- **WHEN** 某模板正文需要引用 `iagent_spec_apply` 的指令
- **THEN** 正文 SHALL 书写规范形 `/iagent:spec-apply`（或经 `commandRef('spec-apply')` 产出），MUST NOT 硬编码与 `deriveCommandId` 结果不一致的字符串

#### Scenario: 生成期按工具布局改写

- **WHEN** 为 `prefixed-file` 布局的工具（Pi）生成含 `/iagent:spec-apply` 的产物
- **THEN** 产物正文 SHALL 为 `/iagent-spec-apply`；为 `namespace-dir` 布局的工具（Claude）生成时 SHALL 保持 `/iagent:spec-apply`

#### Scenario: 未注册 id 被测试拦截

- **WHEN** 某模板正文出现 `/iagent:commit-change` 而注册表中不存在 id `commit-change`（真实 id 为 `commit`）
- **THEN** 引用校验测试 MUST 失败并指出该未注册 id；生成期改写 MUST NOT 将其改写为任何命令（未知名保持原样）

#### Scenario: 历史断链修复

- **WHEN** 本变更落地后检查 `commit.ts` 与 `review.ts` 的正文引用
- **THEN** 二者 SHALL 分别为 `/iagent:commit` 与 `/iagent:review`（真实 id），生成产物正文 MUST NOT 再含 `/iagent:commit-change` 或 `/iagent:review-code`

#### Scenario: 无条件委派技能由 DEPS 覆盖

- **WHEN** 某技能经 `Skill(<裸名>)` **无条件**委派子技能
- **THEN** 该子技能对应的 workflow id MUST 出现在 `DEPS` 依赖注入闭包中，确保安装该技能时子技能随装；测试 MUST 断言覆盖性

#### Scenario: 条件委派声明降级路径

- **WHEN** 某技能**条件委派**子技能（如 `project-init → feature-doc`、`workflow → test`、`debug → proposal-review`）
- **THEN** 其正文 MUST 声明"委派不可得时自行降级"的路径；该委派不受 `DEPS` 覆盖约束，但测试 MUST 以显式例外清单标注

#### Scenario: 引用改写不改变指令派生策略

- **WHEN** 本变更落地后检查各技能 `CommandTemplate.content` 的生成方式
- **THEN** spec-* 指令仍由 `deriveCommandContent` 从 skill instructions 派生（保真比 81–100%）；12 个手写指令模板（workflow / auto-workflow / debug / commit / review / test / svn-commit / migration / migration-check / feature-doc / requirement-doc / proposal-review）仍为手写压缩版；本变更 MUST NOT 将 `deriveCommandContent` 强制到全部模板（引用改写对派生与手写两类正文同等适用）

### Requirement: frontmatter 元数据字段 SHALL NOT 含 metadata.version

技能模板 frontmatter 的 `metadata` 段 SHALL 仅含 `author`、`type`、`generatedBy`、`generatedFingerprint` 等有消费者或记账职责的字段；SHALL NOT 含游离的 `metadata.version`。`SkillTemplate.metadata.version` 字段与生成器写入的 `version:` 行 SHALL 被移除。

`metadata.generatedBy`（产物版本号，CLI 写入）与 `metadata.generatedFingerprint`（内容指纹，手改保护）语义 MUST 保持不变。

#### Scenario: 模板与生成器不再写入 version

- **WHEN** 检查任一技能 `SKILL.md` 的 frontmatter `metadata` 段
- **THEN** MUST NOT 含 `version:` 行；`SkillTemplate.metadata` 类型契约 MUST NOT 声明 `version` 字段

#### Scenario: 存量产物移除 version 后仍可安全升级

- **WHEN** 对含旧 `metadata.version` 的存量产物运行 `iagent update`
- **THEN** 手改保护判定基于内容指纹自洽比对（`readGeneratedFingerprint(existing) === fingerprintOf(existing)`），与模板内容无关——产物 SHALL 判为"未手改"并被正常覆盖升级，MUST NOT 需要 `--force`

#### Scenario: 记账字段不受影响

- **WHEN** 生成技能或指令产物
- **THEN** frontmatter SHALL 仍含 `metadata.generatedBy` 与 `metadata.generatedFingerprint`，取值与语义与移除 version 前一致

## MODIFIED Requirements

### Requirement: 类型 id 集
系统 SHALL 定义且仅定义 9 个技能类型 id：init、impl、test、commit、review、release、tools、docs、spec。类型 id MUST NOT 携带 tr 前缀。类型 SHALL 作为 frontmatter 的 metadata.type 与 `.iagent/rules/<type>.md` 的文件名来源。`spec` 兼具类型 id 与技能名领域段两重身份，两者取值 SHALL 一致。

类型 meta SHALL 以可选 `reserved?: boolean` 标记**预留类型**（当前无内置技能，供 `iagent generate --type` 扩展）：`release` 与 `tools` SHALL 标记为预留；其余 7 类为在用类型。`iagent validate` 的非法类型提示与文档 SHALL 区分在用 / 预留，MUST NOT 暗示预留类型不可用。

`review` 类型语义 SHALL 为「审查 / 检查」，覆盖代码审查、提案完整性审查与迁移一致性检查；**检查/审查类技能 SHALL 归入 `review`**（当前含 `iagent_review` / `iagent_proposal_review` / `iagent_migration_check`）。`impl` 类型语义 SHALL 为「实现域编排」（当前含 `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_migration`）。

类型体系 SHALL 文档化类型轴（生命周期类：init / impl / test / commit / review / release / tools；领域类：docs / spec）、`spec` 的双重身份、`impl` 与 `review` 的语义边界，以及 `reserved` 规则。

#### Scenario: 类型 id 无 tr 前缀
- **GIVEN** 系统类型注册表
- **WHEN** 枚举全部类型 id
- **THEN** 得到 init/impl/test/commit/review/release/tools/docs/spec，无一以 tr 开头

#### Scenario: 规则文件名取自类型 id
- **GIVEN** config.yaml 的 rules 列表含 impl
- **WHEN** 解析并读取规则文件
- **THEN** 读取 .iagent/rules/impl.md，缺失时记为 missingRuleFiles

#### Scenario: 非法类型被拒
- **GIVEN** 传入类型 id tr_impl
- **WHEN** 执行类型合法性校验
- **THEN** 判定为非法类型

#### Scenario: 预留类型标记与可扩展
- **WHEN** 枚举类型 meta
- **THEN** `release` 与 `tools` 的 `reserved` 为 true，其余类型为 false/未设置；二者仍可通过 `iagent generate --type release|tools` 生成骨架（MUST NOT 因预留而拒绝）

#### Scenario: 检查类技能归入 review 类型
- **WHEN** 检查 `iagent_proposal_review` 与 `iagent_migration_check` 的 frontmatter `metadata.type`
- **THEN** 二者 SHALL 为 `review`（而非 `impl`）；`iagent_review` 亦为 `review`；三者同属审查/检查语义

#### Scenario: 归位后规则注入可达
- **WHEN** 类型为 `review` 的技能读取项目规则
- **THEN** 读取 `.iagent/rules/review.md`；`defaultRuleFileContent('review')` MUST 返回非空的默认规则内容（不因归位而注入空规则）

#### Scenario: 存量检查类技能升级归位

- **WHEN** 对含存量 `metadata.type: impl` 的 `iagent_proposal_review` / `iagent_migration_check` 运行 `iagent update`
- **THEN** 产物 SHALL 被覆盖刷新为 `metadata.type: review`；因内容指纹自洽比对，判定为未手改，MUST NOT 需要 `--force`

## ADDED Requirements

### Requirement: 技能 description 结构与长度约束

技能模板 `SkillTemplate.description` SHALL 遵循统一结构：**中文一句话用途 + 触发词（中英） + `NOT for …（改用 X）` 排歧**。description 长度 MUST ≤ 1024 字符（对齐 Agent Skills 规范上限），并 SHALL 在 ≥ 800 字符时输出软告警（不阻断）。

将纯英文 description 规范化时 MUST 保留原英文触发关键词，MUST NOT 因改写导致触发匹配退化。description 的 YAML 转义 SHALL 走既有 `escapeYamlValue`。

#### Scenario: description 结构统一
- **WHEN** 检查任一技能的 description
- **THEN** 其 SHALL 含中文用途表述；含触发词；与相邻技能存在边界时含 `NOT for …` 或"不适用"排歧表述

#### Scenario: 长度上限与软告警
- **WHEN** 检查任一技能 description 长度
- **THEN** 长度 MUST ≤ 1024 字符；≥ 800 字符时输出软告警但不使测试失败

#### Scenario: 英文描述中文化保留触发词
- **WHEN** 将纯英文 description（如 `iagent_feature_doc`）规范化为中文优先
- **THEN** 原英文触发关键词（如 "feature map" / "migration requirement document"）SHALL 保留，触发匹配不退化；测试断言关键触发词仍存在

#### Scenario: description 含 YAML 特殊字符时安全转义

- **WHEN** description 含 `:` 或 `"` 等 YAML 特殊字符
- **THEN** 写入 frontmatter 时 SHALL 经 `escapeYamlValue` 转义，frontmatter 可被正常解析（结构测试按语义判定，MUST NOT 因转义而误判）

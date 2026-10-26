# agent-tool-identity 增量规格

## MODIFIED Requirements

### Requirement: 类型 id 集

系统 SHALL 定义且仅定义 9 个技能类型 id：init、impl、test、commit、review、release、tools、docs、spec。类型 id MUST NOT 携带 tr 前缀。类型 SHALL 作为 frontmatter 的 metadata.type；`.iagent/rules/` 下的规则文件名 SHALL 由类型经**类型→语义名映射**派生（映射内容、派生/反查/回退细则见 `iagent-rules-config` 能力，本规格不重复映射表）；管理型三类型的规则文件路径 MUST NOT 以 `<type>.md` 直拼。`spec` 兼具类型 id 与技能名领域段两重身份，两者取值 SHALL 一致。

类型 meta SHALL 以可选 `reserved?: boolean` 标记**预留类型**（当前无内置技能，供 `iagent generate --type` 扩展）：`release` 与 `tools` SHALL 标记为预留；其余 7 类为在用类型。`iagent validate` 的非法类型提示与文档 SHALL 区分在用 / 预留，MUST NOT 暗示预留类型不可用。

`review` 类型语义 SHALL 为「审查 / 检查」，覆盖代码审查、提案完整性审查与迁移一致性检查；**检查/审查类技能 SHALL 归入 `review`**（当前含 `iagent_review` / `iagent_proposal_review` / `iagent_migration_check`）。`impl` 类型语义 SHALL 为「实现域编排」（当前含 `iagent_workflow` / `iagent_auto_workflow` / `iagent_debug` / `iagent_migration`）。

类型体系 SHALL 文档化类型轴（生命周期类：init / impl / test / commit / review / release / tools；领域类：docs / spec）、`spec` 的双重身份、`impl` 与 `review` 的语义边界，以及 `reserved` 规则。

#### Scenario: 类型 id 无 tr 前缀

- **GIVEN** 系统类型注册表
- **WHEN** 枚举全部类型 id
- **THEN** 得到 init/impl/test/commit/review/release/tools/docs/spec，无一以 tr 开头

#### Scenario: 规则文件名经映射派生

- **GIVEN** config.yaml 的 rules 列表含 impl
- **WHEN** 解析并读取规则文件
- **THEN** 读取 `.iagent/rules/coding-rules.md`，缺失时记为 missingRuleFiles

#### Scenario: 映射外类型回退直拼

- **GIVEN** config.yaml 的 rules 列表含 commit
- **WHEN** 解析该类型的规则文件路径
- **THEN** 路径 SHALL 回退为 `.iagent/rules/commit.md`，MUST NOT 引入额外语义名

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

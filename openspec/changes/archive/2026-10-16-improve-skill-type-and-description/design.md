## Context

- **类型体系**：`src/core/config.ts` 的 `SKILL_TYPES: SkillTypeMeta[]`（`id` / `name` / `description`）为单点真源；`SKILL_TYPE_IDS` / `isSkillType` 由其派生。
- **消费面**（探索记录影响表）：`list.ts`（分组展示，空组跳过）、`validate.ts:121`（硬编码"必须为 9 类之一"）、`generate.ts`（`isSkillType` 校验 + 骨架生成）、`show.ts`（展示）、`project-config.ts` 的 `defaultRuleFileContent`（**类型 → 默认规则内容**）+ 技能读 `.iagent/rules/<type>.md`、`legacy-migration.ts`（`LEGACY_TYPE_RENAME` 由 `SKILL_TYPES` 派生，测试锁定 `SKILL_TYPES.length === 9`）。
- **description**：Agent Skills 规范的 `description` 是触发匹配入口；`generator.ts` 经 `escapeYamlValue` 写入 frontmatter；现有测试仅断言 `length > 10`。
- **现状类型分布**：init 1、impl 6、test 1、commit 2、review 1、docs 2、spec 7；release / tools 各 0。

## Goals / Non-Goals

**Goals**:
- 空类型"名副其实"（`reserved` 标记 + 文案/文档区分在用/预留）；
- 检查类技能归位 `review`（语义扩展为「审查 / 检查」），`impl` 明确为「实现域编排」；
- description 结构统一（中文用途 + 触发词 + NOT-for）与长度约束（≤1024 硬 / ≥800 软）；
- 类型语义（轴、双重身份、兜底语义）文档化 + 测试。

**Non-Goals**:
- **不新增/删除类型**：`release` / `tools` 保留为预留类型，MUST NOT 移除（`iagent generate --type` 仍可用）。
- **不改变技能行为**：确认门、阶段、委派面、allowedTools 不变。
- **不改技能命名**：仅类型归属与 description 文本。
- **不实现预留类型的技能**：`release` / `tools` 仍为空。
- **不做类型轴的结构性重构**（如拆分生命周期/领域为两张表）——仅文档化现状。

## Decisions

### D1: `SkillTypeMeta.reserved` 标记预留类型
- **选择**：`SkillTypeMeta` 新增可选 `reserved?: boolean`；`release` / `tools` 标 `true`。`list` 维持空组跳过；`validate` 非法类型文案改为"必须为 9 类之一（含 2 类预留：release / tools）"（去硬编码或明确标注）；README / AGENTS 声明。
- **理由**：以最小改动使"9 类中用 7 类、预留 2 类"显式化，消除"声明了却无实现"的困惑。
- **备选**：①移除空类型（`iagent generate --type release` 失效，且 `LEGACY_TYPE_RENAME` 测试连锁，弃）；②仅改文档不动代码（无法被测试守护，弃）。

### D2: 检查类技能归位 `review`
- **选择**：`review` 语义扩展为「审查 / 检查」（name 由"审查"改为"审查 / 检查"，description 覆盖代码审查 + 提案完整性审查 + 迁移一致性检查）；`iagent_proposal_review`、`iagent_migration_check` 的 `metadata.type` 改为 `review`；`impl` = `workflow` / `auto-workflow` / `debug` / `migration`（实现域编排）。
- **理由**：二者本质是"审查/检查"，不实现代码；`review` 类型已存在（代码审查），扩展语义比新增类型更轻、避免类型膨胀。
- **备选**：①新增 `quality` 类型（类型 9→10，`SKILL_TYPES.length` 测试、`LEGACY_TYPE_RENAME` 连锁，且新增空语义，弃）；②保留 `impl` 仅文档化（不解决"名不副实"，弃）。

### D3: 归位后的规则注入处理
- **选择**：`defaultRuleFileContent` 为 `review` 补默认规则内容；技能读 `.iagent/rules/<type>.md` 的逻辑不变；归位后 `proposal-review` / `migration-check` 读取 `.iagent/rules/review.md`。
- **理由**：类型变更直接影响 rules 注入源，须保证新类型有可注入的默认规则，避免"归位即注入失效"。
- **备选**：保留 `impl` 规则注入（与类型语义矛盾，弃）。

### D4: description 结构与长度
- **选择**：结构 = 中文一句话用途 + 触发词（中英）+ `NOT for …（改用 X）` 排歧；长度 **≤ 1024（硬，Agent Skills 上限）+ ≥ 800 软告警（测试 console.warn，不失败）**；4 个纯英文描述改中文优先、**逐条保留原英文触发关键词**。
- **理由**：统一结构降低路由成本；保留关键词保证触发匹配不退化；引用 Agent Skills 规范上限而非自定阈值。
- **备选**：①自定更紧上限（如 500）——会迫使 `feature-doc`/`workflow` 大幅删减触发词，触发退化风险，弃；②不设约束仅文档（无守护，弃）。

### D5: 类型语义文档化
- **选择**：`config.ts` 注释 + AGENTS.md 声明——类型轴（生命周期类：init/impl/test/commit/review/release/tools；领域类：docs/spec）、`spec` 双重身份（类型 id + 名称领域段）、`impl` 兜底语义与 `review` 审查/检查语义、`reserved` 规则。
- **理由**：P4 的根因之一是语义未文档化导致归类随意；文档化 + 归位共同"名副其实"。
- **备选**：无（文档化是必要动作）。

## Architecture Mapping

```
SKILL_TYPES（9 类）
├─ 在用（7）
│   ├─ init(1) impl(4=编排) test(1) commit(2) review(3=审查/检查) docs(2) spec(7)
│   └─ impl 语义：实现域编排（workflow/auto-workflow/debug/migration）
│   └─ review 语义：审查/检查（review/proposal-review/migration-check）
└─ reserved（2）：release / tools（iagent generate --type 可扩展）

description：中文用途 + 触发词（中英）+ NOT-for 排歧；≤1024 硬 / ≥800 软
```

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| 归位改变规则注入导致技能行为变化 | D3 补 `review` 默认规则；测试断言 `defaultRuleFileContent('review')` 非空 |
| 英文描述改中文后触发匹配退化 | D4 逐条保留原英文关键词；快照 diff 审查触发词齐全 |
| `SKILL_TYPES.length === 9` 测试与 `LEGACY_TYPE_RENAME` 连锁 | 本变更**不增删类型**，长度仍 9，`LEGACY_TYPE_RENAME` 不变 |
| `validate.ts` 硬编码"9 类"文案 | D1 改为动态/含预留说明，避免误导 |
| 存量产物 `type=impl`（检查类）升级后不一致 | `iagent update` 内容指纹自洽可覆盖；无需 `--force` |
| description 含 YAML 特殊字符 | 既有 `escapeYamlValue` 负责；结构测试按语义判定不断言原文 |

## Open Questions

- **[待确认]** `migration-check` 归位 `review` vs 保留 `impl`——本变更选择归位（检查性质优先于套件归属）。
- **[待确认]** 软告警阈值 800 是否合适（当前 >800 者：feature_doc 808）——软告警不阻断。

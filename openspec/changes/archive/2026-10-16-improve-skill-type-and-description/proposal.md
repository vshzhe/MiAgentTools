## Why

技能类型体系当前"名不副实"（探索记录见 `openspec/explorations/type-and-description-explore-001.md`，整体根因见 `skill-system-review-explore-001.md` 的 P4/P8）：

1. **空类型无标记**：`SKILL_TYPES` 声明 9 类，但 `release` / `tools` **无任何内置技能**。`README.md` 称其为"保留类型供扩展"，而 `src/core/config.ts` 的 `SkillTypeMeta` **无任何标记**——类型 meta、`iagent list`、`iagent validate` 无法区分"在用类型"与"预留类型"，`validate.ts` 甚至硬编码"必须为 9 类之一"。
2. **`impl` 是兜底类**：塞入 6 种异质技能——编排器（`workflow` / `auto-workflow` / `migration`）、调试（`debug`）、质量门（`proposal-review`）、检查（`migration-check`）。其中 `proposal-review`（"检查变更提案完整性与实现合规性"）与 `migration-check`（"检查迁移后功能一致性"）本质是**审查/检查**类，归入 `impl`（实现）语义不符。
3. **description 语言/长度不统一**：`feature-doc` / `migration` / `migration-check` / `requirement-doc` 为纯英文，`commit` / `review` / `test` 为纯中文，`workflow` / `debug` 双语；最长 808 字符（逼近 Agent Skills 规范的 1024 上限）。description 是技能**触发匹配的唯一入口**，混用与超长增加路由成本。

## What Changes

1. **`reserved` 标记预留类型**：`SkillTypeMeta` 新增可选 `reserved?: boolean`；`release` / `tools` 标 `true`。`iagent list` 维持空组跳过，`iagent validate` 的非法类型文案改为区分"在用类型 / 预留类型"，文档（README / AGENTS）同步。
2. **检查类技能归位 `review`**：`review` 类型语义扩展为「审查 / 检查」；`iagent_proposal_review` 与 `iagent_migration_check` 的 `metadata.type` 由 `impl` 改为 `review`；`impl` 语义明确为「实现域编排」（保留 `workflow` / `auto-workflow` / `debug` / `migration`）。`defaultRuleFileContent` 补 `review` 默认规则，避免归位后规则注入失效。
3. **description 规范化**：统一结构 = **中文一句话用途 + 触发词（中英） + `NOT for …（改用 X）` 排歧**；长度约束 **≤ 1024 字符（硬，对齐 Agent Skills 规范）+ ≥ 800 软告警**；把 4 个纯英文描述改为中文优先并**保留原英文触发关键词**（避免触发匹配退化）。
4. **类型语义文档化**：在 `config.ts` 注释与 AGENTS.md 声明类型轴（生命周期类 vs 领域类）、`spec` 的双重身份（类型 id + 名称领域段）、`impl` 兜底语义与 `review` 审查/检查语义。
5. **测试**：新增 description 结构与长度断言；更新类型相关测试（若断言 `proposal-review`/`migration-check` 为 `impl`）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-tool-identity`: 类型 id 集需求扩充——`release` / `tools` 为预留类型（`reserved` 标记）、`review` 语义扩展为「审查 / 检查」、检查类技能归位、类型语义文档化；新增「技能 description 结构与长度约束」要求。

## Impact

### 直接影响的文件

- `src/core/config.ts`: `SkillTypeMeta.reserved` 字段 + `release`/`tools` 标记 + `review` 名称/描述 + `impl` 语义注释
- `src/commands/validate.ts`: 非法类型文案区分在用/预留（去硬编码"9 类"）
- `src/commands/list.ts`: 预留类型展示（可选提示）
- `src/core/project-config.ts`: `defaultRuleFileContent` 补 `review` 默认规则
- `src/core/templates/workflows/proposal-review.ts` / `migration-check.ts`: `type: 'impl'` → `'review'`；description 规范化
- `src/core/templates/workflows/feature-doc.ts` / `migration.ts` / `requirement-doc.ts`: description 中文优先 + 保留英文触发词
- `test/`: description 结构与长度测试；类型相关断言更新
- `skills/`: 快照重新生成（`pnpm build && pnpm generate:skills`）
- `README.md` / `AGENTS.md`: 类型体系（在用/预留、review 语义、description 约定）文档同步

### 向后兼容

- **预留类型仍可用于 `iagent generate --type`**：`reserved` 仅表意，不移除类型；`isSkillType` 不变。
- **检查类技能类型变更**：`metadata.type` 由 `impl` → `review`，affects 规则注入文件（`.iagent/rules/impl.md` → `.agent/rules/review.md`）；`defaultRuleFileContent` 补 review 默认规则；`iagent update` 因内容指纹自洽可正常覆盖，无需 `--force`。
- **description 变更**：仅文本规范化，保留全部触发关键词；触发匹配不退化。
- **[待确认]** description 硬上限取 1024（Agent Skills 规范）——本变更采用；若项目希望更紧可后续收紧。

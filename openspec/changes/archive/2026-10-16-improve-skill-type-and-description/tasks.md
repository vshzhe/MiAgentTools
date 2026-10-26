# Tasks: improve-skill-type-and-description

<!-- 任务类型标签：[代码] / [DB脚本] / [使用说明]（默认产出至 attachments/） -->

## 1. 预留类型标记

- [x] 1.1 [代码] `config.ts` 的 `SkillTypeMeta` 新增可选 `reserved?: boolean`；为 `release` / `tools` 标 `reserved: true`；其余类型不标（在用）
  - 文件：`src/core/config.ts`
  - 验证：`SKILL_TYPES.length` 仍为 9；`release`/`tools` 的 `reserved === true`，`impl`/`review` 等为 false/未设置
  - Spec Ref：`agent-tool-identity / 类型 id 集`
  - Scenario Ref：预留类型标记与可扩展
  - Scenario Ref：类型 id 无 tr 前缀

- [x] 1.2 [代码] `validate.ts` 非法类型文案去硬编码"9 类"，改为区分在用/预留（如"必须为 9 类之一（含 2 类预留：release / tools）"）；`list.ts` 视需要提示预留类型；确认 `isSkillType` 不变（预留仍合法）
  - 文件：`src/commands/validate.ts`、`src/commands/list.ts`
  - 验证：非法类型报错文案含"预留"说明；`iagent generate --type release` 仍可生成
  - Spec Ref：`agent-tool-identity / 类型 id 集`
  - Scenario Ref：非法类型被拒
  - Scenario Ref：预留类型标记与可扩展

## 2. 检查类技能归位 review

- [x] 2.1 [代码] `config.ts` 中 `review` 类型的 name/description 扩展为「审查 / 检查」（代码审查 + 提案完整性审查 + 迁移一致性检查）；`impl` 语义注释明确为「实现域编排」
  - 文件：`src/core/config.ts`
  - 验证：`SKILL_TYPES` 中 review.name/description 反映扩展语义
  - Spec Ref：`agent-tool-identity / 类型 id 集`
  - Scenario Ref：检查类技能归入 review 类型

- [x] 2.2 [代码] `proposal-review.ts` 与 `migration-check.ts` 的 `type: 'impl'` 改为 `'review'`；同步规范化二者 description（结构统一）
  - 文件：`src/core/templates/workflows/proposal-review.ts`、`migration-check.ts`
  - 验证：两模板 `metadata.type` 为 review；快照 frontmatter 反映变更
  - Spec Ref：`agent-tool-identity / 类型 id 集`
  - Scenario Ref：检查类技能归入 review 类型

- [x] 2.3 [代码] `project-config.ts` 的 `defaultRuleFileContent` 补 `review` 默认规则内容（审查/检查类项目约束），避免归位后 `.iagent/rules/review.md` 注入为空
  - 文件：`src/core/project-config.ts`
  - 验证：`defaultRuleFileContent('review')` 返回非空规则；缺失时仍以占位规则兜底
  - Spec Ref：`agent-tool-identity / 类型 id 集`
  - Scenario Ref：归位后规则注入可达
  - Scenario Ref：规则文件名取自类型 id

## 3. description 规范化

- [x] 3.1 [代码] 将 4 个纯英文 description 改为中文优先：`feature-doc.ts` / `migration.ts` / `migration-check.ts` / `requirement-doc.ts`；逐条**保留原英文触发关键词**（如 "feature map" / "migration requirement document"），并补 `NOT for …（改用 X）` 排歧
  - 文件：`src/core/templates/workflows/feature-doc.ts`、`migration.ts`、`migration-check.ts`、`requirement-doc.ts`
  - 验证：改写后 description 含中文用途 + 原英文关键词 + NOT-for；`skills/` 快照 diff 审查关键词齐全
  - Spec Ref：`agent-tool-identity / 技能 description 结构与长度约束`
  - Scenario Ref：英文描述中文化保留触发词
  - Scenario Ref：description 结构统一

- [x] 3.2 [代码] 核对其余技能 description 结构：确保含中文用途 + 触发词；跨技能边界处含 `NOT for …`/不适用排歧；`escapeYamlValue` 转义正常
  - 文件：`src/core/templates/workflows/*.ts`
  - 验证：结构测试通过（3.3）；无 YAML 转义破坏
  - Spec Ref：`agent-tool-identity / 技能 description 结构与长度约束`
  - Scenario Ref：description 结构统一

- [x] 3.3 [测试][单元][P0] 新增 description 测试：① 长度 ≤ 1024（硬失败）；② ≥ 800 软告警（console.warn 不失败）；③ 结构断言（含中文用途与触发词/排歧）；④ 英文关键词保留断言（针对 4 个改写技能）
  - 文件：`test/templates.test.ts`（扩展）/ 新建 `test/description-format.test.ts`
  - 验证：`pnpm test` 全绿
  - Spec Ref：`agent-tool-identity / 技能 description 结构与长度约束`
  - Scenario Ref：长度上限与软告警
  - Scenario Ref：description 结构统一
  - Scenario Ref：英文描述中文化保留触发词
  - Scenario Ref：description 含 YAML 特殊字符时安全转义

## 4. 类型语义文档化

- [x] 4.1 [代码] `config.ts` 注释与 `AGENTS.md` / `README.md` 同步：声明类型轴（生命周期类 vs 领域类）、`spec` 双重身份、`impl`/`review` 语义边界、`reserved` 规则、在用 7 类 / 预留 2 类
  - 文件：`src/core/config.ts`、`AGENTS.md`、`README.md`
  - 验证：文档与 `SKILL_TYPES` 实际一致（在用/预留清单）
  - Spec Ref：`agent-tool-identity / 类型 id 集`
  - Scenario Ref：预留类型标记与可扩展

## 5. 快照、回归与版本

- [x] 5.1 [代码] 重新生成快照并人工审查 diff：`pnpm build && pnpm generate:skills`；`git diff skills/` 预期为 `proposal-review`/`migration-check` 的 type 变更与 4 个技能 description 改写
  - 文件：`skills/`
  - 验证：`test/skills-parity.test.ts` 通过；diff 仅含预期差异
  - Spec Ref：`agent-tool-identity / 技能 description 结构与长度约束`

- [x] 5.2 [测试][单元][P1] 更新类型相关既有断言：`legacy-migration.test.ts`（`SKILL_TYPES.length === 9` 仍成立）、`commands.test.ts`（`workflow.type === 'impl'` 仍成立；如断言了 proposal-review/migration-check 的 type 则更新为 review）
  - 文件：`test/legacy-migration.test.ts`、`test/commands.test.ts`
  - 验证：`pnpm test` 全绿
  - Spec Ref：`agent-tool-identity / 类型 id 集`
  - Scenario Ref：检查类技能归入 review 类型
  - Scenario Ref：存量检查类技能升级归位

- [x] 5.3 [代码] 全量回归与版本收尾：`pnpm build && pnpm test` 全绿；按守则 8 递增 `package.json` 版本（类型归属 + frontmatter 契约变更 → 取较大递增位）并归档 `CHANGELOG.md`
  - 文件：`package.json`、`CHANGELOG.md`
  - 验证：`pnpm test` 全绿；CHANGELOG 生成新版本小节
  - Spec Ref：`agent-tool-identity / 类型 id 集`

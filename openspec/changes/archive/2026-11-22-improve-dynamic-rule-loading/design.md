# 设计：规则与技能的动态加载

## Context

### 现状与架构位置

本变更跨三层：

- **核心层**：`src/core/project-config.ts`（`RULE_FILE_NAMES` / `ruleFileNameFor` / `ruleFileTypeFor`）与 `src/core/project-skills.ts`（`phases` / `scope` frontmatter）
- **命令层**：`src/commands/rules.ts` / `skills.ts`（枚举）与 `src/commands/spec.ts`（一致性门）
- **模板层**：7 个技能模板正文的读取段落

### 架构影响

改造前，读取策略是「枚举即全读」，三层之间没有任何筛选协作：

```
规则文件 ──枚举──> iagent rules --json ──全读──> 技能上下文
                                              ↑
技能类型 ──闲置─── RULE_FILE_NAMES          （无映射参与）
scope  ──闲置─── project-skills             （无筛选参与）
```

改造后形成「CLI 确定性筛选 → 模板按层读取」的链路：

```
技能类型 ──> iagent rules --json --type <t>
                ↓ rule-selection.ts（纯函数）
          ┌─────┴─────┬──────────┐
        always      phase    on-demand
          ↓           ↓          ↓
     常驻基线    阶段相关    按需点读（带理由）
          └───────────┴──────────┘
                     ↓
              未读声明（逐源 相关性/读取/理由）
                     ↓
              一致性门（漏读 fail / 不需要读 not-fail）
```

### 约束来源

- 项目规则：单一真源优先、派生而非复制、新增 CLI 参数须同步补全表、改模板后 build + generate:skills
- 项目技能（`backend-design.md`）：单一真源、扩展点接口化、fail-safe 默认、失败非阻断
- 探索决策 D1-D10 与硬约束 12 条

## Goals / Non-Goals

**Goals**:
- 消除 12 个全量读取点（常驻基线除外），使读取量与实际阶段/范围相关
- 让「读什么」由 CLI 确定性计算，而非模型主观判断
- 使「不需要读」与「漏读」可区分、可审计
- 保持 `rules` / `skills` 无参输出与既有产物完全兼容

**Non-Goals**:
- 不改变规则文件的格式与命名（`RULE_FILE_NAMES` 零改动）
- 不改 `phases` 的既有语义（只新增 `scope` 维度）
- 不重构 `project-skills.ts` 的解析与校验
- 不引入新的配置段或外部依赖

## Decisions

### DD1: 筛选内核放 `src/core/rule-selection.ts`（核心层）

- **选择**: 新增独立纯函数模块，不放 `commands/` 也不放 `templates/`。
- **理由**: 命令层（`rules.ts` / `skills.ts`）与模板层（技能正文经 CLI 调用）都要消费同一判定；放 `commands/` 会让模板层反向依赖命令层，放 `templates/` 会让命令层依赖模板层。核心层是唯一同向位置（与 `project-skills.ts` / `project-config.ts` 同级）。
- **备选**: 放 `src/core/project-skills.ts` 内部 —— 会让规则筛选与技能解析耦在同一文件，职责混杂。

### DD2: 类型映射复用 `ruleFileNameFor`，不另立表

- **选择**: `classifyRuleSources` 内部调用 `ruleFileNameFor(type)` 与 `ruleFileTypeFor(fileName)`。
- **理由**: `RULE_FILE_NAMES` 是「类型 → 文件名」的既有单一源（`project-config.ts:396`），且 `init` / `update` / legacy-migration 全部依赖它。另立映射表会出现两处漂移（正是 `AGENTS.md`「单一真源」纪律禁止的）。
- **备选**: 在 `rule-selection.ts` 内写 `{ impl: 'coding-rules.md', ... }` —— 直接违反单一源纪律。

### DD3: CLI 筛选为「加法参数」，无参路径完全不变

- **选择**: `--type` / `--phase` / `--scope` 只在传入时生效；无参时代码路径不进入筛选分支。
- **理由**: `rules --json` 的输出被 `conformance --rules-read` 与既有测试（`rules-command.test.ts`）断言；改动无参输出会破坏既有契约。D9 已裁决向后兼容优先。
- **备选**: 默认按当前技能类型筛选 —— 会让 CLI 行为依赖调用上下文，不可复现，且破坏无参契约。

### DD4: 筛选为空时回退 `always` 而非全量

- **选择**: `fallback: true` + 只返回常驻基线。
- **理由**: 回退全量等于「动态加载没有生效」，且会让不确定性从「筛选」转移到「兜底」；回退常驻基线至少保证元规则在场，同时以 WARN 暴露问题（fail-safe：宁可少读并告警，不可静默全读）。
- **备选**: 回退全量 + WARN —— 违背本变更的核心目标。

### DD5: `scope` 筛选只在范围可判定时启用

- **选择**: 模板正文写成「范围可判定时 MAY 追加 `--scope`；未判定时 MUST NOT 传」，并规定 `scope: null` 不被排除。
- **理由**: 探索早期往往还不知道变更侧重前端还是后端；强制传 `scope` 会逼模型猜范围，违反「零猜测」规则。`scope: null` 不排除则保证存量技能不因新维度消失。
- **备选**: 恒定传 `scope` —— 需要先判定范围，与探索阶段的信息完备度冲突。

### DD6: 未读声明用 Markdown 表格而非新 schema 字段

- **选择**: 在既有 `## 项目规则基线` / `## 项目技能基线` 段内增加列（`相关性` / `理由`），不新增 JSON 字段或新插件。
- **理由**: 这两个段已存在且已被 propose / apply 消费；加列是最小改动，且人类可读。`rulesSkipped` / `skillsSkipped` 作为回执字段（内存态），不落新文件。
- **备选**: 新增 `rules-read-manifest.json` —— 引入第二套真源，且与其他证据文件格式不一致。

### DD7: 一致性门的豁免通过新增可选输入实现

- **选择**: `ConformanceOptions.rules` 增加可选 `skip?: readonly string[]`；不传时行为与现状完全一致。
- **理由**: `buildConformance` 是纯函数且被 `runSpecConformance` / `runSpecValidate` 共用；新增可选字段是最小侵入。`spec conformance --rules-skip <paths>` 作为 CLI 透传入口。
- **备选**: 让模板层自己判断是否 fail —— 会把确定性判定推回模型，违背 DD7 精神。

### DD8: 技能正文改动优先下沉 references

- **选择**: `spec-explore`（1435 行代码 / SKILL ~20k 字符）与 `debug`（583 行 / ~20k 字符）的三层读取细则写入 `references/`，主文件只留指针 + 三层定义表。
- **理由**: `test/skill-size-budget.test.ts` 硬约束 ≤500 行 / ≤20000 字符；上一轮变更已因超限做过同样处理（precedent）。
- **备选**: 直接写进主文件 —— 会立刻触发预算测试失败。

## Risks / Trade-offs

| 风险 | 缓解 |
| :--- | :--- |
| 新增 CLI 参数改变补全与帮助文本 | 同步 `completion.ts`；`completion-config.test.ts` 断言覆盖；新增参数不影响无参行为 |
| 筛选逻辑误排除关键规则 | `always` 层恒读项目元规则；`fallback` 时回退常驻基线；未读声明暴露排除理由 |
| 模板正文改动触发尺寸预算失败 | DD8：细则下沉 references；改后跑 `skill-size-budget.test.ts` |
| 一致性门豁免被滥用（全部声明为不需要读） | 声明必须给理由；`always` 层恒读且不可跳过；报告逐条列出 `rulesSkipped` 供审计 |
| 存量项目 `config.yaml` 的 `rules:` 与磁盘不一致 | BS4：以枚举结果为准并 WARN（不依赖 `rules:` 列表做筛选） |
| 7 个模板同时改动，回归面大 | 分阶段实施：先内核 + CLI（含测试），再模板，再一致性门；每阶段跑相关测试 |

## 评估记录

| 评估对象 | 结论 | 依据 |
| :--- | :--- | :--- |
| `RULE_FILE_NAMES` 映射内容 | **不改** | 类型→文件名契约稳定；本变更只新增消费方 |
| `phases` 现有语义 | **不改** | 只新增 `scope` 维度，`phases` 判定规则原样复用 |
| `skills-not-read` / `skills-incomplete` 口径 | **不改** | 仅新增 `skillsSkipped` 豁免通道 |
| 规则源枚举范围（4 类） | **不改** | D3 只决定「读哪些」，不改变「枚举哪些」 |
| 90% 阈值 / 维度编号 / 门白名单 | **不改** | 本变更不触碰验证评分与门结构 |

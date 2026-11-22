# Tasks: improve-dynamic-rule-loading

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档 -->

> 流程基准：`exploration.md` §功能流程图 N1-N11（已确认）。

## 1. 规则选择内核（rule-selection.ts）

- [x] 1.1 [代码] 新建 `src/core/rule-selection.ts`：`classifyRuleSources(sources, options)` 纯函数，把规则源分为 `always` / `phase` / `on-demand` 三层；`always` 集 = config / `CLAUDE.md` / `AGENTS.md`，`phase` 集按 `ruleFileNameFor(type)` 判定 [N3][N4][N5]
  - 文件：`src/core/rule-selection.ts`
  - 验证：无 I/O；可用纯对象构造单测
  - Spec Ref：rule-selection / 规则源三层归类

- [x] 1.2 [代码] 在 `rule-selection.ts` 实现 `selectSkillEntries(entries, { phase, scope })`：`phase` 复用既有 design/implement/both 语义；`scope` 为可选过滤，`null` 条目不排除 [N5]
  - 文件：`src/core/rule-selection.ts`
  - 验证：按阶段 / 范围筛选结果正确
  - Spec Ref：rule-selection / 技能条目按阶段与范围筛选

- [x] 1.3 [代码] 在 `rule-selection.ts` 实现 fallback：`phase` 层为空时返回 `always` 集 + `fallback: true` + 原因，MUST NOT 回退全量 [N5]
  - 文件：`src/core/rule-selection.ts`
  - 验证：无匹配类型时 `fallback=true` 且不含 `on-demand`
  - Spec Ref：rule-selection / 筛选为空时回退常驻基线

- [x] 1.4 [测试][单元][P0] 三层归类单测：常驻基线恒含 / 类型映射走单一源 / 常驻不落入 phase 或 on-demand [N3]
  - 文件：`test/rule-selection.test.ts`
  - 验证：`pnpm test test/rule-selection.test.ts` 全绿
  - Spec Ref：rule-selection / 规则源三层归类
  - Scenario Ref：rule-selection / 规则源三层归类 / 按技能类型归类
  - Scenario Ref：rule-selection / 规则源三层归类 / 类型映射走单一源
  - Scenario Ref：rule-selection / 规则源三层归类 / 常驻基线不受类型影响

- [x] 1.5 [测试][单元][P0] 技能筛选与 fallback 单测：按阶段 / 按范围 / `scope: null` 不排除 / 空集回退且不扩为全量 [N5]
  - 文件：`test/rule-selection.test.ts`
  - 验证：四类情形断言通过
  - Spec Ref：rule-selection / 技能条目按阶段与范围筛选
  - Scenario Ref：rule-selection / 技能条目按阶段与范围筛选 / 按阶段筛选
  - Scenario Ref：rule-selection / 技能条目按阶段与范围筛选 / 按范围筛选
  - Scenario Ref：rule-selection / 技能条目按阶段与范围筛选 / 存量技能无 scope 字段
  - Spec Ref：rule-selection / 筛选为空时回退常驻基线
  - Scenario Ref：rule-selection / 筛选为空时回退常驻基线 / 无匹配规则文件
  - Scenario Ref：rule-selection / 筛选为空时回退常驻基线 / 回退不扩大为全量

## 2. CLI 筛选参数（rules / skills）

- [x] 2.1 [代码] `src/commands/rules.ts` 新增 `--type <id[,id...]>`：命中 `ruleFileNameFor` 的规则文件入结果，常驻基线恒含；未知 type 非零退出并列出合法值 [N2]
  - 文件：`src/commands/rules.ts`
  - 验证：`iagent rules --json --type test` 只含常驻基线 + testing-rules
  - Spec Ref：rule-loading-cli / rules 命令按类型筛选

- [x] 2.2 [代码] `src/commands/skills.ts` 新增 `--phase <design|implement>` 与 `--scope <backend|frontend>`：复用 `selectSkillEntries`；未知 phase 非零退出 [N2]
  - 文件：`src/commands/skills.ts`
  - 验证：`--phase implement` / `--scope backend` 结果正确
  - Spec Ref：rule-loading-cli / skills 命令按阶段与范围筛选

- [x] 2.3 [代码] `src/commands/completion.ts` 的 `IAGENT_COMMANDS` 表同步新增参数 [N2]
  - 文件：`src/commands/completion.ts`
  - 验证：补全脚本含 `--type` / `--phase` / `--scope`
  - Spec Ref：rule-loading-cli / 新增参数同步补全表

- [x] 2.4 [测试][单元][P0] rules CLI 单测：按类型 / 多类型 / 无参输出不变 / 未知类型报错 [N2]
  - 文件：`test/rules-command.test.ts`
  - 验证：四类断言通过
  - Spec Ref：rule-loading-cli / rules 命令按类型筛选
  - Scenario Ref：rule-loading-cli / rules 命令按类型筛选 / 按类型筛选
  - Scenario Ref：rule-loading-cli / rules 命令按类型筛选 / 多个类型
  - Scenario Ref：rule-loading-cli / rules 命令按类型筛选 / 无参输出不变
  - Scenario Ref：rule-loading-cli / rules 命令按类型筛选 / 未知类型报错

- [x] 2.5 [测试][单元][P0] skills CLI 单测：按阶段 / 按范围 / 无参输出不变 / 未知阶段报错 [N2]
  - 文件：`test/skills-command.test.ts`
  - 验证：四类断言通过
  - Spec Ref：rule-loading-cli / skills 命令按阶段与范围筛选
  - Scenario Ref：rule-loading-cli / skills 命令按阶段与范围筛选 / 按阶段筛选
  - Scenario Ref：rule-loading-cli / skills 命令按阶段与范围筛选 / 按范围筛选
  - Scenario Ref：rule-loading-cli / skills 命令按阶段与范围筛选 / 无参输出不变
  - Scenario Ref：rule-loading-cli / skills 命令按阶段与范围筛选 / 未知阶段报错

- [x] 2.6 [测试][单元][P1] 补全表覆盖新参数 [N2]
  - 文件：`test/completion-config.test.ts`
  - 验证：断言补全脚本含三参数
  - Spec Ref：rule-loading-cli / 新增参数同步补全表
  - Scenario Ref：rule-loading-cli / 新增参数同步补全表 / 补全覆盖新参数

## 3. 三层读取契约写入技能正文

- [x] 3.1 [代码] `spec-explore.ts` 的 1.1.1 / 1.1.1.5 改为三层读取 + 未读声明（相关性/读取/理由列）；细则下沉 `references/` 守尺寸预算 [N1][N4][N5][N6][N7][N8][N9]
  - 文件：`src/core/templates/workflows/spec-explore.ts`（+ `references/dynamic-rule-loading.md`）
  - 验证：生成正文含三层定义与未读声明列；尺寸预算通过
  - Spec Ref：rule-loading-contract / 技能正文三层读取契约

- [x] 3.2 [代码] `debug.ts` 的 2.1.6 / 2.1.7 改为三层读取（细则下沉 references） [N1][N4][N5][N8]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：生成正文含三层与未读声明；尺寸预算通过
  - Spec Ref：rule-loading-contract / 技能正文三层读取契约

- [x] 3.3 [代码] `spec-apply.ts` 实现前基线改为三层读取 + 回执 `skillsSkipped` [N4][N5][N8]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：正文含三层与 `skillsSkipped`
  - Spec Ref：rule-loading-contract / 技能正文三层读取契约

- [x] 3.4 [代码] `spec-verify.ts` / `review.ts` / `proposal-review.ts` 规则基线改为三层读取 [N4][N5][N8]
  - 文件：`src/core/templates/workflows/spec-verify.ts` / `review.ts` / `proposal-review.ts`
  - 验证：三处正文含三层定义
  - Spec Ref：rule-loading-contract / 技能正文三层读取契约

- [x] 3.5 [代码] `spec-propose.ts` 的 handoff `## 规范要点` 改为按相关性分层蒸馏 + 指针保留；旧「MUST NOT 只蒸馏 coding-rules.md」改为「MUST NOT 静默丢弃任一存在源」 [N10]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文含分层蒸馏与指针规则
  - Spec Ref：rule-loading-contract / handoff 规范要点按相关性分层蒸馏

- [x] 3.6 [代码] `test.ts` 的既有最佳实践保持并标注为三层契约范式（不改读取范围） [N4]
  - 文件：`src/core/templates/workflows/test.ts`
  - 验证：仍只读 `testing-rules.md`
  - Spec Ref：rule-loading-contract / 技能正文三层读取契约

- [x] 3.7 [测试][单元][P0] 模板三层契约单测：各技能正文含三层定义、未读声明列、`skillsSkipped`；`test.ts` 未退化 [N8]
  - 文件：`test/rule-loading-contract.test.ts`
  - 验证：断言各模板文本
  - Scenario Ref：rule-loading-contract / 技能正文三层读取契约 / 探索阶段按层读取
  - Scenario Ref：rule-loading-contract / 技能正文三层读取契约 / 审查阶段按层读取
  - Spec Ref：rule-loading-contract / 未读声明
  - Scenario Ref：rule-loading-contract / 未读声明 / 逐源声明
  - Scenario Ref：rule-loading-contract / 未读声明 / 漏读被判定
  - Scenario Ref：rule-loading-contract / 未读声明 / 显式不需要读不 fail

- [x] 3.8 [测试][单元][P0] handoff 分层蒸馏单测：分层要点 + 指针 + 不丢弃任何存在源 [N10]
  - 文件：`test/rule-loading-contract.test.ts`
  - 验证：断言 propose 正文文本
  - Spec Ref：rule-loading-contract / handoff 规范要点按相关性分层蒸馏
  - Scenario Ref：rule-loading-contract / handoff 规范要点按相关性分层蒸馏 / 分层蒸馏
  - Scenario Ref：rule-loading-contract / handoff 规范要点按相关性分层蒸馏 / 不丢弃任何存在源

## 4. 一致性门豁免声明

- [x] 4.1 [代码] `conformance.ts` 的 `ConformanceOptions.rules` 增加可选 `skip`，命中 `skip` 的源不报 `rules-not-read`；不传时行为不变 [N11]
  - 文件：`src/core/spec/validation/conformance.ts`
  - 验证：skip 内源不 fail；未声明且未读仍 fail
  - Spec Ref：rule-baseline / handoff 多源规范要点与 rulesRead 完整性

- [x] 4.2 [代码] `src/commands/spec.ts` 的 `conformance` 命令新增 `--rules-skip <paths>` 透传 [N11]
  - 文件：`src/commands/spec.ts`
  - 验证：`--rules-skip` 生效；不传时不变
  - Spec Ref：rule-baseline / handoff 多源规范要点与 rulesRead 完整性

- [x] 4.3 [测试][单元][P0] 豁免声明单测：声明跳过不 fail / 未声明未读仍 fail / 不传 skip 行为不变 [N11]
  - 文件：`test/spec-conformance.test.ts`
  - 验证：三类断言通过
  - Spec Ref：rule-baseline / handoff 多源规范要点与 rulesRead 完整性
  - Scenario Ref：rule-baseline / handoff 多源规范要点与 rulesRead 完整性 / 多源规范要点
  - Scenario Ref：rule-baseline / handoff 多源规范要点与 rulesRead 完整性 / 规则未读导致一致性门失败
  - Scenario Ref：rule-baseline / handoff 多源规范要点与 rulesRead 完整性 / 声明跳过不判失败

- [x] 4.4 [测试][单元][P1] rule-baseline 探索阶段三层读取单测：逐源相关性层级 + 全部源缺失记「无规则源」不阻断 [N4][N8]
  - 文件：`test/rule-loading-contract.test.ts`
  - 验证：两类断言通过
  - Spec Ref：rule-baseline / 探索阶段规则基线
  - Scenario Ref：rule-baseline / 探索阶段规则基线 / 探索起点建立规则基线
  - Scenario Ref：rule-baseline / 探索阶段规则基线 / 全部规则源缺失

- [x] 4.5 [测试][单元][P1] 技能消费范围筛选与跳过声明单测：建立基线 / 无技能配置 / 读取失败计未读 / 实现前读取技能 [N11]
  - 文件：`test/project-skills.test.ts`
  - 验证：`--scope` 收窄、`scope: null` 保留
  - Spec Ref：project-skill-consumption / 探索起点技能基线
  - Scenario Ref：project-skill-consumption / 探索起点技能基线 / 建立技能基线
  - Scenario Ref：project-skill-consumption / 探索起点技能基线 / 无技能配置
  - Scenario Ref：project-skill-consumption / 探索起点技能基线 / 读取失败计未读
  - Scenario Ref：project-skill-consumption / 探索起点技能基线 / 范围可判定时收窄
  - Spec Ref：project-skill-consumption / 实现消费与回执
  - Scenario Ref：project-skill-consumption / 实现消费与回执 / 实现前读取技能
  - Scenario Ref：project-skill-consumption / 实现消费与回执 / 声明跳过不判失败

## 5. 文档同步与全量回归

- [x] 5.1 [代码] 更新 `openspec/CONTEXT.md`：新增「动态加载 / 读取层级 / 未读声明 / 范围筛选」四条术语（写前先读，同名冲突显式裁决）
  - 文件：`openspec/CONTEXT.md`
  - 验证：四条术语存在且与探索术语表一致
  - Spec Ref：rule-loading-contract / 技能正文三层读取契约

- [x] 5.2 [使用说明] 更新 `AGENTS.md`：仓库地图新增 `rule-selection.ts`；修改守则新增动态加载单一源说明
  - 产出：`AGENTS.md`
  - 验证：含新模块与守则条目
  - Spec Ref：rule-loading-contract / 技能正文三层读取契约

- [x] 5.3 [测试][单元][P0] 快照与尺寸回归：`pnpm build && pnpm generate:skills` 后跑 parity / size-budget / template-consistency
  - 文件：`test/skills-parity.test.ts` / `test/skill-size-budget.test.ts` / `test/template-consistency.test.ts`
  - 验证：三个测试文件全绿
  - Spec Ref：rule-loading-contract / 技能正文三层读取契约
  - Scenario Ref：rule-loading-contract / 技能正文三层读取契约 / 既有最佳实践保持

### Caller Updates

| 影响模块 | 承接任务 |
| :--- | :--- |
| `src/core/project-config.ts`（`RULE_FILE_NAMES` / `ruleFileNameFor`） | 1.1（只消费，零改动） |
| `src/core/project-skills.ts`（`phases` / `scope`） | 1.2（只消费，零改动） |
| `src/commands/rules.ts` | 2.1 |
| `src/commands/skills.ts` | 2.2 |
| `src/commands/completion.ts` | 2.3 |
| `src/core/spec/validation/conformance.ts` | 4.1 |
| `src/commands/spec.ts` | 4.2 |
| `src/core/templates/workflows/spec-explore.ts` | 3.1 |
| `src/core/templates/workflows/debug.ts` | 3.2 |
| `src/core/templates/workflows/spec-apply.ts` | 3.3 |
| `src/core/templates/workflows/spec-verify.ts` / `review.ts` / `proposal-review.ts` | 3.4 |
| `src/core/templates/workflows/spec-propose.ts` | 3.5 |
| `src/core/templates/workflows/test.ts` | 3.6 |
| `openspec/CONTEXT.md` / `AGENTS.md` | 5.1 / 5.2 |

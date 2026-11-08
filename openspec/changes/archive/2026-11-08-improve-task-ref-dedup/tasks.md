# Tasks: improve-task-ref-dedup

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/）
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]
     补充文档类（非 [代码]/[测试]）MUST 含 `产出:` 字段指定输出路径 -->

## 1. 追溯引用补全实现

- [x] 1.1 [代码] 新增引用补全模块 `reference-resolver.ts`，实现叶子名判定与同任务 Spec Ref 补全 [N3][N4]
  - 文件：`src/core/spec/parser/reference-resolver.ts`
  - 验证：`pnpm test test/spec-artifact-parser.test.ts`
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：场景叶子名由同任务 Spec Ref 补全
  - Scenario Ref：同一任务多场景各自补全
  - Scenario Ref：引用值含分隔符视为全路径

- [x] 1.2 [代码] `buildTraceability` 接入补全结果，移除「裸场景名全局相等」兜底匹配 [N5][N6][N7]
  - 文件：`src/core/spec/validation/traceability.ts`
  - 验证：`pnpm test test/spec-artifact-parser.test.ts`
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：叶子名不得跨 Requirement 匹配
  - Scenario Ref：跨 capability 同名场景按 Spec Ref 绑定

- [x] 1.3 [代码] 新增 `scenario-ref-missing-context` / `ambiguous-scenario-ref` 诊断与 `--partial` 降级 [N8]
  - 文件：`src/core/spec/validation/traceability.ts`
  - 验证：`pnpm test test/spec-artifact-parser.test.ts`
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：叶子名缺少上下文报诊断
  - Scenario Ref：多条 Spec Ref 叶子名报歧义

- [x] 1.4 [代码] 保证混合写法（全路径 + 叶子名）覆盖计数只算一次 [N7]
  - 文件：`src/core/spec/validation/traceability.ts`
  - 验证：`pnpm test test/spec-artifact-parser.test.ts`
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：混合写法覆盖计数一次

## 2. 模板与技能正文

- [x] 2.1 [代码] 更新 `TASKS_TEMPLATE` 规范形态为「Spec Ref 两段 + Scenario Ref 叶子名」 [N1]
  - 文件：`src/core/spec/templates/index.ts`
  - 验证：`pnpm test test/spec-commands.test.ts`
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：tasks.md 使用场景叶子名形态
  - Scenario Ref：propose 为每个 Scenario 生成关联任务
  - Scenario Ref：不可测 Scenario 留痕

- [x] 2.2 [代码] 更新 `spec-propose` 正文追溯规范形态与上下文缺失 / 歧义诊断说明 [N1]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：`pnpm test test/templates.test.ts`
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：propose 模板声明上下文缺失与歧义诊断

- [x] 2.3 [代码] 更新 `spec-verify-proposal` D3 规范引用形态为叶子名口径 [N9]
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 验证：`pnpm test test/templates.test.ts`
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：D3 按规范形态匹配
  - Scenario Ref：仅 capability 引用不计为覆盖

- [x] 2.4 [使用说明] 核对 `openspec/CONTEXT.md` 的 Spec Ref / Scenario Ref / 场景叶子名 / 引用上下文补全术语
  - 产出: openspec/CONTEXT.md
  - 验证：术语条目与解析器口径一致
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：tasks.md 使用场景叶子名形态

## 3. 测试

- [x] 3.1 [测试][单元][P0] 补全模块与跨边界匹配：叶子名补全、多场景、分隔符、跨 Requirement / capability [N3][N4][N5]
  - 文件：`test/spec-artifact-parser.test.ts`
  - 验证：断言补全后的全路径与匹配结果，失败样例不得跨 Requirement / capability
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：场景叶子名由同任务 Spec Ref 补全
  - Scenario Ref：同一任务多场景各自补全
  - Scenario Ref：引用值含分隔符视为全路径
  - Scenario Ref：叶子名不得跨 Requirement 匹配
  - Scenario Ref：跨 capability 同名场景按 Spec Ref 绑定

- [x] 3.2 [测试][单元][P0] 诊断分层与起草期降级：缺少上下文、歧义、覆盖计数、pending-ref [N7][N8]
  - 文件：`test/spec-artifact-parser.test.ts`
  - 验证：严格模式为 error，`--partial` 为 pending-ref warning
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：叶子名缺少上下文报诊断
  - Scenario Ref：多条 Spec Ref 叶子名报歧义
  - Scenario Ref：混合写法覆盖计数一次
  - Scenario Ref：起草期未匹配引用降级 pending-ref

- [x] 3.3 [测试][单元][P1] 历史兼容回归：全路径 / 裸名 / HTML 注释 / 一行双引用 / capability-only / 只到 Requirement [N2][N5]
  - 文件：`test/spec-artifact-parser.test.ts`
  - 验证：历史写法匹配成功且不产生新 error
  - Spec Ref：artifact-markdown-source / Tasks maintain explicit traceability to requirements
  - Scenario Ref：历史全路径与裸名引用保持兼容
  - Scenario Ref：HTML 注释式与一行双引用等价
  - Scenario Ref：仅 capability 的 Spec Ref 报缺失 Requirement
  - Scenario Ref：Scenario Ref 只到 Requirement 报缺失 Scenario
  - Scenario Ref：有效规格引用
  - Scenario Ref：失效规格引用

- [x] 3.4 [测试][单元][P0] `TASKS_TEMPLATE` 新形态断言与占位填充后可解析 [N1]
  - 文件：`test/spec-commands.test.ts`
  - 验证：模板含新两段式与叶子名示例，填占位后 strict 校验无 invalid 引用
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：tasks.md 使用场景叶子名形态
  - Scenario Ref：不可测 Scenario 留痕

- [x] 3.5 [测试][单元][P1] 技能正文口径断言：D3 规范形态、capability-only 反例、上下文缺失 / 歧义说明 [N9]
  - 文件：`test/templates.test.ts`
  - 验证：正文含叶子名形态与两类诊断关键词
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：D3 按规范形态匹配
  - Scenario Ref：仅 capability 引用不计为覆盖
  - Scenario Ref：propose 模板声明上下文缺失与歧义诊断

- [x] 3.6 [测试][单元][P1] 格式真源单点：`workflow` / `auto-workflow` / `debug` 正文未新增第二份格式声明
  - 文件：`test/templates.test.ts`
  - 验证：三个编排技能正文不重复声明追溯规范形态
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：格式真源单点

## 4. 校验收尾

- [x] 4.1 [代码] 依次运行 `pnpm build && pnpm generate:skills` 刷新技能快照 [N1]
  - 文件：`skills/**/SKILL.md`
  - 验证：`pnpm test test/skills-parity.test.ts`
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：tasks.md 使用场景叶子名形态

- [x] 4.2 [测试][功能][P1] 运行全量测试与 strict `iagent spec validate` 收尾 [N8][N10]
  - 文件：`test/`
  - 验证：`pnpm test` 全绿且 `node bin/iagent.js spec validate --change improve-task-ref-dedup` 无 error
  - Spec Ref：spec-workflow-skills / Spec-to-task traceability is mandatory
  - Scenario Ref：D3 按规范形态匹配

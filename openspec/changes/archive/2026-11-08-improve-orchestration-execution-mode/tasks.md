# Tasks: improve-orchestration-execution-mode

<!-- 任务类型标签：[代码] / [测试][单元|功能][P0|P1|P2] / [DB脚本] / [使用说明] -->
<!-- 追溯引用规范形态：Spec Ref = capability / Requirement；Scenario Ref = capability / Requirement / Scenario -->

> **实现顺序**：先完成第 1、2 组（协议字段与推进校验，是其余模板与测试的依赖），再第 4 组（fingerprint CLI，模板引用依赖），随后第 3 / 5 组模板正文，最后第 6 组快照与回归。第 2.3 组与第 5 组可并行起草。

## 1. 协议字段与回执校验

- [x] 1.1 [代码] 在 `protocol.ts` 新增执行方式与独立性取值域常量（`EXECUTION_MODES` / `INDEPENDENCE_VALUES`）与类型，扩展 `Receipt`：`executionMode?` / `independence?` / `usage?`（`tokens` / `toolCalls` / `durationMs`）/ `readScope?` / `dependsOn?` / `contextReplay?`
  - 文件：`src/core/host-orchestration/protocol.ts`
  - 验证：类型与常量可被 `index.ts` 导入；`DEFAULT_RECEIPT_FIELDS` 保持不变
  - Spec Ref：host-orchestration / Receipt execution and data-sharing fields
  - Scenario Ref：host-orchestration / Receipt execution and data-sharing fields / 合法扩展字段通过校验

- [x] 1.2 [代码] 扩展 `validateReceipt`：字段出现时校验 `executionMode` / `independence` 取值域、`usage` 非负数值、`readScope` / `dependsOn` 非空字符串数组、`contextReplay` 布尔；非法值返回 `invalid-receipt` 原因；字段缺失保持旧产物兼容（是否必需由阶段规格决定）
  - 文件：`src/core/host-orchestration/protocol.ts`
  - 验证：非法 `executionMode=agent`、负 `usage.tokens`、空串数组元素均返回 invalid；旧回执（仅四字段 + status=ok）仍 valid；`usage` 未知键不导致校验失败且不被消费
  - Spec Ref：host-orchestration / Receipt execution and data-sharing fields
  - Scenario Ref：host-orchestration / Receipt execution and data-sharing fields / 非法执行方式被阻断

- [x] 1.3 [测试][单元][P0] 回执扩展字段校验：合法字段通过、非法取值域被阻断、旧产物缺字段的 fail-safe 行为
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：host-orchestration / Receipt execution and data-sharing fields
  - Scenario Ref：host-orchestration / Receipt execution and data-sharing fields / 合法扩展字段通过校验
  - Scenario Ref：host-orchestration / Receipt execution and data-sharing fields / 非法执行方式被阻断
  - Scenario Ref：host-orchestration / Receipt execution and data-sharing fields / 旧产物缺失新字段

- [x] 1.4 [测试][单元][P1] `usage` 缺失时回执仍合法且不允许编造（校验器不补默认值）
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：host-orchestration / Receipt execution and data-sharing fields
  - Scenario Ref：host-orchestration / Receipt execution and data-sharing fields / usage 不可得时省略

## 2. 阶段推进执行方式校验

- [x] 2.1 [代码] 在 `transition.ts` 增加执行方式检查：strict 变更类阶段要求 `executionMode=subagent`（否则 `invalid-receipt`）；按 `execution.independence` 映射处理（`required` / `self-allowed` 下 `self` 均记 WARN，`required` 下不视为合规）；degraded 非 `local-degraded` 记 WARN 按不实声明处理；`contextReplay=true` 记 WARN
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：四类输入分别得到 advance=false / WARN / WARN / WARN，且既有能力与门检查行为不变
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 变更类阶段内联被阻断

- [x] 2.2 [代码] 在 `protocol.ts` 为 `PhaseSpec` 增加 `execution?: { allowed: ExecutionMode[]; independence?: 'required' | 'self-allowed' }`；在 `workflows.ts` 按阶段职责声明：explore / debug investigate / debug verify-close 允许 inline；propose / apply / archive / debug fix 要求 subagent；verify 系列默认 subagent 且允许 inline；`iagent_test` 作为 apply / fix 子阶段由模板约束，**不新增顶层 test 阶段**；degraded 由协商层统一推导
  - 文件：`src/core/host-orchestration/workflows.ts`、`src/core/host-orchestration/protocol.ts`
  - 验证：协议声明可被 `evaluatePhaseTransition` 读取；`execution.independence` 的 `required` / `self-allowed` / 缺省映射可判定；`verify` 阶段声明 `required`；inline 阶段 `requiredCapabilities` 不含 `delegate`；门白名单与既有阶段顺序不变；不存在顶层 `test` 阶段
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 变更类阶段必须委派
  - Scenario Ref：host-orchestration / Stage execution mode contract / 交互与收束阶段内联
  - Scenario Ref：host-orchestration / Stage execution mode contract / test 是子阶段而非顶层阶段
  - Scenario Ref：host-orchestration / Stage execution mode contract / 阶段规格缺省不校验执行方式
  - Scenario Ref：host-orchestration / Stage execution mode contract / verify 阶段独立性为 required

- [x] 2.3 [代码] 在 `index.ts` 导出新增类型、常量与校验所需接口（保持既有导出不破坏）
  - 文件：`src/core/host-orchestration/index.ts`
  - 验证：`pnpm build` 通过；既有导入方无需改动
  - Spec Ref：host-orchestration / Receipt execution and data-sharing fields
  - Scenario Ref：host-orchestration / Receipt execution and data-sharing fields / 合法扩展字段通过校验

- [x] 2.4 [测试][单元][P0] 阶段推进执行方式：变更类内联阻断、只读验证自证 WARN、degraded 不实声明 WARN、resume 复验 WARN
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：host-orchestration / Phase transition validates execution mode
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 变更类阶段内联被阻断
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 只读验证自证记 WARN 但可推进
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / degraded 不得声称子代理
  - Scenario Ref：host-orchestration / Phase transition validates execution mode / 复验使用 resume 记 WARN

- [x] 2.5 [测试][单元][P0] 分级执行契约：strict 缺 `delegate` 阻断变更类阶段、inline 阶段不要求 delegate、探索内联、只读验证非作者约束（`self` 记 WARN）、degraded 统一 `local-degraded`
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts`
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / 探索阶段内联
  - Scenario Ref：host-orchestration / Stage execution mode contract / 变更类阶段必须委派
  - Scenario Ref：host-orchestration / Stage execution mode contract / 只读验证允许内联但受非作者约束
  - Scenario Ref：host-orchestration / Stage execution mode contract / 内联阶段不要求 delegate 能力
  - Scenario Ref：host-orchestration / Stage execution mode contract / degraded 宿主统一本地执行
  - Scenario Ref：host-orchestration / Stage execution mode contract / strict 缺少委派能力时阻断

## 3. 分级执行与增量复验契约渲染

- [x] 3.1 [代码] 在 `render.ts` 的宿主编排段注入分级执行契约（章节执行方式表 / 内联验证非作者约束 / degraded 覆盖声明）与增量复验契约（fixDiff + reportPath、禁止 resume 复验、`contextReplay` WARN）
  - 文件：`src/core/host-orchestration/render.ts`
  - 验证：strict 段含分级执行与增量复验关键字；degraded 段声明 `local-degraded` 且禁止声称子代理
  - Spec Ref：host-orchestration / Stage execution mode contract
  - Scenario Ref：host-orchestration / Stage execution mode contract / degraded 宿主统一本地执行

- [x] 3.2 [测试][单元][P1] 渲染段keyword断言：分级执行表、内联非作者约束、增量复验、degraded 覆盖声明
  - 文件：`test/claude-host-adapter.test.ts`
  - 验证：`pnpm vitest run test/claude-host-adapter.test.ts`
  - Spec Ref：host-orchestration / Incremental re-verification contract
  - Scenario Ref：host-orchestration / Incremental re-verification contract / 修复后新开增量复验代理

## 4. fingerprint CLI 与补全

- [x] 4.1 [代码] 在 `src/core/spec/fingerprint.ts` 实现指纹算法单一源：文件集合枚举（proposal / design? / specs/**/*.md / tasks）、每文件 sha256、相对路径正斜杠、字典序排序、**单换行连接且末尾无换行**、取前 16 位；同时产出 `artifacts[]`（path / size / sha256）
  - 文件：`src/core/spec/fingerprint.ts`
  - 验证：同一变更两次复算一致；改动任一文件后指纹变化；与 handoff 包算法文本一致；显式修正旧参考脚本「每行含末尾 `\n`」的偏差，并在测试中固定「末尾无换行」fixture
  - Spec Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹
  - Scenario Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹 / 复算与 handoff 包一致

- [x] 4.2 [代码] 在 `src/commands/spec.ts` 注册 `fingerprint` 子命令（`--change <name>` 必填、`--json`），文本模式仅打印 `sha256:<16 位>` 一行，变更不存在或无制品时非零退出并输出诊断
  - 文件：`src/commands/spec.ts`、`src/cli/index.ts`
  - 验证：`node bin/iagent.js spec fingerprint --change <name>` 与 `--json` 输出符合规格；不存在变更退出码非零
  - Spec Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹
  - Scenario Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹 / 文本与 JSON 输出

- [x] 4.3 [代码] 在 `completion.ts` 的 `IAGENT_COMMANDS` 的 `spec` 条目补 `fingerprint` 子命令并更新描述字符串
  - 文件：`src/commands/completion.ts`
  - 验证：生成的 bash / powershell 补全二级候选含 `fingerprint`，描述不再声称旧集合
  - Spec Ref：spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令
  - Scenario Ref：spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令 / 补全表含 migrate、validate 与 fingerprint

- [x] 4.4 [测试][单元][P0] 指纹算法：固定 fixture 断言「排序 + 单换行 + 末尾无换行」、文件变更后指纹变化、仅时间戳变化不影响
  - 文件：`test/spec-fingerprint.test.ts`（新建）
  - 验证：`pnpm vitest run test/spec-fingerprint.test.ts`
  - Spec Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹
  - Scenario Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹 / 复算与 handoff 包一致
  - Scenario Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹 / 制品变更后指纹变化
  - Scenario Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹 / 旧算法包首次复算不一致

- [x] 4.5 [测试][功能][P1] CLI 端到端：文本 / JSON 输出形状、变更不存在时非零退出、不写任何文件
  - 文件：`test/spec-commands.test.ts`
  - 验证：`pnpm build && pnpm vitest run test/spec-commands.test.ts`
  - Spec Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹
  - Scenario Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹 / 文本与 JSON 输出
  - Scenario Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹 / 变更不存在时失败

- [x] 4.6 [测试][单元][P1] 补全一致性：从 Commander 程序提取 `spec` 子命令集，断言 `IAGENT_COMMANDS` 相等并含 `fingerprint` 参数
  - 文件：`test/completion-config.test.ts`
  - 验证：`pnpm vitest run test/completion-config.test.ts`
  - Spec Ref：spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令
  - Scenario Ref：spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令 / 补全表由程序派生并受断言约束
  - Scenario Ref：spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令 / fingerprint 的参数补全可见
  - Scenario Ref：spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令 / 补全表不含已退役子命令

## 5. 模板正文

- [x] 5.1 [代码] `auto-workflow.ts`：声明分级执行（Phase 1 内联 / Phase 2、4、5 子代理 / Phase 3 验证默认子代理、可内联但须非作者约束）、增量复验（fixDiff + reportPath、禁止 resume）、验证串联 `dependsOn`（先 verify-proposal 后 proposal-review，**顺序执行不得并行**）、制品清单读取范围、`## 阶段结论` 记录 tokens
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文含分级执行表与增量复验关键字；MUST NOT 出现「内联执行变更类阶段」表述
  - Spec Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式
  - Scenario Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式 / auto-workflow 变更类阶段使用子代理

- [x] 5.2 [代码] `debug.ts`：investigate / verify-close 声明主代理 `inline`（验证 / 复查以嵌套子代理执行），fix 声明 `subagent` 且 `iagent_test` 子阶段经子代理；增量复验与读取范围、verification 段记录 tokens
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：investigate / verify-close 明确 `executionMode=inline`；fix 要求 `executionMode=subagent` 且禁止内联伪装；复验段含 fixDiff + reportPath
  - Spec Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式
  - Scenario Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式 / debug 修复阶段不得内联伪装
  - Scenario Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式 / debug 交互与收束阶段内联

- [x] 5.3 [代码] `workflow.ts`：Phase 1 内联、Phase 2 / 4 / 5 子代理、Phase 3 验证分级与串联、增量复验、制品清单读取范围
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文与协议阶段声明一致；无「是否调用某技能」类确认
  - Spec Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式
  - Scenario Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式 / 探索阶段内联

- [x] 5.4 [代码] `spec-propose.ts`：指纹来源改为「优先 `iagent spec fingerprint`，缺失回退 handoff 包并 WARN」；handoff 包在 `## 契约` 之后、`## 规范要点` 之前新增 `## 制品清单`（路径 / 大小 / sha256 / 章节锚点，不计入六节）；修正参考脚本为末尾无换行；`## 阶段结论` 表头扩为 `phase | status | artifact | nextAllowed | tokens`（不可得填 `—`）
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：模板含 `## 制品清单` 与 `iagent spec fingerprint`；参考脚本与 CLI 算法一致
  - Spec Ref：workflow-suite-skills / handoff 包制品清单与读取范围
  - Scenario Ref：workflow-suite-skills / handoff 包制品清单与读取范围 / 指纹优先走 CLI

- [x] 5.5 [代码] `spec-verify-proposal.ts` / `proposal-review.ts`：只读验证分级与内联三条件；proposal-review 串联读取 verify-proposal `reportPath` 并标 `dependsOn`，报告缺失退化独立复查并 WARN；回执写入 `readScope`
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`、`src/core/templates/workflows/proposal-review.ts`
  - 验证：两模板均含执行方式与 `readScope` 要求；proposal-review 含 `dependsOn` 与缺失回退分支
  - Spec Ref：workflow-suite-skills / 提案验证串联 proposal-review
  - Scenario Ref：workflow-suite-skills / 提案验证串联 proposal-review / 复查消费验证报告

- [x] 5.6 [代码] `spec-verify.ts` / `spec-apply.ts` / `spec-archive.ts`：只读验证分级与读取清单、复验 fixDiff、`## 阶段结论` tokens、指纹优先 CLI 的复算段
  - 文件：`src/core/templates/workflows/spec-verify.ts`、`src/core/templates/workflows/spec-apply.ts`、`src/core/templates/workflows/spec-archive.ts`
  - 验证：三模板含 `readScope` 与增量复验约束；不改变门账本与业务确认语义
  - Spec Ref：host-orchestration / Incremental re-verification contract
  - Scenario Ref：host-orchestration / Incremental re-verification contract / 复验只覆盖增量
  - Scenario Ref：host-orchestration / Incremental re-verification contract / resume 仅用于阶段续跑

- [x] 5.7 [代码] `requirement-doc.ts`：制品指纹来源改为「优先 `iagent spec fingerprint`，缺失回退 handoff 包，皆不可得写未提供」
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 验证：模板不再要求自行计算指纹；回退分支有 WARN / 未提供说明
  - Spec Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹
  - Scenario Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹 / 旧版本回退 handoff 包

- [x] 5.8 [测试][单元][P1] 模板关键词与结构断言：分级执行、增量复验、串联 `dependsOn`、制品清单、`readScope`、tokens 记录、无内联伪装表述
  - 文件：`test/stage-continuation.test.ts`、`test/spec-workflow-contract.test.ts`
  - 验证：`pnpm vitest run test/stage-continuation.test.ts test/spec-workflow-contract.test.ts`
  - Spec Ref：workflow-suite-skills / handoff 包制品清单与读取范围
  - Scenario Ref：workflow-suite-skills / handoff 包制品清单与读取范围 / 子代理先读清单再增量读取
  - Scenario Ref：workflow-suite-skills / handoff 包制品清单与读取范围 / 回执记录读取范围
  - Scenario Ref：workflow-suite-skills / handoff 包制品清单与读取范围 / 清单陈旧时重建
  - Scenario Ref：workflow-suite-skills / handoff 包制品清单与读取范围 / 制品清单不破坏六节与门账本解析

- [x] 5.9 [测试][单元][P1] 增量复验与串联：模板断言复验新开代理、residual 清单、resume 仅续跑、串联缺失回退、tokens 可用/不可用分支
  - 文件：`test/stage-continuation.test.ts`、`test/template-consistency.test.ts`
  - 验证：`pnpm vitest run test/stage-continuation.test.ts test/template-consistency.test.ts`
  - Spec Ref：workflow-suite-skills / 修复后增量复验
  - Scenario Ref：workflow-suite-skills / 修复后增量复验 / 复验新开代理
  - Scenario Ref：workflow-suite-skills / 修复后增量复验 / 增量范围与残留清单
  - Scenario Ref：workflow-suite-skills / 修复后增量复验 / 修复后重建 handoff 包
  - Scenario Ref：workflow-suite-skills / 修复后增量复验 / resume 只用于续跑
  - Scenario Ref：workflow-suite-skills / 提案验证串联 proposal-review / 报告缺失时独立复查
  - Scenario Ref：workflow-suite-skills / 提案验证串联 proposal-review / 双门职责不重叠
  - Scenario Ref：workflow-suite-skills / 阶段结论记录用量 / 可用时记录 tokens
  - Scenario Ref：workflow-suite-skills / 阶段结论记录用量 / 不可用时填 —

- [x] 5.10 [测试][单元][P2] 分级执行模板断言：内联三条件、degraded 显式本地执行、探索内联、验证默认子代理
  - 文件：`test/stage-continuation.test.ts`
  - 验证：`pnpm vitest run test/stage-continuation.test.ts`
  - Spec Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式
  - Scenario Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式 / 只读验证内联受非作者约束
  - Scenario Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式 / degraded 宿主显式本地执行

## 6. 快照与回归

- [x] 6.1 [代码] 模板变更后重新构建并生成技能快照
  - 文件：`skills/**`（生成产物）
  - 验证：`pnpm build && pnpm generate:skills`
  - Spec Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式
  - Scenario Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式 / auto-workflow 变更类阶段使用子代理

- [x] 6.2 [测试][单元][P1] 快照一致性：`skills/` 与模板源一致（skills-parity），生成产物体积与渐进披露预算不回归
  - 文件：`test/skills-parity.test.ts`、`test/skill-size-budget.test.ts`
  - 验证：`pnpm vitest run test/skills-parity.test.ts test/skill-size-budget.test.ts`
  - Spec Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式
  - Scenario Ref：workflow-suite-skills / 编排阶段按分级策略选择执行方式 / 探索阶段内联

- [x] 6.3 [测试][功能][P2] 全量回归：Markdown-first 回归锁、许可工具白名单、门预算与既有 CLI 行为不回归
  - 文件：`test/markdown-first-regression.test.ts`、`test/allowed-tools.test.ts`、`test/gate-ledger.test.ts`
  - 验证：`pnpm test`
  - Spec Ref：spec-workflow-cli / iagent spec fingerprint 复算制品指纹
  - Scenario Ref：spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令 / 补全表不含已退役子命令

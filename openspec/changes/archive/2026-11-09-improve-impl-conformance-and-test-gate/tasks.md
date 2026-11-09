# Tasks: improve-impl-conformance-and-test-gate

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]
     追溯引用规范形态：Spec Ref：<capability> / <Requirement>；Scenario Ref：<场景叶子名> -->

## 1. 一致性判定内核 [N9]

- [x] 1.1 [代码] 扩展追溯判定并新增三层一致性内核（Requirement/Scenario→任务、任务→产出证据、Scenario→测试任务）
  - 文件：`src/core/spec/validation/conformance.ts`、`src/core/spec/validation/traceability.ts`
  - 验证：`pnpm test -- test/spec-artifact-parser.test.ts`
  - Spec Ref：spec-conformance / 实现一致性三层判定
  - Scenario Ref：任务已勾选但缺少产出证据
  - Scenario Ref：Scenario 缺少测试任务
  - Scenario Ref：三层全部覆盖
  - Scenario Ref：缺少追溯引用不猜测
  - Scenario Ref：大变更矩阵分批

- [x] 1.2 [测试][单元][P0] 三层判定单元测试（缺产出证据 / 缺测试任务 / 全覆盖 / skip_specs / JSON 降级）
  - 文件：`test/spec-conformance.test.ts`
  - 验证：`pnpm test -- test/spec-conformance.test.ts`
  - Spec Ref：spec-conformance / 实现一致性三层判定
  - Scenario Ref：任务已勾选但缺少产出证据
  - Scenario Ref：Scenario 缺少测试任务
  - Scenario Ref：三层全部覆盖
  - Scenario Ref：缺少追溯引用不猜测
  - Scenario Ref：大变更矩阵分批

- [x] 1.3 [代码] 实现一致性证据契约（九列 + `**summary**:` 行 + 阶段结论追加）
  - 文件：`src/core/templates/workflows/spec-apply.ts`、`src/core/spec/validation/conformance.ts`
  - 验证：模板断言 + 证据模板测试
  - Spec Ref：spec-conformance / 实现一致性证据契约
  - Scenario Ref：apply 产出一致性证据
  - Scenario Ref：一致性失败阻断归档

- [x] 1.4 [测试][单元][P0] 一致性证据契约测试（列名 / 汇总行 / fail 阻断归档判定）
  - 文件：`test/spec-conformance.test.ts`
  - 验证：`pnpm test -- test/spec-conformance.test.ts`
  - Spec Ref：spec-conformance / 实现一致性证据契约
  - Scenario Ref：apply 产出一致性证据
  - Scenario Ref：一致性失败阻断归档

## 2. 一致性 CLI [N9]

- [x] 2.1 [代码] 新增 `iagent spec conformance --change <name> [--json] [--strict]` 子命令
  - 文件：`src/commands/spec.ts`、`src/core/spec/validation/conformance.ts`
  - 验证：`node bin/iagent.js spec conformance --change <name> --json`
  - Spec Ref：spec-conformance / iagent spec conformance 覆盖矩阵命令
  - Scenario Ref：JSON 覆盖矩阵输出
  - Scenario Ref：严格模式非零退出
  - Scenario Ref：skip_specs 变更不误报
  - Scenario Ref：历史 JSON-only 变更降级

- [x] 2.2 [测试][单元][P0] conformance 子命令测试（JSON 形状 / 退出码 / skip_specs）
  - 文件：`test/spec-commands.test.ts`、`test/markdown-spec-cli.test.ts`
  - 验证：`pnpm test -- test/spec-commands.test.ts test/markdown-spec-cli.test.ts`
  - Spec Ref：spec-conformance / iagent spec conformance 覆盖矩阵命令
  - Scenario Ref：JSON 覆盖矩阵输出
  - Scenario Ref：严格模式非零退出
  - Scenario Ref：skip_specs 变更不误报
  - Scenario Ref：历史 JSON-only 变更降级

- [x] 2.3 [代码] `iagent spec validate --conformance` 严格模式（默认 severity 不变）
  - 文件：`src/commands/spec.ts`、`src/core/spec/validation/artifact-validator.ts`
  - 验证：`node bin/iagent.js spec validate --change <name> --conformance`
  - Spec Ref：spec-conformance / iagent spec validate --conformance 严格模式
  - Scenario Ref：默认行为不变
  - Scenario Ref：严格模式升级为错误

- [x] 2.4 [测试][单元][P0] validate 严格模式测试（默认 warning / `--conformance` error）
  - 文件：`test/spec-commands.test.ts`
  - 验证：`pnpm test -- test/spec-commands.test.ts`
  - Spec Ref：spec-conformance / iagent spec validate --conformance 严格模式
  - Scenario Ref：默认行为不变
  - Scenario Ref：严格模式升级为错误

## 3. 测试证据与自动补测 [N7] [N8] [N9]

- [x] 3.1 [代码] 测试证据契约与 `testGate.autoGenerate` 配置（默认 true）
  - 文件：`src/core/project-config.ts`、`src/core/templates/workflows/spec-apply.ts`
  - 验证：`iagent config show` 显示生效值；证据模板断言
  - Spec Ref：test-evidence-gate / 测试证据文件契约
  - Scenario Ref：测试证据产出
  - Scenario Ref：无框架记不适用

- [x] 3.2 [测试][单元][P0] 测试证据契约测试（九列 / 汇总行 / not-applicable 占位）
  - 文件：`test/test-evidence-gate.test.ts`
  - 验证：`pnpm test -- test/test-evidence-gate.test.ts`
  - Spec Ref：test-evidence-gate / 测试证据文件契约
  - Scenario Ref：测试证据产出
  - Scenario Ref：无框架记不适用

- [x] 3.3 [代码] apply Step 8.11 自动单测补齐（先消费 `[测试]` 任务，只补缺口；不测清单留痕）
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：模板断言 + 手动执行一次补齐
  - Spec Ref：test-evidence-gate / 自动单测补齐
  - Scenario Ref：未规划 [测试] 任务时补齐
  - Scenario Ref：已覆盖文件不重复生成
  - Scenario Ref：不测清单留痕
  - Scenario Ref：项目无测试框架
  - Scenario Ref：iagent_test 不可用

- [x] 3.4 [测试][单元][P1] 自动补测模板断言（步骤存在 / 不测留痕 / 无框架降级 / 不静默改 tasks）
  - 文件：`test/test-evidence-gate.test.ts`
  - 验证：`pnpm test -- test/test-evidence-gate.test.ts`
  - Spec Ref：test-evidence-gate / 自动单测补齐
  - Scenario Ref：未规划 [测试] 任务时补齐
  - Scenario Ref：已覆盖文件不重复生成
  - Scenario Ref：不测清单留痕
  - Scenario Ref：项目无测试框架
  - Scenario Ref：iagent_test 不可用

- [x] 3.5 [代码] apply Step 9 写测试证据、Step 9.7 一致性门、Step 10 保留三类证据
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：模板断言 + 步骤顺序检查
  - Spec Ref：spec-workflow-skills / spec-apply 自动单测补齐与实现一致性门
  - Scenario Ref：补齐发生在测试门之前
  - Scenario Ref：一致性门失败暂停
  - Scenario Ref：证据文件保留

- [x] 3.6 [测试][单元][P0] apply 新门顺序与证据保留测试
  - 文件：`test/test-evidence-gate.test.ts`、`test/templates.test.ts`
  - 验证：`pnpm test -- test/test-evidence-gate.test.ts test/templates.test.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 自动单测补齐与实现一致性门
  - Scenario Ref：补齐发生在测试门之前
  - Scenario Ref：一致性门失败暂停
  - Scenario Ref：证据文件保留

## 4. 归档前置判定与编排消费 [N11]

- [x] 4.1 [代码] auto-workflow / workflow 归档前读取 `test-report.md` 与 `conformance-report.md` 汇总行
  - 文件：`src/core/templates/workflows/auto-workflow.ts`、`src/core/templates/workflows/workflow.ts`
  - 验证：模板断言汇总行解析与阻断语句
  - Spec Ref：test-evidence-gate / 测试门与归档前只读判定
  - Scenario Ref：证据放行
  - Scenario Ref：证据失败阻断

- [x] 4.2 [测试][功能][P1] 证据放行与阻断的编排测试
  - 文件：`test/test-evidence-gate.test.ts`
  - 验证：`pnpm test -- test/test-evidence-gate.test.ts`
  - Spec Ref：test-evidence-gate / 测试门与归档前只读判定
  - Scenario Ref：证据放行
  - Scenario Ref：证据失败阻断

- [x] 4.3 [代码] 编排技能消费规则基线 / 测试证据 / 一致性证据（不自行重跑命令）
  - 文件：`src/core/templates/workflows/auto-workflow.ts`、`src/core/templates/workflows/workflow.ts`
  - 验证：模板断言三证据读取与 fail 阻断
  - Spec Ref：workflow-suite-skills / 编排技能消费规则基线、测试证据与一致性证据
  - Scenario Ref：auto-workflow 归档前置三证据
  - Scenario Ref：证据缺失阻断

- [x] 4.4 [测试][功能][P1] 三证据归档判定测试
  - 文件：`test/test-evidence-gate.test.ts`、`test/stage-continuation.test.ts`
  - 验证：`pnpm test -- test/test-evidence-gate.test.ts test/stage-continuation.test.ts`
  - Spec Ref：workflow-suite-skills / 编排技能消费规则基线、测试证据与一致性证据
  - Scenario Ref：auto-workflow 归档前置三证据
  - Scenario Ref：证据缺失阻断

## 5. debug 测试与一致性收束 [N15] [N16]

- [x] 5.1 [代码] debug Phase 5.5 范围内测试执行 + Phase 7 一致性证据消费
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：模板断言 Phase 5.5 与 fail 回修语句
  - Spec Ref：workflow-suite-skills / debug 范围内测试执行与一致性收束
  - Scenario Ref：debug 测试证据
  - Scenario Ref：debug 一致性失败回修
  - Scenario Ref：归档来源调试新建变更

- [x] 5.2 [测试][功能][P1] debug 新阶段模板测试
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test -- test/templates.test.ts`
  - Spec Ref：workflow-suite-skills / debug 范围内测试执行与一致性收束
  - Scenario Ref：debug 测试证据
  - Scenario Ref：debug 一致性失败回修
  - Scenario Ref：归档来源调试新建变更

- [x] 5.3 [代码] debug 测试执行门与测试证据写入（复用 ≤3 修复预算）
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：模板断言测试证据与重试预算
  - Spec Ref：test-evidence-gate / debug 变更范围内测试执行
  - Scenario Ref：回归测试后运行范围内既有测试
  - Scenario Ref：范围内失败重试后暂停

- [x] 5.4 [测试][单元][P1] debug 测试门模板测试
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test -- test/templates.test.ts`
  - Spec Ref：test-evidence-gate / debug 变更范围内测试执行
  - Scenario Ref：回归测试后运行范围内既有测试
  - Scenario Ref：范围内失败重试后暂停

## 6. 规则基线 [N1]

- [x] 6.1 [代码] 新增 `iagent rules --json` 规则源枚举命令
  - 文件：`src/commands/rules.ts`、`src/cli/index.ts`、`src/commands/completion.ts`、`src/core/project-config.ts`
  - 验证：`node bin/iagent.js rules --json`
  - Spec Ref：rule-baseline / 规则源枚举命令
  - Scenario Ref：枚举存在的规则源
  - Scenario Ref：规则源缺失
  - Scenario Ref：不枚举 openspec 规则目录

- [x] 6.2 [测试][单元][P0] 规则源枚举测试（存在性 / sha256 / 排除 openspec/rules）
  - 文件：`test/rules-command.test.ts`
  - 验证：`pnpm test -- test/rules-command.test.ts`
  - Spec Ref：rule-baseline / 规则源枚举命令
  - Scenario Ref：枚举存在的规则源
  - Scenario Ref：规则源缺失
  - Scenario Ref：不枚举 openspec 规则目录

- [x] 6.3 [代码] 探索/排查起点建立 `## 项目规则基线`
  - 文件：`src/core/templates/workflows/spec-explore.ts`、`src/core/templates/workflows/debug.ts`
  - 验证：模板断言规则基线检查点
  - Spec Ref：rule-baseline / 探索阶段规则基线
  - Scenario Ref：探索起点建立规则基线
  - Scenario Ref：全部规则源缺失

- [x] 6.4 [测试][单元][P1] 规则基线模板测试
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test -- test/templates.test.ts`
  - Spec Ref：rule-baseline / 探索阶段规则基线
  - Scenario Ref：探索起点建立规则基线
  - Scenario Ref：全部规则源缺失

- [x] 6.5 [代码] handoff 多源 `## 规范要点` 与回执 `rulesRead` 完整性校验
  - 文件：`src/core/templates/workflows/spec-propose.ts`、`src/core/templates/workflows/spec-apply.ts`、`src/core/spec/validation/conformance.ts`
  - 验证：模板断言多源来源标注与 `rules-not-read` 判定
  - Spec Ref：rule-baseline / handoff 多源规范要点与 rulesRead 完整性
  - Scenario Ref：多源规范要点
  - Scenario Ref：规则未读导致一致性门失败
  - Scenario Ref：读取失败不伪装

- [x] 6.6 [测试][单元][P0] 多源规范要点与 rulesRead 完整性测试
  - 文件：`test/rules-command.test.ts`、`test/spec-conformance.test.ts`
  - 验证：`pnpm test -- test/rules-command.test.ts test/spec-conformance.test.ts`
  - Spec Ref：rule-baseline / handoff 多源规范要点与 rulesRead 完整性
  - Scenario Ref：多源规范要点
  - Scenario Ref：规则未读导致一致性门失败
  - Scenario Ref：读取失败不伪装

## 7. 既有技能正文调整 [N3] [N10] [N16]

- [x] 7.1 [代码] spec-propose 多源规范要点与 `[代码]`/`[测试]` 任务配对约束
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：模板断言多源来源标注与 scenario-without-test 自检
  - Spec Ref：spec-workflow-skills / spec-propose 多源规范要点与任务配对
  - Scenario Ref：多源规范要点写入 handoff
  - Scenario Ref：可测场景缺测试任务

- [x] 7.2 [测试][单元][P1] spec-propose 模板测试
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test -- test/templates.test.ts`
  - Spec Ref：spec-workflow-skills / spec-propose 多源规范要点与任务配对
  - Scenario Ref：多源规范要点写入 handoff
  - Scenario Ref：可测场景缺测试任务

- [x] 7.3 [代码] spec-verify 消费一致性与测试证据（缺失判 CRITICAL）
  - 文件：`src/core/templates/workflows/spec-verify.ts`
  - 验证：模板断言证据读取与 CRITICAL 语句
  - Spec Ref：spec-workflow-skills / spec-verify 消费一致性与测试证据
  - Scenario Ref：一致性证据缺失判 CRITICAL
  - Scenario Ref：证据通过不重复推断

- [x] 7.4 [测试][单元][P1] spec-verify 模板测试
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test -- test/templates.test.ts`
  - Spec Ref：spec-workflow-skills / spec-verify 消费一致性与测试证据
  - Scenario Ref：一致性证据缺失判 CRITICAL
  - Scenario Ref：证据通过不重复推断

- [x] 7.5 [代码] workflow 交付桥预告自动补测 / 测试门 / 一致性门
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：模板断言交付桥内容
  - Spec Ref：workflow-suite-skills / workflow 实现阶段继承新门
  - Scenario Ref：交付桥预告新门

- [x] 7.6 [测试][单元][P1] workflow 交付桥模板测试
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test -- test/templates.test.ts`
  - Spec Ref：workflow-suite-skills / workflow 实现阶段继承新门
  - Scenario Ref：交付桥预告新门

- [x] 7.7 [代码] `iagent_test` 自动补测调用语义（接收改动文件与已覆盖 Scenario）
  - 文件：`src/core/templates/workflows/test.ts`
  - 验证：模板断言 delegated 分支与输入契约
  - Spec Ref：test-generate / 自动补测调用语义
  - Scenario Ref：自动管线补测
  - Scenario Ref：独立调用行为不变

- [x] 7.8 [测试][单元][P1] `iagent_test` 自动调用语义模板测试
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test -- test/templates.test.ts`
  - Spec Ref：test-generate / 自动补测调用语义
  - Scenario Ref：自动管线补测
  - Scenario Ref：独立调用行为不变

- [x] 7.9 [代码] 测试计划门自动处置（自动采用计划 + WARN；独立调用保持阻塞）
  - 文件：`src/core/templates/workflows/test.ts`、`src/core/templates/workflows/spec-apply.ts`、`src/core/templates/workflows/debug.ts`
  - 验证：模板断言计划门分支
  - Spec Ref：test-evidence-gate / 自动管线的测试计划门处置
  - Scenario Ref：自动管线不阻塞
  - Scenario Ref：独立调用保持阻塞

- [x] 7.10 [测试][单元][P1] 测试计划门分支测试
  - 文件：`test/test-evidence-gate.test.ts`
  - 验证：`pnpm test -- test/test-evidence-gate.test.ts`
  - Spec Ref：test-evidence-gate / 自动管线的测试计划门处置
  - Scenario Ref：自动管线不阻塞
  - Scenario Ref：独立调用保持阻塞

## 8. 集成与回归 [N11] [N12]

- [x] 8.1 [代码] 命令补全与白名单同步（`IAGENT_COMMANDS`、`allowedTools` 复核）
  - 文件：`src/commands/completion.ts`、`src/core/templates/tool-whitelist.ts`、相关模板
  - 验证：`node bin/iagent.js completion bash` 输出含新命令；`test/allowed-tools.test.ts`
  - Spec Ref：rule-baseline / 规则源枚举命令
  - Scenario Ref：枚举存在的规则源

- [x] 8.2 [代码] 重建技能快照并校验纯派生关系
  - 文件：`skills/**/SKILL.md`
  - 验证：`pnpm build && pnpm generate:skills && pnpm test -- test/skills-parity.test.ts test/template-derivation.test.ts`
  - Spec Ref：spec-workflow-skills / spec-apply 自动单测补齐与实现一致性门
  - Scenario Ref：证据文件保留

- [x] 8.3 [测试][功能][P0] 全量回归（构建、测试、快照、语言与行数预算）
  - 文件：`test/`
  - 验证：`pnpm build && pnpm test`
  - Spec Ref：spec-conformance / 实现一致性三层判定
  - Scenario Ref：三层全部覆盖

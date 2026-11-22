# Tasks: improve-proposal-generation-completeness

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/）
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]
     补充文档类（非 [代码]/[测试]）MUST 含 `产出:` 字段指定输出路径 -->

> 流程基准：`exploration.md` §功能流程图 N1-N13（已确认）。

## 1. 验证锚点单一源（anchors.ts + 模板锚点）

- [x] 1.1 [代码] 新建 `src/core/spec/validation/anchors.ts`，定义锚点唯一常量源 `VERIFY_ANCHORS`（`impactAnalysis` / `architectureImpact` / `callerUpdates` / `NODE_REF` 正则）并导出插值 helper [N4]
  - 文件：`src/core/spec/validation/anchors.ts`
  - 验证：`pnpm build` 通过；模板层与验证层均可引用
  - Spec Ref：spec-verify-anchors / 验证锚点单一常量源

- [x] 1.2 [代码] 修改 `src/core/spec/templates/index.ts`：`PROPOSAL_TEMPLATE` 的 `## Impact` 下增 `### Impact Analysis`；`DESIGN_TEMPLATE` 的 `## Context` 下增 `### 架构影响`；`TASKS_TEMPLATE` 增 `### Caller Updates` 与 `[N<id>]` 标注示例；锚点文本由 `anchors.ts` 插值 [N2][N3]
  - 文件：`src/core/spec/templates/index.ts`
  - 验证：`iagent spec instructions` 三类输出均含锚点
  - Spec Ref：spec-verify-anchors / 验证锚点单一常量源

- [x] 1.3 [测试][单元][P0] 锚点单一源与模板产出单测：三份模板均含锚点、验证侧引用同一常量、常量与解析器一致
  - 文件：`test/spec-anchors.test.ts`
  - 验证：`pnpm test test/spec-anchors.test.ts` 全绿
  - Spec Ref：spec-verify-anchors / 验证锚点单一常量源
  - Scenario Ref：spec-verify-anchors / 验证锚点单一常量源 / 生成模板产出全部锚点
  - Scenario Ref：spec-verify-anchors / 验证锚点单一常量源 / 验证侧复用同一常量
  - Scenario Ref：spec-verify-anchors / 验证锚点单一常量源 / 锚点常量与解析器一致

- [x] 1.4 [代码] 扩展 `src/core/spec/parser/proposal-parser.ts`：解析 `## What Changes` 条目 → `ParsedProposal.whatChanges`；解析 `### New/Modified Capabilities` 列表 → `ParsedProposal.capabilities` [N2]
  - 文件：`src/core/spec/parser/proposal-parser.ts`
  - 验证：结构化字段可由单测断言
  - Spec Ref：spec-verify-anchors / 验证锚点单一常量源

- [x] 1.5 [代码] 扩展 `src/core/spec/model/artifact-model.ts` 的 `ParsedProposal`（增 `whatChanges` / `capabilities`）与 `ParsedTask`（增 `nodeRef?`），既有字段不删不改 [N4]
  - 文件：`src/core/spec/model/artifact-model.ts`
  - 验证：类型检查通过；既有消费方无需改动
  - Spec Ref：spec-verify-anchors / 验证锚点单一常量源

- [x] 1.6 [代码] 扩展 `src/core/spec/parser/task-parser.ts`：解析任务行中全部 `[N<id>]` → `ParsedTask.nodeRefs: string[]`（`nodeRef` 保留为 `nodeRefs[0]` 兼容），并从描述剥离；缺失不产生诊断 [N4]
  - 文件：`src/core/spec/parser/task-parser.ts`
  - 验证：`nodeRefs` 解析正确（含多节点）；无标注时为空
  - Spec Ref：spec-verify-anchors / 任务节点标注的 Markdown 真源

- [x] 1.7 [测试][单元][P0] 节点标注解析单测：命中 `[N4]`、描述已剥离、无标注不报错、形似「括号内无数值」与「括号内非纯数字」的写法均不匹配
  - 文件：`test/spec-anchors.test.ts`
  - 验证：四类情形断言全部通过
  - Spec Ref：spec-verify-anchors / 任务节点标注的 Markdown 真源
  - Scenario Ref：spec-verify-anchors / 任务节点标注的 Markdown 真源 / 解析节点标注
  - Scenario Ref：spec-verify-anchors / 任务节点标注的 Markdown 真源 / 无标注任务不报错
  - Scenario Ref：spec-verify-anchors / 任务节点标注的 Markdown 真源 / 单任务多节点标注

- [x] 1.8 [代码] 修改 `spec-verify-proposal.ts` 的影响面存在性判定，改用 `anchors.ts` 常量，移除正文硬编码锚点串 [N10]
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 验证：生成正文锚点与常量一致
  - Spec Ref：spec-verify-anchors / 验证锚点单一常量源

- [x] 1.9 [代码] 修改 `src/core/templates/workflows/spec-propose.ts` 的 Step 0：delegated 模式下直接迁移 `exploration-file` 并校验其存在性（缺失时报 `missing-exploration` 并停止），确保 N1 的过桥载体不被跳过 [N1] [N1]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：生成正文含校验句；缺失探索文件时报错而非静默继续
  - Spec Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol

## 2. 确定性就绪门（readiness.ts + `validate --ready`）

- [x] 2.1 [代码] 新建 `src/core/spec/validation/readiness.ts`：纯函数 `buildReadiness(model, options)` 执行四类判定（结构 / 覆盖 / 锚点 / 能力对齐），复用 `validateParsedChange` 与 `buildConformance`；导出 `ReadinessResult`（`valid` / `checks[]` / `diagnostics[]` / `skipped[]`） [N4]
  - 文件：`src/core/spec/validation/readiness.ts`
  - 验证：无 I/O；单测可构造 `ParsedChange` 直接调用
  - Spec Ref：spec-readiness-gate / 确定性就绪门

- [x] 2.2 [代码] 在 `readiness.ts` 实现能力对齐：`proposal` 声明能力 ↔ `specs/<dir>/` 双向差集，产出 `capability-without-spec` / `spec-without-capability` 诊断；`skip_specs: true` 豁免且不参与分母 [N4]
  - 文件：`src/core/spec/validation/readiness.ts`
  - 验证：双向缺项均报可定位诊断
  - Spec Ref：spec-readiness-gate / 确定性就绪门

- [x] 2.3 [代码] 在 `readiness.ts` 实现存量/新变更判定：读 `.openspec.yaml` 的 `created` 与常量 `READINESS_EFFECTIVE_DATE` 比较；`created` 缺失按新变更（fail-safe） [N4]
  - 文件：`src/core/spec/validation/readiness.ts`
  - 验证：存量锚点缺失 → `warning` + `skipped`；新变更 → `error`
  - Spec Ref：spec-readiness-gate / 就绪门的存量变更兼容

- [x] 2.4 [代码] 在 `src/commands/spec.ts` 为 `validate` 增 `--ready`；与 `--partial` 互斥（同时传时报参数冲突并返回非零退出码） [N4][N8]
  - 文件：`src/commands/spec.ts`
  - 验证：`--ready` 输出四类判定逐项结论；`--ready --partial` 报冲突
  - Spec Ref：spec-readiness-gate / 确定性就绪门

- [x] 2.5 [代码] `runSpecValidate` 与 `SpecValidateOptions` 增 `ready?: boolean`，保证不传 `--ready` 时 strict / `--partial` / `--conformance` 行为完全不变 [N4]
  - 文件：`src/commands/spec.ts`
  - 验证：既有三种模式回归全绿
  - Spec Ref：spec-readiness-gate / 确定性就绪门

- [x] 2.6 [测试][单元][P0] 就绪门四类判定单测：全通过、覆盖不足逐条定位、能力对齐双向差集、与 partial 互斥 [N5][N6]
  - 文件：`test/spec-readiness-gate.test.ts`
  - 验证：`pnpm test test/spec-readiness-gate.test.ts` 全绿
  - Spec Ref：spec-readiness-gate / 确定性就绪门
  - Scenario Ref：spec-readiness-gate / 确定性就绪门 / 全部判定通过
  - Scenario Ref：spec-readiness-gate / 确定性就绪门 / 覆盖不足时逐条定位
  - Scenario Ref：spec-readiness-gate / 确定性就绪门 / 能力声明与 specs 目录不一致
  - Scenario Ref：spec-readiness-gate / 确定性就绪门 / 与 partial 模式互斥

- [x] 2.7 [测试][单元][P0] 存量/新变更严格度分支单测：存量缺锚点不阻断、新变更缺锚点阻断、`created` 缺失按新变更、skip_specs 豁免能力对齐
  - 文件：`test/spec-readiness-gate.test.ts`
  - 验证：四类情形断言全部通过
  - Spec Ref：spec-readiness-gate / 就绪门的存量变更兼容
  - Scenario Ref：spec-readiness-gate / 就绪门的存量变更兼容 / 存量变更缺锚点不阻断
  - Scenario Ref：spec-readiness-gate / 就绪门的存量变更兼容 / 新变更缺锚点阻断
  - Scenario Ref：spec-readiness-gate / 就绪门的存量变更兼容 / skip_specs 豁免能力对齐

- [x] 2.8 [测试][功能][P1] CLI 端到端：`bin/iagent.js spec validate --ready` 的退出码与参数冲突（先 `pnpm build`）
  - 文件：`test/markdown-spec-cli.test.ts`
  - 验证：成功 0 / 失败非 0 / 冲突非 0
  - Spec Ref：spec-readiness-gate / 确定性就绪门
  - Scenario Ref：spec-readiness-gate / 确定性就绪门 / 与 partial 模式互斥

## 3. 验证清单单一源（verify-checklist.ts）

- [x] 3.1 [代码] 新建 `src/core/templates/verify-checklist.ts`：导出 `renderVerifyChecklist({ variant })`，承载 D1-D10 清单表头与 B1-B7 边界清单唯一正文；variants 含 `propose-selfcheck`（确定性可判子集）与 `orchestrator`（完整清单） [N10]
  - 文件：`src/core/templates/verify-checklist.ts`
  - 验证：渲染结果可被 5 个技能插值
  - Spec Ref：verify-checklist-single-source / 验证清单单一源

- [x] 3.2 [代码] 修改 `spec-verify-proposal.ts`：清单表头与 B1-B7 改为 `renderVerifyChecklist()` 插值；D1-D10 维度定义正文保留在本技能 [N10]
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 验证：生成正文含清单且维度定义不丢
  - Spec Ref：verify-checklist-single-source / 验证清单单一源

- [x] 3.3 [代码] 修改 `spec-verify.ts` / `workflow.ts` / `auto-workflow.ts` / `debug.ts`：删除手写清单，改为 `renderVerifyChecklist()` 插值 [N10]
  - 文件：`src/core/templates/workflows/spec-verify.ts` / `workflow.ts` / `auto-workflow.ts` / `debug.ts`
  - 验证：四处生成正文清单内容一致
  - Spec Ref：verify-checklist-single-source / 验证清单单一源

- [x] 3.4 [测试][单元][P0] 清单单一源单测：五个技能生成正文含同一清单文本；改模块后五处同步
  - 文件：`test/verify-checklist-single-source.test.ts`
  - 验证：断言五处输出一致
  - Spec Ref：verify-checklist-single-source / 验证清单单一源
  - Scenario Ref：verify-checklist-single-source / 验证清单单一源 / 五个技能引用同一清单源
  - Scenario Ref：verify-checklist-single-source / 验证清单单一源 / 清单内容改动只改一处

- [x] 3.5 [测试][单元][P0] 阈值与维度编号不变性单测：D1-D10 编号、90% 阈值、总分公式原文未被改变
  - 文件：`test/verify-checklist-single-source.test.ts`
  - 验证：断言原文不变
  - Spec Ref：verify-checklist-single-source / 验证清单单一源
  - Scenario Ref：verify-checklist-single-source / 验证清单单一源 / 阈值与编号保持不变

- [x] 3.6 [代码] 修改 `spec-propose.ts`：终检接入 `renderVerifyChecklist({ variant: 'propose-selfcheck' })` 压缩自检清单；顺序固定 partial → `validate --ready` → strict → handoff 包；delegated 回执增 `readiness` 字段 [N9]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：生成正文顺序可读、不新增门；回执字段存在
  - Spec Ref：verify-checklist-single-source / 压缩自检清单与验证清单同源

- [x] 3.7 [测试][单元][P1] propose 自检同源与「不新增门」单测：清单来自同一真源、FAIL 出口为既有三出口（修复轮次超限后） [N7]
  - 文件：`test/verify-checklist-single-source.test.ts`
  - 验证：断言来源与出口文本
  - Spec Ref：verify-checklist-single-source / 压缩自检清单与验证清单同源
  - Scenario Ref：verify-checklist-single-source / 压缩自检清单与验证清单同源 / 自检与验证同源
  - Scenario Ref：verify-checklist-single-source / 压缩自检清单与验证清单同源 / 自检失败不新增门

## 4. 编排链消费就绪结果与验证侧确定性优先

- [x] 4.1 [代码] 修改 `workflow.ts` / `auto-workflow.ts`：Phase 2 → Phase 3 推进条件增 `readiness.status === 'pass'`，否则回 Phase 2 修复（不新增用户门） [N10][N11]
  - 文件：`src/core/templates/workflows/workflow.ts` / `auto-workflow.ts`
  - 验证：生成正文含该门控句
  - Spec Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol

- [x] 4.2 [代码] 修改 `debug.ts` Phase 6「同步提案」：完成后 MUST 运行 `iagent spec validate --ready`，FAIL → 回 Phase 4，不另立判定口径 [N13]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：生成正文含该步且无第二套判定
  - Spec Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol

- [x] 4.3 [代码] 修改 `spec-verify-proposal.ts` D2：`design.md` 缺失时从 `specs` + `proposal` 取技术选型证据，双无则 SKIP 排除分母 [N10]
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 验证：生成正文含 SKIP 分支
  - Spec Ref：spec-verify-proposal / 技术一致性的 design 缺失分支

- [x] 4.4 [代码] 修改 `spec-verify-proposal.ts` D3：优先消费 `ParsedProposal.whatChanges` / `capabilities` 的确定性结论，语义判定仅补缺且冲突时确定性优先并留 WARN [N10]
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 验证：生成正文含优先级声明
  - Spec Ref：spec-verify-proposal / 待实现功能覆盖检查

- [x] 4.5 [代码] 更新 `.iagent/rules/spec.md`（项目侧协议投影）：增「锚点产出」与「终检顺序 partial → ready → strict → handoff」 [N4]
  - 文件：`.iagent/rules/spec.md`
  - 验证：文件含两条新要点
  - Spec Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol

- [x] 4.6 [测试][单元][P1] 编排门控单测：workflow / auto-workflow 含 `readiness.status` 门控，debug Phase 6 含 `--ready` [N10][N12]
  - 文件：`test/proposal-readiness-chain.test.ts`
  - 验证：断言文本存在
  - Spec Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol
  - Scenario Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol / 终检按固定顺序执行

- [x] 4.7 [测试][单元][P1] 协议与降级路径单测：制品含锚点、按依赖序生成、协议共享、缺项目侧协议时降级、校验失败可定位
  - 文件：`test/proposal-readiness-chain.test.ts`
  - 验证：断言路径与降级文本
  - Spec Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol
  - Scenario Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol / 制品包含验证锚点
  - Scenario Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol / Generate artifacts in dependency order
  - Scenario Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol / Generation protocol is shared
  - Scenario Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol / 目标项目缺项目侧协议文件时降级
  - Scenario Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol / Validation failure is actionable

- [x] 4.8 [测试][单元][P1] D3 确定性优先与待实现功能覆盖单测：声明项逐级有承接、无任务承接、确定性结论优先
  - 文件：`test/verify-review-checkpoints.test.ts`
  - 验证：断言三类文本与优先级
  - Spec Ref：spec-verify-proposal / 待实现功能覆盖检查
  - Scenario Ref：spec-verify-proposal / 待实现功能覆盖检查 / 声明项逐级有承接
  - Scenario Ref：spec-verify-proposal / 待实现功能覆盖检查 / 声明项无任务承接
  - Scenario Ref：spec-verify-proposal / 待实现功能覆盖检查 / 确定性结论优先

- [x] 4.9 [测试][单元][P1] 影响范围一致性检查单测：三制品对齐、与 tasks 脱节、无影响面制品、存量 JSON-only 降级
  - 文件：`test/verify-review-checkpoints.test.ts`
  - 验证：断言四类处置
  - Spec Ref：spec-verify-proposal / 影响范围一致性检查
  - Scenario Ref：spec-verify-proposal / 影响范围一致性检查 / 三制品存在且对齐
  - Scenario Ref：spec-verify-proposal / 影响范围一致性检查 / 有制品但与 tasks 脱节
  - Scenario Ref：spec-verify-proposal / 影响范围一致性检查 / 无影响面制品
  - Scenario Ref：spec-verify-proposal / 影响范围一致性检查 / 存量 JSON-only 降级

- [x] 4.10 [测试][单元][P1] D2 design 缺失分支单测：specs 有技术选型时计分、双无时 SKIP 排除分母
  - 文件：`test/verify-review-checkpoints.test.ts`
  - 验证：两类情形断言通过
  - Spec Ref：spec-verify-proposal / 技术一致性的 design 缺失分支
  - Scenario Ref：spec-verify-proposal / 技术一致性的 design 缺失分支 / design 缺失但 specs 有技术选型
  - Scenario Ref：spec-verify-proposal / 技术一致性的 design 缺失分支 / design 缺失且无技术选型证据

## 5. 文档同步与全量回归

- [x] 5.1 [使用说明] 更新 `AGENTS.md` 仓库地图与单一源清单（新增 `anchors.ts` / `readiness.ts` / `verify-checklist.ts`），并在「修改守则」补「改清单只改一处」
  - 产出：`AGENTS.md`
  - 验证：仓库地图含三模块；守则含单一源条目
  - Spec Ref：verify-checklist-single-source / 验证清单单一源

- [x] 5.2 [代码] 更新 `openspec/CONTEXT.md`：新增「一次完成度 / 就绪门 / 验证锚点 / 压缩自检清单」，写入前先读既有文件并对同名冲突显式裁决 [N4]
  - 文件：`openspec/CONTEXT.md`
  - 验证：四条术语存在且与探索术语表一致
  - Spec Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol

- [x] 5.3 [测试][单元][P0] 快照与模板一致性回归：`pnpm build && pnpm generate:skills` 后跑 parity / consistency / spec-commands / task-label
  - 文件：`test/skills-parity.test.ts` / `test/template-consistency.test.ts` / `test/spec-commands.test.ts` / `test/task-label.test.ts`
  - 验证：四个测试文件全绿
  - Spec Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol
  - Scenario Ref：artifact-generation-protocol / Shared Markdown artifact generation protocol / Generation protocol is shared

### Caller Updates

| 影响模块 | 承接任务 |
| :--- | :--- |
| `src/core/spec/validation/artifact-validator.ts` | 2.1、2.5 |
| `src/core/spec/parser/proposal-parser.ts` | 1.4 |
| `src/core/spec/parser/task-parser.ts` | 1.6 |
| `src/core/spec/model/artifact-model.ts` | 1.5 |
| `src/core/spec/templates/index.ts` | 1.2 |
| `src/commands/spec.ts` | 2.4、2.5 |
| `src/core/templates/workflows/spec-propose.ts` | 3.6 |
| `src/core/templates/workflows/spec-verify-proposal.ts` | 1.8、3.2、4.3、4.4 |
| `src/core/templates/workflows/workflow.ts` | 3.3、4.1 |
| `src/core/templates/workflows/auto-workflow.ts` | 3.3、4.1 |
| `src/core/templates/workflows/debug.ts` | 3.3、4.2 |
| `src/core/templates/workflows/spec-verify.ts` | 3.3 |
| `AGENTS.md` / `.iagent/rules/spec.md` / `openspec/CONTEXT.md` | 5.1、4.5、5.2 |

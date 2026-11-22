## ADDED Requirements

### Requirement: 验证清单单一源

系统 SHALL 在 `src/core/templates/verify-checklist.ts` 提供验证清单的唯一正文源，导出 `renderVerifyChecklist(options)`，覆盖 D1-D10 核心与条件维度的清单表头、B1-B7 边界清单。以下五处 MUST 以插值引用该模块，MUST NOT 各自手写清单正文：

- `src/core/templates/workflows/spec-verify-proposal.ts`
- `src/core/templates/workflows/spec-verify.ts`
- `src/core/templates/workflows/workflow.ts`
- `src/core/templates/workflows/auto-workflow.ts`
- `src/core/templates/workflows/debug.ts`

维度编号（D1-D10）、90% 统一阈值与总分公式 MUST NOT 因本抽取而改变。

#### Scenario: 五个技能引用同一清单源

- **WHEN** 任一上述技能模板生成正文
- **THEN** 其 D1-D10 / B1-B7 清单 SHALL 由 `renderVerifyChecklist()` 插值产生
- **AND** MUST NOT 在技能正文中内联手写清单条目

#### Scenario: 清单内容改动只改一处

- **WHEN** 需要调整 B1-B7 边界清单的任一条描述
- **THEN** 改动 SHALL 只需修改 `verify-checklist.ts`
- **AND** 五个技能的生成正文 SHALL 同步反映，无需逐个模板编辑

#### Scenario: 阈值与编号保持不变

- **WHEN** 抽取后运行验证
- **THEN** 维度编号 SHALL 仍为 D1-D10、阈值 SHALL 仍为 90%、总分公式 SHALL 保持不变
- **AND** 该不变性 SHALL 由测试断言守护

### Requirement: 压缩自检清单与验证清单同源

`iagent_spec_propose` SHALL 在终检阶段运行**压缩自检清单**——从 `renderVerifyChecklist()` 的同一真源渲染的确定性可判子集（Requirement 有任务 / Scenario 有 `[测试]` 任务 / 三锚点齐备 / Capabilities↔specs 对齐 / `[N<id>]` 标注齐备）。该清单 MUST NOT 构成用户确认门；FAIL 时 MUST 走既有 propose FAIL 三出口（手动编辑 / 返回探索 / 查看差异），MUST NOT 新增第二道停点。

#### Scenario: 自检与验证同源

- **WHEN** propose 执行压缩自检清单
- **THEN** 清单项 SHALL 来自 `renderVerifyChecklist()` 的同一真源
- **AND** MUST NOT 在 propose 正文内另写一份自检清单

#### Scenario: 自检失败不新增门

- **WHEN** 压缩自检清单存在 FAIL 项
- **THEN** 本技能 SHALL 自动修复并重跑（≤3 次）
- **AND** 超限后 SHALL 呈现既有三出口，MUST NOT 呈现新增的确认门

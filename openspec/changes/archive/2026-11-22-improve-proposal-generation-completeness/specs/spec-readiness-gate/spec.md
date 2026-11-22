## ADDED Requirements

### Requirement: 确定性就绪门

系统 SHALL 提供 `iagent spec validate --ready`，由 `src/core/spec/validation/readiness.ts` 的纯函数实现**四类确定性判定**：结构完整、覆盖完整、锚点齐备、能力对齐。该判定 MUST NOT 含 AI 语义判断。

判定复用既有纯函数，MUST NOT 另立第二套解析或覆盖算法：

| 判定 | 内容 | 复用 |
| :--- | :--- | :--- |
| 结构完整 | 四类制品存在且无 `error` 级诊断 | `validateParsedChange` |
| 覆盖完整 | 每个 Requirement 有承接任务、每个 Scenario 有 `[测试]` 任务 | `buildConformance` |
| 锚点齐备 | 影响面三锚点存在且非空 | `anchors.ts` |
| 能力对齐 | `proposal.md` 声明的能力与 `specs/<capability>/` 目录逐一对应 | 扩展后的 `parseProposal` |

诊断 MUST 沿用 `ArtifactDiagnostic`（`filePath` + `line` + `code`）；FAIL 输出 MUST 逐条可定位，MUST NOT 仅给出计数或百分比。

#### Scenario: 全部判定通过

- **WHEN** 四类制品齐备、覆盖完整、锚点齐备且能力目录对齐
- **THEN** `validate --ready` SHALL 返回 `valid=true` 且退出码为 0
- **AND** 输出 SHALL 含四类判定的逐项结论

#### Scenario: 覆盖不足时逐条定位

- **WHEN** 某 Scenario 无 `[测试]` 任务覆盖
- **THEN** `validate --ready` SHALL 返回 `valid=false`、退出码非 0
- **AND** 诊断 SHALL 逐条列出 `<capability> / <Requirement> / <Scenario>` 与所在 `filePath:line`

#### Scenario: 能力声明与 specs 目录不一致

- **WHEN** `proposal.md` 声明能力 `a`、`b`，但 `specs/` 下只有 `a/spec.md`
- **THEN** 就绪门 SHALL 报 `capability-without-spec` 诊断并指明缺失能力名
- **AND** 反之 `specs/` 下有未在 Capabilities 声明的目录 SHALL 报 `spec-without-capability`

#### Scenario: 与 partial 模式互斥

- **WHEN** 同时传 `--ready` 与 `--partial`
- **THEN** 命令 SHALL 报参数冲突诊断并返回非零退出码
- **AND** MUST NOT 静默选择其中一种语义

### Requirement: 就绪门的存量变更兼容

就绪门 SHALL 对新变更与存量变更采用不同严格度：锚点缺失在**新变更**记 `error`，在**存量变更**记 `warning` 并计入 `skipped` 统计，MUST NOT 阻断。新/存量判定 MUST 依据变更目录 `.openspec.yaml` 的 `created` 字段与能力生效日期比较，MUST NOT 依据制品内容猜测。

#### Scenario: 存量变更缺锚点不阻断

- **WHEN** 存量变更的 `proposal.md` 无 `### Impact Analysis` 小节
- **THEN** 就绪门 SHALL 记 `warning` 并把该判定计入 `skipped`
- **AND** 整体 `valid` MUST NOT 因该条为 `false`

#### Scenario: 新变更缺锚点阻断

- **WHEN** 新变更的 `proposal.md` 无 `### Impact Analysis` 小节
- **THEN** 就绪门 SHALL 记 `error` 且 `valid=false`

#### Scenario: skip_specs 豁免能力对齐

- **WHEN** 变更的 `.openspec.yaml` 声明 `skip_specs: true`
- **THEN** 能力对齐判定 SHALL 豁免并不计入分母
- **AND** 其余三类判定 SHALL 照常执行

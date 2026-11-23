## ADDED Requirements

### Requirement: 就绪门第五判定（需求发散）

`buildReadiness` SHALL 在既有四判定（`structure` / `coverage` / `anchors` / `capabilities`）之后追加第 5 判定 `divergence`：

- `ReadinessCheck.id` SHALL 为 `'divergence'`，`label` 为 `'需求发散'`
- 判定输入 SHALL 为已解析的变更模型中的 `## 需求发散` 段（解析结果由调用方注入，MUST NOT 在判定内做 I/O）
- 严格度沿用 `isNewChange`：新变更缺段/空维度 → `status='fail'` + `error` 诊断；存量变更 → `status='skipped'` + `legacyWarnings`
- `skip_specs` / `legacyJson` MUST NOT 豁免本判定
- `ReadinessResult.checks` SHALL 由 4 项变为 5 项；消费方 MUST 按 `id` 查找或 `every()` 迭代，MUST NOT 依赖数组长度
- **MUST NOT** 改变 D1-D10 维度编号、90% 阈值或总分公式

细则见新增能力 `divergence-analysis`。

#### Scenario: checks 数组含五项

- **WHEN** 对任一变更加载就绪门结果
- **THEN** `checks` SHALL 含 `structure` / `coverage` / `anchors` / `capabilities` / `divergence` 五项

#### Scenario: CLI --ready 输出含新判定

- **WHEN** 执行 `iagent spec validate --change <name> --ready`
- **THEN** 输出 SHALL 列出 `需求发散` 判定的 pass / fail / skipped 状态

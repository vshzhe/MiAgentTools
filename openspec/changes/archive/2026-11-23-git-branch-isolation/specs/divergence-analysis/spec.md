## ADDED Requirements

### Requirement: 需求发散五维

探索阶段 SHALL 产出探索产物的 `## 需求发散` 段，含五个维度：

| 维度 | 语义 |
| :--- | :--- |
| 直接影响 | 需求字面涉及的功能与文件 |
| 间接影响 | 共享工具 / 数据模型 / 配置 / 公共组件 / 既有调用方 |
| 契约影响 | API / CLI / 事件 / DB schema / 文件格式，含向后兼容判定 |
| 同类场景 | 同一模式的其他调用点；同类功能是否需要同步改动 |
| 非功能影响 | 性能 / 并发 / 权限 / 可观测性 / 多语言与多平台 |

- 每条 SHALL 带证据位置（`文件:行` 或 类.方法）；新建项标 `[新建]` 并写明预期产物；推断项标 `[推断]`
- 维度内确实无内容时 SHALL 写固定字面量 `无`（不得留空、不得省略该维度行）
- **无法追溯证据且非新建/推断的条目 MUST NOT 进入段内**

#### Scenario: 五维齐备

- **WHEN** 探索产出一段完整的需求发散
- **THEN** `## 需求发散` 段 SHALL 含五个维度小节，每节至少一条带证据的条目或固定字面量 `无`

#### Scenario: 维度留空即视为缺失

- **WHEN** 某维度小节存在但内容为空
- **THEN** 就绪门 SHALL 判定该维度缺失（不视为合法终态）

#### Scenario: 无发散内容时显式声明

- **WHEN** 该变更确无间接 / 契约 / 同类 / 非功能影响
- **THEN** 对应维度 SHALL 写 `无`，就绪门 pass 并留痕

### Requirement: 发散产出的时机与呈现

`iagent_spec_explore`（delegated 模式）SHALL 在 **1.5.5 功能流程图之后、1.6 探索完成检测之前**产出需求发散，并与 1.5.5 的**流程最终确认门合并呈现**：

- MUST NOT 新增用户停顿（门预算：探索阶段仍只有 1 个流程级阻塞门）
- 用户对流程图的确认 SHALL 同时覆盖发散段；用户修改流程图时 SHALL 重新评估发散段
- 发散段的生成细则 SHALL 下沉 `references/divergence-analysis.md`，主 SKILL.md 只保留指针与硬约束

#### Scenario: 合并呈现不新增停点

- **WHEN** 探索走到流程最终确认门
- **THEN** 流程图、节点清单与需求发散段 SHALL 在一次呈现中给出，用户一次确认

#### Scenario: 修改流程图后重新评估

- **WHEN** 用户在流程门修改了流程图
- **THEN** 技能 SHALL 重新评估受影响维度的发散条目，MUST NOT 保持陈旧结论

### Requirement: 就绪门第 5 判定 divergence

`buildReadiness`（`src/core/spec/validation/readiness.ts`）SHALL 新增第 5 判定 `divergence`：

- **判定内容**：解析出的变更模型含 `## 需求发散` 段，且五维小节各自非空（含固定字面量 `无`）
- **输出**：`ReadinessCheck` 的 `id='divergence'`、`label='需求发散'`、`status='pass'|'fail'|'skipped'`
- **严格度**：沿用既有 `isNewChange` 分界 —— 新变更缺项记 `error` 并使 `valid=false`；存量变更记 WARN 并 `status='skipped'`（不阻断）
- **skip_specs / legacyJson**：不豁免本判定（发散段与 specs 无关）
- **MUST NOT** 改变 D1-D10 维度编号、90% 阈值或总分公式

#### Scenario: 新变更缺发散段判 fail

- **WHEN** `created >= 2026-11-22` 的变更缺少 `## 需求发散` 段
- **THEN** `divergence` 判定 SHALL 为 `fail`，`valid=false`

#### Scenario: 存量变更缺发散段不阻断

- **WHEN** 存量变更缺少该段
- **THEN** `divergence` 判定 SHALL 为 `skipped` 并记 WARN，`valid` 不受影响

#### Scenario: 五维齐备判 pass

- **WHEN** 五维小节均非空（含 `无`）
- **THEN** `divergence` 判定 SHALL 为 `pass`

### Requirement: 发散结论的消费承接

四类消费方 SHALL 承接发散结论：

1. `iagent_spec_propose` —— 在 proposal `## Impact` 下产出 `### 需求发散承接` 表：`能力/影响类别 | 影响条目 | 承接需求 / 任务`
2. `iagent_workflow` / `iagent_auto_workflow` 的 Phase 2.0 —— 影响分析 SHALL 扩为五维归集，采用**一次广查询 + 分维归集**，MUST NOT 逐维重复调用 CodeGraph；CodeGraph 不可用或 busy 耗尽 SHALL 降级 Grep 估算并记 WARN，MUST NOT 阻塞提案
3. `iagent_debug` 的 2.2.3.5 排查深度分级 —— 信号 SHALL 新增「需求面扩展」（受影响模块是否超出原需求声明面），命中即倾向深度路径
4. `iagent_spec_verify_proposal` 的 D2/D3 —— 影响范围一致性检查 SHALL 以发散承接表为证据源之一

#### Scenario: propose 产出承接表

- **WHEN** explore 产出了五维发散
- **THEN** propose SHALL 在 `## Impact` 下产出 `### 需求发散承接` 表，覆盖五维中出现影响的维度

#### Scenario: Phase 2.0 一次广查询

- **WHEN** 父编排执行 Phase 2.0 影响分析
- **THEN** SHALL 以一次广查询获取符号与文件面，再按五维归集，MUST NOT 为每个维度单独发起查询

#### Scenario: debug 需求面扩展信号

- **WHEN** 排查发现受影响模块超出原需求声明的范围
- **THEN** 2.2.3.5 分级 SHALL 倾向深度路径并记录该信号

### Requirement: 发散段的验证维度边界

发散判定 SHALL **只做确定性存在性校验**（段与小节存在、非空），MUST NOT 含 AI 语义判定；发散结论的**质量**由验证阶段的 D2/D3 以承接表为证据来源评估。

#### Scenario: 就绪门不含语义判定

- **WHEN** 审阅 `readiness.ts` 的 `checkDivergence` 实现
- **THEN** SHALL 仅基于解析结果做存在性与非空判定，MUST NOT 调用任何模型或启发式语义评分

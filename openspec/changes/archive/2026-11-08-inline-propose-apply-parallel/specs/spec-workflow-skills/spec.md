## MODIFIED Requirements

### Requirement: spec-apply 派发协议与共享资源协议

`iagent_spec_apply` SHALL 以**主 agent 单 agent 分批实现**执行任务，MUST NOT 派发子代理（`Agent` / `Task`）。

**分批协议**：批次由同一 `group` 标签的任务聚成的**单元**构成。主 agent SHALL 按批推进：批内独立**只读**调用
（Read / Grep / CodeGraph 查询）可并行发起；写**不同文件**的任务 MAY 在同一回合并行发起；写**同一文件**的任务
MUST 串行。`openspec/config.yaml` 的 `apply.concurrency` 语义 SHALL 为「每批单元数」软上限（缺省 3，非法值回退 3 并告警），
MUST NOT 再约束子代理并发。批内单元失败时 SHALL 串行重试一次，仍失败则暂停并报告。

**共享资源协议（三载体）**：

- **变更级 handoff 包**：主 agent SHALL 在首次实现前确保 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 存在
  （propose 产出的跨阶段包；独立调用 apply 且不存在时按同一六节协议产出一次）。六节为 `## 变更摘要` / `## 契约` /
  `## 规范要点` / `## 文件归属表` / `## Codebase 摘要` / `## 已产出（跨单元可见）`。包是实现的**只读输入面**；
  产出后 MUST NOT 整包重产，只允许向 `## 已产出` 与 `## 阶段结论` 追加。
- **进度登记表**：主 agent SHALL 在 `.openspec-tmp/pipeline-<change-name>/apply-progress.md` 逐批追加进度行：
  `<任务 id> | <状态> | <产出文件> | <公开签名>`；MUST NOT 粘贴代码正文。「公开签名」为该产出中可被其他任务引用的
  符号签名（函数 / 方法 / 类型 / 接口 / 导出常量 / CLI 命令）；无则记「无」。
- **任务勾选集中管理**：任务状态、重试与 `tasks.md` 勾选 SHALL 由主 agent 集中更新；仅确认完整实现者勾选。

**读取纪律**：主 agent MUST NOT 重读 handoff 包已覆盖的 proposal / specs / design，MUST NOT 重跑包已覆盖的
CodeGraph 查询；包未覆盖时可补查，并在进度表中记录「缺什么、补查了什么」。

**一致性校验**：阶段入口 SHALL 比对 handoff 包头部指纹与当前制品；不一致时 SHALL 重建并记 WARN，MUST NOT 静默沿用陈旧包。

**工作区生命周期**：`.openspec-tmp/pipeline-<change-name>/` 为流程级工作区——propose 产出、verify / apply / archive 只读追加、
归档收尾统一清理（同时识别旧 `apply-` 前缀，失败 WARN 不阻断）。独立调用 apply 收尾 MUST NOT 删除
`compile-report.md` 与 `handoff-pack.md`，保留证据并在摘要报告路径。

**fail-safe 降级**：工作区不可写 / 包产出失败 / 项目无 `.iagent/rules/coding-rules.md` 时 SHALL 退化为既有内联读取
并记 WARN，MUST NOT 阻断实现。

**批次形态**：批次含少于 2 个单元时，主 agent SHALL 直接实现；`auto-mode=true` 只跳过设计确认门，
共享资源协议 SHALL 照常生效。

#### Scenario: 主 agent 分批实现

- **WHEN** 批次含多个单元
- **THEN** 主 agent SHALL 按批推进并逐批更新进度表
- **AND** MUST NOT 派发 Agent / Task 子代理

#### Scenario: 批内并行只读

- **WHEN** 同一批内多个任务需要独立读取
- **THEN** 主 agent MAY 在同一回合并行发起这些只读调用
- **AND** MUST NOT 声称这是独立上下文的并行实现

#### Scenario: 同文件串行写入

- **WHEN** 不同任务会修改同一文件
- **THEN** 这些写入 SHALL 串行执行
- **AND** 文件归属表 SHALL 反映该拆分结果

#### Scenario: 跨阶段复用 propose 产出的包

- **WHEN** apply 被父流程调用且 handoff 包已存在
- **THEN** 主 agent 直接只读该包，MUST NOT 重新蒸馏 proposal/specs/design 或重产整包

#### Scenario: 独立调用时按同一协议产出包

- **WHEN** 独立调用 spec-apply 且 handoff 包不存在
- **THEN** 主 agent SHALL 按六节协议产出 `handoff-pack.md` 后再实现
- **AND** 格式与本协议一致

#### Scenario: 进度表跨批共享

- **WHEN** 一批完成且主 agent 完成校验
- **THEN** 主 agent SHALL 向 `apply-progress.md` 追加该批产出与公开签名
- **AND** 下一批无需重扫已登记产出

#### Scenario: 指纹不一致时重建

- **WHEN** 阶段入口发现 handoff 包指纹与当前制品不一致
- **THEN** 主 agent SHALL 重建包并记录 WARN，MUST NOT 静默使用陈旧包

#### Scenario: 阶段结论只追加

- **WHEN** apply 阶段收束
- **THEN** 主 agent SHALL 向包追加 `## 阶段结论` 一节（phase / status / artifact / nextAllowed）
- **AND** MUST NOT 改写其它阶段已写入的结论

#### Scenario: 空值处置不留空不编造

- **WHEN** 变更不涉及接口 / 数据结构 / 表字段，或某任务无可被引用的符号
- **THEN** 包 `## 契约` 相应位置与进度表「公开签名」列记「无」，MUST NOT 留空或编造签名

#### Scenario: 包机制失效 fail-safe 降级

- **WHEN** 临时工作区不可写、包产出失败，或项目无 `.iagent/rules/coding-rules.md`
- **THEN** 主 agent SHALL 退化为既有内联读取并记 WARN，实现流程 MUST NOT 被阻断

#### Scenario: 单任务批次直接实现

- **WHEN** 批次含少于 2 个单元
- **THEN** 主 agent SHALL 直接实现，不新产出包

#### Scenario: auto-mode 不豁免共享资源协议

- **WHEN** 技能以 `auto-mode=true` 被调用
- **THEN** 设计确认门被跳过，但 handoff 包复用/产出、进度表与阶段结论规则均照常生效

## ADDED Requirements

### Requirement: handoff 包硬约束并列节

(D2.2) propose 产出的变更级 handoff 包 SHALL 在六节与 `## 制品清单` 之外新增并列节 `## 硬约束`：与六节并列、**不计入六节**、MUST NOT 改变六节与 `## 制品清单` 的既有语义。该节契约：

- **一行一条**：每行只承载一条不可被散文稀释的硬约束（顺序保证 / 否定式需求 / 数值型默认值等）；
- **逐字保留**：只收录不可改写的精确片段，MUST NOT 整段复制制品或探索文件；
- **来源锚点**：每行 MUST 带 `source: D<n>`，指向 `exploration.md` 的决策 id；
- **节预算**：该节同样受 handoff 包「每节 ≤ 120 行」预算约束。

该节缺失、为空且探索文件中确无硬约束来源、或无法从探索文件确定时，propose MUST 返回 `status=incomplete` + `failure`，MUST NOT 猜测补写。**例外**：探索文件显式声明固定字面量 `无硬约束`（合法终态）时，该节为空是允许的，MUST NOT 判为 `incomplete`。包写入失败（磁盘 / 权限）与「缺硬约束内容」是两类不同失败：前者按 propose 既有 WARN 继续策略处理，后者按本要求的 `incomplete` 处理，MUST NOT 混用。存量 handoff 包不含该节时，消费方 SHALL 记 WARN 并按「无硬约束」处理，MUST NOT 判定整包无效。消费方（verify / apply / archive）SHALL **只读复用**该节，MUST NOT 在该节写入或改写内容；`## 阶段结论` 的追加只允许由具备 `Write` 权限的消费方（apply / archive）执行——`verify` 无 `Write` 权限，MUST NOT 声称已追加阶段结论，其结论由父编排转交 apply / archive 落盘。

#### Scenario: 产出并列节

- **WHEN** propose 在全部 `applyRequires` 制品定稿后产出 handoff 包
- **THEN** 包内 SHALL 含 `## 硬约束` 并列节
- **AND** 该节 MUST NOT 计入六节，六节语义保持原样

#### Scenario: 逐字保留与来源锚点

- **WHEN** 探索文件记录了顺序保证、否定式需求或数值型默认值
- **THEN** `## 硬约束` SHALL 逐字保留这些片段而非改写成散文
- **AND** 每行 SHALL 带 `source: D<n>` 来源锚点
- **AND** MUST NOT 整段复制制品或探索文件内容

#### Scenario: 硬约束节受每节预算约束

- **WHEN** handoff 包含 `## 硬约束` 并列节
- **THEN** 该节 SHALL ≤ 120 行且 MUST NOT 计入六节
- **AND** MUST NOT 整段复制制品或探索文件内容

#### Scenario: 缺失则回执 incomplete

- **WHEN** 子代理无父级对话且 handoff 包缺 `## 硬约束` 节（边界 B6）
- **THEN** propose MUST 返回 `status=incomplete` + `failure`
- **AND** MUST NOT 猜测补写硬约束后继续

#### Scenario: 显式无硬约束为合法终态

- **WHEN** 探索文件显式声明固定字面量 `无硬约束`（合法终态）
- **THEN** `## 硬约束` 节为空是允许的
- **AND** propose MUST NOT 因此返回 `status=incomplete`

#### Scenario: 包写入失败与内容缺失区分

- **WHEN** handoff 包写入因磁盘或权限失败
- **THEN** 系统 SHALL 按 propose 既有 WARN 继续策略处理
- **AND** MUST NOT 将其与「缺硬约束内容」的 `status=incomplete` 混用

#### Scenario: 存量 handoff 包无该节

- **WHEN** 消费方读取本变更之前产出的 handoff 包（边界 B3）
- **THEN** 消费方 SHALL 记 WARN 并按「无硬约束」处理
- **AND** MUST NOT 判定整包无效或阻断阶段

#### Scenario: 禁止伪造硬约束

- **WHEN** 用户回答本身模糊（如「越快越好」，边界 B4）
- **THEN** propose MUST 标 `[待确认]` 或在流程最终确认门提出
- **AND** MUST NOT 为该回答伪造硬约束条目

#### Scenario: 硬约束与既有代码矛盾

- **WHEN** 硬约束与代码交叉验证结果矛盾（边界 B5）
- **THEN** SHALL 以代码事实为优先证据
- **AND** 矛盾 SHALL 在流程最终确认门呈现，MUST NOT 静默选择任一方

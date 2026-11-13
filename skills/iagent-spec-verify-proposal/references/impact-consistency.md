# 影响范围一致性检查细则（提案验证门）

> 本文件是「影响面制品存在性判定」（流程节点 N3）与「影响范围一致性检查」（流程节点 N5，并入 D2/D3）的细则展开。主 SKILL 正文是唯一执行顺序；冲突时以主文件为准。

## 1. 存在性判定矩阵（N3）

| 制品 | 判定锚点 | 缺失处置 |
| :--- | :--- | :--- |
| `proposal.md` 影响面 | `## Impact` 下影响面分析小节（影响面分析 / Impact Analysis） | 检查点 SKIP 排除分母 |
| `design.md` 影响面 | `## Context` 下架构影响小节（架构影响 / Architecture Impact） | 同上 |
| `tasks.md` 影响面 | `### Caller Updates` 小节 | 同上 |

- 判定以**小节标题锚点**为准；语义等价标题（不同措辞指向同一内容）MAY 计为存在，MUST 能指出对应之处，拿不准标「待验证」且 MUST NOT 据此判 FAIL
- 生成侧来源：三制品由 workflow / auto-workflow 影响分析产出；独立 `iagent-spec-propose` 路径可能无影响面小节 —— 属「影响分析未触发」，合法 SKIP
- 存量 JSON-only 降级（Markdown 缺失且仅有历史 `change.json` / `tasks.json`）→ SKIP + WARN，不阻断评分，验证报告注明

## 2. 对齐核查规则（N5）

| # | 对齐关系 | 核查内容 | 不一致判据 |
| :--- | :--- | :--- | :--- |
| 1 | proposal Impact ↔ design 架构影响 | Impact 声明的影响模块在架构影响小节有对应描述 | 模块名无对应或描述矛盾 |
| 2 | proposal Impact ↔ tasks 承接 | 每个影响模块在 tasks 有对应任务（Caller Updates 条目或直接改动该模块的任务） | 模块无任何任务承接 |
| 3 | design 架构影响 ↔ specs 范围 | 架构影响声明与 specs 能力范围一致 | 声明越出 specs 覆盖范围 |

- **语义等价**：模块措辞不同但指向同一目标 MAY 计为对齐（如「库存服务」与「inventory 模块」），MUST 指出具体对应之处，MUST NOT 笼统放行
- **只报能定位的偏差**：每条不一致输出「模块名 + 断裂点（tasks 缺承接 / design 矛盾 / specs 越界）」，MUST NOT 仅给出百分比

## 3. 评分并入与处置（D2/D3）

| 情形 | 处置 |
| :--- | :--- |
| 三制品均存在且全部对齐 | 影响范围一致性 PASS；D2/D3 评分计入该结论（报告标注各制品对齐状态） |
| 三制品均存在但任一脱节 | 计入评分 **FAIL**，逐条列出偏差模块 |
| 任一制品缺失（影响分析未触发） | 检查点 **SKIP**，从总分分母排除（不计入 triggered_count），MUST NOT 按 0 分拉低总分、MUST NOT 判 FAIL |
| 存量 JSON-only 降级 | **SKIP + WARN**（注明降级原因），验证报告注明该处置 |

- 缺失处置与 D10 缺失处理（SKIP 排除分母）同构：缺失向后兼容，脱节才惩罚
- 本检查点为**只读评分**（本技能无 Write/Edit），修复建议仅呈现给调用方，由 propose 阶段或用户处置

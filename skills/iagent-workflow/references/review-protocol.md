### 实现后 review 环节（4.4 细则）

- **调用形态**：由主 agent 内联调用 `iagent-review` skill（`executionMode=inline` / `independence=self`，self 记 WARN），MUST NOT 派发子代理；review 检查功能实现完整度（规格→实现对照、缺口行为、明显缺陷），MUST NOT 重复 spec_verify 的一致性清单。
- **报告落盘（强制）**：结论写入 `.openspec-tmp/pipeline-<change-name>/review-report.md`，文末汇总行 `**summary**: pass|not-applicable|fail`；报告纳入归档桥前置（5.1 就绪检查读取其一）。
- **问题分级与预算**：P0/P1 → 回 Phase 4 修复循环（与编译 / 测试共用既有 ≤3 预算）后重跑 review，3 次耗尽仍未收束 → 暂停并报告；未收束（`fail`）MUST NOT 进入 5.1 归档确认门。P2 → 记录到 review 报告，不阻断流程推进。
- **not-applicable 直通**：变更范围无代码改动（纯制品 / 文档变更）→ review 判定 `not-applicable` 并留痕，直接进入 Phase 5。
- **降级二分（strict / 显式 degraded）**：`iagent-review` 不可用（宿主不支持内联调用且未经显式 degraded 协商）→ strict 阻断并报告，记录「本阶段未发生内联技能调用」，MUST NOT 静默跳过、MUST NOT 伪装为「已审查」；仅宿主显式协商 degraded 时才降级为本地深度复查 + WARN 透明记录。

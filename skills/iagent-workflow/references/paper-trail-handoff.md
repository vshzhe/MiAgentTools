### 探索→提案纸迹衔接（编排口径）

- **唯一过桥载体**：`exploration.md` 是探索阶段进入提案阶段的唯一过桥载体。Phase 2 委派 MUST 传 `explorationFile`，MUST NOT 以父级对话摘要、回执正文或临时记忆替代。
- **字段原样透传**：探索回执的 `flowBaselineConfirmed` 与 `paperTrailStatus` SHALL 由父级原样记录并透传，MUST NOT 被改写；字段缺失时 MUST NOT 静默补默认值。
- **父级复核纸迹自证**：收到 `paperTrailStatus=complete` 时，父级 SHALL 至少核对一次 `exploration.md` 的 Decisions / 术语表 / ADR 三项确实存在或有显式「无」字面量；核对不一致时 SHALL 记 WARN 并按实际值透传，MUST NOT 静默采信子级自证（复核纠偏不等于改写子级值）。
- **唯一停点不变**：纸迹校验 MUST 在探索的流程最终确认门之内完成，MUST NOT 在 Phase 2 追加第二次用户停顿，MUST NOT 因 `paperTrailStatus=incomplete` 自动阻断管线（由流程门内的用户处置决定）。
- **只读消费**：`spec-verify` / `spec-apply` / `spec-archive` 只读复用 handoff 包 `## 硬约束`；`## 阶段结论` 的追加只由具备 `Write` 权限的 apply / archive 执行（verify 只读，不声称已追加）。

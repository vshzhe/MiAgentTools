## Context

当前 VenusAgentTools 中需求文档的生成时机由以下调用链控制：

```
tr-impl-auto-workflow (Phase 5) ──references──▶ spec-archive (step 4.8) ──delegates──▶ tr-docs-requirement-doc
tr-impl-workflow      (Guardrails) ──references──▶ spec-archive (step 4.8)
tr-impl-genfull       (Stage 4)    ──delegates──▶ spec-archive (step 4.8)
tr-impl-debug         (Phase 7)    ──references──▶ spec-archive (step 4.8)
```

三个工作流模板（auto-workflow / workflow / genfull）均明确**禁止**在验证阶段生成需求文档，将生成推迟到归档阶段。需求文档技能（tr-docs-requirement-doc）的 Caller note 也仅列归档阶段为合法自动调用方。

**核心问题**：验证通过时 proposal/specs/design 均已齐备且交叉验证——这是制品质量最高的时刻。推迟到归档阶段（实现完成后）生成：
- 用户在整个实现阶段没有结构化需求文档可对照排查
- 生成的文档反映的是"最终制品"而非"设计意图"

**修改策略**：将需求文档生成从归档阶段**上移**到验证阶段（Phase 3 / Stage 2 收束），归档阶段改为"对齐为主"。

## Goals / Non-Goals

**Goals**:
- 验证通过后自动生成需求文档（非交互模式），使用户在实现前就能获得结构化需求文档
- 归档阶段保持需求文档的增量对齐能力（保留人工域）
- 向后兼容存量变更（未经新流程的变更归档时仍能生成）
- 模板正文一致性——所有引用点同步更新

**Non-Goals**:
- 不改变需求文档的格式/章节结构
- 不改变需求文档的输出路径
- 不改变独立手动调用需求文档技能的行为
- 不改变 debug 工作流的需求文档禁令

## Decisions

### D1: 需求文档生成时机
- **选择**: 验证通过 + 深度复查收束后立即生成（Phase 3 / Stage 2）
- **理由**: 
  - 提案验证通过时所有设计制品（proposal/specs/design）已齐备，生成的文档质量最高
  - 用户在实现前就能获得结构化需求文档，便于对照排查
  - 生成失败非阻断——不阻塞实现流程
- **备选**: 保持在归档阶段生成（当前行为）
  - 否决原因：用户在整个实现阶段无可对照的需求文档

### D2: 归档阶段行为
- **选择**: 文档已存在 → 增量对齐（保留人工域）；不存在 → 仍生成（后向兼容）
- **理由**:
  - 新流程的变更在验证阶段已生成，归档时只需对齐
  - 存量变更未经新流程，归档时仍需生成——保持零破坏性
  - 减少重复的完整生成开销
- **备选**: 归档阶段完全移除需求文档生成
  - 否决原因：破坏存量变更的归档流程

### D3: 生成调用方式
- **选择**: 直接非交互调用 `venus_tr_docs_requirement_doc` skill（非委派）
- **理由**:
  - auto-workflow 和 workflow 是内联 SKILL，不委派阶段 SKILL，直接调用即可
  - genfull 在 Stage 2 收束时直接调用（非委派），区别于 Stage 4 委派 spec_archive
  - 非交互模式避免在自动化流程中弹出交互问题
- **备选**: 委派给 genfull 的阶段 SKILL
  - 否决原因：auto-workflow/workflow 无阶段委派机制，genfull Stage 2 收束是编排器内联逻辑

### D4: allowedTools 白名单更新
- **选择**: auto-workflow 和 workflow 的 `skillDelegation` 增加 `tr_docs_requirement_doc`
- **理由**: 验证阶段新增对需求文档技能的调用，需在权限白名单中放行
- **注意**: genfull 已通过 `spec_archive` 间接放行，但 Stage 2 直接调用也需新增白名单条目

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 验证阶段生成的文档在实现阶段被代码细节"推翻"——实现可能与设计有偏差 | 归档阶段增量对齐会从最终制品重新派生章节一~七，覆盖实现偏差 |
| 模板正文修改引入 regression（某处遗漏更新导致表述不一致） | 全量 grep 覆盖所有引用点；`pnpm build && pnpm generate:skills && pnpm test` 验证 |
| genfull Stage 2 直接调用 `tr_docs_requirement_doc` 违反其"委派不内联"原则 | 需求文档生成是编排器收束逻辑的一部分，非阶段执行；genfull 的委派原则针对 explore/propose/apply/archive 阶段 SKILL |
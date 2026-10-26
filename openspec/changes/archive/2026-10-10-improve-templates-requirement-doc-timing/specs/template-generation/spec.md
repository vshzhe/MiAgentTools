## MODIFIED Requirements

### Requirement: 需求文档生成时机
系统 SHALL 在提案验证通过后（Phase 3 / Stage 2 收束阶段）自动生成需求文档，而非等到归档阶段（Phase 5 / Stage 4）。

#### Scenario: 全自动工作流验证通过后生成需求文档
- **WHEN** `venus_tr_impl_auto_workflow` Phase 3 验证通过（≥90%）且深度复查收束
- **THEN** 系统 SHALL 以非交互模式调用 `venus_tr_docs_requirement_doc` 生成需求文档到 `openspec/changes/<change-name>/需求文档.md`
- **AND** 生成成功后自动进入 Phase 4（Auto-Apply）
- **AND** 生成失败时记录 WARN 并继续进入 Phase 4（非阻断）

#### Scenario: 引导式工作流验证通过后生成需求文档
- **WHEN** `venus_tr_impl_workflow` Phase 3 验证通过且深度复查收束
- **THEN** 系统 SHALL 以非交互模式调用 `venus_tr_docs_requirement_doc` 生成需求文档
- **AND** 生成成功后报告 "apply-ready"
- **AND** 生成失败时记录 WARN（非阻断）

#### Scenario: 全流程编排器提案阶段生成需求文档
- **WHEN** `venus_tr_impl_genfull` Stage 2 提案验证通过 + 深度复查收束
- **THEN** 编排器 SHALL 在 Stage 2.3 收束时以非交互模式调用 `venus_tr_docs_requirement_doc` 生成需求文档
- **AND** MUST NOT 等待到 Stage 4 归档阶段再生成
- **AND** 生成的文档随变更目录流转到后续阶段

### Requirement: 归档阶段需求文档行为
归档阶段（`venus_spec_archive` step 4.8）SHALL 调整为"对齐为主、生成为辅"模式。

#### Scenario: 归档时需求文档已存在则增量对齐
- **WHEN** 归档预检查点（step 4.8）检测到 `openspec/changes/<change-name>/需求文档.md` 已存在
- **THEN** 系统 SHALL 执行就地增量对齐——从当前制品（proposal/design/tasks/specs）重新派生章节 一~七
- **AND** SHALL 保留人工域 `## 基本信息` 和 `## 八、评审记录` 逐字不变
- **AND** MUST NOT 调用 `venus_tr_docs_requirement_doc` skill（避免覆盖人工内容）

#### Scenario: 归档时需求文档不存在则后向兼容生成
- **WHEN** 归档预检查点（step 4.8）检测到需求文档不存在
- **THEN** 系统 SHALL 以非交互模式委派 `venus_tr_docs_requirement_doc` 生成需求文档
- **AND** 向后兼容存量变更（未经新验证流程的旧变更归档时仍能生成需求文档）
- **AND** 生成失败记录 WARN 并继续归档（非阻断）

### Requirement: 需求文档技能自动调用方扩展
`venus_tr_docs_requirement_doc` 技能的 Caller note SHALL 将自动调用方从"仅归档阶段"扩展为"验证阶段 + 归档阶段"。

#### Scenario: 非交互模式调用方识别
- **WHEN** `venus_tr_docs_requirement_doc` 以非交互模式被调用
- **THEN** 技能 SHALL 接受来自验证阶段（workflow/auto-workflow/genfull Stage 2）或归档阶段的调用
- **AND** 行为不变：不询问用户、使用占位符基本信息
- **AND** 独立手动调用（Standalone 模式）行为不受影响

### Requirement: 模板正文一致性
所有引用需求文档生成时机的模板正文 SHALL 保持一致——不再声称"需求文档由归档阶段生成"。

#### Scenario: tr-impl-debug 归档引用同步
- **WHEN** `venus_tr_impl_debug` Phase 7 引用归档阶段的需求文档生成
- **THEN** 引用文本 SHALL 反映新时机（验证阶段生成、归档阶段对齐）
- **AND** Phase 7 的需求文档禁令 SHALL 保持（debug 工作流不生成需求文档）

#### Scenario: tr-impl-auto-migration 引用同步
- **WHEN** `venus_tr_impl_auto_migration` 引用归档阶段的需求文档生成
- **THEN** 引用文本 SHALL 反映新时机
- **AND** 若有类似"归档时生成"的独立逻辑 SHALL 同步调整
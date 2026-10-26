# Spec Delta

## REMOVED Requirements

### Requirement: spec-propose 模板 SHALL 按合并 JSON 主产物生成提案
**Reason**: 新变更不再以 change.json/tasks.json 为真源。
**Migration**: spec-propose 按 OpenSpec 依赖序直接创建 proposal.md、specs/design Markdown 和 tasks.md，生成后运行 Markdown 校验。

### Requirement: 生成协议 artifact-generation.md SHALL 承载 JSON-first 步骤（单一源）
**Reason**: 共享协议改为 Markdown-first。
**Migration**: 由新的 Markdown 生成协议取代，JSON 仅用于 CLI 状态响应。

### Requirement: requirement-doc SHALL 从 change.json 结构化获取章节内容
**Reason**: 需求文档应读取 OpenSpec Markdown 真源。
**Migration**: 按 proposal.md、design.md、specs/**/*.md 和 tasks.md 的标准章节提取内容。

### Requirement: spec-archive / spec-bulk-archive SHALL 从 change.json specs 段执行主 spec 同步
**Reason**: delta spec 本身已经是 OpenSpec Markdown，重复从 JSON 分类没有必要。
**Migration**: 归档技能直接解析 delta spec Markdown，并对结构错误报告诊断。

### Requirement: debug Phase 6 SHALL 以 JSON-first 同步提案
**Reason**: 调试修复应直接更新 Markdown 制品。
**Migration**: debug 按需更新 proposal.md、design.md、spec delta 和 tasks.md，并在修改后校验。

### Requirement: 验证与复查技能 SHALL 优先读 JSON，MD 降级
**Reason**: Markdown 不再是降级来源，而是新变更的权威来源。
**Migration**: verify、verify-proposal 和 proposal-review 主链路读取 Markdown；历史 JSON-only 变更只读兼容并 WARN。

### Requirement: spec-apply SHALL 优先从 change.json 读取实现上下文
**Reason**: apply 上下文改由 OpenSpec Markdown 提供。
**Migration**: apply 读取 proposal.md、design.md、specs/**/*.md 和 tasks.md，完成任务后直接更新 tasks.md。

## ADDED Requirements

### Requirement: Spec skills use Markdown as the artifact contract
spec-explore、spec-propose、spec-apply、spec-verify、spec-verify-proposal、spec-archive 和 spec-bulk-archive SHALL 将 OpenSpec Markdown 作为新变更的读写契约。技能 MAY 使用 CLI 的 JSON 摘要获取状态，但 MUST NOT 将 JSON 响应或缓存当作制品真源。

#### Scenario: Propose writes standard artifacts
- **WHEN** spec-propose 完成规划制品
- **THEN** SHALL 生成 proposal.md、适用的 design.md、specs/<capability>/spec.md 和 tasks.md
- **AND** MUST NOT 生成 change.json 或 tasks.json

#### Scenario: Apply updates task Markdown
- **WHEN** spec-apply 完成一个任务
- **THEN** SHALL 在 tasks.md 中将对应 checkbox 更新为 `[x]`
- **AND** MUST NOT 通过更新 tasks.json 或重新渲染覆盖 tasks.md

#### Scenario: Verify reads Markdown
- **WHEN** spec-verify 或 spec-verify-proposal 执行检查
- **THEN** SHALL 从 Markdown Requirement/Scenario、设计决策和任务清单取得证据
- **AND** 对历史 JSON-only 变更才允许只读降级并记录 WARN

### Requirement: Spec-to-task traceability is mandatory
spec-propose SHALL 为每个可测 Scenario 生成对应的测试或实现任务，并使用可读的 `Spec Ref` 或 `Scenario Ref` 关联 capability、Requirement 和 Scenario。spec-verify-proposal 和 spec-verify SHALL 报告未覆盖或失效的引用。

#### Scenario: Scenario has an implementation task
- **WHEN** specs 中存在可实现的 Scenario
- **THEN** tasks.md SHALL 包含关联任务及其 Spec Ref/Scenario Ref

#### Scenario: Scenario has no test
- **WHEN** Scenario 被判断为不可测
- **THEN** SHALL 生成带 `[测试]` 标签的记录任务，说明已评估且无需测试的依据
- **AND** MUST NOT 静默省略评估

### Requirement: Skills validate before advancing stages
spec-propose、spec-apply、spec-verify 和 spec-archive SHALL 在进入下一阶段前执行适用的 Markdown 结构、依赖和一致性校验。错误必须包含路径和行号；技能不得以创建 JSON 副本来绕过校验。

#### Scenario: Proposal cannot advance with invalid spec
- **WHEN** spec delta 缺少 Requirement Scenario 结构
- **THEN** propose/verify SHALL 阻止或报告进入 apply，并列出可定位修复项

#### Scenario: Scope change is explicit
- **WHEN** apply 发现必须缩小或推迟规格行为才能完成任务
- **THEN** SHALL 暂停并要求用户确认，同时更新对应 Markdown 制品
- **AND** MUST NOT 静默勾选任务

### Requirement: Markdown reading is selective and shareable
spec-apply 的多 Agent 调度 SHALL 使用从 Markdown 解析出的共享 `context-pack.md` 和单元任务清单，避免每个子代理重复读取完整制品。共享包是蒸馏视图，不替代 Markdown；发现缺口时必须回读真实制品并回报。

#### Scenario: Multi-agent batch uses one context pack
- **WHEN** 一个批次包含至少两个派发单元
- **THEN** 协调者 SHALL 一次生成 context-pack.md 并向各单元提供任务与 Spec Ref
- **AND** 子代理 MUST NOT 重复扫描已覆盖的 Markdown 和代码查询

#### Scenario: Context pack has a gap
- **WHEN** 子代理发现共享包缺少必要契约
- **THEN** SHALL 读取真实 Markdown 补查并回报缺口
- **AND** 协调者 SHALL 尝试补充共享包并记录失败警告

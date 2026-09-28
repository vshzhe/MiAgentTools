/**
 * 内置 artifact 模板（proposal / specs / design / tasks）。
 *
 * 内容结构对齐 openspec spec-driven 模板（design D5：契约对齐，技能正文仅换命令名）。
 * 模板由 venus spec instructions 分发给技能正文填充。
 */

export const PROPOSAL_TEMPLATE = `## Why

<!-- 为什么需要这个变更：解决什么问题，为什么是现在 -->

## What Changes

<!-- 变更内容清单：新增能力、修改点、移除项。破坏性变更标注 **BREAKING** -->

## Capabilities

### New Capabilities
<!-- 新增能力，kebab-case 命名，每个能力对应一个 specs/<name>/spec.md -->
- \`<name>\`: <能力简述>

### Modified Capabilities
<!-- 需求发生变化 的既有能力（仅 spec 级行为变化，不含实现细节）。无则留空 -->
- \`<existing-name>\`: <变更的需求>

## Impact

### 直接影响的文件

- \`<file-path>\`: <变更说明>

### 向后兼容

<!-- 破坏性变更与迁移策略；无破坏性变更则写"无" -->
`;

export const SPECS_TEMPLATE = `## ADDED Requirements

### Requirement: <!-- 需求名 -->
<!-- 需求描述：使用 SHALL/MUST 规范语言 -->

#### Scenario: <!-- 场景名 -->
- **WHEN** <!-- 条件 -->
- **THEN** <!-- 预期结果 -->

<!-- 操作类型：ADDED（新能力）/ MODIFIED（行为变化，须含完整更新内容）/ REMOVED（须含 Reason 与 Migration）/ RENAMED（FROM:/TO: 格式） -->
<!-- 硬性约束：每条需求至少一个场景；场景必须精确使用 #### 四级标题 -->
`;

export const DESIGN_TEMPLATE = `## Context

<!-- 相关代码、架构现状、影响链（来自探索阶段的分析结论） -->

## Goals / Non-Goals

**Goals**:
- <!-- 本变更要达成什么 -->

**Non-Goals**:
- <!-- 明确不做什么 -->

## Decisions

### D<N>: <!-- 决策点 -->
- **选择**: <!-- 方案 -->
- **理由**: <!-- 为什么这样选 -->
- **备选**: <!-- 被否决的方案与原因 -->

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| <!-- 风险 --> | <!-- 缓解措施 --> |
`;

export const TASKS_TEMPLATE = `# Tasks: <change-name>

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/）
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]，形如 \`- [ ] [测试][单元][P0] 1.2 <任务描述>\`
     补充文档类（非 [代码]/[测试]）MUST 含 \`产出:\` 字段指定输出路径 -->

## 1. <任务组名>

- [ ] 1.1 [代码] <任务描述>
  - 文件：\`<file-path>\`
  - 验证：<验证方式>

- [ ] 1.2 [测试][单元][P0] <测试任务描述>
  - 文件：\`<test-file-path>\`
  - 验证：<验证方式>
`;

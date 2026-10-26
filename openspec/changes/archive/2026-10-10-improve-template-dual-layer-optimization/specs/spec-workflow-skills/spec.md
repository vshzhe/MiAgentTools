# spec-workflow-skills Delta Spec

## ADDED Requirements

### Requirement: SKILL 模板 references 机制启用
spec-* 技能模板 SHALL 使用 `SkillTemplate.references` 字段，将大于 50 行的独立文本段（Gate 全文、输出示例、检查矩阵）移入 `references/*.md` 文件，主 SKILL.md 正文通过紧凑版渲染函数（`buildPromptGateCompact` / `buildFlowchartCompact`）引用核心判定规则，并显式引导 AI 在 Gate 触发时按需 `Read` 完整细则。

#### Scenario: spec-explore 使用 Compact Gate + references
- **WHEN** 安装 spec-explore 技能
- **THEN** SKILL.md 的 instructions 含 `${PROMPT_GATE_COMPACT}`（~12 行）和 `${FLOWCHART_COMPACT}`（~8 行），`references/prompt-gate.md` 和 `references/flowchart-gate.md` 含完整版 Gate 文本

#### Scenario: AI 按需读取 references
- **WHEN** spec-explore 的提示词校验门被触发（输入不明确，进入 Step 3 优化流程）
- **THEN** AI 按指令中的引导句读取 `references/prompt-gate.md` 获取完整 Step 3-5 流程细节

#### Scenario: references 文件随 update 自动同步
- **WHEN** `venus update` 刷新 spec-explore 技能
- **THEN** syncReferences 先 removeDir 旧 references/ 再 writeSkillReferences 新 references，无旧文件残留

## MODIFIED Requirements

### Requirement: spec 技能类型注册
原需求不变。新增约束：spec-* 模板的 `allowedTools` 中 Read 工具 SHALL 覆盖 references 文件的读取场景（已有 Read 白名单的模板无需改动）。

### Requirement: spec-explore 探索技能
原需求不变。修改点：
- 提示词校验门由 `${PROMPT_GATE}`（全文）改为 `${PROMPT_GATE_COMPACT}`（紧凑版 ~12 行）
- 功能流程图由 `${FLOWCHART}`（全文）改为 `${FLOWCHART_COMPACT}`（紧凑版 ~8 行）
- 新增 references 字段输出（prompt-gate.md + flowchart-gate.md）
- 原各场景行为不变

### Requirement: spec-propose 提案技能
原需求不变。新增：
- 生成的 instructions 中添加 JSON sidecar 生成指令（~15 行）
- 生成的 instructions 中添加 SQLite 冲突检测步骤（index.db 可用时 ~10 行）

### Requirement: spec-apply 实现技能
原需求不变。新增：
- 任务状态读取优先从 tasks.json（降级解析 tasks.md）
- 输出示例块移入 references/output-examples.md

### Requirement: spec-verify 验证技能
原需求不变。新增：
- 结构化验证：优先读 tasks.json + capabilities.json 做对比

### Requirement: spec-archive 归档技能
原需求不变。新增：
- 归档后写入 SQLite 索引
- 输出示例块移入 references/output-examples.md
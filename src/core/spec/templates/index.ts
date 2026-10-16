/**
 * 内置 artifact 模板（proposal / specs / design / tasks）。
 *
 * 内容结构对齐 openspec spec-driven 模板（design D5：契约对齐，技能正文仅换命令名）。
 * 模板由 iagent spec instructions 分发给技能正文填充。
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

// ── JSON 模板（JSON-primary 真源示例：change.json 段落 / tasks.json）────
// 供 iagent spec instructions 的 jsonTemplate 字段分发；JSONC 注释仅作字段说明，实际写入不得含注释。

/** change.json 的 proposal 段模板（字段与 ChangeSchema/ProposalSection 对齐） */
export const PROPOSAL_JSON_TEMPLATE = `// change.json 的 proposal 段（文件：openspec/changes/<name>/change.json）
// JSONC 注释仅作字段说明；实际写入的 JSON 不得含注释
// 写入前先读取 change.json，保留已有段（design/specs）与根字段现值，再合并写回
{
    "$schema": "iagent/change/v1",           // 固定值
    "changeName": "<change-name>",          // string：kebab-case，与变更目录同名
    "createdAt": "<ISO 8601>",              // string：创建时间（iagent spec new 已初始化）
    "updatedAt": "<ISO 8601>",              // string：最后更新时间（写回时刷新）
    "phase": "proposal",                    // "proposal" | "apply" | "archive"
    "proposal": {
        "why": "<为什么需要这个变更：解决什么问题、为什么是现在>",       // string
        "whatChanges": [                                            // string[]：变更内容清单
            "<变更项：新增能力/修改点/移除项，破坏性变更标注 **BREAKING**>"
        ],
        "capabilities": {                                           // 涉及能力
            "new": [                                                // CapabilityDecl[]：{ name: string; description: string }
                { "name": "<new-capability>", "description": "<能力简述>" }
            ],
            "modified": [                                           // 形状同 new，无则空数组 []
                { "name": "<existing-name>", "description": "<变更的需求>" }
            ]
        },
        "impact": {
            "files": [                                              // ImpactFile[]：{ path: string; description: string }
                { "path": "<file-path>", "description": "<变更说明>" }
            ],
            "breaking": false,                                      // boolean：是否含破坏性变更
            "compatibility": "<向后兼容说明；无破坏性变更写无>"        // string
        }
    }
}
`;

/** change.json 的 specs 段模板（字段与 SpecEntry/SpecOperation/ScenarioEntry 对齐） */
export const SPECS_JSON_TEMPLATE = `// change.json 的 specs 段（文件：openspec/changes/<name>/change.json）
// JSONC 注释仅作字段说明；实际写入的 JSON 不得含注释
// 写入前先读取 change.json，保留已有段（proposal/design）与根字段现值，再合并写回
{
    "$schema": "iagent/change/v1",
    "changeName": "<change-name>",
    "createdAt": "<ISO 8601>",
    "updatedAt": "<ISO 8601>",
    "phase": "proposal",
    "specs": [                                  // SpecEntry[]：每个能力一个条目
        {
            "name": "<capability-name>",        // string：kebab-case，与 proposal 段 Capabilities 对应
            "path": "specs/<capability-name>/spec.md",   // string：spec.md 渲染目标路径
            "operations": [                     // SpecOperation[]：type 取值 ADDED | MODIFIED | REMOVED | RENAMED
                {
                    "type": "ADDED",            // 新需求：description + scenarios 必填
                    "requirement": "<需求名>",  // string
                    "description": "<需求描述：SHALL/MUST 规范语言>",   // string
                    "scenarios": [              // ScenarioEntry[]：每条需求至少一个场景
                        { "name": "<场景名>", "given": "<前置条件，无则空字符串>", "when": "<条件>", "then": "<预期结果>" }
                    ]
                },
                {
                    "type": "MODIFIED",         // 行为变化：形状同 ADDED，须含完整更新内容
                    "requirement": "<需求名>",
                    "description": "<需求描述：SHALL/MUST 规范语言>",
                    "scenarios": [
                        { "name": "<场景名>", "given": "", "when": "<条件>", "then": "<预期结果>" }
                    ]
                },
                {
                    "type": "REMOVED",          // 移除需求：reason + migration 必填
                    "requirement": "<需求名>",
                    "reason": "<移除原因>",      // string
                    "migration": "<迁移策略>"    // string
                },
                {
                    "type": "RENAMED",          // 重命名需求：from + to 必填
                    "requirement": "<需求名>",
                    "from": "<原需求名>",        // string
                    "to": "<新需求名>"           // string
                }
            ]
        }
    ]
}
`;

/** change.json 的 design 段模板（字段与 DesignSection/DecisionEntry/RiskEntry 对齐） */
export const DESIGN_JSON_TEMPLATE = `// change.json 的 design 段（文件：openspec/changes/<name>/change.json）
// JSONC 注释仅作字段说明；实际写入的 JSON 不得含注释
// 写入前先读取 change.json，保留已有段（proposal/specs）与根字段现值，再合并写回
{
    "$schema": "iagent/change/v1",
    "changeName": "<change-name>",
    "createdAt": "<ISO 8601>",
    "updatedAt": "<ISO 8601>",
    "phase": "proposal",
    "design": {
        "context": "<相关代码、架构现状、影响链（来自探索阶段的分析结论）>",   // string
        "goals": ["<本变更要达成什么>"],                                     // string[]
        "nonGoals": ["<明确不做什么>"],                                      // string[]
        "decisions": [                                                      // DecisionEntry[]
            {
                "id": "D1",                          // string：决策编号
                "title": "<决策点>",                  // string
                "choice": "<选择的方案>",             // string
                "alternatives": ["<被否决的方案与原因>"],   // string[]
                "rationale": "<为什么这样选>",        // string
                "risks": ["<该决策的风险>"],          // string[]
                "relatedFiles": ["<file-path:line>"]        // string[]
            }
        ],
        "risks": [                                  // RiskEntry[]：{ risk: string; mitigation: string }
            { "risk": "<风险>", "mitigation": "<缓解措施>" }
        ]
    }
}
`;

/** tasks.json 模板（独立文件，字段与 TasksSchema/TaskEntry 对齐） */
export const TASKS_JSON_TEMPLATE = `// tasks.json（文件：openspec/changes/<name>/tasks.json，独立文件，不并入 change.json）
// JSONC 注释仅作字段说明；实际写入的 JSON 不得含注释
{
    "$schema": "iagent/tasks/v1",           // 固定值
    "tasks": [                             // TaskEntry[]
        {
            "id": "1.1",                   // string：任务编号
            "label": "代码",                // 类型标签（渲染时自动加方括号）：代码 | 测试 | DB脚本 | 使用说明
            "description": "<任务描述：含涉及文件与验证方式，支持多行子列表>",   // string
            "status": "pending",           // "pending" | "done"
            "dependencies": [],            // string[]：依赖的任务 id（如 ["1.1"]）
            "files": ["<file-path>"],      // string[]：涉及/产出的文件
            "batchGroup": "1. <任务组名>"   // 可选：tasks.md 中 "## N" 分组标题（含序号前缀）
        },
        {
            "id": "1.2",                   // 测试任务示例：subLabel/priority 仅测试任务填写
            "label": "测试",
            "subLabel": "单元",             // 单元 | 功能（渲染为 [单元]）
            "priority": "P0",              // P0 | P1 | P2（渲染为 [P0]）
            "description": "<测试任务描述>",
            "status": "pending",
            "dependencies": ["1.1"],
            "nodeRef": "N4",               // 可选：流程图节点引用
            "specRef": "<spec requirement 引用>",   // 可选：对应的 spec requirement
            "files": ["<test-file-path>"],
            "batchGroup": "1. <任务组名>"
        }
    ],
    "progress": { "total": 2, "complete": 0, "remaining": 2 }   // 进度统计（写入时自动重算）
}
`;

/**
 * Artifact JSON Sidecar Schema 类型定义。
 *
 * JSON sidecar 为 Markdown artifact 的只读加速层：
 *   - 从 MD 提取结构化元数据，供下游 SKILL 精确消费
 *   - MD 是唯一真源，JSON 与 MD 不一致时以 MD 为准
 *   - JSON 缺失时下游 MUST 降级解析 MD，不得阻断
 *
 * 四类 sidecar 文件存储于变更目录 .venus/ 下：
 *   openspec/changes/<name>/.venus/manifest.json
 *   openspec/changes/<name>/.venus/tasks.json
 *   openspec/changes/<name>/.venus/decisions.json
 *   openspec/changes/<name>/.venus/capabilities.json
 */

/** 变更生命周期阶段 */
export type ChangePhase = 'proposal' | 'apply' | 'archive';

/** 任务状态 */
export type TaskStatus = 'pending' | 'done';

/** 能力操作类型 */
export type CapabilityOperation = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED';

// ── manifest.json ────────────────────────────────────────────────

/** manifest.json：变更元信息 */
export interface ManifestSchema {
    /** JSON schema 版本标识 */
    $schema: 'venus/manifest/v1';
    /** 变更名（kebab-case） */
    changeName: string;
    /** 创建时间 ISO 8601 */
    createdAt: string;
    /** 最后更新时间 ISO 8601 */
    updatedAt: string;
    /** 涉及的能力名列表 */
    capabilities: string[];
    /** 影响面（如 "前端页面", "后端Service", "数据库"） */
    impactAreas: string[];
    /** 变更当前阶段 */
    phase: ChangePhase;
}

// ── tasks.json ───────────────────────────────────────────────────

/** tasks.json：单个任务条目 */
export interface TaskEntry {
    /** 任务编号（如 "1.1"） */
    id: string;
    /** 类型标签：[代码]/[测试]/[DB脚本]/[使用说明] */
    label: string;
    /** 测试子标签（仅 [测试] 类型）：[单元]/[功能] */
    subLabel?: string;
    /** 测试优先级（仅 [测试] 类型）：P0/P1/P2 */
    priority?: string;
    /** 任务描述 */
    description: string;
    /** 执行状态 */
    status: TaskStatus;
    /** 依赖的任务 id 列表 */
    dependencies: string[];
    /** 流程图节点引用（如 "N4"） */
    nodeRef?: string;
    /** 对应 spec requirement 引用 */
    specRef?: string;
    /** 涉及的文件列表 */
    files: string[];
    /** 批次分组标签 */
    batchGroup?: string;
}

/** tasks.json：任务清单 */
export interface TasksSchema {
    /** JSON schema 版本标识 */
    $schema: 'venus/tasks/v1';
    /** 任务条目数组 */
    tasks: TaskEntry[];
    /** 进度统计 */
    progress: {
        total: number;
        complete: number;
        remaining: number;
    };
}

// ── decisions.json ───────────────────────────────────────────────

/** decisions.json：单个技术决策 */
export interface DecisionEntry {
    /** 决策编号（如 "D1"） */
    id: string;
    /** 决策标题 */
    title: string;
    /** 选择的方案 */
    choice: string;
    /** 被否决的备选方案 */
    alternatives: string[];
    /** 选择理由 */
    rationale: string;
    /** 风险 */
    risks: string[];
    /** 相关文件（文件路径:行号） */
    relatedFiles: string[];
}

/** decisions.json：技术决策清单 */
export interface DecisionsSchema {
    /** JSON schema 版本标识 */
    $schema: 'venus/decisions/v1';
    /** 决策条目数组 */
    decisions: DecisionEntry[];
}

// ── capabilities.json ────────────────────────────────────────────

/** capabilities.json：单个场景 */
export interface ScenarioEntry {
    /** 场景名 */
    name: string;
    /** GIVEN 前置条件 */
    given: string;
    /** WHEN 触发条件 */
    when: string;
    /** THEN 预期结果 */
    then: string;
}

/** capabilities.json：单个能力操作 */
export interface CapabilityOperationEntry {
    /** 操作类型 */
    type: CapabilityOperation;
    /** 需求名 */
    requirement: string;
    /** 场景列表 */
    scenarios: ScenarioEntry[];
}

/** capabilities.json：单个能力 */
export interface CapabilityEntry {
    /** 能力名 */
    name: string;
    /** 操作列表 */
    operations: CapabilityOperationEntry[];
}

/** capabilities.json：能力映射 */
export interface CapabilitiesSchema {
    /** JSON schema 版本标识 */
    $schema: 'venus/capabilities/v1';
    /** 能力条目数组 */
    capabilities: CapabilityEntry[];
}

// ── 辅助函数 ─────────────────────────────────────────────────────

/** 创建空的 manifest.json 模板 */
export function createEmptyManifest(changeName: string): ManifestSchema {
    const now = new Date().toISOString();
    return {
        $schema: 'venus/manifest/v1',
        changeName,
        createdAt: now,
        updatedAt: now,
        capabilities: [],
        impactAreas: [],
        phase: 'proposal',
    };
}

/** 创建空的 tasks.json 模板 */
export function createEmptyTasks(): TasksSchema {
    return {
        $schema: 'venus/tasks/v1',
        tasks: [],
        progress: { total: 0, complete: 0, remaining: 0 },
    };
}

/** 创建空的 decisions.json 模板 */
export function createEmptyDecisions(): DecisionsSchema {
    return {
        $schema: 'venus/decisions/v1',
        decisions: [],
    };
}

/** 创建空的 capabilities.json 模板 */
export function createEmptyCapabilities(): CapabilitiesSchema {
    return {
        $schema: 'venus/capabilities/v1',
        capabilities: [],
    };
}

/** 校验 phase 值是否合法 */
export function isValidPhase(value: string): value is ChangePhase {
    return ['proposal', 'apply', 'archive'].includes(value);
}

/** 校验 task status 值是否合法 */
export function isValidTaskStatus(value: string): value is TaskStatus {
    return ['pending', 'done'].includes(value);
}

/** 校验 capability operation 值是否合法 */
export function isValidOperation(value: string): value is CapabilityOperation {
    return ['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'].includes(value);
}
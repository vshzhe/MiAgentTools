/**
 * Artifact JSON Schema 类型定义（合并主产物 + 遗留 sidecar）。
 *
 * 主产物（JSON-primary —— JSON 为结构化数据真源，Markdown 由代码渲染）：
 *   openspec/changes/<name>/change.json          —— proposal / design / specs 三段合并
 *   openspec/changes/<name>/tasks.json          —— 任务清单（独立，不并入）
 *
 * 渲染：sidecar-writer.ts 的 renderProposalMd / renderDesignMd / renderSpecsMd / renderTasksMd。
 * 遗留 sidecar（manifest / decisions / capabilities，标 @deprecated）保留供存量变更降级读取：
 *   openspec/changes/<name>/.venus/manifest.json
 *   openspec/changes/<name>/.venus/decisions.json
 *   openspec/changes/<name>/.venus/capabilities.json
 */

/** 变更生命周期阶段 */
export type ChangePhase = 'proposal' | 'apply' | 'archive';

/** 任务状态 */
export type TaskStatus = 'pending' | 'done';

/** 能力操作类型 */
export type CapabilityOperation = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED';

// ── manifest.json（@deprecated —— 字段已吸收进 change.json 根结构）──

/** manifest.json：变更元信息
 * @deprecated 由 ChangeSchema 根字段取代；仅保留供存量变更降级读取
 */
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

// ── change.json（合并主产物：proposal / design / specs 三段）─────

/** proposal 段：能力声明（new 与 modified 共用形状） */
export interface CapabilityDecl {
    /** 能力名（kebab-case） */
    name: string;
    /** 能力简述（new）/ 变更的需求（modified） */
    description: string;
}

/** proposal 段：能力分组 */
export interface ProposalCapabilities {
    /** 新增能力 */
    new: CapabilityDecl[];
    /** 需求发生变化的既有能力 */
    modified: CapabilityDecl[];
}

/** proposal 段：受影响文件 */
export interface ImpactFile {
    /** 文件路径 */
    path: string;
    /** 变更说明 */
    description: string;
}

/** proposal 段：影响面 */
export interface ImpactSection {
    /** 直接影响的文件列表 */
    files: ImpactFile[];
    /** 是否含破坏性变更 */
    breaking: boolean;
    /** 向后兼容说明（无破坏性变更时写"无"） */
    compatibility: string;
}

/** change.json 的 proposal 段 */
export interface ProposalSection {
    /** 为什么需要这个变更 */
    why: string;
    /** 变更内容清单 */
    whatChanges: string[];
    /** 涉及能力 */
    capabilities: ProposalCapabilities;
    /** 影响面 */
    impact: ImpactSection;
}

/** design 段：风险与缓解 */
export interface RiskEntry {
    /** 风险描述 */
    risk: string;
    /** 缓解措施 */
    mitigation: string;
}

/** change.json 的 design 段 */
export interface DesignSection {
    /** 架构上下文（自由文本） */
    context: string;
    /** 目标 */
    goals: string[];
    /** 非目标 */
    nonGoals: string[];
    /** 技术决策（复用 DecisionEntry） */
    decisions: DecisionEntry[];
    /** 风险与权衡 */
    risks: RiskEntry[];
}

/** specs 段：单个需求操作（含 REMOVED/RENAMED 完整字段） */
export interface SpecOperation {
    /** 操作类型 */
    type: CapabilityOperation;
    /** 需求名 */
    requirement: string;
    /** 需求描述（SHALL/MUST 规范语言；ADDED/MODIFIED 必填） */
    description?: string;
    /** 场景列表（ADDED/MODIFIED 使用） */
    scenarios?: ScenarioEntry[];
    /** 移除原因（REMOVED 必填） */
    reason?: string;
    /** 迁移策略（REMOVED 必填） */
    migration?: string;
    /** 原需求名（RENAMED 必填） */
    from?: string;
    /** 新需求名（RENAMED 必填） */
    to?: string;
}

/** specs 段：单个能力 */
export interface SpecEntry {
    /** 能力名（kebab-case） */
    name: string;
    /** 渲染目标路径（如 specs/<name>/spec.md） */
    path: string;
    /** 需求操作列表 */
    operations: SpecOperation[];
}

/** change.json specs 段（数组嵌套，键序确定） */
export type SpecsSection = SpecEntry[];

/** change.json 根结构（proposal/design/specs 三段合并主产物） */
export interface ChangeSchema {
    /** JSON schema 版本标识 */
    $schema: 'venus/change/v1';
    /** 变更名（kebab-case） */
    changeName: string;
    /** 创建时间 ISO 8601 */
    createdAt: string;
    /** 最后更新时间 ISO 8601 */
    updatedAt: string;
    /** 变更当前阶段 */
    phase: ChangePhase;
    /** 提案段（生成流程第一段） */
    proposal?: ProposalSection;
    /** 设计段（跨切面变更时提供） */
    design?: DesignSection;
    /** 规格段（skip_specs 变更可缺省） */
    specs?: SpecsSection;
}

// ── decisions.json（@deprecated —— 已吸收进 change.json 的 design 段）──

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

/** decisions.json：技术决策清单
 * @deprecated 由 DesignSection.decisions 取代；仅保留供存量变更降级读取
 */
export interface DecisionsSchema {
    /** JSON schema 版本标识 */
    $schema: 'venus/decisions/v1';
    /** 决策条目数组 */
    decisions: DecisionEntry[];
}

// ── capabilities.json（@deprecated —— 已吸收进 change.json 的 specs 段）──

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

/** capabilities.json：能力映射
 * @deprecated 由 SpecsSection 取代；仅保留供存量变更降级读取
 */
export interface CapabilitiesSchema {
    /** JSON schema 版本标识 */
    $schema: 'venus/capabilities/v1';
    /** 能力条目数组 */
    capabilities: CapabilityEntry[];
}

// ── 辅助函数 ─────────────────────────────────────────────────────

/** 创建空的 change.json 骨架（三段缺省，根字段就绪） */
export function createEmptyChange(changeName: string): ChangeSchema {
    const now = new Date().toISOString();
    return {
        $schema: 'venus/change/v1',
        changeName,
        createdAt: now,
        updatedAt: now,
        phase: 'proposal',
    };
}

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
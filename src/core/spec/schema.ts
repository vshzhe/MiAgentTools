/**
 * spec-driven 依赖图定义（内置硬编码）。
 *
 * 按 ADR-0001：iagent spec 命令组不读取外部 schema.yaml，
 * 依赖关系在此处以常量形式定义，new/status/instructions/archive 四命令共享引用。
 *
 * 依赖图：proposal（无依赖）→ specs / design（依赖 proposal）→ tasks（依赖 specs + design）
 * apply 门槛：requires=[tasks]，进度跟踪文件 tracks=tasks.md
 */

/** 单个 artifact 的定义 */
export interface ArtifactSpec {
    /** artifact 标识（如 proposal / specs / design / tasks） */
    id: string;
    /** 用途说明 */
    description: string;
    /** 输出路径（相对变更目录），支持目录递归 glob（如 specs 下任意深度的 .md 文件） */
    outputPath: string;
    /** 依赖的前置 artifact id 列表 */
    requires: string[];
    /** 生成该 artifact 的指导说明 */
    instruction: string;
}

/** apply 阶段配置 */
export interface ApplySpec {
    /** 进入 apply 前必须完成的 artifact id 列表 */
    requires: string[];
    /** 任务进度跟踪文件（相对变更目录） */
    tracks: string;
}

/** 完整 schema 定义 */
export interface SpecSchema {
    /** schema 名称（写入 .openspec.yaml 的 schema 字段） */
    schemaName: string;
    /** 全部 artifact（声明顺序即构建顺序基准） */
    artifacts: ArtifactSpec[];
    /** apply 阶段配置 */
    apply: ApplySpec;
}

/** 内置 spec-driven schema（唯一支持的 schema） */
export const SPEC_DRIVEN_SCHEMA: SpecSchema = {
    schemaName: 'spec-driven',
    artifacts: [
        {
            id: 'proposal',
            description: '变更提案：为什么需要这个变更、改什么、影响是什么',
            outputPath: 'proposal.md',
            requires: [],
            instruction:
                '直接创建 openspec/changes/<name>/proposal.md，使用 OpenSpec 的 Why / What Changes / Capabilities / Impact 结构；Markdown 是唯一真源，不创建 change.json。',
        },
        {
            id: 'specs',
            description: '能力规格：每个能力一个 spec 文件，定义系统应当做什么',
            outputPath: 'specs/**/*.md',
            requires: ['proposal'],
            instruction:
                '按 proposal.md 的 Capabilities 为每个能力创建 specs/<capability>/spec.md，使用 OpenSpec 的 ADDED/MODIFIED/REMOVED/RENAMED Requirements 与四级 Scenario 标题；每条需求必须可验证。',
        },
        {
            id: 'design',
            description: '技术设计：上下文、目标、技术决策与风险（跨切面变更时创建）',
            outputPath: 'design.md',
            requires: ['proposal'],
            instruction:
                '直接创建 openspec/changes/<name>/design.md，使用 Context / Goals / Non-Goals / Decisions / Risks 结构说明实现方式；仅跨切面、依赖、性能或迁移复杂度需要。',
        },
        {
            id: 'tasks',
            description: '实现任务清单：带类型标签的可勾选任务列表',
            outputPath: 'tasks.md',
            requires: ['specs', 'design'],
            instruction:
                '直接创建 openspec/changes/<name>/tasks.md（Markdown 是唯一真源），将规格映射为实现任务：每个任务含类型标签（代码/测试/DB脚本/使用说明）、描述与文件；[测试] 任务 MUST 带层级（单元/功能）与优先级（P0/P1/P2）；可测规格场景 MUST 产出对应 [测试] 任务，不可测场景也 MUST 产出 [测试] 任务记录"已评估、判定无需测试"的依据；每个任务标注 Spec Ref/Scenario Ref。',
        },
    ],
    apply: {
        requires: ['tasks'],
        tracks: 'tasks.md',
    },
};

/** 按声明顺序的拓扑构建序（Kahn 算法，兄弟节点按声明序而非字母序） */
export function getBuildOrder(): string[] {
    const order: string[] = [];
    const completed = new Set<string>();
    const pending = SPEC_DRIVEN_SCHEMA.artifacts.map((a) => a.id);
    while (pending.length > 0) {
        // 每轮取第一个依赖已全部满足的 artifact（保持声明顺序）
        const nextIndex = pending.findIndex((id) => {
            const spec = SPEC_DRIVEN_SCHEMA.artifacts.find((a) => a.id === id);
            return spec !== undefined && spec.requires.every((dep) => completed.has(dep));
        });
        if (nextIndex < 0) {
            // 依赖图中存在环（常量定义错误，防御性抛出）
            throw new Error(`spec-driven 依赖图存在循环依赖：${pending.join(' -> ')}`);
        }
        const [next] = pending.splice(nextIndex, 1);
        order.push(next);
        completed.add(next);
    }
    return order;
}

/** 校验 artifact id 是否合法（不合法时返回 false） */
export function isValidArtifactId(artifactId: string): boolean {
    return SPEC_DRIVEN_SCHEMA.artifacts.some((a) => a.id === artifactId);
}

/** 全部合法 artifact id（错误提示用） */
export function getArtifactIds(): string[] {
    return SPEC_DRIVEN_SCHEMA.artifacts.map((a) => a.id);
}

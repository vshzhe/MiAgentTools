/**
 * 规则与技能的三层归类（动态加载内核）。
 *
 * 纯函数、无 I/O —— 规则源与技能条目由调用方注入，便于单测与 CLI / 技能复用。
 *
 * 三层语义（见 `openspec/specs/rule-selection/spec.md`）：
 *   - `always`    常驻基线：`.iagent/config.yaml`、`CLAUDE.md`、`AGENTS.md`（恒读，不参与筛选）
 *   - `phase`     阶段相关：`.iagent/rules/<type>.md` 中与技能类型匹配的规则文件
 *   - `onDemand`  按需点读：其余存在的规则源，须由调用方声明理由后才读取
 *
 * 类型 → 文件名映射 MUST 走 `project-config.ts` 的 `RULE_FILE_NAMES` / `ruleFileNameFor`
 * （单一源），MUST NOT 在本模块另立映射表。
 */

import type { SkillType } from './config.js';
import { RULE_FILE_NAMES, ruleFileNameFor } from './project-config.js';

/** 规则源（与 `iagent rules --json` 的 `RuleSource` 结构对齐的最小形状） */
export interface RuleSourceLike {
    /** 项目相对路径（正斜杠） */
    path: string;
    /** 源类型 */
    kind: 'config' | 'rule-file' | 'claude-md' | 'agents-md';
    /** 是否存在 */
    exists: boolean;
}

/** 三层读取结果 */
export interface RuleClassification {
    /** 常驻基线（恒读） */
    always: RuleSourceLike[];
    /** 阶段相关（按技能类型） */
    phase: RuleSourceLike[];
    /** 按需点读（其余存在的源） */
    onDemand: RuleSourceLike[];
    /** phase 层是否为空并回退到常驻基线 */
    fallback: boolean;
    /** 回退原因（fallback 为 true 时） */
    fallbackReason?: string;
}

/** 归类选项 */
export interface ClassifyOptions {
    /** 当前技能类型（决定 phase 层内容）；缺省时 phase 层为空并回退 */
    type?: SkillType;
}

/**
 * 把规则源分为三层。
 *
 * 只有 `exists=true` 的源进入结果 —— 不存在的源不构成读取项（由调用方记「不存在」）。
 *
 * @param sources - 规则源列表（`iagent rules --json` 的 `sources`）
 * @param options - 归类选项（技能类型）
 */
export function classifyRuleSources(
    sources: readonly RuleSourceLike[],
    options: ClassifyOptions = {},
): RuleClassification {
    const always: RuleSourceLike[] = [];
    const phase: RuleSourceLike[] = [];
    const onDemand: RuleSourceLike[] = [];

    // phase 层目标文件名（该技能类型对应的规则文件）
    const phaseFileName = options.type === undefined ? undefined : ruleFileNameFor(options.type);

    for (const source of sources) {
        if (!source.exists) continue;

        // 常驻基线：config / CLAUDE.md / AGENTS.md —— 恒读，MUST NOT 落入其余层
        if (isAlwaysSource(source)) {
            always.push(source);
            continue;
        }

        // 阶段相关：文件名命中该技能类型的规则文件
        if (phaseFileName !== undefined && isRuleFileNamed(source, phaseFileName)) {
            phase.push(source);
            continue;
        }

        onDemand.push(source);
    }

    if (phase.length === 0) {
        const reason = options.type === undefined
            ? '未指定技能类型，无阶段相关规则'
            : `技能类型「${options.type}」无对应规则文件（期望 ${phaseFileName ?? '<type>.md'}）`;
        return {
            always,
            phase,
            onDemand,
            fallback: true,
            fallbackReason: `${reason}；已回退常驻基线（MUST NOT 回退为全量）`,
        };
    }

    return { always, phase, onDemand, fallback: false };
}

/** 是否为常驻基线源 */
function isAlwaysSource(source: RuleSourceLike): boolean {
    return source.kind === 'config' || source.kind === 'claude-md' || source.kind === 'agents-md';
}

/** 源是否为该文件名的 `.iagent/rules/` 规则文件 */
function isRuleFileNamed(source: RuleSourceLike, fileName: string): boolean {
    if (source.kind !== 'rule-file') return false;
    const normalized = source.path.replaceAll('\\', '/');
    return normalized === `.iagent/rules/${fileName}` || normalized.endsWith(`/rules/${fileName}`);
}

/** 技能条目的最小形状（与 `collectProjectSkills` 输出对齐） */
export interface SkillEntryLike {
    /** 技能名 */
    name: string;
    /** 技能文件路径 */
    path: string;
    /** 是否存在 */
    exists: boolean;
    /** 阶段标签：design / implement / both / null */
    phases: string | null;
    /** 范围标签：backend / frontend / null */
    scope: string | null;
}

/** 技能筛选选项 */
export interface SelectSkillOptions {
    /** 阶段：design 匹配 {design, both}；implement 匹配 {implement, both} */
    phase?: 'design' | 'implement';
    /** 范围过滤（可选）；不传或 null 时不做范围排除 */
    scope?: 'backend' | 'frontend' | null;
}

/**
 * 按阶段与范围筛选技能条目。
 *
 * - `phase`：沿用既有 `phases` 语义（design → {design, both}；implement → {implement, both}）
 * - `scope`：可选过滤；`scope: null` 的存量条目 **不排除**（向后兼容）
 *
 * @param entries - 技能条目列表
 * @param options - 筛选选项
 */
export function selectSkillEntries<T extends SkillEntryLike>(
    entries: readonly T[],
    options: SelectSkillOptions = {},
): T[] {
    return entries.filter((entry) => {
        if (entry.exists !== true) return false;
        if (options.phase !== undefined && !matchesPhase(entry.phases, options.phase)) return false;
        if (options.scope !== undefined && options.scope !== null && !matchesScope(entry.scope, options.scope)) return false;
        return true;
    });
}

/** 阶段匹配：both 同时满足 design 与 implement */
function matchesPhase(phases: string | null, phase: 'design' | 'implement'): boolean {
    if (phases === null) return false;
    const normalized = phases.trim().toLowerCase();
    return normalized === phase || normalized === 'both';
}

/** 范围匹配：`null` 视为未声明，不排除 */
function matchesScope(scope: string | null, expected: 'backend' | 'frontend'): boolean {
    if (scope === null || scope.trim() === '') return true;
    return scope.trim().toLowerCase() === expected;
}

/** 该技能类型是否有规则文件映射（供诊断与文档使用） */
export function hasRuleFileFor(type: SkillType): boolean {
    return RULE_FILE_NAMES[type] !== undefined;
}

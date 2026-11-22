/**
 * 提案就绪门（`spec-readiness-gate`）。
 *
 * 确定性组合校验（纯函数、无 I/O —— 证据由调用方注入），四类判定：
 *   1. 结构完整：四类制品存在且无 error 级诊断；
 *   2. 覆盖完整：每个 Requirement 有承接任务、每个 Scenario 有 [测试] 任务；
 *   3. 锚点齐备：影响面三锚点存在且非空；
 *   4. 能力对齐：proposal 声明的能力 ↔ specs/<capability>/ 目录逐一对应。
 *
 * MUST NOT 含 AI 语义判定 —— 语义判定留在验证阶段（Phase 3），作为确定性判定之外的增量。
 * 存量/新变更严格度依据变更目录 `.openspec.yaml` 的 `created`（D3）。
 */

import type {
    ArtifactDiagnostic,
    ParsedChange,
    ParsedProposal,
} from '../model/artifact-model.js';
import { validateParsedChange } from './artifact-validator.js';
import { buildConformance } from './conformance.js';
import { VERIFY_ANCHORS, ANCHOR_ARTIFACTS } from './anchors.js';

/** 就绪门能力生效日期（此日之后创建的变更按新变更严格度判定） */
export const READINESS_EFFECTIVE_DATE = '2026-11-22';

/** 单类判定结果 */
export interface ReadinessCheck {
    /** 判定名：structure / coverage / anchors / capabilities */
    id: 'structure' | 'coverage' | 'anchors' | 'capabilities';
    /** 判定标题（用于输出） */
    label: string;
    /** pass / fail / skipped */
    status: 'pass' | 'fail' | 'skipped';
    /** 跳过原因（status=skipped 时） */
    skipReason?: string;
}

/** 就绪门选项 */
export interface ReadinessOptions {
    /** 变更创建时间（`.openspec.yaml` 的 created）；缺失按新变更处理（fail-safe） */
    created?: string;
    /** 变更声明 skip_specs：能力对齐判定豁免且不参与分母 */
    skipSpecs?: boolean;
    /** 历史 JSON-only 变更：只读降级（锚点判定跳过） */
    legacyJson?: boolean;
}

/** 就绪门结果 */
export interface ReadinessResult {
    /** 全部判定通过（skipped 不计入失败） */
    valid: boolean;
    checks: ReadinessCheck[];
    diagnostics: ArtifactDiagnostic[];
    /** 被跳过的判定 id（SKIP 排除分母，不按 0 分拉低） */
    skipped: string[];
    /** 被跳过的判定是否因存量兼容（记 WARN 而非 error） */
    legacyWarnings: ArtifactDiagnostic[];
}

/**
 * 判定变更是新变更还是存量变更。
 *
 * `created` 缺失或不可解析时按**新变更**处理（fail-safe：更严格，防规避）。
 */
export function isNewChange(created: string | undefined, effectiveDate = READINESS_EFFECTIVE_DATE): boolean {
    if (created === undefined || created.trim() === '') return true;
    const parsed = Date.parse(`${created.trim()}T00:00:00Z`);
    if (Number.isNaN(parsed)) return true;
    const effective = Date.parse(`${effectiveDate}T00:00:00Z`);
    return parsed >= effective;
}

/**
 * 执行就绪门判定。
 *
 * @param change - 已解析的变更模型（由调用方按 Markdown 构造，MUST NOT 在此做 I/O）
 * @param options - 变更元数据（created / skipSpecs / legacyJson）
 */
export function buildReadiness(change: ParsedChange, options: ReadinessOptions = {}): ReadinessResult {
    const diagnostics: ArtifactDiagnostic[] = [];
    const legacyWarnings: ArtifactDiagnostic[] = [];
    const checks: ReadinessCheck[] = [];
    const skipped: string[] = [];
    const newChange = isNewChange(options.created);

    // ── 1. 结构完整 ───────────────────────────────────────────────
    const structure = checkStructure(change, newChange, diagnostics, legacyWarnings);
    checks.push(structure.check);
    if (structure.check.status === 'skipped') skipped.push(structure.check.id);

    // ── 2. 覆盖完整 ───────────────────────────────────────────────
    const coverage = checkCoverage(change, diagnostics);
    checks.push(coverage);
    if (coverage.status === 'skipped') skipped.push(coverage.id);

    // ── 3. 锚点齐备 ───────────────────────────────────────────────
    const anchors = checkAnchors(change, options, newChange, diagnostics, legacyWarnings);
    checks.push(anchors);
    if (anchors.status === 'skipped') skipped.push(anchors.id);

    // ── 4. 能力对齐 ───────────────────────────────────────────────
    const capabilities = checkCapabilities(change, options, diagnostics);
    checks.push(capabilities);
    if (capabilities.status === 'skipped') skipped.push(capabilities.id);

    return {
        valid: checks.every((check) => check.status !== 'fail'),
        checks,
        diagnostics,
        skipped,
        legacyWarnings,
    };
}

interface StructureOutcome {
    check: ReadinessCheck;
}

/** 判定 1：四类制品存在且无 error 级结构诊断 */
function checkStructure(
    change: ParsedChange,
    newChange: boolean,
    diagnostics: ArtifactDiagnostic[],
    legacyWarnings: ArtifactDiagnostic[],
): StructureOutcome {
    const result = validateParsedChange(change);
    const errors = result.diagnostics.filter((item) => item.severity === 'error');
    const warnings = result.diagnostics.filter((item) => item.severity !== 'error');

    // 结构错误对新变更记 error、对存量记 warning（存量兼容，不阻断）
    if (newChange) {
        diagnostics.push(...result.diagnostics);
    } else {
        diagnostics.push(...warnings);
        legacyWarnings.push(
            ...errors.map((item) => ({ ...item, severity: 'warning' as const, code: `${item.code ?? 'structure'}-legacy` })),
        );
    }
    const failed = newChange ? errors.length > 0 : false;
    return {
        check: {
            id: 'structure',
            label: '结构完整',
            status: failed ? 'fail' : 'pass',
        },
    };
}

/** 判定 2：Requirement 有承接任务、Scenario 有 [测试] 任务 */
function checkCoverage(change: ParsedChange, diagnostics: ArtifactDiagnostic[]): ReadinessCheck {
    if (change.specs.length === 0 || change.tasks === undefined) {
        return {
            id: 'coverage',
            label: '覆盖完整',
            status: 'skipped',
            skipReason: 'specs 或 tasks 缺失，无法判定覆盖（缺失向后兼容）',
        };
    }
    const result = buildConformance(change.specs, change.tasks.tasks, {
        tasksFilePath: change.tasks.filePath,
    });
    for (const finding of result.findings) {
        diagnostics.push({
            severity: 'error',
            code: finding.code,
            message: finding.message,
            filePath: finding.filePath,
            line: finding.line,
        });
    }
    return {
        id: 'coverage',
        label: '覆盖完整',
        status: result.findings.length === 0 ? 'pass' : 'fail',
    };
}

/** 判定 3：影响面三锚点存在且非空 */
function checkAnchors(
    change: ParsedChange,
    options: ReadinessOptions,
    newChange: boolean,
    diagnostics: ArtifactDiagnostic[],
    legacyWarnings: ArtifactDiagnostic[],
): ReadinessCheck {
    if (options.legacyJson === true) {
        return {
            id: 'anchors',
            label: '锚点齐备',
            status: 'skipped',
            skipReason: '历史 JSON-only 变更，无 Markdown 锚点可判',
        };
    }
    const targets: Array<{
        artifact: string;
        anchor: string;
        present: boolean;
        filePath: string;
    }> = [
        {
            artifact: ANCHOR_ARTIFACTS.impactAnalysis,
            anchor: VERIFY_ANCHORS.impactAnalysis,
            present: hasSubHeading(change.proposal, VERIFY_ANCHORS.impactAnalysis),
            filePath: change.proposal?.filePath ?? '',
        },
        {
            artifact: ANCHOR_ARTIFACTS.architectureImpact,
            anchor: VERIFY_ANCHORS.architectureImpact,
            present: hasDesignAnchor(change),
            filePath: change.design?.filePath ?? '',
        },
        {
            artifact: ANCHOR_ARTIFACTS.callerUpdates,
            anchor: VERIFY_ANCHORS.callerUpdates,
            present: hasHeadingInRaw(change.tasks?.rawContent, VERIFY_ANCHORS.callerUpdates),
            filePath: change.tasks?.filePath ?? '',
        },
    ];

    let failedCount = 0;
    let legacyMissing = 0;
    for (const target of targets) {
        if (target.present) continue;
        // design 为可选制品：缺失时不强制（D8 的 SKIP 先例）
        if (target.artifact === ANCHOR_ARTIFACTS.architectureImpact && change.design === undefined) continue;
        const message = `${target.artifact} 缺少验证锚点：### ${target.anchor}`
            + `（验证门的影响范围一致性检查依赖该小节）`;
        const diagnostic: ArtifactDiagnostic = {
            severity: newChange ? 'error' : 'warning',
            code: 'missing-verify-anchor',
            message,
            filePath: target.filePath,
            line: 1,
        };
        if (newChange) {
            diagnostics.push(diagnostic);
            failedCount += 1;
        } else {
            legacyWarnings.push(diagnostic);
            legacyMissing += 1;
        }
    }

    if (failedCount > 0) {
        return { id: 'anchors', label: '锚点齐备', status: 'fail' };
    }
    if (legacyMissing > 0) {
        // 存量：锚点缺失只记 WARN，判定计入 skipped（不阻断）
        return {
            id: 'anchors',
            label: '锚点齐备',
            status: 'skipped',
            skipReason: `存量变更缺少 ${legacyMissing} 个验证锚点（记 WARN，不阻断）`,
        };
    }
    return { id: 'anchors', label: '锚点齐备', status: 'pass' };
}

/** 判定 4：proposal 声明能力 ↔ specs 目录 */
function checkCapabilities(
    change: ParsedChange,
    options: ReadinessOptions,
    diagnostics: ArtifactDiagnostic[],
): ReadinessCheck {
    if (options.skipSpecs === true) {
        return {
            id: 'capabilities',
            label: '能力对齐',
            status: 'skipped',
            skipReason: '变更声明 skip_specs，能力对齐豁免',
        };
    }
    if (change.proposal === undefined || change.specs.length === 0) {
        return {
            id: 'capabilities',
            label: '能力对齐',
            status: 'skipped',
            skipReason: 'proposal 或 specs 缺失，无法判定能力对齐',
        };
    }

    const declared = new Set(change.proposal.capabilities.map((item) => item.name));
    const actual = new Set(change.specs.map((spec) => spec.capability));
    let failed = false;

    for (const item of change.proposal.capabilities) {
        if (actual.has(item.name)) continue;
        failed = true;
        diagnostics.push({
            severity: 'error',
            code: 'capability-without-spec',
            message: `proposal 声明能力「${item.name}」但缺少 specs/${item.name}/spec.md`,
            filePath: change.proposal.filePath,
            line: item.line,
        });
    }
    for (const capability of actual) {
        if (declared.has(capability)) continue;
        failed = true;
        diagnostics.push({
            severity: 'error',
            code: 'spec-without-capability',
            message: `specs/${capability}/spec.md 存在但未在 proposal 的 Capabilities 声明`,
            filePath: change.specs.find((spec) => spec.capability === capability)?.filePath ?? '',
            line: 1,
        });
    }

    return {
        id: 'capabilities',
        label: '能力对齐',
        status: failed ? 'fail' : 'pass',
    };
}

/** proposal `sections` 是否含指定三级子标题 */
function hasSubHeading(proposal: ParsedProposal | undefined, anchor: string): boolean {
    if (proposal === undefined) return false;
    return hasHeadingInRaw(proposal.rawContent, anchor);
}

/** design 的 `## Context` 之下是否含「架构影响」子标题 */
function hasDesignAnchor(change: ParsedChange): boolean {
    if (change.design === undefined) return true; // 可选制品：缺失时不在本判定内惩罚
    return hasHeadingInRaw(change.design.rawContent, VERIFY_ANCHORS.architectureImpact);
}

/** 原文中是否含指定文本的 ATX 标题（`#`~`######`，忽略代码围栏内） */
function hasHeadingInRaw(rawContent: string | undefined, anchor: string): boolean {
    if (rawContent === undefined) return false;
    let fenced = false;
    for (const line of rawContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (/^(```|~~~)/.test(trimmed)) {
            fenced = !fenced;
            continue;
        }
        if (fenced) continue;
        const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
        if (match !== null && match[2].trim() === anchor) return true;
    }
    return false;
}

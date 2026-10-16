/**
 * 技能模板注册表。
 *
 * 汇总全部内置技能模板，并派生每个技能对应的斜杠指令模板。
 * 指令 id 规则：技能名 iagent_<功能名> → 指令 id <功能名连字符化>
 * 例：iagent_spec_apply → spec-apply → .claude/commands/iagent/spec-apply.md
 */

import { SKILL_PREFIX, SKILL_TYPES, type SkillType } from '../config.js';
import type { SkillTemplate, SkillTemplateEntry, CommandTemplate } from './types.js';
import { getProjectInitSkillTemplate, getProjectInitCommandTemplate } from './workflows/project-init.js';
import {
    getMigrationCheckSkillTemplate,
    getMigrationCheckCommandTemplate,
} from './workflows/migration-check.js';
import {
    getMigrationSkillTemplate,
    getMigrationCommandTemplate,
} from './workflows/migration.js';
import {
    getWorkflowSkillTemplate,
    getWorkflowCommandTemplate,
} from './workflows/workflow.js';
import {
    getAutoWorkflowSkillTemplate,
    getAutoWorkflowCommandTemplate,
} from './workflows/auto-workflow.js';
import {
    getDebugSkillTemplate,
    getDebugCommandTemplate,
} from './workflows/debug.js';
import { getTestSkillTemplate, getTestCommandTemplate } from './workflows/test.js';
import { getCommitSkillTemplate, getCommitCommandTemplate } from './workflows/commit.js';
import {
    getSvnCommitSkillTemplate,
    getSvnCommitCommandTemplate,
} from './workflows/svn-commit.js';
import { getReviewSkillTemplate, getReviewCommandTemplate } from './workflows/review.js';
import { getFeatureDocSkillTemplate, getFeatureDocCommandTemplate } from './workflows/feature-doc.js';
import {
    getRequirementDocSkillTemplate,
    getRequirementDocCommandTemplate,
} from './workflows/requirement-doc.js';
import { getSpecExploreSkillTemplate, getSpecExploreCommandTemplate } from './workflows/spec-explore.js';
import { getSpecProposeSkillTemplate, getSpecProposeCommandTemplate } from './workflows/spec-propose.js';
import {
    getSpecApplyChangeSkillTemplate,
    getSpecApplyChangeCommandTemplate,
} from './workflows/spec-apply.js';
import {
    getSpecArchiveChangeSkillTemplate,
    getSpecArchiveChangeCommandTemplate,
} from './workflows/spec-archive.js';
import {
    getSpecBulkArchiveSkillTemplate,
    getSpecBulkArchiveCommandTemplate,
} from './workflows/spec-bulk-archive.js';
import {
    getSpecVerifyChangeSkillTemplate,
    getSpecVerifyChangeCommandTemplate,
} from './workflows/spec-verify.js';
import {
    getSpecVerifyProposalSkillTemplate,
    getSpecVerifyProposalCommandTemplate,
} from './workflows/spec-verify-proposal.js';
import {
    getProposalReviewSkillTemplate,
    getProposalReviewCommandTemplate,
} from './workflows/proposal-review.js';

/**
 * 从技能名派生斜杠指令 id。
 * iagent_spec_apply → spec-apply（下划线转连字符，去掉 iagent 前缀）
 */
export function deriveCommandId(skillName: string): string {
    if (!skillName.startsWith(SKILL_PREFIX)) {
        throw new Error(`技能名必须以 ${SKILL_PREFIX} 开头：${skillName}`);
    }
    return skillName.slice(SKILL_PREFIX.length).replaceAll('_', '-');
}

/** 技能模板 + 对应指令模板的成对注册项 */
interface WorkflowPair {
    skill: SkillTemplate;
    command: CommandTemplate;
}

/**
 * 斜杠指令模板（白名单已由配对技能回填）。
 *
 * `allowedTools` 在 `CommandTemplate` 侧可选（见 types.ts 说明），经 registry
 * 单点回填后此处收敛为必填，供下游 `CommandContent`（必填）直接透传。
 */
type ResolvedCommandTemplate = CommandTemplate & { allowedTools: string };

/** 全部内置技能（顺序即安装与展示顺序） */
const WORKFLOW_PAIRS: WorkflowPair[] = [
    { skill: getProjectInitSkillTemplate(), command: getProjectInitCommandTemplate() },
    // 迁移套件（impl）：迁移后一致性检查 + 一站式迁移编排
    { skill: getMigrationCheckSkillTemplate(), command: getMigrationCheckCommandTemplate() },
    { skill: getMigrationSkillTemplate(), command: getMigrationCommandTemplate() },
    // 工作流套件（impl）：一站式引导工作流（探索→提案→验证→实现→归档）+ 全自动管线 + 一站式调试 + 提案完整性复查（迁移自 OpenSpec 工作流技能）
    { skill: getWorkflowSkillTemplate(), command: getWorkflowCommandTemplate() },
    { skill: getAutoWorkflowSkillTemplate(), command: getAutoWorkflowCommandTemplate() },
    { skill: getDebugSkillTemplate(), command: getDebugCommandTemplate() },
    { skill: getProposalReviewSkillTemplate(), command: getProposalReviewCommandTemplate() },
    { skill: getTestSkillTemplate(), command: getTestCommandTemplate() },
    { skill: getCommitSkillTemplate(), command: getCommitCommandTemplate() },
    { skill: getSvnCommitSkillTemplate(), command: getSvnCommitCommandTemplate() },
    { skill: getReviewSkillTemplate(), command: getReviewCommandTemplate() },
    // 迁移套件（docs）：源项目功能扫描与需求文档生成
    { skill: getFeatureDocSkillTemplate(), command: getFeatureDocCommandTemplate() },
    // 工作流套件（docs）：变更提案转评审需求文档
    { skill: getRequirementDocSkillTemplate(), command: getRequirementDocCommandTemplate() },
    // 规格驱动工作流（spec 类型，依赖 iagent spec 命令组）
    { skill: getSpecExploreSkillTemplate(), command: getSpecExploreCommandTemplate() },
    { skill: getSpecProposeSkillTemplate(), command: getSpecProposeCommandTemplate() },
    { skill: getSpecApplyChangeSkillTemplate(), command: getSpecApplyChangeCommandTemplate() },
    { skill: getSpecArchiveChangeSkillTemplate(), command: getSpecArchiveChangeCommandTemplate() },
    { skill: getSpecBulkArchiveSkillTemplate(), command: getSpecBulkArchiveCommandTemplate() },
    { skill: getSpecVerifyChangeSkillTemplate(), command: getSpecVerifyChangeCommandTemplate() },
    { skill: getSpecVerifyProposalSkillTemplate(), command: getSpecVerifyProposalCommandTemplate() },
];

/**
 * 获取全部技能模板注册项，可按类型与 workflow 过滤。
 *
 * @param typeFilter - 若提供，仅返回该类型的技能
 * @param workflowFilter - 若提供，仅返回 workflow id（= commandId）在集合内的技能
 */
export function getSkillTemplates(
    typeFilter?: SkillType,
    workflowFilter?: readonly string[]
): SkillTemplateEntry[] {
    let pairs = WORKFLOW_PAIRS;
    if (typeFilter) {
        pairs = pairs.filter((p) => p.skill.type === typeFilter);
    }
    if (workflowFilter) {
        const set = new Set(workflowFilter);
        pairs = pairs.filter((p) => set.has(deriveCommandId(p.skill.name)));
    }
    return pairs.map(({ skill }) => ({
        template: skill,
        commandId: deriveCommandId(skill.name),
    }));
}

/**
 * 获取全部斜杠指令模板，可按类型与 workflow 过滤。
 *
 * @param typeFilter - 若提供，仅返回该类型的指令
 * @param workflowFilter - 若提供，仅返回 workflow id 在集合内的指令
 */
export function getCommandTemplates(
    typeFilter?: SkillType,
    workflowFilter?: readonly string[]
): { template: ResolvedCommandTemplate; id: string }[] {
    let pairs = WORKFLOW_PAIRS;
    if (typeFilter) {
        pairs = pairs.filter((p) => p.skill.type === typeFilter);
    }
    if (workflowFilter) {
        const set = new Set(workflowFilter);
        pairs = pairs.filter((p) => set.has(deriveCommandId(p.skill.name)));
    }
    // 单点回填：指令白名单与其配对技能的白名单保持完全一致
    return pairs.map(({ skill, command }) => ({
        template: { ...command, allowedTools: skill.allowedTools },
        id: deriveCommandId(skill.name),
    }));
}

/**
 * 全部已知指令 id 的集合（由注册表派生，单一真源）。
 *
 * 供模板正文引用校验（`test/command-reference-refs.test.ts`）与生成期按布局改写
 * （`rewriteCommandRefs`）使用。派生规则与 `deriveCommandId` 一致。
 */
export function getKnownCommandIds(): Set<string> {
    return new Set(WORKFLOW_PAIRS.map((p) => deriveCommandId(p.skill.name)));
}

/**
 * 按类型统计技能数量（list 命令展示用）。
 */
export function countSkillsByType(): Map<SkillType, number> {
    const counts = new Map<SkillType, number>();
    for (const { skill } of WORKFLOW_PAIRS) {
        counts.set(skill.type, (counts.get(skill.type) ?? 0) + 1);
    }
    // 无技能的类型也占位为 0，保证类型体系完整展示
    for (const meta of SKILL_TYPES) {
        if (!counts.has(meta.id)) {
            counts.set(meta.id, 0);
        }
    }
    return counts;
}

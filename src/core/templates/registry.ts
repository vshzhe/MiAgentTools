/**
 * 技能模板注册表。
 *
 * 汇总全部类型（tr_*）的技能模板，并派生每个技能对应的斜杠指令模板。
 * 指令 id 规则：技能名 venus_<type>_<name> → 指令 id <type 连字符化>-<name>
 * 例：venus_tools_pwd → tr-tools-pwd → .claude/commands/venus/tr-tools-pwd.md
 */

import { SKILL_PREFIX, SKILL_TYPES, type SkillType } from '../config.js';
import type { SkillTemplate, SkillTemplateEntry, CommandTemplate } from './types.js';
import { getTrInitProjectSkillTemplate, getTrInitProjectCommandTemplate } from './workflows/tr-init.js';
import { getTrImplFeatureSkillTemplate, getTrImplFeatureCommandTemplate } from './workflows/tr-impl.js';
import {
    getTrImplMigrationCheckSkillTemplate,
    getTrImplMigrationCheckCommandTemplate,
} from './workflows/tr-impl-migration-check.js';
import {
    getTrImplAutoMigrationSkillTemplate,
    getTrImplAutoMigrationCommandTemplate,
} from './workflows/tr-impl-auto-migration.js';
import {
    getTrImplWorkflowSkillTemplate,
    getTrImplWorkflowCommandTemplate,
} from './workflows/tr-impl-workflow.js';
import {
    getTrImplAutoWorkflowSkillTemplate,
    getTrImplAutoWorkflowCommandTemplate,
} from './workflows/tr-impl-auto-workflow.js';
import {
    getTrImplGenfullSkillTemplate,
    getTrImplGenfullCommandTemplate,
} from './workflows/tr-impl-genfull.js';
import {
    getTrImplDebugSkillTemplate,
    getTrImplDebugCommandTemplate,
} from './workflows/tr-impl-debug.js';
import { getTrTestGenerateSkillTemplate, getTrTestGenerateCommandTemplate } from './workflows/tr-test.js';
import {
    getTrTestGentestJavaSkillTemplate,
    getTrTestGentestJavaCommandTemplate,
} from './workflows/tr-test-gentest-java.js';
import { getTrCommitChangeSkillTemplate, getTrCommitChangeCommandTemplate } from './workflows/tr-commit.js';
import { getTrReviewCodeSkillTemplate, getTrReviewCodeCommandTemplate } from './workflows/tr-review.js';
import { getTrReleaseVersionSkillTemplate, getTrReleaseVersionCommandTemplate } from './workflows/tr-release.js';
import {
    getTrToolsPwdSkillTemplate,
    getTrToolsPwdCommandTemplate,
    getTrToolsListSkillTemplate,
    getTrToolsListCommandTemplate,
} from './workflows/tr-tools.js';
import { getTrDocsFeatureDocSkillTemplate, getTrDocsFeatureDocCommandTemplate } from './workflows/tr-docs-feature-doc.js';
import {
    getTrDocsRequirementDocSkillTemplate,
    getTrDocsRequirementDocCommandTemplate,
} from './workflows/tr-docs-requirement-doc.js';
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
    getTrImplReviewProposalSkillTemplate,
    getTrImplReviewProposalCommandTemplate,
} from './workflows/tr-impl-review-proposal.js';
import {
    getTrImplFrontendSkillTemplate,
    getTrImplFrontendCommandTemplate,
} from './workflows/tr-impl-frontend.js';


/**
 * 从技能名派生斜杠指令 id。
 * venus_tools_pwd → tr-tools-pwd（下划线转连字符，去掉 venus 前缀）
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

/** 全部内置技能（顺序即安装与展示顺序） */
const WORKFLOW_PAIRS: WorkflowPair[] = [
    { skill: getTrInitProjectSkillTemplate(), command: getTrInitProjectCommandTemplate() },
    { skill: getTrImplFeatureSkillTemplate(), command: getTrImplFeatureCommandTemplate() },
    // 迁移套件（tr_impl）：迁移后一致性检查 + 一站式迁移编排
    { skill: getTrImplMigrationCheckSkillTemplate(), command: getTrImplMigrationCheckCommandTemplate() },
    { skill: getTrImplAutoMigrationSkillTemplate(), command: getTrImplAutoMigrationCommandTemplate() },
    // 工作流套件（tr_impl）：引导工作流 + 全自动管线 + 引导式全流程编排 + 一站式调试 + 提案完整性复查（迁移自 OpenSpec 工作流技能）
    { skill: getTrImplWorkflowSkillTemplate(), command: getTrImplWorkflowCommandTemplate() },
    { skill: getTrImplAutoWorkflowSkillTemplate(), command: getTrImplAutoWorkflowCommandTemplate() },
    { skill: getTrImplGenfullSkillTemplate(), command: getTrImplGenfullCommandTemplate() },
    { skill: getTrImplDebugSkillTemplate(), command: getTrImplDebugCommandTemplate() },
    { skill: getTrImplReviewProposalSkillTemplate(), command: getTrImplReviewProposalCommandTemplate() },
    // 前端套件（tr_impl）：前端页面设计与生成，组件设计决策 + 代码模板生成
    { skill: getTrImplFrontendSkillTemplate(), command: getTrImplFrontendCommandTemplate() },
    { skill: getTrTestGenerateSkillTemplate(), command: getTrTestGenerateCommandTemplate() },
    { skill: getTrTestGentestJavaSkillTemplate(), command: getTrTestGentestJavaCommandTemplate() },
    { skill: getTrCommitChangeSkillTemplate(), command: getTrCommitChangeCommandTemplate() },
    { skill: getTrReviewCodeSkillTemplate(), command: getTrReviewCodeCommandTemplate() },
    { skill: getTrReleaseVersionSkillTemplate(), command: getTrReleaseVersionCommandTemplate() },
    { skill: getTrToolsPwdSkillTemplate(), command: getTrToolsPwdCommandTemplate() },
    { skill: getTrToolsListSkillTemplate(), command: getTrToolsListCommandTemplate() },
    // 迁移套件（tr_docs）：源项目功能扫描与需求文档生成
    { skill: getTrDocsFeatureDocSkillTemplate(), command: getTrDocsFeatureDocCommandTemplate() },
    // 工作流套件（tr_docs）：变更提案转评审需求文档
    { skill: getTrDocsRequirementDocSkillTemplate(), command: getTrDocsRequirementDocCommandTemplate() },
    // 规格驱动工作流（spec 类型，依赖 venus spec 命令组）
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
): { template: CommandTemplate; id: string }[] {
    let pairs = WORKFLOW_PAIRS;
    if (typeFilter) {
        pairs = pairs.filter((p) => p.skill.type === typeFilter);
    }
    if (workflowFilter) {
        const set = new Set(workflowFilter);
        pairs = pairs.filter((p) => set.has(deriveCommandId(p.skill.name)));
    }
    return pairs.map(({ skill, command }) => ({
        template: command,
        id: deriveCommandId(skill.name),
    }));
}

/**
 * 按类型统计技能数量（list 命令展示用）。
 */
export function countSkillsByType(): Map<SkillType, number> {
    const counts = new Map<SkillType, number>();
    for (const { skill } of WORKFLOW_PAIRS) {
        counts.set(skill.type, (counts.get(skill.type) ?? 0) + 1);
    }
    // 无技能的类型也占位为 0，保证 7 类完整展示
    for (const meta of SKILL_TYPES) {
        if (!counts.has(meta.id)) {
            counts.set(meta.id, 0);
        }
    }
    return counts;
}

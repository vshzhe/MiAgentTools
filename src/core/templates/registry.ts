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
import { getTrTestGenerateSkillTemplate, getTrTestGenerateCommandTemplate } from './workflows/tr-test.js';
import { getTrCommitChangeSkillTemplate, getTrCommitChangeCommandTemplate } from './workflows/tr-commit.js';
import { getTrReviewCodeSkillTemplate, getTrReviewCodeCommandTemplate } from './workflows/tr-review.js';
import { getTrReleaseVersionSkillTemplate, getTrReleaseVersionCommandTemplate } from './workflows/tr-release.js';
import {
    getTrToolsPwdSkillTemplate,
    getTrToolsPwdCommandTemplate,
    getTrToolsListSkillTemplate,
    getTrToolsListCommandTemplate,
} from './workflows/tr-tools.js';

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
    { skill: getTrTestGenerateSkillTemplate(), command: getTrTestGenerateCommandTemplate() },
    { skill: getTrCommitChangeSkillTemplate(), command: getTrCommitChangeCommandTemplate() },
    { skill: getTrReviewCodeSkillTemplate(), command: getTrReviewCodeCommandTemplate() },
    { skill: getTrReleaseVersionSkillTemplate(), command: getTrReleaseVersionCommandTemplate() },
    { skill: getTrToolsPwdSkillTemplate(), command: getTrToolsPwdCommandTemplate() },
    { skill: getTrToolsListSkillTemplate(), command: getTrToolsListCommandTemplate() },
];

/**
 * 获取全部技能模板注册项，可按类型过滤。
 *
 * @param typeFilter - 若提供，仅返回该类型的技能
 */
export function getSkillTemplates(typeFilter?: SkillType): SkillTemplateEntry[] {
    const pairs = typeFilter ? WORKFLOW_PAIRS.filter((p) => p.skill.type === typeFilter) : WORKFLOW_PAIRS;
    return pairs.map(({ skill }) => ({
        template: skill,
        commandId: deriveCommandId(skill.name),
    }));
}

/**
 * 获取全部斜杠指令模板，可按类型过滤。
 */
export function getCommandTemplates(typeFilter?: SkillType): { template: CommandTemplate; id: string }[] {
    const pairs = typeFilter ? WORKFLOW_PAIRS.filter((p) => p.skill.type === typeFilter) : WORKFLOW_PAIRS;
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

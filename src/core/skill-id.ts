/**
 * 宿主技能 ID 单一来源。
 *
 * 两种标识严格区分（见变更 add-host-orchestration-adapters）：
 *   - canonical workflowId：既有 commandId（连字符形，如 `spec-explore`），
 *     是 config workflows / 依赖注入 / 指令引用的稳定契约；
 *   - 宿主技能 ID：`iagent-<workflowId>`（如 `iagent-spec-explore`），
 *     作为技能目录名与 frontmatter `name`，符合 Agent Skills 规范
 *     （小写字母、数字、单连字符）。
 *
 * 旧的下划线形态 `iagent_<name>` 仅作为 **legacy alias** 解析：
 * 系统仍能识别、校验、列出、删除与迁移它，但新产物 MUST NOT 再以它作为 canonical。
 *
 * 本模块只依赖 config.ts，避免 registry → templates 的循环导入。
 */

import { COMMAND_NAMESPACE, SKILL_PREFIX } from './config.js';

/** 宿主技能 ID 前缀（kebab-case） */
export const SKILL_ID_PREFIX = `${COMMAND_NAMESPACE}-`;

/**
 * 内部技能名（`iagent_<功能名>`）→ 宿主技能 ID（`iagent-<功能名>`）。
 *
 * 下划线转连字符后即符合 Agent Skills 命名约束。
 *
 * @throws 技能名不以内部前缀开头
 */
export function deriveSkillId(skillName: string): string {
    if (!skillName.startsWith(SKILL_PREFIX)) {
        throw new Error(`技能名必须以 ${SKILL_PREFIX} 开头：${skillName}`);
    }
    return SKILL_ID_PREFIX + skillName.slice(SKILL_PREFIX.length).replaceAll('_', '-');
}

/**
 * 目录名是否为本工具管理的技能产物。
 *
 * 同时接受 canonical（`iagent-`）与 legacy（`iagent_`）两种前缀，
 * 使存量装机的旧产物仍被识别、校验与清理。
 */
export function isManagedSkillDirName(dirName: string): boolean {
    return dirName.startsWith(SKILL_ID_PREFIX) || dirName.startsWith(SKILL_PREFIX);
}

/**
 * 把 legacy 下划线技能目录名规范化为 canonical kebab-case。
 *
 * 已是 canonical 或非本工具管理的名字原样返回。
 */
export function toCanonicalSkillId(dirName: string): string {
    if (dirName.startsWith(SKILL_ID_PREFIX)) {
        return dirName;
    }
    if (dirName.startsWith(SKILL_PREFIX)) {
        return SKILL_ID_PREFIX + dirName.slice(SKILL_PREFIX.length).replaceAll('_', '-');
    }
    return dirName;
}

/** 是否为 legacy（下划线）技能目录名 */
export function isLegacySkillId(dirName: string): boolean {
    return dirName.startsWith(SKILL_PREFIX) && !dirName.startsWith(SKILL_ID_PREFIX);
}

/** 宿主技能 ID / legacy 目录名 → workflowId（去掉前缀，规范化为连字符形） */
export function skillIdToWorkflowId(idOrDirName: string): string {
    const canonical = toCanonicalSkillId(idOrDirName);
    return canonical.startsWith(SKILL_ID_PREFIX)
        ? canonical.slice(SKILL_ID_PREFIX.length)
        : canonical;
}

/**
 * venus list 命令。
 *
 * 列出目标工具目录中已安装的 venus 技能，按生命周期类型分组展示。
 */

import path from 'path';
import {
    AI_TOOLS,
    SKILL_PREFIX,
    SKILL_TYPES,
    isSkillType,
    TOOL_SKILLS_SUBDIR,
    type SkillType,
} from '../core/config.js';
import { listSubdirectories, readFileIfExists } from '../utils/file-system.js';

/** 单个已安装技能的信息 */
export interface InstalledSkillInfo {
    /** 技能目录名（venus_<type>_<name>） */
    name: string;
    /** 从 frontmatter metadata.type 解析出的类型（解析失败为 null） */
    type: SkillType | null;
    /** 从 frontmatter 解析的 description */
    description: string | null;
}

/** list 命令选项 */
export interface ListOptions {
    /** 输出 JSON（供程序处理） */
    json?: boolean;
}

/**
 * 解析 SKILL.md 内容，提取 name / description / metadata.type。
 * 解析失败的字段返回 null，不抛错（容错展示）。
 */
function parseSkillFile(content: string): { type: SkillType | null; description: string | null } {
    const typeMatch = content.match(/^  type: (\S+)$/m);
    const descMatch = content.match(/^description: (.+)$/m);
    let description: string | null = null;
    if (descMatch) {
        // 去除 YAML 双引号包裹
        description = descMatch[1].replace(/^"|"$/g, '');
    }
    const rawType = typeMatch?.[1] ?? null;
    return {
        type: rawType !== null && isSkillType(rawType) ? rawType : null,
        description,
    };
}

/**
 * 扫描项目工具目录中的已安装技能。
 *
 * @param projectRoot - 项目根目录
 */
export function scanInstalledSkills(projectRoot: string): InstalledSkillInfo[] {
    const skills: InstalledSkillInfo[] = [];
    const seen = new Set<string>();
    for (const tool of AI_TOOLS) {
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        for (const dirName of listSubdirectories(skillsRoot)) {
            // 只关注 venus_ 前缀的技能（其他技能不属于本工具管理范围）
            if (!dirName.startsWith(SKILL_PREFIX)) {
                continue;
            }
            // 多工具间去重：同一技能名在不同工具目录中只计一次
            if (seen.has(dirName)) {
                continue;
            }
            seen.add(dirName);
            const content = readFileIfExists(path.join(skillsRoot, dirName, 'SKILL.md'));
            if (content === undefined) {
                // 目录存在但无 SKILL.md：仅登记名称
                skills.push({ name: dirName, type: null, description: null });
                continue;
            }
            const parsed = parseSkillFile(content);
            skills.push({ name: dirName, ...parsed });
        }
    }
    return skills;
}

/**
 * 渲染人类可读的分组列表输出。
 */
export function renderListOutput(skills: InstalledSkillInfo[]): string {
    if (skills.length === 0) {
        return '尚未安装任何 venus 技能。运行 venus init 开始安装。';
    }
    const lines: string[] = ['已安装的 Venus 技能：', ''];
    for (const meta of SKILL_TYPES) {
        const group = skills.filter((s) => s.type === meta.id);
        if (group.length === 0) {
            continue;
        }
        lines.push(`[${meta.id}] ${meta.name}（${meta.description}）`);
        for (const skill of group) {
            lines.push(`  - ${skill.name}${skill.description ? ` —— ${skill.description}` : ''}`);
        }
        lines.push('');
    }
    // 无法归类的技能（frontmatter 缺失/损坏）单独列出，不静默丢弃
    const unknown = skills.filter((s) => s.type === null);
    if (unknown.length > 0) {
        lines.push('[未分类]（frontmatter 缺失或无法解析 type）');
        for (const skill of unknown) {
            lines.push(`  - ${skill.name}`);
        }
    }
    return lines.join('\n');
}

/**
 * 执行 list：扫描 + 渲染。
 *
 * @param projectRoot - 项目根目录
 * @param options - 命令选项
 */
export function runList(projectRoot: string, options: ListOptions = {}): string {
    const skills = scanInstalledSkills(projectRoot);
    if (options.json) {
        return JSON.stringify(
            {
                projectRoot,
                total: skills.length,
                skills: skills.map((s) => ({
                    name: s.name,
                    type: s.type,
                    description: s.description,
                })),
            },
            null,
            2
        );
    }
    return renderListOutput(skills);
}

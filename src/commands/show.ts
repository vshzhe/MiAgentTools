/**
 * venus show 命令。
 *
 * 查看单个技能详情：frontmatter 解析（name/description/type/allowed-tools/generatedBy）、
 * 安装位置、正文预览。支持前缀模糊匹配（唯一命中才展开）。
 */

import path from 'node:path';
import {
    AI_TOOLS,
    SKILL_PREFIX,
    TOOL_SKILLS_SUBDIR,
    SKILL_TYPES,
} from '../core/config.js';
import { readFileIfExists } from '../utils/file-system.js';
import { scanInstalledSkills } from './list.js';

/** show 命令选项 */
export interface ShowOptions {
    /** JSON 输出 */
    json?: boolean;
}

/** 单个技能的详情 */
export interface SkillDetail {
    /** 技能目录名 */
    name: string;
    /** frontmatter name（可能为 null = 解析失败） */
    declaredName: string | null;
    description: string | null;
    allowedTools: string | null;
    type: string | null;
    typeName: string | null;
    generatedBy: string | null;
    /** 安装文件路径（项目相对） */
    file: string | null;
    /** 正文预览（去 frontmatter 后的原文） */
    body: string | null;
}

/** 从 SKILL.md 内容解析 frontmatter 字段 */
function parseFrontmatter(content: string): {
    declaredName: string | null;
    description: string | null;
    allowedTools: string | null;
    type: string | null;
    generatedBy: string | null;
    body: string | null;
} {
    const result = {
        declaredName: null as string | null,
        description: null as string | null,
        allowedTools: null as string | null,
        type: null as string | null,
        generatedBy: null as string | null,
        body: null as string | null,
    };
    if (!content.startsWith('---\n')) {
        return result;
    }
    const endIdx = content.indexOf('\n---\n', 4);
    if (endIdx === -1) {
        return result;
    }
    const frontmatter = content.slice(4, endIdx);
    result.body = content.slice(endIdx + 5).trim();

    const nameMatch = frontmatter.match(/^name: (.+)$/m);
    if (nameMatch) {
        result.declaredName = nameMatch[1].replace(/^"|"$/g, '');
    }
    const descMatch = frontmatter.match(/^description: (.+)$/m);
    if (descMatch) {
        result.description = descMatch[1].replace(/^"|"$/g, '');
    }
    const toolsMatch = frontmatter.match(/^allowed-tools: (.+)$/m);
    if (toolsMatch) {
        result.allowedTools = toolsMatch[1];
    }
    const typeMatch = frontmatter.match(/^  type: (\S+)$/m);
    if (typeMatch) {
        result.type = typeMatch[1];
    }
    const versionMatch = frontmatter.match(/^  generatedBy: "(.+)"$/m);
    if (versionMatch) {
        result.generatedBy = versionMatch[1];
    }
    return result;
}

/**
 * 按名称（或前缀）查找技能，返回全部命中。
 *
 * @param projectRoot - 项目根目录
 * @param query - 完整技能名或唯一前缀（如 venus_tr_tools / pwd）
 */
export function findSkills(projectRoot: string, query: string): SkillDetail[] {
    const installed = scanInstalledSkills(projectRoot);
    // 匹配：全名 / 去前缀段（venus_tr_tools_pwd → tr_tools_pwd / pwd 段）
    const matches = installed.filter((s) => {
        if (s.name === query) {
            return true;
        }
        const stripped = s.name.startsWith(SKILL_PREFIX) ? s.name.slice(SKILL_PREFIX.length) : s.name;
        return stripped.startsWith(query) || (query.length >= 3 && s.name.includes(query));
    });

    const details: SkillDetail[] = [];
    for (const match of matches) {
        for (const tool of AI_TOOLS) {
            const file = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR, match.name, 'SKILL.md');
            const content = readFileIfExists(file);
            if (content === undefined) {
                continue;
            }
            const parsed = parseFrontmatter(content);
            const typeMeta = parsed.type
                ? SKILL_TYPES.find((t) => t.id === parsed.type)
                : undefined;
            details.push({
                name: match.name,
                ...parsed,
                typeName: typeMeta ? `${typeMeta.name}（${typeMeta.id}）` : null,
                file: path.relative(projectRoot, file),
            });
        }
    }
    return details;
}

/**
 * 执行 show：查找并展示技能详情。
 * 命中 0 个 → 报错并列出可用技能；命中多个 → 报错列出候选；唯一命中 → 展示。
 *
 * @param projectRoot - 项目根目录
 * @param query - 技能名或前缀
 * @param options - 命令选项
 */
export function runShow(
    projectRoot: string,
    query: string,
    options: ShowOptions = {}
): { output: string; exitCode: number } {
    const details = findSkills(projectRoot, query);

    if (details.length === 0) {
        const installed = scanInstalledSkills(projectRoot);
        const names = installed.map((s) => s.name).join('\n  ');
        return {
            output: `未找到匹配「${query}」的技能。已安装：\n  ${names || '（无）'}`,
            exitCode: 1,
        };
    }
    if (details.length > 1) {
        const candidates = details.map((d) => d.name).join('\n  ');
        return {
            output: `「${query}」匹配到多个技能，请指定完整名称：\n  ${candidates}`,
            exitCode: 1,
        };
    }
    const detail = details[0];
    if (options.json) {
        return { output: JSON.stringify(detail, null, 2), exitCode: 0 };
    }
    return { output: renderShowOutput(detail), exitCode: 0 };
}

/** 渲染详情输出 */
export function renderShowOutput(detail: SkillDetail): string {
    const lines: string[] = [];
    lines.push(`技能：${detail.name}`);
    if (detail.declaredName && detail.declaredName !== detail.name) {
        lines.push(`⚠ frontmatter name（${detail.declaredName}）与目录名不一致`);
    }
    lines.push(`  描述：${detail.description ?? '（缺失）'}`);
    lines.push(`  类型：${detail.typeName ?? detail.type ?? '（缺失）'}`);
    lines.push(`  工具白名单：${detail.allowedTools ?? '（缺失）'}`);
    lines.push(`  生成版本：${detail.generatedBy ?? '（未知）'}`);
    lines.push(`  安装位置：${detail.file ?? '（未知）'}`);
    lines.push('');
    lines.push('── 正文预览（前 40 行）──');
    const bodyLines = (detail.body ?? '').split('\n');
    lines.push(...bodyLines.slice(0, 40));
    if (bodyLines.length > 40) {
        lines.push(`……（共 ${bodyLines.length} 行，完整内容见 ${detail.file}）`);
    }
    return lines.join('\n');
}

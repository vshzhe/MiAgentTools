/**
 * iagent generate 命令。
 *
 * 按类型生成新技能骨架（SKILL.md），供用户在其基础上填充内容。
 * 骨架同时写入项目 skills/ 源目录与 .claude/ 安装目录。
 */

import path from 'path';
import { createRequire } from 'node:module';
import {
    SKILL_PREFIX,
    SKILL_TYPES,
    TOOL_SKILLS_SUBDIR,
    isSkillType,
    type SkillType,
} from '../core/config.js';
import { generateSkillContent } from '../core/command-generation/index.js';
import { AI_TOOLS } from '../core/config.js';
import { readProjectConfig, type ResolvedProjectConfig } from '../core/project-config.js';
import type { SkillTemplate } from '../core/templates/types.js';
import { ensureDir, writeFile, pathExists, writeSkillReferences } from '../utils/file-system.js';

/** generate 命令选项 */
export interface GenerateOptions {
    /** 技能类型（必填，9 类之一） */
    type: string;
    /** 技能名（kebab-case，必填） */
    name: string;
    /** 技能描述（frontmatter description） */
    desc?: string;
    /** 覆盖已存在文件 */
    force?: boolean;
}

/** generate 执行结果 */
export interface GenerateResult {
    /** 生成的技能名（iagent_<name>） */
    skillName: string;
    /** 项目源目录下的 SKILL.md 路径（相对项目根） */
    sourcePath: string;
    /** .claude 安装目录下的 SKILL.md 路径（相对项目根） */
    installedPath: string;
}

/** kebab-case 校验（小写字母/数字/连字符，不以连字符开头结尾） */
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * 构造新技能的骨架模板（正文为待填充的引导结构）。
 * 若项目存在 .iagent/ 配置，将 context 与该类型的 rules 注入正文。
 */
function buildSkeletonTemplate(
    type: SkillType,
    name: string,
    desc: string | undefined,
    projectConfig: ResolvedProjectConfig | null
): SkillTemplate {
    // 项目规则注入：该类型被 config 引用且规则文件有内容时追加到约束区
    const typeRules = projectConfig?.rules[type] ?? [];
    const ruleLines = typeRules.length > 0
        ? ['项目规则（来自 .iagent/rules/）：', ...typeRules.map((r) => `- ${r}`)].join('\n')
        : '- 需要遵守的边界与规范';

    // 项目背景注入：开头以引用块提示
    const contextBlock = projectConfig && projectConfig.context.trim().length > 0
        ? `> **项目背景**（来自 .iagent/config.yaml，执行时遵守）：\n> ${projectConfig.context.split('\n').join('\n> ')}\n\n`
        : '';

    return {
        name: `${SKILL_PREFIX}${name.replaceAll('-', '_')}`,
        description: desc ?? `（待补充）${SKILL_TYPES.find((t) => t.id === type)?.name ?? type}类技能：${name}`,
        // 骨架默认宽松白名单，正文填充后应按实际命令收紧
        allowedTools: 'Read, Write, Edit, Glob, Grep, Bash',
        type,
        instructions: `${contextBlock}（待补充技能正文）

## 功能说明

描述这个技能做什么、什么场景下使用。

## 执行步骤

1. 第一步
2. 第二步

## 约束

${ruleLines}`,
        license: 'MIT',
        compatibility: '无特殊依赖，通用环境可用。',
        metadata: { author: 'mi-agent-tools', version: '1.0' },
    };
}

/**
 * 执行 generate：生成技能骨架并安装。
 *
 * @param projectRoot - 项目根目录
 * @param options - 命令选项
 */
export function runGenerate(projectRoot: string, options: GenerateOptions): GenerateResult {
    if (!isSkillType(options.type)) {
        throw new Error(
            `未知的技能类型：${options.type}（可选：${SKILL_TYPES.map((t) => t.id).join(', ')}）`
        );
    }
    if (!KEBAB_CASE.test(options.name)) {
        throw new Error(`技能名必须为 kebab-case（小写字母/数字/连字符）：${options.name}`);
    }

    const packageVersion = getPackageVersion();
    const projectConfig = readProjectConfig(projectRoot);
    const template = buildSkeletonTemplate(options.type, options.name, options.desc, projectConfig);
    const generated = generateSkillContent(template, packageVersion);
    const skillName = generated.dirName;

    // 1. 写入项目源目录 skills/iagent_<name>/SKILL.md
    const sourceDir = path.join(projectRoot, 'skills', skillName);
    const sourceFile = path.join(sourceDir, 'SKILL.md');
    if (pathExists(sourceFile) && !options.force) {
        throw new Error(`技能已存在（使用 --force 覆盖）：${skillName}`);
    }
    ensureDir(sourceDir);
    writeFile(sourceFile, generated.fileContent, { force: true });
    writeSkillReferences(sourceDir, generated.references);

    // 2. 安装到各目标工具目录（.claude/skills/...）
    let installedPath = '';
    for (const tool of AI_TOOLS) {
        const installDir = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR, skillName);
        const installFile = path.join(installDir, 'SKILL.md');
        ensureDir(installDir);
        writeFile(installFile, generated.fileContent, { force: true });
        writeSkillReferences(installDir, generated.references);
        installedPath = path.relative(projectRoot, installFile);
    }

    return {
        skillName,
        sourcePath: path.relative(projectRoot, sourceFile),
        installedPath,
    };
}

/** 读取当前包版本 */
function getPackageVersion(): string {
    try {
        const req = createRequire(import.meta.url);
        const pkg = req('../../package.json') as { version?: string };
        return pkg.version ?? '0.0.0';
    } catch {
        return '0.0.0';
    }
}

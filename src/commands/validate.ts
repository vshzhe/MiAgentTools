/**
 * venus validate 命令。
 *
 * 校验目标工具目录中已安装的 venus 技能是否符合规范：
 *   - 目录名必须以 venus_ 开头（仅校验 venus 管理的技能）
 *   - SKILL.md 必须存在且 frontmatter 完整（name/description/allowed-tools/metadata.type）
 *   - frontmatter name 必须等于目录名（Agent Skills 规范）
 *   - metadata.type 必须为 7 类之一
 * 输出 CRITICAL / WARNING 分级报告，存在 CRITICAL 时退出码为 1。
 */

import path from 'path';
import {
    AI_TOOLS,
    SKILL_PREFIX,
    SKILL_TYPE_IDS,
    isSkillType,
    TOOL_SKILLS_SUBDIR,
} from '../core/config.js';
import { listSubdirectories, readFileIfExists } from '../utils/file-system.js';

/** 校验问题级别 */
export type IssueLevel = 'CRITICAL' | 'WARNING';

/** 单条校验问题 */
export interface ValidationIssue {
    level: IssueLevel;
    /** 技能目录名 */
    skill: string;
    /** 问题文件（相对项目根） */
    file: string;
    message: string;
}

/** 单个技能的校验结果 */
export interface SkillValidationResult {
    skill: string;
    valid: boolean;
    issues: ValidationIssue[];
}

/** validate 命令选项 */
export interface ValidateOptions {
    /** 以 JSON 输出 */
    json?: boolean;
}

/** validate 整体结果 */
export interface ValidateResult {
    projectRoot: string;
    total: number;
    passed: number;
    failed: number;
    results: SkillValidationResult[];
    issues: ValidationIssue[];
}

/**
 * 校验单个 SKILL.md 内容。
 *
 * @param skillDirName - 技能目录名
 * @param content - SKILL.md 内容（undefined 表示文件不存在）
 * @param relativeFile - 相对项目根的文件路径（用于问题定位）
 */
function validateSkillContent(
    skillDirName: string,
    content: string | undefined,
    relativeFile: string
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const critical = (message: string): void => {
        issues.push({ level: 'CRITICAL', skill: skillDirName, file: relativeFile, message });
    };
    const warning = (message: string): void => {
        issues.push({ level: 'WARNING', skill: skillDirName, file: relativeFile, message });
    };

    if (content === undefined) {
        critical('缺少 SKILL.md 文件');
        return issues;
    }

    // frontmatter 结构
    if (!content.startsWith('---\n')) {
        critical('缺少 YAML frontmatter（应以 --- 开始）');
        return issues;
    }
    const endMatch = content.indexOf('\n---\n', 4);
    if (endMatch === -1) {
        critical('frontmatter 未闭合（缺少结束 ---）');
        return issues;
    }
    const frontmatter = content.slice(4, endMatch);

    // name 字段
    const nameMatch = frontmatter.match(/^name: (.+)$/m);
    if (!nameMatch) {
        critical('frontmatter 缺少 name 字段');
    } else {
        const declaredName = nameMatch[1].replace(/^"|"$/g, '');
        if (declaredName !== skillDirName) {
            critical(`frontmatter name（${declaredName}）与目录名（${skillDirName}）不一致`);
        }
    }

    // description 字段
    if (!/^description: .+/m.test(frontmatter)) {
        critical('frontmatter 缺少 description 字段');
    }

    // allowed-tools 字段
    if (!/^allowed-tools: .+/m.test(frontmatter)) {
        critical('frontmatter 缺少 allowed-tools 字段（技能将无法执行任何命令）');
    }

    // metadata.type 字段
    const typeMatch = frontmatter.match(/^  type: (\S+)$/m);
    if (!typeMatch) {
        critical('frontmatter 缺少 metadata.type 字段（无法归类）');
    } else if (!isSkillType(typeMatch[1])) {
        critical(`metadata.type 非法（${typeMatch[1]}），必须为 7 类之一：${SKILL_TYPE_IDS.join(', ')}`);
    }

    // 正文
    const body = content.slice(endMatch + 5);
    if (body.trim().length < 20) {
        warning('技能正文过短（不足 20 字符），可能未填充完整');
    }

    return issues;
}

/**
 * 执行 validate：扫描全部工具目录并校验。
 *
 * @param projectRoot - 项目根目录
 */
export function runValidate(projectRoot: string): ValidateResult {
    const results: SkillValidationResult[] = [];
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();

    for (const tool of AI_TOOLS) {
        const skillsRoot = path.join(projectRoot, tool.skillsDir, TOOL_SKILLS_SUBDIR);
        for (const dirName of listSubdirectories(skillsRoot)) {
            // 只校验 venus 管理的技能，其他技能不属本工具职责
            if (!dirName.startsWith(SKILL_PREFIX)) {
                continue;
            }
            // 多工具间去重：同一技能名在不同工具目录中只校验一次
            if (seen.has(dirName)) {
                continue;
            }
            seen.add(dirName);
            const skillFile = path.join(skillsRoot, dirName, 'SKILL.md');
            const relativeFile = path.relative(projectRoot, skillFile);
            const content = readFileIfExists(skillFile);
            const skillIssues = validateSkillContent(dirName, content, relativeFile);
            results.push({
                skill: dirName,
                valid: skillIssues.filter((i) => i.level === 'CRITICAL').length === 0,
                issues: skillIssues,
            });
            issues.push(...skillIssues);
        }
    }

    return {
        projectRoot,
        total: results.length,
        passed: results.filter((r) => r.valid).length,
        failed: results.filter((r) => !r.valid).length,
        results,
        issues,
    };
}

/**
 * 渲染人类可读的校验报告。
 */
export function renderValidateOutput(result: ValidateResult): string {
    if (result.total === 0) {
        return '未发现任何 venus 技能。运行 venus init 开始安装。';
    }
    const lines: string[] = [];
    const criticals = result.issues.filter((i) => i.level === 'CRITICAL');
    const warnings = result.issues.filter((i) => i.level === 'WARNING');

    lines.push(`校验结果：${result.passed}/${result.total} 个技能通过`, '');
    if (criticals.length > 0) {
        lines.push(`[CRITICAL] 必须修复（${criticals.length} 项）：`);
        for (const issue of criticals) {
            lines.push(`  - ${issue.skill}：${issue.message}（${issue.file}）`);
        }
        lines.push('');
    }
    if (warnings.length > 0) {
        lines.push(`[WARNING] 建议修复（${warnings.length} 项）：`);
        for (const issue of warnings) {
            lines.push(`  - ${issue.skill}：${issue.message}（${issue.file}）`);
        }
        lines.push('');
    }
    if (criticals.length === 0 && warnings.length === 0) {
        lines.push('全部技能符合规范。');
    }
    return lines.join('\n');
}

/**
 * 执行 validate 并返回输出文本。
 *
 * @param projectRoot - 项目根目录
 * @param options - 命令选项
 */
export function runValidateCommand(
    projectRoot: string,
    options: ValidateOptions = {}
): { output: string; exitCode: number } {
    const result = runValidate(projectRoot);
    if (options.json) {
        return { output: JSON.stringify(result, null, 2), exitCode: result.failed > 0 ? 1 : 0 };
    }
    return { output: renderValidateOutput(result), exitCode: result.failed > 0 ? 1 : 0 };
}

/**
 * 项目技能（`.iagent/skills/<name>.md`）载体：路径解析、frontmatter 读取与完整性校验。
 *
 * 定位：项目技能不是宿主注册技能，而是由技能正文 `Read` 加载的 Markdown 规范；
 * 默认落 `.iagent/skills/`，缺失时按生效工具顺序回退宿主技能目录同名 skill。
 * 本模块是蒸馏期自检与 `iagent skills --json` 校验的**共享常量单一源**。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { AI_TOOLS } from './config.js';
import {
    SKILLS_DIR_NAME,
    readProjectConfig,
    resolveActiveTools,
    type ProjectSkillGroup,
    type ProjectSkillRole,
} from './project-config.js';

/** 技能阶段归属 */
export type ProjectSkillPhases = 'design' | 'implement' | 'both';

/** 技能角色范围 */
export type ProjectSkillScope = 'frontend' | 'backend' | 'both';

/** 完整性校验必需章节（与蒸馏自检共享） */
export const REQUIRED_SKILL_SECTIONS = [
    '## 框架与版本',
    '## 目录与分层',
    '## 设计规范',
    '## 实现规范',
    '## 约定与禁止项',
    '## 证据索引',
    '## 不适用项',
] as const;

/** 占位符模式（与蒸馏自检共享） */
export const SKILL_PLACEHOLDER_PATTERN = /\[待补充\]|\bTODO\b|\bTBD\b|<[^>\n]{1,40}>/;

/** 规则行证据锚点模式（`文件:行`、`类.方法` 不强制，docs 章节亦可） */
const EVIDENCE_PATTERN = /证据[:：]|`[^`\n]+:\d+`|[\w./-]+\.\w+:\d+|docs\/project\//;

/** 完整性校验结果 */
export interface SkillValidation {
    status: 'ok' | 'incomplete';
    missingSections: string[];
    emptySections: string[];
    placeholders: string[];
    ruleLinesWithoutEvidence: number;
    nameMismatch: boolean;
}

/** 单个项目技能条目 */
export interface ProjectSkillEntry {
    role: ProjectSkillRole;
    name: string;
    /** 项目相对路径（正斜杠）；未命中为 null */
    path: string | null;
    exists: boolean;
    bytes: number;
    lines: number;
    /** sha256 前 12 位；不存在为 null */
    sha256: string | null;
    phases: ProjectSkillPhases | null;
    scope: ProjectSkillScope | null;
    frameworks: string[];
    source: 'distilled' | 'user' | null;
    /** 不存在时为 null */
    validation: SkillValidation | null;
}

/** 技能分组输出 */
export interface ProjectSkillGroupOutput {
    role: ProjectSkillRole;
    entries: ProjectSkillEntry[];
}

/** `iagent skills` 输出 */
export interface ProjectSkillsOutput {
    groups: ProjectSkillGroupOutput[];
}

/** frontmatter 解析结果 */
export interface SkillFrontmatter {
    name: string | null;
    phases: ProjectSkillPhases | null;
    scope: ProjectSkillScope | null;
    frameworks: string[];
    source: 'distilled' | 'user' | null;
}

/** 把路径归一化为项目相对 posix 路径 */
function toPosix(value: string): string {
    return value.replaceAll('\\', '/');
}

/** 读取文件内容（不存在返回 null） */
function readIfExists(absolutePath: string): string | null {
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        return null;
    }
    return fs.readFileSync(absolutePath, 'utf8');
}

/** 解析简单 YAML frontmatter（只读取项目技能约定字段） */
export function parseSkillFrontmatter(content: string): SkillFrontmatter {
    const result: SkillFrontmatter = {
        name: null,
        phases: null,
        scope: null,
        frameworks: [],
        source: null,
    };
    const lines = content.split(/\r?\n/);
    if (lines[0]?.trim() !== '---') {
        return result;
    }
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            end = i;
            break;
        }
    }
    if (end === -1) {
        return result;
    }
    for (const line of lines.slice(1, end)) {
        const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line.trim());
        if (!match) {
            continue;
        }
        const key = match[1].toLowerCase();
        const rawValue = match[2].trim().replace(/^["']|["']$/g, '');
        if (key === 'name') {
            result.name = rawValue;
        } else if (key === 'phases') {
            result.phases =
                rawValue === 'design' || rawValue === 'implement' || rawValue === 'both'
                    ? rawValue
                    : null;
        } else if (key === 'scope') {
            result.scope =
                rawValue === 'frontend' || rawValue === 'backend' || rawValue === 'both'
                    ? rawValue
                    : null;
        } else if (key === 'frameworks') {
            const inner = rawValue.replace(/^\[|\]$/g, '');
            result.frameworks = inner
                .split(',')
                .map((item) => item.trim().replace(/^["']|["']$/g, ''))
                .filter((item) => item.length > 0);
        } else if (key === 'source') {
            result.source = rawValue === 'distilled' || rawValue === 'user' ? rawValue : null;
        }
    }
    return result;
}

/**
 * 解析项目技能路径：`.iagent/skills/<name>.md` 优先，未命中时按生效工具顺序回退
 * `<tool.skillsDir>/skills/<name>/SKILL.md`。
 */
export function resolveProjectSkillPath(
    projectRoot: string,
    name: string,
    tools: readonly { skillsDir: string }[]
): string | null {
    const candidates: string[] = [path.join(projectRoot, SKILLS_DIR_NAME, `${name}.md`)];
    for (const tool of tools) {
        candidates.push(path.join(projectRoot, tool.skillsDir, 'skills', name, 'SKILL.md'));
    }
    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }
    return null;
}

/** 按行拆分 Markdown 二级章节（不含 `## ` 前缀） */
function splitSections(content: string): Map<string, string[]> {
    const sections = new Map<string, string[]>();
    let current = '';
    for (const line of content.split(/\r?\n/)) {
        const match = /^##\s+(.+?)\s*$/.exec(line);
        if (match) {
            current = `## ${match[1]}`;
            if (!sections.has(current)) {
                sections.set(current, []);
            }
            continue;
        }
        if (current.length > 0) {
            sections.get(current)?.push(line);
        }
    }
    return sections;
}

/** 章节正文是否为空（仅空行 / 注释） */
function isBlankBody(lines: readonly string[]): boolean {
    return lines.every((line) => line.trim().length === 0 || line.trim().startsWith('<!--'));
}

/** 必需章节（按 phases 计算） */
export function requiredSectionsForPhases(phases: ProjectSkillPhases | null): string[] {
    if (phases === 'design') {
        return REQUIRED_SKILL_SECTIONS.filter((section) => section !== '## 实现规范');
    }
    if (phases === 'implement') {
        return REQUIRED_SKILL_SECTIONS.filter((section) => section !== '## 设计规范');
    }
    return [...REQUIRED_SKILL_SECTIONS];
}

/** 校验一份项目技能文档 */
export function validateProjectSkill(
    name: string,
    content: string,
    frontmatter: SkillFrontmatter
): SkillValidation {
    const sections = splitSections(content);
    const required = requiredSectionsForPhases(frontmatter.phases);
    const notApplicableBody = (sections.get('## 不适用项') ?? []).join('\n');
    const missingSections = required.filter((section) => {
        if (sections.has(section)) {
            return false;
        }
        // 缺失章节在「不适用项」给出依据时视为已声明
        return !notApplicableBody.includes(section.replace(/^##\s+/, ''));
    });
    const emptySections = required.filter((section) => {
        const body = sections.get(section);
        return body !== undefined && isBlankBody(body);
    });
    const placeholders: string[] = [];
    for (const line of content.split(/\r?\n/)) {
        const match = SKILL_PLACEHOLDER_PATTERN.exec(line);
        if (match) {
            placeholders.push(match[0]);
        }
    }
    let ruleLinesWithoutEvidence = 0;
    for (const section of ['## 目录与分层', '## 设计规范', '## 实现规范', '## 约定与禁止项']) {
        for (const line of sections.get(section) ?? []) {
            if (!/^\s*-\s+\S/.test(line)) {
                continue;
            }
            if (!EVIDENCE_PATTERN.test(line)) {
                ruleLinesWithoutEvidence += 1;
            }
        }
    }
    const nameMismatch = frontmatter.name !== name;
    const status =
        missingSections.length === 0 &&
        emptySections.length === 0 &&
        placeholders.length === 0 &&
        ruleLinesWithoutEvidence === 0 &&
        !nameMismatch
            ? 'ok'
            : 'incomplete';
    return {
        status,
        missingSections,
        emptySections,
        placeholders,
        ruleLinesWithoutEvidence,
        nameMismatch,
    };
}

/** 构造单个技能条目 */
function describeSkill(
    projectRoot: string,
    role: ProjectSkillRole,
    name: string,
    tools: readonly { skillsDir: string }[]
): ProjectSkillEntry {
    const absolutePath = resolveProjectSkillPath(projectRoot, name, tools);
    if (absolutePath === null) {
        return {
            role,
            name,
            path: null,
            exists: false,
            bytes: 0,
            lines: 0,
            sha256: null,
            phases: null,
            scope: null,
            frameworks: [],
            source: null,
            validation: null,
        };
    }
    const content = readIfExists(absolutePath) ?? '';
    const frontmatter = parseSkillFrontmatter(content);
    return {
        role,
        name,
        path: toPosix(path.relative(projectRoot, absolutePath)),
        exists: true,
        bytes: Buffer.byteLength(content, 'utf8'),
        lines: content.split('\n').length,
        sha256: createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 12),
        phases: frontmatter.phases,
        scope: frontmatter.scope,
        frameworks: frontmatter.frameworks,
        source: frontmatter.source,
        validation: validateProjectSkill(name, content, frontmatter),
    };
}

/** 枚举项目技能（只读）。 */
export function collectProjectSkills(
    projectRoot: string,
    activeTools?: readonly { skillsDir: string }[]
): ProjectSkillsOutput {
    const config = readProjectConfig(projectRoot);
    const tools = activeTools ?? resolveActiveTools(undefined, config?.tools, AI_TOOLS);
    const groups: ProjectSkillGroupOutput[] = [];
    for (const group of config?.skills ?? []) {
        groups.push({
            role: group.role,
            entries: group.entries.map((name) => describeSkill(projectRoot, group.role, name, tools)),
        });
    }
    return { groups };
}

/** 渲染人类可读文本。 */
export function renderSkillsText(output: ProjectSkillsOutput): string {
    const lines = ['项目技能：'];
    const entries = output.groups.flatMap((group) => group.entries);
    if (entries.length === 0) {
        lines.push('  （无技能配置）');
        return lines.join('\n');
    }
    for (const entry of entries) {
        if (!entry.exists) {
            lines.push(`  - [${entry.role}] ${entry.name}（不存在）`);
            continue;
        }
        const validation = entry.validation;
        const status =
            validation === null
                ? '未校验'
                : validation.status === 'ok'
                  ? '完整'
                  : `不完整（缺章节 ${validation.missingSections.length} / 占位 ${validation.placeholders.length} / 无证据规则 ${validation.ruleLinesWithoutEvidence}）`;
        lines.push(
            `  - [${entry.role}] ${entry.name} → ${entry.path}（${entry.bytes} 字节 / ${entry.lines} 行 / sha256:${entry.sha256} / ${status}）`
        );
    }
    return lines.join('\n');
}

/** 分组访问器（供蒸馏注册复用类型） */
export type { ProjectSkillGroup };

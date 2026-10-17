/**
 * 模板语言一致性回归锁（变更 improve-template-language-consistency）。
 *
 * 锁定：生成后的技能正文、references 与指令正文中，**普通解释性英文自然语言**
 * MUST NOT 出现；只有承载契约 / 机器语义的「特定描述」可保留英文
 * （命令、路径、文件名、标识符、`/iagent:<id>`、`$ARGUMENTS`、工具与协议名、
 * `MUST` / `MUST NOT` / `SHALL`、`ADDED` 等标记、协议标题 `Input` / `Output` /
 * `Phase` / `Step` / `Guardrails`、英文触发词、`NOT for`）。
 *
 * 判定规则（低误报）：
 *   1. 围栏代码块与行内代码整体豁免（逐字节保留的机器内容）
 *   2. 扣除白名单词 / 短语与标识符后，同一行出现 ≥3 个连续英文单词即判违规
 *      （行内以空白分隔才算「连续」，被中文、标点、逗号、斜杠打断即断开）
 *   3. 已定中文译法的术语禁止残留英文形（BANNED 短语表）
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';
import {
    generateCommand,
    claudeAdapter,
    piAdapter,
    opencodeAdapter,
} from '../src/core/command-generation/index.js';

/** 围栏代码块（含语言标记）——整体豁免 */
const FENCE_RE = /```[\s\S]*?```/g;
/** 行内代码 span ——整体豁免 */
const INLINE_RE = /`[^`\n]*`/g;

/**
 * 白名单词：承载契约 / 机器语义，保留英文是设计决策（详见 translation-style-guide §一）。
 * 大小写敏感 —— 仅列实际出现的形态。
 */
const ALLOWED_WORDS = new Set<string>([
    // 规范词与状态
    'MUST', 'MUST', 'SHALL', 'SHOULD', 'MAY', 'NOT', 'AND', 'OR', 'WHEN', 'THEN',
    'IF', 'FOR', 'EACH', 'IN', 'DO', 'ALL', 'ONLY', 'YES', 'NO', 'A', 'B', 'R',
    'WARN', 'SKIP', 'PASS', 'FAIL', 'INFO', 'TODO', 'FIXME', 'ERROR', 'BLOCKED',
    'ADDED', 'MODIFIED', 'REMOVED', 'RENAMED', 'CRITICAL', 'WARNING', 'SUGGESTION',
    'HIGH', 'MEDIUM', 'LOW', 'OK', 'L',
    // 协议 / 结构标题
    'Input', 'Output', 'Phase', 'Step', 'Steps', 'Guardrails', 'Context', 'Goals',
    'Non', 'Decisions', 'Risks', 'Requirement', 'Requirements', 'Scenario', 'Scenarios',
    'Spec', 'Ref', 'Check', 'Produce', 'Expected', 'Actual', 'Baseline', 'Startup',
    'Trigger', 'Outputs', 'Inputs', 'Bridge', 'Continuity', 'Goal', 'Scope',
    // 工具与协议名
    'Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash', 'Task', 'Agent', 'Skill',
    'TodoWrite', 'AskUserQuestion', 'MCP', 'OpenSpec', 'CodeGraph', 'Markdown',
    'JSON', 'YAML', 'TOML', 'SQL', 'API', 'CLI', 'DDL', 'DML', 'ORM', 'DAO', 'DTO',
    'Entity', 'Mapper', 'Service', 'Controller', 'Repository', 'Redis', 'HTTP',
    'HTTPS', 'URL', 'UI', 'DB', 'ID', 'OS', 'ACK', 'EOS', 'README', 'AGENTS',
    'INDEX', 'CONTEXT', 'ARCHIVE', 'DEV', 'SRC', 'MAX', 'MIN', 'NUL',
    // 语言 / 框架 / 工具链
    'Java', 'Node', 'Nodejs', 'Windows', 'POSIX', 'Spring', 'MyBatis', 'JPA',
    'Hibernate', 'Mockito', 'EasyMock', 'AssertJ', 'JUnit', 'Vitest', 'Jest',
    'Mocha', 'Supertest', 'Maven', 'Gradle', 'pnpm', 'npm', 'npx', 'mvn', 'git',
    'svn', 'bash', 'cmd', 'PowerShell', 'ts', 'js', 'json', 'yml', 'yaml', 'md',
    // 领域内已确立英文术语（保留原文，不作翻译）
    'skill', 'skills', 'spec', 'specs', 'delta', 'kebab', 'grill', 'auto', 'mode',
    'change', 'attachments', 'baseline', 'digest', 'lazy', 'signature', 'receipt',
    'triage', 'tier', 'Bash', 'Semgrep', 'CodeQL', 'SonarQube',
]);

/** 白名单短语（多词，整体豁免） */
const ALLOWED_PHRASES = [
    'NOT for',
    'Keep a Changelog',
    'Conventional Commits',
    'Agent Skills',
    'Claude Code',
    'CodeGraph MCP',
    'Expected vs Actual',
    // 技能触发关键词（保留英文触发词是 description 契约）
    'analyze feature implementation',
    // CLI 报错字面量：降级分支按此特征匹配，必须逐字保留
    'command not found',
    'not recognized',
    // 探索产物的结构化子段名（下游引用契约）
    'Capability Exploration Memory',
];

/**
 * 已定中文译法的术语：禁止残留英文形（translation-style-guide §二）。
 * 命中即失败，即使被白名单规则的边角放过。
 */
const BANNED_PHRASES = [
    'Prompt Validation Gate',
    'Functional Flowchart',
    'Checkpoint Enforcement',
    'hard conflict',
    'One-stop',
    'Standalone mode',
    'Non-interactive mode',
    'output ledger',
    'minimal receipt',
    'shared context pack',
    'shared instruction prefix',
    'enter plan mode',
    'propose next steps',
    'MANDATORY',
    'CHECKPOINT',
    'Checkpoint:',
    'Pre-Archive',
    'Pre-archive',
    'Design Confirmation Gate',
    'Compile Check Phase',
    'Test Execution Gate',
    'non-blocking',
    'read pack',
    'blast radius',
    'dispatch unit',
    'Deep review',
    'Remaining problems',
    'Creating exploration file',
    'Pre-migration verification',
    'Do NOT ',
    'If omitted',
    'Hard Stop',
];

/** 标识符 / 路径 / 文件 / 版本号 / 编号 —— 属于「特定描述」，不计入英文散文 */
function isIdentifierToken(token: string): boolean {
    if (/[_.\/]/.test(token)) return true; // proposal.md / openspec/changes / iagent_spec_apply
    if (/^[A-Za-z]\d/.test(token)) return true; // P0 / L1 / D1 (D1-D5 已含连字符)
    if (/^[A-Za-z][A-Za-z0-9]*(-[A-Za-z0-9]+)+$/.test(token)) return true; // kebab-case / auto-mode
    if (/^[A-Za-z]\d*[-–][A-Za-z]?\d+$/.test(token)) return true; // D1-D5
    return false;
}

function normalizeForScan(text: string): string {
    // 1. 剥掉围栏与行内代码（换行保留，避免跨行误连）
    let out = text.replace(FENCE_RE, (m) => '\n'.repeat(m.split('\n').length - 1)).replace(INLINE_RE, ' ');
    // 2. 白名单短语 → 分隔符
    for (const phrase of ALLOWED_PHRASES) {
        out = out.split(phrase).join('\u0001');
    }
    // 3. 白名单词 / 标识符 → 分隔符（按 token 边界整词替换）
    out = out.replace(/[A-Za-z][A-Za-z0-9_./-]*/g, (tok) =>
        ALLOWED_WORDS.has(tok) || isIdentifierToken(tok) ? '\u0001' : tok
    );
    return out;
}

/** 返回一行内违规的英文连续词串（≥3 个连续英文单词），附行号 */
function englishRuns(text: string): Array<{ line: number; run: string }> {
    const normalized = normalizeForScan(text);
    const runs: Array<{ line: number; run: string }> = [];
    normalized.split('\n').forEach((line, index) => {
        const matches = line.match(/[A-Za-z][A-Za-z0-9]*(?:[ \t]+[A-Za-z][A-Za-z0-9]*){2,}/g);
        if (matches) runs.push(...matches.map((run) => ({ line: index + 1, run })));
    });
    return runs;
}

interface Target {
    label: string;
    text: string;
}

function collectTargets(): Target[] {
    const targets: Target[] = [];
    for (const { template } of getSkillTemplates()) {
        targets.push({ label: `${template.name} (SKILL)`, text: template.instructions });
        for (const ref of template.references ?? []) {
            targets.push({ label: `${template.name} (${ref.path})`, text: ref.content });
        }
    }
    for (const { id, template } of getCommandTemplates()) {
        targets.push({ label: `command ${id}`, text: template.content });
    }
    return targets;
}

const TARGETS = collectTargets();

describe('模板中文一致性（普通英文散文零残留）', () => {
    it('技能正文 / references / 指令正文无 ≥3 连续英文散文', () => {
        const offenders: string[] = [];
        for (const { label, text } of TARGETS) {
            for (const { line, run } of englishRuns(text)) {
                offenders.push(`${label}:${line} 「${run}」`);
            }
        }
        expect(offenders, `残留英文散文 ${offenders.length} 处`).toEqual([]);
    });

    it('已定中文译法的术语不残留英文形', () => {
        const offenders: string[] = [];
        for (const { label, text } of TARGETS) {
            // 围栏与行内代码豁免后再判（机器内容不算）
            const scanned = text.replace(FENCE_RE, ' ').replace(INLINE_RE, ' ');
            for (const banned of BANNED_PHRASES) {
                if (scanned.includes(banned)) {
                    offenders.push(`${label}: 「${banned}」`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('Claude / Pi / OpenCode 三类适配器产物正文无普通英文散文', () => {
        const offenders: string[] = [];
        const adapters = [claudeAdapter, piAdapter, opencodeAdapter];
        for (const adapter of adapters) {
            for (const { template, id } of getCommandTemplates()) {
                const generated = generateCommand(
                    {
                        id,
                        name: template.name,
                        description: template.description,
                        category: template.category,
                        tags: template.tags,
                        body: template.content,
                        allowedTools: template.allowedTools,
                    },
                    adapter
                );
                // frontmatter 为机器元数据（键名与 YAML），仅扫其后的正文
                const body = generated.fileContent.replace(/^---[\s\S]*?\n---\n/, '');
                for (const { line, run } of englishRuns(body)) {
                    offenders.push(`${adapter.toolId}/${id}:${line} 「${run}」`);
                }
            }
        }
        expect(offenders, `工具产物残留英文散文 ${offenders.length} 处`).toEqual([]);
    });

    it('技能 description 保留英文触发关键词与 NOT for 排歧', () => {
        const offenders: string[] = [];
        for (const { template } of getSkillTemplates()) {
            if (!/[\u4e00-\u9fa5]/.test(template.description)) {
                offenders.push(`${template.name}: 缺中文用途`);
            }
            if (!template.description.includes('NOT for')) {
                offenders.push(`${template.name}: 缺 NOT for`);
            }
            if (!/(触发词|triggers:)/.test(template.description)) {
                offenders.push(`${template.name}: 缺触发词标记`);
            }
        }
        expect(offenders).toEqual([]);
    });
});

/**
 * 调用类白名单条目 SHALL 经共享常量构造。
 *
 * 对应变更 improve-template-generation-consistency 的 tool-call-whitelist delta：
 * 含 CodeGraph MCP / 技能委派 / 子代理派发条目的技能，其 `allowedTools` MUST 经
 * `tool-whitelist.ts` 的共享常量（`CODEGRAPH_MCP` / `skillDelegation()` /
 * `SUBAGENT_DISPATCH`）构造，MUST NOT 逐模板手写字面量。
 *
 * 该强制只统一来源，不改变授权面（值等价）。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { deriveSkillId } from '../src/core/skill-id.js';
import {
    CODEGRAPH_CLI,
    CODEGRAPH_MCP,
    SUBAGENT_DISPATCH,
    skillDelegation,
} from '../src/core/templates/tool-whitelist.js';

describe('调用类白名单条目经共享常量构造', () => {
    const skills = getSkillTemplates();

    it('含 CodeGraph MCP 条目的技能包含 CODEGRAPH_MCP 常量', () => {
        for (const { template } of skills) {
            if (template.allowedTools.includes('mcp__codegraph')) {
                expect(template.allowedTools, template.name).toContain(CODEGRAPH_MCP);
            }
        }
    });

    it('含子代理派发条目的技能包含 SUBAGENT_DISPATCH 常量', () => {
        for (const { template } of skills) {
            const tools = template.allowedTools;
            if (/(^|, )(Agent|Task)(,|$)/.test(tools)) {
                expect(tools, template.name).toContain(SUBAGENT_DISPATCH);
            }
        }
    });

    it('Skill(...) 条目可由 skillDelegation(...) 产出（顺序连续）', () => {
        for (const { template } of skills) {
            const names = [...template.allowedTools.matchAll(/Skill\(([a-z_]+)\)/g)].map((m) => m[1]);
            if (names.length === 0) {
                continue;
            }
            expect(template.allowedTools, template.name).toContain(skillDelegation(names));
        }
    });

    it('不使用 Skill(*) 通配', () => {
        for (const { template } of skills) {
            expect(template.allowedTools, template.name).not.toContain('Skill(*)');
        }
    });
});

// 任务 2.7 / 4.8：CodeGraph CLI 条目单一源。
describe('CodeGraph CLI 条目单一源', () => {
    /** 正文确有 CLI 调用（codegraph status / unlock / sync）的技能 */
    const CLI_SKILLS = [
        'iagent_spec_archive',
        'iagent_spec_bulk_archive',
        'iagent_spec_explore',
        'iagent_debug',
        'iagent_project_init',
    ];

    it('常量取值与 Bash(codegraph:*) 逐字一致', () => {
        expect(CODEGRAPH_CLI).toBe('Bash(codegraph:*)');
    });

    it('正文跑 CLI 的技能均含该常量，且不删除 MCP 条目', () => {
        for (const name of CLI_SKILLS) {
            const skill = getSkillTemplates().find((s) => s.template.name === name);
            expect(skill, `${name} 未注册`).toBeDefined();
            expect(skill?.template.allowedTools, `${name} 缺 CODEGRAPH_CLI`).toContain(CODEGRAPH_CLI);
            expect(skill?.template.allowedTools, `${name} 缺 CODEGRAPH_MCP`).toContain(CODEGRAPH_MCP);
        }
    });

    it('模板正文不手写字面量（仅常量定义处出现）', () => {
        for (const { template } of getSkillTemplates()) {
            const corpus = [
                template.instructions,
                ...(template.references ?? []).map((ref) => ref.content),
            ].join('\n');
            expect(corpus, `${template.name} 手写 Bash(codegraph:*)`).not.toContain('Bash(codegraph:*)');
        }
    });

    it('migration 不持 CLI 权限（仅两通道探测）', () => {
        const migration = getSkillTemplates().find((s) => s.template.name === 'iagent_migration');
        expect(migration?.template.allowedTools).not.toContain(CODEGRAPH_CLI);
    });
});

describe('debug 文档与回归测试委派授权（4.5）', () => {
    const debug = getSkillTemplates().find(({ template }) => template.name === 'iagent_debug')!;

    /** 白名单条目（逗号分隔 + trim） */
    function parseEntries(allowedTools: string): string[] {
        return allowedTools
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    }

    it('使用共享 skillDelegation 生成精确裸名条目（按正文委派顺序连续）', () => {
        const expected = skillDelegation([
            'spec_verify_proposal',
            'proposal_review',
            'requirement_doc',
            'test',
        ]);
        expect(debug.template.allowedTools).toContain(expected);
    });

    it('无带 iagent_ 前缀的死条目、无通配、条目均对应已注册技能', () => {
        const registered = new Set(getSkillTemplates().map(({ template }) => template.name));
        const entries = parseEntries(debug.template.allowedTools);
        const skillEntries = entries.filter((entry) => entry.startsWith('Skill('));
        expect(skillEntries).toEqual([
            'Skill(spec_verify_proposal)',
            'Skill(proposal_review)',
            'Skill(requirement_doc)',
            'Skill(test)',
        ]);
        for (const entry of skillEntries) {
            const bare = entry.slice('Skill('.length, -1);
            expect(bare.startsWith('iagent_'), `${debug.template.name} 使用带前缀死条目 ${entry}`).toBe(
                false
            );
            expect(registered, `${debug.template.name} 委派未注册技能 ${entry}`).toContain(
                `iagent_${bare}`
            );
        }
        expect(debug.template.allowedTools).not.toContain('Skill(*)');
    });

    it('写类与 Bash 授权面不因新增委派而扩张', () => {
        const entries = parseEntries(debug.template.allowedTools);
        // 写类授权：各一条（委派条目不得夹带新写权限）
        expect(entries.filter((entry) => entry === 'Write')).toEqual(['Write']);
        expect(entries.filter((entry) => entry === 'Edit')).toEqual(['Edit']);
        // Bash 授权面：新增 CODEGRAPH_CLI 条目属 2.10（正文确有 CLI 能力探测调用），其余与变更前一致
        expect(entries.filter((entry) => entry.startsWith('Bash(')).sort()).toEqual([
            'Bash(cargo:*)',
            'Bash(codegraph:*)',
            'Bash(git:*)',
            'Bash(go:*)',
            'Bash(gradle:*)',
            'Bash(iagent:*)',
            'Bash(mvn:*)',
            'Bash(node:*)',
            'Bash(npm:*)',
            'Bash(pnpm:*)',
            'Bash(tsc:*)',
        ]);
        // 无 Bash(*)
        expect(entries).not.toContain('Bash(*)');
    });
});

// tool-call-whitelist / 「CodeGraph CLI 条目单一源」+「调用类白名单条目 SHALL 经共享常量构造」：
// 常量是唯一真源 -> 源码里该字面量只能出现在常量定义处，快照经同一常量产出。
describe('2.7 / 4.8 Bash(codegraph:*) 字面量单一源与生成快照', () => {
    const repoRoot = fileURLToPath(new URL('..', import.meta.url));
    const LITERAL = 'Bash(codegraph:*)';

    /** 遍历目录下的指定扩展名文件，返回命中谓词的项目相对路径 */
    function collectFiles(dir: string, pattern: RegExp): { rel: string; full: string }[] {
        const found: { rel: string; full: string }[] = [];
        const walk = (current: string): void => {
            for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!pattern.test(entry.name)) {
                    continue;
                }
                found.push({ rel: path.relative(repoRoot, full).replaceAll('\\', '/'), full });
            }
        };
        walk(dir);
        return found;
    }

    it('src/** 内该字面量只出现在 tool-whitelist.ts，且仅一处为字符串常量定义', () => {
        const filesWithLiteral: string[] = [];
        let quotedLiterals = 0;
        for (const { rel, full } of collectFiles(path.join(repoRoot, 'src'), /\.(ts|js)$/)) {
            const text = fs.readFileSync(full, 'utf8');
            if (text.includes(LITERAL)) {
                filesWithLiteral.push(rel);
            }
            quotedLiterals += (text.match(/'Bash\(codegraph:\*\)'/g) ?? []).length;
        }

        // 唯一定义点；其余模板 MUST 经常量拼接（手写字面量会让本断言失败）
        expect(filesWithLiteral).toEqual(['src/core/templates/tool-whitelist.ts']);
        expect(quotedLiterals).toBe(1);
        // 常量取值与字面量逐字一致（防常量被改名成另一个权限面）
        expect(CODEGRAPH_CLI).toBe(LITERAL);
    });

    it('生成快照经同一常量产出：CLI 技能快照 frontmatter 含该条目', () => {
        const CLI_SKILLS = [
            'iagent_spec_archive',
            'iagent_spec_bulk_archive',
            'iagent_spec_explore',
            'iagent_debug',
            'iagent_project_init',
        ];
        for (const name of CLI_SKILLS) {
            const template = getSkillTemplates().find((entry) => entry.template.name === name);
            expect(template, `${name} 未注册`).toBeDefined();
            expect(template?.template.allowedTools, `${name} 缺 CODEGRAPH_CLI`).toContain(CODEGRAPH_CLI);

            const skillId = deriveSkillId(name);
            const snapshotPath = path.join(repoRoot, 'skills', skillId, 'SKILL.md');
            expect(fs.existsSync(snapshotPath), `${skillId} 快照缺失`).toBe(true);
            const snapshot = fs.readFileSync(snapshotPath, 'utf8');
            // 快照 allowed-tools 行含该条目（快照由 pnpm generate:skills 生成，非手写）
            expect(snapshot).toContain(LITERAL);
            expect(snapshot).toMatch(new RegExp(`^allowed-tools:.*${LITERAL.replace(/[()*:]/g, '\\$&')}`, 'm'));
        }
    });

    it('src/** 与 skills/** 零 Skill(*) 通配', () => {
        const offenders: string[] = [];
        let scanned = 0;
        for (const { rel, full } of [
            ...collectFiles(path.join(repoRoot, 'src'), /\.(ts|js)$/),
            ...collectFiles(path.join(repoRoot, 'skills'), /\.md$/),
        ]) {
            scanned++;
            if (fs.readFileSync(full, 'utf8').includes('Skill(*)')) {
                offenders.push(rel);
            }
        }
        expect(offenders).toEqual([]);
        // 扫描面非空证明
        expect(scanned).toBeGreaterThan(50);
    });
});

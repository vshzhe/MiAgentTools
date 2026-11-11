/**
 * 生成层测试：SKILL.md 内容、指令文件格式、YAML 转义。
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    generateSkillContent,
    generateCommand,
    escapeYamlValue,
    formatTagsArray,
    claudeAdapter,
    piAdapter,
    opencodeAdapter,
    fingerprintOf,
    readGeneratedFingerprint,
    rewriteReferencePaths,
    skillReferencesBasePath,
} from '../src/core/command-generation/index.js';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';
import { deriveSkillId } from '../src/core/skill-id.js';
import { runGenerate } from '../src/commands/generate.js';

describe('SKILL.md 生成', () => {
    const [{ template }] = getSkillTemplates('init');

    it('frontmatter 含 name/description/type 字段', () => {
        const generated = generateSkillContent(template, '0.1.0');
        const skillId = deriveSkillId(template.name);
        expect(generated.dirName).toBe(skillId);
        expect(generated.fileContent).toContain(`name: ${skillId}`);
        expect(generated.fileContent).toContain(`allowed-tools: ${template.allowedTools}`);
        expect(generated.fileContent).toContain(`  type: ${template.type}`);
        expect(generated.fileContent).toContain('generatedBy: "0.1.0"');
        expect(generated.fileContent).toMatch(/^---\n[\s\S]+\n---\n\n/);
    });

    it('非法前缀技能名抛错', () => {
        expect(() =>
            generateSkillContent({ ...template, name: 'bad_prefix' }, '0.1.0')
        ).toThrow(/iagent_/);
    });

    it('description 含特殊字符时被 YAML 转义包裹', () => {
        const generated = generateSkillContent(
            { ...template, description: '含: 冒号"引号"的描述' },
            '0.1.0'
        );
        expect(generated.fileContent).toContain('description: "');
    });
});

describe('Claude 指令生成', () => {
    it('指令路径符合 .claude/commands/iagent/<id>.md 规范', () => {
        // 平台无关断言：统一转换为正斜杠比较（项目规范：Windows 兼容）
        const normalized = claudeAdapter.getFilePath('pwd').replaceAll('\\', '/');
        expect(normalized).toBe('.claude/commands/iagent/pwd.md');
    });

    it('frontmatter 含 name/description/allowed-tools/category/tags', () => {
        const [{ template, id }] = getCommandTemplates('init');
        const content = {
            id,
            name: template.name,
            description: template.description,
            category: template.category,
            tags: template.tags,
            body: template.content,
            // 白名单由配对技能派生（registry 单点回填），此处透传后逐值断言
            allowedTools: template.allowedTools,
        };
        const generated = generateCommand(content, claudeAdapter);
        expect(generated.path).toContain('project-init.md');
        expect(generated.fileContent).toContain(`allowed-tools: ${content.allowedTools}`);
        // name 含冒号时被 YAML 转义为双引号包裹："iAgent: 初始化项目"
        expect(generated.fileContent).toContain(`name: "${template.name}"`);
        expect(generated.fileContent).toContain('description:');
        expect(generated.fileContent).toContain(template.content.slice(0, 20));
    });
});

describe('Pi prompt 指令生成', () => {
    it('指令路径为 .pi/prompts/iagent-<id>.md（扁平前缀布局）', () => {
        const normalized = piAdapter.getFilePath('pwd').replaceAll('\\', '/');
        expect(normalized).toBe('.pi/prompts/iagent-pwd.md');
    });

    it('frontmatter 去 Claude 专有字段、保留 description 与指纹记账', () => {
        const [{ template, id }] = getCommandTemplates('init');
        const content = {
            id,
            name: template.name,
            description: template.description,
            category: template.category,
            tags: template.tags,
            body: template.content,
            allowedTools: template.allowedTools,
            generatedBy: '2.0.0',
        };
        const generated = generateCommand(content, piAdapter);
        expect(generated.path.replaceAll('\\', '/')).toContain('.pi/prompts/iagent-project-init.md');

        // 仅取 frontmatter 区段断言（正文可能含同名文本）
        const frontmatter = generated.fileContent.split('---')[1] ?? '';
        expect(frontmatter).toContain(`description: ${template.description}`);
        expect(frontmatter).not.toMatch(/^\s*name:/m);
        expect(frontmatter).not.toMatch(/^\s*allowed-tools:/m);
        expect(frontmatter).not.toMatch(/^\s*category:/m);
        expect(frontmatter).not.toMatch(/^\s*tags:/m);
        expect(frontmatter).toContain('generatedBy: "2.0.0"');

        // 指纹自洽：update 的手改保护对 Pi prompt 可用
        const fp = readGeneratedFingerprint(generated.fileContent);
        expect(fp).toBeDefined();
        expect(fp).toBe(fingerprintOf(generated.fileContent));
    });

    /** 构造极简 Pi 指令内容（仅 body 可变） */
    function piContent(body: string) {
        return {
            id: 'workflow',
            name: 'workflow',
            description: '测试指令',
            category: 'impl',
            tags: [] as string[],
            body,
            allowedTools: 'Read',
            generatedBy: '6.5.0',
        };
    }

    it('无参数占位符且 Input 段需要参数时注入 $ARGUMENTS', () => {
        const generated = generateCommand(
            piContent('**Input**: The argument after the command is the topic.\n\n## Steps\n\nDo it.'),
            piAdapter
        );
        expect(generated.fileContent).toContain('**Provided arguments**: $ARGUMENTS');
    });

    it('Input 段声明 None required 时不注入', () => {
        const generated = generateCommand(
            piContent('**Input**: None required (prompts for selection)\n\n## Steps\n\nDo it.'),
            piAdapter
        );
        expect(generated.fileContent).not.toContain('Provided arguments');
    });

    it('正文已含占位符时不重复注入', () => {
        const generated = generateCommand(
            piContent('**Input**: Provide the topic.\n\nUse $ARGUMENTS here.'),
            piAdapter
        );
        expect(generated.fileContent.match(/\$ARGUMENTS/g)?.length).toBe(1);
    });
});

describe('OpenCode 指令生成', () => {
    it('指令路径为 .opencode/commands/iagent-<id>.md（扁平前缀布局）', () => {
        const normalized = opencodeAdapter.getFilePath('spec-apply').replaceAll('\\', '/');
        expect(normalized).toBe('.opencode/commands/iagent-spec-apply.md');
    });

    it('frontmatter 仅 description + 记账字段，去 Claude 专有字段且指纹自洽', () => {
        const [{ template, id }] = getCommandTemplates('init');
        const content = {
            id,
            name: template.name,
            description: template.description,
            category: template.category,
            tags: template.tags,
            body: template.content,
            allowedTools: template.allowedTools,
            generatedBy: '6.3.0',
        };
        const generated = generateCommand(content, opencodeAdapter);
        expect(generated.path.replaceAll('\\', '/')).toContain('.opencode/commands/iagent-project-init.md');

        const frontmatter = generated.fileContent.split('---')[1] ?? '';
        expect(frontmatter).toContain('description:');
        expect(frontmatter).not.toMatch(/^\s*name:/m);
        expect(frontmatter).not.toMatch(/^\s*allowed-tools:/m);
        expect(frontmatter).not.toMatch(/^\s*category:/m);
        expect(frontmatter).not.toMatch(/^\s*tags:/m);
        expect(frontmatter).toContain('generatedBy: "6.3.0"');

        const fp = readGeneratedFingerprint(generated.fileContent);
        expect(fp).toBeDefined();
        expect(fp).toBe(fingerprintOf(generated.fileContent));
    });

    /** 构造极简 OpenCode 指令内容（仅 body 可变） */
    function opencodeContent(body: string) {
        return {
            id: 'workflow',
            name: 'workflow',
            description: '测试指令',
            category: 'impl',
            tags: [] as string[],
            body,
            allowedTools: 'Read',
            generatedBy: '6.3.0',
        };
    }

    it('无参数占位符且 Input 段需要参数时注入 $ARGUMENTS', () => {
        const generated = generateCommand(
            opencodeContent('**Input**: The argument after the command is the topic.\n\n## Steps\n\nDo it.'),
            opencodeAdapter
        );
        expect(generated.fileContent).toContain('**Provided arguments**: $ARGUMENTS');
    });

    it('Input 段声明 None required 时不注入', () => {
        const generated = generateCommand(
            opencodeContent('**Input**: None required (prompts for selection)\n\n## Steps\n\nDo it.'),
            opencodeAdapter
        );
        expect(generated.fileContent).not.toContain('Provided arguments');
    });

    it('正文已含占位符时不重复注入', () => {
        const generated = generateCommand(
            opencodeContent('**Input**: Provide the topic.\n\nUse $ARGUMENTS here.'),
            opencodeAdapter
        );
        expect(generated.fileContent.match(/\$ARGUMENTS/g)?.length).toBe(1);
    });
});

// 变更 fix-multi-agent-skill-command-generation / 任务 1.2 / 1.4：
// generateSkillContent 全字段与 references 统一归一化（不依赖 options.hostId）。
describe('技能 ID 统一归一化（全字段 + references）', () => {
    const template = {
        name: 'iagent_spec_apply',
        description: '委派 iagent_test 与 iagent_spec_verify 的示例描述',
        compatibility: '依赖 iagent_spec_verify_proposal',
        instructions: '委派 `iagent_test` 生成回归测试；由 iagent_spec_apply 承载。',
        allowedTools: 'Read',
        type: 'impl' as const,
        references: [
            { path: 'references/notes.md', content: '参考 iagent_feature_doc 与 iagent_review。' },
        ],
    };

    it('未传 hostId 时 description / compatibility / 正文 / references 全部归一化', () => {
        const generated = generateSkillContent(template, '1.0.0');
        expect(generated.fileContent).toContain('iagent-test');
        expect(generated.fileContent).not.toMatch(/\biagent_(test|spec_verify|spec_apply)\b/);
        expect(generated.references?.[0].content).toContain('iagent-feature-doc');
        expect(generated.references?.[0].content).toContain('iagent-review');
        expect(generated.references?.[0].content).not.toMatch(/\biagent_[a-z]/);
    });

    it('references 路径保持不变（只改写内容）', () => {
        const generated = generateSkillContent(template, '1.0.0', { hostId: 'pi' });
        expect(generated.references?.[0].path).toBe('references/notes.md');
    });
});

// 变更 fix-multi-agent-skill-command-generation / 任务 2.1 / 2.3：
// Pi 与 OpenCode 的参数注入矩阵（围栏隔离 + 仅首个顶层段 + 无参跳过）。
describe('Pi / OpenCode 参数注入矩阵', () => {
    const commandTemplates = getCommandTemplates();

    /** 用指定适配器格式化工具无关正文 */
    function formatWith(adapter: typeof piAdapter, body: string): string {
        const generated = generateCommand(
            {
                id: 'sample',
                name: 'sample',
                description: '示例',
                category: 'impl',
                tags: [],
                body,
                allowedTools: 'Read',
                generatedBy: '9.9.9',
            },
            adapter
        );
        return generated.fileContent;
    }

    for (const [label, adapter] of [
        ['Pi', piAdapter],
        ['OpenCode', opencodeAdapter],
    ] as const) {
        it(`${label}：20 个内置指令中 19 个注入 $ARGUMENTS，spec-bulk-archive 跳过`, () => {
            const injected: string[] = [];
            const skipped: string[] = [];
            for (const { template, id } of commandTemplates) {
                const output = formatWith(adapter, template.content);
                if (output.includes('**Provided arguments**: $ARGUMENTS')) {
                    injected.push(id);
                } else {
                    skipped.push(id);
                }
            }
            expect(injected.length).toBe(19);
            expect(skipped).toEqual(['spec-bulk-archive']);
        });

        it(`${label}：顶层中文 **输入**：注入占位符`, () => {
            const output = formatWith(adapter, '**输入**：待验证评分的变更名称。\n\n## 步骤\n\n执行。');
            expect(output).toContain('**Provided arguments**: $ARGUMENTS');
        });

        it(`${label}：顶层英文 **Input**: 注入占位符`, () => {
            const output = formatWith(adapter, '**Input**: topic\n\n## Steps\n\nDo it.');
            expect(output).toContain('**Provided arguments**: $ARGUMENTS');
        });

        it(`${label}：围栏代码块内的输入示例不触发误注入`, () => {
            const output = formatWith(
                adapter,
                '## 报告模板\n\n```markdown\n**输入**: 示例内容\n```\n\n~~~\n**输入**: 示例\n~~~\n\n无顶层输入段。'
            );
            expect(output).not.toContain('Provided arguments');
        });

        it(`${label}：首个顶层输入段之后注入，非顶层示例段被排除`, () => {
            const output = formatWith(
                adapter,
                '**输入**：变更名称（可选）。\n\n## 检查示例\n\n**输入**: add-order-query\n\n执行。'
            );
            const first = output.indexOf('**Provided arguments**: $ARGUMENTS');
            expect(first).toBeGreaterThan(-1);
            expect(output.indexOf('## 检查示例')).toBeGreaterThan(first);
            expect(output.match(/Provided arguments/g)?.length).toBe(1);
        });

        // 真实模板回归：proposal-review 正文的 `## 检查示例` 段含未围栏同形行
        // （`**输入**: 检查变更提案 ...`），只能靠「仅首个顶层段」排除。
        it(`${label}：proposal-review 模板只在顶层输入段注入一次（示例段同形行不触发）`, () => {
            const review = commandTemplates.find(({ id }) => id === 'proposal-review');
            expect(review).toBeDefined();
            const output = formatWith(adapter, review?.template.content ?? '');
            const matches = output.match(/Provided arguments/g) ?? [];
            expect(matches.length).toBe(1);
            // 注入点位于 `## 检查示例` 之前
            expect(output.indexOf('**Provided arguments**: $ARGUMENTS')).toBeLessThan(
                output.indexOf('## 检查示例')
            );
        });

        it(`${label}：无参声明（None required / 无需参数）跳过注入`, () => {
            const none = formatWith(adapter, '**Input**: None required (prompts for selection)\n\nDo it.');
            const zhongwen = formatWith(adapter, '**输入**：无需参数（会提示选择）\n\n执行。');
            expect(none).not.toContain('Provided arguments');
            expect(zhongwen).not.toContain('Provided arguments');
        });

        it(`${label}：已含 $ARGUMENTS / $@ / $1 占位符时跳过注入`, () => {
            for (const body of [
                '**输入**：主题。\n\n使用 $ARGUMENTS。',
                '**输入**：主题。\n\n使用 $@ 传递。',
                '**输入**：主题。\n\n使用 $1 传递。',
            ]) {
                const output = formatWith(adapter, body);
                expect(output).not.toContain('Provided arguments');
            }
        });
    }
});

describe('用户自定义 description 保持原文（生成器不翻译）', () => {
    it('runGenerate 的 --desc 逐字写入 frontmatter（英文与中英混排均不转换）', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-desc-'));
        try {
            const desc = 'Do NOT translate this 混合 description: keep "quotes" and Keep a Changelog';
            const result = runGenerate(root, { type: 'impl', name: 'custom-desc', desc });
            const skillFile = fs.readFileSync(
                path.join(root, 'skills', result.skillName, 'SKILL.md'),
                'utf8'
            );
            // YAML 转义仅包裹，不改写文本；原文逐字保留
            expect(skillFile).toContain(escapeYamlValue(desc));
            expect(skillFile).toContain('Do NOT translate this');
            expect(skillFile).toContain('Keep a Changelog');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('YAML 工具', () => {
    it('普通文本不加引号', () => {
        expect(escapeYamlValue('simple-text')).toBe('simple-text');
    });

    it('含冒号/引号文本加双引号并转义', () => {
        expect(escapeYamlValue('a: b')).toBe('"a: b"');
        expect(escapeYamlValue('say "hi"')).toBe('"say \\"hi\\""');
    });

    it('数组格式化', () => {
        expect(formatTagsArray(['iagent', 'tools'])).toBe('[iagent, tools]');
    });
});

// 变更 fix-skill-contract-drift / D4：指令形态 references 可解析。
describe('指令形态 references 重写', () => {
    it('按宿主派生技能 references 目录', () => {
        expect(skillReferencesBasePath('claude', 'spec-apply')).toBe(
            '.claude/skills/iagent-spec-apply/references'
        );
        expect(skillReferencesBasePath('pi', 'spec-explore')).toBe(
            '.pi/skills/iagent-spec-explore/references'
        );
        expect(skillReferencesBasePath('opencode', 'spec-apply')).toBe(
            '.opencode/skills/iagent-spec-apply/references'
        );
        // skills-only 无指令产物，不重写
        expect(skillReferencesBasePath('codex', 'spec-apply')).toBeNull();
    });

    it('重写裸 references 且幂等', () => {
        const base = '.claude/skills/iagent-spec-apply/references';
        const once = rewriteReferencePaths('见 references/compile-check.md', base);
        expect(once).toBe(`见 ${base}/compile-check.md`);
        expect(rewriteReferencePaths(once, base)).toBe(once);
    });

    it('全部指令的 references 均映射到配对技能声明', () => {
        const skills = getSkillTemplates();
        const offenders: string[] = [];
        for (const { template, id } of getCommandTemplates()) {
            const skill = skills.find((entry) => entry.commandId === id);
            expect(skill, `指令 ${id} 无配对技能`).toBeDefined();
            const declared = new Set((skill!.template.references ?? []).map((ref) => ref.path));
            for (const match of template.content.matchAll(/references\/[A-Za-z0-9._-]+\.md/g)) {
                if (!declared.has(match[0])) {
                    offenders.push(`${id}: ${match[0]} 未在技能 references 中声明`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('生成期重写覆盖 Claude / Pi / OpenCode 三种指令布局', () => {
        const id = 'spec-apply';
        const command = getCommandTemplates().find((entry) => entry.id === id)!;
        for (const [tool, base] of [
            ['claude', '.claude/skills/iagent-spec-apply/references'],
            ['pi', '.pi/skills/iagent-spec-apply/references'],
            ['opencode', '.opencode/skills/iagent-spec-apply/references'],
        ] as const) {
            const rewritten = rewriteReferencePaths(command.template.content, skillReferencesBasePath(tool, id));
            expect(rewritten, tool).toContain(`${base}/compile-check.md`);
            expect(rewritten, tool).toContain(`${base}/batch-scheduling.md`);
            expect(rewritten, tool).not.toMatch(/[^/\w.-]references\/compile-check\.md/);
        }
    });
});

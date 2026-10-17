/**
 * 生成层测试：SKILL.md 内容、指令文件格式、YAML 转义。
 */

import { describe, it, expect } from 'vitest';
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
} from '../src/core/command-generation/index.js';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';

describe('SKILL.md 生成', () => {
    const [{ template }] = getSkillTemplates('init');

    it('frontmatter 含 name/description/type 字段', () => {
        const generated = generateSkillContent(template, '0.1.0');
        expect(generated.dirName).toBe(template.name);
        expect(generated.fileContent).toContain(`name: ${template.name}`);
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

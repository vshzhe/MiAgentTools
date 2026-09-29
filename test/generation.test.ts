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
} from '../src/core/command-generation/index.js';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';

describe('SKILL.md 生成', () => {
    const [{ template }] = getSkillTemplates('tr_tools');

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
        ).toThrow(/venus_/);
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
    it('指令路径符合 .claude/commands/venus/<id>.md 规范', () => {
        // 平台无关断言：统一转换为正斜杠比较（项目规范：Windows 兼容）
        const normalized = claudeAdapter.getFilePath('tr-tools-pwd').replaceAll('\\', '/');
        expect(normalized).toBe('.claude/commands/venus/tr-tools-pwd.md');
    });

    it('frontmatter 含 name/description/allowed-tools/category/tags', () => {
        const [{ template, id }] = getCommandTemplates('tr_tools');
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
        expect(generated.path).toContain('tr-tools-pwd.md');
        expect(generated.fileContent).toContain(`allowed-tools: ${content.allowedTools}`);
        // name 含冒号时被 YAML 转义为双引号包裹："Venus: 查看当前路径"
        expect(generated.fileContent).toContain(`name: "${template.name}"`);
        expect(generated.fileContent).toContain('description: 查看当前路径');
        expect(generated.fileContent).toContain(template.content.slice(0, 20));
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
        expect(formatTagsArray(['venus', 'tr_tools'])).toBe('[venus, tr_tools]');
    });
});

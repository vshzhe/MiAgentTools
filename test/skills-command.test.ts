/**
 * iagent skills 命令：枚举输出与完整性校验（JSON / 文本 / 只读）。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildSkillsCommand } from '../src/commands/skills.js';
import { collectProjectSkills, renderSkillsText } from '../src/core/project-skills.js';

function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-skills-cli-'));
}

const VALID = [
    '---',
    'name: backend-design',
    'description: 后端设计实现规范',
    'phases: both',
    'scope: backend',
    'source: distilled',
    '---',
    '## 框架与版本',
    '- Spring（证据：pom.xml:10）',
    '## 目录与分层',
    '- Controller/Service/DAO（证据：src/main/java/App.java:1）',
    '## 设计规范',
    '- 事务边界在 Service（证据：src/main/java/App.java:5）',
    '## 实现规范',
    '- 异常统一 ErrorCode（证据：src/main/java/App.java:9）',
    '## 约定与禁止项',
    '- 禁止跨层调用（证据：src/main/java/App.java:12）',
    '## 证据索引',
    '- pom.xml:10',
    '## 不适用项',
    '- 无',
    '',
].join('\n');

describe('iagent skills 命令', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
        fs.mkdirSync(path.join(projectRoot, '.iagent', 'skills'), { recursive: true });
        fs.writeFileSync(
            path.join(projectRoot, '.iagent', 'config.yaml'),
            'skills:\n  backend:\n    - backend-design\n    - missing-skill\n',
            'utf8'
        );
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('构造 skills 命令且含 --json', () => {
        const command = buildSkillsCommand();
        expect(command.name()).toBe('skills');
        expect(command.options.some((option) => option.long === '--json')).toBe(true);
    });

    it('JSON 输出含路径 / 哈希 / frontmatter / validation', () => {
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'skills', 'backend-design.md'), VALID, 'utf8');
        const output = collectProjectSkills(projectRoot);
        const entries = output.groups.flatMap((group) => group.entries);
        const present = entries.find((entry) => entry.name === 'backend-design');
        expect(present?.path).toBe('.iagent/skills/backend-design.md');
        expect(present?.sha256).toHaveLength(12);
        expect(present?.phases).toBe('both');
        expect(present?.validation).toEqual({
            status: 'ok',
            missingSections: [],
            emptySections: [],
            placeholders: [],
            ruleLinesWithoutEvidence: 0,
            nameMismatch: false,
        });
    });

    it('无配置返回空集合并可渲染「无技能配置」', () => {
        const emptyRoot = makeTempProject();
        try {
            const output = collectProjectSkills(emptyRoot);
            expect(output.groups).toEqual([]);
            expect(renderSkillsText(output)).toContain('无技能配置');
        } finally {
            fs.rmSync(emptyRoot, { recursive: true, force: true });
        }
    });

    it('缺章节判 incomplete', () => {
        const content = VALID.replace('## 实现规范\n- 异常统一 ErrorCode（证据：src/main/java/App.java:9）\n', '');
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'skills', 'backend-design.md'), content, 'utf8');
        const entry = collectProjectSkills(projectRoot).groups[0]?.entries[0];
        expect(entry?.validation?.status).toBe('incomplete');
        expect(entry?.validation?.missingSections).toContain('## 实现规范');
    });

    it('含占位符判 incomplete', () => {
        const content = VALID.replace('## 不适用项\n- 无\n', '## 不适用项\n- TODO\n');
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'skills', 'backend-design.md'), content, 'utf8');
        const entry = collectProjectSkills(projectRoot).groups[0]?.entries[0];
        expect(entry?.validation?.status).toBe('incomplete');
        expect(entry?.validation?.placeholders.length).toBeGreaterThan(0);
    });

    it('不存在条目 validation=null', () => {
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'skills', 'backend-design.md'), VALID, 'utf8');
        const missing = collectProjectSkills(projectRoot)
            .groups[0]?.entries.find((entry) => entry.name === 'missing-skill');
        expect(missing?.exists).toBe(false);
        expect(missing?.validation).toBeNull();
    });

    it('命令只读：枚举不修改配置与技能文件', () => {
        const skillPath = path.join(projectRoot, '.iagent', 'skills', 'backend-design.md');
        fs.writeFileSync(skillPath, VALID, 'utf8');
        const configPath = path.join(projectRoot, '.iagent', 'config.yaml');
        const configBefore = fs.readFileSync(configPath, 'utf8');
        collectProjectSkills(projectRoot);
        expect(fs.readFileSync(skillPath, 'utf8')).toBe(VALID);
        expect(fs.readFileSync(configPath, 'utf8')).toBe(configBefore);
    });
});

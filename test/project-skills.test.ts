/**
 * project-skill-config：项目技能路径解析、frontmatter 与完整性校验。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    collectProjectSkills,
    parseSkillFrontmatter,
    renderSkillsText,
    resolveProjectSkillPath,
    validateProjectSkill,
} from '../src/core/project-skills.js';

function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-skills-'));
}

function skillBody(options: { name?: string; phases?: string; includeImplement?: boolean } = {}): string {
    const name = options.name ?? 'frontend-design';
    const phases = options.phases ?? 'both';
    const lines = [
        '---',
        `name: ${name}`,
        'description: 前端设计实现规范',
        `phases: ${phases}`,
        'scope: frontend',
        'source: distilled',
        '---',
        '## 框架与版本',
        '- Vue 3（证据：package.json:12）',
        '## 目录与分层',
        '- 页面位于 src/views（证据：src/views/Home.vue:1）',
        '## 设计规范',
        '- 每页覆盖 Loading/Empty/Error/Data（证据：docs/project/architecture/技术框架.md）',
    ];
    if (options.includeImplement !== false) {
        lines.push('## 实现规范', '- 组件命名 PascalCase（证据：src/components/App.vue:3）');
    }
    lines.push(
        '## 约定与禁止项',
        '- 禁止直接操作 DOM（证据：src/views/Home.vue:9）',
        '## 证据索引',
        '- package.json:12',
        '## 不适用项',
        options.includeImplement === false ? '- 实现规范：证据不足' : '- 无',
        ''
    );
    return lines.join('\n');
}

describe('项目技能载体', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
        fs.mkdirSync(path.join(projectRoot, '.iagent', 'skills'), { recursive: true });
        fs.writeFileSync(
            path.join(projectRoot, '.iagent', 'config.yaml'),
            'skills:\n  frontend:\n    - frontend-design\n',
            'utf8'
        );
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('读取有效技能文件并返回元数据', () => {
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md'), skillBody(), 'utf8');
        const entry = collectProjectSkills(projectRoot).groups[0]?.entries[0];
        expect(entry?.exists).toBe(true);
        expect(entry?.path).toBe('.iagent/skills/frontend-design.md');
        expect(entry?.sha256).toHaveLength(12);
        expect(entry?.phases).toBe('both');
        expect(entry?.scope).toBe('frontend');
        expect(entry?.source).toBe('distilled');
        expect(entry?.validation?.status).toBe('ok');
    });

    it('frontmatter 非法计为不完整且不猜测阶段', () => {
        fs.writeFileSync(
            path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md'),
            '---\nname: frontend-design\nphases: 未知\n---\n## 框架与版本\n- x\n',
            'utf8'
        );
        const entry = collectProjectSkills(projectRoot).groups[0]?.entries[0];
        expect(entry?.phases).toBeNull();
        expect(entry?.validation?.status).toBe('incomplete');
    });

    it('name 与文件名不一致', () => {
        fs.writeFileSync(
            path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md'),
            skillBody({ name: 'frontend-design-v2' }),
            'utf8'
        );
        const entry = collectProjectSkills(projectRoot).groups[0]?.entries[0];
        expect(entry?.validation?.nameMismatch).toBe(true);
        expect(entry?.validation?.status).toBe('incomplete');
    });

    it('缺少必需章节判 incomplete', () => {
        fs.writeFileSync(
            path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md'),
            ['---', 'name: frontend-design', 'description: x', 'phases: both', 'scope: frontend', 'source: distilled', '---', '## 框架与版本', '- x（证据：package.json:1）'].join('\n'),
            'utf8'
        );
        const entry = collectProjectSkills(projectRoot).groups[0]?.entries[0];
        expect(entry?.validation?.missingSections.length).toBeGreaterThan(0);
        expect(entry?.validation?.status).toBe('incomplete');
    });

    it('占位符判 incomplete', () => {
        const content = skillBody().replace('## 不适用项\n- 无\n', '## 不适用项\n- [待补充]\n');
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md'), content, 'utf8');
        const entry = collectProjectSkills(projectRoot).groups[0]?.entries[0];
        expect(entry?.validation?.placeholders.length).toBeGreaterThan(0);
        expect(entry?.validation?.status).toBe('incomplete');
    });

    it('拆分产物按 phases 计算必需章节', () => {
        fs.writeFileSync(
            path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md'),
            skillBody({ phases: 'design', includeImplement: false }),
            'utf8'
        );
        const entry = collectProjectSkills(projectRoot).groups[0]?.entries[0];
        expect(entry?.validation?.missingSections).toEqual([]);
        expect(entry?.validation?.status).toBe('ok');
    });

    it('.iagent 优先于宿主目录，且同名冲突不合并', () => {
        fs.mkdirSync(path.join(projectRoot, '.claude', 'skills', 'frontend-design'), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, '.claude', 'skills', 'frontend-design', 'SKILL.md'), skillBody(), 'utf8');
        fs.writeFileSync(path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md'), skillBody(), 'utf8');
        const resolved = resolveProjectSkillPath(projectRoot, 'frontend-design', [{ skillsDir: '.claude' }]);
        expect(resolved).toBe(path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md'));
        const entry = collectProjectSkills(projectRoot, [{ skillsDir: '.claude' }]).groups[0]?.entries[0];
        expect(entry?.path).toBe('.iagent/skills/frontend-design.md');
    });

    it('回退宿主目录并按工具顺序命中', () => {
        fs.mkdirSync(path.join(projectRoot, '.pi', 'skills', 'frontend-design'), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, '.pi', 'skills', 'frontend-design', 'SKILL.md'), skillBody(), 'utf8');
        const resolved = resolveProjectSkillPath(projectRoot, 'frontend-design', [
            { skillsDir: '.claude' },
            { skillsDir: '.pi' },
        ]);
        expect(resolved).toBe(path.join(projectRoot, '.pi', 'skills', 'frontend-design', 'SKILL.md'));
        const entry = collectProjectSkills(projectRoot, [{ skillsDir: '.claude' }, { skillsDir: '.pi' }]).groups[0]?.entries[0];
        expect(entry?.path).toBe('.pi/skills/frontend-design/SKILL.md');
    });

    it('全部未命中 exists=false 且 validation=null', () => {
        const entry = collectProjectSkills(projectRoot, [{ skillsDir: '.claude' }]).groups[0]?.entries[0];
        expect(entry?.exists).toBe(false);
        expect(entry?.validation).toBeNull();
    });

    it('无配置输出空集合与「无技能配置」文案', () => {
        const emptyRoot = makeTempProject();
        try {
            const output = collectProjectSkills(emptyRoot);
            expect(output.groups).toEqual([]);
            expect(renderSkillsText(output)).toContain('无技能配置');
        } finally {
            fs.rmSync(emptyRoot, { recursive: true, force: true });
        }
    });

    it('parseSkillFrontmatter 读取数组与布尔字段', () => {
        const frontmatter = parseSkillFrontmatter(
            '---\nname: x\nphases: design\nscope: backend\nframeworks: [spring, mybatis]\nsource: user\n---\n'
        );
        expect(frontmatter).toEqual({
            name: 'x',
            phases: 'design',
            scope: 'backend',
            frameworks: ['spring', 'mybatis'],
            source: 'user',
        });
    });

    it('validateProjectSkill 统计无证据规则行', () => {
        const content = skillBody().replace(
            '- 组件命名 PascalCase（证据：src/components/App.vue:3）',
            '- 组件命名 PascalCase'
        );
        const validation = validateProjectSkill('frontend-design', content, parseSkillFrontmatter(content));
        expect(validation.ruleLinesWithoutEvidence).toBeGreaterThan(0);
        expect(validation.status).toBe('incomplete');
    });

    it('只读：枚举不修改文件', () => {
        const file = path.join(projectRoot, '.iagent', 'skills', 'frontend-design.md');
        fs.writeFileSync(file, skillBody(), 'utf8');
        const before = fs.readFileSync(file, 'utf8');
        collectProjectSkills(projectRoot);
        expect(fs.readFileSync(file, 'utf8')).toBe(before);
    });
});

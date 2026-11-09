/**
 * project-skill-config：`skills:` 段解析、回写与幂等注册。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    parseProjectConfig,
    readSkillsSection,
    registerSkillInConfig,
    writeSkillsToConfig,
} from '../src/core/project-config.js';

function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-skills-config-'));
}

describe('skills 配置段', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
        fs.mkdirSync(path.join(projectRoot, '.iagent'), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('解析分组条目', () => {
        const raw = [
            'context: |',
            '  背景',
            'skills:',
            '  frontend:',
            '    - frontend-design',
            '    - frontend-extra',
            '  backend:',
            '    - backend-design',
            'workflows:',
            '  - spec-explore',
        ].join('\n');
        expect(readSkillsSection(raw)).toEqual([
            { role: 'frontend', entries: ['frontend-design', 'frontend-extra'] },
            { role: 'backend', entries: ['backend-design'] },
        ]);
        expect(parseProjectConfig(raw).skills).toHaveLength(2);
    });

    it('无 skills 段为空集', () => {
        const raw = 'context: |\n  背景\nworkflows:\n  - spec-explore\n';
        expect(readSkillsSection(raw)).toEqual([]);
        expect(parseProjectConfig(raw).skills).toEqual([]);
    });

    it('忽略未知角色与非法条目，注释不影响解析', () => {
        const raw = [
            'skills:',
            '  # 说明',
            '  frontend:',
            '    - a',
            '  tools:',
            '    - b',
            '  backend:',
            '    - c',
        ].join('\n');
        expect(readSkillsSection(raw)).toEqual([
            { role: 'frontend', entries: ['a'] },
            { role: 'backend', entries: ['c'] },
        ]);
    });

    it('回写保留注释与未知段', () => {
        const configPath = path.join(projectRoot, '.iagent', 'config.yaml');
        fs.writeFileSync(
            configPath,
            ['# 头注释', 'context: |', '  背景', 'custom-section:', '  key: value', 'skills:', '  frontend:', '    - old'].join('\n'),
            'utf8',
        );
        writeSkillsToConfig(projectRoot, [{ role: 'backend', entries: ['backend-design'] }]);
        const text = fs.readFileSync(configPath, 'utf8');
        expect(text).toContain('# 头注释');
        expect(text).toContain('custom-section:');
        expect(text).toContain('  key: value');
        expect(text).toContain('  backend:');
        expect(text).toContain('    - backend-design');
        expect(text).not.toContain('    - old');
    });

    it('自动注册幂等', () => {
        const configPath = path.join(projectRoot, '.iagent', 'config.yaml');
        fs.writeFileSync(configPath, 'context: |\n  背景\n# 注释\n', 'utf8');
        expect(registerSkillInConfig(projectRoot, 'frontend', 'frontend-design')).toBe(true);
        const first = fs.readFileSync(configPath, 'utf8');
        expect(first).toContain('  frontend:');
        expect(first).toContain('    - frontend-design');
        expect(registerSkillInConfig(projectRoot, 'frontend', 'frontend-design')).toBe(false);
        const second = fs.readFileSync(configPath, 'utf8');
        expect(second).toBe(first);
        expect(second.match(/- frontend-design/g)).toHaveLength(1);
    });
});

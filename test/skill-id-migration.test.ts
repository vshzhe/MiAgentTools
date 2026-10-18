/**
 * canonical 技能 ID 与 legacy 下划线 → kebab-case 迁移回归锁。
 *
 * 变更 add-host-orchestration-adapters：宿主技能 ID 统一为 `iagent-<workflowId>`，
 * 旧 `iagent_<name>` 仅作兼容解析并可自动迁移。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    SKILL_ID_PREFIX,
    deriveSkillId,
    isLegacySkillId,
    isManagedSkillDirName,
    skillIdToWorkflowId,
    toCanonicalSkillId,
} from '../src/core/skill-id.js';
import { runSkillIdMigration } from '../src/core/skill-id-migration.js';
import { generateSkillContent } from '../src/core/command-generation/index.js';
import { getSkillTemplates } from '../src/core/templates/index.js';
import { runInit } from '../src/commands/init.js';
import { runList, scanInstalledSkills } from '../src/commands/list.js';
import { findSkills } from '../src/commands/show.js';
import { runValidate } from '../src/commands/validate.js';
import { fingerprintOf, readGeneratedFingerprint } from '../src/core/command-generation/index.js';

/** 写文件（自动建父目录） */
function writeAt(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

describe('canonical 技能 ID 派生', () => {
    it('内部名 → 宿主 ID 为 kebab-case（iagent-<workflowId>）', () => {
        expect(deriveSkillId('iagent_spec_explore')).toBe('iagent-spec-explore');
        expect(deriveSkillId('iagent_workflow')).toBe('iagent-workflow');
        expect(deriveSkillId('iagent_project_init')).toBe('iagent-project-init');
        expect(deriveSkillId('iagent_spec_explore').startsWith(SKILL_ID_PREFIX)).toBe(true);
    });

    it('canonical 与 legacy 均被识别，legacy 可规范化', () => {
        expect(isManagedSkillDirName('iagent-spec-explore')).toBe(true);
        expect(isManagedSkillDirName('iagent_spec_explore')).toBe(true);
        expect(isManagedSkillDirName('other_skill')).toBe(false);

        expect(isLegacySkillId('iagent_spec_explore')).toBe(true);
        expect(isLegacySkillId('iagent-spec-explore')).toBe(false);

        expect(toCanonicalSkillId('iagent_spec_explore')).toBe('iagent-spec-explore');
        expect(toCanonicalSkillId('iagent-spec-explore')).toBe('iagent-spec-explore');
        expect(toCanonicalSkillId('other')).toBe('other');

        expect(skillIdToWorkflowId('iagent-spec-explore')).toBe('spec-explore');
        expect(skillIdToWorkflowId('iagent_spec_explore')).toBe('spec-explore');
    });

    it('生成产物的目录名与 frontmatter name 均为 canonical', () => {
        const [{ template }] = getSkillTemplates('spec');
        const generated = generateSkillContent(template, 'snapshot');
        const skillId = deriveSkillId(template.name);
        expect(generated.dirName).toBe(skillId);
        expect(generated.fileContent).toContain(`name: ${skillId}`);
    });
});

describe('legacy 下划线技能目录迁移', () => {
    let root: string;

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-skillid-'));
    });

    afterAll(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('迁移可识别的 legacy 目录并同步 name 与指纹', () => {
        const legacyDir = path.join(root, '.claude', 'skills', 'iagent_spec_apply');
        // 用真实生成内容构造「指纹自洽」的 legacy 产物（仅把 name 还原为下划线形态）
        const [{ template }] = getSkillTemplates('spec').filter((t) => t.template.name === 'iagent_spec_apply');
        const canonicalContent = generateSkillContent(template, 'snapshot').fileContent;
        const legacyContent = canonicalContent.replace(/^name: iagent-spec-apply$/m, 'name: iagent_spec_apply');
        writeAt(path.join(legacyDir, 'SKILL.md'), legacyContent);

        const report = runSkillIdMigration(root);
        expect(report.migrated).toBe(true);
        expect(report.moved.some((m) => m.includes('iagent_spec_apply') && m.includes('iagent-spec-apply'))).toBe(true);

        const migratedDir = path.join(root, '.claude', 'skills', 'iagent-spec-apply');
        expect(fs.existsSync(migratedDir)).toBe(true);
        expect(fs.existsSync(legacyDir)).toBe(false);

        const content = fs.readFileSync(path.join(migratedDir, 'SKILL.md'), 'utf8');
        expect(content).toContain('name: iagent-spec-apply');
        // 迁移后指纹仍自洽 → update 不会把它误判为手改
        expect(readGeneratedFingerprint(content)).toBe(fingerprintOf(content));
    });

    it('目标已存在时保留两者并告警，不覆盖', () => {
        const legacyDir = path.join(root, '.claude', 'skills', 'iagent_workflow');
        const canonicalDir = path.join(root, '.claude', 'skills', 'iagent-workflow');
        writeAt(path.join(legacyDir, 'SKILL.md'), 'legacy-body');
        writeAt(path.join(canonicalDir, 'SKILL.md'), 'canonical-body');

        const report = runSkillIdMigration(root);
        expect(report.skipped.some((s) => s.includes('iagent_workflow'))).toBe(true);
        expect(report.warnings.length).toBeGreaterThan(0);
        // 两者都在，内容未被覆盖
        expect(fs.readFileSync(path.join(legacyDir, 'SKILL.md'), 'utf8')).toBe('legacy-body');
        expect(fs.readFileSync(path.join(canonicalDir, 'SKILL.md'), 'utf8')).toBe('canonical-body');
    });

    it('非 iagent 目录不受影响', () => {
        const other = path.join(root, '.claude', 'skills', 'other_tool');
        writeAt(path.join(other, 'SKILL.md'), 'keep');
        runSkillIdMigration(root);
        expect(fs.readFileSync(path.join(other, 'SKILL.md'), 'utf8')).toBe('keep');
    });

    it('幂等：二次执行无改动', () => {
        const second = runSkillIdMigration(root);
        expect(second.moved).toEqual([]);
    });
});

describe('legacy alias 在 list/show/validate 中可解析', () => {
    let root: string;

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-alias-'));
        runInit(root, { tools: 'claude' });
    });

    afterAll(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('list 展示 canonical ID', () => {
        const skills = scanInstalledSkills(root);
        expect(skills.some((s) => s.name === 'iagent-project-init')).toBe(true);
        expect(skills.some((s) => s.name === 'iagent_project_init')).toBe(false);
        expect(runList(root)).toContain('iagent-project-init');
    });

    it('show 以 legacy 名查询命中 canonical 技能', () => {
        const details = findSkills(root, 'iagent_project_init');
        expect(details.length).toBe(1);
        expect(details[0].name).toBe('iagent-project-init');
    });

    it('validate 校验 canonical 产物通过', () => {
        const result = runValidate(root);
        expect(result.failed).toBe(0);
        expect(result.results.some((r) => r.skill === 'iagent-project-init')).toBe(true);
    });
});

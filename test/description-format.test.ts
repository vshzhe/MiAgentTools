/**
 * 技能 description 结构与长度约束。
 *
 * 对应变更 improve-skill-type-and-description 的
 * `agent-tool-identity / 技能 description 结构与长度约束`：
 *   1. 长度 ≤ 1024（硬上限，对齐 Agent Skills 规范）
 *   2. ≥ 800 软告警（console.warn，不失败）
 *   3. 结构：含中文用途表述
 *   4. 英文描述中文化时保留原英文触发关键词
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';

describe('技能 description 结构与长度约束', () => {
    const skills = getSkillTemplates();

    it('长度 ≤ 1024（硬上限）', () => {
        for (const { template } of skills) {
            expect(template.description.length, template.name).toBeLessThanOrEqual(1024);
        }
    });

    it('≥ 800 软告警（不失败）', () => {
        const long = skills.filter((s) => s.template.description.length >= 800);
        for (const { template } of long) {
            console.warn(
                `[description] ${template.name} 长度 ${template.description.length} ≥ 800，建议精简`
            );
        }
        // 软告警不失败
        expect(true).toBe(true);
    });

    it('结构统一：含中文用途表述', () => {
        for (const { template } of skills) {
            expect(/[\u4e00-\u9fa5]/.test(template.description), `${template.name} 缺中文用途`).toBe(true);
        }
    });

    it('英文关键词保留（4 个中文化技能）', () => {
        const byName = new Map(skills.map((s) => [s.template.name, s.template.description]));
        expect(byName.get('iagent_feature_doc')).toContain('feature map');
        expect(byName.get('iagent_feature_doc')).toContain('migration requirement document');
        expect(byName.get('iagent_migration')).toContain('auto migration');
        expect(byName.get('iagent_migration_check')).toContain('migration check');
        expect(byName.get('iagent_requirement_doc')).toContain('requirement document');
    });

    it('排歧：跨技能边界含 NOT for 表述', () => {
        const byName = new Map(skills.map((s) => [s.template.name, s.template.description]));
        for (const name of [
            'iagent_feature_doc',
            'iagent_migration',
            'iagent_migration_check',
            'iagent_requirement_doc',
        ]) {
            expect(byName.get(name), name).toContain('NOT for');
        }
    });
});

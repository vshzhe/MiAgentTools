/**
 * Markdown-first 回归锁（markdown-first-artifacts 变更）。
 *
 * 锁定已落地的 Markdown-first 契约：
 *   - spec-driven schema 的 artifact 输出路径均为 OpenSpec Markdown
 *   - 模板/指令正文 MUST NOT 指示渲染 proposal/specs/design MD
 *   - instructions 输出不再包含 jsonTemplate 字段
 */

import { describe, expect, it } from 'vitest';
import { SPEC_DRIVEN_SCHEMA } from '../src/core/spec/schema.js';
import { getArtifactInstructions } from '../src/core/spec/instructions.js';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Markdown-first 回归锁', () => {
    it('schema 的 artifact 输出路径为 OpenSpec Markdown', () => {
        const byId = new Map(SPEC_DRIVEN_SCHEMA.artifacts.map((a) => [a.id, a.outputPath]));
        expect(byId.get('proposal')).toBe('proposal.md');
        expect(byId.get('design')).toBe('design.md');
        expect(byId.get('specs')).toBe('specs/**/*.md');
        expect(byId.get('tasks')).toBe('tasks.md');
        expect(SPEC_DRIVEN_SCHEMA.apply.tracks).toBe('tasks.md');
    });

    it('模板/指令正文 MUST NOT 指示渲染 proposal/specs/design MD', () => {
        const bodies = [
            ...getSkillTemplates().map((entry) => entry.template.instructions),
            ...getCommandTemplates().map((entry) => entry.template.content),
        ];
        for (const body of bodies) {
            expect(body).not.toMatch(/iagent spec render (proposal|specs|design)/);
            expect(body).not.toMatch(/spec render <type>/);
        }
    });

    it('instructions 输出不含 jsonTemplate 字段', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-md-lock-'));
        try {
            const changeDir = path.join(root, 'openspec', 'changes', 'demo');
            fs.mkdirSync(changeDir, { recursive: true });
            const info = getArtifactInstructions(root, 'demo', 'proposal');
            expect('jsonTemplate' in info).toBe(false);
            expect(info.outputPath).toBe('proposal.md');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

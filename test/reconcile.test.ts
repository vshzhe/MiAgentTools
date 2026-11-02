/**
 * 跨宿主孤立产物扫描（reconcile）回归。
 *
 * 变更 fix-multi-agent-skill-command-generation / 任务 4.2 / 4.3：
 * `scanReconcileOrphans` 的 `agents` 字段语义扩展为「宿主原生 agent 定义（Pi + OpenCode）」，
 * 同时覆盖 `.pi/agents/` 与 `.opencode/agents/` 下不在生效集的 `iagent-*.md`，
 * 且不误报 orchestrator 与用户自建文件。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { reconcileOrphanCount, scanReconcileOrphans } from '../src/core/reconcile.js';

function write(projectRoot: string, rel: string, content = 'x'): string {
    const abs = path.join(projectRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    return abs;
}

describe('scanReconcileOrphans：宿主原生 agent 定义', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-reconcile-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('识别 .opencode/agents/ 下不在生效集的 iagent-*.md', () => {
        write(root, '.opencode/agents/iagent-foo.md');
        const orphans = scanReconcileOrphans(root, ['workflow']);
        expect(orphans.agents).toContain('.opencode/agents/iagent-foo.md');
    });

    it('orchestrator 与用户自建 agent 不被误报', () => {
        write(root, '.opencode/agents/iagent-orchestrator.md');
        write(root, '.opencode/agents/custom.md');
        const orphans = scanReconcileOrphans(root, ['workflow']);
        expect(orphans.agents).toEqual([]);
    });

    it('同时覆盖 .pi/agents/（Pi + OpenCode 双目录）', () => {
        write(root, '.pi/agents/iagent-bar.md');
        write(root, '.opencode/agents/iagent-baz.md');
        write(root, '.pi/agents/iagent-orchestrator.md');
        const orphans = scanReconcileOrphans(root, ['workflow']);
        expect(orphans.agents.sort()).toEqual([
            '.opencode/agents/iagent-baz.md',
            '.pi/agents/iagent-bar.md',
        ]);
    });

    it('生效集内 agent 不算孤立，计数包含 agent 定义', () => {
        write(root, '.opencode/agents/iagent-workflow.md');
        write(root, '.opencode/agents/iagent-old.md');
        write(root, '.claude/skills/iagent-keep/SKILL.md');
        const orphans = scanReconcileOrphans(root, ['workflow', 'keep']);
        expect(orphans.agents).toEqual(['.opencode/agents/iagent-old.md']);
        expect(reconcileOrphanCount(orphans)).toBe(1);
    });

    it('目录不存在时返回空结果', () => {
        const orphans = scanReconcileOrphans(root, []);
        expect(orphans).toEqual({ skills: [], commands: [], agents: [] });
    });
});

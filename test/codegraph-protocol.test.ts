import { describe, it, expect } from 'vitest';

import {
    CODEGRAPH_BUSY_LADDER,
    CODEGRAPH_CALL_DISCIPLINE,
    CODEGRAPH_CLI_BOUNDARY,
    renderCodegraphProbeOrder,
} from '../src/core/templates/codegraph-protocol.js';
import { getSpecExploreSkillTemplate } from '../src/core/templates/workflows/spec-explore.js';
import { getDebugSkillTemplate } from '../src/core/templates/workflows/debug.js';
import { getProjectInitSkillTemplate } from '../src/core/templates/workflows/project-init.js';
import { getSpecArchiveChangeSkillTemplate } from '../src/core/templates/workflows/spec-archive.js';
import { getMigrationSkillTemplate } from '../src/core/templates/workflows/migration.js';
import { getSpecBulkArchiveSkillTemplate } from '../src/core/templates/workflows/spec-bulk-archive.js';
import type { SkillTemplate } from '../src/core/templates/types.js';

/** 技能正文 + 全部参考文件（深潜协议下沉在 references/，断言需覆盖两者） */
function fullText(template: SkillTemplate): string {
    const refs = (template.references ?? []).map((ref) => ref.content).join('\n');
    return `${template.instructions}\n${refs}`;
}

describe('CodeGraph call discipline', () => {
    it('names codegraph_explore as the primary channel and marks other tools optional', () => {
        expect(CODEGRAPH_CALL_DISCIPLINE).toContain('codegraph_explore');
        expect(CODEGRAPH_CALL_DISCIPLINE).toContain('可选');
        for (const tool of ['codegraph_files', 'codegraph_search', 'codegraph_context']) {
            expect(CODEGRAPH_CALL_DISCIPLINE).toContain(tool);
        }
    });

    it('requires serial calls and bounded queries', () => {
        expect(CODEGRAPH_CALL_DISCIPLINE).toContain('同一时刻只发一个');
        expect(CODEGRAPH_CALL_DISCIPLINE).toContain('maxFiles');
        expect(CODEGRAPH_CALL_DISCIPLINE).toContain('MUST NOT 并行');
    });
});

describe('CodeGraph busy ladder', () => {
    it('retries the same call at most twice with a 5-10s wait', () => {
        expect(CODEGRAPH_BUSY_LADDER).toContain('5–10 秒');
        expect(CODEGRAPH_BUSY_LADDER).toContain('2 次');
        expect(CODEGRAPH_BUSY_LADDER).toContain('busy');
    });

    it('degrades to built-in tools without touching the index lock', () => {
        expect(CODEGRAPH_BUSY_LADDER).toContain('Glob / Grep');
        expect(CODEGRAPH_BUSY_LADDER).toContain('MUST NOT 因 busy 判「索引不可用」');
        expect(CODEGRAPH_BUSY_LADDER).toContain('codegraph unlock');
        expect(CODEGRAPH_BUSY_LADDER).toContain('codegraph sync');
    });
});

describe('CodeGraph CLI boundary', () => {
    it('allows only status / unlock / sync', () => {
        expect(CODEGRAPH_CLI_BOUNDARY).toContain('status');
        expect(CODEGRAPH_CLI_BOUNDARY).toContain('unlock');
        expect(CODEGRAPH_CLI_BOUNDARY).toContain('sync');
    });

    it('forbids MCP tool names as CLI subcommands', () => {
        expect(CODEGRAPH_CLI_BOUNDARY).toContain('codegraph search');
        expect(CODEGRAPH_CLI_BOUNDARY).toContain('不存在');
        expect(CODEGRAPH_CLI_BOUNDARY).toContain('unknown command');
    });
});

describe('probe order unchanged', () => {
    it('keeps the three-channel probe and the guardrails', () => {
        const withCli = renderCodegraphProbeOrder({ withCli: true });
        expect(withCli).toContain('codegraph status --json');
        expect(withCli).toContain('工具名缺失 ≠ 索引不可用');
        const withoutCli = renderCodegraphProbeOrder({ withCli: false });
        expect(withoutCli).toContain('本技能不执行 CLI');
    });
});

describe('templates consume the single source', () => {
    it('spec-explore scans through the primary channel', () => {
        const text = fullText(getSpecExploreSkillTemplate());
        expect(text).toContain('CodeGraph 调用纪律');
        expect(text).toContain('主通道 \u0060codegraph_explore\u0060');
        expect(text).toContain('CodeGraph busy 阶梯');
        expect(text).toContain('CodeGraph CLI 边界');
        expect(text).not.toContain('用 \u0060codegraph_files\u0060 工具**扫描项目文件结构**');
    });

    it('debug maps call chain tools to the primary channel', () => {
        const text = fullText(getDebugSkillTemplate());
        expect(text).toContain('CodeGraph 调用纪律');
        expect(text).toContain('可选通道');
        expect(text).toContain('主通道');
    });

    it('project-init / archive / bulk-archive carry busy and CLI boundaries', () => {
        for (const text of [
            fullText(getProjectInitSkillTemplate()),
            fullText(getSpecArchiveChangeSkillTemplate()),
            fullText(getSpecBulkArchiveSkillTemplate()),
        ]) {
            expect(text).toContain('CodeGraph busy 阶梯');
            expect(text).toContain('CodeGraph CLI 边界');
        }
    });

    it('migration carries the call discipline without the CLI boundary (no CLI permission)', () => {
        const text = fullText(getMigrationSkillTemplate());
        expect(text).toContain('CodeGraph 调用纪律');
        expect(text).toContain('CodeGraph busy 阶梯');
        expect(text).not.toContain('codegraph status');
    });
});

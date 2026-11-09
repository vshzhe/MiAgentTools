/**
 * test-evidence-gate：自动补测、测试证据、一致性门与 testGate 配置。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getSkillTemplates } from '../src/core/templates/index.js';
import {
    DEFAULT_TEST_GATE,
    parseTestGate,
    readProjectConfig,
    resolveTestGate,
} from '../src/core/project-config.js';
import { runConfigShow } from '../src/commands/config.js';

function instructionsOf(name: string): string {
    const found = getSkillTemplates().find(({ template }) => template.name === name);
    if (found === undefined) throw new Error(`缺少模板：${name}`);
    return found.template.instructions;
}

function makeTempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-test-gate-'));
}

describe('apply 自动补测与一致性门模板', () => {
    it('Step 8.11 自动补测位于测试门前，并声明不测清单留痕', () => {
        const body = instructionsOf('iagent_spec_apply');
        expect(body).toContain('8.11 自动单测补齐');
        expect(body).toContain('testGate.autoGenerate');
        expect(body).toContain('已评估、判定不生成');
        expect(body.indexOf('8.11 自动单测补齐')).toBeLessThan(body.indexOf('9. **测试执行门**'));
    });

    it('Step 9 写 test-report，Step 9.7 写 conformance-report 并阻断归档', () => {
        const body = instructionsOf('iagent_spec_apply');
        expect(body).toContain('test-report.md');
        expect(body).toContain('**summary**: status=<pass|fail|not-applicable|disabled>');
        expect(body).toContain('9.7 实现一致性门');
        expect(body).toContain('conformance-report.md');
        expect(body).toContain('MUST NOT 进入 Step 10');
    });

    it('三类证据保留至归档收尾', () => {
        const body = instructionsOf('iagent_spec_apply');
        expect(body).toContain('compile-report.md');
        expect(body).toContain('test-report.md');
        expect(body).toContain('conformance-report.md');
        expect(body).toContain('MUST 保留');
    });

    it('自动管线测试计划门自动采用并记 WARN', () => {
        const body = instructionsOf('iagent_test');
        expect(body).toContain('自动管线调用');
        expect(body).toContain('计划未经用户逐项确认');
        expect(body).toContain('MUST NOT 阻塞');
    });
});

describe('编排技能消费测试与一致性证据', () => {
    it('auto-workflow 归档前置三证据', () => {
        const body = instructionsOf('iagent_auto_workflow');
        expect(body).toContain('.openspec-tmp/pipeline-<change-name>/compile-report.md');
        expect(body).toContain('.openspec-tmp/pipeline-<change-name>/test-report.md');
        expect(body).toContain('.openspec-tmp/pipeline-<change-name>/conformance-report.md');
        expect(body).toContain('MUST NOT 自动归档');
    });

    it('workflow 归档桥读取三证据', () => {
        const body = instructionsOf('iagent_workflow');
        expect(body).toContain('.openspec-tmp/pipeline-<change-name>/compile-report.md');
        expect(body).toContain('.openspec-tmp/pipeline-<change-name>/test-report.md');
        expect(body).toContain('.openspec-tmp/pipeline-<change-name>/conformance-report.md');
        expect(body).toContain('MUST NOT 表述为「编译检查通过」');
    });

    it('debug 含 Phase 5.5 与规则/一致性细则引用', () => {
        const body = instructionsOf('iagent_debug');
        expect(body).toContain('Phase 5.5');
        expect(body).toContain('test-report.md');
        expect(body).toContain('references/gates-and-rules.md');
        expect(body).toContain('conformance-report.md');
    });

    it('spec-verify 消费证据并把缺失判 CRITICAL', () => {
        const body = instructionsOf('iagent_spec_verify');
        expect(body).toContain('conformance-report.md');
        expect(body).toContain('test-report.md');
        expect(body).toContain('CRITICAL');
    });

    it('spec-propose 多源规范要点与任务配对', () => {
        const body = instructionsOf('iagent_spec_propose');
        expect(body).toContain('CLAUDE.md');
        expect(body).toContain('AGENTS.md');
        expect(body).toContain('scenario-without-test');
    });
});

describe('testGate 配置', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTempProject();
    });

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('默认 autoGenerate=true', () => {
        expect(DEFAULT_TEST_GATE.autoGenerate).toBe(true);
        expect(resolveTestGate().autoGenerate).toBe(true);
    });

    it('显式 false 生效', () => {
        const parsed = parseTestGate('testGate:\n  autoGenerate: false\n');
        expect(parsed.present).toBe(true);
        expect(resolveTestGate(parsed).autoGenerate).toBe(false);
    });

    it('非法取值回退默认并 WARN', () => {
        const parsed = parseTestGate('testGate:\n  autoGenerate: maybe\n');
        expect(parsed.warnings.length).toBeGreaterThan(0);
        expect(resolveTestGate(parsed).autoGenerate).toBe(true);
    });

    it('readProjectConfig 暴露生效 testGate', () => {
        fs.mkdirSync(path.join(projectRoot, '.iagent'), { recursive: true });
        fs.writeFileSync(
            path.join(projectRoot, '.iagent', 'config.yaml'),
            'context: |\n  背景\ntestGate:\n  autoGenerate: false\n',
            'utf8',
        );
        expect(readProjectConfig(projectRoot)?.testGate.autoGenerate).toBe(false);
        expect(runConfigShow(projectRoot)).toContain('testGate: autoGenerate=false');
    });
});

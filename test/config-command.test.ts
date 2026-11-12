/**
 * config 命令测试：listAllWorkflowIds / runConfigShow / runConfigSet。
 * 交互式 runConfigInteractive 依赖 TTY 与 @inquirer/prompts，跳过单测。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    runConfigShow,
    runConfigSet,
    listAllWorkflowIds,
} from '../src/commands/config.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';
import { readProjectConfig } from '../src/core/project-config.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-config-'));
    ensureProjectConfig(tempRoot);
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('listAllWorkflowIds', () => {
    it('返回全部 22 个 workflow id', () => {
        const ids = listAllWorkflowIds();
        expect(ids.length).toBe(22);
        expect(ids).toContain('project-init');
        expect(ids).toContain('spec-explore');
        expect(ids).toContain('spec-verify-proposal');
        expect(ids).toContain('workflow');
    });
});

describe('runConfigShow', () => {
    it('无 config 时提示不存在与默认集来源（默认集 10 项）', () => {
        const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-nocfg-show-'));
        try {
            const output = runConfigShow(emptyRoot);
            expect(output).toContain('不存在');
            expect(output).toContain('默认集');
            expect(output).toContain('10 项');
            expect(output).toContain('project-init');
        } finally {
            fs.rmSync(emptyRoot, { recursive: true, force: true });
        }
    });

    it('配置后输出生效集与依赖注入标注', () => {
        writeWorkflowsToConfig(tempRoot, ['spec-propose']);
        const output = runConfigShow(tempRoot);
        expect(output).toContain('用户配置');
        expect(output).toContain('spec-propose');
        expect(output).toContain('spec-verify-proposal');
        expect(output).toContain('(依赖注入)');
    });
});

describe('runConfigShow compileCheck', () => {
    /** 建独立项目根（含默认 config.yaml） */
    function freshRoot(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-compile-show-'));
        ensureProjectConfig(root);
        return root;
    }

    /** 把 compileCheck 段追加到 config.yaml */
    function appendCompileCheck(root: string, body: string[]): void {
        const configPath = path.join(root, '.iagent', 'config.yaml');
        const raw = fs.readFileSync(configPath, 'utf8');
        fs.writeFileSync(configPath, `${raw}\ncompileCheck:\n${body.map((line) => `  ${line}`).join('\n')}\n`, 'utf8');
    }

    it('缺段时展示默认生效值并标注来源为默认值', () => {
        const root = freshRoot();
        try {
            const output = runConfigShow(root);
            expect(output).toContain(
                'compileCheck: enabled=true, command=(自动探测), incremental=true, timeoutMs=600000, autoFix=true, maxRetries=3（来源：默认值）'
            );
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('用户覆盖值标注为用户配置', () => {
        const root = freshRoot();
        try {
            appendCompileCheck(root, ['enabled: false', 'command: node build.js']);
            const output = runConfigShow(root);
            expect(output).toContain('enabled=false');
            expect(output).toContain('command=node build.js');
            expect(output).toContain('（来源：用户配置）');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('非法取值可见：回退值 + WARN 行 + 来源含回退字段', () => {
        const root = freshRoot();
        try {
            appendCompileCheck(root, ['maxRetries: 0']);
            const output = runConfigShow(root);
            expect(output).toContain('maxRetries=3');
            expect(output).toContain('（来源：用户配置（含回退字段））');
            expect(output).toContain('WARN compileCheck: maxRetries 非法，已回退默认值 3（原值：0）');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('runConfigSet', () => {
    it('合法列表写回并含依赖注入补全', () => {
        const result = runConfigSet(tempRoot, 'spec-propose,spec-archive');
        expect(result.action).toBe('set');
        expect(result.workflows).toContain('spec-propose');
        expect(result.workflows).toContain('spec-archive');
        expect(result.workflows).toContain('spec-verify-proposal');
        expect(result.workflows).toContain('spec-verify');

        // config.yaml 实际写回
        const resolved = readProjectConfig(tempRoot);
        expect(resolved?.workflows).toEqual(['spec-propose', 'spec-archive']);
    });

    it('非法 id 抛错且 config 不变', () => {
        const before = readProjectConfig(tempRoot)?.workflows;
        expect(() => runConfigSet(tempRoot, 'foo-bar')).toThrow(/未知 workflow id/);
        const after = readProjectConfig(tempRoot)?.workflows;
        expect(after).toEqual(before);
    });
});

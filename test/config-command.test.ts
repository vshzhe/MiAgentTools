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
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-config-'));
    ensureProjectConfig(tempRoot);
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('listAllWorkflowIds', () => {
    it('返回全部 23 个 workflow id', () => {
        const ids = listAllWorkflowIds();
        expect(ids.length).toBe(23);
        expect(ids).toContain('tr-init-project');
        expect(ids).toContain('spec-explore');
        expect(ids).toContain('spec-verify-proposal');
        expect(ids).toContain('tr-tools-list');
    });
});

describe('runConfigShow', () => {
    it('无 config 时提示不存在与默认集来源', () => {
        const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venus-nocfg-show-'));
        try {
            const output = runConfigShow(emptyRoot);
            expect(output).toContain('不存在');
            expect(output).toContain('默认集');
            expect(output).toContain('tr-init-project');
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

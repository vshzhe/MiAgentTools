/**
 * Pi 编排运行时 provider 回归锁（变更 add-host-orchestration-adapters）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    DEFAULT_PI_RUNTIME_PROVIDER,
    PI_RUNTIME_PACKAGE,
    detectPiRuntime,
    ensurePiRuntime,
    installPiRuntime,
    renderPiRuntimeMetadata,
    versionAtLeast,
    type PiCommandRunner,
} from '../src/core/pi-runtime.js';
import { runInit } from '../src/commands/init.js';
import { ensureProjectConfig, writeWorkflowsToConfig } from '../src/core/project-config.js';

/** 构造模拟执行器 */
function makeRunner(handlers: {
    piVersion?: string | null;
    installed?: boolean;
    installOk?: boolean;
    record?: string[][];
}): PiCommandRunner {
    return (cmd, args) => {
        handlers.record?.push([cmd, ...args]);
        if (cmd === 'pi' && args[0] === '--version') {
            return handlers.piVersion === null || handlers.piVersion === undefined
                ? { status: 1, stdout: '' }
                : { status: 0, stdout: handlers.piVersion };
        }
        if (cmd === 'pi' && args[0] === 'list') {
            return { status: 0, stdout: handlers.installed ? PI_RUNTIME_PACKAGE : '' };
        }
        if (cmd === 'pi' && args[0] === 'install') {
            return { status: handlers.installOk === false ? 1 : 0, stdout: '' };
        }
        return { status: 1, stdout: '' };
    };
}

describe('版本判定', () => {
    it('semver 前缀比较', () => {
        expect(versionAtLeast('1.2.0', '1.1.0')).toBe(true);
        expect(versionAtLeast('1.1.0', '1.1.0')).toBe(true);
        expect(versionAtLeast('1.0.9', '1.1.0')).toBe(false);
        expect(versionAtLeast('2.0.0', '1.9.9')).toBe(true);
        expect(versionAtLeast('garbage', '1.1.0')).toBe(false);
    });
});

describe('运行时检测', () => {
    it('Pi 不可用 → degraded（不尝试安装）', () => {
        const status = detectPiRuntime({ runner: makeRunner({ piVersion: null }) });
        expect(status.mode).toBe('degraded');
        expect(status.installed).toBe(false);
    });

    it('Pi 版本不兼容 → degraded', () => {
        const status = detectPiRuntime({ runner: makeRunner({ piVersion: '1.0.0' }) });
        expect(status.mode).toBe('degraded');
        expect(status.compatible).toBe(false);
        expect(status.reasons.join()).toContain('低于运行时要求');
    });

    it('运行时已安装且版本兼容 → strict', () => {
        const status = detectPiRuntime({ runner: makeRunner({ piVersion: '1.2.0', installed: true }) });
        expect(status.mode).toBe('strict');
        expect(status.installed).toBe(true);
    });

    it('未安装 → 默认安装并不阻塞（degraded 时记录包名）', () => {
        const status = detectPiRuntime({ runner: makeRunner({ piVersion: '1.2.0', installed: false }) });
        expect(status.mode).toBe('degraded');
        expect(status.package).toBe(PI_RUNTIME_PACKAGE);
    });
});

describe('运行时安装', () => {
    it('项目级安装使用 --local', () => {
        const record: string[][] = [];
        installPiRuntime({
            runner: makeRunner({ piVersion: '1.2.0', installOk: true, record }),
            projectRoot: '/tmp/x',
        });
        const installCall = record.find((c) => c[1] === 'install');
        expect(installCall).toContain('--local');
        expect(installCall).toContain(`npm:${PI_RUNTIME_PACKAGE}`);
    });

    it('安装成功且复检可用 → strict', () => {
        const status = ensurePiRuntime({
            runner: makeRunner({ piVersion: '1.2.0', installed: true, installOk: true }),
        });
        expect(status.mode).toBe('strict');
    });

    it('安装失败 → degraded 并给出手动命令', () => {
        const status = ensurePiRuntime({
            runner: makeRunner({ piVersion: '1.2.0', installed: false, installOk: false }),
        });
        expect(status.mode).toBe('degraded');
        expect(status.reasons.join(' ')).toContain('pi install');
    });

    it('默认 provider 为 @tintinweb/pi-subagents latest', () => {
        expect(DEFAULT_PI_RUNTIME_PROVIDER.package).toBe('@tintinweb/pi-subagents');
        expect(DEFAULT_PI_RUNTIME_PROVIDER.version).toBe('latest');
    });
});

describe('版本解析与冲突检测', () => {
    it('项目 .pi/settings.json 声明包时视为已安装并解析版本', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-pirt-settings-'));
        try {
            fs.mkdirSync(path.join(root, '.pi'), { recursive: true });
            fs.writeFileSync(
                path.join(root, '.pi', 'settings.json'),
                JSON.stringify({ packages: ['npm:@tintinweb/pi-subagents@0.22.0'] }),
                'utf8'
            );
            const status = detectPiRuntime({
                runner: makeRunner({ piVersion: '1.2.0', installed: false }),
                projectRoot: root,
            });
            expect(status.installed).toBe(true);
            expect(status.mode).toBe('strict');
            expect(status.resolved).toBe('0.22.0');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('检测到同类编排包冲突时保持 degraded 并记录冲突', () => {
        const runner: PiCommandRunner = (cmd, args) => {
            if (cmd === 'pi' && args[0] === '--version') return { status: 0, stdout: '1.2.0' };
            if (cmd === 'pi' && args[0] === 'list') {
                return { status: 0, stdout: 'npm:@tintinweb/pi-subagents\nnpm:pi-agent-suite' };
            }
            return { status: 1, stdout: '' };
        };
        const status = detectPiRuntime({ runner });
        expect(status.mode).toBe('degraded');
        expect(status.conflicts).toContain('pi-agent-suite');
        expect(status.reasons.join(' ')).toContain('冲突');
    });
});

describe('可诊断元数据', () => {
    it('渲染 host/package/orchestration/reasons', () => {
        const status = detectPiRuntime({ runner: makeRunner({ piVersion: null }) });
        const meta = JSON.parse(renderPiRuntimeMetadata(status));
        expect(meta.host).toBe('pi');
        expect(meta.package).toBe(PI_RUNTIME_PACKAGE);
        expect(meta.orchestration).toBe('degraded');
        expect(Array.isArray(meta.reasons)).toBe(true);
    });
});

describe('init 集成：Pi 运行时状态与 degraded 产物', () => {
    let root: string;

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-pirt-'));
    });

    afterAll(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('Pi 不可用时 init 仍成功并写 degraded 元数据', () => {
        const result = runInit(root, { tools: 'pi', piRuntimeRunner: makeRunner({ piVersion: null }) });
        expect(result.piRuntime?.mode).toBe('degraded');
        const metaPath = path.join(root, '.iagent', 'pi-runtime.json');
        expect(fs.existsSync(metaPath)).toBe(true);
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        expect(meta.orchestration).toBe('degraded');
        // 技能产物仍生成
        expect(fs.existsSync(path.join(root, '.pi', 'skills', 'iagent-workflow', 'SKILL.md'))).toBe(false);
        expect(fs.existsSync(path.join(root, '.pi', 'prompts', 'iagent-test.md'))).toBe(true);
    });

    it('Pi strict 时编排技能含 strict 适配段', () => {
        const strictRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-pirt-strict-'));
        try {
            ensureProjectConfig(strictRoot);
            writeWorkflowsToConfig(strictRoot, ['workflow']);
            runInit(strictRoot, {
                tools: 'pi',
                piRuntimeRunner: makeRunner({ piVersion: '1.2.0', installed: true }),
            });
            const wf = fs.readFileSync(
                path.join(strictRoot, '.pi', 'skills', 'iagent-workflow', 'SKILL.md'),
                'utf8'
            );
            expect(wf).toContain('宿主编排适配（生成期注入）');
            expect(wf).toContain('strict 编排');
            expect(wf).toContain('Runtime Extension');
        } finally {
            fs.rmSync(strictRoot, { recursive: true, force: true });
        }
    });

    it('Pi degraded 时编排技能声明不构成委派', () => {
        const degRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-pirt-deg-'));
        try {
            ensureProjectConfig(degRoot);
            writeWorkflowsToConfig(degRoot, ['workflow']);
            runInit(degRoot, {
                tools: 'pi',
                piRuntimeRunner: makeRunner({ piVersion: '1.2.0', installed: false, installOk: false }),
            });
            const wf = fs.readFileSync(
                path.join(degRoot, '.pi', 'skills', 'iagent-workflow', 'SKILL.md'),
                'utf8'
            );
            expect(wf).toContain('degraded 单 agent 模式');
            expect(wf).toContain('不构成委派');
        } finally {
            fs.rmSync(degRoot, { recursive: true, force: true });
        }
    });
});

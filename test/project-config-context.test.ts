/**
 * context 回写（writeContextToConfig）测试。
 *
 * 关注点：段替换只改 context 段，其余行（注释行、未知段、尾部空行）逐字保留；
 * config.yaml 不存在时先创建 .iagent/ 目录与默认配置再写入。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    CONFIG_FILE_NAME,
    defaultConfigFileContent,
    findListSectionEnd,
    parseProjectConfig,
    readListSection,
    readProjectConfig,
    replaceConfigSectionInRaw,
    writeContextToConfig,
    writeWorkflowsToConfig,
} from '../src/core/project-config.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-ctx-'));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

/** 在临时根下建一个项目目录（返回绝对路径） */
function makeProjectDir(name: string): string {
    const dir = path.join(tempRoot, name);
    fs.mkdirSync(path.join(dir, '.iagent'), { recursive: true });
    return dir;
}

/** 读取项目 config.yaml 内容 */
function readWritten(projectRoot: string): string {
    return fs.readFileSync(path.join(projectRoot, CONFIG_FILE_NAME), 'utf8');
}

/** 含未知段、注释与尾部空行的 config.yaml（回写保留能力的最小样本） */
const CONFIG_WITH_UNKNOWN_SECTION =
    [
        '# 项目配置（含未知段与注释）',
        'context: |',
        '  项目背景（供技能参考的技术栈与约定）：',
        '  - 技术栈：待补充（如 TypeScript + Node.js 20+ / JDK 17 + Spring Boot 3）',
        '',
        '# 未知段：本工具不识别，回写时必须逐字保留',
        'auto_package:',
        '  runtime_dir: .iagent/runtime',
        '  keep: true',
        '',
        '# 规则引用（缩进列表项，不得被 context 段替换吞掉）',
        'rules:',
        '  - impl',
        '  - test',
        '',
        '# 尾部注释',
        '',
        '',
    ].join('\n') + '\n';

describe('writeContextToConfig 回写保留未知段与注释', () => {
    const newContext = [
        '项目背景（扫描生成）：',
        '- 技术栈：TypeScript + Node.js 20+',
        '',
        '- 分层约定：Controller → Service → DAO',
    ].join('\n');

    let projectRoot: string;

    beforeAll(() => {
        projectRoot = makeProjectDir('keep-unknown');
        fs.writeFileSync(path.join(projectRoot, CONFIG_FILE_NAME), CONFIG_WITH_UNKNOWN_SECTION, 'utf8');
        writeContextToConfig(projectRoot, newContext);
    });

    it('context 段内容替换为新内容', () => {
        const written = readWritten(projectRoot);
        expect(written).toContain(
            [
                'context: |',
                '  项目背景（扫描生成）：',
                '  - 技术栈：TypeScript + Node.js 20+',
                '',
                '  - 分层约定：Controller → Service → DAO',
            ].join('\n')
        );
        // 原占位内容已消失，且只保留一个 context 段头
        expect(written).not.toContain('待补充');
        expect(written.match(/^context:\s*\|/gm)?.length).toBe(1);
        // 读回解析结果与写入内容一致
        expect(readProjectConfig(projectRoot)?.context).toBe(newContext);
    });

    it('未知段 auto_package 及其子键逐字保留', () => {
        const written = readWritten(projectRoot);
        expect(written).toContain(
            [
                '# 未知段：本工具不识别，回写时必须逐字保留',
                'auto_package:',
                '  runtime_dir: .iagent/runtime',
                '  keep: true',
            ].join('\n')
        );
    });

    it('全部注释行逐字保留', () => {
        const written = readWritten(projectRoot);
        for (const comment of [
            '# 项目配置（含未知段与注释）',
            '# 未知段：本工具不识别，回写时必须逐字保留',
            '# 规则引用（缩进列表项，不得被 context 段替换吞掉）',
            '# 尾部注释',
        ]) {
            expect(written).toContain(comment);
            expect(written.match(new RegExp(`^${comment.replace(/[()[\]]/g, '\\$&')}$`, 'gm'))?.length).toBe(1);
        }
    });

    it('context 段之后的 rules 缩进列表项逐字保留', () => {
        const written = readWritten(projectRoot);
        expect(written).toContain(['rules:', '  - impl', '  - test'].join('\n'));
        expect(readProjectConfig(projectRoot)?.workflows).toEqual([]);
    });

    it('尾部空行被规整为单个换行（防回写累积）', () => {
        const written = readWritten(projectRoot);
        // 原文末尾的多余空行被规整为单个结束换行，避免每次回写累积一个空行
        expect(written.slice(written.indexOf('# 尾部注释'))).toBe('# 尾部注释\n');
    });

    it('回写 context 后 workflows 段仍可独立替换（共用段替换实现互通）', () => {
        writeWorkflowsToConfig(projectRoot, ['spec-propose']);
        const written = readWritten(projectRoot);
        expect(readProjectConfig(projectRoot)?.workflows).toEqual(['spec-propose']);
        // context 与未知段不受影响
        expect(readProjectConfig(projectRoot)?.context).toBe(newContext);
        expect(written).toContain('  runtime_dir: .iagent/runtime');
    });
});

describe('段替换与列表读取原语（遗留迁移共用）', () => {
    it('readListSection 按段头读条目，且不过滤旧类型 id（parseProjectConfig 会过滤）', () => {
        const raw = ['rules:', '  - tr_impl', '  - tr_test', '  - spec', '', 'tools:', '  - claude'].join('\n');
        // 迁移须读旧值，故该原语不做 isSkillType 过滤
        expect(readListSection(raw, /^rules:/)).toEqual(['tr_impl', 'tr_test', 'spec']);
        expect(readListSection(raw, /^tools:/)).toEqual(['claude']);
        // 段不存在返回空数组
        expect(readListSection(raw, /^workflows:/)).toEqual([]);
        // 对照：解析器按新类型过滤，旧 id 被丢弃
        expect(parseProjectConfig(raw).rules).toEqual(['spec']);
    });

    it('replaceConfigSectionInRaw 命中段时替换段体、其余行逐字保留', () => {
        const raw = ['# 头注释', 'rules:', '  - tr_impl', '', '# 尾注释', ''].join('\n');
        const { content, found } = replaceConfigSectionInRaw(
            raw,
            /^rules:/,
            findListSectionEnd,
            (out) => {
                out.push('rules:');
                out.push('  - impl');
            }
        );
        expect(found).toBe(true);
        // 段体替换、其余行逐字保留，末尾统一为单个换行（不累积空行）
        expect(content).toBe(['# 头注释', 'rules:', '  - impl', '', '# 尾注释'].join('\n') + '\n');
    });

    it('appendWhenMissing 默认在文末追加段，传 false 时原样返回且 found 为 false', () => {
        const raw = 'context: |\n  背景\n';

        const appended = replaceConfigSectionInRaw(
            raw,
            /^workflows:/,
            findListSectionEnd,
            (out) => {
                out.push('workflows:');
                out.push('  - spec-explore');
            }
        );
        expect(appended.found).toBe(false);
        expect(appended.content).toContain('workflows:\n  - spec-explore');

        // 遗留迁移语义：旧配置本就没有该段时不得凭空补一个
        const kept = replaceConfigSectionInRaw(
            raw,
            /^workflows:/,
            findListSectionEnd,
            (out) => {
                out.push('workflows:');
                out.push('  - spec-explore');
            },
            { appendWhenMissing: false }
        );
        expect(kept.found).toBe(false);
        expect(kept.content).toBe(raw);
    });
});

describe('writeContextToConfig 段替换正确性与首次创建', () => {
    it('替换默认占位内容，并保留默认 rules / workflows 段', () => {
        const projectRoot = makeProjectDir('replace-placeholder');
        fs.writeFileSync(path.join(projectRoot, CONFIG_FILE_NAME), defaultConfigFileContent(), 'utf8');
        expect(readWritten(projectRoot)).toContain('技术栈：待补充');

        const newContext = ['项目背景（由 iagent_project_init 扫描生成）：', '- 技术栈：TypeScript + Node.js 20+'].join(
            '\n'
        );
        writeContextToConfig(projectRoot, newContext);

        const written = readWritten(projectRoot);
        expect(written).not.toContain('待补充');
        expect(written).toContain(
            [
                'context: |',
                '  项目背景（由 iagent_project_init 扫描生成）：',
                '  - 技术栈：TypeScript + Node.js 20+',
            ].join('\n')
        );
        expect(written).toContain(['rules:', '  - impl', '  - test', '  - spec'].join('\n'));
        expect(written).toContain('workflows:');

        const resolved = readProjectConfig(projectRoot);
        expect(resolved?.context).toBe(newContext);
        expect(resolved?.workflows.length).toBe(7);
    });

    it('.iagent/config.yaml 不存在时先创建目录与默认配置再写入', () => {
        const projectRoot = path.join(tempRoot, 'fresh-root');
        fs.mkdirSync(projectRoot, { recursive: true });

        const newContext = ['项目背景（新建项目）：', '- 技术栈：待定'].join('\n');
        writeContextToConfig(projectRoot, newContext);

        // 目录与配置文件已创建（路径按 / 归一化，兼容 Windows）
        const configPath = path.join(projectRoot, CONFIG_FILE_NAME);
        expect(fs.existsSync(path.join(projectRoot, '.iagent'))).toBe(true);
        expect(fs.existsSync(configPath)).toBe(true);
        expect(path.relative(projectRoot, configPath).replaceAll('\\', '/')).toBe('.iagent/config.yaml');

        // 默认配置的其余段保留：workflows 默认集 7 项、rules 引用默认三类
        const resolved = readProjectConfig(projectRoot);
        expect(resolved?.context).toBe(newContext);
        expect(resolved?.workflows.length).toBe(7);
        expect(resolved?.missingRuleFiles).toEqual(['impl', 'test', 'spec']);
        expect(readWritten(projectRoot)).not.toContain('技术栈：待补充');
    });
});

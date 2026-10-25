/**
 * shell 补全 / onboarding / 项目配置（.iagent/ 目录）三特性测试。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    generateBashCompletion,
    generatePowerShellCompletion,
    isCompletionShell,
} from '../src/commands/completion.js';
import { renderOnboardingHints } from '../src/commands/onboarding.js';
import {
    parseProjectConfig,
    readProjectConfig,
    defaultConfigFileContent,
    defaultRuleFileContent,
    listRuleFiles,
    CONFIG_FILE_NAME,
    MANUAL_DOMAIN_MARKS,
    RULES_DIR_NAME,
    ensureProjectConfig,
    writeWorkflowsToConfig,
} from '../src/core/project-config.js';
import { runInit } from '../src/commands/init.js';
import { runGenerate } from '../src/commands/generate.js';
import { buildSpecCommand } from '../src/commands/spec.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-feat-'));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('shell 补全脚本生成', () => {
    it('bash 脚本包含 5 个命令与 complete 注册', () => {
        const script = generateBashCompletion();
        for (const cmd of ['init', 'list', 'validate', 'update', 'generate']) {
            expect(script).toContain(cmd);
        }
        expect(script).toContain('complete -F _iagent_completion iagent');
    });

    it('bash 脚本包含子命令选项补全', () => {
        const script = generateBashCompletion();
        expect(script).toContain('--type');
        expect(script).toContain('--force');
        expect(script).toContain('--json');
    });

    it('spec 第二级补全覆盖全部已注册子命令（含 migrate/validate）', () => {
        const script = generateBashCompletion();
        const names = buildSpecCommand().commands.map((c) => c.name());
        expect(names).toEqual(expect.arrayContaining(['migrate', 'validate']));
        const match = script.match(/spec\)[\s\S]*?COMP_CWORD -eq 2[\s\S]*?compgen -W "([^"]*)"/);
        expect(match, '未找到 spec 子命令补全块').not.toBeNull();
        const listed = match![1].trim().split(/\s+/).sort();
        expect(listed).toEqual([...names].sort());
    });

    it('PowerShell 脚本包含 Register-ArgumentCompleter', () => {
        const script = generatePowerShellCompletion();
        expect(script).toContain('Register-ArgumentCompleter -CommandName iagent');
        for (const cmd of ['init', 'list', 'validate', 'update', 'generate']) {
            expect(script).toContain(`"${cmd}"`);
        }
    });

    it('shell 参数校验', () => {
        expect(isCompletionShell('bash')).toBe(true);
        expect(isCompletionShell('powershell')).toBe(true);
        expect(isCompletionShell('zsh')).toBe(false);
    });
});

describe('onboarding 提示', () => {
    it('默认集提示包含 spec 核心与 project-init', () => {
        const output = renderOnboardingHints();
        // 默认集 8 个（project-init + spec 全 6 + test）
        expect(output).toContain('/iagent:project-init');
        expect(output).toContain('/iagent:spec-explore');
        expect(output).toContain('/iagent:spec-propose');
        expect(output).toContain('/iagent:spec-apply');
        expect(output).toContain('/iagent:spec-archive');
        expect(output).toContain('iagent list');
        expect(output).toContain('iagent config');
        // 非默认 workflow 不在默认提示中
        expect(output).not.toContain('/iagent:feature');
    });

    it('按传入 workflow 集过滤提示', () => {
        const output = renderOnboardingHints(['commit', 'review']);
        expect(output).toContain('/iagent:commit');
        expect(output).toContain('/iagent:review');
        expect(output).not.toContain('/iagent:spec-explore');
    });
});

describe('项目配置（.iagent/ 目录结构）', () => {
    it('默认 config 内容包含 context 与 rules 引用', () => {
        const content = defaultConfigFileContent();
        expect(content).toContain('context: |');
        expect(content).toContain('- impl');
        expect(content).toContain('- test');
    });

    it('解析 config：context 块 + rules 引用列表', () => {
        const parsed = parseProjectConfig(defaultConfigFileContent());
        expect(parsed.context).toContain('项目背景');
        expect(parsed.rules).toEqual(['impl', 'test', 'spec']);
    });

    it('解析容忍注释与未知项', () => {
        const raw = ['# 注释', 'context: |', '  项目背景', '', 'rules:', '  - commit', '  - 未知项'].join('\n');
        const parsed = parseProjectConfig(raw);
        expect(parsed.context).toBe('项目背景');
        expect(parsed.rules).toEqual(['commit']);
    });

    it('init 创建 .iagent/config.yaml + rules/ 结构（语义名文件）', () => {
        const result = runInit(tempRoot);
        expect(result.configState).toBe('created');

        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        const rulesDir = path.join(tempRoot, RULES_DIR_NAME);
        expect(fs.existsSync(configPath)).toBe(true);
        expect(fs.existsSync(rulesDir)).toBe(true);
        // 默认规则文件为语义名（impl → coding-rules.md、test → testing-rules.md）
        expect(fs.existsSync(path.join(rulesDir, 'coding-rules.md'))).toBe(true);
        expect(fs.existsSync(path.join(rulesDir, 'testing-rules.md'))).toBe(true);
        expect(fs.existsSync(path.join(rulesDir, 'spec.md'))).toBe(true);
        expect(fs.existsSync(path.join(rulesDir, 'impl.md'))).toBe(false);
        expect(fs.existsSync(path.join(rulesDir, 'test.md'))).toBe(false);
        expect(result.ruleFilesCreated.length).toBe(3);
        expect([...result.ruleRepair.created].sort()).toEqual([
            '.iagent/rules/coding-rules.md',
            '.iagent/rules/spec.md',
            '.iagent/rules/testing-rules.md',
        ]);
    });

    it('重复 init：config.yaml 保留 + 映射外 commit.md 保留 + 管理型文件修复明细', () => {
        // 用户修改 context 与规则（只引用映射外的 commit 类型）
        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        fs.writeFileSync(
            configPath,
            ['context: |', '  我的项目背景', '', 'rules:', '  - commit'].join('\n') + '\n',
            'utf8'
        );
        const commitRule = path.join(tempRoot, RULES_DIR_NAME, 'commit.md');
        fs.writeFileSync(commitRule, '提交信息用中文\n遵守 Conventional Commits\n', 'utf8');
        // 制造管理型文件的两种待修复形态：缺失（test）与常量域漂移（impl）
        const testingRule = path.join(tempRoot, RULES_DIR_NAME, 'testing-rules.md');
        fs.rmSync(testingRule, { force: true });
        fs.appendFileSync(
            path.join(tempRoot, RULES_DIR_NAME, 'coding-rules.md'),
            '旧版常量残留行\n',
            'utf8'
        );

        const result2 = runInit(tempRoot, { force: true });
        expect(result2.configState).toBe('exists');
        expect(result2.ruleFilesCreated).toHaveLength(0);
        // 管理型文件按最新常量重建/对齐，映射外文件不在管理范围
        expect(result2.ruleRepair.created).toEqual(['.iagent/rules/testing-rules.md']);
        expect(result2.ruleRepair.aligned).toEqual(['.iagent/rules/coding-rules.md']);
        expect(result2.ruleRepair.removedOldName).toEqual([]);
        expect(fs.readFileSync(testingRule, 'utf8')).toBe(defaultRuleFileContent('test'));
        expect(fs.readFileSync(path.join(tempRoot, RULES_DIR_NAME, 'coding-rules.md'), 'utf8')).not.toContain(
            '旧版常量残留行'
        );

        const resolved = readProjectConfig(tempRoot);
        expect(resolved?.context).toBe('我的项目背景');
        expect(resolved?.rules.commit).toEqual(['提交信息用中文', '遵守 Conventional Commits']);
        // 映射外文件既不对齐也不改写
        expect(fs.readFileSync(commitRule, 'utf8')).toBe('提交信息用中文\n遵守 Conventional Commits\n');
    });

    it('config 引用但文件缺失的类型记入 missingRuleFiles', () => {
        const resolved = readProjectConfig(tempRoot);
        // 上一用例的 config 只引用了 commit（文件已创建），再引用一个不存在的
        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        fs.writeFileSync(
            configPath,
            ['context: |', '  背景', '', 'rules:', '  - release'].join('\n') + '\n',
            'utf8'
        );
        const after = readProjectConfig(tempRoot);
        expect(after?.missingRuleFiles).toContain('release');
        void resolved;
    });

    it('listRuleFiles 列出合法类型规则文件（语义名 + 映射外回退名）', () => {
        const files = listRuleFiles(tempRoot).map((f) => f.replaceAll('\\', '/'));
        expect(files).toContain('.iagent/rules/coding-rules.md');
        expect(files).toContain('.iagent/rules/testing-rules.md');
        expect(files).toContain('.iagent/rules/commit.md');
        // 映射内类型的旧名不被识别为合法规则文件
        expect(files).not.toContain('.iagent/rules/impl.md');
        expect(files).not.toContain('.iagent/rules/test.md');
    });

    it('generate 将 context 与该类型 rules 注入骨架正文', () => {
        // config 引用 commit + 已有规则文件
        const configPath = path.join(tempRoot, CONFIG_FILE_NAME);
        fs.writeFileSync(
            configPath,
            ['context: |', '  我的项目背景', '', 'rules:', '  - commit'].join('\n') + '\n',
            'utf8'
        );
        const result = runGenerate(tempRoot, { type: 'commit', name: 'lint-check' });
        const content = fs.readFileSync(path.join(tempRoot, 'skills', result.skillName, 'SKILL.md'), 'utf8');
        expect(content).toContain('我的项目背景');
        expect(content).toContain('.iagent/config.yaml');
        expect(content).toContain('.iagent/rules/');
        expect(content).toContain('提交信息用中文');
    });

    it('未引用的类型规则不注入（显式 include 语义）', () => {
        // config 只引用 commit，impl 的规则文件存在但不应注入
        const result = runGenerate(tempRoot, { type: 'impl', name: 'no-ref' });
        const content = fs.readFileSync(path.join(tempRoot, 'skills', result.skillName, 'SKILL.md'), 'utf8');
        expect(content).not.toContain('分层架构');
        expect(content).toContain('需要遵守的边界与规范');
    });

    it('无 .iagent 目录时 generate 生成普通骨架', () => {
        const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-nocfg-'));
        try {
            const result = runGenerate(emptyRoot, { type: 'impl', name: 'plain' });
            const content = fs.readFileSync(path.join(emptyRoot, 'skills', result.skillName, 'SKILL.md'), 'utf8');
            expect(content).not.toContain('.iagent');
            expect(content).toContain('需要遵守的边界与规范');
        } finally {
            fs.rmSync(emptyRoot, { recursive: true, force: true });
        }
    });

    it('默认规则文件内容：蒸馏要点 + 成对人工域标记（D-5 / D-Q1 基准）', () => {
        const impl = defaultRuleFileContent('impl');
        // impl 域蒸馏要点：零猜测 / UI 四状态
        for (const phrase of ['[待确认]', 'Loading', 'Empty', 'Error', 'Data']) {
            expect(impl, `coding-rules 缺蒸馏要点：${phrase}`).toContain(phrase);
        }
        const spec = defaultRuleFileContent('spec');
        // spec 域蒸馏要点：Markdown-first 制品协议
        for (const phrase of ['openspec/changes/', 'proposal → specs/design → tasks', 'spec validate', 'change.json']) {
            expect(spec, `spec 缺蒸馏要点：${phrase}`).toContain(phrase);
        }
        for (const type of ['impl', 'test', 'spec'] as const) {
            const content = defaultRuleFileContent(type);
            expect(content.split(MANUAL_DOMAIN_MARKS.start).length - 1, `${type} 开始标记数`).toBe(1);
            expect(content.split(MANUAL_DOMAIN_MARKS.end).length - 1, `${type} 结束标记数`).toBe(1);
            expect(content).toContain('# ');
        }
        // test 域 CLI 侧为占位兜底（项目特异性约定由 project-init 技能蒸馏进人工域）
        expect(defaultRuleFileContent('test')).toContain('（待补充）');
    });

    it('无 config.yaml 且存在旧名 impl.md：旧名整体删除并告警丢失风险', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-oldname-'));
        try {
            const rulesDir = path.join(root, RULES_DIR_NAME);
            fs.mkdirSync(rulesDir, { recursive: true });
            fs.writeFileSync(path.join(rulesDir, 'impl.md'), '# 7.x 遗留手写规则\n禁止跨层调用\n', 'utf8');

            const result = ensureProjectConfig(root);

            expect(result.state).toBe('created');
            expect(result.ruleRepair.removedOldName).toEqual(['.iagent/rules/impl.md']);
            expect(result.ruleRepair.warnings.some((w) => w.includes('整体删除'))).toBe(true);
            expect(result.ruleRepair.warnings.some((w) => w.includes('丢失风险'))).toBe(true);
            expect(fs.existsSync(path.join(rulesDir, 'impl.md'))).toBe(false);
            expect(result.ruleRepair.created).toContain('.iagent/rules/coding-rules.md');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('无 config.yaml 且 coding-rules.md 已存在：字节不变 + WARN 登记', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-exists-name-'));
        try {
            const rulesDir = path.join(root, RULES_DIR_NAME);
            fs.mkdirSync(rulesDir, { recursive: true });
            const userContent = '# 我手写的规则\n自定义约束\n';
            const existing = path.join(rulesDir, 'coding-rules.md');
            fs.writeFileSync(existing, userContent, 'utf8');

            const result = ensureProjectConfig(root);

            expect(result.state).toBe('created');
            // created 分支不进入常量对齐：既有语义名文件字节不变
            expect(fs.readFileSync(existing, 'utf8')).toBe(userContent);
            expect(result.ruleRepair.created).not.toContain('.iagent/rules/coding-rules.md');
            expect(result.ruleRepair.aligned).not.toContain('.iagent/rules/coding-rules.md');
            expect(result.ruleRepair.warnings.some((w) => w.includes('未做常量对齐'))).toBe(true);
            expect(result.ruleRepair.warnings.some((w) => w.includes('iagent update'))).toBe(true);
            // 其余两份照常新建
            expect([...result.ruleRepair.created].sort()).toEqual([
                '.iagent/rules/spec.md',
                '.iagent/rules/testing-rules.md',
            ]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('workflows 字段（profile 配置）', () => {
    it('默认 config 内容含默认集 7 项', () => {
        const content = defaultConfigFileContent();
        expect(content).toContain('workflows:');
        expect(content).toContain('- project-init');
        expect(content).toContain('- spec-explore');
        expect(content).toContain('- spec-verify-proposal');

        const parsed = parseProjectConfig(content);
        expect(parsed.workflows.length).toBe(7);
        expect(parsed.workflows).toContain('project-init');
        expect(parsed.workflows).toContain('spec-archive');
    });

    it('解析 workflows 列表项', () => {
        const raw = [
            'context: |',
            '  背景',
            '',
            'workflows:',
            '  - feature',
            '  - spec-explore',
        ].join('\n');
        const parsed = parseProjectConfig(raw);
        expect(parsed.workflows).toEqual(['feature', 'spec-explore']);
    });

    it('无 workflows 字段时解析为空数组（用默认集）', () => {
        const raw = ['context: |', '  背景', '', 'rules:', '  - impl'].join('\n');
        const parsed = parseProjectConfig(raw);
        expect(parsed.workflows).toEqual([]);
    });

    it('writeWorkflowsToConfig 替换已有 workflows 段且保留 context/rules', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-wf-write-'));
        try {
            ensureProjectConfig(root);
            writeWorkflowsToConfig(root, ['spec-propose']);
            let resolved = readProjectConfig(root);
            expect(resolved?.workflows).toEqual(['spec-propose']);

            // 再次写回替换
            writeWorkflowsToConfig(root, ['project-init', 'spec-explore']);
            resolved = readProjectConfig(root);
            expect(resolved?.workflows).toEqual(['project-init', 'spec-explore']);
            // context/rules 段保留
            expect(resolved?.context).toContain('项目背景');
            expect(resolved?.rules).toBeTruthy();
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

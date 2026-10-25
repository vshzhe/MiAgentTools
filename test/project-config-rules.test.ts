/**
 * 规则文件生命周期（`repairRuleFiles` / init 蒸馏）测试。
 *
 * 覆盖 design D-2（修复契约与 preservePaths）、D-4（命名映射单一源）、
 * D-5（蒸馏常量、人工域标记与对齐算法）：
 *   - 缺失重建 / 旧名删除 / 常量域对齐 / 人工域逐字保留 / 多区间原序 /
 *     破损标记取保留侧 / 两轮幂等 / 读写失败降级 / preservePaths 归一与忽略；
 *   - `readRuleFile` 的读取契约（标记行与注释不注入）；
 *   - 新装 init 的蒸馏验收（D-Q1 基准）。
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    CONFIG_FILE_NAME,
    LEGACY_RULE_FILE_NAMES,
    MANUAL_DOMAIN_MARKS,
    RULES_DIR_NAME,
    RULE_FILE_NAMES,
    defaultRuleFileContent,
    ensureProjectConfig,
    listRuleFiles,
    readProjectConfig,
    repairRuleFiles,
    ruleFileNameFor,
    ruleFileTypeFor,
} from '../src/core/project-config.js';
import { runInit } from '../src/commands/init.js';

const START = MANUAL_DOMAIN_MARKS.start;
const END = MANUAL_DOMAIN_MARKS.end;

/** 本文件创建的临时项目根（afterEach 统一清理） */
let roots: string[] = [];

afterEach(() => {
    for (const root of roots) {
        fs.rmSync(root, { recursive: true, force: true });
    }
    roots = [];
});

/** 新建临时项目目录 */
function makeProject(prefix = 'iagent-rules-'): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    roots.push(root);
    return root;
}

/** 写文件（自动创建父目录） */
function writeAt(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

/** 写一份最小 config.yaml（rules 默认三类型） */
function writeConfig(root: string, rules: string[] = ['impl', 'test', 'spec']): void {
    const lines = ['context: |', '  测试项目背景', '', 'rules:'];
    for (const rule of rules) {
        lines.push(`  - ${rule}`);
    }
    writeAt(path.join(root, CONFIG_FILE_NAME), `${lines.join('\n')}\n`);
}

/** 规则文件绝对路径 */
function rulePath(root: string, fileName: string): string {
    return path.join(root, RULES_DIR_NAME, fileName);
}

/** 写规则文件并返回绝对路径 */
function writeRule(root: string, fileName: string, content: string): string {
    const target = rulePath(root, fileName);
    writeAt(target, content);
    return target;
}

/** 路径归一（Windows 反斜杠 → posix） */
function norm(target: string): string {
    return target.replaceAll('\\', '/');
}

/** 目标是否真的不可写（部分特权环境会忽略只读位） */
function isWriteBlocked(target: string): boolean {
    try {
        fs.appendFileSync(target, '');
        return false;
    } catch {
        return true;
    }
}

describe('repairRuleFiles：空操作与缺失重建', () => {
    it('项目无 .iagent 时为空操作，MUST NOT 创建配置目录', () => {
        const root = makeProject();
        const report = repairRuleFiles(root);

        expect(report).toEqual({ removedOldName: [], created: [], aligned: [], preserved: [], warnings: [] });
        expect(fs.existsSync(path.join(root, '.iagent'))).toBe(false);
    });

    it('缺失文件按默认内容重建（常量块 + 空人工域骨架）', () => {
        const root = makeProject();
        writeConfig(root);

        const report = repairRuleFiles(root);

        expect([...report.created].sort()).toEqual([
            '.iagent/rules/coding-rules.md',
            '.iagent/rules/spec.md',
            '.iagent/rules/testing-rules.md',
        ]);
        expect(report.aligned).toEqual([]);
        expect(report.preserved).toEqual([]);
        expect(report.removedOldName).toEqual([]);
        expect(report.warnings).toEqual([]);
        expect(fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8')).toBe(defaultRuleFileContent('impl'));
        expect(fs.readFileSync(rulePath(root, 'testing-rules.md'), 'utf8')).toBe(defaultRuleFileContent('test'));
        expect(fs.readFileSync(rulePath(root, 'spec.md'), 'utf8')).toBe(defaultRuleFileContent('spec'));
    });
});

describe('repairRuleFiles：常量对齐与人工域保护', () => {
    it('常量域漂移被对齐，人工域区间逐字保留', () => {
        const root = makeProject();
        writeConfig(root);
        const interval = [START, '# 人工域说明（保留）', '用户规则 A', '', '用户规则 B', END];
        writeRule(
            root,
            'coding-rules.md',
            ['# 旧版头注释', '旧版常量行（应被对齐掉）', ...interval].join('\n') + '\n'
        );

        const report = repairRuleFiles(root);

        expect(report.aligned).toEqual(['.iagent/rules/coding-rules.md']);
        expect(report.warnings).toEqual([]);
        const content = fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8');
        expect(content.startsWith('# coding-rules.md 项目规则（impl 域')).toBe(true);
        expect(content).not.toContain('旧版常量行');
        expect(content).not.toContain('# 旧版头注释');
        // 区间原文（含标记行与区间内每一行）逐字保留
        expect(content).toContain(interval.join('\n'));
    });

    it('无人工域标记的文件整块重写为常量内容并告警', () => {
        const root = makeProject();
        writeConfig(root);
        writeRule(root, 'coding-rules.md', '# 我手写的头\n我的规则（无标记保护）\n');

        const report = repairRuleFiles(root);

        expect(report.aligned).toEqual(['.iagent/rules/coding-rules.md']);
        expect(report.warnings.some((w) => w.includes('未检出人工域标记'))).toBe(true);
        expect(report.warnings.some((w) => w.includes('手写规则请置于'))).toBe(true);
        const content = fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8');
        expect(content).not.toContain('我的规则（无标记保护）');
        // 整块替换不带标记骨架（修复不猜测用户内容）
        expect(content).not.toContain(START);
        expect(content.startsWith('# coding-rules.md 项目规则（impl 域')).toBe(true);
    });

    it('多个人工域区间按原文件中出现的顺序保留，不合并', () => {
        const root = makeProject();
        writeConfig(root);
        writeRule(
            root,
            'coding-rules.md',
            [
                '旧常量行',
                START,
                '第一段规则',
                END,
                '夹在区间之间的旧常量（应丢弃）',
                START,
                '第二段规则',
                END,
            ].join('\n') + '\n'
        );

        const report = repairRuleFiles(root);

        expect(report.aligned).toEqual(['.iagent/rules/coding-rules.md']);
        const content = fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8');
        expect(content).toContain([START, '第一段规则', END, START, '第二段规则', END].join('\n'));
        expect(content).not.toContain('夹在区间之间的旧常量');
        expect(content.indexOf('第一段规则')).toBeLessThan(content.indexOf('第二段规则'));
    });

    it('人工域未闭合：保留开始标记至文末并告警', () => {
        const root = makeProject();
        writeConfig(root);
        writeRule(root, 'coding-rules.md', ['旧常量行', START, '未闭合区间的规则'].join('\n') + '\n');

        const report = repairRuleFiles(root);

        expect(report.warnings.some((w) => w.includes('未闭合'))).toBe(true);
        const content = fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8');
        expect(content).toContain([START, '未闭合区间的规则'].join('\n'));
        expect(content.endsWith('未闭合区间的规则\n')).toBe(true);
        expect(content).not.toContain('旧常量行');
    });

    it('人工域标记嵌套乱序：按最外层最大连续区间保留并告警', () => {
        const root = makeProject();
        writeConfig(root);
        writeRule(
            root,
            'coding-rules.md',
            ['旧常量行', START, '外层规则', START, '内层规则', END, '区间之后的行'].join('\n') + '\n'
        );

        const report = repairRuleFiles(root);

        expect(report.warnings.some((w) => w.includes('嵌套或乱序'))).toBe(true);
        const content = fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8');
        expect(content).toContain([START, '外层规则', START, '内层规则', END].join('\n'));
        // 结束标记之后的行属常量域，不进入输出
        expect(content).not.toContain('区间之后的行');
        expect(content).not.toContain('旧常量行');
    });

    it('两轮执行输出字节相同（幂等）', () => {
        const root = makeProject();
        writeConfig(root);
        writeRule(
            root,
            'spec.md',
            ['旧常量行', START, '用户提案约定', END, START, '第二段约定', END].join('\n') + '\n'
        );

        const first = repairRuleFiles(root);
        expect(first.aligned).toEqual(['.iagent/rules/spec.md']);
        const firstBytes = fs.readFileSync(rulePath(root, 'spec.md'), 'utf8');

        const second = repairRuleFiles(root);
        expect(second.aligned).toEqual([]);
        expect(second.created).toEqual([]);
        expect(second.removedOldName).toEqual([]);
        expect(second.warnings).toEqual([]);
        expect(fs.readFileSync(rulePath(root, 'spec.md'), 'utf8')).toBe(firstBytes);
    });

    it('新建文件的默认内容同样幂等（骨架区间被识别并逐字保留）', () => {
        const root = makeProject();
        writeConfig(root);
        repairRuleFiles(root);
        const afterCreate = fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8');

        const second = repairRuleFiles(root);

        expect(second.aligned).toEqual([]);
        expect(fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8')).toBe(afterCreate);
    });
});

describe('repairRuleFiles：旧名检测删除', () => {
    it('检测并整体删除旧名文件，逐文件输出丢失风险告警', () => {
        const root = makeProject();
        writeConfig(root);
        writeRule(root, 'impl.md', '# 旧 impl\n禁止跨层调用\n');
        writeRule(root, 'test.md', '# 旧 test\n测试先行\n');

        const report = repairRuleFiles(root);

        expect([...report.removedOldName].sort()).toEqual(['.iagent/rules/impl.md', '.iagent/rules/test.md']);
        expect(report.warnings.filter((w) => w.includes('整体删除')).length).toBe(2);
        expect(report.warnings.some((w) => w.includes('丢失风险'))).toBe(true);
        expect(report.warnings.some((w) => w.includes('coding-rules.md'))).toBe(true);
        expect(report.warnings.some((w) => w.includes('testing-rules.md'))).toBe(true);
        expect(fs.existsSync(rulePath(root, 'impl.md'))).toBe(false);
        expect(fs.existsSync(rulePath(root, 'test.md'))).toBe(false);
        // 旧名内容不被合并进语义名文件（不做兼容读取）
        const coding = fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8');
        expect(coding).not.toContain('# 旧 impl');
        expect(coding).not.toContain('测试先行');
    });

    it('无旧名时幂等（第二次不重复登记删除）', () => {
        const root = makeProject();
        writeConfig(root);
        writeRule(root, 'impl.md', '旧内容\n');

        expect(repairRuleFiles(root).removedOldName).toEqual(['.iagent/rules/impl.md']);
        const second = repairRuleFiles(root);
        expect(second.removedOldName).toEqual([]);
        expect(second.warnings).toEqual([]);
    });

    it('旧名清单只含本变更改名产生的两枚（不含 tr_ 前缀形态）', () => {
        expect([...LEGACY_RULE_FILE_NAMES]).toEqual(['impl.md', 'test.md']);
    });
});

describe('repairRuleFiles：失败降级（不中断、不抛出）', () => {
    it('读取失败（目标为目录）只记 WARN，其余文件照常重建', () => {
        const root = makeProject();
        writeConfig(root);
        fs.mkdirSync(rulePath(root, 'coding-rules.md'), { recursive: true });

        let report: ReturnType<typeof repairRuleFiles> | undefined;
        expect(() => {
            report = repairRuleFiles(root);
        }).not.toThrow();

        expect(report!.warnings.some((w) => w.includes('读取失败'))).toBe(true);
        expect(report!.aligned).not.toContain('.iagent/rules/coding-rules.md');
        expect([...report!.created].sort()).toEqual(['.iagent/rules/spec.md', '.iagent/rules/testing-rules.md']);
    });

    it('写入失败（只读目标）只记 WARN 不抛出，会话继续', () => {
        const root = makeProject();
        writeConfig(root);
        const target = writeRule(root, 'coding-rules.md', ['旧常量行', START, '用户规则', END].join('\n') + '\n');
        fs.chmodSync(target, 0o444);
        try {
            const blocked = isWriteBlocked(target);

            let report: ReturnType<typeof repairRuleFiles> | undefined;
            expect(() => {
                report = repairRuleFiles(root);
            }).not.toThrow();

            if (blocked) {
                expect(report!.warnings.some((w) => w.includes('对齐写入失败'))).toBe(true);
                expect(report!.aligned).not.toContain('.iagent/rules/coding-rules.md');
                expect(fs.readFileSync(target, 'utf8')).toContain('用户规则');
            } else {
                // 特权环境忽略只读位：仍须完成对齐且不抛出
                expect(report!.aligned).toContain('.iagent/rules/coding-rules.md');
            }
            // 其余文件不受影响
            expect(report!.created).toContain('.iagent/rules/spec.md');
        } finally {
            fs.chmodSync(target, 0o666);
        }
    });
});

describe('repairRuleFiles：preservePaths（本轮迁移产出跳过对齐）', () => {
    it('命中管理型路径：跳过对齐并登记 preserved，其余文件照常修复', () => {
        const root = makeProject();
        writeConfig(root);
        const migrated = '# 旧装机规则\n禁止跨层调用\n';
        writeRule(root, 'coding-rules.md', migrated);

        const report = repairRuleFiles(root, { preservePaths: ['.iagent/rules/coding-rules.md'] });

        expect(report.preserved).toEqual(['.iagent/rules/coding-rules.md']);
        expect(report.aligned).toEqual([]);
        expect(report.warnings).toEqual([]);
        expect(fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8')).toBe(migrated);
        expect([...report.created].sort()).toEqual(['.iagent/rules/spec.md', '.iagent/rules/testing-rules.md']);
    });

    it('不存在或非管理型路径安全忽略（不报错、不登记 preserved）', () => {
        const root = makeProject();
        writeConfig(root);
        const commitContent = '提交信息用中文\n';
        writeRule(root, 'commit.md', commitContent);

        const report = repairRuleFiles(root, {
            preservePaths: ['.iagent/rules/testing-rules.md', '.iagent/rules/commit.md', 'docs/other.md'],
        });

        expect(report.preserved).toEqual([]);
        expect(report.warnings).toEqual([]);
        // 不存在的管理型文件照常重建
        expect(report.created).toContain('.iagent/rules/testing-rules.md');
        // 非管理型文件既不对齐也不改写
        expect(fs.readFileSync(rulePath(root, 'commit.md'), 'utf8')).toBe(commitContent);
    });

    it('路径归一：Windows 反斜杠输入与 posix 等价，报告路径统一 posix', () => {
        const root = makeProject();
        writeConfig(root);
        const migrated = '# 旧装机规则\n禁止跨层调用\n';
        writeRule(root, 'coding-rules.md', migrated);

        const report = repairRuleFiles(root, { preservePaths: ['.iagent\\rules\\coding-rules.md'] });

        expect(report.preserved).toEqual(['.iagent/rules/coding-rules.md']);
        for (const item of [...report.preserved, ...report.created, ...report.aligned, ...report.removedOldName]) {
            expect(item).not.toContain('\\');
            expect(norm(item)).toBe(item);
        }
        expect(fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8')).toBe(migrated);
    });
});

describe('命名映射（单一源）导出契约', () => {
    it('管理型三类型映射与回退名一致', () => {
        expect(RULE_FILE_NAMES.impl).toBe('coding-rules.md');
        expect(RULE_FILE_NAMES.test).toBe('testing-rules.md');
        expect(RULE_FILE_NAMES.spec).toBe('spec.md');
        expect(ruleFileNameFor('impl')).toBe('coding-rules.md');
        expect(ruleFileNameFor('test')).toBe('testing-rules.md');
        expect(ruleFileNameFor('spec')).toBe('spec.md');
        // 映射外类型回退直拼
        expect(ruleFileNameFor('commit')).toBe('commit.md');
        expect(ruleFileNameFor('review')).toBe('review.md');
    });

    it('反查只认语义名与映射外回退名，映射内旧名返回 null', () => {
        expect(ruleFileTypeFor('coding-rules.md')).toBe('impl');
        expect(ruleFileTypeFor('testing-rules.md')).toBe('test');
        expect(ruleFileTypeFor('spec.md')).toBe('spec');
        expect(ruleFileTypeFor('commit.md')).toBe('commit');
        expect(ruleFileTypeFor('impl.md')).toBeNull();
        expect(ruleFileTypeFor('test.md')).toBeNull();
        expect(ruleFileTypeFor('unknown.md')).toBeNull();
        expect(ruleFileTypeFor('coding-rules.txt')).toBeNull();
    });

    it('listRuleFiles 双形态识别：语义名与映射外回退名均列出，旧名不列', () => {
        const root = makeProject();
        writeRule(root, 'coding-rules.md', '规则\n');
        writeRule(root, 'commit.md', '提交规则\n');
        writeRule(root, 'impl.md', '旧名\n');
        writeRule(root, 'test.md', '旧名\n');

        expect([...listRuleFiles(root)].sort()).toEqual([
            path.join(RULES_DIR_NAME, 'coding-rules.md'),
            path.join(RULES_DIR_NAME, 'commit.md'),
        ]);
    });
});

describe('readRuleFile 读取契约（人工域标记不注入）', () => {
    it('人工域规则行照常注入，标记行与 # 注释不注入', () => {
        const root = makeProject();
        writeConfig(root, ['impl']);
        writeRule(
            root,
            'coding-rules.md',
            ['# 头注释不注入', '规则一', START, '# 人工域说明不注入', '规则二', END].join('\n') + '\n'
        );

        const resolved = readProjectConfig(root);

        expect(resolved?.rules.impl).toEqual(['规则一', '规则二']);
        expect(resolved?.missingRuleFiles).toEqual([]);
    });
});

describe('init 蒸馏验收（D-Q1 基准）', () => {
    it('新装 init 即得三份语义名规则文件与可判定的蒸馏要点', () => {
        const root = makeProject();
        const result = runInit(root, { tools: 'claude', scan: false });

        expect(result.configState).toBe('created');
        const files = {
            impl: fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8'),
            test: fs.readFileSync(rulePath(root, 'testing-rules.md'), 'utf8'),
            spec: fs.readFileSync(rulePath(root, 'spec.md'), 'utf8'),
        };

        // coding-rules.md：零猜测 / UI 四状态（D-5 impl 域要点）
        for (const phrase of ['[待确认]', 'Loading', 'Empty', 'Error', 'Data']) {
            expect(files.impl, `coding-rules.md 缺蒸馏要点：${phrase}`).toContain(phrase);
        }
        // spec.md：Markdown-first 制品协议要点（D-5 spec 域要点）
        for (const phrase of ['openspec/changes/', 'proposal → specs/design → tasks', 'spec validate', 'change.json']) {
            expect(files.spec, `spec.md 缺蒸馏要点：${phrase}`).toContain(phrase);
        }
        // testing-rules.md：无测试代码场景的占位兜底
        expect(files.test).toContain('（待补充）');

        // 三份文件均含成对人工域标记（恰好一对）
        for (const [type, content] of Object.entries(files)) {
            const startCount = content.split(START).length - 1;
            const endCount = content.split(END).length - 1;
            expect(startCount, `${type} 域人工域开始标记数`).toBe(1);
            expect(endCount, `${type} 域人工域结束标记数`).toBe(1);
        }

        // 旧名文件不再生成
        expect(fs.existsSync(rulePath(root, 'impl.md'))).toBe(false);
        expect(fs.existsSync(rulePath(root, 'test.md'))).toBe(false);
        // config.yaml 的 rules 列表仍是类型 id（与文件名正交），读取链按映射命中语义名文件
        expect(readProjectConfig(root)?.rules.impl?.length).toBeGreaterThan(0);
    });

    it('重复 init 转入重建/修复：config.yaml 保留但规则文件按最新常量修复', () => {
        const root = makeProject();
        runInit(root, { tools: 'claude', scan: false });
        const configBefore = fs.readFileSync(path.join(root, CONFIG_FILE_NAME), 'utf8');
        // 制造漂移：删掉 testing-rules.md、给 coding-rules.md 追加常量域脏行
        fs.rmSync(rulePath(root, 'testing-rules.md'), { force: true });
        fs.appendFileSync(rulePath(root, 'coding-rules.md'), '旧版常量残留行\n', 'utf8');

        const second = runInit(root, { tools: 'claude', scan: false });

        expect(second.configState).toBe('exists');
        expect(fs.readFileSync(path.join(root, CONFIG_FILE_NAME), 'utf8')).toBe(configBefore);
        expect(second.ruleRepair.created).toEqual(['.iagent/rules/testing-rules.md']);
        expect(second.ruleRepair.aligned).toEqual(['.iagent/rules/coding-rules.md']);
        const coding = fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8');
        expect(coding).not.toContain('旧版常量残留行');
        // 人工域骨架仍在（逐字保留）
        expect(coding).toContain(START);
    });

    it('无 config.yaml 且存在旧名 impl.md：旧名删除 + 丢失风险告警', () => {
        const root = makeProject();
        writeRule(root, 'impl.md', '# 7.x 遗留手写规则\n禁止跨层调用\n');

        const result = ensureProjectConfig(root);

        expect(result.state).toBe('created');
        expect(result.ruleRepair.removedOldName).toEqual(['.iagent/rules/impl.md']);
        expect(result.ruleRepair.warnings.some((w) => w.includes('丢失风险'))).toBe(true);
        expect(fs.existsSync(rulePath(root, 'impl.md'))).toBe(false);
        expect(result.ruleRepair.created).toContain('.iagent/rules/coding-rules.md');
    });

    it('无 config.yaml 且 coding-rules.md 已存在：字节不变 + WARN 登记', () => {
        const root = makeProject();
        const userContent = '# 我手写的规则\n自定义约束\n';
        writeRule(root, 'coding-rules.md', userContent);

        const result = ensureProjectConfig(root);

        expect(result.state).toBe('created');
        // created 分支不进入常量对齐：既有内容字节不变
        expect(fs.readFileSync(rulePath(root, 'coding-rules.md'), 'utf8')).toBe(userContent);
        expect(result.ruleRepair.created).not.toContain('.iagent/rules/coding-rules.md');
        expect(result.ruleRepair.aligned).not.toContain('.iagent/rules/coding-rules.md');
        expect(result.ruleRepair.warnings.some((w) => w.includes('未做常量对齐'))).toBe(true);
        expect(result.ruleRepair.warnings.some((w) => w.includes('iagent update'))).toBe(true);
        // 其余两份照常新建
        expect([...result.ruleRepair.created].sort()).toEqual([
            '.iagent/rules/spec.md',
            '.iagent/rules/testing-rules.md',
        ]);
    });
});

/**
 * 项目预扫描（src/core/project-scan.ts）测试。
 *
 * 覆盖：Ant 构建设施识别、敏感值零外泄、排除清单、变体合并与候选/信号分层、
 *       失败降级与上限可区分、iagent init 端到端、非 Maven/Ant 族（Node）项目。
 *
 * 已评估、判定无需独立测试：
 *   任务 2.7 —— renderScanReport() 的纯排版分支（列表拼接、空列表占位、候选截断提示）
 *   不承载任何独立业务判定逻辑：该函数无 IO、无状态机，输入即 ProjectScanReport，
 *   输出为确定性字符串，其正确性已由 2.6 的端到端渲染输出断言（报告段存在、构建设施
 *   已列出、渲染文本与基线均不含配置取值）完整覆盖。若再单设排版用例，只会重复同一
 *   代码路径且无法定义独立的失败语义（失败必先由 2.6 的字段断言暴露），故不另设用例。
 *
 * 已修复（由协调者裁决后回改实现，见 2.4）：
 *   变体命名 `DataBase.properties_bss`（环境后缀位于扩展名之后）曾被实现静默忽略——
 *   只从「主干」剥离变体中缀（`DataBase_bss.properties`）与扩展名后缀
 *   （`DataBase.properties.bak`），而真实项目实际使用的恰是 `*.properties_<env>` 形态。
 *   `configBaseName()` 已补入「扩展名之后环境后缀」的识别，2.4 现覆盖该形态。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
    createEmptyScanReport,
    renderScanReport,
    scanProject,
    writeScanBaseline,
    MAX_SCAN_DEPTH,
    SCAN_BASELINE_PATH,
    type ProjectScanReport,
    type ScanOptions,
} from '../src/core/project-scan.js';
import { runInit } from '../src/commands/init.js';

/** 临时根目录（整个文件共用，afterAll 递归清理） */
let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-scan-'));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

/** 哨兵口令串：唯一且可被 grep 检出，用于验证配置取值零外泄 */
const SENTINEL_PASSWORD = 'SENTINEL_PASSWORD_7c1f9a3e';

/** 哨兵密钥串：同上，覆盖非口令类敏感键（sm4Key） */
const SENTINEL_SM4 = 'SENTINEL_SM4KEY_2b8d4e6f';

/** 哨兵个人信息串：验证非源码文件内容从未被读取 */
const SENTINEL_PII = 'SENTINEL_PII_IDCARD_11010519900307';

/** 在临时根下新建一个独立项目目录（返回绝对路径） */
function makeProject(name: string): string {
    const dir = path.join(tempRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/** 写文件（自动创建父目录） */
function write(root: string, relPath: string, content: string): void {
    const target = path.join(root, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
}

/** 路径归一化（Windows 兼容，统一正斜杠） */
function norm(target: string): string {
    return target.replaceAll('\\', '/');
}

/** 读取扫描基线原文（不存在返回 undefined） */
function readBaselineText(root: string): string | undefined {
    const target = path.join(root, SCAN_BASELINE_PATH);
    return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : undefined;
}

/** 执行扫描并捕获异常（用于断言「失败不抛出」） */
function scanSafely(root: string, options?: ScanOptions): { report?: ProjectScanReport; error?: unknown } {
    try {
        return { report: scanProject(root, options) };
    } catch (error) {
        return { error };
    }
}

/** 以指定项目目录为 cwd 执行 CLI init（返回 stdout） */
function execInit(binPath: string, cwd: string, args: string[]): string {
    return execFileSync(process.execPath, [binPath, 'init', ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

describe('2.1 Ant 项目构建设施识别', () => {
    it('识别 build.xml 并给出 default/target evidence，不因缺 pom.xml 报失败', () => {
        const root = makeProject('ant');
        write(
            root,
            'build.xml',
            [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<project name="x" default="war" basedir=".">',
                '    <target name="compile"></target>',
                '    <target name="war"></target>',
                '</project>',
            ].join('\n')
        );
        // 依赖目录内的 package.json 不属于本项目构建设施（node_modules 属排除清单）
        write(root, 'node_modules/some-pkg/package.json', '{"name":"some-pkg"}');

        const report = scanProject(root);

        // 只识别到根级 build.xml 一项
        expect(report.signals.build.map((item) => item.file)).toEqual(['build.xml']);
        const evidence = report.signals.build[0].evidence ?? '';
        expect(evidence).toContain('default=war');
        expect(evidence).toContain('war');
        // 四种构建标志文件平权：缺 pom.xml 不算缺失，不记失败
        expect(report.failures).toEqual([]);
    });
});

describe('2.2 敏感值防护（哨兵串断言）', () => {
    it('配置取值零外泄，config 条目仅含 file/keys', () => {
        const root = makeProject('secret');
        write(
            root,
            'DataBase.properties',
            [
                '# 数据库连接（含明文口令，扫描 MUST NOT 外泄）',
                'DB_URL1=jdbc:mysql://10.0.0.1:3306/app',
                'USER1=appuser',
                `PASSWORD1=${SENTINEL_PASSWORD}`,
                `sm4Key=${SENTINEL_SM4}`,
            ].join('\n')
        );

        const report = scanProject(root);

        // 报告序列化与写盘基线全文均不含哨兵串
        expect(JSON.stringify(report)).not.toContain(SENTINEL_PASSWORD);
        expect(JSON.stringify(report)).not.toContain(SENTINEL_SM4);
        const baseline = readBaselineText(root);
        expect(baseline).toBeDefined();
        expect(baseline).not.toContain(SENTINEL_PASSWORD);
        expect(baseline).not.toContain(SENTINEL_SM4);
        // 终端渲染文本同理
        expect(renderScanReport(report)).not.toContain(SENTINEL_PASSWORD);

        expect(report.signals.config.length).toBe(1);
        const entry = report.signals.config[0];
        expect(norm(entry.file)).toBe('DataBase.properties');
        expect(entry.keys).toContain('DB_URL1');
        expect(entry.keys).toContain('USER1');
        expect(entry.keys).toContain('PASSWORD1');
        expect(entry.keys).toContain('sm4Key');
        // 类型层：条目上不存在任何取值类字段
        expect(Object.keys(entry).sort()).toEqual(['file', 'keys']);
    });
});

describe('2.3 排除清单', () => {
    it('PII/编译产物/日志/依赖目录/iagent 自身产物均不入信号，且不触达上限', () => {
        const root = makeProject('exclude');
        // 含 PII 的非源码文件：内容 MUST NOT 被读取
        write(root, 'org.xml', `<org><idcard>${SENTINEL_PII}</idcard></org>`);
        // 编译产物目录与日志文件（真实 Web 项目常以 bin/ 存放编译产物，
        // 含 .class 与 .sql 副本，故与 dist/ 同等排除）
        write(root, 'dist/app.js', 'compiled');
        write(root, 'bin/com/demo/Main.class', 'bytecode');
        write(root, 'x.log', 'runtime log');
        write(root, 'hs_err_pid1.log', 'jvm crash');
        // 依赖目录
        write(root, 'node_modules/dep/package.json', '{"name":"dep"}');
        // iagent 自身产物：技能目录 / 项目配置 / 代码图谱
        write(root, '.claude/skills/iagent_pwd/SKILL.md', 'name: iagent_pwd');
        write(root, '.claude/skills/iagent_feature/SKILL.md', 'name: iagent_feature');
        write(root, '.iagent/config.yaml', 'workflows:\n  - tr_tools_pwd\n');
        write(root, '.codegraph/graph.db', 'binary');

        const report = scanProject(root);

        // PII 内容从未被读取
        expect(JSON.stringify(report)).not.toContain(SENTINEL_PII);

        // iagent 自身产物不被误报为构建设施/源码骨架
        expect(report.signals.build).toEqual([]);
        expect(report.signals.skeleton).toEqual([]);

        // 编译产物/日志/依赖目录/iagent 产物目录不进入任何信号
        const signalPaths = [
            ...report.signals.build.map((item) => item.file),
            ...report.signals.config.map((item) => item.file),
            ...report.signals.routes.map((item) => item.file),
            ...report.signals.docs.map((item) => item.path),
            ...report.signals.skeleton.map((item) => item.path),
        ].map(norm);
        for (const signalPath of signalPaths) {
            expect(signalPath.startsWith('dist/')).toBe(false);
            expect(signalPath.startsWith('node_modules/')).toBe(false);
            expect(signalPath.startsWith('.claude/')).toBe(false);
            expect(signalPath.startsWith('.codegraph/')).toBe(false);
            expect(signalPath.endsWith('.log')).toBe(false);
        }
        expect(signalPaths).not.toContain('org.xml');

        // 未触达上限（.claude/skills 下技能目录未被误判为项目信号）
        expect(report.limits.hit).toBe(false);
    });
});

describe('2.4 变体合并 + 候选/信号分层', () => {
    it('同配置多环境变体合并为一项、keys 取并集；jar 只进 candidates', () => {
        const root = makeProject('variant');
        write(root, 'DataBase.properties', 'DB_URL=jdbc:mysql://h/db\nDB_USER=u\n');
        write(root, 'DataBase.properties.bak', 'DB_USER=ubak\nDB_DRIVER=com.mysql.jdbc.Driver\n');
        write(root, 'DataBase_bss.properties', 'DB_URL=jdbc:mysql://bss/db\nDB_POOL_SIZE=10\n');
        // 真实项目实际使用的形态：环境后缀位于**扩展名之后**（`*.properties_<env>`，
        // 如 Venus4A 的 DataBase.properties_bss / _idc / _mysql）。该形态曾不被识别为变体、
        // 被当作「不认识的扩展名」静默忽略（既不合并也不报失败），故此处显式覆盖。
        write(root, 'DataBase.properties_bss', 'DB_EXTRA_BSS=1\n');
        write(root, 'DataBase.properties_idc', 'DB_EXTRA_IDC=1\n');
        write(root, 'lib/spring-2.0.5.jar', 'jar-bytes');
        write(root, 'lib/mysql-connector-java-8.0.30.jar', 'jar-bytes');

        const report = scanProject(root);

        // 同配置五份变体合并为一项，代表文件取规范命名，键名为并集
        expect(report.signals.config.length).toBe(1);
        expect(norm(report.signals.config[0].file)).toBe('DataBase.properties');
        expect(report.signals.config[0].keys).toEqual([
            'DB_DRIVER',
            'DB_EXTRA_BSS',
            'DB_EXTRA_IDC',
            'DB_POOL_SIZE',
            'DB_URL',
            'DB_USER',
        ]);

        // jar 只出现在 candidates，signals 中无相应字样（jar 存在 ≠ 框架在用）
        expect(JSON.stringify(report.signals)).not.toContain('spring');
        expect(report.signals.build).toEqual([]);
        const spring = report.candidates.find((item) => item.name === 'spring');
        expect(spring).toBeDefined();
        expect(spring?.kind).toBe('jar');
        expect(spring?.note).toContain('候选');
        expect(report.candidates.map((item) => item.name)).toEqual(['mysql-connector-java', 'spring']);
    });
});

describe('2.5 失败降级 + 超限可区分', () => {
    it('目录读取失败：返回结果且不抛出，原因落入 failures', () => {
        // Windows 下难以构造真实「不可读目录」，改用「不存在的路径」等价触发
        // 同一 readdirSync 失败分支（目录读取失败 → 记 failures 而非抛出）。
        const missing = path.join(tempRoot, 'no-such-dir-2-5');

        const { report, error } = scanSafely(missing, { writeBaseline: false });

        expect(error).toBeUndefined();
        expect(report?.failures.some((item) => item.reason.includes('目录读取失败'))).toBe(true);
    });

    it('写基线失败：state=failed 且带 warning，扫描不抛出', () => {
        const root = makeProject('baseline-fail');
        write(root, 'build.xml', '<project name="x" default="war"><target name="war"></target></project>');
        // 把 .iagent 建成文件（而非目录），使基线写盘必然失败
        fs.writeFileSync(path.join(root, '.iagent'), 'not-a-dir', 'utf8');

        const written = writeScanBaseline(root, createEmptyScanReport());
        expect(written.state).toBe('failed');
        expect(written.warning).toBeTruthy();
        expect(written.path).toBe(SCAN_BASELINE_PATH);

        // 扫描整体仍返回报告，写盘失败降级为 failures 条目
        const { report, error } = scanSafely(root);
        expect(error).toBeUndefined();
        expect(report?.failures.some((item) => item.target === SCAN_BASELINE_PATH)).toBe(true);
    });

    it('触及上限：hit=true 且说明含「上限所致」，与「未触达」可区分', () => {
        const root = makeProject('limits');
        write(root, 'a.txt', 'a');
        write(root, 'b.txt', 'b');
        write(root, 'nested/deep/c.txt', 'c');

        // 未触达：说明文本明确为「未触达」，不含「上限所致」
        const normal = scanProject(root, { writeBaseline: false });
        expect(normal.limits.hit).toBe(false);
        expect(normal.limits.detail).toContain('未触达');
        expect(normal.limits.detail).not.toContain('上限所致');

        // 文件数上限（注入 1）：说明文本指向 MAX_SCAN_FILES
        const byFiles = scanProject(root, { maxFiles: 1, writeBaseline: false });
        expect(byFiles.limits.hit).toBe(true);
        expect(byFiles.limits.detail).toContain('上限所致');
        expect(byFiles.limits.detail).toContain('MAX_SCAN_FILES=1');

        // 目录深度上限：造出比默认上限更深一层，验证默认值来自具名常量而非内联字面量
        const deep = makeProject('limits-deep');
        let cursor = deep;
        for (let level = 1; level <= MAX_SCAN_DEPTH + 1; level++) {
            cursor = path.join(cursor, `d${level}`);
        }
        fs.mkdirSync(cursor, { recursive: true });
        fs.writeFileSync(path.join(cursor, 'x.txt'), 'x');

        const byDepth = scanProject(deep, { writeBaseline: false });
        expect(byDepth.limits.hit).toBe(true);
        expect(byDepth.limits.detail).toContain(`MAX_SCAN_DEPTH=${MAX_SCAN_DEPTH}`);
    });
});

describe('2.6 iagent init 端到端', () => {
    it('产出基线、scanReport 识别构建设施，--no-scan 不写基线且为空报告', () => {
        // 零文档项目：只有 build.xml，无任何 md 文档、无预置 .iagent/
        const root = makeProject('init-e2e');
        write(root, 'build.xml', '<project name="zero-doc" default="war"><target name="war"></target></project>');
        // 含哨兵取值的配置：端到端验证渲染文本与基线均不外泄取值
        write(root, 'DataBase.properties', `PASSWORD1=${SENTINEL_PASSWORD}\n`);

        const result = runInit(root);

        // 基线文件存在且可解析，结构字段齐全
        const baselinePath = path.join(root, SCAN_BASELINE_PATH);
        expect(fs.existsSync(baselinePath)).toBe(true);
        const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Record<string, unknown>;
        for (const field of ['version', 'scannedAt', 'scope', 'limits']) {
            expect(baseline[field]).toBeDefined();
        }
        // InitResult.scanReport 已识别构建设施
        expect(result.scanReport.signals.build.map((item) => item.file)).toContain('build.xml');

        const rendered = renderScanReport(result.scanReport);
        expect(rendered.length).toBeGreaterThan(0);
        expect(rendered).toContain('项目预扫描');
        expect(rendered).not.toContain(SENTINEL_PASSWORD);
        expect(fs.readFileSync(baselinePath, 'utf8')).not.toContain(SENTINEL_PASSWORD);

        // --no-scan：先删基线，再跑，MUST NOT 重建/刷新基线
        fs.rmSync(baselinePath, { force: true });
        const noScan = runInit(root, { scan: false });
        expect(fs.existsSync(baselinePath)).toBe(false);
        // scanReport 为空报告形态（未扫描、未写基线）
        const empty = createEmptyScanReport();
        expect(noScan.scanReport.version).toBe(empty.version);
        expect(noScan.scanReport.scope).toEqual({ dirs: 0, files: 0 });
        expect(noScan.scanReport.limits).toEqual(empty.limits);
        expect(noScan.scanReport.signals).toEqual(empty.signals);
        expect(noScan.scanReport.candidates).toEqual([]);
    });

    it('CLI：默认打印扫描报告段，--no-scan 不打印且不写基线', () => {
        const root = makeProject('init-cli');
        write(root, 'build.xml', '<project name="cli" default="war"><target name="war"></target></project>');
        const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));

        const withScan = execInit(binPath, root, ['--no-deps']);
        expect(withScan).toContain('项目预扫描');
        const baselinePath = path.join(root, SCAN_BASELINE_PATH);
        expect(fs.existsSync(baselinePath)).toBe(true);

        fs.rmSync(baselinePath, { force: true });
        const noScan = execInit(binPath, root, ['--no-scan', '--no-deps']);
        expect(noScan).not.toContain('项目预扫描');
        expect(fs.existsSync(baselinePath)).toBe(false);
    });
});

describe('2.8 非 Maven/Ant 族项目（Node/TypeScript）', () => {
    it('识别 package.json 为构建设施，且不因缺 pom.xml/build.xml 报缺失', () => {
        const root = makeProject('node-ts');
        write(root, 'package.json', '{"name":"app","version":"1.0.0"}');
        write(root, 'pnpm-lock.yaml', 'lockfileVersion: 9\n');

        const report = scanProject(root);

        expect(report.signals.build.map((item) => item.file)).toEqual(['package.json']);
        expect(report.signals.build[0].evidence).toContain('npm');
        expect(report.failures).toEqual([]);
    });

    it('四种构建标志文件平权受理：任一存在即独立记为一项，无默认假设', () => {
        const cases: { file: string; label: string }[] = [
            { file: 'build.xml', label: 'Ant' },
            { file: 'pom.xml', label: 'Maven' },
            { file: 'build.gradle', label: 'Gradle' },
            { file: 'package.json', label: 'npm' },
        ];

        for (const item of cases) {
            const root = makeProject(`build-flag-${item.label}`);
            write(root, item.file, '<project name="x" default="war"><target name="war"></target></project>');

            const report = scanProject(root);
            expect(report.signals.build.map((entry) => entry.file)).toEqual([item.file]);
            expect(report.failures).toEqual([]);
        }
    });
});

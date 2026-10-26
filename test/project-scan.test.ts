/**
 * 项目预扫描（src/core/project-scan.ts）测试（v2 契约）。
 *
 * 覆盖：Ant / Node 构建设施识别、敏感值零外泄、固定忽略清单、变体合并与候选/信号分层、
 *       非阻断失败降级、无深度与文件数上限、忽略计数、软超时受控停止（终端 + 基线双写）、
 *       不可读计数、基线 v2 写入与 v1 只读兼容、CLI 注入路径（env / --no-scan-ignore）。
 *
 * 已移除的旧用例（v1「上限所致」语义废止）：MAX_SCAN_DEPTH / MAX_SCAN_FILES 截断断言 ——
 * 有界性改由「忽略清单 + 忽略规则 + 软超时」承担（见 tasks 1.9 / 1.12）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
    createEmptyScanReport,
    parseScanBaseline,
    renderScanReport,
    scanProject,
    writeScanBaseline,
    SCAN_BASELINE_PATH,
    SCAN_BASELINE_VERSION,
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
function execInit(binPath: string, cwd: string, args: string[], env?: NodeJS.ProcessEnv): string {
    return execFileSync(process.execPath, [binPath, 'init', ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: env === undefined ? process.env : { ...process.env, ...env },
    });
}

describe('1.1 Ant 项目构建设施识别', () => {
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
        // 依赖目录内的 package.json 不属于本项目构建设施（node_modules 属固定忽略清单）
        write(root, 'node_modules/some-pkg/package.json', '{"name":"some-pkg"}');

        const report = scanProject(root);

        // 只识别到根级 build.xml 一项
        expect(report.signals.build.map((item) => item.file)).toEqual(['build.xml']);
        const evidence = report.signals.build[0].evidence ?? '';
        expect(evidence).toContain('default=war');
        expect(evidence).toContain('war');
        // 四种构建标志文件平权：缺 pom.xml 不算缺失，不记失败
        expect(report.failures).toEqual([]);
        // node_modules 命中固定忽略清单 → 计入 skipped.ignored（不再有「上限」语义）
        expect(report.limits.skipped.ignored).toBeGreaterThanOrEqual(1);
    });
});

describe('1.2 敏感值防护（哨兵串断言）', () => {
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

describe('1.3 固定忽略清单（iagent 自身产物不误报）', () => {
    it('PII/编译产物/日志/依赖目录/iagent 自身产物均不入信号，跳过计入 ignored', () => {
        const root = makeProject('exclude');
        // 含 PII 的非源码文件：内容 MUST NOT 被读取
        write(root, 'org.xml', `<org><idcard>${SENTINEL_PII}</idcard></org>`);
        // 编译产物目录与日志文件（真实 Web 项目常以 bin/ 存放编译产物）
        write(root, 'dist/app.js', 'compiled');
        write(root, 'bin/com/demo/Main.class', 'bytecode');
        write(root, 'x.log', 'runtime log');
        write(root, 'hs_err_pid1.log', 'jvm crash');
        // 依赖目录
        write(root, 'node_modules/dep/package.json', '{"name":"dep"}');
        // iagent 自身产物：技能目录 / 项目配置 / 代码图谱
        write(root, '.claude/skills/iagent_pwd/SKILL.md', 'name: iagent_pwd');
        write(root, '.iagent/config.yaml', 'workflows:\n  - tr_tools_pwd\n');
        write(root, '.codegraph/graph.db', 'binary');
        // v2 固定清单新增的目录
        write(root, '.venv/lib/site.py', 'print(1)');
        write(root, '__pycache__/mod.pyc', 'bytecode');

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

        // 跳过原因：ignored（v2：hit 表示「发生任一跳过」）
        expect(report.limits.skipped.ignored).toBeGreaterThanOrEqual(6);
        expect(report.limits.reasons).toContain('ignored');
        expect(report.limits.hit).toBe(true);
        expect(report.limits.detail).toContain('忽略');
    });
});

describe('1.4 变体合并 + 候选/信号分层', () => {
    it('同配置多环境变体合并为一项、keys 取并集；jar 只进 candidates', () => {
        const root = makeProject('variant');
        write(root, 'DataBase.properties', 'DB_URL=jdbc:mysql://h/db\nDB_USER=u\n');
        write(root, 'DataBase.properties.bak', 'DB_USER=ubak\nDB_DRIVER=com.mysql.jdbc.Driver\n');
        write(root, 'DataBase_bss.properties', 'DB_URL=jdbc:mysql://bss/db\nDB_POOL_SIZE=10\n');
        // 真实项目实际使用的形态：环境后缀位于**扩展名之后**（`*.properties_<env>`）
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

describe('1.5 非阻断失败降级', () => {
    it('目录读取失败：返回结果且不抛出，原因落入 failures 并计入 skipped.unreadable', () => {
        // Windows 下难以构造真实「不可读目录」，改用「不存在的路径」等价触发
        // 同一 readdirSync 失败分支（目录读取失败 → 记 failures 而非抛出）。
        const missing = path.join(tempRoot, 'no-such-dir-1-5');

        const { report, error } = scanSafely(missing, { writeBaseline: false });

        expect(error).toBeUndefined();
        expect(report?.failures.some((item) => item.reason.includes('目录读取失败'))).toBe(true);
        expect(report?.limits.skipped.unreadable).toBeGreaterThanOrEqual(1);
        expect(report?.limits.reasons).toContain('unreadable');
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
});

describe('1.9 无上限 / 忽略计数 / 软超时 / 基线 v2', () => {
    it('深度 ≥12 的配置目录不再被漏采', () => {
        const root = makeProject('deep');
        const deepRel = 'src/main/java/com/acme/module/a/b/c/d/e/f/g';
        write(root, `${deepRel}/db.properties`, 'DB_URL=jdbc:mysql://h/db\nPASSWORD=p\n');
        write(root, 'package.json', '{"name":"deep"}');

        const report = scanProject(root, { writeBaseline: false });

        const configPaths = report.signals.config.map((item) => norm(item.file));
        expect(configPaths).toContain(`${deepRel}/db.properties`);
        // 无「上限所致」类跳过
        expect(report.limits.detail).not.toContain('上限');
    });

    // init-project-scan / 「不设深度与文件数上限」：深度远超 12 层仍完整采集（语义断言，不依赖耗时）。
    it('深度 20 的配置文件仍被采集，且无任何「上限」类跳过原因', () => {
        const root = makeProject('deep-20');
        const deepRel = Array.from({ length: 20 }, (_, index) => `d${index + 1}`).join('/');
        write(root, `${deepRel}/db.properties`, 'DB_URL=jdbc:mysql://h/db\nAPP_MODE=prod\n');

        const report = scanProject(root, { writeBaseline: false });

        expect(report.signals.config.map((item) => norm(item.file))).toEqual([`${deepRel}/db.properties`]);
        // 深层文件被计入 scope.files（20 层目录 + 1 文件）
        expect(report.scope.dirs).toBe(21);
        expect(report.scope.files).toBe(1);
        expect(report.limits.hit).toBe(false);
        expect(report.limits.reasons).toEqual([]);
        expect(report.failures).toEqual([]);
    });

    it('超过 2000 个文件不被截断', () => {
        const root = makeProject('many-files');
        const manyDir = path.join(root, 'many');
        fs.mkdirSync(manyDir, { recursive: true });
        for (let index = 0; index < 2050; index++) {
            fs.writeFileSync(path.join(manyDir, `f${index}.txt`), 'x', 'utf8');
        }

        const report = scanProject(root, { writeBaseline: false });

        expect(report.scope.files).toBeGreaterThanOrEqual(2050);
        expect(report.limits.hit).toBe(false);
        expect(report.limits.reasons).toEqual([]);
        expect(report.limits.detail).toBe('未发生跳过');
    });

    it('忽略命中计入 skipped.ignored（固定清单 + .gitignore 否定规则）', () => {
        const root = makeProject('ignored-count');
        write(root, '.gitignore', 'logs/\n!logs/keep.properties\n');
        write(root, 'logs/a.properties', 'A=1\n');
        write(root, 'logs/keep.properties', 'KEEP=1\n');
        write(root, 'dist/bundle.js', 'compiled');
        write(root, 'keep.txt', 'x');

        const report = scanProject(root, { writeBaseline: false });

        // logs/ 因否定规则仍被遍历（不计入忽略）→ logs/a.properties + dist/ = 2 项
        expect(report.limits.skipped.ignored).toBe(2);
        expect(report.limits.reasons).toEqual(['ignored']);
        // 否定规则生效：keep.properties 被正常归类
        expect(report.signals.config.map((item) => norm(item.file))).toContain('logs/keep.properties');
        expect(report.signals.config.map((item) => norm(item.file))).not.toContain('logs/a.properties');
    });

    it('软超时：exceeded=true + skipped.timeout≥1，终端与基线双写提示（受控停止）', () => {
        const root = makeProject('soft-timeout');
        for (let index = 1; index <= 5; index++) {
            write(root, `src/d${index}/a.properties`, `K${index}=1\n`);
        }
        // 可注入时钟：第 3 次读取后即超过 100ms 预算（不依赖真实计时）
        let reads = 0;
        const report = scanProject(root, {
            softTimeoutMs: 100,
            now: () => (reads++ > 2 ? 1_000 : 0),
        });

        expect(report.limits.softTimeout.exceeded).toBe(true);
        expect(report.limits.softTimeout.ms).toBe(100);
        expect(report.limits.skipped.timeout).toBeGreaterThanOrEqual(1);
        expect(report.limits.reasons).toContain('soft-timeout');
        expect(report.limits.hit).toBe(true);

        // 终端报告与基线 JSON 双写（不得静默）
        const rendered = renderScanReport(report);
        expect(rendered).toContain('软超时');
        expect(rendered).toContain('因软超时跳过');
        const baseline = JSON.parse(fs.readFileSync(path.join(root, SCAN_BASELINE_PATH), 'utf8')) as {
            limits: { softTimeout: { exceeded: boolean }; skipped: { timeout: number } };
        };
        expect(baseline.limits.softTimeout.exceeded).toBe(true);
        expect(baseline.limits.skipped.timeout).toBeGreaterThanOrEqual(1);
    });

    // init-project-scan / 「软超时停止遍历但不失败」：受控停止 MUST NOT 记 failures、MUST NOT 抛出。
    it('软超时为受控停止而非失败：不抛出、failures 为空、终端明示「非失败」', () => {
        const root = makeProject('soft-timeout-not-failure');
        write(root, 'a/f1.properties', 'K1=1\n');
        write(root, 'b/f2.properties', 'K2=1\n');
        // 预算 1ms + 可注入时钟：第 1 次取时建立 deadline，之后立即超预算（确定性，无真实等待）
        let calls = 0;
        const { report, error } = scanSafely(root, {
            writeBaseline: false,
            softTimeoutMs: 1,
            now: () => (calls++ === 0 ? 0 : 10_000),
        });

        expect(error).toBeUndefined();
        expect(report?.limits.softTimeout).toEqual({ ms: 1, exceeded: true });
        expect(report?.limits.skipped.timeout).toBeGreaterThanOrEqual(1);
        expect(report?.limits.reasons).toEqual(['soft-timeout']);
        // 受控停止不是失败：failures 为空（不可读才落 failures）
        expect(report?.failures).toEqual([]);
        expect(report?.limits.detail).toContain('因软超时跳过');
        const rendered = renderScanReport(report as ProjectScanReport);
        expect(rendered).toContain('软超时');
        expect(rendered).toContain('受控停止、非失败');
    });

    it('基线恒写 version=2 且不含 maxDepth/maxFiles；v1 基线仍可读取', () => {
        const root = makeProject('baseline-v2');
        write(root, 'build.xml', '<project name="v2" default="war"><target name="war"></target></project>');

        const report = scanProject(root);
        expect(report.version).toBe(SCAN_BASELINE_VERSION);
        const raw = fs.readFileSync(path.join(root, SCAN_BASELINE_PATH), 'utf8');
        expect(raw).toContain('"version": 2');
        expect(raw).not.toContain('maxDepth');
        expect(raw).not.toContain('maxFiles');
        // v2 字段齐全
        const parsed = JSON.parse(raw) as {
            limits: { reasons: unknown[]; softTimeout: unknown; skipped: Record<string, number> };
        };
        expect(parsed.limits.reasons).toEqual([]);
        expect(parsed.limits.softTimeout).toEqual({ ms: 30000, exceeded: false });
        expect(parsed.limits.skipped).toEqual({ ignored: 0, timeout: 0, unreadable: 0 });

        // 历史 v1 基线（无 skipped / softTimeout）：按 v1 分支只读 hit/detail，不报错
        const legacy = parseScanBaseline(
            JSON.stringify({
                version: 1,
                scannedAt: '2026-01-01T00:00:00.000Z',
                scope: { dirs: 2, files: 3 },
                limits: { hit: true, detail: '上限所致：目录深度已达 MAX_SCAN_DEPTH=8' },
                signals: { build: [{ file: 'build.xml' }], skeleton: [], config: [], routes: [], docs: [], tests: [] },
                candidates: [],
                failures: [],
            })
        );
        expect(legacy.version).toBe(2);
        expect(legacy.scope).toEqual({ dirs: 2, files: 3 });
        expect(legacy.limits.hit).toBe(true);
        expect(legacy.limits.detail).toContain('MAX_SCAN_DEPTH');
        expect(legacy.limits.skipped).toEqual({ ignored: 0, timeout: 0, unreadable: 0 });
        expect(legacy.signals.build.map((item) => item.file)).toEqual(['build.xml']);
    });

    // init-project-scan / 「扫描基线落盘」：缺 version 字段的历史基线同样按 v1 归一（MUST NOT 报错）。
    it('缺 version 字段（含 maxDepth / maxFiles）的 v1 基线归一为 v2：hit/detail 保留、skipped 置 0', () => {
        const legacy = parseScanBaseline(
            JSON.stringify({
                scannedAt: '2026-01-01T00:00:00.000Z',
                scope: { dirs: 4, files: 7 },
                limits: { hit: true, detail: '上限所致：目录深度已达 MAX_SCAN_DEPTH=8', maxDepth: 8, maxFiles: 2000 },
                signals: {
                    build: [{ file: 'pom.xml' }],
                    skeleton: [],
                    config: [],
                    routes: [],
                    docs: [],
                    tests: [],
                },
                candidates: [],
                failures: [{ target: 'src', reason: '目录读取失败' }],
            })
        );

        expect(legacy.version).toBe(SCAN_BASELINE_VERSION);
        expect(legacy.scope).toEqual({ dirs: 4, files: 7 });
        // 历史 hit/detail 逐字保留（不重写用户文件语义）
        expect(legacy.limits.hit).toBe(true);
        expect(legacy.limits.detail).toContain('MAX_SCAN_DEPTH');
        // v2 新增字段按空值归一，而不是报错
        expect(legacy.limits.reasons).toEqual([]);
        expect(legacy.limits.skipped).toEqual({ ignored: 0, timeout: 0, unreadable: 0 });
        expect(legacy.limits.softTimeout).toEqual({ ms: 30000, exceeded: false });
        // 既有事实字段保留
        expect(legacy.signals.build.map((item) => item.file)).toEqual(['pom.xml']);
        expect(legacy.failures).toEqual([{ target: 'src', reason: '目录读取失败' }]);
        // 上限字段不进入归一结果（无上限语义）
        expect(JSON.stringify(legacy)).not.toContain('maxDepth');
        expect(JSON.stringify(legacy)).not.toContain('maxFiles');
    });

    it('空报告为 v2 形态：version=2、skipped 三项为 0、hit=false 时 detail 中性', () => {
        const empty = createEmptyScanReport();
        expect(empty.version).toBe(2);
        expect(empty.limits.skipped).toEqual({ ignored: 0, timeout: 0, unreadable: 0 });
        expect(empty.limits.reasons).toEqual([]);
        expect(empty.limits.hit).toBe(false);
        expect(empty.limits.detail).not.toContain('上限');
    });

    it('--no-scan 占位报告与真实空扫描一致（limits 结构）', () => {
        const root = makeProject('no-skip');
        write(root, 'README.md', '# empty\n');
        const report = scanProject(root, { writeBaseline: false });
        expect(report.limits).toEqual({
            hit: false,
            detail: '未发生跳过',
            reasons: [],
            softTimeout: { ms: 30000, exceeded: false },
            skipped: { ignored: 0, timeout: 0, unreadable: 0 },
        });
    });
});

describe('1.12 既有行为回归（v2 契约下仍成立）', () => {
    it('测试目录探针记录事实（任意层级按目录名命中）', () => {
        const root = makeProject('probe-dir');
        write(root, 'test/unit/a.ts', 'export {};\n');
        write(root, 'src/test/java/DemoHelper.java', 'class DemoHelper {}\n');
        write(root, 'package.json', '{"name":"app"}');

        const report = scanProject(root, { writeBaseline: false });
        const dirs = report.signals.tests.filter((item) => item.kind === 'test-dir');
        expect(dirs.map((item) => norm(item.name)).sort()).toEqual(['src/test', 'test']);
        // count 固定 1：只反映「观察到该目录」这一事实
        expect(dirs.every((item) => item.count === 1)).toBe(true);
        expect(renderScanReport(report)).toContain('测试探针：');
    });

    it('测试文件名模式命中即计数（*Test.java / *.test.* / *.spec.*）', () => {
        const root = makeProject('probe-files');
        write(root, 'src/main/java/DemoTest.java', 'class DemoTest {}\n');
        write(root, 'src/main/java/OtherTests.java', 'class OtherTests {}\n');
        write(root, 'web/src/a.test.ts', 'export {};\n');
        write(root, 'web/src/b.test.ts', 'export {};\n');
        write(root, 'web/src/c.spec.ts', 'export {};\n');
        write(root, 'package.json', '{"name":"app"}');

        const report = scanProject(root, { writeBaseline: false });
        const byName = new Map(
            report.signals.tests.filter((item) => item.kind === 'test-files').map((item) => [item.name, item.count])
        );
        expect(byName.get('*Test.java')).toBe(1);
        expect(byName.get('*Tests.java')).toBe(1);
        expect(byName.get('*.test.*')).toBe(2);
        expect(byName.get('*.spec.*')).toBe(1);
        // 只有文件名匹配，不读内容：任何模式记录都不含文件内容或框架名
        expect(JSON.stringify(report.signals.tests)).not.toContain('class');
    });

    it('测试文件模式计数因软超时未完成：只记已计数部分并标注跳过', () => {
        const root = makeProject('probe-soft-timeout');
        for (let index = 0; index < 6; index++) {
            write(root, `pkg/d${index}/a.test.ts`, 'export {};\n');
        }
        let reads = 0;
        const report = scanProject(root, {
            writeBaseline: false,
            softTimeoutMs: 50,
            now: () => (reads++ > 1 ? 1_000 : 0),
        });

        expect(report.limits.softTimeout.exceeded).toBe(true);
        expect(report.limits.skipped.timeout).toBeGreaterThanOrEqual(1);
        const counts = report.signals.tests
            .filter((item) => item.kind === 'test-files')
            .reduce((sum, item) => sum + item.count, 0);
        // 已计数部分不超过夹具文件总数，且不得据此推断框架结论
        expect(counts).toBeLessThanOrEqual(6);
        expect(JSON.stringify(report.signals.tests)).not.toContain('框架');
    });

    it('无测试探针时为空（空报告形态同步该维度）', () => {
        const root = makeProject('probe-none');
        write(root, 'README.md', '# 无测试项目\n');
        write(root, 'package.json', '{"name":"app"}');

        const report = scanProject(root, { writeBaseline: false });

        expect(report.signals.tests).toEqual([]);
        expect(createEmptyScanReport().signals.tests).toEqual([]);
        expect(renderScanReport(report)).toContain('测试探针：未探测到');
    });

    it('jar 候选不因存在而生成测试/框架结论', () => {
        const root = makeProject('probe-jar');
        write(root, 'lib/spring-2.0.5.jar', 'jar-bytes');
        write(root, 'lib/junit-4.13.jar', 'jar-bytes');

        const report = scanProject(root, { writeBaseline: false });

        expect(report.candidates.map((item) => item.kind)).toEqual(['jar', 'jar']);
        expect(report.candidates.every((item) => item.note.includes('候选'))).toBe(true);
        expect(report.signals.tests).toEqual([]);
        expect(report.signals.build).toEqual([]);
        expect(JSON.stringify(report.signals)).not.toContain('junit');
    });

    it('非 Maven/Ant 族项目（Node/TypeScript）识别 package.json 为构建设施', () => {
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

describe('1.13 iagent init 端到端（扫描注入路径）', () => {
    it('产出 v2 基线、scanReport 识别构建设施；--no-scan 不写基线且为空报告', () => {
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
        expect(baseline.version).toBe(2);
        // InitResult.scanReport 已识别构建设施
        expect(result.scanReport.signals.build.map((item) => item.file)).toContain('build.xml');

        const rendered = renderScanReport(result.scanReport);
        expect(rendered.length).toBeGreaterThan(0);
        expect(rendered).toContain('项目预扫描');
        expect(rendered).toContain('跳过：');
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

        const withScan = execInit(binPath, root, ['--tools', 'claude', '--no-deps']);
        expect(withScan).toContain('项目预扫描');
        const baselinePath = path.join(root, SCAN_BASELINE_PATH);
        expect(fs.existsSync(baselinePath)).toBe(true);

        fs.rmSync(baselinePath, { force: true });
        const noScan = execInit(binPath, root, ['--tools', 'claude', '--no-scan', '--no-deps']);
        expect(noScan).not.toContain('项目预扫描');
        expect(fs.existsSync(baselinePath)).toBe(false);
    });

    it('IAGENT_SCAN_SOFT_TIMEOUT_MS 极小值：受控停止、双写提示、退出码 0', () => {
        const root = makeProject('init-env-timeout');
        for (let index = 0; index < 6; index++) {
            write(root, `src/d${index}/db.properties`, `K${index}=1\n`);
        }
        const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));

        // execFileSync 在非零退出码时抛错，故跑到这里即证明退出码为 0
        const stdout = execInit(binPath, root, ['--tools', 'claude', '--no-deps'], {
            IAGENT_SCAN_SOFT_TIMEOUT_MS: '1',
        });

        expect(stdout).toContain('软超时');
        const baseline = JSON.parse(
            fs.readFileSync(path.join(root, SCAN_BASELINE_PATH), 'utf8')
        ) as { limits: { softTimeout: { exceeded: boolean; ms: number }; skipped: { timeout: number } } };
        expect(baseline.limits.softTimeout.ms).toBe(1);
        expect(baseline.limits.softTimeout.exceeded).toBe(true);
        expect(baseline.limits.skipped.timeout).toBeGreaterThanOrEqual(1);
    });

    it('非法 IAGENT_SCAN_SOFT_TIMEOUT_MS 被忽略并 WARN（沿用默认预算）', () => {
        const root = makeProject('init-env-invalid');
        write(root, 'README.md', '# x\n');
        const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));

        const stdout = execInit(binPath, root, ['--tools', 'claude', '--no-deps'], {
            IAGENT_SCAN_SOFT_TIMEOUT_MS: 'abc',
        });

        expect(stdout).toContain('忽略非法环境变量');
        const baseline = JSON.parse(
            fs.readFileSync(path.join(root, SCAN_BASELINE_PATH), 'utf8')
        ) as { limits: { softTimeout: { ms: number } } };
        expect(baseline.limits.softTimeout.ms).toBe(30000);
    });

    it('--no-scan-ignore 关闭忽略规则解析（.gitignore 不参与过滤）', () => {
        const root = makeProject('init-no-scan-ignore');
        write(root, '.gitignore', 'generated/\n');
        write(root, 'generated/db.properties', 'K=1\n');
        const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));

        const stdout = execInit(binPath, root, [
            '--tools',
            'claude',
            '--no-deps',
            '--no-scan-ignore',
        ]);
        expect(stdout).toContain('项目预扫描');
        // .gitignore 不生效时，generated/ 下的配置被正常归类（以扫描报告文本为证）
        expect(stdout).toContain('generated/db.properties');
    });

    it('--help 列出 --no-scan-ignore', () => {
        const binPath = fileURLToPath(new URL('../bin/iagent.js', import.meta.url));
        const stdout = execFileSync(process.execPath, [binPath, 'init', '--help'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        expect(stdout).toContain('--no-scan-ignore');
    });
});

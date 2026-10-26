/**
 * 忽略规则解析（src/core/scan-ignore.ts）测试。
 *
 * 覆盖 tasks 1.10 的八类：固定清单 / `.gitignore` / `!` 否定 / 嵌套作用域 /
 * 自定义 ignore / 解析失败 fail-open / `respectIgnoreFiles=false` 退化 / Windows 反斜杠归一。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    BUILTIN_IGNORED_DIR_NAMES,
    createIgnoreMatcher,
    isBuiltinIgnoredDirName,
} from '../src/core/scan-ignore.js';
import { scanProject } from '../src/core/project-scan.js';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-ignore-'));
});

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

/** 新建夹具目录并写入若干文件（键为相对路径，值为内容） */
function makeFixture(name: string, files: Record<string, string>): string {
    const root = path.join(tempRoot, name);
    for (const [relPath, content] of Object.entries(files)) {
        const target = path.join(root, relPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf8');
    }
    fs.mkdirSync(root, { recursive: true });
    return root;
}

describe('1.10 固定忽略清单', () => {
    it('覆盖 VCS / 构建产物 / 依赖 / iagent 自身产物与常见生态目录', () => {
        for (const name of [
            '.git',
            'node_modules',
            'dist',
            'build',
            'coverage',
            '.next',
            '.venv',
            '__pycache__',
            '.claude',
            '.iagent',
            '.codegraph',
            'openspec',
        ]) {
            expect(isBuiltinIgnoredDirName(name), name).toBe(true);
            expect(BUILTIN_IGNORED_DIR_NAMES.has(name), name).toBe(true);
        }
        expect(isBuiltinIgnoredDirName('.DS_Store')).toBe(false);
    });
});

describe('1.10 .gitignore 与否定规则', () => {
    it('忽略 logs/ 但 !logs/keep.properties 时，例外文件仍被遍历', () => {
        const root = makeFixture('negation', {
            '.gitignore': '# 日志\nlogs/\n!logs/keep.properties\n',
            'logs/a.properties': 'A=1\n',
            'logs/keep.properties': 'KEEP=1\n',
        });
        const matcher = createIgnoreMatcher(root);

        // 目录因存在锚定否定规则而仍进入遍历（否则例外文件无法被发现）
        expect(matcher.ignores('logs', true)).toBe(false);
        expect(matcher.ignores('logs/a.properties', false)).toBe(true);
        expect(matcher.ignores('logs/keep.properties', false)).toBe(false);
        expect(matcher.warnings).toEqual([]);
    });

    it('尾部 / 仅目录、前导 / 锚定根目录、* 与 ** 通配生效', () => {
        const root = makeFixture('patterns', {
            '.gitignore': ['tmp/', '/root-only.txt', '*.tmp', 'a/**/deep.txt', 'd?.txt'].join('\n'),
            'tmp/a.txt': 'x',
            'sub/tmp/b.txt': 'x',
            'root-only.txt': 'x',
            'sub/root-only.txt': 'x',
            'x.tmp': 'x',
            'a/b/c/deep.txt': 'x',
            'd1.txt': 'x',
            'd12.txt': 'x',
        });
        const matcher = createIgnoreMatcher(root);

        expect(matcher.ignores('tmp', true)).toBe(true);
        expect(matcher.ignores('sub/tmp', true)).toBe(true);
        expect(matcher.ignores('root-only.txt', false)).toBe(true);
        expect(matcher.ignores('sub/root-only.txt', false)).toBe(false);
        expect(matcher.ignores('x.tmp', false)).toBe(true);
        expect(matcher.ignores('a/b/c/deep.txt', false)).toBe(true);
        expect(matcher.ignores('d1.txt', false)).toBe(true);
        expect(matcher.ignores('d12.txt', false)).toBe(false);
    });
});

describe('1.10 嵌套 .gitignore 作用域受限', () => {
    it('子目录规则只在其子树生效', () => {
        const root = makeFixture('nested', {
            'module-a/.gitignore': '*.tmp\n',
            'module-a/x.tmp': 'x',
            'module-b/x.tmp': 'x',
            'x.tmp': 'x',
        });
        const matcher = createIgnoreMatcher(root);

        expect(matcher.ignores('module-a/x.tmp', false)).toBe(true);
        expect(matcher.ignores('module-b/x.tmp', false)).toBe(false);
        expect(matcher.ignores('x.tmp', false)).toBe(false);
    });
});

describe('1.10 自定义 ignore 文件（不依赖 VCS）', () => {
    it('.iagentignore 与 .ignore 参与解析', () => {
        const root = makeFixture('custom', {
            '.iagentignore': '*.bak\n',
            '.ignore': 'generated/\n',
            'a.bak': 'x',
            'generated/out.js': 'x',
            'keep.js': 'x',
        });
        const matcher = createIgnoreMatcher(root);

        expect(matcher.ignores('a.bak', false)).toBe(true);
        expect(matcher.ignores('generated', true)).toBe(true);
        expect(matcher.ignores('keep.js', false)).toBe(false);
    });

    it('无 VCS 元数据（无 .git/.gitignore）仍可正常判定与遍历', () => {
        const root = makeFixture('no-vcs', { 'src/a.ts': 'export {};\n' });
        expect(fs.existsSync(path.join(root, '.git'))).toBe(false);
        const matcher = createIgnoreMatcher(root);

        expect(matcher.warnings).toEqual([]);
        expect(matcher.ignores('src/a.ts', false)).toBe(false);
        expect(scanProject(root, { writeBaseline: false }).failures).toEqual([]);
    });
});

describe('1.10 解析失败 fail-open', () => {
    it('内容不可解析：该文件不生效、记录 warning、不过滤', () => {
        const root = makeFixture('fail-open', {
            '.gitignore': 'ignored-dir/\n\u0000BROKEN\n',
            'ignored-dir/a.properties': 'A=1\n',
        });
        const matcher = createIgnoreMatcher(root);

        // fail-open：不过滤，warning 非空
        expect(matcher.ignores('ignored-dir/a.properties', false)).toBe(false);
        expect(matcher.warnings.length).toBeGreaterThan(0);
        expect(matcher.warnings[0]).toContain('fail-open');
    });

    it('非文件（同名目录）不构成解析失败，也不产生规则', () => {
        const root = makeFixture('ignore-is-dir', { 'a.bak': 'x' });
        fs.mkdirSync(path.join(root, '.gitignore'));

        const matcher = createIgnoreMatcher(root);
        expect(matcher.warnings).toEqual([]);
        expect(matcher.ignores('a.bak', false)).toBe(false);
    });
});

describe('1.10 respectIgnoreFiles=false 退化', () => {
    it('关闭后 .gitignore / 自定义 ignore 均不参与过滤（仅固定清单由调用方判定）', () => {
        const root = makeFixture('disabled', {
            '.gitignore': 'generated/\n',
            '.iagentignore': '*.bak\n',
            'generated/db.properties': 'K=1\n',
            'a.bak': 'x',
        });
        const matcher = createIgnoreMatcher(root, { respectIgnoreFiles: false });

        expect(matcher.ignores('generated', true)).toBe(false);
        expect(matcher.ignores('generated/db.properties', false)).toBe(false);
        expect(matcher.ignores('a.bak', false)).toBe(false);
        expect(matcher.warnings).toEqual([]);

        // 集成：generated/ 下的配置被正常归类
        const report = scanProject(root, { writeBaseline: false, respectIgnoreFiles: false });
        expect(report.signals.config.map((item) => item.file.replaceAll('\\', '/'))).toContain(
            'generated/db.properties'
        );
    });
});

describe('1.10 Windows 反斜杠归一', () => {
    it('反斜杠路径与正斜杠路径判定一致', () => {
        const root = makeFixture('win-path', {
            '.gitignore': 'logs/\n!logs/keep.properties\n',
            'logs/a.properties': 'A=1\n',
            'logs/keep.properties': 'KEEP=1\n',
        });
        const matcher = createIgnoreMatcher(root);

        expect(matcher.ignores('logs\\a.properties', false)).toBe(true);
        expect(matcher.ignores('logs\\keep.properties', false)).toBe(false);
        expect(matcher.ignores('logs\\sub\\b.properties', false)).toBe(true);
    });
});

// init-project-scan / 「忽略清单与忽略规则解析」：8 类固定目录逐个断言（补既有清单用例的逐个覆盖与大小写维度）。
describe('1.10 固定忽略清单逐个断言（8 类）', () => {
    it('8 类固定目录逐个命中，且非清单目录不命中', () => {
        const EIGHT = [
            '.git',
            'node_modules',
            'dist',
            'build',
            'coverage',
            '.next',
            '.venv',
            '__pycache__',
        ];
        for (const name of EIGHT) {
            expect(BUILTIN_IGNORED_DIR_NAMES.has(name), name).toBe(true);
            expect(isBuiltinIgnoredDirName(name), name).toBe(true);
            // 逐个断言，避免「清单整体存在」掩盖个别条目缺失
            expect(BUILTIN_IGNORED_DIR_NAMES.size, name).toBeGreaterThanOrEqual(EIGHT.length);
        }
        // 非清单目录不应被误判（判别力：不是「任何名字都 true」）
        for (const name of ['src', 'app', 'distribution', 'builds', 'coverage-report']) {
            expect(isBuiltinIgnoredDirName(name), name).toBe(false);
        }
    });

    it('目录名按小写比较：大小写变体同样命中（Windows / 大小写不敏感文件系统）', () => {
        for (const name of ['.GIT', 'NODE_MODULES', 'Dist', 'BUILD', 'Coverage', '.NEXT', '.Venv', '__PYCACHE__']) {
            expect(isBuiltinIgnoredDirName(name), name).toBe(true);
        }
    });

    it('深层嵌套的固定忽略目录不进入遍历（不计 scope.files 与信号）', () => {
        const root = makeFixture('deep-ignored', {
            'a/b/c/node_modules/pkg/db.properties': 'SECRET_KEY=1\n',
            'a/b/c/Dist/out.properties': 'OUT_KEY=1\n',
            'a/b/c/src/app.properties': 'APP_KEY=1\n',
        });
        const report = scanProject(root, { writeBaseline: false });
        const configFiles = report.signals.config.map((item) => item.file.replaceAll('\\', '/'));

        expect(configFiles).toEqual(['a/b/c/src/app.properties']);
        // 两个被忽略目录各计 1（目录命中计 1，不展开统计未知子项）
        expect(report.limits.skipped.ignored).toBe(2);
        expect(report.limits.reasons).toEqual(['ignored']);
        // 遍历目录：根 + a + b + c + src（node_modules / Dist 未进入）
        expect(report.scope.dirs).toBe(5);
    });
});

// init-project-scan / 「忽略清单与忽略规则解析」：注释行与未支持语法的 fail-open 方向。
describe('1.10 注释行与未支持语法 fail-open', () => {
    it('注释行不产生规则（不会把 # 之后的模式当成忽略），其余规则照常生效', () => {
        const root = makeFixture('comment-fail-open', {
            '.gitignore': ['#ignored-dir/', '# *.log', 'logs/'].join('\n'),
            'ignored-dir/a.properties': 'A=1\n',
            'x.log': 'x',
            'logs/b.properties': 'B=1\n',
        });
        const matcher = createIgnoreMatcher(root);

        // 若注释被误当作规则（剥掉 #），ignored-dir 与 *.log 会命中 —— 这两条断言即为判别点
        expect(matcher.ignores('ignored-dir', true)).toBe(false);
        expect(matcher.ignores('x.log', false)).toBe(false);
        expect(matcher.ignores('logs', true)).toBe(true);
        expect(matcher.warnings).toEqual([]);
    });

    it('字符类与反斜杠转义按「该行不产生忽略」处理：不抛错、不反向误忽略', () => {
        const root = makeFixture('unsupported-syntax', {
            '.gitignore': ['[abc].txt', 'dir\\name', 'keep.log'].join('\n'),
            'a.txt': 'x',
            'dir/name': 'x',
            'keep.log': 'x',
        });
        const matcher = createIgnoreMatcher(root);

        expect(() => matcher.ignores('a.txt', false)).not.toThrow();
        // 字符类 [abc].txt 未支持 → 不忽略 a.txt（也不因该行把整份文件作废）
        expect(matcher.ignores('a.txt', false)).toBe(false);
        // 反斜杠转义未支持 → 不忽略 dir/name
        expect(matcher.ignores('dir\\name', false)).toBe(false);
        // 同一文件内的受支持规则仍生效（fail-open 只影响未支持那一行）
        expect(matcher.ignores('keep.log', false)).toBe(true);
        expect(matcher.warnings).toEqual([]);
    });
});

/**
 * 版本递增判定测试：
 *   - SemVer 递增与等级判定（提交 / 文件 / 注册表 / CHANGELOG 四类信号）
 *   - CHANGELOG 归档与 README 版本引用同步
 *   - Git 仓库端到端：iagent version / version bump
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
    analyzeVersionBump,
    buildChangelogBody,
    bumpVersion,
    extractUnreleasedBody,
    parseSemver,
    updateChangelog,
    updatePackageVersion,
    updateReadmeVersion,
    type CommitInfo,
    type VersionChangeSet,
} from '../src/core/version-bump.js';
import { renderVersionReport, runVersion } from '../src/commands/version.js';

/** 造一个变更集（默认无信号） */
function changeSet(overrides: Partial<VersionChangeSet> = {}): VersionChangeSet {
    return {
        baselineRef: 'v1.0.0',
        baselineLabel: 'tag v1.0.0',
        commits: [],
        files: [],
        ...overrides,
    };
}

/** 造一个提交 */
function commit(subject: string, body = '', hash = 'a'.repeat(40)): CommitInfo {
    return { hash, subject, body };
}

describe('SemVer 递增', () => {
    it('解析与递增', () => {
        expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
        expect(parseSemver('1.2.3-beta.1')).toEqual([1, 2, 3]);
        expect(parseSemver('v1.2.3')).toBeNull();
        expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
        expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
        expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
    });

    it('非法版本抛错', () => {
        expect(() => bumpVersion('1.2', 'patch')).toThrow(/无法解析版本号/);
    });
});

describe('实现影响面判定', () => {
    it('仅有修复 / 维护提交 → patch', () => {
        const analysis = analyzeVersionBump('1.2.3', changeSet({
            commits: [commit('fix(cli): 修正输出')],
            files: [{ path: 'src/cli/index.ts', status: 'modified' }],
        }));
        expect(analysis.level).toBe('patch');
        expect(analysis.nextVersion).toBe('1.2.4');
    });

    it('功能提交 → minor', () => {
        const analysis = analyzeVersionBump('1.2.3', changeSet({
            commits: [commit('feat(cli): 新增 version 命令')],
        }));
        expect(analysis.level).toBe('minor');
        expect(analysis.nextVersion).toBe('1.3.0');
        expect(analysis.signals.some((s) => s.code === 'commit-feat')).toBe(true);
    });

    it('feat! 与 BREAKING CHANGE 均 → major', () => {
        const bang = analyzeVersionBump('1.2.3', changeSet({
            commits: [commit('feat(cli)!: 移除旧命令')],
        }));
        expect(bang.level).toBe('major');
        expect(bang.nextVersion).toBe('2.0.0');

        const footer = analyzeVersionBump('1.2.3', changeSet({
            commits: [commit('fix(cli): 调整行为', 'BREAKING CHANGE: 旧参数不再接受')],
        }));
        expect(footer.level).toBe('major');
    });

    it('删除技能模板 / CLI 命令模块 → major', () => {
        const analysis = analyzeVersionBump('1.2.3', changeSet({
            commits: [commit('chore: 清理')],
            files: [
                { path: 'src/core/templates/workflows/old.ts', status: 'deleted' },
                { path: 'src/commands/old.ts', status: 'deleted' },
            ],
        }));
        expect(analysis.level).toBe('major');
        expect(analysis.signals.some((s) => s.code === 'skill-template-removed')).toBe(true);
        expect(analysis.signals.some((s) => s.code === 'command-module-removed')).toBe(true);
    });

    it('新增技能模板 / 命令模块 → minor', () => {
        const analysis = analyzeVersionBump('1.2.3', changeSet({
            files: [
                { path: 'src/core/templates/workflows/new.ts', status: 'added' },
                { path: 'src/commands/new.ts', status: 'added' },
            ],
        }));
        expect(analysis.level).toBe('minor');
    });

    it('CLI 注册表增删按差异判定（同名增删视为未变）', () => {
        const added = analyzeVersionBump('1.2.3', changeSet({
            addedLines: { 'src/cli/index.ts': ["    .command('release')"] },
        }));
        expect(added.level).toBe('minor');

        const removed = analyzeVersionBump('1.2.3', changeSet({
            removedLines: { 'src/cli/index.ts': ["    .command('release')"] },
        }));
        expect(removed.level).toBe('major');

        const moved = analyzeVersionBump('1.2.3', changeSet({
            addedLines: { 'src/cli/index.ts': ["    .command('release')"] },
            removedLines: { 'src/cli/index.ts': ["    .command('release')"] },
        }));
        expect(moved.level).toBe('patch');
    });

    it('CHANGELOG BREAKING / Added 小节参与判定', () => {
        const breaking = analyzeVersionBump('1.2.3', changeSet({
            unreleasedChangelog: '### BREAKING\n\n- 移除旧参数\n',
        }));
        expect(breaking.level).toBe('major');

        const added = analyzeVersionBump('1.2.3', changeSet({
            unreleasedChangelog: '### Added\n\n- 新增能力\n',
        }));
        expect(added.level).toBe('minor');
    });

    it('Release-Level 尾注覆盖提交类型（取较大者）', () => {
        const declared = analyzeVersionBump('1.2.3', changeSet({
            commits: [commit('fix(cli): 行为调整', 'Release-Level: minor')],
        }));
        expect(declared.declaredLevel).toBe('minor');
        expect(declared.level).toBe('minor');

        const conflict = analyzeVersionBump('1.2.3', changeSet({
            commits: [commit('fix(cli): 行为调整', 'Release-Level: minor')],
            removedLines: { 'src/cli/index.ts': ["    .command('old')"] },
        }));
        expect(conflict.level).toBe('major');
    });

    it('显式等级覆盖自动判定并保留告警', () => {
        const analysis = analyzeVersionBump('1.2.3', changeSet({
            commits: [commit('feat(cli): 新增能力')],
        }), { level: 'patch' });
        expect(analysis.level).toBe('patch');
        expect(analysis.nextVersion).toBe('1.2.4');
        expect(analysis.warnings.join('\n')).toContain('低于实现影响面自动判定');
    });

    it('无信号时默认 patch', () => {
        const analysis = analyzeVersionBump('1.2.3', changeSet());
        expect(analysis.level).toBe('patch');
        expect(analysis.autoLevel).toBe('patch');
    });
});

describe('CHANGELOG 归档', () => {
    const changelog = [
        '# Changelog',
        '',
        '## [Unreleased]',
        '',
        '## [1.0.0] - 2026-01-01',
        '',
        '### Added',
        '',
        '- 初始版本',
        '',
        '[Unreleased]: https://github.com/o/r/compare/v1.0.0...HEAD',
        '[1.0.0]: https://github.com/o/r/releases/tag/v1.0.0',
        '',
    ].join('\n');

    it('提取 Unreleased 正文', () => {
        expect(extractUnreleasedBody(changelog)).toBe('');
        expect(extractUnreleasedBody('## [Unreleased]\n\n- 条目\n\n## [1.0.0]\n')).toBe('- 条目');
    });

    it('归档已有条目并保留空的 Unreleased', () => {
        const content = changelog.replace('## [Unreleased]\n\n## [1.0.0]', '## [Unreleased]\n\n### Fixed\n\n- 修复 A\n\n## [1.0.0]');
        const body = buildChangelogBody({
            unreleasedBody: extractUnreleasedBody(content),
            commits: [],
            fileCount: 1,
            version: '1.1.0',
        });
        const result = updateChangelog({
            content,
            version: '1.1.0',
            previousVersion: '1.0.0',
            date: '2026-02-01',
            body: body.body,
            repositoryUrl: 'https://github.com/o/r',
        });
        expect(result.content).toContain('## [Unreleased]\n\n## [1.1.0] - 2026-02-01');
        expect(result.content).toContain('### Fixed\n\n- 修复 A');
        expect(result.content).toContain('[Unreleased]: https://github.com/o/r/compare/v1.1.0...HEAD');
        expect(result.content).toContain('[1.1.0]: https://github.com/o/r/compare/v1.0.0...v1.1.0');
        expect(result.warnings).toEqual([]);
    });

    it('Unreleased 为空时按提交合成小节', () => {
        const synthesized = buildChangelogBody({
            unreleasedBody: '',
            commits: [commit('feat(cli): 新增命令'), commit('fix(cli): 修复问题')],
            fileCount: 2,
            version: '1.1.0',
        });
        expect(synthesized.synthesized).toBe(true);
        expect(synthesized.body).toContain('### Added');
        expect(synthesized.body).toContain('- **cli**：新增命令');
        expect(synthesized.body).toContain('### Fixed');
        expect(synthesized.warnings.length).toBe(1);
    });

    it('保留原文件行尾（CRLF 不被写坏）', () => {
        const crlf = changelog.replace(/\n/g, '\r\n');
        const result = updateChangelog({
            content: crlf,
            version: '1.1.0',
            previousVersion: '1.0.0',
            date: '2026-02-01',
            body: '### Fixed\n\n- 修复 A',
            repositoryUrl: 'https://github.com/o/r',
        });
        expect(result.content.replace(/\r\n/g, '')).not.toContain('\n');
        expect(result.content).toContain('## [1.1.0] - 2026-02-01');
    });

    it('缺少 Unreleased 小节抛错', () => {
        expect(() => updateChangelog({
            content: '# Changelog\n',
            version: '1.1.0',
            previousVersion: '1.0.0',
            date: '2026-02-01',
            body: '### Changed\n\n- x',
        })).toThrow(/缺少 \[Unreleased\]/);
    });
});

describe('package.json / README 写回', () => {
    it('只替换 version 字段且校验预期版本', () => {
        const content = '{\n  "name": "x",\n  "version": "1.0.0"\n}\n';
        expect(updatePackageVersion(content, '1.0.0', '1.1.0')).toContain('"version": "1.1.0"');
        expect(() => updatePackageVersion(content, '2.0.0', '2.0.1')).toThrow(/不一致/);
    });

    it('只同步明确的版本示例（npx / npm / --version 输出）', () => {
        const readme = [
            'iagent --version    # 输出 1.0.0',
            'npx mi-agent-tools@1.0.0 --version',
            'npm install --save-dev mi-agent-tools@1.0.0',
            '历史版本 1.0.0 不应被改写',
        ].join('\n');
        const result = updateReadmeVersion(readme, '1.0.0', '1.1.0');
        expect(result.replacements).toBe(3);
        expect(result.content).toContain('# 输出 1.1.0');
        expect(result.content).toContain('mi-agent-tools@1.1.0');
        expect(result.content).toContain('历史版本 1.0.0 不应被改写');
    });
});

describe('iagent version 无 Git 回退（显式等级）', () => {
    it('Git 不可用时仍可按 --level 写回', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-version-nogit-'));
        try {
            fs.writeFileSync(
                path.join(root, 'package.json'),
                '{\n  "name": "fixture",\n  "version": "0.1.0"\n}\n',
                'utf8'
            );
            const analyzed = runVersion(root, { level: 'minor' }, false);
            expect(analyzed.analysis.level).toBe('minor');
            expect(analyzed.analysis.nextVersion).toBe('0.2.0');
            expect(analyzed.warnings.join('\n')).toContain('不是 Git 工作区');

            const applied = runVersion(root, { level: 'minor' }, true);
            expect(applied.applied).toBe(true);
            expect(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version).toBe('0.2.0');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('iagent version 端到端（临时 Git 仓库）', () => {
    let root: string;

    /** 执行 git（测试夹具） */
    function git(args: string[]): void {
        execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    }

    /** 初始化仓库并提交 1.0.0 基线 */
    function setupRepo(): void {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-version-'));
        fs.mkdirSync(path.join(root, 'src', 'commands'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'package.json'),
            JSON.stringify(
                {
                    name: 'fixture',
                    version: '1.0.0',
                    repository: { type: 'git', url: 'git+https://github.com/o/r.git' },
                },
                null,
                2
            ) + '\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(root, 'CHANGELOG.md'),
            [
                '# Changelog',
                '',
                '## [Unreleased]',
                '',
                '### Added',
                '',
                '- 新增 version 命令',
                '',
                '[Unreleased]: https://github.com/o/r/compare/v1.0.0...HEAD',
                '',
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            path.join(root, 'README.md'),
            'iagent --version    # 输出 1.0.0\nnpx mi-agent-tools@1.0.0 --version\n',
            'utf8'
        );
        fs.writeFileSync(path.join(root, 'src', 'commands', 'init.ts'), 'export const init = 1;\n', 'utf8');
        git(['init', '-q']);
        git(['config', 'user.email', 'test@example.com']);
        git(['config', 'user.name', 'Test']);
        git(['add', '.']);
        git(['commit', '-q', '-m', 'chore(release): 1.0.0']);
    }

    beforeEach(() => {
        setupRepo();
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('优先以同版本 tag 为基线', () => {
        git(['tag', 'v1.0.0']);
        const empty = runVersion(root, {}, false);
        expect(empty.hasChanges).toBe(false);
        expect(empty.analysis.currentVersion).toBe('1.0.0');
        expect(renderVersionReport(empty)).toContain('待发布变更：无');

        fs.writeFileSync(path.join(root, 'src', 'commands', 'ping.ts'), 'export const ping = 1;\n', 'utf8');
        const analyzed = runVersion(root, {}, false);
        expect(analyzed.analysis.baselineLabel).toBe('tag v1.0.0');
        expect(analyzed.analysis.level).toBe('minor');
    });

    it('按新增命令模块判定 minor 并写回 package.json / CHANGELOG / README', () => {
        fs.writeFileSync(path.join(root, 'src', 'commands', 'ping.ts'), 'export const ping = 1;\n', 'utf8');
        git(['add', '.']);
        git(['commit', '-q', '-m', 'feat(cli): 新增 ping 命令']);

        const analyzed = runVersion(root, {}, false);
        expect(analyzed.analysis.level).toBe('minor');
        expect(analyzed.analysis.nextVersion).toBe('1.1.0');
        expect(analyzed.applied).toBe(false);

        const applied = runVersion(root, {}, true);
        expect(applied.applied).toBe(true);
        expect(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version).toBe('1.1.0');
        expect(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')).toContain('## [1.1.0]');
        expect(fs.readFileSync(path.join(root, 'README.md'), 'utf8')).toContain('# 输出 1.1.0');
    });

    it('显式 --level 覆盖自动判定（Git 不可用也可用）', () => {
        const result = runVersion(root, { level: 'major' }, true);
        expect(result.analysis.nextVersion).toBe('2.0.0');
    });

    it('重复 bump 时拒绝未提交的版本号变更', () => {
        fs.writeFileSync(path.join(root, 'src', 'commands', 'ping.ts'), 'export const ping = 1;\n', 'utf8');
        runVersion(root, {}, true);
        expect(() => runVersion(root, {}, true)).toThrow(/未提交的版本号变更/);
    });

    it('提交版本后无新变更时拒绝递增', () => {
        fs.writeFileSync(path.join(root, 'src', 'commands', 'ping.ts'), 'export const ping = 1;\n', 'utf8');
        runVersion(root, {}, true);
        git(['add', '.']);
        git(['commit', '-q', '-m', 'chore(release): 1.1.0']);
        expect(() => runVersion(root, {}, true)).toThrow(/没有检测到变更/);
    });
});

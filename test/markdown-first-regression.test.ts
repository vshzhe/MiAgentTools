/**
 * Markdown-first 回归锁（markdown-first-artifacts 变更）。
 *
 * 锁定已落地的 Markdown-first 契约：
 *   - spec-driven schema 的 artifact 输出路径均为 OpenSpec Markdown
 *   - 模板/指令正文 MUST NOT 指示渲染 proposal/specs/design MD
 *   - instructions 输出不再包含 jsonTemplate 字段
 */

import { describe, expect, it } from 'vitest';
import { SPEC_DRIVEN_SCHEMA } from '../src/core/spec/schema.js';
import { getArtifactInstructions } from '../src/core/spec/instructions.js';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

describe('Markdown-first 回归锁', () => {
    it('schema 的 artifact 输出路径为 OpenSpec Markdown', () => {
        const byId = new Map(SPEC_DRIVEN_SCHEMA.artifacts.map((a) => [a.id, a.outputPath]));
        expect(byId.get('proposal')).toBe('proposal.md');
        expect(byId.get('design')).toBe('design.md');
        expect(byId.get('specs')).toBe('specs/**/*.md');
        expect(byId.get('tasks')).toBe('tasks.md');
        expect(SPEC_DRIVEN_SCHEMA.apply.tracks).toBe('tasks.md');
    });

    it('模板/指令正文 MUST NOT 指示渲染 proposal/specs/design MD', () => {
        const bodies = [
            ...getSkillTemplates().map((entry) => entry.template.instructions),
            ...getCommandTemplates().map((entry) => entry.template.content),
        ];
        for (const body of bodies) {
            expect(body).not.toMatch(/iagent spec render (proposal|specs|design)/);
            expect(body).not.toMatch(/spec render <type>/);
        }
    });

    it('编排技能正文不含新变更 JSON-first 生成路径', () => {
        const names = ['iagent_workflow', 'iagent_auto_workflow', 'iagent_debug', 'iagent_proposal_review'];
        const byName = new Map(getSkillTemplates().map((entry) => [entry.template.name, entry.template.instructions]));
        for (const name of names) {
            const body = byName.get(name);
            expect(body, `${name} 未注册`).toBeDefined();
            expect(body, name).not.toMatch(/write the JSON truth source/i);
            expect(body, name).not.toMatch(/JSON-first protocol/i);
            expect(body, name).not.toMatch(/iagent spec render <artifact-id>/);
            expect(body, name).toContain('Markdown');
        }
    });

    it('spec-apply 声明 handoff 包且任务状态直接写 tasks.md', () => {
        const apply = getSkillTemplates().find((entry) => entry.template.name === 'iagent_spec_apply');
        const applyText = `${apply?.template.instructions ?? ''}\n${(apply?.template.references ?? [])
            .map((r) => r.content)
            .join('\n')}`;
        expect(applyText).toContain('handoff-pack.md');
        expect(applyText).not.toContain('context-pack.md');
        expect(applyText).toContain('以 tasks.md 的勾选框为唯一权威');
    });

    it('instructions 输出不含 jsonTemplate 字段', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-md-lock-'));
        try {
            const changeDir = path.join(root, 'openspec', 'changes', 'demo');
            fs.mkdirSync(changeDir, { recursive: true });
            const info = getArtifactInstructions(root, 'demo', 'proposal');
            expect('jsonTemplate' in info).toBe(false);
            expect(info.outputPath).toBe('proposal.md');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('全模板无 JSON 写动词残留（legacy 只读白名单外）', () => {
        const WRITE = /\b(sync|write|re-?render|update|create)\b/i;
        const ARTIFACT = /(tasks\.json|change\.json)/;
        const LEGACY = /legacy|历史|只读|read-only|WARN|降级|迁移|do not|MUST NOT|禁止|avoid|不创建|不更新/i;
        const bodies = [
            ...getSkillTemplates().flatMap(({ template }) => [
                { name: `${template.name}/skill`, body: template.instructions },
                ...(template.references ?? []).map((r) => ({ name: `${template.name}/${r.path}`, body: r.content })),
            ]),
            ...getCommandTemplates().map(({ template, id }) => ({ name: `${id}/cmd`, body: template.content })),
        ];
        const offenders: string[] = [];
        for (const { name, body } of bodies) {
            for (const line of body.split('\n')) {
                if (ARTIFACT.test(line) && WRITE.test(line) && !LEGACY.test(line)) {
                    offenders.push(`${name}: ${line.trim().slice(0, 120)}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    // 任务 2.15：提案侧无索引依赖（跨变更索引退役后，冲突检测只依赖变更目录内的 delta 文件清单）。
    it('spec-propose 模板与 spec.ts 辅助零索引 API 引用', () => {
        const propose = getSkillTemplates().find((entry) => entry.template.name === 'iagent_spec_propose');
        expect(propose, 'spec-propose 未注册').toBeDefined();
        const proposeText = [
            propose?.template.instructions ?? '',
            ...(propose?.template.references ?? []).map((ref) => ref.content),
        ].join('\n');
        for (const forbidden of ['index.db', 'indexChangeJsonEntry', 'exploration_memory', 'sqlite3']) {
            expect(proposeText, `spec-propose 仍引用 ${forbidden}`).not.toContain(forbidden);
        }
        // 冲突判断只依赖变更目录内的 delta 文件清单（specs/<capability>/spec.md）
        expect(proposeText).toContain('specs/<capability>/spec.md');

        const specSource = fs.readFileSync(
            fileURLToPath(new URL('../src/commands/spec.ts', import.meta.url)),
            'utf8'
        );
        for (const forbidden of ['index.db', 'indexChangeJsonEntry', 'INDEX_DB_PATH', 'reindex']) {
            expect(specSource, `spec.ts 仍引用 ${forbidden}`).not.toContain(forbidden);
        }
    });

    // 任务 3.3：openspec 变更制品的纳管规则链（父目录排除语义下 `!` 才能生效）
    it('.gitignore 采用「openspec/* → !openspec/changes/ → 逐个排除缓存」规则链', () => {
        const gitignore = fs.readFileSync(fileURLToPath(new URL('../.gitignore', import.meta.url)), 'utf8');
        const wildcard = gitignore.search(/^openspec\/\*$/m);
        const allow = gitignore.search(/^!openspec\/changes\/$/m);
        expect(wildcard).toBeGreaterThanOrEqual(0);
        expect(allow).toBeGreaterThan(wildcard);
        // MUST NOT 保留整目录排除（否则 `!` 放行无效）
        expect(gitignore).not.toMatch(/^openspec\/$/m);
        // 缓存与附件逐个再排除
        expect(gitignore).toMatch(/^openspec\/changes\/archive\/\.iagent\/$/m);
        expect(gitignore).toMatch(/^openspec\/changes\/\*\*\/attachments\/$/m);
        // 流程级临时工作区仍忽略
        expect(gitignore).toMatch(/^\.openspec-tmp\/$/m);
    });

    // 任务 7.5：索引移除彻底性回归锁（精确白名单，MUST NOT 用宽前缀放过整个 src/）。
    it('src/** 与 skills/** 零 reindex / index.db / sqlite3 / sql.js / INDEX_DB_PATH 残留', () => {
        const repoRoot = fileURLToPath(new URL('..', import.meta.url));
        /** 精确白名单：仅旧装机迁移的旧品牌常量与升级说明 */
        const ALLOWED = new Set([
            'src/core/legacy-migration.ts', // LEGACY_INDEX_DB_FILE = 'index.db'（旧品牌缓存清理）
            'src/core/legacy-migration.ts'.replaceAll('/', '\\'),
        ]);
        const FORBIDDEN = [/reindex/, /index\.db/, /sqlite3/, /sql\.js/, /INDEX_DB_PATH/];
        const offenders: string[] = [];

        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!/\.(ts|js|md|json)$/.test(entry.name)) {
                    continue;
                }
                const rel = path
                    .relative(repoRoot, full)
                    .replaceAll('\\', '/');
                if (ALLOWED.has(rel)) {
                    continue;
                }
                const text = fs.readFileSync(full, 'utf8');
                for (const pattern of FORBIDDEN) {
                    if (pattern.test(text)) {
                        offenders.push(`${rel} → ${pattern}`);
                    }
                }
            }
        };
        walk(path.join(repoRoot, 'src'));
        walk(path.join(repoRoot, 'skills'));
        expect(offenders).toEqual([]);
    });

    // 任务 7.5 补强（spec-workflow-cli / 「reindex 子命令已移除」）：sqlite-index 同属退役字样。
    it('退役字样 sqlite-index 在 src/** 与 skills/** 零残留', () => {
        const repoRoot = fileURLToPath(new URL('..', import.meta.url));
        const offenders: string[] = [];
        let scanned = 0;

        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!/\.(ts|js|md|json)$/.test(entry.name)) {
                    continue;
                }
                scanned++;
                const rel = path.relative(repoRoot, full).replaceAll('\\', '/');
                // 白名单：仅旧装机迁移文件（精确路径，MUST NOT 用宽前缀放过整个 src/）
                if (rel === 'src/core/legacy-migration.ts') {
                    continue;
                }
                if (/sqlite-index/i.test(fs.readFileSync(full, 'utf8'))) {
                    offenders.push(rel);
                }
            }
        };

        walk(path.join(repoRoot, 'src'));
        walk(path.join(repoRoot, 'skills'));

        expect(offenders).toEqual([]);
        // 扫描面非空证明：确实遍历了 src/ 与 skills/ 下的文件
        expect(scanned).toBeGreaterThan(50);
    });

    // spec-workflow-cli / 「调用已移除的子命令报错」：退出码非零，不得静默成功。
    it('iagent spec reindex 以非零退出码失败并提示未知子命令', () => {
        const repoRoot = fileURLToPath(new URL('..', import.meta.url));
        const bin = path.join(repoRoot, 'bin', 'iagent.js');

        const result = spawnSync(process.execPath, [bin, 'spec', 'reindex'], { encoding: 'utf8' });

        expect(result.status).toBe(1);
        const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
        expect(output).toContain("unknown command 'reindex'");
        // 未执行任何索引重建（输出中不得出现索引命令的行为行）
        expect(output).not.toContain('索引已重建');
    });

    // commit-push-skill / 「openspec 变更制品的纳管策略」+「Git 提交技能的提案制品纳入」：
    // 规则链用真实 git 判定（文本顺序断言不足以证明 `!` 在父目录排除下仍然生效）。
    it('.gitignore 规则链在临时 git 仓库中实测：changes 制品放行、缓存与工作区排除', () => {
        const repoRoot = fileURLToPath(new URL('..', import.meta.url));
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-gitignore-'));
        try {
            const source = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
            fs.writeFileSync(path.join(root, '.gitignore'), source, 'utf8');
            execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });

            /** git check-ignore -v：0 = 被忽略（输出命中规则行），1 = 未忽略 */
            const check = (relPath: string): { status: number | null; rule: string } => {
                const result = spawnSync('git', ['check-ignore', '--no-index', '-v', relPath], {
                    cwd: root,
                    encoding: 'utf8',
                });
                return {
                    status: result.status,
                    rule: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
                };
            };

            // 放行：变更制品（含 specs 子树）不进入忽略面
            for (const allowed of [
                'openspec/changes/x/proposal.md',
                'openspec/changes/x/specs/demo/spec.md',
                'openspec/changes/x/tasks.md',
            ]) {
                const { status } = check(allowed);
                expect(status, `${allowed} 不应被忽略`).toBe(1);
            }

            // 排除：主规格 / 探索 / 附件 / 归档缓存 / 流程级工作区
            const ignored: [string, string][] = [
                ['openspec/specs/demo/spec.md', 'openspec/*'],
                ['openspec/explorations/x.md', 'openspec/*'],
                ['openspec/changes/x/attachments/a.png', 'attachments'],
                ['openspec/changes/archive/.iagent/scan.json', 'archive/.iagent'],
                ['.openspec-tmp/pipeline-x/handoff-pack.md', '.openspec-tmp/'],
            ];
            for (const [relPath, ruleHint] of ignored) {
                const { status, rule } = check(relPath);
                expect(status, `${relPath} 应被忽略`).toBe(0);
                expect(rule, `${relPath} 命中规则不符`).toContain(ruleHint);
            }
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    // spec-workflow-skills / 「spec-apply 派发协议与共享资源协议」+ migration-skills：
    // 指令版（派生产物）必须同样承载 handoff 包的路径与只读 + 追加语义，且旧 context-pack 口径零残留。
    // 注：spec-apply 的「只读消费 + 只追加」细则位于 references/batch-scheduling.md（派生产物只含主正文），
    // 故追加语义在指令版仅对 propose / verify / archive 断言；apply 的追加语义由技能版用例覆盖。
    it('handoff 包在 propose/verify/apply/archive 四类指令版中出现，verify/archive 保留只读 + 追加语义', () => {
        const commands = new Map(getCommandTemplates().map((entry) => [entry.id, entry.template.content]));
        for (const id of ['spec-propose', 'spec-verify', 'spec-apply', 'spec-archive']) {
            const body = commands.get(id);
            expect(body, `指令 ${id} 未注册`).toBeDefined();
            expect(body, `${id} 未引用 handoff 包`).toContain('handoff-pack.md');
            expect(body, `${id} 未使用流程级工作区路径`).toContain('.openspec-tmp/pipeline-<change-name>/');
        }
        for (const id of ['spec-propose', 'spec-verify', 'spec-archive']) {
            expect(commands.get(id), `${id} 未声明阶段结论追加`).toContain('## 阶段结论');
            expect(commands.get(id), `${id} 未禁止重产整包`).toContain('MUST NOT 重产整包');
        }
        // verify / archive 只读消费（propose 是唯一产出方）
        for (const id of ['spec-verify', 'spec-archive']) {
            expect(commands.get(id), `${id} 未声明只读消费`).toContain('只读');
        }
    });

    it('模板与生成快照零 context-pack 正向路径（历史文档/归档不计入产品面）', () => {
        const repoRoot = fileURLToPath(new URL('..', import.meta.url));
        const corpus = [
            ...getSkillTemplates().flatMap(({ template }) => [
                template.instructions,
                ...(template.references ?? []).map((ref) => ref.content),
            ]),
            ...getCommandTemplates().map((entry) => entry.template.content),
        ].join('\n');
        expect(corpus).not.toContain('context-pack');

        const offenders: string[] = [];
        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!entry.name.endsWith('.md')) {
                    continue;
                }
                if (fs.readFileSync(full, 'utf8').includes('context-pack')) {
                    offenders.push(path.relative(repoRoot, full).replaceAll('\\', '/'));
                }
            }
        };
        walk(path.join(repoRoot, 'skills'));
        expect(offenders).toEqual([]);
    });
});

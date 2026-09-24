/**
 * allowed-tools 白名单覆盖性测试。
 *
 * 防止回归：技能正文声明的命令必须在 allowed-tools 白名单中，
 * 否则技能在 Claude Code 中会被权限拦截而无法执行。
 *
 * 含两层检查：
 *   1. 硬断言（拦截）：逐技能硬编码的关键命令覆盖（pwd/git/venus/codegraph 等）
 *   2. 一致性扫描（仅告警不拦截）：扫描全部技能正文（instructions + 非脚本类 references）
 *      与白名单比对，缺失项以 console.warn 输出，供人工判断后补录。
 *      不作为失败拦截——存量技能存在历史缺口，避免阻断无关改动；且不同语言构建命令
 *      （mvn/gradle/go/cargo）常按语言在运行期选用，不宜硬性要求全量列入。
 *      已知误报类（告警需人工判断）：① 正文转述脚本体行为，如「auto-package.sh 会 `rm -rf`」；
 *      ② build.xml/XML 片段中的元素名；③ 纯示例性命令而非技能实际执行路径。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/index.js';

describe('allowed-tools 白名单覆盖', () => {
    const skills = getSkillTemplates();

    it('每个技能都声明了非空 allowedTools', () => {
        for (const { template } of skills) {
            expect(template.allowedTools.length).toBeGreaterThan(0);
        }
    });

    it('pwd 技能白名单包含 pwd 命令', () => {
        const pwd = skills.find((s) => s.template.name === 'venus_tr_tools_pwd');
        expect(pwd?.template.allowedTools).toContain('Bash(pwd');
    });

    it('commit 技能白名单覆盖 git status/diff/commit', () => {
        const commit = skills.find((s) => s.template.name === 'venus_tr_commit_change');
        const tools = commit?.template.allowedTools ?? '';
        expect(tools).toContain('Bash(git status');
        expect(tools).toContain('Bash(git diff');
        expect(tools).toContain('Bash(git commit');
    });

    it('init 技能白名单包含 ls 探查命令', () => {
        const init = skills.find((s) => s.template.name === 'venus_tr_init_project');
        expect(init?.template.allowedTools).toContain('Bash(ls');
    });

    it('list 技能白名单包含 venus CLI', () => {
        const list = skills.find((s) => s.template.name === 'venus_tr_tools_list');
        expect(list?.template.allowedTools).toContain('Bash(venus');
    });

    it('工作流套件五新技能白名单包含 venus CLI', () => {
        const names = [
            'venus_tr_impl_workflow',
            'venus_tr_impl_auto_workflow',
            'venus_tr_impl_debug',
            'venus_tr_docs_requirement_doc',
            'venus_tr_impl_review_proposal',
        ];
        for (const name of names) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill?.template.allowedTools.length).toBeGreaterThan(0);
            expect(skill?.template.allowedTools).toContain('Bash(venus');
        }
    });

    it('debug 技能白名单覆盖编译检查命令', () => {
        const debug = skills.find((s) => s.template.name === 'venus_tr_impl_debug');
        const tools = debug?.template.allowedTools ?? '';
        expect(tools).toContain('Bash(pnpm:');
        expect(tools).toContain('Bash(git:');
        expect(tools).toContain('Bash(codegraph:');
    });

    it('生成的 SKILL.md 中 allowed-tools 与模板一致', async () => {
        const { generateSkillContent } = await import('../src/core/command-generation/index.js');
        for (const { template } of skills) {
            const generated = generateSkillContent(template, 'test');
            expect(generated.fileContent).toContain(`allowed-tools: ${template.allowedTools}`);
        }
    });

    it('迁移套件三新技能 allowedTools 非空且包含 CodeGraph', () => {
        const names = [
            'venus_tr_impl_migration_check',
            'venus_tr_impl_auto_migration',
            'venus_tr_docs_feature_doc',
        ];
        for (const name of names) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill?.template.allowedTools.length).toBeGreaterThan(0);
            expect(skill?.template.allowedTools).toContain('Bash(codegraph:*)');
        }
    });

    it('auto-migration 技能白名单包含 venus CLI', () => {
        const auto = skills.find((s) => s.template.name === 'venus_tr_impl_auto_migration');
        expect(auto?.template.allowedTools).toContain('Bash(venus');
    });

    // —— 一致性扫描（仅告警，不拦截） ——

    /** 命令词表：行内反引号中只认词表内命令，避免把 return/if/participant 之类当命令 */
    const SCAN_VOCAB = new Set(
        (
            'bash sh zsh svn git hg pnpm npm yarn npx node tsc mvn gradle go cargo make ' +
            'python python3 pip java javac jar ant cat ls cp mv rm mkdir rmdir find grep sed awk xargs diff ' +
            'curl wget unzip zip tar gzip md5sum sha256sum echo printf tee head tail sort uniq wc tr cut ' +
            'venus codegraph docker kubectl ps tasklist where which chmod touch'
        ).split(/\s+/)
    );

    /** shell 控制关键字：出现在 ```bash 块内但不是「要执行的命令」 */
    const SHELL_KEYWORDS = new Set(
        (
            'if then else elif fi for while do done case esac function return exit local ' +
            'export set unset source break continue read test time eval trap shift ulimit umask wait jobs alias'
        ).split(/\s+/)
    );

    /** 排除关键字、MCP 工具名（mcp__xxx）、文件名/路径（含点号或斜杠）后的候选命令 */
    function isCandidateCommand(token: string): boolean {
        return (
            /^[a-z][a-z0-9_-]*$/.test(token) &&
            !SHELL_KEYWORDS.has(token) &&
            !token.includes('__') &&
            !token.startsWith('mcp')
        );
    }

    /** 抽取候选命令：tagged shell 代码块取行首 token + 行内反引号取词表内且后接参数的 token */
    function extractCommands(text: string): Set<string> {
        const found = new Set<string>();
        for (const block of text.matchAll(/```([a-zA-Z]*)\n([\s\S]*?)```/g)) {
            if (!/^(bash|sh|shell|console|cmd|powershell|bat)$/i.test(block[1])) {
                continue;
            }
            for (const raw of block[2].split('\n')) {
                const line = raw.trim();
                if (!line || line.startsWith('#')) {
                    continue;
                }
                const token = line.split(/\s+/)[0];
                if (isCandidateCommand(token)) {
                    found.add(token);
                }
            }
        }
        for (const inline of text.matchAll(/`([^`\n]+)`/g)) {
            const parts = inline[1].trim().split(/\s+/);
            if (parts.length < 2 || !SCAN_VOCAB.has(parts[0])) {
                continue;
            }
            // 后接参数（flag/路径/占位符）才认作命令，避免把散文中提到的单词当命令
            if (!/^[-<a-zA-Z0-9/._$]/.test(parts[1])) {
                continue;
            }
            found.add(parts[0]);
        }
        return found;
    }

    it('扫描正文命令 vs 白名单：缺失仅告警，不拦截', () => {
        const findings: string[] = [];
        for (const { template, commandId } of skills) {
            // Bash(*) 为全量 Bash 授权，无需逐命令比对
            if (/Bash\(\*\)/.test(template.allowedTools ?? '')) {
                continue;
            }
            // 指令正文 + 参考文件；.sh/.bat/.ps1 脚本体由 Bash(bash:*) 覆盖，跳过
            const sources = [template.instructions];
            for (const ref of template.references ?? []) {
                if (/\.(sh|bat|ps1)$/i.test(ref.path)) {
                    continue;
                }
                sources.push(ref.content);
            }
            const declared = new Set(
                [...(template.allowedTools ?? '').matchAll(/Bash\(([a-zA-Z0-9_.-]+)/g)].map(
                    (m) => m[1]
                )
            );
            const missing = new Set<string>();
            for (const source of sources) {
                for (const cmd of extractCommands(source)) {
                    if (!declared.has(cmd)) {
                        missing.add(cmd);
                    }
                }
            }
            if (missing.size > 0) {
                findings.push(`${commandId} → 缺 [${[...missing].sort().join(', ')}]`);
            }
        }

        if (findings.length > 0) {
            console.warn(
                `\n[allowed-tools 扫描告警] ${findings.length} 个技能的正文命令未列入白名单` +
                    `（仅提示，不拦截）：\n` +
                    findings.map((f) => `  - ${f}`).join('\n') +
                    `\n  处理建议：确认该命令是否由技能实际执行——是则补进 allowedTools，` +
                    `否则收窄扫描词表。\n`
            );
        }

        // 扫描器可用性断言：避免抽取逻辑静默失效（命中数为 0 时不报错）
        expect(skills.length).toBeGreaterThan(0);
        expect([...extractCommands('```bash\nsvn info -r HEAD\n```')]).toContain('svn');
        expect([...extractCommands('先用 `javac -encoding UTF-8 foo.java` 复现')]).toContain('javac');
        expect([...extractCommands('```java\npublic class Foo {}\n```')]).toHaveLength(0);
    });
});

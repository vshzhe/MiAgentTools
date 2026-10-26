/**
 * allowed-tools 白名单覆盖性测试。
 *
 * 防止回归：技能正文声明的命令必须在 allowed-tools 白名单中，
 * 否则技能在 Claude Code 中会被权限拦截而无法执行。
 *
 * 含两层检查：
 *   1. 硬断言（拦截）：逐技能硬编码的关键命令覆盖（pwd/git/iagent/codegraph 等）
 *   2. 一致性扫描（仅告警不拦截）：扫描全部技能正文（instructions + 非脚本类 references）
 *      与白名单比对，缺失项以 console.warn 输出，供人工判断后补录。
 *      不作为失败拦截——存量技能存在历史缺口，避免阻断无关改动；且不同语言构建命令
 *      （mvn/gradle/go/cargo）常按语言在运行期选用，不宜硬性要求全量列入。
 *      已知误报类（告警需人工判断）：① 正文转述脚本体行为，如「auto-package.sh 会 `rm -rf`」；
 *      ② build.xml/XML 片段中的元素名；③ 纯示例性命令而非技能实际执行路径。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates, getCommandTemplates } from '../src/core/templates/index.js';
import {
    CONDITIONAL_DELEGATIONS,
    ORCHESTRATION_DELEGATIONS,
} from '../src/core/host-orchestration/index.js';
import { CODEGRAPH_CLI } from '../src/core/templates/tool-whitelist.js';

describe('allowed-tools 白名单覆盖', () => {
    const skills = getSkillTemplates();

    it('每个技能都声明了非空 allowedTools', () => {
        for (const { template } of skills) {
            expect(template.allowedTools.length).toBeGreaterThan(0);
        }
    });

    it('commit 技能白名单覆盖 git status/diff/commit', () => {
        const commit = skills.find((s) => s.template.name === 'iagent_commit');
        const tools = commit?.template.allowedTools ?? '';
        expect(tools).toContain('Bash(git status');
        expect(tools).toContain('Bash(git diff');
        expect(tools).toContain('Bash(git commit');
    });

    it('init 技能白名单包含 ls 探查命令', () => {
        const init = skills.find((s) => s.template.name === 'iagent_project_init');
        expect(init?.template.allowedTools).toContain('Bash(ls');
    });

    it('工作流套件五新技能白名单包含 iagent CLI', () => {
        const names = [
            'iagent_workflow',
            'iagent_auto_workflow',
            'iagent_debug',
            'iagent_requirement_doc',
            'iagent_proposal_review',
        ];
        for (const name of names) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill?.template.allowedTools.length).toBeGreaterThan(0);
            expect(skill?.template.allowedTools).toContain('Bash(iagent');
        }
    });

    it('debug 技能白名单覆盖编译检查命令', () => {
        const debug = skills.find((s) => s.template.name === 'iagent_debug');
        const tools = debug?.template.allowedTools ?? '';
        expect(tools).toContain('Bash(pnpm:');
        expect(tools).toContain('Bash(git:');
        expect(tools).toContain('mcp__codegraph');
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
            'iagent_migration_check',
            'iagent_migration',
            'iagent_feature_doc',
        ];
        for (const name of names) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill?.template.allowedTools.length).toBeGreaterThan(0);
            expect(skill?.template.allowedTools).toContain('mcp__codegraph');
        }
    });

    it('auto-migration 技能白名单包含 iagent CLI', () => {
        const auto = skills.find((s) => s.template.name === 'iagent_migration');
        expect(auto?.template.allowedTools).toContain('Bash(iagent');
    });

    // —— 一致性扫描（仅告警，不拦截） ——

    /** 命令词表：行内反引号中只认词表内命令，避免把 return/if/participant 之类当命令 */
    const SCAN_VOCAB = new Set(
        (
            'bash sh zsh svn git hg pnpm npm yarn npx node tsc mvn gradle go cargo make ' +
            'python python3 pip java javac jar ant cat ls cp mv rm mkdir rmdir find grep sed awk xargs diff ' +
            'curl wget unzip zip tar gzip md5sum sha256sum echo printf tee head tail sort uniq wc tr cut ' +
            'iagent codegraph docker kubectl ps tasklist where which chmod touch'
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

describe('调用类白名单条目（MCP / Skill 委派 / 子代理派发）', () => {
    const skills = getSkillTemplates();
    const registeredSkillNames = new Set(skills.map((s) => s.template.name));

    /** CodeGraph MCP 期望条目：裸服务器形式 + 9 个具名工具（共 10 条） */
    const CODEGRAPH_MCP_ENTRIES = [
        'mcp__codegraph',
        'mcp__codegraph__codegraph_status',
        'mcp__codegraph__codegraph_files',
        'mcp__codegraph__codegraph_search',
        'mcp__codegraph__codegraph_context',
        'mcp__codegraph__codegraph_node',
        'mcp__codegraph__codegraph_callers',
        'mcp__codegraph__codegraph_callees',
        'mcp__codegraph__codegraph_impact',
        'mcp__codegraph__codegraph_explore',
    ];

    /** 抽取白名单条目（逗号分隔 + trim），供精确的整条目断言 */
    function parseEntries(allowedTools: string): string[] {
        return allowedTools
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    }

    /** 断言判据：白名单含全部 CodeGraph MCP 条目 */
    function expectCodegraphEntries(skill: { name: string; allowedTools: string }): void {
        const entries = parseEntries(skill.allowedTools);
        for (const required of CODEGRAPH_MCP_ENTRIES) {
            expect(entries, `${skill.name} 缺少 CodeGraph MCP 条目 ${required}`).toContain(required);
        }
    }

    /** 断言判据：子代理派发条目双写（Agent 与 Task 必须成对出现） */
    function expectSubagentDispatchPaired(skill: { name: string; allowedTools: string }): void {
        const entries = parseEntries(skill.allowedTools);
        expect(
            entries.includes('Agent'),
            `${skill.name} 的 Agent / Task 派发条目未成对写入`
        ).toBe(entries.includes('Task'));
    }

    it('正文用 CodeGraph 或白名单含 MCP CodeGraph 条目的技能，均含裸服务器与 9 个具名工具', () => {
        const derived = skills.filter(
            ({ template }) => /codegraph_/.test(template.instructions) || parseEntries(template.allowedTools).includes('mcp__codegraph')
        );
        // 判据自检：命中数不得为 0，否则断言静默空转
        // 10 = 既有 11 项 - full-workflow（已并入 workflow）
        expect(derived.length).toBe(10);
        for (const { template } of derived) {
            expectCodegraphEntries(template);
        }
        // 反向：含 MCP 条目的技能集合与判据集合完全一致（无未经正文核准的授权）
        const declared = skills.filter(({ template }) =>
            parseEntries(template.allowedTools).includes('mcp__codegraph')
        );
        expect(declared.map((s) => s.commandId).sort()).toEqual(derived.map((s) => s.commandId).sort());
    });

    it('判据拦截力：白名单缺失任一 CodeGraph 条目即判定失败', () => {
        // 缺失具名工具条目（仅保留 CLI 形态）→ 判据必须失败
        expect(() =>
            expectCodegraphEntries({ name: 'iagent_fake', allowedTools: 'Read, Bash(codegraph:*)' })
        ).toThrow();
        // 缺失裸服务器条目 → 判据必须失败
        expect(() =>
            expectCodegraphEntries({
                name: 'iagent_fake',
                allowedTools: CODEGRAPH_MCP_ENTRIES.slice(1).join(', '),
            })
        ).toThrow();
    });

    it('经 Skill 工具委派的技能，白名单含对应 Skill(iagent_xxx) 条目且正文确有提及', () => {
        const delegating = skills.filter(({ template }) =>
            parseEntries(template.allowedTools).some((entry) => entry.startsWith('Skill('))
        );
        // 委派技能集合（回归锁）：白名单声明委派即意味着该技能正文存在委派动作
        expect(delegating.map((s) => s.commandId).sort()).toEqual([
            'auto-workflow',
            'debug',
            'migration',
            'project-init',
            'spec-apply',
            'spec-archive',
            'spec-bulk-archive',
            'spec-propose',
            'workflow',
        ]);

        for (const { template } of delegating) {
            const delegated = parseEntries(template.allowedTools)
                .filter((entry) => entry.startsWith('Skill('))
                .map((entry) => entry.slice('Skill('.length, -1));
            expect(delegated.length).toBeGreaterThan(0);
            for (const name of delegated) {
                // 委派目标必须是已注册技能（拼错技能名会产生永不放行的死条目）
                expect(registeredSkillNames, `${template.name} 委派了未注册技能 ${name}`).toContain(
                    `iagent_${name}`
                );
                // 且正文必须提及该技能，避免幽灵授权（授权面过宽属安全问题）
                expect(template.instructions, `${template.name} 正文未提及被委派技能 ${name}`).toContain(
                    `iagent_${name}`
                );
            }
            // 不得使用星号通配——授权面过宽
            expect(template.allowedTools).not.toContain('Skill(*)');
        }
    });

    it('正文确有派发的技能含 Agent 与 Task（双写兼容新旧运行时）', () => {
        const dispatching = skills.filter(({ template }) =>
            parseEntries(template.allowedTools).includes('Agent')
        );
        // 派发技能集合（回归锁）：debug 在批次一补齐派发
        expect(dispatching.map((s) => s.commandId).sort()).toEqual([
            'auto-workflow',
            'debug',
            'migration',
            'spec-apply',
            'spec-bulk-archive',
            'spec-propose',
            'workflow',
        ]);
        for (const { template } of dispatching) {
            expectSubagentDispatchPaired(template);
            // 授权派发的前提是正文确有子代理派发动作
            expect(template.instructions).toMatch(/sub-?agent|子代理/i);
        }
    });

    it('判据拦截力：派发条目单写（仅 Agent 或仅 Task）即判定失败', () => {
        expect(() => expectSubagentDispatchPaired({ name: 'iagent_fake', allowedTools: 'Read, Agent' })).toThrow();
        expect(() => expectSubagentDispatchPaired({ name: 'iagent_fake', allowedTools: 'Read, Task' })).toThrow();
    });

    it('全部技能不存在 Skill(*) 星号通配', () => {
        for (const { template } of skills) {
            expect(template.allowedTools, `${template.name} 使用了 Skill(*) 通配`).not.toContain('Skill(*)');
        }
    });

    it('只读技能白名单不含 Write / Edit（只读语义约束维持）', () => {
        for (const name of ['iagent_spec_verify_proposal', 'iagent_spec_verify']) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill, `只读技能 ${name} 未注册`).toBeDefined();
            const entries = parseEntries(skill?.template.allowedTools ?? '');
            expect(entries, `${name} 不应含 Write`).not.toContain('Write');
            expect(entries, `${name} 不应含 Edit`).not.toContain('Edit');
        }
    });

    it('指令白名单与配对技能的白名单全等', () => {
        const commands = getCommandTemplates();
        const skillWhitelist = new Map(skills.map((s) => [s.commandId, s.template.allowedTools]));
        expect(commands.length).toBe(skills.length);
        for (const { template, id } of commands) {
            expect(skillWhitelist.get(id), `指令 ${id} 无配对技能`).toBeDefined();
            // 指令侧回填值 = 配对技能白名单 = 其他技能名（防止回填错位或残留硬编码）
            expect(template.allowedTools).toBe(skillWhitelist.get(id));
            expect(template.allowedTools).not.toBe('Bash(iagent:*)');
        }
    });

    it('全部条目为合法规则串：无空条目、无首尾空白、无重复', () => {
        for (const { template, commandId } of skills) {
            const raw = template.allowedTools;
            expect(raw, `${commandId} 整串带首尾空白`).toBe(raw.trim());
            expect(raw.endsWith(','), `${commandId} 以分隔符结尾`).toBe(false);
            expect(/,\s*,/.test(raw), `${commandId} 存在连续分隔符`).toBe(false);
            const entries = raw.split(',').map((entry) => entry.trim());
            expect(entries.every((entry) => entry.length > 0), `${commandId} 存在空条目`).toBe(true);
            expect(entries.join(', '), `${commandId} 分隔符非规范「逗号 + 空格」`).toBe(raw);
            expect(new Set(entries).size, `${commandId} 存在重复条目`).toBe(entries.length);
        }
    });
});

describe('debug 授权与宿主委派表一致（4.5）', () => {
    const debug = getSkillTemplates().find(({ template }) => template.name === 'iagent_debug')!;

    /** 白名单条目（逗号分隔 + trim） */
    function parseEntries(allowedTools: string): string[] {
        return allowedTools
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    }

    /** 白名单裸名 → canonical workflowId（下划线转连字符） */
    function delegatedTargets(): string[] {
        return parseEntries(debug.template.allowedTools)
            .filter((entry) => entry.startsWith('Skill('))
            .map((entry) => entry.slice('Skill('.length, -1).replaceAll('_', '-'));
    }

    it('白名单与宿主委派表一一对应（无漏项、无幽灵项）', () => {
        expect(delegatedTargets().sort()).toEqual([...ORCHESTRATION_DELEGATIONS.debug].sort());
        expect(ORCHESTRATION_DELEGATIONS.debug).toEqual([
            'spec-verify-proposal',
            'proposal-review',
            'requirement-doc',
            'test',
        ]);
    });

    it('每个委派目标在正文确有调用动作（授权面由真实委派支撑）', () => {
        for (const target of ORCHESTRATION_DELEGATIONS.debug) {
            const templateName = `iagent_${target.replaceAll('-', '_')}`;
            expect(
                debug.template.instructions,
                `debug 正文未提及被委派技能 ${templateName}`
            ).toContain(templateName);
        }
    });

    it('条件委派集合仅含声明降级路径的目标；必需委派不得归入条件委派', () => {
        expect(CONDITIONAL_DELEGATIONS.debug).toContain('test');
        expect(CONDITIONAL_DELEGATIONS.debug).toContain('proposal-review');
        // spec-verify-proposal / requirement-doc 由 DEPS 随装且正文无降级路径 → 无条件必需委派
        expect(CONDITIONAL_DELEGATIONS.debug).not.toContain('spec-verify-proposal');
        expect(CONDITIONAL_DELEGATIONS.debug).not.toContain('requirement-doc');
        // 分类与 DEPS 口径一致：DEPS 覆盖的目标必为无条件必需委派
        for (const dep of ['spec-verify-proposal', 'requirement-doc']) {
            expect(CONDITIONAL_DELEGATIONS.debug, `DEPS 覆盖的 ${dep} 不应是条件委派`).not.toContain(dep);
        }
        expect(debug.template.instructions).toContain('strict 模式无法委派 `iagent_test` 时 SHALL 按能力协商**阻断并报告**');
        expect(debug.template.instructions).toContain('显式协商 degraded 时才允许本地编写');
    });

    it('4.8 debug 含 Agent/Task 派发条目（批次一补齐派发能力）', () => {
        const entries = parseEntries(debug.template.allowedTools);
        expect(entries).toContain('Agent');
        expect(entries).toContain('Task');
        expect(debug.template.allowedTools).not.toContain('Skill(*)');
    });

    it('4.8 宿主委派表未虚增（debug 的派发条目不改变委派目标清单）', () => {
        expect(ORCHESTRATION_DELEGATIONS.debug).toEqual([
            'spec-verify-proposal',
            'proposal-review',
            'requirement-doc',
            'test',
        ]);
    });
});

// 任务 4.8：CodeGraph CLI 条目覆盖 + commit 提案制品断言。
describe('4.8 CodeGraph CLI 条目与 commit 提案制品', () => {
    const skills = getSkillTemplates();

    /** 正文确有 CLI 调用、MUST 具备 CODEGRAPH_CLI 的技能 */
    const CLI_SKILLS = [
        'iagent_spec_archive',
        'iagent_spec_bulk_archive',
        'iagent_spec_explore',
        'iagent_debug',
        'iagent_project_init',
    ];

    it('归档 / 探索 / 调试 / 初始化技能含 Bash(codegraph:*)', () => {
        for (const name of CLI_SKILLS) {
            const skill = skills.find((s) => s.template.name === name);
            expect(skill, `${name} 未注册`).toBeDefined();
            const entries = (skill?.template.allowedTools ?? '').split(',').map((e) => e.trim());
            expect(entries, `${name} 缺少 CODEGRAPH_CLI`).toContain(CODEGRAPH_CLI);
            // MCP 条目不被 CLI 条目替代
            expect(entries).toContain('mcp__codegraph');
        }
    });

    it('migration 不跑 CLI：不含 Bash(codegraph:*) 且渲染无 codegraph status', () => {
        const migration = skills.find((s) => s.template.name === 'iagent_migration');
        expect(migration?.template.allowedTools).not.toContain('Bash(codegraph:*)');
        expect(migration?.template.instructions).not.toContain('codegraph status');
    });

    it('commit 正文声明提案制品纳入 + 尾行溯源 + 人工闸', () => {
        const commit = skills.find((s) => s.template.name === 'iagent_commit');
        const body = commit?.template.instructions ?? '';
        expect(body).toContain('提案制品纳入');
        expect(body).toContain('提案: <change-name>');
        expect(body).toContain('MUST NOT 使用 `git add -A`');
        expect(body).toContain('MUST NOT 自动 commit');
        expect(body).toContain('确认后再执行');
        // 不新增未使用的授权（git 命令面保持既有）
        const entries = (commit?.template.allowedTools ?? '').split(',').map((e) => e.trim());
        expect(entries.filter((e) => e.startsWith('Bash('))).toEqual([
            'Bash(git status:*)',
            'Bash(git diff:*)',
            'Bash(git add:*)',
            'Bash(git commit:*)',
            'Bash(git log:*)',
        ]);
    });

    // commit-push-skill / 「Git 提交技能的提案制品纳入」：暂存范围必须逐条精确，排除附件与人工评审产物。
    it('提案制品固定清单逐条精确暂存：排除 attachments 与需求文档，禁目录级 add', () => {
        const commit = skills.find((s) => s.template.name === 'iagent_commit');
        const body = commit?.template.instructions ?? '';

        // 正向：逐条精确暂存（非目录级 / 非通配）
        expect(body).toContain('git add <files>');
        expect(body).toContain('proposal.md');
        expect(body).toContain('specs/**/*.md');
        // 负向：附件与人工评审产物不入默认清单
        expect(body).toContain('attachments/**');
        expect(body).toContain('需求文档.md');
        // 禁目录级批量暂存（三个禁用形态逐字列出）
        expect(body).toContain(
            'MUST NOT 使用 `git add -A` / `git add openspec` / `git add openspec/changes`'
        );
        // 0 个活跃变更时不得附加空溯源尾行
        expect(body).toContain('MUST NOT 附加 `提案:` 尾行');
    });
});

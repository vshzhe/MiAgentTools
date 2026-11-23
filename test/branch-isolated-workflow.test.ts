/**
 * branch-isolated-workflow：四类技能的分支生命周期一致性。
 *
 * 覆盖能力 `branch-isolated-workflow` 的全部 Scenario（跨模板断言）。
 * 断言面向「生成后的正文」，因此改动模板措辞时这里会立即失败。
 */

import { describe, it, expect } from 'vitest';
import { getSkillTemplates } from '../src/core/templates/registry.js';
import { BRANCH_STATE_SECTION } from '../src/core/templates/branch-isolation.js';
import { GATE_WHITELIST, GATE_WHITELIST_ANCHORS } from '../src/core/host-orchestration/protocol.js';
import { GATE_SKIP_IDS } from '../src/core/host-orchestration/delegation-contract.js';

function skillOf(name: string) {
    const found = getSkillTemplates().find(({ template }) => template.name === name);
    if (found === undefined) throw new Error(`缺少模板：${name}`);
    return found.template;
}

/** 主文件 + references 合并文本（分支协议正文可能下沉 references） */
function fullText(name: string): string {
    const template = skillOf(name);
    return [template.instructions, ...(template.references ?? []).map((ref) => ref.content)].join('\n');
}

const APPLY = 'iagent_spec_apply';
const ARCHIVE = 'iagent_spec_archive';
const DEBUG = 'iagent_debug';
const UPDATE = 'iagent_spec_update';

describe('分支状态载体', () => {
    it('Scenario: apply 创建分支后写入状态（四个字段齐备）', () => {
        const text = fullText(APPLY);
        expect(text).toContain(BRANCH_STATE_SECTION);
        for (const field of ['branch', 'baseBranch', 'branchMode', 'createdAt']) {
            expect(text, `apply 缺字段 ${field}`).toContain(field);
        }
        expect(text).toContain('work-branch');
    });

    it('Scenario: 节缺失视为不分枝（archive / debug / update 均读同一段）', () => {
        for (const name of [ARCHIVE, DEBUG, UPDATE]) {
            const text = fullText(name);
            expect(text, `${name} 未读取分支状态段`).toContain(BRANCH_STATE_SECTION);
            expect(text, `${name} 缺缺失处置`).toMatch(/段缺失|缺失或|跳过并记日志/);
        }
    });
});

describe('apply 分支准入（脏工作区不切换）', () => {
    it('Scenario: 干净工作区创建分支（m-幂等 CLI 调用）', () => {
        const text = fullText(APPLY);
        expect(text).toContain('iagent git branch --create');
        expect(text).toContain('iagent/<change-name>');
    });

    it('Scenario: 脏工作区暂停（三出口 + 禁止自动 stash）', () => {
        const text = fullText(APPLY);
        expect(text).toContain('git status --porcelain');
        expect(text).toContain('MUST NOT 自动 `git stash`');
        expect(text).toContain('MUST NOT 带脏工作区切换分支');
        // 三出口齐备
        for (const exit of ['提交已有改动', 'stash', '取消实现']) {
            expect(text, `apply 缺脏工作区出口：${exit}`).toContain(exit);
        }
    });

    it('Scenario: 无 Git 降级（branchMode=none + WARN，不阻断）', () => {
        const text = fullText(APPLY);
        expect(text).toContain('branchMode=none');
        expect(text).toMatch(/WARN/);
    });
});

describe('apply 分支模式下的实现期提交', () => {
    it('Scenario: 分支模式精确提交（尾行 提案 / 禁 git add -A）', () => {
        const text = fullText(APPLY);
        expect(text).toContain('精确提交到工作分支');
        expect(text).toContain('提案: <change-name>');
        expect(text).toContain('MUST NOT `git add -A`');
    });

    it('Scenario: 非分支模式保持只暂存', () => {
        const text = fullText(APPLY);
        expect(text).toContain('只暂存不提交');
        expect(text).toContain('branchMode=none');
    });

    it('Scenario: 提交失败不阻断', () => {
        expect(fullText(APPLY)).toMatch(/失败记 WARN 不阻断|WARN 不阻断/);
    });

    it('MUST NOT 表述为归档自动提交（实现期提交与归档窄通道区分）', () => {
        expect(fullText(APPLY)).toContain('MUST NOT 表述为归档自动提交');
    });
});

describe('归档合并与合并门', () => {
    it('Scenario: 合并门不可跳过且归 destructive-change', () => {
        const text = fullText(ARCHIVE);
        expect(text).toContain('destructive-change');
        expect(text).toContain('不可被 `gate-skip` 跳过');
        // 门白名单不扩张：合并门未成为独立锚点
        expect(GATE_WHITELIST_ANCHORS).not.toContain('merge-confirmation');
        expect(GATE_SKIP_IDS as readonly string[]).not.toContain('merge');
        expect(GATE_WHITELIST.map((entry) => entry.id)).toEqual([
            'requirement-clarification',
            'flow-final-confirmation',
            'implementation-bridge',
            'archive-confirmation',
            'destructive-change',
        ]);
    });

    it('Scenario: 合并冲突暂停（不 abort / 不丢弃产出）', () => {
        const text = fullText(ARCHIVE);
        expect(text).toMatch(/冲突暂停/);
        expect(text).toContain('MUST NOT abort');
        expect(text).toContain('丢弃产出');
    });

    it('Scenario: 合并成功并删除分支（失败仅 WARN）', () => {
        const text = fullText(ARCHIVE);
        expect(text).toContain('iagent git merge');
        expect(text).toMatch(/删分支|branch --delete/);
        expect(text).toMatch(/失败仅 WARN/);
    });

    it('Scenario: 拒绝合并保留工作', () => {
        expect(fullText(ARCHIVE)).toContain('保留分支与提交');
    });

    it('合并失败 MUST NOT 回滚归档', () => {
        expect(fullText(ARCHIVE)).toContain('合并失败 MUST NOT 回滚归档');
    });
});

describe('debug 与 spec-update 的验证后自动合并', () => {
    for (const [name, label] of [[DEBUG, 'debug'], [UPDATE, 'spec-update']] as const) {
        it(`${label}：验证 PASS 后自动合并并携带 mergeAuthorized`, () => {
            const text = fullText(name);
            expect(text).toContain('合并');
            expect(text).toContain('mergeAuthorized');
            expect(text).toMatch(/验证 PASS/);
        });

        it(`${label}：MUST NOT 写入 ## 已确认门（域外 id）`, () => {
            expect(fullText(name)).toContain('MUST NOT 写 `## 已确认门`');
        });

        it(`${label}：冲突不构成验证失败、不 abort`, () => {
            const text = fullText(name);
            expect(text).toMatch(/冲突暂停/);
            expect(text).toContain('MUST NOT abort');
            expect(text).toContain('不构成验证失败');
        });

        it(`${label}：自动合并不新增用户停点`, () => {
            expect(fullText(name)).toContain('不新增停点');
        });
    }
});

describe('非目标声明', () => {
    it('Scenario: 正文声明非目标（SVN / 自动冲突解决 / bulk-archive）', () => {
        for (const name of [APPLY, ARCHIVE, DEBUG, UPDATE]) {
            const text = fullText(name);
            // 只检查包含分支协议的技能（apply / archive 直接声明；debug / update 经共享 references）
            if (!text.includes('分支隔离')) continue;
            expect(text, `${name} 缺 SVN 非目标`).toMatch(/不覆盖 SVN|SVN 项目/);
        }
    });

    it('apply 与 archive 的 references 含非目标声明全文', () => {
        for (const name of [APPLY, ARCHIVE]) {
            const refs = (skillOf(name).references ?? []).map((ref) => ref.content).join('\n');
            expect(refs, `${name} 缺非目标全文`).toContain('不覆盖 SVN');
            expect(refs, `${name} 缺冲突声明`).toContain('不实现自动冲突解决');
            expect(refs, `${name} 缺 bulk-archive 声明`).toContain('spec-bulk-archive');
        }
    });
});

describe('分支操作工具白名单', () => {
    it('apply / archive 的 allowedTools 含 Bash(git:*)', () => {
        for (const name of [APPLY, ARCHIVE]) {
            expect(skillOf(name).allowedTools, `${name} 缺 git 白名单`).toContain('Bash(git:*)');
        }
    });

    it('分支命令不握有超出 git 子命令的授权', () => {
        for (const name of [APPLY, ARCHIVE, DEBUG, UPDATE]) {
            expect(skillOf(name).allowedTools, `${name} 出现全量 shell`).not.toContain('Bash(*)');
        }
    });
});

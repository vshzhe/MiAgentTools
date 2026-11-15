/**
 * spec-update 技能契约测试（变更 add-spec-update-capability）。
 *
 * 覆盖：注册与派生形态 / 前置阻断 / 归档复活复制 / 双轨根因定位 /
 * 破坏性改动确认门 / 原地改写与修订记录 / 回滚 / 再实现与能力对比 /
 * 四环节顺序与结构化回执 / 依赖注入与旧标识映射表对齐。
 */

import { describe, it, expect } from 'vitest';
import {
    getSkillTemplates,
    getCommandTemplates,
    deriveCommandId,
} from '../src/core/templates/index.js';
import { deriveCommandContent } from '../src/core/templates/derive-command.js';
import { DEFAULT_WORKFLOWS, DEPS, resolveWorkflows } from '../src/core/profiles.js';
import { WORKFLOW_PROTOCOLS } from '../src/core/host-orchestration/workflows.js';
import { GATE_WHITELIST } from '../src/core/host-orchestration/protocol.js';
import {
    CONDITIONAL_DELEGATIONS,
    ORCHESTRATION_DELEGATIONS,
} from '../src/core/host-orchestration/render.js';
import { LEGACY_WORKFLOW_ID_MAP } from '../src/core/legacy-migration.js';
import { SPEC_DRIVEN_SCHEMA } from '../src/core/spec/schema.js';

/** 技能模板（主文件） */
const entry = getSkillTemplates().find(({ template }) => template.name === 'iagent_spec_update');
const skill = entry?.template;
/** 主文件正文 */
const body = skill?.instructions ?? '';
/** 主文件 + references（下沉细则同样是模板契约） */
const corpus = `${body}\n${(skill?.references ?? []).map((ref) => ref.content).join('\n')}`;
/** 配对指令模板 */
const command = getCommandTemplates().find(({ id }) => id === 'spec-update')?.template;

describe('spec-update 注册与派生形态', () => {
    it('技能与指令成对注册，指令 id 派生为 spec-update', () => {
        expect(skill, 'spec-update 技能未注册').toBeDefined();
        expect(command, 'spec-update 指令未注册').toBeDefined();
        expect(deriveCommandId('iagent_spec_update')).toBe('spec-update');
        expect(entry?.commandId).toBe('spec-update');
    });

    it('command 正文由 skill 正文经 deriveCommandContent 派生（无第二份手写正文）', () => {
        expect(command?.content).toBe(deriveCommandContent(body));
    });

    it('不进入默认集与阶段协议表', () => {
        expect(DEFAULT_WORKFLOWS).not.toContain('spec-update');
        expect(Object.keys(WORKFLOW_PROTOCOLS)).not.toContain('spec-update');
    });

    it('description 含三向 NOT for 排歧', () => {
        const description = skill?.description ?? '';
        expect(description).toContain('NOT for 新建变更提案（改用 iagent_spec_propose）');
        expect(description).toContain('NOT for 实现未完成的变更（改用 iagent_spec_apply）');
        expect(description).toContain('NOT for 孤立缺陷的根因排查（改用 iagent_debug）');
        // 长度上限（Agent Skills 硬上限 1024）
        expect(description.length).toBeLessThanOrEqual(1024);
    });

    it('旧标识映射表登记同名透传条目，映射目标集 == 注册表指令 id 集', () => {
        expect(LEGACY_WORKFLOW_ID_MAP['spec-update']).toBe('spec-update');
        const commandIds = new Set(getSkillTemplates().map((item) => item.commandId));
        expect(new Set(Object.values(LEGACY_WORKFLOW_ID_MAP))).toEqual(commandIds);
    });

    it('debug description 含反向排歧句（不改行为）', () => {
        const debug = getSkillTemplates().find(({ template }) => template.name === 'iagent_debug');
        expect(debug?.template.description).toContain('已实现变更的提案修订用 iagent_spec_update');
    });
});

describe('spec-update 前置校验与复活复制', () => {
    it('前置校验以 progress.remaining 为判据并给出阻断出口（无跳过出口）', () => {
        expect(body).toContain('progress.remaining');
        expect(body).toContain('`progress` 为 `null` 时视为未完成');
        expect(body).toContain('先走 `iagent_spec_apply`');
        expect(body).toContain('MUST NOT 提供「跳过检查 / 继续修订」一类出口');
    });

    it('已归档变更先复活复制，原归档目录保持不动', () => {
        expect(body).toContain('update-<原名>-<YYYYMMDD>');
        expect(body).toContain('原归档目录 MUST 保持不动');
        expect(body).toContain('cpSync');
        expect(body).toContain('MUST NOT 依赖 `cp -r` / `xcopy`');
    });

    it('复制失败时阻断并终止本轮', () => {
        expect(body).toContain('复制失败 → 阻断并报 WARN，终止本轮');
    });
});

describe('spec-update 双轨根因定位', () => {
    it('轻量差异定位优先，无结论才降级委派 debug', () => {
        expect(body).toContain('默认路径（轻量差异定位）');
        expect(body).toContain('MUST NOT 额外发起 debug 委派');
        expect(body).toContain('降级委派 `iagent_debug`');
    });

    it('降级委派未发生时不伪装为委派完成', () => {
        expect(body).toContain('MUST NOT 表述为「委派完成」');
        expect(body).toContain('按「根因未定位」处置');
    });

    it('根因未定位时不修改任何制品', () => {
        expect(body).toContain('停在探索阶段出口');
        expect(body).toContain('MUST NOT 改写任何制品，MUST NOT 生成修订清单');
    });
});

describe('spec-update 破坏性改动确认门', () => {
    it('门归第 5 类 destructive-change 且不自造第 6 类', () => {
        expect(body).toContain('⛔ GATE: 破坏性改动确认门');
        expect(body).toContain('destructive-change');
        expect(body).toContain('MUST NOT 自造第 6 类门');
        expect(GATE_WHITELIST.length).toBe(5);
        expect(GATE_WHITELIST.find((item) => item.id === 'destructive-change')?.conditional).toBe(
            false
        );
    });

    it('门段引用既有白名单（正向枚举 5 类）', () => {
        expect(body).toContain('正向枚举 5 类');
        expect(body).toContain('破坏性改动确认');
    });

    it('用户拒绝时不改任何制品且无跳过出口', () => {
        expect(body).toContain('记录拒绝并停在「更新提案」阶段');
        expect(body).toContain('MUST NOT 提供「跳过门继续」一类出口');
    });
});

describe('spec-update 原地改写、修订记录与回滚', () => {
    it('改写顺序固定且不引入 JSON 制品', () => {
        expect(body).toContain('`proposal.md` → `specs/**` → `design.md` → `tasks.md`');
        expect(body).toContain('MUST NOT 引入 `change.json` / `tasks.json`');
    });

    it('revision.md 追加写入，MUST NOT 覆盖历史记录', () => {
        expect(body).toContain('追加** `revision.md`');
        expect(body).toContain('MUST NOT 覆盖历史修订记录');
        expect(corpus).toContain('## 修订记录');
    });

    it('改写失败整体回滚并停在更新提案阶段', () => {
        expect(body).toContain('内存副本');
        expect(body).toContain('逐个还原已改写制品');
        expect(body).toContain('MUST NOT 留下半改写状态');
    });
});

describe('spec-update 再实现与能力测试对比', () => {
    it('委派 spec-apply 承接再实现优化', () => {
        expect(body).toContain('委派 `iagent_spec_apply`');
        expect(body).toContain('MUST NOT 自建一套实现调度');
    });

    it('产出 capability-comparison.md 且口径与 spec-verify 互补', () => {
        expect(body).toContain('capability-comparison.md');
        expect(body).toContain('MUST NOT 替代或复用 `spec-verify` 的三维度口径');
        expect(corpus).toContain('| 能力 | 修复前表现 | 修复后表现 | 证据位置 | 结论 |');
    });

    it('对比结论 FAIL 时不进入归档出口', () => {
        expect(body).toContain('MUST NOT 进入归档出口');
    });

    it('新增制品不进入 SPEC_DRIVEN_SCHEMA（不进主 spec 合并范围）', () => {
        const outputPaths = SPEC_DRIVEN_SCHEMA.artifacts.map((artifact) => artifact.outputPath);
        expect(outputPaths).not.toContain('revision.md');
        expect(outputPaths).not.toContain('capability-comparison.md');
    });
});

describe('spec-update 四环节顺序与结构化回执', () => {
    it('环节段序固定：探索分析 → 更新提案 → 再实现优化 → 能力测试对比', () => {
        const steps = [
            '## Step 0 前置校验',
            '## Step 1 归档态判定与复活复制',
            '## Step 2 双轨根因定位',
            '## Step 3 根因结论与修订清单',
            '## ⛔ GATE: 破坏性改动确认门',
            '## Step 4 原地改写与修订记录',
            '## Step 5 改写失败回滚',
            '## Step 6 再实现优化',
            '## Step 7 能力测试对比',
            '## Step 8 一致性验证与对比结论',
            '## Step 9 结构化回执',
        ];
        const positions = steps.map((step) => body.indexOf(step));
        positions.forEach((position, index) => {
            expect(position, `缺少环节段「${steps[index]}」`).toBeGreaterThanOrEqual(0);
        });
        expect(new Set(positions).size).toBe(steps.length);
        expect(positions).toEqual([...positions].sort((left, right) => left - right));
    });

    it('回执含 phase / status / artifact / nextAllowed 四字段', () => {
        for (const field of ['`phase`', '`status`', '`artifact`', '`nextAllowed`']) {
            expect(body, `回执字段缺失 ${field}`).toContain(field);
        }
        expect(body).toContain('MUST NOT 以面向用户的会话小结替代回执');
    });
});

describe('spec-update 依赖注入与委派面一致', () => {
    it('DEPS 声明与正文委派集合一致（无死引用、无冗余项）', () => {
        const delegated = [...(skill?.allowedTools ?? '').matchAll(/Skill\(([a-z0-9-]+)\)/g)]
            .map((match) => match[1].replace(/^iagent-/, ''))
            .sort();
        expect(delegated).toEqual([...DEPS['spec-update']].sort());
        expect(delegated).toEqual(['debug', 'spec-apply', 'spec-verify', 'test']);
    });

    it('委派条目均为 canonical 形态，无通配与裸名', () => {
        const tools = skill?.allowedTools ?? '';
        expect(tools).not.toContain('Skill(*)');
        expect(tools).toContain('Skill(iagent-spec-apply)');
        expect(tools).toContain('Skill(iagent-spec-verify)');
        expect(tools).toContain('Skill(iagent-test)');
        expect(tools).toContain('Skill(iagent-debug)');
    });

    it('resolveWorkflows 随装补全四项依赖', () => {
        const resolved = resolveWorkflows(['spec-update']);
        for (const dep of ['spec-apply', 'spec-verify', 'test', 'debug']) {
            expect(resolved.workflows).toContain(dep);
        }
    });

    it('条件委派登记与正文降级语义一致（仅 debug 为条件委派）', () => {
        // 宿主运行时表：debug 属条件委派（轻量定位无结论时降级），其余为无条件必需委派
        expect(CONDITIONAL_DELEGATIONS['spec-update']).toEqual(['debug']);
        for (const unconditional of ['spec-apply', 'spec-verify', 'test']) {
            expect(CONDITIONAL_DELEGATIONS['spec-update']).not.toContain(unconditional);
        }
        // 条件委派必须是委派清单内的真实目标（无死条目）
        expect(ORCHESTRATION_DELEGATIONS['spec-update']).toContain('debug');
    });
});

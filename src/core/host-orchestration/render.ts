/**
 * 宿主编排段渲染（变更 add-host-orchestration-adapters）。
 *
 * 共享技能模板保持宿主无关；安装期按目标宿主把「原生编排映射 + strict/degraded 限制 +
 * 回执与门契约」渲染为追加段。这样同一份模板源可服务 Claude Code、OpenCode V2、Pi
 * 与 Codex，而不必为每个宿主维护第二份正文。
 *
 * 注入面（变更 fix-mode-delegation-host-parity）：需要注入的 workflow 集合与委派目标
 * 由**模板单一源派生** —— 模板 `allowedTools` 含 `Skill(...)` 即视为编排技能，
 * 委派清单取该技能的 canonical 目标集合（保序去重），MUST NOT 维护第二份硬编码真源。
 */

import type { CapabilityNegotiation, OrchestrationMode } from './hosts.js';
import { renderDelegationList } from './actions.js';
import { getWorkflowProtocol } from './workflows.js';
import { getSkillTemplates } from '../templates/index.js';

/** 派生入参（纯函数：入参化模板列表，避免「模板 → 注册表 → 模板」循环导入） */
export interface OrchestrationTemplateInput {
    /** canonical workflowId（= commandId） */
    commandId: string;
    /** 技能模板的 allowedTools 白名单串 */
    allowedTools: string;
}

/** 派生结果 */
export interface OrchestrationDelegations {
    /** 需要注入宿主编排段的 workflow（含委派动作） */
    workflowIds: string[];
    /** canonical workflowId → 委派目标（保序去重） */
    delegations: Record<string, string[]>;
}

/** `Skill(...)` 条目解析（canonical kebab 与 legacy 下划线、`plugin:` 前缀均可识别） */
const SKILL_ENTRY_PATTERN = /Skill\(\s*([a-zA-Z0-9_:\-*]+)\s*\)/g;

/**
 * 解析 `allowedTools` 中的技能委派目标（canonical workflowId，保序去重）。
 *
 * 星号通配不属合法条目（构造期已拒绝），此处忽略。
 */
export function parseDelegationTargets(allowedTools: string): string[] {
    const targets: string[] = [];
    for (const match of allowedTools.matchAll(SKILL_ENTRY_PATTERN)) {
        const raw = match[1].trim();
        if (raw === '*') {
            continue;
        }
        const normalized = raw
            .replace(/^plugin:/, '')
            .replace(/^iagent[_-]/, '')
            .replaceAll('_', '-')
            .toLowerCase();
        if (normalized !== '' && !targets.includes(normalized)) {
            targets.push(normalized);
        }
    }
    return targets;
}

/**
 * 从模板列表派生编排注入面（纯函数）。
 *
 * 规则：`allowedTools` 含 `Skill(...)` 的技能即编排技能；委派目标取该技能的
 * `Skill(...)` 目标集合（保序去重）。无委派条目的技能不注入、不生成 `allowed_subagents`。
 */
export function deriveOrchestrationDelegations(
    templates: readonly OrchestrationTemplateInput[]
): OrchestrationDelegations {
    const workflowIds: string[] = [];
    const delegations: Record<string, string[]> = {};
    for (const template of templates) {
        const targets = parseDelegationTargets(template.allowedTools);
        if (targets.length === 0) {
            continue;
        }
        workflowIds.push(template.commandId);
        delegations[template.commandId] = targets;
    }
    return { workflowIds, delegations };
}

/** 缺省派生结果（按全部内置技能模板；缓存一次，生成期多次复用） */
let defaultDerivation: OrchestrationDelegations | undefined;

/** 取得缺省派生结果（全部内置技能模板） */
export function defaultOrchestrationDelegations(): OrchestrationDelegations {
    if (defaultDerivation === undefined) {
        defaultDerivation = deriveOrchestrationDelegations(
            getSkillTemplates().map(({ template, commandId }) => ({
                commandId,
                allowedTools: template.allowedTools,
            }))
        );
    }
    return defaultDerivation;
}

/** 需要编排注入的 workflow（派生自模板 `Skill(...)` 条目，非第二份硬编码清单） */
export const ORCHESTRATING_WORKFLOW_IDS: readonly string[] =
    defaultOrchestrationDelegations().workflowIds;

/** 各编排 workflow 的委派目标（派生自模板 `Skill(...)` 条目） */
export const ORCHESTRATION_DELEGATIONS: Readonly<Record<string, readonly string[]>> =
    defaultOrchestrationDelegations().delegations;

/**
 * 委派参数表（**目标之外的第二类信息**，显式声明）。
 *
 * `allowedTools` 只承载「委派目标」，不承载参数；参数表 MUST 与模板正文的委派语句
 * 同源同值，未声明的目标 MUST NOT 被填充任何模式参数。
 *
 * **门账本通道（变更 improve-delegation-gate-ledger / D6）**：父级确认门后把门承载 id
 * 写入 handoff 包的 `## 已确认门` 段，被委派方在 `gate-skip` 丢失时据此兜底。账本路径由
 * change-name 确定性派生（`gateLedgerPath(changeName)` = `.openspec-tmp/pipeline-<change>/handoff-pack.md`），
 * MUST NOT 作为委派参数键传入 —— 参数表仍只有 `mode` / `gate-skip` 两轴（`auto-mode` 为兼容写法），
 * `resolveDelegationContract` 的 `KNOWN_PARAMS` MUST NOT 新增账本键。
 */
export const DELEGATION_PARAMETERS: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
> = {
    workflow: {
        'spec-explore': { mode: 'delegated' },
        'spec-propose': { mode: 'delegated' },
        'spec-apply': { 'gate-skip': 'design-confirmation' },
    },
    'auto-workflow': {
        'spec-explore': { mode: 'delegated' },
        'spec-propose': { mode: 'delegated' },
        'spec-apply': { 'gate-skip': 'design-confirmation' },
    },
};

/**
 * 条件委派的委派目标（模板正文已声明 fallback / degraded 路径）。
 *
 * 未列出的委派目标一律视为**无条件必需委派**：宿主缺少该目标时按能力阻断，
 * MUST NOT 以本地执行替代。
 *
 * 列出的目标在其宿主缺口中按正文既有降级路径执行并记 WARN（例如
 * `debug → proposal-review` 的内联只读复查、`debug → test` 的显式 degraded 本地编写，
 * 以及 `project-init → feature-doc` 的自行扫描降级），
 * 两类情形均 MUST NOT 伪装为 strict 委派完成。
 *
 * `debug` 的 `spec-verify-proposal` **不在此列**：它由 `DEPS.debug` 随装且正文未声明
 * 可替代路径 —— 属无条件必需委派，缺口按能力阻断（见 `DEPS` 响应）。
 */
export const CONDITIONAL_DELEGATIONS: Readonly<Record<string, readonly string[]>> = {
    workflow: [
        'spec-verify-proposal',
        'proposal-review',
        'spec-verify',
        'test',
    ],
    'auto-workflow': [
        'spec-verify-proposal',
        'proposal-review',
        'spec-verify',
        'test',
    ],
    // debug：仅 proposal-review（内联只读复查）与 test（仅显式 degraded 本地编写）声明了降级路径。
    debug: ['proposal-review', 'test'],
    // project-init：委派 feature-doc 生成文档，不可得时正文已声明自行扫描（降级路径）。
    'project-init': ['feature-doc'],
    migration: [],
};

/**
 * 续跑断言单一源（变更 improve-continuation-and-codegraph-resilience，D3 / D4 / D8 / D11）。
 *
 * 目标：把「回执后继续、只有 5 类门可停」从多处散文收敛为一段可断言文本，
 * 并补齐执行侧条款（回执内部化、门自检、判定顺序、落盘与重试）。
 *
 * 模板与宿主产物 MUST 引用本函数，MUST NOT 手写第二份门清单或续跑条款。
 */
export function renderContinuationContract(mode: OrchestrationMode = 'strict'): string {
    const firstAction =
        mode === 'strict'
            ? '`status=ok` 且回执校验通过后，回执 `nextAllowed`（阶段 id）即本回合的下一动作'
            : '本地阶段完成且回执校验通过后，回执 `nextAllowed`（阶段 id）即本回合的下一动作';
    return [
        `- **续跑断言**：${firstAction} —— MUST 在同一用户回合内继续下一阶段：先发起该阶段的委派 / 内联工具调用，再输出任何文字；MUST NOT 以回执、阶段小结或「等待确认」结束回合`,
        '- **回执内部化**：回执 MUST NOT 作为面向用户的最终消息；用户可见输出至多一行进度',
        '- **停点自检**：只有门白名单内的确认门是合法停点；停点前 MUST 引用门白名单的**类别 id 或锚点 id**（`destructive-change` 无阶段锚点，只认类别 id）；引用不出即继续，MUST NOT 停点',
        '- **判定顺序**：能力（生成期协商 + `requiredCapabilities`）→ 门（白名单）→ 回执（`validateReceipt` + `resolveNextPhase`）；**门优先**',
        '- **回执处置**：编排器先落盘 `.openspec-tmp/pipeline-<change>/receipts/<phase>.json` 再校验；`blockedBy` 恰为 `[\'invalid-receipt\']` 时同参数自动重试一次（不询问用户），仍失败 → 暂停并报告；能力缺失与未知门 → 阻断并报告，非停点',
        '- **中断恢复**：用户在阶段之间发来「继续」类指令时，直接执行上一回执的 `nextAllowed`，MUST NOT 重新询问或重跑已确认的门',
    ].join('\n');
}

/**
 * 渲染宿主编排段（Markdown）。
 *
 * strict：说明原生机制与门/回执契约；
 * degraded：显式声明未提供的能力与禁止伪装。
 */
export function renderHostOrchestrationSection(
    negotiation: CapabilityNegotiation,
    workflowId?: string,
    orchestration?: OrchestrationDelegations
): string {
    const derived = orchestration ?? defaultOrchestrationDelegations();
    const lines: string[] = [];
    lines.push('## 宿主编排适配（生成期注入）');
    lines.push('');
    if (negotiation.mode === 'strict') {
        lines.push('本次产物为 **strict 编排**：阶段委派、回执与确认门使用宿主原生机制。');
        lines.push('');
        lines.push(`- 技能加载：${negotiation.native.skillLoading}`);
        lines.push(`- 阶段委派：${negotiation.native.delegation}`);
        lines.push(`- 确认门：${negotiation.native.gate}`);
        lines.push('- 回执契约：阶段 MUST 返回 `phase` / `status` / 产物位置 / 下一步允许动作 / 失败原因');
        lines.push('- 回执缺失或不通过校验时 MUST NOT 自动推进下一阶段');
        lines.push('- 续跑契约：阶段回执是**中间状态**');
        lines.push(renderContinuationContract('strict'));
        lines.push('- 失败 / 阻塞：`blocked` / `failed` / `incomplete` MUST NOT 继续；按重试策略暂停并报告 `failure` / `blockedGate` / `blockedReason`');
        lines.push('- 子代理数据：只传 Stage Envelope（路径 + 结构化字段），MUST NOT 内联制品正文或完整 SKILL.md；子代理先读 handoff 包，回执只含 Stage Receipt（≤40 行 / ≤2KB）');
        lines.push(
            '- 分级执行：全部编排阶段（explore / propose / apply / verify / archive / fix / migration）默认内联；仅 `spec-bulk-archive` 内部并行单元保留子代理（≤3）；兼容窗接受 legacy `subagent` 回执并记 deprecation WARN，下个 major 收紧；propose / apply 由主 agent 单 agent 分批执行（批内并行只读、同文件串行）；只读验证以固定清单 + 每条结论 `文件:行` 证据 + 报告落盘承担可信度（independence=self 记 WARN）；`iagent_test` 为 apply / fix 子阶段'
        );
        lines.push(
            '- 增量复验：验证 FAIL 修复后在同一主上下文按 fixDiff 增量重跑清单，禁止新开验证代理或全量重读；禁止以 resume 充当复验（contextReplay=true 记 WARN）'
        );
        lines.push(
            '- 执行方式回执：executionMode / independence / readScope / dependsOn / contextReplay；inline 阶段不要求 delegate'
        );
    } else {
        lines.push('本次产物为 **degraded 单 agent 模式**（宿主严格编排能力不可用）。');
        lines.push('');
        if (negotiation.host === 'codex') {
            lines.push(
                '- Codex 为 skills-only 宿主：阶段由当前 agent **本地执行，不构成委派**；MUST NOT 声称获得宿主原生阶段回执或子代理完成'
            );
        }
        if (negotiation.missing.length > 0) {
            lines.push(`- 未提供的能力：${negotiation.missing.join(', ')}。`);
        }
        lines.push('- MUST NOT 把本地串行执行标记为委派完成、子代理回执或严格 gate 通过');
        lines.push('- 每个被跳过的委派 / 回执 / 门控 MUST 记录原因');
        lines.push(
            '- 执行方式回执：全部阶段 MUST 为 executionMode=local-degraded，MUST NOT 声称 subagent'
        );
        lines.push('- 续跑契约：阶段回执是**中间状态**');
        lines.push(renderContinuationContract('degraded'));
        lines.push('- 恢复 strict 需安装或配置宿主运行时后重新执行 iagent init / update');
    }
    for (const note of negotiation.notes) {
        lines.push(`- ${note}`);
    }
    if (negotiation.mode !== 'strict') {
        // degraded 宿主不存在可执行的委派机制：以覆盖声明消解正文中的「委派」语句，
        // 避免产物自相矛盾（codex / Pi degraded 均适用）
        lines.push('');
        lines.push(
            '**degraded 覆盖声明（优先于正文）**：本文正文中出现的「委派 / 委派阶段 / SHALL 委派 / 经 Skill 工具 / 子代理」等表述，在本宿主一律按**当前 agent 本地执行**理解，**不构成委派**；MUST NOT 声称获得宿主原生阶段回执、子代理完成或严格 gate 通过'
        );
    }
    // 模板正文通则：已授权技能直接推进，不追加业务确认（执行方式随协商结果）
    lines.push('');
    lines.push(
        negotiation.mode === 'strict'
            ? '- 已授权技能直接推进：入口意图或已确认业务门指定的唯一 `nextAllowed` 技能 SHALL 直接委派，不追加"是否调用该技能"的业务确认；宿主工具权限、strict/degraded 能力协商与回执校验仍然独立生效'
            : '- 已授权技能直接推进：入口意图或已确认业务门指定的唯一 `nextAllowed` 技能 SHALL 按本段声明的执行方式**由当前 agent 本地执行**（不构成委派），不追加"是否调用该技能"的业务确认；回执校验仍然独立生效'
    );
    // 门兜底矩阵声明（生成期无法判定运行表面，产物声明运行期规则）
    lines.push(
        '- headless 表面按门兜底矩阵执行：条件门（需求澄清类）记录决策并继续并记 WARN；不可豁免门 MUST 以 `status=blocked` 回执中止'
    );
    if (workflowId) {
        const delegations = derived.delegations[workflowId] ?? [];
        const list = renderDelegationList(
            negotiation.host,
            negotiation.mode,
            delegations,
            DELEGATION_PARAMETERS[workflowId],
            workflowId
        );
        if (list) {
            lines.push('');
            lines.push(list);
        }
        const protocol = getWorkflowProtocol(workflowId);
        if (protocol) {
            lines.push('');
            lines.push('**阶段能力声明**：');
            lines.push('');
            for (const phase of protocol.phases) {
                const caps = phase.requiredCapabilities.join(', ');
                const gate = phase.gate
                    ? `；门：${phase.gate.id}${phase.gate.condition ? `（条件 ${phase.gate.condition}）` : ''}`
                    : '';
                const retry = phase.retry
                    ? `；重试：≤${phase.retry.maxAttempts} 次（${phase.retry.on.join(' / ')}）`
                    : '';
                lines.push(`- \`${phase.id}\`：能力 ${caps}${gate}${retry}`);
            }
        }
    }
    lines.push('');
    return lines.join('\n');
}

/** 技能是否属于需要编排适配的 workflow */
export function isOrchestratingWorkflow(
    workflowId: string,
    orchestration?: OrchestrationDelegations
): boolean {
    const derived = orchestration ?? defaultOrchestrationDelegations();
    return derived.workflowIds.includes(workflowId);
}

/**
 * 为编排类技能产物追加宿主编排段。
 *
 * 非编排技能原样返回；传入内容已含同名段时先移除旧段（幂等，避免重复追加）。
 */
export function adaptSkillContentForHost(
    content: string,
    negotiation: CapabilityNegotiation,
    workflowId: string,
    orchestration?: OrchestrationDelegations
): string {
    // 宿主产物统一使用 canonical kebab-case skill ID；模板源仍可保留 legacy
    // `iagent_<name>` 标识作为注册/兼容契约。
    const normalized = content.replace(/\biagent_([a-z0-9_]+)\b/g, (_match, suffix: string) =>
        `iagent-${suffix.replaceAll('_', '-')}`
    );
    if (!isOrchestratingWorkflow(workflowId, orchestration)) {
        return normalized;
    }
    const marker = '## 宿主编排适配（生成期注入）';
    const withoutOld = stripExistingSection(normalized, marker);
    const section = renderHostOrchestrationSection(negotiation, workflowId, orchestration);
    return `${withoutOld.trimEnd()}\n\n${section}`;
}

/** 移除既有宿主编排段（从标记到下一个二级标题或文末） */
function stripExistingSection(content: string, marker: string): string {
    const idx = content.indexOf(marker);
    if (idx === -1) {
        return content;
    }
    const after = content.slice(idx);
    const nextHeading = after.slice(marker.length).search(/\n## /);
    if (nextHeading === -1) {
        return content.slice(0, idx);
    }
    return content.slice(0, idx) + after.slice(marker.length + nextHeading);
}

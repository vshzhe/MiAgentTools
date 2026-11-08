/**
 * 门账本（gate ledger）单一源（变更 improve-delegation-gate-ledger，D1 / D5 / U4）。
 *
 * 门账本是「门承载」的**第二通道**：`gate-skip` 仍是主通道（权威），账本只在参数
 * 丢失时兜底；两者皆缺 → 门照常执行（fail-safe）。
 *
 * 载体固定为变更级 handoff 包 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md`
 * 的 `## 已确认门` 段 —— 与六节并列、**不计入六节**，也不改变 `## 阶段结论` 的只追加语义。
 *
 * **语义铁律（门承载，不是父级阶段门）**：账本条目表达「该门已由父级承载、被委派方
 * 无需再确认」这一事实，取值域收敛到 `GATE_SKIP_IDS`（当前仅 `design-confirmation`）。
 * 父级的**阶段门 id**（如 `implementation-bridge`）不在该域内，
 * 写入会触发 `invalid-receipt` —— 故渲染期直接拒绝，MUST NOT 写入父级阶段门 id。
 *
 * 本模块是**叶依赖消费方**：只导入 `delegation-contract.js`（同为叶模块），
 * 不导入模板 / 注册表，避免与生成期形成循环。
 */

import * as path from 'node:path';

import { GATE_SKIP_IDS, type GateSkipId } from './delegation-contract.js';

/** 门账本段标题（与 handoff 包六节并列，不计入六节） */
export const GATE_LEDGER_SECTION = '## 已确认门';

/** handoff 包文件名（账本载体） */
export const HANDOFF_PACK_FILE_NAME = 'handoff-pack.md';

/** 流程级临时工作区目录名前缀（`pipeline-<change-name>`） */
export const PIPELINE_WORKSPACE_PREFIX = 'pipeline-';

/** 流程级临时工作区根目录（已被 `.gitignore` 排除，不进提交面） */
export const PIPELINE_WORKSPACE_ROOT = '.openspec-tmp';

/** 账本表格表头行（解析时 MUST 跳过，MUST NOT 当作门 id） */
export const GATE_LEDGER_HEADER_ROW = '| 门 id | 确认阶段 |';

/** 账本表格分隔行（解析时 MUST 跳过，MUST NOT 当作门 id） */
export const GATE_LEDGER_SEPARATOR_ROW = '| --- | --- |';

/** 表头首列字面量（同时覆盖带 / 不带外层竖线的写法） */
const LEDGER_HEADER_FIRST_CELL = '门 id';

/** 账本条目：门承载 id + 其确认阶段（写入方阶段标识） */
export interface GateLedgerEntry {
    /** 门承载 id（`GATE_SKIP_IDS` 内取值） */
    gate: GateSkipId;
    /** 确认阶段（写入方阶段标识，如 `verify` / `apply`） */
    phase: string;
}

/** 账本解析结果 */
export interface GateLedger {
    /** 段是否存在（缺失即「无账本」，门照常触发） */
    present: boolean;
    /** 已确认门 id（去重、保序；未知 id 不回填） */
    gates: GateSkipId[];
    /** 条目明细（门 id + 确认阶段） */
    entries: GateLedgerEntry[];
    /** 解析期间的 WARN（未知门 id / 无法解析的行），MUST NOT 静默吞掉 */
    warnings: string[];
}

/** 账本一致性判定结果 */
export interface GateLedgerConfirmation {
    /** 该门是否可视为「已由父级承载」 */
    confirmed: boolean;
    /** 不一致 / 无法核对时的 WARN 文案 */
    warnings: string[];
}

/**
 * 账本文件的确定性派生路径。
 *
 * 由 change-name 派生，MUST NOT 作为新的委派参数键传入（参数表仍只允许
 * `mode` / `gate-skip`；`auto-mode` 为兼容写法）。
 */
export function gateLedgerPath(changeName: string): string {
    return path.join(
        PIPELINE_WORKSPACE_ROOT,
        `${PIPELINE_WORKSPACE_PREFIX}${changeName}`,
        HANDOFF_PACK_FILE_NAME
    );
}

/** 门 id 是否落在门承载取值域内 */
export function isGateSkipId(raw: string): raw is GateSkipId {
    return (GATE_SKIP_IDS as readonly string[]).includes(raw);
}

/** 是否为表头行（`| 门 id | 确认阶段 |` 及不带外层竖线的等价写法） */
function isHeaderRow(cells: readonly string[]): boolean {
    return cells[0] === LEDGER_HEADER_FIRST_CELL;
}

/** 是否为表格分隔行（`| --- | --- |` / `|:---:|:---:|`） */
function isSeparatorRow(cells: readonly string[]): boolean {
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/** 把一行拆为单元格（剥离首尾 `|` 与空白，不依赖列宽对齐） */
function splitCells(line: string): string[] {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length > 0 && cells[0] === '') {
        cells.shift();
    }
    if (cells.length > 0 && cells[cells.length - 1] === '') {
        cells.pop();
    }
    return cells;
}

/**
 * 解析 handoff 包 Markdown 中的 `## 已确认门` 段。
 *
 * 规则：
 *   - 段缺失 → `present: false` + 空集（**不产生 WARN**：无账本属合法 fail-safe 状态）；
 *   - 表头行与分隔行 SHALL 被跳过，MUST NOT 作为门 id 处理或产生 WARN；
 *   - 未知门 id → 忽略 + WARN（MUST NOT 按「全部门已确认」处理，MUST NOT 回填）；
 *   - 重复条目 → 保留首个（只追加语义下重复即人工追加，不改写既有条目）。
 */
export function parseGateLedger(markdown: string): GateLedger {
    const lines = typeof markdown === 'string' ? markdown.split(/\r?\n/) : [];
    const warnings: string[] = [];
    const entries: GateLedgerEntry[] = [];
    const gates: GateSkipId[] = [];

    const start = lines.findIndex((line) => line.trim() === GATE_LEDGER_SECTION);
    if (start === -1) {
        return { present: false, gates, entries, warnings };
    }

    for (const rawLine of lines.slice(start + 1)) {
        const line = rawLine.trim();
        // 下一个二级标题即段结束（六节 / `## 阶段结论` 均如此）
        if (/^#{1,2}\s/.test(line)) {
            break;
        }
        if (line === '') {
            continue;
        }
        const cells = splitCells(line);
        if (isHeaderRow(cells) || isSeparatorRow(cells)) {
            continue;
        }
        if (cells.length < 2) {
            warnings.push(
                `WARN: 忽略无法解析的门账本行「${line}」（期望格式 \`| <门 id> | <确认阶段> |\`）`
            );
            continue;
        }
        const [rawGate, rawPhase] = cells;
        if (!isGateSkipId(rawGate)) {
            warnings.push(
                `WARN: 忽略未知门账本条目 ${rawGate}（可选：${GATE_SKIP_IDS.join(' / ')}），MUST NOT 视为已确认`
            );
            continue;
        }
        if (gates.includes(rawGate)) {
            continue;
        }
        gates.push(rawGate);
        entries.push({ gate: rawGate, phase: rawPhase });
    }

    return { present: true, gates, entries, warnings };
}

/**
 * 渲染单条账本表格行（形如 `| design-confirmation | verify |`）。
 *
 * 传入域外 id（如父级阶段门 `implementation-bridge`）时直接抛错：账本只表达
 * **门承载语义**，写入父级阶段门 id 必然在回执校验侧触发 `invalid-receipt`。
 */
export function renderGateLedgerEntry(gateId: string, phase: string): string {
    if (!isGateSkipId(gateId)) {
        throw new Error(
            `门账本只接受门承载 id（可选：${GATE_SKIP_IDS.join(' / ')}），收到 ${gateId}；MUST NOT 写入父级阶段门 id`
        );
    }
    return `| ${gateId} | ${phase} |`;
}

/**
 * 渲染完整账本段（标题 + 表头 + 分隔行 + 条目）。
 *
 * 供测试与写入方构造符合协议的段文本；重复门保留首个（与解析侧一致）。
 */
export function renderGateLedgerSection(entries: readonly GateLedgerEntry[]): string {
    const rendered: string[] = [GATE_LEDGER_SECTION, GATE_LEDGER_HEADER_ROW, GATE_LEDGER_SEPARATOR_ROW];
    const seen = new Set<string>();
    for (const entry of entries) {
        if (seen.has(entry.gate)) {
            continue;
        }
        seen.add(entry.gate);
        rendered.push(renderGateLedgerEntry(entry.gate, entry.phase));
    }
    return rendered.join('\n');
}

/**
 * 判定某门是否可经账本视为「已由父级承载」。
 *
 * 判定顺序（fail-safe）：
 *   1. 门 id 不在 `GATE_SKIP_IDS` 内 → 未确认 + WARN；
 *   2. 段缺失或段内无该门 → 未确认（不产生 WARN，门照常执行）；
 *   3. 回执未声明 `confirmedGates` → **无法核对** → 未确认 + WARN（视同不一致）；
 *   4. 回执未包含该门（伪造 / 过期 / 人工改写）→ 未确认 + WARN。
 *
 * 回执是账本的**上游真源**：账本条目 MUST NOT 超出回执声明的已确认门。
 *
 * @param gateId - 待判定的门承载 id
 * @param ledger - `parseGateLedger` 的解析结果
 * @param receiptConfirmedGates - 上游阶段回执的 `confirmedGates`（未携带即 undefined）
 */
export function resolveGateLedgerConfirmation(
    gateId: string,
    ledger: GateLedger,
    receiptConfirmedGates?: readonly string[]
): GateLedgerConfirmation {
    const warnings: string[] = [];
    if (!isGateSkipId(gateId)) {
        warnings.push(
            `WARN: 门账本不承载 ${gateId}（可选：${GATE_SKIP_IDS.join(' / ')}），视为未确认`
        );
        return { confirmed: false, warnings };
    }
    const declared = ledger.gates.includes(gateId);
    if (!declared) {
        return { confirmed: false, warnings };
    }
    const receiptGates = (receiptConfirmedGates ?? []).filter(
        (item): item is string => typeof item === 'string'
    );
    if (receiptConfirmedGates === undefined) {
        warnings.push(
            `WARN: 账本声明门 ${gateId}，但上游回执未携带 confirmedGates，无法核对（伪造 / 过期）→ 视为未确认`
        );
        return { confirmed: false, warnings };
    }
    if (!receiptGates.includes(gateId)) {
        warnings.push(
            `WARN: 账本声明门 ${gateId}，但上游回执 confirmedGates 未包含该门（伪造 / 过期 / 人工改写）→ 视为未确认`
        );
        return { confirmed: false, warnings };
    }
    return { confirmed: true, warnings };
}

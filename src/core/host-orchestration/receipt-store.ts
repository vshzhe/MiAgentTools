/**
 * 阶段回执落盘单一源（变更 improve-continuation-and-codegraph-resilience，D10 / D11）。
 *
 * 回执只存在于会话文本时，编排器没有可校验对象，「回执后继续」退化为模型自检。
 * 本模块把阶段回执落为流程级临时文件（`.openspec-tmp/pipeline-<change>/receipts/<phase>.json`），
 * 供编排器写入后再读取校验。
 *
 * 边界（MUST NOT 扩张）：
 *   - 由**编排器**写入 —— 无 `Write` 权限的阶段（如 `spec-verify`）不因此获得写权限；
 *   - 不新增 CLI 命令，路径由 change-name + phase id 确定性派生；
 *   - 写入失败返回可诊断结果，调用方按 WARN 继续（不阻断阶段）。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { pipelineWorkspacePath } from './gate-ledger.js';
import type { Receipt } from './protocol.js';

/** 回执子目录名 */
export const RECEIPTS_DIR_NAME = 'receipts';

/** 回执文件名后缀 */
export const RECEIPT_FILE_SUFFIX = '.json';

/** 回执落盘结果 */
export type ReceiptStoreResult =
    | { ok: true; filePath: string }
    | { ok: false; filePath: string; reason: string };

/**
 * 阶段回执的确定性路径：`.openspec-tmp/pipeline-<change>/receipts/<phase>.json`。
 *
 * 路径分隔符由 `path.join` 生成，MUST NOT 硬编码。
 */
export function receiptStorePath(changeName: string, phaseId: string): string {
    return path.join(
        pipelineWorkspacePath(changeName),
        RECEIPTS_DIR_NAME,
        `${phaseId}${RECEIPT_FILE_SUFFIX}`
    );
}

/**
 * 写入阶段回执。
 *
 * @param changeName - 变更名（派生工作区）
 * @param phaseId - 阶段 id（派生文件名）
 * @param receipt - 阶段回执（结构化字段，MUST NOT 含制品正文）
 * @param cwd - 工作区根（默认进程 cwd；测试可注入临时目录）
 */
export function writeReceipt(
    changeName: string,
    phaseId: string,
    receipt: Partial<Receipt>,
    cwd: string = process.cwd()
): ReceiptStoreResult {
    const filePath = receiptStorePath(changeName, phaseId);
    const absolute = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    try {
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
        return { ok: true, filePath };
    } catch (error) {
        return {
            ok: false,
            filePath,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}

/** 读取阶段回执；文件缺失或不可解析时返回 undefined（调用方按 WARN 处理） */
export function readReceipt(
    changeName: string,
    phaseId: string,
    cwd: string = process.cwd()
): Partial<Receipt> | undefined {
    const filePath = receiptStorePath(changeName, phaseId);
    const absolute = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    try {
        const raw = fs.readFileSync(absolute, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return undefined;
        }
        return parsed as Partial<Receipt>;
    } catch {
        return undefined;
    }
}

/**
 * 产物内容指纹契约。
 *
 * `generateSkillContent` 在 frontmatter 写入 `metadata.generatedFingerprint`
 * （由产物内容派生）。`venus update` 据此判断产物自上次由 venus 写入后
 * **是否被改动过** —— 该信号独立于版本号，因此不依赖"先递增版本号再 update"
 * 的操作顺序，也不会因包版本号递增而把用户手改误判为可升级。
 */

import { createHash } from 'node:crypto';

/** frontmatter 中记录指纹的字段名（metadata 下） */
export const FINGERPRINT_FIELD = 'generatedFingerprint';

/** 读取 generatedBy（版本号）值的正则；`\r?` 容忍 CRLF 行尾 */
const GENERATED_BY_RE = /^  generatedBy: "(.+)"\r?$/m;

/** 读取 generatedFingerprint 值的正则；空占位值 `""` 不匹配（视为无指纹） */
const FINGERPRINT_VALUE_RE = /^  generatedFingerprint: "(.+)"\r?$/m;

/** 匹配 generatedFingerprint 整行（用于哈希前置空、打断自引用） */
const FINGERPRINT_LINE_RE = /^  generatedFingerprint: ".*"\r?$/m;

/**
 * 计算产物内容的指纹。
 *
 * 先把 `generatedFingerprint` 整行**置空**再哈希 —— 否则指纹将自引用
 * （内容的哈希依赖内容里的哈希），无法收敛。行尾统一归一化为 LF，
 * 使工作区被 CRLF 污染时不被误判为"被手改"。
 *
 * 结果只由内容决定（不含时间/随机/绝对路径），故同一输入恒得同一指纹 ——
 * 这是 `test/skills-parity.test.ts` 字节级比较成立的前提。
 *
 * @param fileContent - 产物全文（frontmatter + 正文）
 */
export function fingerprintOf(fileContent: string): string {
    const canonical = fileContent
        .replaceAll('\r\n', '\n')
        .replace(FINGERPRINT_LINE_RE, `  ${FINGERPRINT_FIELD}: ""`);
    return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

/**
 * 读取产物记录的指纹。
 *
 * @returns 指纹字符串；无该字段（存量产物）或值为空占位时返回 undefined
 */
export function readGeneratedFingerprint(fileContent: string): string | undefined {
    return fileContent.match(FINGERPRINT_VALUE_RE)?.[1];
}

/**
 * 读取产物记录的生成器版本号（`metadata.generatedBy`）。
 *
 * @returns 版本号；无该字段时返回 undefined
 */
export function readGeneratedBy(fileContent: string): string | undefined {
    return fileContent.match(GENERATED_BY_RE)?.[1];
}

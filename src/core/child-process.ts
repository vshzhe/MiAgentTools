/**
 * 子进程执行助手（Windows shell 兼容 + Node DEP0190 规避）。
 *
 * 背景：npm / claude / pi 等命令在 Windows 上实为 `.cmd` shim，不经 shell 无法执行；
 * 而 Node 20.19+ 起，`spawnSync(cmd, args, { shell: true })` 会触发 DEP0190 弃用告警
 * （args 不转义、仅拼接进命令行，存在注入风险）。
 *
 * 本模块自行把 argv 拼成一条 shell 命令行，再以**字符串**形式交给 shell：
 *   - Windows：`<ComSpec> /d /s /c "<命令行>"`（与 Node 内部 shell:true 的调用形态一致，
 *     配合 `windowsVerbatimArguments` 避免二次引用）
 *   - 其它平台：直接 `spawnSync(cmd, args)`，**不启用** shell
 *
 * 参数按 cmd.exe 的引号规则转义（见 `quoteArgumentForCmd`），语义与原先的 args 数组一致，
 * 但不再触发弃用告警。
 */

import { spawnSync } from 'node:child_process';

/** 需要引号包裹的字符：空白与 cmd.exe 元字符 */
const CMD_NEEDS_QUOTE = /[\s"&|<>^()%!;,]/;

/** spawnCommand 选项 */
export interface SpawnCommandOptions {
    /** 子进程工作目录 */
    cwd?: string;
    /** 超时（毫秒） */
    timeout?: number;
    /** `ignore` 丢弃全部输出；缺省捕获到 stdout / stderr */
    stdio?: 'ignore' | 'pipe';
    /** 写入子进程 stdin 的内容（需要从 stdin 传参的命令） */
    input?: string;
}

/** spawnCommand 结果（stdout / stderr 在编码为 utf8 时返回字符串） */
export interface SpawnCommandResult {
    status: number | null;
    stdout?: string;
    stderr?: string;
    error?: Error;
}

/**
 * 按 cmd.exe 的引号规则转义单个参数。
 *
 * 规则来源 qntm.org/cmd：
 *   - 不含空白与元字符的参数原样返回（保持与自带转义一致的最小改写）
 *   - 其余整体用双引号包裹；内嵌 `"` 写作 `\"`，其前的反斜杠成对加倍
 *   - 结尾连续反斜杠加倍（闭合引号会吞掉它们）
 *
 * 引号内 cmd.exe 不再解释 `& | < > ( ) ^` 等元字符，故无需额外的 `^` 转义。
 */
export function quoteArgumentForCmd(arg: string): string {
    if (arg === '') {
        return '""';
    }
    if (!CMD_NEEDS_QUOTE.test(arg)) {
        return arg;
    }
    const escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
    return `"${escaped}"`;
}

/**
 * 拼出 Windows 下交给 `cmd.exe /d /s /c` 的完整命令行。
 *
 * `/s` 会在命令行以引号开头时剥离首尾引号，因此命令本身需要引号（含空格路径）时
 * 整体再包一层，保证参数边界不被破坏。
 */
export function buildWindowsCommandLine(cmd: string, args: readonly string[]): string {
    const line = [cmd, ...args].map(quoteArgumentForCmd).join(' ');
    return line.startsWith('"') ? `"${line}"` : line;
}

/** Windows 下用于解析 `.cmd` shim 的 shell（默认 ComSpec） */
function resolveWindowsShell(): string {
    return process.env.ComSpec ?? process.env.COMSPEC ?? 'cmd.exe';
}

/**
 * 同步执行一条外部命令（替代 `spawnSync(..., { shell: true })`，不触发 DEP0190）。
 *
 * @param cmd - 命令名或可执行文件路径
 * @param args - 参数数组（逐个转义，语义与原 args 形式一致）
 * @param options - 工作目录 / 超时 / stdio / stdin
 * @returns 退出码与（可选）输出；启动失败时 `error` 有值且 `status` 为 null
 */
export function spawnCommand(
    cmd: string,
    args: readonly string[],
    options: SpawnCommandOptions = {}
): SpawnCommandResult {
    const common = {
        cwd: options.cwd,
        timeout: options.timeout,
        input: options.input,
        encoding: 'utf8' as const,
        stdio: options.stdio ?? ('pipe' as const),
    };

    const result =
        process.platform === 'win32'
            ? spawnSync(resolveWindowsShell(), ['/d', '/s', '/c', buildWindowsCommandLine(cmd, args)], {
                  ...common,
                  windowsVerbatimArguments: true,
              })
            : spawnSync(cmd, [...args], common);

    return {
        status: result.status,
        stdout: typeof result.stdout === 'string' ? result.stdout : undefined,
        stderr: typeof result.stderr === 'string' ? result.stderr : undefined,
        error: result.error ?? undefined,
    };
}

/**
 * CodeGraph 能力探测顺序与锁阶梯的唯一口径源。
 *
 * 背景（变更 upgrade-workflow-efficiency 的 DEC-4）：技能正文曾把「先跑 `codegraph_status`」
 * 写成硬约束、并在归档时无条件 `codegraph sync` —— 前者把探测绑定到单一工具名（宿主并不保证
 * MCP 工具齐全），后者与 daemon 的合法 writer 争锁。故把两段口径收敛到本模块：
 *
 *   - `renderCodegraphProbeOrder({ withCli })`：同一函数两种渲染（三通道 / 仅 MCP 两通道），
 *     调用方按自身是否持有 CLI 权限选择；MUST NOT 另立第二份手写文本。
 *   - `CODEGRAPH_LOCK_LADDER`：锁阶梯（读 `writer.pid` → 存活只读复用 → 不存活才 unlock），
 *     含 JSON 判据与「仅无 daemon 时按需 sync 一次」条件句。
 *
 * 两条判据 MUST 区分：判**索引可用性**只走能力探测通道，MUST NOT 用 `.codegraph/` 目录
 * 存在性（点号目录的 Glob 存在假阴性）；判 **daemon 存活** 读取 `.codegraph/writer.pid`
 * 属显式路径读取（失败即「无 daemon」），不违反该护栏。
 */

/** 探测顺序渲染选项 */
export interface CodegraphProbeOrderOptions {
    /**
     * 是否包含第三通道（CLI）。
     *
     * `true` → 三通道全文，调用方 MUST 同时具备 `CODEGRAPH_CLI` 白名单条目；
     * `false` → 仅 MCP 两通道，并声明「本技能不执行 CLI，第三通道不适用」。
     */
    withCli: boolean;
}

/** 共同的护栏句（两形态一致）：工具名缺失 ≠ 索引不可用；目录存在性不构成判据 */
const PROBE_GUARDRAILS = [
    '- **工具名缺失 ≠ 索引不可用**：某一通道在当前宿主不存在，只说明该通道不可用，MUST NOT 据此断言索引未初始化。',
    '- MUST NOT 用「`.codegraph/` 目录是否存在」判定索引可用性（点号目录的 Glob 存在假阴性）；目录存在性不构成可用性判据。',
];

/**
 * 渲染 CodeGraph 能力探测顺序。
 *
 * @param options - `withCli` 决定是否渲染第三通道（CLI）
 * @returns 可直接内联进技能正文的 Markdown 段
 */
export function renderCodegraphProbeOrder(options: CodegraphProbeOrderOptions): string {
    if (!options.withCli) {
        return [
            '**CodeGraph 能力探测（本技能不执行 CLI：仅两通道，任一成功即视为可用）**：',
            '1. 先调用 MCP 具名工具（`codegraph_explore` / `codegraph_status` 等）——能返回结果即视为可用；',
            '2. 若 MCP 具名工具未暴露，改看 `codegraph_explore` 返回的**时效横幅**（含索引构建/滞后提示）——横幅存在即视为可用。',
            '- 本技能不执行 CLI：第三通道（CLI 状态查询）不适用，MUST NOT 据其判定索引不可用。',
            ...PROBE_GUARDRAILS,
        ].join('\n');
    }
    return [
        '**CodeGraph 能力探测（按顺序尝试，三条通道任一成功即视为可用）**：',
        '1. 先调用 MCP 具名工具（`codegraph_explore` / `codegraph_status` 等）——能返回结果即视为可用；',
        '2. 若 MCP 具名工具未暴露，改看 `codegraph_explore` 返回的**时效横幅**（含索引构建/滞后提示）——横幅存在即视为可用；',
        '3. 若前两条通道均不可得，再经 Bash 运行 `codegraph status --json`——命令成功并返回 JSON 即视为可用。',
        ...PROBE_GUARDRAILS,
    ].join('\n');
}

/**
 * 锁阶梯文本（唯一源）：读 `writer.pid` 判存活 → 存活只读复用（禁止 unlock / sync）
 * → 不存活才 unlock + 重试一次 → 仍失败降级 Grep + WARN；仅确认无 daemon 时按需 sync 一次。
 */
export const CODEGRAPH_LOCK_LADDER: string = [
    '**CodeGraph 锁阶梯（读锁优先；误删活跃锁会损坏索引）**：',
    '1. **读取** `.codegraph/writer.pid`（用 `path.join()` 构造显式路径）：文件缺失或为空 → 视为**无 daemon**，可进入 unlock 分支；',
    '2. **解析**：该文件为 **JSON**（形如 `{"pid":19488,"mode":"daemon","startedAt":<ms>,"ready":true}`），MUST NOT 假定为裸数字；JSON 解析失败 / `pid` 非正整数 / `ready:false` → 视为**不可判定 = 存活**：MUST NOT `codegraph unlock`、MUST NOT 显式 `codegraph sync`，只读复用索引，查询失败则降级 Glob / Grep 并记 WARN，且 MUST NOT 删除该文件；',
    '3. **存活判定**：`pid` 可用时以只读、无副作用的方式探测进程是否存在（`process.kill(pid, 0)` 语义或平台等价的只读探测）——MUST NOT 执行任何终止动作；',
    '4. **存活 → 只读复用既有索引**：daemon 是合法写者，MUST NOT 执行 `codegraph unlock`、MUST NOT 显式 `codegraph sync`；',
    '5. **不存活 → 执行一次 `codegraph unlock`**，随后重试读取一次；仍失败 → 降级 Glob / Grep 并记 WARN；',
    '6. **仅确认无 daemon（纯 CLI 用户）时**才按需执行一次 `codegraph sync`；同步失败只记 WARN，不阻断流程；',
    '7. 判 daemon 存活是显式路径读取（失败即视为无 daemon），与「MUST NOT 用目录存在性判索引可用性」是两条独立判据，MUST NOT 混用。',
].join('\n');

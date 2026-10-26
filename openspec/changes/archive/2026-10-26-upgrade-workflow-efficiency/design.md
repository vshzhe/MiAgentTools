# design：upgrade-workflow-efficiency

## Context

### 架构影响

本变更是「管线级效率改造」，改动落在三条既有主干的交汇处：**CLI 契约**（扫描产物 + `spec` 子命令组）、**模板单一源**（`src/core/templates/**` 与产物白名单）、**宿主编排协议**（`src/core/host-orchestration/**`）。三项契约的收敛点必须明确，避免改动扩散成多点写死：

| 收敛点 | 承载内容 | 消费方 |
| :--- | :--- | :--- |
| `src/core/project-scan.ts`（+ 新增 `src/core/scan-ignore.ts`） | 遍历语义、忽略规则、软超时、基线 v2 `limits` 契约 | `src/commands/init.ts`、`src/cli/index.ts`、`project-init` 技能、`src/core/legacy-migration.ts`（仅文件名常量） |
| `src/core/templates/tool-whitelist.ts` + 新增 `src/core/templates/codegraph-protocol.ts` | `CODEGRAPH_CLI` 白名单常量、CodeGraph 能力探测顺序与锁阶梯的口径文本 | 5 个引用 CodeGraph 的技能模板 |
| `src/core/templates/prompt-gate.ts` | `GATE_PROTOCOL_PREAMBLE`（门 = 硬停止 + 非门不停）与门白名单的**文本渲染**（数据源在协议层，见下） | 全部含门技能；测试断言 |
| `src/core/host-orchestration/protocol.ts` | `GateWhitelistEntry` / `GATE_WHITELIST`（5 类语义类别 + `anchors` 锚点集合）—— 属**协议层数据**，与 `GateSpec` 同源；`prompt-gate.ts` 反向 import 它渲染文本（模板层依赖协议层，与既有 `project-init.ts` 借用 `project-config` 常量同方向），MUST NOT 定义在模板层让协议层反向依赖 | `prompt-gate.ts` 渲染、`workflows.ts` 对齐断言、生成期测试 |

**现状事实（证据取自 explore-001，已在本次核对）**：

- **扫描**：`MAX_SCAN_DEPTH = 8`（`project-scan.ts:21`）、`MAX_SCAN_FILES = 2000`（`:24`）；截断点在 `walkDir`（`:543`）的 `:569-572`（深度）与 `:585-588`（文件数）；`ScanSink` 携带 `limits: { maxDepth, maxFiles }` 与 `depthLimited` / `filesLimited`（`:272-281`）；`limitDetail`（`:717`）拼装「上限所致」文案；`REPORT_VERSION` 常量为 `1`；`renderScanReport`（`:816`）在 `limits.hit` 时输出一行提示（`:864-866`）。排除清单 `EXCLUDED_DIR_NAMES`（`:55-76`）**已含** `.git` / `node_modules` / `dist` / `build` / `coverage` / `target` / `out` / `bin` / `openspec` 等，**未含** `.next` / `.venv` / `__pycache__`。消费侧 `project-init.ts:167-173` 只读 `signals` / `candidates` / `failures`。
- **索引**：写路径全经 `sqlite3` CLI（`sqlite-index.ts:136-147`），`initDatabase`（`:168`）/ `recreateDatabase`（`:383`）/ `isSqlite3Available`（`:150-157`）；`indexMarkdownEntry`（`markdown-index.ts:21`）单变更 5–6 次进程；`index-cache.ts` 提供 `hashIndexSource` / `readIndexManifest` / `writeIndexManifest`；读侧 `queryExplorationByCapability` / `queryCapabilityConflicts` / `searchDecisions`（`:326` / `:339` / `:359`）零调用点；`spec.ts:272` 注册 `reindex` 命令、`:733` 起为 `indexChangeJsonEntry` 及三个 fallback；`init.ts:39` import、`:317-333` 建库段、`:349` 返回 `indexDbStatus`；`spec-archive.ts:394` / `spec-bulk-archive.ts:367` 调 `reindex --force`；`package.json` 声明 `sql.js`。
- **提交**：`commit.ts:11` 白名单仅 `git status/diff/add/commit/log` + `Read/Glob/Grep`；正文 4 步（`:19-58`），约束段 `:54-58` 要求首次执行前展示清单并确认；`svn-commit.ts:49-88` 已有提案分类提交与尾行 `提案: <name>`（`:72-80`）；`.gitignore` 用 `openspec/` 整目录排除。
- **CodeGraph**：`tool-whitelist.ts` 只有 `CODEGRAPH_MCP`（10 条）与 `SUBAGENT_DISPATCH`，**无 CLI 条目**；`spec-archive.ts:115-130` 为「任何错误一律跳过全部 CodeGraph 步骤」；`spec-archive.ts:241-252` / `spec-bulk-archive.ts:349/:360` 固定 `codegraph sync`；`spec-explore` / `debug.ts:23-28` / `project-init.ts:194` 把 `codegraph_status` 设为无条件首动作；`dependencies.ts` 的 `CODEGRAPH_PACKAGE` 只用于安装提示。
- **门**：`GATE_PROTOCOL_PREAMBLE`（`prompt-gate.ts:115-121`）仅正向约束；`workflow.ts` 无直通句（`auto-workflow.ts:41` 有）；`WORKFLOW_PROTOCOLS`（`host-orchestration/workflows.ts:134-151`）声明的阶段门为 `flow-final-confirmation` / `implementation-bridge`（apply 与 migration 各一处）/ `archive-confirmation` / `diagnostic-confirmation` / `fix-option-confirmation`（条件门）；`render.ts:105` 的「已授权技能直接推进」只出现在 strict 注入段。
- **多 agent**：`BATCH_SCHEDULING_FULL`（`spec-apply.ts:8-75`）为 context-pack 六节协议唯一源；工作区 `.openspec-tmp/apply-<change-name>/`（`spec-apply.ts:12`、`:263` 的 `.gitignore` 补条目逻辑）；`debug.ts:562` 白名单无 `SUBAGENT_DISPATCH`；`debug.ts:240-256` 为探查摘要段。

**影响面小节**：调用点计数与逐项处置见 proposal「Impact > d1 直接调用方」表（② 索引 HIGH、①④⑤ MEDIUM、③⑥ MEDIUM/LOW）。补充三处容易漏的耦合：

1. **`SCAN_BASELINE_FILE` 被 `src/core/legacy-migration.ts` 引用**（旧装机把 `.venus/` 下的扫描基线搬到 `.iagent/`）。本设计**不改文件名与路径**，只改内容 schema → 迁移逻辑无需改；但必须补一条断言测试（搬移后的基线仍可被 v2 读取方解析），避免「改了 schema 忘了旧装机」。
2. **② 与 ④ 落在同一归档段落**（`spec-archive` 的「记忆同步 → CodeGraph → 归档」链）：删除 `reindex` 与改写 CodeGraph 段必须同批提交，否则中间态会出现「步骤编号错位 / 引用已删函数」的不可运行状态。
3. **本轮复核新增的四处落点（原制品遗漏，已在 tasks 补齐）**：
   - `src/core/project-config.ts:216`（`RULE_CONSTANT_LINES.spec` 的 `context-pack` 行）与 `:202`（`impl` 域的「设计先行」行）——`iagent init` / `iagent update` 会**用这两个常量重组 `.iagent/rules/*.md` 的常量块**（`composeRuleFileContent` 在 `:561` 被调用；常量块外的人工域才逐字保留）。故 ⑥ 的包口径与 ⑤ 的「设计先行」豁免 MUST 落在**该常量**上，只改仓库里已被 gitignore 的 `.iagent/rules/spec.md` / `coding-rules.md` 会在下次 `init`/`update` 被覆盖，且对用户侧零生效。
   - `src/core/child-process.ts:30` 的注释「写入子进程 stdin 的内容（sqlite3 等需要）」是 `sqlite3` 字样的唯一残留（`input` 选项的唯一使用者随索引一并消失）→ 若不清理，7.5 的 `sqlite3` 回归锁必然失败。
   - `src/cli/index.ts:14` 的子命令清单注释仍含 `reindex`（proposal 只提了「移除索引结果渲染行」）→ 同属 7.5 回归锁范围。
   - 文档面：`docs/project/README.md:19`、`docs/project/architecture/技术框架.md:33`、`docs/project/modules/模块与功能点.md:90-91`、根 `CONTEXT.md` 的术语表仍描述 `sql.js` / `sqlite-index.ts` / `sqlite-memory-backend.ts`。

### 数据结构与契约

**A. 扫描基线 v2（产物契约，BREAKING）**

```jsonc
{
  "version": 2,                     // v1 → 2
  "scannedAt": "2026-10-26T10:00:00.000Z",
  "scope": { "dirs": 59, "files": 218 },
  "limits": {
    "hit": false,                   // 语义变更：发生任一跳过（非「触及上限」）
    "detail": "未发生跳过",          // 人读文案；hit=false 时为固定中性文案
    "reasons": [],                  // "ignored" | "soft-timeout" | "unreadable"
    "softTimeout": { "ms": 30000, "exceeded": false },
    "skipped": { "ignored": 0, "timeout": 0, "unreadable": 0 }
  },
  "signals": { "build": [], "skeleton": [], "config": [], "routes": [], "docs": [], "tests": [] },
  "candidates": [],
  "failures": []
}
```

对应 TS 契约（`project-scan.ts`）：

```ts
export const SCAN_BASELINE_VERSION = 2;
/** 软超时默认预算（毫秒）；可经 ScanOptions.softTimeoutMs 注入（测试与配置覆盖） */
export const DEFAULT_SCAN_SOFT_TIMEOUT_MS = 30_000;

export type ScanSkipReason = 'ignored' | 'soft-timeout' | 'unreadable';

export interface ScanLimitsV2 {
    hit: boolean;
    detail: string;
    reasons: ScanSkipReason[];
    softTimeout: { ms: number; exceeded: boolean };
    skipped: { ignored: number; timeout: number; unreadable: number };
}

export interface ScanOptions {
    writeBaseline?: boolean;
    softTimeoutMs?: number;        // 默认 30s
    respectIgnoreFiles?: boolean;  // 默认 true；false 时只用固定忽略清单
    now?: () => number;            // 可注入时钟（软超时判定可测）
}
```

**字段契约（逐字段：类型 / 约束 / 默认值 / 业务含义）**

| 字段 | 类型 | 约束 | 默认值 | 业务含义 |
| :--- | :--- | :--- | :--- | :--- |
| `version` | 字面量 `2` | 写入方 MUST 恒写 `2`；读取方据其分支 | `2` | 结构版本；`1` 或缺失按 v1 只读解析 |
| `scannedAt` | ISO 8601 字符串 | 每次 init 覆盖刷新 | 采样时刻 | 基线生成时间 |
| `scope.dirs` / `scope.files` | 非负整数 | 按实际遍历条目计数（忽略项不计入） | `0` | 探测范围，用于判断「扫了多大」 |
| `limits.hit` | boolean | `reasons` 为空时 MUST 为 `false`；有任一跳过即 `true` | `false` | 本次是否发生过跳过（原「触及上限」语义废止） |
| `limits.detail` | 字符串 | `hit=false` 时为固定中性文案；`hit=true` 时逐类说明原因 | `未发生跳过` | 人读文案（保留给既有读方） |
| `limits.reasons` | `ScanSkipReason[]` | 取值域 `ignored` / `soft-timeout` / `unreadable`；去重、按发生顺序 | `[]` | 跳过原因集合，供消费侧分类展示 |
| `limits.softTimeout.ms` | 正整数 | 默认 `DEFAULT_SCAN_SOFT_TIMEOUT_MS`，可经 `ScanOptions.softTimeoutMs` 覆盖 | `30000` | 软超时预算 |
| `limits.softTimeout.exceeded` | boolean | 超时发生即 `true`，且此时 `skipped.timeout > 0` | `false` | 本次是否被软超时截断（受控停止，不算失败） |
| `limits.skipped.ignored` | 非负整数 | 按**条目**计数；目录命中计 1（不展开未知子项） | `0` | 忽略清单 / 忽略规则跳过的条目数 |
| `limits.skipped.timeout` | 非负整数 | 与 `softTimeout.exceeded` 同真同假（`exceeded=true ⇒ ≥1`）；语义见下方「边界 > `skipped.timeout` 可判定语义」 | `0` | 软超时导致的未处理条目数（停止点起至本层枚举结束；不含未展开子树） |
| `limits.skipped.unreadable` | 非负整数 | 与 `failures[]` 的不可读条目一一对应 | `0` | 不可读条目数 |
| `signals.*` / `candidates` / `failures` | 既有结构 | 本变更仅新增 `signals.tests` 的「因软超时跳过」标注语义，其余字段不变 | `[]` | 事实 / 候选 / 失败项（既有语义） |

**v1 → v2 映射**：`maxDepth` / `maxFiles`（删除，无对应字段）；`depthLimited` / `filesLimited`（删除，由 `reasons` + `skipped` 表达）；`hit` / `detail` 保留字段名但语义收敛为「跳过」。

**兼容判别**：读方按 `version` 分支 —— `2` 读 v2 字段；`1` 只读 `limits.hit` / `limits.detail`（旧结构无 `skipped`）；`version` 缺失按 v1 处理。`createEmptyScanReport()`（`--no-scan` 占位）同步产出 v2 空值。

**B. 忽略规则匹配（新模块）**

```ts
export interface IgnoreMatcher {
    /** 判定项目相对 posix 路径是否应跳过；目录与文件同一入口 */
    ignores(relPath: string, isDir: boolean): boolean;
    /** 解析期告警（解析失败 fail-open 时记录） */
    warnings: string[];
}

/** 解析顺序：内置固定目录清单（调用方先判）→ .gitignore（根 + 嵌套）→ 自定义 ignore 文件 */
export function createIgnoreMatcher(projectRoot: string, options?: { respectIgnoreFiles?: boolean }): IgnoreMatcher;
```

规则语义：支持 `#` 注释、`!` 否定、尾部 `/` 仅目录、`**` 与 `*` 通配、无 `/` 的模式匹配任意层级 basename；嵌套 `.gitignore` 生效范围限于其所在子树。**fail-open**：任一 ignore 文件解析抛错 → 忽略该文件、记 `warnings` 与 `skipped.unreadable` 计数、**不过滤**（宁可多扫，不可漏扫）。

**实现约束（TypeScript / 跨平台）**：新模块及其消费方 MUST 以 ESM 相对导入接入（`import ... from './scan-ignore.js'`，与仓库既有 `.js` 后缀约定一致）；所有文件系统访问 MUST 经 `path.join()` 构造路径；匹配前统一转为 posix 归一形式（反斜杠 → `/`），MUST NOT 用原生分隔符做字符串比较（Windows 兼容，见 `AGENTS.md` 守则 6）。

**C. CodeGraph 白名单与口径**

```ts
/** CLI 形态条目：与 MCP 是两套命名，互不覆盖 */
export const CODEGRAPH_CLI: string = 'Bash(codegraph:*)';
```

`codegraph-protocol.ts` 导出两段可插值文本（唯一源，5 个技能共用）：

- `CODEGRAPH_PROBE_ORDER`：`MCP 具名工具 → codegraph_explore 时效横幅 → CLI status --json`，并声明「工具名缺失 ≠ 索引不可用」。
- `CODEGRAPH_LOCK_LADDER`：`读 writer.pid → 存活则只读复用（禁止 unlock）→ 不存活才 unlock + 重试一次 → 仍失败降级 Grep + WARN`，并声明「仅确认无 daemon 时按需 sync 一次」。

**渲染两形态（本轮补正 —— 解决「插值即等于声明 CLI 调用」的权限矛盾）**：探测文本含第三通道（CLI `status --json`），若所有引用者都插值全文，则**凡插值者都等于声明了一次 CLI 调用**，与「`migration` 不跑 CLI、不加 `CODEGRAPH_CLI`」直接冲突。故单一源改为**同一函数两种渲染**：

```ts
export function renderCodegraphProbeOrder(options: { withCli: boolean }): string;
// withCli=true  → 三通道全文（调用方 MUST 同时具备 CODEGRAPH_CLI）
// withCli=false → 仅通道 1/2，并声明「本技能不执行 CLI：第三通道不适用，MUST NOT 据其判定不可用」
```

MUST NOT 为此新增第二份手写文本（那会破坏单一源）；测试 SHALL 断言两形态同源（同一函数、仅分支不同）且 `withCli=true` 的调用方白名单均含 `CODEGRAPH_CLI`。

**D. 门白名单（协议层常量）**

```ts
export interface GateWhitelistEntry {
    /** 类别标识 */
    id: 'requirement-clarification' | 'flow-final-confirmation' | 'implementation-bridge'
        | 'archive-confirmation' | 'destructive-change';
    /** 锚点集合：该类别覆盖的阶段门 id 或技能内动作（一对多；5 类不等价于 5 个 gate id） */
    anchors: readonly string[];
    /** 是否可条件豁免（破坏性改动确认不可豁免） */
    conditional: boolean;
}
export const GATE_WHITELIST: readonly GateWhitelistEntry[];
```

**类别 → 锚点映射（5 类 ≠ 5 个阶段门）**：

| 类别 | 锚点（阶段门 id 或技能内动作） | 现有 `PhaseSpec.gate.id` |
| :--- | :--- | :--- |
| `requirement-clarification`（需求 / 方案歧义） | L1-L5 澄清门、提示词校验门、grill 批量确认、诊断结论确认、修复方案选择 | `diagnostic-confirmation`、`fix-option-confirmation`（条件门） |
| `flow-final-confirmation` | 功能流程图最终确认门 | `flow-final-confirmation` |
| `implementation-bridge` | Phase 3.7 实现 + 测试桥 | `implementation-bridge`（`workflow.apply` 与 `migration.implement-and-check` 各一处） |
| `archive-confirmation` | Phase 5 归档桥 | `archive-confirmation` |
| `destructive-change`（动作级，不可豁免） | 删除目录 / 覆盖既有制品 / 改写版本库跟踪 / 不可逆命令 | 无（MUST NOT 占用阶段门预算） |

> **可满足性前提（本轮验证补正）**：白名单按**语义类别**枚举，一个类别可含多个锚点；`WORKFLOW_PROTOCOLS` 现有 5 个 gate id（`flow-final-confirmation` / `implementation-bridge` / `archive-confirmation` / `diagnostic-confirmation` / `fix-option-confirmation`）全部落入上表锚点集合。若按「5 类 = 5 个门 id」的字面理解，`diagnostic-confirmation` 与 `fix-option-confirmation` 无处挂靠，生成期断言必然失败 —— 故在此显式记录一对多映射，MUST NOT 通过删改既有门来凑对齐。

对齐方式：`WORKFLOW_PROTOCOLS` 的每个 `PhaseSpec.gate.id` **必须**在 `GATE_WHITELIST` 的 `anchors` 集合内（生成期测试断言）；`PhaseSpec` 结构、`GateConditionId` 与 `evaluatePhaseTransition` 判定**均不变**（不新增阶段阻塞门，避免破坏「每阶段至多一个阻塞门」预算）。

**E. handoff 包（临时制品契约）**

```text
.openspec-tmp/pipeline-<change-name>/
└── handoff-pack.md          # 六节 + 可选「## 阶段结论」
```

- 包头部固定元信息行：`change: <name>` / `producedBy: propose|verify|apply|archive` / `producedAt: <ISO>` / `sourceFingerprint: <hash>`（制品内容指纹，覆盖 proposal/design/specs/tasks）。
- 六节固定顺序：`## 变更摘要` / `## 契约` / `## 规范要点` / `## 文件归属表` / `## Codebase 摘要` / `## 已产出（跨单元可见）`。
- 只追加段：`## 已产出`（apply 的产出登记表）与 `## 阶段结论`（每个阶段一条，含 `phase` / `status` / `artifact` / `nextAllowed` 四列）。
- 指纹不一致 → 重建（记 WARN，不静默沿用）；产物缺失/不可写 → 退化为内联注入 + WARN（沿用既有 fail-safe）。

**F. 索引移除面（一次性清空清单）**

| 面 | 位置 |
| :--- | :--- |
| 模块 | `src/core/spec/sqlite-index.ts` / `markdown-index.ts` / `index-cache.ts` / `sqlite-memory-backend.ts` |
| 命令 | `src/commands/spec.ts` 的 `spec.command('reindex')` 与 `indexChangeJsonEntry` / `indexSpecsMdFallback` / `indexDesignMdFallback` / `indexExplorationMdFallback` / `extractModule` 等辅助 |
| 入口 | `src/commands/init.ts` 的 import 与建库段、`InitResult.indexDbStatus` |
| 模板 | `spec-explore.ts` 历史记忆的索引分支；`spec-archive.ts` / `spec-bulk-archive.ts` 的 `reindex` 步骤 |
| 补全 | `src/commands/completion.ts` 的 `spec.subcommands` |
| 旧装机迁移 | `src/core/legacy-migration.ts`：`LEGACY_INDEX_DB_FILE` / `LEGACY_INDEX_DIR_RELATIVE_PATH`（旧品牌 `openspec/changes/archive/.venus/` 清理，保留）与 `:793` 的 `reindex` 提示文案（改为中性，MUST NOT 指向已删命令）；同文件的 `:92` / `:390` / `:749` 注释与 `legacy-install-migration` 主规格 `:197` / `:214-217`（Requirement 与 Scenario 明写「提示可用 reindex 重建」）必须同步 MODIFIED，否则归档后主规格与实现互相矛盾 |
| 依赖 | `package.json` 的 `sql.js` |
| 残留字样 | `src/cli/index.ts:14`（子命令清单注释含 `reindex`）、`src/core/child-process.ts:30`（`sqlite3` 注释；`input` 选项的唯一使用者随索引消失）→ 二者属 7.5 回归锁范围，必须同批清理 |
| 测试 | `test/sqlite-index.test.ts`、`test/markdown-index.test.ts`（整文件删除）；`test/spec-commands.test.ts` 的 `describe('iagent spec reindex（内存后端…）')` 段与 `MemoryBackend` import（整段删除）；`test/legacy-migration.test.ts` 的 `reindex` 提示断言（改中性） |
| 文档 | `AGENTS.md` 仓库地图与约定、`docs/upgrade-guide.md`、`CHANGELOG.md`、`docs/project/**`（README / 技术框架 / 模块与功能点）与根 `CONTEXT.md` 的术语表 |

**G. 分批策略（DEC-6，两批次同一变更）**

| 批次 | 内容 | 排序理由 | 提交簇 |
| :--- | :--- | :--- | :--- |
| 批次一 | `debug` 补派发 + 四列回执 + 探查摘要升格（⑥-half） | 补最大空白、风险最低、不触碰其他技能的包协议 | 独立簇，可单独 revert |
| 批次二 | handoff 包泛化（⑥-half） | token 收益最大但改动面跨 5 个技能，需在批次一定稿后统一改写 | 独立簇 |

六个改动簇的提交粒度（各自可独立 revert）：① 扫描 / ②+④ 归档与索引（**必须同批**）/ ③ 提交 / ⑤ 门 / ⑥ 批次一、批次二。② 与 ④ 的耦合见「影响面小节」。

### ADR 引用

- **ADR-0001（既有，`openspec/docs/adr/0001-venus-spec-selfcontained.md`）**：`spec` 命令组自持、delta 合并由技能 AI 执行 —— 本变更**不触碰**该决策（移除的是索引旁路，`spec new/status/instructions/archive/validate` 全部保留）。
- **ADR-0002（本变更新增，`openspec/docs/adr/0002-retire-sqlite-cross-change-index.md`）**：退役跨变更 SQLite 索引。explore-001 曾建议编号 0001，但该编号已被既有 ADR 占用，故顺延为 0002（记录编号修正）。该决策满足「难以逆转 + 脱离上下文会令人意外 + 真实权衡」三条件（删依赖 + 删命令 + 删能力）。
- 其余五项均为模板正文 / 常量层面的**可逆**改动（回滚 = 还原模板与常量），按仓库惯例不单独建 ADR。

## Goals / Non-Goals

**Goals**

1. 扫描不再有臆造上限：深目录与大规模项目按实际情况采集，跳过原因（忽略 / 软超时 / 不可读）成为**可计数、可呈现**的事实（`skipped` 计数器 + 消费侧强制呈现）。
2. 删除净成本为负的跨变更索引链路：每次归档省掉约 10s 的全量重建与一次 legacy 崩溃面。
3. 提案制品随代码进版本库并有溯源：Git 侧获得与 SVN 侧同构的「精确暂存 + 尾行 `提案: <name>`」，人工闸保留。
4. CodeGraph 使用不再自伤：去掉与 daemon writer 争锁的显式 sync，探测不再绑定单一工具名，锁竞争有阶梯可走，权限面与正文同步。
5. 确认门收敛为正向白名单：只为「需求歧义 + 不可逆操作」付门成本，纯委派动作不停顿。
6. 跨阶段上下文一次蒸馏、五阶段复用：主上下文与派发侧 token 双降；`debug` 获得派发形态。

**Non-Goals**

- 不改技能数量（仍 20 个）、不改 `SKILL_TYPES`（9 类）、不改技能 id 与指令 id 派生。
- 不改 `parseProjectConfig` / `readProjectConfig` 契约与 `.iagent/rules/` 文件命名映射。
- 不改 `evaluatePhaseTransition` 判定语义、不新增阶段阻塞门、不改门预算（每阶段 ≤1）。
- 不引入 `git ls-files` 枚举（Q1=D 已否决）、不引入新运行时依赖（本变更**净删**依赖）。
- 不把 `commit` 改为自动提交（人工闸保留）、不改 SVN 侧「未纳管默认不提交」。
- 不在本变更内实现需求文档生成桥的变更（父流程职责）。
- 不做 `skill-template-language` 调整：新增正文全中文，无英文自然描述句。

## Decisions

### D1: 扫描契约 v2 —— 无上限 + 忽略清单 + 软超时

**决策**：删除深度与文件数上限（`MAX_SCAN_DEPTH` / `MAX_SCAN_FILES` 及 `depthLimited` / `filesLimited`）；有界性由「固定忽略清单 + `.gitignore`/自定义 ignore + 30s 软超时」三件承担；`limits` 升 v2（`reasons` / `softTimeout` / `skipped`），`hit` 语义改为「发生任一跳过」。

**取舍**：
- **软超时 vs 数量阈值**：阈值与项目结构无关（本仓库 218 文件 11ms，而深度 10 的单文件被丢），坏处是「不可解释的漏」；软超时的时间上限与「项目有多大」正相关，且超时是**受控停止**，用 `skipped.timeout` 把「漏了什么」变成事实。代价：超大 monorepo 的部分扫描成为常态，因此**必须**在报告与基线双写提示，且消费侧必须呈现。
- **忽略清单 vs git-first 枚举**：git 枚举更准（天然尊重 `.gitignore`、无深度概念，实测 53ms/218 文件），但用户裁决 D 明确不引入 VCS 依赖；改为**自己解析** `.gitignore`（额外收益：非 Git 项目也能用同一套自定义 ignore）。
- **`hit` 保留 vs 改名为 `skipped`**：保留 `hit`/`detail` 使既有读方（规格要求的「必须说明是上限所致」）不破，只把语义从「上限」收敛为「跳过」；新增结构化字段承载可计数事实。
- **`version` 判别 vs 只写新结构**：写 `version: 2` 让升级期的混用可诊断；读方按版本分支，老基线（v1）仍可读，避免「升级后首次 init 前技能不可用」。

**边界**：
- 软超时的时钟与预算可注入（`now` / `softTimeoutMs`），否则纯计时测试不可靠。
- 忽略匹配 **fail-open**：解析失败宁可多扫（多扫只花时间，漏扫会产生错误结论）。
- 跳过计数按「条目数」而非「字节数」；目录命中忽略清单时计 **1**（不展开统计不可知的子项数）。
- `openspec` / `.iagent` / `.claude` 等 iagent 自身产物**仍在**忽略清单内（纳管 `openspec/changes/**` 只影响 VCS，不影响扫描语义）。
- **`skipped.timeout` 的可判定语义（本轮补正）**：DFS 在停止点之后无法枚举「未遍历到的条目总数」，故该字段定义为「因软超时未完成处理的条目数，**从停止点起逐个计至本层枚举结束**」：到点时正在归类的条目计 1，其后同一目录下已 `readdir` 返回但未处理的同级条目逐个计 1；**不**递归统计未展开子树的未知子项。恒满足 `exceeded=true ⇒ timeout ≥ 1`，且 MUST NOT 被解读为「精确漏扫量」。消费侧文案统一为「因软超时跳过 N 项（可能不完整）」。
- **`signals.tests` 的截断标注载体（本轮补正）**：不新增字段。截断事实由 `limits.softTimeout.exceeded` + `limits.skipped.timeout` 承载，`signals.tests[]` 仍只记已计数部分；消费侧据 `exceeded` 把该计数标为「不完整，MUST NOT 推断框架结论」。规格正文的「标注」措辞按此对齐，MUST NOT 另造 `truncated` 一类字段（保持 v2 schema 与 §A 逐字段表一致）。
- **软超时与忽略开关的配置载体（本轮补正）**：`ScanOptions` 是库级入口，但 `iagent init` 需要可注入路径，否则「退出码 0 + 双写提示」的验收不可测。故：
  - `respectIgnoreFiles` 的关闭面 = `iagent init --no-scan-ignore`（与 `--no-scan` / `--no-deps` 同构的逃生阀；**不**新增 `config.yaml` 段，`parseProjectConfig` 契约不变）；
  - `softTimeoutMs` 的覆盖面 = 环境变量 `IAGENT_SCAN_SOFT_TIMEOUT_MS`（正整数毫秒；非法值忽略并 WARN），供 e2e 测试与超大项目调优；
  - 二者均**不进**基线 schema，也不改变默认值（30s / 尊重忽略规则）。

### D2: 索引退役的完整边界

**决策**：`sqlite-cross-change-index` **整能力退役**，其 6 条 Requirement 全部 REMOVED（4 条核心行为 + 2 条 reindex 专属：Markdown 主来源、全文结果保留证据）；命令、模块、init 段、归档步骤、补全表、依赖、测试一次性删除；**不留**弃用桩；**不删**用户历史 `index.db`。

**理由**：
- 保留 5/6 两条（reindex 行为）会让主规格继续要求一个不存在的命令 —— 归档合并后即产生规格漂移，与本次「消除漂移」的目标相反。DEC-2 已裁决「移除 `iagent spec reindex` 命令与全部辅助」，故 6 条属同一决策的完整落面。
- 不留弃用桩：留桩会把 `spec reindex` 字样保留在 CLI 帮助、补全表与源码里，与新增回归点「源码 / 模板 / 文档零 `reindex` 引用」直接冲突，也让「删除」变成两个版本周期的拖尾。BREAKING 通告足以承担迁移成本（`CHANGELOG` 的 `### BREAKING` + `docs/upgrade-guide.md`）。
- 不删历史 `index.db`：用户目录中的文件不属于产物；`iagent update` 的既有语义是「不主动删除用户文件」。只在升级文档里给出清理指引。

**替代方案（否决）**：懒建 + 进程内 `sql.js` + `iagent spec memory` CLI（否决：为不存在的检索需求维护 WASM 持久化与旧库迁移）；仅修 bug（否决：成本与「只写不读」的根因仍在）。

### D3: 提案制品纳入 —— 纳管 + 精确暂存 + 不自动 commit

**决策**：
- 纳管拓扑：`.gitignore` 保留 `openspec/` 的其余排除，**放行** `openspec/changes/**` 下的 Markdown 制品（`proposal.md` / `design.md` / `tasks.md` / `exploration.md` / `specs/**/spec.md`），继续忽略 `openspec/changes/archive/.iagent/`、`.iagent/` 与 `.openspec-tmp/`。
- **`.gitignore` 规则链（必须按此形态，否则放行无效）**：git 的「父目录被排除时子路径无法用 `!` 重新纳入」规则意味着**不能**在保留 `openspec/` 的同时用 `!openspec/changes/**` 放行。实际写法 MUST 为「先通配排除、再逐目录放行」：

  ```gitignore
  # openspec 本地产物（默认不纳管；仅纳管提案制品）
  openspec/*
  !openspec/changes/
  openspec/changes/archive/.iagent/
  ```
  说明：`openspec/*` 只作用于 `openspec/` 的直接子项；`!openspec/changes/` 放开该目录；`archive/.iagent/` 为历史索引/清单缓存（`index.db` / `index-manifest.json`），MUST 保持忽略。MUST NOT 写成「`openspec/` + `!openspec/changes/**`」（git 语义下放行不生效，且该错误不会被测试发现 —— 只能靠手工 `git status` 验证，故 3.3 的验收必须真的跑 `git status`）。
- **纳管范围的三项显式取舍（本轮补正）**：
  1. **`openspec/changes/archive/**` 一并纳管**（遵循 DEC-3 字面 `changes/**`）：历史 42 个变更的 312 个 Markdown 制品首次纳管时会一次性成为未跟踪项（约 3.8MB）；这是「归档后规格合并结果（`openspec/specs/**` 仍忽略）不至于完全失去可追溯性」的唯一来源。首次提交由用户在 `commit` 人工闸下确认。
  2. **`attachments/**` 与 `.openspec-tmp/**` 在 `.gitignore` 层面排除**（不只依赖提交清单）：`attachments` 共 59 个文件 / 约 0.45MB，属变更附件（截图 / 样本），不是提案文本；仅靠「默认清单不含」挡不住 `git add -A` 或 IDE 全量暂存。
  3. **`openspec/explorations/**` 保持忽略（不纳管）**：DEC-3 的「范围含 `exploration.md`」指**变更目录内**的 `exploration.md`（归档变更的既有布局），不是仓库级 `openspec/explorations/*.md`（当前 20 个文件 / 约 0.47MB，且本变更自身的探索文件按 D8 保持原位）。若要纳管探索记录，回滚点 = 加 `!openspec/explorations/` 并把该前缀加入精确暂存清单的允许前缀。
  4. **`openspec/CONTEXT.md` / `openspec/specs/**` / `openspec/devdocs/**` / `openspec/rules/**` / `openspec/config.yaml` 保持忽略**（`openspec/*` 已覆盖）：它们是本机语义产物或 OpenSpec CLI 的本地状态，不属本变更的纳管目标；`specs/**` 的「合并后主规格不入库」是既有约定，本变更不改变（如需改变须另开变更）。
- 暂存契约：清单由**活跃变更名 + 固定文件名模板**生成，逐条校验前缀 `openspec/changes/<active>/`；`attachments/**` 与 `需求文档.md` 不进默认清单。**MUST NOT** `git add -A` / `git add openspec`。
- 时机：`spec-apply` 完成段执行「精确暂存 + 提示」；`commit` 技能在提交前做同样的纳入（幂等：已暂存则跳过）。
- 溯源：提交信息主体保持 Conventional Commits 一行式，**尾行** `提案: <change-name>`（与 `svn-commit.ts:72-80` 完全同格式，便于跨 VCS 检索）。
- 人工闸：`commit.ts:54-58` 的「首次执行前展示清单与信息并确认」**不豁免**；`init` 只提示纳管策略，不擅自改业务 `.gitignore` 条目。

**理由**：「自动提交」与既有不可撤销约束冲突（模板会自相矛盾），而 apply 后的暂存提示消除了「提交时找不到提案」的实际痛点；尾行溯源对齐 SVN 侧既有实现，避免两套格式。

**边界**：无活跃变更 → 退化为普通提交（不加尾行）；暂存失败（权限 / 路径不存在）→ WARN + 提示手动处理，**不阻断** apply 收尾。

### D4: CodeGraph —— 探测顺序 + 锁阶梯的单一源

**决策**：
1. `tool-whitelist.ts` 新增 `CODEGRAPH_CLI = 'Bash(codegraph:*)'`；正文确需跑 CLI 的 5 个技能（`spec-archive` / `spec-bulk-archive` / `spec-explore` / `debug` / `project-init`）白名单引用该常量。
2. 探测顺序与锁阶梯文本收敛到新模块 `src/core/templates/codegraph-protocol.ts`，5 个技能插值引用（MUST NOT 各自手写）。`migration` 正文的「遵循 `codegraph_status` 优先规则」措辞随 `CODEGRAPH_PROBE_ORDER` 引用一并更名（该技能不跑 CLI，故不进入 `CODEGRAPH_CLI` 的 5 技能清单）。
3. 删除技能内无条件 `codegraph sync`；保留条件句「确认无 daemon（纯 CLI 用户）时按需 sync 一次」。
4. `writer.pid` 存活期间**禁止** `unlock`（存活即认为 daemon 是合法写者，只读复用 WAL 快照）。

**理由**：根因是「谁拥有 DB 谁应同步」被技能越权承担；探测根因是「探测手段被绑定为单一工具名」，而宿主工具面并不保证齐全（实测只挂 `codegraph_explore`）。`unlock` 只在进程不存活时执行，避免误删活跃锁导致索引损坏（R-4b）。

**边界**：能力探测的 3 条通道任一成功即视为可用；全部失败 → 降级 Grep/Read + WARN，**不询问用户**（沿用既有非阻断）；`dependencies.ts` 的安装/检测口径不变（只可选增强提示文案）。

**`writer.pid` 实现契约（本轮核实后补正 —— 该文件真实存在，但格式是 JSON 而非裸 pid）**：

实测 `.codegraph/writer.pid` 内容为 `{"pid":19488,"mode":"daemon","startedAt":1793013424572,"ready":true}`（`.codegraph/daemon.pid` 另含 `version` / `socketPath` / `startedAt`，为 daemon 自身的 pid 记录）。因此锁阶梯 MUST 按如下判据实现，MUST NOT 假定文件内容是裸数字：

1. **读取**：`Read` `.codegraph/writer.pid`（`path.join()` 构造）。文件缺失 / 空 → 视为**无 daemon**（可进入 unlock 分支）。
2. **解析**：JSON 解析失败或 `pid` 非正整数 → 视为**存活态（不可判定）**：MUST NOT `unlock`、MUST NOT 显式 `sync`，只读复用索引；若随即查询失败则降级 Grep + WARN。理由：误删活跃锁会损坏索引（R-4b），而误判「存活」的代价只是多用一次只读查询。
3. **存活判定**：`pid` 可用时以「只读、无副作用」的方式判定进程是否存在（`process.kill(pid, 0)` 语义或平台等价的只读探测）——**禁止** `kill`/`taskkill` 等终止动作。
4. **阶梯**：存活 → 只读复用（禁止 unlock / sync）；不存活 → `codegraph unlock` 一次 → 重试读取一次 → 仍失败降级 Grep + WARN。
5. **`ready` 字段**：`ready:false` 时按「不可判定」处理（同上第 2 条），MUST NOT 据其判定索引可用性。

**既有护栏必须保留（不得被新探测顺序覆盖）**：`spec-archive.ts:121` 的「MUST NOT 用 Glob 预检 `.codegraph/` 目录是否存在」仍然有效（点号目录的 Glob 假阴性会把 CodeGraph 误判为未初始化）。注意区分两件事：**判索引可用性** MUST NOT 用目录存在性（只走三通道）；**判 daemon 存活** 读取 `.codegraph/writer.pid` 属显式路径读取（失败即「无 daemon」），不违反该护栏。`CODEGRAPH_PROBE_ORDER` / `CODEGRAPH_LOCK_LADDER` 文本 MUST 同时写清这条区分。

**CLI 语义已核实**：`codegraph unlock [path]` = "Remove a stale lock file that is blocking indexing"，`codegraph status -j/--json` 存在 —— 探测第三通道与锁定修复均有对应 CLI 能力，方案可实现。

### D5: 门白名单与直通句

**决策**：
1. `GATE_WHITELIST`（5 类 + `anchors` 锚点集合 + `conditional`）定义在**协议层** `src/core/host-orchestration/protocol.ts`（与 `GateSpec` 同源，供 `workflows.ts` 对齐断言直接消费）；`prompt-gate.ts` 的 `GATE_PROTOCOL_PREAMBLE` 增加负向边界句：「非门动作（阶段宣告 / 技能委派 / 只读扫描 / CodeGraph 查询 / 状态查询）MUST NOT 停止，也 MUST NOT 请求确认」，并 import 白名单渲染门清单文本（模板层依赖协议层，禁止协议层反向 import 模板层）。
2. `workflow.ts` 四处委派点补直通句（范本 `auto-workflow.ts:41`）；`auto-workflow` / `debug` / `migration` / `spec-*` 补「MUST NOT 请求确认清单」段。
3. `host-orchestration` 以 `GATE_WHITELIST` 的 `anchor` 集合约束 `PhaseSpec.gate.id`；`PhaseSpec` 与 `evaluatePhaseTransition` **不变**；「破坏性改动确认」以 `conditional: false` 的独立条目表达，不新增阶段门。
4. `.iagent/rules/coding-rules.md` 的「设计先行」豁免口径 → **列 tasks**（本阶段不改规则文件）。
5. **既有只读校验询问的收口**：`spec-verify-proposal`、`workflow` 正文与其参考协议 `VERIFICATION_PROTOCOL_FULL`（产出 `references/verification-protocol.md` 3.4）现有的「检测到技术栈：…是否运行技术栈专项校验？」[是][否] 属**只读校验询问**，按负向清单改为**直接执行并在报告中说明校验项**；三处文本 MUST 同批改写（MUST NOT 只改模板而留下参考文件内的旧询问）。

**为什么用正向枚举**：排除式写法（「删除哪些门」）写漏会让业务门消失；正向枚举写漏只会多留门（fail-safe）。「破坏性改动确认」独立成条、不依赖阶段门，是第二重保险。

**为什么不改 `evaluatePhaseTransition`**：它是协议层判定（门/回执/能力三要素），模板正文其实并未消费其返回值；改判定会牵动 3 处调用与 3 个宿主适配器测试，收益为零。对齐只需「门清单 ⊆ 白名单」的结构断言。

**门预算一致性**：必留 5 类中，「需求澄清门」与「流程图门」同属探索阶段（澄清门在 grill 首批内、流程图门为流程级阻塞门），不新增第二阶段门；「实现 + 测试桥」「归档桥」各对应一个已声明阶段门；「破坏性改动确认」为动作级安全条。

### D6: handoff 包（跨阶段上下文）

**决策**：`context-pack` 泛化为变更级 `handoff-pack.md`，落 `.openspec-tmp/pipeline-<change-name>/`；propose 产出，verify/apply/archive 只读 + 追加；六节不变 + 可选 `## 阶段结论`；头部 `sourceFingerprint` 校验，不一致重建。

**理由**：
- 位置复用已 gitignore 的 `.openspec-tmp/`，**不进入提交面**（与 DEC-3 的纳管范围互斥问题就地消解）。
- 「一次蒸馏、多阶段引用」是唯一能把跨阶段 150k 压到 ~37k 的结构性手段；包是**蒸馏视图**而非替代品（缺口回执 + 回查制品兜底）。
- 用 `propose` 作产出者：propose 结束时制品已定稿（proposal/design/specs/tasks 齐全），是「信息最完整且只需一次」的时点。

**边界**：
- 独立调用 `spec-apply`（无父流程）时，若包不存在 → 按同一六节协议产出一次（不引入第二套格式）。
- 包不可写 → 退化内联注入 + WARN（沿用 `spec-apply.ts` 既有 fail-safe），MUST NOT 阻断。
- 清理：阶段收尾清理 `.openspec-tmp/pipeline-<change>/`；迁移期同时识别旧 `apply-<change>/` 前缀（下一版本移除旧前缀）。
- `debug` 的 `investigation-digest`（`.openspec-tmp/debug-<keyword>/`）保留为**前置来源**：`changeName` 确定后其结论进入包的 `## Codebase 摘要`，不重复探查、也不替代诊断记录。

### D7: 分批实施与提交粒度

**决策**：同一变更内两批次（⑥ 批次一 → 批次二），六个改动簇独立提交，② 与 ④ 同批。

**依赖序**：①（扫描契约，独立）→ ② + ④（同批，归档段耦合）→ ③（提交，独立）→ ⑤（门，独立）→ ⑥ 批次一（debug 派发）→ ⑥ 批次二（handoff 包，依赖批次一的回执形态与 `## 已产出` 语义）→ 版本与文档收口。

**理由**：批次一补齐 `debug` 的派发与四列回执，为批次二的包协议提供既有的回执与登记表语义（避免两批各写一套）；版本号与 CHANGELOG 在模板与文档定稿后写（`AGENTS.md`：版本号随功能提交一并提交）。

**批次一必须可独立实施与独立 revert（本轮补正）**：`workflow-suite-skills / debug 修复循环的派发形态` 正文写了「子代理读 handoff 包」，而包是批次二的产物 —— 若按字面实现，批次一将依赖批次二。故批次一 MUST 采用以下降级口径：**包存在则读包；包不存在时子代理读「`investigation-digest` 摘要 + 本单元 bug 清单 + 文件归属」三件**，MUST NOT 因缺包而拒绝派发、MUST NOT 在批次一自建第二套包格式。批次二再把「包不存在」分支改为「本技能按六节协议产出一次」。

**4.8 的次序**：4.8（allowed-tools / adapter 断言）同时覆盖 ④ 的 `CODEGRAPH_CLI`、③ 的 commit 正文与 ⑥ 批次一的 debug 派发，故它 MUST 在 5.1 之后完成；⑤ 的「收口」以 4.6 / 4.7 为界（4.8 归入批次一之后的回归批），MUST NOT 因它把批次一提前。

### D8: 版本、文档与探索文件处置

**决策**：
- `version` **1.0.2 → 2.0.0**（major）；`CHANGELOG` 归档 `[Unreleased]` → `## [2.0.0] - 2026-10-26`，保留空 `[Unreleased]`，同步底部链接。
- `AGENTS.md` / `README.md` / `docs/upgrade-guide.md` 同步（条目见 proposal「版本与配套」）。
- **探索文件不迁移**：`openspec/explorations/iagent-workflow-efficiency-upgrade-explore-001.md` 保持原位。理由：`delegated` 模式下父编排持有该路径并作为回执字段（`exploration_file`）；迁移会让路径失效并产生「父编排与变更目录两份真源」的二义。制品内以「语义来源」引用，不复制副本。**已知后果（必须显式承担）**：按 D3 的纳管范围（放行 `openspec/changes/**`、`openspec/explorations/**` 仍忽略），本变更的探索文件**不会**随本变更入库；它的可追溯性由「父编排回执 + 制品内的语义来源引用」承担。若需入库，回滚点见 D3 第 3 条第 4 点（加 `!openspec/explorations/` 并扩允许前缀），属同簇可逆改动。

## Risks / Trade-offs

### 风险与缓解

| 编号 | 簇 | 风险 | 等级 | 缓解 / 回滚 |
| :--- | :--- | :--- | :--- | :--- |
| R-1 | ① | 基线 v1→v2 产物契约变更；读 `maxDepth`/`maxFiles` 的第三方消费方失效 | **BREAKING** | `version` 判别分支（v1 只读 `hit`/`detail`）；完全回滚 = 恢复两常量与两个 `*Limited` 分支（单文件） |
| R-1b | ① | 忽略规则解析过度忽略（漏扫源码） | 中 | fail-open + WARN；`scan.respectIgnoreFiles=false` 可整体关闭 |
| R-1c | ① | 大项目「部分扫描」成常态 | 中 | `softTimeoutMs` 可配（默认 30s）；超时**必须**进报告与基线；消费侧强制呈现 `skipped` |
| R-2 | ② | 删命令 / 删依赖 / 删能力 | **BREAKING** | 整批 `git revert`；历史 `index.db` 不删除；能力恢复需从归档规格重提 |
| R-2b | ② | 脚本仍调 `iagent spec reindex` → 未知命令 | 中 | `CHANGELOG ### BREAKING` + `docs/upgrade-guide.md` 明示；不留弃用桩（理由见 D2） |
| R-3 | ③ | 纳管 `openspec/changes/**` 增大仓库体积与 diff 噪音 | **BREAKING**（约定） | `.gitignore` 回滚 + `git rm -r --cached openspec/changes` |
| R-3b | ③ | 暂存路径构造错误带入无关文件 | 高（安全） | 清单由变更名 + 固定模板生成、逐条前缀校验、打印拟暂存清单；禁止 `git add -A` |
| R-4 | ④ | 去 sync 后纯 CLI 场景索引滞后 | 中 | 保留「无 daemon 时按需 sync 一次」；锁阶梯全失败降级 Grep + WARN |
| R-4b | ④ | `unlock` 误删活跃锁 → 索引损坏 | 高 | `writer.pid` 存活**禁止** unlock；unlock 后仅重试一次 |
| R-4c | ④ | 白名单新增 `Bash(codegraph:*)` 扩大执行面 | 低 | 前缀限定 `codegraph` 子命令，不含任意 shell |
| R-5 | ⑤ | 门白名单写漏 → 业务门消失 | 高（流程安全） | 正向枚举 + 破坏性确认独立成条 + 生成期文本断言 |
| R-5b | ⑤ | 直通句使中间节点无干预点 | 中 | 5 类必留门 + 宿主中断键；文档明示唯一停点清单 |
| R-6 | ⑥ | debug 补派发后子代理越权 / 重复改动 | 中 | 沿用 `⛔ EXIT GUARD` + 文件归属表 + 同文件串行 |
| R-6b | ⑥ | handoff 包陈旧 / 与制品不一致 | 中 | 指纹校验 + 不一致重建 + 包缺口回执 |
| R-6c | ⑥ | 包前缀由 `apply-` 改为 `pipeline-`，旧清理逻辑残留临时目录 | 低 | 清理同时识别两前缀（迁移期），下一版本移除旧前缀 |

### Trade-offs

- **有界 vs 完整**：任何跳过都是完整性妥协。本变更把「有界」从臆造阈值换成「用户本来就表达的语义（不扫依赖/产物）+ 时间预算」，并让每次跳过可计数。
- **索引 vs Grep**：索引换查询速度，代价是构建 + 失效 + 迁移；当前规模 Grep 已 253ms 且读路径从未接通 → 边际收益为负。
- **门 vs 流畅**：门成本是一轮交互，收益是防误操作与假完成。白名单化 = 只为不可逆与需求歧义付成本。
- **包 vs 真源**：包越小越省 token，失真风险越高；用指纹 + 缺口回执把风险显式化，并坚持「包是蒸馏视图」定位。

### 测试影响

**须同步修改的既有测试（17 个，本轮复核修正 —— 原表把 `markdown-first-regression` 误标为「应保持绿」且漏掉 `subagent-resource-sharing`）**：

| 测试文件 | 处置 | 依据 |
| :--- | :--- | :--- |
| `test/sqlite-index.test.ts` | 整文件删除 | 2.1 |
| `test/markdown-index.test.ts` | 整文件删除 | 2.1 |
| `test/spec-commands.test.ts` | 删除 `reindex` 内存后端段（6 用例）与 `MemoryBackend` import | 2.14 |
| `test/legacy-migration.test.ts` | `reindex` 提示断言改中性 + 「基线搬移仍可解析」 | 2.14 / 1.8 |
| `test/project-scan.test.ts` | 上限用例改写为忽略 / 软超时 / 不可读 | 1.9 / 1.12 |
| `test/scan-ignore.test.ts` | **新增** | 1.10 |
| `test/project-init-scan.test.ts` | `limits.skipped` 呈现断言；**`:68` 的 `codegraph_status` 文本断言随 2.10 改写同步** | 1.11 / 2.10 |
| `test/allowed-tools.test.ts` | `CODEGRAPH_CLI` 覆盖、debug 派发（翻转既有「debug 无 Agent/Task」反向断言 `:437-441`）、commit 提案制品 | 4.8 / 5.1 |
| `test/claude-host-adapter.test.ts` | 直通句与委派表未虚增 | 4.8 |
| `test/host-orchestration.test.ts` | 门 id ⊆ 白名单锚点 | 4.7 |
| `test/templates.test.ts` | 门白名单 / 探索 / 归档 / apply / debug 既有场景守护 | 2.11 / 2.12 / 3.5 / 4.6 / 5.4 / 7.7 |
| **`test/subagent-resource-sharing.test.ts`** | **既有 A1 断言含 `context-pack.md` / `.openspec-tmp/apply-<change-name>/` / 「上下文包是子代理**唯一**必读的制品」，与 6.1/6.3 直接冲突 → 必须同步改写**（原表遗漏此文件） | 6.9 / 6.11 / 6.12 |
| **`test/markdown-first-regression.test.ts`** | **`:52-59` 硬断言 `applyText` 含 `context-pack.md` → 6.1 后必然失败；原表标「应保持绿」有误，必须随包改名改写**（同文件另有 2.15/7.5 新增断言） | 6.12 / 2.15 / 7.5 |
| `test/commands.test.ts` / `test/config-command.test.ts` | 命令清单与 `InitResult` 字段断言 | 7.6 |
| `test/skill-size-budget.test.ts` / `test/command-reference-refs.test.ts` | 复跑（正文增量与 `reindex` 引用清空） | 7.6 |
| **`test/completion-config.test.ts`** | `RULE_CONSTANT_LINES` 变更后复跑（现有断言不覆盖被改行，保持绿即可，但必须先跑确认） | 4.5 / 6.8 |
| **`test/tool-whitelist-constants.test.ts`** | `CODEGRAPH_CLI` 常量断言 | 2.7 / 4.8 |
| `test/skills-parity.test.ts` | 重生成快照 | 7.4 |

> 另：`test/template-derivation.test.ts` **不存在** `BATCH_SCHEDULING_FULL` 相关断言（该常量只在 `spec-apply.ts:8` 定义、`:533` 作为 `references/batch-scheduling.md` 的唯一使用者）——原「Caller Updates」表的 ⑥ 行指错了文件，本轮已改为指向 `test/subagent-resource-sharing.test.ts` / `test/markdown-first-regression.test.ts`。

**必须新增的回归点（13 条）**：忽略清单命中 / `.gitignore` 与 `!` 否定 / 无深度无数量上限 / 软超时（报告与基线双写、退出码 0）/ 不可读进 `failures` / 基线 v2 与 v1 双读兼容 / 索引移除彻底性（`src/`、`src/core/templates/`、`skills/` 零 `reindex`/`index.db`/`sqlite3`/`sql.js` 引用，白名单外的历史提及限定为 `docs/upgrade-guide.md` 与 `src/core/legacy-migration.ts` 的旧品牌常量，且不得含 `reindex` 文案）/ 归档步骤序（无 reindex、锁阶梯两分支）/ 白名单常量（`CODEGRAPH_CLI` 覆盖所有正文跑 CLI 的技能、`debug` 含 `Agent, Task`）/ 门白名单文本（5 类 + MUST NOT 清单 + `workflow` 直通句 + 无自造门句式）/ 只读校验自动执行（无「是否运行技术栈专项校验」询问，三处文本一致）/ 提交暂存（范围限 `openspec/changes/<active>/**`、尾行 `提案: <name>`）/ handoff 包（创建 → propose 产出 → verify/apply 只读追加 → 指纹不一致重建 → 收尾清理）。

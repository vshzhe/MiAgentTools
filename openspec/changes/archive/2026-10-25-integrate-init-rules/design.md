# design：integrate-init-rules

## Context

### 架构影响（含影响面小节）

本变更把「规则文件契约」收敛到 `src/core/project-config.ts` 一个模块：命名映射、蒸馏常量、人工域工具、修复函数全部落该文件；`init` / `update` 两个 CLI 入口与 `project-init` 技能模板只消费该面。既有架构事实（file:line 证据取自 exploration.md 与复查）：

- **唯一生成点**：`ensureProjectConfig`（project-config.ts:239-261）——config.yaml 不存在时创建并硬编码 `['impl','test','spec']` 三文件（:253），**已存在即整体跳过**（:244-246），config 内容「保留用户修改」。
- **读取链**：`readProjectConfig` 按 `` `${type}.md` `` 拼路径（:222）；`parseProjectConfig` 对 rules 列表按 `isSkillType` 过滤（:161，读的是**类型 id**，与文件名正交）；`listRuleFiles` 同样按类型 id 过滤 basename（:264-273）。
- **init step 4**：init.ts:301-304 调 `ensureProjectConfig`，结果进 `InitResult.ruleFilesCreated`（init.ts:96、:338），CLI 输出（cli/index.ts:121-128）。
- **update 流程**：0 legacy 迁移（update.ts:148-153，**必须最先**，批次约束同 init.ts:142-146）→ 0.1 misplaced 清理（:156）→ 0.2 技能 id 迁移（:159）→ 读 config（:162）→ --tools 回写（:170-172）→ 技能/指令刷新（:205 起）→ reconcile。update **完全不触 rules**（grep `rules|scanProject|context` 0 命中）。
- **旧名来源链**：`legacy-migration.ts:559-562` 把 `.venus/rules/tr_impl.md` 按 `LEGACY_TYPE_RENAME`（:104-106，由 SKILL_TYPES 派生、类型 id 不变更）搬为 `.iagent/rules/impl.md`——本变更让搬运落点**直达语义名**（`coding-rules.md`，任务 2.1），因此旧名文件只剩「7.x 装机遗留的 `impl.md`/`test.md`」一个来源；update 的修复步骤必须先于读 config，且不得抢在迁移之前建出新名文件（否则迁移按「已存在不覆盖」跳过，旧规则内容滞留），见 Decisions D-2。
- **扫描**：`scanProject`（project-scan.ts:689-718）输出 `ProjectScanReport`（:181-202），signals 五维（build/skeleton/config/routes/docs），候选独立（candidates，:198-199）；渲染函数（:758-776）。排除清单 `EXCLUDED_DIR_NAMES` 与上限 MAX_SCAN_DEPTH=8 / MAX_SCAN_FILES=2000 不变。
- **project-init 技能**：9 步正文（project-init.ts:156-287）：读基线（166）→ 框架扫描（174）→ 委派 feature_doc（187）→ 安全扫描（196）→ 逐份确认（210）→ 增量对齐人工域（219-233，破损取保留侧）→ 五类落盘（234-247）→ AGENTS.md（249-258）→ context 回写（260-266）；五份 references；frontmatter allowedTools 含 `CODEGRAPH_MCP` + `skillDelegation(['feature_doc'])` + `Read, Write, Glob, Grep`（:150-154）。command 版由 `deriveCommandContent()` 从 skill 唯一源派生、本模板**刻意不标 CMD:SKIP**（project-init.ts:301-304 注释）。
- **模板引用现状**：`openspec/rules/ai-coding.md` / `artifact-generation.md` 硬编码 25 处（15 文件，逐文件计数：auto-workflow 2、debug 2、feature-doc 1、migration 2、migration-check 1、proposal-review 1、requirement-doc 1、spec-apply 4、spec-archive 1、spec-bulk-archive 1、spec-explore 1、spec-propose 3、spec-verify-proposal 1、spec-verify 1、workflow 3；skills/ 快照为生成物同形态存在）。语义是**源仓路径**，在无 `openspec/` 目录的目标项目中为死引用；生成产品运行环境（目标项目）在 init/update 后必有 `.iagent/rules/`。
- **测试面**：断言强依赖现名——completion-config.test.ts:134-135,175-176,217、legacy-migration.test.ts:281-285,457、commands.test.ts:292、skill-type-taxonomy.test.ts:10,42；反向护栏 subagent-resource-sharing.test.ts:67（断言正文**不含**内联规范摘要短语，路径改写不影响其正向断言）。

**影响面**：read 链下游广（generate 注入 / config 展示 / 技能骨架注入）但契约面收敛——`readProjectConfig` 返回结构签名不变；直接调用方按全量核对为 **30 处调用表达式分布于 9 个调用文件**（另定义文件 project-config.ts，共 10 文件涉改；编排器影响面分析记为 14 语义调用点，核对后细化为该口径），处置见 proposal「影响面分析」表；SKILL_TYPES 数量（9）不变；`parseProjectConfig` 不动；`rewriteCommandRefs` / `deriveCommandContent` 不动；skills-parity / allowed-tools / command-reference-refs 三个一致性测试经 `pnpm build && pnpm generate:skills` 重生成后复跑。

## Goals / Non-Goals

**Goals**：

1. 目标项目脱离对 `openspec/rules/` 源仓路径的运行时依赖：init 即得蒸馏基线（D-Q1）。
2. `.iagent/rules/` 成为有生命周期管理的产物：init/update 双入口确定性重建/修复 + 技能蒸馏动态更新（D-Q5），旧名文件一次性清除（D-Q6）。
3. 用户手写规则获得与 docs/project 同构的人工域保护（D-Q4），保护语义单一化。
4. 命名与实际语义一致：`coding-rules.md` / `testing-rules.md`（D-Q3/D-Q9）。

**Non-Goals**：

- 不改 `SKILL_TYPES` 数量与类型 id（`Legacy *` 映射表与守卫测试不牵动）。
- 不改 `parseProjectConfig` 的 rules 列表契约（类型 id，与文件名正交）。
- 不引入 `.iagent/rules` 的 frontmatter / generatedFingerprint 机制（D-Q4 已决人工域段；与 update 既有指纹体系解耦）。
- 不做规则文件按宿主差异化（D-Q8 已决跨宿主统一）。
- 不把 `defaultRuleFileContent` 的管理范围扩到映射外类型（仍 `['impl','test','spec']` 三类型；review 等类型默认内容函数保留现状供注入）。
- 不在 project-init 蒸馏步骤引入新委派或新工具授权。
- **review 类技能复用问题（探索 B4 残留待查项，显式结论）**：现状结论——review / verify 类模板经本次 25 处引用改写后统一指向 `.iagent/rules/coding-rules.md` 获得护栏复用；`defaultRuleFileContent('review')` 的默认内容**保持现状不变**（不改名、不并入 coding-rules、不新增蒸馏），故 review 域不新增文件与映射。

## Decisions

### D-1【Phase 2 待查项 1】模板引用改写指向 `.iagent/rules/`，不维持双源

**结论**：25 处 `openspec/rules/ai-coding.md` → `.iagent/rules/coding-rules.md`；`openspec/rules/artifact-generation.md` → `.iagent/rules/spec.md`。

**理由**：D-Q1 定案「目标项目无需 openspec 目录」——模板正文运行环境是目标项目，维持源仓路径即死引用（违背有效引用）；改写后引用目标在 init/update 后必然存在，唯二例外（用户删文件 / 无 rules 目录）沿用 spec-apply.ts:74 已有的降级语句模式（缺失→内联要点 + WARN，MUST NOT 阻断），故各引用处的「缺失即降级」表述保留原文语义仅换路径。措辞按语境微调（如「域护栏」→「项目护栏（impl 域蒸馏）」），G1-G7 协议的过程步骤本就内联在 spec-propose / workflow 正文，改写不丢过程语义，仅把「要点清单」锚定到 spec.md。

**牵动说明**：`rewriteCommandRefs` / `deriveCommandContent` 只识别 `/iagent:<id>` / `<id>` 命令形态，对路径字面量无交叉，**无派生机制牵动**；`pnpm generate:skills` 重新生成 skills/ 快照（skills-parity 一致性靠重生成达成）；test/command-reference-refs.test.ts 校验命令 id 引用，不受影响；test/subagent-resource-sharing.test.ts:67 反向断言针对英文摘要短语（非路径），正向断言文本（「指令 MUST NOT 内联完整护栏摘要」「## 规范要点」）不落在被改写句面内，均为绿。本仓（源仓自身）的开发护栏真源仍是 `openspec/rules/ai-coding.md`，属变更工作流约束、不属生成模板正文，不在改写范围。**计数口径**：exploration B4 的「14+ 处」与「proposal-review :419,575」是流程门时点的粗略清单，本次按全量 grep 复核为 **25 处 / 15 文件**（proposal-review 实为 :419 一处），以复核结果作为实现与验收基线（任务 2.7）。

### D-2【Phase 2 待查项 2】runUpdate rules 步骤的定位与插点定序

**定位**：确定性常量重生成 + 人工域保护（AI-free 兜底）。与 project-init 技能蒸馏（AI 增量推断）互补分工：CLI 修复「缺文件 / 常量域漂移」，技能负责「项目特异性规则行的蒸馏注入」（写人工域）；blocking 上 update 步骤失败记 WARN 非阻断。

**插点**：0.2 legacy 技能 id 迁移（update.ts:159）**之后**、读 config（update.ts:162）**之前**：

```text
0 legacy-migration（最先，批次约束不变）      [U2]
0.1 misplaced 清理
0.2 技能 id 迁移
0.3 [新增] .iagent/rules 重建/修复
     ├── preservePaths(movedRules) → preserved 登记（本轮不做常量对齐）   [P1-2]
     ├── 旧名检测删除（impl.md / test.md）+ WARN      [N1][N2]
     └── 缺失重建 / 人工域外对齐 / 报告明细            [U3][U4]
读 config（:162）→ …（readProjectConfig 此时读到修复后的规则内容）
```

**取舍理由**：(a) **必须后于 step 0**——legacy 迁移把 `.venus/rules/` 下的规则按新名直达 `.iagent/rules/`（任务 2.1）；若修复先跑，它会先建出 `coding-rules.md`，迁移随后按「目标已存在不覆盖」跳过，旧规则内容将滞留旧目录且只留 WARN。先迁移、后修复保证搬运优先；修复只处理缺失、人工域外对齐与 7.x 遗留旧名文件，**本轮搬运产物按 preservePaths 跳过**；(b) **先于读 config**——修复结果立即可被 `readProjectConfig` 读到，`missingRuleFiles` 不再因缺失误报，`--tools` 回写与 refresh 流程不受影响；(c) **手改保护协调**——update 指纹体系只覆盖技能/指令产物（有 frontmatter 存指纹）；rules 文件本来就无指纹，保护语义迁移到人工域标记段，两套判定对象不重叠、不引入第二指纹。

**不新增 CLI 旗标**：`init` / `update` 无条件执行修复步骤（幂等、非阻断、失败仅 WARN），不引入 `--rules` 一类开关——exploration Pending 的「init options 是否有 rules 旗标」按现状 `InitOptions`（tools / force / scan / migrate / homeDir / piRuntimeRunner）核定为无，本变更不扩张命令面。

**修复步骤契约**（类型定义落 `src/core/project-config.ts`，两个命令结果同构引用）：

```ts
/** 规则重建/修复明细（removedOldName / created / aligned / preserved 为**项目相对 posix 路径**；warnings 为面向用户的告警行） */
export interface RuleRepairReport {
    removedOldName: string[];
    created: string[];
    aligned: string[];
    /** 本轮 legacy 迁移产出、按 preservePaths 跳过对齐的文件（只登记不重写） */
    preserved: string[];
    warnings: string[];
}

/** 旧名规则文件检测删除单步（init 两分支与 repairRuleFiles 共用；一次只扫 .iagent/rules/ 根级） */
export function removeLegacyRuleFiles(projectRoot: string): { removed: string[]; warnings: string[] };

/** 幂等、非阻断：preserved 登记 / 旧名删除 / 缺失重建 / 人工域外对齐；IO 失败只记 WARN 不抛出 */
export function repairRuleFiles(
    projectRoot: string,
    options?: { preservePaths?: readonly string[] }
): RuleRepairReport;

/** init / update 两个命令结果字段（同名同类型，命名统一为单数 ruleRepair） */
InitResult.ruleRepair: RuleRepairReport;
UpdateResult.ruleRepair: RuleRepairReport;
```

**路径域归一（`movedRules` / `preservePaths`）**：两处取值统一为**项目相对 posix 路径**（如 `.iagent/rules/coding-rules.md`，分隔符 `/`）。`repairRuleFiles` 在比较前 MUST 用 `toPosix(path.relative(projectRoot, abs))` 归一再比对；`preservePaths` 命中但目标不存在或非管理型三类型时 SHALL 安全忽略（不报错、不登记 preserved）。归一函数纳入单测（任务 3.4）。

**P1-2 决策（迁移产物同轮不被常量重写）**：采用 **①「本轮迁移产出跳过集合」**——`legacy-migration` 报告新增机读字段 `movedRules`（本轮写入的规则文件相对路径，posix），`runInit` / `runUpdate` 把它作为 `preservePaths` 传入修复步骤，首轮只登记 `preserved` 不对齐，下一轮起恢复正常对齐。**理由**：②「迁移写入时把既有内容包进人工域标记」需要改写用户文件字节、替用户生成标记，直接违背 legacy 迁移「内容逐字保留」既有契约（docs/upgrade-guide.md 与测试锁定的保真语义），且无法区分「迁移包好的旧内容」与用户后续手写内容；① 保持搬运保真、不触碰文件内容，跳过范围可机读可测（任务 3.5 断言同轮 `readProjectConfig` 内容保真），代价仅是首轮不做常量升级（下一轮自动补）。

**preserved 的首轮提示（消除延后丢失）**：首轮出现 `preserved` 时，**CLI（init/update 结果输出）** SHALL 输出以下提示（原样文案，避免用户误以为内容已长期安全）：

```text
迁移规则已原样保留；如需长期保留请将其移入人工域标记区间，否则下次 init/update 的常量对齐会重写该文件
```

**载体单点**：该提示只由 CLI 结果输出承载（读 `InitResult.ruleRepair.preserved` / `UpdateResult.ruleRepair.preserved` 渲染）；MUST NOT 改动 `renderLegacyMigrationReport`（legacy-migration.ts:448）的签名或其报告文本——迁移报告保持既有四段式（搬运 / 删除 / 跳过 / 告警），规则修复提示属规则的修复报告域，两者不混载。

即：`preservePaths` 只延后一轮对齐，不构成永久豁免；长期保留的正确做法是把内容包进 `<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->`。

### D-3【Phase 2 待查项 3】init step 4 改造边界与「保留用户修改」注释的冲突消解

**边界**：`ensureProjectConfig` 保留**双层**语义：

- `config.yaml` 不存在 → `config.yaml` + 三份语义名规则文件全量创建（created），ruleFiles 与现状报告同构；**不再维持「已存在即跳过」对规则文件的含义**；created 分支 SHALL **先执行旧名检测删除**（复用 `removeLegacyRuleFiles` 单步，与「旧名规则文件检测删除」同一函数）再写新名文件，避免「无 config.yaml 但存在 impl.md」时旧名逃过清理；
- `config.yaml` 已存在（I4 分支）→ 转入与 update 0.3 **同一函数**（`repairRuleFiles`）：旧名清理 → 缺失重建 → 人工域外对齐，返回明细；
- 两分支均透传 `options.preservePaths`（`legacyMigration.movedRules`），本轮迁移产物只登记不对齐（D-2 P1-2 决策）。

`config.yaml` 文件本身仍按现行「已存在不重生成、逐字保留用户内容」处理（`replaceConfigSectionInRaw` 体系不动）。

**created 分支对已存在语义名文件的语义（P2-3）**：created 分支只**新建缺失**的语义名文件；若某语义名文件已存在（典型：用户手建 `.iagent/rules/` 后删了 config.yaml），SHALL **不覆盖、不做内容修复**（created 分支不进入常量对齐流程），并记 WARN「`<file>` 已存在，未做常量对齐；内容可能过期，可运行 `iagent update` 修复」——该 WARN 写入 `ruleRepair.warnings`（`ruleRepair.aligned` / `created` 均不含该文件），使用户能从 `iagent init` 报告看出「跳过了哪些文件的修复」。需要修复时执行 `iagent update`（走 exists 分支的对齐路径）。

**旧名删除单步**：`removeLegacyRuleFiles(projectRoot)` 为 `repairRuleFiles` 内部与 created 分支**共用的导出函数**（D-2 契约），返回 `{ removed, warnings }`，保证两条分支删除行为与告警文案完全一致。

**调用方外溢（显式接受）**：`ensureProjectConfig` 不止 init 调用——`config` 交互入口（config.ts:56）与 `config --set`（config.ts:131）也调用它。改造后这两个入口同样获得「config 已存在即修复 rules」的行为：幂等、非阻断、不触碰 config.yaml 内容，且 `.iagent/` 已存在（这两条路径的前置正是它）故不会凭空造目录。验收测试只在 init 侧断言明细，config 侧仅保证既有断言不回归（任务 3.5 / Caller Updates 表）。

**冲突消解**：现注释（project-config.ts:236、init 现状测试 completion-config.test.ts:139「重复 init 保留用户修改的 config 与规则文件」）中「保留用户修改」指向的是**免于静默覆盖的旧保护机制**。本变更把规则文件的保护契约从「整体不触碰」迁移为「人工域标记段逐字保留 + 常量域对齐常量」（D-Q4），`config.yaml` 部分原语义不变、注释更新为区分两者的表述；生成文件头注释写明「手写规则请置于人工域标记区间内」；docs/upgrade-guide.md 增订该行为变更与迁移提示。旧语义测试（completion-config.test.ts:139-157）改写为验收「config.yaml 保留 + commit.md（映射外类型）保留 + 管理型文件修复明细」。

### D-4 类型→语义名映射单一源落点

落 `src/core/project-config.ts` 常量区（`IAGENT_DIR_NAME` / `CONFIG_FILE_NAME` / `RULES_DIR_NAME` 同区）：

```ts
/** 类型 → 规则文件语义名（D-Q3/D-Q9：spec 显式声明不改名） */
export const RULE_FILE_NAMES: Readonly<Partial<Record<SkillType, string>>> = {
    impl: 'coding-rules.md',
    test: 'testing-rules.md',
    spec: 'spec.md',
};
export function ruleFileNameFor(type: SkillType): string;   // 映射优先，回退 `${type}.md`
export function ruleFileTypeFor(fileName: string): SkillType | null;  // 反查：仅语义名 + 映射外类型的合法 id 回退名；映射内类型的旧名（impl.md / test.md）返回 null
/** 本变更改名产生的旧名（D-Q6 检测删除对象） */
export const LEGACY_RULE_FILE_NAMES = ['impl.md', 'test.md'] as const;/** 人工域标记字面量（唯一代码真源；project-init 模板正文从此导入渲染，避免双写） */
export const MANUAL_DOMAIN_MARKS = { start: '<!-- 人工域:开始 -->', end: '<!-- 人工域:结束 -->' } as const;
```

消费改造点：`readProjectConfig`（:222）、`ensureProjectConfig`（:253-258）、`listRuleFiles`（:271）、legacy-migration.ts:562 搬运落点四处的 `` `${type}.md` `` 直拼全部改走 `ruleFileNameFor` / `ruleFileTypeFor`。**旧名清单边界**：`LEGACY_RULE_FILE_NAMES` 只含**本变更改名产生**的 `impl.md` / `test.md`，**不含** `tr_impl.md` / `tr_test.md`——旧品牌名属 `.venus/rules/` 域，由 legacy-migration 的 `LEGACY_TYPE_RENAME` 一次性搬移（`tr_impl.md` 直达 `coding-rules.md`，见任务 2.1），把它并入 `.iagent/rules` 旧名清单会让 init 每次去扫一个不该出现在 `.iagent/rules` 的形态，与 legacy 迁移职责重叠且掩盖迁移漏搬。**修复函数跳过集合**（`preservePaths` / `movedRules`）契约见 D-2 P1-2 决策；首轮 preserved 提示文案与路径域归一（posix）同见 D-2。**旧名不参与反查**：映射内类型的旧名（`impl.md` / `test.md`）不被 `ruleFileTypeFor` 识别（返回 `null`），`listRuleFiles` 因此不会把旧名文件当合法规则列出——与服务规格「旧名整体删除、不做兼容读取」一致；仅**映射外**类型才回退 `<type>.md`（如 `commit.md`）。**下游消费面不新增映射**：`generate.ts`（按 `rules[type]` 类型键注入）与 `config.ts`（展示类型 key 列表）均不接触文件名，类型→语义名解析只发生在 `project-config.ts` 一处；新增消费点若需文件名，MUST 调用同一派生函数，MUST NOT 再写文件名字面量。**选 project-config.ts 而非 legacy-migration.ts 的理由**：D-Q6 检测删除并非品牌旧装机的「一次性迁移」（init 每次都要跑，含非品牌改名场景），放 legacy-migration.ts 会迫使 init 在非迁移路径依赖该文件、混淆其「旧装机一次迁移」定位；旧名清理与读/列/写同属 rules 目录域，与 legacy-migration.ts「映射不可能静默漂移」的守卫测试体系互不耦合。

### D-5 defaultRuleFileContent 蒸馏与人工域骨架

每份管理型文件默认内容结构：`# <语义名> 项目规则（<域>，每行一条，# 开头为注释）` 头注释 → 蒸馏规则行（可读写生效的真实条目）→ 空行 → 人工域标记对（区间内首行为 `#` 注释指引：「人工域：可自由增删规则行，自动更新逐字保留」）。蒸馏内容（要点行级，不复制全文）：

- **coding-rules.md（impl 域）**：零猜测（未明确即 `[待确认]`，禁 todo 推迟）、设计先行 + apply 前确认门、数据变更须明确字段/类型/约束且 Schema 变更单独确认、严格分层禁跨层调用与统一异常 ErrorCode、UI 组件显式四状态（Loading→Empty→Error→Data）、按层级顺序生成与破坏性改动暂停确认。
- **spec.md**：变更真源为 openspec/changes/ Markdown、依赖序 proposal → specs/design → tasks、启用 `iagent spec validate` 写后校验循环、不创建 change.json/tasks.json（JSON 弃用）、提案实现前过评分门（阈值 90%），与现行 spec 常量行（project-config.ts:112-116）合并去重；另补 G1（变更目录不存在时先 `iagent spec new`、已存在则询问复用或改名）与 G6（批次 ≥2 派发单元时一次性产出 context-pack）各一行，使默认行覆盖 G1-G7 口径。
- **testing-rules.md（test 域）**：CLI 侧默认 = 占位兜底行（无测试代码场景，D-Q2），人工域骨架就位待技能蒸馏注入。

**extract 契约同步**：`readRuleFile`（:198-207）扩展为同时过滤两枚标记行（标记行不入规则条目）；区间内**规则行照常注入**（用户人工域规则生效），区间内 `#` 注释照常过滤——人工域使用说明行以 `#` 注释形态写，即可避免被当作规则条目。命名映射/标记常量见 D-4。

**对齐输出算法（阻塞式确定性，任务 3.4 幂等基准）**：

1. **常量块**：头注释行 → 蒸馏常量规则行 → 空行。**常量块不含人工域标记对**（标记只随保留下来的原区间出现），顺序与内容恒定，不含时间戳/版本号。
2. **解析既有文件**：按标记对切出人工域区间（含破损取保留侧的区间，见上文破损语义）；区间之外的行全部视为常量域，不进入输出。
3. **重写输出** = 常量块 + 按**原文件中出现的顺序**逐个拼接的**原区间原文**：每段包含其自身的 `<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->` 标记行与区间内每一行，逐字保留，不重排、不合并、不去重；**多个人工域区间各保留各自区间**（不合并成一段），顺序与原文件一致。
4. **无任何人工域区间**：输出**仅常量块**（整块替换，不带标记骨架）并记 WARN（提示手写规则应置于人工域区间内），MUST NOT 猜测哪段是用户内容。
5. **文末**：统一以单个换行结尾。
6. **幂等推演**：设第一次输入解析出的区间集合为 S（原区间原文），第一次输出 = 常量块 + S（常量块不含标记）。第二次运行解析第一次输出时，仅 S 中的标记对被识别为区间、解析结果仍为 S（区间原文与顺序未变，常量块无标记故不被误识），于是第二次输出 = 常量块 + S = 第一次输出，**字节相同**；多区间时同理按原顺序稳定。
7. **新建路径的一致口径**：文件缺失时的「默认内容」= 常量块 + 一对空的人工域骨架（标记对 + 首行 `#` 使用指引），即 S 为单个空区间；下一次对齐解析该骨架为区间并逐字保留，输出与首次创建字节一致（与第 6 条同一推演）。


### D-6 project-init 技能改动形态

- **正文新增第 10 步「实现/测试规则蒸馏」**（context 回写之后，触发顺序 P3/P4→P5→P6）：输入=基线 signals（含 tests 探针）/candidates + 五类 docs + AGENTS.md + `config.yaml`；按零猜测补扫测试代码（Glob/Grep）；产出写入 `coding-rules.md` / `testing-rules.md` **人工域区间内**（文件缺失→按常量补建 + WARN；写入失败→WARN 继续）；说明「常量域由 init/update 维护，技能不触碰常量域」；蒸馏判定细则与消息格式由正文承接（若正文行数吃紧，再将明细下沉 `references/rule-distill.md`）。补丁要求同字面：文件名以语义名书写，且注明「命名与读取以 project-config 映射为真源，改映射时同步本正文」。
- **单一源插值与维度枚举**：第 6 步（project-init.ts:223）的两处人工域标记字面量改为 `${MANUAL_DOMAIN_MARKS.start}` / `${MANUAL_DOMAIN_MARKS.end}` 插值（常量来自 project-config，避免第二份字面量）；第 1 步的基线维度枚举（project-init.ts:168）增补「测试探针（tests）」，与 D-7 新增的 signals 维度对齐。
- **无人工域区间文件的写入边界**：目标语义名文件已存在但**不含标记对**时，技能 SHALL 在常量块之后追加一对空骨架区间（标记对 + `#` 指引行）并记 WARN，再把蒸馏行写入该区间，**MUST NOT 改写常量块**。理由：常量域由 CLI 的 init/update 确定性维护（D-2/D-5），技能若改常量块会与修复步骤打架且让「谁改了常量」不可追踪；同时不要求用户先跑 `iagent update`——project-init 可能先于 update 被调用，缺区间不应成为阻断，而 repair 的「无区间 → 仅常量块」与技能的「追加空骨架」最终都收敛到「常量块 + 标记区间」同一形态，重复执行仍然幂等。
- **allowedTools 核对结论：无增补**。蒸馏步骤动作用 Read / Glob / Grep / Write——全部在既有 frontmatter（project-init.ts:150-154）三层组合的「只读检索 + 技能专有」层内；不新增委派（feature_doc 委派维持现状、无新增派发动作 → 不写 `${SUBAGENT_DISPATCH}`；委派清单仍为 `Skill(iagent_feature_doc)` 精确项）。MUST NOT 逐模板手写扩条目。
- **CMD:SKIP 派生**：新步骤**不标记 CMD:SKIP**——蒸馏步骤对 command 版同样有意义（fail-safe：command 版全文带入，仅更长），与该模板「刻意不标」的现行基调（project-init.ts:301-304 注释）一致。
- **references 不新增**：蒸馏判定与占位兜底细则可由正文约 40 行内承载（体量在 SKILL.md ≤500 行预算内），五份 references 维持现状；生成后经 test/skill-size-budget.test.ts 验证，若超预算再下沉 `references/rule-distill.md`（任务内留验证点，非本变更默认路径）。
- 改模板后 `pnpm build && pnpm generate:skills`（修改守则 1）。

### D-7 扫描测试探针的字段形态（D-Q7 轻量扩展）

`ProjectScanReport.signals` 新增第 6 维 `tests`（project-scan.ts:190-197 的结构扩展，version 仍 1——基线消费方按维度遍历，缺维兼容读）：

```ts
tests: { kind: 'test-dir' | 'test-files'; name: string; count: number }[];
```

- `test-dir`：`name` = 目录相对路径（如 `test`），`count` 固定 1；
- `test-files`：`name` = 文件名模式（如 `*Test.java`），`count` = 命中计数；
- 遍历实现挂在 `visitFile`/目录探测层（与既有 build/config 探测同构，仅文件名/目录名匹配，MUST NOT 读文件内容）；触及上限时在 `limits` 既有口径标注；
- 渲染 `renderScanReport`（:758-776）加一行「测试探针」清单；上限与排除清单（`EXCLUDED_DIR_NAMES`）沿用。技能蒸馏（P1）把 `tests` 与 candidates 一并作为证据源，骨架判定不因探针改变。

**探针与既有结构化文档常量的边界（探索 Pending 待查项，显式结论）**：`project-scan.ts:154` 的 `STRUCTURED_DOC_PATHS`（`.iagent/config.yaml`、`openspec/config.yaml`）仅用于 docs 维度的结构化文档识别，与 `.iagent/rules/` 的命名、内容与读取链**无联动**，本变更不触动该常量。

### D-8 测试迁移清单

**改断言（4 个既有文件）**：

| 文件 | 位置 | 改动 |
|---|---|---|
| test/completion-config.test.ts | :134-135,175-176,217 | 断言改语义名（coding-rules.md / testing-rules.md）；:139-157 重复 init 用例改为「config 保留 + 映射外文件保留 + 管理型修复明细」 |
| test/legacy-migration.test.ts | :281-285（:457 不变） | tr_impl → 新名落点断言 coding-rules.md / 保真内容断言保持 |
| test/commands.test.ts | :292 | `.venus/rules/tr_impl.md` 写入路径不变（旧目录属 legacy 域），仅在对其迁移产物路径断言处跟进 |
| test/skill-type-taxonomy.test.ts | :10,42 | `defaultRuleFileContent('review')` 非空断言保留（语义不变），可加映射常量一致性断言 |

**新增测试（4 组）**：`repairRuleFiles` 纯函数级（缺失重建 / 无标记对齐+WARN / 人工域保留 / 破损取保留侧 / 旧名删除+WARN / 幂等 / 读取契约）；update/init 流程级（step 0.3 先序于 readProjectConfig、未 init 空操作、报告明细）；init 端到端蒸馏验收（新装 init 后 coding-rules.md 含护栏要点、spec.md 含协议要点、人工域骨架存在——D-Q1 验收基准）；project-scan 探针用例。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| **旧名删除丢用户内容**（已知、有意为之） | D-Q6 确认「整体删除」；删除前 WARN + `docs/upgrade-guide.md` 明示 + 升级前自查提示。用户手写内容置于旧名文件且无人工域标记时将丢失——文档中给出迁移前手动改名路径（先改名为语义名即免删）。 |
| **update 修复的破坏性感知**：常量域对齐会重写旧版生成内容 | 语义变更正是本变更目标（内容升级），人工域保护避免伤及用户域；无人工域标记的文件被对齐时记 WARN，不静默覆盖；幂等（再跑无 diff）由任务 3.4 锁定。 |
| **旧装机规则内容被对齐重写**：`.venus/rules` 搬运产物与 7.x 手写的 `impl.md`/`test.md` 均无人工域标记 | 旧名文件按 D-Q6 删除 + WARN；搬运产物**本轮按 `preservePaths` 跳过对齐**，下一轮起对齐并记 WARN，同时首轮即输出「请移入人工域标记区间」提示；`docs/upgrade-guide.md` 给出升级步骤与第二轮语义说明。 |
| **技能蒸馏写入的人工域内容与 CLI 对齐共存** | 分工明确（常量域=CLI、人工域=技能+用户），蒸馏步骤按「整合而非追加」写入口径，并禁止触碰常量域。 |
| **探针计数性能** | 新增文件名匹配在既有 walk 循环内，O(1) 判定；上限共用既有 quota，不强扫。 |
| **模板引用改写漏改** | 以 grep 清单（25 处 / 15 文件）为基线，`pnpm generate:skills` 后再 grep `skills/` 残留，残留 0 为过门（任务 2.7 / 2.9）。 |


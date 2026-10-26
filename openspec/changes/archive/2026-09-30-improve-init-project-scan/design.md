## Context

### 相关代码与架构现状

| 对象 | 位置 | 现状 |
|---|---|---|
| `venus init` 主流程 | `src/commands/init.ts` `runInit()`（[init.ts:123-211](../../src/commands/init.ts#L123-L211)） | 五步确定性流程：技能/指令生成 → `.claude/settings.json` 权限合并 → `ensureProjectConfig()` → `scanReconcileOrphans()`；**不读项目内容** |
| init 中的非阻断自检范式 | `src/core/dependencies.ts` `ensureDependencies()` + `renderDependencyReport()`（[dependencies.ts:112](../../src/core/dependencies.ts#L112)） | 检测 codegraph CLI/MCP → 缺则自动安装 → **失败仅 WARN 不阻断**；命令执行器经 `runner` 参数**依赖注入**以便测试 mock |
| CLI 侧调用点 | `src/cli/index.ts` init action（[index.ts:104-106](../../src/cli/index.ts#L104-L106)） | `ensureDependencies()` + `renderDependencyReport()` 无条件调用并打印 |
| `.venus/config.yaml` | `src/core/project-config.ts` | `context` 段为"待补充"占位（[project-config.ts:53-82](../../src/core/project-config.ts#L53-L82)）；**读有解析（`parseProjectConfig`），写只有 `writeWorkflowsToConfig()`（[project-config.ts:253-296](../../src/core/project-config.ts#L253-L296)），context 无写入 API** |
| `writeWorkflowsToConfig()` 的写入策略 | 同上 | **逐行扫描 + 只替换目标段 + 其余原样保留**；实证：本仓库 `config.yaml` 的 `auto_package.runtime_dir` 段（该函数不认识）与注释、尾部空行均被完整保留 |
| `tr-init` 技能模板 | `src/core/templates/workflows/tr-init.ts`（88 行） | 四步正文，白名单 `Bash(ls:*)` / `Bash(pwd:)` / `Read` / `Write` / `Glob` / `Grep`；**skill 与 command 两份手工字符串** |
| 派生机制 | `src/core/templates/derive-command.ts` `deriveCommandContent()` | 按 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->` 段落裁剪，fail-safe（未标记段落默认双向可见）；**当前仅 7 个 `spec-*.ts` 使用，18 个 `tr-*.ts` 全为双写** |
| 技能附加参考文件机制 | `src/core/templates/types.ts` `SkillReference`（[types.ts:11-16](../../src/core/templates/types.ts#L11-L16)） | `references/*.md` 随技能目录落盘，正文以文字引用，AI 按需 Read；`venus_tr_test_generate` 已用该机制做多 schema（`references/schema-java.md` / `schema-node.md`） |
| 白名单真源 | `src/core/templates/tool-whitelist.ts` | `CODEGRAPH_MCP`（裸 + 9 具名，双写）、`SUBAGENT_DISPATCH`、`skillDelegation([...])`；指令侧由 `getCommandTemplates()` 单点回填 |
| 可委派的既有扫描能力 | `venus_tr_docs_feature_doc`（模板 `tr-docs-feature-doc.ts`，skill 437 行） | 4 种输出模式 + **框架档案驱动**（内置 Venus4A / Spring MVC / Struts + 自动探测），已覆盖前端交互 / 后端方法 / **字段级 API 契约** / **数据库调用链** / 跨模块交互 |

### 影响链

```text
runInit() ─┬─ 既有五步（不动）
           ├─ ensureDependencies()（既有，非阻断）
           └─ 【新增】scanProject() → .venus/scan-baseline.json → renderScanReport()
                        │
                        ▼（技能读取）
       getTrInitProjectSkillTemplate() ─→ registry.WORKFLOW_PAIRS
                        │                    ├─→ getSkillTemplates()  → init/update/list/show/validate
                        │                    └─→ getCommandTemplates()（白名单单点回填）
                        ▼
              skills/venus_tr_init_project/SKILL.md（快照，必须重生成）
                        │
                        ▼
              .claude/skills/... + .claude/commands/venus/tr-init-project.md（本机产物）
```

### 探索阶段的分析结论（约束来源）

- **M1**：被测三项目**全部用 Ant + `build.xml`，无一个 `pom.xml`** → 扫描器不得以 Maven 为默认假设
- **M3**：`AccountManager` 含 `spring-2.0.5.jar` 但源码仅 1 处 import → **jar 存在 ≠ 框架在用**
- **M7**：Venus4A 根目录 `org.xml` 含真实用户 PII；AuthServer `database.xml` 存明文口令 → 敏感值防护是**实测风险**
- **M9**：JDK 版本声明需四级回退（`pom.xml` → 工具链配置 → 构建脚本参数 → 文档文本 → 未知）
- **B6**：Venus4A 3064 文件 → 遍历必须设上限
- **F5/B10**：`config.yaml` 回写 MUST 逐行保留，否则丢失未知段（本仓库 `auto_package` 即实证）

## Goals / Non-Goals

**Goals**:

- `venus init` 在不破坏既有行为的前提下，产出一份**机器可读的项目扫描基线**，使技能免于重复机械探测
- `venus_tr_init_project` 能一键沉淀五类项目知识文档 + 索引 + `AGENTS.md`，并回写 `.venus/config.yaml` 的 `context`
- **敏感值零外泄**：扫描路径上不存在任何把配置取值写入产物的可能
- 存量项目可用：零文档项目（纯产出）与全文档项目（逐份确认 + 增量对齐）两种极端都能正确工作
- 全部改动可测：新增逻辑有 vitest 覆盖，快照一致性测试全绿

**Non-Goals**:

- **不做文档版本管理**：不记录文档变更历史、不做 diff 引擎（用户未提出）
- **不新增 CLI 子命令**：仅加 `--no-scan` option，保持 init 命令面不变
- **不改默认集与依赖注入**：`DEPS` 不含 `tr-init-project ⇒ tr-docs-feature-doc`，默认安装集维持 9 项
- **不把派生机制推广到其余 17 个 `tr-*.ts` 模板**（本次仅 `tr-init.ts`）
- **不做增量 diff 扫描**：每次 init 全量覆盖基线，不做增量比对
- **不实现"扫描结果可提交"的 Git 集成**：产物落盘即止

## Decisions

### D1: 预扫描模块形态与 `dependencies.ts` 同构

- **选择**: 新建 `src/core/project-scan.ts`，导出 `scanProject(projectRoot, options): ProjectScanReport` 与 `renderScanReport(report): string`；在 `runInit()` 内于 `ensureDependencies()` 语义位置之后调用（实际调用点在 `cli/index.ts` init action，与 deps 并列打印）。
- **理由**: `dependencies.ts` 已在 init 中确立「非阻断自检 + 报告渲染 + 失败仅 WARN」的完整范式，且**命令执行器经参数注入以便测试 mock**。新模块沿用同构形态可获得三项收益：CLI 侧改动最小（并列两行）、错误处理语义与既有约定一致（用户无需学习第二套）、测试模式可复用（注入 `projectRoot` 与限额参数）。
- **备选**:
  - *把预扫描直接写进 `init.ts`* → 否决：`init.ts` 已是 211 行的流程编排文件，塞入文件树遍历与解析逻辑会破坏其"编排"单一职责
  - *把预扫描做成独立 CLI 子命令 `venus scan`* → 否决：用户明确要求"在 venus init 时自动调用"，且 Non-Goals 禁止扩张命令面
  - *在技能内做全部探测* → 否决：这正是需求要解决的现状（技能每轮重复机械探测），且违背用户选定的 A2 方案

### D2: 扫描基线 JSON 结构（信号/候选分层）

- **选择**: `.venus/scan-baseline.json` 结构为：

```jsonc
{
  "version": 1,              // 结构版本，供后续演化做兼容判定
  "scannedAt": "<ISO 时间>",  // 本次探测时间
  "scope": { ... },           // 探测范围（已遍历目录数/文件数）
  "limits": { "hit": bool, "detail": "..." },  // 是否触及上限
  "signals": {                // 直接观察到的事实（不含任何配置取值）
    "build":    [ { "file": "build.xml", "evidence": "..." } ],
    "skeleton": [ { "path": "src", "shape": "直挂" } ],
    "config":   [ { "file": "DataBase.properties", "keys": ["DB_URL1", "USER1", "..."] } ],
    "routes":    [ { "file": "WEB-INF/action_mappings.xml" } ],
    "docs":     [ { "path": "AGENTS.md" } ]
  },
  "candidates": [ { "kind": "jar", "name": "spring-2.0.5.jar", "note": "候选，未验证源码使用" } ],
  "failures": [ { "target": "...", "reason": "..." } ]   // 探测失败项
}
```

- **理由**: `signals` / `candidates` 分离是 M3 教训的直接物化 —— 两者混在一个数组里，技能侧迟早会把候选当结论。`config[].keys` **只存键名**（类型层面就不给取值留位置，而非靠约定不写）。`failures` 与 `limits` 让"没探测到"与"没评估"可区分（沿用 exploration 中「该不该测闸门」的同一思路）。
- **备选**:
  - *基线用 Markdown 而非 JSON* → 否决：基线是**给技能读的脚手架**，结构化格式便于技能稳定解析与逐项引用；人类可读性由 `renderScanReport()` 的终端输出承担
  - *信号与候选合为一数组 + 一个 `confidence` 字段* → 否决：单个字段容易被忽略，物理分层才能强制技能侧分别处理

### D3: 敏感值防护在扫描器单点实现，技能侧只做二次约束

- **选择**: 两层防护 —— (a) **扫描器层（主防线）**：键名提取函数只把 `key = value` 的 **key** 写入报告，`value` 在提取函数内即被丢弃，不进任何中间结构；(b) **技能层（二次约束）**：技能正文显式写入禁令（安全规范文档 MUST NOT 含凭据值与可利用绕过细节）。文件排除清单同样在扫描器层内置。
- **理由**: 主防线必须在**离数据最近的地方**（提取函数内），而非靠下游"记得不打印"。排除清单内置而非可配置，因为 M7 实测的 PII 文件与明文口令文件是**已知的具体风险**，默认安全优于默认可用。
- **备选**:
  - *只靠技能正文的禁令* → 否决：技能是 LLM，禁令是软约束；把 PII 读进上下文即已泄露（上下文可能被记录），必须在读之前排除
  - *把排除清单做成 `.venus/config.yaml` 可配置项* → 否决：用户未提出；且默认放行再让用户收紧，与"默认安全"相反
  - *对取值做脱敏（如 `****`）后写入* → 否决：脱敏算法会被绕过（短口令、可猜口令），"不读取"严格优于"读取后遮蔽"

### D4: `config.yaml` 写入抽公共段替换函数，`context` 与 `workflows` 共用

- **选择**: 在 `src/core/project-config.ts` 中抽出段替换的内部实现（逐行扫描 + 段替换 + 其余保留），由 `writeWorkflowsToConfig()` 与新增的 `writeContextToConfig()` 共用；`writeWorkflowsToConfig()` 的**外部行为与产物 MUST 保持不变**。
- **理由**: F5/B10 已确立"逐行保留"是硬约束，而该策略的实现细节（段头匹配、列表项跳过、追加分支）在 `writeWorkflowsToConfig()` 中已存在。复制一份会造出第二份真源且在后续修 bug 时漂移。`context` 段的写入形态（`context: |` + 缩进块）与 `workflows` 的列表形态不同，故抽的是**骨架**（定位段 + 保留其余）而非整体。
- **备选**:
  - *直接复制 `writeWorkflowsToConfig()` 改写* → 否决：第二份真源
  - *重新序列化整个 YAML（引入 YAML 库）* → 否决：会丢失注释与未知段，属破坏性改动（B10 明确禁止）；且仓库刻意不引入 YAML 依赖（`project-config.ts` 文件头注释）
  - *只替换 `context` 段的文本块，不抽函数* → 否决：段定位与保留逻辑重复，长期漂移风险

### D5: `tr-init.ts` 派生改造的最小步骤

- **选择**: `getTrInitProjectCommandTemplate()` 的 `content` 改为 `deriveCommandContent(getTrInitProjectSkillTemplate().instructions)`；在 skill 正文中以 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->` 标记**仅 skill 版可见**的段落。**fail-safe 原则下，默认不标记**——只在确实不宜进入 command 压缩版的段落上标记（如五类文档的逐份确认细节、基线读取步骤）。
- **理由**: `deriveCommandContent` 的 fail-safe 设计要求漏标只会让 command 版更长、不会缺防护语句，因此"默认不标记"是安全侧的默认值。仅 `tr-init.ts` 纳入（其余 17 个 `tr-*.ts` 不动，见 Non-Goals），沿用 2026-09-14 只改 `spec-*` 的增量迁移先例。
- **备选**:
  - *维持手工双写* → 否决：本次正文会大幅扩写，双写漂移风险随之放大（`CONTEXT.md:86` 已记录该现象）
  - *18 个 `tr-*.ts` 全改派生* → 否决：改动面从 1 个文件扩到 18 个文件 + 18 份快照，远超本次诉求边界，且会让变更难以审阅（经用户二次确认）

### D6: 五类文档模板放 `references/`，主 SKILL.md 只留流程与索引

- **选择**: 技能主正文保留**流程**（读基线 → 语义扫描 → 逐份确认 → 落盘 → 回写）；五类文档的**骨架模板**与框架档案细节拆为 `references/` 下的分文件，正文以文字引用，AI 按需 `Read`。
- **理由**: 五类文档各有独立骨架（章节、表格形态、证据要求），全部内联会使单文件正文膨胀到难以维护，且每轮调用都把五份模板的全文载入上下文。`venus_tr_test_generate` 的 `references/schema-java.md` / `schema-node.md` 已验证该机制（`SkillReference`，[types.ts:11-16](../../src/core/templates/types.ts#L11-L16)）。
- **备选**:
  - *全部内联进 SKILL.md* → 否决：上下文负担与可维护性双输
  - *五类各建一个独立技能* → 否决：用户要求优化 `init_project` 单一能力，且会造成 5 个技能的编排开销与白名单重复

### D7: 白名单按正文实际使用扩展，委派条目走共享常量

- **选择**: `allowedTools` 增加 `CODEGRAPH_MCP`（技能需做结构探测）与 `skillDelegation(['tr_docs_feature_doc'])`（复用扫描能力）；`Read` / `Glob` / `Grep` 按正文实际使用保留；`Bash(ls:*)` / `Bash(pwd:*)` 维持现状。**不加** `SUBAGENT_DISPATCH`——技能仅经 `Skill` 工具委派，不派发子代理。
- **理由**: AGENTS.md 修改守则第 2 条要求白名单按实放行、调用类条目走共享常量、`MUST NOT` 无差别补齐与扩大授权面。`venus_tr_docs_feature_doc` 是唯一委派目标，故精确列举一项而非通配。
- **备选**:
  - *加 `Agent, Task` 派发子代理并行扫描五类* → 否决：本次正文采串行流程，无派发动作；按实放行原则不得预先放行（AGENTS.md：仅错误处理段落提及"子代理失败"不构成派发）
  - *加 `Skill(*)` 通配* → 否决：授权面过宽，属安全问题（`tool-whitelist.ts` 注释明确禁止）

### D8: 人工域标记由技能侧按成对注释解析，破损情形走保留 + WARN

- **选择**: 增量对齐的解析由技能（LLM）按 `<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->` **成对注释**识别区间；解析规则三条 —— (a) 成对且有序 → 区间内容逐字保留，区间外重派生；(b) **未闭合**（有开始无结束）→ 从开始标记**至文末**整体保留并记 WARN，MUST NOT 猜测闭合位置（宁多保留、不误删）；(c) 出现嵌套或乱序 → 保留最外层的最大连续区间并记 WARN。文档不含任何标记时退化为整体重派生（不报错）。
- **理由**: 标记本身是**用户手写的**，格式破损必然发生；而误删用户手写内容是不可逆的损害。故破损分支一律取"保留侧"而非"重派生侧"（fail-safe 方向与 `deriveCommandContent` 的"未标记段落默认双向可见"一致：不确定时选不会丢信息的那一侧）。人工域机制设为**显式标记而非章节白名单**的理由已在探索 `架构决策 A3` 记载（白名单写死在模板里，用户新增段落无法被保护）。
- **备选**:
  - *解析失败即整体重派生* → 否决：会静默删除用户手写内容，最坏分支
  - *解析失败即整体保留* → 否决：文档永不更新，与本能力目的相悖
  - *由扫描器（Node）解析标记并输出区间* → 否决：标记存在于**产物文档**而非被探测的项目源码，且区间判定需要文档语义判断，属技能职责；放进 CLI 还会把文档格式契约耦合进 `venus init`

### D9: 扫描器常量具名化、排除清单含 venus 自身产物、导入遵仓库 ESM 约定

- **选择**: 三项实现约束随本变更一并落实 —— (a) 遍历深度与文件数上限定义**具名常量**（如 `MAX_SCAN_DEPTH` / `MAX_SCAN_FILES`），MUST NOT 以字面量散落；(b) 排除清单**必须包含 venus 自身产物目录**（`.claude/` / `.venus/` / `.codegraph/` / `openspec/`）与 `node_modules/` / `dist/`；(c) 新模块的导入按「系统包 → 第三方包 → 自定义包」分组且**相对导入带 `.js` 后缀**（仓库 TS ESM 约定，见 [init.ts:11-33](../../src/commands/init.ts#L11-L33)）；(d) 异常 MUST NOT 被空 catch 吞掉 —— 失败原因须落入 `failures` 或 WARN 文本。
- **理由**:
  - (a)(d) 为项目硬规约（`ai-coding.md` 一/六 + 全局编码规范「禁止魔法数字、硬编码」「禁止空 catch 块、吞异常」）
  - (b) 是**实测必需**：`.claude/skills/` 下含全部已安装技能目录（本仓库测试夹具中为 27 个）。不排除会导致两个后果 —— 真实项目里 venus 自身产物被当作"项目信号"污染基线；测试夹具里遍历 27 个技能目录可能触发上限（而测试断言 `runInit` 的返回值与 `.claude/` 内容，报告污染会传导为测试噪声）
- **备选**:
  - *上限以字面量内联* → 否决：违反项目硬规约，且后续调参需全局搜索
  - *排除清单不含 venus 自身产物* → 否决：会造成基线污染与测试噪声（见上）
  - *用 `require` / 无后缀导入* → 否决：与仓库 ESM 约定不符，构建期即报错

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| **敏感值外泄**（M7 实测：`org.xml` 含真实 PII、`database.xml` 存明文口令）；产物落 `docs/project/` 会**入库并随项目交付**，泄露面从"本机"扩到"版本库+交付物" | D3 双层防护：扫描器在提取函数内丢弃 value（类型层面不留位置）+ 内置排除清单在**读取前**排除 PII/编译产物/日志；技能正文禁令做二次约束。验收含"含敏感键的配置文件"单测 |
| **jar 名误报框架**（M3：`AccountManager` 有 spring jar 但 1 处 import） | D2 的 `signals` / `candidates` 物理分层 + 能力规格明文"预扫描 MUST NOT 输出框架结论"；框架判定交由技能结合 import 频次 |
| **遍历失控**（B6：Venus4A 3064 文件） | 扫描器内置深度与文件数上限；触及上限时返回部分结果并记 WARN，且 WARN 须区分"上限所致"与"确实没有"（避免把超限误读为无内容） |
| **`config.yaml` 回写损坏用户配置**（B10：含 `auto_package` 未知段与注释） | D4 抽公共段替换函数，沿用逐行保留策略；MUST NOT 引入 YAML 序列化；验收含"含未知段与注释的 config"单测 |
| **技能正文膨胀**导致每轮上下文负担 | D6 五类模板拆入 `references/`，主正文只留流程与索引；沿用 `tr-test-generate` 已验证的机制 |
| **`tr-init` 派生改造改变既有 command 产物内容**（消除既有漂移属修正，但产物 diff 会非空） | D5 采用 fail-safe 默认（尽量少标记），使 command 版内容尽量贴近现状；快照重生成并人工核对 diff；`template-derivation.test.ts` 覆盖该模板 |
| **委派 `tr-docs-feature-doc` 不可得时三类文档质量下降** | 能力规格要求降级时**记 WARN 并自行扫描**（不静默降质）；降级路径在技能正文显式写出，用户可见 |
| **`docs/project/` 与用户既有目录约定冲突**（如项目已有 `docs/` 且结构不同） | 产物路径为固定约定（用户确认）；已存在文档走逐份确认分支，用户可逐份跳过；若目标目录已有同名不同义文件，同样进入确认分支而非覆盖 |
| **技能新增交互询问**打断既有用户习惯（已存在文档时询问处置） | 仅在有已存在文档时触发；零文档项目（典型新项目场景）无新增交互；用户可对全部文档选"跳过"快速通过 |
| **默认安装集若被误改会导致全量用户多装技能** | 能力规格明文 `MUST NOT 引入依赖注入` + 场景"默认安装集不变"（9 项）；`profiles.test.ts` 既有断言可拦截 |
| **既有测试的两处硬编码回归锁会被打破**（深度探索实测，P0）：`test/allowed-tools.test.ts:262` 断言「正文用 CodeGraph 或白名单含 `Bash(codegraph:*)` 的技能数」**恒为 10**；同文件 `:292-302` 断言「经 `Skill` 委派的技能清单」**恰为 9 项且逐项列举**。本次为 `tr-init` 加 `CODEGRAPH_MCP` 会使其变 11、加 `Skill(tr_docs_feature_doc)` 会使其变 10 → **两处断言必然 FAIL**，任务 6.2「全量回归全绿」不可达 | 新增显式任务 6.4/6.5 同步更新这两处回归锁（锁的是**清单**而非计数上限，更新即把 tr-init 纳入正确集合）；并在任务 6.2 注明"含回归锁同步" |
| **反向断言要求"授权有正文核准"**（深度探索实测）：同文件 `:266-270` 要求「含 MCP 条目的技能集合」与「正文提及 codegraph 或白名单含 CLI 形态的集合」**完全一致**。若给 tr-init 加 `CODEGRAPH_MCP` 而正文未真实出现 `codegraph_` 字样，将被判为"未经正文核准的授权" | 任务 4.11 明确：正文须**实际出现** codegraph 工具名（如 `codegraph_status` / `codegraph_files`）并与白名单同步；不得只加白名单不改正文 |
| **`writeWorkflowsToConfig()` 重构引入回归** | 任务 3.1 的验证条件已明确"外部行为与产物逐字不变"；`completion-config.test.ts:216/222/256` 对 config 内容有既有断言，可作为拦截网 |

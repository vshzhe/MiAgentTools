# Tasks: improve-workflow-artifact-dataflow

> 流程基准节点 id 见 `exploration.md` §功能流程图（N1–N7 探索文件流 / M1–M8 需求文档流 / K1–K4 归档继承链）。
> 技术真源 `src/core/templates/workflows/*.ts`：`spec-*.ts` 单一定义源（指令版自动派生）、`tr-*.ts` **手工双处**（skill 正文 + command 正文必须同步）。
> 每个 `[代码]` 任务完成后须跑 `pnpm build && pnpm generate:skills`（AGENTS.md 守则 1）后再勾选。

## 1. 探索文件移动语义（规则 1 · 节点 N2/N3/N4）

- [x] 1.1 [代码] `spec-propose.ts` Step 0.6 迁移语义明确为「移动 + 成功删源 + 失败保留」 [N2][N3][N4]
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 说明：改写 0.6 的「关联」分支描述（源路径 → 目标路径文案改为移动语义，补「迁移成功且目标文件校验通过后删除源文件」与失败保留句）；该段位于 `<!-- CMD:SKIP -->`(46)–`<!-- /CMD:SKIP -->`(87) 内，**指令版无需同步**。
  - 验证：`pnpm build` 无错；`skills/venus_spec_propose/SKILL.md` 含删源断句，`.claude/commands/venus/spec-propose.md` 不含迁移段（维持现状）

- [x] 1.2 [代码] `tr-impl-workflow.ts` 反转 Phase 2.3 保留语义并**删除 Post-Migration 保留段**（双处同步） [N2][N3][N4]
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`
  - 说明：①删除 `**Post-Migration: Source File Preservation** (Task 7.1)` 整段（原 1057–1077）；②Phase 2.0 checkpoint 句「Preserve source file unchanged」（原 949）改为失败路径语义；③Phase 2.3 迁移段补「成功即删源」；④失败保留句（原 965/1053/1081）**保持不变**；⑤command 版「**Post-Migration**: Source file is preserved (not deleted)」（原 2116）同步反转；⑥指令版其余压缩句按同语义改写。
  - 验证：`skills/venus_tr_impl_workflow/SKILL.md` 与 `.claude/commands/venus/tr-impl-workflow.md` 均无 "Preserve source file unchanged" / "Source File Preservation" / "preserved (not deleted)" 残留

- [x] 1.3 [代码] `tr-impl-auto-workflow.ts` 反转 Phase 2 "Preserve the exploration file" 句（双处同步） [N2][N3][N4]
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 说明：skill 正文（原 458–463）与 command 正文（原 671）同步改为「移动 + 成功删源 + 失败保留」。
  - 验证：两版产物均无 "Preserve the exploration file — do NOT delete it." 残留

## 2. 需求文档归档生成（规则 2 新增侧 · 节点 M3/M4/M5/M8、K1/K2/K4）

- [x] 2.1 [代码] `spec-archive.ts` 新增预归档步骤 4.8「需求文档生成」+ 白名单 + 摘要三态 [M3][M4][M5][M8][K1]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 说明：①新步骤 4.8 插于步骤 4.7 与步骤 5 之间 [M3][M4][M5]，含存在性判定（范围仅 `openspec/changes/<name>/需求文档.md`，`path.join()`）、不存在→非交互委派 `venus_tr_docs_requirement_doc`、已存在→就地增量对齐（人工域 `## 基本信息` 与 `## 八、评审记录` 逐字保留、`一~七` 重派生、MUST NOT 调该技能）、目录不可读→WARN 按不存在 [M8]、两分支失败→WARN 继续归档 [M8]；②步骤 6 迁移逻辑**保持不动**（生成落点为变更目录 → 步骤 6 搬到 devdocs）[M6][M7]；③步骤 8 完成摘要新增「需求文档：生成 / 就地增量对齐 / WARN（原因）」三态（对齐既有 `Exploration Memory` 摘要口径）[M8]；④`allowedTools` 经 `skillDelegation(['tr_docs_requirement_doc'])` 加条目并补 import（AGENTS.md 守则 2：走共享常量）[K1]；⑤该步骤**不置于** `CMD:SKIP` 段内（指令版同步生效）[K1]。
  - 验证：`skills/venus_spec_archive/SKILL.md` 与 `.claude/commands/venus/spec-archive.md` 均含 4.8 与双分支断句；frontmatter `allowed-tools` 两版一致且含 `Skill(venus_tr_docs_requirement_doc)`

- [x] 2.2 [代码] `spec-bulk-archive.ts` 新增平行步骤 a.6 + 白名单 [M3][M4][M5][M8][K4]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 说明：①新步骤 a.6 插于 a.5 与 b 之间（同语义双分支 + 单变更失败 WARN 不中止批次）；②b.5 的探索记忆同步与 c 的需求文档迁移**保持不动**；③`allowedTools` 加 `skillDelegation(['tr_docs_requirement_doc'])` 并补 import；④派发子代理的指令文本（步骤 8 的「MUST embed the full archive checkpoint text」）须随新步骤一并嵌入。
  - 验证：两版产物含 a.6 与双分支断句；指令嵌入文本含 a.6

- [x] 2.3 [代码] `tr-impl-auto-workflow.ts` Phase 5 步骤清单追加需求文档生成引用 [M3][M4][M5][K2]
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 说明：skill 正文 5.1（原 581）与 5.2（原 588）与 command 正文（原 683）的归档步骤枚举追加「需求文档生成（按 `venus_spec_archive` 同一规则：存在性判定 → 委派生成 / 就地增量对齐，失败 WARN 非阻断）」，并让错误处理段含「需求文档生成或对齐失败 WARN 继续」。**只引用不复制**双分支正文（单一源 D2）。
  - 验证：两版产物 Phase 5 步骤枚举含需求文档生成；全文检索无第二份双分支正文

## 3. 需求文档生成移除（规则 2 移除侧 · 节点 M1）

- [x] 3.1 [代码] `tr-impl-workflow.ts` 移除 §3.5 需求文档生成（双处同步） [M1]
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`
  - 说明：①删除 §3.5 第 5 条「Auto-generate requirement document」及其输出提示（原 1391、1471-1479 对应段）；②guardrails 两条（原 1618、2280）改为「verify PASS → 深度复查 → 收束，MUST NOT 生成需求文档」；③完成摘要新增「需求文档将于归档时生成」提示（防用户误判缺失）；④`allowedTools` 剔除 `tr_docs_requirement_doc`（见 4.2）。
  - 验证：两版产物无「invoke `venus_tr_docs_requirement_doc`」残留；摘要含归档生成提示

- [x] 3.2 [代码] `tr-impl-auto-workflow.ts` 移除 Phase 3 需求文档生成（双处同步） [M1]
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 说明：①删除 Phase 3 的 Auto-generate bullet 与 Auto-transition 前置（原 517-518、523）；②Phase 4 进入条件改为「验证 PASS」不再含文档生成完成（原 534）；③guardrails（原 618、689）与指令版（原 675）同步；④compat 说明句同步。
  - 验证：两版产物 Phase 3 不含生成调用；Phase 4 摘要不再以文档为前置

- [x] 3.3 [代码] `tr-impl-debug.ts` 移除 Phase 7.3 需求文档双分支（双处同步，能力迁至归档） [M1][M5]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 说明：①删除 Phase 7.3 判定段与两分支（原 484-499、510、549、569、686、700）；②新增禁令断句「MUST NOT 生成 / 就地增量对齐 / 委派 `venus_tr_docs_requirement_doc`；需求文档由归档阶段生成」；③Phase 7 收尾改为「深度复查 → 提示准备归档」；④描述（原 46）、Phase 清单与 devdocs 提示（原 551）同步；⑤`allowedTools` 剔除该条目 + `compatibility` 行（原 586）改为不再依赖该技能。
  - 验证：两版产物无 Phase 7.3 分支残留、含禁令断句；`allowed-tools` 不含 `tr_docs_requirement_doc`

- [x] 3.4 [代码] `tr-impl-genfull.ts` 移除 Stage 2.3 需求文档生成（双处同步） [M1][K3]
  - 文件：`src/core/templates/workflows/tr-impl-genfull.ts`
  - 说明：①删除 Stage 2.3 生成段（原 270-286）；②Stage 2 标题与摘要（原 26、39、49、254）去掉「+ 需求文档」；③Bridge 2 就绪检查去掉「需求文档已生成」并显式声明 Stage 2 MUST NOT 委派该技能；④workspace-planning 降级描述（原 100、291、404 对应段）改为「仅探索+提案+深度复查」；⑤Stage 4 声明「需求文档由归档阶段生成并迁移 devdocs」；⑥完成摘要（原 294-297、370-373）与 guardrails（原 392）同步；⑦TodoWrite 项与描述同步。
  - 验证：两版产物无 Stage 2.3 生成、无「需求文档已生成」就绪项；Stage 4 含归档生成声明

- [x] 3.5 [代码] `tr-docs-requirement-doc.ts` 路由表补「归档生成」入口说明（双处同步）
  - 文件：`src/core/templates/workflows/tr-docs-requirement-doc.ts`
  - 说明：保持既有路由（active 变更目录 → `openspec/changes/{change-name}/需求文档.md`；archived → devdocs），仅在「被工作流非交互调用」场景补充说明：调用方可能是归档的预归档检查点，成功产出后由调用方迁移至 devdocs；**显式声明独立技能与 `/venus:tr-docs-requirement-doc` 指令保留可手工调用**（standalone 模式与八章节规则不变），自动调用方唯一化为归档侧；MUST NOT 改变「目标已存在则静默覆盖」规则本身（调用方在已存在分支 MUST NOT 调用本技能）。
  - 验证：两版产物路由表与说明一致；含"独立指令保留可手工调用"与"自动调用方唯一化为归档"断句；`test/artifact-dataflow.test.ts` 的 A3 断言不误伤该技能自身正文
  - 场景覆盖：`需求文档技能的手工调用保留与自动调用方变更` 三条场景

## 4. 白名单与依赖注入

- [x] 4.1 [代码] `spec-archive.ts` / `spec-bulk-archive.ts` 白名单补 `Skill(venus_tr_docs_requirement_doc)`
  - 文件：`src/core/templates/workflows/spec-archive.ts`、`src/core/templates/workflows/spec-bulk-archive.ts`
  - 说明：经 `src/core/templates/tool-whitelist.ts` 的 `skillDelegation([...])` 共享常量写入（MUST NOT 手写字符串）；补 import。与 2.1/2.2 同批次完成。
  - 验证：`test/allowed-tools.test.ts` 通过；指令版 frontmatter 与技能模板逐字节一致

- [x] 4.2 [代码] `tr-impl-workflow` / `tr-impl-debug` / `tr-impl-genfull` 白名单剔除失效条目
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`（原 1619）、`tr-impl-debug.ts`（原 583）、`tr-impl-genfull.ts`（原 327）
  - 说明：三者 `skillDelegation([...])` 去掉 `tr_docs_requirement_doc`；`tr-impl-auto-workflow.ts`（原 631）**保留**（Phase 5 内联归档仍委派）；`tr-impl-debug.ts` 的 `compatibility` 行同步。
  - 验证：三技能 `allowed-tools` 不含 `tr_docs_requirement_doc`；auto-workflow 仍含

- [x] 4.3 [代码] `profiles.ts` DEPS 增删 + 注释同步
  - 文件：`src/core/profiles.ts`
  - 说明：①`spec-archive` → `['spec-verify', 'tr-docs-requirement-doc']`、`spec-bulk-archive` → 同；②`tr-impl-workflow` → `['tr-impl-review-proposal']`；③`tr-impl-debug` → `['spec-verify-proposal']`；④`tr-impl-genfull` 显式列表去掉 `tr-docs-requirement-doc`（注明由 spec-archive 传递注入）；⑤`tr-impl-auto-workflow` 保留；⑥`DEFAULT_WORKFLOWS` **不改**；⑦文件头注释与各条注释同步（说明默认安装集实为 9 项）。
  - 验证：`resolveWorkflows(['spec-archive']).injected` 为 `['spec-verify', 'tr-docs-requirement-doc']`；`resolveWorkflows(['tr-impl-debug']).injected` 为 `['spec-verify-proposal']`

## 5. 测试

- [x] 5.1 [测试][单元][P0] 更新 `profiles.test.ts` 注入断言（含 genfull 顺序）
  - 文件：`test/profiles.test.ts`
  - 说明：①`spec-archive` 注入断言语料由 `['spec-verify']` 改为 `['spec-verify', 'tr-docs-requirement-doc']`（新增 1 条与 spec-bulk-archive 对称的断言）；②`tr-impl-workflow` 期望改为 `['tr-impl-review-proposal']`；③`tr-impl-debug` 期望改为 `['spec-verify-proposal']`；④`tr-impl-genfull` 期望集不变但**顺序**按 DEPS 不动点迭代实际输出锁定（`tr-docs-requirement-doc` 由显式项后移为传递项）。
  - 验证：`pnpm vitest run test/profiles.test.ts` 全绿
  - 场景覆盖：`skill-profile` 的「漏选归档需求文档技能」「批量归档同时补两依赖」「失效依赖不再注入」「传递注入仍使 genfull 链路可得」

- [x] 5.2 [测试][单元][P0] 更新 `commands.test.ts` 默认集安装数 8 → 9
  - 文件：`test/commands.test.ts`
  - 说明：①默认集用例 `skillsInstalled/commandsInstalled` 改为 9、`injectedDeps` 期望 `['tr-docs-requirement-doc']`；②同步注释（原 20、176 附近「默认集仅 8 个」）；③复核 `reconcileOrphans`（26）与全量 27 的断言不受影响。
  - 验证：`pnpm vitest run test/commands.test.ts` 全绿
  - 场景覆盖：`skill-profile` 的「默认集安装 9 项」

- [x] 5.3 [测试][单元][P1] 新增结构指标断言（模板文本层）
  - 产出：`test/artifact-dataflow.test.ts`
  - 说明：断言 A1–A6——A1 探索文件移动：`tr-impl-workflow` / `tr-impl-auto-workflow` 两版均含删源断句、均**不含** "Preserve the source"/"Source File Preservation"/"preserved (not deleted)" 残留，且二者与 `spec-propose` 均保留「迁移失败保留源文件」断句；A2 归档生成：`spec-archive` / `spec-bulk-archive` 两版均含需求文档生成步骤与双分支断句（人工域 `## 基本信息` / `## 八、评审记录`）；A3 移除侧：`tr-impl-workflow` / `tr-impl-auto-workflow` / `tr-impl-genfull` / `tr-impl-debug` 两版均不含「invoke `venus_tr_docs_requirement_doc` 生成需求文档」的校验后调用断句；A4 白名单：四技能 `allowedTools` 的 `Skill(...)` 条目集合与正文委派面精确匹配（增删双向）；A5 DEPS：`profiles.ts` 输出与 4.3 期望一致；A6 继承关系：`genfull` Stage 4 声明归档生成、`auto-workflow` Phase 5 步骤枚举含生成且全文无第二份双分支正文。
  - 验证：`pnpm vitest run test/artifact-dataflow.test.ts` 全绿
  - 场景覆盖：`tool-call-whitelist` 全部新增场景、`tr-workflow-suite-skills` 的「Stage 2 不生成需求文档」「debug 不生成需求文档」「需求文档生成移除后条目同步剔除」

- [x] 5.4 [测试][功能][P0] 全量回归 + 快照重生成
  - 产出：无（验证性任务）
  - 说明：`pnpm build && pnpm generate:skills` → `pnpm vitest run`（全量，含 `skills-parity.test.ts` / `allowed-tools.test.ts` / `templates.test.ts` / `subagent-resource-sharing.test.ts`）；`pnpm lint`。
  - 验证：构建成功、全量测试全绿、lint 无错；`skills/` 快照 diff 与模板改动一一对应（无意外漂移）

## 6. 文档与版本

- [x] 6.1 [代码] 更新 `openspec/CONTEXT.md` 术语定义
  - 文件：`openspec/CONTEXT.md`
  - 说明：①「探索文件」（原 :23）改为「提案生成时移动入变更目录，不保留原件（失败保留）；`openspec/explorations/` 为"探索中"暂存区」；②「人工域」（原 :146）触发点由 debug Phase 7.3 改指 `venus_spec_archive` 预归档需求文档生成检查点；③「就地增量对齐」（原 :149）主体改为归档生成步骤；④补「归档生成制品」术语（需求文档在归档预归档检查点生成、随后迁移 devdocs）；⑤「工作流技能套件」（原 :80）描述去掉 tr-impl-workflow 的「+需求文档联动」。
  - 验证：`CONTEXT.md` 内不再出现「debug Phase 7.3 …就地增量对齐」的旧主体表述

- [x] 6.2 [代码] 版本号与变更日志
  - 文件：`package.json`、`CHANGELOG.md`
  - 说明：按 AGENTS.md 守则 8，改技能模板行为属**功能变更** → minor：`1.7.0` → `1.8.0`；CHANGELOG 归档 `[Unreleased]` 并登记本变更条目（两条规则 + 默认集 8→9 的显式说明）。二者随本次功能提交一并提交。
  - 验证：`package.json` version 为 `1.8.0`；CHANGELOG 含本条且版本段与 package.json 一致

- [x] 6.3 [使用说明] 变更摘要说明（含默认集变化的用户可见影响）
  - 产出：`attachments/upgrade-note.md`
  - 说明：面向已安装旧版的用户，说明三点：①探索文件不再在 `openspec/explorations/` 保留副本；②需求文档改为归档时生成（归档前不应期待该文件存在）；③默认安装集由 8 项变为 9 项（新增 `tr-docs-requirement-doc`），`venus update` 后自动补齐。
  - 验证：文件存在于 `openspec/changes/improve-workflow-artifact-dataflow/attachments/upgrade-note.md`

## 7. 流程基准「维持现状」节点登记（N1/N5/N6/N7/M2）

> 本组为**否定式登记**：流程基准中存在但本变更**不触碰**的节点，显式记录"已评估、判定无改动"的依据，使"维持现状"与"漏改"可区分（对齐 `[测试]` 任务记录否定结论的既有口径）。**本组只读校验，不产生代码改动。**

- [x] 7.1 [代码] 校验 N1（创建暂存探索文件）维持现状 [N1]
  - 文件：`src/core/templates/workflows/spec-explore.ts`、`tr-impl-workflow.ts`、`tr-impl-auto-workflow.ts`（**只读校验，MUST NOT 修改**）
  - 说明：本变更只改探索文件**离开**暂存区的语义，创建行为（路径规则、关键词 + 序号、工作区不可写降级）保持不变。判定依据：探明两处创建点均无"提案期"语义耦合。
  - 验证：三技能正文的创建段与本变更前逐字一致（`git diff` 无该段改动）

- [x] 7.2 [代码] 校验 N5（制品生成消费 exploration.md）维持现状 [N5]
  - 文件：`src/core/templates/workflows/spec-propose.ts`、`tr-impl-workflow.ts`（`openspec/rules/artifact-generation.md` 引用句；**只读校验，MUST NOT 修改**）
  - 说明：制品生成仍以 `exploration.md` 为流程基准锚点（Decisions→proposal / Analysis→design / Questions→specs / Codebase Findings→tasks 映射与"流程图锚点/降级"规则均不变）；本变更只改变该文件的**来源路径**，不改变其**消费方式**。
  - 验证：三处生成协议的映射段与流程图锚点段 `git diff` 无改动

- [x] 7.3 [代码] 校验 N6（归档随迁 exploration.md）与 N7（归档抽取能力记忆）维持现状 [N6][N7]
  - 文件：`src/core/templates/workflows/spec-archive.ts`、`spec-bulk-archive.ts`（**只读校验，MUST NOT 修改**；仅 2.1/2.2 新增的 4.8 / a.6 步骤为改动，步骤 4.7 与 b.5 保持不动）
  - 说明：①`exploration.md` 随变更目录进入 `archive/` 的随迁语义不变；②能力记忆抽取仍是"extraction copies, not moves"（`spec-archive.ts:155`、`spec-bulk-archive.ts:203` 的既有语义**不得被误改为移动**），失败仍 WARN 非阻断。
  - 验证：两技能步骤 4.7 / b.5 的抽取段 `git diff` 无改动

- [x] 7.4 [代码] 校验 M2（实现 / apply）维持现状 [M2]
  - 文件：`src/core/templates/workflows/spec-apply.ts`（**只读校验，MUST NOT 修改**）
  - 说明：`spec-apply` 与其派发协议、测试执行关卡（§9）在本变更中零改动；`auto-workflow` Phase 4 的 auto-mode 继承关系不变（仅其**进入条件**由"验证通过且需求文档生成完成"改为"验证通过"，见 3.2）。
  - 验证：`spec-apply.ts` 在本次变更的 `git diff` 中无任何改动

## 8. 文档面同步（`tool-call-whitelist` 规格「快照与文档同步」的既有义务）

> 深度复查发现：`docs/` 手册逐技能记录了 **allowed-tools 列表**与**行为描述**，本次两条规则 + 白名单增删均会使其失效。属 P0（文档与模板背离会误导使用者）。

- [x] 8.1 [使用说明] 更新 `docs/skills-manual.md`
  - 产出：`docs/skills-manual.md`（就地更新，非 attachments）
  - 说明：①`venus_tr_impl_workflow` 段：allowed-tools 列表剔除 `Skill(tr_docs_requirement_doc)`、流程图"2.3 迁移探索文件（强制保留源文件不删除）"改为"移动并删除源文件"、guardrail"迁移保留源文件"改为失败路径语义、"PASS 后自动生成需求文档"改为"深度复查后收束，需求文档于归档时生成"；②`venus_tr_impl_auto_workflow` 段：迁移句、Phase 3/4 前置、Phase 5 归档步骤序列（追加需求文档生成）；③`venus_tr_impl_debug` 段：Phase 7.3 分支与"自动需求文档"表述整段移除、allowed-tools 剔除该条目；④`venus_tr_impl_genfull` 段：Stage 2 标题/2.3 步/Bridge 2 就绪检查/workspace-planning 降级/终点描述/allowed-tools；⑤`venus_spec_propose` 段（探索文件迁移语义、`exploration.md` 来源说明）；⑥`venus_spec_archive` 段（步骤序列新增 4.8、配置表"变更含需求文档时移入"改为"归档时生成并移入"）；⑦`venus_spec_bulk_archive` 段（b.5 周边新增 a.6）；⑧目录树/流程框图（如 `Phase 3 PASS 后自动生成` 等散落句）。
  - 验证：全文检索 `保留源文件` / `Phase 3 PASS 后自动生成` / `Stage 2.3 非交互生成` / `Phase 7.3` 均无失效表述；`docs/skills-manual.md` 中的 allowed-tools 列表与模板 `allowedTools` 逐技能一致

- [x] 8.2 [使用说明] 更新 `docs/genfull-guide.md`
  - 产出：`docs/genfull-guide.md`（就地更新）
  - 说明：①allowed-tools 列表剔除 `Skill(tr_docs_requirement_doc)`；②Stage 2 标题与 2.3 步去掉需求文档生成；③Bridge 2 就绪检查去掉"需求文档已生成（或 WARN 跳过）"；④workspace-planning 降级文案去掉"+需求文档"；⑤Stage 4 段声明"需求文档由归档阶段生成并迁移 devdocs"；⑥总览框图/"终点"行同步。
  - 验证：全文检索 `2.3 委派 venus_tr_docs_requirement_doc` / `需求文档已生成` / `仅探索+提案+深度复查+需求文档` 均无失效表述

- [x] 8.3 [使用说明] 更新 `docs/openspec-comparison.md`
  - 产出：`docs/openspec-comparison.md`（就地更新）
  - 说明：①5.4「需求文档归档（devdocs）」节改为「需求文档归档生成与归集」——描述由"变更含 `需求文档.md` 时自动移动"改为"归档时生成（已存在则就地增量对齐保人工域）后移入 devdocs"；②探索文件相关描述（第 69/101 行）补"提案生成时移动入变更目录且不保留原件"。
  - 验证：5.4 节含"归档时生成"与"就地增量对齐"表述；无"变更含需求文档时自动移动"的旧表述

- [x] 8.4 [代码] 复核 `AGENTS.md` 修改守则是否需补充
  - 文件：`AGENTS.md`
  - 说明：守则 7 描述 `spec-*.ts` 单一源与 `CMD:SKIP` 裁剪，本次新增的 archive 4.8 步骤**不置于** `CMD:SKIP` 内（指令版同步生效），与守则一致 → 预计**无需修改**；仅需复核守则 1/2/8 的既有要求已被任务 1–6 覆盖（如发现缺口则补充）。
  - 验证：复核结论记录于本任务备注；如修改则说明理由

- [x] 8.5 [使用说明] 复核 `docs/migration-suite-guide.md` 无需改动
  - 产出：无（只读复核）
  - 说明：该指南中的"需求文档"指**源项目功能需求文档**（`venus_tr_docs_feature_doc` 产出），与本次变更的需求文档时机无关（auto-migration 不在范围内）；其 NOT-for 行指向 `requirement_doc` 属指引性表述，保持有效。
  - 验证：复核结论记录于本任务备注（预期：零改动）

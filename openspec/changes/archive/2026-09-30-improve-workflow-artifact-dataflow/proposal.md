## Why

技能模板中**两类制品**（探索产物 `exploration.md`、评审产物 `需求文档.md`）的数据处理逻辑存在两处不合理：

1. **探索文件双份驻留**：提案生成时探索文件从 `openspec/explorations/` **迁移**入变更目录，但多处明文要求**保留源件**——`tr-impl-auto-workflow.ts:463` 写着 "**Preserve the exploration file — do NOT delete it.**"，`tr-impl-workflow.ts:1057-1077` 更以整段 "Post-Migration: Source File Preservation (Task 7.1)" 强制 "Keep source file"，指令版 `tr-impl-workflow.ts:2116` 亦同。同一探索内容在流程中留下两份副本，归档后源件成为无主残留（`openspec/explorations/` 下现存 9 个已归档变更的探索文件即此残留）。

2. **需求文档生成时机错位**：需求文档在**提案校验通过后**立即生成（`tr-impl-workflow.ts:1391`、`tr-impl-auto-workflow.ts:517-518,675`、`tr-impl-genfull.ts:270-286`、`tr-impl-debug.ts:484-499` 四条链路），而归档时却又"存在则迁移到 devdocs"（`spec-archive.ts:171-183`）。生成点远早于制品定稿点——实现阶段（apply）会持续修改 tasks/design/specs，**提案后生成的文档必然与最终制品脱节**，归档迁移只是把过期文档搬了个位置；且 debug 的 Phase 7.3 为防覆盖人工内容而特设的"就地增量对齐"分支（`tr-impl-debug.ts:686,700`，CONTEXT.md 术语「人工域」「就地增量对齐」），恰恰证明生成点与人工编辑点存在冲突。

两项共同根源：**制品缺少单一驻留点与单一生成时机**。

## What Changes

1. **探索文件改为移动后删源（不留原件）**：提案生成时 `mv openspec/explorations/<kw>-explore-<seq>.md → openspec/changes/<change-name>/exploration.md`，**迁移成功即删除源文件**；`openspec/explorations/` 退化为"探索中"暂存区。落点三处：`spec-propose.ts`（独立提案）、`tr-impl-workflow.ts`（Phase 2.3 + **删除整段 Post-Migration 保留段**）、`tr-impl-auto-workflow.ts`（Phase 2 反转 "Preserve the exploration file" 句）。
2. **保留失败安全网**：迁移**失败**（或目标文件存在但校验失败）时仍 MUST 保留源文件并报错——"不保留原件"只适用于**成功**路径。
3. **需求文档改为归档时生成**：在 `venus_spec_archive` 新增预归档步骤 **4.8「需求文档生成」**（插于 4.7 探索记忆同步与步骤 5 目录移动之间）；`venus_spec_bulk_archive` 新增平行步骤 **a.6**（插于 a.5 与 b 之间）。落点为变更目录内 `需求文档.md`，随后由**既有步骤 6 / b.5 迁移逻辑**原样搬到 `openspec/devdocs/`——devdocs 产出路径与历史归档完全一致。
4. **双分支能力整体迁移**：`tr-impl-debug` Phase 7.3 的「不存在→委派 `venus_tr_docs_requirement_doc` 生成 / 已存在→就地增量对齐（人工域 `## 基本信息` 与 `## 八、评审记录` 逐字保留）」**整段移到归档生成步骤**。debug 侧整段移除（不再涉及需求文档），能力不丢失、人工域保护语义延续。
5. **提案校验后不再生成**：移除上述四条链路的生成调用（`tr-impl-workflow` §3.5、`tr-impl-auto-workflow` Phase 3、`tr-impl-genfull` Stage 2.3、`tr-impl-debug` Phase 7.3），并同步其 guardrails / 完成摘要 / DEPS / 白名单。深度复查（`venus_tr_impl_review_proposal`）**保留不变**。
6. **单一定义源与继承**：生成步骤只定义在 `spec-archive.ts`；`tr-impl-genfull` Stage 4 委派 archive 技能 → **零文本改动继承**；`tr-impl-auto-workflow` Phase 5 内联执行归档步骤 → 步骤清单**追加引用**（不复制协议文本），延续历史 D1（避免双模板漂移）。
7. **依赖注入与白名单同步**：`DEPS` 中 `spec-archive` / `spec-bulk-archive` **加** `tr-docs-requirement-doc`（被委派技能必须可得，与 `spec-propose ⇒ spec-verify-proposal` 同构）；`tr-impl-workflow` / `tr-impl-debug` / `tr-impl-genfull` **剔除**已失效的同名依赖；`tr-impl-auto-workflow` 保留。副作用：**默认安装集由 8 项变为 9 项**（`DEFAULT_WORKFLOWS` 本身不改）。`spec-archive` / `spec-bulk-archive` 的 `allowedTools` 补 `Skill(venus_tr_docs_requirement_doc)`，失效方剔除。
8. **失败非阻断**：生成/对齐失败记 WARN 并继续归档（沿用归档既有非阻断哲学）。

**不在本次范围**：清理 9 个历史探索文件（保留可追溯）；改造 `/venus:spec-propose` **指令版**（其 Step 0 位于 `CMD:SKIP` 内，指令版本就不含迁移步骤，维持现状）；改动 `tr-impl-auto-migration`（探索文件直建变更目录，无暂存层）与 `tr-impl-debug` 的探索文件逻辑（无 `openspec/explorations/` 落点）；修改 `DEFAULT_WORKFLOWS`、`deriveCommandContent` 派生器。

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `spec-workflow-skills`: ① `venus_spec_propose` 需求补充「探索文件**移动**入变更目录且不保留原件（失败保留）」语义；② `venus_spec_archive` 需求新增「**预归档需求文档生成**」检查点（存在性判定 → 委派生成 / 就地增量对齐 → 失败 WARN 非阻断），并声明落点为变更目录、由既有步骤 6 迁移至 devdocs。
- `spec-bulk-archive-skill`: `归档单元执行序列` 需求在 a.5 与 b 之间新增 **a.6 需求文档生成**（同语义双分支 + 失败 WARN 不中止批次），并声明白名单须含 `Skill(venus_tr_docs_requirement_doc)`。
- `tr-workflow-suite-skills`: ① `venus_tr_impl_workflow` 需求反转「迁移后保留源件」为「迁移后删源」，并移除 §3.5 需求文档生成；② `venus_tr_impl_auto_workflow` 同构反转 + Phase 3 生成移除 + Phase 5 内联归档步骤追加需求文档生成；③ `venus_tr_impl_debug` 移除 Phase 7.3 需求文档双分支（其能力迁至 archive）；④ `venus_tr_impl_genfull` 移除 Stage 2.3 生成，Stage 4 继承 archive 生成语义。
- `tool-call-whitelist`: `venus_spec_archive` / `venus_spec_bulk_archive` 新增 `Skill(venus_tr_docs_requirement_doc)` 委派条目；`venus_tr_impl_workflow` / `tr_impl_debug` / `tr_impl_genfull` 剔除失效条目（正文 ↔ 白名单一致性硬约束）。
- `skill-profile`: `DEPS` 表增删（archive/bulk-archive 加 `tr-docs-requirement-doc`；tr_impl 三技能剔除），默认安装集 8 → 9 项。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/spec-propose.ts`: 单一定义源正文 —— Step 0.6 迁移语义明确为「移动 + 删源（失败保留）」。该段位于 `CMD:SKIP` 内，指令版不含，无需双改。
- `src/core/templates/workflows/spec-archive.ts`: **单一定义源**（`deriveCommandContent` 自动派生指令版）—— 新增步骤 4.8（需求文档生成双分支 + 失败 WARN 非阻断）；`allowedTools` 补 `Skill(venus_tr_docs_requirement_doc)`。
- `src/core/templates/workflows/spec-bulk-archive.ts`: **单一定义源** —— 新增步骤 a.6（平行同语义 + 单变更失败隔离）；`allowedTools` 同步补齐。
- `src/core/templates/workflows/tr-impl-workflow.ts`: **双处同步**（skill 正文 + 手写 command 正文）—— Phase 2.3 改移动语义、删除 Post-Migration 保留段、Phase 2.0 checkpoint 句改写、§3.5 生成移除、guardrails 同步、`allowedTools` 剔除。
- `src/core/templates/workflows/tr-impl-auto-workflow.ts`: **双处同步** —— Phase 2 反转保留句、Phase 3 生成移除、Phase 5 步骤清单追加生成、guardrails 同步。
- `src/core/templates/workflows/tr-impl-debug.ts`: **双处同步** —— Phase 7.3 双分支整段移除、Phase 7 摘要与 guardrails 同步、`allowedTools` 与 `compatibility` 剔除。
- `src/core/templates/workflows/tr-impl-genfull.ts`: **双处同步** —— Stage 2.3 生成移除、Bridge 2 与完成摘要同步、`allowedTools` 剔除。
- `src/core/templates/workflows/tr-docs-requirement-doc.ts`: **双处同步** —— 路由表补「归档生成」入口说明（active 变更目录为目标路径，与既有路由一致，仅语义澄清）。
- `src/core/profiles.ts`: `DEPS` 增删 + 注释同步（默认集仍 8 项显式，注解决议 1 项 → 实际安装 9 项）。
- `test/profiles.test.ts`: `spec-archive` / `tr-impl-workflow` / `tr-impl-genfull` / `tr-impl-debug` 注入断言更新（含 genfull **顺序**断言）。
- `test/commands.test.ts`: 默认集安装数 8 → 9、`injectedDeps` 期望 `['tr-docs-requirement-doc']`、相关注释同步。
- `test/`: 新增结构指标断言（探索文件移动语义 / 归档生成步骤存在 / 四条链路无生成调用 / 双分支存在）。
- `skills/`: 静态快照，改动后 `pnpm build && pnpm generate:skills` 重生成（否则 `skills-parity.test.ts` 失败）。
- `docs/skills-manual.md`: 逐技能手册 —— 三处技能段的**行为描述**（探索文件保留 / 需求文档生成时机 / Phase 7.3 分支 / Stage 2.3 / 归档步骤序列）与 **allowed-tools 列表**同步；由 `tool-call-whitelist` 规格「快照与文档同步」的既有义务约束。
- `docs/genfull-guide.md`: 编排指南 —— Stage 2.3、Bridge 2 就绪检查、workspace-planning 降级文案、allowed-tools 列表同步。
- `docs/openspec-comparison.md`: 5.4「需求文档归档」节改为「归档生成与归集」，探索文件描述补"不保留原件"。
- `package.json` / `CHANGELOG.md`: 按 AGENTS.md 守则递增版本号并归档 `[Unreleased]`。
- `openspec/CONTEXT.md`: 归档时更新「探索文件」「人工域」「就地增量对齐」三术语定义（触发点由 debug Phase 7.3 改指归档生成步骤），并按需补「归档生成制品」术语。

**不修改**：`derive-command.ts`（`spec-*.ts` 自动派生）、`prompt-gate.ts` / `flowchart-gate.ts`、`registry.ts`（技能名/类型/总数 27 不变）、`DEFAULT_WORKFLOWS`（不改显式集）、`tr-impl-auto-migration.ts`（无落点）。

### 向后兼容

无破坏性变更。两条规则均为**流程内制品路由**调整，不改变任何确认门语义、制品格式或技能接口：

- 探索文件"不留原件"只作用于**迁移成功**路径；失败路径保留源件（安全网方向不变）。
- 需求文档生成时机后移到归档，**产物路径最终一致**（`openspec/devdocs/YYYY-MM-DD-<name>-需求文档.md`），历史归档目录不受影响。
- 人工域保护语义延续（由 debug Phase 7.3 迁至归档生成步骤），已人工编辑的文档在归档时仍不被覆盖。
- 唯一可见副作用是默认安装集 8 → 9 项（多装 `tr-docs-requirement-doc`）；目标项目已安装旧版产物由 `venus update` 按内容指纹正常升级。

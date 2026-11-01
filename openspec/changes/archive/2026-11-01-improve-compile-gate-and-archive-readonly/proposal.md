## Why

两条同源缺陷，都源于「约束写在正文里、却没有任何外部校验点」：

**缺陷一：实现后编译检查能力弱，且存在合法跳过路径。** `iagent_spec_apply` 的 Step 8 标了「⚠️ 强制」，但正文同时给出多条退出通道：8.2「未探测到技术栈 → 告警并跳过」、8.9 `[3] 跳过并记录警告`、Output 模板直接写「跳过检查并归档（记录警告）」。同时配置契约是破的——8.1 读 `openspec/config.yaml` 的 `compileCheck`（该文件当前只有 `schema: spec-driven`，无此段，缺省语义未定义，而 `debug.ts` 写「默认禁用」、apply 隐含「默认启用」，两处矛盾）；8.3 解析 `allowedEditRoots`（`getApplyInstructions` 根本不返回该字段）；8.4 硬编码 `tsc --noEmit` / `pnpm run build`（本仓库实际构建是 `node build.js`）；46-50 行声明的 `apply.incrementalCheck` 在 Step 8 没有任何对应子步骤。父流程（`workflow` Phase 5.1、`auto-workflow` Phase 5）的就绪条件写「编译检查通过」，但可核对的只有自由文本报告——**「是否真的跑过」无法被机器校验**，这正是「措辞已强制却仍被跳过」的根因。

**缺陷二：归档写入面过宽，越过「历史不可变」边界。** 两个归档技能会写入 6 个位置：主 spec（预期）、`openspec/CONTEXT.md`、`specs/<cap>/explorations.md`、变更目录内 `需求文档.md`（4.8 就地增量对齐 / a.6）、把 `需求文档.md` 从归档目录**迁出**到 `openspec/devdocs/`（Step 6 / b.5 第二段）、`ARCHIVE-INDEX.md`（含 bulk 10.g 的**全量重建**分支）。用户诉求是「归档时不调整历史变更提案内容，只更新相关主 spec，已归档提案不处理」——现状与 `debug.ts:546`「归档只读：MUST NOT 修改 `openspec/changes/archive/`」的自有原则也不一致：**有这条护栏的是 debug，两个归档技能反而没有**。

现在做的原因：`iagent_spec_apply` 的编译门已在真实流程中被跳过（探索阶段实测），而归档侧的需求文档分支已与提案验证后的文档桥职责重叠（2026-10-10 起生成前移，2026-10-25 改为四值状态）——继续保留只会制造两套语义。

## What Changes

**A. 编译检查升级为「硬门 + 结构化证据」（Q1 / Q5）**

- Step 8 成为**硬门**：删除 8.9 的 `[3] 跳过并记录警告` 与 Output「跳过检查并归档」；仅保留两种非通过终态——`disabled`（项目级显式禁用，写进摘要）与 `not-applicable`（无可编译产物，**不得记 PASS**）。
- 失败自动修复（`autoFix=true` 时最多 `maxRetries` 次，缺省 3）后**暂停**并报告；MUST NOT 进入测试门、MUST NOT 进入归档。
- 新增**编译证据契约**：`.openspec-tmp/pipeline-<change-name>/compile-report.md`（列名 `change` / `command` / `exitCode` / `errorCount` / `fixedCount` / `status` / `scope` / `timestamp` / `reason`，多条命令逐行记录）+ handoff 包 `## 阶段结论` 的 `compile` 行。
- 父流程（`workflow` Phase 5.1、`auto-workflow` Phase 4.2/5.1）**只读证据**做就绪检查：`status ∈ {pass, not-applicable, disabled}` 放行（后两者记 WARN，MUST NOT 表述为「通过」）；`missing` / `fail` / 证据不可解析 → 阻断归档并回实现。**父流程 MUST NOT 自行执行编译**（编译由 apply 单点负责）。
- 既有 lint / 前端校验保留为 Step 8 的**辅助检查**（失败仅 WARN，不参与编译终态、不计入 `errorCount`），MUST NOT 因重写 Step 8 而静默移除。
- `compileCheck.autoFix=false` 时首次失败即记 `fail` 并暂停（不进入修复循环）；批后增量检查复用收尾全量的同一条命令、不做「轻量命令」二分（避免第二套命令真源）。

**B. 配置载体改为 `.iagent/config.yaml`（Q2 / Q3 / Q4）**

- 新增 `compileCheck` 段：`enabled`（默认 `true`）、`command`（可选，空=自动探测）、`timeoutMs`（默认 `600000`）、`incremental`（默认 `true`）、`autoFix`（默认 `true`）、`maxRetries`（默认 `3`）；接口 / 解析 / 默认内容 / `iagent config show` 单点扩展在 `src/core/project-config.ts` 与 `src/commands/config.ts`。
- `openspec/config.yaml` 的同名段与 `apply.incrementalCheck` 不再作为权威来源，仅做一次 WARN 提示（MUST NOT 双源）。
- 编译命令**运行时确定**（Q3）：显式 `compileCheck.command` → 变更文件**最近的构建描述符**（`package.json` 的 `scripts.build` + lockfile / `tsconfig.json` / `pom.xml` / `build.gradle` / `build.xml` / `go.mod` / `Cargo.toml` / `build.js` 等）→ 不适用；monorepo 按最近祖先描述符**去重后逐条执行**，每条命令都记录；模板 MUST NOT 固化本仓库的 `node build.js` / `tsc --noEmit` 为唯一命令。
- 补齐 `apply.incrementalCheck` 的真实步骤（批后编译检查，复用收尾全量的同一命令；收尾全量保留），并收敛到 `compileCheck.incremental`（默认 `true`）。
- 8.3 的变更范围来源改为「变更文件 + `git diff` + 状态 JSON 可用字段」的降级链，去掉对不存在的 `allowedEditRoots` 的依赖；字段缺失时降级**必须记 WARN**，不得静默跳过。

**C. 归档写入面收敛（Q6-B + Q7）**

- 禁止改写已归档变更：`openspec/changes/archive/**` 既有内容只读（整目录移动不属于改写）；两个归档技能补「归档只读」护栏（措辞对齐 `debug.ts:546`）。
- **归档收尾清理流程级工作区**：`.openspec-tmp/pipeline-<change-name>/`（含 `compile-report.md` 与 `handoff-pack.md`）在归档成功后由归档技能清理（批量按单元、失败单元保留供诊断）；这是既有「流程收尾统一清理」条款的落地 —— apply 不再清理后，归档侧是唯一清理点。
- **删除归档侧需求文档写入分支**：`spec-archive` 删除 4.8（就地增量对齐 / 历史兼容生成）与 Step 6（迁出 `devdocs/`）；`spec-bulk-archive` 删除 a.6 与 b.5 的需求文档迁移。两者只保留「检测 `需求文档.md` 存在性 + 摘要报告」。
- `requirementDocStatus` 保留在 workflow / auto-workflow → archive 的协议中，仅用于报告与跨会话追溯，**MUST NOT 再用它触发生成 / 对齐 / 迁移**。

**D. 归档索引与依赖面收敛（Q8 / Q9 / Q10）**

- `ARCHIVE-INDEX.md` 保持**纯追加**，禁止全量重建：bulk 10.g 由「无法解析则重建」改为「WARN + 人工修复提示 + 保留本批最小追加」。
- `CONTEXT.md` 与 `specs/<cap>/explorations.md` 仍由归档维护、失败非阻断。
- `src/core/profiles.ts` 的 `DEPS` 移除 `spec-archive` / `spec-bulk-archive ⇒ requirement-doc`；`workflow` / `auto-workflow` **显式声明** `requirement-doc`（其验证后文档桥仍无条件委派该技能，需防死引用）。
- 两个归档技能 `allowedTools` 移除 `skillDelegation(['requirement_doc'])`；为「归档收尾清理」的真实调用增列 `Bash(node:*)`（跨平台删除，避免更宽的 `Bash(rm:*)`）。

**E. debug 缺省语义对齐（范围最小）**

- `debug.ts` 仅改 Phase 5 的编译检查载体与缺省语义（`.iagent/config.yaml`、默认启用）；不扩大 debug 职责、不改其编译检查实行为。

**F. 模板平衡**

- Step 8 细则下沉 `references/compile-check.md`（主 SKILL 保持渐进披露与 ≤500 行预算）；网络/超时/依赖未安装等边界一律计为失败（B2 / B3），不得归类为跳过。

## Capabilities

### New Capabilities

- `compile-check-gate`: 实现后编译检查的配置契约（`.iagent/config.yaml` 的 `compileCheck` 段与默认值单一源）、运行时编译命令判定、硬门终态模型、编译证据契约与生命周期、证据供父流程消费的字段约定、旧配置来源弃用策略、细则 references 下沉与预算约束。

### Modified Capabilities

- `spec-workflow-skills`: `spec-apply 实现技能` 的 Step 8 由「可跳过的软门」改为硬门 + 证据 + 范围降级链 + 批后增量检查 + Step 10 保留证据；`spec-apply 派发协议与共享资源协议` 的工作区生命周期更新为「独立调用保留证据 / 归档收尾清理」；`spec-archive 归档技能` 删除需求文档写入 / 迁出分支，改为存在性报告 + 归档只读护栏 + 索引纯追加 + 归档收尾清理。
- `spec-bulk-archive-skill`: 归档单元执行序列删除 a.6 写入分支与 b.5 的需求文档迁移（保留探索记忆同步、新增存在性报告）；批量索引单点更新取消「无法解析则全量重建」。
- `workflow-suite-skills`: 新增父流程编译证据就绪检查（workflow Phase 5.1 / auto-workflow Phase 5.1 只读证据、MUST NOT 自行编译）；更新 Phase 5 归档描述（不再提 4.8 对齐与 devdocs 迁移）。
- `skill-profile`: `DEPS` 移除归档类 → `requirement-doc`，`workflow` / `auto-workflow` 显式声明该依赖（默认安装集由 9 项降为 8 项）；`iagent config show` 展示生效 `compileCheck`。
- `tool-call-whitelist`: 删除「归档技能的需求文档委派条目」需求，新增「归档技能不委派需求文档技能」的授权面收敛需求。
- `host-orchestration`: 归档类技能移除唯一的 `Skill(iagent-requirement-doc)` 条目后不再被派生为编排技能 —— 更新「编排适配注入面按模板委派派生」的最小覆盖清单，并明确「无委派即不注入宿主编排段 / 不生成 `allowed_subagents`」在归档类上的结果。

## Impact

### 直接影响的文件

**配置层**

- `src/core/project-config.ts`：`ProjectConfig` / `ResolvedProjectConfig` 增加 `compileCheck`；新增解析与默认值单一源；`defaultConfigFileContent()` 增注释示例。
- `src/commands/config.ts`：`runConfigShow` 展示生效 `compileCheck`。
- `test/config-command.test.ts` / `test/commands.test.ts` / `test/completion-config.test.ts`：`config show` 与默认配置内容断言。

**模板层（唯一源，command 版由 `derive-command.ts` 派生）**

- `src/core/templates/workflows/spec-apply.ts`：Step 8 重写（含 `references/compile-check.md` 新引用）、Step 6 批后增量检查、Step 10 保留证据、Output 示例去跳过项、Guardrails 同步。
- `src/core/templates/workflows/spec-archive.ts`：删除 4.8 与 Step 6，新增只读报告步骤、「归档只读」护栏与归档收尾清理，`allowedTools` 去 `skillDelegation(['requirement_doc'])` 与 `Bash(ls:*)`、增 `Bash(node:*)`。
- `src/core/templates/workflows/spec-bulk-archive.ts`：删除 a.6 与 b.5 的需求文档迁移，10.g 改 WARN，补护栏与单元清理，`allowedTools` 去委派条目、增 `Bash(node:*)` 并移除 `skillDelegation` 导入。
- `src/core/templates/workflows/workflow.ts`：Phase 5.1 就绪检查读编译证据、Phase 5.2 归档描述更新。
- `src/core/templates/workflows/auto-workflow.ts`：Phase 4.2 / Phase 5.1 / 5.2 同步（证据就绪检查、归档描述、错误处理措辞）。
- `src/core/templates/workflows/debug.ts`：仅 Phase 5 编译检查载体与缺省语义一行。

**依赖与白名单**

- `src/core/profiles.ts`：`DEPS` 与注释（移除 archive ⇒ requirement-doc；workflow / auto-workflow 显式声明）。
- `src/core/templates/tool-whitelist.ts`：不改实现，仅被测断言引用（`skillDelegation` 仍在其他模板使用）。

**模板函数调用面（CodeGraph upstream，需随之核对/更新）**

- `getSpecApplyChangeSkillTemplate` / `getSpecArchiveChangeSkillTemplate` / `getSpecBulkArchiveSkillTemplate` / `getAutoWorkflowSkillTemplate` / `getWorkflowSkillTemplate` 的单一注册点为 `src/core/templates/registry.ts`，测试面为 `test/template-derivation.test.ts`、`test/templates.test.ts`、`test/allowed-tools.test.ts`、`test/artifact-dataflow.test.ts`、`test/spec-workflow-contract.test.ts`、`test/skill-size-budget.test.ts`、`test/host-orchestration.test.ts`、`test/pi-native.test.ts`、`test/command-reference-refs.test.ts`。
- `WORKFLOW_DEPS` / `DEPS`（`src/core/profiles.ts`）影响默认安装集与 `init` / `update`；测试：`test/profiles.test.ts`、`test/commands.test.ts`（`injectedDeps`）、`test/legacy-migration.test.ts`（安装数）、`test/artifact-dataflow.test.ts` A5/A6、`test/allowed-tools.test.ts`、`test/command-reference-refs.test.ts`。
- 归档技能 `Skill(...)` 条目移除会改变 `deriveOrchestrationDelegations` 的派生集合（`ORCHESTRATING_WORKFLOW_IDS` 不再含 `spec-archive` / `spec-bulk-archive`），测试面：`test/host-orchestration.test.ts`（派生集合回归锁）、`test/allowed-tools.test.ts`（委派技能集合回归锁）、`test/pi-native.test.ts` / `test/opencode-v2.test.ts`（编排产物形态）。
- `.iagent/config.yaml` 解析影响 `src/commands/config.ts`（show）与 init/update 默认配置；测试：`test/completion-config.test.ts`、`test/config-command.test.ts`、`test/commands.test.ts`、`test/legacy-migration.test.ts`。
- `getApplyInstructions`（`src/commands/spec.ts`）与 `getChangeStatus`（`src/core/spec/status.ts`）是 CLI 契约：本次**不新增**编译证据字段（证据走文件而非 JSON），故仅需确认既有字段被 8.3 正确消费；若实现时确需扩展，须同步 JSON 契约与测试。
- `previewArchive` / `executeArchive`（`src/core/spec/archive.ts`）保持「只做状态检查 + 目录移动」，本次不新增改写行为。

**构建与快照**

- `skills/` 静态快照（`pnpm build && pnpm generate:skills`）、`package.json` 版本号、`CHANGELOG.md`。

### 风险与影响面评估

风险等级 **HIGH**：同时触及技能行为（编译门/归档语义）、默认安装集（用户可见副作用）、配置契约（载体迁移）、编排派生面（归档类退出编排）与历史归档语义（不可逆方向的收紧）。影响面已按上述文件逐条列出，测试面覆盖 17 个既有测试文件 + 新增 1 个编译配置测试文件。

### Breaking Changes

1. **配置载体迁移（行为不兼容）**：`compileCheck` 只在 `.iagent/config.yaml` 生效；项目若把该段写在不属于本工具权威面的 `openspec/config.yaml`（或使用 `apply.incrementalCheck`），本次仅输出一次 WARN，不再读取其取值。缺省值固定为「启用」。
2. **默认安装集变化（用户可见）**：`DEPS` 移除 `spec-archive` / `spec-bulk-archive ⇒ requirement-doc` 后，未配置 `workflows` 的项目默认安装由 **9 项降为 8 项**（不再随装 `requirement-doc`）；已配置 `workflow` / `auto-workflow` / `debug` 的项目安装集**不变**（三者均显式声明该依赖）。
3. **归档能力收缩**：归档不再生成、不就地增量对齐、不迁出 `openspec/devdocs/` 需求文档；`需求文档.md` 随变更目录留在 `archive/` 内，归档仅报告存在性。
4. **编译门收紧**：人工「跳过编译检查」通道被删除；仅项目级显式禁用与「无可编译产物」两种非通过终态。此前依赖跳过路径的项目在升级后会遇到新的暂停点。
5. **版本判定**：按 AGENTS.md「BREAKING ⇒ major；判定有歧义时取较大的递增位」，本变更四条均属用户可见的不兼容行为（其中归档能力收缩是能力移除、`iagent config show` 输出是 CLI 行为变更、两个归档技能的 `allowed-tools` 取值是 frontmatter 契约面变更），且项目 CHANGELOG 的 `### BREAKING` 小节历来只出现在 major 版本。故版本为 **`2.1.0 → 3.0.0`**（major），Breaking 说明逐条记录，不得静默。

### Out of Scope

- 不新增 `iagent compile` 之类的 CLI 编译执行器（编译执行仍由技能正文按构建描述符驱动）。
- 不修改 `previewArchive` / `executeArchive` 的行为（保持「状态检查 + 目录移动」）。
- 不实现 `debug` 的编译检查实行为，仅统一其载体与缺省语义表述。
- 不迁移 `openspec/config.yaml` 的历史 `compileCheck` / `apply.*` 段内容（只 WARN，不自动搬运）。
- 不修改 `iagent_requirement_doc` 的生成规则；仅对齐其调用方说明（归档侧不再调用该技能）。不改提案侧文档桥（workflow / auto-workflow / debug 的生成 / 跳过桥保留）。
- 不为已归档变更回填或修复历史 `需求文档.md` / `devdocs/` 内容。
- 不引入索引、SQLite 或跨变更检索能力（DEC-2 退役结论不变）。
- 不扩展父流程的 `Bash(tsc:*)` 等编译权限（父流程不执行编译，见 design DEC-12）。

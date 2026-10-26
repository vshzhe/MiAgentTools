# Tasks: improve-skill-orchestration-consistency

## 1. Markdown-first 残留清除

- [x] 1.1 [代码] 修正 `iagent_migration` Phase 4 修复循环：去掉 `sync the change tasks.json` 与 `re-render tasks.md`，改为直接编辑 `tasks.md`（勾选 / 新增任务）
  - 文件：`src/core/templates/workflows/migration.ts`
  - 验证：生成快照后 `skills/iagent_migration/SKILL.md` 不含写 `tasks.json` 的指令
  - Spec Ref：`template-generation / 模板正文 SHALL 无 Markdown-first 主产物残留`
  - Scenario Ref：migration 修复任务状态不再回写 JSON

- [x] 1.2 [代码] 修正 `iagent_spec_explore` 捕获表与结尾摘要：`change.json 的 design/proposal 段` → `design.md` / `proposal.md`
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：生成快照后 `skills/iagent_spec_explore/SKILL.md` 捕获表指向 Markdown
  - Spec Ref：`spec-workflow-skills / spec-explore 制品捕获目标 SHALL 为 Markdown`
  - Scenario Ref：捕获映射为 Markdown
  - Scenario Ref：结尾摘要不引用 JSON

- [x] 1.3 [测试][功能][P0] 加宽 `markdown-first-regression.test.ts`：扫描全部技能模板、指令模板与 references 正文中 `tasks.json` / `change.json` 的写动词（`sync` / `write` / `re-render` / `update`），legacy 只读句式白名单豁免
  - 文件：`test/markdown-first-regression.test.ts`
  - 验证：1.1 / 1.2 修复前失败、修复后通过
  - Spec Ref：`template-generation / 模板正文 SHALL 无 Markdown-first 主产物残留`
  - Scenario Ref：回归锁扫描全部模板

## 2. 编排器一致性收束

- [x] 2.1 [代码] `iagent_auto_workflow` Phase 4/5 改为经 Skill 委派 `iagent_spec_apply`（`auto-mode=true`）/ `iagent_spec_archive`（`change-name`），条件委派 `iagent_test`；删除内联执行描述与"不重定义协议"的自相矛盾表述
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文出现委派指令，白名单含 `Skill(spec_apply/spec_archive/test)`
  - Spec Ref：`workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议`
  - Scenario Ref：Phase 4 委派而非内联
  - Scenario Ref：Phase 5 委派而非内联
  - Scenario Ref：测试执行门继承

- [x] 2.2 [代码] 删除 `iagent_workflow` 中 stale Examples 与冲突 Guardrail（`MUST use inline generation ... no Skill delegation`、`Executing inline artifact generation`），示例按委派流程重写
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文不含 inline generation 矛盾表述，Phase 2.3 委派声明与示例一致
  - Spec Ref：`workflow-suite-skills / 编排技能正文 SHALL 无被移除阶段的 stale 残留`
  - Scenario Ref：workflow 正文委派一致

- [x] 2.3 [代码] workflow / auto-workflow 实现验证桥接：apply→archive 之间委派 `iagent_spec_verify`，或在归档桥就绪检查中显式声明省略理由
  - 文件：`src/core/templates/workflows/workflow.ts`、`src/core/templates/workflows/auto-workflow.ts`
  - 验证：归档桥就绪检查反映该决策；`DEPS` 与行为一致
  - Spec Ref：`workflow-suite-skills / 实现验证桥接 SHALL 与 DEPS 一致`
  - Scenario Ref：workflow 实现验证桥接

- [x] 2.4 [测试][功能][P0] 结构断言：auto-workflow 正文含委派 `spec_apply/spec_archive`，白名单含对应 `Skill(...)`；workflow 正文无 `inline generation` / `no Skill delegation` 残留
  - 文件：`test/template-consistency.test.ts`
  - 验证：断言通过
  - Spec Ref：`workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权`
  - Scenario Ref：auto-workflow 委派 apply/archive 时白名单齐备

## 3. 验证契约统一与双门去重

- [x] 3.1 [代码] 统一提案验证维度表述为唯一契约（D1-D5 核心 + D6-D10 条件，统一 90%），集中于 `iagent_spec_verify_proposal`；删除 workflow / auto-workflow / debug / spec-propose 中的 `D1-D6` / `D1-D9` 子集表述
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`、`workflow.ts`、`auto-workflow.ts`、`debug.ts`、`spec-propose.ts`
  - 验证：全模板维度表述一致
  - Spec Ref：`spec-workflow-skills / spec-verify-proposal SHALL 为提案验证维度的唯一真源`
  - Scenario Ref：维度定义集中于 verify-proposal
  - Spec Ref：`workflow-suite-skills / 提案验证契约 SHALL 唯一且双门非重叠`
  - Scenario Ref：维度表述唯一

- [x] 3.2 [代码] `iagent_proposal_review` 定位为深度层：正文明确其为评分门 PASS 后的非重叠深度复查，不再描述为重复 D1-DN 评分；修正 Phase 编号跳号（4→9）
  - 文件：`src/core/templates/workflows/proposal-review.ts`
  - 验证：定位表述与 Phase 编号正确
  - Spec Ref：`workflow-suite-skills / 提案验证契约 SHALL 唯一且双门非重叠`
  - Scenario Ref：双门职责非重叠
  - Spec Ref：`template-generation / 技能命名与注释一致性`
  - Scenario Ref：Phase 编号连续

- [x] 3.3 [测试][功能][P1] 回归锁：扫描全模板，断言提案验证维度契约串唯一，`D1-D6` / `D1-D9` 命中即失败
  - 文件：`test/template-consistency.test.ts`
  - 验证：断言通过
  - Spec Ref：`spec-workflow-skills / spec-verify-proposal SHALL 为提案验证维度的唯一真源`
  - Scenario Ref：消费方只引用不重定义

## 4. 单一源与死文件清理

- [x] 4.1 [代码] `workflow` / `auto-workflow` / `debug` 改用 `GATE_PROTOCOL_PREAMBLE` 常量，删除手写导言
  - 文件：`src/core/templates/workflows/workflow.ts`、`auto-workflow.ts`、`debug.ts`
  - 验证：`GATE PROTOCOL — ACTIVE` 字面量仅存于 `prompt-gate.ts`
  - Spec Ref：`template-generation / 门控导言与调用类白名单 SHALL 单一源`
  - Scenario Ref：六个含门技能均使用共享导言

- [x] 4.2 [代码] 删除 `iagent_workflow` / `iagent_auto_workflow` 的孤儿 `references/prompt-gate.md`、`references/flowchart-gate.md`（保留 workflow 被引用的 `verification-protocol.md`）
  - 文件：`src/core/templates/workflows/workflow.ts`、`auto-workflow.ts`
  - 验证：生成目录无孤儿 references
  - Spec Ref：`template-generation / references 文件 SHALL 无孤儿`
  - Scenario Ref：workflow / auto-workflow 清理孤儿门控文件

- [x] 4.3 [代码] 修正 `prompt-gate.ts` / `flowchart-gate.ts` 文档注释技能清单重复（`iagent_workflow` 计两次）
  - 文件：`src/core/templates/prompt-gate.ts`、`src/core/templates/flowchart-gate.ts`
  - 验证：注释列表无重复且与实际使用集合一致
  - Spec Ref：`template-generation / 技能命名与注释一致性`
  - Scenario Ref：注释不重复计数

- [x] 4.4 [代码] 编排技能指令版与技能骨架一致性修复 + 派生覆盖度可观测：修复 `iagent_workflow` 指令版 Phase 2.0 缺 CONTEXT.md 预迁移检查（现为 Pre-Migration Verification + Impact Analysis）；新增派生覆盖度测试锁定 `deriveCommandContent` 使用数 ≥ 8（基线）。**实现偏差（记录）**：未对 workflow/auto-workflow/debug/migration 做全量派生转换 —— 这四项的手写指令版是刻意精简的摘要，全量派生会大幅改变既有指令形态（与最小改动原则冲突）；改以「骨架一致性 + 覆盖度可观测」满足本变更契约（template-generation / 指令正文派生覆盖 SHALL 可度量）。后续如需全量派生，应作为独立变更。
  - 文件：`src/core/templates/workflows/workflow.ts`、`auto-workflow.ts`、`debug.ts`、`migration.ts`
  - 验证：指令版覆盖技能版阶段骨架与确认门
  - Spec Ref：`template-generation / 指令正文派生覆盖 SHALL 可度量`
  - Scenario Ref：编排技能指令与技能骨架一致

- [x] 4.5 [测试][单元][P1] 回归锁：`GATE PROTOCOL — ACTIVE` 唯一、references 无孤儿、`Skill(...)` 无幽灵条目
  - 文件：`test/template-consistency.test.ts`
  - 验证：断言通过
  - Spec Ref：`template-generation / 门控导言与调用类白名单 SHALL 单一源`
  - Scenario Ref：门控导言字面量唯一
  - Spec Ref：`template-generation / references 文件 SHALL 无孤儿`
  - Scenario Ref：孤儿 references 被拦截
  - Spec Ref：`workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权`
  - Scenario Ref：白名单无幽灵条目

## 5. DEPS 与补全表

- [x] 5.1 [代码] 修正 `DEPS['auto-workflow']`：移除冗余 `workflow`，补 auto-workflow 新委派面（`spec-apply` / `spec-archive` / `test`）
  - 文件：`src/core/profiles.ts`
  - 验证：`resolveWorkflows(['auto-workflow'])` 不含 `workflow`
  - Spec Ref：`skill-profile / auto-workflow 依赖注入面 SHALL 与其委派面一致`
  - Scenario Ref：移除冗余 workflow 依赖
  - Scenario Ref：委派面与依赖面一致

- [x] 5.2 [代码] `IAGENT_COMMANDS` 的 `spec.subcommands` 补 `migrate` / `validate`，同步 `spec` 描述字符串
  - 文件：`src/commands/completion.ts`
  - 验证：生成的 bash / powershell 脚本含 `migrate` 与 `validate` 补全
  - Spec Ref：`spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令`
  - Scenario Ref：补全表含 migrate 与 validate

- [x] 5.3 [测试][单元][P1] 补全一致性与 DEPS 注入断言：`spec` 子命令来自 Commander 程序派生并相等；`resolveWorkflows(['auto-workflow'])` 断言
  - 文件：`test/completion-config.test.ts`、`test/profiles.test.ts`
  - 验证：断言通过
  - Spec Ref：`spec-workflow-cli / shell 补全 SHALL 覆盖全部 spec 子命令`
  - Scenario Ref：补全表由程序派生并受断言约束
  - Spec Ref：`skill-profile / auto-workflow 依赖注入面 SHALL 与其委派面一致`
  - Scenario Ref：既有装机的无删除保证

## 6. 文档与 description

- [x] 6.1 [使用说明] 修正 `docs/skills-manual.md`：版本号（4.0.0 → 6.1.0）、类型表（impl 4 / review 3 / docs 2 / spec 7）、workflow 描述（委派 spec_explore/spec_propose）
  - 产出：`docs/skills-manual.md`
  - 验证：类型表与 `getSkillTemplates()` 实测一致

- [x] 6.2 [代码] 为全部技能 description 补齐触发词（中英）与 `NOT for` 排歧（相邻技能边界）
  - 文件：`src/core/templates/workflows/*.ts`
  - 验证：每个 description 含触发词；相邻技能含 NOT for
  - Spec Ref：`agent-tool-identity / 技能 description SHALL 采用统一结构`
  - Scenario Ref：全部技能具备触发词
  - Scenario Ref：跨技能边界含 NOT for 排歧

- [x] 6.3 [测试][单元][P1] 扩展 `description-format.test.ts`：断言全部技能含触发词；以清单锁定需含 `NOT for` 的技能集合
  - 文件：`test/description-format.test.ts`
  - 验证：断言通过
  - Spec Ref：`agent-tool-identity / 技能 description SHALL 采用统一结构`
  - Scenario Ref：长度约束保持

## 7. 版本与快照

- [x] 7.1 [代码] `package.json` 版本递增至 6.1.0（技能模板行为变更 → minor）；`CHANGELOG.md` 归档 `[Unreleased]` 为 `## [6.1.0]` 并同步底部链接
  - 文件：`package.json`、`CHANGELOG.md`
  - 验证：版本与变更日志一致

- [x] 7.2 [代码] 运行 `pnpm build && pnpm generate:skills` 刷新 `skills/` 快照；`pnpm test` 全绿
  - 文件：`skills/`、`dist/`
  - 验证：`test/skills-parity.test.ts`、`allowed-tools.test.ts`、`template-derivation.test.ts`、新增回归锁全部通过
  - Spec Ref：`template-generation / 指令正文派生覆盖 SHALL 可度量`
  - Scenario Ref：派生覆盖度可观测

## 8. 已评估、判定无需运行时测试

- [x] 8.1 [测试][功能][P2] 评估：编排器委派行为（auto-workflow 委派 apply/archive、验证桥接时机）为运行时 prompt 编排行为，仓库内无可驱动的运行时执行体（无 CLI 入口、无 HTTP 端点），无法在 vitest 中驱动。替代防线：以结构指标断言锁定正文委派与白名单齐备（2.4 / 4.5）。依据：纯 prompt 模板改造，与 `subagent-resource-sharing.test.ts` 既有判定同构。
  - Spec Ref：`workflow-suite-skills / 编排技能 SHALL 委派其声明的全部子技能且齐备授权`
  - Scenario Ref：auto-workflow 委派 apply/archive 时白名单齐备

## 9. 验证期补遗（实现结果与探索复核时发现）

- [x] 9.1 [代码] 补 3.2 遗漏项：在 `iagent_proposal_review` 主正文补「职责边界（双门非重叠）」深度层定位（首次编辑因 Phase 9 标题不唯一而整体回滚）
  - 文件：`src/core/templates/workflows/proposal-review.ts`
  - 验证：`skills/iagent_proposal_review/SKILL.md` 含「职责边界（双门非重叠）」与「深度层」
  - Spec Ref：`workflow-suite-skills / 提案验证契约 SHALL 唯一且双门非重叠`
  - Scenario Ref：双门职责非重叠

- [x] 9.2 [代码] 清理主 spec `template-generation` 的 JSON-first 残留 requirement（REMOVED delta：`jsonTemplate` 字段 / 生成协议 JSON-first 单一源 / JSON-first 快照同步）
  - 文件：`openspec/changes/improve-skill-orchestration-consistency/specs/template-generation/spec.md`（归档时对 `openspec/specs/template-generation/spec.md` 生效）
  - 验证：`iagent spec validate --change improve-skill-orchestration-consistency` 通过
  - 说明：Markdown-first 已实现但主 spec 未同步（在飞 `markdown-first-artifacts` 未覆盖 `template-generation`），此处以 REMOVED 补正

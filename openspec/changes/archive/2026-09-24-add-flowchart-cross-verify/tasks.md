# Tasks: add-flowchart-cross-verify

<!-- 任务类型标签：[代码] 实现代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/） -->

## 1. 共享模块（唯一源）

- [x] 1.1 [代码] 新增功能流程图文本唯一源模块，导出节点列类型 `FlowNodeColumn`、需求版列集 `REQUIREMENT_FLOW_COLUMNS`（节点/操作/触发条件/证据位置/异常路径）、缺陷链路版列集 `FAULT_CHAIN_FLOW_COLUMNS`（节点/操作/证据位置/标记）、参数化渲染 `buildFlowchartBlock(columns)`（共享「生成 → 用户最终确认 → 落盘」流程文本，仅列集注入）、压缩渲染 `buildFlowchartCompact(columns)`
  - 文件：`src/core/templates/flowchart-gate.ts`
  - 验证：`pnpm build` 通过；`buildFlowchartBlock(REQUIREMENT_FLOW_COLUMNS)` 生成文本含 Mermaid 模板、节点证据追溯规则、`[新建]` 标记规则、四条出口确认门；`buildFlowchartBlock(FAULT_CHAIN_FLOW_COLUMNS)` 含 `🔴异常` / `🟠根因` 标记口径；两版共享流程文本一致，仅列集不同
- [x] 1.2 [代码] **所有内联本块的技能正文 MUST NOT 引入新 Bash 命令**（`venus_tr_impl_workflow` / `venus_tr_impl_genfull` 的 `allowedTools` 仅含 venus/git/codegraph/ls，无 pnpm/npm）；`pnpm build && pnpm generate:skills` 属本变更 tasks 的执行动作，MUST NOT 写入技能正文
  - 文件：`src/core/templates/flowchart-gate.ts`
  - 验证：块文本中无任何 Bash 命令示例；`pnpm test` 的 `allowed-tools.test.ts` 通过（无需改白名单）

## 2. 5 个技能正文接入

- [x] 2.1 [代码] `venus_spec_explore` 接入**条件触发**的流程图产出与流程最终确认门（探索浮现明确业务功能流程时产出 + 确认；纯概念探讨或无流程时记录「本次无功能流程」直通，不阻断）；不改变其"无固定步骤、无强制产出"定位
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 验证：正文含条件触发的流程图产出段与直通分支；流程图文本**未被** `<!-- CMD:SKIP -->` 包裹（指令版同样需要）
  - **锚点说明**：本技能无「Initialize Structured Format」段（探索立场技能无固定结构模板），流程图文本 SHALL 以 `What You Might Do` 之后的独立小节接入，MUST NOT 被改造成固定编号步骤
- [x] 2.2 [代码] `venus_tr_impl_workflow` 在 **1.5.5**（1.5 探索文件更新之后、1.6 完成检测之前）新增强制的功能流程图产出 + 流程最终确认门；结构化格式增补 `## 功能流程图` 段
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`
  - 验证：正文含 1.5.5 章节与 `## 功能流程图` 段定义；位置使 1.6.6 聚合一致性门覆盖本制品；确认门四条出口齐备
- [x] 2.3 [代码] `venus_tr_impl_auto_workflow` 在 **1.5.5**（同构位置）新增强制流程图产出 + 确认门，并明文规定该确认门 MUST NOT 被 auto 语义跳过；结构化格式同步
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 验证：正文含 1.5.5 章节与「auto 语义不得跳过本门」明文；结构化格式含 `## 功能流程图` 段
- [x] 2.4 [代码] `venus_tr_impl_debug` 在 **2.5**（2.4 根因确认门之后、Phase 3 之前）新增强制的**缺陷链路变体**产出 + 确认门；诊断记录增补 `## 功能流程（缺陷链路）` 段；Phase 4 验证口径改为覆盖「异常节点 + 根因节点」
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：正文含 2.5 章节、缺陷链路节点范围（前置条件 → 触发 → 异常 → 根因）、`🔴异常` / `🟠根因` 标记；Phase 4 回归测试口径引用异常与根因节点
- [x] 2.5 [代码] `venus_tr_impl_genfull` 在 **Bridge 1** 新增功能流程图**兜底补建 + 确认**步骤（exploration.md 缺失 `## 功能流程图` 段时依 Decisions / 边界场景 / Codebase Findings 强制补建，并入 Bridge 1 门决策）；明文幂等规则
  - 文件：`src/core/templates/workflows/tr-impl-genfull.ts`
  - 验证：Bridge 1 段落含兜底补建步骤、与 Bridge 1 既有 exploration.md 兜底同构、幂等判定（已含经确认段落则直通）明文；Guardrails 段补入对应条目

## 3. 消费方接入

- [x] 3.1 [代码] `venus_spec_propose` 新增流程基准消费规则：design.md 引用流程图与节点清单（不重新发明流程）；tasks.md 每个任务标注对应节点 id（`[N4]` 形）；流程图缺失或未确认时降级为仅凭 exploration.md 并标注降级
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 验证：正文含节点 id 标注要求与降级分支；指令正文经 `deriveCommandContent` 自动同步
- [x] 3.2 [代码] `venus_spec_verify_proposal` 新增「流程图节点覆盖度」维度：`覆盖度 = 被覆盖节点数 ÷ 总节点数`；优先节点 id 显式标注、未标注时 AI 语义等价判定；纳入 90% 统一阈值与既有总分公式的 `triggered` 集合；无 `## 功能流程图` 段时 SKIP（不计入分母，MUST NOT FAIL）；FAIL 时列出未覆盖节点 id 清单
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 验证：正文含维度定义、SKIP 规则、`triggered` 集合纳入说明、未覆盖节点清单输出要求；MUST NOT 改动 D1-D9 既有算法与公式核心；指令正文经派生自动同步
  - **只读约束**：本技能 `allowedTools` 为 `Read, Glob, Grep, Bash(venus:*)`（无 Write/Edit），新维度 MUST 保持**只读评分**，MUST NOT 要求技能自行 Edit 修复制品（修复建议仅呈现给调用方）
  - **段落归属**：新维度正文置于 D1-D9 共享段（**非** `<!-- CMD:SKIP -->` 区），使指令版同步具备评分能力
- [x] 3.3 [代码] 核验 **D9 保留不动**与 `tr-docs-requirement-doc` 业务流程图**不被触碰**
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`、`src/core/templates/workflows/tr-docs-requirement-doc.ts`
  - 验证：`git diff` 中 D9 维度定义无修改；`tr-docs-requirement-doc.ts` 无改动

## 4. 手写压缩指令正文同步（防漂移）

- [x] 4.1 [代码] 手工同步 `getTrImplWorkflowCommandTemplate().content` 的流程图压缩版
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`
  - 验证：技能版与指令版流程图段落语义一致（指令版为压缩形态）
- [x] 4.2 [代码] 手工同步 `getTrImplAutoWorkflowCommandTemplate().content` 的流程图压缩版
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 验证：同上
- [x] 4.3 [代码] 手工同步 `getTrImplDebugCommandTemplate().content` 的缺陷链路压缩版
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：同上（含 `🔴异常` / `🟠根因` 口径）
- [x] 4.4 [代码] 手工同步 `getTrImplGenfullCommandTemplate().content` 的 Bridge 1 兜底压缩版
  - 文件：`src/core/templates/workflows/tr-impl-genfull.ts`
  - 验证：同上

## 5. 测试与快照

- [x] 5.1 [代码] 新增断言：5 个技能正文均含来自 `flowchart-gate.ts` 的流程图文本（需求版或缺陷链路版按技能注入）
  - 文件：`test/templates.test.ts`
  - 验证：`pnpm test` 通过；断言覆盖 5 个技能名
- [x] 5.2 [代码] 扩展模板派生一致性测试：`spec-explore` 派生指令正文含流程图块（且未被 `CMD:SKIP` 裁掉）
  - 文件：`test/template-derivation.test.ts`
  - 验证：`pnpm test` 通过
- [x] 5.3 [代码] 重新生成技能静态快照
  - 文件：`skills/**/SKILL.md`
  - 验证：`pnpm build && pnpm generate:skills` 后 `test/skills-parity.test.ts` 逐字节一致性断言通过
- [x] 5.4 [代码] 核验 `allowed-tools` 白名单无需变更（本变更不引入新命令）
  - 文件：`test/allowed-tools.test.ts`
  - 验证：`pnpm test` 通过
- [x] 5.5 [代码] 全量校验：`pnpm build && pnpm test && pnpm lint`
  - 文件：（无）
  - 验证：三条命令全部通过，技能总数断言（27）无需修改

## 6. 版本与文档

- [x] 6.1 [代码] `package.json` 的 `version` 按 minor 递增（功能新增）
  - 文件：`package.json`
  - 验证：版本号大于变更前版本；`README.md` 中 `venus --version` 输出示例同步
- [x] 6.2 [使用说明] `CHANGELOG.md` 归档 `[Unreleased]` 为新版本小节并补入本变更条目（`### Added`），保留空的 `[Unreleased]`，同步底部链接引用定义
  - 文件：`CHANGELOG.md`
  - 产出：`CHANGELOG.md`（就地更新）
  - 验证：Keep a Changelog 格式；新增小节含日期与 compare/tag 链接
- [x] 6.3 [使用说明] 更新 `openspec/CONTEXT.md` 术语表（功能流程图 / 关键操作节点 / 流程最终确认门 / 节点覆盖度 / 流程基准 / 缺陷链路）
  - 文件：`openspec/CONTEXT.md`
  - 产出：`openspec/CONTEXT.md`（就地更新）
  - 验证：6 条术语齐备且与「提示词基线」「业务流程图」「D9」显式划界（**探索阶段已落盘，本任务为归档前复核**）

- [x] 6.4 [代码] **（实现期发现的计划外必需项，经用户裁决纳入）** 同步 `.claude/` dogfood 产物，使本仓库实际使用的技能反映本次模板变更 —— 仓库约定见 AGENTS.md 第 1 条与先例 commit `684dd74`（提示词校验门变更同款）；原任务清单未覆盖此项
  - 文件：`.claude/skills/**/SKILL.md`、`.claude/commands/venus/*.md`
  - 验证：`venus update` 刷新 23 项技能 + 7 项指令（恰为本次受影响的 7 个工作流）；5 个产出方技能含「功能流程图（Functional Flowchart）」制品、2 个消费方技能（spec-propose / spec-verify-proposal）正确地不含内联制品；dogfood 正文与 `skills/` 快照逐字节一致（排除 `generatedBy` 行）

## 7. 规格对齐核验

- [x] 7.1 [代码] 核验实现与 delta 规格逐条对齐（`tr-workflow-suite-skills` 的 1 ADDED + 4 MODIFIED；`spec-workflow-skills` 的 3 MODIFIED），场景全覆盖
  - 文件：`openspec/changes/add-flowchart-cross-verify/specs/**/spec.md`
  - 验证：逐场景核对实现位置；无遗漏场景、无超出规格的实现

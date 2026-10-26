## Why

对全部内置技能模板与 CLI 命令做了一次全局设计审计（见 `openspec/explorations/skill-orchestration-audit-explore-001.md`），逐条回源复核后确认了一批**跨切面一致性缺陷**：模板正文仍有 Markdown-first 残留、编排器存在半重构（内联 vs 委派自相矛盾）、提案验证维度契约不统一、单一源常量/指令派生未全覆盖、DEPS 与补全表漂移。这些缺陷单独看都是小问题，但共同造成两类系统性风险：

1. **AI 执行歧义**：同一技能正文内既有"委派 `spec_propose`"又有"no Skill delegation"，或白名单未授权它实际要委派的技能——AI 会绕过预期路径或在运行时被权限拦截。
2. **回归不可见**：现有回归锁（`markdown-first-regression.test.ts` 等）覆盖面窄（只扫 4 个编排技能、只匹配少数正则），新漂移无法被测试拦截（`migration` 的 `tasks.json` 残留与 `spec_explore` 的 `change.json` 捕获指引即是漏网证据）。

因此本变更在修复具体缺陷的同时，建立一层**跨切面一致性回归锁**，把"单一源""Markdown-first 无残留""白名单/DES 齐备""验证契约唯一"从约定升级为可测试契约。

## What Changes

1. **Markdown-first 残留清除（P0）**：`iagent_migration` Phase 4 的 `tasks.json` 同步改为直接编辑 `tasks.md`；`iagent_spec_explore` 的制品捕获目标由 `change.json 的 design/proposal 段` 改为 `design.md`/`proposal.md`。
2. **编排器半重构收束（P0）**：`iagent_auto_workflow` Phase 4/5 由"内联执行 apply/archive 协议"改为经 Skill 工具委派 `iagent_spec_apply`（`auto-mode=true`）/`iagent_spec_archive`（条件 `iagent_test`），并补齐白名单 `Skill(spec_apply/spec_archive/test)` 与 DEPS；删除 `iagent_workflow` 中与 Phase 2.3 委派相矛盾的 stale Examples 与 Guardrail。
3. **实现验证桥接（P1）**：`workflow`/`auto_workflow` 在 apply→archive 之间补 `spec_verify`（或在正文显式声明"由 apply 编译检查 + 归档一致性承担、故意省略"），使编排器行为与 `DEPS`（`spec-archive ⇒ spec-verify`）一致。
4. **提案验证契约统一（P1）**：定义唯一维度契约（D1-D5 核心 + D6-D10 条件，统一 90% 阈值），全部技能只引用该契约串，删除 `D1-D6`/`D1-D9` 等散落字面量；明确 `proposal_review` 为 `spec_verify_proposal` PASS 后的非重叠深度层。
5. **单一源与死文件清理（P1/P2）**：`workflow`/`auto_workflow`/`debug` 改用 `GATE_PROTOCOL_PREAMBLE`；删除 `workflow`/`auto_workflow` 的孤儿 `references/{prompt-gate,flowchart-gate}.md`；修 `prompt-gate.ts`/`flowchart-gate.ts` 注释 typo 与 `proposal_review` Phase 跳号。
6. **DEPS 与补全表对齐（P1）**：`DEPS['auto-workflow']` 去掉冗余 `workflow`、按新委派面补 `spec-apply`/`spec-archive`/`test`；`IAGENT_COMMANDS` 的 spec 子命令补 `migrate`/`validate`。
7. **文档与元数据一致性（P2）**：修正 `docs/skills-manual.md`（版本、类型表、workflow 描述）；把 description 结构规约（触发词 + NOT for 排歧）推广到全部技能并扩测。
8. **跨切面一致性回归锁（核心交付）**：新增测试，扫描全部技能/指令正文与白名单，拦截"Markdown-first 写动词残留""GATE 导言多份""孤儿 references""委派未声明/未注入""验证维度多份契约""补全表缺项"。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `template-generation`: 新增"模板正文一致性契约"——Markdown-first 无 JSON 主产物残留、门控导言与调用类白名单单一源、references 无孤儿、指令正文派生覆盖；新增可测试的跨切面回归锁。
- `workflow-suite-skills`: auto-workflow 管线改为委派 apply/archive/test；workflow 删除 stale 内联描述；编排器补齐实现验证桥接；提案验证契约唯一化与双门去重。
- `spec-workflow-skills`: spec-explore 制品捕获目标 Markdown 化；spec-verify-proposal 的维度契约统一并作为唯一真源被其他技能引用。
- `skill-profile`: 依赖注入表修正（auto-workflow 冗余依赖移除 + 新委派面补全）。
- `spec-workflow-cli`: shell 补全覆盖全部 spec 子命令（补 `migrate`/`validate`）。
- `agent-tool-identity`: 技能 description 结构（中文用途 + 触发词 + NOT for 排歧）SHALL 覆盖全部技能并受测试约束。

## Impact

### 直接影响的文件

- `src/core/templates/workflows/migration.ts`: Phase 4 去掉 `tasks.json` 同步，改为直接编辑 `tasks.md`
- `src/core/templates/workflows/spec-explore.ts`: 捕获表 `change.json` → `design.md`/`proposal.md`
- `src/core/templates/workflows/auto-workflow.ts`: Phase 4/5 改委派；白名单补 `Skill(spec_apply/spec_archive/test)`
- `src/core/templates/workflows/workflow.ts`: 删除 stale Examples 与冲突 Guardrail；补验证桥接
- `src/core/templates/workflows/debug.ts`: 改用 `GATE_PROTOCOL_PREAMBLE`；统一维度表述
- `src/core/templates/workflows/spec-verify-proposal.ts`: 统一维度契约唯一源
- `src/core/templates/workflows/proposal-review.ts`: 定位为深度层、Phase 跳号修正
- `src/core/templates/prompt-gate.ts`、`flowchart-gate.ts`: 注释 typo 修正
- `src/core/templates/workflows/review.ts` 等`: description 结构补全（触发词 + NOT for）
- `src/core/profiles.ts`: `DEPS` 修正
- `src/commands/completion.ts`: spec 子命令补 `migrate`/`validate`
- `docs/skills-manual.md`: 版本/类型表/workflow 描述修正
- `test/`: 新增跨切面一致性回归锁；加宽 `markdown-first-regression.test.ts`
- `skills/`: 快照重新生成（`pnpm build && pnpm generate:skills`）
- `package.json` / `CHANGELOG.md`: 版本递增（技能模板行为变更 → minor，6.1.0）

### 向后兼容

- **技能语义**：修复的是自相矛盾与残留，不改变已确认的确认门、白名单授权面（除补齐缺失委派条目）与 CLI 契约；`auto-workflow` 由内联改为委派后行为等价（同一 apply/archive 协议），属**行为一致性修复**而非破坏性变更。
- **DEPS 变更**：`auto-workflow` 不再连带安装 `workflow`；已装 workflow 的项目由 `reconcile` 保留不删（既有不删策略），仅影响新装。
- **与在飞变更的关系**：`markdown-first-artifacts`（已实现未归档）已覆盖大部分 Markdown-first 规格修正；本变更的 Markdown-first 修复针对其**回归锁未覆盖的残留**（migration / spec_explore），规格层以补充契约为主，避免与在飞 delta 冲突。归档顺序建议：`markdown-first-artifacts` 先归档，再实现本变更。

# Exploration: fix-skill-contract-drift

## 提示词基线

**原始提示词**：探索整体项目信息，对每个指令技能设计和流程完整性、实现等维度进行检查和验证，对不合理点就行调整优化。

**确认后的提示词基线**：

- 目标：对 20 个技能模板与指令形态做设计 / 流程完整性 / 实现一致性审计，并修复确认的问题。
- 对象：`src/core/templates/workflows/*.ts`、`src/core/host-orchestration/*`、`src/core/command-generation/*`、`src/commands/version.ts`、相关测试与文档。
- 范围：仅修复审计确认项；不重新设计业务阶段，不改 CLI 参数与产物布局。
- 约束：探索阶段只读；实现前必须通过提案验证与实现桥；模板改动后执行 `pnpm build && pnpm generate:skills`。
- 验收：`pnpm test` 全绿、`pnpm lint` 通过、`iagent validate` 20/20、生成物与权限双向一致。

## 项目规则基线

| 规则源 | 是否存在 | 读取状态 | 与本次相关的约束 |
| :--- | :--- | :--- | :--- |
| `.iagent/config.yaml` | 是 | 已读 | 单一真源、模板改动后重新生成、Conventional Commits |
| `.iagent/rules/coding-rules.md` | 是 | 已读 | 零猜测、设计先行、单一真源、模板单一源、指令引用规范形、白名单共享常量 |
| `.iagent/rules/testing-rules.md` | 是 | 已读 | Vitest、`test/**/*.test.ts`、主目录沙箱、CLI e2e 需先 build |
| `.iagent/rules/spec.md` | 是 | 已读 | Markdown 单一真源、提案 90% 阈值、handoff 包 |
| `AGENTS.md` | 是 | 已读 | 三层白名单、派发按实放行、分级执行默认内联、宿主机制生成期渲染 |
| `CLAUDE.md` | 否 | 不存在 | 不构成规则源 |

## 项目技能基线

| 技能 | phases | 完整性 | 本次是否读取 |
| :--- | :--- | :--- | :--- |
| `backend-design` | design | ok | 已读（设计约束） |
| `backend-implement` | implement | ok | 未读（implement 相，本阶段不适用） |

## 分析（审计证据）

### P1

1. `version bump --dry-run` 在 `--from` 无变更时抛错：`src/commands/version.ts:458-460`，测试 `test/version-bump.test.ts:448`，实测可复现。
2. 门词汇三套不对齐：`protocol.ts:98-134` 的 anchors 未含 `design-confirmation`，但 `delegation-contract.ts:26` 与 `spec-apply.ts:367` 使用它；白名单注释声称覆盖「技能内动作」。
3. 归档门声明与实现冲突：`workflows.ts:89` 声明阻塞，`spec-archive.ts:58-70` 与 `:186` 直接 `--yes`，`spec-bulk-archive.ts:158` 明写不提示。
4. 指令 references 不可达：`generator.ts:30-47` 不产出 references，`init.ts:326-327` 只写技能目录；`.claude/commands/iagent/spec-apply.md:189,201` 与 `.pi/prompts/*` 仍按 `references/` 引用。
5. 派发不一致：`spec-apply.ts:84` 与 `:381/:715` 自相矛盾；`renderDelegate` 对 6 个无 `Agent, Task` 授权的技能生成「Agent 子代理」指令（实测 project-init 1、workflow 7、auto-workflow 7、debug 3、spec-propose 1、spec-apply 1）。

### P2

6. 白名单块注入 11 个技能，仅 3 个含真 `⛔ GATE:`；`spec-propose` 有导言无门。
7. `AskUserQuestion` 13 处 / 9 模板；`Task 工具` 1 处；生成期不替换。
8. `review` 只对照 `CLAUDE.md`；`review` / `test` 未读 `.iagent/rules`。
9. 重复短语：`migration.ts:126`、`debug.ts:477`、`debug.ts:553`、`workflow.ts:393`。
10. 编号复核：`workflow` 的 `Phase 3.7` 与 `references/verification-protocol.md` 的 3.1–3.6 连续；`debug` 的 `3.x` 为「Phase 3 前移」的有意标记 —— **非缺陷，不做改动**。
11. 行数预算：workflow 486 / debug 486 / spec-bulk-archive 482 / spec-apply 477（上限 500）。
12. 文档漂移：`AGENTS.md:94` 69 文件、`README.md:467` 1507 用例 / 69 文件（实际 71 / 1542）；`docs/skills-manual.md:3` 版本 7.0.1。
13. 测试盲区：`allowed-tools.test.ts:324-333` 只按白名单反推；无生成物越权断言。
14. 本地 dogfood 滞后：`.claude` / `.opencode` 的 `generatedBy: 4.9.0`（不入库）。

## Decisions

### D1: 门词汇单一源

- `design-confirmation` 纳入 `GATE_WHITELIST` 的 `requirement-clarification` anchors；阻塞门统一使用 `⛔ GATE:` 标记。
- 备选：新造第 6 类 —— 破坏「5 类门」契约，否决。

### D2: 归档门分层

- 父工作流保留阻塞 `archive-confirmation`；独立调用 `spec-archive` / `spec-bulk-archive` 显式豁免（用户直接调用即意图）。
- 依据：用户在探索确认中选择「豁免并改措辞」。
- 备选：独立归档也加门 —— 与用户裁决冲突，否决。

### D3: 派发执行策略单一源

- 新增 `DELEGATION_EXECUTION`；默认 `inline`，仅 `migration → migration-check` 为条件降级，`spec-bulk-archive` 内部并行单元保留子代理。
- 备选：全部内联 —— 破坏 migration 阈值降级，否决。

### D4: 指令 references 生成期重写

- 按宿主 `skillsDir + 技能 ID` 重写为可解析路径；不复制 references。
- 备选：为指令复制副本 —— 双写维护，否决。

### D5: 宿主中立提问令牌

- 模板用 `{{ASK_USER}}`，生成期按宿主替换；degraded / Codex 渲染为阻塞回执。
- 备选：纯中性措辞 —— 失去宿主可执行性，否决。

### D6: version dry-run 守卫

- 守卫仅作用于写回模式；错误消息使用实际基线标签。
- 备选：改测试期望 —— 与 dry-run 语义冲突，否决。

### D7: 文本卫生与文档基线

- 清理重复短语；保留既有阶段编号（`Phase 3.7` 与 references 3.1–3.6 连续，`debug` 3.x 为「Phase 3 前移」有意标记）；更新计数与版本；不改变业务语义。

## Pending

（无）

## 硬约束

- 独立归档豁免归档确认门；父工作流门不变。source: D2
- 全部编排阶段默认内联；仅 migration 超阈降级与 spec-bulk-archive 并行单元允许子代理。source: D3
- 无 BREAKING：CLI 参数、技能 ID、产物布局、回执字段不变。source: D7
- 模板改动后必须执行 `pnpm build && pnpm generate:skills`。source: D7

## 功能流程图

本次为代码/制品审计与契约修复，无产品业务功能流程，不产出功能流程图（无阻断）。

## 代码库发现

- 单一真源已覆盖：技能 ID、指令引用、产物落点、版本判定。
- 生成管线：模板 → `adaptSkillContentForHost` → 技能/指令产物；references 仅在技能侧写入。
- 测试已覆盖 71 个文件 / 1542 用例；唯一红灯为 version `--from` dry-run。
- `iagent validate` 20/20 通过；`pnpm lint` 干净。

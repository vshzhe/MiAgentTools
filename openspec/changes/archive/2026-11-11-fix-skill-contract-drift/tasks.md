# Tasks: fix-skill-contract-drift

## 1. 版本守卫（P1-1）

- [x] 1.1 [代码] 调整 `runVersion` 的「无变更」守卫：仅在写回模式（`apply && !options.dryRun`）抛错；错误消息改用 `changeSet.baselineLabel`（缺省回落 `baseline.label`）
  - 文件：`src/commands/version.ts`
  - 验证：`version --from HEAD --json` 与 `version bump --from HEAD --dry-run --json` 均退出码 0；`version bump`（无 dry-run、无变更）仍报错且消息含 `--from` 标签
  - Spec Ref: version-bump-guard / Dry-run bypasses no-change guard
  - Scenario Ref: 显式基线无变更仍可预览

- [x] 1.2 [测试][单元][P0] 覆盖 `--from <ref> --dry-run --json` 无变更时返回 `baselineRef`
  - 文件：`test/version-bump.test.ts`
  - 验证：定向跑 `pnpm vitest run test/version-bump.test.ts -t "from"` 通过
  - Spec Ref: version-bump-guard / Dry-run bypasses no-change guard
  - Scenario Ref: 显式基线无变更仍可预览

- [x] 1.3 [测试][单元][P0] 覆盖写回模式仍拒绝无变更递增，且消息使用实际基线标签
  - 文件：`test/version-bump.test.ts`
  - 验证：断言错误消息含 `--from <ref>` 或默认基线标签，不含固定版本号误述
  - Spec Ref: version-bump-guard / Dry-run bypasses no-change guard
  - Scenario Ref: 写回模式仍拒绝无变更递增

- [x] 1.4 [测试][单元][P0] 覆盖 `version bump` 子命令的 `--from` 选项合并
  - 文件：`test/version-bump.test.ts`
  - 验证：`--from` 输出 `analysis.baselineRef=<ref>`，不回退默认基线
  - Spec Ref: version-bump-guard / Bump subcommand merges parent options
  - Scenario Ref: bump 子命令 --from 生效

## 2. 门词汇与归档分层（P1-2 / P1-3）

- [x] 2.1 [代码] `design-confirmation` 纳入 `GATE_WHITELIST` 的 `requirement-clarification` anchors，并补齐 `PHASE_GATE_CATEGORY`
  - 文件：`src/core/host-orchestration/protocol.ts`、`src/core/host-orchestration/workflows.ts`
  - 验证：`isWhitelistedGate('design-confirmation') === true`
  - Spec Ref: host-orchestration / Gate whitelist covers skill-internal blocking gates
  - Scenario Ref: 设计确认门被白名单收录

- [x] 2.2 [代码] 扩展门对齐审计：校验 `GATE_SKIP_IDS` 与模板 `⛔ GATE:` id 均落在白名单锚点内（模板扫描在测试层完成，避免 host-orchestration → templates 循环依赖）
  - 文件：`src/core/host-orchestration/workflows.ts`、`test/host-orchestration.test.ts`
  - 验证：未知锚点被报告；现有协议与账本 id 全部对齐
  - Spec Ref: host-orchestration / Gate whitelist covers skill-internal blocking gates
  - Scenario Ref: 未知门被对齐审计拦截

- [x] 2.3 [代码] `prompt-gate.ts` 新增门策略块渲染变体：`full`（有门）/ `no-gate`（零门，仅负向清单）/ `readonly`（只读）/ `standalone-archive`（省略归档桥并附豁免注记）
  - 文件：`src/core/templates/prompt-gate.ts`
  - 验证：各变体不输出与实际承载不符的绝对表述；`GATE_PROTOCOL_PREAMBLE` 仍为唯一源
  - Spec Ref: template-generation / Gate policy block matches skill gate reality
  - Scenario Ref: 零门技能无 GATE 导言

- [x] 2.4 [代码] 按技能实际承载切换策略块：`spec-propose` / `spec-verify` / `spec-archive` / `spec-bulk-archive` 改用 `no-gate` / `readonly` / `standalone-archive`；`workflow` / `debug` / `spec-explore` 保留 `full`
  - 文件：`src/core/templates/workflows/spec-propose.ts`、`spec-verify.ts`、`spec-archive.ts`、`spec-bulk-archive.ts`、`spec-apply.ts`
  - 验证：零门技能不再出现「本技能包含以 ⛔ GATE: 标记的确认门」
  - Spec Ref: template-generation / Gate policy block matches skill gate reality
  - Scenario Ref: 零门技能无 GATE 导言

- [x] 2.5 [代码] `spec-apply` 的 `5.5 设计确认门` 改用 `⛔ GATE:` 标记；`migration` Phase 3 实现确认门补 `⛔ GATE:` 标记
  - 文件：`src/core/templates/workflows/spec-apply.ts`、`src/core/templates/workflows/migration.ts`
  - 验证：两处门在技能版与指令版均含标记；三级降级链与单问逻辑保留
  - Spec Ref: workflow-suite-skills / Blocking confirmation gates use the gate marker
  - Scenario Ref: spec-apply 设计门使用标记

- [x] 2.6 [代码] 归档技能措辞分层：删除无条件「不可豁免」表述，改为「父工作流承载；独立调用豁免」
  - 文件：`src/core/templates/workflows/spec-archive.ts`、`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：独立技能正文不再让 `archive-confirmation` 无条件不可豁免；父流程门不变
  - Spec Ref: host-orchestration / Archive confirmation is layered by invocation context
  - Scenario Ref: 独立归档不新增停点

- [x] 2.7 [测试][单元][P0] 断言 `design-confirmation` 为白名单锚点且类别可解析
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`isWhitelistedGate` 为真；`PHASE_GATE_CATEGORY` 映射存在
  - Spec Ref: host-orchestration / Gate whitelist covers skill-internal blocking gates
  - Scenario Ref: 设计确认门被白名单收录

- [x] 2.8 [测试][单元][P1] 断言未知门被对齐审计拦截
  - 文件：`test/host-orchestration.test.ts`
  - 验证：构造未知锚点的协议副本，`auditGateWhitelistAlignment()` 返回含 workflow/phase/gate 的违规
  - Spec Ref: host-orchestration / Gate whitelist covers skill-internal blocking gates
  - Scenario Ref: 未知门被对齐审计拦截

- [x] 2.9 [测试][单元][P1] 断言 `GATE_SKIP_IDS` 全部落在白名单锚点内
  - 文件：`test/delegation-contract.test.ts`
  - 验证：逐项 `isWhitelistedGate` 为真
  - Spec Ref: host-orchestration / Gate whitelist covers skill-internal blocking gates
  - Scenario Ref: 账本门 id 与白名单一致

- [x] 2.10 [测试][功能][P0] 断言父工作流归档门仍阻塞
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`workflow` 协议 archive 阶段 `gate.id === 'archive-confirmation'` 且 `blocking !== false`
  - Spec Ref: host-orchestration / Archive confirmation is layered by invocation context
  - Scenario Ref: 父工作流归档仍阻塞

- [x] 2.11 [测试][功能][P0] 断言独立归档技能不使用「不可豁免」表述且渲染豁免注记
  - 文件：`test/template-consistency.test.ts`
  - 验证：`spec-archive` / `spec-bulk-archive` 正文与渲染块均含豁免说明
  - Spec Ref: host-orchestration / Archive confirmation is layered by invocation context
  - Scenario Ref: 白名单渲染反映豁免

- [x] 2.12 [测试][单元][P1] 断言 `spec-apply` 与 `migration` 的阻塞门使用 `⛔ GATE:` 标记
  - 文件：`test/template-consistency.test.ts`
  - 验证：两处门标题含标记；`spec-apply` 仍保留三级门承载链
  - Spec Ref: workflow-suite-skills / Blocking confirmation gates use the gate marker
  - Scenario Ref: migration 实现门使用标记

- [x] 2.13 [测试][单元][P1] 断言有门技能保留 `GATE PROTOCOL — ACTIVE` 与对应 `⛔ GATE:` 标记
  - 文件：`test/template-consistency.test.ts`
  - 验证：`workflow` / `debug` / `spec-explore` 三者命中；零门技能不命中
  - Spec Ref: template-generation / Gate policy block matches skill gate reality
  - Scenario Ref: 有门技能保留导言

- [x] 2.14 [测试][功能][P0] 断言独立归档技能不新增停点且标注豁免
  - 文件：`test/template-consistency.test.ts`
  - 验证：`spec-archive` / `spec-bulk-archive` 含「独立调用」与 `archive-confirmation` 豁免说明
  - Spec Ref: host-orchestration / Archive confirmation is layered by invocation context
  - Scenario Ref: 独立归档不新增停点

- [x] 2.15 [测试][单元][P1] 断言零门技能不出现「本技能包含 ⛔ GATE」导言
  - 文件：`test/template-consistency.test.ts`
  - 验证：`spec-propose` / `spec-verify` / `spec-archive` / `spec-bulk-archive` 均不命中
  - Spec Ref: template-generation / Gate policy block matches skill gate reality
  - Scenario Ref: 零门技能无 GATE 导言

- [x] 2.16 [测试][单元][P1] 断言 `spec-apply` 的设计确认门使用 `⛔ GATE:` 标记
  - 文件：`test/template-consistency.test.ts`
  - 验证：正文含 `⛔ GATE: 5.5 设计确认门`
  - Spec Ref: workflow-suite-skills / Blocking confirmation gates use the gate marker
  - Scenario Ref: spec-apply 设计门使用标记

## 3. 内联/派发收口（P1-5）

- [x] 3.1 [代码] 新增 `DELEGATION_EXECUTION` 执行策略单一来源（默认 `inline`；`migration → migration-check` 为 `inline-with-opt-in-subagent`），并让 `renderDelegate` / `renderDelegationList` 按策略渲染
  - 文件：`src/core/host-orchestration/render.ts`、`src/core/host-orchestration/actions.ts`
  - 验证：Claude 渲染中内联目标不含「经前台 Agent 子代理执行」；条件降级目标为条件式表述
  - Spec Ref: host-orchestration / Delegation rendering follows execution policy
  - Scenario Ref: 内联目标不渲染子代理

- [x] 3.2 [代码] 修正 `spec-apply` 正文：删除「每个单元一个子代理」与「前台 Agent 子代理」表述，改为内联/Skill 调用
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：`:84` / `:287` 与 `:381` / `:715` 语义一致；无 Agent 派发表述
  - Spec Ref: tool-call-whitelist / Generated orchestration section never exceeds declared dispatch permission
  - Scenario Ref: 内联阶段渲染为内联

- [x] 3.3 [代码] 修正 `auto-workflow` 的「经 Agent 子代理调用 iagent_proposal_review」为内联调用
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：阶段 3 复查仍要求内联深度复查 + WARN 降级
  - Spec Ref: tool-call-whitelist / Generated orchestration section never exceeds declared dispatch permission
  - Scenario Ref: 生成物不越权派发

- [x] 3.4 [代码] 修正 `spec-explore` 多项目扫描：改为主 agent 串行扫描（或运行时不支持子代理时的降级），删除 MUST 派发子代理表述
  - 文件：`src/core/templates/workflows/spec-explore.ts`（`references/multi-project-scan.md` 内容）
  - 验证：不再要求未授权的 Agent/Task；跨项目扫描与 120s 预算降级保留
  - Spec Ref: host-orchestration / Delegation rendering follows execution policy
  - Scenario Ref: 子代理目标保留派发

- [x] 3.5 [测试][单元][P0] 断言 Claude 渲染内联目标不出现 Agent 子代理文本
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`renderDelegate('claude','strict',{workflowId:'test'})` 不含「Agent 子代理」
  - Spec Ref: host-orchestration / Delegation rendering follows execution policy
  - Scenario Ref: 内联目标不渲染子代理

- [x] 3.6 [测试][单元][P0] 断言子代理目标保留 Agent/Task 且技能具备授权
  - 文件：`test/host-orchestration.test.ts`、`test/allowed-tools.test.ts`
  - 验证：`migration` / `spec-bulk-archive` 的授权与正文派发同时成立
  - Spec Ref: host-orchestration / Delegation rendering follows execution policy
  - Scenario Ref: 子代理目标保留派发

- [x] 3.7 [测试][单元][P0] 双向派发一致性：正文派发 ⇒ 白名单含 `Agent, Task`
  - 文件：`test/allowed-tools.test.ts`
  - 验证：对全部技能扫描「Agent 子代理 / 子代理派发」表述与白名单，缺失即失败
  - Spec Ref: tool-call-whitelist / Dispatch authorization is bidirectional
  - Scenario Ref: 正文派发但未授权则失败

- [x] 3.8 [测试][单元][P1] 双向派发一致性：`Agent, Task` ⇒ 正文确有派发动作
  - 文件：`test/allowed-tools.test.ts`
  - 验证：仅 `migration` / `spec-bulk-archive` 命中；其余技能不因兼容窗误判
  - Spec Ref: tool-call-whitelist / Dispatch authorization is bidirectional
  - Scenario Ref: 授权但无派发动作则失败

- [x] 3.9 [测试][功能][P0] 生成物越权派发检查：含 Agent 指令的技能必须含 `Agent, Task`
  - 文件：`test/template-consistency.test.ts` 或 `test/generation.test.ts`
  - 验证：对全部技能做 Claude 渲染后扫描；不匹配即失败
  - Spec Ref: tool-call-whitelist / Generated orchestration section never exceeds declared dispatch permission
  - Scenario Ref: 生成物不越权派发

- [x] 3.10 [测试][单元][P1] 断言真实派发技能（`migration` / `spec-bulk-archive`）同时具备授权与派发正文，其余编排技能不被误判
  - 文件：`test/allowed-tools.test.ts`
  - 验证：派发集合恰为 2 个技能；其余技能的兼容窗不回退为派发
  - Spec Ref: tool-call-whitelist / Dispatch authorization is bidirectional
  - Scenario Ref: 真实派发技能保持授权

- [x] 3.11 [测试][功能][P0] 断言内联阶段渲染为内联（不出现 Agent 子代理）
  - 文件：`test/host-orchestration.test.ts`
  - 验证：`renderDelegate('claude','strict',{workflowId:'spec-apply'})` 含「主 agent 内联执行」且不含「前台 Agent 子代理」
  - Spec Ref: tool-call-whitelist / Generated orchestration section never exceeds declared dispatch permission
  - Scenario Ref: 内联阶段渲染为内联

## 4. 指令 references 可解析（P1-4）

- [x] 4.1 [代码] 新增 `rewriteReferencePaths(content, base)` 单一帮助函数，并在指令生成前按 `skillsDir + canonical 技能 ID` 重写 `references/<file>`
  - 文件：`src/core/command-generation/`（新帮助函数或 generator.ts）、`src/commands/init.ts`
  - 验证：Claude / Pi / OpenCode 三种指令布局均重写；Codex skills-only 不处理
  - Spec Ref: template-generation / Command-form references resolve to installed skill references
  - Scenario Ref: Claude 指令重写 references

- [x] 4.2 [测试][单元][P0] 断言 Claude 指令的 references 指向 `.claude/skills/<id>/references/...`
  - 文件：`test/generation.test.ts`
  - 验证：`spec-apply` 指令含 `.claude/skills/iagent-spec-apply/references/compile-check.md`
  - Spec Ref: template-generation / Command-form references resolve to installed skill references
  - Scenario Ref: Claude 指令重写 references

- [x] 4.3 [测试][单元][P0] 断言 Pi prompt 的 references 指向 `.pi/skills/<id>/references/...`
  - 文件：`test/generation.test.ts`
  - 验证：`spec-explore` prompt 不含 `.pi/prompts/references/`
  - Spec Ref: template-generation / Command-form references resolve to installed skill references
  - Scenario Ref: Pi prompt 重写 references

- [x] 4.4 [测试][单元][P0] 全量指令 references 可解析检查
  - 文件：`test/template-consistency.test.ts` 或 `test/generation.test.ts`
  - 验证：每个 `references/*.md` 均能映射到配对技能声明的 references；失败列出 id 与路径
  - Spec Ref: template-generation / Command-form references resolve to installed skill references
  - Scenario Ref: 指令 references 可解析测试

## 5. 宿主中立与规则基线（P2）

- [x] 5.1 [代码] 新增 `{{ASK_USER}}` 令牌与 `renderHostTokens(content, negotiation)`；生成期按宿主替换（Claude / OpenCode / Pi strict / degraded & Codex）
  - 文件：`src/core/host-orchestration/actions.ts`、生成管线
  - 验证：生成后无 `{{` 残留；未知令牌中性兜底并 WARN
  - Spec Ref: template-generation / Template bodies are host-neutral
  - Scenario Ref: 生成期注入宿主机制

- [x] 5.2 [代码] 用 `{{ASK_USER}}` 替换 13 处 `AskUserQuestion`（9 个模板），并把 `Task 工具` / `Skill 工具` 改为宿主中立表述
  - 文件：`src/core/templates/workflows/*.ts`
  - 验证：模板源不再出现宿主工具名
  - Spec Ref: template-generation / Template bodies are host-neutral
  - Scenario Ref: 模板正文无宿主工具名

- [x] 5.3 [代码] `review` / `test` 接入规则基线：`review` 增加 `Bash(iagent:*)`，两技能在开头读取 `.iagent/rules` 与 `iagent rules --json`
  - 文件：`src/core/templates/workflows/review.ts`、`src/core/templates/workflows/test.ts`
  - 验证：规则源存在时被读取；`review` 不再只对照 `CLAUDE.md`
  - Spec Ref: workflow-suite-skills / Review and test skills consume project rule baseline
  - Scenario Ref: review 技能读取规则基线

- [x] 5.4 [测试][单元][P1] 断言模板正文不含 `AskUserQuestion` / `Task 工具`
  - 文件：`test/template-consistency.test.ts`
  - 验证：全量扫描失败即报技能 id 与行号
  - Spec Ref: template-generation / Template bodies are host-neutral
  - Scenario Ref: 模板正文无宿主工具名

- [x] 5.5 [测试][功能][P1] 断言生成物按宿主注入提问机制且无残留令牌
  - 文件：`test/generation.test.ts`
  - 验证：Claude / Pi / Codex 产物均无 `{{ASK_USER}}`
  - Spec Ref: template-generation / Template bodies are host-neutral
  - Scenario Ref: 生成期注入宿主机制

- [x] 5.6 [测试][单元][P1] 断言 `review` / `test` 读取规则基线
  - 文件：`test/template-consistency.test.ts`
  - 验证：正文含规则源枚举与测试规则路径；`review` 白名单含 `Bash(iagent:*)`
  - Spec Ref: workflow-suite-skills / Review and test skills consume project rule baseline
  - Scenario Ref: test 技能读取测试规则

- [x] 5.7 [测试][单元][P1] 断言 `review` 技能读取规则基线而非只对照 `CLAUDE.md`
  - 文件：`test/template-consistency.test.ts`
  - 验证：正文含 `iagent rules --json` 与 `.iagent/rules/*.md`
  - Spec Ref: workflow-suite-skills / Review and test skills consume project rule baseline
  - Scenario Ref: review 技能读取规则基线

## 6. 质量清扫与文档（P2）

- [x] 6.1 [代码] 清理 4 处相邻重复短语
  - 文件：`src/core/templates/workflows/migration.ts`、`debug.ts`、`workflow.ts`
  - 验证：不再出现「由主 agent 内联由主 agent 内联」「由主 agent 由主 agent」
  - Spec Ref: workflow-suite-skills / Template text hygiene
  - Scenario Ref: 重复短语测试拦截

- [x] 6.2 [代码] 复核阶段编号并记录结论：`workflow` 的 `Phase 3.7` 与 references 3.1–3.6 连续、`debug` 的 `3.x` 为「Phase 3 前移」有意标记，均保持不动
  - 文件：`src/core/templates/workflows/workflow.ts`、`debug.ts`
  - 验证：编号与 references 对应关系不变；在验证报告中记录该判定
  - Spec Ref: workflow-suite-skills / Template text hygiene
  - Scenario Ref: 重复短语测试拦截

- [x] 6.3 [测试][单元][P1] 文本卫生测试：相邻重复短语
  - 文件：`test/template-consistency.test.ts`
  - 验证：命中「由主 agent 内联由主 agent 内联」「由主 agent 由主 agent」即失败
  - Spec Ref: workflow-suite-skills / Template text hygiene
  - Scenario Ref: 重复短语测试拦截

- [x] 6.4 [使用说明] 更新文档计数与版本：README / AGENTS 的测试文件数与用例数、`docs/skills-manual.md` 的适用版本
  - 文件：`README.md`、`AGENTS.md`、`docs/skills-manual.md`
  - 产出: `README.md`、`AGENTS.md`、`docs/skills-manual.md`
  - 验证：计数与 `pnpm test` 输出一致；版本与 `package.json` 一致
  - Spec Ref: workflow-suite-skills / Documentation counts reflect actual project state
  - Scenario Ref: 文档计数与实测一致

- [x] 6.5 [代码] 本地刷新 dogfood 产物（`pnpm build && pnpm generate:skills`，必要时 `iagent update`），确认 `.claude` / `.opencode` 的 `generatedBy` 与当前版本一致
  - 文件：`.claude/`、`.opencode/`（不入库）
  - 验证：`generatedBy` 不再停留在 4.9.0；本次执行的技能正文与源码一致
  - Spec Ref: workflow-suite-skills / Documentation counts reflect actual project state
  - Scenario Ref: 文档计数与实测一致

- [x] 6.6 [测试][单元][P2] 评估：文档计数无自动化可验证行为，由发布检查人工复核（依据：README/AGENTS 为散文计数，无稳定机器可读源）
  - 文件：`README.md`、`AGENTS.md`
  - 验证：记录「已评估、判定不生成自动化测试」及依据
  - Spec Ref: workflow-suite-skills / Documentation counts reflect actual project state
  - Scenario Ref: 文档计数与实测一致

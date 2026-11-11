## Context

审计对象是 20 个技能模板、20 个指令模板与宿主编排生成层。当前架构的单一真源已基本到位（技能 ID、指令引用、产物落点、版本判定），问题集中在四处契约漂移：

- 门词汇：`GATE_WHITELIST`（5 类 / 9 anchor）、`GATE_SKIP_IDS`（`design-confirmation`）与模板 `⛔ GATE:` 文本三套并存；`design-confirmation` 是阻塞门却不在 anchor 内。
- 归档门：协议与白名单声明 `archive-confirmation` 阻塞，独立归档技能却直接 `--yes`。
- 派发：`renderDelegate` 对 Claude 的非交互阶段一律输出 Agent 子代理；6 个技能没有 `Agent, Task` 授权，测试又把派发集合锁成 2 个技能。
- 指令形态：`generateCommand` 不产出 references，指令正文却按技能相对路径引用。

## Goals / Non-Goals

**Goals**:
- 让门词汇、派发执行方式、指令 references 各有一个可校验的单一来源。
- 主干 `pnpm test` 转绿，并把本次修复固化为回归测试。
- 保持 CLI 参数、技能 ID、产物布局、回执字段不变。

**Non-Goals**:
- 不重新设计 20 个技能的流程，不改业务阶段划分。
- 不引入新的宿主，不改变 Pi / Codex 的 degraded 语义。
- 不为独立归档新增用户停点（按本次裁决：显式调用即意图）。

## Decisions

### D1: `design-confirmation` 纳入门白名单锚点

- **选择**: 在 `GATE_WHITELIST` 的 `requirement-clarification` 类别新增 anchor `design-confirmation`；`workflow-suite-skills` 的 `spec-apply` 设计门改用 `⛔ GATE:` 标记。
- **理由**: 该门是「方案歧义」类阻塞门，与 `diagnostic-confirmation` / `fix-option-confirmation` 同属技能内动作；白名单注释本就声明 anchor 覆盖「阶段门 id 或技能内动作」。
- **备选**: 新造第 6 类 `design-confirmation` —— 会改变「5 类门」的既有契约与续跑自检，否决。

### D2: 归档门按调用上下文分层（独立调用豁免）

- **选择**: `archive-confirmation` 保留为父工作流阻塞门；`spec-archive` / `spec-bulk-archive` 的渲染标注「独立调用不承载该门」。白名单渲染新增 `standalone-archive` 变体（省略该条并附注），MUST NOT 改写 `GATE_WHITELIST` 常量本身。
- **理由**: 用户直接调用归档技能即表达意图；保留父流程门可维持编排链安全。
- **备选**: 独立归档也加门 —— 与用户裁决冲突，否决。

### D3: 委派执行策略单一来源

- **选择**: 在 `render.ts` 新增 `DELEGATION_EXECUTION`（workflowId → targetId → `inline` / `inline-with-opt-in-subagent`），与既有 `DELEGATION_PARAMETERS` 并列；`renderDelegate` 接收执行策略，只有 `subagent` 分支输出 Agent/Task。默认 `inline`；`migration` 的 `migration-check` 标记 `inline-with-opt-in-subagent`（超阈时才允许 Agent，且生成文本为条件式）。
- **理由**: 生成期是唯一知道宿主与目标的地方；在渲染层统一，避免模板、权限、测试三处各自推断。
- **备选**: 删除所有 Agent 渲染 —— 会破坏 migration 的阈值降级与 bulk archive 的并行单元，否决。

### D4: 指令 references 在生成期重写

- **选择**: 新增单一帮助函数 `rewriteReferencePaths(content, base)`；`base` 由宿主 `skillsDir` + canonical 技能 ID 派生（如 `.claude/skills/iagent-spec-apply/references`）。指令生成前统一重写，技能形态保持原样。
- **理由**: 指令是单文件，无法携带 references 目录；重写是最小改动且不复制内容。
- **备选**: 为指令复制 references 副本 —— 产物重复、更新需双写，否决。

### D5: 宿主中立提问令牌

- **选择**: 模板正文用 `{{ASK_USER}}` 令牌替代 `AskUserQuestion`；生成期 `renderHostTokens(content, negotiation)` 按宿主替换（Claude → `AskUserQuestion`；OpenCode → `question`；Pi strict → 阻塞提问；degraded/Codex → 阻塞回执）。令牌替换对全部技能与指令生效。
- **理由**: 模板正文不再绑定单一宿主；替换点可测试。
- **备选**: 纯中性措辞「询问用户」 —— 失去宿主机制可执行性，降级为建议，否决。

### D6: version dry-run 守卫

- **选择**: 守卫条件改为 `apply && !options.dryRun`；错误消息使用 `changeSet.baselineLabel`（缺省回落到 `baseline.label`）。
- **理由**: dry-run 是预览，不应因「无变更」失败；显式 `--from` 时消息应指向该基线。
- **备选**: 修改测试期望为抛错 —— 与 `--dry-run` 语义冲突，否决。

### D7: 文本卫生与文档基线

- **选择**: 删除 4 处相邻重复短语；保留既有阶段编号（复核结论：`workflow` 的 `Phase 3.7` 与 `references/verification-protocol.md` 的 3.1–3.6 连续，`debug` 的 `3.x` 是「Phase 3 前移」的有意标记，均不做改动）；新增重复短语测试。README / AGENTS / skills-manual 的计数与版本按实际值更新。
- **理由**: 这些是审计中确认的可读性与可信度问题，改动低风险；编号经设计意图复核后确认为非缺陷。
- **备选**: 改写编号 —— 会破坏与 references 3.1–3.6 的对应关系及「Phase 3 前移」的溯源，否决。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 生成文本变更导致 4 个接近 500 行的技能超预算 | 每批改动后测量行数；超预算内容下沉到 `references/`（`skill-size-budget.test.ts` 守护） |
| 内联渲染改动影响 workflow / auto-workflow / debug 的执行语义 | 保留 `Skill` 内联路径；新增生成物断言；`pnpm test` + 人工核对关键段落 |
| 独立归档豁免被理解为「取消安全门」 | 白名单显式标注豁免范围；父流程门不变；测试断言父流程仍阻塞 |
| `{{ASK_USER}}` 令牌遗漏替换 | 生成后测试扫描 `{{` 残留；未知令牌按中性文本兜底并记 WARN |
| 文档计数再次漂移 | 计数改为从测试输出/注册表派生或至少在发布检查中复核；本次只修当前值 |

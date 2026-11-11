## Why

对 20 个技能模板及其指令形态做只读审计后，确认 14 项问题（12 项确认、1 项建议级、1 项已裁决），其中 5 项为 P1：

1. `iagent version bump --dry-run` 在基线无变更时仍抛错，主干 `pnpm test` 红灯（`test/version-bump.test.ts:448`）。
2. 门词汇有三套（`GATE_WHITELIST` / `GATE_SKIP_IDS` / `⛔ GATE:` 文本），`design-confirmation` 是阻塞门却不在白名单锚点内；只读技能与无门技能也被注入「必留门」块。
3. 归档确认门在协议与白名单声明「不可豁免」，但 `spec-archive` 直接 `--yes`、`spec-bulk-archive` 明写「不提示批量确认」。
4. 指令形态（`.claude/commands` / `.pi/prompts` / `.opencode/commands`）引用 `references/*.md`，而 references 只随技能目录安装，强制 `Read` 步骤不可达。
5. 生成期 `renderDelegate` 对 6 个技能输出「经前台 Agent 子代理执行」，但这些技能的 `allowedTools` 不含 `Agent, Task`；正文、权限、测试三处对「内联 vs 派发」表述不一致。

另有 9 项 P2：宿主工具名硬编码、重复短语、阶段编号断档、行数预算饱和、文档计数漂移、测试盲区、review/test 未接规则基线、本地 dogfood 滞后等。

为什么是现在：这些漂移已经造成主干红灯与生成物自相矛盾；继续叠加功能会让门契约与权限面更难收敛。

## What Changes

- **版本守卫**：`--dry-run` 不再被「无变更」守卫阻断；写回模式仍拒绝；错误消息使用实际基线标签。
- **门词汇单一源**：`design-confirmation` 纳入门白名单锚点；对齐审计扩展为「模板 `⛔ GATE:` id ∪ `GATE_SKIP_IDS` ⊆ 白名单锚点」。
- **归档门分层**：独立调用（`/iagent:spec-archive`、`/iagent:spec-bulk-archive`）豁免归档确认门（用户显式调用即意图）；父工作流仍保留阻塞的 `archive-confirmation`。协议、白名单与模板措辞统一为分层声明，删除无条件的「不可豁免」表述。
- **派发执行方式单一源**：新增委派执行策略表；`renderDelegate` 仅对 `subagent` 目标输出 Agent/Task，内联目标输出 Skill/内联调用；生成物与 `allowedTools` 双向一致。
- **指令 references 可解析**：生成指令时把 `references/<file>` 重写为配对技能目录下可解析的路径（按宿主 `skillsDir` 派生）；新增解析测试。
- **宿主中立**：模板正文移除 `AskUserQuestion` / `Task 工具` 等宿主工具名，改由生成期 `renderAskUser()` 按宿主注入。
- **质量与文档**：清理 4 处重复短语；保留既有阶段编号（经复核 `workflow` 的 `Phase 3.7` 与 references 的 3.1–3.6 连续、`debug` 的 3.x 为「Phase 3 前移」有意标记，不做改动）；更新 README / AGENTS 计数与 skills-manual 版本；review / test 接入 `.iagent/rules` 规则基线。
- 无 **BREAKING**：CLI 参数、技能 ID、产物布局与回执字段均不变；仅修正行为与措辞。

## Capabilities

### New Capabilities

- `version-bump-guard`: 版本递增命令的 dry-run 与「无变更」守卫行为。

### Modified Capabilities

- `host-orchestration`: 门白名单覆盖技能内阻塞门；归档门按调用上下文分层；委派渲染遵循执行策略。
- `template-generation`: 指令形态 references 可解析；门策略块按技能实际承载渲染；模板正文宿主中立。
- `tool-call-whitelist`: 正文派发与 `allowedTools` 双向一致；生成物不得越权派发。
- `workflow-suite-skills`: 阻塞门使用统一标记；模板文本卫生（重复短语、阶段编号）。

## Impact

### 直接影响的文件

- `src/commands/version.ts`: dry-run 守卫与基线消息。
- `src/core/host-orchestration/protocol.ts`: `design-confirmation` anchor 与对齐审计。
- `src/core/host-orchestration/workflows.ts` / `render.ts` / `actions.ts`: 归档门分层、委派执行策略。
- `src/core/templates/prompt-gate.ts`: 白名单渲染变体（有门 / 只读 / 独立归档）。
- `src/core/templates/workflows/*.ts`: 门标记、内联/派发文本、AskUserQuestion、重复短语、编号。
- `src/core/command-generation/*` 与 adapters: 指令 references 重写。
- `test/*`: dry-run、门对齐、双向派发、生成物越权、references 解析。
- `README.md` / `AGENTS.md` / `docs/skills-manual.md`: 计数与版本。

### 向后兼容

无破坏性变更。既有产物在 `iagent update` 后刷新；未刷新的旧产物保持可用（只是继续带旧措辞）。归档独立调用行为按本次裁决保持「不新增停点」，只修正措辞与协议声明。

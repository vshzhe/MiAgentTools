## Why

用户观察到：同一套 iagent 技能在 Claude Code「UI 插件模式」下，`mode=auto-mode` 仍要人工二次确认、`mode=delegated` 可跳过，而 CLI 下表现又不同。探索（`openspec/changes/fix-mode-delegation-host-parity/exploration.md`）已把症状拆成四层根因：

1. **权限层（主因，P0）**：`skillDelegation()` 产出 `Skill(<裸名>)`（如 `Skill(spec_apply)`），与宿主实际技能 ID `iagent-spec-apply`（目录名与 frontmatter `name`）不一致 → **每次技能间委派都触发宿主权限审批，与 mode 无关**。本机 `.claude/settings.local.json` 记录的落盘规则是完整技能名（实证）。
2. **语义层（P0）**：`mode=delegated`（抑制停点 / 抑制自验证 / 结构化回执）与 `auto-mode=true`（只跳设计确认门）**不等价**，却被 `spec-propose` 正文声明为「等价别名」；无共享常量、无校验。
3. **宿主层（P0/P1）**：Codex 在默认安装集内却 `negotiationForHost → null`（不注入适配段、不声明 degraded）→ **静默伪 strict**；OpenCode 权限只翻译 `skill`/`subagent`，缺 `bash` 与 worker 的委派面；Pi strict 声称 `gate`/`receipt`/`state`，而 agent `tools` 仅 7 个内置名。
4. **环境层（P1）**：能力协商无 `surface` 维度，headless（`claude -p` / SDK）被当作可交互 strict → 业务门无法执行却仍声称 strict。

现在处理的原因：用户明确要求「除必留业务门外不再打断」，且 Codex 静默降级违反既有「MUST NOT 把本地执行伪装为委派完成」硬约束——缺陷位于默认路径，拖后会把同类问题复制到更多宿主产物。

## What Changes

**M1 权限层 canonical 化（P0，Q1/Q2 → D1/D2）**
- `skillDelegation()` 输出由 `Skill(<裸名>)` 改为 canonical 全名 `Skill(iagent-<workflowId>)`（与技能目录名及 frontmatter `name` 一致），19 处模板调用自动跟随；**不双写**裸名条目。
- 同步 `command-reference-refs` / `allowed-tools` / `template-consistency` / `tool-whitelist-constants` / `host-orchestration` 回归锁（正则须容纳 kebab），同步 `AGENTS.md` 守则 2、`openspec/CONTEXT.md` 术语与能力记忆（`tool-call-whitelist/explorations.md` 的 D5 裸名结论标注「已过时（由本变更取代）」）。
- 验收含 Claude Code 手动批准一次后读取 `settings.local.json` 落盘形态。

**M2 委托模式双正交参数（P0，Q3/Q5 → D3/D5）**
- 轴一 `mode=interactive|delegated`（**执行归属**）：`delegated` = 抑制结尾停点、抑制被委派技能自身验证、输出结构化回执、禁止「等待用户确认」停点。
- 轴二 `gate-skip=<gate-id>`（**门承载**）：声明哪些业务门已由父级确认，当前唯一取值 `design-confirmation`。`auto-mode=true` 仅映射到本轴（≡ `gate-skip=design-confirmation`），**不并入**执行归属轴。
- 词汇收敛为单一常量源（新模块），模板正文插值引用，MUST NOT 手写第二份取值；`auto-mode` 原名与「只跳设计门」语义保留（**非破坏性，minor**）。
- `spec-propose` 正文关于「`auto-mode=true` 为 `mode=delegated` 等价别名」的错误声明更正为两轴映射说明。
- `spec-explore` 补 `mode` Input 契约与回执字段（与被委派技能对齐）。

**M3 运行表面（surface）维度（P1，Q7 → D7）**
- 能力协商增加 `surface=interactive-ui|interactive-cli|headless`；headless 下 MUST NOT 声称可交互 `gate`。
- 门兜底：`conditional: true` 的澄清门可「记录决策并继续」并记 WARN；**不可豁免门**（`flow-final-confirmation` / `implementation-bridge` / `archive-confirmation` / `destructive-change`）在 headless 下 MUST 以 `blocked` 回执中止。

**M4 四宿主全覆盖（P0，Q4 → D4）**
- Codex：`HostId` 增 `codex` + 显式 degraded 档案（仅 `skill-load` / `argument-passing`），`negotiationForHost('codex')` 返回协商结果而非 `null`；`init` / `update` 输出诊断；编排产物在 Codex 下显式声明「本地执行，不构成委派」。
- Claude：canonical 白名单 + 会话级权限同步 + surface 维度。
- OpenCode：补齐 `bash` 规则（按技能实际 `Bash(<cmd>:*)` 前缀派生）与 worker 的 `skill`/`subagent` 面；MCP 缺口显式诊断（不生成猜测性规则）。
- Pi：`tools` 保持上游内置名不变，收窄 strict 的 `gate` 声明语义为「阻塞回执形态（非交互式）」并在协商 notes 披露；MUST NOT 保留「名义 strict」。

**M5/M6 已在 M4 内并入（OpenCode 权限翻译完整性、Pi 工具与门声明对齐）。**

**协议与渲染一致性（D8/D9）**
- `WORKFLOW_PROTOCOLS['auto-workflow']` 的 APPLY/ARCHIVE 阶段改用 auto-workflow 专用阶段（不声明与模板冲突的阻塞门），VERIFY 阶段显式声明 `requirement-doc-bridge`；该门锚定在既有 5 类白名单的 `requirement-clarification` 类别内（**5 类不变**）。
- `ORCHESTRATING_WORKFLOW_IDS` / `ORCHESTRATION_DELEGATIONS` 由硬编码清单改为**派生规则**：模板 `allowedTools` 含 `Skill(...)` 即注入宿主适配段与委派清单；`renderDelegationList` 透传 `options`（`mode` / `gate-skip`）。

**D6 验收**：仓库内结构断言 + `docs/host-permission-verification.md` 手工验证清单（Claude UI 与 CLI 各跑一次，区分权限弹窗与业务门）。权限诊断子命令（D6 可选项）本期不做。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `tool-call-whitelist`: 技能委派条目由裸名改为 canonical 全名，回归锁与文档形态同步（含归档/debug 委派条目与共享常量派生规则）。
- `host-orchestration`: 新增运行表面（surface）能力协商、Codex 显式 degraded 档案、按模板委派派生的注入面与选项透传、auto-workflow 阶段门与模板一致；Pi strict 的 gate 声明收窄；确认门白名单锚点补 `requirement-doc-bridge`。
- `opencode-tool-adapter`: OpenCode 权限翻译完整性（bash 按实际命令前缀、worker 的 skill/subagent 面按实际委派派生、MCP 缺口诊断）。
- `spec-workflow-skills`: 委托模式双轴词汇与单一常量源、`spec-propose` 别名声明更正、`spec-apply` 门承载参数契约、`spec-explore` Input 模式契约。
- `workflow-suite-skills`: workflow / auto-workflow 委派 apply 的参数由 `auto-mode=true` 改为 canonical `gate-skip=design-confirmation`（行为不变），与协议阶段门对齐。

## Impact

### 影响分析（CodeGraph，Phase 2.0）

| 区域 | 符号 / 文件 | 调用方与测试 |
| :--- | :--- | :--- |
| 白名单与模板构造（M1/M2） | `skillDelegation`（`src/core/templates/tool-whitelist.ts:60`） | 19 处模板调用（`project-init` / `spec-archive` / `workflow` / `debug` +5）；`test/tool-whitelist-constants.test.ts` |
| 同上 | `SUBAGENT_DISPATCH`（`:46`） | 8 处（`auto-workflow` / `debug` / `migration` / `spec-apply` +3）；同上测试 |
| 同上 | `getProjectInitSkillTemplate` / `getSpecApplyChangeSkillTemplate` / `getAutoWorkflowCommandTemplate` | `registry.ts` 注册；`test/template-derivation.test.ts`、`test/project-init-scan.test.ts` |
| 宿主编排渲染（M2/M3） | `adaptSkillContentForHost`（`render.ts:160`） | 6 处（`init` / `update` / `index`）；`test/host-orchestration.test.ts` |
| 同上 | `renderDelegate`（`actions.ts:46`）/ `renderDelegationList`（`:83`） | 各 4 处；`test/claude-host-adapter.test.ts`、`test/host-orchestration.test.ts` |
| 能力协商（M3/M4） | `negotiationForHost`（`hosts.ts:139`）/ `negotiateCapabilities`（`:105`） | 5 / 3 处（`init` / `update` / `index`） |
| 同上 | `HOST_PROFILES` / `HostCapabilityProfile` / `CapabilityNegotiation` | 2 / 3 / 9 处（`index` / `render` / `transition` / `hosts`） |
| 同上 | `WORKFLOW_PROTOCOLS`（`workflows.ts:141`）/ `evaluatePhaseTransition`（`transition.ts:59`） | 4 处（`index` / `workflows`）；`test/host-orchestration.test.ts` |
| 权限载体（M1） | `buildPermissionEntries` / `mergePermissions`（`permissions.ts:56,90`） | 各 5 处（`init` / `update`）；`test/permissions.test.ts` |
| OpenCode（M5） | `writeOpenCodeProjectArtifacts`（`opencode-v2.ts:264`）/ `mergeOpenCodeProjectConfig`（2） | 4 处（`init` / `update`）；`test/opencode-v2.test.ts` |
| 同上 | `renderOrchestratorAgent` / `renderWorkerAgent` / `iagentPermissionRules` / `isIagentRule` / `openCodeAgentId` | 模块内部 |
| Pi（M6） | `writePiNativeAgents`（`pi-native.ts:244`）/ `PI_AGENT_TOOLS`（3）/ `renderPiStageAgent`（2）/ `resolvePiNestingDelegations`（2） | 7 处（`init` / `update`）；`test/pi-native.test.ts`、`test/pi-runtime.test.ts` |
| 同上 | `detectPiRuntime`（`pi-runtime.ts:276`） | `init` / `update` |
| 模板 mode 语义（M2） | `spec-apply` / `spec-propose` / `spec-explore` / `auto-workflow` / `workflow` 模板正文；`DelegateAction.options`（2 调用方） | `test/template-derivation.test.ts` |

### 直接影响的文件

- `src/core/templates/tool-whitelist.ts`: `skillDelegation()` 改 canonical 派生，文档注释与输入契约同步。
- `src/core/templates/workflows/*.ts`（19 处调用方 + mode 段落）: 白名单取值自动跟随；`spec-propose` / `spec-apply` / `spec-explore` / `workflow` / `auto-workflow` 正文改为插值引用双轴词汇。
- `src/core/host-orchestration/delegation-contract.ts`（**新建**）: 委托模式词汇与解析的单一源（`mode` / `gate-skip` / `auto-mode` 映射）。
- `src/core/host-orchestration/hosts.ts`: `HostId` 增 `codex`、`HOST_PROFILES.codex`、`surface` 维度、`PI_STRICT_PROFILE` gate 声明收窄。
- `src/core/host-orchestration/render.ts`: 派生注入面（替换硬编码 `ORCHESTRATING_WORKFLOW_IDS` / `ORCHESTRATION_DELEGATIONS`）、surface 策略声明。
- `src/core/host-orchestration/actions.ts`: `renderDelegationList` 透传 `options`；codex 委派渲染为显式本地执行。
- `src/core/host-orchestration/workflows.ts`: auto-workflow 专用 APPLY/ARCHIVE 阶段与 VERIFY 文档桥门；`PHASE_GATE_CATEGORY` 补 `requirement-doc-bridge` → `requirement-clarification` 映射；`debug` 的 `verify-close` 同步声明该门（消除第三条「协议与模板漂移」）。
- `src/core/host-orchestration/protocol.ts`: 白名单锚点补 `requirement-doc-bridge`（归属 `requirement-clarification`）。
- `src/core/host-orchestration/index.ts`: 导出新模块（`delegation-contract` 的词汇与解析函数）、`SurfaceId` / `SURFACE_IDS`、`deriveOrchestrationDelegations` 与新增的可选形参类型。
- `src/core/host-orchestration/transition.ts`: surface 缺 gate 时的门兜底（条件门放行并记录、不可豁免门阻断）。
- `src/core/opencode-v2.ts`: `bash` 规则派生、worker `skill` / `subagent` 面派生、MCP 缺口诊断。
- `src/core/pi-native.ts`: 注释与诊断与收窄后的 gate 声明对齐（`tools` 集合不变）。
- `src/commands/init.ts` / `update.ts`: codex 协商诊断输出、派生注入面接线。
- `test/*`（`allowed-tools` / `command-reference-refs` / `template-consistency` / `tool-whitelist-constants` / `host-orchestration` / `opencode-v2` / `pi-native` / `pi-runtime` / `permissions` / `template-derivation` / `artifact-dataflow` / `project-init-scan` / `skills-parity`）: 断言与正则同步。
- `AGENTS.md`、`openspec/CONTEXT.md`、`docs/skills-manual.md`、`docs/migration-guide.md`、`openspec/specs/tool-call-whitelist/explorations.md`: 术语与守则同步。
- `package.json` / `CHANGELOG.md`: minor 递增与变更日志（AGENTS.md 修改守则 8）。
- `docs/host-permission-verification.md`（**新建**）: Claude UI / CLI 手工验证清单。
- `skills/`（`pnpm build && pnpm generate:skills` 重生成，MUST NOT 手编）。

### 向后兼容

- **非破坏性（minor）**：`auto-mode=true` 名称与「只跳设计门」语义保持不变；新增 `mode=delegated` 与 `gate-skip` 为增量能力；既有用户自动化管线不因本次变更改变行为。
- 白名单形态变化只影响生成产物（`Skill(iagent-<id>)`），不改用户可见 CLI 参数与配置文件结构。
- Codex 由「无适配段」变为「显式 degraded 段」：产物内容增加，语义从「静默内联」变为「显式声明本地执行」，不涉及 CLI 契约变化。
- Pi `tools` 集合不变，仅收窄 `gate` 的声明语义，避免既有 `.pi/agents/` 产物失效。
- 存量项目需执行 `iagent update` 刷新技能 / 指令 / 权限产物；`iagent init` 不覆盖既有产物（既有语义不变）。

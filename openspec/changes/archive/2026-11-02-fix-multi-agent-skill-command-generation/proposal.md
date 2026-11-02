# Proposal: fix-multi-agent-skill-command-generation

## Why

在全面审查 MiAgentTools 针对 `claude`、`pi`、`opencode`、`codex` 四个 Agent 宿主的指令（Commands/Prompts）与技能（SKILL）生成框架、单一源派生链路与宿主原生编排适配时，定位出 9 项跨四宿主的实质性缺陷（F1–F9，详见 `openspec/changes/fix-multi-agent-skill-command-generation/exploration.md`）：

1. **指令适配与参数注入缺陷（F1 / F9，P0）**：
   - `pi.ts` 与 `opencode.ts` 的参数注入仅匹配英文 `**Input**:` 与 `None required`，在模板中文化（`improve-template-language-consistency`）后，12/20 个使用中文 `**输入**：` 或缺少顶层输入行的指令丢失了 `**Provided arguments**: $ARGUMENTS` 占位符，而无参指令 `spec-bulk-archive`（使用 `无需参数`）却被误注入 `$ARGUMENTS`；且 `proposal-review.ts` 的**非顶层示例段**（`## 检查示例`，未置于围栏内）含 `**输入**:` 示例行，在补齐中文识别后存在被「首个匹配」误判为顶层输入段的风险 —— 须由「仅匹配首个顶层段 + 围栏代码块隔离」双重约束收敛。
   - `deriveCommandContent`（`CMD:SKIP`）存在两处**真实**裁剪缺陷：`spec-archive.ts`（误将 `ARCHIVE-INDEX.md` 标签白名单防护规则裁剪出 Command 版）、`spec-propose.ts`（误将 Step 0.2~0.7 探索文件扫描与迁移裁剪出 Command 版）。
   - 勘误（代码取证修正）：`spec-explore.ts` 第 34 行的英文 `**Input**:` 位于常量 `EXPLORATION_PROTOCOL_FULL`，其唯一落点是 `references/exploration-protocol.md` 参考文件，**不进入** `deriveCommandContent` 派生面，故不存在「指令版重复输入段」；改为直接删除该参考文件内的冗余英文行（MUST NOT 使用 `CMD:SKIP` 包裹，理由见 `design.md` §2 与 Risks）。
2. **跨宿主引用改写与参考文件归一化遗漏（F3 / F4 / F7 / F8，P0/P1）**：
   - Codex（`skills-only` 宿主，无自定义斜杠命令）未配置 `commandsLayout`，`rewriteCommandRefs` 将 `/iagent:<id>` 原样保留为 Claude 专有斜杠命令语法，未改写为 Codex CLI 原生技能调用语法 `$iagent-<id>`。
   - `references/*.md` 附加参考文件绕过了 `rewriteCommandRefs` 与 `normalizeHostSkillRefs`（`iagent_<id>` → `iagent-<id>`），导致 Pi / OpenCode / Codex 的 `references/*.md` 中残留 `/iagent:<id>` 与 `iagent_<id>`。
   - `generateSkillContent` 仅在传入 `options.hostId` 时才对 `instructions` 归一化 `iagent_`，未覆盖 `description`、`compatibility`、`references[].content`，且 `scripts/generate-skills.mjs` 与 `iagent generate` 未传 `hostId` 导致 `skills/` 快照残留 40+ 处 `iagent_`（实测：23 个 `references/*.md` 中 16 处 `iagent_` + 1 处 `/iagent:`，`SKILL.md` 正文合计 124 处 `iagent_` + 31 处 `/iagent:`）；4 个模板仍残留已废弃的 `metadata.version: '1.0'`（`workflow.ts`、`auto-workflow.ts`、`spec-explore.ts`、`spec-propose.ts`）；`project-init.ts` 与 `test.ts` 残留硬编码 `.claude/skills/...` 路径与 `经 Skill 工具委派` 措辞。
3. **宿主原生编排、Agent 产物与权限/卸载完整性缺陷（F2 / F5 / F6，P0/P1）**：
   - `init.ts` 与 `update.ts` 已按生效 `workflows` 计算了 `orchestration`，但在调用 `adaptSkillContentForHost` 时漏传该第 4 参数，导致裁剪 `workflows` 时回退到全量 20 技能派生。
   - `opencode-v2.ts` 中 `collectShellPrefixes` 正则 `/^Bash\(([a-zA-Z0-9._-]+):\*?\)$/` 无法匹配含空格的 `Bash(git status:*)` 等 8 处 Git 子命令（5 类前缀：`git status` / `git diff` / `git add` / `git commit` / `git log`）；`removeOpenCodeProjectArtifacts` 使用 `raw.replace(/\/\/.*$/gm, '')` 截断 `"$schema": "https://opencode.ai/config.json"` 中的 `//opencode.ai/...`，导致 `iagent uninstall` 解析 JSON 恒抛错并静默吞掉异常、无法卸载权限规则；`renderWorkerPermissions` 无条件为只读技能（`review` / `proposal-review` / `spec-verify` / `spec-verify-proposal`）授予 `action: edit` 且缺失 `action: question`；`renderWorkerAgent` 未对 `description` 执行 `normalizeHostSkillRefs` 与 `escapeYamlValue`。
   - OpenCode 与 Pi 的阶段 Worker Agent（`.opencode/agents/iagent-*.md`、`.pi/agents/iagent-*.md`）正文缺少启动时加载对应 `SKILL.md` 的引导指令；`writeOpenCodeProjectArtifacts` 与 `scanReconcileOrphans` 缺少对 `.opencode/agents/iagent-*.md` orphan 文件的清理与扫描。

现在修复的原因：上述缺陷直接影响 `claude`、`pi`、`opencode`、`codex` 四个宿主的指令可用性、技能加载、权限最小化与卸载干净度，必须在框架层一次性收敛并加上回归锁。

## What Changes

### D1：跨宿主指令引用改写、路径去耦合与 `SKILL.md` / `references/*.md` 统一归一化（覆盖 F3 / F4 / F7 / F8，含边界 B1 / B3）
- **Codex `$iagent-<id>` 引用改写（B1）**：`src/core/config.ts` 的 `CommandLayout` 扩展为 `'namespace-dir' | 'prefixed-file' | 'skills-only'`，`AI_TOOLS` 中 `codex` 配置 `commandsLayout: 'skills-only'`；`src/core/templates/command-references.ts` 新增 `codexSkillRef(id)`（产出 `$iagent-<id>`），`rewriteCommandRefs(text, layout, knownIds)` 在 `layout === 'skills-only'` 时将已知 `/iagent:<id>` 改写为 `$iagent-<id>`，未知 id 保持原样，`layout === undefined` 时仍返回 `/iagent:<id>`（保持既有单测兼容）。
- **技能与 `references/*.md` 统一归一化（B3）**：`src/core/command-generation/generator.ts` 的 `generateSkillContent` 无条件对 `description`、`compatibility`、`instructions` 及 `references[].content` 统一执行 `normalizeHostSkillRefs`（`iagent_<id>` → `iagent-<id>`）；`init.ts`、`update.ts`、`generate.ts` 在生成技能时对 `references[].content` 同步执行 `rewriteCommandRefs`（当 `SKILL.md` 因用户手改被 `skippedModified` 保护跳过时，不覆盖其 `references/`）。
- **Codex 引用语法与能力档案同源（新增，补齐 D1 一致性缺口）**：改写引入 `$iagent-<id>` 后，MUST 同步 `src/core/host-orchestration/hosts.ts` 的 `codex` 档案 `native.skillLoading` 与 `src/core/host-orchestration/actions.ts` 的 `renderLoadSkill('codex')` 口径（现行文案为「无宿主级技能调用工具」，与新语法冲突），并更新 `README.md` 四工具对照表中的 Codex 技能触发形式 `$iagent_spec_apply` → `$iagent-spec-apply`。MUST NOT 因改写而在 `codex` 档案中虚增 `delegate` / `gate` 能力（skills-only degraded 边界不变）。
- **移除废弃 `metadata.version` 与宿主耦合表述**：移除实际残留 `version: '1.0'` 的 4 个模板（`workflow.ts`、`auto-workflow.ts`、`spec-explore.ts`、`spec-propose.ts`）中的该字段（`generateSkillContent` 从不渲染 `metadata.version`，故本项属源码卫生，产物前后字节一致）；`iagent generate` 骨架已无该字段，仅需回归断言；将 `project-init.ts`（第 304 行）与 `test.ts`（第 753 行）中硬编码的 `.claude/skills/iagent-.../references/...` 改为宿主无关的本技能目录下 `references/...` 相对路径；将 `project-init.ts`（第 71、194 行）中硬编码的 `经 \`Skill\` 工具委派` 改为宿主中立表述。

### D2：Command 派生（`deriveCommandContent`）与 Pi / OpenCode 参数占位符注入修复（覆盖 F1 / F9，含边界 B2）
- **中英 Input 识别与代码块隔离（B2）**：统一 `src/core/command-generation/adapters/pi.ts` 与 `opencode.ts` 的参数注入逻辑，仅在围栏代码块（` ``` `）外识别顶层 `**Input**:` 与 `**输入**：` / `**输入**:` 段落，在其段落末尾注入 `**Provided arguments**: $ARGUMENTS`；同时识别 `None required` 与 `无需参数`（修复 `spec-bulk-archive` 误注入）及既有 `$ARGUMENTS` / `$1`..`$9` 幂等跳过；为缺少顶层输入声明的 `migration.ts`、`proposal-review.ts`、`spec-verify-proposal.ts` 补齐标准 `**输入**：` 声明行。
- **`CMD:SKIP` 裁剪边界修正**：
  - `spec-explore.ts`：删除 `EXPLORATION_PROTOCOL_FULL`（唯一落点 `references/exploration-protocol.md`）中第 34 行的冗余英文 `**Input**:` 行，统一参考文件语言口径；MUST NOT 用 `CMD:SKIP` 包裹（该常量不进入指令派生面，标记会原样写进参考文件）；
  - `spec-archive.ts`：调整第 257–274 行 `CMD:SKIP` 范围，使 `ARCHIVE-INDEX.md` 补充标注标签白名单规则保留进入 Command 版；
  - `spec-propose.ts`：移除 Step 0.2~0.7 外围的 `CMD:SKIP` 包裹，使独立执行 `/iagent:spec-propose` 时同样具备探索文件扫描、提示关联与迁移能力。

### D3：宿主原生编排（OpenCode V2 / Pi / Claude）与权限/Agent 产物完整性修复（覆盖 F2 / F5 / F6，含边界 B4 / B5 / B6）
- **生效 `orchestration` 透传（B6）**：`src/commands/init.ts` 与 `src/commands/update.ts` 在技能生成与指令生成两处调用 `adaptSkillContentForHost` 时，顯式传入基于 `activeSkillTemplates` 计算的 `orchestration` 对象。
- **OpenCode V2 权限、JSONC 卸载与 Worker 定义修复（B4 / B5）**：
  - `collectShellPrefixes` 支持含空格子命令 `Bash(git <subcmd>:*)`（提取为 `"git <subcmd> "` 并由 `isIagentRule` 同步识别）；
  - `removeOpenCodeProjectArtifacts` 改用状态机 `stripJsonc(raw)` 替代破坏 `$schema` URL 的行注释正则；
  - `renderWorkerPermissions` 仅当阶段模板 `allowedTools` 含 `Write` 或 `Edit` 时授予 `action: edit`（只读技能不授 `edit`），并为所有阶段 worker 补充 `action: question`；
  - `renderWorkerAgent` 与 `renderPiStageAgent` 对 `description` 执行 `normalizeHostSkillRefs` 与 `escapeYamlValue`，并在 worker 正文中注入启动时加载对应技能 `SKILL.md` 的明确指令。
- **OpenCode orphan agent 清理与 reconcile 扫描（B6）**：`writeOpenCodeProjectArtifacts` 清理 `.opencode/agents/` 下不再属于生效集的 `iagent-*.md`（保留 `iagent-orchestrator.md` 与用户自建文件），`scanReconcileOrphans` 同步扫描 `.opencode/agents/`。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `template-generation`: 扩展 `rewriteCommandRefs` 支持 `codex`（`skills-only`）改写为 `$iagent-<id>` 且对 `references/*.md` 同步改写；`generateSkillContent` 统一对全字段及 `references` 执行 `iagent_<id>` → `iagent-<id>` 归一化；清理实际残留 `metadata.version` 的 4 个模板（`workflow` / `auto-workflow` / `spec-explore` / `spec-propose`）及硬编码 `.claude/skills/` 路径与 Claude 专属工具名；使 Codex 引用语法与宿主编档（`hosts.ts` / `actions.ts` / README）口径一致。
- `template-single-source`: 删除 `spec-explore` 参考文件中冗余英文 `Input` 行（不使用 `CMD:SKIP`）、修正 `spec-archive` 与 `spec-propose` 两处 `CMD:SKIP` 裁剪边界；统一 Pi 与 OpenCode 指令适配器的中英 `Input`/`输入` 参数占位符注入规则（含「首个顶层段」、代码块隔离与中英无参跳过）。
- `host-orchestration`: `init` / `update` 向 `adaptSkillContentForHost` 传入生效集 `orchestration`；Pi 阶段 worker agent 补充 `description` 技能 ID 归一化与读取对应 `SKILL.md` 的协议引导；Codex 档案 `native.skillLoading` 与 `renderLoadSkill('codex')` 措辞与 `$iagent-<id>` 引用改写同源一致（MUST NOT 借此虚增 `delegate` / `gate` 能力）。
- `opencode-tool-adapter`: `collectShellPrefixes` 支持含空格 Git 子命令前缀；`removeOpenCodeProjectArtifacts` 复用 `stripJsonc` 修复含 `$schema` URL 的配置卸载；阶段 worker 按需授予 `edit` 并补齐 `question` 权限、`description` 安全转义、加载对应 `SKILL.md` 引导，以及 `.opencode/agents/` orphan 清理与 reconcile 扫描。

## Impact

### 影响分析（CodeGraph，Phase 2.0）

| 区域 | 符号 / 文件 | 直接调用方与测试覆盖 |
| :--- | :--- | :--- |
| 指令引用改写（D1） | `rewriteCommandRefs` / `prefixedCommandRef` / `codexSkillRef` (`src/core/templates/command-references.ts:27,53`) | 调用方：`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/generate.ts`、`src/core/templates/index.ts`；测试：`test/command-reference-refs.test.ts` |
| 工具指令布局配置（D1） | `CommandLayout` / `AI_TOOLS` (`src/core/config.ts:65,99`) | 调用方：`src/core/templates/command-references.ts`、`src/core/command-artifacts.ts`；测试：`test/command-reference-refs.test.ts`、`test/commands.test.ts` |
| 技能生成与 ID 归一化（D1） | `generateSkillContent` / `normalizeHostSkillRefs` (`src/core/command-generation/generator.ts:21,78`) | 15 处调用方：`scripts/generate-skills.mjs`、`src/commands/generate.ts`、`src/commands/init.ts`、`src/commands/update.ts`；测试：`test/generation.test.ts`、`test/skills-parity.test.ts`、`test/allowed-tools.test.ts` |
| Pi / OpenCode 参数注入（D2） | `injectPiArgs` / `piAdapter` (`src/core/command-generation/adapters/pi.ts:32,40`) & `injectOpenCodeArgs` / `opencodeAdapter` (`src/core/command-generation/adapters/opencode.ts:34,45`) | 调用方：`src/core/command-generation/adapters/registry.ts`；测试：`test/generation.test.ts`、`test/opencode-v2.test.ts`、`test/template-language.test.ts` |
| 指令单一源派生（D2） | `deriveCommandContent` (`src/core/templates/derive-command.ts:23`) 及 `workflows/{spec-explore,spec-archive,spec-propose,migration,proposal-review,spec-verify-proposal,project-init,test}.ts` | 调用方：全部 20 个 `workflows/*.ts`；测试：`test/template-derivation.test.ts`、`test/templates.test.ts` |
| 宿主编排适配注入（D3） | `adaptSkillContentForHost` (`src/core/host-orchestration/render.ts:272`) | 调用方：`src/commands/init.ts`、`src/commands/update.ts`；测试：`test/host-orchestration.test.ts` |
| OpenCode V2 产物与权限（D3） | `collectShellPrefixes` / `renderWorkerPermissions` / `renderWorkerAgent` / `writeOpenCodeProjectArtifacts` / `removeOpenCodeProjectArtifacts` (`src/core/opencode-v2.ts:59,78,145,365,463`) | 调用方：`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/uninstall.ts`；测试：`test/opencode-v2.test.ts` |
| Pi 原生 Agent 生成（D3） | `renderPiStageAgent` / `writePiNativeAgents` (`src/core/pi-native.ts:194,254`) | 调用方：`src/commands/init.ts`、`src/commands/update.ts`；测试：`test/pi-native.test.ts` |
| 孤立产物对账扫描（D3） | `scanReconcileOrphans` (`src/core/reconcile.ts:37`) | 调用方：`src/commands/init.ts`、`src/commands/update.ts`；测试：`test/reconcile.test.ts` |
| Codex 引用语法与能力档案同源（D1） | `HOST_PROFILES.codex.native.skillLoading` (`src/core/host-orchestration/hosts.ts:97-107`)、`renderLoadSkill` (`src/core/host-orchestration/actions.ts:89-104`)、`README.md` 四工具对照表 | 调用方：`negotiationForHost` / `renderHostOrchestrationSection` / `writePiNativeAgents` / `writeOpenCodeProjectArtifacts`；测试：`test/host-orchestration.test.ts`、`test/host-smoke.test.ts` |

### 直接影响的文件

- `src/core/config.ts`: `CommandLayout` 增加 `'skills-only'`，`AI_TOOLS` 的 `codex` 条目配置 `commandsLayout: 'skills-only'`。
- `src/core/templates/command-references.ts`: 新增 `codexSkillRef(id)`，`rewriteCommandRefs` 支持 `'skills-only'` 改写为 `$iagent-<id>`。
- `src/core/command-generation/generator.ts`: `generateSkillContent` 无条件对 `description`、`compatibility`、`instructions`、`references[].content` 执行 `normalizeHostSkillRefs`。
- `src/core/command-generation/adapters/pi.ts` & `src/core/command-generation/adapters/opencode.ts`（及共享辅助函数）: 支持围栏代码块外的中英 `**Input**:` / `**输入**：` 识别与 `None required` / `无需参数` 跳过。
- `src/core/templates/workflows/*.ts`:
  - `workflow.ts`、`auto-workflow.ts`、`spec-explore.ts`、`spec-propose.ts`（移除实际残留的 `metadata.version: '1.0'`，源码卫生项，产物字节不变）；
  - `project-init.ts`、`test.ts`（去耦合 `.claude/skills/...` 硬编码路径与 `经 \`Skill\` 工具委派`）；
  - `migration.ts`、`proposal-review.ts`、`spec-verify-proposal.ts`（补齐顶层 `**输入**：` 声明行）；
  - `spec-explore.ts`（删除 `EXPLORATION_PROTOCOL_FULL` 中的冗余英文 `**Input**:` 行，仅影响 `references/exploration-protocol.md`）、`spec-archive.ts`、`spec-propose.ts`（修正 `CMD:SKIP` 裁剪边界）。
- `src/core/host-orchestration/hosts.ts` / `src/core/host-orchestration/actions.ts` / `README.md`: 使 Codex `skillLoading` 口径、`renderLoadSkill('codex')` 措辞与 README 对照表（`$iagent-spec-apply`）与 `$iagent-<id>` 改写一致，且不虚增 `delegate` / `gate` 能力。
- `src/core/opencode-v2.ts`: 修复 `collectShellPrefixes`、`removeOpenCodeProjectArtifacts`（复用 `stripJsonc`）、`renderWorkerPermissions`（只读不授 `edit`、补 `question`）、`renderWorkerAgent`（转义与归一化 `description`、补充加载 `SKILL.md` 引导）、`writeOpenCodeProjectArtifacts`（清理 orphan agent）。
- `src/core/pi-native.ts`: `renderPiStageAgent` 归一化 `description` 并补充读取 `.pi/skills/iagent-<id>/SKILL.md` 的引导指令。
- `src/core/reconcile.ts`: `scanReconcileOrphans` 增加扫描 `.opencode/agents/iagent-*.md` 孤立 agent。
- `src/commands/init.ts`、`src/commands/update.ts`、`src/commands/generate.ts`: 对 `references` 执行 `rewriteCommandRefs`；向 `adaptSkillContentForHost` 传入生效 `orchestration`（`generate.ts` 骨架无 `metadata.version`，仅补回归断言）。
- `skills/**`: 经 `pnpm build && pnpm generate:skills` 重新生成静态快照。
- `test/**`: 扩展 `test/command-reference-refs.test.ts`、`test/generation.test.ts`、`test/template-derivation.test.ts`、`test/opencode-v2.test.ts`、`test/pi-native.test.ts`、`test/reconcile.test.ts`、`test/host-orchestration.test.ts`。

### 向后兼容

- **非破坏性修复**：
  - `rewriteCommandRefs(text, undefined, knownIds)` 在 `layout === undefined` 时保持返回 `/iagent:<id>`，100% 兼容既有调用方与单测（B1）。
  - `command-artifacts.ts` 中指令文件落盘与清理仍以 `!tool.commandsDir` 短路跳过 `codex`，为 `codex` 增加 `commandsLayout: 'skills-only'` 仅作用于正文引用改写，不改变 `codex` 无指令产物的目录结构契约。
  - `update` 的手改保护边界（`skippedModified`）保持不变：主 `SKILL.md` 被手改跳过时，其 `references/` 同样保留不覆盖（B3）。
  - 存量项目执行 `iagent update` 即可无损刷新全部四宿主产物、清理 orphan agent 并修复权限配置。

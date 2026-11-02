# Tasks: fix-multi-agent-skill-command-generation

> 节点标识（`[N1]`–`[N14]` 含 `[N6F]` / `[N6W]`）对应探索文件 `## 功能流程图` 的已确认流程基准。
> 任务类型标签：`[代码]` 实现代码 / `[测试][单元|功能][P0|P1|P2]` 测试代码。
> 执行顺序即依赖顺序；标记「依赖」的任务须在其前置任务完成后执行。

## 1. 跨宿主指令引用改写、路径去耦合与技能/参考文件统一归一化（D1）

- [x] [代码] 1.1 扩展 `CommandLayout` 支持 `'skills-only'` 并配置 `AI_TOOLS` 的 `codex` 条目；在 `command-references.ts` 新增 `codexSkillRef(id)`（产出 `$iagent-<id>`），扩展 `rewriteCommandRefs` 在 `layout === 'skills-only'` 时改写已知 `/iagent:<id>` 为 `$iagent-<id>`，保持 `layout === undefined` 返回原字符串 [N1][N4]
  - 文件：`src/core/config.ts`、`src/core/templates/command-references.ts`
  - 验证：`rewriteCommandRefs('运行 /iagent:spec-apply 与 /iagent:unknown', 'skills-only')` 返回 `'运行 $iagent-spec-apply 与 /iagent:unknown'`；`rewriteCommandRefs('/iagent:spec-apply', undefined)` 返回 `'/iagent:spec-apply'`
  - Spec Ref: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验
  - Scenario Ref: Codex skills-only 布局改写与 undefined 向后兼容
  - Scenario Ref: 生成期按工具布局改写
  - Refs: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验 / Codex skills-only 布局改写与 undefined 向后兼容

- [x] [代码] 1.2 更新 `generateSkillContent` 无条件对 `description`、`compatibility`、`instructions` 及 `references[].content` 统一执行 `normalizeHostSkillRefs`（`iagent_<id>` → `iagent-<id>`） [N5]
  - 文件：`src/core/command-generation/generator.ts`、`src/core/command-generation/host-refs.ts`（新增，归一化实现）、`src/core/command-generation/index.ts`
  - 验证：不传 `options.hostId` 调用 `generateSkillContent` 时，输出的 frontmatter `description`、`compatibility`、主正文与 `references[].content` 均不含已知 `iagent_<id>` 下划线形式
  - Spec Ref: template-generation / 技能与参考文件宿主技能 ID 统一归一化及宿主路径去耦合
  - Scenario Ref: generateSkillContent 全字段与 references 统一归一化
  - Refs: template-generation / 技能与参考文件宿主技能 ID 统一归一化及宿主路径去耦合 / generateSkillContent 全字段与 references 统一归一化

- [x] [代码] 1.3 移除**实际残留** `metadata.version: '1.0'` 的 4 个技能模板字段（`workflow` / `auto-workflow` / `spec-explore` / `spec-propose`；`generateSkillContent` 从不渲染该字段，属源码卫生、产物字节不变）；将 `project-init.ts` 与 `test.ts` 中硬编码的 `.claude/skills/.../references/...` 改为本技能目录下的相对路径 `references/...`，并将 `project-init.ts`（第 71、194 行）中的 `经 \`Skill\` 工具委派` 改为宿主中立表述 [N5]
  - 文件：`src/core/templates/workflows/workflow.ts`、`src/core/templates/workflows/auto-workflow.ts`、`src/core/templates/workflows/spec-explore.ts`、`src/core/templates/workflows/spec-propose.ts`、`src/core/templates/workflows/project-init.ts`、`src/core/templates/workflows/test.ts`
  - 验证：扫描全部 20 个 `workflows/*.ts` 与 `src/commands/generate.ts`，不含 `version: '1.0'`（模板元数据）、不含 `.claude/skills/`、不含 `经 \`Skill\` 工具`；`git diff skills/` 中 SKILL.md 正文与 frontmatter 字节不变（仅 `spec-explore` 的 `references/exploration-protocol.md` 因删除冗余英文行而变）
  - Spec Ref: template-generation / frontmatter 元数据字段 SHALL NOT 含 metadata.version
  - Scenario Ref: 模板与生成器不再写入 version
  - Spec Ref: template-generation / 技能与参考文件宿主技能 ID 统一归一化及宿主路径去耦合
  - Scenario Ref: 模板正文与 references 无硬编码宿主路径及专属工具名
  - Refs: template-generation / frontmatter 元数据字段 SHALL NOT 含 metadata.version / 模板与生成器不再写入 version

- [x] [测试][单元][P0] 1.4 为 D1 编写并扩展单元测试：验证 Codex `$iagent-<id>` 改写、`layout === undefined` 兼容、`references/*.md` 引用改写与 `iagent_` 归一化、`metadata.version` 零残留及硬编码 `.claude/skills/` 拦截、以及 Codex 能力档案口径与改写一致（`capabilities` 不含 `delegate` / `gate`） [N4][N5][N6F][N6W]
  - 依赖：1.1, 1.2, 1.3, 1.5
  - 文件：`test/command-reference-refs.test.ts`、`test/generation.test.ts`、`test/template-consistency.test.ts`、`test/host-orchestration.test.ts`
  - 验证：`pnpm vitest run test/command-reference-refs.test.ts test/generation.test.ts test/template-consistency.test.ts test/host-orchestration.test.ts` 全部通过
  - Spec Ref: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验
  - Scenario Ref: 引用以规范形书写并由单一源产出
  - Scenario Ref: 生成期按工具布局改写
  - Scenario Ref: Codex skills-only 布局改写与 undefined 向后兼容
  - Scenario Ref: references 附加文件同步改写且遵循手改保护
  - Scenario Ref: 未注册 id 被测试拦截
  - Scenario Ref: 历史断链修复
  - Scenario Ref: 无条件委派技能由 DEPS 覆盖
  - Scenario Ref: 条件委派声明降级路径
  - Scenario Ref: 引用改写适用于全部派生正文
  - Spec Ref: template-generation / 技能与参考文件宿主技能 ID 统一归一化及宿主路径去耦合
  - Scenario Ref: generateSkillContent 全字段与 references 统一归一化
  - Scenario Ref: 模板正文与 references 无硬编码宿主路径及专属工具名
  - Spec Ref: template-generation / frontmatter 元数据字段 SHALL NOT 含 metadata.version
  - Scenario Ref: 模板与生成器不再写入 version
  - Scenario Ref: 存量产物移除 version 后仍可安全升级
  - Scenario Ref: 记账字段不受影响
  - Refs: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验 / references 附加文件同步改写且遵循手改保护

- [x] [代码] 1.5 使 Codex 引用语法与能力档案同源：更新 `HOST_PROFILES.codex.native.skillLoading`（不再声明「无宿主级技能调用工具」）与 `renderLoadSkill('codex', ...)` 措辞，并同步 `README.md` 四工具对照表的 Codex 技能触发形式 `$iagent-spec-apply`；`capabilities` 仍仅含 `skill-load` / `argument-passing`（MUST NOT 虚增 `delegate` / `gate`） [N3][N4][N7]
  - 依赖：1.1
  - 文件：`src/core/host-orchestration/hosts.ts`、`src/core/host-orchestration/actions.ts`、`README.md`、`test/host-orchestration.test.ts`
  - 验证：`negotiationForHost('codex')` 仍返回 `degraded` 且 `missing` 含 `delegate` / `gate`；`renderLoadSkill('codex', 'degraded', …)` 不再输出「无宿主级技能调用工具」；README 对照表 Codex 列与 canonical `$iagent-<id>` 一致
  - Spec Ref: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验
  - Scenario Ref: Codex skills-only 布局改写与 undefined 向后兼容
  - Refs: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验 / Codex skills-only 布局改写与 undefined 向后兼容

## 2. Command 单一源派生与 Pi / OpenCode 参数占位符注入修复（D2）

- [x] [代码] 2.1 重构 `pi.ts` 与 `opencode.ts` 的参数注入逻辑：提取共享的围栏代码块感知注入函数，仅在代码块（` ``` ` / `~~~`）外匹配顶层 `**Input**:` 与 `**输入**：` / `**输入**:` 段落并注入 `**Provided arguments**: $ARGUMENTS`；同时识别 `None required` 与 `无需参数` 及已有 `$ARGUMENTS` / `$1`..`$9` 跳过注入 [N9][N10]
  - 文件：`src/core/command-generation/adapters/pi.ts`、`src/core/command-generation/adapters/opencode.ts`、`src/core/command-generation/adapters/inject-args.ts`（新增，共享注入实现）
  - 验证：`spec-bulk-archive`（`无需参数`）不注入 `$ARGUMENTS`；代码块内含 `**输入**:` 的文本不在代码块内误注入；顶层中文 `**输入**：` 正确注入 `**Provided arguments**: $ARGUMENTS`
  - Spec Ref: template-single-source / Pi 与 OpenCode 指令适配器中英 Input 参数占位符注入与代码块隔离
  - Scenario Ref: 顶层中英文输入段落均正确注入参数占位符
  - Scenario Ref: 围栏代码块内的输入示例不触发误注入
  - Scenario Ref: 中英文无参声明与已有占位符跳过注入
  - Refs: template-single-source / Pi 与 OpenCode 指令适配器中英 Input 参数占位符注入与代码块隔离 / 顶层中英文输入段落均正确注入参数占位符

- [x] [代码] 2.2 为 `migration.ts`、`proposal-review.ts`、`spec-verify-proposal.ts` 补齐顶层 `**输入**：` 声明行（置于标题下、任何示例段之前）；`spec-explore.ts` 删除 `EXPLORATION_PROTOCOL_FULL`（仅落 `references/exploration-protocol.md`）中第 34 行冗余英文 `**Input**:` 行（**MUST NOT** 用 `CMD:SKIP` 包裹）；`spec-archive.ts` 将 `ARCHIVE-INDEX.md` 补充标注的标签白名单规则句移出 `CMD:SKIP` 区块以进入 Command 版（MUST NOT 仅平移标记）；`spec-propose.ts` 移除包裹 Step 0.2~0.7 的 `CMD:SKIP` 标记（保留探索文件扫描与迁移进入 Command 版） [N8][N9]
  - 依赖：2.1
  - 文件：`src/core/templates/workflows/migration.ts`、`src/core/templates/workflows/proposal-review.ts`、`src/core/templates/workflows/spec-verify-proposal.ts`、`src/core/templates/workflows/spec-explore.ts`、`src/core/templates/workflows/spec-archive.ts`、`src/core/templates/workflows/spec-propose.ts`
  - 验证：19 个有参内置指令在 Pi 与 OpenCode 下均注入 `**Provided arguments**: $ARGUMENTS`，1 个无参指令（`spec-bulk-archive`）不注入；`spec-explore` 指令版仍只有一份顶层 `Input`；`spec-archive` 指令版含标签白名单句；`spec-propose` 指令版含 Step 0.2~0.7；全部 `references[].content` 不含 `CMD:SKIP` 字面量
  - Spec Ref: template-single-source / 派生正文支持技能版与指令版差异
  - Scenario Ref: 仅技能版内容被安全裁剪
  - Scenario Ref: 关键防护语句与核心步骤在指令版保留
  - Refs: template-single-source / 派生正文支持技能版与指令版差异 / 关键防护语句与核心步骤在指令版保留

- [x] [测试][单元][P0] 2.3 为 D2 编写并扩展单元测试：验证 20 个指令在 Pi / OpenCode 下的 `$ARGUMENTS` 注入矩阵（19 注入 + 1 跳过）、围栏代码块隔离与非顶层示例段排除、无参跳过、`deriveCommandContent` 裁剪边界与异常标记 fail-safe，并断言全部 `references[].content` 不含 `CMD:SKIP` 字面量 [N8][N9][N10]
  - 依赖：2.1, 2.2
  - 文件：`test/generation.test.ts`、`test/template-derivation.test.ts`、`test/inject-args.test.ts`（共享注入实现的直接单测；原计划的 `test/templates.test.ts` 实际未改动，断言落在前两者）
  - 验证：`pnpm vitest run test/generation.test.ts test/template-derivation.test.ts test/inject-args.test.ts` 全部通过
  - Spec Ref: template-single-source / Pi 与 OpenCode 指令适配器中英 Input 参数占位符注入与代码块隔离
  - Scenario Ref: 顶层中英文输入段落均正确注入参数占位符
  - Scenario Ref: 围栏代码块内的输入示例不触发误注入
  - Scenario Ref: 中英文无参声明与已有占位符跳过注入
  - Scenario Ref: references 内容不承载 CMD:SKIP 标记
  - Spec Ref: template-single-source / 派生正文支持技能版与指令版差异
  - Scenario Ref: 仅技能版内容被安全裁剪
  - Scenario Ref: 关键防护语句与核心步骤在指令版保留
  - Scenario Ref: 异常裁剪标记按 fail-safe 处理
  - Refs: template-single-source / Pi 与 OpenCode 指令适配器中英 Input 参数占位符注入与代码块隔离 / 围栏代码块内的输入示例不触发误注入

## 3. 宿主原生编排、OpenCode V2 / Pi Agent 产物与权限/卸载修复（D3）

- [x] [代码] 3.1 修复 `src/core/opencode-v2.ts`：`collectShellPrefixes(allowedTools: readonly string[])`（签名不变，禁止改为 stage 列表；用非锚定的全局正则 `/Bash\(([a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)*):\*\)/g`）支持含空格子命令 `Bash(git <subcmd>:*)`（`isIagentRule` 沿用 `managedShellPrefixes.includes(resource)` 归属判定，不新增第二份前缀白名单）；`removeOpenCodeProjectArtifacts` 复用状态机 `stripJsonc(raw)` 替代破坏 `$schema` URL 的行注释正则；`renderWorkerPermissions(options)` 新增 `grantEdit` 入参（由 `writeOpenCodeProjectArtifacts` 以 `hasWriteEntry(stage.allowedTools)` 判定后透传），仅在其为真时授予 `action: edit`，并为所有阶段 worker 补充 `action: question`；`renderWorkerAgent` 对 `description` 执行 `normalizeHostSkillRefs` 与 `escapeYamlValue` 并注入加载 `.opencode/skills/iagent-<id>/SKILL.md` 的引导指令；`writeOpenCodeProjectArtifacts` 增加清理 `.opencode/agents/` 下 orphan `iagent-*.md` 的逻辑（保留 `iagent-orchestrator.md` 与非 `iagent-` 用户文件） [N13]
  - 文件：`src/core/opencode-v2.ts`、`src/cli/index.ts`（init / update 输出新增 `.opencode/agents/` orphan 清理上报项 —— 实现期合理 scope addition）
  - 验证：`collectShellPrefixes` 产出 `"git status "` 等多词前缀；含 `"$schema": "https://opencode.ai/config.json"` 的 `opencode.jsonc` 经 `removeOpenCodeProjectArtifacts` 正常清理；只读 worker 无 `action: edit` 且有 `action: question`；worker 正文含 `skill` 加载引导；缩小 `workflows` 时清理 orphan agent
  - Spec Ref: opencode-tool-adapter / OpenCode 权限翻译完整性
  - Scenario Ref: bash 规则按单/多词实际命令前缀派生
  - Scenario Ref: 只读与可写 worker 的 edit 及 question 最小权限边界
  - Scenario Ref: 含 schema URL 与注释的 opencode.jsonc 卸载清理
  - Spec Ref: opencode-tool-adapter / OpenCode V2 project agents
  - Scenario Ref: Worker returns bounded result and loads skill instructions
  - Scenario Ref: OpenCode orphan agent 清理与 reconcile 扫描
  - Refs: opencode-tool-adapter / OpenCode 权限翻译完整性 / 含 schema URL 与注释的 opencode.jsonc 卸载清理

- [x] [代码] 3.2 修复 `src/core/pi-native.ts`：`renderPiStageAgent` 对 `description` 先执行 `normalizeHostSkillRefs` 再调用 `escapeYamlValue`，并在阶段 agent 正文中注入启动时使用 `read` 工具读取 `.pi/skills/iagent-<id>/SKILL.md` 完整阶段规程的引导指令 [N12]
  - 文件：`src/core/pi-native.ts`
  - 验证：生成的 `.pi/agents/iagent-*.md` 的 `description` 不含 `iagent_` 下划线技能名，且正文含 `.pi/skills/iagent-<id>/SKILL.md` 读取引导
  - Spec Ref: host-orchestration / Pi native delegation entries
  - Scenario Ref: 生成编排器与阶段 agent 含技能规程读取引导与归一化描述
  - Refs: host-orchestration / Pi native delegation entries / 生成编排器与阶段 agent 含技能规程读取引导与归一化描述

- [x] [测试][单元][P0] 3.3 为 OpenCode V2 与 Pi 原生 Agent 产物编写并扩展单元测试：覆盖多词 `shell` 前缀、含 `$schema` URL 与注释的 `opencode.jsonc` 卸载、只读/可写 worker 的 `edit` 与 `question` 权限边界、worker `SKILL.md` 加载引导、`description` 转义与归一化、以及 `.opencode/agents/` 与 `.pi/agents/` orphan 清理 [N12][N13]
  - 依赖：3.1, 3.2
  - 文件：`test/opencode-v2.test.ts`、`test/pi-native.test.ts`
  - 验证：`pnpm vitest run test/opencode-v2.test.ts test/pi-native.test.ts` 全部通过
  - Spec Ref: opencode-tool-adapter / OpenCode V2 project agents
  - Scenario Ref: Orchestrator owns phase progression
  - Scenario Ref: Worker returns bounded result and loads skill instructions
  - Scenario Ref: OpenCode orphan agent 清理与 reconcile 扫描
  - Spec Ref: opencode-tool-adapter / OpenCode 权限翻译完整性
  - Scenario Ref: bash 规则按单/多词实际命令前缀派生
  - Scenario Ref: bash 资源语法未核实时不猜测
  - Scenario Ref: 只读与可写 worker 的 edit 及 question 最小权限边界
  - Scenario Ref: 含 schema URL 与注释的 opencode.jsonc 卸载清理
  - Scenario Ref: worker 获得其实际委派目标的 skill
  - Scenario Ref: 派发型 worker 获得 subagent
  - Scenario Ref: 无派发 worker 不获 subagent
  - Scenario Ref: MCP 缺口显式诊断
  - Scenario Ref: 权限规则幂等且不覆盖用户配置
  - Spec Ref: host-orchestration / Pi native delegation entries
  - Scenario Ref: 生成编排器与阶段 agent 含技能规程读取引导与归一化描述
  - Scenario Ref: 用户自建 agent 不被覆盖
  - Scenario Ref: frontmatter 契约与上游可解析
  - Scenario Ref: agent 定义为纯生成物
  - Scenario Ref: 生效集缩小后清理 orphan
  - Scenario Ref: gate 能力限定为阻塞回执形态
  - Refs: opencode-tool-adapter / OpenCode 权限翻译完整性 / 只读与可写 worker 的 edit 及 question 最小权限边界

## 4. Caller Updates（调用方与管线接线：init / update / generate / reconcile）

### Caller Updates

- [x] [代码] 4.1 更新 `src/commands/init.ts`、`src/commands/update.ts` 与 `src/commands/generate.ts`：对技能 `references` 同步执行 `rewriteCommandRefs`（`update.ts` 在 `SKILL.md` 手改跳过 `N6F` 时保留原 `references/` 不覆盖，可写入 `N6W` 时写出改写后的 `references/`）；在 `init.ts` 与 `update.ts` 的技能生成和指令生成两处向 `adaptSkillContentForHost` 显式传入基于 `activeSkillTemplates` 计算的 `orchestration`；保持 `CommandAdapterRegistry` 分流（`N7`）与 `mergePermissions` 会话级权限合并（`N11`）衔接 [N2][N3][N6][N6F][N6W][N7][N11]
  - 依赖：1.1, 1.2, 3.1, 3.2
  - 文件：`src/commands/init.ts`、`src/commands/update.ts`、`src/commands/generate.ts`
  - 验证：`init` / `update` 为 Pi、OpenCode、Codex 生成的 `references/*.md` 均完成指令引用改写与技能 ID 归一化；手改 `SKILL.md` 在 `update`（无 `--force`）下跳过且 `references/` 不被覆盖；裁剪 `workflows` 时 `adaptSkillContentForHost` 接收裁剪后的 `orchestration`
  - Spec Ref: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验
  - Scenario Ref: references 附加文件同步改写且遵循手改保护
  - Spec Ref: host-orchestration / 编排适配注入面按模板委派派生
  - Scenario Ref: init 与 update 透传生效集 orchestration
  - Refs: host-orchestration / 编排适配注入面按模板委派派生 / init 与 update 透传生效集 orchestration

- [x] [代码] 4.2 更新 `src/core/reconcile.ts`：`scanReconcileOrphans` 在扫描 `.pi/agents/` 之外，同步扫描 `.opencode/agents/` 下不在生效集的 `iagent-*.md`（排除 `iagent-orchestrator.md` 与用户自建文件）并纳入 `ReconcileOrphans.agents`（该字段语义扩展为「宿主原生 agent 定义（Pi + OpenCode）」，JSDoc 与计数注释同步更新） [N14]
  - 依赖：3.1
  - 文件：`src/core/reconcile.ts`
  - 验证：当 `.opencode/agents/` 存在不在生效 `workflows` 中的 `iagent-foo.md` 时，`scanReconcileOrphans` 将其识别为 orphan，而 `iagent-orchestrator.md` 与 `custom.md` 不被误报
  - Spec Ref: opencode-tool-adapter / OpenCode V2 project agents
  - Scenario Ref: OpenCode orphan agent 清理与 reconcile 扫描
  - Refs: opencode-tool-adapter / OpenCode V2 project agents / OpenCode orphan agent 清理与 reconcile 扫描

- [x] [测试][单元][P0] 4.3 为调用方管线与孤立产物扫描编写并扩展测试：验证 `init` / `update` 透传生效 `orchestration`、`references/*.md` 跨四宿主改写与 `skippedModified` 手改保护、`scanReconcileOrphans` 对 `.opencode/agents/` 的扫描，以及 `command-artifacts` 在 `codex` 新增 `commandsLayout: 'skills-only'` 后仍不产出/不识别指令（`commandFilePath('codex', …)` 仍抛 skills-only、`listManagedCommands` 仍为空） [N1][N2][N3][N6][N6F][N6W][N7][N11][N14]
  - 依赖：4.1, 4.2
  - 文件：`test/host-orchestration.test.ts`、`test/reconcile.test.ts`、`test/commands.test.ts`、`test/command-artifacts.test.ts`
  - 验证：`pnpm vitest run test/host-orchestration.test.ts test/reconcile.test.ts test/commands.test.ts test/command-artifacts.test.ts` 全部通过
  - Spec Ref: host-orchestration / 编排适配注入面按模板委派派生
  - Scenario Ref: 有委派即注入
  - Scenario Ref: 无委派不注入
  - Scenario Ref: init 与 update 透传生效集 orchestration
  - Scenario Ref: 委派清单携带参数
  - Scenario Ref: 可降级委派不被误报为必需缺口
  - Scenario Ref: 派生结果覆盖既有委派技能
  - Scenario Ref: 归档类无 Skill 委派面
  - Spec Ref: opencode-tool-adapter / OpenCode V2 project agents
  - Scenario Ref: OpenCode orphan agent 清理与 reconcile 扫描
  - Spec Ref: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验
  - Scenario Ref: references 附加文件同步改写且遵循手改保护
  - Refs: opencode-tool-adapter / OpenCode V2 project agents / OpenCode orphan agent 清理与 reconcile 扫描

## 5. 构建、技能快照同步与全量回归验证

- [x] [代码] 5.1 执行 `pnpm build && pnpm generate:skills` 重新生成 `skills/` 静态快照，确保全部 20 个技能快照及 `references/*.md` 完成 `iagent_` → `iagent-` 归一化、消除硬编码 `.claude/skills/` 路径，并体现 `spec-explore` 参考文件删除冗余英文 `Input` 行（`metadata.version` 从不进入产物，SKILL.md frontmatter 字节不变） [N5][N6W]
  - 依赖：1.3, 2.2, 4.1
  - 文件：`skills/**`
  - 验证：`git diff skills/` 反映模板与归一化修复，`pnpm vitest run test/skills-parity.test.ts test/skill-size-budget.test.ts test/template-language.test.ts` 全部通过
  - Spec Ref: template-generation / 技能与参考文件宿主技能 ID 统一归一化及宿主路径去耦合
  - Scenario Ref: generateSkillContent 全字段与 references 统一归一化
  - Scenario Ref: 模板正文与 references 无硬编码宿主路径及专属工具名
  - Refs: template-generation / 技能与参考文件宿主技能 ID 统一归一化及宿主路径去耦合 / 模板正文与 references 无硬编码宿主路径及专属工具名

- [x] [测试][功能][P0] 5.2 运行全量构建、代码检查与测试套件（`pnpm build && pnpm lint && pnpm test`），验证四宿主技能、指令、原生 Agent、权限配置与快照一致性零回归 [N1][N2][N3][N4][N5][N6][N6F][N6W][N7][N8][N9][N10][N11][N12][N13][N14]
  - 依赖：1.4, 2.3, 3.3, 4.3, 5.1
  - 文件：`test/**`
  - 验证：`pnpm build && pnpm lint && pnpm test` 退出码均为 0
  - Spec Ref: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验
  - Scenario Ref: Codex skills-only 布局改写与 undefined 向后兼容
  - Spec Ref: template-single-source / Pi 与 OpenCode 指令适配器中英 Input 参数占位符注入与代码块隔离
  - Scenario Ref: 顶层中英文输入段落均正确注入参数占位符
  - Spec Ref: opencode-tool-adapter / OpenCode 权限翻译完整性
  - Scenario Ref: 含 schema URL 与注释的 opencode.jsonc 卸载清理
  - Refs: template-generation / 模板正文指令引用 SHALL 单一源并可生成期校验 / Codex skills-only 布局改写与 undefined 向后兼容

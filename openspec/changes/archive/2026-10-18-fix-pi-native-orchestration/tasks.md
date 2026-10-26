# Tasks: fix-pi-native-orchestration

## 1. Pi 原生 agent 定义

- [x] 1.1 [代码] 新增 `src/core/pi-native.ts`：渲染 orchestrator 与阶段 agent 定义，并写入 `.pi/agents/iagent-*.md`；只处理 `iagent-` 前缀。
  - 文件：`src/core/pi-native.ts`
  - 验证：生成文件 frontmatter `name` 等于 `subagent_type`，用户自建 agent 不受影响
  - Spec Ref：`host-orchestration / Pi native delegation entries`
  - Scenario Ref：生成编排器与阶段 agent
  - Scenario Ref：用户自建 agent 不被覆盖

- [x] 1.2 [代码] 在 `init` / `update` 中按 D6 顺序接线：解析生效 workflow 与所需 agent 集 → 检测 runtime（`init` 缺失时安装并复检，`update` 仅检测）→ 写入 agent 定义 → 重算 strict/degraded → 生成技能与指令 → 写诊断元数据。
  - 文件：`src/commands/init.ts`、`src/commands/update.ts`
  - 验证：首次 init 即可得到 strict（或真实 degraded），不会因判定早于落盘而误判
  - Spec Ref：`host-orchestration / Pi native delegation entries`
  - Scenario Ref：生成编排器与阶段 agent

- [x] 1.3 [代码] 固定 Pi agent 的 frontmatter 契约：`tools` 只写小写内置名（read/write/edit/bash/grep/find/ls），嵌套派发由 `allowed_subagents` 授予（不写 `Agent` / `get_subagent_result`），`prompt_mode: append`，orchestrator 的 `allowed_subagents` 枚举阶段 agent。
  - 文件：`src/core/pi-native.ts`
  - 验证：生成结果字段与 D7/D10 一致；阶段 agent 不含 `allowed_subagents`
  - Spec Ref：`host-orchestration / Pi native delegation entries`
  - Scenario Ref：frontmatter 契约与上游可解析
  - Scenario Ref：生成编排器与阶段 agent

- [x] 1.4 [测试][单元][P0] 覆盖 agent 生成路径、frontmatter 契约、幂等与用户文件保留。
  - 文件：`test/pi-native.test.ts`
  - 验证：断言 name/description、`tools` 不含任何非内置名、`iagent-` 前缀边界、二次执行无变化（纯生成物重建）
  - Scenario Ref：生成编排器与阶段 agent
  - Scenario Ref：frontmatter 契约与上游可解析
  - Scenario Ref：用户自建 agent 不被覆盖
  - Scenario Ref：agent 定义为纯生成物

## 2. strict 判定与诊断

- [x] 2.1 [代码] `pi-runtime.ts` 实现 D8 可解析判定（存在 ∧ frontmatter 可解析 ∧ name/文件名匹配），缺失时降级并暴露四类缺失项。
  - 文件：`src/core/pi-runtime.ts`
  - 验证：包已安装但定义缺失/写坏 → `degraded`；三项齐备 → `strict`
  - Spec Ref：`ai-tool-selection / Pi strict runtime detection`
  - Scenario Ref：Compatible runtime is installed
  - Scenario Ref：Runtime installed but native entries missing

- [x] 2.2 [代码] 诊断元数据写入原生入口状态与缺失项名称，区分「缺包 / 版本不兼容 / 缺定义 / 定义不可解析」。
  - 文件：`src/core/pi-runtime.ts`、`src/commands/init.ts`、`src/commands/update.ts`
  - 验证：`.iagent/pi-runtime.json` 含缺失定义字段且与 `orchestration` 一致
  - Spec Ref：`ai-tool-selection / Pi runtime diagnostics include native entry status`
  - Scenario Ref：诊断可区分缺包与缺定义

- [x] 2.3 [测试][单元][P0] strict 判定矩阵：版本/包/定义三条件组合，覆盖四类缺失项。
  - 文件：`test/pi-runtime.test.ts`
  - 验证：仅三条件全满足为 strict；四类缺失分别产出对应诊断码
  - Scenario Ref：Runtime installed but native entries missing
  - Scenario Ref：Compatible runtime is installed

- [x] 2.4 [代码] 更新既有 strict 断言：原先“装了包即 strict”的用例改为携带 agent 定义，避免与新判定冲突。
  - 文件：`test/pi-runtime.test.ts`、`test/commands.test.ts`、`test/host-smoke.test.ts`
  - 验证：全量测试无旧语义残留断言
  - Spec Ref：`ai-tool-selection / Pi strict runtime detection`

- [x] 2.5 [测试][功能][P1] 宿主能力协商回归：strict 可执行、缺能力阻断、Pi 定义不可解析时降级。
  - 文件：`test/host-orchestration.test.ts`
  - 验证：三种场景分别断言 strict / 阻断并报告 / degraded 报告缺失定义
  - Spec Ref：`host-orchestration / Host capability negotiation`
  - Scenario Ref：Strict host is capable
  - Scenario Ref：Strict host is missing a capability
  - Scenario Ref：Pi runtime present but entries unresolvable

## 3. Pi 设置与刷新语义

- [x] 3.1 [代码] `AI_TOOLS` 的 `pi` 设 `sessionPermissions: false`，不再写 `.pi/settings.json` 的 `permissions.allow`。
  - 文件：`src/core/config.ts`
  - 验证：`--tools pi` 后不生成权限段；Claude 行为不变
  - Spec Ref：`ai-tool-selection / Pi session permissions carrier not applicable`
  - Scenario Ref：Pi settings 不含 Claude 权限段
  - Scenario Ref：Claude 权限载体行为不变

- [x] 3.2 [代码] init 跳过既有产物时输出刷新提示；README/AGENTS 明确 `update` 刷新语义，以及 `.pi/agents` 的删除/清理语义与技能产物的提示语义差异。
  - 文件：`src/commands/init.ts`、`README.md`、`AGENTS.md`
  - 验证：跳过提示含 `iagent update`；文档步骤可复现
  - Spec Ref：`host-orchestration / Upgrade refresh semantics`
  - Scenario Ref：init 跳过既有产物

- [x] 3.3 [测试][单元][P0] 覆盖 Pi settings 不写权限段、init 跳过提示、update 刷新。
  - 文件：`test/commands.test.ts`、`test/pi-native.test.ts`
  - 验证：断言 settings 无 `permissions`、提示文本存在、update 覆盖旧指纹自洽产物
  - Scenario Ref：Pi settings 不含 Claude 权限段
  - Scenario Ref：update 刷新未手改产物

- [x] 3.4 [测试][单元][P1] 覆盖无指纹历史产物的刷新路径（`generatedBy` 低于当前版本即可覆盖）。
  - 文件：`test/validate-update.test.ts`
  - 验证：删除 `generatedFingerprint` 后 update 仍覆盖，无需 `--force`
  - Scenario Ref：无指纹的历史产物可刷新

- [x] 3.5 [测试][功能][P1] 覆盖 runtime 缺失时的尝试安装与输出动作（不阻断后续产物）。
  - 文件：`test/commands.test.ts`
  - 验证：缺失包时输出安装动作与目标包，且生成 degraded 产物
  - Scenario Ref：Runtime is missing

## 4. 委派可执行化与描述一致性

- [x] 4.1 [代码] Pi 委派渲染改为可执行 `Agent({ subagent_type, prompt })` 形态，`subagent_type` 与生成定义一致。
  - 文件：`src/core/host-orchestration/actions.ts`
  - 验证：strict 产物含可解析类型名；degraded 仍标记“不构成委派”
  - Spec Ref：`workflow-suite-skills / Pi delegation renders executable agent invocation`
  - Scenario Ref：strict 产物含可执行委派
  - Scenario Ref：degraded 明确不构成委派

- [x] 4.2 [代码] 修正编排指令 description 的“内联生成”过期表述（逐模板核对实际命中文件）。
  - 文件：`src/core/templates/workflows/`（按实际命中修正）
  - 验证：description 与正文委派语义一致
  - Spec Ref：`workflow-suite-skills / Command descriptions reflect delegation`
  - Scenario Ref：工作流指令描述一致

- [x] 4.3 [测试][单元][P1] 覆盖委派渲染与 description 一致性扫描。
  - 文件：`test/host-orchestration.test.ts`、`test/template-consistency.test.ts`
  - 验证：断言 `Agent({` 形态、类型名匹配、无“提案内联生成”矛盾
  - Scenario Ref：strict 产物含可执行委派
  - Scenario Ref：工作流指令描述一致

- [x] 4.4 [测试][功能][P1] 三宿主探索委派回归：Skill / V2 subagent / Pi `Agent({subagent_type})`，并断言 handoff 消费、非内联、阶段主权归编排器。
  - 文件：`test/host-smoke.test.ts`、`test/host-orchestration.test.ts`
  - 验证：三宿主各自的委派形态成立，degraded 不声称委派
  - Spec Ref：`workflow-suite-skills / workflow 探索阶段委派 spec-explore`
  - Scenario Ref：Claude Code realization
  - Scenario Ref：OpenCode V2 realization
  - Scenario Ref：Pi realization
  - Scenario Ref：探索阶段委派而非内联
  - Scenario Ref：消费结构化 handoff
  - Scenario Ref：探索阶段阶段主权归编排器

## 5. 生命周期、文档与整体验证

- [x] 5.1 [代码] `.pi/agents/` 纳入 uninstall 与 reconcile：只删除 `iagent-` 前缀定义，不触碰用户自建 agent；生效集缩小时清理 orphan，并同步 `ReconcileOrphans` 接口、`reconcileOrphanCount` 与 init/update 输出。
  - 文件：`src/commands/uninstall.ts`、`src/core/reconcile.ts`、`src/commands/init.ts`、`src/commands/update.ts`
  - 验证：uninstall 后无 iagent agent 残留；orphan 被清理并计入输出；用户文件保留
  - Spec Ref：`host-orchestration / Pi native delegation entries`
  - Scenario Ref：用户自建 agent 不被覆盖
  - Scenario Ref：生效集缩小后清理 orphan

- [x] 5.2 [测试][单元][P0] 覆盖 uninstall/reconcile 对 Pi agent 定义的处理边界。
  - 文件：`test/uninstall-show.test.ts`、`test/pi-native.test.ts`
  - 验证：仅删 `iagent-` 前缀；非前缀文件与目录保留；清理计数与输出一致；Windows 路径断言经 `replaceAll('\\','/')` 归一化，文件按 UTF-8 读写
  - Scenario Ref：用户自建 agent 不被覆盖
  - Scenario Ref：生效集缩小后清理 orphan

- [x] 5.3 [使用说明] 更新 Pi 排障文档：strict 三条件、`.pi/agents/` 说明、升级用 `update`。
  - 产出: `attachments/pi-orchestration-notes.md`
  - 验证：文档命令与生成行为一致

- [x] 5.4 [测试][功能][P0] 跨宿主冒烟更新：Pi strict 含可执行委派、degraded 不伪装。
  - 文件：`test/host-smoke.test.ts`
  - 验证：strict/degraded 两态断言通过
  - Scenario Ref：strict 产物含可执行委派
  - Scenario Ref：degraded 明确不构成委派

- [x] 5.5 [代码] 重新生成 `skills/` 快照并同步版本与 CHANGELOG（功能新增，minor → 7.1.0）。
  - 文件：`skills/`、`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：`pnpm build && pnpm generate:skills && pnpm lint && pnpm test` 全绿

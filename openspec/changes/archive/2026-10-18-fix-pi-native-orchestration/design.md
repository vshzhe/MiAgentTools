## Context

现有 `src/core/pi-runtime.ts` 只检测 Pi 版本、npm 包安装与冲突；`strict` 判定未涉及原生委派入口（`pi-runtime.ts` 仅以包存在为条件）。`@tintinweb/pi-subagents` 的 `Agent` 工具按 `subagent_type` 查找 `.pi/agents/<name>.md`（内置类型除外），当前 `iagent init/update` 从不生成该目录，因此正文里的“委派 iagent-spec-explore”无法解析。另：`AI_TOOLS` 中 `pi` 的 `sessionPermissions` 未关闭，`mergePermissions` 会把 Claude 风格 `permissions.allow` 写入 `.pi/settings.json`；`iagent init` 对既有产物跳过，升级后不刷新；`workflow.ts` 的指令 description 仍写“提案内联生成”。

## Goals / Non-Goals

**Goals**:
- 生成可被 `@tintinweb/pi-subagents` 解析的 Pi agent 定义，使阶段委派可执行。
- strict 判定纳入原生入口可解析性，缺定义即 degraded 并给出缺失项。
- 停止向 Pi 写 Claude 权限段；补升级刷新提示；修正指令 description 过期表述。

**Non-Goals**:
- 不改变 `.pi/skills` / `.pi/prompts` 布局。
- 不实现 iagent 自有 Pi 运行时包（provider 抽象已具备）。
- 不改变 `init` 跳过既有产物的既有行为（仅补提示）。
- 不清理既有 `.pi/settings.json` 中历史遗留的 `permissions.allow`（仅停止写入）。

## Decisions

### D1: 新增 `.pi/agents/` 生成而非改写 pi-subagents
- **选择**: 生成 `iagent-orchestrator.md` 与 `iagent-<workflowId>.md`，`name` 即 `subagent_type`。
- **理由**: 复用上游扩展的既有调度/回执能力，避免自建运行时；定义文件是上游公开契约。
- **备选**: 自研 Extension（成本高、与 provider 抽象重复）；仅写自然语言（已验证不可执行）。

### D2: strict 三条件判定
- **选择**: `Pi 版本兼容 && 运行时包已安装 && 所需 agent 定义可解析` 才 strict。
- **理由**: 前两者只证明“扩展存在”，第三者才证明“委派可解析”。
- **备选**: 仅看包安装（现状，产生名义 strict）。

### D3: Pi agent 定义的最小 frontmatter
- **选择**: `name` / `description` / `tools`，可选 `model`、`thinking`、`prompt_mode`、`allowed_subagents`。
- **理由**: `name` 是调度标识，`tools` 限定能力面；其余按上游可选字段。
- **备选**: 只写 `name` + body（`tools` 缺省为全部，授权面过大）。

### D4: Pi 不写 Claude 权限载体
- **选择**: `pi.sessionPermissions = false`。
- **理由**: Pi 不读取 `permissions.allow`，该文件段是惰性且误导的。
- **备选**: 改写为 Pi `defaultTools`（会覆盖用户选择，风险更高）。

### D5: 升级刷新语义只补提示
- **选择**: 保持 `init` 跳过既有产物，输出提示 `iagent update`；文档同步。
- **理由**: 改变 init 覆盖语义会破坏用户手改保护契约。
- **备选**: init 默认覆盖（破坏手改保护，否决）。

### D6: 生成顺序（先定义、后判 strict）
- **选择**: `init` 顺序为：解析生效 workflow 与所需 agent 集 → 检测 runtime（缺失时安装并复检）→ 写入 `.pi/agents/` → 以「定义已落盘」重算 strict/degraded → 按该状态生成技能与指令 → 写 `.iagent/pi-runtime.json`。`update` 只检测不安装（与既有契约一致），其余顺序相同。
- **理由**: 若先判 strict 再生成定义，首次 init 永远先拿到 degraded，产物会退回本地执行文案；顺序颠倒会让一次 init 产生自相矛盾结果。
- **备选**: 先判 strict，生成后再补写一次产物（双趟写盘、易漏）；把“将要生成”当作已具备（虚构能力，禁止）；update 也安装（超出既有契约）。

### D7: Pi tools 词表与 agent 分工
- **选择**: `tools` 只写上游内置名（`read` / `write` / `edit` / `bash` / `grep` / `find` / `ls`）；编排器的嵌套派发能力由 `allowed_subagents` 枚举阶段 agent 授予（上游 `nested-tools.ts` 据此注入 `Agent` / `get_subagent_result` / `steer_subagent`）；`prompt_mode: append`（继承项目 `AGENTS.md` 约定）；阶段 agent 不设 `allowed_subagents`。
- **理由**: 上游 `tools` 的 plain 项只按内置名解析，写入扩展工具名会在每次 spawn 触发 `tools-error`；嵌套工具由 `allowed_subagents` 控制才是正确契约。
- **备选**: 在 `tools` 写 `Agent` / `get_subagent_result`（触发 tools-error）；`prompt_mode: replace`（丢失项目约定）。

### D8: “可解析”的判定口径
- **选择**: 文件存在 ∧ frontmatter 可解析 ∧（`name` 或文件名去扩展名）等于期望 `subagent_type`。诊断区分四类：`runtime-missing`、`runtime-incompatible`、`entry-missing`、`entry-invalid`。
- **理由**: 仅判文件存在会把写坏的 frontmatter 当成就绪；四类缺失项让用户能直接定位补救动作。
- **备选**: 只判存在（假阳性）；实际调用一次 Agent 探测（有副作用，且 init 不应触发模型调用）。

### D9: 产物生命周期与版本
- **选择**: Pi agent 定义纳入 uninstall / reconcile 的 `iagent-` 前缀清理；本次为功能新增，版本按 minor 递增（7.1.0）。
- **理由**: 新增产物若不纳入清理会残留；新增能力按版本规则取 minor。
- **备选**: 只在 init 写入、不清理（卸载后残留）。
- **清理语义**: 对 `.pi/agents` 采用**删除**语义（区别于技能/指令的“保留并提示”），因其为纯生成物；`iagent init` 仅清理不再属于生效集的 `iagent-` 生成物，不触碰其它产物。

### D10: 编排器入口模型
- **选择**: `/iagent-*` 在 Pi 主会话展开，主会话本身即编排者；同时生成 `.pi/agents/iagent-orchestrator.md` 作为可显式进入/被其它 agent 调用的入口，其 `allowed_subagents` 必须枚举阶段 agent。阶段 agent 与 orchestrator 共用同一份阶段定义，避免两套语义。
- **理由**: 两条路径（主会话直接派发、显式进入 orchestrator）都能用同一组 `subagent_type`；不选边会导致实现时不知道 `allowed_subagents` 是否必需。
- **备选**: 只支持主会话派发（orchestrator 文件无消费方，删除生成）；只支持显式进入（要求用户额外一步，体验退化）。

### D11: agent 定义为纯生成物与平台边界
- **选择**: `.pi/agents/iagent-*.md` 视为纯生成物，每轮按最新模板重建，不写入 `generatedFingerprint` 手改保护；清理只认 `iagent-` 前缀。路径统一走 `path.join('.pi','agents')`，测试断言按 `replaceAll('\\','/')` 归一化并以 UTF-8 读写。
- **理由**: agent 定义由模板与生效集共同决定，保留用户改动会与 `.pi/skills` 的委派契约漂移；与 `.opencode/agents` 的先例一致。
- **备选**: 给 agent 定义加手改保护（用户改坏后 strict 判定与模板长期不一致）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 上游 `pi-subagents` 的 agent frontmatter 字段变化 | 只使用最小稳定字段（name/description/tools），其余可选；生成前检测包版本 |
| 生成过多 agent 造成噪音 | 仅为生效集内的编排 workflow 与其委派目标生成 |
| strict 收紧后现有用户被降级 | 诊断明确列出缺失定义，并提供 `iagent update` 一键补齐 |
| 用户自建 agent 被误删 | 只处理 `iagent-` 前缀，uninstall/reconcile 同规则 |
| 刷新依赖用户手动 update | init 输出显式提示，README/AGENTS 说明升级步骤 |
| 首次 init 因顺序问题误判 degraded | D6 固定「先落盘定义、后判 strict」顺序，并加回归断言 |

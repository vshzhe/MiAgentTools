# Tasks: fix-mode-delegation-host-parity

> 节点标识（`[N#]`）对应探索文件 `## 功能流程图` 的 N1-N31；改动点 `M1-M6` 见 `proposal.md`。
> 任务标签：`[代码]` / `[测试][单元|功能][P0|P1|P2]` / `[使用说明]`。
> 执行顺序即依赖顺序；标记「依赖」的任务须在其前置任务完成后执行。

## 1. 委托模式词汇单一源与模板正文（M2）

- [x] [代码] 1.1 新建 `src/core/host-orchestration/delegation-contract.ts`：`DelegationMode`、`GateSkipId`、`DELEGATION_MODES`、`GATE_SKIP_IDS`、`LEGACY_AUTO_MODE_PARAM`、`DelegationContract`、`resolveDelegationContract()`、`renderDelegationModeContract()`、`renderGateSkipOption()`；未知 gate id 记 WARN 并忽略 [N1][N16]
  - 文件：`src/core/host-orchestration/delegation-contract.ts`
  - 验证：模块为叶依赖（不导入 templates / registry），`tsc` 通过；`resolveDelegationContract({ 'auto-mode': 'true' })` 返回 `gateSkips=['design-confirmation']` 且 `mode` 保持调用方原值；仅 `mode` / `gate-skip` 为可解析键，`gate-policy=` 等未知键被忽略并记 WARN（MUST NOT 映射为门跳过）
  - Spec Ref: spec-workflow-skills / 委托模式双轴词汇单一源
  - Scenario Ref: 模板词汇由常量产出

- [x] [测试][单元][P0] 1.2 为 `delegation-contract` 编写单元测试：两轴正交、`auto-mode` 仅映射门承载轴、未知 gate id 不被静默接受 [N16]
  - 文件：`test/delegation-contract.test.ts`
  - 验证：`mode=delegated` 单独传入时不产生 gateSkips；`auto-mode=true` 不产生 delegated 的停点抑制标志；`gate-skip=unknown` 被拒绝或忽略并记 WARN
  - Spec Ref: spec-workflow-skills / 委托模式双轴词汇单一源
  - Scenario Ref: auto-mode 仅映射门承载轴
  - Scenario Ref: 两个轴不可互换
  - Scenario Ref: 未知 gate id 不被静默接受

- [x] [代码] 1.3 模板正文改为插值引用双轴词汇：`spec-propose`（更正 auto-mode 别名声明）、`spec-apply`（接受 `gate-skip=design-confirmation`，保留 auto-mode 兼容写法）、`spec-explore`（`**Input**` 增 `mode` 与回执字段）、`workflow` 与 `auto-workflow`（委派 apply 改传 `gate-skip=design-confirmation`）[N1][N16][N18]
  - 文件：`src/core/templates/workflows/spec-propose.ts`、`src/core/templates/workflows/spec-apply.ts`、`src/core/templates/workflows/spec-explore.ts`、`src/core/templates/workflows/workflow.ts`、`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文出现 `gate-skip=design-confirmation` 与「`auto-mode` 仅为门承载轴兼容写法」说明；`spec-propose` 不再声称两者等价；`spec-explore` 的 `**Input**` 含 `mode=interactive|delegated`；技能版新增的仅技能可读段落须用成对 `<!-- CMD:SKIP -->` 标记（AGENTS.md 修改守则 7），指令派生版不得出现半截段落
  - Spec Ref: spec-workflow-skills / spec-propose 委派执行模式（delegated）契约
  - Scenario Ref: auto-mode 不被声明为 delegated 的等价别名
  - Scenario Ref: Input 段声明模式契约
  - Scenario Ref: 词汇与宿主原生 mode 字段区分
  - Scenario Ref: gate-skip 跳过设计确认门
  - Scenario Ref: auto-mode 兼容写法行为一致
  - Spec Ref: workflow-suite-skills / workflow 实现桥承载 apply 设计门
  - Scenario Ref: workflow 以门承载参数委派 apply
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref: Phase 4 委派而非内联
  - Scenario Ref: Phase 5 委派而非内联

- [x] [测试][单元][P0] 1.4 模板文本与语义回归断言：`gate-skip` 只跳设计门、其余门与停点不被豁免、`delegated` 与 `auto-mode` 不可互换、被委派技能 Input 契约齐备 [N1][N19][N20]
  - 文件：`test/template-derivation.test.ts`（新增用例）；如需独立承载可新建 `test/spec-workflow-contract.test.ts`（仓库当前无此文件，须显式标注为新建）
  - 验证：断言模板正文含两轴说明与「其余门照常生效」语句；断言 auto-mode 不抑制停点；断言实现桥缺失时门仍阻塞
  - Spec Ref: spec-workflow-skills / spec-apply 门承载参数契约
  - Scenario Ref: 其余门与停点不被豁免
  - Spec Ref: spec-workflow-skills / spec-explore 委派执行模式（delegated）契约
  - Scenario Ref: interactive 保持立场式不变
  - Scenario Ref: delegated 强制 checkpoint 体系
  - Scenario Ref: delegated 的 L1-L5 追问门逐级等待
  - Scenario Ref: delegated 的聚合一致性门拦截硬冲突
  - Scenario Ref: delegated 产出结构化 handoff 并交回主权
  - Scenario Ref: delegated 不跳过确认门
  - Scenario Ref: 探索文件缺失时 handoff 报告异常
  - Scenario Ref: interactive 默认行为不变
  - Scenario Ref: delegated 模式跳过 Step 0 用户提示
  - Scenario Ref: delegated 模式抑制自身 Phase 3
  - Scenario Ref: delegated 模式抑制结尾停点
  - Scenario Ref: delegated 不改变确认门
  - Spec Ref: workflow-suite-skills / workflow 实现桥承载 apply 设计门
  - Scenario Ref: 实现桥缺失时门仍生效
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref: 测试执行门继承
  - Scenario Ref: Failure remains blocking

## 2. 白名单 canonical 化与回归锁（M1）

- [x] [代码] 2.1 `skillDelegation()` 改为 canonical 派生：入参裸名（`spec_apply` / `spec-apply` 等价）→ 输出 `Skill(iagent-<workflowId>)`；更新函数文档注释，MUST NOT 双写裸名、MUST NOT 通配 [N2][N3]
  - 文件：`src/core/templates/tool-whitelist.ts`
  - 验证：`skillDelegation(['spec_apply'])` 返回 `Skill(iagent-spec-apply)`；`skillDelegation(['spec-apply'])` 返回一致；含 `*` 入参抛错
  - Spec Ref: tool-call-whitelist / 技能间委派条目逐技能枚举
  - Scenario Ref: 编排技能委派多子技能
  - Scenario Ref: 不使用通配条目
  - Scenario Ref: 入参写法不影响输出形态

- [x] [代码] 2.2 同步白名单文档与派生说明：`tool-whitelist.ts` 头注释、`AGENTS.md` 修改守则中的技能委派条目形态、`openspec/CONTEXT.md` 的「工具调用白名单」术语 [N2]
  - 文件：`AGENTS.md`、`openspec/CONTEXT.md`
  - 验证：文档中技能委派条目示例均为 `Skill(iagent-<workflowId>)`，不再出现「裸名才是真实条目」的表述
  - Spec Ref: tool-call-whitelist / 白名单形态的回归锁与文档同步
  - Scenario Ref: 文档与守则同步 canonical 形态

- [x] [代码] 2.3 同步既有回归锁：`Skill(...)` 解析正则容纳 kebab、注册校验改对照 `iagent-<workflowId>`、相关断言与注释更新 [N30]
  - 文件：`test/allowed-tools.test.ts`、`test/command-reference-refs.test.ts`、`test/template-consistency.test.ts`、`test/tool-whitelist-constants.test.ts`、`test/host-orchestration.test.ts`、`test/artifact-dataflow.test.ts`、`test/project-init-scan.test.ts`
  - 验证：正则能匹配 `Skill(iagent-spec-apply)`；对 `Skill(spec_apply)` 形态断言失败；比较 DEPS / conditional 表前须先剥离 `iagent-` 前缀得到 workflowId（`CONDITIONAL_DELEGATIONS` 与 `resolveWorkflows` 均以 canonical workflowId 为键）；`pnpm test` 中白名单相关用例全绿
  - Spec Ref: tool-call-whitelist / 白名单形态的回归锁与文档同步
  - Scenario Ref: 回归锁容纳 canonical 形态
  - Spec Ref: tool-call-whitelist / 技能间委派条目逐技能枚举
  - Scenario Ref: 不产出裸名条目
  - Spec Ref: tool-call-whitelist / 调用类白名单条目 SHALL 经共享常量构造
  - Scenario Ref: 编排技能白名单经共享常量构造
  - Scenario Ref: CodeGraph CLI 条目由常量产出
  - Scenario Ref: 常量变更自动跟随
  - Scenario Ref: 授权面不因来源统一而扩大
  - Spec Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备
  - Scenario Ref: 最小权限保持

- [x] [测试][单元][P0] 2.4 全量白名单断言：归档 / debug / 委派技能条目均 canonical、嵌套委派不使外层虚增、未使用条目被剔除 [N2][N30]
  - 文件：`test/allowed-tools.test.ts`
  - 验证：`spec-archive` / `spec-bulk-archive` 含 `Skill(iagent-requirement-doc)`；`workflow` 含且仅含 1 条 `Skill(iagent-requirement-doc)`（Phase 3 文档桥真实委派），嵌套链路不新增；`debug` 含 `Skill(iagent-test)`
  - Spec Ref: tool-call-whitelist / 归档技能的需求文档委派条目
  - Scenario Ref: spec-archive 具备需求文档委派条目
  - Scenario Ref: spec-bulk-archive 具备需求文档委派条目
  - Scenario Ref: 指令侧白名单同步派生
  - Scenario Ref: 嵌套委派不使外层白名单虚增
  - Scenario Ref: 未使用条目被剔除
  - Spec Ref: tool-call-whitelist / debug 文档与回归测试委派授权齐备
  - Scenario Ref: debug 正文真实委派获得精确条目
  - Scenario Ref: debug 授权与宿主委派表一致

## 3. 宿主编排渲染与能力协商（M2/M3/M4）

- [x] [代码] 3.1 `hosts.ts` 增 `SurfaceId` / `SURFACE_IDS` 与 `surface` 参数：headless 移除 `gate` 并写 notes；`negotiationForHost` 接受可选 surface [N26]
  - 文件：`src/core/host-orchestration/hosts.ts`、`src/core/host-orchestration/index.ts`
  - 验证：`negotiateCapabilities('claude','strict',{surface:'headless'})` 的 `missing` 含 `gate`；交互表面结果不含 `gate` 缺失；第三个形参接受「能力数组 **或** 选项对象」联合，`test/host-orchestration.test.ts` 既有位置化调用（`negotiateCapabilities('pi','strict',['skill-load','argument-passing'])` 等 18 处）无需修改即通过；`SurfaceId` / `SURFACE_IDS` 经 `index.ts` 导出；生成期 `init` / `update` 以缺省 `interactive-cli` 协商（本期不新增 CLI 标志），headless 由运行期调用方传入（design D13）
  - Spec Ref: host-orchestration / 运行表面（surface）能力协商
  - Scenario Ref: headless 不声称可交互 gate
  - Scenario Ref: 同一宿主不同表面的协商结果可见

- [x] [代码] 3.2 Codex 显式 degraded：`HostId` 增 `codex`、`HOST_PROFILES.codex`、`negotiationForHost('codex')` 返回协商结果、`renderDelegate` 输出本地执行且不构成委派、`init` / `update` 输出 codex 诊断 [N9][N29]
  - 文件：`src/core/host-orchestration/hosts.ts`、`src/core/host-orchestration/actions.ts`、`src/commands/init.ts`、`src/commands/update.ts`
  - 验证：`negotiationForHost('codex')` 非空且 `mode='degraded'`；codex 产物含「不构成委派」；init/update 输出含 codex degraded 结论
  - Spec Ref: host-orchestration / Codex skills-only 显式 degraded 档案
  - Scenario Ref: codex 协商返回 degraded 且不返回 null
  - Scenario Ref: codex 产物显式声明本地执行不构成委派
  - Scenario Ref: init 与 update 报告 codex 诊断
  - Scenario Ref: Codex 映射声明本地执行
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议
  - Scenario Ref: Codex 自动管线显式本地执行

- [x] [代码] 3.3 注入面改派生：新增 `deriveOrchestrationDelegations(templates)`，替换 `ORCHESTRATING_WORKFLOW_IDS` / `ORCHESTRATION_DELEGATIONS` 硬编码清单；新增显式参数表 `DELEGATION_PARAMETERS`（仅声明参数，目标仍派生）；`renderDelegationList` 渲染参数；`adaptSkillContentForHost` / `renderHostOrchestrationSection` 增可选 `orchestration` 形参；`CONDITIONAL_DELEGATIONS` 补 `project-init: ['feature-doc']`；`pi-native` / `opencode-v2` / `init` / `update` 接入同一派生结果 [N4][N22]
  - 文件：`src/core/host-orchestration/render.ts`、`src/core/host-orchestration/actions.ts`、`src/core/pi-native.ts`、`src/commands/init.ts`、`src/commands/update.ts`、`src/core/host-orchestration/index.ts`
  - 验证：含 `Skill(...)` 的技能注入适配段，不含者不注入；委派清单条目携带 `mode` / `gate-skip` 且取值来自 `DELEGATION_PARAMETERS`（MUST NOT 由白名单推断）；派生结果覆盖既有 9 个委派技能（`auto-workflow` / `debug` / `migration` / `project-init` / `spec-apply` / `spec-archive` / `spec-bulk-archive` / `spec-propose` / `workflow`）；默认安装集（含 `project-init`、不含 `feature-doc`）下 Pi 不产生 `project-init` 的无条件必需缺口告警；`deriveOrchestrationDelegations` 经 `index.ts` 导出；`resolvePiNestingDelegations` 的派生结果经可选形参注入（缺省内部按 `getSkillTemplates()` 派生），既有 2 参单元调用保持通过
  - Spec Ref: host-orchestration / 编排适配注入面按模板委派派生
  - Scenario Ref: 有委派即注入
  - Scenario Ref: 无委派不注入
  - Scenario Ref: 委派清单携带参数
  - Scenario Ref: 可降级委派不被误报为必需缺口
  - Scenario Ref: 授予面来自模板派生清单

- [x] [代码] 3.4 协议与白名单对齐：`workflows.ts` 增 auto-workflow 专用 APPLY/ARCHIVE 阶段（无阻塞门）与 VERIFY 文档桥门；`workflow` 的 VERIFY 与 `debug` 的 `verify-close` 同声明该门；`PHASE_GATE_CATEGORY` 补 `requirement-doc-bridge` → `requirement-clarification`；`protocol.ts` 的 `requirement-clarification.anchors` 追加 `requirement-doc-bridge`（类别数不变）[N19][N23]
  - 文件：`src/core/host-orchestration/workflows.ts`、`src/core/host-orchestration/protocol.ts`
  - 验证：`WORKFLOW_PROTOCOLS['auto-workflow']` 的 apply/archive 无 `gate`，verify 有 `requirement-doc-bridge`；`workflow` 的 verify 与 `debug` 的 `verify-close` 含该门；`GATE_WHITELIST` 类别数为 5；`auditGateWhitelistAlignment()` 返回空数组（`PHASE_GATE_CATEGORY` 缺映射会判「缺少白名单类别映射」违规）；新增门的阶段 MUST NOT 把 `gate` 加入 `requiredCapabilities`（否则 headless 下会以 `missing-capabilities` 阻断，与 D7 的条件门放行冲突）
  - Spec Ref: host-orchestration / auto-workflow 协议阶段门与模板声明一致
  - Scenario Ref: auto-workflow 的 APPLY 与 ARCHIVE 无阻塞门
  - Scenario Ref: auto-workflow 的 VERIFY 声明文档桥门
  - Scenario Ref: 白名单仍为 5 类且锚点包含文档桥
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议
  - Scenario Ref: 阶段门声明与协议一致

- [x] [代码] 3.5 `transition.ts` 消费 surface 缺失能力：条件门不因缺 `gate` 阻塞并记 WARN，不可豁免门保持阻塞并说明缺少交互式确认 [N23][N26]
  - 文件：`src/core/host-orchestration/transition.ts`
  - 验证：headless 协商 + 条件门 + `gateConfirmed=false` → 不出现 `gate-unconfirmed`；headless + 不可豁免门 → 仍阻塞；「条件 / 不可豁免」判定取自 `GATE_WHITELIST` 条目的 `conditional`（经 `PHASE_GATE_CATEGORY` 映射），MUST NOT 以 `GateSpec.condition` 代替
  - Spec Ref: host-orchestration / 运行表面（surface）能力协商
  - Scenario Ref: headless 条件门记录并继续
  - Scenario Ref: headless 不可豁免门以 blocked 回执中止

- [x] [测试][单元][P0] 3.6 宿主编排渲染与协商断言：派生注入、codex 产物、委派清单参数、strict 缺能阻断、OpenCode V2 委派措辞 [N4][N9][N24][N25][N29]
  - 文件：`test/host-orchestration.test.ts`、`test/claude-host-adapter.test.ts`
  - 验证：各宿主产物段落断言通过；派生结果与模板 `Skill(...)` 一一对应
  - Spec Ref: host-orchestration / 编排适配注入面按模板委派派生
  - Scenario Ref: 派生结果覆盖既有委派技能
  - Spec Ref: host-orchestration / Host capability negotiation
  - Scenario Ref: Strict host is capable
  - Scenario Ref: Strict host is missing a capability
  - Scenario Ref: OpenCode V2 delegation

- [x] [测试][单元][P1] 3.7 协议门与白名单对齐断言 + 交互表面回归：门预算不增、条件门语义不变、破坏性确认独立生效、协议门全部落在锚点内 [N19][N23][N24]
  - 文件：`test/host-orchestration.test.ts`
  - 验证：门 id 集合 ⊆ 白名单锚点；每阶段阻塞门 ≤1；`gateConditions` 三态结果与改前一致；`PHASE_GATE_CATEGORY` 覆盖全部 `PhaseSpec.gate.id` 且映射类别锚点含该门（含 `requirement-doc-bridge`），`auditGateWhitelistAlignment()` 为空
  - Spec Ref: host-orchestration / 确认门白名单与协议门清单对齐
  - Scenario Ref: 协议门均在白名单内
  - Scenario Ref: 协议门全部落在白名单锚点内
  - Scenario Ref: 五类白名单覆盖全部现有阶段门
  - Scenario Ref: 阶段门类别映射齐备且 debug 文档桥一致
  - Scenario Ref: 对齐不新增第二道阻塞门
  - Scenario Ref: 条件门语义不变
  - Scenario Ref: 破坏性改动确认独立生效
  - Spec Ref: host-orchestration / 运行表面（surface）能力协商
  - Scenario Ref: 交互表面保持既有判定

## 4. OpenCode 权限翻译完整性（M5）

- [x] [代码] 4.1 `opencode-v2.ts` 权限补齐：`bash` 规则按技能实际 `Bash(<cmd>:*)` 前缀派生（语法未核实则 WARN + 诊断，不猜测）、worker `skill` 面含实际委派目标、派发阶段条件授予 `subagent`、MCP 缺口诊断、保持幂等与用户规则保留 [N7][N27]
  - 文件：`src/core/opencode-v2.ts`
  - 验证：`spec-apply` worker 的 `skill` 含 `iagent-spec-apply` 与 `iagent-test`；含 `Agent` 的阶段获 `subagent`；无 `bash *` 全量放行；`isIagentRule` 的归属识别已扩展到 `bash` 规则（按可判别前缀或显式标记），连续两次 `update` 不产生重复 bash 规则；bash 语法未核实 / MCP 缺口经 `openCodeProject.warnings` 进入 `init` / `update` 用户可见输出
  - Spec Ref: opencode-tool-adapter / OpenCode 权限翻译完整性
  - Scenario Ref: bash 规则按实际命令前缀派生
  - Scenario Ref: bash 资源语法未核实时不猜测
  - Scenario Ref: worker 获得其实际委派目标的 skill
  - Scenario Ref: 派发型 worker 获得 subagent
  - Scenario Ref: 无派发 worker 不获 subagent
  - Scenario Ref: MCP 缺口显式诊断

- [x] [测试][单元][P0] 4.2 OpenCode 产物断言：权限规则幂等、用户配置保留、bash / worker 委派面覆盖、`skill` / `subagent` 资源限定 [N7][N27]
  - 文件：`test/opencode-v2.test.ts`
  - 验证：连续两次 update 规则集合一致；用户规则与字段保留；断言 `bash` / worker `skill` / 条件 `subagent` 存在
  - Spec Ref: opencode-tool-adapter / OpenCode 权限翻译完整性
  - Scenario Ref: 权限规则幂等且不覆盖用户配置
  - Spec Ref: opencode-tool-adapter / OpenCode 项目级编排配置
  - Scenario Ref: Project-local V2 config
  - Scenario Ref: Native skill permission
  - Scenario Ref: Native subagent permission
  - Scenario Ref: bash 面不再缺失
  - Scenario Ref: worker 委派面不再缺失
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议
  - Scenario Ref: OpenCode V2 auto apply

## 5. Pi 工具与门声明对齐（M6）

- [x] [代码] 5.1 `PI_STRICT_PROFILE.native.gate` 文本限定为「阻塞回执形态（非交互式）」并在协商 notes 输出；`PI_AGENT_TOOLS` 保持 7 个内置名不变；`pi-native.ts` 注释与诊断措辞对齐 [N8][N28]
  - 文件：`src/core/host-orchestration/hosts.ts`、`src/core/pi-native.ts`
  - 验证：strict 协商 notes 含 gate 形态限定；`.pi/agents/*.md` 的 `tools` 仍只含内置名
  - Spec Ref: host-orchestration / Pi native delegation entries
  - Scenario Ref: gate 能力限定为阻塞回执形态

- [x] [测试][单元][P1] 5.2 Pi 产物断言：agent 定义契约、orphan 清理、嵌套委派授予来自派生清单、缺口诊断、degraded 路径不伪装 [N8][N28][N29]
  - 文件：`test/pi-native.test.ts`、`test/pi-runtime.test.ts`
  - 验证：`allowed_subagents` 与派生清单一致；缺失目标记 `nestingGaps`；`tools` 不含扩展工具名；默认安装集（`project-init` 在、`feature-doc` 不在）不产生 `project-init` 的无条件必需缺口（按 `CONDITIONAL_DELEGATIONS` 记条件委派 WARN）
  - Spec Ref: host-orchestration / Pi native delegation entries
  - Scenario Ref: 生成编排器与阶段 agent
  - Scenario Ref: 用户自建 agent 不被覆盖
  - Scenario Ref: frontmatter 契约与上游可解析
  - Scenario Ref: agent 定义为纯生成物
  - Scenario Ref: 生效集缩小后清理 orphan
  - Scenario Ref: Pi delegation
  - Scenario Ref: Pi runtime present but entries unresolvable
  - Spec Ref: host-orchestration / Pi 编排阶段 agent 的嵌套委派授予
  - Scenario Ref: 编排阶段 agent 可嵌套委派
  - Scenario Ref: 委派目标未安装时不伪装严格可用
  - Spec Ref: workflow-suite-skills / auto-workflow 全自动管线 SHALL 经宿主适配器复用 apply/archive 协议
  - Scenario Ref: Pi degraded auto workflow

## 6. 构建、回归与发布（D6 / AGENTS.md 守则 8）

- [x] [使用说明] 6.1 编写 Claude UI / CLI 手工验证清单：区分权限弹窗与业务门、记录 `settings.local.json` 落盘规则形态、记录 headless 行为 [N31]
  - 产出: docs/host-permission-verification.md
  - 验证：清单含可勾选的 UI 与 CLI 用例、预期观察项（是否弹窗 / 弹窗来源 / 落盘规则名）与判定准则；每条用例要求记录当次**权限姿态**（`default` / `acceptEdits` / `plan` / `bypassPermissions` 或 CLI 等价物），并显式声明 `bypassPermissions` 下的「无弹窗」不构成通过证据（须以非 bypass 姿态重跑）；含 headless（`claude -p`）用例与「旧裸名条目为死条目、无放行作用」的核对项
  - Spec Ref: tool-call-whitelist / 白名单形态的回归锁与文档同步
  - Scenario Ref: 回归锁容纳 canonical 形态
  - Scenario Ref: 手工验证不被权限姿态掩盖

- [x] [代码] 6.2 版本与变更日志：`package.json` 按 minor 递增，`CHANGELOG.md` 归档 `[Unreleased]` 为对应版本小节并更新链接引用（AGENTS.md 修改守则 8）
  - 文件：`package.json`、`CHANGELOG.md`
  - 验证：`version` 递增位为 minor；CHANGELOG 含新版本小节与链接定义，`[Unreleased]` 保留
  - 验证：`node bin/iagent.js --version` 输出与 `package.json` 一致；其它出现版本号的位置同步更新（README.md 安装验证的 `iagent --version` 输出示例与 `npx mi-agent-tools@<version>` 示例，AGENTS.md 修改守则 8）

- [x] [测试][功能][P0] 6.3 全量回归：`pnpm build && pnpm generate:skills && pnpm test`，确认快照一致、技能体积预算、白名单与宿主产物断言全绿
  - 文件：`skills/**`（生成产物）
  - 验证：三条命令均成功；`skills-parity` 与 `skill-size-budget` 用例通过
  - Spec Ref: tool-call-whitelist / 白名单形态的回归锁与文档同步
  - Scenario Ref: 文档与守则同步 canonical 形态

## 7. 术语、文档与能力记忆同步（D11）

- [x] [代码] 7.1 同步文档与能力记忆：`docs/skills-manual.md`、`docs/migration-guide.md` 的白名单/委派形态；`openspec/specs/tool-call-whitelist/explorations.md` 的 D5 结论标注「已过时（由本变更取代）」并保留历史；`openspec/CONTEXT.md` 术语补双轴与 surface [N31]
  - 文件：`docs/skills-manual.md`、`docs/migration-guide.md`、`openspec/specs/tool-call-whitelist/explorations.md`、`openspec/CONTEXT.md`
  - 验证：文档中委派条目示例为 canonical；旧记忆带「已过时」标注且原文保留；CONTEXT 术语与 `delegation-contract.ts` 取值一致
  - Spec Ref: tool-call-whitelist / 白名单形态的回归锁与文档同步
  - Scenario Ref: 旧记忆标注已过时

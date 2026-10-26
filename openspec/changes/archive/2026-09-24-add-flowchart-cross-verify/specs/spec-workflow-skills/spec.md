## MODIFIED Requirements

### Requirement: spec-explore 探索技能

spec-explore 技能 SHALL 实现探索立场工作流：CodeGraph 强制首动作（codegraph_status 确认可用前禁止 Glob/Grep 回退）、结构化探索文件持久化（`openspec/explorations/<keyword>-explore-<seq>.md`）、CONTEXT.md 术语表启动检查、只读不写代码；首次写操作前 MUST 以 yes/no 形式向用户单独确认（确认范围仅限命名的文件、回答设计问题≠同意写入）；用户可能已编辑的依赖文件 MUST 在使用前 re-read from disk；材料性歧义（影响范围/行为/兼容性/验收）MUST 必问，小细节可合理假设并记录。

技能 SHALL 在 `Input` 段之后、进入思考伙伴立场（`The Stance`）之前接入**提示词校验门**，且 MUST 以**条件触发**方式接入——本门的加入 MUST NOT 把该技能改造为固定步骤流程，其"没有固定步骤、没有强制产出"的定位保持不变。触发条件与行为：输入清晰（目标、对象、范围均明确且无实质歧义）时，MUST NOT 输出校验表格、MUST NOT 要求确认，直接进入思考伙伴模式；输入含糊或多义（对象不可定位、存在多个候选对象、只有笼统动词、或存在影响范围/行为契约/验收的实质歧义）时，SHALL 执行提示词优化——遵守"不篡改用户原始意图"（只做结构化与约束补全，MUST NOT 擅自增加用户未提出的需求）、推断内容标 `[推断]`、无法推断内容标 `[待确认]`、输出 `【优化后提示词】` 与 `【优化说明】`，并**阻塞等待用户确认或修改**后才继续探索；用户拒绝优化时记录原始提示词按其原有理解继续；用户在门上明确授权按推断继续时，将全部推断项标 `[推断]` 并记入基线后继续探索，MUST NOT 反复要求确认或陷入等待确认的死循环。本门复用 `src/core/templates/prompt-gate.ts` 单一源（见 tr-workflow-suite-skills 的「提示词校验门共享模块」需求），维度取需求六维（目标/对象/范围/约束/验收/歧义），软不明确（仅细节级歧义）沿用本技能既有的"合理假设并记录"处理，不进入优化分支。校验产出的提示词基线 SHALL 在探索产物中落盘为 `## 提示词基线` 段（含原始提示词与确认后的基线）；本技能不设强制产出文件，无探索文件时基线仅保留在会话中，并在创建/关联探索文件时写入。

门的入口适配 MUST 覆盖本技能的不同入口形态：**无输入**（仅进入探索模式，无可校验提示词）时 SHALL 跳过本门并直接进入探索立场，MUST NOT 因缺少输入而要求用户先提供提示词；**输入为变更名**（如 `/venus:spec-explore <change-name>`）时 SHALL 以该变更的既有制品（proposal / design / specs / tasks）为校验对象，MUST NOT 把变更名本身当作需求提示词评估清晰度；**输入为比较型或问题型表述**时按需求六维正常判定。

技能 SHALL 以**条件触发**方式产出**功能流程图**，MUST NOT 因本制品的加入把该技能改造为固定步骤流程：探索中浮现**明确的业务功能流程**时，SHALL 将流程固化为探索产物的 `## 功能流程图` 段——Mermaid 流程图（`flowchart TD`）加关键操作节点清单表（节点 / 操作 / 触发条件 / 证据位置 / 异常路径），节点 id（`N<序号>`）在两处 MUST 稳定一致；节点 SHALL 为可独立验证的业务操作单元，每节点 MUST 含证据位置（既有代码标 `文件:行`，新建功能标 `[新建]` + 预期产物），MUST NOT 让无法追溯证据的节点进入清单。产出后 SHALL 执行**流程最终确认门**（四出口模型：确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续，MUST NOT 死锁），确认后成为 propose / verify 的**流程基准**。探索为**纯概念探讨或无业务功能流程**时，SHALL 在探索产物中记录「本次无功能流程」并**直接继续**，MUST NOT 因此阻塞探索。本制品复用 `src/core/templates/flowchart-gate.ts` 单一源（见 tr-workflow-suite-skills 的「功能流程图共享模块」需求）。

#### Scenario: CodeGraph 首动作

- **WHEN** spec-explore 技能启动且 CodeGraph MCP 可用
- **THEN** 技能先执行 codegraph_status / codegraph_files / codegraph_search 完成基础扫描，Glob/Grep 仅在 CodeGraph 确认不可用后作为回退

#### Scenario: 探索文件持久化

- **WHEN** 探索过程产出结构化发现（背景/问题/决策/术语）
- **THEN** 写入 `openspec/explorations/<keyword>-explore-<sequence>.md`（sequence 从 001 递增），跨会话可被 spec-propose 关联迁移

#### Scenario: 写入确认守卫

- **WHEN** 探索过程需要执行任何写能力动作（含创建变更、修改 artifact、保存探索文件）
- **THEN** 技能先命名将修改的文件、以 yes/no 形式向用户确认并等待单独回复后才执行；确认范围仅限已命名的文件，不允许 "全部同意" 式笼统授权；用户回答设计问题（讨论方案、澄清需求、解释术语等）不构成对写入操作的同意，写入仍需独立的 yes/no 确认

#### Scenario: 依赖文件 re-read from disk

- **WHEN** 探索过程需要读取用户可能在会话期间编辑过的文件（如 CONTEXT.md、exploration.md、变更 artifact）
- **THEN** 技能在每次使用前重新从磁盘读取最新内容，不依赖会话开始时缓存的版本，避免基于过时内容决策

#### Scenario: 材料性歧义划分

- **WHEN** 探索过程遇到歧义
- **THEN** 影响范围/行为契约/向后兼容性/验收标准的歧义 MUST 表面化并向用户提问（标记 `[待确认]`）；不影响上述方面的细节性歧义可做合理假设并记录假设，避免无限追问

#### Scenario: 条件触发保持探索立场

- **WHEN** 用户以清晰输入进入探索（如"帮我看看 OrderService 的导出逻辑能否支持大数据量"——对象与范围明确、无实质歧义）
- **THEN** 技能不输出六维校验表格、不要求确认、不生成 `【优化后提示词】`，直接以思考伙伴身份进入探索；技能既有的"无固定步骤、无强制产出"定位不变

#### Scenario: 入口形态适配

- **WHEN** 用户不携带任何参数直接进入探索模式（无提示词可校验），或携带变更名进入（如 `/venus:spec-explore add-auth-system`）
- **THEN** 无参数时技能跳过本门直接进入探索立场，不要求用户先提供提示词；携带变更名时技能先读取该变更的既有制品作为校验与探讨对象，不把变更名当作需求提示词评估清晰度

#### Scenario: 含糊输入激活门并阻塞确认

- **WHEN** 用户以含糊输入进入探索（如"看看能不能优化一下"——目标与对象均不可定位）
- **THEN** 技能先执行提示词优化并输出 `【优化后提示词】`（含 `[推断]` / `[待确认]` 标注）与 `【优化说明】`，阻塞等待用户确认或修改后才开始探索；在用户确认前不进行代码库扫描与需求澄清追问

#### Scenario: 浮现业务功能流程时产出并确认

- **WHEN** 探索中浮现明确的业务功能流程（如探索导出功能时梳理出"选择范围 → 点击导出 → 数据量判定 → 分批查询 → 生成文件"的完整链路）
- **THEN** 技能产出 `## 功能流程图` 段（Mermaid 流程图 + 节点清单表，节点 id 稳定一致、每节点含证据位置），并执行流程最终确认门等待用户确认；确认后该流程图成为流程基准

#### Scenario: 无业务功能流程时直通不阻断

- **WHEN** 探索为纯概念探讨或未浮现明确的业务功能流程（如"帮我想想这个模块该怎么分层"）
- **THEN** 技能在探索产物中记录「本次无功能流程」并直接继续探索，MUST NOT 因此阻塞、MUST NOT 为凑制品而虚构流程节点

#### Scenario: 流程最终确认门不陷入死锁

- **WHEN** 用户在流程最终确认门上拒绝确认或明确不表态
- **THEN** 技能记录原始流程图与未确认状态后继续探索，MUST NOT 反复要求确认；该未确认状态随探索产物传递，propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP

### Requirement: spec-propose 提案技能

spec-propose 技能 SHALL 实现变更提案工作流：`venus spec new` 创建骨架 → 按 `venus spec status` 依赖序逐 artifact 用 `venus spec instructions` 获取模板生成 → 生成完成后 MUST 调用 spec-verify-proposal 技能执行前置验证门（90% 阈值）；用户请求授权的范围是规划而非实现，artifacts 全部生成并 PASS 后 MUST 停止、等待用户发起新请求才进入实现；applyRequires 集合 SHALL 按 requires 边构建传递闭包作为必需集（防 tasks done 而 specs 未写早停）；用户可能已编辑的依赖 artifact MUST 在使用前 re-read from disk；材料性歧义（影响范围/行为/兼容性/验收）MUST 必问，小细节可合理假设并记录。

当关联的 `exploration.md` 含经用户确认的 `## 功能流程图` 段时，技能 SHALL 以该流程图为**生成锚点**：`design.md` SHALL 引用流程图与关键操作节点清单（MUST NOT 在 design 中重新发明一套流程）；`tasks.md` 的每个任务 SHALL 标注其对应的节点 id（`[N4]` 形），实现节点 → 任务的可追溯映射，使每个流程节点在任务清单中可被逐一核对。探索期流程图缺失或**未获用户确认**时，技能 SHALL 降级为仅凭 exploration.md 生成，MUST NOT 把未确认的流程图当作既定前提，并 SHALL 在生成报告中标注该降级。

#### Scenario: 能力记忆注入
- **WHEN** spec-propose 启动且 `openspec/specs/<capability>/explorations.md` 存在
- **THEN** 技能读取该能力的历史 Decisions/术语/边界场景注入提案上下文

#### Scenario: 探索文件关联迁移
- **WHEN** `openspec/explorations/` 存在探索文件且用户确认关联
- **THEN** 探索文件迁移至 `openspec/changes/<name>/exploration.md`

#### Scenario: 前置验证门强制执行
- **WHEN** 全部 artifact（proposal/specs/design/tasks）生成完成
- **THEN** 技能 MUST 自动调用 spec-verify-proposal 执行 D1-D9 评分，不允许跳过直接进入实现

#### Scenario: Planning Boundary
- **WHEN** 用户在 propose 阶段请求 "实现它" 或 "开始编码"
- **THEN** 技能继续完成规划工件（proposal/design/specs/tasks）+ 前置验证门，artifacts 全部生成并 PASS 后停止，输出 "准备就绪，告知我即可开始执行任务"，等待用户发起独立新请求（spec-apply）才进入实现；spec-propose 技能本身 SHALL NOT 启动代码实现

#### Scenario: 依赖文件 re-read from disk
- **WHEN** spec-propose 在生成新 artifact 时需要读取已完成的依赖 artifact（如生成 design 时读 proposal.md）
- **THEN** 技能从磁盘重新读取依赖文件的最新内容（用户可能在会话期间手工编辑），不依赖会话缓存

#### Scenario: required set 传递闭包
- **WHEN** spec-propose 通过 `venus spec status --json` 获取 applyRequires 与 artifacts 依赖图
- **THEN** 技能按 requires 边构建 applyRequires 的传递闭包作为必需集（即 applyRequires ∪ 其传递依赖），所有必需 artifact 均 `status: "done"` 才视为 "apply-ready"，防止 tasks 已 done 而 specs 未写时因 applyRequires 只列 tasks 而早停

#### Scenario: 材料性歧义划分
- **WHEN** spec-propose 在 artifact 生成中遇到歧义
- **THEN** 影响范围/行为契约/向后兼容性/验收标准的歧义 MUST 表面化并向用户提问（标记 `[待确认]`），不擅自决策；不影响上述方面的细节性歧义可做合理假设并记录假设

#### Scenario: 以流程基准为生成锚点
- **WHEN** 关联的 exploration.md 含经用户确认的 `## 功能流程图` 段
- **THEN** design.md 引用该流程图与节点清单（不重新发明流程），tasks.md 的每个任务标注对应节点 id（如 `- [ ] 实现分批查询 [N4]`），使流程节点可在任务清单中被逐一核对

#### Scenario: 流程图缺失或未确认时降级
- **WHEN** exploration.md 不含 `## 功能流程图` 段，或该段存在但未获用户确认
- **THEN** 技能降级为仅凭 exploration.md 生成提案，不把未确认流程图当作既定前提，并在生成报告中标注该降级

### Requirement: spec-verify-proposal 前置验证门技能

spec-verify-proposal 技能 SHALL 实现提案阶段量化评分：D1-D9 维度覆盖率评分（D6-D9 按变更类型条件启用，未启用标"不适用"），总分 ≥90% PASS（可进入实现）、<90% FAIL（生成修复建议并重试）；tech stack 从 openspec/config.yaml context 检测。

技能 SHALL 增设**流程图节点覆盖度**维度，与既有 D1-D9 同权重参与平均分：评分公式为 `覆盖度 = 被 design/tasks 覆盖的节点数 ÷ 流程图总节点数 × 100%`。覆盖判定 SHALL **优先按节点 id 显式标注**（tasks 任务标注 `[N4]` 形）匹配；未标注时 MAY 以**语义等价判定**（同一操作的不同措辞算命中）补充。总分 SHALL 复用既有公式 `(D1+…+D5 + sum(triggered)) / (5 + triggered_count)`，本维度纳入 `triggered` 集合，MUST NOT 改变算法核心。本维度与既有的 **D9（Business Steps）职责分离且互补**——D9 检查提案**自身**是否拆解复杂操作（自证，SHALL 保留不动，MUST NOT 被本维度替换或缩窄），本维度检查提案与**外部流程基准**的偏差（他证）。`tr-docs-requirement-doc` 的业务流程图（design.md 的下游表达）MUST NOT 因本变更被修改。**触发条件**：探索产物含 `## 功能流程图` 段时触发。**缺失处理**：无 `## 功能流程图` 段（含未获用户确认）时该维度 SHALL 标 SKIP、**不计入分母**，MUST NOT 按 0 分拉低总分、MUST NOT 判 FAIL——以此保证既有归档变更与纯文档 / 纯配置变更不被误伤。FAIL 时输出 MUST 列出**未覆盖的节点 id 清单**（而非仅覆盖度百分比），使偏差可定位。

#### Scenario: PASS 路径
- **WHEN** 9 维评分总分 ≥90%
- **THEN** 输出 PASS 与各维度覆盖率表，变更获准进入 spec-apply 实现阶段

#### Scenario: FAIL 修复循环
- **WHEN** 评分 <90%
- **THEN** 输出 FAIL 与逐维缺口分析，自动生成修复建议应用后重新评分，仍失败则提供 [手动编辑]/[返回探索]/[查看差异] 选项

#### Scenario: 条件维度跳过
- **WHEN** 变更类型不含交互细节（无 UI 相关 spec）
- **THEN** D6 维度标注"不适用"并从总分计算中排除，不按 0 分拉低总分

#### Scenario: 节点覆盖度参与评分
- **WHEN** 探索产物含 `## 功能流程图` 段且总节点数为 6，design/tasks 覆盖其中 5 个节点
- **THEN** 该维度评分 83%，与既有维度同权重参与总分平均；报告列出未覆盖的节点 id

#### Scenario: 无流程图时维度 SKIP 不误伤
- **WHEN** 变更的探索产物不含 `## 功能流程图` 段（如归档期的既有变更、纯文档变更，或用户拒绝确认流程图）
- **THEN** 节点覆盖度维度标注 SKIP 并从总分分母中排除，MUST NOT 判 FAIL、MUST NOT 按 0 分拉低总分

#### Scenario: 未覆盖节点可定位
- **WHEN** 节点覆盖度评分低于 90% 导致该维度 FAIL 或警告
- **THEN** 报告 MUST 逐条列出未被 design/tasks 覆盖的节点 id 与操作名，使偏差定位到具体节点而非仅给出百分比

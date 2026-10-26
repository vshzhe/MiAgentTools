## MODIFIED Requirements

### Requirement: tr-impl-workflow 结构化探索阶段

技能 `venus_tr_impl_workflow` SHALL 以强制 checkpoint 体系执行探索：调用即创建探索文件（`openspec/explorations/<keyword>-explore-<NNN>.md`，keyword 取自用户主题 kebab-case 最长 50 字符，同 keyword 序号递增，冲突 3 次重试后追加时间戳后缀）、执行 CONTEXT.md 启动检查（存在则注入既有术语）、注入能力级探索记忆（`openspec/specs/<capability>/explorations.md` 存在时注入历史 Decisions/术语/边界场景，`已过时（由 <change-name> 取代）` 标记段仅作历史参考）、以 `codegraph_status` 为强制首动作执行 CodeGraph 基础扫描（files + search；确认不可用后才降级 Glob/Grep 并记录）、检测到其他项目路径时派 Agent 子代理用 projectPath 参数扫描（maxDepth 3 / maxNodes 20 / 超时 120s，失败 WARN 降级不重试）、按"新功能 vs 修改既有代码"智能检测结果条件触发深度分析（6 维度）、执行 grill-with-docs 追问（L1 意图→L2 方案→L3 异常→L4 一致性→L5 边界逐级确认门，一次一问每级等确认，最低深度 L3，每问附 AI 推荐，跳过级别记入 Pending）、术语解决即时写入 CONTEXT.md、探索完成时执行 CONTEXT.md 检查点与聚合一致性门（逐对扫描三类硬冲突：技术选型冲突、依赖方向冲突、约束互斥；发现硬冲突暂停呈现用户裁决，禁止自动解决；空 Decisions 显式记录 vacuity-pass）。

技能 SHALL 在**探索文件创建之后**（1.1.2，先于 CONTEXT.md 启动检查与任何代码库扫描、提问）执行**提示词校验门**：以需求六维（目标 Goal / 对象 Object / 范围 Scope / 约束 Constraints / 验收 Acceptance / 歧义 Ambiguity）逐维判定用户输入并分级——**清晰**（目标/对象/范围/歧义四维均无缺失与实质歧义）时以一句话复述理解后直接进入探索，MUST NOT 输出校验表格或要求用户确认；**不明确**（任一维缺失或存在实质歧义）时执行提示词优化并**阻塞等待用户确认或修改**，用户确认前 MUST NOT 进入 CONTEXT.md 检查、代码库扫描或 grill 追问；**软不明确**（仅细节级歧义，不涉及范围/行为契约/验收标准）记 `[假设]` 继续，不阻断。提示词优化 MUST 遵守"不篡改用户原始意图"——只做结构化与约束补全，MUST NOT 擅自增加用户未提出的需求；推断补齐内容标 `[推断]`、无法推断内容标 `[待确认]`，MUST NOT 把猜测写成既定事实；输出 MUST 含 `【优化后提示词】`（目标/对象/范围/约束/验收/已知歧义）与 `【优化说明】`（改动项与理由）两部分，并列出仍需用户补充的信息项。用户拒绝优化时，技能 SHALL 记录原始提示词并按其原有理解继续，MUST NOT 强制用户接受改写。用户在门上明确授权按推断继续（如"你按你的判断来"）时，技能 SHALL 将全部推断项标 `[推断]` 并记入提示词基线后继续探索，MUST NOT 反复要求确认或陷入等待确认的死循环。技能 SHALL 将「原始提示词」与「确认后的提示词基线」写入探索文件新增的 `## 提示词基线` 段；下游制品（proposal/design/specs/tasks）MUST 以提示词基线为唯一语义来源，基线变更 MUST 回到本门重新确认。门的校验对象 MUST 为用户最终提供的主题描述：调用未携带主题时，技能先经交互收集主题描述，再以收集后的描述执行本门，MUST NOT 对空输入执行校验。

#### Scenario: 调用即创建探索文件并注入记忆

- **WHEN** 用户以主题描述调用 `/venus:tr-impl-workflow <主题>`
- **THEN** 系统在进入任何提问前创建 `openspec/explorations/<keyword>-explore-001.md`（keyword 从主题提取），验证文件存在且可写；检查 `openspec/CONTEXT.md` 存在性并按结果注入或记录；扫描 `openspec/specs/` 推断涉及能力并注入既有 `explorations.md` 记忆

#### Scenario: 聚合一致性门拦截硬冲突

- **WHEN** 探索完成、全部 Decisions 中存在决策 A 选 SQLite 且决策 B 依赖 Postgres 特有功能
- **THEN** 系统暂停并向用户呈现冲突决策对与方向询问，用户裁决前不进入提案阶段；记录解决方向到 exploration.md 的 Scope Changes/Decisions

#### Scenario: CodeGraph 不可用时降级

- **WHEN** `codegraph_status` 确认 CodeGraph MCP 未初始化或出错
- **THEN** 系统记录 "CodeGraph not initialized — using Glob/Grep fallback" 后降级为 Glob 文件结构发现与 Grep 符号搜索，继续探索不阻塞；在 status 返回不可用前不得使用 Glob/Grep 做符号/文件调查

#### Scenario: 清晰输入直通不打扰

- **WHEN** 用户输入同时明确了目标、对象、范围与无歧义表述（如"为 OrderService 新增按订单号批量导出 CSV 的接口，不改动既有查询逻辑，验收标准是导出字段与列表页一致"）
- **THEN** 系统以一句话复述理解后直接进入探索，不输出六维校验表格、不要求用户确认、不生成 `【优化后提示词】`

#### Scenario: 不明确输入阻塞确认门

- **WHEN** 用户输入为"优化一下那个导出"——对象不可定位或存在多个候选对象（对象维 ❌）、范围开放（范围维 ❌）
- **THEN** 系统执行提示词优化，输出 `【优化后提示词】`（含 `[推断]` 与 `[待确认]` 标注）与 `【优化说明】`，随后停止等待用户确认或修改；在用户确认前不创建探索内容以外的任何动作，不执行 CONTEXT.md 检查、不扫描代码库、不发起 grill 追问

#### Scenario: 软不明确不阻断

- **WHEN** 用户输入已明确目标与对象，仅措辞存在细节级歧义（如未指明导出文件名的时间戳格式），该歧义不影响范围/行为契约/验收标准
- **THEN** 系统记录该假设为 `[假设]` 并继续探索，不进入提示词优化分支、不阻塞等待确认

### Requirement: tr-impl-auto-workflow 全自动管线

技能 `venus_tr_impl_auto_workflow` SHALL 执行五阶段全自动管线：Phase 1-3 与 tr-impl-workflow 同构（精简版探索 + 内联提案生成 + 自动验证，探索文件迁移保留源文件）；Phase 4 验证通过且需求文档生成后自动进入 auto-apply（构建 `auto-mode=true` + change-name 上下文，执行 `venus_spec_apply` 的 Step 6+ 批次调度行为，跳过设计确认门）；Phase 5 apply 完成且编译检查通过后自动进入 auto-archive（构建 change-name 上下文跳过变更选择提示，执行 `venus_spec_archive` 模板全部步骤：delta spec 合并、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、目录移动、ARCHIVE-INDEX.md 更新）。错误处理 MUST 遵守：编译检查失败经 3 次自动修复尝试后暂停等待用户指令不进归档；子代理失败自动重试一次、再失败暂停报告；用户中断时完成当前批次、剩余任务标记未完成后暂停；归档 delta spec 冲突带标记自动合并（非阻塞）；CONTEXT.md/探索记忆同步失败 WARN 继续；CodeGraph 未初始化跳过继续；归档目标已存在报错建议改名。

技能 SHALL 在与 tr-impl-workflow 同构的位置（Phase 1.1.2，探索文件创建之后、CONTEXT.md 检查与代码库扫描之前）执行同一**提示词校验门**（需求六维自检、清晰直通、不明确优化并阻塞确认、软不明确记 `[假设]`、`无需`/`提示词基线` 落盘规则与 tr-impl-workflow 完全一致）。该门是**澄清门（确认 WHAT）**，MUST NOT 因管线的 auto 语义被跳过或静默通过——自动化的起点在 Baseline 确认之后，而非之前。

#### Scenario: 验证通过直通 apply 与 archive

- **WHEN** Phase 3 验证 Overall ≥90% 且需求文档生成完成
- **THEN** 系统宣布进入 Auto-Apply Phase 并以 auto-mode=true 执行实现（不呈现设计确认门），apply 完成且编译检查通过后自动宣布进入 Auto-Archive Phase 执行归档，最终输出全 Phase 完成汇总

#### Scenario: 编译检查持续失败暂停

- **WHEN** Phase 4 中编译检查在 3 次自动修复尝试后仍失败
- **THEN** 系统暂停并等待用户指令，不进入归档阶段

#### Scenario: 澄清门不被 auto 语义跳过

- **WHEN** 用户以含糊输入（对象或范围缺失）调用 `/venus:tr-impl-auto-workflow`
- **THEN** 系统在 Phase 1.1.2 执行提示词优化并阻塞等待用户确认后才继续自动化管线；不因管线为全自动模式而跳过本门或按猜测继续

### Requirement: tr-impl-debug 强制复现与根因确认门

技能 `venus_tr_impl_debug` SHALL 在修改任何代码前先复现 bug（失败测试复现优先：定位或编写演示 bug 的测试并确认其因报告的原因失败；无法自动化捕获时记录显式编号步骤并经用户确认）；复现无法建立时向用户报告已尝试内容且不凭假设修复；调查阶段 MUST 以 `codegraph_status` 为首动作执行 CodeGraph 分层排查（files→search+context→callers/callees+impact 双向爆炸半径→常规查询无法定位单一高置信根因时条件触发 explore + 6 维根因深度分析），所有发现实时写入诊断记录（每查询步后而非批量）；调查中注入能力记忆（历史边界场景作为根因线索）；根因确认门：单一高置信根因呈现证据获用户确认；多候选或置信不足时 STOP 呈现候选清单+逐候选证据+推荐，用户选择前不修改代码。

技能 SHALL 在 **Startup 段（记录 bug 描述之后）与 Phase 1 强制复现之前**执行**提示词校验门（bug 版）**：以 bug 五维（症状 Symptom / 复现步骤 Repro steps / 期望 vs 实际 Expected vs Actual / 环境 Environment / 歧义 Ambiguity）逐维判定 bug 描述并分级——**清晰**（症状、复现步骤或触发场景、期望与实际三者具备且无实质歧义）时以一句话复述理解后直接进入 Phase 1；**不明确**（症状笼统、无法判断触发场景、期望与实际混淆、或存在"时好时坏"类实质歧义）时按同一优化规则（不篡改用户意图、`[推断]`/`[待确认]` 标注、输出 `【优化后提示词】` + `【优化说明】`）执行优化并**阻塞等待用户确认或修改**，用户确认前 MUST NOT 进入复现；**软不明确**（仅细节级歧义，如精确的环境版本号）记 `[假设]` 继续。校验结论与基线写入诊断记录的 `## 提示词基线` 段。用户最初未提供 bug 描述、由技能提示后补充的情形，以补充内容为原始提示词执行同一流程，MUST NOT 对空输入执行校验。

#### Scenario: 多候选根因时停止等待选择

- **WHEN** Phase 2 排查后存在两个及以上候选根因且无单一高置信结论
- **THEN** 系统呈现候选清单（逐候选附证据与推荐）并停止，用户选定根因前不进入修复阶段

#### Scenario: 无法复现时不修复

- **WHEN** Phase 1 无法建立失败测试复现且用户无法确认显式复现步骤
- **THEN** 系统向用户报告复现尝试内容后不进入修复阶段（零假设策略）

#### Scenario: bug 描述含糊时先优化再复现

- **WHEN** 用户以"导出功能有 bug"调用 `/venus:tr-impl-debug`——症状笼统且无复现线索（症状维 ⚠、复现步骤维 ❌）
- **THEN** 系统执行 bug 版提示词校验门，输出按五维结构化的 `【优化后提示词】（含 [推断] 标注）` 与 `【优化说明】` 并阻塞等待确认；用户确认前不进入 Phase 1 复现，不凭猜测编写失败测试

#### Scenario: bug 维度场景检查项可映射到复现与验证

- **WHEN** 校验门输出的提示词基线含"期望 vs 实际"与"环境"两项
- **THEN** 该两项分别成为 Phase 1 复现的验收判据（期望 vs 实际）与复现前置条件（环境）；基线写入诊断记录 `## 提示词基线` 段并在 Phase 6 随根因分析一并持久化到变更 exploration.md

## ADDED Requirements

### Requirement: 提示词校验门共享模块

模板层 SHALL 提供单一源模块 `src/core/templates/prompt-gate.ts` 承载提示词校验门文本，MUST NOT 在 5 个技能模板中重复维护流程文本。该模块 SHALL 导出：清晰度维度类型 `PromptDimension`（名称 / 判定问题 / 升级为硬不明确的信号 / 是否计入硬不明确判据）、需求六维常量 `REQUIREMENT_DIMENSIONS`、bug 五维常量 `BUG_DIMENSIONS`、参数化渲染函数 `buildPromptGateBlock(dimensions)`（渲染共享的 Step 1–5 流程文本与入口形态适配段，仅维度表与清晰判据按场景注入——清晰判据由各维度是否计入硬不明确判据渲染得出）、以及供手写指令正文复用的压缩渲染 `buildPromptGateCompact(dimensions)`。`venus_spec_explore` / `venus_tr_impl_workflow` / `venus_tr_impl_auto_workflow` / `venus_tr_impl_debug` / `venus_tr_impl_genfull` 五技能正文 SHALL 由该单一源内联生成；四个手写指令正文（tr-impl-workflow / auto-workflow / debug / genfull）SHALL 复用压缩块，`spec-explore` 指令正文经 `deriveCommandContent` 自动派生，其门文本 MUST NOT 被 `<!-- CMD:SKIP -->` 标记包裹（指令版同样需要本门）。本变更 MUST NOT 修改 `deriveCommandContent`（其被 7 个 spec-* 指令模板依赖，改动爆炸半径 16 个符号），且 MUST NOT 改变技能总数与注册结构。

#### Scenario: 门文本单一源内联

- **WHEN** 运行 `pnpm build && pnpm generate:skills` 生成 `skills/` 静态快照
- **THEN** 5 个技能的 SKILL.md 均含来自 `prompt-gate.ts` 的门文本（需求版或 bug 版按技能注入），且 `test/skills-parity.test.ts` 的逐字节一致性断言通过

#### Scenario: 技能总数与注册结构不变

- **WHEN** 本变更实施完成
- **THEN** `WORKFLOW_PAIRS` 仍为 27 组成对注册，`test/templates.test.ts` 与 `test/commands.test.ts` 的技能总数断言无需修改即可通过

### Requirement: tr-impl-genfull 引导式全流程编排

技能 `venus_tr_impl_genfull` SHALL 以**委派 + 桥梁**模型编排探索→归档的完整流程，MUST NOT 内联 explore / propose / apply 的阶段逻辑（区别于 tr-impl-workflow）。Phase 0 SHALL 执行全阶段 TodoWrite 跟踪初始化、`actionContext.mode` 检测（workspace-planning 模式降级为仅探索+提案+深度复查+需求文档，并在 Bridge 2 前停止）与贯穿上下文初始化（change-name / changeRoot / has-frontend / has-java-test / tech-stack 待各阶段填充）。

Phase 0 SHALL 在 Stage 1 委派之前执行**提示词校验门**（需求六维，规则与 tr-impl-workflow 一致：清晰直通、不明确优化并阻塞确认、软不明确记 `[假设]`）。该门 SHALL 具备**幂等性**：当检测到上游已产出提示词基线（本次会话 Phase 0 已确认，或传入的探索产物中已存在 `## 提示词基线` 段）时，MUST NOT 重复执行校验或再次要求确认。

各阶段 SHALL 经 Skill 工具委派执行：Stage 1 委派 `venus_spec_explore`（交互式 grill L1-L5 由 explore 承载）；Stage 1.5（条件 has-frontend）委派 `venus_tr_impl_frontend` **仅执行设计决策**（页面类型 / 组件选型 / 字段-组件映射矩阵 / jQuery 版本与引入顺序 / 4 种 UI 状态 / 前后端交互方式），产出写入 exploration.md `## 前端设计` 段供 propose 提取，references 实现模板留待 Stage 3；Stage 2 委派 `venus_spec_propose`（内部自动调用 `venus_spec_verify_proposal`，D1-D9 评分 90% 阈值），PASS 后委派 `venus_tr_impl_review_proposal` 深度复查（不可用则内联只读复查 + WARN）再委派 `venus_tr_docs_requirement_doc` 非交互生成需求文档（失败 WARN 继续）；Stage 3 委派 `venus_spec_apply` 并传 `auto-mode=true` 跳过 Step 5.5 设计确认门（由 Bridge 2 承载），条件子阶段 3a 委派 frontend 仅执行实现（读 references 生成 JSP）、3b 委派 `venus_tr_test_generate`；Stage 4 委派 `venus_spec_archive` 并传 change-name。

Bridge 1/2/3 SHALL 各自执行四件事：①上下文交接 ②前置就绪检查（Bridge 1：exploration.md 兜底补建 + CONTEXT.md 存在性校验 + impact analysis 并行执行并回写；Bridge 2：proposal/design/specs/tasks 齐全 + verify PASS + 深度复查完成 + 需求文档已生成 + apply instruction 为 `ready`；Bridge 3：tasks.md 全 `- [x]` + 编译通过 + 条件子阶段完成）③后置完整性校验 ④门决策（引导模式暂停等待用户确认）。错误处理 MUST 遵守：apply 编译失败 3 次自动修复后暂停且不进入归档；frontend/test 确认门拒绝时回退 Bridge 2；子代理失败自动重试一次、仍失败暂停报告；探索文件迁移失败时保留源文件。

#### Scenario: Phase 0 校验门与下游幂等

- **WHEN** 用户以含糊输入调用 `/venus:tr-impl-genfull`，Phase 0 执行提示词校验门并获用户确认后生成提示词基线
- **THEN** Stage 1 委派的 `venus_spec_explore` 检测到已存在的提示词基线后直接进入探索，不重复执行校验或再次要求确认

#### Scenario: 委派而非内联

- **WHEN** genfull 进入 Stage 1 探索
- **THEN** 系统经 Skill 工具委派 `venus_spec_explore` 执行，genfull 自身不内联探索文件创建、CONTEXT.md 检查、能力记忆注入、CodeGraph 扫描与 grill L1-L5 追问等探索逻辑

#### Scenario: workspace-planning 降级在 Bridge 2 前停止

- **WHEN** Phase 0 检测到 `actionContext.mode === "workspace-planning"`
- **THEN** 系统提示 workspace-planning 变更不支持 apply/archive，流程降级为仅探索+提案+深度复查+需求文档，并在 Bridge 2 的就绪检查处停止，不进入 Stage 3

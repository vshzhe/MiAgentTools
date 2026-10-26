## ADDED Requirements

### Requirement: tr-impl-workflow 结构化探索阶段

技能 `venus_tr_impl_workflow` SHALL 以强制 checkpoint 体系执行探索：调用即创建探索文件（`openspec/explorations/<keyword>-explore-<NNN>.md`，keyword 取自用户主题 kebab-case 最长 50 字符，同 keyword 序号递增，冲突 3 次重试后追加时间戳后缀）、执行 CONTEXT.md 启动检查（存在则注入既有术语）、注入能力级探索记忆（`openspec/specs/<capability>/explorations.md` 存在时注入历史 Decisions/术语/边界场景，`已过时（由 <change-name> 取代）` 标记段仅作历史参考）、以 `codegraph_status` 为强制首动作执行 CodeGraph 基础扫描（files + search；确认不可用后才降级 Glob/Grep 并记录）、检测到其他项目路径时派 Agent 子代理用 projectPath 参数扫描（maxDepth 3 / maxNodes 20 / 超时 120s，失败 WARN 降级不重试）、按"新功能 vs 修改既有代码"智能检测结果条件触发深度分析（6 维度）、执行 grill-with-docs 追问（L1 意图→L2 方案→L3 异常→L4 一致性→L5 边界逐级确认门，一次一问每级等确认，最低深度 L3，每问附 AI 推荐，跳过级别记入 Pending）、术语解决即时写入 CONTEXT.md、探索完成时执行 CONTEXT.md 检查点与聚合一致性门（逐对扫描三类硬冲突：技术选型冲突、依赖方向冲突、约束互斥；发现硬冲突暂停呈现用户裁决，禁止自动解决；空 Decisions 显式记录 vacuity-pass）。

#### Scenario: 调用即创建探索文件并注入记忆

- **WHEN** 用户以主题描述调用 `/venus:tr-impl-workflow <主题>`
- **THEN** 系统在进入任何提问前创建 `openspec/explorations/<keyword>-explore-001.md`（keyword 从主题提取），验证文件存在且可写；检查 `openspec/CONTEXT.md` 存在性并按结果注入或记录；扫描 `openspec/specs/` 推断涉及能力并注入既有 `explorations.md` 记忆

#### Scenario: 聚合一致性门拦截硬冲突

- **WHEN** 探索完成、全部 Decisions 中存在决策 A 选 SQLite 且决策 B 依赖 Postgres 特有功能
- **THEN** 系统暂停并向用户呈现冲突决策对与方向询问，用户裁决前不进入提案阶段；记录解决方向到 exploration.md 的 Scope Changes/Decisions

#### Scenario: CodeGraph 不可用时降级

- **WHEN** `codegraph_status` 确认 CodeGraph MCP 未初始化或出错
- **THEN** 系统记录 "CodeGraph not initialized — using Glob/Grep fallback" 后降级为 Glob 文件结构发现与 Grep 符号搜索，继续探索不阻塞；在 status 返回不可用前不得使用 Glob/Grep 做符号/文件调查

### Requirement: tr-impl-workflow 提案内联生成阶段

技能 SHALL 执行预迁移验证（探索文件存在、CONTEXT.md 校验同步、最少节 Background+Decisions 验证；缺失文件时呈现 Option A 从探索记忆新建 / Option B 中止返回探索由用户必选）、Pending 含影响符号时自动执行影响分析（`codegraph_impact` upstream maxDepth 3，≥2 个符号并行发出查询）、经 `venus spec new "<change-name>"` 创建变更并将探索文件迁移为 `openspec/changes/<change-name>/exploration.md`（**迁移后保留源文件不删除**——用户裁决统一行为）、遵循 `openspec/rules/artifact-generation.md` 共享协议内联生成全部制品（探索内容按映射表提取：Decisions→proposal、Analysis→design、Questions→specs、Codebase Findings→tasks；生成前扫描规则文件并将 context/rules 注入为 AI 约束不写入输出；禁止 Skill 委托生成制品）、CLI 降级（首个 `venus spec status` 调用 command-not-found 签名失败→一次声明进入降级模式：内置依赖顺序 proposal→specs→design→tasks、文件存在性状态推断、流内不重试 CLI）、生成后执行制品 schema 验证（proposal 四节、specs 的 `#### Scenario:` 4 hashtags + WHEN/THEN/AND、tasks checkbox；关键错误必修复，警告用户可选现在修/带警告继续/重新生成）。

#### Scenario: CLI 缺失时降级生成

- **WHEN** 首个 `venus spec status` Bash 调用失败且错误含 "command not found"/"不是内部或外部命令"/"not recognized" 之一
- **THEN** 系统一行告知 "venus CLI not found in PATH — switching to CLI-degraded generation mode" 后按内置依赖顺序纯 AI 生成全部制品，流程内不再尝试 `venus spec status`/`venus spec instructions`，结束时声明恰好一次降级提示

#### Scenario: 探索文件迁移保留源文件

- **WHEN** 变更目录创建完成、探索文件迁移为变更目录内 exploration.md 成功
- **THEN** `openspec/explorations/<keyword>-explore-<NNN>.md` 源文件保留在原位置不删除（用户裁决统一为保留行为）

### Requirement: tr-impl-workflow 自动验证门与深度复查联动

技能 SHALL 在全部 applyRequires 制品完成后自动进入验证（跳过 [立即验证]/[跳过验证] 选择）、先运行 `venus spec status --change "<name>" --json` 解析状态再经 Skill 工具调用 `venus_spec_verify_proposal` 技能评分（技能不可用时 fallback AI 内联评分并 WARN，绝不静默跳过）、按统一 90% 阈值处理：PASS 后自动调用 `venus_tr_impl_review_proposal` 技能执行深度复查（技能为主；技能不可用 fallback 主工作流内联只读深度复查并 WARN）→ 复查完成后自动经 Skill 工具非交互调用 `venus_tr_docs_requirement_doc` 生成需求文档（Markdown + 占位符基本信息，输出 `openspec/changes/<change-name>/需求文档.md`；生成失败 WARN 记原因并继续工作流）；FAIL 时不生成需求文档，逐失败维度自动生成修复建议并 Edit 应用后自动重跑验证，仍失败呈现三选项（手动编辑/返回探索/查看 diff），无跳过到实现的路径。

#### Scenario: 验证通过后技能链联动

- **WHEN** 验证评分 Overall ≥90%（全维度 PASS）
- **THEN** 系统自动调用 `venus_tr_impl_review_proposal` 技能深度复查，复查完成后非交互调用 `venus_tr_docs_requirement_doc` 生成 `需求文档.md` 并向用户展示文档路径，全程无用户提示

#### Scenario: 验证失败自动修复循环

- **WHEN** 任一维度评分 <90%
- **THEN** 系统不生成需求文档，自动生成该维度的具体修复（如 D4 缺边界场景→补充场景）、Edit 应用到制品文件、自动重跑验证并显示修复汇总；重跑仍失败时呈现 [1] 手动编辑 [2] 返回探索 [3] 查看详细 diff 三选项

### Requirement: tr-impl-auto-workflow 全自动管线

技能 `venus_tr_impl_auto_workflow` SHALL 执行五阶段全自动管线：Phase 1-3 与 tr-impl-workflow 同构（精简版探索 + 内联提案生成 + 自动验证，探索文件迁移保留源文件）；Phase 4 验证通过且需求文档生成后自动进入 auto-apply（构建 `auto-mode=true` + change-name 上下文，执行 `venus_spec_apply` 的 Step 6+ 批次调度行为，跳过设计确认门）；Phase 5 apply 完成且编译检查通过后自动进入 auto-archive（构建 change-name 上下文跳过变更选择提示，执行 `venus_spec_archive` 模板全部步骤：delta spec 合并、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、目录移动、ARCHIVE-INDEX.md 更新）。错误处理 MUST 遵守：编译检查失败经 3 次自动修复尝试后暂停等待用户指令不进归档；子代理失败自动重试一次、再失败暂停报告；用户中断时完成当前批次、剩余任务标记未完成后暂停；归档 delta spec 冲突带标记自动合并（非阻塞）；CONTEXT.md/探索记忆同步失败 WARN 继续；CodeGraph 未初始化跳过继续；归档目标已存在报错建议改名。

#### Scenario: 验证通过直通 apply 与 archive

- **WHEN** Phase 3 验证 Overall ≥90% 且需求文档生成完成
- **THEN** 系统宣布进入 Auto-Apply Phase 并以 auto-mode=true 执行实现（不呈现设计确认门），apply 完成且编译检查通过后自动宣布进入 Auto-Archive Phase 执行归档，最终输出全 Phase 完成汇总

#### Scenario: 编译检查持续失败暂停

- **WHEN** Phase 4 中编译检查在 3 次自动修复尝试后仍失败
- **THEN** 系统暂停并等待用户指令，不进入归档阶段

### Requirement: tr-impl-debug 强制复现与根因确认门

技能 `venus_tr_impl_debug` SHALL 在修改任何代码前先复现 bug（失败测试复现优先：定位或编写演示 bug 的测试并确认其因报告的原因失败；无法自动化捕获时记录显式编号步骤并经用户确认）；复现无法建立时向用户报告已尝试内容且不凭假设修复；调查阶段 MUST 以 `codegraph_status` 为首动作执行 CodeGraph 分层排查（files→search+context→callers/callees+impact 双向爆炸半径→常规查询无法定位单一高置信根因时条件触发 explore + 6 维根因深度分析），所有发现实时写入诊断记录（每查询步后而非批量）；调查中注入能力记忆（历史边界场景作为根因线索）；根因确认门：单一高置信根因呈现证据获用户确认；多候选或置信不足时 STOP 呈现候选清单+逐候选证据+推荐，用户选择前不修改代码。

#### Scenario: 多候选根因时停止等待选择

- **WHEN** Phase 2 排查后存在两个及以上候选根因且无单一高置信结论
- **THEN** 系统呈现候选清单（逐候选附证据与推荐）并停止，用户选定根因前不进入修复阶段

#### Scenario: 无法复现时不修复

- **WHEN** Phase 1 无法建立失败测试复现且用户无法确认显式复现步骤
- **THEN** 系统向用户报告复现尝试内容后不进入修复阶段（零假设策略）

### Requirement: tr-impl-debug 关联变更判定与调试循环

技能 SHALL 在修复前判定 bug 归属：受影响代码属于 `openspec/changes/` 进行中变更→修复更新该变更；独立 bug→经 `venus spec new "fix-{module}-<topic>"` 新建修复变更；属于 `openspec/changes/archive/`→绝不修改归档目录，新建变更并在 proposal 引用原归档名溯源；调查结论非缺陷→输出诊断报告（症状/排查路径/代码测试证据），不建变更不改代码，工作流结束。修复 MUST 附带强制回归测试（修复前 FAIL、修复后 PASS，tasks.md 缺失则补加，重跑 Phase 1 复现确认）。调试循环：每完成一个修复询问"还有相关 bug 需要修复吗？"，继续则重入 Phase 1（后续 bug 默认同变更修复并呈现关联获认可；用户声明独立变更时收尾当前变更并提示单独调用 debug，不自动新建）；循环中非缺陷发现不阻塞其他 bug；中途退出保留已完成修复、丢弃未完成 bug；连续 ≥5 次迭代建议检查拆分但不强制终止；结束后 Phase 5 编译检查、Phase 6 同步提案、Phase 7 验证各执行一次覆盖全部累计修复。

#### Scenario: 归档变更来源的 bug 只读溯源

- **WHEN** 受影响代码属于 `openspec/changes/archive/` 下的归档变更
- **THEN** 系统不修改归档目录任何文件，新建变更并在其 proposal.md 中引用原归档变更名以保持可追溯性

#### Scenario: 调试循环汇总收尾

- **WHEN** 用户在循环确认中回答"没有"（无更多相关 bug）
- **THEN** 系统执行一次覆盖全部累计修复的编译检查（`openspec/config.yaml` compileCheck 配置驱动，禁用或未配置默认跳过）、同步提案（proposal 按bug组织根因与修复、tasks 勾选与回归任务、design/specs 按需更新、全部根因分析持久化到 exploration.md、格式校验）、调用 `venus_spec_verify_proposal` 验证（FAIL 自动修复循环；PASS 后非交互调用 `venus_tr_docs_requirement_doc` 生成需求文档）

### Requirement: tr-docs-requirement-doc 双执行模式与八章节转换

技能 `venus_tr_docs_requirement_doc` SHALL 支持双执行模式：standalone 直接调用时经 AskUserQuestion 收集 4 项全部可跳过的基本信息（需求编号 REQ-YYYY-XXX / 需求名称 / 交付时间 YYYY-MM-DD / 原始需求可选粘贴），跳过项用占位符；被工作流非交互调用时不问任何问题直接用占位符。制品定位按顺序搜索（活跃变更目录→归档变更目录→用户指定路径）并记录归档状态三态。转换 MUST 遵守：八章节按映射表从制品提取（proposal.md Why+What Changes / design.md Decisions+Non-Goals / tasks.md / specs/*.md）；需求理解按四类场景分组（管理配置/业务使用/后台任务/AI 智能，单个场景 >8 功能点拆子场景，功能点描述业务逻辑不写类名/方法名/字段名）；非本期范围仅含明确不做/超出边界/无实现计划项；技术栈无关检测（`openspec/config.yaml` context + 项目文件佐证）；不适用章节输出"本变更不涉及"绝不输出空表格；伪代码注入规则（```pseudocode 语言无关结构 + 中文对象.属性表达式、≤15 行/块且 ≤3 块/节、超限保多分支决策>核心算法/数据流>循环/批处理优先级、块首 `// 来源:` 注释可回溯、绝不使用真实类名/方法名/字段名、无可推导逻辑不生成空块）；DDL 提取不虚构制品中不存在的表或列（缺口标 [待确认]）；图用 ASCII 方框箭头字符且节点业务语义命名。输出路径 MUST 按归档状态路由：active→`openspec/changes/{change-name}/需求文档.md`；archived→`openspec/devdocs/{date}-{change-name}-需求文档.md`（date 从归档目录名 YYYY-MM-DD- 前缀解析，无可解析前缀回退无时间戳路径）；目标目录缺失则创建；目标文件已存在时静默覆盖（幂等，不阻塞提问）。

#### Scenario: 非交互模式占位符生成

- **WHEN** 技能被 tr-impl-workflow / tr-impl-debug 的验证通过环节以非交互模式调用
- **THEN** 系统不提出任何问题，基本信息使用占位符，按制品内容生成完整八章节 Markdown 需求文档并写入按归档状态路由的输出路径

#### Scenario: 伪代码块约束

- **WHEN** design.md 含可推导的多分支决策逻辑且转换到"四、业务流程"章节
- **THEN** 生成的伪代码块不超过 15 行且语言无关（IF/THEN/ELSE/END IF/FOR EACH 结构 + 中文业务语义对象.属性表达式），块首注释标注 `// 来源: design.md 决策 #N`，不含任何真实类名/方法名/字段名

### Requirement: tr-impl-review-proposal 提案完整性复查

技能 `venus_tr_impl_review_proposal` SHALL 执行提案完整性复查：经 `venus spec status --change --json` 加载变更后实际阅读相关代码（调用链分析：入口点/业务层/数据层/跨模块；数据流分析：输入来源/中间处理/输出去向/异常分支；现有实现模式分析确保提案与项目模式一致）；按 8 个维度执行完整性检查（参数配置、输入输出、数据库操作、前端交互、错误处理、日志记录、安全性、兼容性——每维度按场景-检查点-常见遗漏清单逐项验证）；执行实现合规性验证（技术栈合规对照 config.yaml、架构分层合规、命名规范、数据库操作合规）；执行特殊功能场景检查（导出功能：导出 SQL 与列表 SQL 条件一致、大数据量分批、字段完整、文件名时间戳、UTF-8 编码、敏感脱敏）与页面设计细节、逻辑实现细节检查；输出量化评分与 10 节检查报告；发现遗漏场景时更新文档补充 `#### Scenario:`。检查点表述 MUST 语言无关化，Venus4A 特有检查（IE 兼容、DataStore/DataObject、Log4j 1.2.x 等）保留为 Java 项目专项检查（用户裁决）。

#### Scenario: 调用链未覆盖时判定提案不完整

- **WHEN** 提案涉及的核心功能在深度代码库探索中发现存在提案未提及的 DAO 层方法调用
- **THEN** 系统在检查报告"深度探索发现"节记录该遗漏，并在"建议补充的 Scenario"节给出应补充的规格场景

#### Scenario: 技能为主的验证联动

- **WHEN** tr-impl-workflow 的 Phase 3 验证 Overall ≥90% 通过
- **THEN** 工作流调用本技能执行深度复查；本技能不可用或调用失败时主工作流 fallback 为内联只读深度复查并 WARN，不静默跳过复查环节

# 项目领域术语表（CONTEXT.md）

> 探索与变更过程中沉淀的统一语言。修改术语前先在本表核对。

**spec 技能**：venus 中规格驱动工作流的技能类别：type='spec'，技能名 venus_spec_* 前缀，含 explore/propose/apply/archive/bulk-archive/verify/verify-proposal 七个技能。
_Avoid_: spec skill（英混）、openspec 技能

**venus spec 命令组**：venus CLI 的 spec 子命令（new / status / instructions / archive），自研实现，替代对 openspec CLI 的依赖。
_Avoid_: spec CLI、openspec CLI 命令（迁移后语境）

**变更（change）**：openspec/changes/&lt;name&gt;/ 下的规格驱动工作单元，含 proposal/design/specs/tasks 等 artifact。
_Avoid_: 任务、issue

**artifact**：变更内的制品文件（proposal / specs / design / tasks），存在 requires 依赖顺序，由依赖图拓扑排序决定生成次序。
_Avoid_: 文档、deliverable

**delta spec**：变更内 specs/&lt;capability&gt;/spec.md 的增量规格（ADDED/MODIFIED/REMOVED/RENAMED 标注），归档时合并到主 spec。
_Avoid_: 增量文档

**主 spec**：openspec/specs/&lt;capability&gt;/spec.md 能力规格，delta spec 的合并目标。
_Avoid_: 规格主文件

**探索文件**：openspec/explorations/*.md 是探索期的**暂存**探索记录；提案生成时**移动**（非复制）为变更目录的 exploration.md，移动成功且目标校验通过后删除暂存区源文件（流程中只保留一份）；移动失败保留源件。MUST NOT 追溯搬迁或删除规则生效前的历史文件。
_Avoid_: 探索文档

**能力探索记忆**：openspec/specs/&lt;capability&gt;/explorations.md 归档时累积的决策/术语/边界记忆，冲突时标"已过时"不删历史。
_Avoid_: 能力记忆

**依赖图**：venus CLI 内置硬编码的 spec-driven artifact requires 关系（proposal→specs/design→tasks）与拓扑顺序。
_Avoid_: build graph、schema.yaml（venus 不读取）

**前置验证门**：spec-verify-proposal 技能的 D1-D9 量化评分机制（90% 阈值），在提案后、实现前执行，被 spec-propose 引用。
_Avoid_: verify-before-apply（源项目旧名）

**后置验证**：spec-verify 技能的 Completeness/Correctness/Coherence 三维度检查，在实现后、归档前执行。
_Avoid_: verify-change（源项目旧名）

**workflow**：venus 可安装的技能+指令成对单元，id 由技能名派生（去 `venus_` 前缀 + 下划线转连字符，如 `venus_spec_explore` → `spec-explore`），共 27 个。技能名中的类型段非必需——类型语义以 frontmatter `metadata.type` 为准，名字可省略类型段（如 `venus_release_package` → `release-package`，type 仍为 `tr_release`）。
_Avoid_: 工作流（歧义时）、workflow id 混用技能名

**默认集**：`.venus/config.yaml` 未配置 `workflows` 时的生效 workflow 集（DEFAULT_WORKFLOWS，8 项：tr-init-project + tr-test-generate + spec 全 6）。
_Avoid_: core profile（OpenSpec 概念，venus 不用）、基础集

**workflows 字段**：`.venus/config.yaml` 中声明本项目要安装哪些 workflow 的列表字段，与 rules 字段正交（rules 管规则注入，workflows 管装哪些）。
_Avoid_: profile 字段、workflows 配置项（口语混称）

**依赖注入**：生效 workflow 集的自动补全机制——选了 spec-propose 自动补 spec-verify-proposal，选了 spec-archive 或 spec-bulk-archive 自动补 spec-verify，选了 tr-impl-auto-migration 自动补 tr-docs-feature-doc 与 tr-impl-migration-check；spec-apply 不注入。
_Avoid_: 自动补全（过于宽泛）、隐式依赖

**迁移技能套件**：从源项目（OpenSpec）迁移的三个可选扩展技能——tr-docs-feature-doc（源项目扫描生成需求文档，type tr_docs）、tr-impl-migration-check（迁移后六层一致性检查）、tr-impl-auto-migration（一站式迁移编排），均不入默认集，经 workflows 字段勾选或依赖注入安装。
_Avoid_: migration skills（英混）、OpenSpec 技能（源项目语境）

**蒸馏确认门**：auto-migration 编排技能 Phase 1 的需求澄清门（确认 WHAT）——从源需求文档蒸馏核心功能清单请用户确认（可裁剪、空清单阻断、写入变更 exploration.md），区别于 Phase 3 实现确认门（流程门，确认 HOW）。
_Avoid_: 蒸馏门（口语简称）、与前置验证门混淆（后者是 spec-verify-proposal 评分机制）

**提示词校验门**：5 个工作流技能（explore / workflow / auto-workflow / debug / genfull）在探索动作之前执行的入口校验——按清晰度维度自检用户输入，清晰则一句话复述理解后直通（零打扰），不明确则先做提示词优化（输出【优化后提示词】与【优化说明】，推断项标 [推断]、未知项标 [待确认]）并阻塞等待用户确认或修改；调试技能改用缺陷五维。文本单一源为 `src/core/templates/prompt-gate.ts`，构建期内联进 5 个技能正文。
_Avoid_: 提示词门（口语简称）、与蒸馏确认门混淆（后者是 auto-migration 内部的需求蒸馏）、与前置验证门混淆（后者是制品评分机制）

**提示词基线**：经提示词校验门确认后的提示词版本，与「原始提示词」一并写入探索产物的 `## 提示词基线` 段；下游（提案 / 设计 / 规格 / 任务）以基线为唯一语义来源，基线变更须回到校验门重新确认。保留原始提示词供审计优化是否篡改用户意图。
_Avoid_: 优化后提示词（仅指门的输出物，非落盘产物）、需求基线（无此术语）

**清晰度维度**：提示词校验门的判定维度集——需求版六维（目标 / 对象 / 范围 / 约束 / 验收 / 歧义），缺陷版五维（症状 / 复现步骤 / 期望 vs 实际 / 环境 / 歧义）；其中不计入硬不明确判据的维度（需求版的约束与验收、缺陷版的环境）缺失时不阻断。
_Avoid_: 检查清单（过于宽泛）、歧义等级（含义不同）

**B组架构融入检查**：迁移检查中叠加的三项架构一致性检查——C11 残留源项目错误处理体系（P0）、C12 重复实现目标项目已有工具（P1）、C13 分层/命名/目录约定一致性（P2），与 C1-C6 对抗检查互补，语言无关表述。
_Avoid_: B组检查（无上下文简称）、group-B checks

**reconcile 扫描**：init/update 检测已安装但不在生效集内的 venus 产物，保留不删仅输出提示（引导 venus uninstall 或手动删除）。
_Avoid_: 对账（口语）、自动清理（行为相反）

**tr_test**：venus 技能生命周期类型，测试相关技能（编写用例、运行测试、覆盖率检查）。v3.0 起采用多 schema 模式：`venus_tr_test_generate` 主 SKILL 语言无关，语言专属内容（Java 的 JUnit/Mockito、Node 的 Vitest/Jest）拆为 `references/schema-*.md` 按检测结果按需 Read。v3.0 由原 `tr_test`（TS 专属）与已删除的 `tr_test_gentest`（Java 专属独立类型）合并而来。v3.1（2026-09-28）新增测试层级路由、该不该测闸门、用例优先级分级、用例去重与合并、覆盖度度量，并修正 BCDE 示例标注、废除固定场景配额。
_Avoid_: 测试类型（宽泛）、按语言拆分独立类型（v3.0 已合并为多 schema）

**tr-test-generate**：`venus_tr_test_generate` 的指令 id，多 schema 测试生成——自动检测 Java（Maven/Gradle）或 Node（Vitest/Jest/Mocha）项目并加载对应 schema。v3.0 合并了原 `/venus:tr-test-gentest-java`（已移除）。在 DEFAULT_WORKFLOWS 中显式声明。
_Avoid_: tr-test-gentest-java（已废弃，合并为 tr-test-generate 多 schema）、java-test（未规范 id）

**批量归档技能**：venus_spec_bulk_archive（从 OpenSpec bulk-archive 迁移），单次操作批量归档多个已完成变更——多选、批量状态收集（并行只读子代理 ≤3）、spec 冲突代码库证据三分支裁决、三阶段分层并行归档（失败隔离）、ARCHIVE-INDEX 主代理单点更新、CodeGraph 项目级单次同步；不入默认集，经 workflows 勾选安装（依赖注入 spec-verify）。
_Avoid_: bulk-archive（源项目旧名）、批量归档命令（它是技能非 CLI 子命令）

**工作流技能套件**：从源项目 OpenSpec 迁移的 5 个工作流编排技能——tr-impl-workflow（结构化探索→内联提案→验证→深度复查收束（需求文档由归档阶段生成））、tr-impl-auto-workflow（+auto-apply/auto-archive 全自动管线）、tr-impl-debug（复现-排查-关联-修复-循环-收尾调试闭环）、tr-docs-requirement-doc（八章节评审需求文档转换）、tr-impl-review-proposal（8 维度提案完整性复查）；均不入默认集，经 workflows 勾选或 DEPS 注入安装。
_Avoid_: workflow skills（英混）、openspec 工作流技能（源项目语境）

**制品生成协议**：openspec/rules/artifact-generation.md 的共享 G1-G3 制品生成协议，供 tr-impl-workflow（内联）与 venus_spec_propose（独立）共同引用——G1 创建变更目录、G2 按依赖序循环 status/instructions 生成、G3 终态确认；context/rules 为 AI 约束不写入输出。
_Avoid_: artifact 协议（口语简称）、generation protocol

**双模板漂移**：spec-*.ts 中 skill instructions 与 command content 两份手工维护字符串产生内容不一致的现象（2026-09-14 对比 OpenSpec v1.1.20 时实录 4 处，含 1 处防护语句缺口），由 AGENTS.md 修改守则第 7 条约束双写。
_Avoid_: 模板漂移（口语）、template drift

**单一 prompt 源**：防漂移方案——模板正文仅维护 skill 版一份作为唯一源，command 压缩版由代码从源派生生成，消除手工双写。2026-09-14 决策接受，2026-09-16 随 refactor-spec-workflow-template-single-source 归档落地（command 版由 derive-command.ts 派生）；2026-10-17 随 improve-template-language-consistency 由 8 个模板（project-init + 7 spec）**全量收束至 20 个内置配对**。
_Avoid_: 单源模板（口语）、single prompt source

**派生函数 (deriveCommandContent)**：`src/core/templates/derive-command.ts` 的纯函数——输入 skill instructions 唯一源正文，按段落级 HTML 注释标记 `<!-- CMD:SKIP -->` / `<!-- /CMD:SKIP -->` 裁剪仅 skill 版可见段落、未标记段落默认保留进 command 版（fail-safe，防漏标致防护语句缺失），输出时剥离全部标记注释。**全部 20 个内置配对**的 command content 均由此派生（2026-10-17 起全量收束），模板派生一致性测试（test/template-derivation.test.ts）保证源码无第二份手工正文。
_Avoid_: 派生器、command 生成器（那是 command-generation 产物层，非模板派生层）

**skip_specs**：变更在 `.openspec.yaml` 声明的可选布尔字段（缺省 false），对齐源项目 OpenSpec v1.1.20 语义。声明时 specs artifact 视为 `skipped` 满足态（与 done 等价满足下游依赖但不创建 delta spec 文件），适用于纯代码/纯文档变更；声明但 specs/ 下仍存在文件时报 conflict 态。
_Avoid_: 跳过 specs（口语）、skip-specs（连字符形式）

**提案**：OpenSpec 变更的 proposal.md artifact，自动打包技能第3部分（升级信息归集）的变更来源输入——从提案的 design/tasks 抽取 SQL 与配置说明，与打包产出文件交叉归集。
_Avoid_: 提案文档（口语）、proposal（英混时与 artifact 概念混）

**升级文档**：自动打包技能阶段四输出物，落位于打包产出目录的 `升级文档.md`（与 readme.txt/filelist.txt 同级），归集本次增量包待执行 SQL（四源：产出 .sql 文件、Java/Mapper XML 内嵌、db/migration 目录、提案 tasks [DB脚本] 标记）与待变更配置参数（三源：产出配置文件、提案声明配置项、特定配置文件），供运维升级部署使用。
_Avoid_: 升级说明（口语）、release notes（非同义，后者是版本日志）

**打包运行时路径**：auto-package.sh 及其运行时（auto-package.conf + lib/ecj-4.6.3.jar）所在目录，由 `.venus/config.yaml` 的 `auto_package.runtime_dir` 字段配置，默认 `vendor/auto-package-svn`（项目内备份）。auto-package.sh 自包含（`SCRIPT_DIR=$(dirname BASH_SOURCE)` 定位同目录 conf 与 lib/ecj jar），保持目录结构即可在任意路径工作。技能阶段二读此配置解析运行时目录，不写死路径。
_Avoid_: 打包脚本路径（口语）、auto-package 目录

**venus_tr_commit_push**：从源 SKILL tr-commit-push 迁移的 SVN 交互式提交技能（type=tr_commit，指令 /venus:tr-commit-push），四环节强制确认 + 提交范围排除 + 凭据/编码处理 + 提案分类提交；与现有 venus_tr_commit_change（Git 版）并存，按 VCS 划分职责，均不入默认集。
_Avoid_: tr-commit-push（口语混称源 SKILL）、SVN 提交技能（宽泛）

**提案分类提交**：venus_tr_commit_push 的核心功能——根据点名提案将工作区变更自动归类为功能代码/测试代码/文档三类（路径优先规则：src/test/** 归测试、docs/** 归文档、openspec/ 制品归文档，其余按扩展名），分类分批提交；提案关联校验为提交前辅助检查（无关联变更列出待用户裁决，不阻断）。
_Avoid_: 自动提交（宽泛，未体现分类）、按类型提交（口语）

**溯源标注**：提案分类提交时附加在提交信息尾行的 `提案: <变更名>` 标注——主体保持源 SKILL 单行前缀格式，标注独占尾行，便于批量提取提案归属。
_Avoid_: 提案标记、proposal ref（英混）

**功能流程图**：探索阶段产出的结构化中间制品（探索产物 `## 功能流程图` 段）——Mermaid 流程图 + 关键操作节点清单表，描述**被探索功能自身的业务操作/处理流程**；经流程最终确认门确认后成为 propose / verify 的流程基准。5 个技能中 4 个流程技能强制产出，`venus_spec_explore` 条件触发（无流程时记"本次无功能流程"直通）。
_Avoid_: 流程图（无上下文简称）、业务流程图（那是 tr-docs-requirement-doc 从 design.md 派生的下游表达）、架构图

**关键操作节点**：功能流程图中的最小可验证操作单元（一次用户操作 / 业务判定 / 数据写入 / 外部调用），节点 id 形如 `N<序号>` 在 Mermaid 图与清单表中稳定一致，且**必须**可追溯代码证据（`文件:行`）；新建功能节点标 `[新建]` 并写明预期产物，不要求预测文件路径。
_Avoid_: 步骤（口语）、任务（与 tasks.md 混淆）

**流程最终确认门**：探索阶段末尾对功能流程图与节点清单的阻塞确认门，确认后制品成为流程基准；复用提示词校验门的四条出口模型（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），MUST NOT 死锁。
_Avoid_: 确认门（与提示词校验门混淆）、流程图门（口语简称）

**节点覆盖度**：`venus_spec_verify_proposal` 新增的量化维度——design / tasks 覆盖的节点数 ÷ 流程图总节点数；判定优先按节点 id 显式标注（tasks 任务标 `[N4]`），未标注时允许 AI 语义等价判定；纳入 90% 统一阈值、同权重。无 `## 功能流程图` 段的变更该维度 SKIP（不计入分母）。
_Avoid_: 覆盖率（过于宽泛）、流程覆盖（语义不清）

**流程基准**：经流程最终确认门确认的功能流程图制品，作为**独立于提案自身**的交叉验证锚点——区别于 D9（Business Steps，检查提案自身是否拆解复杂操作的"自证"），流程基准提供"他证"。
_Avoid_: 基线（与提示词基线混淆）、流程图基线

**缺陷链路**：`venus_tr_impl_debug` 的功能流程图变体（探索产物 `## 功能流程（缺陷链路）` 段）——只列缺陷相关节点（前置条件 → 触发 → 异常 → 根因），新增 `🔴异常` / `🟠根因` 标记列；验证口径为修复方案与回归测试是否覆盖"异常节点 + 根因节点"，而非全节点覆盖度。
_Avoid_: 缺陷流程（口语）、复现步骤（那是 debug Phase 1 强制复现的另一产物）

**排查深度分级**：`venus_tr_impl_debug` Phase 2 在常规查询（2.2.1–2.2.3）之后、深度探索之前，按 bug 大小与影响范围选定排查路径的判定步骤（编号 `2.2.3.5`，十进制插入不重排既有编号）。属**事前**判定，区别于原 2.2.4「未定位根因才升级」的事后触发。
_Avoid_: 分级门（口语）、探索深度（易与 `venus_spec_explore` 的探索阶段混淆）

**轻量路径（路径 A）**：排查深度分级判为小范围/根因显式时采用的路径——止步于 2.2.1–2.2.3 常规查询，不执行 6 维根因深度分析。仍须产出 2.5 缺陷链路图（与分级解耦）。
_Avoid_: 快速路径、简化模式

**深度路径（路径 B）**：排查深度分级判为大范围/跨模块/根因不明时采用的路径——进入 2.2.4 执行 `codegraph_explore` + 6 维根因深度分析。触发信号三条：爆炸半径超阈 / 跨 ≥2 模块 / 2.2.2 未一步定位根因；CodeGraph 不可用时信号 (a) 降级为 Grep 代理指标，分级仍生效。
_Avoid_: 重路径、完整模式

**升级兜底**：原 2.2.4 的事后触发条件（常规查询未定位单一高置信根因）在分级改造后的角色——作为轻量路径的纠偏出口。**不是独立步骤**：其内容即 2.2.4 深度探索本身，仅触发条件扩展为「深度信号 ∨ 轻量路径未定位根因」。
_Avoid_: 2.2.5（不存在该编号）、兜底步骤（会诱发误建空步骤）

**归档生成制品**：`需求文档.md` 在归档的**预归档检查点**由 `venus_spec_archive`（或 `venus_spec_bulk_archive` 的平行步骤 a.6）从**最终制品**生成，随后随归档目录迁移至 `openspec/devdocs/`；提案校验后各工作流 MUST NOT 生成它。
_Avoid_: 归档产物、文档生成

**人工域**：`需求文档.md` 中由人工填写、重生成时 MUST NOT 覆盖的段落——`## 基本信息`（需求编号/需求名称/交付时间，含占位符状态）与 `## 八、评审记录`；其余一~七章节由制品重新派生。保护动作生效于 `venus_spec_archive` 归档的预归档需求文档生成检查点（步骤 4.8），`venus_spec_bulk_archive` 的 a.6 同语义。界定方式已推广为**显式标记** `<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->`（见「人工域标记」条，用于项目知识文档）；按章节的既有界定**仍然适用**于需求文档（`venus_spec_archive` 的步骤 4.8）。
_Avoid_: 手填段、只读段

**就地增量对齐**：`venus_spec_archive` 归档生成步骤的「已存在」分支在需求文档**已存在**时直接改写该文件的更新方式（`venus_spec_bulk_archive` 的 a.6 同语义）——人工域逐字保留，一~七按当前制品重新派生；区别于调 `venus_tr_docs_requirement_doc` skill 重生成（其侧规则为"目标已存在则静默覆盖"）。
_Avoid_: 覆盖重生成（指 skill 侧静默覆盖行为）、合并（易与 git merge 混淆）


**测试层级（Test Level）**：`venus_tr_test_generate` v3.1 新增的判定维度，取值单元测试（Unit）/ 功能级测试（Functional），与**语言/框架 schema 路由正交**——语言维度决定"用什么框架写"，层级维度决定"测到哪一层"。判定依据按序命中：功能入口 → 功能级；跨 ≥2 组件协作 → 功能级；其余 → 单元。项目缺功能级工具链（Java 无 `spring-boot-starter-test`、Node 无 `supertest`）时降级为单元并提示，MUST NOT 生成无法运行的代码。
_Avoid_: 测试类型（易与框架类型混淆）、测试范围

**该不该测闸门 / 不测清单**：`venus_tr_test_generate` v3.1 在场景设计**之前**的判定环节，含一份不测清单（纯数据类的取值读写方法、无分支的转发方法、私有方法、框架生命周期回调、自动生成的代码）。落入清单的目标不进入 BCDE 场景设计，且 MUST 输出"已评估、判定不生成测试"的结论与依据——**不得静默跳过**，使"没写测试"与"没评估过"可区分。
_Avoid_: 测试豁免（暗示豁免权而非判定结论）

**用例优先级分级**：`venus_tr_test_generate` v3.1 的用例三级标注——P0 核心业务链路（必生成）/ P1 常规业务（默认生成）/ P2 边界补充（**需显式确认才生成**）。分级**影响生成决策**而非仅作标注，是把"减少低价值用例"落成机制的执行手段。
_Avoid_: 用例权重（易误解为执行顺序）

**覆盖度度量**：`venus_tr_test_generate` v3.1 在运行验证后输出的度量，走两条路径——优先**实测**（Java JaCoCo / Node c8 或 coverage），无工具链时降级为**静态「规格场景 → 用例」映射矩阵**。降级结果 MUST 显式标注"未实测覆盖度"，MUST NOT 被表述为实测数据；两种路径都必须列出未覆盖清单，MUST NOT 仅给百分比。
_Avoid_: 覆盖率（易被误读为仅指实测行覆盖）

**`[测试]` 任务标签**：tasks.md 的一等任务类型标签，与 `[代码]` / `[DB脚本]` / `[使用说明]` 并列四类。带**层级**（`[单元]`/`[功能]`）与**优先级**（`[P0]`/`[P1]`/`[P2]`）子标注，形如 `- [ ] [测试][单元][P0] 3.1 ...`。`tr-commit-push` 早已按该标签工作，但此前无任何模板产出它——2026-09-28 由 `improve-tr-test-generate-case-rationalize` 拉通三处口径。归档摘要的补充标注按**标签白名单**识别（MUST NOT 用"收集所有方括号"实现，否则子标注会被误收为任务类型）。
_Avoid_: 测试任务（泛指）、`[单元]`/`[P0]` 当作独立任务类型

**测试执行关卡**：`venus_spec_apply` 在编译检查（Step 8，保持 `-DskipTests`）**之后**新增的独立关卡（Step 9）。与编译检查**刻意分离**——编译失败是硬错误，测试失败可能是存量红/断言不符/环境问题，需不同处置分支。判定边界为**仅变更范围**（`[测试]` 任务产出 + 变更文件的既有测试）：范围外存量失败仅 WARN 不阻塞（存量已红的项目很常见，全量判定会让关卡不可用而促使绕过）；范围内失败自动修复重试上限 3 次后暂停且不进入归档；项目无测试框架时降级 WARN 跳过。`tr-impl-auto-workflow` Phase 4 继承并自动通关。
_Avoid_: 测试门（易与确认门混淆）、全量测试检查

**派发单元（dispatch unit）**：`venus_spec_apply` 批次调度中由一个子代理串行实现的同组任务集合（同 `group` 标签的任务聚合而成）；并发上限约束的是同时运行的**派发单元**数。2026-09-28 由 `improve-workflow-subagent-resource-sharing` 首次写入规格（此前派发协议零规格覆盖）。
_Avoid_: 任务组（易与 tasks.md 的 `group` 字段混淆）、子代理（那是执行者，非任务集合）

**共享上下文包（context pack）**：协调者在首次派发前**一次性**产出的紧凑上下文制品 `context-pack.md`，落于流程级临时工作区 `.openspec-tmp/apply-<change-name>/`；含六节 —— `## 变更摘要` / `## 契约` / `## 规范要点` / `## 文件归属表` / `## Codebase 摘要` / `## 已产出（跨单元可见）`。**子代理的唯一必读制品**；产出后只追加登记表，不重产整包。
_Avoid_: 上下文文件（歧义）、prompt 缓存（那是提供方机制）

**产出登记表（output ledger）**：上下文包内的 `## 已产出（跨单元可见）` 节——每批完成后协调者**追加**该批产出文件与公开签名，使后续批次子代理无需重扫代码即可获知前序产出（消除跨波次重复探索）。
_Avoid_: 进度表（那是 tasks.md 的职责）、变更日志

**回执最小化**：子代理的单元完成回执固定四列 `<任务 id> | <状态> | <产出文件> | <公开签名>`，**MUST NOT 粘贴代码正文**；失败任务仍 MUST 含失败原因摘要。其中**公开签名**指该单元产出中可被其他单元引用的符号签名（函数/方法/类型/接口/导出常量/CLI 命令），无则记「无」（不留空、不编造）。
_Avoid_: 完成报告（易理解为含详述）

**共享指令前缀**：调度指令结构中**单元无关**的部分（包路径 / `## 规范要点` 引用 / 回执格式 / 禁止项）固定置于前缀位，单元差异（本单元任务清单）后置，使前缀在同一流程内跨派发**字节一致**（为提供方前缀缓存创造条件，不承诺命中）。
_Avoid_: 模板（那是载体，非结构约定）

**包缺口回执**：子代理发现上下文包未覆盖其所需信息时，补查后 MUST 在回执中回报的字段——列出"缺什么、补查了什么"；协调者据此回填包（回填失败仅 WARN 不阻断）。同时确立**包是制品的蒸馏视图而非替代品**——缺项时 MUST 补查制品本身，MUST NOT 凭包猜测字段或契约。
_Avoid_: 异常报告（那是失败路径）

**探查摘要（investigation digest）**：`venus_tr_impl_debug` 的流程级探查缓存 `.openspec-tmp/debug-<keyword>/investigation-digest.md`（`<keyword>` 为调试主题的 kebab-case 关键词，与探索文件关键词同规则）——Phase 2 起始**先读复用**、仅做**增量查询**、逐步骤**增量写入**；修复改动代码后受影响范围标 `> 已失效（由 <bug 标识> 修复改动代码）` 并重新查询；Phase 7 收尾统一清理。**仅为流程内缓存**，不替代诊断记录与 Phase 6 对 `exploration.md` 的持久化。
_Avoid_: 诊断记录（那是 Phase 6 的交付物）、排查缓存（口语）

**工具调用白名单（allowed-tools 白名单）**：技能与斜杠指令 frontmatter 的 `allowed-tools` 取值，是 Claude Code 的**权限放行清单**——列出的工具在该技能/指令被调用的那一轮免审批直通；**未列出的工具仍可调用**（只是需要审批），故它不是限制清单。按「只读检索 + 调用类扩展（CodeGraph MCP / `Skill(...)` 委派 / `Agent, Task` 派发）+ 技能专有条目」三层组合，共享常量单一源为 `src/core/templates/tool-whitelist.ts`；指令侧由 `getCommandTemplates()` 从配对技能单点回填。
_Avoid_: **与「归档标签白名单」混淆**（后者是 tasks.md 任务类型标签的识别白名单，见 spec-workflow-skills 能力规格）、权限白名单（口语，易与 deny 段混淆）

**会话级权限载体**：项目 `.claude/settings.json` 的 `permissions.allow`，由 `venus init` / `venus update` 从技能模板白名单汇总后**非破坏合并**写入（`src/core/permissions.ts`）。存在的理由：frontmatter 的授权**仅覆盖调用当轮**、用户下一条消息即释放，跨轮次长管线需要会话级放行。语义为「不删既有条目、不碰 `deny`、过滤 `Bash(*)` 一类全量放行条目、既有文件非法 JSON 时保留原文件仅告警、幂等」。
_Avoid_: 全局权限（它只作用于本项目的会话，非全局）、白名单文件（载体是设置文件的 allow 段，非独立文件）

**项目扫描（project scan）**：`venus init` 与 `venus_tr_init_project` 协同的「项目知识文档沉淀」能力总称，含**确定性预扫描**（CLI 侧）与**语义扫描**（技能侧）两段，产出五类文档 + 索引 + `AGENTS.md`。
_Avoid_: 项目分析、代码扫描（歧义，易与 codegraph 索引混淆）、与 **reconcile 扫描**混用

**确定性预扫描（deterministic pre-scan）**：`venus init` 由纯 Node 代码执行的**机器可判定事实**提取（标志文件 / 构建设施 / 目录骨架 / 依赖清单 / 配置键名 / 路由声明位置），产出**扫描基线**。不做语义判定、不执行项目内脚本、**只输出键名与路径 MUST NOT 输出取值**。
_Avoid_: CLI 扫描（口语）、静态分析（易误解为代码级分析）

**扫描基线（scan baseline）**：确定性预扫描的产物 `.venus/scan-baseline.json`（本机产物，不入库）。定位为**给技能读的脚手架**——免去技能重复机械探测，非交付物。
_Avoid_: 扫描结果（歧义，那指五类文档）、缓存（它非纯缓存，含负向结论）

**信号与候选（signal / candidate）**：扫描器输出的**判定层级**——「信号」= 观察到的事实（发现 `build.xml`）；「候选」= 可能的技术栈线索（发现 `spring-2.0.5.jar`）。扫描器 MUST NOT 输出框架结论（实测某项目有 spring jar 但源码仅 1 处 import，机械判定必误报）。
_Avoid_: 检测结果（混层）、框架判定（那是技能职责）

**人工域标记（manual-zone marker）**：`<!-- 人工域:开始 -->` … `<!-- 人工域:结束 -->` 成对注释，界定文档中逐字保留的段落；未标记段落一律可重派生。机制与 `derive-command.ts` 的 `<!-- CMD:SKIP -->` 同构，渲染时不可见。破损情形一律取**保留侧**（未闭合保留至文末、嵌套乱序保留最外层最大连续区间，均记 WARN）。
_Avoid_: 保护标记（与指纹手改保护混）、注释块

**不适用类（not-applicable category）**：五类中因项目中无对应内容而不生成文档的类（如纯前端项目无数据库）；索引 MUST 列出该类并标「不适用 + 探测依据」，使「没探测到自己」与「没评估过」可区分。
_Avoid_: 空类、跳过项

**JSON 主产物（change.json）**: 变更制品的结构化真源——proposal/design/specs 三段合并存储于变更目录 `.venus/change.json`（schema `venus/change/v1`），Markdown 制品（proposal.md / design.md / specs/*.md）由 `venus spec render` 从该文件确定性渲染产出（JSON-first）；tasks.json 独立保存于变更目录根。v1.13.0 起取代旧的「JSON Sidecar」四文件加速层（manifest/decisions/capabilities 标废弃，仅保留降级读取）。
_Avoid_: JSON Sidecar（旧四文件模型）、JSON 加速层

**jsonTemplate**: `venus spec instructions <artifact-id>` 输出中的 JSON schema 示例字段（机器源）——AI 写 change.json 段 / tasks.json 时按其字段与约束执行；MD `template` 仅渲染不可用的降级手写时参照。
_Avoid_: JSON 模板（易与 MD template 混淆）

**降级链（读取链）**: 消费方读取变更结构化数据的优先次序——`.venus/change.json` 对应段 → 旧 JSON（manifest/decisions/capabilities）→ MD 散文解析，逐级 WARN、不阻断流程。
_Avoid_: fallback（英混）、回退路径（歧义）

**SQLite Cross-Change Index（已退役，DEC-2）**: 历史上用于归档变更后写入变更/能力/决策/需求/探索记忆索引、供探索和提案阶段快速搜索的本地 SQLite 数据库；跨变更索引能力已整体退役（命令、模块、依赖一并移除），历史索引库不由本工具删除，检索改用 Glob/Grep 与 `openspec/specs/<capability>/explorations.md`。
_Avoid_: SQLite 索引 / 跨变更检索

**SkillTemplate.references**: 技能模板的附加参考文件机制，将大体积文本段（Gate 全文、检查矩阵等）拆分为独立 `references/*.md` 文件，AI 按需读取。由 `writeSkillReferences` 写入，`syncReferences` 管理生命周期。
_Avoid_: references 机制 / 技能参考文件

**MemoryBackend（已退役，DEC-2）**: 历史上提供的 SQLite 内存后端（测试用），随跨变更索引能力退役一并删除。
_Avoid_: 内存后端 / 测试 SQLite

**需求文档生成时机**: SKILL 工作流中需求文档的生成时间点——当前为提案验证通过后（Phase 3 / Stage 2 收束阶段），归档阶段做增量对齐或后向兼容生成。
_Avoid_: 归档时生成需求文档 / requirement doc at archive time

**探索指南（exploration-guidance）**: `iagent_spec_explore` 的 `references/exploration-guidance.md`，承载源自上游 OpenSpec `openspec-explore` 的探索散文（The Stance / What You Might Do / OpenSpec Awareness / Handling Different Entry Points / Ending Discovery）；主 SKILL.md 仅保留门控、阶段骨架与指针（行数 ≤250）。
_Avoid_: 探索主文件（那指 SKILL.md 本体）、stance 文档

**门预算（gate budget）**: 每个阶段（探索 / 提案 / 实现 / 归档）至多 **1 个流程级阻塞确认门**；澄清门（提示词/grill）与聚合一致性门不计入流程级门预算（后者默认直通）。探索阶段以功能流程图门为唯一流程级阻塞门；实现阶段为单一「实现 + 测试桥」。
_Avoid_: 确认门数量（泛指，含非流程级）、门上限

**grill 批量确认（batched grill）**: 探索的 L1-L5 追问由逐决策增量门合并为 **≤2 批量确认轮次**（批量 1 = L1-L3、批量 2 = L4-L5），保留最低确认深度 **L3**；L4 无矛盾时自动直通；跳过的层级记入 Pending。每轮内逐条列出待确认项，MUST NOT 静默丢弃。
_Avoid_: 逐级确认（旧行为）、L1-L5 门（旧）

**聚合一致性门直通（aggregate-gate passthrough）**: `iagent_spec_explore` 1.6.6 的 non-blocking 语义——无硬冲突时自动通过并继续（记录日志，**不计入用户停顿**），仅在检测到跨决策硬冲突（技术选型 / 依赖方向 / 约束互斥）时暂停。该门保留为 1.3.4 增量 L4 检查的兜底。
_Avoid_: 一致性检查门（歧义）、自动通过（易与 skip 混淆）

**技能模板语言一致性**：内置技能模板生成产物（`SKILL.md`、`references/*.md`、Claude/Pi/OpenCode 指令正文）的普通解释性自然语言统一为中文，仅保留承载契约与机器语义的「特定描述」（命令、路径、标识符、协议字段、工具名、代码块与规范性固定词）；中文化真源为 `src/core/templates/` 源文本，生成器不引入运行时翻译。2026-10-17 随 improve-template-language-consistency 落地。
_Avoid_: 中英混排修复（口语）、翻译层（那指生成器内翻译，本方案不做）

**语言回归锁（template-language.test.ts）**: 语言边界的回归防线——扫描技能正文、references 与 Claude/Pi/OpenCode 三类适配器产物正文，扣除白名单（围栏/行内代码、标识符、路径、协议词、固定标记、英文触发词）后，同一行出现 **≥3 个连续英文单词**即判违规；另附「已定中文译法术语禁止残留英文形」禁用短语表（如 `Prompt Validation Gate`/`Functional Flowchart`/`MANDATORY CHECKPOINT`）。以生成结果为对象，不只扫 `skills/` 快照。
_Avoid_: 英文检查（过宽）、拼写检查

**canonical workflowId**：工作流的稳定标识，取既有指令 id（commandId）的 kebab-case 形式（如 `spec-explore`）；config workflows、依赖注入、指令引用与宿主产物命名均以它为准。
_Avoid_: 技能名（内部 `iagent_<name>` 仅为模板注册源）、workflow 编号

**宿主技能 ID**：由 canonical workflowId 派生的宿主可见技能标识 `iagent-<workflowId>`（如 `iagent-spec-explore`），用作技能目录名与 frontmatter `name`；旧 `iagent_<name>` 仅作 legacy alias。
_Avoid_: 内部技能名（`iagent_<name>`）、裸 workflowId

**strict 编排**：宿主具备协议要求的全部能力（技能加载、参数传递、委派、回执、门控、状态）时的运行模式，阶段委派与门控使用宿主原生机制。
_Avoid_: 完整模式（口语）、强模式

**degraded 单 agent 模式**：宿主缺少严格编排能力时的显式运行状态；MUST NOT 把本地串行执行标记为委派完成、子 agent 回执或严格 gate 通过。
_Avoid_: 降级模式（未说明单 agent）、静默 fallback

**宿主能力协商（capability negotiation）**：按工作流阶段声明的必需能力与宿主实际能力比对，产出 strict/degraded 与缺失能力清单；strict 缺能 MUST 阻断。
_Avoid_: 能力探测（仅指检测，不含判定）、权限检查

**阶段回执（receipt）**：阶段完成时返回的结构化结果，至少含 `phase` / `status` / 产物位置 / 下一步允许动作 / 失败原因（如有）；回执缺失或不通过校验时不得自动推进。
_Avoid_: 执行报告（口语）、日志（非结构化）

**Pi 运行时 provider**：Pi 严格编排所依赖的 npm 扩展包抽象，默认 `@tintinweb/pi-subagents`（latest），可替换为 iagent 自有包；init 安装失败时落 degraded 并写 `.iagent/pi-runtime.json` 诊断。
_Avoid_: Pi 插件（泛指）、Extension 本体（provider 只是接入抽象）

**OpenCode V2 项目权限**：OpenCode V2 的权限模型，使用项目级 `permissions` 数组与 agent `permissions`（动作 `skill` / `subagent` / `read` / `edit` / `question`），不使用 Claude 的 `allowed-tools` 或 V1 的 `permission` / `task`。
_Avoid_: allowed-tools（Claude 专用）、permission 段（V1 旧名）

**Pi 原生委派入口（native delegation entry）**：`.pi/agents/<subagent_type>.md`，是 `@tintinweb/pi-subagents` 的 `Agent({ subagent_type })` 的解析目标；仅当「文件存在 ∧ frontmatter 可解析 ∧（`name` 或文件名去扩展名）等于期望 `subagent_type`」才算**可解析**。`tools` 只写上游内置名（`read`/`write`/`edit`/`bash`/`grep`/`find`/`ls`），嵌套派发由 `allowed_subagents` 授予，`prompt_mode: append`。
_Avoid_: Pi 技能（那是 `.pi/skills`）、Pi prompt 模板（那是 `.pi/prompts`）

**Pi 原生入口诊断（nativeEntries）**：`.iagent/pi-runtime.json` 中记录原生委派入口状态的字段（`required` / `resolvable` / `missing` / `invalid` / `issues`），诊断码区分 `runtime-missing` / `runtime-incompatible` / `entry-missing` / `entry-invalid`；strict SHALL 同时满足「Pi 版本兼容 + 运行时包已安装 + 所需入口全部可解析」。
_Avoid_: Pi 运行时 provider（那是包抽象，不含入口判定）、名义 strict（仅凭包存在）

**规则蒸馏（rule distillation）**：把规则源提炼为 `.iagent/rules/` 默认规则行的行为——源侧为 `openspec/rules/*.md` 要点蒸馏进模板常量 `defaultRuleFileContent`（ai-coding.md→impl 域、artifact-generation.md→spec 域）；技能侧为 project-init 扫描既有测试代码（框架/命名/目录约定）蒸馏测试规则行，无证据时占位行兜底。
_Avoid_: 内容拷贝（非逐字搬运）、规则压缩（非本语义）

**语义名文件（semantic rule file）**：`.iagent/rules/` 下按语义命名而非类型 id 派生的规则文件——`impl.md`→`coding-rules.md`、`test.md`→`testing-rules.md`；`spec.md` 保留原名（命名方案 a），**不做旧名兼容映射**，旧名文件检测到即整体删除并报告（BREAKING→major）。
_Avoid_: `<type>.md` 直拼（旧派生方式）、artifact-rules.md（统一语义名方案已弃用）

**rules 重建/修复（rules rebuild）**：init/update 的确定性 `.iagent/rules` 处理动作——文件缺失→常量重生成；人工域标记段外内容与常量对齐，**人工域内逐字保留**；`iagent update` 的新增挂点插在 legacy-migration 之后。
_Avoid_: 整体覆盖（错误语义，人工域受保护）、刷新（易与整体重写混淆）

# 变更探索记录：add-tr-workflow-suite

> 源项目：`E:\github\OpenSpec`（四技能）+ `C:\Users\venus\.claude\skills\openspec-proposal-review`（proposal-review 技能，用户全局目录，源项目 skills/ 下不存在）
> 源需求文档：`attachments/source-feature-doc/工作流技能套件_关联分析.md`（迁移重构模式，2026-09-11 生成，CodeGraph + Read 全文扫描）
> 目标项目：`e:\github\VenusAgentTools`（当前项目）

## 蒸馏核心功能清单

**（用户已确认：全部保留，含追加的 proposal-review 技能，共 5 个技能 + 注册集成。本清单是 Phase 2 提案推导输入与 Phase 4 检查范围基线。）**

### 1. workflow 引导工作流技能（→ `tr-impl-workflow`）

- Phase 1 结构化探索：强制探索文件创建 checkpoint（`<keyword>-explore-<NNN>.md` 命名 + 冲突 3 次重试后加时间戳）、CONTEXT.md 启动检查 + 术语即时写入（懒创建）、能力记忆注入（`specs/<capability>/explorations.md`，`已过时（由 <change-name> 取代）` 标记段仅历史参考）、CodeGraph 强制首动作 + 基础扫描（status→files→search；降级仅限确认不可用后）、多项目 CodeGraph Agent 扫描（`ls <path>/.codegraph/` 检查禁用 Glob 查点前缀目录；子代理 projectPath 参数；maxDepth 3 / maxNodes 20 / 超时 120s）、新功能 vs 修改智能检测（关键词 + 符号交叉三路判定）、深度分析条件触发（6 维度：Design Rationale / Constraints / Trade-offs / Pattern Usage / Historical Context / Implicit Assumptions；范围控制 🔴Auto/🟡Prompt/🟢Manual）、grill-with-docs 追问（决策树构建、追问原语：代码库优先/一次一问/每问附推荐、L1-L5 逐级确认门最低 L3、领域建模：术语锐化立即写 CONTEXT.md / 代码交叉验证 / 边界场景构造 / ADR 三条件）、三层关键词检测（类别 4 类/子类别 8 类/修饰符 5 类）+ 分析自动执行（检测即执行不提供跳过；Semgrep/CodeGraph）、分析驱动追问（HIGH 自动问 / MEDIUM-LOW 用户要求展示；深度优先）、实现深潜分析（6 维度 + HIGH/MEDIUM/LOW 置信度标记，LOW 必生成追问）、完成检测一致性直通、1.6.5 CONTEXT.md 检查点（无探索文件可 WARN 豁免）+ 1.6.6 聚合一致性门（三类硬冲突：技术选型/依赖方向/约束互斥；**不可**豁免；空 Decisions 显式 vacuity-pass）、放弃处理（Delete/Keep）
- Phase 2 提案：预迁移验证（探索文件存在 + CONTEXT.md 校验 + 内容验证 + 缺失文件 Option A/B 用户必选）、影响触发检测（Pending 含符号→直接执行）+ 影响分析自动执行（codegraph_impact upstream maxDepth 3；≥2 符号并行发出）、直接转入内联生成（复杂度评估与方法选择已移除）、探索文件迁移（openspec new change → exploration.md）+ 源文件清理（**用户裁决：统一为保留源文件，与 auto-workflow 行为对齐，更安全**）、内联制品生成（探索内容提取映射表：Decisions→proposal、Analysis→design、Questions→specs、Codebase Findings→tasks；生成前规则文件扫描 ai-coding.md + config.yaml context/rules 注入为 AI 约束；遵循 artifact-generation.md 共享协议 G1-G3；CLI 降级：command-not-found 签名判定一次声明流内不重试 + 内置依赖顺序 + 降级变更发现 Glob 扫 changes/*/ 排除 archive + 文件存在性状态推断 + 结束声明恰好一次；其他 CLI 失败选项交互：重试/跳过/中止 + 从首个 ready 恢复不重生成已完成）、反 Skill 委托护栏（制品生成必须内联；验证类 Skill 调用不受限且必需）、任务类型标签（`[代码]`/`[DB脚本]` + 非代码任务 `产出:` 字段 + attachments/ 默认路径）、制品验证（proposal 四节 + specs 的 `#### Scenario:` 4 hashtags + WHEN/THEN/AND + tasks checkbox + 验证报告三选项）
- Phase 3 验证：自动执行无提示（跳过方式提示与 [立即验证]/[跳过验证]）、先 `venus spec status --change --json` 解析状态再 Skill 调用、调 `venus_spec_verify_proposal` 技能（D1-D5 评分；技能不可用 fallback AI 内联评分 + WARN 绝不静默跳过）、量化评分报告（统一 90% 阈值）、技术栈检测（config.yaml context）、PASS→自动调 `venus_tr_impl_review_proposal` 技能深度复查（**用户裁决：技能为主**；技能不可用 fallback 内联深度复查）→ 自动非交互调 `venus_tr_docs_requirement_doc` 生成需求文档（占位符基本信息；失败 WARN 继续工作流）、FAIL→自动修复重跑（逐维度修复建议 + Edit 应用 + 自动重跑；仍失败三选项无跳过路径）
- 跨平台 path.join() 全程

### 2. auto-workflow 全自动管线技能（→ `tr-impl-auto-workflow`）

- Phase 1-3 与 workflow 同构（精简版：无 Analysis 节细化/Implementation Deep-Dive/1.2.2 智能检测/1.4.5 实现深潜/1.6.5-1.6.6 检查点；1.3 grill 简化为 L1-L5 五问；1.4 分析仅 3 类：Security/Architecture 关键词 + Impact 准备总是运行；1.5 影响分析 Phase 1 内自动执行；2.1 迁移保留源文件）
- Phase 4 auto-apply：验证通过且需求文档生成后自动进入（宣布 + auto-mode=true + change-name 上下文）→ 执行 `venus_spec_apply` 行为（Step 6+：批次调度）；错误处理三规则：编译检查失败（3 次自动修复尝试后）暂停等用户不进归档、子代理失败自动重试一次再失败暂停报告、用户中断完成当前批次剩余标记未完成
- Phase 5 auto-archive：Phase 4 完成且编译通过后自动进入（change-name 跳过选择提示）→ 执行 `venus_spec_archive` 模板全部步骤（delta spec 合并、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、目录移动、ARCHIVE-INDEX.md 更新）；错误处理五规则：冲突带标记自动合并非阻塞、CONTEXT.md 同步失败 WARN 继续、CodeGraph 未初始化跳过继续、探索记忆同步失败 WARN 继续、目标已存在报错建议改名；完成输出全 Phase 汇总

### 3. debug 一站式调试技能（→ `tr-impl-debug`，目标零重叠全新能力）

- Startup：输入 bug 描述（无则提示）+ TodoWrite 动态 bug 跟踪（每 bug P1-P4 条目 + 汇总 P5/P6/P7；循环续 bug 追加）
- P1 强制复现：失败测试复现优先（确认因报告原因失败非无关环境错误；记录测试路径/名称/期望 vs 实际）/ 显式步骤复现（编号步骤+用户确认）/ 复现不能建立报告不修（Zero-Assumption）/ 无法触发→进 P2 查非缺陷
- P2 排查：能力记忆注入（历史边界场景是常见根因线索——bug 可能是明知接受的已知边界）+ CodeGraph 分层排查（2.2.0 status 强制首动作；files→search+context→callers/callees+impact（缺陷与候选修复双向）→2.2.4 条件 explore+6 维根因深析（已定位单一高置信根因则跳过保持轻量）；诊断记录实时更新每查询步后非批量；降级同构记录结构）+ grill 纪律（一次一问/术语立即写 CONTEXT.md/每轮更新诊断记录）+ 根因确认门（单一高置信→证据呈现获确认；多候选或置信不足→STOP 候选清单+逐候选证据+推荐，用户选择前不改代码；非缺陷→P3.5）
- P3 关联变更判定：进行中变更→修复更新该变更；独立 bug→`venus spec new "fix-{module}-<topic>"`；归档变更→**绝不修改归档目录**+新建变更 proposal 引用原归档名溯源；非缺陷退出（诊断报告+不建变更不改代码+持久化诊断记录，工作流结束）
- P4 修复：遵循 ai-coding.md（零假设/最小改动/分层；每行改动可追溯根因；schema 变更单独 DDL 确认；设计问题暂停建议更新制品非静默偏离）+ 强制回归测试（修前 FAIL 修后 PASS；tasks.md 缺则补；重跑 P1 复现确认）
- 调试循环：每修复完成问"还有相关 bug 需要修复吗？"；有→记录完成+描述下一 bug+重入 P1+TodoWrite 追加；后续 bug P3 简化（默认同变更+呈现获认可；用户声明独立→收尾当前+提示单独 debug 不自动新建）；循环非缺陷不阻塞其他 bug；中途退出保留已完成丢弃未完成；≥5 迭代建议拆分不强制；没有→P5
- P5 编译检查（汇总所有修复执行一次）：config.yaml compileCheck（disabled/未配置默认禁用→跳 P6）；技术栈命令表（TS→tsc --noEmit 或 pnpm run build / Java-Maven→mvn compile -DskipTests / Java-Gradle→gradle compileJava / Go→go build ./... / Rust→cargo build；后端 TS/Java/Go/Rust 与前端 JSP/Vue/React 分类）；autoFix.enabled→按可修复性分类+变更范围文件应用+重跑上限 maxRetries 默认 3；剩余失败报告用户绝不静默越过
- P6 同步提案（汇总所有修复）：proposal 按bug组织根因+修复描述；tasks 全部勾选+每 bug 回归任务；design 决策变更时更新；specs 行为变更时更新（`#### Scenario:` + WHEN/THEN）；全部根因分析持久化 changes/<name>/exploration.md 按bug组织；格式校验（同步不得损坏制品：proposal 四节/specs 4 hashtags/tasks checkbox）
- P7 验证：调 `venus_spec_verify_proposal` 技能（D1-D6；fallback 内联+WARN）；FAIL→不生成需求文档+自动修复重跑（无跳过路径）；PASS→自动非交互调 `venus_tr_docs_requirement_doc`（失败 WARN 继续）
- 输出：循环汇总（N bug + M 非缺陷）+ 每 bug 四要素 + P5/P6/P7 状态 + "Ready for /venus:spec-apply or /venus:spec-archive"

### 4. requirement-doc 需求文档转换技能（→ `tr-docs-requirement-doc`，目标零重叠）

- Step 1 制品定位：顺序搜索 active `changes/{name}/` → archived `changes/archive/{date}-{name}/` → 用户指定路径；**记录归档状态三态**（active/archived/user-specified 无 archive 段）
- Step 2 双执行模式：standalone（AskUserQuestion 收 4 项全部可跳过：需求编号 REQ-YYYY-XXX / 需求名称 / 交付时间 YYYY-MM-DD / 原始需求可选，跳过用占位符）/ 非交互（不问、Markdown、占位符、可稍后 standalone 重跑）
- Step 3 读取制品优先级（缺失优雅跳过）：proposal→design→tasks→specs
- Step 4 八章节映射转换表（基本信息←交互/占位符；一原始需求←Why+用户原文合并；二需求分析[需求理解按场景分组/非本期范围仅明确不做/需求拆解表格]；三技术框架[架构图+决策表+接口设计]；四业务流程[流程图+说明表]；五页面设计；六表结构设计[完整 DDL]；七影响分析←Impact 直接映射；八评审记录空模板）
- Step 5 技术栈无关检测（config.yaml context + package.json/pom.xml/go.mod/Cargo.toml 佐证；栈适应该约定；不适用节输出"本变更不涉及"绝不空表格）
- 场景分组规则（4 场景类型：管理配置/业务使用/后台任务/AI 智能；Phase 标注仅时间计划仍列入场景；预留能力列入场景说明设计意图；单场景>8 功能点拆子场景；无实际内容类型不生成；功能点描述业务逻辑非技术细节不写类名/方法名/字段名）
- ASCII 图生成规则（`┌ ┐ └ ┘ ──▶ ▼` 三类图：业务流程/功能设计交互/技术框架；无对应设计省略；节点业务语义命名；箭头标注触发条件）
- 伪代码注入规则（```pseudocode 语言无关结构 IF/THEN/ELSE/END IF/FOR EACH + 中文对象.属性表达式；位置紧随表格/图/决策点+块首 `// 来源: design.md 决策 #2` 注释；禁真实类名/方法名/字段名；缺口 [待确认]；≤15 行/块 ≤3 块/节超限保优先级三档：多分支决策>核心算法/数据流>循环/批处理；纯文本已清晰表达不生成）
- DDL 提取规则（design Decisions 主源完整 CREATE TABLE/索引/序列/预置数据 + tasks 任务组补充；方言匹配技术栈；不虚构表列缺口 [待确认]；涉及表汇总表）
- Step 6 输出路径按归档状态路由（active→`changes/{name}/需求文档.md`；archived→`devdocs/{date}-{name}-需求文档.md`；date 前缀从归档目录名解析 YYYY-MM-DD-，无可解析回退无时间戳；目录缺失创建 path.join()；目标存在**静默覆盖**幂等不阻塞）
- 输出验证 12 项清单

### 5. proposal-review 提案复查技能（→ `tr-impl-review-proposal`，源自用户全局目录 979 行，目标零重叠）

- Phase 1 加载变更提案（status --json + 读 proposal/design/specs/tasks 四制品）
- Phase 2 深度代码库探索（核心：必须实际阅读相关代码）：调用链分析（入口点/业务层/数据层/跨模块）+ 数据流分析（输入来源/中间处理/输出去向/异常分支四节点）+ 现有实现模式分析（确保提案与项目现有模式一致）
- Phase 3 多维度完整性检查 8 维度（每维度场景-检查点-常见遗漏三列表）：参数配置（true/false/未配置/大小写变体/非法格式/查询异常 6 场景）、输入输出（空/空格/超长/特殊字符/格式错误/输出空/输出超量 7 场景）、数据库操作（SQL 参数化/事务边界/并发更新/批量/迁移/索引 6 项）、前端交互（权限/表单双重验证/分页/标签/兼容性/错误提示）、错误处理（业务异常/系统异常/DAO 异常/外部调用/异常恢复 5 项）、日志记录（级别/格式/声明/脱敏/堆栈 5 项）、安全性（SQL 注入/XSS/CSRF/权限/密码/敏感操作审计 6 项）、兼容性（JDK/浏览器/数据库/配置 4 项）
- Phase 4 实现合规性验证：技术栈合规（对照 config.yaml）+ 架构分层合规（三层职责表+违规检查方法）+ 命名规范合规（包/类/方法/常量/表/列）+ 数据库操作合规
- Phase 5 特殊功能场景检查（导出功能 6 项：导出 SQL 与列表一致/大数据量分批/字段完整/文件名时间戳/UTF-8 编码/敏感脱敏）
- Phase 6 页面设计细节检查（JSP 级细节）→ **用户裁决：语言无关化 + 保留 Java 专项**（通用检查点语言无关化；Venus4A 特有检查保留为 Java 档案专项）
- Phase 7 逻辑实现细节检查
- Phase 8 量化评分
- Phase 9 发现遗漏时更新文档（补充 Scenario）
- 输出 10 节检查报告模板 + 常见高频遗漏速查表 + 注意事项

### 6. 注册与安装集成（配套能力）

- `src/core/templates/workflows/` 新建 5 个模板文件（技能+指令模板对）
- `src/core/templates/registry.ts` WORKFLOW_PAIRS 注册 5 对 + import
- SkillType 归属（见下方命名决策，不新增类型）
- `src/core/profiles.ts` DEPS 依赖注入 + DEFAULT_WORKFLOWS 不纳入（用户裁决）
- `allowedTools` 字段与正文命令同步（auto-workflow 需含 Agent 工具；review-proposal 需含 Bash(venus:*)）
- `pnpm build && pnpm generate:skills` 快照再生成；skills-parity / allowed-tools / templates / profiles 测试同步；CHANGELOG 补记
- **补齐 `openspec/rules/artifact-generation.md` 共享协议到目标项目**（用户裁决；同时修复 venus_spec_propose SKILL.md:138 悬空引用）
- 联动恢复上次迁移删除的引用：`venus_tr_docs_feature_doc` 与 `venus_tr_impl_auto_migration` 中的 `/opsx:requirement-doc` NOT-for 引用 → 指向 `/venus:tr-docs-requirement-doc`；`/opsx:workflow` 镜像引用 → 指向 `/venus:tr-impl-workflow`

---

## 命名与类型决策（用户已裁决）

| 源技能 | 目标技能名 | 指令 id | SkillType | 模板文件 |
|--------|-----------|---------|-----------|----------|
| openspec-workflow | `venus_tr_impl_workflow` | `tr-impl-workflow` | `tr_impl`（现有「实现」类） | `src/core/templates/workflows/tr-impl-workflow.ts` |
| openspec-auto-workflow | `venus_tr_impl_auto_workflow` | `tr-impl-auto-workflow` | `tr_impl` | `src/core/templates/workflows/tr-impl-auto-workflow.ts` |
| openspec-debug | `venus_tr_impl_debug` | `tr-impl-debug` | `tr_impl` | `src/core/templates/workflows/tr-impl-debug.ts` |
| openspec-create-requirement-doc | `venus_tr_docs_requirement_doc` | `tr-docs-requirement-doc` | `tr_docs`（现有「文档」类） | `src/core/templates/workflows/tr-docs-requirement-doc.ts` |
| openspec-proposal-review | `venus_tr_impl_review_proposal` | `tr-impl-review-proposal` | `tr_impl`（现有「实现」类——用户原裁决 spec 类，实现期经命名硬约束「技能名以 venus_<type>_ 开头」+「tr- 前缀」联立修正，见 design D1） | `src/core/templates/workflows/tr-impl-review-proposal.ts` |

- 命名以用户显式输入为准：workflow/auto-workflow 用 `tr-impl-` 前缀（用户改选），debug/requirement-doc/review-proposal 按推荐
- DEFAULT_WORKFLOWS **不纳入**（与上次迁移三技能一致，用户经 `.venus/config.yaml` workflows 字段勾选）
- Venus4A 适配（review-proposal）：语言无关化 + 保留 Java 专项检查（与上次 migration-check 裁决一致）
- proposal-review 调用对接：workflow/auto-workflow/debug 验证 PASS 后调 `venus_tr_impl_review_proposal` 技能（技能为主）；技能不可用 fallback 内联深度复查
- 探索文件清理行为统一：保留源文件（workflow 源为删除，统一为 auto-workflow 的保留行为）
- Semgrep MCP 引用保留（可选增强，缺失时该分析跳过）
- artifact-generation.md 协议补齐到目标 `openspec/rules/`（顺带修复 venus_spec_propose 悬空引用）

---

## 目标项目规范要点

**（Phase 2 加载；本节为 design/tasks 推导与 Phase 3 子代理调度的 BINDING 约束）**

### 来源 1：AGENTS.md（仓库修改守则）

1. 改技能模板（`src/core/templates/workflows/`）后必须依次 `pnpm build && pnpm generate:skills`，否则 `test/skills-parity.test.ts` 失败
2. 改模板正文的命令时同步 `allowedTools` 字段，否则技能被权限拦截（`test/allowed-tools.test.ts` 部分拦截）
3. 新增技能类型：`src/core/config.ts` 的 `SKILL_TYPES` 加条目（本次**不新增**——五技能均归现有类型）
4. YAML 转义：含冒号/引号的 frontmatter 值必须走 `escapeYamlValue`
5. Windows 兼容：路径断言用 `replaceAll('\\', '/')` 归一化；`path.join` 不硬编码分隔符
6. 技能名强制 `venus_` 前缀；frontmatter `metadata.type` 必须是 `SKILL_TYPES` 之一
7. SKILL 正文中文；代码注释中文；标识符英文
8. `update` 手改保护依赖 frontmatter `generatedBy` —— 生成路径必须写全该字段
9. 指令 id 派生：`venus_tr_impl_workflow` → `tr-impl-workflow`（下划线转连字符，去前缀）
10. `.venus/`（本项目配置）与 `.claude/`（dogfood 产物）都提交到 git
11. 提交信息：Conventional Commits 一行式，中文描述

### 来源 2：openspec/specs/skill-profile/spec.md（主规范）

- `DEFAULT_WORKFLOWS` 默认集 7 项（tr-init-project + spec 全 6）；未配置 `workflows` 字段时生效；本次不改动
- 依赖注入 `DEPS`：现有 `spec-propose ⇒ spec-verify-proposal`、`spec-archive ⇒ spec-verify`、`tr-impl-auto-migration ⇒ [tr-docs-feature-doc, tr-impl-migration-check]`；本次新增 5 技能的 DEPS 规则见 design
- `venus init`/`venus update` 仅生成生效集内的技能与指令
- reconcile 检测：`.claude/` 下已安装但不在生效集的 venus 产物保留不删，仅提示

### 来源 3：openspec/rules/ai-coding.md（编码守卫）

零猜测（[待确认] 标记）、先蓝图后编码（实现前确认门）、最小改动、分层隔离、交付自检。

### 来源 4：用户全局 CLAUDE.md（TS 代码风格）

4 空格缩进禁 Tab；行宽 ≤120；方法间空 1 行；字符串双引号；语句结尾分号；if/for/while/try 无论单行必须 `{}` 且右括号单独成行；变量小驼峰见名知意；常量全大写下划线；导入按系统包→第三方→自定义分组排序、禁通配符导入。

### 来源 5：ADR-0001 + spec 命令组

- `venus spec` 自研命令组不依赖 openspec CLI：`venus spec new "<name>"`、`venus spec status --change <name> [--json]`、`venus spec instructions <artifact-id> --change <name> [--json]`、`venus spec archive <name>`
- spec-driven schema 依赖图：proposal（无依赖）→ specs / design（依赖 proposal）→ tasks（依赖 specs + design）；apply 门槛 requires=[tasks]
- spec-apply 已支持 `auto-mode=true`（跳过设计确认门）与 `openspec/config.yaml` 的 `apply.concurrency` —— auto-workflow Phase 4 调用契约完整对接

---

## 目标项目探索发现

### 接口兼容性（源 → 目标模板适配）

| 源 SkillTemplate 字段 | 目标字段 | 结论 |
|----------------------|---------|------|
| name / description / instructions | 同名 | 直接迁移（name 改 venus_tr_*） |
| license / compatibility / metadata | 同名可选 | 直接迁移（生成器注入 generatedBy；compatibility 如实标注——requirement-doc 实际无 CLI 依赖） |
| （无） | **allowedTools（必填）** | 新增：按技能正文实际用到的工具写白名单 |
| （无） | **type（必填）** | tr_impl ×3 / tr_docs ×1 / spec ×1（均现有类型） |

### 注册点清单（实现涉及的文件）

| 文件 | 动作 |
|------|------|
| `src/core/templates/workflows/tr-impl-workflow.ts` | 新建（技能+指令模板对） |
| `src/core/templates/workflows/tr-impl-auto-workflow.ts` | 新建 |
| `src/core/templates/workflows/tr-impl-debug.ts` | 新建 |
| `src/core/templates/workflows/tr-docs-requirement-doc.ts` | 新建 |
| `src/core/templates/workflows/tr-impl-review-proposal.ts` | 新建 |
| `src/core/templates/registry.ts` | WORKFLOW_PAIRS 注册 5 对 + import |
| `src/core/profiles.ts` | DEPS 新增规则（见 design）；DEFAULT_WORKFLOWS 不变 |
| `openspec/rules/artifact-generation.md` | **新建**（迁移源项目共享协议，命令改 venus spec；修复 venus_spec_propose:138 悬空引用） |
| `src/core/templates/workflows/tr-docs-feature-doc.ts` + `tr-impl-auto-migration.ts` | 联动：恢复 `/opsx:requirement-doc`、`/opsx:workflow` 引用指向新技能 |
| `skills/` 快照 + `.claude/` dogfood | `pnpm build && pnpm generate:skills` 再生成 |
| `CHANGELOG.md` | Unreleased 段补记 |

### 测试影响面

| 测试文件 | 影响 |
|---------|------|
| `test/skills-parity.test.ts` | 快照对比——必须 `pnpm generate:skills` 后再跑 |
| `test/templates.test.ts` | 注册表断言（新增 5 对注册；若有硬编码数量断言需同步） |
| `test/allowed-tools.test.ts` | 新技能的 allowedTools 校验 |
| `test/profiles.test.ts` | DEPS 新增注入规则用例 |
| `test/completion-config.test.ts` | 不受影响（不新增 CLI 命令） |

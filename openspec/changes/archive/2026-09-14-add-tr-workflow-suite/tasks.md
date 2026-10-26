# Tasks: add-tr-workflow-suite

<!-- 任务类型标签：[代码] 实现代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/） -->

## 1. 共享协议与联动修复（批次 1——前置，供批次 2 引用）

- [x] 1.1 [代码] 新建 `openspec/rules/artifact-generation.md` 共享制品生成协议（G1 `venus spec new` 创建变更目录 → G2 status/instructions 依赖序循环 + context/rules 为 AI 约束不写入输出 + 补充文档处理 → G3 终态确认；跨平台 path.join()；usage modes：workflow 内联模式与 propose 独立模式）
  - 文件：`openspec/rules/artifact-generation.md`
  - 验证：文件存在且含 G1/G2/G3 三节；全部 CLI 命令为 `venus spec` 前缀（无 `openspec ` 残留）；venus_spec_propose SKILL.md:138 引用路径与本文件一致（悬空引用修复）
- [x] 1.2 [代码] 联动恢复上次迁移删除的引用：`tr-docs-feature-doc` 模板正文 NOT-for 段的 `/opsx:requirement-doc` 引用 → `/venus:tr-docs-requirement-doc`；`tr-impl-auto-migration` 模板正文 `/opsx:workflow` 镜像引用处补充 `/venus:tr-impl-workflow` 完整工作流选项（保留现有 spec 工作流链引用）
  - 文件：`src/core/templates/workflows/tr-docs-feature-doc.ts`、`src/core/templates/workflows/tr-impl-auto-migration.ts`
  - 验证：两模板正文含新技能指令 id 引用；`grep -c "opsx:requirement-doc\|opsx:workflow"` 在两文件返回合理计数（残留引用仅剩必要的 NOT-for 对比表述或为 0）

## 2. 五个技能模板（批次 2——5 任务可并发派发）

- [x] 2.1 [代码] 新建 `venus_tr_impl_workflow` 技能+指令模板对（源：openspec-workflow SKILL.md 1526 行）：完整 Phase 1 结构化探索（1.1 探索文件 checkpoint / 1.1.5 CONTEXT.md 启动检查 / 1.2 结构化格式 13 节 / 1.2.0.5 能力记忆注入 / 1.2.1 CodeGraph 强制首动作+基础扫描 / 1.2.1.5 多项目 Agent 扫描 / 1.2.2 智能检测 / 1.2.3 深度分析条件触发 / 1.3 grill L1-L5 逐级确认门 / 1.4 三层关键词+分析自动执行含 Semgrep（标注可选增强，缺失跳过）/ 1.4.5 实现深潜分析 / 1.5 每轮更新 / 1.6.5 CONTEXT.md 检查点 / 1.6.6 聚合一致性门 / 1.7 放弃处理）+ Phase 2（2.0 预迁移验证+影响分析并行 / 探索文件迁移**保留源文件** / 2.4 内联生成遵循 artifact-generation.md + CLI 降级 command-not-found 三签名 + 反 Skill 委托护栏 / 2.5 任务类型标签 / 2.6 制品验证）+ Phase 3（自动执行 / 调 venus_spec_verify_proposal + 内联 fallback / 90% 阈值 / PASS→venus_tr_impl_review_proposal 技能为主+内联 fallback→非交互调 venus_tr_docs_requirement_doc / FAIL 自动修复循环）；引用替换按 design D2/D3/D4 与源需求文档 11.2 表逐项执行
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`
  - 验证：模板对工厂函数导出；frontmatter name=venus_tr_impl_workflow、type=tr_impl、allowedTools 与正文命令同步（含 Skill/Agent/AskUserQuestion/TodoWrite）；正文含 openspec/rules/artifact-generation.md 引用；无 `openspec status`/`openspec instructions`/`openspec new` 残留（已替换为 venus spec）
- [x] 2.2 [代码] 新建 `venus_tr_impl_auto_workflow` 技能+指令模板对（源：openspec-auto-workflow SKILL.md 521 行）：Phase 1-3 与 tr-impl-workflow 同构（精简版：无 Analysis 细化/Deep-Dive/1.2.2/1.4.5/1.6.5-1.6.6；grill 简化 L1-L5；分析 3 类含 Impact 总是运行；1.5 影响分析 Phase 1 内自动执行；2.1 迁移保留源文件）+ Phase 4 auto-apply（auto-mode=true 上下文 + venus_spec_apply Step 6+ 行为 + 错误处理三规则）+ Phase 5 auto-archive（change-name 上下文 + venus_spec_archive 全步骤 + 错误处理五规则）+ 完成汇总输出
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 验证：frontmatter type=tr_impl、allowedTools 含 Agent；Phase 4/5 引用 venus_spec_apply/venus_spec_archive 技能名；auto-mode=true 契约表述与 venus_spec_apply SKILL.md L18/L78/L123 一致
- [x] 2.3 [代码] 新建 `venus_tr_impl_debug` 技能+指令模板对（源：openspec-debug SKILL.md 406 行）：Startup 动态 bug 跟踪 + P1 强制复现（失败测试优先/显式步骤确认/复现不成不修）+ P2 CodeGraph 分层排查（status 首动作→files→search+context→callers/callees+impact→条件 explore+6 维根因深析；诊断记录每查询步实时更新）+ 能力记忆注入 + grill 纪律 + 根因确认门（多候选 STOP）+ P3 关联判定四路（含归档只读溯源、非缺陷诊断退出）+ P4 修复+强制回归测试 + 调试循环（后续 bug P3 简化/非缺陷不阻塞/中途退出保留/≥5 建议拆分）+ P5 编译检查（compileCheck 配置驱动+5 技术栈命令表+autoFix maxRetries 3）+ P6 同步提案（全部修复+根因持久化+格式校验）+ P7 验证（venus_spec_verify_proposal + FAIL 自动修复 + PASS 非交互调 venus_tr_docs_requirement_doc）+ 结构化输出
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：frontmatter type=tr_impl、allowedTools 含 Bash(pnpm:*)/Bash(npm:*)/Bash(node:*)/Bash(git:*)/Skill；关联判定引用 `venus spec new "fix-..."`；Phase 7 引用 venus_spec_verify_proposal 与 venus_tr_docs_requirement_doc 技能名
- [x] 2.4 [代码] 新建 `venus_tr_docs_requirement_doc` 技能+指令模板对（源：openspec-create-requirement-doc SKILL.md 241 行）：Step 1 制品定位+归档状态三态记录 / Step 2 双执行模式（standalone AskUserQuestion 4 项可跳过 / 非交互占位符）/ Step 3 制品读取优先级 / Step 4 八章节映射表 / Step 5 技术栈无关检测（不适用节输出"本变更不涉及"）/ 场景分组 4 类型规则 / ASCII 图 3 类规则 / 伪代码注入规则（≤15 行/块 ≤3 块/节、优先级三档、块首来源注释、禁真实标识符）/ DDL 提取规则（不虚构 [待确认]）/ Step 6 八章节输出模板 + 归档状态输出路由（4 路径表 + date 前缀解析 + 幂等静默覆盖）/ 输出验证 12 项清单
  - 文件：`src/core/templates/workflows/tr-docs-requirement-doc.ts`
  - 验证：frontmatter name=venus_tr_docs_requirement_doc、type=tr_docs、compatibility 如实标注（无 CLI 硬依赖，标注 venus spec status 为可选加载方式）；正文无 openspec CLI 命令硬依赖
- [x] 2.5 [代码] 新建 `venus_tr_impl_review_proposal` 技能+指令模板对（源：用户全局 openspec-proposal-review 979 行中文定制版）：Phase 1 加载变更（venus spec status --json + 四制品读取）/ Phase 2 深度代码库探索（调用链/数据流/现有实现模式三分析，**语言无关化**：grep 示例改为通用表述）/ Phase 3 八维度完整性检查（参数配置 6 场景/输入输出 7 场景/数据库操作 6 项/前端交互/错误处理 5 项/日志记录 5 项/安全性 6 项/兼容性 4 项——检查点语言无关化）/ Phase 4 合规性验证（技术栈/分层/命名/数据库——语言无关化 + **Java/Venus4A 专项检查小节保留**：IE 兼容禁 ES6+、DataStore/DataObject 小写列名、Log4j 1.2.x、Oracle 11g 方言，触发条件=检测到 Java 项目特征）/ Phase 5 特殊场景检查（导出 6 项）/ Phase 6 页面设计细节 / Phase 7 逻辑实现细节 / Phase 8 量化评分 / Phase 9 发现遗漏更新文档补充 `#### Scenario:` / 10 节检查报告输出 + 常见高频遗漏速查表 + 注意事项
  - 文件：`src/core/templates/workflows/tr-impl-review-proposal.ts`
  - 验证：frontmatter name=venus_tr_impl_review_proposal、type=spec、allowedTools 含 Edit/Bash(venus:*)；正文 8 维度齐全且检查点无 Venus4A 硬编码残留（Venus4A 内容仅存于 Java 专项小节）；CLI 引用为 venus spec status

## 3. 注册与依赖注入（批次 3——依赖批次 2 的模板文件存在）

- [x] 3.1 [代码] registry.ts 注册 5 对模板：import 5 个新模板文件 + WORKFLOW_PAIRS 追加 5 条（venus_tr_impl_workflow→tr-impl-workflow、venus_tr_impl_auto_workflow→tr-impl-auto-workflow、venus_tr_impl_debug→tr-impl-debug、venus_tr_docs_requirement_doc→tr-docs-requirement-doc、venus_tr_impl_review_proposal→tr-impl-review-proposal）
  - 文件：`src/core/templates/registry.ts`
  - 验证：`npx tsx -e "..."` 或单测断言 WORKFLOW_PAIRS 含全部 5 对；指令 id 派生规则符合"下划线转连字符去 venus_ 前缀"
- [x] 3.2 [代码] profiles.ts DEPS 新增 3 条注入规则：`tr-impl-workflow ⇒ [tr-impl-review-proposal, tr-docs-requirement-doc]`、`tr-impl-auto-workflow ⇒ [tr-impl-workflow, tr-docs-requirement-doc]`、`tr-impl-debug ⇒ [tr-docs-requirement-doc, spec-verify-proposal]`；DEFAULT_WORKFLOWS 保持不变
  - 文件：`src/core/profiles.ts`
  - 验证：DEPS 断言；勾选 tr-impl-auto-workflow 时自动补全链生效（含连带 tr-impl-workflow 的依赖）；DEFAULT_WORKFLOWS 仍为 7 项

## 4. 快照、测试与文档（批次 4——依赖全部前置批次）

- [x] 4.1 [代码] 执行 `pnpm build && pnpm generate:skills` 重新生成快照（skills/ 源目录 + .claude/skills/ + .claude/commands/venus/ dogfood 产物）
  - 文件：`skills/`、`.claude/skills/`、`.claude/commands/venus/`（生成产物）
  - 验证：5 个新技能目录与 5 个新指令 .md 生成；`test/skills-parity.test.ts` 通过
- [x] 4.2 [代码] 测试同步：`test/templates.test.ts`（WORKFLOW_PAIRS 数量/条目断言如有硬编码需 +5）、`test/allowed-tools.test.ts`（5 技能白名单校验）、`test/profiles.test.ts`（3 条 DEPS 用例：workflow 依赖补全、auto-workflow 连带补全、debug 含 spec-verify-proposal）
  - 文件：`test/templates.test.ts`、`test/allowed-tools.test.ts`、`test/profiles.test.ts`
  - 验证：`pnpm test` 全绿（skills-parity / templates / allowed-tools / profiles / completion-config 不受影响）
- [x] 4.3 [代码] CHANGELOG.md Unreleased 段补记：新增 5 技能（tr-impl-workflow / tr-impl-auto-workflow / tr-impl-debug / tr-docs-requirement-doc / tr-impl-review-proposal）+ artifact-generation.md 共享协议 + venus_spec_propose 悬空引用修复 + 2 处联动引用恢复
  - 文件：`CHANGELOG.md`
  - 验证：Unreleased 段含本次全部交付物；Conventional Commits 风格描述

## 5. Phase 4 迁移检查与修复轮（2026-09-11）

- [x] 5.1 [代码] 审查子代理迁移检查（venus_tr_impl_migration_check 非交互 + 核心功能覆盖矩阵 + C11/C12/C13 B组检查）→ 报告 16 文件输出至 `attachments/migration-check/`；结论：核心功能覆盖率 100%（65/66 完整+1 部分），C11/C12 通过、C13 基本通过
  - 产出：`attachments/migration-check/`（00 摘要 / 01 模板正文层×5 / 02 指令注册层 / 03 安装产物层 / 04 覆盖矩阵 / 05 问题清单 P0×0 P1×2 P2×8 / 06 修复建议 / 07 对抗检查×3）
- [x] 5.2 [代码] P1-1 修复：auto-workflow CLI 失败重试建议语义偏移——instructions L402 与 CommandTemplate L549 两处均从"suggest /venus:spec-propose (or 经 venus spec new) to retry"（新建提案语义）改回源语义"重跑 venus spec status --json 定位首个 ready 制品断点恢复，不重生成已完成制品"（用户确认修复）
- [x] 5.3 [代码] P1-2 修复：review-proposal 检查示例从"3 行浓缩摘要+指向用户目录源技能的不可达引用"恢复为自包含完整走查示例（数据脱敏规则管理模块，源 SKILL.md 850-938 行完整迁移，openspec status → venus spec status）（用户确认修复）
- [x] 5.4 [代码] 修复后复核：pnpm build + generate:skills（22 技能）+ 全量测试 140/140 通过；模板与快照零残留（`spec-propose.*to retry` 计数 0；"完整示例详见源 skill" 计数 0）
- [x] 5.5 [代码] P2 处置：8 个 P2 按用户裁决记录不修（详见 `attachments/migration-check/05_问题清单/03_一般问题.md`），不阻塞归档

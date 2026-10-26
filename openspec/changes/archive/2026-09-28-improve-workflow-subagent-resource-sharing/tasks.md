# Tasks: improve-workflow-subagent-resource-sharing

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/）
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]
     节点标注 [N<id>] 对应探索产物 `## 功能流程图`（4 条链路 / 41 节点，经 1.5.5 门确认） -->

## 1. spec-apply 共享资源协议（单一源 · spec 类，command 自动派生）

- [x] 1.1 [代码] 在 Step 6 新增「共享资源协议」段：上下文包六节（变更摘要 / 契约 / 规范要点 / 文件归属表 / Codebase 摘要 / 已产出）、**一次性产出 + 逐批追加登记表**规则、包路径 `context-pack.md`（落于流程级临时工作区）、包为「唯一必读制品」定位 [N5][N10]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：正文含六节名称与包路径；含「一次性产出」「追加」规则；无整包重产表述

- [x] 1.2 [代码] 将批次派发形态判定显式化为独立步：批次含 ≥2 派发单元 → 产出包 + 派发子代理；含 <2 个 → 协调者直接实现且**不产出包** [N3][N4]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：正文含两条分支与「单任务批次不产出包」明文

- [x] 1.3 [代码] 改造 Step 6.5 子代理调度指令必含清单：改为「包路径 + 本单元任务清单（含全量细节与 Spec Ref）+ 回执格式 + 禁止项」；**移出** ai-coding 规范摘要内联段（改为引用包 `## 规范要点` 节）；任务细节保持内联（使子代理无需读 tasks.md） [N6]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：必含清单不再含规范摘要全文表述；含「包路径」为首位必读项；含「任务细节保持内联」约束

- [x] 1.4 [代码] 改造子代理职责段：新增**回执最小化**（固定四列 `<任务 id> | <状态> | <产出文件> | <公开签名>`，MUST NOT 粘贴代码正文，失败任务仍含失败原因摘要；**并定义「公开签名」** = 该单元产出中可被其他单元引用的符号签名（函数/方法/类型/接口/导出常量/CLI 命令），无则记「无」）、**共享指令前缀**（固定顺序：共享前缀 → 单元差异）、**禁止项**（禁重读 proposal/specs/design、禁重跑包已覆盖的 CodeGraph 查询）与**包缺口回执**（MAY 查缺，但 MUST 报告缺口清单，协调者回填） [N8][N9]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：四类新约束均有明文；含「公开签名」定义与空值处置（契约节空值记「无」，不留空不编造）；含「包是蒸馏视图而非替代品，缺项 MUST 补查制品本身、MUST NOT 凭包猜测」的反幻觉约束

- [x] 1.5 [代码] 改造批后集中管理段：协调者校验结果 → 集中更新 tasks.md 勾选 → **追加产出登记表**（产出文件 + 公开签名）→ 进入下一批 [N10]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：正文含「追加登记表」动作且与批后集中勾选在同一段内

- [x] 1.6 [代码] 新增 **fail-safe 降级**规则：工作区不可写 → 先回退系统临时目录（沿用既有回退）→ 仍失败或包产出失败或项目无 `openspec/rules/ai-coding.md` → **退化为既有内联注入 + WARN，绝不阻断实现**；并明文 `auto-mode=true` **不豁免**共享资源协议 [N2]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：退化路径与 auto-mode 不豁免均有明文；退化语义为「指令变长、防护不缺失」

- [x] 1.7 [代码] §10 统一清理段扩及上下文包与登记表（清理范围说明同步）；并逐段判定新增段落的 `<!-- CMD:SKIP -->` 标记（核对派生后 command 版仍可读、防护语句不缺失） [N14]
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 验证：`pnpm build && node bin/venus.js spec status --json` 可运行；`deriveCommandContent` 派生结果含全部防护语句；标记成对且无孤立标记

## 2. tr-impl-auto-workflow（tr 类 · skill 正文 + 手写 command 正文双处同步）

- [x] 2.1 [代码] §4.1 新增**继承声明句**：显式声明 Phase 4 继承 `venus_spec_apply` 的派发协议与共享资源协议（四载体），并声明 MUST NOT 另立派发指令格式或重复定义协议文本 [N16]
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 验证：§4.1 含四载体名与 MUST NOT 声明

- [x] 2.2 [代码] 1.2.1.5 多项目扫描改为**单个子代理内串行扫描全部待查项目**；降级保持**项目粒度**（某项目未初始化/失败/超时 >120s 仅该项目降级 Glob/Grep + WARN，其余照常；与当前项目同路径则跳过） [N17][N18][N19][N20][N21]
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`
  - 验证：正文为「一个子代理扫描全部项目」而非「每项目一个子代理」；含项目粒度降级与跳过同路径项目

- [x] 2.3 [代码] 手写 command 压缩正文**双处同步**（1.2.1.5 单代理化表述 + Phase 4 继承声明句） [N16][N20]
  - 文件：`src/core/templates/workflows/tr-impl-auto-workflow.ts`（`getTrImplAutoWorkflowCommandTemplate`）
  - 验证：command 正文含继承声明与单代理扫描表述，语义与 skill 正文一致

## 3. tr-impl-workflow（tr 类 · 同构同步 D17 · skill 正文 + 手写 command 正文双处同步）

- [x] 3.1 [代码] 1.2.1.5 多项目扫描改为单个子代理内串行扫描全部待查项目（skill 版），降级保持项目粒度 —— 与 `tr-impl-auto-workflow` 保持同构一致 [N20]
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`（skill 正文 `:363-383` 区段）
  - 验证：两技能的 1.2.1.5 语义一致，无「每项目一个子代理」残留；原「Spawn sub-agents sequentially」表述被替换

- [x] 3.2 [代码] 手写 command 压缩正文**双处同步**（command 版 `:1896-1916` 区段） [N20]
  - 文件：`src/core/templates/workflows/tr-impl-workflow.ts`（command 正文）
  - 验证：command 正文含单代理扫描表述，与 skill 正文语义一致

## 4. tr-impl-debug（tr 类 · 单代理流程 · 新增探查摘要共享 · skill 正文 + 手写 command 正文双处同步）

- [x] 4.1 [代码] Phase 2 新增 **2.1.5 流程级探查摘要**节：载体 `.openspec-tmp/debug-<keyword>/investigation-digest.md`（`path.join()` 构造；**`<keyword>` 为该次调试主题的 kebab-case 关键词**，与探索文件关键词同规则，MUST NOT 用 bug 描述原文）、存在性判定分支、先读复用命中结论、不存在则初始化空摘要、落盘失败降级为仅会话内复用 + WARN；并明文「摘要仅为流程内缓存，MUST NOT 替代诊断记录或 Phase 6 对变更 `exploration.md` 的持久化」 [N22][N23][N24][N25]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：含载体路径与 keyword 派生规则、三分支（存在/不存在/不可写）、非交付物划界明文

- [x] 4.2 [代码] 2.2.1–2.2.3 各步增「**仅增量**」约束（摘要已覆盖范围 MUST NOT 重复发起同类查询）；2.2.4（深度路径）后增**增量写入摘要**步（与既有「实时写诊断记录」并行，不替代）；新增**失效规则**（某 bug 修复改动代码后，受影响范围的摘要结论标 `> 已失效（由 <bug 标识> 修复改动代码）`，下次进入 Phase 2 重新查询，MUST NOT 复用失效结论） [N26][N27][N28][N29][N30]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：2.2.1–2.2.3 均含仅增量约束；含增量写入时机与「不替代诊断记录」；含失效标记格式与重新查询规则

- [x] 4.3 [代码] 4.3 调试循环段增「回边复用」约束：用户答「有」后重入 Phase 2 时先读摘要、仅做增量查询，不重跑已覆盖区域 [N33]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：4.3 段含回边先读摘要明文

- [x] 4.4 [代码] Phase 7 收尾新增**清理流程级工作区**步（含非缺陷退出 `3.5` 与中途退出路径）；清理失败记 WARN + 提示路径，不阻断 [N34][N35]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`
  - 验证：Phase 7 含清理步且覆盖非缺陷/中途退出路径；含 WARN 容错

- [x] 4.5 [代码] 手写 command 压缩正文**双处同步**（2.1.5 探查摘要 + 仅增量约束 + 循环回边复用 + 收尾清理） [N23][N26][N33][N35]
  - 文件：`src/core/templates/workflows/tr-impl-debug.ts`（`getTrImplDebugCommandTemplate`）
  - 验证：command 正文含四类新表述；**MUST NOT 出现 `| 异常路径 |` 列头**（`test/templates.test.ts:138` 反向断言）

## 5. tr-impl-auto-migration（tr 类 · D18 · skill 正文 + 手写 command 正文双处同步）

- [x] 5.1 [代码] Phase 3 规范要点载体改造：新增包可用性判定；可用 → 目标项目规范要点**写入包的 `## 规范要点` 节**（与 `ai-coding.md` 要点合并，BINDING 约束地位不变）；不可用 → 退化为每子代理内联注入 + WARN；调度指令**引用包、MUST NOT 内联要点全文** [N36][N37][N38][N39][N40][N41]
  - 文件：`src/core/templates/workflows/tr-impl-auto-migration.ts`
  - 验证：含写入包明文、MUST NOT 内联明文、退化分支；「按 apply 协议并发批次执行」表述保持

- [x] 5.2 [代码] 手写 command 压缩正文**双处同步**（规范要点写入包 + 不内联 + 退化分支） [N38][N40]
  - 文件：`src/core/templates/workflows/tr-impl-auto-migration.ts`（command 正文）
  - 验证：command 正文含三类表述，与 skill 正文语义一致

## 6. 构建与产物快照

- [x] 6.1 [代码] 构建与增量编译检查：`pnpm build`（tsc）+ `pnpm lint`，确认模板改动无类型/语法错误 [N12]
  - 文件：`package.json` / `src/core/templates/workflows/*.ts`
  - 验证：构建零错误；eslint 零告警

- [x] 6.2 [代码] 重生成 `skills/` 静态快照：`pnpm generate:skills`（否则 `test/skills-parity.test.ts` 失败）
  - 文件：`skills/**/SKILL.md`
  - 验证：快照与模板一致；`git status` 中快照变更仅限本次涉及技能

## 7. 测试

- [x] 7.1 [测试][单元][P0] 断言 A1/A2/A3/A4：`spec-apply` 正文含包六节 + 包路径 + 一次性产出/追加规则；Step 6.5 必含清单**不再含**内联规范摘要；三项禁止句 + 包缺口回执字段 + **「公开签名」定义**存在；调度指令固定顺序存在 [N5][N6][N8][N9]
  - 文件：`test/subagent-resource-sharing.test.ts`（新建）
  - 验证：断言通过；反向断言（旧内联规范摘要表述消失）通过；断言经 `getSkillTemplates()` 取正文

- [x] 7.2 [测试][单元][P0] 断言 A5：`tr-impl-auto-workflow` 与 `tr-impl-workflow` 的 skill + command **四处**均含「单个子代理串行扫描全部项目」语义，且**无**「每项目一个子代理」残留 [N20]
  - 文件：`test/subagent-resource-sharing.test.ts`
  - 验证：四处断言通过；两技能表述同构一致

- [x] 7.3 [测试][单元][P0] 断言 A6：`tr-impl-debug` 的 skill + command **两处**均含探查摘要载体路径、先读复用、仅增量、增量写入、收尾清理五类表述；且正文不含 `| 异常路径 |` 列头 [N23][N26][N30][N35]
  - 文件：`test/subagent-resource-sharing.test.ts`
  - 验证：两处断言通过；列头反向断言通过

- [x] 7.4 [测试][单元][P1] 断言 A8：`tr-impl-auto-migration` 的 skill + command 两处均含「规范要点写入包 `## 规范要点` 节」「MUST NOT 内联」与退化分支三表述 [N38][N40]
  - 文件：`test/subagent-resource-sharing.test.ts`
  - 验证：两处断言通过

- [x] 7.5 [测试][功能][P0] 断言 A7 全量回归：`pnpm test` 全绿（含 `skills-parity` / `template-derivation` / `allowed-tools` / `templates`）
  - 文件：`test/**/*.test.ts`
  - 验证：vitest 全量通过，零失败

- [x] 7.6 [测试][单元][P2] 记录**已评估、判定无需运行时测试**的场景与依据：本次为纯 prompt 文本改造，包缺口回填、项目粒度降级、子代理不可用降级、探查摘要落盘失败降级等均为**运行时编排行为**，无法在 vitest 中驱动（无运行时执行体）；已以 7.1–7.4 的**结构指标断言**作为替代防线（可回归、可防漂移）
  - 文件：`test/subagent-resource-sharing.test.ts`（文件头注释说明）
  - 验证：说明文字存在，使「没写运行时测试」与「没评估过」可区分

## 8. 版本与变更日志

- [x] 8.1 [代码] 按 AGENTS.md 守则 8 递增 `package.json` 版本号（本类改动 **minor**），并把 CHANGELOG `[Unreleased]` 归档为新版本小节（Keep a Changelog 格式，含 `### Changed` 与「已知落差」说明），保留空的 `[Unreleased]` 并同步底部链接引用定义
  - 文件：`package.json` / `CHANGELOG.md`
  - 验证：版本号与 CHANGELOG 小节一致；链接引用定义指向新 tag

- [x] 8.2 [代码] 同步其它版本号引用位置（`README.md` 的 `venus --version` 输出示例）
  - 文件：`README.md`
  - 验证：全仓无残留旧版本号引用

- [x] 8.3 [代码] 确认 `openspec/CONTEXT.md` 的 7 个新术语（派发单元 / 共享上下文包 / 产出登记表 / 回执最小化 / 共享指令前缀 / 包缺口回执 / 探查摘要）已在归档阶段合并（本任务仅核对不提前写入）
  - 文件：`openspec/CONTEXT.md`
  - 验证：归档阶段（Phase 5）按既有 CONTEXT.md 同步步骤合并，术语含 `_Avoid_` 对照

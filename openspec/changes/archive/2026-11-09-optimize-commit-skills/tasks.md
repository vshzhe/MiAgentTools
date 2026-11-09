# Tasks: optimize-commit-skills

> 流程图节点 id 与探索文件 `## 功能流程图` 一致；每个任务标注对应节点。每个任务只引用一个 Spec Ref，多个场景直属同一 Requirement。

## 1. SVN 模板改造（`src/core/templates/workflows/svn-commit.ts`）

- [x] 1.1 [代码] 移除知识库推送并收敛为三环节 [N1][N9][N10][N12]
  - 文件：`src/core/templates/workflows/svn-commit.ts`
  - 验证：描述 / 强制约束 / 使用样例 / 交互流程 / 执行阶段 / 汇报中不再出现「知识库」「llm-wiki」「submission_id」；环节编号收敛为 1-3，原环节 4 上移为环节 3
  - Spec Ref：commit-push-skill / 显式触发与三环节强制确认
  - Scenario Ref：不再询问知识库推送

- [x] 1.2 [代码] 归档未提交提案检测与候选标注 [N2][N3][N4]
  - 文件：`src/core/templates/workflows/svn-commit.ts`
  - 验证：提案判定同时扫描活跃与 `openspec/changes/archive/`；归档项标注「已归档」；同名并存分别列出；多归档候选列出供选；无 VCS 变更不列候选；部分已提交只纳入未提交部分
  - Spec Ref：commit-push-skill / 归档未提交提案检测与纳入
  - Scenario Ref：活跃与归档同名提案并存
  - Scenario Ref：归档提案部分制品已提交
  - Scenario Ref：归档提案无 VCS 变更
  - Scenario Ref：多个归档候选

- [x] 1.3 [代码] 归档提案未纳管制品纳入（排除规则例外） [N5][N6]
  - 文件：`src/core/templates/workflows/svn-commit.ts`
  - 验证：提交范围排除段新增例外条款；仅被选中/点名的归档提案制品经环节 2 确认后 auto `svn add`；其他未点名未纳管制品仍排除
  - Spec Ref：commit-push-skill / 提交范围排除（最高优先级）
  - Scenario Ref：归档提案未纳管制品例外

- [x] 1.4 [代码] 归档提案制品归文档类 [N6]
  - 文件：`src/core/templates/workflows/svn-commit.ts`
  - 验证：三类自动分类的文档类别明确包含经确认纳入的归档提案制品
  - Spec Ref：commit-push-skill / 提案分类提交（三类自动分类）
  - Scenario Ref：归档提案制品归文档类

- [x] 1.5 [代码] 三类提交说明统一「对象 + 改动」并禁止文档泛化 [N7][N8]
  - 文件：`src/core/templates/workflows/svn-commit.ts`
  - 验证：输出要求新增统一规范段；文档类禁止「更新文档 / 修改文档 / 更新提案」单独成句；无法定位对象时文件路径/能力名兜底并询问
  - Spec Ref：commit-push-skill / 三类提交说明统一规范
  - Scenario Ref：文档类泛化表述
  - Scenario Ref：三类说明同等明确
  - Scenario Ref：文档对象无法定位

- [x] 1.6 [代码] 归档提案溯源尾行去日期前缀 [N7]
  - 文件：`src/core/templates/workflows/svn-commit.ts`
  - 验证：溯源段说明 `YYYY-MM-DD-<name>` → `提案: <name>`；非日期前缀目录原样使用
  - Spec Ref：commit-push-skill / 提案溯源标注
  - Scenario Ref：归档提案尾行去日期前缀

- [x] 1.7 [代码] 汇报移除知识库结果 [N11][N12]
  - 文件：`src/core/templates/workflows/svn-commit.ts`
  - 验证：输出要求与汇报段不再包含 submission_id / 审核状态 / 知识库推送结论
  - Spec Ref：commit-push-skill / 提交汇报
  - Scenario Ref：汇报不含知识库结果

- [x] 1.8 [代码] 提案状态边界改为归档正常处理 [N2][N3]
  - 文件：`src/core/templates/workflows/svn-commit.ts`
  - 验证：点名已归档提案时正常读取并推进（提示「提案已归档」），不再报错拒绝；无候选时退化为场景 2
  - Spec Ref：commit-push-skill / 提案状态边界处理
  - Scenario Ref：点名已归档提案
  - Scenario Ref：未点名且无候选退化

## 2. Git 模板改造（`src/core/templates/workflows/commit.ts`）

- [x] 2.1 [代码] 归档检测与固定清单归档路径支持 [G1][G2][G3][G4][G7]
  - 文件：`src/core/templates/workflows/commit.ts`
  - 验证：提案检测同时覆盖 `openspec/changes/` 与 `archive/` 未提交制品；归档项标注「已归档」；固定清单前缀支持 `openspec/changes/archive/<dir>/`；尾行使用去日期前缀名称
  - Spec Ref：commit-push-skill / Git 提交技能的提案制品纳入
  - Scenario Ref：归档未提交提案被自动检测
  - Scenario Ref：多候选时由用户选择
  - Scenario Ref：无候选退化为普通提交

- [x] 2.2 [代码] docs 类提交说明明确化 [G5][G6][G8]
  - 文件：`src/core/templates/workflows/commit.ts`
  - 验证：提交信息规范新增 docs 类要求（文档对象 + 内容变化），禁止「更新文档」泛化
  - Spec Ref：commit-push-skill / Git 提交技能的提案制品纳入
  - Scenario Ref：docs 类说明不得泛化

## 3. 规格与生成产物同步

- [x] 3.1 [代码] 重新生成技能快照并构建
  - 文件：`skills/**`、`dist/**`
  - 验证：`pnpm build && pnpm generate:skills` 成功；`test/skills-parity.test.ts` 通过
  - Spec Ref：commit-push-skill / 显式触发与三环节强制确认
  - Scenario Ref：不再询问知识库推送

- [x] 3.2 [使用说明] 版本号递增与 CHANGELOG 更新
  - 产出：`CHANGELOG.md`、`package.json`、`README.md`
  - 验证：`node bin/iagent.js version` 判定为 minor（新增行为契约），`version bump` 写回并生成 `## [<新版本>]` 小节
  - Spec Ref：commit-push-skill / 显式触发与三环节强制确认
  - Scenario Ref：不再询问知识库推送

## 4. 测试

- [x] 4.1 [测试][单元][P0] 模板契约：知识库移除与三环节一致性
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：svn-commit 正文不含知识库 / llm-wiki / submission_id；环节编号为 1-3；普通文本不触发、环节未确认不推进
  - Spec Ref：commit-push-skill / 显式触发与三环节强制确认
  - Scenario Ref：普通文本提交请求不触发
  - Scenario Ref：环节未确认不得推进
  - Scenario Ref：不再询问知识库推送

- [x] 4.2 [测试][单元][P0] 归档候选检测与状态边界
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：归档扫描、已归档标注、同名并存、部分提交、无变更、多候选、非日期目录均有断言
  - Spec Ref：commit-push-skill / 归档未提交提案检测与纳入
  - Scenario Ref：活跃与归档同名提案并存
  - Scenario Ref：归档提案部分制品已提交
  - Scenario Ref：归档提案无 VCS 变更
  - Scenario Ref：多个归档候选
  - Scenario Ref：非日期前缀归档目录
  - Scenario Ref：溯源尾行去日期前缀
  - Scenario Ref：SVN 归档提案未纳管制品
  - Scenario Ref：非日期前缀归档目录

- [x] 4.3 [测试][单元][P0] 提交范围确定
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：未指定时自动检测归档；列表不存在列出可用列表；点名提案读取并推进
  - Spec Ref：commit-push-skill / 提交范围确定（四场景）
  - Scenario Ref：未指定时自动检测到归档提案
  - Scenario Ref：指定的变更列表不存在
  - Scenario Ref：场景 4 提案点名

- [x] 4.4 [测试][单元][P0] 提案状态边界
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：点名归档提案正常推进并提示；无候选退化为普通提交
  - Spec Ref：commit-push-skill / 提案状态边界处理
  - Scenario Ref：点名已归档提案
  - Scenario Ref：未点名且无候选退化

- [x] 4.5 [测试][单元][P0] 三类说明统一规范
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：文档类泛化表述被禁止；三类均含对象+改动；对象无法定位时兜底并询问
  - Spec Ref：commit-push-skill / 三类提交说明统一规范
  - Scenario Ref：文档类泛化表述
  - Scenario Ref：三类说明同等明确
  - Scenario Ref：文档对象无法定位

- [x] 4.6 [测试][功能][P1] Git 提案制品纳入与暂存安全
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：固定清单精确暂存、前缀校验、禁止全量暂存、人工确认闸门、归档路径与尾行、docs 明确化、降级 WARN
  - Spec Ref：commit-push-skill / Git 提交技能的提案制品纳入
  - Scenario Ref：单活跃变更的提案制品随提交
  - Scenario Ref：归档未提交提案被自动检测
  - Scenario Ref：多候选时由用户选择
  - Scenario Ref：无候选退化为普通提交
  - Scenario Ref：不使用全量暂存
  - Scenario Ref：提交前仍需人工确认
  - Scenario Ref：纳管缺失时降级不阻断
  - Scenario Ref：docs 类说明不得泛化

- [x] 4.7 [测试][单元][P0] 溯源尾行命名
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：归档提案尾行为去日期前缀名称；每笔分类提交独立标注
  - Spec Ref：commit-push-skill / 提案溯源标注
  - Scenario Ref：每笔独立标注
  - Scenario Ref：归档提案尾行去日期前缀

- [x] 4.8 [测试][单元][P1] SVN 排除规则回归
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：编译产物排除优先；A/M/? 状态处理；全部排除时终止；归档未纳管例外
  - Spec Ref：commit-push-skill / 提交范围排除（最高优先级）
  - Scenario Ref：排除项被提交集内文件引用
  - Scenario Ref：排除项已被 svn add 调度
  - Scenario Ref：全部变更均被排除
  - Scenario Ref：归档提案未纳管制品例外

- [x] 4.9 [测试][单元][P1] 三类自动分类回归
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：路径优先规则；某类为空跳过；提案产出命中排除；未纳管制品处理；归档制品归文档
  - Spec Ref：commit-push-skill / 提案分类提交（三类自动分类）
  - Scenario Ref：测试目录下文档随测试类
  - Scenario Ref：某类为空跳过该笔
  - Scenario Ref：提案产出命中排除规则
  - Scenario Ref：openspec 制品未纳管
  - Scenario Ref：归档提案制品归文档类

- [x] 4.10 [测试][单元][P1] 提交汇报
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：汇报字段完整且不含知识库结果
  - Spec Ref：commit-push-skill / 提交汇报
  - Scenario Ref：提案分类提交完整汇报
  - Scenario Ref：汇报不含知识库结果

- [x] 4.11 [测试][单元][P1] openspec 纳管策略
  - 文件：`test/commit-skill-templates.test.ts`
  - 验证：纳管规则链、缓存排除、放行写法生效、init 只提示、SVN 归档提案例外
  - Spec Ref：commit-push-skill / openspec 变更制品的纳管策略
  - Scenario Ref：变更制品可被提交
  - Scenario Ref：归档变更制品同样被纳管
  - Scenario Ref：本机缓存仍被忽略
  - Scenario Ref：放行写法在 git 语义下真实生效
  - Scenario Ref：init 只提示不改写
  - Scenario Ref：SVN 侧归档提案例外

- [x] 4.12 [测试][单元][P1] 全量回归与预算校验
  - 文件：`test/skills-parity.test.ts`、`test/skill-size-budget.test.ts`、`test/allowed-tools.test.ts`
  - 验证：`pnpm test` 全绿；技能主文件 ≤500 行；`allowedTools` 未新增未使用授权
  - Spec Ref：commit-push-skill / 显式触发与三环节强制确认
  - Scenario Ref：不再询问知识库推送

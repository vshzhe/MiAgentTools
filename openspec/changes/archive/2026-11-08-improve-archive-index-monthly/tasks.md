# Tasks: improve-archive-index-monthly

<!-- 任务类型标签（并列四类）：
     [代码] 实现代码 / [测试] 测试代码 / [DB脚本] 数据库脚本 / [使用说明] 补充文档（默认产出至 attachments/）
     [测试] 子标注：层级 [单元]/[功能] + 优先级 [P0]/[P1]/[P2]
     补充文档类（非 [代码]/[测试]）MUST 含 `产出:` 字段指定输出路径 -->

## 1. 历史索引迁移（一次性仓库维护，D3）

- [x] 1.1 [代码] 按归档日期列前 7 位把 45 条历史条目拆分到三个月度索引文件（2026-09:17 / 2026-10:18 / 2026-11:10），条目文本逐字保留（含摘要与 `[含xxx]` 注记）[N13]
  - 文件：`openspec/changes/archive/ARCHIVE-INDEX-2026-09.md`、`openspec/changes/archive/ARCHIVE-INDEX-2026-10.md`、`openspec/changes/archive/ARCHIVE-INDEX-2026-11.md`
  - 验证：拆分脚本输出条目计数为 17/18/10；逐行与源表一致
  - Spec Ref：spec-workflow-skills / 归档索引历史分片迁移（一次性）
  - Scenario Ref：spec-workflow-skills / 归档索引历史分片迁移（一次性）/ 历史条目逐字拆分

- [x] 1.2 [代码] 把根入口 `ARCHIVE-INDEX.md` 改写为入口形态（月份导航 + 全局模块统计），全局统计从三个月度文件确定性聚合 [N13][N17]
  - 文件：`openspec/changes/archive/ARCHIVE-INDEX.md`
  - 验证：根入口不含条目明细；月份导航 3 行；统计合计 45
  - Spec Ref：spec-workflow-skills / 归档索引历史分片迁移（一次性）
  - Scenario Ref：spec-workflow-skills / 归档索引历史分片迁移（一次性）/ 历史条目逐字拆分

- [x] 1.3 [测试][功能][P0] 核对迁移逐字保真与统计一致性（`git diff` + 拆分脚本输出 + 人工抽检）[N17]
  - 文件：`openspec/changes/archive/ARCHIVE-INDEX*.md`
  - 验证：45 条条目逐字一致；全局统计 = 各月统计之和；日期无法解析条目不丢弃（B10）
  - Spec Ref：spec-workflow-skills / 归档索引历史分片迁移（一次性）
  - Scenario Ref：spec-workflow-skills / 归档索引历史分片迁移（一次性）/ 日期无法解析的历史条目不丢弃
  - Scenario Ref：spec-bulk-archive-skill / 批量索引单点更新 / 全局统计由月度文件确定性重算

## 2. spec-archive 单变更归档模板

- [x] 2.1 [代码] 改造 Step 7：按归档目录名前 7 位判定月份，创建/纯追加当月 `ARCHIVE-INDEX-YYYY-MM.md`，损坏时保留原文 + 最小追加 + WARN [N5][N6][N7][N8][N9][N10][N11]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：正文含月份解析、月度模板、纯追加、损坏处置四类强制句；MUST NOT 残留单文件全量追加表述
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 按归档目录名分月写入月度索引
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 月度索引首次创建标准结构
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 归档目录名缺少日期前缀
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 月份不因时区换算偏移

- [x] 2.2 [代码] 改造 Step 7 根入口段：追加缺失月份链接（已存在跳过），从全部月度文件确定性重算全局统计；根入口缺失时依据月度文件重建、损坏时只补链接 + WARN [N12][N13][N14][N15][N16][N17]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：根入口只更新链接与统计，MUST NOT 改写既有条目；重建路径有明确说明
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 根入口只更新月份链接与全局统计
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 根入口损坏时只补链接不重建
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 同月多次归档链接去重

- [x] 2.3 [代码] 同步 Guardrails、归档写入面、归档只读例外、摘要与自检措辞（月度索引为显式写入面；失败/跳过不入索引）[N18]
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 验证：Guardrails 含「任何索引文件 MUST NOT 全量重建」「月度纯追加」；自检例外涵盖根入口与月度索引
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 已归档内容只读
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 失败或跳过变更不入索引
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 需求文档随变更目录原样保留
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 需求文档缺失时不处理
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 归档收尾清理流程级工作区
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 探索记忆同步
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / delta spec 智能合并
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / MODIFIED 目标在主 spec 缺失
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / daemon 活跃时不同步也不解锁

- [x] 2.4 [测试][单元][P0] 更新 `test/templates.test.ts`：锁定 spec-archive 月度创建 / 纯追加 / 损坏只追加不重建 [N7][N9][N10]
  - 文件：`test/templates.test.ts`
  - 验证：断言 `ARCHIVE-INDEX-YYYY-MM.md`、月份前缀解析、保留原文 + 最小追加 + WARN；既有「MUST NOT 全量重建」断言保留
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 月度索引纯追加不重建

- [x] 2.5 [测试][单元][P0] 更新 `test/templates.test.ts`：锁定根入口边界（仅链接 + 全局统计、既有条目不改写、缺失重建）[N12][N13][N14][N15][N16][N17]
  - 文件：`test/templates.test.ts`
  - 验证：断言根入口更新边界句与缺失重建句；断言不再出现单一 `ARCHIVE-INDEX.md` 纯追加旧表述
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 根入口缺失时依据月度文件重建

## 3. spec-bulk-archive 批量归档模板

- [x] 3.1 [代码] 改造 Step 10：按每个成功变更归档目录名前 7 位分组，分别创建/纯追加各自月度索引 [N2][N3][N4][N5][N10][N11]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：正文含跨月分组规则与各月独立追加规则；failed/skipped 不入索引
  - Spec Ref：spec-bulk-archive-skill / 批量索引单点更新
  - Scenario Ref：spec-bulk-archive-skill / 批量索引单点更新 / 跨月批量归档分别写入各自月度文件
  - Scenario Ref：spec-bulk-archive-skill / 批量索引单点更新 / 月度索引追加与注记

- [x] 3.2 [代码] 改造 Step 10 根入口段：主代理单点追加缺失月份链接并从全部月度文件重算全局统计；根入口缺失/损坏处置同单变更协议 [N12][N13][N14][N15][N16][N17]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：正文强调主代理单点、子代理禁写；统计为确定性重算而非增量累加
  - Spec Ref：spec-bulk-archive-skill / 批量索引单点更新
  - Scenario Ref：spec-bulk-archive-skill / 批量索引单点更新 / 全局统计由月度文件确定性重算

- [x] 3.3 [代码] 同步写入面 / 只读护栏 / Guardrails / 批量汇总措辞（月度索引为显式写入面；单元 c 步自检涵盖根入口与月度索引）[N18]
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 验证：护栏含「任何索引文件 MUST NOT 全量重建」；汇总含月度索引写入状态
  - Spec Ref：spec-bulk-archive-skill / 批量索引单点更新
  - Scenario Ref：spec-bulk-archive-skill / 批量索引单点更新 / 月度索引结构损坏时只追加不重建

- [x] 3.4 [测试][单元][P0] 更新 `test/templates.test.ts`：锁定批量跨月分组、根入口单点更新、失败不入索引、损坏只追加 [N3][N4][N10][N11][N17]
  - 文件：`test/templates.test.ts`
  - 验证：断言跨月分组句、根入口统计重算句、`failed/skipped MUST NOT 入索引`、`MUST NOT 全量重建`
  - Spec Ref：spec-bulk-archive-skill / 批量索引单点更新
  - Scenario Ref：spec-bulk-archive-skill / 批量索引单点更新 / 失败变更不入索引

## 4. 父编排与 debug

- [x] 4.1 [代码] 更新 `workflow.ts` 归档阶段说明：索引表述为根入口（月份导航 + 全局统计）+ 月度索引（纯追加），MUST NOT 重述协议 [N18]
  - 文件：`src/core/templates/workflows/workflow.ts`
  - 验证：正文含两部分索引表述；不重复声明创建/追加/统计算法
  - Spec Ref：workflow-suite-skills / 编排技能归档阶段 SHALL 引用分片归档索引协议
  - Scenario Ref：workflow-suite-skills / 编排技能归档阶段 SHALL 引用分片归档索引协议 / workflow 归档阶段引用分片索引

- [x] 4.2 [代码] 更新 `auto-workflow.ts` 自动归档阶段说明：同 4.1 的索引表述 [N18]
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 验证：正文含两部分索引表述；不重复声明协议
  - Spec Ref：workflow-suite-skills / 编排技能归档阶段 SHALL 引用分片归档索引协议
  - Scenario Ref：workflow-suite-skills / 编排技能归档阶段 SHALL 引用分片归档索引协议 / auto-workflow 自动归档阶段引用分片索引

- [x] 4.3 [代码] 复核 `debug.ts`：确认无索引写入逻辑、不改归档逻辑，在任务中记录「无需改动」结论 [N18]
  - 文件：`src/core/templates/workflows/debug.ts`
  - 验证：正文无 `ARCHIVE-INDEX` 写入或月度索引协议；仅保留归档只读护栏与 `/iagent:spec-archive` 提示
  - Spec Ref：workflow-suite-skills / 编排技能归档阶段 SHALL 引用分片归档索引协议
  - Scenario Ref：workflow-suite-skills / 编排技能归档阶段 SHALL 引用分片归档索引协议 / debug 不写索引且归档逻辑不变

- [x] 4.4 [测试][单元][P1] 补 workflow-suite 断言：workflow / auto-workflow 含分片索引表述，debug 无索引写入 [N18]
  - 文件：`test/templates.test.ts`
  - 验证：断言 workflow / auto-workflow 正文含根入口 + 月度索引表述；断言 debug 正文不含 `ARCHIVE-INDEX` 写入
  - Spec Ref：workflow-suite-skills / 编排技能归档阶段 SHALL 引用分片归档索引协议
  - Scenario Ref：workflow-suite-skills / 编排技能归档阶段 SHALL 引用分片归档索引协议 / debug 不写索引且归档逻辑不变

## 5. 派生、构建与快照

- [x] 5.1 [测试][单元][P1] 更新 `test/template-derivation.test.ts`：指令版保留月度索引强制规则句（纯追加、月份落点、标签白名单），逐步细节仍被 `CMD:SKIP` 裁剪 [N18]
  - 文件：`test/template-derivation.test.ts`
  - 验证：断言派生版含强制规则句、不含被裁剪的逐步操作细节
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 月度索引纯追加不重建

- [x] 5.2 [代码] 执行 `pnpm build && pnpm generate:skills` 重新生成 `skills/**` 快照（不手编）[N18]
  - 文件：`skills/iagent-spec-archive/SKILL.md`、`skills/iagent-spec-bulk-archive/SKILL.md`、`skills/iagent-workflow/SKILL.md`、`skills/iagent-auto-workflow/SKILL.md` 等
  - 验证：`pnpm generate:skills` 成功；`test/skills-parity.test.ts` 通过
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 归档不含索引重建

- [x] 5.3 [测试][单元][P0] 运行 `pnpm test` 全量回归（含 skills parity、大小预算、allowedTools）[N18]
  - 文件：`test/`
  - 验证：全量测试通过；无模板漂移或大小预算失败
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 已归档内容只读

## 6. 版本号

- [x] 6.1 [代码] 按 AGENTS.md 守则第 8 条递增 minor（feat 变更）：`node bin/iagent.js version bump`，同步 `package.json` / `CHANGELOG.md` / `README.md` 并随功能提交 [N17]
  - 文件：`package.json`、`CHANGELOG.md`、`README.md`
  - 验证：`node bin/iagent.js version` 判定为 minor；版本号与 CHANGELOG 小节一致
  - Spec Ref：spec-workflow-skills / spec-archive 归档技能
  - Scenario Ref：spec-workflow-skills / spec-archive 归档技能 / 归档不含索引重建

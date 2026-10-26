# tasks：integrate-init-rules

> 任务锚点 `[N<id>]` 对应探索文件 `## 功能流程图` 的节点（F1 侧 I3/I4/I5；F1B 侧 U2/U3/U4；F2 侧 P1/P3/P4/P5/P6；F3 侧 N1/N2/N3/N4/N5），节点覆盖度计入验证。
> 任务类型标签：`[代码]` / `[测试]` / `[使用说明]`；`[测试]` 任务带 `[单元]`/`[功能]` 与 `[P0]`/`[P1]`/`[P2]` 子标注。

### Caller Updates

readProjectConfig 直接调用方：编排器影响面分析记为 **14 语义调用点**，本次按全量 grep 核对为 **30 处调用表达式 / 10 个文件**（生产 5 处、测试 25 处）。全部调用点签名不变，逐项处置如下：

| 调用方 | 位置 | 处置 |
|---|---|---|
| `runGenerate` | src/commands/generate.ts:112（按 `rules[type]` 类型键注入，generate.ts:59-62） | **无需改动**：注入键是类型 id，文件名解析在 `readProjectConfig` 内部由映射承担 |
| `runInit`（读 config） | src/commands/init.ts:157 | **无需改动**；其 step 4（init.ts:302）是 `ensureProjectConfig` 改造点（任务 1.5） |
| `runUpdate` | src/commands/update.ts:162 | **无需改动**；其 0.2 之后新增 0.3 修复步骤（任务 2.3），步骤先序保证读到的已是修复后内容 |
| `runConfigInteractive` | src/commands/config.ts:57（前置 `ensureProjectConfig` :56） | **无需改动**；需知晓语义外溢：`config` 交互入口经 `ensureProjectConfig` 一并获得规则修复（幂等、非阻断，design D-3） |
| `runConfigShow` | src/commands/config.ts:88（rules 展示按类型键 :98-101） | **无需改动**：展示仍为类型 id 列表，不展开文件名 |
| `runConfigSet` | src/commands/config.ts:131（`ensureProjectConfig`） | **无需改动**；同 `runConfigInteractive` 的语义外溢说明 |
| `parseProjectConfig` 消费链 | 生产 1 处（project-config.ts:218 内部）；测试 6 处（completion-config.test.ts:113/120/231/246/252、project-config-context.test.ts:159） | **无需改动**：rules 列表契约是类型 id，与文件名正交 |
| `listRuleFiles` | 生产 0 处；测试 1 处（completion-config.test.ts:174） | 函数体改反查函数（任务 1.6），断言迁移见任务 3.1 |
| `readRuleFile` | 仅 project-config.ts:227 内部 | 函数体新增标记行过滤（任务 1.3），无外部调用方 |
| `defaultRuleFileContent` | ensureProjectConfig :256；测试 2 处（skill-type-taxonomy.test.ts:42、completion-config.test.ts:217） | 内容重写（任务 1.2）；断言迁移见任务 3.1 / 3.3 |
| `ensureProjectConfig` | init.ts:302、config.ts:56、config.ts:131；测试 setup 16 处（claude-host-adapter:33、commands:23/197/216/243、completion-config:259、config-command:22、host-smoke:19、opencode-v2:114、pi-native:175、pi-runtime:254/275、uninstall-show:21/73/127、validate-update:25） | 改造见任务 1.5：created 分支先清旧名再写语义名三文件，exists 分支转修复；测试 setup 均断言「存在即足够」，不受影响，涉及 rules 断言的用例按任务 3.1/3.4 迁移 |
| 测试 `readProjectConfig` 断言 | commands.test.ts:442/449/466、completion-config.test.ts:154/160/168/261/266、config-command.test.ts:73/78/80、legacy-migration.test.ts:240/275/280/289/294/327/328/476、project-config-context.test.ts:100/131/143/145/232/251 | 仅 rules 相关断言需迁移（legacy-migration.test.ts:275/280、completion-config.test.ts:154/160/168）；workflows/tools/context 断言不动 |

## 1. 核心契约层（src/core/project-config.ts）

- [x] 1.1 [代码] 新增类型→语义名映射单一源：`RULE_FILE_NAMES`、`ruleFileNameFor`、`ruleFileTypeFor`、`LEGACY_RULE_FILE_NAMES`（design D-4）`[N4]`
  - 文件：`src/core/project-config.ts`
  - Spec Ref: iagent-rules-config / 规则文件命名映射单一源
  - Scenario Ref: iagent-rules-config / 规则文件命名映射单一源 / 映射外类型回退
  - 验证：断言 `impl`→`coding-rules.md`、`test`→`testing-rules.md`、`spec`→`spec.md`、`commit`→`commit.md` 回退

- [x] 1.2 [代码] 重写 `defaultRuleFileContent`：`ai-coding.md` 要点蒸馏进 coding-rules 域、`artifact-generation.md` 要点蒸馏进 spec 域、test 域占位兜底；新增 `MANUAL_DOMAIN_MARKS` 与人工域标记骨架（design D-5）`[N3]`
  - 文件：`src/core/project-config.ts`
  - Spec Ref: iagent-rules-config / init 生成蒸馏规则
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 新装机生成三份语义名文件
  - Spec Ref: project-init-rule-distill / 测试规则蒸馏与占位兜底
  - Scenario Ref: project-init-rule-distill / 测试规则蒸馏与占位兜底 / 无测试代码时占位兜底
  - 验证：断言三份默认内容含各自蒸馏要点行与成对人工域标记，且不含 openspec/rules 运行时依赖

- [x] 1.3 [代码] `readRuleFile` 过滤人工域标记行：区间内规则行照常注入、`#` 注释照常过滤（design D-5 extract 契约）`[N4]`
  - 文件：`src/core/project-config.ts`
  - Spec Ref: iagent-rules-config / 人工域标记的读取契约
  - Scenario Ref: iagent-rules-config / 人工域标记的读取契约 / 人工域规则行注入
  - Scenario Ref: iagent-rules-config / 人工域标记的读取契约 / 注释行不注入
  - 验证：输入含标记行 + 规则行 + `#` 注释的文件，断言结果只含规则行

- [x] 1.4 [代码] 新增 `repairRuleFiles(projectRoot, options?): RuleRepairReport`：旧名检测删除并 WARN / 缺失重建 / 无人工域标记文件的常量对齐 + WARN / 人工域外对齐（常量块不含标记，原区间原文按序保留）/ 多区间不合并按原序 / 标记破损取保留侧 / 幂等（两次 byte-equal）/ 读写失败（权限·只读·IO）记 WARN 不抛出 / 对 `options.preservePaths`（本轮 legacy 迁移产出，posix 项目相对路径）跳过常量对齐并登记 `preserved`（不存在/非管理型路径安全忽略）；类型与算法见 design D-2 契约 / D-5（design D-2 / D-4）`[U3][N1][N2]`
  - 文件：`src/core/project-config.ts`
  - Spec Ref: iagent-rules-config / update 规则重建/修复
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 缺失文件重建
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 人工域外对齐
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 人工域破损取保留侧
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 无人工域标记的规则文件对齐并告警
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 多个人工域区间保持原顺序
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 修复写入失败不中断
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 本轮迁移产出跳过对齐
  - Spec Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警
  - Scenario Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警 / 检测删除并告警
  - Scenario Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警 / 无旧名时幂等
  - 验证：纯函数级测试覆盖全部分支（任务 3.4），含只读目录/写入失败 → WARN 且流程继续；失败不抛异常只记 WARN

- [x] 1.5 [代码] 改造 `ensureProjectConfig(projectRoot, options?)`：created 分支**先调用 `removeLegacyRuleFiles`**（与 repairRuleFiles 共用的导出单步）再写三份语义名文件，**已存在语义名文件一律不覆盖不修复**、记 WARN「已存在，未做常量对齐；内容可能过期，可运行 `iagent update` 修复」并写入 `ruleRepair.warnings`；exists 分支转 `repairRuleFiles`；两分支都透传 `options.preservePaths`；返回体扩 `ruleRepair`；同步文件头注释与「保留用户修改」措辞（design D-3）`[I3][I4][I5]`
  - 文件：`src/core/project-config.ts`
  - Spec Ref: iagent-rules-config / init 生成蒸馏规则
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 新装机生成三份语义名文件
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 无 config.yaml 时仍清理旧名规则文件
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / created 分支不覆盖既有语义名文件
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 重复 init 转入重建/修复
  - 验证：config.yaml 已存在但 rules 目录缺失时，调用后三份语义名文件被重建，config.yaml 内容逐字不变；无 config.yaml 且存在 `impl.md` 时旧名被删除并记 WARN；无 config.yaml 且 `coding-rules.md` 已存在时字节不变且出现 WARN

- [x] 1.6 [代码] `readProjectConfig`、`listRuleFiles` 与内部写入路径全部改走映射，消灭管理型三类型的 `` `${type}.md` `` 直拼（listRuleFiles 需双形态识别：语义名 + 合法类型 id 回退名）`[N4]`
  - 文件：`src/core/project-config.ts`
  - Spec Ref: iagent-rules-config / 规则文件命名映射单一源
  - Scenario Ref: iagent-rules-config / 规则文件命名映射单一源 / 读取语义名文件
  - Scenario Ref: iagent-rules-config / 规则文件命名映射单一源 / listRuleFiles 双形态识别
  - 验证：`coding-rules.md` 与用户自建 `commit.md` 同目录时两者均被列出；`missingRuleFiles` 不因语义名生效而误报

## 2. 入口、扫描与模板

- [x] 2.1 [代码] legacy 迁移规则搬运落点改走 `ruleFileNameFor`：`.venus/rules/tr_impl.md` 直达 `coding-rules.md`、`tr_test.md` 直达 `testing-rules.md`，内容**逐字保留**（不改写正文、不注入人工域标记）；迁移报告新增机读字段 `movedRules`（本轮写入的规则文件相对路径）`[N3]`
  - 文件：`src/core/legacy-migration.ts`
  - Spec Ref: legacy-install-migration / 配置内容搬运与类型改名
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / rules 列表改名与落点直达语义名
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / 搬运内容逐字保留且登记 movedRules
  - Spec Ref: iagent-rules-config / 规则文件命名映射单一源
  - Scenario Ref: iagent-rules-config / 规则文件命名映射单一源 / 读取语义名文件
  - 验证：迁移报告落点为 `coding-rules.md` / `testing-rules.md`，`movedRules` 含两文件；`LEGACY_TYPE_RENAME` 表与守卫测试不动

- [x] 2.2 [代码] `runInit`：`InitResult` 新增 `ruleRepair`（`RuleRepairReport`：removedOldName / created / aligned / preserved / warnings），step 4 把 `legacyMigration.movedRules` 作为 `preservePaths` 透传给 `ensureProjectConfig`（design D-3）`[I5]`
  - 文件：`src/commands/init.ts`
  - Spec Ref: iagent-rules-config / init 生成蒸馏规则
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 重复 init 转入重建/修复
  - 验证：重复 init 的 `configState='exists'` 但 `ruleRepair` 含重建/删除明细；本轮迁移产出的规则文件登记在 `preserved`

- [x] 2.3 [代码] `runUpdate`：在 0.2 技能 id 迁移之后、读 config（update.ts:162）之前插入 0.3 规则修复步骤；项目无 `.iagent/` 时空操作不创建目录；把 `legacyMigration.movedRules` 作为 `preservePaths` 传入（首轮只登记不对齐）；`UpdateResult` 新增 `ruleRepair`（design D-2）`[U2][U3][U4]`
  - 文件：`src/commands/update.ts`
  - Spec Ref: iagent-rules-config / update 规则重建/修复
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 未安装项目空操作
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 本轮迁移产出跳过对齐
  - 验证：未 init 项目跑 update 后 `.iagent/` 仍不存在；本轮迁移产出的规则文件内容逐字保留（不被常量对齐重写）

- [x] 2.4 [代码] CLI 输出：init / update 按 `ruleRepair` 明细渲染——`新建 N / 对齐 M / 保留迁移内容 K / 删除旧名 J`（某类为 0 时省略该项；**四类全零且无告警**时输出「规则文件已是最新」；四类全零但有告警时输出「规则文件：无变更」并逐行展示告警），存在 `preserved` 时输出提示行「迁移规则已原样保留；如需长期保留请将其移入人工域标记区间，否则下次 init/update 的常量对齐会重写该文件」（**仅 CLI 单点承载**，不改 `renderLegacyMigrationReport` 签名与报告文本），旧名删除与对齐 WARN 逐行输出（对齐 `renderLegacyMigrationReport` 报风格）；init exists 分支文案由「已存在，保留」改为「config.yaml 保留，规则文件已按最新常量修复」（cli/index.ts:121-125）`[I5][U4]`
  - 文件：`src/cli/index.ts`
  - Spec Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警
  - Scenario Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警 / 检测删除并告警
  - Spec Ref: iagent-rules-config / update 规则重建/修复
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 本轮迁移产出跳过对齐
  - 验证：四类明细按实际数量渲染；四类全零且无告警输出「规则文件已是最新」；四类全零有告警输出「规则文件：无变更」+ 告警行；preserved 场景输出指定提示文案

- [x] 2.5 [代码] 预扫描测试探针：`ProjectScanReport.signals` 新增 `tests`（`test-dir` / `test-files` 两形态，字段 `kind`/`name`/`count`）+ 探测逻辑（只匹配目录名与文件名，不读文件内容；排除清单与上限沿用）+ `renderScanReport` 渲染行（design D-7）`[P1]`
  - 文件：`src/core/project-scan.ts`
  - Spec Ref: init-project-scan / 信号与候选分层
  - Scenario Ref: init-project-scan / 信号与候选分层 / jar 存在但未被源码使用
  - Scenario Ref: init-project-scan / 信号与候选分层 / 观察到的事实记为信号
  - Scenario Ref: init-project-scan / 信号与候选分层 / 测试目录探针记录事实
  - Scenario Ref: init-project-scan / 信号与候选分层 / 测试文件模式计数触上限
  - Scenario Ref: init-project-scan / 信号与候选分层 / 无测试探针时为空
  - 验证：`createEmptyScanReport` 同步新维度；既有五维断言不变

- [x] 2.6 [代码] project-init 技能模板新增第 10 步「实现/测试规则蒸馏」：context 回写后触发；蒸馏输入声明含 `signals.tests`（第 1 步维度枚举 project-init.ts:168 增补「测试探针（tests）」）；写入 `coding-rules.md` / `testing-rules.md` 人工域区间内；缺文件按常量补建 + WARN；**文件存在但无人工域区间 → 常量块后追加空骨架 + WARN + 蒸馏行写入该区间（不改写常量块）**；失败 WARN 非阻断；不标 CMD:SKIP；第 6 步（project-init.ts:223）的两处人工域标记字面量改为 `${MANUAL_DOMAIN_MARKS.start/end}` 插值（单一源，来自 project-config）；allowedTools 核对结论=无增补（design D-6）`[P3][P4][P5][P6]`
  - 文件：`src/core/templates/workflows/project-init.ts`
  - Spec Ref: project-init-rule-distill / 规则蒸馏步骤（文档完成时点触发）
  - Scenario Ref: project-init-rule-distill / 规则蒸馏步骤（文档完成时点触发） / 文档完成时点触发蒸馏
  - Scenario Ref: project-init-rule-distill / 规则蒸馏步骤（文档完成时点触发） / 目标文件缺失时补建
  - Scenario Ref: project-init-rule-distill / 规则蒸馏步骤（文档完成时点触发） / 目标文件存在但无人工域区间
  - Scenario Ref: project-init-rule-distill / 规则蒸馏步骤（文档完成时点触发） / 蒸馏写入人工域保护生效
  - Spec Ref: project-init-rule-distill / 测试规则蒸馏与占位兜底
  - Scenario Ref: project-init-rule-distill / 测试规则蒸馏与占位兜底 / 有测试代码时蒸馏
  - Scenario Ref: project-init-rule-distill / 测试规则蒸馏与占位兜底 / 候选依赖不作使用断言
  - 验证：`pnpm build && pnpm generate:skills` 后 SKILL.md 含第 10 步与「无区间 → 追加骨架 + WARN、不改常量块」表述，且 `test/skill-size-budget.test.ts` 通过

- [x] 2.7 [代码] 模板正文引用改写：15 个模板文件共 25 处 `openspec/rules/ai-coding.md` → `.iagent/rules/coding-rules.md`、`openspec/rules/artifact-generation.md` → `.iagent/rules/spec.md`（保留缺失降级语句；措辞按语境微调）；其中 spec-propose.ts:284 与 workflow.ts:293 改写为「遵循**项目规范** `.iagent/rules/spec.md` 的制品协议要点」，不得再声称目标项目存在 `openspec/rules/`（design D-1）`[P6]`
  - 文件：`src/core/templates/workflows/auto-workflow.ts`
  - 文件：`src/core/templates/workflows/debug.ts`
  - 文件：`src/core/templates/workflows/feature-doc.ts`
  - 文件：`src/core/templates/workflows/migration.ts`
  - 文件：`src/core/templates/workflows/migration-check.ts`
  - 文件：`src/core/templates/workflows/proposal-review.ts`
  - 文件：`src/core/templates/workflows/requirement-doc.ts`
  - 文件：`src/core/templates/workflows/spec-apply.ts`
  - 文件：`src/core/templates/workflows/spec-archive.ts`
  - 文件：`src/core/templates/workflows/spec-bulk-archive.ts`
  - 文件：`src/core/templates/workflows/spec-explore.ts`
  - 文件：`src/core/templates/workflows/spec-propose.ts`
  - 文件：`src/core/templates/workflows/spec-verify-proposal.ts`
  - 文件：`src/core/templates/workflows/spec-verify.ts`
  - 文件：`src/core/templates/workflows/workflow.ts`
  - Spec Ref: project-init-rule-distill / 蒸馏内容跨宿主统一
  - Scenario Ref: project-init-rule-distill / 蒸馏内容跨宿主统一 / 多宿主项目同一内容
  - 验证：`grep -r "openspec/rules/" src/core/templates` 为 0 命中

- [x] 2.8 [代码] 版本递增 major：`package.json` 7.1.0 → 8.0.0；CHANGELOG 把 `[Unreleased]` 归档为 `## [8.0.0]`（`### BREAKING` 记录产物契约变更 + 旧名整体删除）并更新底部链接；README 的 `iagent --version` 示例同步
  - 文件：`package.json`
  - 文件：`CHANGELOG.md`
  - 文件：`README.md`
  - 验证：`node bin/iagent.js --version` 输出 8.0.0

- [x] 2.9 [代码] `pnpm build && pnpm generate:skills` 重新生成 `skills/` 快照，并 grep 复核两件事：`skills/` 中 `openspec/rules` 残留为 0；project-init 模板中人工域标记字面量只剩 `${MANUAL_DOMAIN_MARKS.start/end}` 插值形态（源文件 grep `<!-- 人工域:开始 -->` 仅命中 project-config 常量定义）
  - 文件：`skills/`
  - 验证：`git status` 仅含预期快照变动；`test/skills-parity.test.ts` 通过

## 3. 测试

- [x] 3.1 [测试][单元][P0] completion-config.test.ts 断言迁移：`impl.md`/`test.md` 断言改 `coding-rules.md`/`testing-rules.md`；「重复 init 保留用户修改」改写为「config.yaml 保留 + 映射外 `commit.md` 保留 + 管理型文件修复明细」；补「无 config.yaml 且存在 `impl.md` → 旧名删除 + WARN」与「无 config.yaml 且 `coding-rules.md` 已存在 → 字节不变 + WARN 登记」两用例；`defaultRuleFileContent('impl')` 增加蒸馏要点断言 `[I4][N5]`
  - 文件：`test/completion-config.test.ts`
  - Spec Ref: iagent-rules-config / init 生成蒸馏规则
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 重复 init 转入重建/修复
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 无 config.yaml 时仍清理旧名规则文件
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / created 分支不覆盖既有语义名文件
  - Spec Ref: iagent-rules-config / 规则文件命名映射单一源
  - Scenario Ref: iagent-rules-config / 规则文件命名映射单一源 / listRuleFiles 双形态识别
  - 验证：`pnpm test test/completion-config.test.ts` 全绿

- [x] 3.2 [测试][单元][P0] legacy-migration.test.ts 断言迁移：`tr_impl`/`tr_test` 搬运落点断言改 `coding-rules.md` / `testing-rules.md`；`spec.md` 不变；`.venus` 侧原始文件名断言保持；补 `report.movedRules` 断言（posix 项目相对路径、含两文件；`--no-migrate` / 无旧配置目录时为空数组）`[N5]`
  - 文件：`test/legacy-migration.test.ts`
  - Spec Ref: legacy-install-migration / 配置内容搬运与类型改名
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / rules 列表改名与落点直达语义名
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / 搬运内容逐字保留且登记 movedRules
  - Spec Ref: iagent-rules-config / 规则文件命名映射单一源
  - Scenario Ref: iagent-rules-config / 规则文件命名映射单一源 / 读取语义名文件
  - 验证：迁移后 `readProjectConfig(...).rules` 与 `missingRuleFiles` 断言不变，仅路径名变化；`movedRules` 三态（命中 / 跳过迁移 / 无旧配置）断言齐备

- [x] 3.3 [测试][单元][P1] commands.test.ts 旧装机夹具断言与 skill-type-taxonomy.test.ts 跟进：迁移产物路径断言改语义名；`defaultRuleFileContent('review')` 非空断言保留；补映射常量一致性断言 `[N5]`
  - 文件：`test/commands.test.ts`
  - 文件：`test/skill-type-taxonomy.test.ts`
  - Spec Ref: iagent-rules-config / 规则文件命名映射单一源
  - Scenario Ref: iagent-rules-config / 规则文件命名映射单一源 / 映射外类型回退
  - 验证：两文件全绿

- [x] 3.4 [测试][单元][P0] 新增 `repairRuleFiles` 单测：缺失重建 / 常量域漂移对齐 / 无标记文件仅常量块 + WARN / 人工域逐字保留 / 多区间按原序不合并 / 标记未闭合取保留侧 + WARN / 嵌套乱序取最外层区 + WARN / 两轮 byte-equal 幂等（按 design D-5 推演）/ 旧名删除 + WARN / 无旧名幂等 / 只读目录写入失败 → WARN 且不抛出 / `preservePaths` 命中 → 跳过对齐并登记 preserved、不存在或非管理型路径 → 安全忽略 / posix 归一（Windows 反斜杠输入与 posix 输入等价）/ 读取契约（标记行与 `#` 注释不注入）`[U3][N1][N2]`
  - 文件：`test/project-config-rules.test.ts`
  - Spec Ref: iagent-rules-config / update 规则重建/修复
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 缺失文件重建
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 人工域外对齐
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 人工域破损取保留侧
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 无人工域标记的规则文件对齐并告警
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 多个人工域区间保持原顺序
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 修复写入失败不中断
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 本轮迁移产出跳过对齐
  - Spec Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警
  - Scenario Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警 / 无旧名时幂等
  - Spec Ref: iagent-rules-config / 人工域标记的读取契约
  - Scenario Ref: iagent-rules-config / 人工域标记的读取契约 / 人工域规则行注入
  - Scenario Ref: iagent-rules-config / 人工域标记的读取契约 / 注释行不注入
  - 验证：新增测试文件全绿；幂等用例连续两次输出用 `toBe` 逐字节比较

- [x] 3.5 [测试][功能][P0] 新增 init/update 流程测试：update 0.3 先序（迁移产物**同轮内容保真**、不被常量对齐重写）/ 未 init 项目空操作不创建 `.iagent` / init 报告 `ruleRepair` 明细 / 旧名删除告警文案 / preserved 首轮提示文案 / CLI 三类分支文案（created、exists 有变更、exists 无变更=「规则文件已是最新」）各一条断言 `[U2][U3][U4][I5]`
  - 文件：`test/commands.test.ts`
  - Spec Ref: iagent-rules-config / update 规则重建/修复
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 未安装项目空操作
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 本轮迁移产出跳过对齐
  - Spec Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警
  - Scenario Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警 / 检测删除并告警
  - 验证：步骤顺序、同轮 `readProjectConfig` 内容保真、preserved 提示文案与三类 CLI 分支文案均被断言

- [x] 3.6 [测试][功能][P0] 新增 init 蒸馏验收测试（D-Q1 验收基准，以可判定短语断言）：新装 init 后 `coding-rules.md` 至少含 `[待确认]`、`Loading`、`Empty`、`Error`、`Data`；`spec.md` 至少含 `openspec/changes/`、`proposal → specs/design → tasks`、`spec validate`、`change.json`；三份文件均含成对人工域标记；`testing-rules.md` 含占位兜底行 `[I3]`
  - 文件：`test/project-config-rules.test.ts`
  - Spec Ref: iagent-rules-config / init 生成蒸馏规则
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 新装机生成三份语义名文件
  - Spec Ref: project-init-rule-distill / 测试规则蒸馏与占位兜底
  - Scenario Ref: project-init-rule-distill / 测试规则蒸馏与占位兜底 / 无测试代码时占位兜底
  - Scenario Ref: project-init-rule-distill / 测试规则蒸馏与占位兜底 / 有测试代码时蒸馏
  - 验证：新建临时项目跑 `runInit` 后逐项断言

- [x] 3.7 [测试][单元][P1] 新增 project-scan 测试探针测试：`test/` 目录记为 `test-dir` / `*Test.java`、`*.test.ts` 模式计数 / 无测试代码时 `signals.tests` 为空 / 上限触达时 `limits` 标注 / jar 候选不因存在而生成框架结论 `[P1]`
  - 文件：`test/project-scan.test.ts`
  - Spec Ref: init-project-scan / 信号与候选分层
  - Scenario Ref: init-project-scan / 信号与候选分层 / 测试目录探针记录事实
  - Scenario Ref: init-project-scan / 信号与候选分层 / 测试文件模式计数触上限
  - Scenario Ref: init-project-scan / 信号与候选分层 / 无测试探针时为空
  - Scenario Ref: init-project-scan / 信号与候选分层 / jar 存在但未被源码使用
  - Scenario Ref: init-project-scan / 信号与候选分层 / 观察到的事实记为信号
  - 验证：探针用例全绿，既有五维断言不改

- [x] 3.8 [测试][功能][P1] 一致性回归面：skills-parity（快照已重生成）、allowed-tools、command-reference-refs、subagent-resource-sharing（反向断言不破）、markdown-first-regression、skill-size-budget（project-init 新增第 10 步后的行数预算）、template-language（改写后正文语言边界）7 套全绿
  - 文件：`test/skills-parity.test.ts`
  - 文件：`test/allowed-tools.test.ts`
  - 文件：`test/command-reference-refs.test.ts`
  - 文件：`test/subagent-resource-sharing.test.ts`
  - 文件：`test/markdown-first-regression.test.ts`
  - 文件：`test/skill-size-budget.test.ts`
  - 文件：`test/template-language.test.ts`
  - Spec Ref: project-init-rule-distill / 蒸馏内容跨宿主统一
  - Scenario Ref: project-init-rule-distill / 蒸馏内容跨宿主统一 / 多宿主项目同一内容
  - 验证：`pnpm test` 全绿；判定缺陷则修模板后重跑任务 2.9

## 4. 文档

- [x] 4.1 [使用说明] `docs/upgrade-guide.md` 增订：旧名规则文件整体删除与丢失风险告警、人工域使用指引（升级前把 `impl.md`/`test.md` 手写内容迁入新名文件人工域即可免丢）、**`.venus` 搬运内容的升级步骤**（首轮 `preserved` 原样保留 → 把内容移入 `<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->` 区间 → 下一轮对齐不会重写）、**第二轮对齐语义说明**（`preservePaths` 仅豁免一轮，不构成永久保留；该提示出现在 `iagent init` / `iagent update` 的 **CLI 输出**，不在迁移报告段落）`[N2]`
  - 文件：`docs/upgrade-guide.md`
  - 产出：`docs/upgrade-guide.md`
  - Spec Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警
  - Scenario Ref: iagent-rules-config / 旧名规则文件检测删除与丢失风险告警 / 检测删除并告警
  - Spec Ref: iagent-rules-config / update 规则重建/修复
  - Scenario Ref: iagent-rules-config / update 规则重建/修复 / 本轮迁移产出跳过对齐
  - 验证：文档含旧名删除告警、`.venus` 搬运步骤、第二轮对齐语义与人工域迁移示例

- [x] 4.2 [使用说明] `docs/openspec-comparison.md` 的护栏路径表述同步（第 63 行「稳定 `openspec/rules/ai-coding.md`」改为项目侧 `.iagent/rules/coding-rules.md` 语境，并说明源仓文件与本工具模板常量的关系）
  - 文件：`docs/openspec-comparison.md`
  - 产出：`docs/openspec-comparison.md`
  - Spec Ref: project-init-rule-distill / 蒸馏内容跨宿主统一
  - Scenario Ref: project-init-rule-distill / 蒸馏内容跨宿主统一 / 多宿主项目同一内容
  - 验证：全文无「生成产物引用源仓路径」的错误表述

- [x] 4.3 [使用说明] `README.md` 项目级配置小节更新：`:286` 语义由「已存在则保留，不覆盖你的修改」改为「config.yaml 保留，规则文件按最新常量修复、人工域内逐字保留」；`:292-293` 目录树改为 `coding-rules.md` / `testing-rules.md` / `spec.md` 并注明映射外类型仍在 `rules/` 建 `<type>.md`（如 `commit.md`）；`:314-320` 规则格式示例改为语义名文件与人工域标记示例
  - 文件：`README.md`
  - 产出：`README.md`
  - Spec Ref: iagent-rules-config / init 生成蒸馏规则
  - Scenario Ref: iagent-rules-config / init 生成蒸馏规则 / 重复 init 转入重建/修复
  - Spec Ref: iagent-rules-config / 规则文件命名映射单一源
  - Scenario Ref: iagent-rules-config / 规则文件命名映射单一源 / 映射外类型回退
  - 验证：README 内不再出现「impl.md/test.md 为默认规则文件」或「已存在一律不覆盖」表述

- [x] 4.4 [使用说明] `docs/getting-started.md` 同步：`:34-35` 目录树改语义名文件；`:66-71` 规则编辑示例改为 `coding-rules.md` 并展示人工域标记写法（含「常量域由 init/update 维护、手写规则置于人工域」说明）
  - 文件：`docs/getting-started.md`
  - 产出：`docs/getting-started.md`
  - Spec Ref: iagent-rules-config / 人工域标记的读取契约
  - Scenario Ref: iagent-rules-config / 人工域标记的读取契约 / 人工域规则行注入
  - 验证：入门文档示例可被 `iagent init` 产物直接对应，无旧名残留

## 5. 能力规格回写（既有主规格 MODIFIED delta）

> 本组为**制品层**任务，5 个 delta 已在本阶段落盘（标记 `[x]`）；实现阶段仅需复核实现口径与 delta 一致，不阻塞实现。

- [x] 5.1 [使用说明] 新增 `specs/agent-tool-identity/spec.md` delta：MODIFIED「类型 id 集」——规则文件名改为经类型→语义名映射派生（映射表与派生/反查/回退细则引用 `iagent-rules-config`，本 delta 不重复映射表），消除「`.iagent/rules/<type>.md` 文件名来源」与实测行为的主规格矛盾（**制品层已落盘**；实现阶段仅复核口径一致）
  - 文件：`openspec/changes/integrate-init-rules/specs/agent-tool-identity/spec.md`
  - 产出：`openspec/changes/integrate-init-rules/specs/agent-tool-identity/spec.md`
  - Spec Ref: agent-tool-identity / 类型 id 集
  - Scenario Ref: agent-tool-identity / 类型 id 集 / 类型 id 无 tr 前缀
  - Scenario Ref: agent-tool-identity / 类型 id 集 / 规则文件名经映射派生
  - Scenario Ref: agent-tool-identity / 类型 id 集 / 映射外类型回退直拼
  - Scenario Ref: agent-tool-identity / 类型 id 集 / 非法类型被拒
  - Scenario Ref: agent-tool-identity / 类型 id 集 / 预留类型标记与可扩展
  - Scenario Ref: agent-tool-identity / 类型 id 集 / 检查类技能归入 review 类型
  - Scenario Ref: agent-tool-identity / 类型 id 集 / 归位后规则注入可达
  - Scenario Ref: agent-tool-identity / 类型 id 集 / 存量检查类技能升级归位
  - 验证：delta 独立 validate 通过；归档合并后主规格不再出现「impl.md 为读取目标」

- [x] 5.2 [使用说明] 新增 `specs/legacy-install-migration/spec.md` delta：MODIFIED「配置内容搬运与类型改名」——搬运落点经 `ruleFileNameFor` 直达语义名、正文逐字保留、报告新增 `movedRules` 机读字段（**制品层已落盘**；实现阶段仅复核口径一致）
  - 文件：`openspec/changes/integrate-init-rules/specs/legacy-install-migration/spec.md`
  - 产出：`openspec/changes/integrate-init-rules/specs/legacy-install-migration/spec.md`
  - Spec Ref: legacy-install-migration / 配置内容搬运与类型改名
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / context 逐字保留
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / rules 列表改名与落点直达语义名
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / 搬运内容逐字保留且登记 movedRules
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / workflows 列表按旧→新映射改名
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / 注释行保留
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / 扫描基线随目录搬移
  - Scenario Ref: legacy-install-migration / 配置内容搬运与类型改名 / 未知段与自定义字段逐字保留
  - 验证：delta 独立 validate 通过；与任务 2.1 的 `movedRules` 契约一致

- [x] 5.3 [使用说明] 新增 `specs/spec-workflow-skills/spec.md` delta：MODIFIED「spec 技能类型注册」（修正失真场景：init 生成 `spec.md` 而非 `spec_propose.md`）+ MODIFIED「spec-apply 派发协议与共享资源协议」（规范要点来源改为项目侧 `.iagent/rules/coding-rules.md`，fail-safe 条件同步）（**制品层已落盘**；实现阶段仅复核口径一致）
  - 文件：`openspec/changes/integrate-init-rules/specs/spec-workflow-skills/spec.md`
  - 产出：`openspec/changes/integrate-init-rules/specs/spec-workflow-skills/spec.md`
  - Spec Ref: spec-workflow-skills / spec 技能类型注册
  - Scenario Ref: spec-workflow-skills / spec 技能类型注册 / init 安装 6 个 spec 技能
  - Scenario Ref: spec-workflow-skills / spec 技能类型注册 / 成对注册与单一源派生共存
  - Scenario Ref: spec-workflow-skills / spec 技能类型注册 / list 分组展示
  - Scenario Ref: spec-workflow-skills / spec 技能类型注册 / validate 校验 spec 类型
  - Scenario Ref: spec-workflow-skills / spec 技能类型注册 / 指令 id 派生
  - Scenario Ref: spec-workflow-skills / spec 技能类型注册 / init 生成 spec 规则文件
  - Scenario Ref: spec-workflow-skills / spec 技能类型注册 / 与 impl 技能触发区分
  - Spec Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 上下文包一次性产出
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 调度指令瘦身与唯一必读制品
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 产出登记表跨批共享
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 回执最小化
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 共享指令前缀字节一致
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 禁止重读与禁止重跑已覆盖查询
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 空值处置不留空不编造
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 包缺口回执与回填
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 包机制失效 fail-safe 降级
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 单任务批次不产出包
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / auto-mode 不豁免共享资源协议
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 派发单元与并发上限
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 跨单元同文件拆出并发组
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 无子代理能力的运行时降级
  - Scenario Ref: spec-workflow-skills / spec-apply 派发协议与共享资源协议 / 任务勾选与失败重试由协调者集中管理
  - 验证：delta 独立 validate 通过；与任务 2.7 的引用改写口径一致

- [x] 5.4 [使用说明] 新增 `specs/migration-skills/spec.md` delta：MODIFIED「migration 规范要点写入上下文包」——合并来源由 `openspec/rules/ai-coding.md` 改为项目侧 `.iagent/rules/coding-rules.md`（**制品层已落盘**；实现阶段仅复核口径一致）
  - 文件：`openspec/changes/integrate-init-rules/specs/migration-skills/spec.md`
  - 产出：`openspec/changes/integrate-init-rules/specs/migration-skills/spec.md`
  - Spec Ref: migration-skills / migration 规范要点写入上下文包
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 规范要点写入包的规范要点节
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 不再内联注入规范要点
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 包不可用时退化为内联注入
  - Scenario Ref: migration-skills / migration 规范要点写入上下文包 / 规范要点缺失时不阻断
  - 验证：delta 独立 validate 通过；与任务 2.7 的 migration.ts:62 改写一致

- [x] 5.5 [使用说明] 新增 `specs/artifact-generation-protocol/spec.md` delta：MODIFIED「Shared Markdown artifact generation protocol」——声明源仓 `openspec/rules/artifact-generation.md` 仍为协议真源、目标项目侧投影为 `.iagent/rules/spec.md` 并含缺失降级场景（**制品层已落盘**；实现阶段仅复核口径一致）
  - 文件：`openspec/changes/integrate-init-rules/specs/artifact-generation-protocol/spec.md`
  - 产出：`openspec/changes/integrate-init-rules/specs/artifact-generation-protocol/spec.md`
  - Spec Ref: artifact-generation-protocol / Shared Markdown artifact generation protocol
  - Scenario Ref: artifact-generation-protocol / Shared Markdown artifact generation protocol / Generate artifacts in dependency order
  - Scenario Ref: artifact-generation-protocol / Shared Markdown artifact generation protocol / Generation protocol is shared
  - Scenario Ref: artifact-generation-protocol / Shared Markdown artifact generation protocol / 目标项目缺项目侧协议文件时降级
  - Scenario Ref: artifact-generation-protocol / Shared Markdown artifact generation protocol / Validation failure is actionable
  - 验证：delta 独立 validate 通过；与任务 1.2 的 spec 域蒸馏要点一致

## 依赖与顺序

- 1.1 → 1.4/1.6/2.1/2.7；1.2 → 1.5；1.3 → 1.4；1.4 → 1.5 → 2.2/2.3
- 2.3 依赖 1.4；2.2 依赖 1.5；2.4 依赖 2.2/2.3；2.7 依赖 1.1/1.2（引用目标存在性）
- 2.8 依赖 2.6/2.7 收口（版本号与 CHANGELOG 在模板与文档改动定稿后写）；2.9 依赖 2.6/2.7
- 3.1/3.2/3.3 依赖 1.2/1.5/1.6/2.1；3.4 依赖 1.3/1.4；3.5 依赖 2.2/2.3/2.4；3.6 依赖 1.2/1.5；3.7 依赖 2.5；3.8 依赖 2.6/2.7/2.9
- 5.1-5.5 为**制品层回写且已落盘**（`[x]`），实现阶段仅复核实现口径与 delta 一致，不阻塞实现；4.1/4.3/4.4 随实现定稿后收口，4.2 依赖 2.7 措辞定案

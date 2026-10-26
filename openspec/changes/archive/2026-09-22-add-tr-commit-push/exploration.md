# 探索：commit-push（提交推送技能迁移 + 提案自动分类提交）

## Background

用户提供源 SKILL `C:\Users\venus\Downloads\tr-commit-push\tr-commit-push\SKILL.md`（SVN 交互式提交助手 tr-commit-push），要求：

1. 分析该提交推送 SKILL 功能
2. 把相关功能迁移到当前项目（VenusAgentTools —— venus 技能工具链）
3. 增加根据提案自动[计较/校验/提交]功能（`自动计较` 疑为笔误，待 L1 澄清）
4. 提交时按不同类型分开提交：功能代码、测试代码、文档
5. 提交时自动补充来自哪个提案（提案溯源标注）

## Analysis

### 源 SKILL（tr-commit-push）功能分析

源 SKILL 是 **SVN 交互式提交助手**，面向 Venus4A 类 SVN 项目，核心能力：

| 能力块 | 内容 |
|--------|------|
| 触发约束 | 仅显式 `/tr-commit-push` 触发；四确认环节缺一不可 |
| 范围确定（环节1） | 三场景：指定 SVN changelist / 直接点名文件 / 均未指定询问全部 |
| 清单与描述确认（环节2） | M/A/D 分组清单 + 按前缀规范生成功能描述 |
| 知识库推送（环节3） | 可选推送 llm-wiki MCP，文件逐项确认，提交后查审核状态 |
| 最终确认与提交（环节4） | 完整展示后执行 |
| 提交范围排除（最高优先级） | target/、*.class、surefire-reports、*.log、.idea、docs、本地脚本永不提交；?/A/M 状态分策略处理 |
| 提交前缀规范 | feat/fix/docs/style/perf/test/build/chore/revert/refactor 十类 |
| 菜单归属标注 | Venus4A 特有：【前缀: 一级菜单-二级菜单: 业务描述】格式，取 @SystemLogAnn 真实菜单 |
| 提交执行 | 完整性检查（被引用的 ? 文件自动纳入）→ UTF-8 无 BOM 落盘 → 证书/凭据处理（E230001/E215004）→ commit --encoding UTF-8 -F → 双验证（status + log XML） |
| 汇报 | 版本号、作者、路径数、变更列表名、双验证结论、排除清单、知识库结果 |

### 现有技能（venus_tr_commit_change）分析

当前项目已有 [tr-commit.ts](../../src/core/templates/workflows/tr-commit.ts)（`venus_tr_commit_change`，type=`tr_commit`）：

- 基于 **Git**（git status/diff/add/commit/log）
- 简单四步：检查变更 → 核对 diff → 生成 Conventional Commits → 精确暂存提交
- 约束：首次执行前确认、一次提交一件事、禁提密钥/构建产物
- 无交互确认环节体系、无提案关联、无分类提交、无范围排除细则、无 SVN 支持

### 差距对比（源 SKILL → 当前项目）

| 功能 | 源 SKILL | 现有 venus_tr_commit_change | 迁移判定 |
|------|----------|------------------------------|----------|
| VCS | SVN | Git | [待确认] 双轨 or 仅增强 Git |
| 交互确认环节 | 四环节强制确认 | 单次确认 | 待迁移决策 |
| 范围排除细则 | target/编译产物/日志细粒度排除 | 仅提密钥/.env/构建产物 | 候选迁移 |
| 提交注释规范 | 十前缀+菜单归属 | Conventional Commits | 待融合决策 |
| 知识库推送 | llm-wiki MCP | 无 | [待确认] 是否保留 |
| 提案关联分类提交 | 无（源 SKILL 没有） | 无 | **全新增量功能**（用户核心诉求 3/4/5） |
| 编码/凭据处理 | UTF-8 落盘/DPAPI 解密 | 无 | SVN 专属，随 SVN 轨决策 |

### Deep Analysis Trigger
- Triggered: Yes
- Reason: 迁移 + 增强现有技能（"迁移"/"增加"关键词 + 基线扫描发现强相关现有符号 venus_tr_commit_change）
- Scope: src/core/templates/workflows/tr-commit.ts、src/core/templates/registry.ts、src/core/templates/types.ts、src/core/config.ts

## Codebase Findings

### Discovered Files
- src/core/templates/workflows/tr-commit.ts: 现有提交技能模板（venus_tr_commit_change，Git 版），迁移/增强的核心目标文件
- src/core/templates/registry.ts: WORKFLOW_PAIRS 注册表（102-134 行），tr-commit 在 117 行注册；指令 id 派生规则 deriveCommandId（venus_<type>_<name> → <type>-<name>）
- src/core/templates/types.ts: SkillTemplate/CommandTemplate 类型定义
- src/core/config.ts: SKILL_TYPES（tr_commit 等类型定义）、SKILL_PREFIX
- src/core/templates/derive-command.ts: 单一 prompt 源派生函数（spec-* 模板用，双模板漂移防护）
- C:\Users\venus\Downloads\tr-commit-push\tr-commit-push\SKILL.md: 源 SKILL（仅此一个文件）
- openspec/CONTEXT.md: 项目术语表已存在（36 个术语）

### Identified Symbols
- getTrCommitChangeSkillTemplate (src/core/templates/workflows/tr-commit.ts:6): 现有技能模板工厂函数
- getTrCommitChangeCommandTemplate (src/core/templates/workflows/tr-commit.ts:62): 对应指令模板工厂函数（手工双写——非 derive-command 派生模式）
- deriveCommandId (src/core/templates/registry.ts:88): 指令 id 派生
- WORKFLOW_PAIRS (src/core/templates/registry.ts:102): 全部技能注册表（25 对）
- getSkillTemplates / getCommandTemplates (registry.ts:142/166): 按类型/workflow 过滤获取模板

### Pattern Matches
- 技能模板模式：workflows/*.ts 导出 get<Type><Name>SkillTemplate + CommandTemplate 成对工厂函数 → registry.ts WORKFLOW_PAIRS 注册 → init/update 安装到目标项目 .claude/
- 单一 prompt 源模式：spec-* 模板正文仅维护 skill 版，command 版由 derive-command.ts 派生（tr-commit.ts 目前是手工双写两份正文）
- 默认集与勾选：DEFAULT_WORKFLOWS 8 项（tr-init-project + tr-test-generate + spec 全 6），tr-commit-change 经 .venus/config.yaml workflows 勾选安装，不入默认集

### Capability Exploration Memory (injected)
- **tr-workflow-suite-skills**: 五技能命名硬约束（技能名 venus_<type>_ 开头 + tr- 前缀）；allowedTools 必须与正文命令同步（AGENTS.md 守则 2，否则权限拦截）；深度复查 fallback 模式（技能不可用 → 主工作流内联 + WARN）；CLI 降级三签名判定。
- 相关术语（CONTEXT.md）：workflow（23 个成对单元）、默认集（8 项）、workflows 字段、依赖注入、迁移技能套件、工作流技能套件。

### Other Project Findings
- 源项目路径 C:\Users\venus\Downloads\tr-commit-push\tr-commit-push（非 CodeGraph 项目，仅 SKILL.md 单文件，已直接读取）

## Questions

### Q1: 「根据提案自动计较」的核心行为是什么？（L1 意图）
**A1**: 分类提交为主——技能根据提案自动将工作区变更归类为功能代码/测试代码/文档三类，分类分批提交，每笔提交信息自动标注来源提案；「与提案的关联校验」仅作为提交前的辅助检查项（非阻断门）。

### Q2: 迁移策略——源 SKILL（SVN）与现有 venus_tr_commit_change（Git）的关系？（L2 方案）
**A2**: 新建独立技能 venus_tr_commit_push（type=tr_commit，指令 /venus:tr-commit-push），完整迁移源 SKILL 四环节确认/范围排除/凭据处理，并承载提案分类提交新功能；现有 venus_tr_commit_change（Git 版）保持不动，行为零变更。

### Q3: 提案分类提交如何融入交互流程？（L2 方案）
**A3**: 提案点名为新场景（场景 4）：用户点名提案（如 `/venus:tr-commit-push 提交 add-xxx 提案`）→ 自动读提案 → 变更自动归类三类 → 生成三笔提交计划（各带前缀+溯源）→ 仍按四环节确认后依次执行；未点名时自动检测 openspec/changes/ 活跃变更，多个时列出供选。

### Q4: 三类自动分类判定规则？（L2 方案）
**A4**: 路径+扩展名规则为主（测试代码=src/test/**、test/**、*Test.java、*Tests.java、*.test.*；文档=*.md、docs/**、openspec/ 变更制品；功能代码=其余产出含 SQL/配置/页面），提案 tasks.md 任务类型标签作交叉校验。

### Q5: 提案溯源标注格式？（L2 方案）
**A5**: 尾行标注——主体保持源 SKILL 单行格式，另起一行 `提案: <变更名>`；不破坏菜单格式，SVN/Git 通用，便于批量提取溯源。

### Q6: 分类提交中途某笔失败的处理？（L3 异常）
**A6**: 失败即停+汇报——任一笔失败即停，不继续后续类别、不自动回滚已成功笔（SVN 已提交无法本地回滚），汇报已完成笔/未执行笔及失败原因，由用户决定后续。

### Q7: 提案场景下与点名提案无关联的工作区变更如何处理？（L3 异常）
**A7**: 列出待裁决——对每个变更文件与提案（tasks/proposal/design）做关联校验，无关联变更不纳入三笔提交计划，在环节 2 清单单独列出并请用户逐项决定纳入或排除；校验不阻断，由用户裁决。

### Q8: 提案状态边界——①未点名且无活跃变更？②点名已归档提案？（L5 边界）
**A8**: 无活跃退化+归档拒绝——①未点名且 openspec/changes/ 无活跃变更 → 退化为源 SKILL 场景 2（询问是否提交全部，无溯源标注）；②点名的提案已归档（在 archive/ 不在 changes/）→ 报错提示已归档并列出活跃变更供选。

### Q9: 同一文件同时命中多条分类规则时的优先级？（L5 边界）
**A9**: 路径优先——src/test/** 下任何文件（含 *.md 测试说明）归测试代码，docs/** 下任何文件归文档；不在测试/文档目录的按扩展名判定（*.md→文档，源码/SQL/配置→功能代码）。

## 术语表

| 术语 | 定义 | 避免使用 |
|------|------|---------|
| 提案 | OpenSpec 变更的 proposal.md artifact（变更 = openspec/changes/&lt;name&gt;/ 下的规格驱动工作单元） | 提案文档、proposal（英混时与 artifact 概念混） |

## 架构决策

（探索中累积）

## 边界场景

- [x] 变更文件同时横跨功能代码/测试代码/文档多个类别时的归类处理 → Q9 已决：路径优先（src/test/** 归测试、docs/** 归文档，其余按扩展名）
- [x] 当前无活跃提案（openspec/changes/ 无进行中变更）时执行分类提交 → Q8 已决：退化为源 SKILL 场景 2 普通提交（无溯源标注）
- [x] 同一提案实施过程中分多次提交，每次提交的溯源标注 → D5 已决：每笔提交独立带尾行 `提案: <变更名>` 标注
- [x] 被排除文件（编译产物等）恰好是提案 tasks 中列出的产出文件 → 沿用源 SKILL 规则：排除规则优先级最高，即使提案引用也不提交，汇报中说明
- [x] 分类后某类为空（无文档变更）→ 该类跳过不生成提交笔，计划与汇报中说明
- [x] 点名提案不存在于 openspec/changes/ → 列出活跃变更供用户选择（对齐源 SKILL 环节 1 列表不存在时模式）
- [x] openspec/ 变更制品在 SVN 项目中未纳管（? 状态）→ 深度复查澄清：分类规则仅作用于已纳管版本化文件，未纳管制品遵循范围排除默认不提交、不自动 svn add，用户点名要求时以用户指令为准纳入并归文档类

## Decision Process

（探索中累积）

## Decisions

- **D1（核心行为，L1 已确认）**：新功能 = 根据提案的自动分类提交——变更归类为功能代码/测试代码/文档三类，分类分批提交，每笔提交信息自动标注来源提案；提案关联校验为提交前辅助检查项（非阻断门）。
- **D2（迁移策略，L2 已确认）**：新建独立技能 venus_tr_commit_push（type=tr_commit），完整迁移源 SKILL + 承载提案分类提交新功能；现有 venus_tr_commit_change 保持不动。命名遵循硬约束 venus_<type>_ 前缀 + tr- 前缀（能力记忆 D1 命名裁决）。
- **D3（流程形态，L2 已确认）**：提案点名为范围确定的新场景（场景 4）——点名提案 → 自动读提案 → 归类三类 → 三笔提交计划 → 四环节确认 → 依次执行；未点名自动检测活跃变更，多个列出供选。
- **D4（分类规则，L2 已确认）**：路径+扩展名规则为主（测试=src/test/**、test/**、*Test.java、*Tests.java、*.test.*；文档=*.md、docs/**、openspec/ 变更制品；功能代码=其余产出），提案 tasks.md 任务类型标签交叉校验。
- **D5（溯源标注，L2 已确认）**：尾行标注格式——主体单行源 SKILL 格式 + 换行 `提案: <变更名>`。
- **D6（中途失败，L3 已确认）**：失败即停+汇报——任一笔失败即停，不自动回滚，汇报已完成/未执行笔，用户决定后续。
- **D7（无关变更，L3 已确认）**：列出待裁决——与提案关联校验为辅助检查，无关联变更单独列出由用户逐项裁决纳入/排除，不阻断。
- **D8（提案状态边界，L5 已确认）**：未点名且无活跃变更 → 退化为源 SKILL 场景 2 普通提交（无溯源）；点名已归档提案 → 报错并列出活跃变更供选。
- **D9（分类规则优先级，L5 已确认）**：路径优先——测试/文档目录语义覆盖扩展名规则，其余位置按扩展名判定。
- **D10（纳管状态语义，深度复查澄清）**：分类规则的"openspec/ 制品归文档类"限定已版本化纳管文件；未纳管（?）的 docs/openspec/ 文件遵循源 SKILL 提交范围排除规则默认不提交（不自动 svn add），用户点名要求时以用户指令为准——消解分类规则与排除规则的冲突（排除规则优先级最高的既有语义不变）。
- **D11（allowedTools 白名单，深度复查澄清）**：源 SKILL 的 UTF-8 落盘与凭据解密为 PowerShell 命令，白名单必须含 Bash(powershell:*)（能力记忆 D9 教训：allowedTools 与正文命令同步，否则权限拦截）。

## L4 一致性交叉验证结论

- 命名派生验证 ✓：venus_tr_commit_push → deriveCommandId → tr-commit-push（与源 SKILL 名称一致）
- 类型复用验证 ✓：SKILL_TYPES 已有 tr_commit（config.ts:37），无需新增类型
- allowedTools 格式验证 ✓：MCP 工具（mcp__llm-wiki__*）不在白名单显式列出（先例：tr-impl-workflow 引用 codegraph MCP 但白名单仅列 Read/Write/Bash）；新技能白名单需 Bash(svn:*)、Read、Glob、Grep、Write
- 影响面确认：validate-update.test.ts 与 config-command.test.ts 硬编码技能总数 25（需同步 26）；skills-parity.test.ts 要求模板变更后运行 pnpm build && pnpm generate:skills 更新 skills/ 快照；skills/ 目录新增 venus_tr_commit_push/
- **无硬冲突**：方案与代码库约束全部兼容

## Scope Changes

| 变更时间 | 变更类型 | 变更描述 | 原因 |
|---------|---------|---------|------|
| （空） | | | |

## Pending

### For Phase 2 Impact Analysis
- getTrCommitChangeSkillTemplate (src/core/templates/workflows/tr-commit.ts:6) - Priority: HIGH（若走增强现有技能路线，注册表/测试/安装产物全部受影响）
- WORKFLOW_PAIRS (src/core/templates/registry.ts:102) - Priority: HIGH（新增技能或改动注册顺序影响安装与展示）

### Security Concerns
- 源 SKILL 的凭据处理模式（密码仅内存与 stdin、DPAPI 解密）迁移时必须保留完整防护，禁止降级为命令行传参
- 提案溯源标注读取 openspec/changes/ 时须防路径注入（变更名仅允许合法字符）

### Business Validation
- ~~"自动计较"是"自动校验"、"自动提交"还是"自动生成提交计划"~~ → Q1 已决：分类提交为主
- ~~分类提交的三类判定规则与用户期望是否一致~~ → Q4 已决：路径+扩展名规则

### Unresolved Decisions
- ~~迁移策略~~ → Q2 已决：新建独立技能 venus_tr_commit_push
- ~~VCS 场景~~ → Q2 已决：新技能面向 SVN（源 SKILL 完整迁移），现有 Git 技能不动
- 知识库推送（llm-wiki MCP）：完整迁移默认保留环节 3（MCP 不可用时如实说明跳过，源 SKILL 已有此处理），默认保留不另行确认
- ~~提案溯源标注格式~~ → Q5 已决：尾行标注

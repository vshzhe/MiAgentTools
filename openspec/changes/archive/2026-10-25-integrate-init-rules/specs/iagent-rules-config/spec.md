# iagent-rules-config 增量规格

## ADDED Requirements

### Requirement: 规则文件命名映射单一源

系统 SHALL 以**类型→语义名映射**作为 `.iagent/rules/` 下规则文件命名的唯一真源：`impl` → `coding-rules.md`、`test` → `testing-rules.md`、`spec` → `spec.md`（命名提案 D-Q3 / D-Q9 方案 a 转正）。映射 SHALL 位于项目配置模块常量区（与 `IAGENT_DIR_NAME` / `RULES_DIR_NAME` 同区），并以派生函数供全部读/列/写/修复路径取名；映射外的类型 SHALL 回退 `<type>.md`。管理型三类型（impl/test/spec）的读写路径 MUST NOT 存在第二处 `` `${type}.md` `` 直拼（`spec.md` 恰与回退名一致，属显式契约而非巧合）。

#### Scenario: 读取语义名文件

- **WHEN** `config.yaml` 的 rules 列表引用 `impl` 且 `.iagent/rules/coding-rules.md` 存在
- **THEN** 读取链 SHALL 从 `coding-rules.md` 展开规则行，`missingRuleFiles` MUST NOT 因旧名文件缺失或语义名生效而误报

#### Scenario: listRuleFiles 双形态识别

- **WHEN** `.iagent/rules/` 同时存在 `coding-rules.md`（语义名）与用户自建的 `commit.md`（合法类型 id 回退名）
- **THEN** 列出函数 SHALL 同时识别两者并返回各自的项目相对路径，MUST NOT 因语义名不匹配 `<type>.md` 形态而漏列

#### Scenario: 映射外类型回退

- **WHEN** 规则文件属于映射外的合法类型（如 `commit`）
- **THEN** 命名 SHALL 回退 `commit.md`，行为与现状一致，MUST NOT 引入额外语义名

### Requirement: init 生成蒸馏规则

`iagent init` SHALL 以模板常量（`defaultRuleFileContent` 重写）为默认内容源生成管理型三类型的语义名规则文件。`coding-rules.md` 默认行 SHALL 蒸馏源仓 `openspec/rules/ai-coding.md` 的护栏要点（零猜测 / 设计先行+确认门 / 数据分层 / 架构分层 / 前端 UI 四状态 / 生成交付），`spec.md` 默认行 SHALL 蒸馏 `artifact-generation.md` 的协议要点（Markdown 真源 / 依赖序 / 写后校验循环 / JSON 弃用）；每份默认内容 SHALL 含人工域标记骨架。**旧名清理无条件执行**：无论 config.yaml 是否存在，init 均 SHALL 先检测并整体删除 `.iagent/rules/impl.md` / `test.md`（复用旧名检测删除单步，见「旧名规则文件检测删除与丢失风险告警」），再生成/修复语义名文件。**created 分支对已存在的语义名文件 SHALL NOT 覆盖、SHALL NOT 修复内容**（不进入常量对齐），并记 WARN「已存在，未做常量对齐；内容可能过期，可运行 `iagent update` 修复」并登记于修复明细的 warnings。验收基准：新装机 init 后 `.iagent/rules/coding-rules.md` 含 ai-coding 护栏要点，目标项目**无需** openspec 目录即得基线（D-Q1）。

#### Scenario: 新装机生成三份语义名文件

- **WHEN** 项目无 `.iagent/`（或无 config.yaml）并执行 `iagent init`
- **THEN** init SHALL 创建 `.iagent/rules/coding-rules.md`、`testing-rules.md`、`spec.md`，内容含各自蒸馏要点与人工域标记骨架，并把本次新建文件列入 init 报告

#### Scenario: 无 config.yaml 时仍清理旧名规则文件

- **WHEN** 项目无 `.iagent/config.yaml` 但 `.iagent/rules/impl.md` 存在（用户手工建的最小目录）并执行 `iagent init`
- **THEN** init SHALL 先整体删除 `impl.md` 并记丢失风险 WARN，再生成 `coding-rules.md` 等语义名文件，MUST NOT 因 created 分支而跳过旧名清理

#### Scenario: created 分支不覆盖既有语义名文件

- **WHEN** 项目无 `.iagent/config.yaml` 且 `.iagent/rules/coding-rules.md` 已存在（内容为旧版或用户手写）
- **THEN** init SHALL 保留该文件字节不变、不做常量对齐，记 WARN「已存在，未做常量对齐；内容可能过期，可运行 `iagent update` 修复」并登记在修复明细 warnings 中

#### Scenario: 重复 init 转入重建/修复

- **WHEN** 项目 `.iagent/config.yaml` 已存在并再次执行 `iagent init`
- **THEN** init MUST NOT 整体跳过规则维护——SHALL 转入规则重建/修复语义（缺失重建、对齐、旧名清理），config.yaml 本身仍保持「已存在不覆盖、保留用户修改」

### Requirement: update 规则重建/修复

`iagent update` SHALL 在 legacy 迁移（必须最先执行）之后、读取 config 之前插入确定性规则重建/修复步骤（D-Q5），规则如下：

- **缺失重建**：管理型语义名文件缺失时按模板常量重生成；
- **对齐（确定性算法）**：文件存在时按以下固定算法重写——(1) 常量块 = 头注释 + 蒸馏常量行 + 空行，**不含人工域标记对**；(2) 解析出文件内全部人工域区间（含破损取保留侧的区间）；(3) 输出 = 常量块 + 按原文件出现顺序逐个拼接的**原区间原文**（各自标记行与区间内每一行逐字保留，多区间不合并、不重排）；(4) 无任何人工域区间时输出**仅常量块**（整块替换）并记 WARN（提示手写内容应置于人工域标记区间内），MUST NOT 静默覆盖；(5) 文末统一单个换行；(6) 同一输入连续两次执行 SHALL 字节一致（第二次解析出的区间集合与第一次输出一致）；
- **破损取保留侧**：人工域标记未闭合时保留开始标记至文末并记 WARN；嵌套或乱序时保留最外层最大连续区间并记 WARN（与 docs/project 增量对齐机制的破损语义同构）；
- **守序**：legacy 迁移与 misplaced 清理、技能 id 迁移 MUST 保持先序——legacy 迁移把 `.venus/rules/tr_impl.md` 按新名直达 `.iagent/rules/coding-rules.md`；修复步骤在其后运行，保证搬运不被「目标已存在」阻塞，且 7.x 遗留的 `impl.md` / `test.md` 在旧名检测窗口内；
- **不越界**：项目无 `.iagent/`（未 init）时本步骤 SHALL 为空操作，MUST NOT 凭空创建配置目录；
- **本轮迁移产出跳过对齐**：legacy 迁移报告 `movedRules` 列出的规则文件 SHALL 作为本轮 `preservePaths` 传入并跳过常量对齐（只登记、不重写），保证用户既有规则内容在同轮迁移后逐字保留；下一轮 init/update 起恢复正常对齐；
- **非阻断**：修复过程中的文件读写失败（权限 / 只读 / IO 异常）SHALL 记 WARN 并继续，MUST NOT 抛出或中断 init/update。

#### Scenario: 缺失文件重建

- **WHEN** `.iagent/rules/testing-rules.md` 缺失且执行 `iagent update`
- **THEN** update SHALL 以模板常量重建该文件并在报告中列出

#### Scenario: 人工域外对齐

- **WHEN** `.iagent/rules/spec.md` 存在但区间外内容为旧版占位常量
- **THEN** update SHALL 输出「常量块 + 原人工域区间原文（含其标记行）」：区间外内容被常量块替换，区间内逐字保留，并在报告列出该文件

#### Scenario: 无人工域标记的规则文件对齐并告警

- **WHEN** `.iagent/rules/coding-rules.md` 存在、不含任何人工域标记且内容与常量不一致
- **THEN** 系统 SHALL 将文件输出为**仅常量块**（头注释 + 常量规则行 + 空行，不含标记骨架）并记 WARN，提示手写规则应置于人工域标记区间内，MUST NOT 静默覆盖

#### Scenario: 多个人工域区间保持原顺序

- **WHEN** 规则文件含两段及以上人工域区间（含嵌套/乱序破损形态按「最外层最大连续区间」归并后的结果）
- **THEN** 对齐输出 SHALL 按原文件出现顺序逐个保留各区间原文，MUST NOT 合并、重排或去重；再次执行对齐 SHALL 字节一致

#### Scenario: 本轮迁移产出跳过对齐

- **WHEN** 同一轮 init/update 中 legacy 迁移刚把 `.venus/rules/tr_impl.md` 写入 `.iagent/rules/coding-rules.md`
- **THEN** 修复步骤 SHALL 跳过对该文件的常量对齐并登记为保留项，迁移后同轮 `readProjectConfig` 读到的规则内容与旧文件逐字一致

#### Scenario: 人工域破损取保留侧

- **WHEN** 规则文件含 `<!-- 人工域:开始 -->` 但缺结束标记
- **THEN** 系统 SHALL 保留开始标记至文末全部内容并记 WARN，MUST NOT 猜测闭合位置或删除该区间内容

#### Scenario: 未安装项目空操作

- **WHEN** 项目无 `.iagent/` 目录时执行 `iagent update`
- **THEN** 规则重建/修复 SHALL 记录空明细并跳过，MUST NOT 创建 `.iagent/` 或其下任何文件

#### Scenario: 修复写入失败不中断

- **WHEN** 规则目录只读导致对齐写入失败
- **THEN** 记 WARN、报告如实列出失败项、init/update 继续完成其余步骤

### Requirement: 旧名规则文件检测删除与丢失风险告警

`init` 与 `update` SHALL 检测 `.iagent/rules/impl.md` 与 `.iagent/rules/test.md`（旧名，D-Q3 不做兼容映射 / D-Q6），检出即**整体删除**、不做内容合并读取，并在报告中以 **WARN** 明示「旧名文件可能承载用户手写内容，删除存在丢失风险」（对齐 docs/upgrade-guide.md 丢失风险告警模式；docs 同步增订该告警）。

#### Scenario: 检测删除并告警

- **WHEN** `.iagent/rules/` 下存在手工或历史迁移产生的 `impl.md` / `test.md`
- **THEN** init/update SHALL 整体删除两文件、生成对应语义名新文件，并在报告中逐文件输出删除记录与丢失风险 WARN

#### Scenario: 无旧名时幂等

- **WHEN** 项目已全部使用语义名文件并重复执行 init/update
- **THEN** 旧名清理 SHALL 为空操作、报告无删除行，MUST NOT 产生重复告警或误删语义名文件

### Requirement: 人工域标记的读取契约

`.iagent/rules/` 规则文件的规则行提取 SHALL 过滤人工域标记行本身（`<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->`），并 SHALL 保留标记区间内的规则行参与注入——用户在人工域内书写的项目规则与常量域规则同等生效。标记行与 `#` 注释行 MUST NOT 被当作规则条目。

#### Scenario: 人工域规则行注入

- **WHEN** `coding-rules.md` 的人工域标记区间内含用户手写规则行
- **THEN** 读取链 SHALL 将该行与其余规则行一并展开注入，标记行本身 MUST NOT 出现在规则条目中

#### Scenario: 注释行不注入

- **WHEN** 规则文件人工域区间内的指引行为 `#` 注释（如人工域使用说明）
- **THEN** 该行 SHALL 被过滤，MUST NOT 作为规则条目注入生成产物

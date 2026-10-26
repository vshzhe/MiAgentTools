# tr-migration-skills Specification (Delta)

> 迁移三件套技能规格。源：OpenSpec v1.9.5 三功能（蒸馏清单见变更 exploration.md；正文行为逐项保留，仅语言无关化 + venus 生态适配）。

## ADDED Requirements

### Requirement: feature-doc 技能模板
系统 SHALL 提供 `venus_tr_docs_feature_doc` 技能模板（指令 `tr-docs-feature-doc`，type `tr_docs`），扫描源项目功能模块并生成功能需求实现文档。技能正文 SHALL 定义：4 种输出模式（新人上手 / 迁移重构 / 设计文档 / 全景扫描）、框架档案机制（内置 Venus4A / Spring MVC / Struts 可选 + 未知框架结构自动探测须确认为 `[待确认]`）、4 类功能入口识别（文件路径 / URL 路由 / 模块名称 / 全项目）、深度扫描 4 层（后端 / 前端 / 配置 / 数据库）、4 类流程图强制输出、6 条反幻觉规则、细节原则 A-G、输出路由（change 上下文 → `attachments/source-feature-doc/`；standalone → 用户目录或 `openspec/migration/`）、CodeGraph 优先与无索引自动降级、双执行模式（standalone 交互收参 / 非交互注入且已提供参数跳过、无效注入 fail fast）。

#### Scenario: 扫描生成需求文档
- **WHEN** 用户带源项目路径与功能入口触发 `tr-docs-feature-doc`
- **THEN** 技能按入口类型深度扫描源项目并生成含 11 章结构与附录的需求文档，结论逐条可追溯（文件:行号），输出到按上下文路由的目录

#### Scenario: 未知框架自动探测
- **WHEN** 未提供框架档案且用户未选择内置 profile
- **THEN** 从项目结构文件（`pom.xml` / `web.xml` / `package.json` 等）探测框架类型，探测结论以 `[待确认：框架档案探测]` 呈现给用户确认后才继续扫描

#### Scenario: CodeGraph 不可用降级
- **WHEN** 源项目无 CodeGraph 索引
- **THEN** 自动降级为 Glob/Grep/Read 手动扫描，在文档头部记录降级说明，不阻塞、不询问用户

#### Scenario: 非交互模式注入
- **WHEN** auto-migration 工作流以非交互模式调用（注入源项目 / 功能入口 / 输出模式 / 框架档案 / 输出目录）
- **THEN** 直接使用注入参数执行不提问，缺失的非阻塞参数记录为 gap 写入最终摘要；无效注入立即报错

### Requirement: migration-check 技能模板
系统 SHALL 提供 `venus_tr_impl_migration_check` 技能模板（指令 `tr-impl-migration-check`，type `tr_impl`），对迁移后的源/目标项目做一致性检查。技能正文 SHALL 定义：六层对比（Controller / Service / DAO / 前端三文档 / SQL / 数据库）、C1-C6 对抗检查（C1 空实现/硬编码 P2、C2 分支逻辑完整性 P0、C3 事务边界一致性 P0、C4 异常处理完整性 P1、C5 精度/类型一致性 P1、C6 SQL 条件完整性 P0）、框架档案驱动方法对比（WHEN 提供标准方法清单 THEN 逐项对比 / WHEN 未提供 THEN 从源码提取签名对比；禁内置任何框架方法映射预设）、P0/P1/P2 三级分级（每问题含位置/类型/等级/说明/验证方法五字段；空级别文档必须写「未发现该级别问题」不可省略）、写回验证（每文档写完 Read 回读验证非模板含实数据，未过必须重写）、报告树 14 份文档（00 摘要 + 01 后端×3 + 02 前端×3 + 03 SQL + 04 数据库 + 05 问题清单×3 + 06 修复建议 + 07 对抗检查×6）、同路径合法性（源=目标为合法输入按版本/目录差异对比）、匹配方法论（按功能而非文件名、跨层逻辑追踪、禁仅按行数判断）、双执行模式（同 feature-doc）。

#### Scenario: 六层对比执行
- **WHEN** 用户带源/目标项目路径触发 `tr-impl-migration-check`
- **THEN** 技能逐层读取两侧实际代码做深度对比（功能而非行数），每层文档含文件清单对比表、逐单元方法/字段对比表、差异分析、问题清单，全部落到 `openspec/changes/<change-name>/attachments/migration-check/`（change 上下文）或 `openspec/migration/`（standalone）

#### Scenario: 对抗检查
- **WHEN** 每层对比完成
- **THEN** 对已读代码执行适用的 C1-C6 对抗检查，报告写入 `07_对抗检查/`，发现的问题按各自级别并入问题清单

#### Scenario: 写回验证
- **WHEN** 任一对比文档写完
- **THEN** Read 回读验证文件非空、含真实数据行（具体文件名/方法名/字段名而非占位符）、非模板骨架；验证未过必须重写后才能标记该层完成

#### Scenario: 同路径合法输入
- **WHEN** 源项目路径与目标项目路径相同（同框架升级/版本迭代场景）
- **THEN** 接受输入并按版本或目录差异对比，不因路径相等而拒绝

### Requirement: auto-migration 编排技能模板
系统 SHALL 提供 `venus_tr_impl_auto_migration` 技能模板（指令 `tr-impl-auto-migration`，type `tr_impl`），四阶段一站式迁移编排。技能正文 SHALL 定义：Step 0 六项输入收集（源项目、功能入口、目标项目默认当前、双端框架档案、迁移范围说明；路径无效显式报错重新收集禁止猜测纠正）；Phase 1 源需求文档生成（先按项目命名约定定变更名、建 `attachments/source-feature-doc/`、非交互调用 `venus_tr_docs_feature_doc` 技能）+ 蒸馏确认门（清单可裁剪、差异用户裁决、空清单 BLOCKS、确认后写入 `exploration.md` 的 `## 蒸馏核心功能清单`；裁剪项排除出 Phase 4 检查范围）；Phase 2 目标探索（CodeGraph 优先 + Glob/Grep 自动降级）+ 目标规范加载（CLAUDE.md / AGENTS.md / openspec specs 蒸馏为 `## 目标项目规范要点`，BINDING 约束）+ 制品生成（`venus spec status` / `venus spec instructions` 循环，proposal → specs → design → tasks 依赖序）+ CLI 降级（command-not-found 签名判定一次声明，改纯 AI 生成中途不重试）+ 无中途确认直通；Phase 3 实现确认门（统一实现计划 + 一问「是否需要调整」；不调整按 apply 协议并发批次执行、checkbox 集中管理、每个子代理调度指令注入规范要点；需要调整呈现制品编辑后重回此门；失败任务串行重试一次）；Phase 4 评审子代理（注入全部输入；子代理内非交互调用 `venus_tr_impl_migration_check` 技能 + 核心功能覆盖矩阵 + B组检查 C11 异常体系融入 P0 / C12 工具类复用 P1 / C13 架构一致性 P2，语言无关表述）+ P0/P1 修复循环（用户确认修复 → 同步变更 tasks → 重查；终止条件：无 P0/P1、用户停止、重试上限——后两者快照+WARN 完成）+ 子代理失败降级链（串行重试一次 → 主流程直调 → WARN 完成，绝不静默跳过）；产物路由规则（SQL → `attachments/sql/`、配置示例 → `attachments/config/`、对抗检查报告 → `attachments/migration-check/07_对抗检查/`、其余 → `attachments/`）。

#### Scenario: 蒸馏确认门阻断空清单
- **WHEN** Phase 1 从需求文档蒸馏出的核心功能清单为空
- **THEN** 阻断流程，要求重新扫描源项目或收窄功能入口，绝不带空清单继续

#### Scenario: 目标规范作为绑定约束
- **WHEN** Phase 2 完成目标项目规范加载
- **THEN** 规范要点写入 `exploration.md` 的 `## 目标项目规范要点`，作为 design/tasks 推导与 Phase 3 子代理调度指令的 BINDING 约束，使迁移代码遵循目标项目规范

#### Scenario: CLI 降级生成
- **WHEN** 首次 `venus spec status` 调用失败且错误签名匹配 command-not-found（"command not found" / "不是内部或外部命令" / "not recognized"）
- **THEN** 声明 CLI 不可用结论一次，改按内置依赖顺序（proposal → specs → design → tasks）纯 AI 生成全部制品，流程中不再重试 CLI 调用

#### Scenario: 评审子代理修复循环
- **WHEN** Phase 4 检查报告存在 P0/P1 问题
- **THEN** 呈现问题清单与修复建议，用户确认后修复（同步变更 tasks.md）并重新执行迁移检查；循环直到无 P0/P1、用户停止或达到重试上限（后两者输出快照+WARN 以完成告警结束，不静默）

#### Scenario: 子代理失败降级链
- **WHEN** 评审子代理执行失败
- **THEN** 串行重试一次，仍失败降级为主流程直调 `venus_tr_impl_migration_check`（同参数非交互），再失败输出 WARN 以完成告警结束——绝不静默跳过检查

### Requirement: tr_docs 类型与模板注册
系统 SHALL 在 `SKILL_TYPES` 注册表新增第 9 个技能类型 `tr_docs`（文档类），并在模板注册表注册三对「技能模板 + 指令模板」：`venus_tr_docs_feature_doc`（type `tr_docs`）→ `tr-docs-feature-doc`、`venus_tr_impl_migration_check`（type `tr_impl`）→ `tr-impl-migration-check`、`venus_tr_impl_auto_migration`（type `tr_impl`）→ `tr-impl-auto-migration`。三技能模板 MUST 含必填 `allowedTools` 白名单且与正文实际运行的命令同步，MUST 含 `license`（MIT）与 `compatibility` 元数据；技能正文中文、标识符英文。

#### Scenario: 类型体系扩展
- **WHEN** `SKILL_TYPES` 注册表查询类型总数或 `venus list` 按类型统计
- **THEN** 展示 9 个类型（含 `tr_docs` 文档类），`tr_docs` 下含 1 个技能、`tr_impl` 下含 3 个技能（tr-impl-feature + 新增 2 个）

#### Scenario: 注册后进入生成链
- **WHEN** 生效 workflow 集含三指令 id 之一且运行 `venus generate` / `venus init`
- **THEN** 对应技能 SKILL.md 与斜杠指令从模板生成，frontmatter `metadata.type` 与 `allowedTools` 与模板一致，`generatedBy` 字段写入生成时版本

#### Scenario: 快照奇偶校验
- **WHEN** 模板修改后运行 `pnpm build && pnpm generate:skills` 与测试
- **THEN** `skills/` 快照与模板输出一致，`skills-parity` / `allowed-tools` / `templates` 测试通过

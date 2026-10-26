# 变更探索记录：add-tr-migration-suite

> 源项目：`E:\github\OpenSpec`；源需求文档：`attachments/source-feature-doc/迁移技能套件_关联分析.md`（迁移重构模式，2026-09-11 生成）
> 目标项目：`e:\github\VenusAgentTools`（当前项目）

## 蒸馏核心功能清单

**（用户已确认：全部 4 项保留，无裁剪。本清单是 Phase 2 提案推导输入与 Phase 4 检查范围基线。）**

### 1. feature-doc 功能文档生成技能（→ `tr-docs-feature-doc`）

- 扫描源项目功能模块，生成功能需求实现文档；4 种输出模式（新人上手 / 迁移重构 / 设计文档 / 全景扫描）
- 框架档案机制：内置 Venus4A / Spring MVC / Struts 3 个可选档案 + 未知框架结构自动探测（探测结论须用户确认）
- 4 类功能入口识别（文件路径 / URL 路由 / 模块名称 / 全项目）
- 深度扫描 4 层（后端 Controller/Service/DAO/Entity、前端页面字段级、配置、数据库）
- 4 类流程图强制输出（前后端时序 / 接口交互 / 功能间交互 / 后端决策）
- 6 条反幻觉规则（结论必须有代码证据、未确认标 [待确认]、关键代码完整读取、流程图基于实际路径、问题分析具体、禁止概括词汇）
- 细节原则 A-G（每页面独立文档化、字段级契约、方法全覆盖、迁移可执行性、框架页面分组、public+private 全覆盖、工具类引用全覆盖）
- 输出路由：change 上下文 → `attachments/source-feature-doc/`；standalone → 用户指定或 `openspec/migration/`
- CodeGraph 优先 + 无索引自动降级 Glob/Grep/Read（记录降级，不阻塞）
- 双执行模式：standalone 交互收参 / auto-migration 非交互注入（已提供参数跳过，缺失非阻塞记 gap，无效注入 fail fast）

### 2. migration-check 迁移检查技能（→ `tr-impl-migration-check`）

- 六层对比：Controller / Service / DAO / 前端（页面文件、表单字段、JS 函数 3 文档）/ SQL / 数据库
- C1-C6 对抗检查：C1 空实现/硬编码（P2）、C2 分支逻辑完整性（P0）、C3 事务边界一致性（P0）、C4 异常处理完整性（P1）、C5 精度/类型一致性（P1）、C6 SQL 条件完整性（P0）
- 框架档案驱动方法对比：WHEN 提供标准方法清单 THEN 逐项对比 / WHEN 未提供 THEN 从源码提取签名对比；禁止内置任何框架的方法映射预设
- P0/P1/P2 三级分级；每问题必含 位置/类型/等级/说明/验证方法 五字段；空级别文档必须写「未发现该级别问题」不可省略
- 写回验证：每文档写完 Read 回读验证非模板含实数据
- 报告树：00_检查摘要 + 01_后端对比×3 + 02_前端对比×3 + 03_SQL对比 + 04_数据库对比 + 05_问题清单×3 + 06_修复建议 + 07_对抗检查×6
- 同路径合法性：源=目标路径合法（同框架升级场景），按版本/目录差异对比
- 匹配方法论：按功能而非文件名匹配（重命名迁移报告为已迁移+标注）、跨层移动逻辑追踪到目标层、禁止仅按行数/文件大小判断
- 双执行模式（同上）

### 3. auto-migration 一站式迁移编排技能（→ `tr-impl-auto-migration`）

- Step 0：6 项输入收集（源项目、功能入口、目标项目、双端框架档案、迁移范围说明）
- Phase 1：源需求文档生成（先定变更名、建 `attachments/source-feature-doc/`、非交互调 feature-doc 技能）+ **蒸馏确认门**（清单可裁剪、差异用户裁决、空清单 BLOCKS、确认后写入 exploration.md `## 蒸馏核心功能清单`；裁剪项排除出 Phase 4 检查范围）
- Phase 2：目标项目探索（CodeGraph→Glob/Grep 自动降级）+ 目标规范加载（CLAUDE.md/AGENTS.md/openspec specs → `## 目标项目规范要点`，BINDING 约束）+ 标准制品生成循环（proposal → specs → design → tasks）+ CLI 降级（command-not-found 签名判定，一次声明，中途不重试）+ 无中途确认直通
- Phase 3：**实现确认门**（统一实现计划 + 一问「是否需要调整」；不调整 → apply 协议并发批次执行、checkbox 集中管理、每个子代理调度指令注入规范要点；需要调整 → 呈现制品编辑后重回此门；失败任务串行重试一次）
- Phase 4：独立评审子代理（注入全部输入：蒸馏清单/源需求文档/实现范围/双项目/双档案/输出目录；子代理内非交互调 migration-checker + 核心功能覆盖矩阵 + B组检查 C11 异常体系融入 P0 / C12 工具类复用 P1 / C13 架构一致性 P2）+ P0/P1 修复循环（用户确认修复→同步 tasks→重查；终止条件：无 P0/P1、用户停止、重试上限→快照+WARN 完成）+ 子代理失败降级链（串行重试一次→主流程直调→WARN 完成）
- 产物路由规则：SQL → `attachments/sql/`、配置示例 → `attachments/config/`、对抗检查报告 → `attachments/migration-check/07_对抗检查/`、其余 → `attachments/`
- 输出格式块：变更名/源需求文档路径/检查报告路径/任务完成度/P0P1P2 统计

### 4. 注册与安装集成（配套能力）

- registry.ts 注册三对「技能模板 + 指令模板」
- SkillType 归类（见下方命名决策）+ `allowedTools` 字段与正文命令同步
- profiles.ts 依赖注入：auto-migration 依赖 feature-doc 与 migration-check（选 auto-migration 漏选另两个时自动补全）
- `pnpm build && pnpm generate:skills` 快照再生成；skills-parity 奇偶校验、allowed-tools、templates 等测试同步

---

## 命名与类型决策（用户已裁决）

| 功能 | 技能名 | 指令 id | SkillType | 模板文件 |
|------|--------|---------|-----------|---------|
| feature-doc | `venus_tr_docs_feature_doc` | `tr-docs-feature-doc` | `tr_docs`（**新增**，第 9 类） | `src/core/templates/workflows/tr-docs-feature-doc.ts` |
| migration-check | `venus_tr_impl_migration_check` | `tr-impl-migration-check` | `tr_impl`（现有「实现」类） | `src/core/templates/workflows/tr-impl-migration-check.ts` |
| auto-migration | `venus_tr_impl_auto_migration` | `tr-impl-auto-migration` | `tr_impl`（现有「实现」类） | `src/core/templates/workflows/tr-impl-auto-migration.ts` |

- 命名以用户显式输入为准（tr-docs-feature-doc / tr-impl-migration-check / tr-impl-auto-migration）；SKILL_TYPES 由 8 类扩展为 9 类（新增 `tr_docs` 文档类）
- 语义适配（用户已裁决）：语言无关化——C11/C12 检查示例改为语言无关表述（空 catch/异常吞没、重复工具函数等）；内置 3 个 Java 框架档案（Venus4A/Spring MVC/Struts）保留（目标 CLI 用户仍可能扫描 Java 源项目）

---

## 目标项目规范要点

**（Phase 2 加载；本节为 design/tasks 推导与 Phase 3 子代理调度的 BINDING 约束）**

### 来源 1：AGENTS.md（仓库修改守则）

1. 改技能模板（`src/core/templates/workflows/`）后必须依次 `pnpm build && pnpm generate:skills`，否则 `test/skills-parity.test.ts` 失败
2. 改模板正文的命令时同步 `allowedTools` 字段，否则技能被权限拦截（`test/allowed-tools.test.ts` 部分拦截）
3. 新增技能类型：`src/core/config.ts` 的 `SKILL_TYPES` 加条目（本次新增 `tr_docs`）
4. YAML 转义：含冒号/引号的 frontmatter 值必须走 `escapeYamlValue`
5. Windows 兼容：路径断言用 `replaceAll('\\', '/')` 归一化；`path.join` 不硬编码分隔符
6. 技能名强制 `venus_` 前缀；frontmatter `metadata.type` 必须是 `SKILL_TYPES` 之一
7. SKILL 正文中文；代码注释中文；标识符英文
8. `update` 手改保护依赖 frontmatter `generatedBy` —— 生成路径必须写全该字段
9. 指令 id 派生：`venus_tr_impl_migration_check` → `tr-impl-migration-check`（下划线转连字符，去前缀）
10. `.venus/`（本项目配置）与 `.claude/`（dogfood 产物）都提交到 git
11. 提交信息：Conventional Commits 一行式，中文描述

### 来源 2：openspec/specs/skill-profile/spec.md（主规范）

- `DEFAULT_WORKFLOWS` 默认集 7 项（tr-init-project + spec 全 6）；未配置 `workflows` 字段时生效
- 用户配置 `workflows` 完全覆盖默认集（非合并）
- 依赖注入 `DEPS`：`spec-propose ⇒ spec-verify-proposal`、`spec-archive ⇒ spec-verify`；补入项输出提示
- `venus init`/`venus update` 仅生成生效集内的技能与指令
- reconcile 检测：`.claude/` 下已安装但不在生效集的 venus 产物保留不删，仅提示

### 来源 3：openspec/rules/ai-coding.md（编码守卫）

零猜测（[待确认] 标记）、先蓝图后编码（实现前确认门）、最小改动、分层隔离、交付自检。

### 来源 4：用户全局 CLAUDE.md（TS 代码风格）

4 空格缩进禁 Tab；行宽 ≤120；方法间空 1 行；字符串双引号；语句结尾分号；if/for/while/try 无论单行必须 `{}` 且右括号单独成行；变量小驼峰见名知意；常量全大写下划线；导入按系统包→第三方→自定义分组排序、禁通配符导入。

### 来源 5：ADR-0001 + spec 命令组

- `venus spec` 自研命令组不依赖 openspec CLI：`venus spec new "<name>"`、`venus spec status --change <name> [--json]`、`venus spec instructions <artifact-id> --change <name> [--json]`、`venus spec archive <name>`
- spec-driven schema 依赖图：proposal（无依赖）→ specs / design（依赖 proposal）→ tasks（依赖 specs + design）；apply 门槛 requires=[tasks]
- spec-apply 协议：Step 5.5 统一批次计划 + 用户确认门（auto-mode 跳过）；并发上限读 `openspec/config.yaml` 的 `apply.concurrency`（**目标 spec-apply.ts L131-135 同样引用此配置——auto-migration 正文该引用可原样保留**）；`.openspec-tmp/apply-<change-name>/` 临时工作区；单任务批不派子代理直接实现；每批后增量编译检查

---

## 目标项目探索发现

### 接口兼容性（源 → 目标模板适配）

| 源 SkillTemplate 字段 | 目标字段 | 结论 |
|----------------------|---------|------|
| name / description / instructions | 同名 | 直接迁移（name 改 venus_tr_*） |
| license / compatibility / metadata | 同名可选 | 直接迁移（生成器注入 generatedBy） |
| （无） | **allowedTools（必填）** | 新增：按技能正文实际用到的工具写白名单（参考 spec-propose：`Read, Write, Edit, Glob, Grep, Bash(venus:*)`；spec-apply 加 `Bash(pnpm:*), Bash(npm:*), Bash(node:*)`） |
| （无） | **type（必填）** | 新增：`tr_docs`（feature-doc）/ `tr_impl`（migration-check、auto-migration） |

### 注册点清单（实现涉及的文件）

| 文件 | 动作 |
|------|------|
| `src/core/templates/workflows/tr-docs-feature-doc.ts` | 新建（技能+指令模板对） |
| `src/core/templates/workflows/tr-impl-migration-check.ts` | 新建 |
| `src/core/templates/workflows/tr-impl-auto-migration.ts` | 新建 |
| `src/core/templates/registry.ts` | WORKFLOW_PAIRS 注册 3 对 + import |
| `src/core/config.ts` | SKILL_TYPES 新增 `tr_docs`（第 9 类） |
| `src/core/profiles.ts` | DEPS 新增 `tr-impl-auto-migration ⇒ [tr-docs-feature-doc, tr-impl-migration-check]`；DEFAULT_WORKFLOWS 是否纳入默认集：**不纳入**（与源项目 CORE_WORKFLOWS 不含三者的定位一致，属可选扩展件） |
| `skills/` 快照 + `.claude/` dogfood | `pnpm build && pnpm generate:skills` 再生成 |
| `CHANGELOG.md` | Unreleased 段补记 |

### 正文生态引用替换表（迁移时逐项处理）

| 源引用 | 目标引用 |
|--------|---------|
| `openspec-feature-doc-generator` 技能名 | `venus_tr_docs_feature_doc` |
| `openspec-migration-checker` 技能名 | `venus_tr_impl_migration_check` |
| `/opsx:feature-doc`、`/opsx:migration-check`、`/opsx:requirement-doc` | `/venus:tr-docs-feature-doc`、`/venus:tr-impl-migration-check`、`/venus:spec-propose`（requirement-doc 无目标等价物 [待确认：目标项目无 openspec-create-requirement-doc 对应技能，该 NOT-for 引用删除]） |
| `openspec status`/`openspec instructions` CLI 循环 | `venus spec status` / `venus spec instructions`（ADR-0001 自研命令组） |
| `openspec/config.yaml` `apply.concurrency` | 保留（目标 spec-apply 同样引用） |
| `openspec/rules/ai-coding.md` | 保留（目标项目存在同路径文件） |
| `openspec/changes/`、`openspec/migration/` 输出路由 | 保留（目标项目 openspec/ 目录结构一致；openspec/migration/ standalone 时自动创建） |
| 命令模板 name `OPSX: X` | 目标命令命名风格（如 `venus:tr-docs-feature-doc`，与现有命令一致） |
| `/opsx:workflow`（auto-migration 镜像引用） | 改为 spec 工作流链引用（`/venus:spec-explore` → `/venus:spec-propose` → `/venus:spec-apply`） |
| 1.2.1.5 Multi-Project CodeGraph Agent Scan 机制名 | 目标无此编号机制，改为「CodeGraph 优先 + Glob/Grep 自动降级」表述（与 spec-explore L47-52 的 codegraph_status 优先检查规则对齐） |

### CLI 降级签名

源 auto-migration 的 CLI 降级判定（"command not found" / "不是内部或外部命令" / "not recognized"）保留，仅将探测命令改为 `venus spec status`/`venus spec list`（venus CLI 缺失时按内置依赖顺序纯 AI 生成）。

### 测试影响面

| 测试文件 | 影响 |
|---------|------|
| `test/skills-parity.test.ts` | 快照对比——必须 `pnpm generate:skills` 后再跑 |
| `test/templates.test.ts` | 注册表断言（新增 3 对注册 + 第 9 类型；若有硬编码数量断言需同步） |
| `test/allowed-tools.test.ts` | 新技能的 allowedTools 校验 |
| `test/profiles.test.ts` | DEPS 新增注入规则用例 |
| `test/completion-config.test.ts` | 不受影响（管 venus CLI 子命令，本次不新增 CLI 命令） |

### 其他设计决策（迁移落地）

- **type 归属**：feature-doc 归新类型 `tr_docs`；migration-check 与 auto-migration 归现有 `tr_impl`
- **DEFAULT_WORKFLOWS 不变**：三技能为可选扩展件，用户经 `.venus/config.yaml` 的 `workflows` 字段勾选安装（与源项目 custom profile 定位一致）；CHANGELOG 的 BREAKING 恢复命令文档无需更新
- **DEPS 注入**：`tr-impl-auto-migration ⇒ [tr-docs-feature-doc, tr-impl-migration-check]`（auto-migration Phase 1/4 依赖两子技能）
- **`.venus/` 当前配置**：本项目 dogfood 的 workflows 配置若要试用新技能需自行勾选（不影响本变更交付物）

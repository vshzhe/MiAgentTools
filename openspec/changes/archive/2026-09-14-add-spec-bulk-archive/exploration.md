# 探索记录 — add-spec-bulk-archive

> 从 E:\github\OpenSpec 迁移 bulk-archive 批量归档功能到 VenusAgentTools（完整链路迁移，目标命名 venus:spec-bulk-archive）。

## 蒸馏核心功能清单

> 2026-09-14 用户蒸馏确认：**全部 19 项保留，无裁剪**。本清单是 Phase 2 提案推导输入与 Phase 4 迁移检查的评审范围基线（用户裁剪项才会被排除，本次无）。

**A. 模板定义与产物**（3 项）
1. Skill 模板工厂 → `venus_spec_bulk_archive` SKILL.md（指令头含 Guardrail 引用）
2. Command 模板工厂 → `venus:spec-bulk-archive` 命令文件
3. skill instructions 与 command content 双份一致文本（385 行 11 步指令）

**B. 批量归档工作流业务规则**（12 项）
4. 变更发现：`venus list --json` + CLI 降级检测（命令未找到签名 → Glob 扫描降级 + 文件存在推断制品，结束一次性提醒）
5. 用户多选（AskUserQuestion multi-select，禁止自动选择，含"全部"选项）
6. CodeGraph 预检（status-first 单步检测，禁 Glob 预检点前缀目录；失败 → 跳过全部 CG 步骤不询问）
7. 批量状态收集（artifact 状态 6 字段 + 任务 `- [ ]`/`- [x]` 计数 + delta specs 需求名；2+ 变更并行只读子代理 ≤3，子代理失败串行补收）
8. 冲突检测（capability → changes 映射，2+ 变更同 capability 即冲突）
9. 冲突智能解决（读 delta specs + 搜代码库证据；三分支：单实现只同步该变更 / 双实现按时间序旧先新后 / 都未实现跳过同步+警告；2+ 独立冲突并行调查子代理）
10. 合并状态表展示 → 直接进入执行（不二次确认，多选即范围决策；不完整变更带警告归档）
11. 三阶段分层并行归档（无共享 capability 并行组 + 共享串行链；归档子代理 ≤3 并发；单元内串行 a→a.5→b→b.5；失败隔离 WARN 继续）
12. 归档单元四步：a) specs 智能合并同步 → a.5) exploration.md→explorations.md 探索记忆同步（过时标注不删除） → b) `mv` 至 `archive/YYYY-MM-DD-<name>` → b.5) 需求文档.md→devdocs 迁移
13. 汇总显示（成功/跳过/失败清单 + spec 同步摘要 + 并行统计）
14. ARCHIVE-INDEX.md 批量索引主代理单点更新（条目提取：日期/模块/摘要≤50字符；模块统计；损坏恢复；failed/skipped 不入索引）
15. CodeGraph 项目级单次 sync + 单次验证（条件：预检通过且 ≥1 成功；失败不阻塞）

**C. 注册集成链路**（3 项）
16. 模板注册（skill 注册表 + command 注册表两条，workflowId `spec-bulk-archive`）
17. 名单/映射登记（workflow 配置条目、ALL_WORKFLOWS、skill 名单、WORKFLOW→skill 映射、legacy 记账——按目标项目实际登记点等价接入）
18. sync 依赖注入（custom profile 下选 bulk-archive 未选 sync 时自动补 sync）

**D. 测试同步**（1 项）
19. 测试覆盖（内容 hash 锁定 + 工厂注册 parity + status-first 检测断言 + 名单/映射断言）

## 源需求文档摘要

- **文档**：`attachments/source-feature-doc/bulk-archive_需求文档.md`（本变更目录内，迁移唯一事实来源）
- **源项目**：E:\github\OpenSpec（TypeScript ESM CLI 工作流模板体系，Node ≥ 20.19）
- **核心入口**：`src/core/templates/workflows/bulk-archive-change.ts`（793 行）—— `getBulkArchiveChangeSkillTemplate()`（行 9-402）+ `getOpsxBulkArchiveCommandTemplate()`（行 404-793）
- **注册链路（源项目 12 个文件）**：skill-templates.ts:16（re-export）、skill-generation.ts:15,30,83,118（双注册表）、commands/config.ts:87-90（workflow 条目）、profiles.ts:29,51-70（ALL_WORKFLOWS + sync 依赖注入）、config.ts:12（OPENSPEC_SKILL_NAMES）、tool-detection.ts:22,46（双名单）、command-references.ts:63（映射）、legacy-cleanup.ts:76（记账）、init.ts:71 + profile-sync-drift.ts:22（WORKFLOW_TO_SKILL_DIR）
- **11 步工作流**：变更发现（CLI 降级）→ 多选 → CG 预检 → 批量状态收集（并行子代理）→ 冲突检测 → 冲突智能解决（证据三分支）→ 状态表 → 三阶段分层并行归档（a/a.5/b/b.5）→ 汇总 → ARCHIVE-INDEX 单点更新 → CG 单次同步验证
- **测试覆盖**：8 个测试文件（hash 锁定 skill-templates-parity.test.ts 为核心参考）
- **排除项**：`bulk-archive-move.cjs`（源项目根目录一次性手工归档脚本，非功能本体）
- **迁移映射**：模板文件 → `spec-bulk-archive.ts`；skill 目录 → `venus_spec_bulk_archive`；命令 → `venus:spec-bulk-archive`；workflowId → `spec-bulk-archive`；CLI 名 openspec → venus

## 目标项目探索发现

> 2026-09-14 Phase 2 探索（CodeGraph 索引可用但调用者查询未命中，降级 Grep + 全文阅读）。

### 模板体系结构（与源项目的差异）

| 维度 | 源项目 OpenSpec | 目标项目 VenusAgentTools |
|------|-----------------|--------------------------|
| 注册方式 | 两张独立注册表（getSkillTemplates/getCommandTemplates）+ dirName/workflowId 显式登记 | **单一 `WORKFLOW_PAIRS` 成对注册**（registry.ts:90-118，skill+command 一对），commandId 由 `deriveCommandId(skill.name)` 自动派生 |
| 登记面 | 8 处名单/映射（profiles/config/tool-detection/command-references/legacy-cleanup/init/profile-sync-drift） | **仅 registry.ts 一处注册**；config.ts `listAllWorkflowIds()`、reconcile.ts 均从注册表自动派生 |
| SkillTemplate 类型 | 6 字段（name/description/instructions/license/compatibility/metadata） | **8 字段**：多必填 `allowedTools: string` 与 `type: SkillType`（types.ts:11-31） |
| profile | CORE_WORKFLOWS 不含 bulk-archive；custom 时注入 sync | DEFAULT_WORKFLOWS 7 项（tr-init-project + spec 全 6）；DEPS 注入表（profiles.ts:38-45） |
| 归档执行 | bash `mkdir -p` + `mv` | **`venus spec archive "<name>" --yes`**（CLI 单命令完成状态检查+目录移动） |
| 变更列表命令 | `openspec list --json` | **`venus spec status --json`**（无 --change 时列全部活跃变更，src/commands/spec.ts:120-126） |
| spec 同步 | openspec-sync-specs approach | **内联 AI 合并**（ADDED/MODIFIED/REMOVED/RENAMED，v1.1.20 specs-apply 语义，spec-archive.ts 步骤 4） |
| 归档独有检查点 | 无 | **4.5 CONTEXT.md Sync**（强制检查点，spec-archive.ts:83-109） |
| ARCHIVE-INDEX 条目 | 日期/名称/模块/摘要 | 同左 + **`[含<type>]` 补充注记**（扫描 tasks.md 非 [代码] 类型标签） |

### 命名与注册适配（已确认）

- 模板文件：`src/core/templates/workflows/spec-bulk-archive.ts`（新增，文件头注释风格参照 spec-archive.ts）
- 工厂函数：`getSpecBulkArchiveSkillTemplate()` / `getSpecBulkArchiveCommandTemplate()`（参照 `getSpecArchiveChangeSkillTemplate` 命名，spec 系列先例：SpecExplore/SpecPropose/SpecApplyChange/SpecArchiveChange/SpecVerifyChange）
- skill name：`venus_spec_bulk_archive` → 自动派生 commandId `spec-bulk-archive`（registry.ts:76-81 派生规则），对应命令文件 `.claude/commands/venus/spec-bulk-archive.md`、命令名 `venus:spec-bulk-archive`
- 注册位置：registry.ts `WORKFLOW_PAIRS` 的 spec-archive 行（:115）之后插入成对注册
- 命令展示名：`Venus: 批量归档`（参照 `Venus: 归档变更`，spec-archive.ts:333）
- type: `'spec'`；allowedTools 参照 spec-archive.ts:10（`'Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*)'`——批量版需含子代理派发工具）

### 消费方（自动接入，无需手工登记）

- `src/commands/init.ts:126,140` 与 `src/commands/update.ts:95,122`：遍历注册表生成安装产物
- `src/commands/config.ts:40`：`listAllWorkflowIds()` 自动纳入勾选列表
- `src/core/reconcile.ts:48`：目录名 → workflow id 对账
- `src/core/profiles.ts:38-45`：DEPS 注入表需新增 `'spec-bulk-archive': ['spec-verify']`（对齐 spec-archive 的归档前验证依赖语义，即源项目"bulk-archive 依赖 sync"的目标项目等价物）

### Dogfood 现状

`.venus/config.yaml` workflows 现配置 16 项（spec 全 6 + tr 系列 10）；`.claude/skills/` 与 `.claude/commands/venus/` 产物已提交 git（AGENTS.md 约定）。

### 指令文本适配映射（源 → 目标，Phase 3 实现依据）

| 源指令元素 | 目标适配 |
|------------|----------|
| `openspec list --json` | `venus spec status --json` |
| `openspec status --change "<name>" --json` | `venus spec status --change "<name>" --json` |
| mkdir+mv 归档 | `venus spec archive "<name>" --yes`（失败处理保持失败隔离语义） |
| openspec-sync-specs approach | 内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED，v1.1.20 specs-apply 语义） |
| CLI 降级签名的命令名 | 同（错误签名为 OS 层文本，不变） |
| Guardrail 头 | 不变（同为 openspec/rules/ai-coding.md） |
| workspace-planning 停止语义 | 不变（目标 spec-archive 同款） |
| ARCHIVE-INDEX 索引更新 | 保留 + 增加目标项目 `[含<type>]` 注记惯例 |

### 测试同步点（Phase 3 任务清单依据）

1. `test/templates.test.ts:13`：计数断言「内置 22 个技能（spec 类 6）」→ **23 个（spec 类 7）**；commandId 派生断言新增 spec-bulk-archive
2. `test/skills-parity.test.ts`：新增快照 `skills/venus_spec_bulk_archive/SKILL.md`（`pnpm build && pnpm generate:skills` 生成）
3. `test/profiles.test.ts`：DEPS 表新增 `'spec-bulk-archive': ['spec-verify']` 断言
4. `test/allowed-tools.test.ts`：allowedTools 与正文命令一致性（自动扫描，需确认通过）
5. `.venus/config.yaml` workflows 增补 `spec-bulk-archive` + `.claude/` dogfood 产物更新

## 目标项目规范要点

> 来源：AGENTS.md（仓库根）+ openspec/specs/skill-profile/spec.md + openspec/rules/ai-coding.md。以下为对 Phase 2 提案推导与 Phase 3 子代理派发指令的**强制约束**。

### 命名与结构约定

- 技能名强制 `venus_` 前缀且等于安装目录名；frontmatter `metadata.type` 必须是 SKILL_TYPES 之一（spec 系列为 `'spec'`）
- 指令 id 派生：`venus_<type>_<name>` → `<type 连字符化>-<name>`（下划线转连字符去前缀）
- 模板文件按 `workflows/<id>.ts` 命名；代码注释中文、标识符英文
- 新技能注册仅改 `registry.ts` 的 `WORKFLOW_PAIRS`（一处登记，勿模仿源项目的多处名单）

### 强制流程规则（AGENTS.md「修改守则」）

1. **改技能模板后必须依次 `pnpm build && pnpm generate:skills`** —— 否则 skills-parity.test.ts 失败
2. **改模板正文的命令时同步更新 `allowedTools` 字段** —— 否则技能在 Claude Code 被权限拦截（allowed-tools.test.ts 拦截回归）
3. YAML frontmatter 含冒号/引号的值必须走 `escapeYamlValue`
4. Windows 兼容：路径断言用 `replaceAll('\\', '/')` 归一化；`path.join` 不硬编码分隔符
5. `.venus/` 与 `.claude/`（dogfood 产物）都提交到 git
6. 提交信息：Conventional Commits 一行式，中文描述

### 编码规范（openspec/rules/ai-coding.md，与全局 CLAUDE.md 同源）

- 零猜测：未确认内容标 `[待确认]` 提问，不猜测
- 设计先行 + 确认门：跨文件修改先出设计，确认后编码
- 4 空格缩进；行宽 ≤120；双引号；语句尾分号
- 方法/类 JavaDoc 式中文注释（目标项目现有模板文件均带中文文件头注释）

### 主规格约束（skill-profile spec）

- DEPS 依赖注入为不动点迭代；补入项 MUST 在输出中提示用户（profiles.ts 已实现，新增条目复用）
- DEFAULT_WORKFLOWS 描述为「tr-init-project + spec 全 6」——**本变更不修改 DEFAULT_WORKFLOWS**（忠实源项目"bulk-archive 非核心工作流"定位：源 CORE_WORKFLOWS 不含 bulk-archive），故该 Requirement 文本无需变更
- skill-profile spec 的依赖注入 Requirement 需通过 delta spec 补充 spec-bulk-archive 注入场景

# 技术设计：add-spec-bulk-archive

> 事实来源：[源需求文档](attachments/source-feature-doc/bulk-archive_需求文档.md)（源项目 12 文件全景 + 11 步工作流逐步骤分解）+ [exploration.md](exploration.md)（目标项目探索发现 + 规范要点）。

## Context

源项目 OpenSpec 的 bulk-archive 是工作流模板（`src/core/templates/workflows/bulk-archive-change.ts`，793 行，两个纯数据工厂函数），经两张注册表（skill-generation.ts）与 8 处名单/映射登记分发。本项目（VenusAgentTools）模板体系结构不同：单一 `WORKFLOW_PAIRS` 成对注册（registry.ts:90-118），commandId 由 `deriveCommandId` 自动派生，config/reconcile/init/update 全部从注册表派生——**登记面从 8 处收敛到 1 处**。

本项目 SkillTemplate 比源项目多两个必填字段（`allowedTools`、`type`，types.ts:11-31）。本项目已有 `spec-archive`（单变更归档）是从源项目 archive-change 迁移的先例，其指令含本项目特有的强制检查点（4.5 CONTEXT.md Sync）与索引注记（`[含<type>]`）。

## Goals / Non-Goals

**Goals**:
- 将源项目 bulk-archive 11 步批量归档工作流完整迁移为 `venus_spec_bulk_archive` 技能（蒸馏清单 19 项全部保留，无裁剪）
- 指令文本对齐本项目 CLI 与归档惯例（venus CLI 命令、内联 AI 合并、CONTEXT.md 检查点、索引注记）
- 完整链路：模板 + 注册 + DEPS 注入 + 快照 + 测试 + dogfood 产物

**Non-Goals**:
- 不修改 DEFAULT_WORKFLOWS（忠实源项目"bulk-archive 非核心工作流"定位：源 CORE_WORKFLOWS 不含 bulk-archive；未配置 workflows 的项目行为不变）
- 不迁移源项目根目录的 `bulk-archive-move.cjs`（一次性手工归档脚本，非功能本体）
- 不新增 CLI 命令（批量归档是 AI 技能工作流，非 CLI 子命令；`venus spec archive` 单命令被逐变更复用）
- 不解决源项目"双份指令文本维护"的结构问题（保持 skill instructions 与 command content 两份一致文本，与全部 22 个现有模板结构一致；重构属独立改进）

## Decisions

### D1: 变更发现命令用 `venus spec status --json`（而非源项目的 `openspec list --json`）
- **选择**: `venus spec status --json`（无 --change 参数）
- **理由**: 本项目无 `venus list --json` 变更列表命令（`venus list` 是列已安装技能）；spec-archive 先例（spec-archive.ts:24）用 `venus spec status --json` 获取可选变更，输出含全部活跃变更状态（src/commands/spec.ts:120-126）
- **备选**: 新增 `venus list --json` 变更列表命令——否决：超出迁移范围，CLI 面最小改动

### D2: 归档执行用 `venus spec archive "<name>" --yes`（而非源项目的 bash mkdir+mv）
- **选择**: 每变更调用一次 `venus spec archive "<name>" --yes`
- **理由**: 对齐本项目 spec-archive 步骤 5（spec-archive.ts:156-167）；CLI 单命令完成状态检查 + 目录移动 + 目标命名（YYYY-MM-DD-<name>）+ `.openspec.yaml`/`attachments/` 保留，避免技能层重复实现移动逻辑；失败隔离语义保留（失败该变更记 Failed 继续批次）
- **备选**: 保留源项目裸 bash mkdir+mv——否决：绕过 CLI 状态检查，与本项目归档链惯例不一致（Phase 4 C13 架构一致性检查会命中）

### D3: spec 同步用内联 AI 合并（而非源项目的 openspec-sync-specs approach）
- **选择**: ADDED/MODIFIED/REMOVED/RENAMED 四类操作直接应用主规格，遵循 v1.1.20 specs-apply 合并语义
- **理由**: 对齐本项目 spec-archive 步骤 4（spec-archive.ts:58-81）；本项目无独立 sync 技能，内联合并是既有惯例
- **备选**: 引入源项目的 sync 技能——否决：超出迁移范围且引入新技能面

### D4: 归档单元纳入 CONTEXT.md 检查点（源项目 bulk-archive 无此步）
- **选择**: 批量版归档单元在 spec 同步后、CLI 归档前执行 CONTEXT.md Sync（对齐 spec-archive 4.5 的 MANDATORY CHECKPOINT）
- **理由**: 本项目归档链的强制检查点（spec-archive.ts:83-109），批量归档跳过会造成单/批归档行为分叉（Phase 4 C13 命中风险）；失败不阻塞语义与批量失败隔离天然兼容
- **备选**: 忠实源项目不含此步——否决：迁移融入目标体系（B组检查原则），与 spec-archive 行为对齐优先

### D5: 探索记忆同步（源 8a.5）合并进归档单元序列，顺序调整为 b 之后（CONTEXT 检查与 CLI 归档之后）
- **选择**: 单元序列 = a) specs 内联合并 → a.5) CONTEXT.md 检查 → b) `venus spec archive --yes` → b.5) 探索记忆同步 + 需求文档迁移（exploration.md 随目录已移动，从归档目录读取）
- **理由**: 源项目顺序为 a→a.5(exploration)→b(mv)→b.5(需求文档)，探索记忆同步在移动前（源行 162-173）；但本项目 CLI 归档命令一次完成移动，技能层无法在移动前插入步骤；exploration.md 随目录移动至归档目录后路径仍确定（`archive/YYYY-MM-DD-<name>/exploration.md`），从归档目录读取同样可完成（提取复制不移动，spec-archive.ts:153 同款语义"extraction copies, not moves"）
- **备选**: 用裸 bash mkdir+mv 保持源顺序——否决：与 D2 冲突

### D6: DEPS 注入 `'spec-bulk-archive': ['spec-verify']`（而非源项目的注入 sync）
- **选择**: `spec-bulk-archive ⇒ spec-verify`
- **理由**: 源项目注入 sync 因归档含 spec 同步；本项目无独立 sync 技能，spec-archive 的注入物是 spec-verify（归档前验证职责），批量版对齐同一语义（profiles.ts:28 注释）
- **备选**: 不注入——否决：用户漏选 verify 时批量归档绕过验证门，与 spec-archive 行为分叉

### D7: 工厂命名 `getSpecBulkArchiveSkillTemplate` / `getSpecBulkArchiveCommandTemplate`
- **选择**: 简洁式（不含 Change 后缀）
- **理由**: spec 系列命名先例不完全一致（SpecExplore/SpecPropose 无后缀，SpecApplyChange/SpecArchiveChange/SpecVerifyChange 有）；BulkArchive 本身语义完整，加 Change 冗余
- **备选**: `getSpecBulkArchiveChangeSkillTemplate`（源项目 BulkArchiveChange 同构）——否决：过长且无先例强制

### D8: 正文语言英文 + description 中文（跟随 spec 系列实际惯例）
- **选择**: 指令正文英文，frontmatter description 中文
- **理由**: spec-archive.ts 实际形态即如此（description 中文行 9，instructions 英文行 12-324）；spec 系列 6 个模板均从 OpenSpec 英文迁移保持英文正文，批量版保持一致
- **备选**: 全中文化——否决：与 spec 系列 6 个模板分叉，翻译引入语义漂移风险

### D9: allowedTools 在 spec-archive 基础上补子代理派发工具
- **选择**: `'Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*), Task'`（含子代理派发）
- **理由**: 批量工作流 2+ 变更时并行派发只读验证/调查/归档子代理（源行 73、109、143），需 Task 工具；AGENTS.md 修改守则第 2 条（正文命令与 allowedTools 同步）
- **备选**: 仅复制 spec-archive 的 allowedTools——否决：子代理派发会被权限拦截
- **[待确认]**: Task 工具在本项目 allowed-tools.test.ts 的白名单校验规则（实现时核对 test/allowed-tools.test.ts 的断言模式，若 Task 不在允许清单则调整）

### D10: dogfood 接入——`.venus/config.yaml` workflows 增补 `spec-bulk-archive` 并生成 `.claude/` 产物
- **选择**: 增补 + 运行 update 生成 `.claude/skills/venus_spec_bulk_archive/` 与 `.claude/commands/venus/spec-bulk-archive.md`
- **理由**: AGENTS.md 约定 `.venus/` 与 `.claude/` 均提交 git（dogfood）；本项目即 spec 工作流的使用者，批量归档技能自用
- **备选**: 不接入 dogfood——否决：产物链不完整，skills-parity 与 dogfood 分叉

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 指令文本 700+ 行手工适配（CLI 名、路径、语义替换）引入抄写漂移 | 实现后逐项对照源需求文档第 6.1 节 11 步表格复核；Phase 4 迁移检查子代理独立交叉核对 |
| allowedTools 与正文命令不一致（AGENTS.md 守则 2） | test/allowed-tools.test.ts 自动拦截；D9 列出差异点（Task 工具） |
| 归档单元顺序调整（D5：探索记忆移到 CLI 归档后）改变源语义 | spec-archive.ts:153 先例（"extraction copies, not moves"）+ Phase 4 迁移检查核对探索记忆同步效果 |
| DEPS 注入测试（profiles.test.ts）遗漏新条目 | tasks.md 显式列出测试任务；spec delta 含对应 Scenario |
| 快照未再生成导致 skills-parity 失败 | AGENTS.md 守则 1：`pnpm build && pnpm generate:skills`；tasks.md 将其列为独立任务 |
| 并发写风险：子代理与主代理同时写 ARCHIVE-INDEX/codegraph | 指令文本保留源项目单点操作禁令（子代理禁写索引、禁 codegraph sync） |

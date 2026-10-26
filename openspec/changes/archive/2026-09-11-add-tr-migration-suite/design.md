# Design: add-tr-migration-suite

> 迁移来源与依据：`attachments/source-feature-doc/迁移技能套件_关联分析.md`（源项目 E:\github\OpenSpec v1.9.5）；蒸馏清单与用户裁决见 `exploration.md`。本设计遵循 `exploration.md` → `## 目标项目规范要点`（BINDING）。

## Context

- **源实现链**（OpenSpec）：`src/core/templates/workflows/{feature-doc-generator,migration-checker,auto-migration}.ts`（每文件导出 SkillTemplate + CommandTemplate 一对，instructions 为内嵌 markdown 长文本）→ `skill-templates.ts` 转发 → `shared/skill-generation.ts` 注册（workflowId + dirName）→ `init.ts` 按 profile 过滤安装。三功能是非 CORE 扩展件。
- **目标实现链**（VenusAgentTools）：`src/core/templates/workflows/<id>.ts`（每文件导出 `get<X>SkillTemplate` + `get<X>CommandTemplate`）→ `registry.ts` WORKFLOW_PAIRS 注册（commandId 由 `deriveCommandId(skillName)` 派生）→ `generate`/`init` 按 `profiles.ts` 的 resolveWorkflows 过滤生成 → `skills/` 快照（`scripts/generate-skills.mjs`）+ `.claude/` dogfood。
- **接口差异**：目标 `SkillTemplate` 比源多两个必填字段 `allowedTools`（权限白名单）与 `type`（SkillType 枚举）；源 `license`/`compatibility`/`metadata` 目标同样支持（可选）。
- **CLI 等价物**：目标 `venus spec` 命令组（ADR-0001 自研：`venus spec new/status/instructions/archive`，对齐 openspec CLI 契约）。目标 `spec-apply.ts` 同样读取 `openspec/config.yaml` 的 `apply.concurrency`。
- **类型体系**：目标 SKILL_TYPES 现有 8 类（7 个 `tr_*` + `spec`），`tr_impl` 已有 1 技能（tr-impl-feature）。

## Goals / Non-Goals

**Goals**:

- 源三功能正文行为**完整迁移**（蒸馏清单 4 项全部保留，无裁剪）：feature-doc 扫描文档生成、migration-check 六层检查、auto-migration 四阶段编排
- SKILL_TYPES 扩展第 9 类 `tr_docs`；registry 注册 3 对；DEPS 注入 `tr-impl-auto-migration ⇒ [tr-docs-feature-doc, tr-impl-migration-check]`
- 正文 venus 生态适配（替换表见 exploration.md）+ C11/C12 语言无关化（用户裁决）
- `pnpm build && pnpm generate:skills` 后快照/dogfood/测试全绿

**Non-Goals**:

- 不新增 venus CLI 子命令（三技能纯模板层，复用现有 generate/init/update/config 链）
- 不修改 `DEFAULT_WORKFLOWS`（三技能为可选扩展件，与源 CORE_WORKFLOWS 定位一致）
- 不迁移源项目 `profile-sync-drift.ts` 漂移检查机制（目标无对应物；快照一致性由 `skills-parity.test.ts` 承担）
- 不做源技能的功能改进（如 `.ts/.js` 入口扩展名识别、CodeGraph agent-scan 机制升级）——仅记录为后续优化项，避免迁移夹带行为变化
- 不迁移 `openspec-create-requirement-doc` 相关引用（目标无该技能，auto-migration 正文的 NOT-for 边界改为不提及）

## Decisions

### D1: 类型归属与命名（用户裁决：以名称为准）

- **选择**: `tr-docs-feature-doc` → 新类型 `tr_docs`（技能名 `venus_tr_docs_feature_doc`）；`tr-impl-migration-check` / `tr-impl-auto-migration` → 现有 `tr_impl`（技能名 `venus_tr_impl_migration_check` / `venus_tr_impl_auto_migration`）
- **理由**: 用户显式指定三个指令名；按 `deriveCommandId` 派生规则反推类型归属，命名与类型体系完全自洽；SKILL_TYPES 仅扩 1 类（8→9）
- **备选**: 新增 `tr_docs` + `tr_migration` 两类型（名称须改为 tr-migration-check / tr-auto-migration，与用户命名冲突，被否决）；复用 `tr_tools`（名称变 tr-tools-*，与用户命名冲突，被否决）

### D2: 三技能不入默认集

- **选择**: `DEFAULT_WORKFLOWS` 保持 7 项不变；用户经 `.venus/config.yaml` 的 `workflows` 勾选或由 D3 注入带入
- **理由**: 与源项目三功能「非 CORE 扩展件」定位一致；迁移类技能属低频高级用法，默认安装会稀释默认集；`skill-profile` spec 的默认集需求不变
- **备选**: 全部入默认集（违背源定位且 CHANGELOG 的 BREAKING 说明需再改，被否决）

### D3: DEPS 注入规则

- **选择**: `DEPS` 表新增 `'tr-impl-auto-migration': ['tr-docs-feature-doc', 'tr-impl-migration-check']`
- **理由**: auto-migration Phase 1 非交互调用 feature-doc 技能、Phase 4 子代理内调用 migration-check 技能，两子技能缺失则编排技能必然运行失败；沿用现有 DEPS 数据表机制（D3 决策：扩展只改表），`resolveWorkflows` 无逻辑改动
- **备选**: 不注入（用户漏选时运行期报错，体验差，被否决）

### D4: 语义适配边界（用户裁决：语言无关化）

- **选择**: C11 检查描述改为「目标代码残留源项目异常/错误体系（如源项目自定义异常类、空 catch 吞异常）」；C12 改为「重复实现目标项目已有工具能力」；内置 3 个 Java 框架档案（Venus4A / Spring MVC / Struts）**保留**
- **理由**: 检查规则应为语言无关（目标 CLI 用户可能迁移任何栈的项目，包括 TS↔TS）；框架档案是「扫描源项目」的输入参数示例，被扫对象常为 Java 存量项目（本变更本身就是用例），保留即保留能力
- **备选**: 保持 Java 原文（检查规则在非 Java 迁移中失效，被否决）；全盘 TS 化（丢失 Java 扫描用户群，被否决）

### D5: CLI 引用与降级

- **选择**: `openspec status`/`openspec instructions` → `venus spec status`/`venus spec instructions`；CLI 降级签名判定（"command not found" / "不是内部或外部命令" / "not recognized"）保留；`openspec/config.yaml` `apply.concurrency` 引用保留（目标 spec-apply 同源引用）
- **理由**: ADR-0001 自研命令组对齐 openspec CLI 契约，行为等价；目标 spec-apply.ts L131-135 已引用 apply.concurrency，保留可维持两技能措辞一致
- **备选**: 删除并发度引用（与 spec-apply 不一致，被否决）

### D6: allowedTools 白名单

- **选择**:
  - `tr-docs-feature-doc`: `Read, Write, Edit, Glob, Grep, Bash(codegraph:*)`（扫描技能，读为主；写文档）
  - `tr-impl-migration-check`: `Read, Write, Edit, Glob, Grep, Bash(codegraph:*)`（对比+写报告）
  - `tr-impl-auto-migration`: `Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(codegraph:*)`（编排技能需跑 venus spec CLI）
- **理由**: 按「必须覆盖正文实际要运行的命令」守则逐技能盘点：三技能均需 CodeGraph MCP 工具（源正文 CodeGraph 优先策略）与文件读写；仅 auto-migration 正文调 CLI；技能正文提到的 Agent/Skill/AskUserQuestion/TodoWrite 为宿主内置工具不在 allowed-tools 语法管辖范围（目标现有模板同样不列）
- **备选**: 复制 spec-apply 的 `Bash(pnpm:*), Bash(npm:*), Bash(node:*)`（迁移技能正文不跑构建命令，冗余，被否决）

### D7: 模板文件结构与正文迁移方式

- **选择**: 每技能一个 `src/core/templates/workflows/<指令id>.ts` 文件，导出 `get<X>SkillTemplate()` + `get<X>CommandTemplate()`；instructions/content 从源文件对应字段**逐段复制**后按 exploration.md 替换表做文本适配（技能互调名、命令引用、CLI 名、/opsx:workflow 镜像引用、C11/C12 措辞）
- **理由**: 目标与源的模板结构同构（同源于 OpenSpec 架构），逐段复制+定向替换是最小改动路径，避免重写引入行为漂移；替换项全部有清单可核
- **备选**: 重写正文（行为漂移风险高、Review 成本大，被否决）

### D8: 命令模板命名风格

- **选择**: `name` 字段用目标风格 `Venus: Tr Docs Feature Doc` 式展示名（对齐现有命令命名），`category: 'Workflow'`，tags 沿用源 tags 语义
- **理由**: 与现有 14 个命令的 frontmatter 风格一致（dogfood 可读性）
- **备选**: 沿用 `OPSX: X`（残留源生态标识，被否决）

### D9: registry 注册位置

- **选择**: WORKFLOW_PAIRS 在 `tr_tools` 组之后、spec 组之前插入三对（tr_docs 一对 + tr_impl 两对紧跟现有 tr_impl 条目后），按「类型分区」排列
- **理由**: 列表顺序即安装与展示顺序，按类型分区与现有排列一致
- **备选**: 追加到列表末尾（打乱类型分区，被否决）

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 源 instructions 超长（feature-doc 428 行）模板字符串转义遗漏（反引号/`${}`） | 逐段复制时以源文件为基准核对转义；`pnpm build` 编译期捕获语法错；快照 parity 测试捕获内容漂移 |
| allowedTools 遗漏正文命令 → 运行期权限拦截 | D6 逐技能盘点 + `allowed-tools.test.ts` 回归 + Phase 4 迁移检查覆盖矩阵核对 |
| 文本适配替换遗漏（openspec/opsx 残留） | 实现后全文 grep `openspec`/`opsx`/`OPSX` 残留检查；Phase 4 评审子代理交叉核对 |
| DEPS 注入改变 `resolveWorkflows` 输出（现有用户配置含 tr-impl-auto-migration 时——现无人可能配，技能是新加的） | 新技能新规则，无存量配置可影响；`profiles.test.ts` 补注入用例锁定行为 |
| `countSkillsByType` 等遍历对第 9 类的兼容 | 该函数遍历 SKILL_TYPES 注册表自动兼容（registry.ts:135-139 已按注册表占位）；`templates.test.ts` 若有数量硬断言需同步更新 |
| 语言无关化改写偏离源语义 | 改写仅限示例措辞（C11/C12 的 e.g. 从句），规则定义（P0/P1/P2 判定标准）逐字保留；Phase 4 检查时对照源文核对 |

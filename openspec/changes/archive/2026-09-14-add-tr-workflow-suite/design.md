## Context

VenusAgentTools 是管理 venus 技能的 TS CLI 项目：`skills/` 为源技能目录，`src/core/templates/workflows/*.ts` 为模板工厂（「技能 SKILL.md + 指令 .md」模板对），`src/core/templates/registry.ts` 的 WORKFLOW_PAIRS 注册后经 `pnpm build && pnpm generate:skills` 快照分发到 `skills/`、`.claude/skills/`、`.claude/commands/venus/`。SkillType 现有 9 类（init/impl/test/commit/review/release/tools/spec/tr_docs），本次不新增类型。spec 生命周期已有 6 个单环节技能（venus_spec_explore/propose/verify_proposal/apply/archive/verify，add-spec-workflow 变更引入），其中 `venus_spec_propose` SKILL.md:138 引用的 `openspec/rules/artifact-generation.md` 在目标项目不存在（悬空引用）；`venus_spec_apply` 已支持 `auto-mode=true` 跳过设计确认门与 `apply.concurrency` 并发上限。上次迁移（add-tr-migration-suite，已归档）引入 tr-docs-feature-doc / tr-impl-migration-check / tr-impl-auto-migration 三技能，当时因目标无 openspec-create-requirement-doc 与 openspec-workflow 对应物而删除了模板中的 `/opsx:requirement-doc`、`/opsx:workflow` 引用。

源侧：`E:\github\OpenSpec\.claude\skills\` 的 workflow（1526 行）/ auto-workflow（521 行）/ debug（406 行）/ create-requirement-doc（241 行）四技能 + `openspec/rules/artifact-generation.md` 共享协议（102 行）；`C:\Users\venus\.claude\skills\openspec-proposal-review`（979 行，中文定制版，强 Venus4A Java 特征，源项目 skills/ 下不存在）。五技能均依赖 openspec CLI 命令（status/instructions/new）与 CodeGraph MCP；CLI 指令 JSON 契约与目标 `venus spec` 命令组一致（applyRequires/artifacts/changeRoot 与 template/context/rules/resolvedOutputPath/dependencies）。

## Goals / Non-Goals

**Goals**:
- 5 个技能按用户裁决命名与类型落地：`venus_tr_impl_workflow`（tr_impl）、`venus_tr_impl_auto_workflow`（tr_impl）、`venus_tr_impl_debug`（tr_impl）、`venus_tr_docs_requirement_doc`（tr_docs）、`venus_tr_impl_review_proposal`（tr_impl——实现期修正，见 D1）
- 生态引用完整替换：openspec CLI→venus spec 命令组、被依赖技能→目标对应物（venus_spec_verify_proposal / venus_spec_apply / venus_spec_archive / venus_tr_impl_review_proposal / venus_tr_docs_requirement_doc）
- 补齐 `openspec/rules/artifact-generation.md` 共享协议（venus spec 版），修复 venus_spec_propose:138 悬空引用
- 注册与依赖注入：WORKFLOW_PAIRS 5 对、DEPS 3 条规则、DEFAULT_WORKFLOWS 不变
- 联动恢复上次迁移删除的两处引用
- review-proposal 语言无关化 + 保留 Java 专项（与上次 migration-check 裁决一致）
- 测试与快照同步（skills-parity / templates / allowed-tools / profiles）、CHANGELOG 补记

**Non-Goals**:
- 不新增 SkillType（5 技能均归现有类型）
- 不改动 `venus spec` CLI 命令组本身（契约已兼容）
- 不改动 DEFAULT_WORKFLOWS 默认集（7 项不变，新技能经 `.venus/config.yaml` workflows 勾选）
- 不迁移源项目 `.agent/skills/`、`.github/skills/` 分发机制（目标项目已有自己的三处分发）
- 不实现 openspec-proposal-review-backup（用户指定迁移的是非 backup 版）
- 不改动 spec 系列 6 个既有技能的行为（仅修复 venus_spec_propose 的悬空引用指向）

## Decisions

### D1: 五技能命名与类型归属（用户裁决 + 实现期硬约束修正）
- **选择**: `venus_tr_impl_workflow` / `venus_tr_impl_auto_workflow` / `venus_tr_impl_debug`（tr_impl）、`venus_tr_docs_requirement_doc`（tr_docs）、`venus_tr_impl_review_proposal`（tr_impl）
- **理由**: 用户显式改选 workflow/auto-workflow 为 `tr-impl-` 前缀（对齐既有 tr-impl-auto-migration 模式）；requirement-doc 文档类用 tr-docs-（用户原始约束）；review-proposal 用户裁决为 `tr-spec-review-proposal`（spec 类），但实现期发现项目命名硬约束（templates.test.ts:28「技能名必须以 `venus_<type>_` 开头」）与用户「名称以 tr- 开头」约束联立的唯一解是 `venus_tr_impl_review_proposal`（tr_impl）——`venus_spec_*` 无 tr- 前缀违反用户约束，`venus_tr_spec_*` 类型段与 type=spec 不一致违反硬约束，故修正为 tr_impl 归属并同步全部引用与测试
- **备选**: `venus_tr_spec_review_proposal`（type=spec——用户裁决原方案，违反「技能名以 venus_<type>_ 开头」硬约束被实现期修正）；`venus_spec_review_proposal`（type=spec，类型段一致但指令 id 无 tr- 前缀，违反用户约束）

### D2: 验证 PASS 后深度复查对接——技能为主 + 内联 fallback（用户裁决）
- **选择**: workflow/auto-workflow/debug 验证 ≥90% 后调用 `venus_tr_impl_review_proposal` 技能；技能不可用时主工作流 fallback 内联只读深度复查 + WARN
- **理由**: 用户同时选择了"内联深度复查"与"追加迁移 proposal-review 技能"——技能为主恢复源行为，内联 fallback 对齐 venus_spec_propose 既有模式（L196"由主工作流在通过后直接执行一次 read-only 复查"），两个选择兼容
- **备选**: 仅内联复查（丢失源行为的结构化 8 维度检查，被用户追加迁移决策否决）；仅技能调用（技能缺失时复查环节静默缺失，违反"绝不静默跳过"原则被否决）

### D3: 探索文件清理行为统一为保留（用户裁决）
- **选择**: workflow 的 Phase 2.3 迁移探索文件后保留源文件（源行为是删除），与 auto-workflow 对齐
- **理由**: 保留更安全（迁移失败恢复、历史追溯）；auto-workflow 源行为即保留；两技能行为统一降低用户认知负担
- **备选**: 保留源差异（workflow 删 / auto-workflow 留）——同构操作行为不一致，被用户"统一"裁决否决

### D4: artifact-generation.md 协议补齐为项目文件（用户裁决）
- **选择**: 新建 `openspec/rules/artifact-generation.md`（venus spec 命令版），workflow 正文引用该路径；venus_spec_propose:138 的既有悬空引用随之修复（无需改动该模板——它已引用同一路径）
- **理由**: 源 workflow Phase 2.4 强制引用该协议（"MUST follow the shared protocol at openspec/rules/artifact-generation.md"）；目标 venus_spec_propose 已引用同一路径但文件缺失；补齐文件一次修复两处
- **备选**: 协议内联进 workflow 技能正文（venus_spec_propose 悬空引用仍需另行处理，且协议双技能共享的设计意图丢失，被否决）；删除引用直接描述（丢失共享协议的可维护性，被否决）

### D5: review-proposal 的 Venus4A 适配——语言无关化 + 保留 Java 专项（用户裁决）
- **选择**: 8 维度检查点与合规性检查改为语言无关表述（如"SQL 参数化 vs 拼接"）；Venus4A 特有检查（IE 兼容禁 ES6+、DataStore/DataObject 小写列名、Log4j 1.2.x Logger 声明、Oracle 11g 方言、`src/cn/com/venustech/venus4a/` 路径）保留为"Java/Venus4A 项目专项检查"小节，触发条件为检测到 Java 项目特征
- **理由**: 与上次迁移 migration-check 的用户裁决一致（目标 CLI 用户仍可能扫描 Java 源项目；全局 CLAUDE.md 本身含 Venus4A 规范）；完全语言无关化会丢失 Venus4A 专项价值；原样迁移对非 Java 项目大量检查点不适用
- **备选**: 完全语言无关化（删除 Venus4A 专项——丢失 Java 项目检查价值被否决）；原样迁移（非 Java 项目不可用被否决）

### D6: Semgrep 引用保留（用户裁决）
- **选择**: tr-impl-workflow 的关键词安全分析保留 Semgrep MCP 工具引用（`mcp__plugin_semgrep_semgrep__semgrep_scan`），标注为可选增强：Semgrep MCP 不可用时该分析跳过并记录，不阻塞工作流
- **理由**: 保留源能力完整性；Semgrep 是安全分析的可选增强而非硬依赖
- **备选**: 删除 Semgrep 引用（丢失安全分析能力被用户否决）

### D7: DEPS 依赖注入规则设计
- **选择**: `tr-impl-workflow ⇒ [tr-impl-review-proposal, tr-docs-requirement-doc]`、`tr-impl-auto-workflow ⇒ [tr-impl-workflow, tr-docs-requirement-doc]`、`tr-impl-debug ⇒ [tr-docs-requirement-doc]`
- **理由**: workflow Phase 3.5 调用 review-proposal 技能与 requirement-doc 技能；auto-workflow Phase 1-3 同构 workflow（含其全部技能依赖）且 Phase 3.3 调 requirement-doc；debug Phase 7.3 调 requirement-doc（Phase 7.1 调的 venus_spec_verify_proposal 已由 spec-propose 链覆盖……不——debug 直接调 verify_proposal，但 verify_proposal 属 DEFAULT 之外的 spec 系列技能，勾选 debug 的用户若未勾选 spec-propose 仍需 verify_proposal，故 debug 的 DEPS 还应含 spec-verify-proposal）。修正：`tr-impl-debug ⇒ [tr-docs-requirement-doc, spec-verify-proposal]`
- **备选**: 不做依赖注入（用户勾选 debug 而无 verify_proposal/requirement_doc 时技能链断裂被否决）

### D8: 联动恢复上次迁移删除的引用
- **选择**: `src/core/templates/workflows/tr-docs-feature-doc.ts` 与 `tr-impl-auto-migration.ts` 模板正文中恢复：`/opsx:requirement-doc` NOT-for 引用 → `/venus:tr-docs-requirement-doc`；auto-migration 中 `/opsx:workflow` 镜像引用（上次改为 spec 工作流链）→ 保持现有 spec 链引用并补充 `/venus:tr-impl-workflow` 完整工作流选项
- **理由**: 上次迁移的 [待确认] 项当时裁决为删除（无对应物）；本次补齐对应物后恢复引用使生态闭环；改动为模板正文引用行，符合"最小改动"
- **备选**: 不恢复引用（新技能存在但既有技能不知道，生态引用断裂被用户"联动"选择否决）

### D9: allowedTools 白名单设计
- **选择**: 按 5 技能正文实际工具写白名单——tr-impl-workflow：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Skill, Agent, WebFetch, WebSearch, AskUserQuestion, TodoWrite`；tr-impl-auto-workflow：同左（Agent 用于多项目扫描）；tr-impl-debug：`Read, Write, Edit, Glob, Grep, Bash(venus:*), Bash(pnpm:*), Bash(npm:*), Bash(node:*), Bash(git:*), Skill, AskUserQuestion, TodoWrite`（编译检查需 pnpm/mvn/gradle/go/cargo——按目标项目技术栈 TS 为主取 pnpm/npm/node + git log --follow/blame）；tr-docs-requirement-doc：`Read, Write, Glob, Grep, AskUserQuestion, Skill`；tr-impl-review-proposal：`Read, Glob, Grep, Bash(venus:*), Edit, Skill`（Phase 9 更新文档需 Edit）
- **理由**: AGENTS.md 守则 2——allowedTools 必须与正文命令同步否则权限拦截；正文工具逐项核对源技能得出
- **备选**: 统一粗粒度白名单（过度授权被否决）

### D10: 模板文件结构遵循既有工厂模式
- **选择**: 5 个新模板文件均按 `src/core/templates/workflows/` 既有模式：导出 create<Name>SkillTemplate() 与 create<Name>InstructionTemplate() 工厂函数对，frontmatter 经 escapeYamlValue 处理含冒号/引号值，metadata.generatedBy 写全，type 归属见 D1
- **理由**: 与 add-spec-workflow、add-tr-migration-suite 两次既有实现模式一致；skills-parity 测试按此断言
- **备选**: 无（结构一致性是项目硬约束）

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 5 技能共约 3800 行源正文迁移，模板文件体量大，逐项引用替换易遗漏 | 引用替换表已穷举（源需求文档 11.2 节）；Phase 4 迁移检查子代理按核心功能覆盖矩阵逐项核对 |
| review-proposal 语言无关化改写可能改变检查语义 | 保留 Java 专项小节原语义；语言无关化仅改表述不改检查点实质；Phase 4 对抗检查 C2 分支逻辑完整性覆盖 |
| venus_spec_propose 悬空引用修复依赖新文件路径正确 | 文件写入 `openspec/rules/artifact-generation.md` 与该技能 L138 引用完全一致，无路径变更 |
| DEPS 连带补全（auto-workflow→workflow→review-proposal）多级传递 | profiles.ts DEPS 为既有机制，补全提示输出全部补入项；profiles.test.ts 补三条规则用例 |
| CLI 降级签名判定在 Windows 中文环境的编码差异 | 源技能已内置三签名（command not found / 不是内部或外部命令 / not recognized），上次迁移已验证可用 |
| tr-impl-debug 编译检查命令表含 5 技术栈但目标用户多为 TS 项目 | 命令表按 config.yaml compileCheck 配置驱动，未配置默认禁用跳过——不产生硬依赖 |
| .claude/skills/ 下存在用户自装的同名 openspec-* 技能与新 venus_* 技能并存可能混淆 | reconcile 机制：不在生效集的产物保留不删仅提示（skill-profile 既有规范）；命名前缀 venus_ 可区分 |

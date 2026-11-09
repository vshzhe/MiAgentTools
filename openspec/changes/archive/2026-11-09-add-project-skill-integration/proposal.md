## Why

项目的前端 / 后端设计实现约定目前只以两类形式存在：`.iagent/rules/*.md` 中的通用规则行，以及源码与项目文档中的隐含约定。探索阶段（explore / workflow / auto-workflow / debug）做功能设计、实现阶段（apply 及编排的实现阶段）写代码时，只能依赖通用规则与临时扫描，缺少**项目专属、可复用、按阶段加载**的前后端设计实现技能载体，导致设计与实现容易偏离项目既有框架惯例。

同时，`.iagent` 配置目前无法声明「本项目使用哪些前后端技能」，也没有在项目初始化时依据实际框架生成这类技能的机制。需要把「配置接入」与「蒸馏生成」两条路径补齐，并在探索 / 实现阶段形成可审计的加载与校验闭环。

## What Changes

1. **配置接入**：`.iagent/config.yaml` 新增 `skills:` 段，按 `frontend` / `backend` 分组声明项目技能条目（裸名）；技能文件 frontmatter 声明 `phases: design | implement | both`（可选 `scope` / `frameworks`）。
2. **技能载体与路径解析**：项目技能默认落 `.iagent/skills/<name>.md`；文件缺失时按生效 agent 工具顺序在宿主技能目录（`.claude` / `.pi` / `.codex` / `.opencode` 的 `<skillsDir>/skills/<name>/SKILL.md`）回退查找同名 skill。`.iagent` 优先，不合并两份内容。
3. **枚举命令**：新增 `iagent skills --json`，输出配置条目、解析路径、`exists` / `bytes` / `sha256` 前 12 位 / `lines` 与 frontmatter 元数据，作为技能基线的确定性来源。
4. **技能蒸馏**：`iagent_project_init` 新增第 11 步「技能蒸馏」——依据扫描基线与语义扫描证据判定前后端框架，生成 `.iagent/skills/frontend-design.md` / `backend-design.md`（项目复杂时拆为 `<side>-design.md` + `<side>-implement.md`），并自动注册到 `skills:` 段；证据驱动、零猜测、非阻断、人工域保护。
5. **探索消费**：`spec-explore`（delegated）与 `debug` 在规则基线之后**按阶段筛选**（`phases` 含 `design` 或 `both`）加载技能基线，写探索文件 `## 项目技能基线`；grill 与功能设计以技能为约束；`spec-propose` 读取探索的技能基线生成 handoff `## 规范要点` 的「技能要点」子节（不重新枚举，缺失时 WARN + 枚举一次并标来源）。
6. **实现消费与一致性**：`spec-apply` 与 `debug` 修复阶段读取 `phases` 含 `implement` 或 `both` 的技能并写回执 `skillsRead`；`workflow` / `auto-workflow` 在 Phase 1 透传技能基线状态、Phase 4 核对回执；实现一致性门新增 `skills-not-read` 诊断（**仅统计 implement/both 技能**：声明且存在但未读 → `fail`；design-only 不要求；配置为空或文件缺失 → WARN 不阻断）。
7. **内容完整性门（防「生成后技能不完整 / 规则缺失」）**：
   - `project-init` 写入前执行 **C1-C6 自检**：frontmatter 必填、7 个必需章节齐全（无内容须写「不适用 + 探测依据」）、每条规则带证据锚点、无占位符、与既有规则冲突显式标注、超长拆分；自检不通过且无法补齐时 MUST NOT 写入该侧技能。
   - `iagent skills --json` 对每个存在条目输出 `validation`（`status` / `missingSections` / `emptySections` / `placeholders` / `ruleLinesWithoutEvidence`），只读报告。
   - 探索基线记录完整性状态；`incomplete` 记 WARN 并列出缺失项；apply 回执新增 `skillsIncomplete`；一致性诊断输出 `skills-incomplete` WARN（不判 fail）。

**BREAKING**：无。

## Capabilities

### New Capabilities

- `project-skill-config`: `.iagent/config.yaml` 的 `skills:` 声明契约、项目技能文件载体与 frontmatter、`iagent skills --json` 枚举命令（含完整性 `validation` 输出）、`.iagent` 优先与宿主目录回退的路径解析规则。
- `project-skill-distillation`: `iagent_project_init` 的技能蒸馏步骤——证据判定前后端框架、单侧缺失不生成、复杂度驱动的设计/实现拆分、**C1-C6 内容完整性自检门**、已存在确认与人工域保护、自动注册、报告完整性摘要与失败非阻断。
- `project-skill-consumption`: 探索阶段的 `## 项目技能基线`（含完整性状态与阶段筛选）、handoff「技能要点」（propose 复用而非重枚举）、实现阶段的 `skillsRead` / `skillsIncomplete` 回执（apply 与 debug 修复）、`skills-not-read`（按阶段过滤）/ `skills-incomplete` 诊断、编排层 Phase 1 透传与 Phase 4 核对，以及与规则基线并列、互不替代的边界。

### Modified Capabilities

无。消费侧的新行为由新增能力 `project-skill-consumption` 完整承载；既有 `workflow-suite-skills`、`rule-baseline`、`project-init-rule-distill` 的既有需求语义不变（仅新增并列能力，不修改其 Requirement 契约）。

## Impact

### 直接影响的文件

- `src/core/project-config.ts`: 扩展 `parseProjectConfig` / `readProjectConfig` 解析 `skills:` 段；新增段级回写函数（保留注释与未知段）。
- `src/commands/skills.ts`（新建）: `iagent skills --json` / 文本输出；路径解析与回退查找。
- `src/cli/index.ts` / `src/commands/completion.ts`: 注册 `skills` 命令并同步补全表。
- `src/core/templates/workflows/project-init.ts`: 新增第 11 步技能蒸馏（含拆分判定与注册）。
- `src/core/templates/workflows/spec-explore.ts`: 新增技能基线检查点与 `## 项目技能基线` 段、handoff 技能要点消费。
- `src/core/templates/workflows/spec-apply.ts`: 实现前读取技能、回执 `skillsRead`。
- `src/core/templates/workflows/spec-propose.ts`: handoff `## 规范要点` 追加技能要点子节。
- `src/core/templates/workflows/workflow.ts` / `auto-workflow.ts` / `debug.ts`: 编排层透传与核对；debug 排查起点建立技能基线。
- `src/core/templates/workflows/spec-verify.ts`: 一致性诊断新增 `skills-not-read`。
- `skills/**`: 由 `pnpm build && pnpm generate:skills` 重新生成快照。
- `test/**`: 新增配置解析、枚举命令、模板正文与一致性诊断测试。

### 向后兼容

无破坏性变更。既有项目不含 `skills:` 段时行为与当前一致（「无技能配置」合法终态）；未注册的 `.iagent/skills/*.md` 不自动加载；既有 `rules` / `workflows` / `tools` / `compileCheck` / `testGate` 段的解析语义不变。

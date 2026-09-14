/**
 * spec 类型技能模板：提案。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

export function getSpecProposeSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_spec_propose',
        description: '创建变更提案。当用户要快速描述想构建的内容并一步生成包含设计、规格和任务的完整提案时使用。',
        allowedTools: 'Read, Write, Edit, Glob, Grep, Bash(venus:*)',
        type: 'spec',
        instructions: `Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

准备好实现时，告知我即可开始执行任务。

---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

---

**Input**: The user's request should include a change name (kebab-case) OR a description of what they want to build.

**Steps**

**Step 0: 探索文件检测**

在创建变更前，MUST 扫描并关联探索文件：

0. **能力级探索记忆检测（Capability Exploration Memory Injection）**
   - 从用户描述/变更名推断涉及的 capability（参照 Naming Convention 的 Module Identification：Glob \`openspec/specs/\` 匹配模块关键词）
   - 对每个涉及的 capability，检测 \`openspec/specs/<capability>/explorations.md\` 是否存在
   - 存在：读取该文件，将历史 Decisions、术语、边界场景注入探索与提案生成上下文
     - 标注「已过时（由 <change-name> 取代）」的分节仅作历史参考，以取代变更的决策为准
   - 不存在：记录 "无能力级探索记忆 — 全新探索"，正常流程

1. **扫描探索文件目录**
   - MUST 使用 Glob 工具扫描 \`openspec/explorations/*.md\`
   - 获取所有探索文件列表

2. **判断探索文件状态**
   - 如果无探索文件：继续正常流程，记录为 "无探索上下文"
   - 如果有探索文件：MUST 提示用户选择（不允许静默跳过）

3. **提示用户（当存在探索文件时）**
   > 检测到探索文件:
   > - {filename-1} (修改时间: {time})
   > - {filename-2} (修改时间: {time})
   >
   > 是否关联探索文件到此变更？
   > [关联选择的文件] [跳过]

4. **CONTEXT.md 检查（MANDATORY CHECKPOINT）**
   - 如果用户选择关联探索文件，在迁移前检查 \`openspec/CONTEXT.md\`
   - 如果 CONTEXT.md 存在：
     - 验证所有探索文件术语表条目已写入
     - 如果缺失，自动同步
   - 如果 CONTEXT.md 不存在：
     - 从探索文件术语表自动生成初始 CONTEXT.md
   - 如果无探索文件：跳过检查，记录 "无探索上下文，跳过 CONTEXT.md 检查"
   - 日志：记录 CONTEXT.md 状态

5. **用户选择处理**
   - **关联**：将探索文件迁移到变更目录
     - 源路径: \`openspec/explorations/{filename}\`
     - 目标路径: \`openspec/changes/{change-name}/exploration.md\`
     - 使用 \`path.join()\` 确保跨平台兼容
     - 迁移后读取探索内容作为提案生成的上下文
   - **跳过**：继续正常流程，记录为 "无探索上下文"

6. **探索内容传递给提案生成**
   - 如果用户选择关联探索文件：
     - 读取 \`exploration.md\` 中的 Decisions 章节 → 填充 proposal.md
     - 读取 Analysis 章节 → 填充 design.md
     - 读取 Questions 章节 → 填充 specs
     - 读取 Codebase Findings 章节 → 填充 tasks.md

1. **If no clear input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name following the naming convention below.

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

**Naming Convention**

Apply the following naming rules when deriving a change name:

**Format**: \`{prefix}-{module}-{feature}\` (or \`{prefix}-{feature}\` if module unknown)

**Prefix Recognition** (keyword → prefix):
| Keywords | Prefix |
|----------|--------|
| 新增, 添加, 增加, add | \`add-\` |
| 修复, bug, 问题, fix | \`fix-\` |
| 优化, 改进, 提升, improve | \`improve-\` |
| 重构, 调整, refactor | \`refactor-\` |
| 删除, 移除, remove | \`remove-\` |
| 文档, README, docs | \`docs-\` |
| 安全, 漏洞, 权限, security | \`security-\` |
| 配置, 参数, config | \`config-\` |
| 性能, 加速, perf | \`perf-\` |
| 定制, 适配, sync + customer name | \`sync-{customer}-\` |

**Prefix Priority** (when multiple keywords match): security > fix > sync > add > remove > improve > refactor > perf > config > docs

**Module Identification**:
1. Use Glob tool to scan \`openspec/specs/\` directory for module names
2. Match user description keywords against module names
3. Common module keywords: archive→cli-archive, artifact/workflow→cli-artifact-workflow, validate→cli-validate, workspace→workspace-foundation, change→change-creation
4. If no module matches, use simplified format \`{prefix}-{feature}\`

**Example Transformations**:
| User Input | Generated Name |
|------------|----------------|
| "新增归档索引功能" | \`add-cli-archive-index\` |
| "修复 artifact graph 解析问题" | \`fix-artifact-graph-parsing\` |
| "优化 workspace 查询性能" | \`perf-workspace-foundation-query\` |
| "修复登录安全漏洞" | \`security-auth-login-vulnerability\` |

**User-provided name**: If user provides a valid name, use it. If it has correct prefix but missing module, add module identifier.

2. **Create the change directory**
   \`\`\`bash
   venus spec new "<name>"
   \`\`\`
   This creates a scaffolded change in the planning home resolved by the CLI with \`.openspec.yaml\`.

   **按 \`openspec/rules/artifact-generation.md\` 协议执行 artifact 生成。**

3. **Get the artifact build order**
   \`\`\`bash
   venus spec status --change "<name>" --json
   \`\`\`
   Parse the JSON to get:
   - \`applyRequires\`: array of artifact IDs needed before implementation (e.g., \`["tasks"]\`)
   - \`artifacts\`: list of all artifacts with their status and dependencies (resolved as transitive closure of \`applyRequires\` ∪ \`requires\`)
   - \`planningHome\`, \`changeRoot\`, \`artifactPaths\`, and \`actionContext\`: path and scope context. Use these instead of assuming repo-local paths.

4. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is \`ready\` (dependencies satisfied)**:
      - Get instructions:
        \`\`\`bash
        venus spec instructions <artifact-id> --change "<name>" --json
        \`\`\`
      - The instructions JSON includes:
        - \`context\`: Project background (constraints for you - do NOT include in output)
        - \`rules\`: Artifact-specific rules (constraints for you - do NOT include in output)
        - \`template\`: The structure to use for your output file
        - \`instruction\`: Schema-specific guidance for this artifact type
        - \`resolvedOutputPath\`: Resolved path or pattern to write the artifact
        - \`dependencies\`: Completed artifacts to read for context
      - Read any completed dependency files for context
      - Create the artifact file using \`template\` as the structure and write it to \`resolvedOutputPath\`
      - Apply \`context\` and \`rules\` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all \`applyRequires\` artifacts are complete**
      - After creating each artifact, re-run \`venus spec status --change "<name>" --json\`
      - Check if every artifact ID in \`applyRequires\` has \`status: "done"\` in the artifacts array
      - Stop when all \`applyRequires\` artifacts are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

   d. **Parallel delta spec generation (multi-capability only)**:
      - When the \`specs\` artifact is ready for generation AND the change involves two or more capabilities (per the proposal's Capabilities section): dispatch one sub-agent per capability (Task tool) to generate that capability's delta spec in parallel — every sub-agent takes the completed \`proposal.md\` as its input
      - Merge all generated delta specs before proceeding to the next artifact in the dependency order (the proposal → specs → design → tasks chain is unchanged)
      - For a single-capability change: generate the delta spec directly in the artifact loop (automatic serial fallback, no dispatch)
      - On a sub-agent failure: the main workflow regenerates that capability's delta spec serially

5. **Show final status**
   \`\`\`bash
   venus spec status --change "<name>"
   \`\`\`

6. **Phase 3 Verification (auto — MANDATORY, no skip)**
   After all \`applyRequires\` artifacts are done, automatically enter Phase 3 verification (do NOT end the workflow at "Ready for implementation" before verification):
   - Invoke the \`venus_spec_verify_proposal\` **skill** (via Skill tool) for D1-D5 scoring. (\`venus_spec_verify_proposal\` is a skill name, NOT a valid \`venus spec instructions\` artifact ID — do not run it as a CLI instruction.)
   - **Verification review sub-agent**: dispatch an independent read-only review sub-agent (Task tool, subagent_type: "general-purpose") to perform the D1-D5 scoring — the sub-agent reads the change's artifacts without modifying them. On sub-agent dispatch failure: fall back to main-workflow inline scoring with a WARN log (never silently skip verification).
   - **PASS (≥90%)**: 验证通过后可对提案做一次内联深度复查（由主工作流在通过后直接执行一次 read-only 复查，不依赖专门技能名）。
   - **FAIL (<90%)**: auto-generate fixes, apply, re-run; if still FAIL, offer [Manual edit] / [Return to exploration (/venus:spec-explore)] / [View diff] (no skip-to-apply).
   - Fallback if skill unavailable: AI inline D1-D5 scoring + WARN log; never silently skip.
   - 验证使用 90% 通过阈值。

**Output**

After completing all artifacts AND Phase 3 verification passes:
- Change name and location
- List of artifacts created with brief descriptions
- Verification result: "Phase 3 verification passed (≥90%). Inline deep review completed."
- What's ready: "All artifacts created and verified! Ready for implementation."
- Prompt: "告知我即可开始执行任务。"

**Artifact Creation Guidelines**

- Follow the \`instruction\` field from \`venus spec instructions\` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use \`template\` as the structure for your output file - fill in its sections
- **IMPORTANT**: \`context\` and \`rules\` are constraints for YOU, not content for the file
  - Do NOT copy \`<context>\`, \`<rules>\`, \`<project_context>\` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Task Type Labels (for tasks.md generation):**
- Each task MUST include a type label: \`- [ ] [代码] N.M ...\` or \`- [ ] [DB脚本] N.M ...\` etc.
- Supplement tasks (non-\`[代码]\`) MUST include \`产出:\` field as indented content
- Default output path: \`attachments/<filename>\` (relative to changeRoot)
- See \`schemas/spec-driven/templates/tasks.md\` template for full label reference

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's \`apply.requires\`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, mark as **[待确认]** and ask the user. Never guess!
- After all artifacts are created, display a design blueprint summary and wait for user confirmation before suggesting implementation.
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next`,
        license: 'MIT',
        compatibility: '依赖 venus CLI（spec 命令组）与 CodeGraph MCP（可选）。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getSpecProposeCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 创建变更提案',
        description: '创建变更提案 —— 一步生成所有 artifact（proposal/design/specs/tasks）',
        category: 'Venus / 规格',
        tags: ['venus', 'spec', 'propose'],
        content: `**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.**

Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

准备好实现时，告知我即可开始执行任务。

---

**Input**: The argument after \`/venus:spec-propose\` is the change name (kebab-case), OR a description of what the user wants to build.

**Steps**

**Step 0: 能力级探索记忆检测（Capability Exploration Memory Injection）**

在创建变更前，MUST 检测能力级探索记忆：

1. 从用户描述推断涉及的 capability（参照下方 Module Identification：Glob \`openspec/specs/\` 匹配模块关键词）
2. 对每个涉及的 capability，检测 \`openspec/specs/<capability>/explorations.md\` 是否存在
3. 存在：读取该文件，将历史 Decisions、术语、边界场景注入提案生成上下文；标注「已过时（由 <change-name> 取代）」的分节仅作历史参考，以取代变更的决策为准
4. 不存在：记录 "无能力级探索记忆 — 全新探索"，正常流程

1. **If no input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name following the naming convention below.

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

**Naming Convention**

Apply the following naming rules when deriving a change name:

**Format**: \`{prefix}-{module}-{feature}\` (or \`{prefix}-{feature}\` if module unknown)

**Prefix Recognition** (keyword → prefix):
| Keywords | Prefix |
|----------|--------|
| 新增, 添加, 增加, add | \`add-\` |
| 修复, bug, 问题, fix | \`fix-\` |
| 优化, 改进, 提升, improve | \`improve-\` |
| 重构, 调整, refactor | \`refactor-\` |
| 删除, 移除, remove | \`remove-\` |
| 文档, README, docs | \`docs-\` |
| 安全, 漏洞, 权限, security | \`security-\` |
| 配置, 参数, config | \`config-\` |
| 性能, 加速, perf | \`perf-\` |
| 定制, 适配, sync + customer name | \`sync-{customer}-\` |

**Prefix Priority** (when multiple keywords match): security > fix > sync > add > remove > improve > refactor > perf > config > docs

**Module Identification**:
1. Use Glob tool to scan \`openspec/specs/\` directory for module names
2. Match user description keywords against module names
3. If no module matches, use simplified format \`{prefix}-{feature}\`

2. **Create the change directory**
   \`\`\`bash
   venus spec new "<name>"
   \`\`\`
   This creates a scaffolded change in the planning home resolved by the CLI with \`.openspec.yaml\`.

   **按 \`openspec/rules/artifact-generation.md\` 协议执行 artifact 生成。**

3. **Get the artifact build order**
   \`\`\`bash
   venus spec status --change "<name>" --json
   \`\`\`
   Parse the JSON to get:
   - \`applyRequires\`: array of artifact IDs needed before implementation (e.g., \`["tasks"]\`)
   - \`artifacts\`: list of all artifacts with their status and dependencies (resolved as transitive closure of \`applyRequires\` ∪ \`requires\`)
   - \`planningHome\`, \`changeRoot\`, \`artifactPaths\`, and \`actionContext\`: path and scope context. Use these instead of assuming repo-local paths.

4. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is \`ready\` (dependencies satisfied)**:
      - Get instructions:
        \`\`\`bash
        venus spec instructions <artifact-id> --change "<name>" --json
        \`\`\`
      - The instructions JSON includes:
        - \`context\`: Project background (constraints for you - do NOT include in output)
        - \`rules\`: Artifact-specific rules (constraints for you - do NOT include in output)
        - \`template\`: The structure to use for your output file
        - \`instruction\`: Schema-specific guidance for this artifact type
        - \`resolvedOutputPath\`: Resolved path or pattern to write the artifact
        - \`dependencies\`: Completed artifacts to read for context
      - Read any completed dependency files for context
      - Create the artifact file using \`template\` as the structure and write it to \`resolvedOutputPath\`
      - Apply \`context\` and \`rules\` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all \`applyRequires\` artifacts are complete**
      - After creating each artifact, re-run \`venus spec status --change "<name>" --json\`
      - Check if every artifact ID in \`applyRequires\` has \`status: "done"\` in the artifacts array
      - Stop when all \`applyRequires\` artifacts are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

   d. **Parallel delta spec generation (multi-capability only)**:
      - When the \`specs\` artifact is ready for generation AND the change involves two or more capabilities (per the proposal's Capabilities section): dispatch one sub-agent per capability (Task tool) to generate that capability's delta spec in parallel — every sub-agent takes the completed \`proposal.md\` as its input
      - Merge all generated delta specs before proceeding to the next artifact in the dependency order (the proposal → specs → design → tasks chain is unchanged)
      - For a single-capability change: generate the delta spec directly in the artifact loop (automatic serial fallback, no dispatch)
      - On a sub-agent failure: the main workflow regenerates that capability's delta spec serially

5. **Show final status**
   \`\`\`bash
   venus spec status --change "<name>"
   \`\`\`

6. **Phase 3 Verification (auto — MANDATORY, no skip)**
   After all \`applyRequires\` artifacts are done, automatically enter Phase 3 verification (do NOT end before verification):
   - Invoke the \`venus_spec_verify_proposal\` **skill** (via Skill tool) for D1-D5 scoring. (\`venus_spec_verify_proposal\` is a skill name, NOT a valid \`venus spec instructions\` artifact ID.)
   - **Verification review sub-agent**: dispatch an independent read-only review sub-agent (Task tool, subagent_type: "general-purpose") to perform the D1-D5 scoring — the sub-agent reads the change's artifacts without modifying them. On sub-agent dispatch failure: fall back to main-workflow inline scoring with a WARN log (never silently skip verification).
   - **PASS (≥90%)**: 验证通过后可对提案做一次内联深度复查（由主工作流在通过后直接执行一次 read-only 复查，不依赖专门技能名）。
   - **FAIL (<90%)**: auto-fix, re-run; if still FAIL, offer [Manual edit] / [Return to exploration (/venus:spec-explore)] / [View diff] (no skip-to-apply).
   - Fallback if skill unavailable: AI inline D1-D5 scoring + WARN log; never silently skip.
   - 验证使用 90% 通过阈值。

**Output**

After completing all artifacts AND Phase 3 verification passes:
- Change name and location
- List of artifacts created with brief descriptions
- Verification result: "Phase 3 verification passed (≥90%). Inline deep review completed."
- What's ready: "All artifacts created and verified! Ready for implementation."
- Prompt: "告知我即可开始执行任务。"

**Artifact Creation Guidelines**

- Follow the \`instruction\` field from \`venus spec instructions\` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use \`template\` as the structure for your output file - fill in its sections
- **IMPORTANT**: \`context\` and \`rules\` are constraints for YOU, not content for the file
  - Do NOT copy \`<context>\`, \`<rules>\`, \`<project_context>\` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Task Type Labels (for tasks.md generation):**
- Each task MUST include a type label: \`- [ ] [代码] N.M ...\` or \`- [ ] [DB脚本] N.M ...\` etc.
- Supplement tasks (non-\`[代码]\`) MUST include \`产出:\` field as indented content
- Default output path: \`attachments/<filename>\` (relative to changeRoot)
- See \`schemas/spec-driven/templates/tasks.md\` template for full label reference

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's \`apply.requires\`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, mark as **[待确认]** and ask the user. Never guess!
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next`,
    };
}

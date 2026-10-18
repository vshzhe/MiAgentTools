/**
 * spec 类型技能模板：归档变更。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { CODEGRAPH_MCP, skillDelegation } from '../tool-whitelist.js';

export function getSpecArchiveChangeSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_archive',
        description: '归档变更。当用户要归档已实现完成的变更、结束变更工作流时使用；触发词"归档 / archive / 结束变更"；NOT for 一次归档多个变更（改用 iagent_spec_bulk_archive）。',
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(ls:*), ${CODEGRAPH_MCP}, ${skillDelegation(['requirement_doc'])}`,
        type: 'spec',
        instructions: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

在变更工作流中归档一个已完成的变更。

**Input**: 可选指定变更名；省略时检查能否从对话上下文推断。若含糊或有歧义，MUST 提示可用变更供用户选择。工作流也可能为自动执行直接传入变更名。

**Steps**

1. **未提供变更名时提示选择**

   若已提供变更名（来自 workflow 自动归档上下文），跳过选择提示，直接进入 Step 2（制品完成度检查）。

   否则运行 \`iagent spec status --json\` 获取可用变更，用 **AskUserQuestion tool** 让用户选择。

   只展示活动变更（尚未归档的）。
   可用时附带每个变更使用的 schema。

   **IMPORTANT**：不得猜测或自动选择变更。仅当变更名由工作流上下文显式提供时才跳过选择。

2. **检查制品完成状态**

   运行 \`iagent spec status --change "<name>" --json\` 检查制品完成度。

   解析 JSON 以了解：
   - \`schemaName\`：正在使用的工作流
   - \`planningHome\`、\`changeRoot\`、\`artifactPaths\` 与 \`actionContext\`：路径与范围上下文
   - \`artifacts\`：制品清单及其状态（\`done\` 或其他）

   若状态报告 \`actionContext.mode: "workspace-planning"\`，说明本切片不支持工作区归档并 STOP。不得把工作区变更移入仓库内归档目录，也不得编辑关联仓库。

   **若有制品状态不是 \`done\`：**
   - 展示告警并列出未完成的制品
   - 直接继续归档 —— 不提示确认（告警仅供参考）

3. **检查任务完成状态**

   读取任务文件（通常为 \`tasks.md\`）以检查未完成任务。

   统计标记为 \`- [ ]\`（未完成）与 \`- [x]\`（已完成）的任务数。

   **若发现未完成任务：**
   - 展示告警并给出未完成任务数
   - 直接继续归档 —— 不提示确认（告警仅供参考）

   **若不存在任务文件：** 继续，不做任务相关告警。

4. **评估 delta spec 同步状态并执行 AI 合并**

   **Markdown 源**：读取 \`<changeRoot>/specs/<capability>/spec.md\` 下的每个 delta spec 并直接应用其操作。按章节标题 \`## ADDED Requirements\` / \`## MODIFIED Requirements\` / \`## REMOVED Requirements\` / \`## RENAMED Requirements\` 对操作分类；REMOVED 携带 Reason/Migration，RENAMED 携带 FROM/TO。不得读取 JSON 镜像。

   **历史 JSON 降级（WARN）**：若 delta spec Markdown 缺失、只存在历史 \`change.json\`，记录 WARN（"delta spec Markdown 缺失 —— 降级到历史 JSON 的 specs 段"）并只读其 \`specs\` 段。主 Markdown 路径把每个 delta spec（\`specs/<capability>/spec.md\`）与主规格 \`openspec/specs/<capability>/spec.md\` 比对，并按类型分类操作：
     - **ADDED**：delta 中新增、主规格中不存在的需求/Scenario
     - **MODIFIED**：delta 中文本/细节已变更的需求或 Scenario
     - **REMOVED**：delta 中已删除的需求/Scenario
     - **RENAMED**：delta 中已改名的需求标识

   **若两个来源都没有 delta spec**：不做同步继续。

   **若存在 delta spec：**
   - 展示将要应用的合并摘要（ADDED/MODIFIED/REMOVED/RENAMED 各自计数）
   - 直接执行 AI 合并 —— 不提示同步选项（"Sync now" 即默认行为）
   - **内联 AI 合并流程**（不单独调用技能）：对每个 capability，把操作直接应用到主规格 \`openspec/specs/<capability>/spec.md\`：
     - ADDED → 在主规格的正确章节追加新需求（描述 + Scenario）
     - MODIFIED → 在主规格中就地替换对应的需求/Scenario
     - REMOVED → 从主规格中删除对应需求（\`reason\` / \`migration\` 值可在归档摘要中引用）
     - RENAMED → 更新主规格中的需求标识及所有交叉引用
   - 冲突解决与章节放置遵循 v1.1.20 specs-apply 合并语义
   - 记录日志："delta specs 已合并 —— 应用 <N> 个操作（A 新增 / M 修改 / R 删除 / N 重命名）"（附加 \`[source: delta spec Markdown]\` 或 \`[source: legacy JSON fallback]\` 以便追溯）

   **若已同步**：跳过同步并继续归档。

   **若同步失败**：记录告警并继续归档（非阻塞）。

4.5 **归档前 CONTEXT.md 同步（强制检查点）**

   **⚠️ 强制：归档前 MUST 检查 CONTEXT.md**

   归档前，系统 MUST 校验 CONTEXT.md 已包含全部变更相关术语：

   1. **检查 \`openspec/CONTEXT.md\` 是否存在**（用 Glob 或 Read 工具）

   2. **若已存在**：读取 CONTEXT.md，并扫描变更目录中应被记录的术语
      - 读取 \`proposal.md\` 获取关键领域术语（历史 JSON-only 降级时只读 change.json）
      - 读取 \`design.md\` 获取技术术语与决策（历史 JSON-only 降级时只读 change.json）
      - 与 CONTEXT.md 交叉比对 —— 若有术语缺失则自动补全
      - 记录日志："CONTEXT.md 已同步 —— 新增 <N> 个术语"

   3. **若不存在**：用变更中的关键术语创建 \`openspec/CONTEXT.md\`
      - 从 \`proposal.md\` 的 Why 提取领域术语
      - 从 \`design.md\` 的 Decisions 提取技术术语
      - 格式：\`**<Term>**: <definition>\\n_Avoid_: <synonyms>\`
      - 记录日志："CONTEXT.md 已创建 —— 来自变更制品的 <N> 个术语"

   4. **兼容性检查**：若变更既无 Markdown 制品也无历史 JSON，跳过并记录日志：
      "跳过 CONTEXT.md 同步：未找到变更制品"

   **强制检查点**：
   - 系统 MUST 在执行归档前完成 CONTEXT.md 检查
   - CONTEXT.md 缺失时，从变更制品自动创建
   - 不得因检查失败而阻塞归档 —— 记录日志并继续

4.6 **归档前 CodeGraph 状态检查（强制检查点）**

   **⚠️ 强制：归档前 MUST 检查 CodeGraph 状态**

   归档前，用「状态优先」的方式检测项目是否启用了 CodeGraph：

   1. **运行 \`codegraph status\`（经 Bash）作为唯一检测步骤** —— 不得用 Glob 预先检查 \`.codegraph/\` 目录是否存在（点号开头的目录会返回假阴性，导致 CodeGraph 被误判为未初始化）
   2. **若调用成功**：CodeGraph 已初始化且索引健康 —— 记录该调用报告的当前索引统计（文件/节点数），继续归档
   3. **若调用失败**（codegraph CLI 不在 PATH —— 命令未找到类错误 —— 或其他任何错误，含 CodeGraph 未初始化）：自动跳过**全部** CodeGraph 步骤（本 4.6 检查与 6.5 同步），记录 WARN 说明 codegraph CLI 不可用且已跳过同步，继续归档 —— 不得询问用户是否重试或继续

   **强制检查点**：
   - 系统 MUST 在执行归档前完成 CodeGraph 状态检查
   - CodeGraph 未初始化时，跳过**全部** CodeGraph 步骤（本 4.6 检查 + 6.5 同步）
   - codegraph CLI 不可用或状态检查失败时，自动跳过**全部** CodeGraph 步骤并记录 WARN —— 绝不询问用户
   - 不得因检查失败而阻塞归档 —— 记录日志并继续
   - 与 4.5 的 CONTEXT.md 检查点理念保持一致

4.7 **归档前探索记忆同步（强制检查点）**

   **⚠️ 强制：归档前 MUST 把探索记忆同步到能力规格**

   在 delta spec 同步评估之后、把变更目录移入归档**之前**执行：

   1. **检查变更目录中的探索文件**（\`exploration.md\`）
      - 缺失时：记录日志"跳过探索记忆同步：无探索文件"，并跳过本检查点

   2. **确定能力归属**
      - 从 \`specs/<capability>/\` 子目录枚举能力（历史 JSON-only 降级时只读 change.json 的 specs 段）
      - 若变更没有 delta spec：无法确定能力归属 —— 记录日志"跳过探索记忆同步：无 delta spec"并跳过

   3. **对每个涉及的能力 \`<capability>\`**：
      - 目标文件：\`openspec/specs/<capability>/explorations.md\`（用 \`path.join()\`）
      - 文件不存在时：创建它，并写一句简短说明，指出该文件承载此能力的累积探索记忆
      - 从变更的 exploration.md 提取关键记忆：Decisions、术语表、边界场景、Codebase Findings 要点 —— 不得复制过程性内容（逐题问答、Decision Process）
      - 追加新章节 \`## <change-name>（归档日期 YYYY-MM-DD）\`，写入提取出的记忆
      - 若新决策与同一文件中先前变更的决策冲突：用 \`> 已过时（由 <change-name> 取代）\` 标记过时章节 —— 不得删除历史内容

   4. **失败处理（非阻塞）**：
      - 若记忆同步失败（如目标目录不可写）：记录告警，不阻塞归档

   **强制检查点**：
   - 系统 MUST 在移动变更目录前完成探索记忆同步
   - 变更的 exploration.md 仍随变更一起移入归档目录（提取是复制，不是移动）
   - 不得因同步失败而阻塞归档 —— 记录日志并继续

4.8 **归档前需求文档检查点（强制检查点）**

   **⚠️ 强制：确保需求文档在归档移动之前就已存在并对齐**

   在探索记忆同步（4.7）之后、移动变更目录（5）**之前**执行。理由：需求文档现在在提案验证阶段生成（各工作流管线的 Phase 3 / Stage 2）。本检查点确保归档的文档与**最终**制品对齐 —— 新流程变更在验证阶段就已拿到文档，只需对齐；历史变更（在"验证阶段生成"规则之前创建的）仍在此处生成文档，以保持后向兼容。

   **决策范围**：仅 \`openspec/changes/<change-name>/需求文档.md\`（用 \`path.join()\` 构建）。

   1. **若变更目录不可读**（IO 错误）：记录 WARN，视为文档不存在 —— 进入分支 2
   2. **分支 A —— 文档不存在**：以**非交互模式**委派 \`iagent_requirement_doc\` 技能并传入变更名 —— 不向用户提问，基本信息用占位符；文档写入 \`openspec/changes/<change-name>/需求文档.md\`
   3. **分支 B —— 文档已存在**（例如先独立运行生成、之后有人手工补充）：对该文件执行 **in-place（就地）增量对齐更新**。\`## 基本信息\`（需求编号 / 需求名称 / 交付时间，含占位符状态）与 \`## 八、评审记录\` 属**人工域**，MUST NOT 覆盖 —— 逐字保留；\`一~七\` 章节 SHALL 从**当前** Markdown 源（\`proposal.md\` / \`design.md\` / \`specs/**/*.md\` / \`tasks.md\`）重新推导。本分支**不得调用 \`iagent_requirement_doc\`** —— 该技能自身规则是"目标文件已存在时静默覆盖"，会抹掉人工撰写的评审内容。对齐 MUST NOT 删除章节（仅可丢弃制品中已移除的内容）；若文档结构已损坏，重建缺失章节并记录 WARN
   4. **失败处理（非阻塞）**：若生成或对齐失败，记录 WARN（含目标路径与原因），然后继续归档 —— 绝不因本检查点阻塞归档

   **强制检查点**：
   - 系统 MUST 在移动变更目录前完成需求文档检查点
   - 生成的文档留在变更目录内并随其移动；随后既有 Step 6 会把它迁移到 \`openspec/devdocs/\`
   - 不得因生成或对齐失败而阻塞归档 —— 记录日志并继续

5. **执行归档**

   运行 iagent CLI 归档命令 —— 它一步完成状态检查与目录移动：
   \`\`\`bash
   iagent spec archive "<name>" --yes
   \`\`\`

   若 \`openspec/changes/\` 下不存在 \`archive\` 目录则创建它，生成带日期的目标名 \`YYYY-MM-DD-<change-name>\`，并把 \`changeRoot\` 移动到 \`openspec/changes/archive/YYYY-MM-DD-<name>/\`。

   **若命令因目标归档目录已存在而失败**：报告该错误，并建议重命名既有归档、若为重复则删除、或改到另一个日期。不得覆盖。

   保留 \`.openspec.yaml\` 与 \`attachments/\` 子目录 —— 它们会随变更目录自动移动。

6. **把需求文档移入 devdocs（若存在）**

   变更目录移入归档后，检查归档后的变更是否含已生成的需求文档：

   \`\`\`bash
   ls "openspec/changes/archive/YYYY-MM-DD-<name>/需求文档.md"
   \`\`\`

   - **若文件存在**：把它移动到 \`openspec/devdocs/YYYY-MM-DD-<change-name>-需求文档.md\`
     - \`YYYY-MM-DD\` 前缀取自同一归档目录名（与归档命令的目录命名逻辑一致）
     - 若归档目录名不含可解析的 \`YYYY-MM-DD-\` 前缀，降级为不带时间戳的 \`openspec/devdocs/<change-name>-需求文档.md\`
     - devdocs 目录不存在则创建（用 \`path.join()\`）；目标已存在则覆盖
   - **若文件不存在**：静默跳过本步骤 —— 不报错、不告警，继续归档流程

6.5 **归档后 CodeGraph 同步 + 验证（条件执行）**

   **仅当 Step 4.6 确认 CodeGraph 已启用时才执行。** 若 Step 4.6 被跳过（CodeGraph 未初始化），整体跳过本步骤。

   1. **同步 CodeGraph 知识图谱**，纳入刚归档变更已实现的代码：
      - 运行 \`codegraph sync\`（经 Bash）增量索引新实现的代码
      - 运行前展示 "CodeGraph：正在同步已实现的代码..."
      - 完成后记录同步结果

   2. 同步成功后**验证一致性**：
      - 用 MCP \`codegraph_search\` 查询变更名，以及变更 \`tasks.md\` 与 \`design.md\` 中提到的关键符号
      - 确认已实现的符号现已被索引
      - 展示 "CodeGraph：✓ 索引中已校验 N 个符号"，无匹配时告警
      - 若未找到符号（如仅配置或仅文档变更），记录告警 —— 不要视为失败

   3. **失败处理**（非阻塞）：
      - \`codegraph sync\` 失败（CLI 错误、超时或 CLI 不在 PATH）：记录告警，不阻塞归档
      - 验证查询失败或返回空：记录告警，不阻塞归档
      - CodeGraph 同步独立于 \`--skip-specs\` / \`--no-validate\` / 跳过校验的选择执行

7. **更新或创建 ARCHIVE-INDEX.md**

   **IMPORTANT**：workspace 范围的变更（actionContext.mode: "workspace-planning"）跳过本步骤。

   归档索引文件位于 \`openspec/changes/archive/ARCHIVE-INDEX.md\`。

   **文件不存在时创建它**：
<!-- CMD:SKIP -->
   \`\`\`markdown
   # OpenSpec 变更归档索引

   > 本文档记录所有已归档的变更提案，便于历史追溯和查阅

   ---

   ## 归档变更列表

   | 归档日期 | 变更名称 | 所属模块 | 主要内容 |
   |----------|----------|----------|----------|
   | YYYY-MM-DD | change-name | module | description |

   ---

   ## 模块统计

   | 模块 | 归档数量 | 变更列表 |
   |------|----------|----------|

   ---

   *更新时间: YYYY-MM-DD*
   \`\`\`
<!-- /CMD:SKIP -->

   **文件已存在时追加新条目**：
<!-- CMD:SKIP -->

   a. 提取条目信息：
      - **归档日期**：取自归档目录名 \`YYYY-MM-DD-{change-name}\`
      - **变更名称**：取自目录名（日期前缀之后）
      - **模块**：从变更名模式 \`{prefix}-{module}-{feature}\` 提取，无法判断时用 "general"
      - **摘要**：\`proposal.md\` Why 的首段（历史 JSON-only 降级时只读 change.json；最多 50 字符）
      - **补充标注**：读取变更目录中的 \`tasks.md\`（历史 JSON-only 降级时只读 tasks.json），通过**匹配固定标签白名单**收集补充任务类型 \`[测试]\` / \`[DB脚本]\` / \`[使用说明]\`（排除 \`[代码]\`），并把 \`[含<type1>/<type2>/...]\` 追加到摘要（如 \`[含测试/DB脚本]\`）。只按白名单匹配 —— 不得收集"所有方括号内容"：\`[测试]\` 任务带层级/优先级子标注（\`[测试][单元][P0]\`），其中 \`[单元]\`/\`[P0]\` 不是任务类型，收集它们会产生 \`[含测试/单元/P0]\` 噪声。白名单之外的标签一律忽略（非阻塞；MAY 记录 WARN）。若无补充任务，跳过标注。

   b. 向 "归档变更列表" 表新增一行：
      \`| {date} | {change-name} | {module} | {summary} |\`

   c. 更新 "模块统计" 表：
      - 已有模块计数 +1
      - 新模块新增一行（计数：1）

   d. 把页脚时间戳更新为当前日期
<!-- /CMD:SKIP -->

   **跨平台说明**：Windows 上用 \`path.join()\` 构建路径。检查文件是否存在时注意大小写敏感性差异。

8. **展示摘要**

   展示归档完成摘要，包含：
   - 变更名称
   - 使用的 Schema
   - 归档位置
   - 规格是否已同步（如适用）
   - 归档索引更新状态
   - CodeGraph 同步状态（已同步 / 跳过 —— 未初始化或出错）
   - 探索记忆同步状态（已同步 / 跳过 —— 无探索文件或无 delta spec / 失败 —— 已记录告警）
   - 需求文档状态（就地已对齐 / 后向兼容已生成 / 失败 —— 已记录带原因的告警）
   - 关于任何告警的说明（未完成的制品/任务）

**Output（成功）**

\`\`\`
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync failed — warning logged" or "主规格未同步（skip_specs 声明）")
**Archive Index:** ✓ Updated ARCHIVE-INDEX.md
**Exploration Memory:** ✓ Synced to specs/<capability>/explorations.md (or "Skipped — no exploration file" or "Skipped — no delta specs" or "Failed — warning logged")
**Requirement Document:** ✓ Generated → openspec/devdocs/YYYY-MM-DD-<name>-需求文档.md (or "✓ Aligned in place (人工域 preserved)" or "Failed — warning logged: <reason>")
**CodeGraph:** ✓ Synced (or "Not initialized — skipped" or "Sync skipped due to error")

All artifacts complete. All tasks complete.
\`\`\`

<!-- CMD:SKIP -->
**Output（成功但含告警）**

\`\`\`
## Archive Complete (with warnings)

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs

**Warnings:**
- Archived with 2 incomplete artifacts
- Archived with 3 incomplete tasks

Review the archive if this was not intentional.
\`\`\`

**Output（出错：归档已存在）**

\`\`\`
## Archive Failed

**Change:** <change-name>
**Target:** openspec/changes/archive/YYYY-MM-DD-<name>/

Target archive directory already exists.

**Options:**
1. Rename the existing archive
2. Delete the existing archive if it's a duplicate
3. Wait until a different date to archive
\`\`\`
<!-- /CMD:SKIP -->

**Guardrails**
- 未提供变更时始终提示选择（除非变更名由工作流上下文显式传入）
- 用制品图（iagent spec status --json）做完成度检查
- 不要因告警阻塞归档 —— 仅告知（无需确认）
- 移入归档时保留 .openspec.yaml（它随目录一起移动）
- 保留 \`attachments/\` 子目录 —— 它随变更目录自动移动
- 为 ARCHIVE-INDEX.md 提取摘要时，扫描 \`tasks.md\` 的补充类型标签，并把 \`[含xxx]\` 标注追加到摘要
- 归档移动前，为每个涉及的能力把探索记忆同步到 specs/<capability>/explorations.md；exploration.md 或 delta spec 缺失时跳过（并记日志）；绝不因同步失败阻塞归档
从**最终**制品确保预归档检查点（4.8）的需求文档：已存在 → 就地增量对齐并保留人工域；不存在 → 以非交互方式委派 iagent_requirement_doc（对历史变更后向兼容）（\`## 基本信息\` / \`## 八、评审记录\`），且该分支绝不调用该技能；绝不因生成或对齐失败阻塞归档
- 当变更声明 \`skip_specs\`（状态报告 specs 为 skipped）时，归档摘要 MUST 注明 "主规格未同步（skip_specs 声明）"，避免用户误以为规格同步被遗漏
- 清晰展示发生了什么
- 若存在 delta spec，执行同步评估、展示合并摘要，并直接执行内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED → 主规格，遵循 v1.1.20 specs-apply 语义）

## 归档后索引同步（SQLite）

归档移动（Step 5）与 CodeGraph 同步（Step 6.5）之后，MUST 重建 SQLite 跨变更索引：

1. **MUST 运行**：\`Bash(iagent spec reindex --force)\` —— 从所有已归档变更重建完整索引
2. 成功时：报告 "SQLite 索引已重建 —— 已索引 N 个变更"
3. 失败时：记录 WARN 及错误原因并继续（非阻塞）；之后可用同一命令重建索引`,
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）与 CodeGraph CLI（可选）。',
        metadata: { author: 'mi-agent-tools' },
    };
}

export function getSpecArchiveChangeCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 归档变更',
        description: '归档变更 —— 归档已实现完成的变更并同步主规格与知识图谱',
        category: 'iAgent / 规格',
        tags: ['iagent', 'spec', 'archive'],
        content: deriveCommandContent(getSpecArchiveChangeSkillTemplate().instructions),
    };
}

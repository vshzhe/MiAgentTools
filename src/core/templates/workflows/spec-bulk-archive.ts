/**
 * spec 类型技能模板：批量归档变更。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { CODEGRAPH_CLI, CODEGRAPH_MCP, SUBAGENT_DISPATCH } from '../tool-whitelist.js';
import { CODEGRAPH_LOCK_LADDER, renderCodegraphProbeOrder } from '../codegraph-protocol.js';
import { renderGateWhitelistSection } from '../prompt-gate.js';

export function getSpecBulkArchiveSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_bulk_archive',
        description: '批量归档变更。当用户要一次归档多个已完成变更时使用；触发词"批量归档 / bulk archive / 归档多个"；NOT for 单个变更归档（改用 iagent_spec_archive）。',
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), ${CODEGRAPH_CLI}, ${CODEGRAPH_MCP}, Bash(node:*), ${SUBAGENT_DISPATCH}`,
        type: 'spec',
        instructions: `**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

在单次操作中归档多个已完成变更。

本技能支持批量归档变更，并通过检查代码库判断实际已实现的内容，从而智能处理规格冲突。

${renderGateWhitelistSection()}

**Input**: 无需参数（会提示选择）

**Steps**

1. **获取活动变更**

   运行 \`iagent spec status --json\`（不带 \`--change\` 参数）获取全部活动变更。输出含一个 \`changes\` 数组，列出每个活动变更。

   若无活动变更，告知用户并停止。

   **CLI 可用性检测（首次调用失败特征）**：若 \`iagent spec status --json\` 调用（或 Step 3 中的 \`iagent spec status --change\` 调用）以"命令未找到"类错误失败（如 "command not found"、"不是内部或外部命令"、"not recognized"），判定 iagent CLI 未安装。用一行告知用户 ——"未在 PATH 中找到 iagent CLI，以 CLI 降级模式继续"—— 并以 CLI 降级模式继续（流程中不再重复该提示）：
   - **降级变更发现**：用 Glob 扫描 \`openspec/changes/*/\`（排除 \`archive/\`）发现候选变更；仍让用户通过 **AskUserQuestion tool** 选择
   - **降级制品状态推断**：按 \`proposal.md\` / \`design.md\` / \`specs/**/*.md\` / \`tasks.md\` 文件是否存在推断制品完成度 —— 不做 CLI 校验；批量归档本身（目录移动、规格同步、归档索引更新）照常进行
   - 其他错误（如 JSON 解析失败）：报告错误并停止 —— 不得进入降级模式
   - 流程结束时，恰好提醒用户一次：本次运行使用了 CLI 降级模式，建议安装 iagent CLI 以获得校验与构建顺序保证

2. **提示选择变更**

   用 **AskUserQuestion tool** 多选让用户选择变更：
   - 展示每个变更及其 schema
   - 提供 "All changes"（全部变更）选项
   - 允许选择任意数量（1 个即可，2 个以上是典型用法）

   **IMPORTANT**：不得自动选择。始终让用户选择。

2.5 **批量归档前的 CodeGraph 能力探测**

   批量校验前按能力探测顺序判定 CodeGraph 是否可用（任一通道成功即视为可用）：

   ${renderCodegraphProbeOrder({ withCli: true })}

   ${CODEGRAPH_LOCK_LADDER}

   **注意**：CodeGraph 同步是项目粒度的，不是按变更的。整批在所有变更归档后只运行一次同步（Step 11）；daemon 活跃时只读复用、不显式同步。

   **探测结论分支**：
   - 任一通道成功 → 记录该调用报告的当前索引统计（文件/节点数）以备后续对比，继续批量校验
   - 三条通道全部失败 → 为整批自动跳过**全部** CodeGraph 步骤（本 2.5 检查与 Step 11 同步），记录 WARN 说明当前不可用且已跳过，继续批量归档 —— 不得询问用户是否重试或继续
   - 锁冲突 / 状态读取失败：按上面的锁阶梯处置（存活只读复用；不存活 unlock 一次 + 重试一次；仍失败降级 Glob/Grep + WARN），MUST NOT 因单次探测失败而放弃整批能力

3. **批量校验 —— 收集所有已选变更的状态**

   对每个已选变更收集：

   a. **制品状态** - 运行 \`iagent spec status --change "<name>" --json\`
      - 解析 \`schemaName\`、\`artifacts\`、\`planningHome\`、\`changeRoot\` 与 \`artifactPaths\`
      - 记录哪些制品为 \`done\`、哪些为其他状态（\`optional\` 为可选制品缺失，不构成未完成）

   b. **任务完成度** - 从状态 JSON 读取 \`artifactPaths.tasks.existingOutputPaths\`
      - 统计 \`- [ ]\`（未完成）与 \`- [x]\`（已完成）
      - 若不存在任务文件，记作 "No tasks"

   c. **Delta specs** - 从状态 JSON 检查 \`artifactPaths.specs.existingOutputPaths\`
      - 列出存在哪些能力规格
      - 对每个规格提取需求名（匹配 \`### Requirement: <name>\` 的行）

   d. **并行校验派发（多变更、只读）**：
      - 选中 2 个以上变更且运行时支持子代理派发时：为每个变更派发一个只读校验子代理（Task 工具，同时最多 3 个）—— 每个子代理为其负责的变更收集 a-c 三项；子代理只读文件、只跑状态查询，绝不写入
      - 所有子代理返回后，把各变更的结果合并进统一状态表
      - 单变更批或无子代理能力：串行收集状态（既有行为）；若环境无法派发子代理，告知用户已降级为串行
      - 子代理失败时：由主代理串行收集该变更的状态（绝不阻塞整批）

4. **检测规格冲突**

   构建 \`capability -> [changes that touch it]\` 映射：

   \`\`\`
   auth -> [change-a, change-b]  <- CONFLICT (2+ changes)
   api  -> [change-c]            <- OK (only 1 change)
   \`\`\`

   当 2 个以上已选变更为同一 capability 提供 delta spec 时，即存在冲突。

5. **以代理方式解决冲突**

   **对每个冲突**，调查代码库：

   a. **读取 delta spec**（每个冲突变更的），了解各自声称新增/修改了什么

   b. **搜索代码库**寻找实现证据：
      - 查找实现各 delta spec 中需求的代码
      - 检查相关文件、函数或测试

   c. **判定解决方案**：
      - 若只有一个变更真正实现 -> 只同步该变更的规格
      - 若两者都已实现 -> 按时间顺序应用（旧者先，新者覆盖）
      - 若两者都未实现 -> 跳过规格同步，告警用户

   d. **记录解决方案**（每个冲突）：
      - 要应用哪个变更的规格
      - 顺序（若两者都应用）
      - 依据（代码库中发现了什么）

   **并行冲突调查**：检测到 2 个以上相互独立的冲突且可派发子代理时，为每个冲突并行派发一个只读调查子代理（各自读取冲突的 delta spec 并收集代码库证据，绝不写入）；主代理把所有解决方案合并进执行计划。子代理失败时：由主代理串行调查该冲突。

6. **展示统一状态表**

   展示汇总所有变更的表格：

   \`\`\`
   | Change              | Artifacts | Tasks | Specs   | Conflicts | Status |
   |---------------------|-----------|-------|---------|-----------|--------|
   | schema-management   | Done      | 5/5   | 2 delta | None      | Ready  |
   | project-config      | Done      | 3/3   | 1 delta | None      | Ready  |
   | add-oauth           | Done      | 4/4   | 1 delta | auth (!)  | Ready* |
   | add-verify-skill    | 1 left    | 2/5   | None    | None      | Warn   |
   \`\`\`

   存在冲突时，展示解决方案：
   \`\`\`
   * Conflict resolution:
     - auth spec: Will apply add-oauth then add-jwt (both implemented, chronological order)
   \`\`\`

   存在未完成变更时，展示告警：
   \`\`\`
   Warnings:
   - add-verify-skill: 1 incomplete artifact, 3 incomplete tasks
   \`\`\`

7. **进入批量执行**

   展示统一状态表后直接进入批量执行 —— 不提示批量确认（Step 2 的多选即用户对范围的显式决定）。

   若存在未完成变更，在状态表中说明它们将带告警归档（告警仅供参考，绝不是跳过已选变更的理由）。

8. **对每个已选变更执行归档（三阶段分层并行）**

   **执行分组** —— 派发前，按 Step 4 的冲突检测结果对已选变更分组：
   - 无共享 capability 的变更构成并行组 —— 组内每个变更作为一个完整归档派发单元由单个子代理执行（下方 a → a.5 → a.6 → b → b.5 → c 序列）
   - 共享同一 capability 的变更构成串行链，按已解决的（时间）顺序执行
   - 同时最多 3 个归档子代理（固定上限，无配置项）
   - 只选中一个变更：不派发、直接执行（等同于既有的串行行为）
   - 所有变更共享同一 capability：分组结果为单条串行链 —— 串行执行（既有行为）
   - 运行时无子代理能力：降级为串行执行所有变更，并告知用户已降级
   - 子代理 MUST NOT 更新任何归档索引文件（根入口 \`ARCHIVE-INDEX.md\` 与月度 \`ARCHIVE-INDEX-YYYY-MM.md\`），MUST NOT 运行 \`codegraph sync\` —— 二者仍是主代理的单点操作（Step 10 与 Step 11）
   - **失败隔离**：某变更失败时（含子代理失败或超时），记录 WARN 并**继续**处理剩余变更 —— 绝不中止整批；当失败的变更位于同 capability 串行链的前序位置时，后续变更仍执行（每个变更独立合并进主规格）
   - 子代理派发指令 MUST 内嵌下方完整的归档检查点文本（与主代理串行版同源）

   每个归档派发单元对其变更按以下序列执行（串行，按任务顺序）：

   a. **同步规格**（存在 delta spec 时；内联 AI 合并，不单独调用技能）：
      - **Markdown 源**：读取 \`<changeRoot>/specs/<capability>/spec.md\` 下的每个 delta spec，并将其操作直接应用到主规格 \`openspec/specs/<capability>/spec.md\`。按 \`## ADDED/MODIFIED/REMOVED/RENAMED Requirements\` 对操作分类；不得读取 JSON 镜像。
      - **历史 JSON 降级（WARN）**：若 delta spec Markdown 缺失、只存在历史 \`change.json\`，记录 WARN（"delta spec Markdown 缺失 —— 降级到历史 JSON 的 specs 段"）并只读其 \`specs\` 段；否则不做同步继续。主 Markdown 路径把每个 delta spec 与主规格 \`openspec/specs/<capability>/spec.md\` 比对，并按类型分类操作：
        - **ADDED**：delta 中新增、主规格中不存在的需求/Scenario
        - **MODIFIED**：delta 中文本/细节已变更的需求或 Scenario
        - **REMOVED**：delta 中已删除的需求/Scenario
        - **RENAMED**：delta 中已改名的需求标识
      - 若两个来源都没有 delta spec：不做同步继续
      - 展示将要应用的合并摘要（ADDED/MODIFIED/REMOVED/RENAMED 各自计数）
      - 直接执行 AI 合并（不提示同步选项）
      - **内联 AI 合并流程**：对每个 capability，把操作直接应用到主规格 \`openspec/specs/<capability>/spec.md\`：
        - ADDED → 在主规格的正确章节追加新需求（描述 + Scenario）
        - MODIFIED → 在主规格中就地替换对应的需求/Scenario；**目标需求标识在主 spec 中缺失**时按 ADDED 追加该需求（描述 + Scenario），并在该变更摘要中列出「MODIFIED 目标缺失（已追加）」告警后继续归档 —— MUST NOT 中止该变更单元或整批、MUST NOT 丢弃该需求
        - REMOVED → 从主规格中删除对应需求（\`reason\` / \`migration\` 值可在归档摘要中引用）
        - RENAMED → 更新主规格中的需求标识及所有交叉引用
      - 冲突解决与章节放置遵循 v1.1.20 specs-apply 合并语义
      - 存在冲突时，按已解决的顺序应用（Step 5 的解决方案）
      - 记录日志："delta specs 已合并 —— 应用 <N> 个操作（A 新增 / M 修改 / R 删除 / N 重命名）"（附加 \`[source: delta spec Markdown]\` 或 \`[source: legacy JSON fallback]\` 以便追溯）
      - 记录同步是否已执行

   a.5 **CONTEXT.md 同步（强制检查点，归档前）**：
      - **检查 \`openspec/CONTEXT.md\` 是否存在**（用 Glob 或 Read 工具）
      - **取词口径（收窄）**：只同步该变更 \`exploration.md\` 术语表中已确认的术语；MUST NOT 从 \`proposal.md\` / \`design.md\` / \`specs/**\` 正文反向抽取
      - **写入前 MUST 先读** \`openspec/CONTEXT.md\` 现有内容；同名术语已存在且定义不一致时 MUST 显式裁决（更新定义，或保留旧定义并标注「已过时（由 <change-name> 取代）」）；MUST NOT 静默追加第二条同义条目
      - **若已存在**：与 CONTEXT.md 交叉比对，术语表中缺失的术语自动补全；记录日志："CONTEXT.md 已同步 —— 新增 <N> 个术语"
      - **若 \`openspec/CONTEXT.md\` 不存在**：仅用 \`exploration.md\` 术语表创建 \`openspec/CONTEXT.md\`（MUST NOT 从制品正文创建）；格式：\`**<Term>**: <definition>\\\\n_Avoid_: <synonyms>\`；记录日志："CONTEXT.md 已创建 —— 来自 exploration.md 术语表的 <N> 个术语"
      - **并行写入串行化（强制）**：本步的「读取 → 比对 → 写入」三步 SHALL 串行化（同一批次锁或排队），MUST NOT 与其他并行单元的 a.5 并发写同一文件（MUST NOT 并发写同一文件导致丢失更新）
      - **缺失处置**：\`exploration.md\` 或术语表缺失时跳过并记录 WARN，MUST NOT 猜测补词
      - **失败处理（非阻塞）**：不得因检查失败而阻塞归档 —— 记录日志并继续

   a.6 **（已移除）**：
      需求文档桥与只读报告已随 \`skill-bridge-optimize\` 整体移除；本技能不再读取、报告、生成、对齐或迁出 \`需求文档.md\`。文件随变更目录原样移动。

   b. **执行归档**：
      运行 iagent CLI 归档命令 —— 它一步完成状态检查与目录移动：
      \`\`\`bash
      iagent spec archive "<name>" --yes
      \`\`\`
      若 \`openspec/changes/\` 下不存在 \`archive\` 目录则创建它，生成带日期的目标名 \`YYYY-MM-DD-<change-name>\`，并把 \`changeRoot\` 移动到 \`openspec/changes/archive/YYYY-MM-DD-<name>/\`。保留 \`.openspec.yaml\` 与 \`attachments/\` 子目录 —— 它们会随变更目录自动移动。

      **若命令因目标归档目录已存在而失败**：把该变更标为 Failed，并继续处理批内剩余变更（失败隔离）。不得覆盖。

   b.5 **探索记忆同步**（在 CLI 归档移动完成后从归档目录读取；提取是复制，不是移动）：
      - 检查 \`openspec/changes/archive/YYYY-MM-DD-<name>/exploration.md\` 是否存在（CLI 已移动变更目录；从归档位置读取）
      - 缺失时：为该变更记录日志"跳过探索记忆同步：无探索文件"并继续
      - 从 \`specs/<capability>/\` 子目录枚举能力（历史 JSON-only 降级时只读 change.json 的 specs 段）
      - 若变更没有 delta spec：记录日志"跳过探索记忆同步：无 delta spec"并继续
      - 对每个涉及的能力 \`<capability>\`：
        - 目标文件：\`openspec/specs/<capability>/explorations.md\`（用 \`path.join()\`）
        - 文件不存在时创建，并写入一句用途说明
        - 提取关键记忆（Decisions、术语表、边界场景、Codebase Findings 要点 —— 不含过程性内容）
        - 追加 \`## <change-name>（归档日期 YYYY-MM-DD）\` 章节
        - 若新决策与先前章节冲突：用 \`> 已过时（由 <change-name> 取代）\` 标记过时章节，而不是删除
      - 某变更同步失败时：记录 WARN 并**继续**处理剩余变更（绝不中止整批）

   c. **归档只读校验 + 流程级工作区清理**（每个变更，位于结果记录之前）：
      - **只读校验**：确认本单元未改写 \`openspec/changes/archive/**\` 下的既有内容（本单元自身的整目录移动、月度索引追加与根入口月份链接/全局统计更新除外），亦未向 \`openspec/devdocs/\` 写入或迁移任何文件；结果记入该变更摘要；发现越界 → 记录含变更名与路径的 WARN 并继续处理剩余变更（MUST NOT 中止整批，MUST NOT 静默忽略）
      - **单元成功后清理流程级工作区**：清理该变更的 \`.openspec-tmp/pipeline-<change-name>/\`（同时识别旧 \`apply-\` 前缀），经 Bash 运行 \`node -e "fs.rmSync(<path>, { recursive: true, force: true })"\` 跨平台删除；清理失败 WARN 且不中止批次；**失败或跳过的单元保留工作区**供诊断（摘要注明保留位置，MUST NOT 删除）

   d. **记录结果**（每个变更）：
      - 成功：已成功归档
      - 失败：归档过程中出错（记录错误）
      - 跳过：用户选择不归档（如适用）

9. **展示摘要**

   主代理汇总所有归档子代理的结果并展示最终摘要（含并行执行统计：并行组数 / 串行链数）：

   展示最终结果：

   \`\`\`
   ## Bulk Archive Complete

   Archived 3 changes:
   - schema-management-cli -> archive/2026-01-19-schema-management-cli/
   - project-config -> archive/2026-01-19-project-config/
   - add-oauth -> archive/2026-01-19-add-oauth/

   Skipped 1 change:
   - add-verify-skill (user chose not to archive incomplete)

   Spec sync summary:
   - 4 delta specs synced to main specs
   - 1 conflict resolved (auth: applied both in chronological order)

   Exploration memory summary:
   - 3 changes synced to capability memory files
   - 1 skipped (no exploration file)

   Archive read-only check:
   - 4 changes passed（无越界写入）
   - 0 warnings

   Pipeline workspace cleanup:
   - 4 cleaned (.openspec-tmp/pipeline-<name>/)
   - 0 retained (no failed/skipped changes)

   Archive index summary:
   - 2026-09: 2 appended to ARCHIVE-INDEX-2026-09.md
   - 2026-10: 1 appended to ARCHIVE-INDEX-2026-10.md
   - Root entry: month links updated, global statistics recomputed

   Parallel execution:
   - 2 parallel groups, 1 serial chain
   \`\`\`

   若有失败：
   \`\`\`
   Failed 1 change:
   - some-change: Archive directory already exists
   \`\`\`

10. **批量归档索引更新（月度纯追加 + 根入口单点维护）**

   归档索引由两部分组成：**根入口** \`openspec/changes/archive/ARCHIVE-INDEX.md\`（月份导航 + 全局模块统计）与**月度索引** \`openspec/changes/archive/ARCHIVE-INDEX-YYYY-MM.md\`（当月条目 + 当月模块统计）。

   所有归档操作完成后（已判定成功/失败/跳过），由主代理执行本次单点更新 —— 绝不交给子代理；子代理 MUST NOT 向任何索引文件写入：

   a. **按月份分组（强制）**：对每个成功归档的变更，月份 MUST 取其归档目录名 \`YYYY-MM-DD-\` 前缀的前 7 位（\`YYYY-MM\`），并按月份分组。MUST NOT 读取本地时间、MUST NOT 做时区换算；目录名不含该前缀时回退为归档日期所在月并输出 WARN。failed/skipped 变更 MUST NOT 入索引，也不得参与统计重算。

   b. **月度索引创建**（每个分组独立判定）：
      该月月度索引不存在时，按标准结构创建它：
      \`\`\`markdown
      # 归档变更索引 YYYY-MM

      > 本文件记录 YYYY-MM 的归档变更，由归档流程纯追加。

      ---

      ## 归档变更列表

      | 归档日期 | 变更名称 | 模块 | 摘要 |
      |---------|---------|------|------|

      ---

      ## 模块统计

      | 模块 | 归档数 | 变更列表 |
      |------|-------|---------|

      ---

      *更新时间: YYYY-MM-DD*
      \`\`\`

   c. **为每个成功归档的变更提取条目信息**：
      - **归档日期**：取自目录名前缀 \`YYYY-MM-DD-{change-name}\`
      - **变更名称**：取自目录名（日期前缀之后）
      - **模块**：从变更名模式 \`{prefix}-{module}-{feature}\` 提取，未匹配时用 "general"
      - **摘要**：\`proposal.md\` Why 的首段（历史 JSON-only 降级时只读 change.json；最多 50 字符）
      - **补充标注**：读取已归档变更目录中的 \`tasks.md\`（历史 JSON-only 降级时只读 tasks.json），通过**匹配固定标签白名单**收集补充任务类型 \`[测试]\` / \`[DB脚本]\` / \`[使用说明]\`（排除 \`[代码]\`），并把 \`[含<type1>/<type2>/...]\` 追加到摘要（如 \`[含测试/DB脚本]\`）。只按白名单匹配 —— 不得收集"所有方括号内容"：\`[测试]\` 任务带层级/优先级子标注（\`[测试][单元][P0]\`），其中 \`[单元]\`/\`[P0]\` 不是任务类型，收集它们会产生 \`[含测试/单元/P0]\` 噪声。白名单之外的标签一律忽略（非阻塞；MAY 记录 WARN）。若无补充任务，跳过标注。

   d. **逐月纯追加（强制）**：对每个月份分组，向该月月度索引「归档变更列表」表末追加各自条目行 \`| {date} | {change-name} | {module} | {summary} |\`，更新该月「模块统计」（已有模块计数 +1 / 新模块新增一行 / 把变更名追加到该模块的变更列表）并把页脚时间戳更新为当前日期 \`YYYY-MM-DD\`。跨月的成功变更 MUST 分别写入各自月度文件。

   e. **根入口维护（强制，单点）**：主代理 SHALL 仅：① 追加缺失的月份链接（已存在则跳过，MUST NOT 出现重复月份行）；② 从全部 \`ARCHIVE-INDEX-*.md\` 月度文件**确定性重算**全局模块统计（MUST NOT 使用增量累加；某月度文件不可解析时跳过该月并记 WARN）。MUST NOT 改写根入口既有条目。根入口缺失但存在月度文件时 SHALL 依据月度文件重建入口（月份导航 + 全局统计）并在批量汇总中报告；根入口损坏时 SHALL 保留原文 + 只补缺失月份链接 + WARN，MUST NOT 重建。

   f. **写入顺序（强制）**：先完成全部月度索引的创建/追加，再单点更新一次根入口（月份链接 + 全局统计）。

   g. **损坏索引文件的处置（强制，纯追加不重建）**：
      - 若月度索引或根入口存在但结构已损坏，尽力解析既有条目并**保留原文**
      - 月度索引：**仅追加本批成功变更的最小条目**（\`| {date} | {change-name} | {module} | {summary} |\`）；根入口：只补缺失月份链接
      - 输出 WARN 提示人工修复（含损坏位置线索）；MUST NOT 全量重建或整体覆盖**任何索引文件**，MUST NOT 丢弃既有历史条目
      - MUST NOT 因「无法解析」而中止本批索引更新

   h. **跳过失败与已跳过的变更**：
      - 不为失败或跳过的变更向任何月度索引追加条目，统计重算不含该变更
      - 为失败/跳过的变更单独展示摘要

   **跨平台说明**：Windows 上用 \`path.join()\` 构建路径。检查文件是否存在时注意大小写敏感性差异。

11. **批量 CodeGraph 同步 + 验证（条件执行，daemon 感知）**

   **仅当 Step 2.5 任一探测通道成功、且至少有一个变更成功归档时才执行。** 若 Step 2.5 三通道全部失败，整体跳过本步骤。本步骤在 Step 10（批量归档索引更新）之后运行，使所有归档先最终定稿。只由主代理执行 —— 绝不在归档子代理内执行（项目级单次同步可避免知识图谱 DB 的并发写入）。

   1. **先判 daemon 存活**（读取 \`.codegraph/writer.pid\`，判据同 Step 2.5 的锁阶梯）：
      - **daemon 存活（含 \`ready:false\` / 解析失败等不可判定态）** → MUST NOT 执行 \`codegraph sync\`、MUST NOT 执行 \`codegraph unlock\`；只读复用既有索引，直接进入第 2 步验证
      - **确认无 daemon（纯 CLI 用户）** → 项目级单次同步（不是按变更）：经 Bash 执行 \`codegraph sync\` 且**恰好一次**，增量索引已归档变更中新实现的全部代码；运行前展示 "CodeGraph：正在同步 N 个已归档变更的已实现代码..."

   2. 同步（或只读复用）后**单次验证**：
      - 用 MCP \`codegraph_search\` 查询**一次**，查询成功归档变更中的关键词（变更名 + 每个变更 \`tasks.md\` 与 \`design.md\` 中的关键符号）
      - 展示 "CodeGraph：✓ 索引中已校验符号数"，并给出匹配数量
      - 无匹配时告警（非代码变更可能属预期）
      - 验证查询只针对成功归档的变更（不含失败/跳过）

   3. **失败处理**（非阻塞）：
      - 若批量 \`codegraph sync\` 失败（CLI 错误、超时或 CLI 不在 PATH）：记录告警，不阻塞批量归档
      - 锁冲突按 Step 2.5 的锁阶梯处置：存活只读复用；不存活 \`unlock\` 一次 + 重试读取一次；仍失败降级 Glob / Grep 并记 WARN
      - 仍继续展示批量归档摘要（Step 9）与批量索引更新（Step 10）—— 同步在这些之后运行
      - 部分成功（部分变更失败/跳过）时，只要有 ≥1 个变更归档成功仍触发同步

   **批量归档不含任何索引重建**：跨变更 SQLite 索引能力已退役，MUST NOT 出现索引重建类步骤。

**冲突解决示例**

示例 1：只有一个已实现
\`\`\`
Conflict: specs/auth/spec.md touched by [add-oauth, add-jwt]

Checking add-oauth:
- Delta adds "OAuth Provider Integration" requirement
- Searching codebase... found src/auth/oauth.ts implementing OAuth flow

Checking add-jwt:
- Delta adds "JWT Token Handling" requirement
- Searching codebase... no JWT implementation found

Resolution: Only add-oauth is implemented. Will sync add-oauth specs only.
\`\`\`

示例 2：两者都已实现
\`\`\`
Conflict: specs/api/spec.md touched by [add-rest-api, add-graphql]

Checking add-rest-api (created 2026-01-10):
- Delta adds "REST Endpoints" requirement
- Searching codebase... found src/api/rest.ts

Checking add-graphql (created 2026-01-15):
- Delta adds "GraphQL Schema" requirement
- Searching codebase... found src/api/graphql.ts

Resolution: Both implemented. Will apply add-rest-api specs first,
then add-graphql specs (chronological order, newer takes precedence).
\`\`\`

**Output（成功）**

\`\`\`
## Bulk Archive Complete

Archived N changes:
- <change-1> -> archive/YYYY-MM-DD-<change-1>/
- <change-2> -> archive/YYYY-MM-DD-<change-2>/

Spec sync summary:
- N delta specs synced to main specs
- No conflicts (or: M conflicts resolved)
Exploration memory: X synced / Y skipped (no exploration file or no delta specs) / Z failed (warning logged)
CodeGraph: ✓ Synced (or "Not initialized — skipped" or "Sync skipped due to error")
\`\`\`

**Output（部分成功）**

\`\`\`
## Bulk Archive Complete (partial)

Archived N changes:
- <change-1> -> archive/YYYY-MM-DD-<change-1>/

Skipped M changes:
- <change-2> (user chose not to archive incomplete)

Failed K changes:
- <change-3>: Archive directory already exists
\`\`\`

**Output（无变更时）**

\`\`\`
## No Changes to Archive

No active changes found. Create a new change to get started.
\`\`\`

**Guardrails**
- 允许任意数量的变更（1 个即可，2 个以上是典型用法）
- 始终提示选择，绝不自动选择
- 尽早检测规格冲突，并通过检查代码库来解决
- 两个变更都已实现时，按时间顺序应用规格
- 仅在实现缺失时跳过规格同步（告警用户）；MODIFIED 目标在主 spec 缺失时按 ADDED 追加并记「MODIFIED 目标缺失（已追加）」告警，MUST NOT 中止该单元或丢弃需求
- 执行前清晰展示每个变更的状态
- 记录并报告全部结果（成功/跳过/失败）
- 按变更同步探索记忆（步骤 b.5）；某个变更失败只记录告警，绝不中止整批
- 按变更同步 CONTEXT.md（步骤 a.5）：写入前先读、同名冲突显式裁决；只同步 \`exploration.md\` 术语表，MUST NOT 从制品正文反向抽取；探索文件或术语表缺失时跳过并记日志，绝不阻塞整批；并行单元的 a.5 写入步 MUST 串行化
- 需求文档桥与只读报告已移除：本技能 MUST NOT 读取、报告、生成、对齐或迁出 \`需求文档.md\`；文件随变更目录原样保留
- **归档只读**：MUST NOT 修改 \`openspec/changes/archive/\` 下的既有内容 —— 已归档变更是历史事实；整目录移动不属于改写；根入口 \`ARCHIVE-INDEX.md\` 的月份链接与全局统计更新、月度索引 \`ARCHIVE-INDEX-YYYY-MM.md\` 的**追加**是显式例外；单元序列 c 步执行只读校验，越界只 WARN 且不中止批次
- **单元成功后清理流程级工作区** \`.openspec-tmp/pipeline-<change-name>/\`（同时识别旧 \`apply-\` 前缀）；失败或跳过的单元保留工作区供诊断，清理失败只 WARN 且不中止批次
- **月度索引纯追加**：结构损坏时保留原文 + 仅追加本批最小条目 + WARN 提示人工修复，MUST NOT 全量重建或整体覆盖，MUST NOT 丢弃既有历史条目
- **任何索引文件 MUST NOT 全量重建**：月度索引逐月纯追加；根入口只更新月份链接与全局统计（确定性重算，非增量累加）
- 移入归档时保留 .openspec.yaml（CLI 已保证）
- 归档目录目标名使用当前日期：YYYY-MM-DD-<name>
- 若归档目标已存在，则该变更失败，但继续处理其他变更
- 所有归档完成后按月份更新各月度索引并单点更新根入口（步骤 10）
- 索引中只记录成功归档的变更，失败/跳过变更不入索引也不参与统计
- workspace 范围的变更不进入索引更新`,
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）与 CodeGraph CLI（可选）。',
        metadata: { author: 'mi-agent-tools' },
    };
}

export function getSpecBulkArchiveCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 批量归档',
        description: '批量归档变更 —— 单次操作批量归档多个已完成变更（含冲突智能解决与并行执行）',
        category: 'iAgent / 规格',
        tags: ['iagent', 'spec', 'archive', 'bulk'],
        content: deriveCommandContent(getSpecBulkArchiveSkillTemplate().instructions),
    };
}

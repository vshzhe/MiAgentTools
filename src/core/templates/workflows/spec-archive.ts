/**
 * spec 类型技能模板：归档变更。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { CODEGRAPH_CLI, CODEGRAPH_MCP } from '../tool-whitelist.js';
import {
    CODEGRAPH_BUSY_LADDER,
    CODEGRAPH_CALL_DISCIPLINE,
    CODEGRAPH_CLI_BOUNDARY,
    CODEGRAPH_LOCK_LADDER,
    renderCodegraphProbeOrder,
} from '../codegraph-protocol.js';
import { renderGateWhitelistSection } from '../prompt-gate.js';

export function getSpecArchiveChangeSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_spec_archive',
        description: '归档变更。当用户要归档已实现完成的变更、结束变更工作流时使用；触发词"归档 / archive / 结束变更"；NOT for 一次归档多个变更（改用 iagent_spec_bulk_archive）。',
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), ${CODEGRAPH_CLI}, ${CODEGRAPH_MCP}, Bash(node:*)`,
        type: 'spec',
        instructions: `**适用项目护栏（impl 域蒸馏，见 .iagent/rules/coding-rules.md）。** 未定义项标 **[待确认]**，禁止猜测。

在变更工作流中归档一个已完成的变更。

**handoff 包（只读 + 追加）**：若 \`.openspec-tmp/pipeline-<change-name>/handoff-pack.md\` 存在，本技能**只读**该包并在收尾时只向 \`## 阶段结论\` 追加一行（\`phase=archive\` / \`status\` / \`artifact\` / \`nextAllowed\` / \`tokens\`，tokens 不可得填 \`—\`）；MUST NOT 重产整包。包内 \`## 已确认门\`（门账本）同样**只读** —— MUST NOT 改写、删除或回填父级已写入的条目（账本条目表达门承载语义，取值域 = \`GATE_SKIP_IDS\`，与六节并列且不计入六节）。包缺失时按需直接读取制品；\`sourceFingerprint\` 与当前制品不一致时记 WARN 并以磁盘制品为准。包内 \`## 硬约束\` 为并列节，本技能**只读复用**（MUST NOT 在该节写入或改写）；\`## 阶段结论\` 的追加只由具备 \`Write\` 权限的 apply / archive 执行（verify 只读，不声称已追加）。

${renderGateWhitelistSection()}

**Input**: 可选指定变更名；省略时检查能否从对话上下文推断。若含糊或有歧义，MUST 提示可用变更供用户选择。工作流也可能为自动执行直接传入变更名。

**执行方式与读取范围（强制）**：单变更归档由**主 agent 内联**执行（\`executionMode=inline\`）；MUST NOT 为归档启动子代理；兼容窗内旧 \`subagent\` 回执记 deprecation WARN 并允许推进（下个 major 收紧为仅 \`inline\`）。内联执行前 MUST FIRST 读 handoff 包「## 制品清单」并按锚点增量读取，回执写 \`readScope\`；「## 阶段结论」5 列（tokens 可用时填 tokens=<数值>，不可得填 —）；指纹优先 iagent spec fingerprint --change <name>。

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
   - \`planningHome\`、\`changeRoot\`、\`artifactPaths\`：路径与范围上下文
   - \`artifacts\`：制品清单及其状态（\`done\` / \`optional\` 或其他）

   \`design\` 为可选制品：状态 \`optional\`（缺失）不构成未完成，MUST NOT 因其阻断归档。

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
     - MODIFIED → 在主规格中就地替换对应的需求/Scenario；**目标需求标识在主 spec 中缺失**时按 ADDED 追加该需求（描述 + Scenario），并在归档摘要中列出「MODIFIED 目标缺失（已追加）」告警后继续归档 —— MUST NOT 中止归档、MUST NOT 丢弃该需求
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

   2. **若已存在**：写入前 MUST 先读 CONTEXT.md，并只同步变更 \`exploration.md\` 术语表中已确认的术语
      - 取词口径：**只同步** \`exploration.md\` 术语表；MUST NOT 从 \`proposal.md\` / \`design.md\` / \`specs/**\` 正文反向抽取术语
      - 同名术语已存在时 MUST 比对定义，不一致时 MUST 显式裁决（更新定义，或保留旧定义并标注「已过时（由 <change-name> 取代）」）；MUST NOT 静默追加第二条同义条目
      - 与 CONTEXT.md 交叉比对 —— 术语表中缺失的术语自动补全
      - 记录日志："CONTEXT.md 已同步 —— 新增 <N> 个术语"

   3. **若 \`openspec/CONTEXT.md\` 不存在**：仅用变更 \`exploration.md\` 术语表创建 \`openspec/CONTEXT.md\`
      - 格式：\`**<Term>**: <definition>\\n_Avoid_: <synonyms>\`
      - MUST NOT 从 proposal / design / specs 正文创建
      - 记录日志："CONTEXT.md 已创建 —— 来自 exploration.md 术语表的 <N> 个术语"

   4. **缺失处置**：\`exploration.md\` 或术语表缺失时，SHALL 记 WARN 并跳过（MUST NOT 猜测补词）；不得因检查失败而阻塞归档

   **强制检查点**：
   - 系统 MUST 在执行归档前完成 CONTEXT.md 检查
   - CONTEXT.md 缺失时，从变更制品自动创建
   - 不得因检查失败而阻塞归档 —— 记录日志并继续

4.6 **归档前 CodeGraph 能力探测（强制检查点）**

   **⚠️ 强制：归档前 MUST 探测 CodeGraph 是否可用**

   归档前按能力探测顺序判定可用性（任一通道成功即视为可用）：

   ${renderCodegraphProbeOrder({ withCli: true })}

   ${CODEGRAPH_LOCK_LADDER}

   ${CODEGRAPH_CALL_DISCIPLINE}

   ${CODEGRAPH_BUSY_LADDER}

   ${CODEGRAPH_CLI_BOUNDARY}

   **强制检查点**：
   - 系统 MUST 在执行归档前完成能力探测（三条通道任一成功即视为可用）
   - 三条通道全部失败 → 自动跳过**全部** CodeGraph 步骤（本 4.6 检查 + 6.5 同步），记录 WARN 说明当前不可用且已跳过，继续归档 —— 不得询问用户是否重试或继续
   - MUST NOT 用「\`.codegraph/\` 目录是否存在」判定可用性（点号目录的 Glob 假阴性会把 CodeGraph 误判为未初始化）
   - 不得因探测失败而阻塞归档 —— 记录日志并继续
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

4.8 **（已移除）**

   需求文档桥与只读报告已随 \`skill-bridge-optimize\` 整体移除；归档不再读取、报告、生成或迁出需求文档。变更目录内若存在 \`需求文档.md\`，它随目录一起移动，本技能不读取、不处理。

5. **执行归档**

   运行 iagent CLI 归档命令 —— 它一步完成状态检查与目录移动：
   \`\`\`bash
   iagent spec archive "<name>" --yes
   \`\`\`

   若 \`openspec/changes/\` 下不存在 \`archive\` 目录则创建它，生成带日期的目标名 \`YYYY-MM-DD-<change-name>\`，并把 \`changeRoot\` 移动到 \`openspec/changes/archive/YYYY-MM-DD-<name>/\`。

   **若命令因目标归档目录已存在而失败**：报告该错误，并建议重命名既有归档、若为重复则删除、或改到另一个日期。不得覆盖。

   保留 \`.openspec.yaml\` 与 \`attachments/\` 子目录 —— 它们会随变更目录自动移动。

   变更目录内若存在 \`需求文档.md\`，它随目录一起移动（本技能不读取、不处理）。

6.5 **归档后 CodeGraph 同步 + 验证（条件执行，daemon 感知）**

   **仅当 Step 4.6 判定 CodeGraph 可用时才执行。** 若 Step 4.6 三通道全部失败，整体跳过本步骤。

   1. **先判 daemon 存活**（读取 \`.codegraph/writer.pid\`，判据见 Step 4.6 的锁阶梯）：
      - **daemon 存活（含 \`ready:false\` / 解析失败等不可判定态）** → MUST NOT 执行 \`codegraph sync\`、MUST NOT 执行 \`codegraph unlock\`；直接只读复用既有索引，进入第 2 步验证
      - **确认无 daemon（纯 CLI 用户）** → 经 Bash 执行 \`codegraph sync\` **恰一次**，增量索引刚归档变更已实现的代码；运行前展示 "CodeGraph：正在同步已实现的代码..."

   2. 同步（或只读复用）后**验证一致性**：
      - 用主通道 \`codegraph_explore\` 查询变更名，以及变更 \`tasks.md\` 与 \`design.md\` 中提到的关键符号（宿主暴露 \`codegraph_search\` 时 MAY 追加使用）
      - 确认已实现的符号现已被索引
      - 展示 "CodeGraph：✓ 索引中已校验 N 个符号"，无匹配时告警
      - 若未找到符号（如仅配置或仅文档变更），记录告警 —— 不要视为失败

   3. **失败处理**（非阻塞）：
      - \`codegraph sync\` 失败（CLI 错误、超时或 CLI 不在 PATH）：记录告警，不阻塞归档
      - 锁冲突按 Step 4.6 的锁阶梯处置：存活只读复用；不存活 \`unlock\` 一次 + 重试读取一次；仍失败降级 Glob / Grep 并记 WARN
      - 验证查询失败或返回空：记录告警，不阻塞归档
      - CodeGraph 同步独立于 \`--skip-specs\` / \`--no-validate\` / 跳过校验的选择执行

7. **更新分片归档索引（月度纯追加 + 根入口维护）**

   归档索引由两部分组成（强制）：**根入口** \`openspec/changes/archive/ARCHIVE-INDEX.md\` 承担月份导航与全局模块统计；**月度索引** \`openspec/changes/archive/ARCHIVE-INDEX-YYYY-MM.md\` 承担当月归档条目与当月模块统计。月度索引 MUST 与根入口同目录扁平命名。索引写入 MUST 由主代理单点执行。

   **月份判定（强制）**：月份 MUST 取自归档目录名 \`YYYY-MM-DD-\` 前缀的前 7 位（\`YYYY-MM\`）；MUST NOT 读取本地时间、MUST NOT 做时区换算。目录名不含该前缀时 SHALL 回退为本次归档日期所在月并输出 WARN，MUST NOT 因无法解析而中止归档。

   **月度索引维护（强制，纯追加）**：月度索引不存在时 SHALL 按标准结构创建（标题 / 说明 / 当月归档变更列表 / 当月模块统计 / 页脚时间戳）；存在时 MUST 仅向「归档变更列表」表末追加本批条目，并更新当月模块统计与页脚时间戳。任何索引文件 MUST NOT 被全量重建或整体覆盖。

   **月度索引损坏处置（强制，纯追加不重建）**：结构损坏、无法完整解析时 MUST 保留原文 + 仅追加本批最小条目（\`| {date} | {change-name} | {module} | {summary} |\`）+ 输出 WARN 提示人工修复（含损坏位置线索）；MUST NOT 丢弃既有历史条目，MUST NOT 阻断归档。

   **根入口维护（强制，只更新链接与统计）**：根入口 SHALL 仅承担月份导航与全局模块统计。归档时 MUST 只允许：① 追加缺失的当月月份链接（已存在则跳过，MUST NOT 出现重复月份行）；② 从全部 \`ARCHIVE-INDEX-*.md\` 月度文件**确定性重算**全局模块统计（MUST NOT 使用增量累加；某月度文件不可解析时跳过该月并记 WARN）。根入口 MUST NOT 改写既有月度条目与既有条目文本。根入口缺失但存在月度文件时 SHALL 依据月度文件重建入口（月份导航 + 全局统计）并在归档摘要中报告该次重建；根入口损坏时 SHALL 保留原文 + 只补缺失月份链接 + WARN，MUST NOT 重建。

   **失败与跳过不入索引（强制）**：失败或跳过的变更 MUST NOT 写入任何月度索引，也不得参与统计重算。

   **归档写入面（强制）**：归档时本技能只允许写入 \`openspec/specs/**\`、\`openspec/CONTEXT.md\`、根入口（仅月份链接与全局统计更新）与当月月度索引（纯追加）。\`openspec/changes/**\` 只允许整目录移动，MUST NOT 改写其中任何文件的既有内容。

   **条目提取与文件模板（技能版细则）**：
<!-- CMD:SKIP -->

   a. 提取条目信息：
      - **归档日期**：取自归档目录名 \`YYYY-MM-DD-{change-name}\`
      - **变更名称**：取自目录名（日期前缀之后）
      - **模块**：从变更名模式 \`{prefix}-{module}-{feature}\` 提取，无法判断时用 "general"
      - **摘要**：\`proposal.md\` Why 的首段（历史 JSON-only 降级时只读 change.json；最多 50 字符）

   b. 写入顺序（强制）：先向当月月度索引追加条目（步骤 c），再维护根入口（步骤 d）。

   c. 月度索引 \`openspec/changes/archive/ARCHIVE-INDEX-YYYY-MM.md\`：
      - 不存在时按标准结构创建：
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
      - 已存在时：向「归档变更列表」表末追加一行 \`| {date} | {change-name} | {module} | {summary} |\`，更新「模块统计」（已有模块计数 +1 / 新模块新增一行）并把页脚时间戳更新为当前日期

   d. 根入口 \`openspec/changes/archive/ARCHIVE-INDEX.md\`：
      - 不存在但存在月度文件时按标准结构重建：
      \`\`\`markdown
      # 归档变更索引（ARCHIVE-INDEX.md）

      > 索引入口。月度条目见 ARCHIVE-INDEX-YYYY-MM.md；本文件仅维护月份导航与全局模块统计。

      ---

      ## 月份导航

      | 月份 | 月度索引 | 条目数 |
      |------|---------|-------|
      | YYYY-MM | [ARCHIVE-INDEX-YYYY-MM.md](ARCHIVE-INDEX-YYYY-MM.md) | N |

      ---

      ## 全局模块统计

      | 模块 | 归档数 | 变更列表 |
      |------|-------|---------|

      ---

      *更新时间: YYYY-MM-DD*
      \`\`\`
      - 已存在时：若「月份导航」缺少当月行则追加 \`| YYYY-MM | [ARCHIVE-INDEX-YYYY-MM.md](ARCHIVE-INDEX-YYYY-MM.md) | {条目数} |\`；再从全部月度文件确定性重算全局模块统计并更新页脚时间戳
<!-- /CMD:SKIP -->

   **补充标注的标签白名单（强制，指令版同样适用）**：读取变更目录中的 \`tasks.md\`（历史 JSON-only 降级时只读 tasks.json），通过**匹配固定标签白名单**收集补充任务类型 \`[测试]\` / \`[DB脚本]\` / \`[使用说明]\`（排除 \`[代码]\`），并把 \`[含<type1>/<type2>/...]\` 追加到摘要（如 \`[含测试/DB脚本]\`）。只按白名单匹配 —— 不得收集"所有方括号内容"：\`[测试]\` 任务带层级/优先级子标注（\`[测试][单元][P0]\`），其中 \`[单元]\`/\`[P0]\` 不是任务类型，收集它们会产生 \`[含测试/单元/P0]\` 噪声。白名单之外的标签一律忽略（非阻塞；MAY 记录 WARN）。若无补充任务，跳过标注。

   **跨平台说明**：Windows 上用 \`path.join()\` 构建路径。检查文件是否存在时注意大小写敏感性差异。

8. **展示摘要**

   展示归档完成摘要，包含：
   - 变更名称
   - 使用的 Schema
   - 归档位置
   - 规格是否已同步（如适用）
   - 归档索引更新状态（月度索引 \`ARCHIVE-INDEX-YYYY-MM.md\` 追加结果 / 根入口月份链接与全局统计维护结果 / 根入口重建或损坏 WARN）
   - CodeGraph 同步状态（已同步 / 跳过 —— 未初始化或出错）
   - 探索记忆同步状态（已同步 / 跳过 —— 无探索文件或无 delta spec / 失败 —— 已记录告警）
   - 流程级工作区清理结果（已清理 / 清理失败 WARN + 路径）
   - 关于任何告警的说明（未完成的制品/任务）

9. **归档收尾清理（流程级工作区）**

   摘要展示后执行。**顺序强制**：MUST 发生在向 handoff 包 \`## 阶段结论\` 追加 \`phase=archive\` 行**之后**。

   - **清理目标**：该变更的 \`.openspec-tmp/pipeline-<change-name>/\`（含 \`compile-report.md\` 与 \`handoff-pack.md\`）；**迁移期同时识别旧前缀 \`apply-<change-name>/\`**
   - **执行方式**：跨平台删除 —— 经 Bash 运行 \`node -e "fs.rmSync(<path>, { recursive: true, force: true })"\`；MUST NOT 改用平台相关的递归删除命令（更宽的破坏面）
   - **清理失败**（文件被占用 / 权限不足）→ 记 WARN 并给出工作区路径，MUST NOT 阻断归档，MUST NOT 改写已写入的阶段结论
   - 工作区不存在 → 静默跳过（记一行日志）

10. **归档只读护栏自检**

   流程末尾确认：本次归档未改写 \`openspec/changes/archive/**\` 下的既有内容（本变更自身的整目录移动、当月月度索引的追加、根入口的月份链接与全局统计更新除外），也未向 \`openspec/devdocs/\` 写入或迁移任何文件。

   - 发现越界 → 输出含路径的 WARN 并说明需人工复核；MUST NOT 静默忽略、MUST NOT 回滚或重写已归档内容
   - 自检结果并入摘要（与 8 的工作区清理结果一起展示）

**Output（成功）**

\`\`\`
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync failed — warning logged" or "主规格未同步（skip_specs 声明）")
**Archive Index:** ✓ Appended to ARCHIVE-INDEX-YYYY-MM.md (纯追加；结构损坏时仅追加 + WARN); root ARCHIVE-INDEX.md links and global statistics updated
**Exploration Memory:** ✓ Synced to specs/<capability>/explorations.md (or "Skipped — no exploration file" or "Skipped — no delta specs" or "Failed — warning logged")
**Pipeline Workspace:** ✓ Cleaned .openspec-tmp/pipeline-<name>/ (or "Cleanup failed — warning logged: <reason>"; 迁移期同时识别 apply-<name>/)
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
- 为月度索引 \`ARCHIVE-INDEX-YYYY-MM.md\` 提取摘要时，扫描 \`tasks.md\` 的补充类型标签，并把 \`[含xxx]\` 标注追加到摘要
- 归档移动前，为每个涉及的能力把探索记忆同步到 specs/<capability>/explorations.md；exploration.md 或 delta spec 缺失时跳过（并记日志）；绝不因同步失败阻塞归档
- 需求文档桥与只读报告已移除：归档 MUST NOT 读取、报告、生成、对齐或迁出 \`需求文档.md\`；文件随变更目录原样保留
- **归档只读**：MUST NOT 修改 \`openspec/changes/archive/\` 下的既有内容 —— 已归档变更是历史事实；整目录移动（\`openspec/changes/<name>/\` → \`openspec/changes/archive/YYYY-MM-DD-<name>/\`）不属于改写；根入口 \`ARCHIVE-INDEX.md\` 的月份链接与全局统计更新、月度索引 \`ARCHIVE-INDEX-YYYY-MM.md\` 的**追加**是显式例外；流程末尾保留一次护栏自检
- 月度索引 \`ARCHIVE-INDEX-YYYY-MM.md\` 为**纯追加**：结构损坏时保留原文 + 仅追加本批最小条目 + WARN 提示人工修复，MUST NOT 全量重建或整体覆盖，MUST NOT 丢弃既有历史条目
- 根入口 \`ARCHIVE-INDEX.md\` 只维护月份链接与全局模块统计：MUST NOT 改写既有条目；统计 MUST 从全部月度文件确定性重算（非增量累加）；缺失时依据月度文件重建，损坏时只补缺失月份链接 + WARN
- 归档收尾清理流程级工作区 \`.openspec-tmp/pipeline-<change-name>/\`（同时识别旧 \`apply-\` 前缀）必须在追加 \`phase=archive\` 结论之后；清理失败只 WARN，不阻断归档、不改写阶段结论
- 当变更声明 \`skip_specs\`（状态报告 specs 为 skipped）时，归档摘要 MUST 注明 "主规格未同步（skip_specs 声明）"，避免用户误以为规格同步被遗漏
- 清晰展示发生了什么
- 若存在 delta spec，执行同步评估、展示合并摘要，并直接执行内联 AI 合并（ADDED/MODIFIED/REMOVED/RENAMED → 主规格，遵循 v1.1.20 specs-apply 语义）；MODIFIED 目标在主 spec 缺失时按 ADDED 追加并记「MODIFIED 目标缺失（已追加）」告警，MUST NOT 中止归档或丢弃需求
- **任何索引文件 MUST NOT 全量重建**：月度索引为月度纯追加，根入口只更新月份链接与全局统计
- 归档流程不含任何索引重建：跨变更 SQLite 索引能力已退役，MUST NOT 出现索引重建类步骤`,
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

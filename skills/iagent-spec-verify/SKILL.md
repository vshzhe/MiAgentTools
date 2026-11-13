---
name: iagent-spec-verify
description: "验证变更。当用户要在实现完成后、归档前验证实现与变更制品（specs/tasks/design）是否一致时使用；触发词\"验证变更 / verify / 实现验证 / 一致性检查\"；NOT for 实现前的提案质量评分门（改用 iagent-spec-verify-proposal）。"
allowed-tools: Bash(iagent:*), Read, Glob, Grep
license: MIT
compatibility: 依赖 iagent CLI（spec 命令组）。
metadata:
  author: mi-agent-tools
  type: spec
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:842d3223139a61c50aff95d6328c3a6ba31af662d027595fa5acb70d0f2d3336"
---

**验证前先读取项目规则基线（`.iagent/config.yaml` / `.iagent/rules/*.md` / `CLAUDE.md` / `AGENTS.md`）中的验证标准。** 重点检查未定义数据字段、架构分层违规、前端 UI 状态覆盖。

验证实现是否与变更制品（specs / tasks / design）一致。

**证据消费（强制）**：存在 `.openspec-tmp/pipeline-<change-name>/conformance-report.md` 与 `test-report.md` 时，MUST 只读其 `**summary**:` 行作为验证输入：

- 一致性汇总 `status=fail` 或文件缺失 → 判 **CRITICAL**「实现一致性证据缺失 / 失败」，最终评估 MUST NOT 判可归档；
- 测试汇总 `status=fail` 或文件缺失 → 判 **CRITICAL**「测试证据缺失 / 失败」；
- 证据 `pass` 的已覆盖项 MUST NOT 再做语义猜测（避免重复推断）；`not-applicable` / `disabled` 记 WARN 并说明未执行原因。

**规则基线（强制）**：读取 `.iagent/config.yaml`、`.iagent/rules/*.md`、`CLAUDE.md`、`AGENTS.md`（`iagent rules --json` 可枚举）；源缺失记「不存在」，存在但未读记 WARN。

**handoff 包（只读消费，不追加）**：若 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 存在，本技能**只读**该包（含并列节 `## 硬约束`，只读复用、MUST NOT 写入或改写），MUST NOT 重产整包。包内 `## 已确认门`（门账本）同样**只读** —— MUST NOT 改写、删除或回填父级已写入的条目（账本条目表达门承载语义，取值域 = `GATE_SKIP_IDS`，与六节并列且不计入六节）。**本技能无 `Write` 权限**：`## 阶段结论` MUST NOT 由本技能追加，也 MUST NOT 声称已追加；结论由父编排转交具备 `Write` 权限的 apply / archive 落盘。包缺失时按需直接读取制品（不强制产包）；`sourceFingerprint` 与当前制品不一致时记 WARN，并以磁盘制品为准完成验证。

## 门白名单与 MUST NOT 确认清单

**本技能为只读验证，不承载阶段门与破坏性动作；以下为父流程门白名单（供识别）**：
- **需求澄清（需求 / 方案歧义）**：prompt-gate / grill-batch-confirmation / diagnostic-confirmation / fix-option-confirmation / design-confirmation（可按条件豁免）
- **功能流程图门（流程基准确认）**：flow-final-confirmation（不可豁免）
- **实现 + 测试桥**：implementation-bridge（不可豁免）
- **归档桥**：archive-confirmation（不可豁免）
- **破坏性改动确认（动作级，不可豁免：删除目录 / 覆盖既有制品 / 改写版本库跟踪 / 不可逆命令）**（不可豁免）

**MUST NOT 请求确认（非门动作，MUST NOT 被实现为停止点）**：
- 阶段宣告（如「进入 Phase N」「本阶段开始」）
- 技能委派（含「是否调用 <技能>」类询问）—— 已授权的 nextAllowed 技能直接委派
- 只读扫描（Glob / Grep / Read 与只读查询）
- CodeGraph 查询与能力探测（含锁阶梯只读复用）
- 状态查询（`iagent spec status` / `getChangeStatus` 等）
- 只读校验的「是否运行 <校验>？」询问（如技术栈专项校验）—— 直接执行并在报告中说明校验项

> 跨变更索引重建类动作已随索引能力退役（DEC-2），不构成任何门或动作。

**只读验证步骤无需确认即可执行**：读取制品、扫描文件、一致性分析等环节直接运行，无需中途确认。仅最终验证报告（以及真正需要用户决策的选项，例如发现问题后选择修复路径）需呈现给用户。

**报告语义**：report-only —— 不修改任何文件、不执行归档。

**输入**：可指定变更名。若未指定，则判断能否从对话上下文推断；若模糊或存在歧义，必须提示用户从可用变更中选择。

## 执行方式与读取范围（强制）

本技能存在**两种调用形态**，正文显式区分并给出判定信号（消除「单轮合并清单」与「独立三维度」的双语义歧义）：

- **判定信号**：存在**编排上下文** → 合并清单模式；否则 → 三维度 report-only 模式。编排上下文判定：由工作流编排内联调用（如 auto-workflow 验证阶段、实现验证桥），工作区标志为 `.openspec-tmp/pipeline-<change-name>/` 下已存在 handoff 包等编排产物。
- **父编排内联合并清单模式**：**主 agent 内联**，一次合并执行 D1-D10 核心维度 + B1-B7 边界清单；回执写 `executionMode=inline`、`independence=self`（自证记 WARN，可信度由固定清单 + 每条 `文件:行` 证据 + 报告落盘承担）；MUST NOT 为验证启动子代理；**报告路径**：验证报告 MUST 落盘 `.openspec-tmp/pipeline-<change-name>/verify-report.md`。
- **独立调用三维度 report-only 模式**：用户独立调用（无编排上下文、无 pipeline 工作区）时，按执行步骤 4-8 的 Completeness / Correctness / Coherence 三维度执行 report-only 验证；不要求合并清单产物路径，报告按「输出格式」呈现给用户，MUST NOT 写 pipeline 工作区。
- **读取范围（两形态通用）**：MUST FIRST 读 handoff 包「## 制品清单」，按锚点增量读取；合并清单模式回执写 `readScope`（独立调用无回执载体时在报告头部注明读取范围）。
- **同上下文复跑（仅合并清单模式）**：FAIL 修复后在同一主上下文按 `fixDiff` 与上轮 `reportPath` 增量重跑，**禁止新开验证代理或全量重读**；循环上限 3 次；禁止 resume 充当复验（`contextReplay=true 记 WARN`）。
- **两形态通用边界**：每条结论 MUST 带 `文件:行` 或制品章节锚点，**无证据的结论 MUST NOT 计入通过**；均保持 **report-only** —— 不修改任何文件、不执行归档。

## 执行步骤

1. **若未提供变更名，提示选择**

   运行 `iagent spec status --json` 获取可用变更列表。使用 **用户提问 工具** 让用户选择。

   展示含实现任务（存在 tasks 制品）的变更。
   若可获取每个变更所用的 schema，一并展示。
   将任务未完成的变更标记为 "(进行中)"。

   **重要**：禁止猜测或自动选择变更，必须让用户选择。

2. **查询状态以理解 schema**
   ```bash
   iagent spec status --change "<name>" --json
   ```
   解析 JSON 以理解：
   - `schemaName`：当前使用的工作流（例如 "spec-driven"）
   - `planningHome`、`changeRoot`、`artifactPaths`：路径与范围上下文
   - 该变更存在哪些制品

3. **读取变更制品（Markdown 优先）**

   运行 `iagent spec status --change "<name>" --json` 获取进度统计（progress），并直接读取 OpenSpec Markdown 制品：

   - `proposal.md`：需求背景（Why / What Changes / Impact）
   - `specs/**/*.md`：Requirement / Scenario 清单，用于完整性 / 正确性验证
   - `design.md`：设计一致性核对（Decisions / Risks）
   - `tasks.md`：任务复选框状态与 Spec Ref 覆盖关系

   **降级（WARN，仅存量 / 已归档变更）**：变更没有对应 Markdown、仅有历史 `change.json` 时只读降级读取并注明 WARN；不得把 JSON 当作新流程真源。

4. **初始化验证报告结构**

   创建包含三个维度的报告结构：
   - **Completeness（完整性）**：跟踪任务与 spec 覆盖
   - **Correctness（正确性）**：跟踪需求实现与场景覆盖
   - **Coherence（一致性）**：跟踪设计遵循与模式一致性

   每个维度可有 CRITICAL / WARNING / SUGGESTION 级别的问题。

5. **验证 Completeness（完整性）**

   **任务完成情况**：
   - **直接读**变更目录根下的 `tasks.md`：解析任务复选框（`- [ ]` 未完成 / `- [x]` 完成）、类型标签、依赖、Spec Ref 与 progress 统计
   - **降级（WARN）**：变更只有历史 `tasks.json` 时只读解析（Markdown 化前的存量变更）
   - 统计完成 / 总任务数
   - 若存在未完成任务：
     - 为每个未完成任务添加 CRITICAL 问题
     - 建议："完成任务：<描述>" 或 "若已实现则标记为完成"

   **Spec 覆盖（逐需求对比 tasks.md）**：
   - 需求清单来源：`specs/**/*.md` 中以 `### Requirement:` 标记的需求（ADDED / MODIFIED）
   - **降级（WARN）**：历史 JSON-only 变更从 `change.json` 的 specs 段只读读取
   - 对每条需求，在 tasks.md 中匹配覆盖任务（按以下信号依次判定）：
     1. `specRef` 与需求名精确匹配
     2. `dependencies` 引用链上存在面向该需求的任务
     3. `description` 与需求语义相关（关键词 / 语义匹配）
     （历史 JSON-only 降级时，覆盖匹配退化为对 tasks.json 任务描述的语义匹配）
   - 输出逐需求的结构化对比（纳入最终报告）：
     ```
     | 需求 | 覆盖任务 | 任务状态 | 判定 |
     |------|---------|---------|------|
     | <Requirement> | <task ids> | done / pending | 已覆盖 / 未完成 / 未覆盖 |
     ```
   - 判定规则：
     - 覆盖任务全部 done → **已覆盖**
     - 有覆盖任务但存在 pending → CRITICAL："需求未完成：<需求名>（任务 <id> 仍为 pending）"
     - 无任何覆盖任务 → CRITICAL："需求未找到：<需求名>"
       - 建议："实现需求 X：<描述>，并在 tasks.md 补建覆盖任务（specRef 指向该需求）"

6. **验证 Correctness（正确性）**

   **需求实现映射**：
   - 对需求清单中的每个需求（JSON 优先，来源见步骤 3）：
     - 在代码库中检索实现证据
     - 若找到，记录文件路径与行范围
     - 评估实现是否匹配需求意图
     - 若检测到偏离：
       - 添加 WARNING："实现可能与 spec 偏离：<细节>"
       - 建议："对照需求 X 审查 <file>:<lines>"

   **实现影响面 vs 提案声明影响面对比**（流程节点 N12，并入本维度）：
   - **声明影响面**：读 `proposal.md` 的 `## Impact` 下影响面分析小节（标题锚点：影响面分析 / Impact Analysis）与 `### 直接影响的文件` 小节，得到提案声明的影响文件集
   - **实现改动文件集**：汇总「需求实现映射」收集的 `文件:行` 实现证据与 tasks.md 完成任务涉及的文件（Glob / Read 检索）
   - 对比判定：
     - 实现越出声明影响面（改动文件不在声明影响面内）→ 添加 WARNING 并逐条列出："实现越出声明影响面：<file>（提案影响面未声明）"，建议："核对是否需把该文件补入 proposal.md 影响面，或确认实现是否应收敛"（BS-4）；MUST NOT 判 CRITICAL 阻断归档
     - proposal.md 无影响面分析小节（影响分析未触发或存量 JSON-only 降级无对应字段）→ 本对比检查点 SKIP + WARN（注明原因），三维度其余检查照常，MUST NOT 判 CRITICAL（BS-5）
   - **结构层分工**：结构层拦截由 `iagent spec conformance`（conformance-report.md 的 `**summary**:` 行）承担，本检查点为语义层对比，MUST NOT 重复执行结构校验（D2/D4）

   **场景覆盖**：
   - 对场景清单中的每个场景（读 `specs/**/*.md` 中的 `#### Scenario:` 标记）：
     - 检查代码中是否处理了相关条件
     - 检查是否存在覆盖该场景的测试
     - 若场景似乎未覆盖：
       - 添加 WARNING："场景未覆盖：<场景名>"
       - 建议："为场景添加测试或实现：<描述>"

7. **验证 Coherence（一致性）**

   **设计遵循**：
   - 若存在 design 制品：
     - 直接读取 `design.md` 的 Decisions（决策 / 选择 / 理由）与 Risks / Trade-offs 章节
     - **降级（WARN，仅存量 / 已归档变更）**：历史 JSON-only 变更从 `change.json` 的 design 段只读读取
     - 验证实现是否遵循这些决策
     - 若检测到矛盾：
       - 添加 WARNING："未遵循设计决策：<决策>"
       - 建议："更新实现，或修订 `design.md` 的决策记录"
   - 若无 design 制品：跳过设计遵循检查，注明 "无 design 制品可供对照"

   **代码模式一致性**：
   - 审查新代码与项目模式的一致性
   - 检查文件命名、目录结构、编码风格
   - 若发现显著偏离：
     - 添加 SUGGESTION："代码模式偏离：<细节>"
     - 建议："考虑遵循项目模式：<示例>"

   **数据结构验证**：
   - 检查实现是否引用了 specs/design 中未定义的数据库字段或 API 参数
   - 参考 `design.md` 中的数据库表 / 字段映射（历史 JSON-only 变更降级时只读 change.json）
   - 若发现未定义字段：添加 CRITICAL 问题 "数据字段未在 specs 中定义：<field>"
   - 建议："在 specs 中定义字段 <field> 或从实现中移除"

   **项目技能一致性**：
   - 运行 `iagent skills --json`，并读取实现回执的 `skillsRead` / `skillsIncomplete`
   - 配置中 `phases` 含 `implement` 或 `both` 且 `exists=true` 的技能未被 `skillsRead` 覆盖 → CRITICAL（`skills-not-read`；design-only 不要求）
   - 已读但 `validation.status=incomplete` → WARNING（`skills-incomplete`，列出缺失章节 / 占位符 / 无证据规则数，不判 fail）

   **架构分层完整性**：
   - 检查实现是否违反分层边界（例如 Controller / CLI 处理器绕过 Service 直接访问数据）
   - 若发现违规：添加 WARNING 问题 "分层违规：<细节>"
   - 建议："将 <logic> 移至合适层（<建议层>）"

   **交互契约验证**：
   - 参考 `design.md` 中的 API 交互契约（历史 JSON-only 变更降级时只读 change.json）
   - 对实现中的每个 API 端点：
     - 检查实际响应字段是否匹配契约 Response 定义
     - 检查返回的错误码是否匹配契约错误码列表
     - 若发现不匹配：添加 WARNING 问题 "API 响应不匹配：<endpoint> 返回了契约未定义的 <field>"
     - 建议："更新 `design.md` 中的 API 契约或修正实现响应"
   - 参考 `design.md` 中的字段-UI 组件映射矩阵（历史 JSON-only 变更降级时只读 change.json）
   - 对实现中的每个 UI 组件：
     - 检查组件中使用的字段名是否匹配映射矩阵
     - 若发现不匹配：添加 WARNING 问题 "字段名不匹配：<component> 使用 <field>，契约期望 <expected-field>"
     - 建议："对齐组件中的字段名或更新映射矩阵"
   - 可用时参考 tasks.md 复杂操作分解
   - 对 tasks.md 中的每个复杂业务操作：
     - 检查实现是否覆盖所有分解步骤
     - 检查代码中的事务边界是否与任务标注一致
     - 若步骤缺失：添加 CRITICAL 问题 "业务步骤未实现：<operation> 的第 <N> 步"
     - 建议："实现第 <N> 步：<描述>"

   **前端 UI 状态覆盖**（若存在前端代码）：
   - 参考 `design.md` 中的 UI 状态覆盖（历史 JSON-only 变更降级时只读 change.json）
   - 检查数据展示组件是否处理四种必需状态：Loading / Empty / Error / Data
   - 与 `design.md` 交叉对照，验证每个列出的组件具备所有状态
   - 若状态处理缺失：添加 SUGGESTION 问题 "缺失 UI 状态处理：<component> 的 <state>"
   - 建议："为 <component> 添加 <state> 状态处理"

8. **生成验证报告**

   **摘要计分卡**：
   ```
   ## Verification Report: <change-name>

   ### Summary
   | Dimension    | Status           |
   |--------------|------------------|
   | Completeness | X/Y tasks, N reqs|
   | Correctness  | M/N reqs covered |
   | Coherence    | Followed/Issues  |
   ```

   **需求覆盖对比表**：逐需求列出覆盖任务与判定（格式见步骤 5）。

   **按优先级分组的问题**：

   1. **CRITICAL**（归档前必须修复）：
      - 未完成任务
      - 缺失的需求实现
      - 每条均附具体可操作建议

   2. **WARNING**（应修复）：
      - Spec / design 偏离
      - 缺失的场景覆盖
      - 每条均附具体建议

   3. **SUGGESTION**（可改进）：
      - 模式不一致
      - 次要改进
      - 每条均附具体建议

   **最终评估**：
   - 存在 CRITICAL 问题："发现 X 个 critical 问题，修复后再归档。"
   - 仅存在 WARNING："无 critical 问题，Y 个 warning 可考虑。可归档（建议修复 noted 项）。"
   - 全部通过："所有检查通过。可归档。"

## 验证启发式

- **Completeness**：聚焦客观清单项（复选框、需求列表）
- **Correctness**：使用关键字检索、文件路径分析、合理推断 —— 不要求绝对确定
- **Coherence**：查找明显不一致，不纠结风格细节
- **假阳性处理**：不确定时优先 SUGGESTION > WARNING > CRITICAL
- **可操作性**：每个问题必须附具体建议，尽可能给出 file:line 引用

## 优雅降级

- 仅 tasks.md 存在：只验任务完成情况，跳过 spec/design 检查
- tasks + specs 存在：验证完整性与正确性，跳过 design
- 全部制品存在：三维度全验
- 始终说明跳过了哪些检查及原因

## 输出格式

使用清晰的 markdown：
- 摘要计分卡使用表格
- 问题分组列表（CRITICAL/WARNING/SUGGESTION）
- 代码引用格式：`file.ts:123`
- 具体、可操作的建议
- 禁止 "考虑审查" 等模糊建议

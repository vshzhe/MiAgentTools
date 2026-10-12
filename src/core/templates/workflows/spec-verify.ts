/**
 * spec 类型技能模板：验证变更（实现后、归档前）。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';

export function getSpecVerifyChangeSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_spec_verify',
        description: '验证变更。当用户要在实现完成后、归档前验证实现与变更制品（specs/tasks/design）是否一致时使用。',
        allowedTools: 'Bash(venus:*), Read, Glob, Grep',
        type: 'spec',
        instructions: `**验证前先阅读 openspec/rules/ai-coding.md 中的验证标准。** 重点检查未定义数据字段、架构分层违规、前端 UI 状态覆盖。

验证实现是否与变更制品（specs / tasks / design）一致。

**只读验证步骤无需确认即可执行**：读取制品、扫描文件、一致性分析等环节直接运行，无需中途确认。仅最终验证报告（以及真正需要用户决策的选项，例如发现问题后选择修复路径）需呈现给用户。

**报告语义**：report-only —— 不修改任何文件、不执行归档。

**输入**：可指定变更名。若未指定，则判断能否从对话上下文推断；若模糊或存在歧义，必须提示用户从可用变更中选择。

## 执行步骤

1. **若未提供变更名，提示选择**

   运行 \`venus spec status --json\` 获取可用变更列表。使用 **AskUserQuestion 工具** 让用户选择。

   展示含实现任务（存在 tasks 制品）的变更。
   若可获取每个变更所用的 schema，一并展示。
   将任务未完成的变更标记为 "(In Progress)"。

   **重要**：禁止猜测或自动选择变更，必须让用户选择。

2. **查询状态以理解 schema**
   \`\`\`bash
   venus spec status --change "<name>" --json
   \`\`\`
   解析 JSON 以理解：
   - \`schemaName\`：当前使用的工作流（例如 "spec-driven"）
   - \`planningHome\`、\`changeRoot\`、\`artifactPaths\`、\`actionContext\`：路径与范围上下文
   - 该变更存在哪些制品

3. **读取变更制品（JSON 优先）**

   运行 \`venus spec status --change "<name>" --json\` 获取进度统计（progress），并按以下顺序读取制品：

   - **优先读**变更目录下的 \`.venus/change.json\`（结构化真源）：
     - \`specs\` 段（\`specs[].operations[]\`）：需求与场景清单，用于完整性 / 正确性验证
     - \`design\` 段：设计一致性核对（decisions / risks）
     - \`proposal\` 段：需求背景（why / whatChanges / impact）
   - **优先读**变更目录根下的 \`tasks.json\`：任务状态与 specRef 覆盖关系
   - **降级（WARN）**：change.json 缺失时输出 WARN，改读渲染后的 MD —— proposal.md / specs/*.md / design.md；tasks.json 缺失时改读 tasks.md 复选框

   降级读取时必须在报告中注明 WARN 与降级原因，用于后续三维度验证。

4. **初始化验证报告结构**

   创建包含三个维度的报告结构：
   - **Completeness（完整性）**：跟踪任务与 spec 覆盖
   - **Correctness（正确性）**：跟踪需求实现与场景覆盖
   - **Coherence（一致性）**：跟踪设计遵循与模式一致性

   每个维度可有 CRITICAL / WARNING / SUGGESTION 级别的问题。

5. **验证 Completeness（完整性）**

   **任务完成情况**：
   - **优先读**变更目录根下的 \`tasks.json\`：若存在，直接获取结构化任务列表（id / label / status / dependencies / specRef / files）与 progress 统计，跳过 markdown 解析
   - **降级（WARN）**：tasks.json 缺失时解析 tasks.md 复选框：\`- [ ]\`（未完成） vs \`- [x]\`（完成）
   - 统计完成 / 总任务数
   - 若存在未完成任务：
     - 为每个未完成任务添加 CRITICAL 问题
     - 建议："完成任务：<描述>" 或 "若已实现则标记为完成"

   **Spec 覆盖（逐需求对比 tasks.json）**：
   - 需求清单来源（JSON 优先）：
     - 优先：\`.venus/change.json\` 的 \`specs[].operations[].requirement\`（逐条需求）
     - 降级（WARN）：specs/*.md 中以 "### Requirement:" 标记的需求
   - 对每条需求，在 tasks.json 中匹配覆盖任务（按以下信号依次判定）：
     1. \`specRef\` 与需求名精确匹配
     2. \`dependencies\` 引用链上存在面向该需求的任务
     3. \`description\` 与需求语义相关（关键词 / 语义匹配）
     （tasks.json 缺失降级时，覆盖匹配退化为对 tasks.md 任务描述的语义匹配）
   - 输出逐需求的结构化对比（纳入最终报告）：
     \`\`\`
     | 需求 | 覆盖任务 | 任务状态 | 判定 |
     |------|---------|---------|------|
     | <specs[].operations[].requirement> | <task ids> | done / pending | 已覆盖 / 未完成 / 未覆盖 |
     \`\`\`
   - 判定规则：
     - 覆盖任务全部 done → **已覆盖**
     - 有覆盖任务但存在 pending → CRITICAL："需求未完成：<需求名>（任务 <id> 仍为 pending）"
     - 无任何覆盖任务 → CRITICAL："需求未找到：<需求名>"
       - 建议："实现需求 X：<描述>，并在 tasks.json 补建覆盖任务（specRef 指向该需求）"

6. **验证 Correctness（正确性）**

   **需求实现映射**：
   - 对需求清单中的每个需求（JSON 优先，来源见步骤 3）：
     - 在代码库中检索实现证据
     - 若找到，记录文件路径与行范围
     - 评估实现是否匹配需求意图
     - 若检测到偏离：
       - 添加 WARNING："实现可能与 spec 偏离：<细节>"
       - 建议："对照需求 X 审查 <file>:<lines>"

   **场景覆盖**：
   - 对场景清单中的每个场景（JSON 优先取 \`specs[].operations[].scenarios[]\`；降级读 "#### Scenario:" 标记）：
     - 检查代码中是否处理了相关条件
     - 检查是否存在覆盖该场景的测试
     - 若场景似乎未覆盖：
       - 添加 WARNING："场景未覆盖：<场景名>"
       - 建议："为场景添加测试或实现：<描述>"

7. **验证 Coherence（一致性）**

   **设计遵循**：
   - 若存在 design 制品：
     - 优先：\`.venus/change.json\` 的 \`design\` 段，直接读取 \`decisions[]\`（id / title / choice / rationale）与 \`risks[]\`
     - 降级（WARN）：design.md 中查找 "Decision:" / "Approach:" / "Architecture:" 等段落
     - 验证实现是否遵循这些决策
     - 若检测到矛盾：
       - 添加 WARNING："未遵循设计决策：<决策>"
       - 建议："更新实现，或修订 design 段后运行 \`venus spec render design --change <name>\` 重渲染（降级读取时为直接修订 design.md）"
   - 若无 design 制品：跳过设计遵循检查，注明 "无 design 制品可供对照"

   **代码模式一致性**：
   - 审查新代码与项目模式的一致性
   - 检查文件命名、目录结构、编码风格
   - 若发现显著偏离：
     - 添加 SUGGESTION："代码模式偏离：<细节>"
     - 建议："考虑遵循项目模式：<示例>"

   **数据结构验证**：
   - 检查实现是否引用了 specs/design 中未定义的数据库字段或 API 参数
   - 可用时参考 design.md "数据库表-字段映射" 表获取字段定义
   - 若发现未定义字段：添加 CRITICAL 问题 "数据字段未在 specs 中定义：<field>"
   - 建议："在 specs 中定义字段 <field> 或从实现中移除"

   **架构分层完整性**：
   - 检查实现是否违反分层边界（例如 Controller / CLI 处理器绕过 Service 直接访问数据）
   - 若发现违规：添加 WARNING 问题 "分层违规：<细节>"
   - 建议："将 <logic> 移至合适层（<建议层>）"

   **交互契约验证**：
   - 可用时参考 design.md "API 交互契约" 表
   - 对实现中的每个 API 端点：
     - 检查实际响应字段是否匹配契约 Response 定义
     - 检查返回的错误码是否匹配契约错误码列表
     - 若发现不匹配：添加 WARNING 问题 "API 响应不匹配：<endpoint> 返回了契约未定义的 <field>"
     - 建议："更新 design.md 中的 API 契约或修正实现响应"
   - 可用时参考 design.md "字段-UI 组件映射矩阵"
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
   - 可用时参考 design.md "UI 状态覆盖" 表
   - 检查数据展示组件是否处理四种必需状态：Loading / Empty / Error / Data
   - 与 design.md 表交叉对照，验证每个列出的组件具备所有状态
   - 若状态处理缺失：添加 SUGGESTION 问题 "缺失 UI 状态处理：<component> 的 <state>"
   - 建议："为 <component> 添加 <state> 状态处理"

8. **生成验证报告**

   **摘要计分卡**：
   \`\`\`
   ## Verification Report: <change-name>

   ### Summary
   | Dimension    | Status           |
   |--------------|------------------|
   | Completeness | X/Y tasks, N reqs|
   | Correctness  | M/N reqs covered |
   | Coherence    | Followed/Issues  |
   \`\`\`

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
- 代码引用格式：\`file.ts:123\`
- 具体、可操作的建议
- 禁止 "考虑审查" 等模糊建议`,
        license: 'MIT',
        compatibility: '依赖 venus CLI（spec 命令组）。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getSpecVerifyChangeCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 验证变更',
        description: '验证变更 —— 实现完成后、归档前验证实现与变更制品是否一致',
        category: 'Venus / 规格',
        tags: ['venus', 'spec', 'verify'],
        content: deriveCommandContent(getSpecVerifyChangeSkillTemplate().instructions),
    };
}

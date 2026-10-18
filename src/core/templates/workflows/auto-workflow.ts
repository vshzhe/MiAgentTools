/**
 * impl 类型技能模板：全自动工作流（探索→提案→验证→自动实现→自动归档）。
 * 编排层技能 —— 一站式全自动工作流，L1-L5 用户确认后全自动化。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';
import { GATE_PROTOCOL_PREAMBLE } from '../prompt-gate.js';
import { CODEGRAPH_MCP, SUBAGENT_DISPATCH, skillDelegation } from '../tool-whitelist.js';

export function getAutoWorkflowSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_auto_workflow',
        description: '一站式全自动工作流：探索→提案→验证→自动实现→自动归档，L1-L5 用户确认后全自动；触发词"全自动工作流 / auto workflow / fully automated pipeline"。当用户需要完全自动化、无需手工 apply/archive 步骤的管道时使用；NOT for 交互式引导工作流（改用 iagent_workflow）。',
        instructions: `
**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

一站式全自动工作流：从探索到归档。

**输入**：\`/iagent:auto-workflow\` 后可跟用户想构建的主题描述。缺失的参数交互式收集；已提供的参数跳过。

该工作流引导你依次完成：
1. **探索阶段** —— 常驻探索文件 + grill-with-docs 追问（L1-L5 用户确认）
2. **提案阶段** —— 生成变更及其全部制品（自动）
3. **验证阶段** —— 自动质量校验（自动）
4. **自动实现阶段** —— 不设确认门直接自动实现
5. **自动归档阶段** —— 完成后自动归档

${GATE_PROTOCOL_PREAMBLE}

---
## Phase 1: Exploration（委派 iagent_spec_explore）

Phase 1 SHALL 委派阶段 \`iagent_spec_explore\`（传 \`mode=delegated\`）执行强制检查点体系探索（强制建探索文件、提示词校验门、CONTEXT.md 检查、CodeGraph 基础扫描含多项目派发与深度分析、L1-L5 grill 追问、功能流程图与流程最终确认门、聚合一致性门、探索完成检测），MUST NOT 内联执行探索逻辑。

委派完成后 SHALL 消费 \`iagent_spec_explore\` 输出的**结构化 handoff**（探索文件路径、提示词基线、流程基准确认状态、Pending 影响符号）并据此推进 Phase 2。

**退出守卫**：被委派的 \`iagent_spec_explore\` 完成后 MUST NOT 自行进入提案或实现；阶段完成判定与推进主权归编排器。

## Phase 2: Proposal

**⚠️ 自动执行：本阶段在 Phase 1 完成后立即开始 —— 不停顿、不宣告、不向用户提问。若你刚完成 Phase 1，下一个动作 MUST 是 Phase 2 的 2.0 步（影响分析）。禁止输出单独的「探索完成」消息 —— 直接继续进入 Phase 2 的工具调用。若你在到达此点之前结束了回复，立即从 Phase 2 继续。**

### 2.0 影响分析（自动执行）

Pending 段含符号时，逐个符号运行影响分析：
\`\`\`bash
mcp__codegraph__codegraph_impact --symbol <symbol> --direction upstream
\`\`\`

**多符号并行执行**：识别出两个及以上影响符号时，在单轮回复中并行发起影响查询（多个工具调用）。全部结果合并写入制品的对应影响段；单个符号维持现有的单次查询行为。

**结果写入位置**：
- \`proposal.md\` Impact: Impact Analysis 段
- \`design.md\` Context: Architecture Impact 段

### 2.1 提案生成（委派 iagent_spec_propose）

Phase 2 的探索文件迁移与全部制品生成 SHALL 委派阶段 \`iagent_spec_propose\`（传 \`mode=delegated\` + \`exploration-file=<Phase 1 探索文件路径>\`）完成，MUST NOT 内联生成提案制品。委派完成后再进入 Phase 3 自动验证。

**退出守卫**：被委派的 \`iagent_spec_propose\` 完成后 MUST NOT 自行进入实现；阶段推进主权归 \`iagent_auto_workflow\`。

## Phase 3: Verification

**Phase 3 在 Phase 2 制品生成完成后自动执行。无需用户确认。**

### 3.1 自动执行验证

- 跳过方式选择提示 —— 禁止展示「Propose 方式一步生成」或类似选项
- 跳过用户选择 —— 禁止询问 [立即验证] / [跳过验证]
- 直接执行 —— 自动运行 D1-D5 验证

### 3.2 运行验证

- 调用 \`iagent_spec_verify_proposal\` **skill** 执行 D1-D5 评分
- 技能不可用时降级为 AI 内联评分 + WARN 日志；禁止静默跳过
- 计算覆盖率与总分（统一 90% 阈值）
- 从 config.yaml 的 context 探测技术栈

### 3.3 处理结果

**PASS (≥90%)**：
- 自动执行提案深度复查：调用 \`iagent_proposal_review\` skill 做深度复查（不弹 [Yes/No] 询问）；技能不可用时降级为 AI 内联深度复查 + WARN 日志；禁止静默跳过
- 结果与验证报告一并展示
- **收敛 —— 生成需求文档**：深度复查收敛后，以非交互模式委派 \`iagent_requirement_doc\`，在 \`openspec/changes/<change-name>/需求文档.md\` 生成需求文档。该文档在实现开始前依据**当前**制品（proposal/specs/design/tasks）生成 —— 用户可在实现阶段审阅。生成失败非阻断（WARN 日志 + 继续）。MUST NOT 向用户索取文档基本信息
- **自动转入 Phase 4**：需求文档生成完成（或失败）后，自动进入 Phase 4（自动实现）

**FAIL (<90%)**：
- 自动生成修复建议并应用修复
- 自动重新运行验证
- 仍 FAIL 时：[手动修改] [返回探索] [查看详细 diff]（不提供跳过验证直接实现的路径）

---
## Phase 4: Auto-Apply

**Phase 4 在 Phase 3 验证通过后自动执行。无需用户确认 —— 实现以 auto-mode=true 运行，跳过设计确认门。**

### 4.1 自动执行实现

验证通过（≥90%）且深度复查收敛后：
- 宣告：明确标题「## Auto-Apply Phase」
- 展示：「验证通过 —— 自动进入实现阶段」
- 构造实现上下文，包含：
  - \`auto-mode=true\` —— 跳过设计确认门（与 iagent_spec_apply 一致：Input 传 auto-mode=true；auto-mode 下跳过 Step 5.5 确认门，直接进入 Step 6 批次调度）
  - \`change-name\` —— 来自工作流上下文的当前变更名
- **委派阶段**：以 \`auto-mode=true\` + \`change-name\` 调用 \`iagent_spec_apply\` skill；被委派技能完整承载 apply 协议
  - **共享上下文包** —— 唯一必读制品 \`context-pack.md\`（六节），一次性产出、逐批追加
  - **产出登记表** —— 包内 \`## 已产出（跨单元可见）\` 段，由协调器在每批之后追加
  - **最小回执** —— 固定四列回执 \`<task id> | <status> | <output file> | <public signature>\`，不粘贴代码正文
  - **共享指令前缀** —— 固定顺序「共享前缀（包路径 / 规范要点引用 / 回执格式 / 禁止项）→ 单元增量（任务清单）」
- Phase 4 **MUST NOT 重复声明或内联 apply 协议正文** —— 该协议的单一源留在 \`iagent_spec_apply\`；本技能只做委派（MUST NOT 内联执行 apply 工作流逻辑，也 MUST NOT 自定一套调度指令格式，二者都会与单一源规则矛盾）
- \`auto-mode=true\` **仅**跳过设计确认门 —— 共享资源协议继续生效（全自动语义 MUST NOT 免除它）
- 全部实现任务由被委派技能按其既有批次调度自动完成

### 4.2 自动实现错误处理

- **编译检查失败**（自动修复 3 次尝试后）：暂停并等待用户指示 —— 不得进入归档
- **子代理失败**：自动重试一次；重试仍失败则暂停并报告
- **用户中断**：完成当前批次，其余任务标记为未完成，然后暂停

### 4.3 测试执行门（继承自 iagent_spec_apply §9，自动通过）

Phase 4 继承 \`iagent_spec_apply\` 的**测试执行门**并**自动**通过 —— 全自动管线 MUST NOT 跳过该门，也 MUST NOT 把它当作「无需确认因此无需跑测试」：

- 范围：**仅变更范围内** —— 本次变更 \`[测试]\` 任务产出的测试，以及覆盖被改文件的既有测试
- **范围内测试通过** → 自动通过并进入 Phase 5
- **变更范围外的既有失败** → 仅报告 WARN；MUST NOT 计入本次变更的失败，MUST NOT 阻断
- **范围内测试失败** → 自动修复并重跑，至多 3 次尝试（与编译检查同一预算）
- **3 次尝试后仍失败** → 暂停并向用户报告。MUST NOT 静默通过，MUST NOT 进入归档
- 项目无测试框架 → 记录 WARN，跳过该门，继续

**条件测试子阶段**：变更 \`tasks.md\` 含 \`[测试]\` 任务时，在测试执行门前委派阶段 \`iagent_test\` skill 生成变更范围测试；门判定仍然适用（范围内失败自动重试后暂停）。

### 4.4 实现验证桥（委派，强制）

测试执行门通过后，MUST 委派阶段 \`iagent_spec_verify\` skill 校验实现与制品（specs/tasks/design）的一致性：

- **验证通过** → 进入 Phase 5（自动归档）
- **验证失败** → 回到 Phase 4 修复；MUST NOT 进入归档
- **降级（\`iagent_spec_verify\` 不可用）**：记录 WARN 并显式记录省略决策（「实现验证由 apply 编译检查 + 归档一致性承担」）—— MUST NOT 静默跳过

- **⛔ EXIT GUARD (强制 — 子代理退出守卫)**：每条子代理调度指令 MUST 携带退出守卫 —— 完成分配任务后立即停止并返回回执，MUST NOT 进入 plan 模式 / 设计模式 / 提出后续步骤 / 超出分配范围继续；编排器是唯一有权判停、汇总、推进阶段的角色；子代理 MUST NOT 越权替代编排器做阶段收尾决策
- **MUST FIRST 先读取上下文包**：子代理调度指令 MUST 强制子代理在任何其他动作之前先读上下文包 —— MUST NOT 重读 proposal/specs/design 或重跑包已覆盖的 CodeGraph 查询；仅做增量查询

---
## Phase 5: Auto-Archive

**Phase 5 在 Phase 4（自动实现）完成、编译检查与测试门通过、且实现验证桥（§4.4）通过或已显式省略后自动执行。无需用户确认。**

### 5.1 自动执行归档

实现完成且编译检查通过（验证桥通过或已显式省略）后：
- 宣告：明确标题「## Auto-Archive Phase」
- 展示：「实现完成 —— 自动进入归档阶段」
- 构造归档上下文，包含：
  - \`change-name\` —— 当前变更名（跳过变更选择提示）
- **委派阶段**：以 \`change-name\` 调用 \`iagent_spec_archive\` skill；被委派技能完整承载归档协议（delta spec 同步、CONTEXT.md 同步、CodeGraph 检查、探索记忆同步、需求文档对齐 step 4.8、目录移动、需求文档迁移至 devdocs、ARCHIVE-INDEX.md 更新）—— 本技能 MUST NOT 重复声明或内联该协议正文
- 全部归档步骤在被委派技能内部自动执行
- **需求文档对齐（单一源规则）**：由被委派的 \`iagent_spec_archive\` step 4.8 承载（已存在 → 就地增量对齐，逐字保留人工域 \`## 基本信息\` / \`## 八、评审记录\`；不存在 → 非交互委派 \`iagent_requirement_doc\`）。本技能 MUST NOT 复制该分支规则正文 —— 只引用 step 4.8

### 5.2 自动归档错误处理

- **delta spec 同步冲突**：以冲突标记自动合并（非阻断）
- **CONTEXT.md 同步失败**：记录 warning 并继续（非阻断）
- **CodeGraph 未初始化**：跳过 CodeGraph 步骤并继续（非阻断）
- **探索记忆同步失败**：记录 warning 并继续（非阻断）
- **需求文档生成或对齐失败**：记录 warning（目标路径 + 原因）并继续（非阻断）
- **归档目标已存在**：以错误失败，建议改名

### 5.3 完成

自动归档完成后：
- 展示含全部阶段的完整完成摘要
- 显示："## Auto-Workflow Complete ✓"

---
## Guardrails

- **不要跳过追问** —— 一直问到真正清晰为止
- **MUST 在探索前校验提示词** —— 委派的 spec_explore（delegated）提示词校验门是强制检查点：清晰输入一句话复述理解后直通；不明确输入须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 推进到后续步骤
- **全自动语义不得跳过澄清门** —— 委派的 spec_explore 提示词门是澄清门（确认 WHAT），管线为全自动不构成跳过理由；基线确认是自动化的起点
- **不得在确认门上死锁** —— 委派的 spec_explore 提示词门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **持久化提示词基线** —— 原始提示词与确认后的基线一并写入探索文件 \`## 提示词基线\` 段；基线变更 MUST 回到委派的 spec_explore 提示词门重新确认
- **MUST 产出功能流程图** —— 委派的 spec_explore 流程最终确认门是强制检查点：探索分析完成后 MUST 产出探索文件 \`## 功能流程图\` 段（Mermaid + 节点清单）并执行流程最终确认门；确认前 MUST NOT 进入完成检测，MUST NOT 把未确认流程图当作 propose 锚点
- **全自动语义不得跳过流程确认门** —— 委派的 spec_explore 流程最终确认门是确认门（确认流程基准），管线为全自动不构成跳过理由；流程基准的确认是自动化的前置条件
- **不得在流程门上死锁** —— 委派的 spec_explore 流程确认门有四条出口（确认 / 修改 / 拒绝后记录未确认状态并按原理解继续 / 显式授权按推断继续），拒绝时 propose 降级为仅凭 exploration.md、verify 节点覆盖度维度 SKIP，不得反复要求确认
- **MUST NOT 在 tasks 中静默补流程图节点** —— 发现遗漏节点 MUST 回到委派的 spec_explore 更新流程图并重新经用户确认，MUST NOT 在 tasks.md 中静默补节点
- **硬冲突时不得自动推进** —— 1.6 一致性检查通过时阶段自动推进（一致性直通）；仅在检测到硬冲突时询问用户
- **只读操作直接执行** —— 文件读取、CodeGraph 查询与分析步骤（影响分析）无需用户确认即可运行
- **只读直通不覆盖澄清门** —— grill L1-L5 需求澄清门仍等待用户确认
- **自动验证** —— 提案后无需用户提示即自动验证
- **验证通过后自动实现** —— Phase 4 以 auto-mode=true 自动执行（跳过 iagent_spec_apply Step 5.5 门）
- **实现完成后自动归档** —— Phase 5 自动执行，变更名由上下文传入（遵循 iagent_spec_archive 技能模板）
- **继承并自动通过测试执行门** —— Phase 4 执行 iagent_spec_apply §9 且仅限变更范围内；范围内失败自动重试至多 3 次，随后暂停并报告；既有的变更范围外失败仅 WARN；项目无测试框架 → WARN 并跳过
- **测试门失败时不得静默通过** —— 范围内的测试门失败 MUST 在归档前暂停；全自动语义绝不构成跳过该门或跳过归档阻断的理由
- **深度复查后收敛** —— 全部通过后调用 \`iagent_proposal_review\` 做深度复查（不可用则内联深度复查 + WARN），随后生成需求文档（非交互 \`iagent_requirement_doc\`；失败为非阻断 WARN），再自动转入 Phase 4
- **MUST 先建探索文件再追问** —— Phase 1 检查点为强制
- **MUST 迁移前校验文件** —— Phase 2 检查点为强制
- **MUST 迁移失败时保留源文件** —— 绝不丢失用户数据
- **MUST NOT 提供方式选择** —— Phase 2 直接进入内联 propose 式生成
- **Phase 2 MUST 遵循 Markdown-first 协议** —— 内联生成 MUST 遵循 \`openspec/rules/artifact-generation.md\`：写入 Markdown 真源（proposal.md / specs/**/*.md / design.md / tasks.md）→ \`iagent spec validate --change "<name>"\` → 校验失败则修正 Markdown 并重跑；校验不可用则产出 WARN
- **先探索代码库** —— 提问前先看代码库能否回答该问题
- **给出推荐** —— 每个问题都附 AI 的推荐
- **实时更新文件** —— 每轮交互后即时写入探索文件
- **使用结构化格式** —— Background、Questions、Decisions、Pending 段
- **展示量化评分** —— 验证结果包含覆盖率百分比
- **注入能力记忆** —— Phase 1 在存在时读取 specs/<capability>/explorations.md
- **用 CodeGraph 扫描其他项目** —— 探索上下文含其他项目路径时，派发子代理用 CodeGraph 的 projectPath 参数扫描；失败时降级为 Glob/Grep
- **不丢失探索内容** —— 即使放弃探索文件也保留（除非被删除）
- **MUST NOT 进入 plan 模式** —— 子代理完成分配任务后 MUST NOT 进入 plan 模式 / 设计模式 / 提出后续步骤；Phase 4 auto-mode 仅跳过设计确认门，MUST NOT 免除退出守卫或共享资源协议
- **MUST FIRST 读取共享上下文** —— 子代理 MUST 先读共享上下文包再做增量查询；MUST NOT 绕过包重读 proposal/specs/design 或重跑已覆盖的 CodeGraph 查询
`,
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(mvn:*), Bash(gradle:*), Bash(ant:*), Bash(go:*), Bash(cargo:*), Bash(git:*), Bash(ls:*), Bash(mv:*), ${CODEGRAPH_MCP}, ${skillDelegation(['spec_explore', 'spec_propose', 'spec_verify_proposal', 'proposal_review', 'requirement_doc', 'spec_apply', 'spec_verify', 'test', 'spec_archive'])}, ${SUBAGENT_DISPATCH}`,
        type: 'impl',
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）与 spec 系列技能（iagent_spec_apply / iagent_spec_archive）；CLI 缺失时降级为 AI 内联生成。',
        metadata: { author: 'mi-agent-tools', version: '1.0' },
    };
}

export function getAutoWorkflowCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 全自动工作流',
        description: '一站式全自动工作流：探索（L1-L5 确认）→ 自动提案 → 自动验证 → 自动实现（auto-mode）→ 自动归档',
        category: 'iAgent / 实现',
        tags: ['iagent', 'impl', 'auto-workflow', 'automation'],
        content: deriveCommandContent(getAutoWorkflowSkillTemplate().instructions),
    };
}

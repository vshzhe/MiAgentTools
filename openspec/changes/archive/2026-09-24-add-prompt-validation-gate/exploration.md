# 提示词校验门（Prompt Validation Gate）— 探索记录

> 探索对象：VenusAgentTools 自身 5 个技能模板（explore / workflow / auto-workflow / debug / genfull）
> 目标：在探索分析需求前先校验用户提示词，不明确则先优化并请用户确认，防止后续理解偏差

## Background

用户原始诉求（原文）：

> 参考 `docs/prompt.md` 提示词优化器；对 explore / workflow / auto-workflow / debug / genfull 指令 SKILL 进行优化，在探索分析需求前，先对用户提示词进行验证，如果 AI 对提示词内容不明确，则先进行提示词优化，让用户确认后再继续，防止因为提示词问题，导致后续分析理解存在偏差。

参考资产 `docs/prompt.md`（提示词优化器技能定义）核心要点：

1. **角色**：专业提示词工程师 —— 把粗糙、口语化的原始 prompt 改写成严谨、可直接使用的提示词
2. **流程**：接收原始提示词 → 分析（任务类型/受众/输出格式/约束/角色）→ 补全缺失要素（任务目标 / AI 角色 / 输出格式 / 限制 / 验收标准）→ 输出两部分
3. **输出格式**：`【优化后提示词】`（可直接复制）+ `【优化说明】`（改了哪里、为什么）
4. **规则**：不篡改用户原始意图，只做结构化与补全约束，不擅自增加额外需求；缺少关键信息则列出需补充项

## Analysis

### Security Findings

无。纯技能正文（prompt 文本）变更，不触及运行时代码路径、不新增命令执行、不扩大 `allowed-tools` 白名单。唯一的"安全"约束是**语义安全**：优化后提示词不得把 AI 推断写成既定事实（见 Step 3 的 `[推断]` / `[待确认]` 标注规则），防止偏差被固化进下游 artifact。

### Architecture Flow

```
用户提示词
   │
   ▼
┌──────────────────────────────┐
│ Step 1 清晰度自检（六维）      │  目标/对象/范围/约束/验收/歧义
└──────────┬───────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
  清晰         不明确 / 实质歧义        软不明确（细节级）
     │           │                        │
     │           ▼                        ▼
     │   Step 3 提示词优化           记 [假设] 继续
     │           │                   （不阻断）
     │           ▼
     │   Step 4 确认门（阻塞等待）
     │           │  用户确认/修改
     │           ▼
     └──────► Step 5 落盘提示词基线 ◄────┘
                 │
                 ▼
        探索（explore / Phase 1）→ 提案 → 实现
```

### Impact Analysis（codegraph_impact）

| 符号 | 上游影响 | 结论 |
| :--- | :--- | :--- |
| `deriveCommandContent` | 16 个符号 —— 7 个 spec-* CommandTemplate 全部依赖 | **不修改**（零爆炸半径），只新增模块并编辑 5 个模板文件 |
| `getTrImplWorkflowSkillTemplate` | registry.ts（WORKFLOW_PAIRS 注册）+ 测试 | 编辑正文，注册结构不变 |
| 其余 4 个 `getXxxSkillTemplate` | 同上 | 编辑正文，注册结构不变 |
| 新增 `prompt-gate.ts` | 无上游 | 纯新增，无爆炸半径 |

**技能总数不变（27）** → `test/commands.test.ts` / `test/templates.test.ts` 的硬断言无需改动。

## Codebase Findings

### Discovered Files

- `src/core/templates/workflows/spec-explore.ts`（343 行）：`venus_spec_explore`，探索模式"stance not workflow"（无固定步骤、无强制产出），CommandTemplate 经 `deriveCommandContent(instructions)` 自动派生
- `src/core/templates/workflows/tr-impl-workflow.ts`（2164 行）：`venus_tr_impl_workflow`，Phase 1 探索含 1.1→1.7 强制 checkpoint 体系
- `src/core/templates/workflows/tr-impl-auto-workflow.ts`（569 行）：`venus_tr_impl_auto_workflow`，Phase 1-3 与 workflow 同构（精简版），Phase 4/5 全自动
- `src/core/templates/workflows/tr-impl-debug.ts`（499 行）：`venus_tr_impl_debug`，Startup 段接收 bug 描述 → Phase 1 强制复现
- `src/core/templates/workflows/tr-impl-genfull.ts`（334 行）：`venus_tr_impl_genfull`，Phase 0 初始化 → Stage 1 委派 `venus_spec_explore`
- `src/core/templates/derive-command.ts`：指令正文派生器（`<!-- CMD:SKIP -->` 成对标记划定"仅 skill 版可见"段）
- `src/core/templates/registry.ts`：`WORKFLOW_PAIRS` 27 组成对注册

### Identified Symbols

- `getSpecExploreSkillTemplate` / `getSpecExploreCommandTemplate`（spec-explore.ts:7 / :335）
- `getTrImplWorkflowSkillTemplate` / `getTrImplWorkflowCommandTemplate`
- `getTrImplAutoWorkflowSkillTemplate` / `getTrImplAutoWorkflowCommandTemplate`
- `getTrImplDebugSkillTemplate` / `getTrImplDebugCommandTemplate`
- `getTrImplGenfullSkillTemplate` / `getTrImplGenfullCommandTemplate`
- `deriveCommandContent`（derive-command.ts:23）

### Pattern Matches

**命令派生双轨制（关键约束）**：

| 技能 | CommandTemplate.content 来源 | 改 skill 正文后 |
| :--- | :--- | :--- |
| `spec-explore` | `deriveCommandContent(instructions)` 自动派生 | 自动同步；块**不得**包 `<!-- CMD:SKIP -->`（指令版同样需要本门） |
| `tr-impl-workflow` / `auto-workflow` / `debug` / `genfull` | 手写压缩版正文 | **必须手工同步压缩版** |

**既有"确认门"先例**：CONTEXT.md 已收录 `**蒸馏确认门**`（auto-migration Phase 1 需求澄清门，确认 WHAT），与本门语义相邻，术语需显式区分（本门确认的是"我们说的是不是同一件事"，早于蒸馏门）。

**既有歧义分级先例**（spec-explore Guardrails 末条）：实质歧义（范围/行为契约/向后兼容/验收标准）必须上报 `[待确认]`；细节级歧义可合理假设并记录。本门的硬/软不明确分级**沿用该阈值**，不新造标准。

### 生成与校验链路

```
模板（src/core/templates/workflows/*.ts）
  ├─ pnpm build（tsc）→ dist/
  ├─ pnpm generate:skills → skills/<name>/SKILL.md（静态快照，禁止手工编辑）
  └─ venus init → 目标项目 .claude/skills/<name>/SKILL.md + .claude/commands/venus/<id>.md
```

### 相关既有规格

- `openspec/specs/tr-workflow-suite-skills/spec.md`：覆盖 tr-impl-workflow / auto-workflow / debug / requirement-doc / review-proposal（**未收录 genfull** —— 既有缺口）
- `openspec/specs/spec-workflow-skills/spec.md`：覆盖 explore / propose / apply / archive / verify / verify-proposal

### 测试约束（改动必须同步）

- `test/skills-parity.test.ts`：`skills/` 快照必须与模板生成结果逐字节一致 → 必须 `pnpm build && pnpm generate:skills`
- `test/commands.test.ts:32,33,69,80` 与 `test/templates.test.ts:13`：技能总数硬断言 27（本次不变，无需改）
- `test/allowed-tools.test.ts`：正文出现的命令必须被 `allowed-tools` 白名单覆盖（本门不引入新命令）

## Questions

（已全部裁决，见 Decisions）

## 术语表

| 术语 | 定义 | Avoid |
| :--- | :--- | :--- |
| 提示词校验门 | 探索/分析前对用户输入提示词的强制校验步骤：按六维检查清晰度，不明确则先优化再确认 | 提示词门（口语）、与前置验证门混淆 |
| 提示词基线 | 经校验确认后的提示词版本，作为后续探索、提案、实现的唯一语义来源 | 优化后提示词（仅指输出物，非落盘产物） |
| 清晰度六维 | 目标 / 对象 / 范围 / 约束 / 验收 / 歧义 六项判定维度 | 检查清单（过于宽泛） |
| 硬不明确 | 影响范围、行为契约、验收标准的缺失或歧义 → 阻断，必须优化+确认 | 严重歧义（无分级依据） |
| 软不明确 | 细节级歧义 → 不阻断，记 `[假设]` 继续（对齐 explore 既有 Guardrails） | 轻微问题 |

## 架构决策

### 决策：门的位置 —— 探索文件创建之前还是之后

- **候选 A（采纳）**：`spec-explore` 中置于 Input 段之后、The Stance 之前；4 个流程技能中置于**探索文件创建之后**（workflow/auto-workflow 在 1.1 之后 → 1.1.2），校验结论写入探索文件 `## 提示词基线` 段，保留既有"调用即创建探索文件"的规格约束不被破坏
- **候选 B（否决）**：置于探索文件创建之前 —— 门若需用户多轮交互会延迟文件创建，与 `tr-workflow-suite-skills` 中"调用即创建探索文件"的既有 Requirement 冲突

## 边界场景

- 用户提示词已经很清晰 → 一句话复述理解后直接继续，**不得**强制走优化流程（避免橡皮图章式打扰）
- genfull Phase 0 已校验 → Stage 1 委派的 explore 检测到已有提示词基线时不得重复确认（幂等）
- auto-workflow 自动化语境 → 门位于 Phase 1 之前，属澄清门（确认 WHAT），**不得**被 auto 语义跳过
- debug 的输入是 bug 描述而非需求 → 维度换为（症状 / 复现步骤 / 期望 vs 实际 / 环境 / 歧义），不照搬需求六维
- 优化后提示词若引入用户未说的需求 → 违反"不篡改原始意图"，必须标 `[推断]` / `[待确认]`
- 用户拒绝优化 → 记录原始提示词，按其原有理解继续（门不强制用户接受改写）
- **无输入入口**（`spec-explore` 可以不接收任何参数、仅进入探索模式）→ 无提示词可校验，跳过本门；用户在探索中逐步给出现象时不追溯补门
- **输入为变更名**（如 `/venus:spec-explore add-auth-system`）→ 变更名不是需求提示词，门 SHALL 以该变更的既有制品（proposal/design/specs）为校验对象，MUST NOT 把变更名本身当提示词去评估清晰度
- **流程技能的交互式收集**（workflow / auto-workflow / debug 在参数缺失时先向用户收集主题描述）→ 门以**收集后**的描述为校验对象，MUST NOT 对空输入执行校验
- **用户在门上不愿逐项裁决**（含糊输入下的常见反应："你按你的判断来"）→ 若无出口，阻塞式确认门会把流程永久卡在等待态（比不校验更糟）。须有第三条出口：用户显式授权按推断继续时将推断项标 `[推断]` 记入基线后继续，MUST NOT 反复要求确认（已裁决：采纳，见 design D11）

## Decision Process

### Decision: 复用方式

- **候选 A（采纳）**：新增 `src/core/templates/prompt-gate.ts` 作为唯一源，build 时内联进 5 个技能正文。不新增技能、不动 27 技能总数断言、无跨技能调用往返；生成的 SKILL.md 仍自包含
- **候选 B（否决）**：新增独立技能 `venus_tr_impl_prompt_optimize` 经 Skill 工具委派 —— 可单独调用，但技能总数 27→28 需同步 6+ 处断言与依赖注入，改动面显著更大

### Decision: 门控强度

- **候选 A（采纳）分级门**：清晰 → 一句话复述理解后直接进入探索（零打扰）；不明确 → 输出【优化后提示词】+【优化说明】并阻塞等待确认
- **候选 B（否决）恒确认**：每次进入探索前都展示校验结论并等待确认 —— 打断成本过高
- **候选 C（否决）仅不明确时输出**：清晰分支完全静默 —— 用户无法确认"AI 确实做过校验"

### Decision: 清晰度维度集

- **候选 A（采纳）六维**：目标 / 对象 / 范围 / 约束 / 验收 / 歧义。覆盖范围、契约、验收三类硬不明确；技术栈等可从代码库推断的不计入阻断项
- **候选 B（否决）三维精简**：目标 / 对象 / 歧义 —— 范围与验收缺失时不阻断，偏差风险回升
- **候选 C（否决）八维完整**：六维 + 技术栈/契约 + 冲突检测 —— 字段/契约类信息应由探索阶段从代码库得出，前置要求用户提供会造成不必要阻断

### Decision: spec-explore 的处理强度

- **候选 A（采纳）条件触发**：输入含糊/多义时激活本门；清晰则直接进入思考伙伴模式 —— 满足"探索前先校验"且不把无固定步骤的探索模式改造成固定流程
- **候选 B（否决）强制门**：与 4 个流程技能一致 —— 与 explore 既有"没有固定步骤、没有强制产出"定位冲突，需连带修订该技能定位与 spec-workflow-skills 规格

### Decision: 需求维度与 bug 维度的关系

采纳**参数化渲染**：共享 Step 2–5 的流程文本，仅维度表按场景注入（需求六维 / bug 五维），避免 25 行流程文本重复两份。

### Decision: debug 的 bug 描述维度

采纳五维：`症状` / `复现步骤` / `期望 vs 实际` / `环境` / `歧义`。其中"复现步骤"与 Phase 1 强制复现直接衔接。

## Decisions

1. **复用方式**：共享文本块 —— 新增 `src/core/templates/prompt-gate.ts`，导出参数化渲染函数 + 维度表常量 + 指令版压缩块
2. **门控强度**：分级门（清晰一句话复述后继续 / 不明确阻塞确认 / 软不明确记 `[假设]` 继续）
3. **清晰度维度**：需求六维（目标/对象/范围/约束/验收/歧义）；debug 用 bug 五维
4. **explore 强度**：条件触发，不改其"stance not workflow"定位
5. **位置**：4 个流程技能置于探索文件创建之后（新编号 1.1.2 / Phase 0.x），explore 置于 Input 段之后
6. **不修改 `deriveCommandContent`**（16 符号爆炸半径），仅新增模块 + 编辑 5 个模板文件 + 4 个手写指令压缩版
7. **技能总数保持 27**，不触碰既有断言
8. **幂等**：检测到上游已产出提示词基线时不重复确认
9. **落盘**：探索产物新增 `## 提示词基线` 段（原始 + 确认后），下游以基线为唯一语义来源

## Scope Changes

- 增加项：`openspec/specs/tr-workflow-suite-skills/spec.md` 缺 genfull 规格（既有缺口，非本次引入）—— 已裁决：**本次顺带补一条 genfull 规格**（用户在蓝图确认阶段明确采纳）

## Pending

### For Phase 2 Impact Analysis

- `deriveCommandContent`（已分析：不改）
- `getSpecExploreSkillTemplate`
- `getTrImplWorkflowSkillTemplate`
- `getTrImplAutoWorkflowSkillTemplate`
- `getTrImplDebugSkillTemplate`
- `getTrImplGenfullSkillTemplate`

### Security Concerns

（无 —— 纯 prompt 文本变更）

### Business Validation

- 不明确分支的确认门必须真正阻塞（未确认不探索），否则门形同虚设
- 清晰分支必须零打扰（不允许每次强塞确认对话）

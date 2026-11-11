/**
 * impl 类型技能模板：一站式调试工作流（复现→排查→关联判定→修复循环→编译→同步→验证）。
 * 编排层技能 —— 从复现到提案同步的一站式调试工作流，含 P1-P4 调试循环。
 *
 * 模板单一源：command 版正文由 deriveCommandContent() 从 skill 版 instructions 派生，
 * MUST NOT 手工双写两份 markdown 字符串。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { buildPromptGateBlock, BUG_DIMENSIONS, GATE_PROTOCOL_PREAMBLE, renderGateWhitelistSection } from '../prompt-gate.js';
import { buildFlowchartBlock, FAULT_CHAIN_FLOW_COLUMNS } from '../flowchart-gate.js';
import { CODEGRAPH_CLI, CODEGRAPH_MCP, skillDelegation } from '../tool-whitelist.js';
import {
    CODEGRAPH_BUSY_LADDER,
    CODEGRAPH_CALL_DISCIPLINE,
    CODEGRAPH_CLI_BOUNDARY,
    renderCodegraphProbeOrder,
} from '../codegraph-protocol.js';
import { deriveCommandContent } from '../derive-command.js';

/** 提示词校验门全文（写入 references/prompt-gate.md，AI 在 Gate 触发时按需读取） */
const PROMPT_GATE_BUG_FULL = buildPromptGateBlock(BUG_DIMENSIONS);

const INVESTIGATION_PROTOCOL_FULL = `### 2.2 CodeGraph 排查（分层结构）

把工作流的 CodeGraph 查询体系（状态预检 → 文件扫描 → 符号 + 上下文 → 调用链 + 影响 → **分级** → 探索 + 深度分析）适配到调试排查场景。所有发现实时写入诊断记录（在**每一步**查询之后写入，不得在末尾批量补写），以便 Phase 6 持久化完整排查路径。

#### 2.2.0 能力探测（探测顺序，不是单一工具硬约束）

追踪代码前先按能力探测顺序判定 CodeGraph 是否可用（任一通道成功即视为可用）：

${renderCodegraphProbeOrder({ withCli: true })}

- 任一路径可用：继续使用 2.2.1–2.2.4 的 CodeGraph 工具
- 三通道全部不可用：**仅在此时**才降级（回退）到 Glob（文件结构）与 Grep（符号搜索），并在诊断记录记「CodeGraph 不可用 —— 使用 Glob/Grep 降级」

Grep/Glob 是**最后手段**，仅在能力探测三通道全部失败后允许 —— MUST NOT 作为跳过 CodeGraph 的捷径。降级（回退）MUST NOT 阻断排查，但 MUST NOT 在可用性探测之前采用。

${CODEGRAPH_CALL_DISCIPLINE}

${CODEGRAPH_BUSY_LADDER}

${CODEGRAPH_CLI_BOUNDARY}

#### 2.2.1 文件结构与符号扫描（主通道 \`codegraph_explore\`）

- 用 \`codegraph_explore\` 一次查询获取相关文件树与符号，识别与 bug 描述相关的目录、文件与符号
- 将发现写入诊断记录的代码库发现 > 已发现文件段，格式为 "<file-path>: <relevance-reason>"；符号写入已识别符号段
- 所有文件路径 MUST 用 \`path.join()\` 构造以兼容跨平台（Windows/macOS/Linux）—— 不得硬编码分隔符
- 宿主同时暴露 \`codegraph_files\` / \`codegraph_search\` 时 MAY 追加使用；缺失时 MUST NOT 记为不可用
- 降级（回退）（三通道探测全部失败时）：用 Glob 做文件结构发现、Grep 做符号搜索
- **仅增量（摘要命中范围跳过）**: MUST NOT 重跑已覆盖的 CodeGraph 查询 —— **仅增量查询**（见 2.1.5）；摘要未覆盖的范围照常扫描

#### 2.2.2 任务级上下文（主通道追问式查询）

- 用 \`codegraph_explore\` 以「<bug 描述> 的入口点、相关符号与关键代码」为查询，构建有范围的排查上下文
- 将上下文化结论记入诊断记录（入口点 / 相关符号 / 关键代码位置）
- 降级（回退）：用 Grep 做符号搜索
- **仅增量（摘要命中范围跳过）**: MUST NOT 重跑已覆盖的 CodeGraph 查询 —— **仅增量查询**（见 2.1.5）；摘要未覆盖的符号与上下文照常定位

#### 2.2.3 调用链追踪与影响半径

- **主通道**：以 \`codegraph_explore\` 返回的调用路径（Flow）与受影响符号/文件估算调用链与影响半径
- **可选通道**：宿主同时暴露 \`codegraph_callers\` / \`codegraph_callees\` / \`codegraph_impact\` 时以其结果为准（更精确）；缺失时以上述主通道结果替代，MUST NOT 记为不可用，MUST NOT 反复调用缺失工具
- 将调用链（适用时附 ASCII 图）与受影响符号记入诊断记录，供根因确认
- **仅增量（摘要命中范围跳过）**: MUST NOT 重跑已覆盖的 CodeGraph 查询 —— **仅增量查询**（见 2.1.5）；摘要未覆盖的调用链与影响半径照常追踪

#### 2.2.3.5 排查深度分级（事前选定排查路径）

**⚠️ 强制: 本步在常规查询（2.2.1–2.2.3）之后、深度探索（2.2.4）之前执行。** 三条分级信号全部产自常规查询，故本步不得前移；编号采用**十进制插入**（\`2.2.3.5\`）以**不重排既有编号**（2.2.0–2.2.4 的编号与语义均不变）。

**分级信号（三条客观信号，任一命中即深度路径）**：

- **(a) 影响半径**：\`codegraph_impact\` 在 depth ≤ 2 的受影响符号数 **≥ 5**，或受影响文件数 **≥ 3**
- **(b) 跨模块**：受影响范围跨 **≥ 2** 个模块 / 目录
- **(c) 根因清晰度**：2.2.2（主通道 \`codegraph_explore\` 的任务级上下文）**未能**一步定位单一高置信根因

**分级结果（两条路径）**：

- **轻量路径（路径 A）**：止步于 2.2.1–2.2.3，**不执行** 6 维根因深度分析
- **深度路径（路径 B）**：进入 2.2.4 执行 \`codegraph_explore\` + 6 维根因深度分析

**保守取值**：信号缺失或落在阈值边界（无法判定是否超阈）时**取深度路径** —— 误走深度路径的代价是查询成本，误走轻量路径的代价是**漏检根因**（不可逆），宁可多查不漏。

**信号降级（CodeGraph 不可用时分级仍生效）**：

- 信号 **(a)** 降级为 **Grep 代理指标**（以 2.2.1 的文件结构扫描结果计受影响文件数，阈值同 3）
- 信号 **(b)(c)** 不依赖 CodeGraph，照常判定
- 诊断记录 MUST 标注「信号降级」；**MUST NOT 因 CodeGraph 不可用而跳过分级**

**信号可追溯（反幻觉硬约束）**：信号取值 MUST 可追溯至 \`codegraph_explore\` 主通道结果（可选通道 \`codegraph_impact\` / \`codegraph_files\` 存在时以之为准；降级时为 Grep）的**实测查询结果**并在诊断记录留痕；MUST NOT 以"半径小"等未经实测的结论支撑轻量路径判定（违反零猜测原则）。

**与 2.4 解耦**：分级结果**只**影响 2.2.4 是否执行；2.4 诊断确认包内的缺陷链路对两条路径**均强制**产出，轻量路径 MUST NOT 豁免。

**两轨同等生效**：复现优先轨道与证据优先轨道 MUST 共用同一分级口径 —— 轨道只决定 Phase 1 的证据形态，MUST NOT 改变分级信号、路径选择或排查步骤（证据优先轨道 MUST NOT 跳过 2.2.1–2.2.3 的常规查询，也 MUST NOT 免于本步分级）。

**记录规范**：分级结论（三条信号取值 + 所选路径 + 是否降级）随 Step 2.2 的记录规范一并实时写入诊断记录，供 Phase 6 随根因分析持久化到变更 \`exploration.md\`。

#### 2.2.4 深度探索与根因深度分析（条件触发）

**Trigger**: 满足以下任一条件时执行本节 ——

1. **分级为深度路径（2.2.3.5 路径 B）** —— 即便已一步定位到单一高置信根因，大范围 / 跨模块缺陷仍须经 6 维分析确认是否存在未检视的系统性根因（设计意图 / 约束 / 权衡 / 模式 / 历史边界 / 隐式假设）
2. **升级兜底**：轻量路径（路径 A）下 2.2.1–2.2.3 **未能**定位单一高置信根因（多候选或置信不足）

**仅当**分级为轻量路径 **且** 已定位单一高置信根因时，SKIP 本节以让简单缺陷走轻量路径。

**⚠️ 兜底是触发条件，不是独立步骤**：本节的内容与编号（2.2.4）**保持不变**；升级兜底即上述条件 2，MUST NOT 为其新建独立章节或编号。

**两轨同等触发**：上述触发条件在复现优先与证据优先两条轨道下**同等生效**，轨道 MUST NOT 改变 2.2.4 的触发判定。

触发时：
- \`codegraph_explore\` —— 深度探索疑似代码区域
- 6 维根因深度分析（改写自 workflow 的实现深度分析，重心移到根因定位 —— 根因常隐藏在「代码为何如此设计」之中）：
  - **设计意图（Design Rationale）** —— 代码为何如此设计（代码注释、docstring、ADR）—— 根因可能是被违背的设计意图
  - **约束（Constraints）** —— 塑造该代码的硬约束（配置文件、linter 规则）—— 根因可能是已不再成立的约束
  - **权衡（Trade-offs）** —— 被有意接受的多方案权衡（TODO/FIXME/HACK 注释）—— 根因可能是在新条件下失效的权衡
  - **模式运用（Pattern Usage）** —— 采用的设计模式（类/接口结构）—— 根因可能是模式误用
  - **历史背景（Historical Context）** —— 设计演进（\`git log --follow\`、\`git blame\`）—— 根因可能是被有意接受的历史边界情形（交叉参照能力记忆的边界场景）
  - **隐式假设（Implicit Assumptions）** —— 无文档的假设（类型守卫、默认值、缺失的空值检查）—— 根因常隐藏于此
- 将发现写入诊断记录的实现深度分析段；无发现的维度标注 "<!-- No findings -->"
- 衔接 2.4 诊断确认包：多候选 → 先 STOP 让用户选根因，再确认对应链路；单一高置信根因把证据与链路放入同一确认包；深度分析洞见辅助确认

#### 2.2.4.5 摘要增量写入（与诊断记录并行）

**⚠️ 强制: 2.2.1–2.2.4 每步完成后执行。** 每一步的结论 MUST 以**增量追加**方式写入 \`.openspec-tmp/debug-<keyword>/investigation-digest.md\` —— 按步骤顺序追加，不批量补写、不重写已有段落。

**并行写入、互不替代**：本步与「实时写诊断记录」（见下节 记录规范）**并行执行** —— 摘要写入 MUST NOT 替代诊断记录，诊断记录写入也 MUST NOT 替代摘要，两者各自独立完整。

#### 记录规范（所有子节共用）

所有 CodeGraph 发现（已发现文件 / 已识别符号 / 调用链 / 影响半径 / 实现深度分析）MUST 结构化写入诊断记录的对应子段，并在**每一步**查询之后实时更新（不得在排查末尾批量补写）。CodeGraph 不可用而使用 Glob/Grep 降级（回退）时，发现仍遵循同一结构并注明降级 —— MUST NOT 因降级而丢失排查可追溯性。

`;

/** 功能流程图全文（写入 references/flowchart-gate.md，AI 在流程生成时按需读取） */
const FLOWCHART_FAULT_FULL = `${buildFlowchartBlock(FAULT_CHAIN_FLOW_COLUMNS)}
### 缺陷链路变体细则

- **节点范围只覆盖缺陷链路**：前置条件 → 触发 → 异常 → 根因；MUST NOT 展开被测功能的完整业务流程
- **节点粒度** = 可独立验证的业务操作单元；节点标识在图中与表中 MUST 一致；节点数超 50 时按子流程分节；本块 MUST NOT 含任何 Bash 命令示例
- **节点清单列集**：节点 / 操作 / 证据位置 / 标记
- **标记**：异常现象节点 MUST 标 \`🔴异常\`、根因节点 MUST 标 \`🟠根因\`，其余节点以 "—" 占位
- **证据追溯（硬约束）**：每节点 MUST 填 \`文件:行\` 或 类.方法；无法追溯证据的节点 MUST NOT 进入清单
- **与分级解耦**：2.2.3.5 的排查深度分级结果 MUST NOT 影响本步产出；**验证口径**：修复方案与回归测试 MUST 覆盖「异常节点 + 根因节点」
- **回改规则**：发现遗漏节点 MUST 回排查更新并重新确认，MUST NOT 在任务清单静默补节点`;

/** 排查期 grill 纸迹纪律全文（写入 references/grill-discipline.md；主文件 §2.3 仅保留 Read 指引，保证 ≤500 行） */
const GRILL_DISCIPLINE_FULL = `### 2.3 排查期间的 grill-with-docs 纪律

在收敛根因时应用完整纪律，MUST NOT 以「缩减版」为由省略任一纪律：

- **一次一个问题**：需要用户输入时，只问一个问题并等待
- **术语冲突检测（先读后写）**：写入 \`openspec/CONTEXT.md\` 前 MUST 先读取既有条目；同名术语已存在且定义不一致时，MUST 在接受新用法前指出冲突并显式裁决——更新定义，或保留旧定义并标注「已过时（由 <change-name> 取代）」；MUST NOT 静默追加第二条同义条目
- **ADR 三条件判定**：仅当（1）难以逆转、（2）脱离上下文令人意外、（3）是真实权衡的结果，三条件**同时**满足时才写 \`openspec/docs/adr/\`；不满足时不产出（正常态），MUST NOT 为凑纸迹而写
- **边界场景构造**：对每个已确认的根因决策 MUST 构造 ≥1 边界场景（网络故障 / 超时 / 非法输入 / 并发访问），并写入诊断记录（可选同步探索文件边界场景段）；MUST NOT 只保留在对话中
- **实时更新记录**：每次问答交换后都更新诊断记录（根因假设、证据、边界场景）—— 不得在末尾批量补写
`;

/** 规则基线 / 测试证据 / 一致性门细则（写入 references/gates-and-rules.md，主文件保留指针以守 500 行预算） */
const GATES_AND_RULES_FULL = `### 2.1.6 项目规则基线（强制）

**⚠️ 强制: 本步在 2.1.5 之后、2.2 CodeGraph 排查之前执行。**

1. 运行 \`iagent rules --json\` 枚举规则源（\`.iagent/config.yaml\`、\`.iagent/rules/*.md\`、\`CLAUDE.md\`、\`AGENTS.md\`；**不**包含 \`openspec/rules/**\`）
2. 读取全部 \`exists=true\` 的源，并把「源 / 存在性 / 读取状态 / 关键约束摘要」写入诊断记录（Phase 6 随根因分析持久化到变更 \`exploration.md\`）
3. 源缺失 → 记「不存在」（合法终态，不阻断）；读取失败 → WARN 并标「未读」，MUST NOT 伪装为已读；全部源缺失 → 记「无规则源」并继续

**强制检查点**：规则基线未建立时 MUST NOT 进入 2.2；规则源缺失不阻断排查。

### 2.1.7 项目技能基线（强制）

**⚠️ 强制: 本步在 2.1.6 之后、2.2 CodeGraph 排查之前执行。**

1. 运行 \`iagent skills --json\` 枚举配置技能，**按阶段筛选** \`phases\` 含 \`design\` 或 \`both\`（implement-only 不进入设计约束）
2. 读取全部 \`exists=true\` 的技能，把「源 / 存在性 / 读取状态 / 完整性 / 关键约束摘要」写入诊断记录（与规则基线并列、互不替代）
3. 配置为空 / 全部缺失 → 记「无技能配置」并继续；读取失败 → WARN 并标「未读」；\`validation.status=incomplete\` → WARN 并列出缺失章节 / 占位符 / 无证据规则数，MUST NOT 当作完整规范使用
4. 根因分析与修复方案以技能为约束；技能与代码冲突时显式呈现（代码事实优先）

**强制检查点**：技能基线未建立时 MUST NOT 进入 2.2；配置为空不阻断排查。

## Phase 5.5: 变更范围内测试执行（强制）

**位置**：Phase 5 编译检查之后、Phase 6 同步之前。

- **范围**：本次修复改动文件对应的既有测试 + 4.2 生成的回归测试；MUST NOT 把全量套件结果作为通过/失败判据
- **运行**：按项目技术栈探测测试命令（Java \`mvn test\` / \`gradle test\`；Node \`pnpm test\` / \`npm test\`；Go \`go test ./...\`；Rust \`cargo test\`）；仅运行变更范围（可按测试类 / 文件过滤）
- **失败处置**：范围内失败进入与编译检查相同的自动修复重试预算（≤3）；耗尽即写 \`fail\` 证据并暂停，MUST NOT 进入 Phase 6 / 归档；范围外存量失败仅 WARN 且 MUST NOT 阻塞
- **证据**：写 \`.openspec-tmp/pipeline-<change-name>/test-report.md\`（九列 + \`**summary**:\` 汇总行；无测试框架 → \`not-applicable\` 并记 WARN），向 handoff 包 \`## 阶段结论\` 追加 \`test\` 行
- **边界**：debug MUST NOT 因本步骤额外生成单测 —— 新增测试由 4.2 回归测试承担，避免重复生成

## 6.4 实现一致性证据（强制）

- 运行 \`iagent spec conformance --change "<changeName>" --strict --rules-read "<逗号分隔的已读取规则源>" --json\`，校验三层覆盖与回执 \`rulesRead\` 对规则源 \`exists=true\` 集合的覆盖；并校验 \`skillsRead\` 对 \`phases\` 含 \`implement\` 或 \`both\` 且 \`exists=true\` 的技能覆盖（design-only 不要求）——存在未读 → \`skills-not-read\`（fail）；已读但 \`validation.status=incomplete\` → \`skills-incomplete\`（WARN，不判 fail）
- 写 \`.openspec-tmp/pipeline-<change-name>/conformance-report.md\`（九列 + \`**summary**:\` 汇总行），向 handoff 包追加 \`conformance\` 行
- \`fail\` / 证据缺失 → 回到 Phase 4 修复，MUST NOT 进入 Phase 7

## 7.0 实现一致性证据消费（强制）

- 读取 \`.openspec-tmp/pipeline-<change-name>/conformance-report.md\` 的 \`**summary**:\` 行；\`status=pass\` 放行，\`fail\` / 缺失 → 回到 Phase 4 修复，MUST NOT 宣告可归档
- 读取 \`test-report.md\` 的汇总行作为测试门结论（\`pass\` / \`not-applicable\` / \`disabled\` 放行）
- debug MUST NOT 自行重跑 conformance / 测试命令或另立判定；证据由 Phase 5.5 / 6.4 单点产出
`;

export function getDebugSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_debug',
        description: '一站式调试工作流：复现→用 CodeGraph 与能力记忆调查根因→变更关联→带强制回归测试的修复→编译检查→同步提案→验证；触发词"调试 / debug / 修复 bug / bug 报告 / 复现 / 根因"；NOT for：新功能开发用 iagent_workflow、单一阶段探索用 iagent_spec_explore',
        instructions: `
**适用项目护栏（impl 域蒸馏，来源：\`.iagent/config.yaml\` 的 context/rules、\`.iagent/rules/*.md\`、\`CLAUDE.md\`、\`AGENTS.md\`；用 \`iagent rules --json\` 枚举；项目技能用 \`iagent skills --json\` 枚举并记录完整性）。** 未定义项标 **[待确认]**，禁止猜测。

从复现到提案同步的一站式调试工作流。

本工作流引导你依次完成：
1. **复现阶段（双轨入口）** —— 默认轨道为复现优先（失败测试或用户确认的显式步骤作为验收判据）；仅在无复现条件且具备 \`文件:行\` / 日志 / 测试硬证据时启用证据优先轨道，证据类型记入 \`evidenceType\`；两轨均无硬证据时只报告候选、不修复
2. **排查阶段** —— 能力记忆注入 + CodeGraph 根因分析 + 排查深度分级（2.2.3.5：按影响半径 / 跨模块 / 根因清晰度选轻量或深度路径）+ grill-with-docs 纪律
3. **关联变更判定阶段** —— 判定 bug 归属哪个变更（进行中 / 新建修复变更 / 已归档来源 / 非缺陷），并在 2.4 之前收束出 \`changeName\` 与 \`affectedSymbols\`
4. **修复阶段** —— 「诊断 + 方案」合并包内一次确认方案（多方案在包内选定；唯一方案给唯一性证据后随包直通；回退路径下方案门仅多方案时阻塞）→ 精准修复 → 由主 agent 内联调用 \`iagent_test\` 生成回归测试并验收
5. **调试循环** —— 每次修复后可继续报告相关 bug（**非阻塞提示，不构成确认门**；用户主动提出时才追加循环），否则进入统一的 P5-P7
6. **编译检查阶段** —— 复用 iagent_spec_apply 技能的编译检查约定（覆盖所有循环修复）
7. **同步阶段** —— 更新变更制品并持久化所有根因分析（覆盖所有循环修复）
8. **验证收束阶段（verify-close）** —— 失败时自动修复循环；通过后先深度复查，再直接收束（无需求文档桥）（覆盖所有循环修复）

**宿主阶段对应（宿主无关协议）**：Phase 1–3（含 2.4「诊断 + 方案」合并确认包收束与 2.3.5 变更归属判定）对应 \`investigate\` —— 交付 \`rootCause\` / \`defectChain\` / \`changeName\` / \`affectedSymbols\` / \`fixDecision\`（方案在 2.4 合并包内随根因一并确认）；Phase 4 对应 \`fix\` —— 方案确认门绑定条件 \`multiple-fix-options\`（合并包已产出 \`fixDecision\` 时门通常不适用；回退路径下存在多个可行方案置真→阻塞待确认；唯一且证据充分置假→门不适用、直通）；Phase 5–7 对应 \`verify-close\` —— 消费 fix 结果并交付验证/深度复查/可归档结论（无需求文档状态）。全部阶段仍由单一 \`iagent_debug\` 全流程技能承载，不拆分为多个对外技能。

${GATE_PROTOCOL_PREAMBLE}

${renderGateWhitelistSection()}

---
## Startup

**Input**: 命令后的参数为 bug 描述（症状、错误信息或失败行为）。

- 提供了描述时，记录之并进入 Phase 1
- 未提供描述时，提示用户：「请描述该 bug：症状、错误信息，以及（如已知）复现步骤」—— 收到描述后才开始

### 0. 提示词校验门（缺陷五维，强制）

**⚠️ 强制: 本门在 Phase 1 强制复现之前执行，不得跳过。**

**执行前置**：用户最初未提供 bug 描述、由本技能提示后补充的，以补充内容为原始提示词执行本门；**MUST NOT 对空输入执行校验**。

**提示词校验门**: 探索前强制自检用户输入，维度为 症状 Symptom / 复现步骤 Repro / 期望 vs 实际 Expected vs Actual / 环境 Environment / 歧义 Ambiguity。
- **清晰**（症状 Symptom / 复现步骤 Repro / 期望 vs 实际 Expected vs Actual / 歧义 Ambiguity 均无 \`❌\` 与实质 \`⚠️\`）→ 一句话复述理解后直通，不输出校验表、不要求确认
- **不明确**（任一维 \`❌\` 或实质 \`⚠️\`）→ 先做提示词优化，输出 \`【优化后提示词】\`（推断项标 \`[推断]\`、未知项标 \`[待确认]\`）与 \`【优化说明】\`，**⛔ GATE: 立即结束本次响应并等待用户确认或修改**（本次响应到此结束，收到用户响应后继续；出口：确认 / 修改 / 拒绝 / 显式授权按推断），**不得陷入等待死循环**
- **软不明确**（仅细节级歧义）→ 记 \`[假设]\` 继续
- 优化**不篡改原始意图**、不增加用户未提出的需求
- 校验结论与基线写入探索产物 \`## 提示词基线\` 段，作为下游唯一语义来源
- 空输入不校验；输入为变更名时以该变更既有制品为校验对象；上游已产出基线时直接通过

> **完整门细则**见 references/prompt-gate.md。**仅在 Gate 实际触发时**读取全文细则。

**本技能内的执行要求**：

- 门的位置固定在此处：记录 bug 描述之后、TodoWrite 初始化与 Phase 1 复现之前
- 缺陷版的「复现步骤」维与 Phase 1 的复现要求直接衔接：维度判定出的期望与实际在 Phase 1 成为复现的验收判据；该维的判定结果同时是 Phase 1 默认轨道判定的输入之一（见 1.0：与 \`reproductionStatus\` 联合判定，无法判定时默认复现优先）
- 不明确分支的确认门是**澄清门（确认 WHAT）**：用户确认或修改前 MUST NOT 进入 Phase 1，**MUST NOT 凭猜测编写失败测试**
- 校验结论（原始提示词 + 确认后的提示词基线）写入诊断记录的 \`## 提示词基线\` 段（Phase 6 随根因分析一并持久化到变更 exploration.md）

使用 **TodoWrite 工具**初始化跟踪：
\`\`\`
[{"content": "Bug #1: Phase 1 复现", "status": "in_progress"},
 {"content": "Bug #1: Phase 2 排查定位", "status": "pending"},
 {"content": "Bug #1: Phase 3 关联变更判定", "status": "pending"},
 {"content": "Bug #1: Phase 4 修复 + 回归测试", "status": "pending"},
 {"content": "Phase 5: 编译检查 (汇总所有修复)", "status": "pending"},
 {"content": "Phase 6: 同步提案 (汇总所有修复)", "status": "pending"},
 {"content": "Phase 7: 验证 (覆盖所有修复)", "status": "pending"}]
\`\`\`

**动态 bug 跟踪**：调试循环继续到新 bug 时，向 TodoWrite 列表追加该 bug 的 P1-P4 阶段条目。每个 bug 的各阶段完成时标记为完成。例如：
\`\`\`
[{"content": "Bug #1: Phase 1 复现", "status": "completed"},
 {"content": "Bug #1: Phase 2 排查定位", "status": "completed"},
 {"content": "Bug #1: Phase 3 关联变更判定", "status": "completed"},
 {"content": "Bug #1: Phase 4 修复 + 回归测试", "status": "completed"},
 {"content": "Bug #2: Phase 1 复现", "status": "in_progress"},
 {"content": "Bug #2: Phase 2 排查定位", "status": "pending"},
 ...]
\`\`\`

---
## 执行方式与增量复验（强制）

investigate / verify-close 内联；fix（修复 + 编译检查 + 范围内测试）由主 agent 内联执行，共用既有重试预算（≤3）；iagent_test 由主 agent 内联调用（不改为子代理）。增量复验：验证 FAIL 修复后**在同一主上下文**按 fixDiff 与上轮 reportPath 增量重跑清单，禁止新开验证代理、禁止重读未改动制品或全量重读；禁止 resume 充当复验（contextReplay=true 记 WARN）；循环上限 3 次。verify-close 内验证 / 复查均为内联（覆盖 D1-D10 + B1-B7 清单，每条结论带 \`文件:行\` 证据）。内联执行前先读 handoff 包「## 制品清单」并按锚点增量读取，回执写 readScope；「## 阶段结论」5 列（tokens 可用时填 tokens=<数值>，不可得填 —）。

## Phase 1: 复现（双轨入口：默认复现优先，证据优先为条件轨道）

**⚠️ 强制: 在修改任何代码之前 MUST 先建立可验证的缺陷证据 —— 默认轨道是复现（失败测试或用户确认的显式步骤）；仅在无复现条件时启用证据优先轨道（\`文件:行\` / 日志 / 测试硬证据）。两轨均无硬证据时只报告候选、不修复（零假设原则）。**

### 1.0 复现契约与默认轨道判定（强制）

Phase 1 MUST 产出**复现契约**并写入诊断记录：\`reproductionStatus\` 取 \`reproduced\` / \`not-reproduced\` / \`intermittent\` / \`static-only\`；\`evidenceType\` 取 \`failing-test\` / \`manual-steps\` / \`log-trace\` / \`static-proof\` / \`review-finding\`（Phase 6 随根因分析持久化）。

**默认轨道 = 复现优先。** 轨道判定 MUST 联合两个信号，MUST NOT 只看其中一个：① 提示词校验门「复现步骤 Repro」维能否判定触发方式；② \`reproductionStatus\`。

- 复现步骤维可判定触发方式 **且** \`reproductionStatus = reproduced\` → **复现优先轨道**（默认轨道，与既有实现逐条一致）
- 无可执行复现条件 **且** 存在硬证据（\`文件:行\` 静态证据 / 日志 / 测试证据）→ **证据优先轨道**（见 1.3）
- 两者冲突或**无法判定时默认复现优先**（fail-safe：误走复现优先的代价是多一次复现尝试，误走证据优先的代价是降低验收判据）

两条轨道 MUST 共用 2.2.3.5 排查深度分级（路径 A / 路径 B）、2.4「诊断 + 方案」确认包与缺陷链路图，以及 4.2 回归测试口径 —— 轨道只决定证据形态，MUST NOT 改变排查与验收标准。

### 1.1 经失败测试复现（复现优先轨道的首选）

定位或编写一个能演示该 bug 的测试 → 运行并确认其因所报原因 FAIL（而非无关的环境搭建错误）→ 记录测试文件路径 / 测试名 / 期望与实际，并置 \`reproductionStatus = reproduced\`、\`evidenceType = failing-test\`。

**边界（强制）**：本步测试仅作为**失败证据**（可为临时测试），**不构成回归测试** —— 正式回归测试在 4.2 由 \`iagent_test\` 生成或改造落库，MUST NOT 以本步的临时测试充当唯一回归测试。

### 1.2 经显式步骤复现（复现优先轨道）

bug 无法用自动化测试捕获时（环境相关行为 / 时序 / 仅 UI）：记录显式复现步骤（编号步骤、输入、期望结果、实际结果）→ 向用户呈现并确认其与观察到的行为一致 → 置 \`reproductionStatus = reproduced\`、\`evidenceType = manual-steps\`。复现确认之前不应用任何修复。

### 1.3 证据优先轨道（仅在无复现条件时启用）

**启用条件（同时满足）**：不存在可执行的复现条件（无测试入口 / 无法构造输入 / 环境不可重建）**且**存在指向具体代码或日志的**硬证据**（\`文件:行\` 静态证据，或日志 / 测试证据）。

**证据门槛**：\`not-reproduced\` / \`static-only\` MUST 具备 \`文件:行\` 静态证据或日志 / 测试证据，否则不得进入修复；\`intermittent\`（时好时坏）MUST 取得至少一条**可重复**的证据（日志 / 测试 / 静态证明）并记录复现条件，MUST NOT 凭单次偶然现象进入修复；\`evidenceType\` MUST 记下本次依据的证据类型，使「凭什么修」可审计。

**无证据出口**：证据不足时只报告**候选根因 / 候选缺陷**清单与已尝试的调查动作并停止 —— MUST NOT 修改代码、MUST NOT 新建变更、MUST NOT 标记可归档。该出口是「证据不足」，与 3.5 非缺陷退出（行为符合预期）语义不同，MUST NOT 混用。

**强制检查点**：复现优先轨道复现确认之前不应用任何修复；证据优先轨道证据门槛未满足时不应用任何修复；两轨均无硬证据时只报告候选并停止 —— MUST NOT 在假设下修复，不凭假设修复（零猜测原则）；所报行为完全无法触发且不存在任何缺陷证据时，进入 Phase 2 排查其是否属于非缺陷（预期行为）。

将复现证据与复现契约（\`reproductionStatus\` / \`evidenceType\`）更新到诊断记录（工作笔记中的草稿段，Phase 6 再持久化）。

---
## Phase 2: 排查定位

**⚠️ 强制: 排查期间注入能力记忆并应用 grill-with-docs 纪律。**

### 2.1 能力探索记忆注入

1. 由受影响代码与 bug 描述推断 bug 所属的能力（模块）
   - 用 Glob 工具扫描 \`openspec/specs/\` 下的目录名并与受影响区域匹配
2. 对每个涉及的能力 \`<capability>\`，检查 \`openspec/specs/<capability>/explorations.md\` 是否存在（用 \`path.join()\`）
3. 若存在：读取并将历史 Decisions、术语与边界场景注入排查上下文
   - 标记为 \`已过时（由 <change-name> 取代）\` 的段落**仅**作历史参考 —— 取代它的变更的决策才是当前有效
   - 历史边界场景常是根因线索：bug 可能是被有意接受的已知边界情形
4. 无记忆文件时：记录「无能力级探索记忆 — 全新排查」并继续

#### 2.1.5 流程级探查摘要（investigation-digest）

**⚠️ 强制: 本步在 2.1 能力记忆注入之后、2.2 CodeGraph 排查之前执行。**

**载体**：\`.openspec-tmp/debug-<keyword>/investigation-digest.md\` —— 以 \`path.join()\` 构造（跨平台）。

**\`<keyword>\` 规则**：为该次调试主题的 **kebab-case 关键词**，与 \`openspec/explorations/<keyword>-explore-<sequence>.md\` 的关键词**同源同规则**（小写、连字符分隔、剔除非法字符，上限 50 字符）；**MUST NOT 直接使用 bug 描述原文**（避免空格与非法字符导致路径不可用）。

**三分支（先做存在性判定，再决定查询与写入策略）**：

1. **摘要存在** → **先读摘要**，复用其中**命中范围**的结论，**仅在摘要未覆盖的范围执行查询**（增量查询）；MUST NOT 重跑已覆盖区域
2. **摘要不存在** → 初始化空摘要，按常规流程执行 2.2.1–2.2.3，并在每步完成后**逐步骤增量写入**结论
3. **工作区不可写（落盘失败）** → 降级为「仅会话内复用」+ WARN（记录失败原因与目标路径）；排查与修复流程 **MUST NOT 被阻断**

**非交付物划界（强制）**：摘要**仅为流程内缓存**，MUST NOT 替代诊断记录，MUST NOT 替代 Phase 6 对变更 \`exploration.md\` 的持久化；清理摘要 MUST NOT 影响任何交付物。

**失效规则**：某 bug 的修复改动了代码后，摘要中**受影响范围**的结论 SHALL 标记为失效，标记格式逐字如下：

> 已失效（由 <bug 标识> 修复改动代码）

并在**下次进入 Phase 2 时重新查询**该范围；MUST NOT 复用已失效结论。

**2.1.6 项目规则基线（强制）** / **2.1.7 项目技能基线（强制）**：执行与失败处置见 \`references/gates-and-rules.md\`；规则基线 / 技能基线未建立时 MUST NOT 进入 2.2（规则源缺失 / 配置为空不阻断；\`validation.status=incomplete\` 记 WARN）。

> **排查细则下沉**：CodeGraph 分层排查协议与 2.2.3.5 排查深度分级见 \`references/investigation-protocol.md\`；执行 2.2 前 MUST 先 \`Read\` 该文件。

### 2.3 排查期间的 grill-with-docs 纪律

> 完整纪律见 \`references/grill-discipline.md\`；执行本步前 MUST 先 \`Read\`。术语冲突检测（写入 CONTEXT.md 前先读、同名冲突显式裁决）、ADR 三条件判定、边界场景构造三项 MUST NOT 以「缩减版」为由省略。

### 2.3.5 变更归属判定（Phase 3 前移，MUST 在 2.4 之前完成）

**⚠️ 强制顺序**：本步在 2.4「诊断 + 方案」合并包**之前**完成 —— 合并包要同时携带方案与归属结论，故 MUST 先产出 \`changeName\` 与 \`affectedSymbols\`，再进入 2.4（原 Phase 3 的位置已前移；子步骤编号沿用 3.x 以保持可追溯）。

在修复之前先判定 bug 归属哪个变更。

#### 3.1 bug 来自进行中的变更

受影响代码属于 \`openspec/changes/\` 下某个未归档变更 → 修复更新**该**变更，Phase 4–7 针对它运作。

#### 3.2 独立 bug（无归属变更）

不属于任何进行中变更 → **自动创建，不询问用户**：立即执行 \`iagent spec new "fix-<module>-<topic>"\`（module 从受影响代码路径推导，kebab-case）—— MUST NOT 提示「是否新建变更？」或等待确认；修复在新变更下进行。

#### 3.3 bug 来自已归档变更

受影响代码属于 \`openspec/changes/archive/\` 下某个变更 → **绝不可修改已归档目录**（归档是历史事实）；新建变更并在其 proposal 中引用原归档变更名以保持可追溯。

#### 3.5 非缺陷退出（诊断报告收尾）

当 Phase 2 结论为行为符合预期时：

- 输出诊断报告：症状、排查路径、证明行为符合预期的代码/测试证据
- MUST NOT 新建变更，MUST NOT 修改代码
- 持久化诊断记录并告知用户结论 —— 工作流到此结束
- **与 1.3 证据不足出口的区别**：本出口是「行为符合预期」，1.3 是「证据不足以判定与修复」—— 结论不同，MUST NOT 互相替代

#### 3.6 变更归属收束（investigate handoff）

- 归属判定完成后 MUST 明确 \`changeName\`（进行中变更名 / 自动新建的 \`fix-<module>-<topic>\` / 新修复变更名）；缺失时 \`fix\` 阶段 MUST NOT 启动并按回执校验规则报告不完整
- 同步确定 \`affectedSymbols\`（受影响符号清单）；与 \`rootCause\` / \`defectChain\` / \`fixDecision\` 一并构成 \`investigate\` 阶段的 handoff
- **方案决策同属 investigate**：2.4 合并包内确认的修复方案 SHALL 作为 \`fixDecision\` 随 \`investigate\` 交付 —— 归属与方案同批交付，\`fix\` 阶段 MUST NOT 再制造第二次方案确认停点
- **摘要作为 handoff 包来源（不重复探查）**：\`changeName\` 确定后，\`investigation-digest\` 的既有结论 SHALL 作为 \`.openspec-tmp/pipeline-<changeName>/handoff-pack.md\` 的 \`## Codebase 摘要\` 节来源之一；MUST NOT 因写入包而重新执行已覆盖的探查，也 MUST NOT 把摘要内容改写为交付物（摘要仍只是流程内缓存）

**回退路径判定（何时不得前移）**：归属判定依赖根因之外的上下文 —— **多变更候选**、**归档来源追溯**、**范围待定** —— 时 MUST NOT 强行给出 \`changeName\`，2.4 退回纯诊断确认，方案改由 4.0 条件门确认（仅多方案触发，见 2.4 末段）。

### 2.4 根因与修复方案诊断确认包（强制检查点，零猜测原则）

**前置**：2.3.5 的变更归属判定已完成（\`changeName\` / \`affectedSymbols\` 已确定）；属回退路径时见本节末尾。

**本步是「诊断 + 方案」单一确认包** —— 同一确认包内**一次确认**同时确认根因与方案；Phase 4 MUST NOT 再停一次方案确认门。

确认包 MUST 同时呈现四部分：**根因证据**（调用链 / 受影响符号 / 复现或证据关联，含 Phase 1 的 \`reproductionStatus\` 与 \`evidenceType\`）；**缺陷链路图**（诊断记录的 \`## 功能流程（缺陷链路）\` 段，细则见下）；**修复方案**（唯一方案须给出唯一性证据 —— 项目约束与 \`文件:行\` 代码证据；多方案逐项给出做法 / 影响（模块 / 兼容性 / 风险）/ 建议）；**变更归属结论**（\`changeName\` + \`affectedSymbols\`）。

诊断结论按根因置信度分两条入口，但**确认包只有一个**：

- **单一高置信根因**：把**根因证据**与**据此推导的缺陷链路**、**修复方案**放在**同一个**确认包中一次呈现，等待**一次**确认
- **多个候选或置信不足**：先 STOP，呈现候选清单及每个候选的证据与建议，等待用户**选定根因**；选定后在**同一**确认包内呈现据此生成的缺陷链路与修复方案（同一逻辑诊断门内的第二段）。未完成前 MUST NOT 修改任何代码
- **排查结论为非缺陷**：所报行为为预期 —— 转入非缺陷分支（3.5）

**⛔ GATE: 流程最终确认门（强制停止）—— 「诊断 + 方案」合并确认包** — 呈现后立即结束本次响应并等待确认；出口：确认 / 修改 / 拒绝（三条，见下表）：

| 出口 | 行为 |
|------|------|
| 确认 | 同时确认根因与方案 → 进入 Phase 4（修复）；方案涉及数据库 / schema 时仍须执行 4.0 的独立 DDL 确认 |
| 修改 | 更新根因 / 缺陷链路 / 方案后重新呈现**同一**确认包 |
| 拒绝 | **终止修复**并输出诊断报告（含排查路径与证据）；MUST NOT 修改代码、MUST NOT 自动按推断继续、MUST NOT 标记可归档 |

**回退路径（两次停点）**：变更归属依赖根因外上下文（多变更候选 / 归档来源追溯 / 范围待定）时，本包退回**纯诊断确认**（根因证据 + 缺陷链路，不含方案），方案改由 4.0 条件门确认；此时 4.0 仅在存在多个可行方案时触发。

**合并只合并确认面，不删除门**：诊断确认门与修复方案条件门仍是门白名单内的两个既有门（每阶段至多 1 个阻塞门），MUST NOT 因合并新增或删除任何门。

**功能流程图（缺陷链路变体，确认包内必需内容）**：固化为诊断记录的 \`## 功能流程（缺陷链路）\` 段（\`## 功能流程图\` 的缺陷链路变体，Mermaid \`flowchart TD\` + 节点清单表）；节点只覆盖「前置条件 → 触发 → 异常 → 根因」，异常节点标 \`🔴异常\`、根因节点标 \`🟠根因\`，每节点 MUST 有 \`文件:行\` 证据；修复与回归测试 MUST 覆盖异常节点 + 根因节点。完整节点 / 边界 / 回改规则见 \`references/flowchart-gate.md\`。

> **完整流程图细则**见 references/flowchart-gate.md。**仅在流程浮现时**读取全文细则。

---
## Phase 4: 修复（方案判定 → 实施 → 回归测试）

按 iagent_spec_apply 技能的任务执行规范实现修复（变更归属与方案已在 2.3.5 / 2.4 收束）；修复前读取 \`phases\` 含 \`implement\` 或 \`both\` 的项目技能并在修复回执记录 \`skillsRead\` / \`skillsIncomplete\`（design-only 不要求）；一致性门按 implement|both 过滤（\`skills-not-read\` fail / \`skills-incomplete\` WARN）。

### 4.0 可行修复方案数量判定（回退路径条件门）

**触发条件**：方案在 2.4「诊断 + 方案」合并包内已随根因一次确认时，本步**不停点**，直接进入 4.1；本门仅在**回退路径**下生效，且仅存在多个可行方案时触发。

- **多个可行方案（回退路径）**：**⛔ GATE: 修复方案确认门（强制停止）** — 展示每个方案的做法、影响（模块 / 兼容性 / 风险）与建议，等待用户确认其中一项；用户拒绝或要求修改时 MUST NOT 实现
- **只有一个明确可行方案**：仅当项目约束与代码证据（引用具体约束与 \`文件:行\`）支持其唯一性时，说明唯一性依据后**直通实现**，不新增方案确认停顿
- **唯一性证据不足**：MUST 按多方案处理（不得凭"看起来只有一种"直通）
- **既有独立确认仍保留**：方案涉及数据库 / schema 变更时，仍须按 4.1 单独输出 DDL 并在应用前取得显式确认 —— 唯一方案直通规则 MUST NOT 绕过该确认
- 该门是**条件门**：回退路径下多方案（\`multiple-fix-options = true\`）时阻塞待确认；唯一且证据充分（\`false\`）时门不适用；合并包已确认方案时门不适用

### 4.0.5 修复循环的执行形态（主 agent 内联，强制）

- **执行方式**：fix 阶段由**主 agent 内联**执行（\`executionMode=inline\`）—— 修复、编译检查与范围内测试均由同一主上下文完成，MUST NOT 为修复派生 Agent 子代理；兼容窗内旧 \`subagent\` 回执记 deprecation WARN 并允许推进（下个 major 收紧为仅 \`inline\`）。
- **按 bug 顺序处理**：循环内每个 bug 依次在同一上下文修复与验收；同一文件被多个 bug 触及时 MUST 串行处理，不并发写入同一文件。
- **共享读取范围**：主 agent 只读「\`investigation-digest\` 摘要 + 本 bug 清单 + 文件归属」与 handoff 包命中范围，MUST NOT 全量重读已覆盖制品或重跑已覆盖的 CodeGraph 查询。
- **共用重试预算**：修复、编译检查与范围内测试共用既有预算（≤3 次）；超限暂停并报告剩余错误（含 \`文件:行\`），MUST NOT 静默通过。
- **收束归属**：任务状态、回归测试验收与阶段推进由主 agent 集中管理；MUST NOT 在修复循环内修改 \`tasks.md\` 以外的变更制品。

### 4.1 修复实现

- 遵循 \`.iagent/rules/coding-rules.md\`（零猜测原则、最小改动、分层）
- 保持改动外科手术般精准：每一行改动都必须能追溯到根因
- 修复涉及数据库/schema 变更时，单独输出 DDL 并在应用前请求显式确认（依护栏）
- 实现中暴露设计问题时，暂停并建议更新变更制品，而非静默偏离
- **验证口径（2.4）**：修复方案 MUST 覆盖该缺陷链路的**「异常节点 + 根因节点」**；仅覆盖触发节点而未覆盖根因节点时，视为修复未完成

### 4.2 强制回归测试（内联调用 \`iagent_test\`）

- 每个修复 MUST 有回归测试，其：修复前 FAIL、修复后 PASS
- 运行 Phase 1 的复现并确认其现已通过
- **证据优先轨道的口径（characterization test）**：证据优先轨道下无法用原始复现建立「修复前 FAIL」时，回归测试 SHALL 为 \`characterization test\` —— 先以断言固化当前可观察行为（含缺陷表现），再断言修正后的行为；仍 MUST 满足「修复前 FAIL、修复后 PASS」并覆盖缺陷链路的「异常节点 + 根因节点」
- **无法建立可执行断言时**：只报告候选根因 / 候选缺陷并停止，MUST NOT 修改代码（回到 1.3 的无证据出口，MUST NOT 以手工步骤验收替代回归测试）
- 若变更的 \`tasks.md\` 尚未列出对应任务则补上（回归测试任务用 \`[测试]\` 标签并带级别/优先级，如 \`[测试][单元][P0]\`）；保留 \`Spec Ref\`/\`Scenario Ref\`

**编写动作（内联 Skill 调用，强制）**

- 回归测试的编写 SHALL 由主 agent 内联调用 \`iagent_test\`，向其提供：已确认的缺陷链路（2.4）、Phase 1 的复现证据、测试级别/优先级与变更名；Stage Envelope 只传路径与结构化字段，MUST NOT 内联制品正文或完整 SKILL.md；MUST NOT 为回归测试编写派生 Agent 子代理
- \`iagent_test\` 是测试生成规则（框架探测、项目既有风格对齐、用例设计、反模式防护）的**唯一来源**；debug MUST NOT 再维护与之冲突的内联框架检测或测试生成规则
- **Phase 1 内联临时测试的边界**：Phase 1 MAY 以内联临时测试建立失败证据，但该测试**不构成**回归测试；MUST NOT 仅以 Phase 1 临时测试充当唯一回归测试 —— 正式回归测试 SHALL 由 \`iagent_test\` 生成或改造落库
- **能力缺失**：strict 模式无法调用 \`iagent_test\`（技能调用机制不可用）时 SHALL 按能力协商**阻断并报告**；MUST NOT 以"自写 + WARN"绕过。仅在宿主显式协商 degraded 时才允许本地编写，并须透明记录"本阶段未发生内联技能调用"—— MUST NOT 伪装为 strict 内联调用完成

**验收（debug 自身职责，内联不放松）**

- 内联调用返回后 MUST 自行核对：① 修复前 FAIL、修复后 PASS；② 覆盖缺陷链路的「异常节点 + 根因节点」
- **回执续跑**：内联结果 SHALL 含 \`regressionTests\` / 失败原因（如有）；校验通过后 MUST 在同一用户回合内继续 Phase 5（编译检查），MUST NOT 以回执结束回合；回执 MUST NOT 作为面向用户的最终消息（用户可见至多一行进度）
- 缺少前置失败证据、修复后仍失败或覆盖不足时，MUST NOT 报告测试验收通过

### 4.3 修复后收束（调试循环的非阻塞出口）

每个 bug 修复并验收后 MAY 提示「如还有其他相关 bug，可直接继续报告」—— 这是**非阻塞提示**，**不构成确认门**、MUST NOT 作为停点、MUST NOT 等待用户回答才继续；用户主动提出新 bug 时向 TodoWrite 追加该 bug 的 P1-P4 并重复循环，未提出时直接进入 Phase 5（编译检查）。MUST NOT 声明门白名单之外的确认门，MUST NOT 因「是否还有 bug」制造自造门。

---
## Phase 5: 编译检查 — 汇总所有修复

遵循 \`iagent_spec_apply\` 技能的编译检查约定（Step 8），只运行**一次**，覆盖循环中修复的**所有** bug：

- 读取 \`.iagent/config.yaml\` 的 \`compileCheck\`（缺段即启用，缺省启用）；未启用（\`enabled: false\`）→ 跳到 Phase 6
- **作用域声明**：\`compileCheck.command\` / \`timeoutMs\` / \`maxRetries\` / \`autoFix\` / \`incremental\` **仅约束 \`iagent_spec_apply\`**；debug 只共享 \`enabled\` 与「缺省启用」语义，仍按本步自身的技术栈探测执行
- 从 context 探测技术栈并按对应编译命令检查（TypeScript / Java-Maven / Java-Gradle / Go / Rust）；分类变更文件为后端与前端
- 按 debug **自身**策略自动修复并重跑（最多 3 次）—— 该策略独立于 apply 的 \`compileCheck.autoFix\` / \`maxRetries\`，MUST NOT 引用这两个字段
- 汇总编译 / lint / 前端结果，区分已修复与遗留问题；遗留失败**报告**给用户 —— MUST NOT 静默越过失败检查

---
## Phase 5.5: 变更范围内测试执行（强制）

范围 / 运行 / 失败处置 / 证据口径见 \`references/gates-and-rules.md\`；本阶段 MUST 写 \`.openspec-tmp/pipeline-<change-name>/test-report.md\`，只运行变更范围内既有测试与回归测试，范围外存量失败仅 WARN，MUST NOT 额外生成单测。

---
## Phase 6: 同步提案 — 汇总所有修复

**⚠️ 强制: 循环中所有修复完成后，变更制品必须反映所有已实现的修复。**

### 6.1 更新制品（Markdown 优先）

Markdown 是唯一真源 —— 直接更新 OpenSpec Markdown 制品；不得创建或更新 JSON 镜像：

- **proposal**：把循环中**所有** bug 的根因与修复说明追加到 \`proposal.md\` 的 What Changes 下（每个 bug 追加一条）
- **specs**：任一修复改变已记录行为时，用 ADDED/MODIFIED/REMOVED/RENAMED 更新对应的 \`specs/<capability>/spec.md\` Requirement/Scenario
- **design**：任一修复改变已记录决策时，更新 \`design.md\` 的 Decisions
- **tasks**：更新 \`tasks.md\` 的 checkbox，必要时追加回归测试任务；保留 \`Spec Ref\`/\`Scenario Ref\`
- **Validate**：Markdown 编辑后运行 \`iagent spec validate --change "<name>"\` 并修正路径/行号诊断
- **仅遗留 JSON 的变更**：只读兼容；写操作须先显式迁移

### 6.2 持久化根因分析

- 把**所有** bug 的完整诊断记录（提示词基线、复现、排查路径、证据、根因、所选修复理由）写入变更目录的 \`exploration.md\`，按 bug 组织 —— 包含 \`## 提示词基线\` 段，使变更保留用户确认的语义来源；\`## 功能流程（缺陷链路）\` 段（2.4）承载确认后的缺陷链路与节点清单
- **分级判定结果**（2.2.3.5）：每个 bug 的排查深度分级结论 MUST 一并持久化 —— 三条信号取值、所选路径（轻量 A / 深度 B）、是否信号降级；即"为什么这个缺陷走了这条排查路径"须可追溯，避免事后无法复盘排查深度是否合理

### 6.3 Markdown 校验

同步后校验 Markdown 制品：

- \`iagent spec validate --change "<name>"\` 通过；失败时报出文件路径与行号
- \`proposal.md\` 含 Why / What Changes / Capabilities / Impact；\`specs/**/*.md\` 含 \`### Requirement:\` + \`#### Scenario:\`；\`design.md\` 含 Context / Decisions / Risks；\`tasks.md\` 任务带类型标签与 checkbox 状态

继续之前先修复任何违规 —— 同步不得损坏 Markdown 真源。

### 6.4 实现一致性证据（强制）

运行 \`iagent spec conformance --strict\` 并写 \`.openspec-tmp/pipeline-<change-name>/conformance-report.md\`（细则见 \`references/gates-and-rules.md\`）；\`fail\` / 缺失 → 回 Phase 4。

仅当制品反映所有已实现的修复、且一致性证据已产出后，才进入 Phase 7。

---
## Phase 7: 验证 — 覆盖所有修复

### 7.0 实现一致性证据消费（强制）

只读 \`conformance-report.md\` 与 \`test-report.md\` 的 \`**summary**:\` 行（细则见 \`references/gates-and-rules.md\`）；\`fail\` / 缺失 → 回 Phase 4，MUST NOT 宣告可归档，MUST NOT 自行重跑命令。

### 7.1 内联执行验证（主 agent）

对变更 \`<name>\`，由**主 agent 内联**调用 \`iagent_spec_verify_proposal\` 技能执行验证；Stage Envelope 只传 \`changeName\` / \`changeRoot\` / 制品路径 / \`resume\`，MUST NOT 内联制品正文或完整 SKILL.md；MUST NOT 为验证派生 Agent 子代理（\`executionMode=inline\` / \`independence=self\`）：

- \`iagent_spec_verify_proposal\` 是技能名，不是有效的 \`iagent spec instructions\` 制品 ID —— MUST NOT 将其作为 CLI 指令运行
- 该技能通过读取制品与 exploration.md 执行 D1-D5 核心 + D6-D10 条件评分
- **证据契约**：每条结论 MUST 带 \`文件:行\` 或制品章节锚点；无证据结论 MUST NOT 计入通过
- 回执 SHALL 含 \`score\` / \`reviewSummary\` / 可选 \`reportPath\`；父级校验通过后**在同一用户回合内**继续 7.2/7.3

**降级（回退）（技能不可用）**：技能未安装或调用失败时，降级为主 agent 内联读取制品并手动执行 D1-D5 核心 + D6-D10 条件评分，并发出 WARN："iagent_spec_verify_proposal 技能不可用，降级为内联评分"。MUST NOT 静默跳过验证。

### 7.2 验证 FAIL → 自动修复循环

当任一维度得分低于阈值（<90%）时：

- 为每个未通过维度自动生成具体修复建议（如缺边界场景 → 向 spec 补场景）
- 将修复应用到制品文件
- 应用修复后自动重跑验证
- 显示修复摘要（「已应用自动修复 —— 重新运行验证……」）
- 重跑仍失败时：呈现遗留问题与选项 —— [1] 手动编辑，[2] 返回探索，[3] 查看详细差异报告。**没有跳过直接实现的路径。**

### 7.3 验证 PASS → 内联深度复查 → 收束（verify-close）

验证通过后：

1. **由主 agent 内联复查**：由主 agent 内联 调用 \`iagent_proposal_review\` 技能，对提案做只读深度复查（超出 D1-D5 核心 + D6-D10 条件评分的深度一致性与覆盖率审计）。复查内联运行（不弹 [Yes/No] 提示），MUST NOT 派生嵌套子代理（\`executionMode=inline\`）。用户 MAY 中断以跳过；否则照常运行。
   - **降级（回退）（技能不可用）**：技能未安装或调用失败时，降级为主 agent 内联只读深度复查并 WARN："iagent_proposal_review 技能不可用，降级为内联复查"。MUST NOT 静默跳过深度复查。
   - 回执 SHALL 含 \`reviewSummary\` / 可选 \`reportPath\`；完整报告 MUST NOT 内联进回执。
   - **同上下文修复重跑**：复查 FAIL 时在同一主上下文按 \`fixDiff\` 增量重跑，MUST NOT 新开验证代理或全量重读；循环上限 3 次。
2. **收束（verify-close）**：深度复查收束后直接报告该变更已可归档；debug 不自动归档。MUST NOT 展示需求文档桥、MUST NOT 生成需求文档、MUST NOT 携带已移除的需求文档状态字段。
3. **报告**：显示验证结果、深度复查结论与可归档提示：
   > 「调试完成。验证与深度复查已通过；需求文档请按需单独调用 iagent-requirement-doc。」
   > 「已可归档 —— 运行 /iagent:spec-archive。」

### 7.4 清理流程级调试工作区（强制）

验证收尾后 MUST **清理调试工作区** —— 统一清理 \`.openspec-tmp/debug-<keyword>/\`（以 \`path.join()\` 构造），覆盖**所有退出路径**：

- **正常收尾**：Phase 7 验证（含深度复查）完成后清理
- **非缺陷退出路径（3.5）**：诊断报告输出、工作流结束后同样清理
- **诊断确认包被拒绝（2.4）**：输出诊断报告后同样清理
- **中途退出路径**：用户中途退出调试循环（Phase 5-7 收尾）时同样清理

**容错**：清理失败（目录不可删 / 权限不足）→ 记 WARN 并**提示残留路径**，**MUST NOT 阻断流程**（清理为收尾动作，不得使已完成的修复与验证失效）。

---
## Output

\`\`\`
## Debug Workflow: <change-name or diagnosis-only>

### Loop Summary
- Total bugs fixed: N
- Non-defect findings: M (diagnosis only)

### Per-Bug Summaries

#### Bug #1: <one-line summary>
- Phase 1: Reproduction: <failing test / procedure / static evidence> — 轨道: 复现优先 / 证据优先；reproductionStatus: <reproduced / not-reproduced / intermittent / static-only>；evidenceType: <failing-test / manual-steps / log-trace / static-proof / review-finding>；confirmed ✗/✓
- Phase 2: 分级: <轻量路径 A / 深度路径 B —— 信号 (a)(b)(c) 取值、是否降级 yes/no>；根因: <一行摘要>；证据: <调用链 / 符号>
- Phase 3: Association: <in-progress change / new fix-{module}-<topic> / archived origin (traced)>（归属在 2.4 之前判定）
- 2.4 诊断 + 方案合并包: 一次确认（fixDecision: <唯一方案 + 唯一性证据 / 多方案选定项>）
- Phase 4: Fix: <summary>, Regression test: <test reference> — passes ✓

#### Bug #2: <one-line summary>
- ...

### Phase 5: Compile Check (汇总所有修复)
- Compile check: PASS / FAIL(n issues) / SKIPPED(disabled)

### Phase 6: Synchronization (汇总所有修复)
- Markdown updated: proposal.md / design.md / specs/**/*.md / tasks.md — validated with \`iagent spec validate\`
- All root causes persisted to exploration.md ✓
- JSON validation: PASS

### Phase 7: Verification (覆盖所有修复)
- Score: XX% — PASS/FAIL
- Deep review: completed ✓ / WARN (reason)
- Verification close: ready for archive (no requirement-doc bridge)

Ready for \`/iagent:spec-apply\` (fixes already applied) or archive.
\`\`\`

---
## Guardrails

- **复现前先校验 bug 报告**：Startup 段的提示词校验门（缺陷五维）是强制前置——清晰描述一句话复述理解后直通；含糊描述须先做提示词优化并等待用户确认或修改，未确认前 MUST NOT 进入 Phase 1，不得凭猜测编写失败测试
- **确认门不得死锁**：确认门有四条出口（确认 / 修改 / 拒绝后按原理解继续 / 显式授权按推断继续），不得反复要求确认
- **必须持久化提示词基线**：原始提示词与确认后的基线写入诊断记录 \`## 提示词基线\` 段，Phase 6 随根因分析一并持久化
- **缺陷链路并入诊断确认包**：2.4 的确认包 MUST 内含根因证据与诊断记录的 \`## 功能流程（缺陷链路）\` 段（Mermaid + 节点清单表），节点**只覆盖缺陷链路**（前置条件 → 触发 → 异常 → 根因），异常节点标 \`🔴异常\`、根因节点标 \`🟠根因\`；同一确认包 MUST 同时内含修复方案（唯一方案给唯一性证据；多方案逐项给出做法 / 影响 / 建议），**一次确认**即同时确认根因与方案；多候选先选根因再确认对应链路与方案；MUST NOT 展开被测功能的完整业务流程
- **诊断确认包三出口**：确认 / 修改后重呈 / **拒绝 = 终止修复并输出诊断报告**（含排查路径与证据）—— 拒绝时 MUST NOT 修改代码、MUST NOT 自动按推断继续、MUST NOT 标记可归档；不得反复要求确认
- **修复与回归测试须覆盖异常节点与根因节点**：修复方案与回归测试 MUST 覆盖缺陷链路的「异常节点 + 根因节点」（4.1 / 4.2）；仅覆盖触发节点而未覆盖根因节点时，验证不通过
- **默认复现优先、证据优先须硬证据（双轨）**：复现优先轨道（默认轨道）以失败测试或用户确认的显式步骤作为修复判据；证据优先轨道 MUST 先满足 1.3 的证据门槛（\`文件:行\` 静态证据 / 日志 / 测试；\`intermittent\` 须至少一条**可重复**证据）；两轨均无硬证据时只报告候选根因 / 候选缺陷清单并停止，MUST NOT 修改代码、MUST NOT 凭假设修复 —— 适用于循环中的**每个** bug
- **按影响半径分级，而非按便利**：2.2.3.5 的分级信号取值 MUST 可追溯至实测查询结果（主通道 \`codegraph_explore\`；可选通道 \`codegraph_impact\` / \`codegraph_files\`；降级时为 Grep）；MUST NOT 编造"半径小"以走轻量路径；信号缺失或阈值边界 MUST 取深度路径
- **分级与缺陷链路图解耦**：分级只决定 2.2.4 是否执行，2.4 诊断确认包内的缺陷链路对轻量路径同样**强制产出**，MUST NOT 豁免
- **升级兜底是触发条件，不是独立步骤**：升级兜底即 2.2.4 扩展后的触发条件之一，MUST NOT 为其新建独立章节或编号（2.2.4 的内容与编号不变）
- **分级在 CodeGraph 降级时仍生效**：CodeGraph 不可用时分级仍生效（信号 (a) 降级为文件数代理指标，(b)(c) 照常）；MUST NOT 因降级跳过分级，诊断记录 MUST 标注「信号降级」
- **无需求文档桥**：7.3 在验证 PASS + 深度复查收束后直接收束；MUST NOT 展示生成/跳过桥、MUST NOT 委派需求文档技能
- **回执续跑**：内联调用 \`iagent_test\` / \`iagent_spec_verify_proposal\` / \`iagent_proposal_review\` 返回有效结果后 MUST 在同一用户回合内继续下一阶段；MUST NOT 以回执结束回合；回执 MUST NOT 作为面向用户的最终消息（用户可见至多一行进度）
- **读取范围**：只读 handoff 包「## 制品清单」命中范围与 Stage Envelope（路径 + 结构化字段），MUST NOT 内联制品正文或完整 SKILL.md，MUST NOT 全量重读；blocked 时用 \`blockedGate\` / \`blockedReason\` + \`resume=true\`
- **零猜测**：多个候选根因 → STOP 并让用户选择；绝不猜测
- **方案在 2.4 合并包内一次确认**：可行修复方案（含两个及以上方案，或唯一性证据不足按多方案处理的情形）随「诊断 + 方案」合并包与根因一并确认，MUST NOT 在 Phase 4 再停一次；拒绝或要求修改时 MUST NOT 实现 —— 仅**回退路径**（变更归属依赖根因外上下文）且存在多个可行方案时，4.0 的修复方案确认门才 MUST 阻塞并等待用户确认
- **唯一方案需证据（生效位置为 2.4 合并包）**：仅当项目约束与代码证据（引用具体约束与 \`文件:行\`）支持唯一性时，唯一性证据 MUST 随 2.4 合并包一并呈现，确认后随包直通；MUST NOT 凭"看起来只有一种"跳过证据；数据库/schema 的既有独立确认仍须执行
- **修复后循环询问不构成确认门**：概览第 5 条与 4.3 的「可继续报告相关 bug」是**非阻塞提示**，MUST NOT 作为停点、MUST NOT 等待用户回答才继续，MUST NOT 声明门白名单之外的确认门
- **归档只读**：MUST NOT 修改 \`openspec/changes/archive/\`
- **回归测试强制**：每个修复都附带一个修复前失败、修复后通过的测试 —— 适用于循环中的**每个** bug；证据优先轨道下该测试为 \`characterization test\`（先固化当前行为断言，再断言缺陷行为被修正），无法建立可执行断言时回到「只报告候选、不修复」
- **规则基线 / 测试证据 / 一致性门强制**：Phase 2 起点 MUST 枚举并读取全部存在规则源（缺失记「不存在」，未读不得伪装）；Phase 5.5 MUST 写 \`test-report.md\`（范围内失败共享 ≤3 预算）；Phase 6.4 MUST 产出 \`conformance-report.md\`，Phase 7 只读汇总行，任一 \`fail\` / 缺失 MUST NOT 归档（细则见 \`references/gates-and-rules.md\`）
- **回归测试编写内联调用 \`iagent_test\`**：传入已确认的缺陷链路、Phase 1 复现证据、测试级别/优先级与变更名；\`iagent_test\` 是框架/风格/用例规则的唯一来源，debug MUST NOT 复制其内联框架检测或测试生成规则；strict 无法调用时 MUST 阻断并报告，MUST NOT 以"自写 + WARN"绕过（仅显式协商 degraded 时允许本地编写并透明记录未发生的内联调用）
- **Phase 1 临时测试不替代回归测试**：Phase 1 MAY 以内联临时测试建立失败证据，但该测试不构成回归测试；正式回归测试 SHALL 由 \`iagent_test\` 生成或改造落库
- **内联调用绝不放松两条硬要求**：回归测试 MUST 仍覆盖缺陷链路的「异常节点 + 根因节点」，且 MUST 仍修复前 FAIL / 修复后 PASS —— 内联调用返回后自行核对两者
- **提案同步强制**：验证前制品必须反映**所有**已实现的修复
- **验证绝不跳过**：技能 → 内联降级（回退）+ WARN；FAIL → 自动修复循环，无跳过路径；PASS → 深度复查（技能 → 内联降级（回退）+ WARN）→ verify-close 收束
- **循环中非缺陷不阻塞**：循环中的非缺陷发现 MUST NOT 阻塞其他 bug —— 记录诊断并继续
- **循环退出保留已完成工作**：中途退出保留已完成修复，丢弃未完成的当前 bug
- **独立变更分离**：用户声明某 bug 需要独立变更时，收尾当前变更并提示单独调试
- **使用 \`path.join()\`** 处理所有文件路径（跨平台：macOS/Linux/Windows）
- **术语实时收敛**：排查中确定的术语立即写入 CONTEXT.md
`,
        allowedTools: `Read, Write, Edit, Glob, Grep, Bash(iagent:*), Bash(npm:*), Bash(pnpm:*), Bash(node:*), Bash(git:*), Bash(tsc:*), Bash(mvn:*), Bash(gradle:*), Bash(go:*), Bash(cargo:*), ${CODEGRAPH_CLI}, ${CODEGRAPH_MCP}, ${skillDelegation(['spec_verify_proposal', 'proposal_review', 'test'])}`,
        type: 'impl',
        license: 'MIT',
        compatibility: '依赖 iagent CLI（spec 命令组）与 iagent_spec_verify_proposal / iagent_proposal_review / iagent_test 技能（test 为条件内联调用）；CodeGraph MCP 可选（不可用时降级 Glob/Grep）。',
        metadata: { author: 'mi-agent-tools' },
        references: [
            { path: 'references/prompt-gate.md', content: PROMPT_GATE_BUG_FULL },
            { path: 'references/flowchart-gate.md', content: FLOWCHART_FAULT_FULL },
            { path: 'references/investigation-protocol.md', content: INVESTIGATION_PROTOCOL_FULL },
            { path: 'references/grill-discipline.md', content: GRILL_DISCIPLINE_FULL },
            { path: 'references/gates-and-rules.md', content: GATES_AND_RULES_FULL },
        ],
    };
}

export function getDebugCommandTemplate(): CommandTemplate {
    // command 版由 skill 唯一源派生（单一源）。
    // 本模板刻意不标记任何 \`<!-- CMD:SKIP -->\` 段落：debug 不存在「仅技能版职责」的段落，
    // 全部防护语句在指令版同样必需；未标记段落默认进入 command 版（fail-safe）。
    return {
        name: 'iAgent: 调试工作流',
        description: '一站式调试：复现（双轨：默认复现优先 / 无复现条件时证据优先）→ CodeGraph 排查定位 → 关联变更判定 → 诊断 + 方案一次确认 → 内联修复 + 回归测试（调试循环）→ 编译检查 → 同步提案 → 验证与深度复查收束',
        category: 'iAgent / 实现',
        tags: ['iagent', 'impl', 'debug', 'bug-fix', 'root-cause', 'regression'],
        content: deriveCommandContent(getDebugSkillTemplate().instructions),
    };
}

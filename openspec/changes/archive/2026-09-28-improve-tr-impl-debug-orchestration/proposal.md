## Why

`venus_tr_impl_debug` 的两处编排逻辑存在具体缺陷，均导致**排查质量或人工成果的损失**：

**1. 排查深度缺少事前分级 —— 大范围 bug 会过早收敛**

Phase 2 的深度探索（2.2.4）当前是**事后条件触发**，判据只有一条：*"常规查询（2.2.1–2.2.3）无法定位单一高置信根因时"*（`src/core/templates/workflows/tr-impl-debug.ts:171`）。由此产生两个缺口：

- **大范围 bug 一步定位到"表层根因"后即停止**，不再执行 `codegraph_explore` + 6 维根因深度分析。而 6 维分析针对的正是 **Design Rationale / Constraints / Trade-offs / Pattern Usage / Historical Context / Implicit Assumptions**（`:175-181`）—— 这类系统性根因（尤其是历史边界场景与隐式假设）在"一步命中"时根本不会被检视。影响面越大，漏检代价越高。
- **判定口径与"bug 大小"脱钩**：爆炸半径（`codegraph_impact` 实测）、跨模块程度这类直接反映排查成本的信号已被 2.2.1–2.2.3 采集，却没有参与路径选择。是否深入全凭"根因清不清晰"这一单点判断，无法按影响范围升级强度。

**2. 需求文档被无条件覆盖 —— 人工填写内容被静默抹掉**

Phase 7.3 在验证通过后**无条件**调用 `venus_tr_docs_requirement_doc` skill 非交互生成需求文档（`:404-408`）。而该 skill 自身的既有规则是 *"When the target file already exists, overwrite it silently — regeneration is idempotent and must not block on questions"*（`src/core/templates/workflows/tr-docs-requirement-doc.ts:216`）。

因此当变更目录内**已存在** `需求文档.md`（来自 `venus_tr_impl_workflow` / `venus_tr_impl_auto_workflow` 的先前产出，二者同样在验证通过后生成该文档）时，debug 的收尾环节会**整体重写**该文件：人工填写并通过评审的 `## 基本信息`（需求编号 / 需求名称 / 交付时间）与 `## 八、评审记录` 被抹为占位符。这是**数据丢失**，不是风格问题——且 debug 恰恰是"修复已交付功能"的场景，此时文档往往已进入评审流转。

两处缺陷的共同性质：**编排逻辑缺少"按实际情况分支"的判定**——一处少了事前分级，一处少了存在性判定。

## What Changes

**Phase 2 新增排查深度分级（`2.2.3.5`，十进制插入，不重排既有编号）**

- 位置：常规查询 2.2.1–2.2.3 之后、深度探索 2.2.4 之前——三条信号均产自常规查询，故必须后置
- **三条客观信号**（任一命中即深度路径；信号 MUST 可追溯实测结果，MUST NOT 编造）：
  - (a) **爆炸半径**：`codegraph_impact` 在 depth ≤ 2 的受影响符号数 ≥ 5 **或** 受影响文件数 ≥ 3
  - (b) **跨模块**：受影响范围跨 ≥ 2 个模块 / 目录
  - (c) **根因清晰度**：2.2.2（`codegraph_search` + `codegraph_context`）未能一步定位单一高置信根因
- **两条路径**：轻量路径 A（止步，不做 6 维）/ 深度路径 B（进入 2.2.4）
- **保守取值**：信号缺失或落在阈值边界时取深度路径（宁可多查不漏）
- **信号降级**：CodeGraph 不可用（Glob/Grep 降级）时分级**仍生效**——信号 (a) 降级为 Grep 代理指标（受影响文件数阈值），(b)(c) 不依赖 CodeGraph 照常判定；诊断记录标注「信号降级」

**扩展原 2.2.4 的触发条件（内容不变）**

- 2.2.4 的**内容**（`codegraph_explore` + 6 维根因深度分析）与**编号**均不动
- 触发条件由「常规查询未定位单一高置信根因」**扩展**为「**分级为深度路径 ∨ 轻量路径未定位单一高置信根因**」——原事后触发保留为**升级兜底**（轻量路径的纠偏出口），而非独立步骤
- 明确禁止误建"空兜底步骤"：兜底是**触发条件**，不是新章节

**2.5 缺陷链路图与分级解耦**

- 分级结果**只**影响 2.2.4 是否执行；2.5 缺陷链路图与流程最终确认门维持 MANDATORY，不因走轻量路径而豁免（不动 `add-flowchart-cross-verify` 确立的不变量）

**Phase 7.3 新增需求文档分支判定**

- 位置：深度复查（`:402`）之后、生成（`:404`）之前
- 判定范围**仅** `openspec/changes/<change-name>/需求文档.md`（`path.join()`）——debug 只操作 active 变更；归档变更会新建变更，其目录必无该文件
- **不存在** → 调 `venus_tr_docs_requirement_doc` skill 非交互生成（既有行为，不变）
- **已存在** → **就地增量对齐更新**：`## 基本信息` 与 `## 八、评审记录` 为**人工域**（MUST NOT 覆盖，含占位符状态）；`一~七` 章节按更新后的制品重新派生；不调 skill（避免其"静默覆盖"规则抹掉人工内容）
- 异常路径：文档格式破损 → 补建缺失章节并记录 WARN；目录不可读 → WARN 并按"不存在"处理

**不修改（明确边界）**

- **不修改** `venus_tr_docs_requirement_doc`（叶模板，`codegraph_impact` 仅 2 符号零爆炸半径）——仅由 debug 侧作调用方
- **不修改** 共享模块 `prompt-gate.ts` / `flowchart-gate.ts`（5 技能正文共享内联源）
- **不修改** `deriveCommandContent` 派生器、注册结构、技能总数（27）、`allowedTools` 白名单（本方案未引入新命令）
- **已知落差（明确排除）**：`tr-impl-workflow` / `tr-impl-auto-workflow` / `tr-impl-genfull` 的同构"PASS 后生成需求文档"逻辑（分别位于 `tr-impl-workflow.ts:1382,2191`、`tr-impl-auto-workflow.ts:510,591,648`、`tr-impl-genfull.ts:193`）**本次不同步**，另行变更处理

## Capabilities

### New Capabilities

（无 —— 本变更以既有能力的行为增补形式落地）

### Modified Capabilities

- `tr-workflow-suite-skills`: `venus_tr_impl_debug` 的排查深度由「事后单判据触发」改为「事前三条信号分级 + 事后触发保留为升级兜底」（新增 2.2.3.5 节，扩展 2.2.4 触发条件，2.5 与分级解耦）；Phase 7.3 需求文档产出新增存在性判定与就地增量对齐分支（含人工域白名单规则）

## Impact

### 直接影响的文件

- `src/core/templates/workflows/tr-impl-debug.ts`: **主改动**。skill 正文新增 2.2.3.5 节 + 扩展 2.2.4 触发条件 + Phase 7.3 插入判定与就地对齐分支 + 1.2 结构化格式/诊断记录同步 + Guardrails 增补；`getTrImplDebugCommandTemplate().content`（手写压缩正文）**手工同步**
- `openspec/specs/tr-workflow-suite-skills/spec.md`: delta 合并 —— MODIFIED「tr-impl-debug 强制复现与根因确认门」（分级与触发条件扩展）、MODIFIED 需求文档相关需求（7.3 分支）
- `openspec/CONTEXT.md`: 已新增 6 条术语（排查深度分级 / 轻量路径 / 深度路径 / 升级兜底 / 人工域 / 就地增量对齐）—— 探索阶段已同步落盘
- `test/templates.test.ts`: 核对 debug 正文断言（`:116` `scenarioMark: '🟠根因'`、`:134` 读 instructions）是否受正文增补影响
- `test/allowed-tools.test.ts`: 核对 debug 白名单断言（`:56` / `:68`）—— 本方案未新增命令，预期不变
- `skills/**/SKILL.md` 与对应指令文件: `pnpm build && pnpm generate:skills` 重生成静态快照（`test/skills-parity.test.ts` 防漂移要求）
- `package.json` / `CHANGELOG.md`: 版本号递增（minor，功能行为变更）+ `[Unreleased]` 归档为版本小节，随本次提交一并提交（AGENTS.md 守则 8）
- `README.md`: 若含 `venus --version` 输出示例则同步版本号

### 向后兼容

无破坏性变更。全部为**增量判定步骤 + 分支插入**：既有阶段编号（2.2.0–2.2.4、2.4、2.5、Phase 3–7）与 checkpoint 语义、注册结构、技能总数（27）、`allowed-tools`、依赖注入关系（`profiles.ts`）均不变。

- **编号兼容**：采用十进制插入 `2.2.3.5`，既有文档 / 能力记忆 / spec 中对 `2.2.4` 的引用**全部保持有效**
- **既有行为兼容**：轻量路径下若未定位根因，经升级兜底进入 2.2.4 —— 与原行为的**终局一致**，仅增加"大范围 bug 主动深入"这一新升级方向
- **需求文档兼容**：不存在时行为完全不变（调 skill 生成）；已存在时由「静默覆盖」改为「人工域保留 + 制品重派生」——**消除数据丢失**，非破坏性
- **CodeGraph 缺失兼容**：降级模式下分级仍生效，与既有 2.2.0 降级路径连续，不改变"CodeGraph 不可用仍可完成排查"的可用性
- **已知落差**：另 3 处同构逻辑未同步，表现为"debug 收尾不覆盖人工内容，其余三技能仍覆盖"——**记录为已知落差**，不在本变更范围内

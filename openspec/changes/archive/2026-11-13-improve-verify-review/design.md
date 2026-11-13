# 技术设计：improve-verify-review

## Context

（来自 exploration.md 与 Phase 2.0 影响分析，完整爆炸半径表见 proposal.md Impact Analysis）

- **架构链路**：模板层（skill 版 `instructions` 为唯一真源）→ `derive-command.ts` 派生 command 版（CMD:SKIP 标记裁剪，derive-command.ts:23）→ `registry.ts` WORKFLOW_PAIRS（:105-134）成对注册 → 生成层产出 `.opencode` / `.claude` 等宿主产物 → `skills/` 静态快照（`pnpm generate:skills` 再生成）
- **缺口事实**：影响面三制品由生成链产出（workflow.ts:273-279：proposal Impact 影响面分析小节 / design 架构影响小节 / tasks Caller Updates 小节），验证侧（spec-verify-proposal D1-D10、spec-verify 三维度、review 五维度）零消费；review 无变更关联感知；spec-verify.ts:39 执行方式双语义未显式化
- **可复用先例**：条件触发维度模式（D6-D10 关键词触发）、SKIP 排除分母（spec-verify-proposal.ts:152-153，D10 缺失处理）、FAIL 逐条可定位输出（:155-156）、`iagent rules --json` 规则基线读取（review.ts:17）
- **流程基准**：exploration.md `## 功能流程图`（20 节点 / 3 子流程，经流程最终确认门用户确认，flowBaselineConfirmed=true）。本设计**引用而非重建**该流程图与关键操作节点清单——节点 / 操作 / 触发条件 / 证据位置 / 异常路径以 exploration.md 为唯一真源；全部 20 节点经本引用计入 D10 覆盖。本变更落在 6 个 [新建]/[调整] 节点：N3（影响面制品存在性判定）、N4（D3 并入待实现功能覆盖检查点，[调整]）、N5（影响范围一致性评分）、N12（Correctness 并入实现影响面对比，[调整]）、N17（变更关联检测）、N19（提案↔实现一致性检查）
- **爆炸半径结论**：6 个目标模板工厂符号上游仅 registry.ts WORKFLOW_PAIRS 注册条目 + stage-continuation / template-derivation 测试引用；改动收敛在模板正文 / 常量 / references 层

### Architecture Impact

本次改动只落三个模板文件的检查段与执行方式段（spec-verify-proposal.ts / spec-verify.ts / review.ts）+ 新增 references 常量与条目；不触碰 registry.ts 注册表、derive-command.ts 派生器、CLI 校验代码（src/core/spec/）、总分公式（spec-verify-proposal.ts:147/:386-390）与 90% 统一阈值（:392-395）。维度名枚举消费点（workflow.ts:31-39、auto-workflow.ts:30/:90-100、debug.ts:285、proposal-review.ts:438）在「扩展不改名」策略下保持有效——零改动。

## Goals / Non-Goals

**Goals**:

- spec-verify-proposal：补齐「待实现功能覆盖」（并入 D3）与「影响范围一致性」（并入 D2/D3，条件触发）两类检查能力点，缺失 SKIP / 脱节 FAIL 可定位 / 降级 SKIP+WARN
- spec-verify：Correctness 并入实现影响面对比（越面 WARNING）；执行方式双语义显式化
- review：新增提案↔实现一致性条件检查点（N17 检测 + N19 语义核对），结构层证据引用 conformance
- 全部检查能力点的「保留 / 调整 / 不改」评估结论在 design.md 评估记录段留痕

**Non-Goals**:

- 不新增维度编号（D11+）、不改总分公式与 90% 统一阈值（阈值 / 权重语义变更须单独显式确认，未获确认即保持现状）
- 不动 CLI 校验代码（src/core/spec/ 等结构校验实现）
- 不改 workflow.ts / auto-workflow.ts / debug.ts / proposal-review.ts / registry.ts / derive-command.ts（枚举与注册表零改动）
- 不新增 allowedTools 权限条目
- 不实现 review 的写操作能力（审查只报告不改码，review.ts:60）

## Decisions

（承接 exploration.md D1-D4 决策，此处记录实现取向；决策 id 延续探索编号，不复用不重排）

### D1: 改动边界收敛在模板层

- **选择**: 仅三个模板正文 + 新增 references 常量与条目 + 配套测试 + 快照再生成
- **理由**: 检查逻辑主体在模板正文；CLI 结构校验与语义层检查点无强耦合；爆炸半径证实调用方无需变化
- **备选**: 连带 src/core/spec/ 校验代码调整——影响面大且破坏「不动 CLI」边界（用户确认否决）

### D2: 能力点并入既有维度

- **选择**: 待实现功能覆盖 → spec-verify-proposal D3；影响范围一致性（提案侧）→ D2/D3 条件触发检查点；实现影响面对比 → spec-verify Correctness；review 一致性 → 条件检查点（N17/N19）而非新维度
- **理由**: 防维度清单膨胀与 90% 统一阈值失真（CONTEXT.md「节点覆盖度」triggered 集合同权重语义）；报告表述保持「D3 检查点」口径而非常驻维度
- **备选**: 平铺新增 D11/D12——分母变化触碰总分公式，违反硬约束

### D3: 评估结论留痕与双语义显式化

- **选择**: 每个检查能力点产出「保留 / 调整 / 不改」结论写入 design.md 评估记录；spec-verify.ts:39 以两形态判定信号显式化（编排上下文存在 → 合并清单模式；否则三维度 report-only）
- **理由**: 再分析是评估行为，「不改」是合法结论；阈值 / 公式为全局语义，变更须单独显式确认
- **备选**: 强制每维度产出改动——违反工程判断与用户确认的 D3

### D4: 边界处置按 BS-1..BS-6 承接

- **选择**: 影响面制品缺失→SKIP 排除分母（对齐 D10 先例 :152-153）；有制品但与 tasks 脱节→FAIL 逐条列出偏差模块；review 无变更关联→检查点不触发；实现越出声明影响面→WARNING；JSON-only 降级→SKIP+WARN；「评估后不改」以 design.md 评估记录留痕
- **理由**: 与既有 SKIP / FAIL / 降级口径同构，向后兼容存量变更与纯文档变更
- **备选**: 缺失按 0 分拉低 / 越面判 CRITICAL——误伤存量与降级路径，与 D10 先例矛盾

### D5: 语义层与结构层分工

- **选择**: review 一致性检查点只读 conformance 证据（`conformance-report.md` 的 `**summary**:` 行）作为结构层输入，不重复执行结构校验；证据缺失标注「非阻断」继续语义层检查
- **理由**: 与 `iagent spec conformance` 分工不重复（提示词基线）；review 白名单 `Bash(iagent:*)` 已隐含放行 CLI，无需扩权
- **备选**: review 内重复跑结构校验——重复劳动且偏离「审查只报告」语义

### D6: 细则下沉 references

- **选择**: 影响范围一致性判定矩阵（存在性判定 / 对齐规则 / SKIP-FAIL-WARN 处置）写入 spec-verify-proposal 新增 `references/impact-consistency.md`（新常量 + references 数组追加条目），SKILL.md 正文仅保留检查步骤骨架与读文件引导
- **理由**: 渐进披露机制已有（CONDITIONAL_DIMENSIONS_FULL 先例，:589-591）；保持 SKILL.md ≤500 行预算（test/skill-size-budget.test.ts 守护）
- **备选**: 全部内联 SKILL.md——超行数预算；并入 conditional-dimensions.md——D6-D10 条件维度语义混淆（新检查点属 D2/D3 侧）

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 影响面小节为自由文本，存在性判定可能误判 | 判定以小节标题锚点为准（影响面分析 / 架构影响 / Caller Updates），语义等价判定须指出具体对应之处（D10 语义判定先例同构），拿不准标「待验证」不计 FAIL |
| review 语义层误报设计决策违背 | 只报能指出决策条目 + 实现 `文件:行` + 触发场景的问题；分级遵循既有五维度报告口径；拿不准标「待验证」 |
| 双语义显式化后两形态行为漂移 | 正文写明确判定信号（编排上下文 / pipeline 工作区存在性），单测锁定两形态关键词与回执字段 |
| 模板正文增长超 SKILL.md 行数预算 | 细则下沉 references/impact-consistency.md；test/skill-size-budget.test.ts 守护 |
| 快照漂移（模板改后未再生成） | `pnpm build && pnpm generate:skills` 固定后置步骤；test/skills-parity.test.ts 拦截 |
| 检查点表述与既有 D3 语义（任务完整性）重叠引起执行混乱 | 检查点为 D3 内部的增量核查步骤，报告仍按 D3 口径输出覆盖率；正文明确「并入」而非「并列」 |

## 评估记录（检查能力点再分析结论，D3/BS-6 留痕）

| 评估对象 | 结论 | 依据 |
| :--- | :--- | :--- |
| 总分公式（spec-verify-proposal.ts:147 / :466-478） | 不改 | 新检查点并入既有维度评分，不触碰分母语义；公式核心与算法 MUST NOT 被新维度改动 |
| 90% 统一阈值（spec-verify-proposal.ts:475-477） | 不改 | 全局语义；阈值 / 权重语义变更须单独显式确认，本次未获确认 |
| D9 自证职责（spec-verify-proposal.ts:149-150） | 不改 | D9 查「是否拆了」与流程基准他证互补，职责分离成立；新检查点不与之竞争 |
| spec-verify.ts:36-45 执行方式表述 | 调整（显式化） | 双语义歧义消除：两形态判定信号 + 报告落盘要求按形态区分 |
| review 五维度（review.ts:23-27） | 不改 | 一致性检查点为条件触发，无关联时不改变既有五维度行为（BS-3） |
| review allowedTools（review.ts:11） | 不改 | `Bash(iagent:*)` 已隐含放行 conformance 证据读取；白名单只增不减维持现状 |
| 维度名枚举消费点（workflow.ts:31-39、auto-workflow.ts:30/:90-100、debug.ts:285、proposal-review.ts:438） | 不改 | 「扩展不改名」策略下枚举保持有效，无新维度编号 |
| CLI 校验代码（src/core/spec/） | 不改 | 结构校验与语义层检查点分工明确（D5），无需联动 |

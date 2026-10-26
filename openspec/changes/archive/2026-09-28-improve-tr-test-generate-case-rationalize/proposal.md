## Why

`venus_tr_test_generate`（v3.0 多 schema 测试生成技能）已沉淀了框架检测、BCDE 场景矩阵、分层策略、反模式防护等能力，但这些能力**没有被编排技能套件消费**，同时在自身规则上存在会向 AI 传导错误的设计。

三个具体问题：

1. **四种模式中三种完全没有测试产能**。`spec-propose.ts` 与 `tr-impl-auto-workflow.ts` 全文 0 处测试相关；`spec-apply.ts` 的编译检查显式使用 `mvn compile -DskipTests`，全流程无测试执行关卡——**即使生成了测试也从不运行**，测试形同虚设。
2. **唯一有测试产能的 debug 模式与测试生成技能脱钩**。`tr-impl-debug.ts` 4.2 强制回归测试，但编写动作自行实现，无法复用框架检测与既有风格对齐，导致回归测试与项目其它测试不同源。
3. **`[测试]` 任务标签三处口径不齐**。`TASKS_TEMPLATE` 与 `spec-apply` 的标签列表都不含 `[测试]`，但 `tr-commit-push.ts:64` 已假设它存在——**没有任何模板会产出 `[测试]` 标签**，而提交技能已按它工作。

此外该技能自身有两处会直接传导到下游的规则缺陷：

- **BCDE 示例标注自相矛盾**：示例把"参数为 null → 抛出参数校验异常"标为 `B`（正常路径），但按 BCDE 自身定义（"Boundary：Null、空值"）应为 Boundary。示例是 AI 生成用例时的模仿对象，错误标注会使覆盖度评估失真。
- **场景数量为固定配额**：对每个方法一律要求"1-2 正常 + 2-3 边界 + 1-2 业务规则 + 1-2 异常"，**无"该方法是否值得测"的前置判定**，直接驱动 AI 为凑配额生成低价值用例（纯 POJO、getter/setter、无分支的转发方法）。

还有一处规格与实现的双向不一致：能力 spec 声明 `FIRST 原则` 为 SHALL 级需求（`openspec/specs/tr-test-generate/spec.md:19`），但实现中已丢失（`grep -c FIRST` 结果为 0）。

**为什么是现在**：这些缺陷是同一个根因的多个表现——测试能力没有作为一等公民进入规划与执行链路。逐点修补会持续漂移，需要一次把"测试能力真源 + 四模式接入 + 标签口径"整体拉通。

## What Changes

### 一、测试用例设计规则的合理化（`venus_tr_test_generate` 自身）

- **修正 BCDE 示例标注矛盾**：把"null/空集入参"类示例从 `B` 改标为 `Boundary`，使示例与 BCDE 定义自洽
- **固定配额 → 分级取舍**：删除"每个方法一律 N 个场景"的硬配额，改为
  - 新增**"该不该测"闸门**（不测清单：纯数据类、getter/setter、无分支的转发方法、私有方法、框架生命周期回调）
  - 新增**用例优先级分级**（P0 必生成 / P1 默认生成 / P2 需显式确认才生成），分级**影响生成决策**
- **新增用例去重与合并规则**：同构输入强制合并为参数化用例，跨方法重复用例需归并
- **新增测试层级维度**：在语言/框架 schema 路由之外，新增**测试层级路由**（单元测试 / 功能级测试），二者正交；各 schema 内新增功能级小节（Java 走 `@SpringBootTest`/`@WebMvcTest`，Node 走 supertest）
- **新增覆盖度度量**：有工具链时实测（Java: JaCoCo；Node: c8/coverage），无工具链降级为静态"specs Scenario → 用例"映射矩阵，并标注"未实测"
- **补回 FIRST 原则**：把 spec 已声明但实现丢失的 FIRST（Fast/Independent/Repeatable/Self-validating/Timely）约束补入实现

### 二、`[测试]` 任务标签统一为一等类型

- 任务类型标签集从 `[代码]/[DB脚本]/[使用说明]` 扩展为**并列含 `[测试]`**
- `[测试]` 任务带层级与优先级子标注（如 `[测试][单元][P0]`）
- 同步 6 处硬编码的任务格式描述（`TASKS_TEMPLATE`、`schema.ts` instruction、`spec-propose.ts`、`tr-impl-auto-workflow.ts`、`tr-impl-workflow.ts` skill 版与 command 版）

### 三、四模式 + 交互式工作流接入测试能力

- **propose**：新增测试规划判定，按 specs 的 Scenario 产出 `[测试]` 任务（含层级、优先级、`产出:` 路径）
- **apply**：补充文档标签列表纳入 `[测试]`；在 Step 8 编译检查之后新增**测试执行关卡**（仅跑变更范围，存量红测试不阻塞）
- **auto-workflow**：Phase 4 继承 apply 的测试关卡并自动通关；失败 3 次自动修复后暂停，MUST NOT 静默通过、MUST NOT 进入归档
- **debug**：4.2 的回归测试编写动作改为**委派** `venus_tr_test_generate`；保留 debug 特有的"必须覆盖异常节点 + 根因节点"验证口径与"修复前失败/修复后通过"硬要求
- **交互式工作流**：`tr-impl-workflow.ts` 同步 propose/apply 的测试接入（skill 版与 command 版双份同步）

## Capabilities

### New Capabilities

无。本变更不新增能力，仅修改既有能力的行为。

### Modified Capabilities

- `tr-test-generate`: 新增测试层级路由（单元/功能级）、"该不该测"闸门（不测清单）、用例优先级分级（影响生成决策）、用例去重与合并规则、覆盖度度量（实测优先+静态矩阵降级）；修正 BCDE 示例标注矛盾；固定场景配额改为分级取舍；补回 FIRST 原则
- `spec-workflow-skills`: spec-propose 新增测试规划判定与 `[测试]` 任务产出；spec-apply 补充文档标签列表纳入 `[测试]`，Step 8 后新增测试执行关卡（仅变更范围，存量红不阻塞）与失败处置分支
- `tr-workflow-suite-skills`: tr-impl-auto-workflow Phase 4 接入测试关卡并自动通关（3 次修复后暂停）；tr-impl-debug 4.2 回归测试改为委派测试生成技能并保留异常/根因节点验证口径；tr-impl-workflow 同步 propose/apply 的测试接入（双份正文）
- `spec-workflow-cli`: `venus spec instructions tasks` 分发的任务模板新增 `[测试]` 类型标签与层级/优先级子标注说明；tasks artifact 的生成指令同步

## Impact

### 直接影响的文件

- `src/core/templates/workflows/tr-test.ts`: 主 SKILL 新增测试层级路由（阶段一）、不测闸门与优先级分级（阶段二）、去重合并规则（阶段二）、覆盖度度量（阶段五）；修正 BCDE 示例标注与配额要求；补回 FIRST 原则
- `src/core/templates/workflows/tr-test.ts`（`SCHEMA_JAVA`）: 新增功能级测试小节（`@SpringBootTest`/`@WebMvcTest`）、JaCoCo 覆盖度命令、Java 不测清单
- `src/core/templates/workflows/tr-test.ts`（`SCHEMA_NODE`）: 新增功能级测试小节（supertest）、c8/coverage 覆盖度命令、Node 不测清单
- `src/core/spec/templates/index.ts`: `TASKS_TEMPLATE` 类型标签注释新增 `[测试]` 与子标注说明
- `src/core/spec/schema.ts`: tasks artifact 的 instruction 同步标签集
- `src/core/templates/workflows/spec-propose.ts`: 新增测试规划判定；任务类型标签硬约束补入 `[测试]`
- `src/core/templates/workflows/spec-apply.ts`: 补充文档标签列表纳入 `[测试]`；Step 8 后新增测试执行关卡与失败处置分支
- `src/core/templates/workflows/tr-impl-auto-workflow.ts`: Phase 2 任务标签补入 `[测试]`；Phase 4 接入测试关卡 + Guardrails 条目
- `src/core/templates/workflows/tr-impl-debug.ts`: 4.2 回归测试改为委派 `venus_tr_test_generate`
- `src/core/templates/workflows/tr-impl-workflow.ts`: skill 版（`:1220` 附近）与 command 版（`:2162` 附近）双份同步测试接入
- `openspec/specs/tr-test-generate/spec.md`: 修订漂移的 FIRST 原则需求（补回实现并对齐）与分层测试指南的 Node 写死表述（改语言无关）
- `skills/**`（快照）: `pnpm generate:skills` 重新生成
- `package.json` + `CHANGELOG.md`: 版本号按 minor 递增（改技能模板行为），变更日志随本次提交

### 向后兼容

**无破坏性变更**，全部为增量扩展：

- `[测试]` 是**新增**标签，既有变更的 tasks.md 不含该标签时 apply 正常执行（标签为可选增强）
- `TASKS_TEMPLATE` 扩展标签集不改变既有 `[代码]` 任务的格式与解析
- 测试执行关卡在项目无测试框架时降级为 WARN + 跳过，不阻塞流程；存量红测试不计入本次失败
- BCDE 配额由"硬性区间"改为"分级取舍"会减少生成用例数——这是本次的预期效果，但既有依赖"每方法至少 N 个用例"的认知需要更新（技能文档已同步说明）
- 修订 FIRST 原则需求属于**补回实现**（而非删除需求），不构成对外行为破坏

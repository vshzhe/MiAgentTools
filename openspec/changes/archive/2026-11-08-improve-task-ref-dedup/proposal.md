## Why

`tasks.md` 的追溯引用当前要求 `Scenario Ref` 重复书写 `Spec Ref` 的完整 `capability / Requirement` 前缀，只额外追加场景名：

```text
- Spec Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性
- Scenario Ref：workflow-suite-skills / 编排技能的委派与派发白名单齐备性 / workflow 无子代理条目
```

同一路径前缀在一个任务块内出现两遍，既增加书写成本，也让 tasks.md 的噪声掩盖真正不同的信息（场景名）。
本变更只消除重复前缀，保留 Requirement / Scenario 两级覆盖校验语义（D1），使追溯既简洁又可机器校验。

## What Changes

- **追溯引用规范形态改为「Spec Ref 两段 + Scenario Ref 场景叶子名」**：`Spec Ref：<capability> / <Requirement>`、
  `Scenario Ref：<Scenario>`，由解析/校验层用**同一任务**的 Spec Ref 补全 `capability / Requirement / Scenario`
  全路径（D2）。
- **新增上下文补全与 fail-safe 诊断**：有 Scenario Ref 但任务无 Spec Ref 时报「缺少上下文」；任务有 ≥2 条
  Spec Ref 且场景为叶子名时报「歧义」；两种情况均要求写全路径，MUST NOT 猜测归属（D3）。`--partial` 起草期
  按既有规则降级为 `pending-ref` warning。
- **历史写法保持兼容**：全路径 `Scenario Ref`、HTML 注释式、一行双引用与裸名引用继续有效，不得让历史 /
  归档 tasks.md 产生新的 error（D3）。
- **模板与技能正文对齐**：`TASKS_TEMPLATE`、`spec-propose`、`spec-verify-proposal` 的规范形态说明更新为
  叶子名形态，并与解析器 / 校验器同一口径（D4）。
- **格式真源单点**：`workflow` / `auto-workflow` / `debug` 正文不新增第二份格式声明，经委派或继承自动生效（D4）。
- **测试与术语同步**：补齐解析器 / 校验器 / 模板测试，更新 `openspec/CONTEXT.md` 中 `Spec Ref` / `Scenario Ref` /
  「场景叶子名」/「引用上下文补全」术语。

## Capabilities

### New Capabilities

<!-- 无新增能力 -->

### Modified Capabilities
- `artifact-markdown-source`: Spec-to-task 追溯契约新增「场景叶子名」canonical 形态、同一任务上下文补全规则，以及
  「缺少上下文」/「歧义」两类 fail-safe 诊断；Requirement / Scenario 两级覆盖判定语义不变。
- `spec-workflow-skills`: `spec-propose` / `spec-verify-proposal` / `TASKS_TEMPLATE` 的追溯规范形态说明改为叶子名形态，
  并声明上下文缺失 / 歧义诊断与格式真源单点约束。

## Impact

### 直接影响的文件

- `src/core/spec/templates/index.ts`: `TASKS_TEMPLATE` 规范形态改为两段式 + 场景叶子名。
- `src/core/spec/parser/reference-resolver.ts`: 新增引用上下文补全模块（叶子名 → 全路径、缺失 / 歧义判定）。
- `src/core/spec/validation/traceability.ts`: `buildTraceability` 使用补全结果做覆盖匹配，新增两类诊断，
  移除「全局裸场景名」兜底匹配。
- `src/core/templates/workflows/spec-propose.ts`: 追溯规范形态正文更新。
- `src/core/templates/workflows/spec-verify-proposal.ts`: D3 规范引用形态正文更新。
- `openspec/CONTEXT.md`: `Spec Ref` / `Scenario Ref` / 场景叶子名 / 引用上下文补全术语（已预置，需核对）。
- `test/spec-artifact-parser.test.ts`: 补全 / 歧义 / 兼容性用例。
- `test/spec-commands.test.ts`: `TASKS_TEMPLATE` 形态与占位填充可解析断言。
- `test/templates.test.ts`: propose / verify-proposal 正文与 D3 口径断言。
- `skills/**/SKILL.md`: `pnpm generate:skills` 重新生成的静态快照。
- `src/core/templates/workflows/spec-verify-proposal.ts` 派生的命令版（`derive-command.ts` 自动派生，不手编）。

### Impact Analysis（影响分析）

- `TASKS_TEMPLATE`（`src/core/spec/templates/index.ts:76`）← `src/core/spec/instructions.ts:59`
  （`iagent spec instructions tasks` 分发）；下游消费为 `spec-propose` 正文与测试断言。
- `buildTraceability`（`src/core/spec/validation/traceability.ts:32`）← `src/core/spec/validation/artifact-validator.ts:38`
  → `runSpecValidate`（`iagent spec validate`）；新增诊断随现有诊断分级落盘。
- `parseTasks`（`src/core/spec/parser/task-parser.ts:23`）← `src/commands/spec.ts`（10 处调用）；
  本变更**不修改** `parseTasks` 的字段产出语义（叶子名原样保留），补全发生在校验层，避免影响既有消费者。
- 测试锁定面：`test/spec-artifact-parser.test.ts` / `test/spec-commands.test.ts` / `test/templates.test.ts`。
- 影响面降级说明：`codegraph_impact` 不可用，已由 `codegraph_explore` + Grep 核验调用链（见探索文件
  `## Codebase Findings`）。

### 向后兼容

- 无 **BREAKING**：历史 tasks.md 的 `Spec Ref` / `Scenario Ref` 全路径、HTML 注释式、一行双引用与裸名写法继续有效。
- 场景叶子名是**新增推荐形态**；旧写法不产生新 error，覆盖计数不因书写形态变化而下降。
- 新诊断仅在「叶子名无法消歧」时触发，且 `--partial` 起草期降级为 `pending-ref` warning。

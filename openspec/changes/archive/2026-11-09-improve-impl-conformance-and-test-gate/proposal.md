## Why

当前实现阶段的可信度依赖 AI 自证，三个缺口在归档前没有硬门：

- **specs ↔ tasks 不一致**：`buildTraceability` 对每个 Scenario 只在没有覆盖任务时产出 `warning`（`src/core/spec/validation/traceability.ts:121-150`），`validateParsedChange` 只在 `severity === 'error'` 时判 `valid=false`（`src/core/spec/validation/artifact-validator.ts:48`）。任务勾选完成只代表 AI 自述，缺「任务 → 产出文件 / 代码证据」与「Scenario → 测试」的核验。
- **自动单测能力薄弱**：`iagent_spec_apply` 仅在 tasks.md 已规划 `[测试]` 任务时才调用 `iagent_test`（`src/core/templates/workflows/spec-apply.ts:98-106`）；Step 9 测试门只运行既有测试（`src/core/templates/workflows/spec-apply.ts:481-508`），无测试任务时不会生成任何测试；debug 仅在 4.2 生成回归测试，Phase 5 只做编译检查（`src/core/templates/workflows/debug.ts:437-443`）。测试结果也没有可机器复核的证据文件。
- **项目规则读取无完整性证据**：apply / verify / debug 只声明读取 `.iagent/rules/coding-rules.md`（`src/core/templates/workflows/spec-apply.ts:275`、`src/core/templates/workflows/spec-verify.ts:14`、`src/core/templates/workflows/debug.ts:143`）；`CLAUDE.md` / `AGENTS.md` / `.iagent/rules/testing-rules.md` / `.iagent/rules/spec.md` / `config.yaml` 的 context 未进入读取契约。`listRuleFiles()` 已存在（`src/core/project-config.ts:864`）但没有消费面。

为什么是现在：编排已全面转入主 agent 内联，可信度必须由「固定清单 + 落盘证据 + 硬门」承担；编译门已经用 `compile-report.md` 验证了该模式，测试与一致性可以复用同一模式补齐。

## What Changes

- **新增一致性判定能力（三层）**：规划层（Requirement/Scenario → 任务追溯）、实现层（已勾选任务 → 产出文件 / 代码证据）、测试层（Scenario → 至少一个 `[测试]` 任务）。新增 `iagent spec conformance --change <name> [--json] [--strict]` 输出覆盖矩阵与缺失项；`iagent spec validate` 新增可选 `--conformance` 严格模式（默认行为不变）。
- **新增实现一致性门**：apply 在测试门之后执行一致性门，产出 `.openspec-tmp/pipeline-<change>/conformance-report.md`；`fail` 或证据缺失 MUST NOT 进入归档。auto-workflow / debug / workflow 只读该证据，不另立判定。
- **新增自动单测补齐**：apply 在编译检查通过后、测试门前，对变更范围内「有行为」的生产文件补齐单测（先消费 tasks.md 的 `[测试]` 任务，只补缺口），内联调用 `iagent_test`；自动管线下其测试计划门自动采用推荐计划并记 WARN。
- **新增测试证据**：`.openspec-tmp/pipeline-<change>/test-report.md`（九列 + `**summary**:` 汇总行），apply 与 debug 均产出；auto-workflow 归档前与编译证据一起只读判定。
- **debug 补强**：Phase 5 编译检查后新增「变更范围内既有测试执行」并产出测试证据；Phase 6/7 增加一致性门消费。
- **规则读取完整性**：新增 `iagent rules --json` 枚举规则源（`.iagent/config.yaml`、`.iagent/rules/*.md`、`CLAUDE.md`、`AGENTS.md`）；探索阶段产出 `## 项目规则基线`；apply handoff `## 规范要点` 扩为多源；阶段回执写 `rulesRead`，一致性门校验覆盖。
- **不改变**：`iagent spec validate` 默认严格度、编译门四值终态、`iagent_test` 作为测试规则唯一源、`openspec/rules/*.md` 的蒸馏源定位（运行时仍只读 `.iagent/rules/`）。

## Capabilities

### New Capabilities

- `spec-conformance`: 实现一致性三层判定、`iagent spec conformance` 覆盖矩阵、`validate --conformance` 严格模式与 `conformance-report.md` 证据契约。
- `test-evidence-gate`: 自动单测补齐、`test-report.md` 测试证据契约、apply/debug 的测试执行门与归档前只读判定。
- `rule-baseline`: 规则源枚举 CLI、`## 项目规则基线`、handoff 多源 `## 规范要点` 与 `rulesRead` 完整性校验。

### Modified Capabilities

- `spec-workflow-skills`: `spec-apply` 新增自动单测补齐与实现一致性门；`spec-verify` 消费一致性 / 测试证据并对缺口判 CRITICAL；`spec-propose` 的 `## 规范要点` 扩为多源并强化任务配对。
- `workflow-suite-skills`: `workflow` / `auto-workflow` / `debug` 编排消费规则基线、测试证据与一致性证据；debug 新增范围内测试执行。
- `test-generate`: 新增 delegated/auto 调用语义——自动管线内计划确认门自动采用推荐计划并记 WARN；补齐调用需接收变更范围与已覆盖 Scenario。

## Impact

### 直接影响的文件

- `src/core/spec/validation/conformance.ts`（新建）：三层一致性判定与矩阵输出。
- `src/core/spec/validation/traceability.ts`：补充 Requirement 级覆盖与测试任务覆盖判定（保持默认 warning 语义）。
- `src/core/spec/validation/artifact-validator.ts`：透传一致性证据选项。
- `src/commands/spec.ts`：新增 `conformance` 子命令、`validate --conformance`。
- `src/commands/rules.ts`（新建）+ `src/cli/index.ts` + `src/commands/completion.ts`：`iagent rules --json`。
- `src/core/project-config.ts`：复用/扩展规则源枚举（`listRuleFiles`）。
- `src/core/templates/workflows/spec-apply.ts`：Step 8.11 自动单测补齐、Step 9 测试证据、Step 9.7 一致性门、Step 10 证据保留、`allowedTools` 校准。
- `src/core/templates/workflows/spec-verify.ts`：消费 `conformance-report.md` / `test-report.md`，缺口判 CRITICAL。
- `src/core/templates/workflows/spec-propose.ts`：handoff `## 规范要点` 多源化、任务配对约束。
- `src/core/templates/workflows/spec-explore.ts`：规则基线检查点。
- `src/core/templates/workflows/workflow.ts` / `auto-workflow.ts` / `debug.ts`：消费新证据与门、debug Phase 5.5。
- `src/core/templates/workflows/test.ts`：delegated/auto 计划门处置与补齐输入。
- `skills/`：`pnpm build && pnpm generate:skills` 重建快照。

### 向后兼容

- `iagent spec validate` 默认行为不变（未覆盖场景仍为 warning）；严格判定只在 `--conformance` 或 apply 一致性门显式启用。
- 存量变更（含历史 JSON-only）不追溯重判：一致性门对它们记 WARN 并按只读降级处理。
- 新增 CLI 子命令与证据文件均为增量，不删除既有命令、字段或产物布局。
- 无 BREAKING 变更。

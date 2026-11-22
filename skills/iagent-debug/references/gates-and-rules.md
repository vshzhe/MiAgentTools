### 6.3 Markdown 校验（章节清单）

`proposal.md` 含 Why / What Changes / Capabilities / Impact；`specs/**/*.md` 含 `### Requirement:` + `#### Scenario:`；`design.md` 含 Context / Decisions / Risks；`tasks.md` 任务带类型标签与 checkbox 状态。

### 6.4 一致性证据与就绪门（细则）

- **一致性**：运行 `iagent spec conformance --strict`，写 `.openspec-tmp/pipeline-<change-name>/conformance-report.md`；`fail` / 缺失 → 回 Phase 4
- **就绪门**：运行 `iagent spec validate --change "<name>" --ready`（与 propose 侧同一 `readiness.ts`，MUST NOT 另立判定口径）：四类判定为结构 / 覆盖 / 锚点 / 能力对齐；`fail` → 按逐条诊断就地修正后重跑（≤3），超限回 Phase 4
- **存量兼容**：锚点缺失对新变更记 error、对存量变更记 WARN + SKIP（不阻断）
- **推进条件**：仅当制品反映全部修复、且两项证据均通过后才进入 Phase 7

### 7.3 实现后 review 环节（细则）

- **调用形态**：由主 agent 内联调用 `iagent-review` skill（`executionMode=inline` / `independence=self`，self 记 WARN），MUST NOT 派发子代理；review 检查修复实现完整度（缺陷链路覆盖、修复遗漏、明显缺陷），MUST NOT 重复 spec_verify_proposal 的一致性清单。
- **报告落盘（强制）**：结论写入 `.openspec-tmp/pipeline-<change-name>/review-report.md`，文末汇总行 `**summary**: pass|not-applicable|fail`；收束判定读取该汇总行。
- **问题分级与预算**：P0/P1 → 回 Phase 4 修复循环（与编译 / 测试共用既有 ≤3 预算）后重跑 review，3 次耗尽仍未收束 → 暂停并报告；未收束（`fail`）MUST NOT 输出「已可归档」收束提示。P2 → 记录到 review 报告，不阻断流程推进。
- **not-applicable 直通**：变更范围无代码改动（纯制品 / 文档变更）→ review 判定 `not-applicable` 并留痕，直接收束。
- **降级二分（strict / 显式 degraded）**：`iagent-review` 不可用（宿主不支持内联调用且未经显式 degraded 协商）→ strict 阻断并报告，记录「本阶段未发生内联技能调用」，MUST NOT 静默跳过、MUST NOT 伪装为「已审查」；仅宿主显式协商 degraded 时才降级为本地深度复查 + WARN 透明记录。

### 2.1.6 项目规则基线（强制）

**⚠️ 强制: 本步在 2.1.5 之后、2.2 CodeGraph 排查之前执行。**

1. 运行 `iagent rules --json --type impl` 枚举并**按三层分层**（`always` / `phase` / `onDemand`；**不**包含 `openspec/rules/**`）
2. **按层读取**：`always`（config context、`CLAUDE.md`、`AGENTS.md`）恒读；`phase`（`--type impl` 命中的 `coding-rules.md`）MUST 读；`onDemand`（其余规则）与本缺陷相关时读，否则显式声明不需要读
3. 把「源 / 相关性层级 / 存在性 / 读取状态 / 关键约束摘要或不需要读的理由」写入诊断记录（Phase 6 随根因分析持久化到变更 `exploration.md`）
4. 失败处置：源缺失 → 记「不存在」（合法终态，不阻断）；读取失败 → WARN 并标「未读」；全部源缺失 → 记「无规则源」并继续；`fallback=true` → 按常驻基线继续 + WARN，MUST NOT 回退全量
5. 三层细则与未读声明格式见 `references/gates-and-rules.md`

**强制检查点**：规则基线未建立时 MUST NOT 进入 2.2；规则源缺失不阻断排查。

### 2.1.7 项目技能基线（强制）

**⚠️ 强制: 本步在 2.1.6 之后、2.2 CodeGraph 排查之前执行。**

1. 运行 `iagent skills --json --phase design` 枚举**按阶段筛选**后的技能（`design` 匹配 `phases` 含 `design` 或 `both`）
2. 读取筛选结果中 `exists=true` 的技能，把「源 / 存在性 / 读取状态 / 完整性 / 关键约束摘要」写入诊断记录（与规则基线并列、互不替代）；缺陷已明确只涉前端或只涉后端时 MAY 追加 `--scope`，未明确时 MUST NOT 传
3. 配置为空 / 全部缺失 → 记「无技能配置」并继续；读取失败 → WARN 并标「未读」；`validation.status=incomplete` → WARN 并列出缺失章节 / 占位符 / 无证据规则数，MUST NOT 当作完整规范使用
4. 根因分析与修复方案以技能为约束；技能与代码冲突时显式呈现（代码事实优先）

**强制检查点**：技能基线未建立时 MUST NOT 进入 2.2；配置为空不阻断排查。

## Phase 5.5: 变更范围内测试执行（强制）

**位置**：Phase 5 编译检查之后、Phase 6 同步之前。

- **范围**：本次修复改动文件对应的既有测试 + 4.2 生成的回归测试；MUST NOT 把全量套件结果作为通过/失败判据
- **运行**：按项目技术栈探测测试命令（Java `mvn test` / `gradle test`；Node `pnpm test` / `npm test`；Go `go test ./...`；Rust `cargo test`）；仅运行变更范围（可按测试类 / 文件过滤）
- **失败处置**：范围内失败进入与编译检查相同的自动修复重试预算（≤3）；耗尽即写 `fail` 证据并暂停，MUST NOT 进入 Phase 6 / 归档；范围外存量失败仅 WARN 且 MUST NOT 阻塞
- **证据**：写 `.openspec-tmp/pipeline-<change-name>/test-report.md`（九列 + `**summary**:` 汇总行；无测试框架 → `not-applicable` 并记 WARN），向 handoff 包 `## 阶段结论` 追加 `test` 行
- **边界**：debug MUST NOT 因本步骤额外生成单测 —— 新增测试由 4.2 回归测试承担，避免重复生成

## 6.4 实现一致性证据（强制）

- 运行 `iagent spec conformance --change "<changeName>" --strict --rules-read "<逗号分隔的已读取规则源>" --json`，校验三层覆盖与回执 `rulesRead` 对规则源 `exists=true` 集合的覆盖；并校验 `skillsRead` 对 `phases` 含 `implement` 或 `both` 且 `exists=true` 的技能覆盖（design-only 不要求）——存在未读 → `skills-not-read`（fail）；已读但 `validation.status=incomplete` → `skills-incomplete`（WARN，不判 fail）
- 写 `.openspec-tmp/pipeline-<change-name>/conformance-report.md`（九列 + `**summary**:` 汇总行），向 handoff 包追加 `conformance` 行
- `fail` / 证据缺失 → 回到 Phase 4 修复，MUST NOT 进入 Phase 7

## 7.0 实现一致性证据消费（强制）

- 读取 `.openspec-tmp/pipeline-<change-name>/conformance-report.md` 的 `**summary**:` 行；`status=pass` 放行，`fail` / 缺失 → 回到 Phase 4 修复，MUST NOT 宣告可归档
- 读取 `test-report.md` 的汇总行作为测试门结论（`pass` / `not-applicable` / `disabled` 放行）
- debug MUST NOT 自行重跑 conformance / 测试命令或另立判定；证据由 Phase 5.5 / 6.4 单点产出

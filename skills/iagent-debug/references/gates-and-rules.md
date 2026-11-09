### 2.1.6 项目规则基线（强制）

**⚠️ 强制: 本步在 2.1.5 之后、2.2 CodeGraph 排查之前执行。**

1. 运行 `iagent rules --json` 枚举规则源（`.iagent/config.yaml`、`.iagent/rules/*.md`、`CLAUDE.md`、`AGENTS.md`；**不**包含 `openspec/rules/**`）
2. 读取全部 `exists=true` 的源，并把「源 / 存在性 / 读取状态 / 关键约束摘要」写入诊断记录（Phase 6 随根因分析持久化到变更 `exploration.md`）
3. 源缺失 → 记「不存在」（合法终态，不阻断）；读取失败 → WARN 并标「未读」，MUST NOT 伪装为已读；全部源缺失 → 记「无规则源」并继续

**强制检查点**：规则基线未建立时 MUST NOT 进入 2.2；规则源缺失不阻断排查。

### 2.1.7 项目技能基线（强制）

**⚠️ 强制: 本步在 2.1.6 之后、2.2 CodeGraph 排查之前执行。**

1. 运行 `iagent skills --json` 枚举配置技能，**按阶段筛选** `phases` 含 `design` 或 `both`（implement-only 不进入设计约束）
2. 读取全部 `exists=true` 的技能，把「源 / 存在性 / 读取状态 / 完整性 / 关键约束摘要」写入诊断记录（与规则基线并列、互不替代）
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

# spec-verify 能力规格（delta）

## ADDED Requirements

### Requirement: Correctness 实现影响面对比

后置验证 Correctness 维度 SHALL 并入「实现影响面 vs 提案声明影响面对比」检查点（流程节点 N12）：读 `proposal.md` 声明影响面（Impact 影响面分析小节）与实现实际改动文件集并对比；越面以 WARNING 分级，逐条列出差异；结构层拦截仍由 `iagent spec conformance` 承担，本检查点 MUST NOT 重复执行结构校验（D2/D4）。

#### Scenario: 实现越出声明影响面

- **WHEN** 实现改动文件集包含提案声明影响面之外的文件
- **THEN** 报 WARNING 并逐条列出越面文件与可操作建议（BS-4），MUST NOT 判 CRITICAL 阻断归档

#### Scenario: 提案无影响面制品

- **WHEN** proposal.md 无影响面分析小节（影响分析未触发或存量 JSON-only 降级）
- **THEN** 对比检查点 SKIP + WARN（注明原因），三维度其余检查照常，MUST NOT 判 CRITICAL（BS-5）

### Requirement: 执行方式双语义显式化

spec-verify 正文执行方式段 SHALL 显式区分两种调用形态并给出判定信号：父编排内联合并清单模式（D1-D10 核心维度 + B1-B7 边界清单，报告落盘 `.openspec-tmp/pipeline-<change>/verify-report.md`）与独立调用三维度 report-only 模式（Completeness / Correctness / Coherence），消除原 :39 行的双语义歧义（D3）。

#### Scenario: 父编排内联合并清单模式

- **WHEN** 由工作流编排内联调用（如 auto-workflow Phase 3、实现验证桥）
- **THEN** 按合并清单执行并输出 executionMode=inline / independence=self / readScope 回执字段，报告落盘 pipeline 工作区 verify-report.md

#### Scenario: 独立调用三维度模式

- **WHEN** 用户独立调用 iagent-spec-verify（无编排上下文）
- **THEN** 按 Completeness / Correctness / Coherence 三维度执行 report-only 验证，不要求合并清单产物路径；两种形态在正文有明确判定信号（编排上下文存在与否）

### Requirement: report-only 权限边界

后置验证 SHALL 保持 report-only 语义与既有 allowedTools（`Bash(iagent:*), Read, Glob, Grep`）：不修改文件、不执行归档、不新增权限（D1）。

#### Scenario: 验证不改文件

- **WHEN** 验证发现 WARNING / CRITICAL 问题
- **THEN** 仅输出分级报告与修复建议，MUST NOT 修改制品或源码；allowedTools 白名单字面量与既有完全一致（只增不减维持现状约束下本次零新增）

# Tasks: markdown-first-artifacts

## 1. Markdown 运行时模型与解析器

- [x] 1.1 [代码] 新增 `ParsedChange`、`ParsedProposal`、`ParsedDesign`、`ParsedSpec`、`ParsedScenario`、`ParsedTask` 和诊断类型，明确 Markdown 是输入真源；验证：TypeScript 编译通过，类型覆盖 proposal/design/spec/tasks 及路径行号诊断。Spec Ref：`artifact-markdown-source / Markdown artifacts are the sole editable source of truth`

- [x] 1.2 [代码] 实现公共 Markdown 标题、section、行号和文件路径解析工具，支持 Windows 路径归一化；验证：单元测试覆盖标题层级、重复标题、空文件、CRLF 和 LF。Spec Ref：`artifact-markdown-source / Markdown parsing and validation produce actionable diagnostics`

- [x] 1.3 [代码] 实现 proposal.md 和 design.md 解析器，提取标准章节但保留表格、代码块、Mermaid 和未知 Markdown 原文；验证：夹杂表格/代码块的 fixture 解析后内容不丢失。Spec Ref：`artifact-markdown-source / OpenSpec Markdown structure is preserved and machine-readable`

- [x] 1.4 [测试][单元][P0] 为 proposal/design parser 增加章节提取、缺失章节、重复章节和行号诊断测试；验证：相关 Vitest 用例通过。Spec Ref：`artifact-markdown-source / Markdown parsing and validation produce actionable diagnostics`

## 2. Spec 与任务解析校验

- [x] 2.1 [代码] 实现 delta spec parser，解析 ADDED/MODIFIED/REMOVED/RENAMED section、Requirement、Scenario、WHEN/THEN、Reason、Migration 和 FROM/TO；验证：四种 delta 操作 fixture 均生成正确运行时模型。Spec Ref：`artifact-markdown-source / OpenSpec Markdown structure is preserved and machine-readable`

- [x] 2.2 [代码] 实现 tasks.md parser，解析 checkbox、任务编号、类型标签、测试子标签、依赖、文件、验证、Spec Ref 和 Scenario Ref；验证：混合标签任务和多行任务说明可被稳定解析。Spec Ref：`artifact-markdown-source / Tasks maintain explicit traceability to requirements`

- [x] 2.3 [代码] 实现 artifact validator，校验 Requirement 必须有 Scenario、Scenario 的 WHEN/THEN、任务编号唯一、任务依赖存在、引用目标存在和必要章节结构；验证：每类非法 fixture 都返回 invalid 与文件路径/行号。Spec Ref：`artifact-markdown-source / Markdown parsing and validation produce actionable diagnostics`

- [x] 2.4 [代码] 实现 Scenario 到 Task 的追溯矩阵，输出未覆盖 Scenario、失效 Spec Ref 和无测试评估记录；验证：有效引用通过，缺失/失效引用被明确报告。Spec Ref：`artifact-markdown-source / Tasks maintain explicit traceability to requirements`

- [x] 2.5 [测试][单元][P0] 增加 spec/task parser、validator 和 traceability 的边界测试，包括空 Scenario、重复任务、循环依赖、未知标签、CRLF 和 Unicode；验证：相关测试通过且错误均含路径和行号。Spec Ref：`artifact-markdown-source / Markdown parsing and validation produce actionable diagnostics`

## 3. CLI 状态与指令契约

- [x] 3.1 [代码] 将 `src/core/spec/schema.ts` 的 artifact 输出路径改为 `proposal.md`、`specs/**/*.md`、`design.md`、`tasks.md`，保留 proposal→specs/design→tasks 依赖图和 skip_specs 语义；验证：依赖图和路径单元测试通过。Spec Ref：`spec-workflow-cli / 内置 spec-driven 依赖图`

- [x] 3.2 [代码] 重构 `status` 使用 parser/validator 判定 done/ready/blocked/invalid，并保留 skipped/conflict；验证：有效、缺失、非法和 skip_specs 变更的 JSON 状态符合规格。Spec Ref：`spec-workflow-cli / iagent spec status 状态校验`

- [x] 3.3 [代码] 重构 `instructions` 返回 Markdown template、outputPath、resolvedOutputPath、dependencies、unlocks 和解析约束，移除新流程对 `jsonTemplate` 的依赖；验证：proposal/specs/design/tasks 的输出路径均为 Markdown。Spec Ref：`spec-workflow-cli / Markdown task instructions`

- [x] 3.4 [代码] 重构 `instructions apply`，使 contextFiles 指向 proposal.md、design.md、specs 目录和 tasks.md，taskList/progress 从 tasks.md 解析；验证：pending/done/invalid/blocked 场景输出正确。Spec Ref：`spec-workflow-cli / Markdown task instructions`

- [x] 3.5 [代码] 增加 `iagent spec validate --change <name>`，输出结构、依赖和追溯诊断；验证：合法变更退出码 0，invalid 变更退出码非零并包含路径/行号。Spec Ref：`artifact-markdown-source / Markdown parsing and validation produce actionable diagnostics`

- [x] 3.6 [测试][功能][P0] 更新 spec CLI 测试，覆盖 Markdown status、instructions、apply、validate、skip_specs、invalid 和 CLI `--json` 不写入 JSON 文件；验证：`pnpm test -- test/spec-commands.test.ts test/spec-status.test.ts` 通过。Spec Ref：`spec-workflow-cli / iagent spec status 状态校验`

## 4. JSON 历史兼容与显式迁移

- [x] 4.1 [代码] 将旧 sidecar 读取隔离到兼容模块，制定 Markdown 优先、JSON-only 只读降级、冲突不自动合并的统一读取策略；验证：Markdown 与 JSON 并存时只使用 Markdown，JSON-only 读取输出 WARN。Spec Ref：`artifact-json-sidecar / 旧 JSON Sidecar 文件 SHALL 保留可读，读方按降级链回退`

- [x] 4.2 [代码] 实现 `iagent spec migrate --from-json --change <name>` 的显式转换流程，将历史 change.json/tasks.json 或旧 sidecar 转换为 OpenSpec Markdown；验证：目标不存在时生成 proposal/design/specs/tasks 并通过 Markdown validate。Spec Ref：`artifact-markdown-source / Legacy JSON artifacts require explicit migration`

- [x] 4.3 [代码] 为迁移增加目标冲突保护、校验失败回滚/保留源文件和显式 `--delete-legacy` 边界；验证：目标文件已存在时不覆盖，默认不删除 JSON，迁移失败不留下未验证产物。Spec Ref：`artifact-markdown-source / Legacy JSON artifacts require explicit migration`

- [x] 4.4 [测试][功能][P0] 增加 Markdown/JSON 混合、JSON-only、迁移冲突、迁移失败和删除选项测试；验证：历史 JSON 未被常规 status/apply/archive 修改。Spec Ref：`artifact-json-sidecar / 旧 JSON Sidecar 文件 SHALL 保留可读，读方按降级链回退`

## 5. 归档索引与缓存

- [x] 5.1 [代码] 将 `iagent spec reindex` 主链路切换为 Markdown parser，提取 proposal/design/specs/exploration 内容写入既有 SQLite 表；验证：Markdown-only 归档可以完整建立 changes/capabilities/decisions/requirements/exploration_memory 索引。Spec Ref：`sqlite-cross-change-index / iagent spec reindex 按降级链读取数据源`

- [x] 5.2 [代码] 为索引结果增加来源文件路径、标题或行号，并保证查询结果要求 Agent 回读 Markdown 原文；验证：历史决策和需求查询结果包含可定位来源。Spec Ref：`sqlite-cross-change-index / 全文搜索决策和需求`

- [x] 5.3 [代码] 保留历史 JSON reindex 降级并记录 WARN，增加内容 hash/mtime 缓存和 `--force` 全量重建路径；验证：删除或损坏 index.db 后可从 Markdown 重建，制品文件不变。Spec Ref：`sqlite-cross-change-index / iagent spec reindex 按降级链读取数据源`

- [x] 5.4 [测试][功能][P1] 增加 Markdown-first reindex、JSON fallback、来源定位、空 archive、损坏数据库和 force rebuild 测试；验证：SQLite 索引相关测试全部通过。Spec Ref：`sqlite-cross-change-index / Rebuild after cache loss`

## 6. 共享生成协议与 spec 技能

- [x] 6.1 [代码] 重写 `openspec/rules/artifact-generation.md` 为 Markdown-first G1-G7 协议，明确写入后校验、重新读取、context/rules 不落盘和 CLI JSON 仅为摘要；验证：协议中无新变更写 change.json/tasks.json 或 render tasks 的要求。Spec Ref：`artifact-generation-protocol / Shared Markdown artifact generation protocol`

- [x] 6.2 [代码] 更新 `spec-propose`，按依赖顺序直接创建 proposal.md、specs/design Markdown 和 tasks.md，生成每个可测 Scenario 的任务及 Spec Ref/Scenario Ref；验证：模板正文不含 JSON-first 生成路径，相关模板测试通过。Spec Ref：`spec-workflow-skills / spec skills use Markdown as the artifact contract`

- [x] 6.3 [代码] 更新 `spec-apply`，从 Markdown contextFiles 获取上下文，直接更新 tasks.md checkbox，保留设计确认、编译、测试和失败处置门；验证：完成任务不创建/更新 tasks.json，部分完成不勾选。Spec Ref：`spec-workflow-skills / Apply updates task Markdown`

- [x] 6.4 [代码] 更新 `spec-verify` 和 `spec-verify-proposal`，使用 Markdown parser、Scenario 覆盖和任务追溯矩阵；验证：缺失场景、失效引用和代码覆盖缺口可定位。Spec Ref：`spec-workflow-skills / Verify reads Markdown`

- [x] 6.5 [代码] 更新 `spec-archive` 和 `spec-bulk-archive`，直接解析 delta spec Markdown 合并主 spec，归档前运行结构和追溯校验；验证：ADDED/MODIFIED/REMOVED/RENAMED 合并不依赖 change.json。Spec Ref：`spec-workflow-skills / spec-archive / spec-bulk-archive SHALL 从 change.json specs 段执行主 spec 同步`

- [x] 6.6 [代码] 更新 `requirement-doc`，从 proposal.md/design.md/specs/**/*.md/tasks.md 生成八章节文档，历史 JSON-only 仅只读降级；验证：技能正文不再把 change.json/tasks.json 作为主来源。Spec Ref：`workflow-suite-skills / requirement-doc 双执行模式与八章节转换`

- [x] 6.7 [测试][功能][P0] 增加 spec 技能正文回归锁，禁止新变更 JSON-first、tasks.json 主路径、proposal/design/specs JSON 渲染和“Markdown 仅降级”表述；验证：模板和派生 command 内容扫描通过。Spec Ref：`spec-workflow-skills / spec skills use Markdown as the artifact contract`

## 7. 编排技能与共享 Agent 资源

- [x] 7.1 [代码] 更新 `workflow` 和 `auto-workflow` 的内联制品生成与就绪判定，统一引用 Markdown-first artifact-generation 协议；验证：两条路径均以 Markdown status/validate 为阶段门。Spec Ref：`workflow-suite-skills / workflow 端到端引导管线（实现与归档委派）`

- [x] 7.2 [代码] 更新 `debug` Phase 6 和 `proposal-review`，直接修改 proposal/design/spec/tasks Markdown，并在 scope change 时触发用户确认；验证：调试同步不写 JSON，复查补充 Scenario 与任务引用可追溯。Spec Ref：`workflow-suite-skills / debug 关联变更判定与调试循环`

- [x] 7.3 [代码] 将现有 context-pack 共享资源协议改为从 Markdown parser/model 蒸馏，保留文件归属、缺口回执、最小回执和协调者集中勾选；验证：两单元以上批次只生成一个包，子代理指令包含 Spec Ref。Spec Ref：`spec-workflow-skills / Markdown reading is selective and shareable`

- [x] 7.4 [测试][功能][P1] 增加 workflow/auto-workflow/debug/proposal-review 的数据流测试，覆盖 Markdown 读取、tasks.md 状态、context-pack 和无 JSON 新变更；验证：artifact-dataflow 和模板测试通过。Spec Ref：`workflow-suite-skills / auto-workflow 全自动管线`

## 8. 文档、兼容收口与交付验证

- [x] 8.1 [使用说明] 更新 `AGENTS.md`、`README.md`、`docs/skills-manual.md` 和 `openspec/rules/artifact-generation.md`，移除 JSON-only 主流程，说明 Markdown 真源、CLI JSON、SQLite 缓存和显式迁移边界；验证：文档检索不到与新流程冲突的 JSON-only 指令。Spec Ref：`artifact-markdown-source / Markdown artifacts are the sole editable source of truth`

- [x] 8.2 [代码] 更新 sidecar、status、instructions、render 和相关命令的弃用/兼容提示，确保旧 `iagent spec render tasks` 不会覆盖 tasks.md；验证：旧命令给出明确迁移提示且不产生数据写入副作用。Spec Ref：`spec-workflow-cli / iagent spec instructions 模板分发`

- [x] 8.3 [测试][功能][P0] 更新 skills 快照和 parity/allowed-tools/template-derivation 测试，确保 Markdown-first 指令与配套 command 内容一致；验证：`pnpm build && pnpm generate:skills` 后相关测试通过。

- [x] 8.4 [测试][功能][P0] 执行全量集成验证：新建 Markdown 变更、生成 proposal/specs/design/tasks、validate、apply 任务推进、verify、archive、reindex 和历史 JSON 只读兼容；验证：`pnpm build && pnpm test && pnpm lint` 全部通过。

- [x] 8.5 [使用说明] 更新 CHANGELOG 并按 BREAKING 变更递增版本号，记录 JSON-first 到 Markdown-first 的迁移、兼容边界和显式迁移命令；验证：版本号、变更日志和用户文档口径一致。

## Workflow follow-up

- 归档本变更前，执行 `iagent spec validate --change markdown-first-artifacts`（或等价的 OpenSpec 校验）并确认所有任务完成。
- 归档后执行一次 `iagent spec reindex --force`，确认 Markdown 主链路和历史 JSON 降级链均可用。

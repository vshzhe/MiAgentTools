# 归档变更索引 2026-11

> 本文件记录 2026-11 的归档变更，由归档流程纯追加。

---

## 归档变更列表

| 归档日期 | 变更名称 | 模块 | 摘要 |
|---------|---------|------|------|
| 2026-11-01 | fix-mode-delegation-host-parity | orchestration | 修复技能间委派权限弹窗与委托模式语义：白名单全名化 + mode/gate-skip 双轴 + 四宿主×表面一致。[含测试/使用说明] |
| 2026-11-01 | improve-compile-gate-and-archive-readonly | workflow | 两条同源缺陷：编译检查能力弱且有跳过路径；归档写入面过宽越界改写历史变更 [含测试] |
| 2026-11-02 | fix-multi-agent-skill-command-generation | templates | 四宿主（claude/pi/opencode/codex）技能与指令生成框架的 9 项缺陷收敛：skills-only 引用改写、参考文件归一化、围栏感知参数注入、worker 最小权限。[含测试] |
| 2026-11-03 | improve-proposal-validation-and-spec-ref | spec | 提案生成链路的正常中间态被当成错误，导致生成循环提前收敛、模型被迫先补 design：validate 起草期模式（`--partial` / `--artifact`）、design 可选依赖与 `optional` 状态、Spec Ref/Scenario Ref 多形态解析与诊断分层、`planningHome`/`artifactPaths` 路径字段契约、`actionContext` 清除。[含测试] |
| 2026-11-03 | improve-delegation-gate-ledger | orchestration | 委派门重复确认的两条缺陷：门账本（handoff 包 `## 已确认门` 段 + 回执 `confirmedGates` 校验；`gate-skip` 仍为主通道，账本仅参数丢失时兜底，缺失 / 不一致仍执行门）、workflow 交付桥合并（文档桥并入实现桥，「仅生成文档」停在规划边界；`workflow` VERIFY 不再声明 `requirement-doc-bridge`，5 类白名单与锚点集合不变）。[含测试] |
| 2026-11-03 | feat-debug-dual-track-entry | debug | debug 强制复现无第二入口、诊断门与方案门两次停点、概览声明正文不存在的自造门：Phase 1 复现契约与双轨入口（复现优先为默认轨道，证据优先仅在无复现条件且有过硬证据时启用，`intermittent` 须可重复证据）、2.4「诊断 + 方案」合并单次确认包 + 变更归属前移、4.0 降级为回退路径条件门、概览自造门降级为非阻塞提示、证据优先轨道回归测试为 characterization test。[含测试] |
| 2026-11-08 | skill-bridge-optimize | orchestration | 技能委派续跑与需求文档剥离：Claude 交互阶段用 Skill、自动阶段用前台 Agent + 共享续跑契约；Stage Envelope/Receipt + token 预算；需求文档桥/状态/归档报告/DEPS/白名单彻底移除，独立技能手工调用。[含测试/使用说明] |
| 2026-11-08 | improve-requirement-doc-review-readiness | templates | 需求文档技能评审可用性优化：评审摘要、验收标准与来源、风险与待确认集中表、人工域保护与就地增量对齐。[含测试] |
| 2026-11-08 | improve-orchestration-execution-mode | templates | 编排执行方式提升为一等契约：`Receipt` 扩展 `executionMode` / `independence` / `usage` / `readScope` / `dependsOn` / `contextReplay` 并由 `validateReceipt` 校验取值域；分级执行（探索与交互收束内联、变更类与 test 子阶段子代理、只读验证允许非作者内联）；`evaluatePhaseTransition` 按 `PhaseSpec.execution` 校验执行方式与独立性；修复后增量复验（新开只读代理 + `fixDiff`，禁止 resume 充当复验）；`iagent spec fingerprint` 复算制品指纹（算法单一源，末尾无换行）+ 补全表同步；handoff 包 `## 制品清单`、proposal-review 串联 verify 报告、`## 阶段结论` 记录 tokens。不发散门白名单与业务确认语义。[含测试] |
| 2026-11-08 | improve-grill-with-docs-paper-trail | templates | iagent 对 grill-with-docs 的自持集成补齐纸迹保真与硬约束载体 [含测试] |
| 2026-11-08 | improve-archive-index-monthly | spec | 归档索引按月份分片：根入口 + 月度索引，防止单文件膨胀。[含测试] |
| 2026-11-08 | inline-orchestration-delegation | orchestration | 验证与收尾阶段改为主代理内联：verify / archive / debug fix / migration 内联优先（兼容窗 subagent WARN），propose / apply 保留子代理；验证改为单轮内联清单 + `文件:行` 证据 + 报告落盘。[含测试] |
| 2026-11-08 | inline-propose-apply-parallel | orchestration | propose / apply 改为主 agent 内联与单 agent 分批（批内并行只读、同文件串行、进度落盘）；仅 `spec-bulk-archive` 并行单元与 migration 阈值降级保留子代理；propose / apply 进入兼容窗。[含测试] |
| 2026-11-08 | improve-task-ref-dedup | spec | tasks.md 追溯引用去重：Scenario Ref 改为场景叶子名，由同任务 Spec Ref 补全全路径；历史写法兼容。[含测试/使用说明] |
| 2026-11-09 | optimize-commit-skills | templates | 提交技能优化：移除知识库推送、统一三类说明、归档未提交提案纳入提交范围 [含测试/使用说明] |
| 2026-11-09 | improve-impl-conformance-and-test-gate | spec | 实现一致性三层判定 + 自动单测补齐 + 规则读取完整性 [含测试] |
| 2026-11-09 | add-project-skill-integration | skills | 项目技能接入：`.iagent` skills 配置 + 技能载体/宿主回退 + `iagent skills` 枚举与完整性校验 + project-init 技能蒸馏（C1-C6 自检）+ 探索/实现技能基线与 skillsRead 诊断。[含测试/使用说明] |
| 2026-11-11 | improve-continuation-and-codegraph-resilience | continuation | 消除编排流程回执停点，并让 CodeGraph 调用具备 busy 重试与 CLI 边界 [含测试] |
| 2026-11-11 | improve-archive-name-collision | archive | 归档名冲突不再阻断：目标名唯一化后缀 -2/-3…、索引保留后缀并剥离模块、批量归档冲突不标 Failed [含测试] |
| 2026-11-11 | fix-skill-contract-drift | orchestration | 统一门词汇 / 派发执行 / 指令 references，修复 version dry-run 与宿主中立性漂移 [含测试] |

---

## 模块统计

| 模块 | 归档数 | 变更列表 |
|------|-------|---------|
| orchestration | 5 | fix-mode-delegation-host-parity (2026-11-01), improve-delegation-gate-ledger (2026-11-03), skill-bridge-optimize (2026-11-08), inline-orchestration-delegation (2026-11-08), inline-propose-apply-parallel (2026-11-08) |
| templates | 5 | fix-multi-agent-skill-command-generation (2026-11-02), improve-requirement-doc-review-readiness (2026-11-08), improve-orchestration-execution-mode (2026-11-08), improve-grill-with-docs-paper-trail (2026-11-08), optimize-commit-skills (2026-11-09) |
| spec | 4 | improve-proposal-validation-and-spec-ref (2026-11-03), improve-archive-index-monthly (2026-11-08), improve-task-ref-dedup (2026-11-08), improve-impl-conformance-and-test-gate (2026-11-09) |
| continuation | 1 | improve-continuation-and-codegraph-resilience (2026-11-11) |
| debug | 1 | feat-debug-dual-track-entry (2026-11-03) |
| skills | 1 | add-project-skill-integration (2026-11-09) |
| workflow | 1 | improve-compile-gate-and-archive-readonly (2026-11-01) |
| archive | 1 | improve-archive-name-collision (2026-11-11) |

---

*更新时间: 2026-11-11*

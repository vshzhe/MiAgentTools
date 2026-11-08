# 归档变更索引 2026-10

> 本文件记录 2026-10 的归档变更，由归档流程纯追加。

---

## 归档变更列表

| 归档日期 | 变更名称 | 模块 | 摘要 |
|---------|---------|------|------|
| 2026-10-10 | improve-templates-requirement-doc-timing | templates | 需求文档生成从归档阶段前移到提案验证通过后，便于用户提前排查 [含测试] |
| 2026-10-10 | improve-template-dual-layer-optimization | template | SKILL模板瘦身 + JSON Sidecar + SQLite索引 双层优化 [含测试/DB脚本] |
| 2026-10-12 | improve-artifact-full-json-primary | templates | 提案制品全量 JSON 化：proposal/design/specs 三段合并为单一 `.venus/change.json` 主产物（JSON-first——JSON 为结构化真源，MD 由 `venus spec render <type>` 确定性渲染；tasks.json 独立于变更目录根），全链路消费方改 JSON 优先读取（需求文档章节来源/归档主 spec 同步/spec-verify 与 verify-proposal 评分/tr-impl-debug 同步提案/reindex 三级降级链）；生成协议单一源收敛于 `artifact-generation.md` G2（spec-propose / tr-impl-workflow / tr-impl-auto-workflow 三路径共享，消除内联路径绕过 JSON 的缺口）；`venus spec instructions` 新增 `jsonTemplate` 字段（JSON 段 schema 机器源）；旧四文件 sidecar（manifest/decisions/capabilities）标废弃、保留降级读取。流程中修复：reindex 点目录扫描恒 exit 1、`renderTasksMd` 方括号 label 归一化（消除 `[[代码]]`）、MD 降级解析补齐（specs/design/exploration → 存量 19 变更全量可检索）。版本 1.13.0；测试 391 用例。[含测试] |
| 2026-10-13 | consolidate-skills-and-genericize-checks | spec | 4.0.0 技能集精简与去领域耦合：移除 feature/pwd/skills/version/package/frontend 六技能（27→20），full-workflow 并入 workflow（端到端引导管线：实现桥委派 spec-apply、归档桥委派 spec-archive），框架专项检查改为运行时按项目实际信息判定（不内置框架预设）；同步 7 个主规格（release-package 能力移除 + workflow-suite-skills / migration-skills / skill-profile / template-generation / tool-call-whitelist / spec-bulk-archive-skill），含 Skill 裸名约定修正。[含测试/使用说明] |
| 2026-10-16 | improve-skill-type-and-description | skills | 技能类型体系归位与 description 结构统一：类型 id/预留标记、检查类技能归入 review、description 结构（中文用途+触发词+NOT for）与长度约束。[含测试/使用说明] |
| 2026-10-16 | improve-skill-progressive-disclosure | skills | SKILL.md 渐进披露与尺寸预算（主文件 ≤500 行）：超预算技能明细下沉 references，主文件保留控制流。[含测试/使用说明] |
| 2026-10-16 | improve-template-generation-consistency | templates | 模板指令引用单一源（`commandRef`/`rewriteCommandRefs`）+ 调用类白名单共享常量 + frontmatter 去 `metadata.version`。[含测试/使用说明] |
| 2026-10-16 | refactor-orchestrator-propose-delegation | workflow | 编排器 Phase 2 提案生成改为委派 `spec-propose`（delegated 模式 + 结构化回执），删除两份内联提案真源；DEPS 注入 `spec-propose`。[含测试] |
| 2026-10-16 | refactor-orchestrator-explore-delegation | workflow | 编排器 Phase 1 探索改为委派 `spec-explore`（delegated 强制 checkpoint 体系 + 结构化 handoff），删除内联探索真源；DEPS 注入 `spec-explore`。[含测试] |
| 2026-10-16 | markdown-first-artifacts | artifacts | 制品由 JSON-first 切换为 Markdown-first：proposal/design/specs/tasks.md 为唯一可编辑真源，新增 Markdown parser/validation/索引与显式 JSON 迁移；主规移除 JSON-first 需求。[含测试/使用说明] |
| 2026-10-16 | improve-skill-orchestration-consistency | skills | 技能/指令体系一致性收束：Markdown-first 残留清除、auto-workflow 委派化、实现验证桥接、提案验证契约唯一、门控导言单一源、死引用清理、DEPS/补全表/description 对齐 + 跨切面回归锁。[含测试/使用说明] |
| 2026-10-16 | streamline-explore-size-and-gates | skills | `iagent_spec_explore` 瘦身与门控收敛：主文件下沉探索指南（≤250 行）、协议按关注点分层（多项目扫描/grill/深度分析）、grill L1-L5 合并为 ≤2 批量确认、定义门预算、实现桥合并为单一「实现 + 测试桥」、聚合一致性门默认直通。[含测试] |
| 2026-10-17 | improve-template-language-consistency | templates | 技能模板语言中文化（普通英文散文→中文，机器契约保留）+ 全部 20 配对收束为 skill 单一源派生；新增语言回归锁与全量派生锁。[含测试/使用说明] |
| 2026-10-18 | add-host-orchestration-adapters | orchestration | 共享工作流协议 + 宿主原生编排适配：新增 `host-orchestration` 能力（阶段/input/handoff/receipt/gate/retry、能力协商、strict/degraded、门与回执推进判定）与 `WORKFLOW_PROTOCOLS` 实例；宿主技能 ID 统一为 canonical kebab-case `iagent-<workflowId>`（旧 `iagent_<name>` 自动迁移并保留兼容解析）；OpenCode V2 生成项目级 `agents/` 与 `opencode.jsonc` 的 `permissions`（skill/subagent/read/edit/question），指令含 agent/subagent 元数据；Pi 默认 provider `@tintinweb/pi-subagents`（latest），init 安装失败落 degraded + `.iagent/pi-runtime.json`，修复 `$ARGUMENTS` 参数丢失；Claude 保留 allowed-tools 与会话权限载体。BREAKING：外部技能目录/名称改为 kebab-case（带自动迁移）。[含测试/使用说明] |
| 2026-10-18 | fix-pi-native-orchestration | orchestration | 修复 Pi 实际运行不按编排执行：生成 `.pi/agents/` 原生委派入口（orchestrator + 阶段 agent，`name` 即 `subagent_type`、`tools` 只写上游内置名、嵌套派发走 `allowed_subagents`）；strict 收紧为「版本兼容 + 运行时已装 + 入口可解析」三条件，`nativeEntries` 诊断区分缺包/版本/缺定义/定义不可解析；Pi 停止写 Claude 权限段；补升级刷新提示与可执行 `Agent({ subagent_type })` 委派形态。[含测试/使用说明] |
| 2026-10-25 | integrate-init-rules | config | `openspec/rules` 护栏/协议要点蒸馏进 `.iagent/rules/` 模板常量（目标项目无需 openspec 目录即得基线），init 生成三份语义名规则文件、update 与重复 init 走确定性重建/修复（常量对齐 + 人工域逐字保留 + 本轮迁移产出 `preservePaths` 跳过）；`impl.md`/`test.md` 改语义名 `coding-rules.md`/`testing-rules.md` 且旧名整体删除不兼容（BREAKING→8.0.0）；project-init 新增第 10 步规则蒸馏（扫描测试代码，零猜测/占位兜底）、预扫描新增 `signals.tests` 测试探针；15 模板 25 处源仓路径引用改写为项目侧规则文件；8 份 delta（2 ADDED + 6 MODIFIED）回写主规格。[含测试/使用说明] |
| 2026-10-25 | improve-workflow-debug-bridges | workflow | 父流程需求文档桥 + 四值文档状态 + debug 修复方案门与 host 阶段拆分。[含测试/使用说明] |
| 2026-10-26 | upgrade-workflow-efficiency | workflow | 六处效率/能力瓶颈一次性收口：扫描去深度与文件数上限（改忽略清单 + 30s 软超时 + skipped 计数，基线 v2）、跨变更 SQLite 索引整体退役（删 `spec reindex` / `sql.js` / 能力 6 条需求）、提案制品纳管且 apply 后精确暂存不自动 commit、CodeGraph 改能力探测 + 锁阶梯（去无条件 sync）、确认门白名单化 + 直通句、跨阶段 handoff 包（原 context-pack）。**BREAKING** → 2.0.0。[含测试/使用说明] |

---

## 模块统计

| 模块 | 归档数 | 变更列表 |
|------|-------|---------|
| skills | 4 | improve-skill-type-and-description (2026-10-16), improve-skill-progressive-disclosure (2026-10-16), improve-skill-orchestration-consistency (2026-10-16), streamline-explore-size-and-gates (2026-10-16) |
| templates | 4 | improve-templates-requirement-doc-timing (2026-10-10), improve-artifact-full-json-primary (2026-10-12), improve-template-generation-consistency (2026-10-16), improve-template-language-consistency (2026-10-17) |
| workflow | 4 | refactor-orchestrator-propose-delegation (2026-10-16), refactor-orchestrator-explore-delegation (2026-10-16), improve-workflow-debug-bridges (2026-10-25), upgrade-workflow-efficiency (2026-10-26) |
| orchestration | 2 | add-host-orchestration-adapters (2026-10-18), fix-pi-native-orchestration (2026-10-18) |
| artifacts | 1 | markdown-first-artifacts (2026-10-16) |
| config | 1 | integrate-init-rules (2026-10-25) |
| spec | 1 | consolidate-skills-and-genericize-checks (2026-10-13) |
| template | 1 | improve-template-dual-layer-optimization (2026-10-10) |

---

*更新时间: 2026-11-08*

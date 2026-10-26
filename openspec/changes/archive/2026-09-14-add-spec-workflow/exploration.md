# 探索：openspec-workflow-migration-001

## Background
用户提供两个外部项目路径：
- `E:\github\OpenSpec` —— OpenSpec 自定义分支项目（含增强版功能）
- `E:\github\OpenSpec_v1120` —— OpenSpec 最新版本（v1120）

用户需求：分析自定义分支项目中的增强版 explore/propose/apply/archive/verify 功能，结合 OpenSpec_v1120 最新版本，把这五个功能迁移到当前项目（VenusAgentTools），并按当前项目进行重新命名。

## CONTEXT.md Startup Check
- `openspec/CONTEXT.md` 不存在 —— 探索期间将按需创建术语表。

## Capability Exploration Memory
- `openspec/specs/` 目录为空 —— 无能力级探索记忆，全新探索。

## Codebase Findings

### Discovered Files
- `src/cli/index.ts`: venus CLI 主入口（commander），注册 init/list/validate/update/completion/uninstall/show/generate 八个命令
- `src/core/templates/workflows/tr-*.ts`: 现有 7 个工作流模板（tr-commit/tr-impl/tr-init/tr-release/tr-review/tr-test/tr-tools），通过 getTr*CommandTemplate() 导出 CommandTemplate
- `src/core/config.ts`: COMMAND_NAMESPACE = 'venus'，AI_TOOLS / SKILL_TYPES 配置
- `src/core/command-generation/`: 命令生成器（generator.ts 的 generateCommand/generateCommands、adapters/registry.ts 的 CommandAdapterRegistry）
- `src/core/project-config.ts` + `src/commands/init.ts`: .venus/ 目录结构（config.yaml + rules/）项目级配置
- `src/commands/uninstall.ts` / `show.ts` / `update.ts` / `validate.ts`: 技能管理命令实现
- `openspec/`: 已有 openspec/ 目录（changes/archive/、rules/ai-coding.md、specs/ 空）

### Identified Symbols
- buildProgram (src/cli/index.ts:30): CLI 命令注册主函数
- generateCommand (src/core/command-generation/generator.ts:24): 命令内容生成
- CommandAdapterRegistry (src/core/command-generation/adapters/registry.ts:10): 工具适配器注册表
- getTrImplFeatureCommandTemplate (src/core/templates/workflows/tr-impl.ts:58): 现有工作流模板模式（新功能参考）
- COMMAND_NAMESPACE (src/core/config.ts:11): 'venus' 命名空间常量

### Pattern Matches
- CommandTemplate 模式: src/core/templates/workflows/tr-*.ts —— 每个工作流一个模板文件 + get*Template() 工厂函数
- 命令分层模式: src/cli/index.ts（注册）→ src/commands/*.ts（实现）→ src/core/*（核心逻辑）

### Other Project Findings

#### E:\github\OpenSpec_v1120（官方最新版 v1.12.0 基线）

**核心结论**：五功能官方实现均为「技能文档（SKILL.md 生成器）+ CLI 命令组合」双层结构，无独立运行时；技能通过 `Bash(openspec:*)` 调 CLI。

**实现载体对照表**（源生成器 → 渲染产物）：
| 功能 | 生成器（src/core/templates/workflows/） | 技能（skills/） | 斜杠指令 | 专用 CLI |
|------|------|------|------|------|
| explore | explore.ts | openspec-explore | /opsx:explore | 无（组合现有命令） |
| propose | propose.ts | openspec-propose | /opsx:propose | 无（new change + status + instructions 组合） |
| apply | apply-change.ts | openspec-apply-change | /opsx:apply | instructions apply --change --json |
| archive | archive-change.ts | openspec-archive-change | /opsx:archive | instructions archive --json + openspec archive |
| verify | verify-change.ts | openspec-verify-change | /opsx:verify | 无（status + instructions apply 组合） |

**SKILL.md frontmatter 统一结构**：name、description、`allowed-tools: Bash(openspec:*)`、license: MIT、`compatibility: Requires openspec CLI.`、metadata。

**关键机制**：
1. **artifact 依赖图**：`schemas/spec-driven/schema.yaml` 的 `artifacts[].requires` + `apply.requires`；`status --change --json` 的 `applyRequires` 是权威入口；所需集 = applyRequires ∪ requires 传递闭包
2. **build order**：`ArtifactGraph.getBuildOrder()`（Kahn 拓扑排序，兄弟节点按声明序）— src/core/artifact-graph/graph.ts:95
3. **artifact 状态机**：done/skipped/ready/blocked（文件存在性驱动）；apply 状态机：blocked/ready/all_done
4. **变更生命周期**：无显式状态字段，由目录位置（changes/ vs changes/archive/）+ 完成度隐式表达
5. **skip_specs 标记**：.openspec.yaml 的 skip_specs: true 表示无 spec 级行为变更
6. **context/operationGuidance**：从 openspec/config.yaml 注入的 prompt 级输入（required vs advisory），与 CLI 状态严格分离
7. **explore 写入确认守卫**（1.11 PR#1716）：写动作前必须命名文件、yes/no 单独确认
8. **store 感知**：所有路径取自 planningHome.root，不硬编码 repo 相对路径
9. **verify 官方只有 post-impl**（CRITICAL/WARNING/SUGGESTION 三级清单），无量化评分/阈值 —— verify-before-apply + 5 维评分是 VenusAgentTools 自定义扩展
10. **CORE_WORKFLOWS**（src/core/profiles.ts:14）= propose/explore/apply/update/sync/archive，verify 属 Optional 集

**关键 CLI JSON 契约**：
- `openspec status --change <name> --json`：changeName/schemaName/changeRoot/planningHome/artifactPaths/applyRequires/artifacts[](id,status,requires,missingDeps)/nextSteps/actionContext/isPlanningComplete
- `openspec instructions <artifact-id> --change <name> --json`：outputPath/resolvedOutputPath/template/instruction/context/rules/dependencies/unlocks
- `openspec instructions apply --change <name> --json`：contextFiles/progress(total,complete,remaining)/tasks[](id,description,done)/state(blocked|ready|all_done)

#### E:\github\OpenSpec（自定义分支增强版）

**核心结论**：自定义分支在官方「技能 + CLI」双层之上做了 6 大增强，五个功能均为 `src/core/templates/workflows/*.ts` 模板生成器 → `skills/openspec-*/SKILL.md` + `.claude/commands/opsx/*.md`。

**源模板清单**（src/core/templates/workflows/）：
| 功能 | 模板文件 | 导出工厂 |
|------|---------|---------|
| explore | explore.ts | getExploreSkillTemplate / getOpsxExploreCommandTemplate |
| propose | propose.ts | getOpsxProposeSkillTemplate / getOpsxProposeCommandTemplate |
| apply | apply-change.ts | getApplyChangeSkillTemplate / getOpsxApplyCommandTemplate |
| archive | archive-change.ts | getArchiveChangeSkillTemplate / getOpsxArchiveCommandTemplate |
| verify（后置） | verify-change.ts | getVerifyChangeSkillTemplate / getOpsxVerifyCommandTemplate |
| verify（前置增强） | verify-before-apply.ts | getVerifyBeforeApplySkillTemplate（D1-D9 评分） |
| workflow（一站式） | workflow.ts | getWorkflowSkillTemplate（Phase1-3） |
| auto-workflow（全自动） | auto-workflow.ts | getAutoWorkflowSkillTemplate（Phase1-5） |

**自定义分支 6 大增强点**：
1. **CodeGraph 深度集成**：explore 强制首动作 codegraph_status（禁 Glob/Grep 回退直到确认不可用）；archive 归档后 codegraph sync 增量索引 + codegraph_search 验证
2. **持久化探索记忆**：openspec/explorations/<keyword>-explore-<seq>.md 跨会话；能力级 specs/<capability>/explorations.md 归档时累积（冲突标"已过时"不删历史）
3. **量化验证门**：verify-before-apply 的 D1-D9 九维评分（90% 阈值），propose Phase 3 强制调用；独立只读子 agent 评分
4. **apply 并发调度**：Step 5.5 设计确认门（WAIT "确认"）+ 统一批次计划（CLI batchPlan + AI 推断）+ 任务复杂度评级（simple/medium/complex）+ 预派发重叠检查 + Step 8 编译检查（tech stack 检测 + autoFix maxRetries=3）+ .openspec-tmp/ 临时工作区
5. **CLI 降级模式**：openspec CLI 不可用时（command-not-found 签名检测）切换文件系统直接操作 + 内置依赖序 + 文件存在性推断
6. **MANDATORY 检查点（非阻塞）**：archive 的 4.5 CONTEXT.md 同步 / 4.6 CodeGraph 状态 / 4.7 探索记忆同步；失败仅 WARN 不阻断

**数据流闭环**：
```
explorations/*.md（探索）→ changes/<name>/（proposal+design+specs+tasks+exploration.md）
→ 项目代码 + attachments/（apply，tasks.md 勾选推进）
→ 验证报告（verify：前置 D1-D9 评分 / 后置三维度清单）
→ changes/archive/YYYY-MM-DD-<name>/（archive）
  + specs/<capability>/spec.md（主 spec 同步）
  + specs/<capability>/explorations.md（能力记忆）
  + ARCHIVE-INDEX.md + CONTEXT.md + CodeGraph 同步
```

**关键差异（自定义分支 vs v1120 官方）**：
- 官方 verify 仅 post-impl（三维度 CRITICAL/WARNING/SUGGESTION），自定义分支增加 pre-impl verify-before-apply（9 维评分）—— 评分体系是自定义扩展
- 官方 propose 无验证门；自定义分支 propose Phase 3 强制 D1-D5 评分
- 官方无能力级探索记忆、无 CLI 降级模式、无并发调度、无编译检查
- 自定义分支 CORE_WORKFLOWS 额外含 workflow（一站式）；还有 debug/auto-migration/feature-doc-generator/migration-checker/create-requirement-doc 等衍生技能（用户未要求迁移这些）

## Questions

### Q1: 五个功能迁移后的形态？（L1 意图）
**A（用户确认）**：融入模板体系 —— 新增 spec 生命周期类型，6 个技能注册 WORKFLOW_PAIRS，venus init 安装到目标项目。

### Q2: 命名前缀？（L2 方案）
**A（用户确认）**：spec 前缀。技能 venus_spec_explore / venus_spec_propose / venus_spec_apply / venus_spec_archive / venus_spec_verify / venus_spec_verify_proposal；指令 spec-explore 等。

### Q3: verify 拆分方式？（L2 方案）
**A（用户确认）**：拆两个 —— spec-verify（实现后三维度）+ spec-verify-proposal（提案后 D1-D9 评分门，被 spec-propose 引用）。

### Q4: 目标项目无 openspec CLI 时？（L3 异常）
**用户自定义答案（超出预设选项，方向性变更）**：增强后功能调整使用 venus CLI 状态校验，不再依赖 openspec。
→ 引出 Q5/Q6 澄清。

### Q5: venus CLI 自研哪些 spec 子命令？
**A（用户确认）**：完整集 —— venus spec new / status / instructions / archive 四个命令，替代原 openspec CLI 依赖，全流程自持。

### Q6: 变更目录约定？
**A（用户确认）**：沿用 openspec/（openspec/changes/、openspec/specs/、openspec/explorations/、openspec/CONTEXT.md）。

### Q7: artifact 依赖图定义方式？（L4 一致性）
**A（用户确认）**：内置硬编码 spec-driven（proposal→specs/design→tasks，apply.requires=[tasks]，tracks=tasks.md），不读外部 schema.yaml。

### Q8: venus spec archive 实现深度？（L4 一致性）
**A（用户确认）**：CLI 移动 + AI 合并 —— CLI 做状态检查+目录移动；delta spec→主 spec 智能合并由 spec-archive 技能正文指导 AI 执行。

### Q9: 变更元数据格式？（L5 边界）
**A（用户确认）**：写兼容元数据 .openspec.yaml（schema: spec-driven / created / goal），与 openspec CLI 互认。

## 术语表

| 术语 | 定义 | 避免使用 |
|------|------|---------|
| spec 技能 | venus 中规格驱动工作流技能类别：type='spec'，技能名 venus_spec_*，含 6 个技能 | spec skill（英混）、openspec 技能 |
| venus spec 命令组 | venus CLI 的 spec 子命令（new/status/instructions/archive），自研替代 openspec CLI | spec CLI |
| 变更（change） | openspec/changes/<name>/ 下的规格驱动工作单元 | 任务、issue |
| artifact | 变更内制品文件（proposal/specs/design/tasks），有 requires 依赖顺序 | 文档、deliverable |
| delta spec | 变更内 specs/<capability>/spec.md 的增量规格，归档时合并到主 spec | 增量文档 |
| 主 spec | openspec/specs/<capability>/spec.md 能力规格 | 规格主文件 |
| 探索文件 | openspec/explorations/*.md 持久化探索记录 | 探索文档 |
| 能力探索记忆 | openspec/specs/<capability>/explorations.md 归档时累积的决策记忆 | 能力记忆 |
| 依赖图 | 内置 spec-driven 的 artifact requires 关系与拓扑顺序 | build graph |
| 前置验证门 | spec-verify-proposal 的 D1-D9 评分（90% 阈值） | verify-before-apply（旧名） |

## 架构决策
- ADR-0001: spec 技能不依赖 openspec CLI，由 venus CLI 自研状态校验 —— 用户决策（Q4/Q5），venus 全流程自持
  File: `openspec/docs/adr/0001-venus-spec-selfcontained.md`

## 边界场景

- [x] 目标项目无 openspec/ 目录：venus spec new 自动创建 openspec/changes/ 骨架（含 archive/ 子目录）
- [x] .openspec.yaml 的 schema 字段非 spec-driven：venus spec status 输出 WARN 并按内置 spec-driven 依赖图处理
- [x] 目标项目已有 openspec CLI 创建的变更：venus spec status 正常读取（.openspec.yaml 兼容互认，目录约定一致）
- [x] tasks.md 勾选格式非标准（无 checkbox）：progress 统计为 0 任务，状态机判定 all_done 需 total>0
- [x] 归档时存在未完成任务 / 未完成 artifact：CLI 警告并要求 --yes 确认
- [x] spec 技能与 tr_impl 触发冲突：技能 description 明确区分（tr_impl=直接实现需求；spec_apply=基于已有变更制品的规格驱动实现）

## Decision Process

### Decision: 迁移形态（L1）
**Options Considered**: A. 融入模板体系（WORKFLOW_PAIRS + venus init 安装）; B. 仅本地 .claude/skills/ 拷贝; C. venus CLI 子命令直接驱动流程
**Chosen**: A
**Rationale**: 符合"按当前项目重新命名"意图；当前项目定位是技能工厂，模板体系是核心价值。

### Decision: verify 范围（L2）
**Options Considered**: A. 拆两个（verify + verify-proposal）; B. 合并为一个双模式技能; C. 只迁后置
**Chosen**: A
**Rationale**: 保持源项目结构；spec-propose 验证门需要引用 verify-proposal；职责清晰。

### Decision: openspec CLI 依赖（L3 — 用户方向性变更）
**Options Considered**: A. 预检+提示运行 venus init; B. 保留完整 CLI 降级模式
**User Override**: 增强后功能调整使用 venus CLI 状态校验，不再依赖 openspec
**Rationale**: 用户明确要求 venus 自持；引出 venus spec 命令组完整自研（Q5/Q6）。

### Decision: 依赖图定义（L4）
**Options Considered**: A. 内置硬编码 spec-driven; B. 兼容读取 openspec/schemas/schema.yaml
**Chosen**: A
**Rationale**: 不依赖 openspec 生态的扩展点；spec-driven 是唯一支持的 schema；最小实现。

### Decision: 归档深度（L4）
**Options Considered**: A. CLI 移动 + AI 合并; B. CLI 全量实现 spec 合并
**Chosen**: A
**Rationale**: 源项目 sync-specs 本就是 AI 驱动智能合并；CLI 只做确定性逻辑（移动），复杂语义合并交给 AI。

### Decision: 元数据格式（L5）
**Options Considered**: A. 写兼容 .openspec.yaml; B. venus 私有 change.yaml
**Chosen**: A
**Rationale**: 与 openspec CLI 互认（venus 创建的变更 openspec 也能读），生态互通，迁移期友好。

## Decisions

1. **形态**：6 个 spec 技能融入模板体系，新增 SkillType 'spec'，注册 WORKFLOW_PAIRS（venus init 安装）
2. **命名**：venus_spec_explore / venus_spec_propose / venus_spec_apply / venus_spec_archive / venus_spec_verify / venus_spec_verify_proposal → 指令 spec-explore / spec-propose / spec-apply / spec-archive / spec-verify / spec-verify-proposal
3. **CLI 自持**：venus CLI 新增 spec 命令组（new/status/instructions/archive），技能正文全部改调 venus 命令，零 openspec CLI 依赖
4. **目录约定**：沿用 openspec/（changes/、specs/、explorations/、CONTEXT.md）
5. **依赖图**：内置硬编码 spec-driven（proposal→specs/design→tasks；apply.requires=[tasks]，tracks=tasks.md）
6. **归档分工**：venus spec archive 做状态检查+目录移动；delta→主 spec 合并由 spec-archive 技能 AI 执行
7. **元数据**：写 .openspec.yaml（schema: spec-driven / created / goal），与 openspec CLI 互认
8. **CLI 降级**：不需要（venus 自身就是 CLI，技能调 venus 命令天然可用；venus 不存在时技能本身也不存在）
9. **tr_impl 区分**：tr_impl=用户直接描述需求即写代码；spec_apply=基于 openspec/changes/ 制品的规格驱动实现，description 明确区分触发条件
10. **规则文件**：init 时生成 .venus/rules/spec_propose.md（spec 类型的项目规则文件，与 tr_* 同模式）

## Scope Changes
| 变更时间 | 变更类型 | 变更描述 | 原因 |
|---------|---------|---------|------|
| Q4 应答时 | expand | 迁移范围从"6 个技能模板"扩展为"6 个技能模板 + venus CLI spec 命令组（new/status/instructions/archive）" | 用户要求不再依赖 openspec CLI，venus 自研状态校验 |

## Pending

### For Phase 2 Impact Analysis
- buildProgram (src/cli/index.ts:30) - Priority: HIGH（venus spec 子命令组需注册到 CLI）
- WORKFLOW_PAIRS / getSkillTemplates / getCommandTemplates (src/core/templates/registry.ts:42) - Priority: HIGH（6 个 spec 技能注册）
- SKILL_TYPES / SkillType (src/core/config.ts:14-31) - Priority: HIGH（新增 'spec' 类型）
- deriveCommandId (src/core/templates/registry.ts:28) - Priority: MEDIUM（验证 venus_spec_verify_proposal → spec-verify-proposal 派生正确）
- runInit / runUpdate (src/commands/init.ts / update.ts) - Priority: HIGH（安装 6 个新技能 + 规则文件 spec_propose.md）
- runList / countSkillsByType (src/commands/list.ts / registry.ts:80) - Priority: MEDIUM（8 类分组展示）
- runValidate (src/commands/validate.ts) - Priority: MEDIUM（spec 类型校验）
- runShow / runUninstall - Priority: LOW（自然兼容，无需改动确认）

### Security Concerns
（无 —— 纯 CLI + 技能文档迁移，无用户输入入库/网络面）

### Business Validation
- ~~迁移后五个功能与 OpenSpec 自定义分支原始行为的一致性边界？~~ 已解决：CLI 自研（Q5-Q8），目录/元数据兼容互认（Q6/Q9），行为对齐源项目增强版

### Unresolved Decisions
（无 —— 全部已确认，见 Decisions 1-10）

## Implementation Deep-Dive

### Design Rationale
- 技能即数据：所有 venus 技能是 SkillTemplate（结构化对象）而非散落文件，registry.ts 集中注册（WORKFLOW_PAIRS），init/update/validate/list 全部从注册表驱动 —— 新增技能只需扩展注册表，无需改各管理命令的核心逻辑
- 命名派生规则硬编码：venus_<type>_<name> → 指令 id <type 连字符>-<name>（deriveCommandId，registry.ts:28），SKILL_PREFIX='venus_' 是全局约束

### Constraints
- SkillType 是封闭联合类型（config.ts:14-21，7 个 tr_* 值），新增类型需修改 config.ts 的 SKILL_TYPES 注册表 + isSkillType 校验自然生效
- Agent Skills 规范：技能名 = 安装目录名，必须 venus_ 前缀
- 斜杠指令固定安装到 .claude/commands/venus/ 命名空间下
- .venus/rules/ 规则文件与技能类型对应（init 时生成 tr_impl.md 等）

### Trade-offs
- 技能正文是纯文本 instructions（模板字符串），无外部文件依赖 —— 迁移 OpenSpec 的长流程技能时正文会较长，但与现有模式一致
- allowedTools 白名单必须覆盖正文实际要运行的命令（tr-impl 已含 Bash(pnpm/npm/node)），OpenSpec 技能大量调用 openspec CLI —— 白名单需加 Bash(openspec:*)

### Pattern Usage
- CommandTemplate 工厂模式（get*CommandTemplate）—— 现有 7 个 tr-* 工作流均遵循
- WorkflowPair 成对注册（skill + command）—— registry.ts:42 WORKFLOW_PAIRS 数组
- 每类型一个文件：src/core/templates/workflows/tr-<type>.ts 导出 get<Type><Name>SkillTemplate + get<Type><Name>CommandTemplate 两个工厂

### Historical Context
- git log 显示项目近期演进：init 依赖检测（codegraph/openspec）→ uninstall/show 命令 → .venus/ 配置重构 → shell 补全 + onboarding
- init 已检测安装 openspec CLI（ensureDependencies），说明项目定位就是给 openspec 工作流提供技能增强

### Implicit Assumptions
- 迁移的新技能默认会被 venus init 安装到任意目标项目 —— 但 OpenSpec 技能依赖目标项目有 openspec/ 目录结构，该假设需在 grill 中确认边界
- SkillTemplate.instructions 中的命令引用（如 openspec status --json）在目标项目无 openspec CLI 时会失败 —— init 的 ensureDependencies 已兜底安装 openspec

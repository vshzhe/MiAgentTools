## MODIFIED Requirements

### Requirement: auto-workflow 全自动管线 SHALL 经委派复用 apply/archive 协议

`iagent_auto_workflow` 的 Phase 4（自动实现）与 Phase 5（自动归档）SHALL 经 **Skill 工具内联**执行 `iagent_spec_apply`（传 `gate-skip=design-confirmation`；`auto-mode=true` 为等价兼容写法）与 `iagent_spec_archive`（传 `change-name`），MUST NOT 派生 Agent 子代理，也 MUST NOT 重定义 / 内联复述其派发协议、共享资源协议、测试门、实现一致性门、review 环节、归档索引 / 清理协议与 Guardrails 条目。编排层只保留阶段顺序、门承载、回执字段、证据就绪判定与失败处置；子技能协议的单一源分别留在 `iagent_spec_apply`、`iagent_spec_verify`、`iagent_review`、`iagent_spec_archive`。`gate-skip=design-confirmation` 仅跳过设计确认门，MUST NOT 免除共享资源协议与退出守卫。

**门账本写入**：流程基准确认后、执行前，父级 SHALL 把 `design-confirmation` 写入 handoff 包 `## 已确认门` 段并在执行前校验存在；阶段回执 SHALL 携带 `confirmedGates: ['design-confirmation']`。两者皆缺时被调用 apply 的设计门 SHALL 照常触发（MUST NOT 静默跳过）。账本写入 / 校验失败 → 停止并报告。

auto-workflow 的阶段门声明 SHALL 与其协议阶段清单一致：**验证 / 实现阶段 MUST NOT 声明阻塞门；归档阶段 SHALL 声明 `archive-confirmation` 阻塞门**（`AUTO_ARCHIVE_PHASE` 与 `ARCHIVE_PHASE` 同门），归档执行前 MUST 呈现 ⛔ 归档确认门。`requirementDocStatus` 已整体移除，MUST NOT 出现。

#### Scenario: Phase 4 内联而非子代理

- **WHEN** auto-workflow 验证通过后进入 Phase 4
- **THEN** SHALL 经 Skill 工具内联执行 `iagent_spec_apply`（`gate-skip=design-confirmation`）
- **AND** MUST NOT 派生 Agent 子代理

#### Scenario: Phase 5 内联而非子代理

- **WHEN** auto-workflow 实现、编译检查与测试门完成后进入 Phase 5
- **THEN** SHALL 经 Skill 工具内联执行 `iagent_spec_archive`（`change-name`）
- **AND** MUST NOT 派生 Agent 子代理；MUST NOT 传递 `requirementDocStatus`

#### Scenario: 测试执行门继承

- **WHEN** auto-workflow 的内联 apply 进入测试执行门
- **THEN** SHALL 复用 `iagent_spec_apply` §9 的门（change scope、in-scope 失败重试 3 次后暂停、out-of-scope 仅 WARN）
- **AND** MUST NOT 在 auto-workflow 内另立第二份测试门定义

#### Scenario: 门账本兜底

- **WHEN** 内联执行时 `gate-skip` 参数未传达，但账本已声明 `design-confirmation` 且与回执一致
- **THEN** 被调用 apply SHALL 经账本兜底跳过 Step 5.5 并记 WARN
- **AND** 其余门与停点 MUST 照常生效

#### Scenario: 两者皆缺时设计门照常触发

- **WHEN** 内联执行既未传 `gate-skip`，账本段也缺失或无该条目
- **THEN** 被调用 apply 的设计确认门 MUST 照常执行，MUST NOT 静默跳过

#### Scenario: 归档阶段门与协议声明一致

- **WHEN** 检查 `auto-workflow` 的阶段门声明与 §5.2 正文
- **THEN** 归档阶段 SHALL 声明 `archive-confirmation` 阻塞门
- **AND** 验证 / 实现阶段 MUST NOT 声明阻塞门
- **AND** MUST NOT 出现「验证 / 实现 / 归档阶段均无阻塞门」一类注释或表述

#### Scenario: 子技能协议单一源

- **WHEN** 检查 `iagent_auto_workflow` 正文中的测试门、一致性门、review、归档索引 / 清理协议
- **THEN** 编排层 SHALL 只引用子技能名称与关键产物路径，MUST NOT 复述子技能的判定矩阵、命令参数、证据列集或修复循环细则
- **AND** 回归测试 SHALL 断言 auto-workflow 正文不包含子技能协议的特征串（如 `compile-report.md` 九列、`conformance-report.md` 九列、`review-report.md` 汇总行、归档索引纯追加细则）

#### Scenario: Guardrails 不复述阶段正文

- **WHEN** 检查 `iagent_auto_workflow` 的 Guardrails
- **THEN** 每条护栏 SHALL 只承载跨阶段不可违反的约束（门不可跳过、证据缺失阻断、续跑、退出守卫）
- **AND** MUST NOT 逐条重复 Phase 1-5 已声明的操作步骤；重复条目 SHALL 合并或删除

### Requirement: Documentation counts reflect actual project state

`README.md` / `AGENTS.md` / `docs/skills-manual.md` / `docs/project/**` SHALL 使用与当前仓库实际一致的测试文件数、用例数、package 版本与技能模板 / 技能总数，MUST NOT 保留历史计数或历史版本。技能模板总数以 `src/core/templates/workflows/*.ts` 文件数为准（当前 23）；技能与指令总数以注册表 `WORKFLOW_PAIRS` 为准（当前 23）。

#### Scenario: 文档计数与实测一致

- **WHEN** 更新文档中的计数或版本
- **THEN** 测试文件数与用例数 SHALL 与 `pnpm test` 输出一致
- **AND** 版本号 SHALL 与 `package.json` 的 `version` 一致

#### Scenario: 技能模板计数与实测一致

- **WHEN** 文档提及技能模板 / 技能 / 指令总数
- **THEN** 计数 SHALL 等于 `src/core/templates/workflows/*.ts` 文件数与 `WORKFLOW_PAIRS` 条目数
- **AND** MUST NOT 保留历史值（如 22）

## ADDED Requirements

### Requirement: spec-propose 委派执行模式（delegated）契约

`iagent_spec_propose` SHALL 支持两种执行模式，由 Input 参数 `mode` 选择：`interactive`（默认）与 `delegated`。

`interactive` 模式行为 MUST 与引入本契约前完全一致：保留 Step 0 探索文件关联的**用户提示**（[关联] / [跳过]）、自身 Step 6 Phase 3 验证（委派 `iagent_spec_verify_proposal` + `iagent_requirement_doc`）、以及结尾 "display a design blueprint summary and wait for user confirmation before suggesting implementation" 的规划边界停点。

`delegated` 模式为**编排器调用**而设，SHALL 让出阶段推进主权与编排器已承担的重复步骤，同时保留一切交互确认门：

1. **接受 `exploration-file=<path>` 输入**：跳过 Step 0 的用户提示，直接对该文件执行迁移语义（移入变更目录为 `exploration.md`，成功后删除源文件）；
2. **抑制结尾规划边界停点**：制品完成后不输出 "等待用户确认" 停点，改为输出**结构化回执**（change-name、生成制品清单、apply-ready 状态），控制权交回编排器；
3. **抑制自身 Phase 3 验证**：不调用 `spec_verify_proposal`、不生成需求文档（编排器的 Phase 3 为其超集，含 `proposal_review` 深度复查）；
4. **保留全部对话级确认门语义**：`delegated` 模式 MUST NOT 新增、跳过或放宽任何对话级确认门（delegated 仅涉及阶段主权，不涉及确认门）。

`iagent_spec_apply` 既有 `auto-mode=true` SHALL 被文档化为 `mode=delegated` 的等价别名（语义：让出设计确认门主权）；两编排器正文 SHALL 使用 `mode=delegated` 表述。

#### Scenario: interactive 默认行为不变

- **WHEN** 用户直接以 `/iagent:spec-propose <描述>` 调用技能（未传 `mode`）
- **THEN** 技能以 `interactive` 模式运行：Step 0 呈现探索文件关联提示、自身 Phase 3 验证照常、结尾输出规划边界停点；行为与引入本契约前一致

#### Scenario: delegated 模式跳过 Step 0 用户提示

- **WHEN** 编排器以 `mode=delegated` + `exploration-file=openspec/explorations/<f>.md` 委派技能
- **THEN** 技能跳过探索文件关联的用户提示，直接迁移该文件为变更目录内 `exploration.md`（成功后删除源文件），并在回执中报告迁移结果

#### Scenario: delegated 模式抑制自身 Phase 3

- **WHEN** `delegated` 模式下全部 applyRequires 制品生成完成
- **THEN** 技能 MUST NOT 调用 `iagent_spec_verify_proposal`、MUST NOT 生成需求文档，直接输出结构化回执交回编排器；由编排器的 Phase 3 执行验证超集

#### Scenario: delegated 模式抑制结尾停点

- **WHEN** `delegated` 模式制品生成完成
- **THEN** 技能 MUST NOT 输出 "wait for user confirmation before suggesting implementation" 停点，改为输出结构化回执

#### Scenario: delegated 不改变确认门

- **WHEN** 审阅 `spec_propose` 的 `delegated` 模式正文
- **THEN** 正文 MUST NOT 声明 `delegated` 跳过任何对话级确认门（如提示词校验门、流程最终确认门、材料性歧义询问）；`delegated` 仅让出阶段推进主权与重复步骤

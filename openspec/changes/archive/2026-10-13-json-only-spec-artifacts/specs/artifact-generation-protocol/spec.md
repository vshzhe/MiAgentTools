# Spec Delta

## MODIFIED Requirements

### Requirement: 共享制品生成协议文件

项目 SHALL 在 `openspec/rules/artifact-generation.md` 提供共享的制品生成协议，供 `iagent_workflow`（内联执行）与 `iagent_spec_propose`（独立执行）共同引用，内容涵盖：Step G1 创建变更目录（`iagent spec new "<name>"`，已存在时询问用户继续或新建）；Step G2 按依赖顺序以 **JSON-first** 生成制品（`iagent spec status --change "<name>" --json` 解析 applyRequires/artifacts/changeRoot → 循环取首个 status "ready" 的 artifact → `iagent spec instructions <artifact-id> --change "<name>" --json` 获取 jsonTemplate/instruction/resolvedOutputPath/dependencies → 读依赖文件作上下文 → proposal/specs/design 更新 `change.json` 对应段、tasks 写 `tasks.json`，**仅 tasks** 运行 `iagent spec render tasks` 渲染 tasks.md → 重跑 status 检查进度，直至 applyRequires 全部 done）；Step G3 显示终态（`iagent spec status --change "<name>"` 确认全部 applyRequires 为 done）。协议 MUST 声明约束：proposal / design / specs MUST NOT 生成 MD（`change.json` 为唯一真源；`iagent spec render` 仅支持 `tasks`，proposal / specs / design 无渲染入口与 MD 降级）；context 与 rules 是 AI 约束不得复制到制品输出文件；制品必须按依赖顺序创建；每个制品写入后验证 JSON 段/文件存在；跨平台路径使用 path.join()/path.resolve() 不硬编码分隔符；补充文档处理（每个任务含类型标签 `[代码]`/`[DB脚本]`，非代码补充任务含 `产出:` 字段，默认输出路径 attachments/<filename> 相对 changeRoot，含补充任务时创建 attachments/ 目录）。协议文本 MUST 使用当前 CLI 名 `iagent`，MUST NOT 残留旧名 `venus`。

#### Scenario: workflow 内联引用协议

- **WHEN** `iagent_workflow` 的 Phase 2.4 进入制品生成环节
- **THEN** 技能按 `openspec/rules/artifact-generation.md` 的 G1-G3 流程经 `iagent spec new` + status/instructions 循环内联生成全部 applyRequires 制品，无中途用户提示

#### Scenario: propose 独立引用同一协议

- **WHEN** `iagent_spec_propose` 独立执行制品生成
- **THEN** 技能按同一 `openspec/rules/artifact-generation.md` 协议执行 G1-G3，与 `iagent_workflow` 共享同一份协议文本（修复 iagent_spec_propose SKILL.md 引用悬空）

#### Scenario: context 与 rules 不落入输出

- **WHEN** `iagent spec instructions` 返回的 JSON 含 `context`（项目背景）与 `rules`（制品特定规则）字段
- **THEN** 执行技能将两者作为自身生成约束，产出的制品文件中不出现 context 与 rules 内容的复制

#### Scenario: 协议不产出 proposal/design/specs MD

- **WHEN** 按协议执行 proposal / specs / design 三个 artifact
- **THEN** 协议指引 SHALL 只更新 `change.json` 对应段，MUST NOT 指示运行 `iagent spec render proposal` / `specs` / `design`，MUST NOT 提供手写 MD 的降级路径

#### Scenario: 协议文本无旧 CLI 名

- **WHEN** 检查 `openspec/rules/artifact-generation.md`
- **THEN** 全部命令示例 SHALL 使用 `iagent spec ...`，MUST NOT 出现 `venus spec ...`

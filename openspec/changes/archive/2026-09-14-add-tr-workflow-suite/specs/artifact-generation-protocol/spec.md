## ADDED Requirements

### Requirement: 共享制品生成协议文件

项目 SHALL 在 `openspec/rules/artifact-generation.md` 提供共享的制品生成协议，供 `venus_tr_impl_workflow`（内联执行）与 `venus_spec_propose`（独立执行）共同引用，内容涵盖：Step G1 创建变更目录（`venus spec new "<name>"`，已存在时询问用户继续或新建）；Step G2 按依赖顺序生成制品（`venus spec status --change "<name>" --json` 解析 applyRequires/artifacts/changeRoot → 循环取首个 status "ready" 的 artifact → `venus spec instructions <artifact-id> --change "<name>" --json` 获取 template/context/rules/instruction/resolvedOutputPath/dependencies → 读依赖文件作上下文 → 以 template 为结构填充写入 resolvedOutputPath → 重跑 status 检查进度，直至 applyRequires 全部 done）；Step G3 显示终态（`venus spec status --change "<name>"` 确认全部 applyRequires 为 done）。协议 MUST 声明约束：context 与 rules 是 AI 约束不得复制到制品输出文件；制品必须按依赖顺序创建；每个制品写入后验证文件存在；跨平台路径使用 path.join()/path.resolve() 不硬编码分隔符；补充文档处理（每个任务含类型标签 `[代码]`/`[DB脚本]`，非代码补充任务含 `产出:` 字段，默认输出路径 attachments/<filename> 相对 changeRoot，含补充任务时创建 attachments/ 目录）。

#### Scenario: workflow 内联引用协议

- **WHEN** `venus_tr_impl_workflow` 的 Phase 2.4 进入制品生成环节
- **THEN** 技能按 `openspec/rules/artifact-generation.md` 的 G1-G3 流程经 `venus spec new` + status/instructions 循环内联生成全部 applyRequires 制品，无中途用户提示

#### Scenario: propose 独立引用同一协议

- **WHEN** `venus_spec_propose` 独立执行制品生成
- **THEN** 技能按同一 `openspec/rules/artifact-generation.md` 协议执行 G1-G3，与 `venus_tr_impl_workflow` 共享同一份协议文本（修复 venus_spec_propose SKILL.md 引用悬空）

#### Scenario: context 与 rules 不落入输出

- **WHEN** `venus spec instructions` 返回的 JSON 含 `context`（项目背景）与 `rules`（制品特定规则）字段
- **THEN** 执行技能将两者作为自身生成约束，产出的制品文件中不出现 context 与 rules 内容的复制

## ADDED Requirements

### Requirement: 内置任务模板的类型标签集

`venus spec instructions tasks` 分发的内置任务模板（`TASKS_TEMPLATE`）SHALL 声明**并列的**四类任务类型标签：`[代码]`（实现代码）、`[测试]`（测试代码）、`[DB脚本]`（数据库脚本）、`[使用说明]`（补充文档，默认产出至 `attachments/`）。

任务模板 MUST 说明 `[测试]` 任务的子标注规则：测试层级（`[单元]`/`[功能]`）与优先级（`[P0]`/`[P1]`/`[P2]`），形如 `- [ ] [测试][单元][P0] 1.2 <任务描述>`。

tasks artifact 的生成指令（`venus spec instructions tasks` 返回的 `instruction` 字段）SHALL 与模板标签集保持一致，MUST NOT 遗漏 `[测试]`。

#### Scenario: tasks 模板声明 [测试] 标签

- **WHEN** 运行 `venus spec instructions tasks --change "<name>" --json`
- **THEN** 返回的 `template` 的类型标签注释中并列包含 `[代码]`、`[测试]`、`[DB脚本]`、`[使用说明]` 四类标签

#### Scenario: tasks 模板说明 [测试] 子标注

- **WHEN** 审阅 `venus spec instructions tasks` 返回的 `template` 全文
- **THEN** 模板中包含 `[测试]` 任务的层级（`[单元]`/`[功能]`）与优先级（`[P0]`/`[P1]`/`[P2]`）子标注说明与示例

#### Scenario: 生成指令与模板标签集一致

- **WHEN** 运行 `venus spec instructions tasks --change "<name>" --json` 并比对 `instruction` 与 `template`
- **THEN** `instruction` 列出的类型标签集合与 `template` 旁注的标签集合一致，均含 `[测试]`

#### Scenario: 既有格式不被破坏

- **WHEN** 既有变更的 tasks.md 仅含 `[代码]` 任务（不含 `[测试]`）
- **THEN** `venus spec status` 的进度统计与勾选解析行为不变，新增标签不改变既有任务的解析

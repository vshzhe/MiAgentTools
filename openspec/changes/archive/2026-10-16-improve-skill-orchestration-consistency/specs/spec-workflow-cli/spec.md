## ADDED Requirements

### Requirement: shell 补全 SHALL 覆盖全部 spec 子命令

`src/commands/completion.ts` 的 `IAGENT_COMMANDS` 中 `spec` 条目的 `subcommands` 列表 MUST 与 `src/commands/spec.ts` 实际注册的子命令集合完全一致，至少含 `new` / `status` / `migrate` / `validate` / `instructions` / `archive` / `reindex` / `render` / `sidecar`。`spec` 的描述字符串 MUST 同步列出这些子命令。

#### Scenario: 补全表含 migrate 与 validate

- **WHEN** 生成 bash / powershell 补全脚本
- **THEN** `iagent spec` 的第二级补全候选项 SHALL 含 `migrate` 与 `validate`
- **AND** `spec` 描述字符串 SHALL 不再声称旧子命令集

#### Scenario: 补全表由程序派生并受断言约束

- **WHEN** 运行补全一致性测试
- **THEN** 测试 SHALL 从 Commander 程序中提取 `spec` 子命令集合
- **AND** 断言 `IAGENT_COMMANDS` 的 `subcommands` 与其相等（缺项 / 多项即失败）

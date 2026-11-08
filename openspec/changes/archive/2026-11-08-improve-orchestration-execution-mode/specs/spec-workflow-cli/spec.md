## ADDED Requirements

### Requirement: iagent spec fingerprint 复算制品指纹

系统 SHALL 提供只读子命令 `iagent spec fingerprint --change <name> [--json]`，按与 handoff 包 `sourceFingerprint` **完全相同**的算法复算制品内容指纹，供模板、`iagent-requirement-doc` 与各阶段消费方复算，MUST NOT 再手写一次性脚本。

算法 SHALL 为：

1. 制品集合 = `<changeRoot>/proposal.md`、`<changeRoot>/design.md`（存在时）、`<changeRoot>/specs/**/*.md`、`<changeRoot>/tasks.md`；
2. 对每个文件计算 `sha256(字节内容)`，得到一行 `<相对路径>:<sha256 十六进制>`，路径统一使用正斜杠（相对 `changeRoot`）；
3. 按相对路径字典序排序，用**单个换行**连接为串 `S`（**MUST NOT 在末尾追加换行**）；
4. 指纹 = `"sha256:" + sha256(S) 十六进制的前 16 字符`。

文本模式 SHALL 只向 stdout 打印指纹一行（`sha256:<16 位>`），不附加其他内容；`--json` 模式 SHALL 输出 `{ changeName, changeRoot, fingerprint, artifacts: [{ path, size, sha256 }] }`，其中 `artifacts` 按相对路径字典序，`sha256` 为完整十六进制。命令 MUST NOT 写入或修改任何文件。

变更目录不存在、或制品集合为空时 SHALL 以非零退出码失败并给出诊断（MUST NOT 输出空指纹或伪造值）。消费方调用失败或旧版本 CLI 不认识该子命令时 SHALL 回退读取 handoff 包 `sourceFingerprint` 并记 WARN。

#### Scenario: 复算与 handoff 包一致

- **WHEN** 对同一变更分别运行 `iagent spec fingerprint --change <name>` 与 handoff 包产出方复算
- **THEN** 两次结果 SHALL 完全相同
- **AND** 算法 MUST NOT 在排序后的拼接串末尾追加换行

#### Scenario: 文本与 JSON 输出

- **WHEN** 运行 `iagent spec fingerprint --change <name>` 与 `--json`
- **THEN** 文本模式 SHALL 仅输出 `sha256:<16 位>` 一行
- **AND** JSON 模式 SHALL 含 `fingerprint` 与按路径字典序的 `artifacts[]`（每项含 `path` / `size` / `sha256`）

#### Scenario: 制品变更后指纹变化

- **WHEN** `proposal.md` / `design.md` / `specs/**/*.md` / `tasks.md` 任一文件内容改动
- **THEN** 复算指纹 SHALL 与改动前不同
- **AND** 仅文件时间戳或顺序变化、内容不变时指纹 SHALL 保持不变

#### Scenario: 变更不存在时失败

- **WHEN** 指定的变更目录不存在或没有任何可选入指纹的制品
- **THEN** 命令 SHALL 以非零退出码失败并输出诊断
- **AND** MUST NOT 输出伪造指纹

#### Scenario: 旧版本回退 handoff 包

- **WHEN** 运行环境的 CLI 不支持 `iagent spec fingerprint`
- **THEN** 消费方 SHALL 回退读取 handoff 包 `sourceFingerprint` 并记 WARN
- **AND** 两者皆不可得时 SHALL 以磁盘制品为准完成流程并记 WARN

#### Scenario: 旧算法包首次复算不一致

- **WHEN** in-flight handoff 包的 `sourceFingerprint` 由旧参考脚本（每行含末尾 `\n`）计算
- **THEN** 消费方按新算法复算 SHALL 检测到不一致
- **AND** SHALL 重建 handoff 包一次并记 WARN，MUST NOT 阻断流程或沿用旧指纹

## MODIFIED Requirements

### Requirement: shell 补全 SHALL 覆盖全部 spec 子命令

`src/commands/completion.ts` 的 `IAGENT_COMMANDS` 中 `spec` 条目的 `subcommands` 列表 MUST 与 `src/commands/spec.ts` 实际注册的子命令集合完全一致，当前集合为 `new` / `status` / `migrate` / `validate` / `instructions` / `archive` / `render` / `sidecar` / `fingerprint`（`reindex` 已随索引退役删除）。`spec` 的描述字符串 MUST 同步列出这些子命令。

#### Scenario: 补全表含 migrate、validate 与 fingerprint

- **WHEN** 生成 bash / powershell 补全脚本
- **THEN** `iagent spec` 的第二级补全候选项 SHALL 含 `migrate`、`validate` 与 `fingerprint`
- **AND** `spec` 描述字符串 SHALL 不再声称旧子命令集

#### Scenario: 补全表不含已退役子命令

- **WHEN** 生成补全脚本并检查 `spec` 的二级候选
- **THEN** 候选中 MUST NOT 含 `reindex`

#### Scenario: 补全表由程序派生并受断言约束

- **WHEN** 运行补全一致性测试
- **THEN** 测试 SHALL 从 Commander 程序中提取 `spec` 子命令集合
- **AND** 断言 `IAGENT_COMMANDS` 的 `subcommands` 与其相等（缺项 / 多项即失败）

#### Scenario: fingerprint 的参数补全可见

- **WHEN** 在 `iagent spec fingerprint ` 后触发补全
- **THEN** 候选中 SHALL 提供 `--change` 与 `--json`
- **AND** 命令数量断言 SHALL 覆盖新增子命令

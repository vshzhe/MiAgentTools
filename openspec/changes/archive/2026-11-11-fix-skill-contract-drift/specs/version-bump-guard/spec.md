## ADDED Requirements

### Requirement: Dry-run bypasses no-change guard

`iagent version bump --dry-run` SHALL 在基线无变更时仍返回判定结果（`analysis` 与 `baselineRef`），MUST NOT 抛出「没有检测到变更」。该守卫 SHALL 仅作用于写回模式。

#### Scenario: 显式基线无变更仍可预览

- **WHEN** 执行 `iagent version bump --from <ref> --dry-run --json` 且 `<ref>..工作区` 无变更
- **THEN** 命令 SHALL 以退出码 0 输出 JSON，且 `analysis.baselineRef` 等于 `<ref>`
- **AND** MUST NOT 写入 `package.json` / `CHANGELOG.md` / `README.md`

#### Scenario: 写回模式仍拒绝无变更递增

- **WHEN** 执行 `iagent version bump`（无 `--dry-run`）且基线无变更
- **THEN** 命令 SHALL 失败并说明无变更
- **AND** 消息 SHALL 使用实际基线标签（显式 `--from` 时为该 ref），MUST NOT 固定使用 `package.json` 版本号

### Requirement: Bump subcommand merges parent options

`iagent version bump` 的 `--from` / `--level` / `--json` SHALL 与父命令同名选项正确合并（子级优先），MUST NOT 因 Commander 的父级解析而静默失效。

#### Scenario: bump 子命令 --from 生效

- **WHEN** 以 `iagent version bump --from <ref> --dry-run --json` 调用 CLI
- **THEN** 输出 SHALL 反映 `analysis.baselineRef=<ref>`
- **AND** MUST NOT 回退到同版本 tag 或默认基线

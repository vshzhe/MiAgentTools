## ADDED Requirements

### Requirement: 归档收尾合并工作分支

`iagent_spec_archive` SHALL 归档自动提交（原 Step 7.5）**之后**、摘要（Step 8）**之前**执行「归档合并」：

- 读取 handoff 包 `## 分支状态`；`branchMode≠work-branch` → 跳过并记日志
- 合并门归门白名单 `destructive-change`（**不可豁免**、**MUST NOT 被 `gate-skip` 跳过**），与推送确认在**同一步内一次确认**（一次呈现：工作分支 / 基分支 / 待合并提交数 / 推送目标）
- 冲突 → 暂停 + 冲突文件清单，MUST NOT `git merge --abort`
- 成功 → `git branch -d`（失败仅 WARN）→ 推送（拒绝则保留本地合并）
- 拒绝合并 → 保留分支与提交，归档正常结束
- **归档结果 MUST NOT 因合并失败而回滚**；MUST NOT 改写 `openspec/changes/archive/**` 内容

**边界划界**：合并改变版本库状态（当前分支 HEAD），不属于「归档只读」约束的改写面 —— 该约束作用于 `openspec/changes/archive/**` 的**文件内容**。

#### Scenario: 合并门与推送门同一步呈现

- **WHEN** 归档进入合并步骤且 `branchMode=work-branch`
- **THEN** 技能 SHALL 在一次呈现中给出合并与推送信息，用户一次确认覆盖两者

#### Scenario: 合并失败不回滚归档

- **WHEN** 合并因冲突或基分支受保护失败
- **THEN** 归档结果 SHALL 保持成功状态，只输出 WARN 与冲突清单

#### Scenario: 非分支模式跳过合并

- **WHEN** `## 分支状态` 缺失或 `branchMode=none`
- **THEN** 技能 SHALL 跳过合并并继续摘要，MUST NOT 报错

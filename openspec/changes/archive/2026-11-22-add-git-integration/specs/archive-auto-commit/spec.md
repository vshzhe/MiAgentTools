## ADDED Requirements

### Requirement: 单变更归档自动提交

`iagent_spec_archive` SHALL 在索引更新（Step 7）之后、摘要（Step 8）之前执行「Step 7.5 归档自动提交」：

1. 收集待提交路径：该变更的制品固定清单（`collectArchiveCommitPaths`）+ 本次变更相关的代码改动
2. 路径为空 → 跳过提交并说明（不视为失败）
3. 精确 `git add <paths>`（MUST NOT `git add -A` / `git add .` / `git add openspec`）+ `git commit`，提交信息沿用 `iagent_commit` §3 的 Conventional Commits 中文一行式，尾行 `提案: <change-name>`
4. **失败不阻断**：钩子拒绝 / 权限不足 / 用户身份未配置 / detached HEAD / 存在未合并冲突 → 记 WARN + 处理建议，归档结果 MUST NOT 受影响
5. 提交成功后呈现 **⛔ 推送确认门**（门白名单第 5 类 `destructive-change`，不可豁免、MUST NOT 被 `gate-skip` 跳过）：确认则 `git push`；拒绝则保留本地提交并正常结束

#### Scenario: 提交成功

- **WHEN** 变更已归档且待提交路径非空、仓库状态正常
- **THEN** 技能 SHALL 执行精确暂存与 commit，提交信息尾行为 `提案: <change-name>`
- **AND** 报告 SHALL 记录 commit hash 与文件数

#### Scenario: 无路径可提交

- **WHEN** 归档变更无代码改动且制品已全部提交
- **THEN** 技能 SHALL 跳过 commit 并在摘要中说明，MUST NOT 报错

#### Scenario: 只暂存固定清单

- **WHEN** 工作区同时存在与本次变更无关的改动文件
- **THEN** 提交 SHALL 只包含本次变更的相关路径
- **AND** 无关文件 MUST NOT 进入提交（保持原状）

#### Scenario: 提交失败不阻断归档

- **WHEN** `git commit` 因钩子拒绝或身份未配置失败
- **THEN** 技能 SHALL 记 WARN 并给出建议
- **AND** 归档结果 MUST NOT 被回滚或标记失败

#### Scenario: 推送确认门拒绝

- **WHEN** 用户在推送确认门选择不推送
- **THEN** 本地提交 SHALL 保留，MUST NOT 执行 `git push`
- **AND** 流程 SHALL 正常结束

#### Scenario: 推送确认门不可跳过

- **WHEN** 调用方传入任何 `gate-skip` 参数
- **THEN** 推送确认门 SHALL 照常触发（`GATE_SKIP_IDS` MUST NOT 含推送相关 id）

### Requirement: 批量归档自动提交

`iagent_spec_bulk_archive` SHALL 在索引更新（Step 10）之后执行「Step 10.5 批量归档自动提交」，语义与单变更归档一致，差异为：

- **整批一次提交**（MUST NOT 逐变更分别提交），提交信息汇总各成功归档的变更名
- 仅收集**成功归档**的变更路径；部分失败时只提交成功者并另行报告失败项
- 推送确认门与失败处置同单变更归档

#### Scenario: 整批一次提交

- **WHEN** 批量归档成功归档三个变更
- **THEN** 技能 SHALL 执行**一次** commit，提交信息汇总这三个变更名
- **AND** MUST NOT 产生三次独立提交

#### Scenario: 部分归档失败

- **WHEN** 五个变更中三个归档成功、两个失败
- **THEN** 提交 SHALL 只包含成功归档者的路径
- **AND** 失败的两个 SHALL 在报告中单独列出，MUST NOT 纳入提交

### Requirement: 归档技能工具白名单

`iagent_spec_archive` 与 `iagent_spec_bulk_archive` 的 `allowedTools` SHALL 含 `Bash(git:*)`（经 `tool-whitelist.ts` 共享常量构造），否则自动提交步骤会被宿主权限拦截。

#### Scenario: 白名单放行 git

- **WHEN** 归档技能执行 `git add` / `git commit` / `git push`
- **THEN** 宿主 SHALL 按白名单放行，MUST NOT 出现权限拦截

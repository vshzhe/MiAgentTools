## MODIFIED Requirements

### Requirement: 提交范围确定（四场景）

技能 SHALL 按四种场景确定提交候选集：场景 1 指定 SVN changelist（校验列表存在，候选集 = 列表成员，不存在时列出可用列表供选）；场景 2 均未指定（先自动检测提案候选——存在活跃或归档未提交提案时进入提案分类提交流程；无候选时询问是否提交全部变更，不提交全部时请用户指定列表或文件，仍无法确定则终止）；场景 3 直接点名文件（候选集 = 点名文件）；场景 4 提案点名（读取点名提案后进入提案分类提交流程，归档提案同样适用）。候选集 MUST 先经「提交范围排除」过滤再进入环节 2（D3）。

**自动提交的窄通道例外（新增）**：交互式 `/iagent:commit` 调用 MUST NOT 自动 commit，确认前 MUST NOT 执行 `git commit`。本约束的**唯一例外**是归档收尾：
`iagent_spec_archive` / `iagent_spec_bulk_archive` 的归档自动提交 MAY 不经交互式确认即执行本地 commit，但 MUST 同时满足：
① 只暂存固定清单（MUST NOT `git add -A` / `git add .` / `git add openspec`）；
② 推送前 MUST 经推送确认门（`destructive-change`，不可豁免、MUST NOT 被 `gate-skip` 跳过）；
③ 失败 MUST NOT 阻断归档。
除上述窄通道外，任何调用方 MUST NOT 自动执行 `git commit`。

#### Scenario: 指定的变更列表不存在
- **WHEN** 用户执行 /iagent:svn-commit 提交 not-exist-list 列表且该列表不存在
- **THEN** 列出 svn status 中当前可用的变更列表供用户选择

#### Scenario: 场景 4 提案点名
- **WHEN** 用户执行 /iagent:svn-commit 提交 add-audit-alert 提案且该提案存在于 openspec/changes/
- **THEN** 技能读取该提案的 proposal/design/tasks，进入提案分类提交流程

#### Scenario: 未指定时自动检测到归档提案
- **WHEN** 用户执行 /iagent:svn-commit 且无活跃变更，但 archive/ 下某提案存在未提交制品
- **THEN** 该归档提案作为候选并标注「已归档」，进入提案分类提交流程

#### Scenario: 交互式提交仍需确认
- **WHEN** 用户调用 `/iagent:commit`
- **THEN** 技能 MUST 先展示将提交的文件与提交信息，确认后才执行 `git commit`

#### Scenario: 归档收尾自动提交不受交互约束
- **WHEN** `iagent_spec_archive` 归档收尾自动提交
- **THEN** 该提交 MUST 只含固定清单路径
- **AND** 推送前 MUST 触发推送确认门

## ADDED Requirements

### Requirement: 分支状态载体

系统 SHALL 在变更级 handoff 包 `.openspec-tmp/pipeline-<change-name>/handoff-pack.md` 中新增并列节 `## 分支状态`（与既有六节并列、**不计入六节**），记录 `branch` / `baseBranch` / `branchMode` / `createdAt` 四个字段。

- `branchMode` 取值域 SHALL 为 `work-branch` / `none`
- 写入方 SHALL 为 `iagent_spec_apply`（创建分支后立即写入）；读取方为 `spec-archive` / `debug` / `spec-update`（只读复用）
- 节缺失时读取方 SHALL 视为 `branchMode=none` 并记 WARN，MUST NOT 猜测分支名

#### Scenario: apply 创建分支后写入状态

- **WHEN** apply 在 Step 5.5 之后成功创建 `iagent/x`
- **THEN** handoff 包 SHALL 含 `## 分支状态` 段，`branchMode=work-branch`、`branch` 与 `baseBranch` 均为实际值

#### Scenario: 节缺失视为不分枝

- **WHEN** archive 读取 handoff 包但无 `## 分支状态` 段
- **THEN** 归档 SHALL 按 `branchMode=none` 继续，不执行合并步骤，并记 WARN

### Requirement: apply 分支准入（脏工作区不切换）

`iagent_spec_apply` SHALL 在 **Step 5.5 设计确认门之后、Step 6 批调度之前**执行分支准入：

1. 探测 Git 可用性与仓库状态（`iagent git status --json`）
2. **不可用 / 非仓库 / detached HEAD** → `branchMode=none` + WARN，继续 Step 6（行为与现状一致）
3. **可用** → 检查 `git status --porcelain`：
   - **有未提交改动** → **暂停**，呈现三出口：①提交已有改动 ②stash 暂存后继续 ③取消实现；用户选择后回到检查
   - **干净** → 创建并切换 `iagent/<change-name>`（幂等），写入 `## 分支状态`
4. 分支名校验失败或创建失败 → 降级 `branchMode=none` + WARN，MUST NOT 阻断实现

**MUST NOT 自动 `git stash`**、**MUST NOT 在脏工作区上切换分支**、**MUST NOT 覆盖既有同名分支**。

#### Scenario: 干净工作区创建分支

- **WHEN** apply 通过设计确认门且工作区无未提交改动
- **THEN** 技能 SHALL 创建 `iagent/<change-name>` 并写入 `## 分支状态`，随后进入 Step 6

#### Scenario: 脏工作区暂停

- **WHEN** 工作区存在未提交改动
- **THEN** 技能 SHALL 暂停并呈现三出口，MUST NOT 自动 stash、MUST NOT 切换分支

#### Scenario: 无 Git 降级

- **WHEN** 项目无 Git 或不是仓库
- **THEN** `branchMode=none` + WARN，Step 6 照常执行

### Requirement: apply 分支模式下的实现期提交

`iagent_spec_apply` 的 Step 10.5 语义 SHALL 按 `branchMode` 分叉：

- **`branchMode=work-branch`** → 按固定清单（`proposal.md` / `design.md` / `tasks.md` / `exploration.md` / `.openspec.yaml` / `specs/**/*.md`）+ 本次变更相关代码改动，**精确提交到工作分支**（`git add -- <具体路径>` + `git commit`），提交信息沿用 `iagent_commit` 规范并尾行 `提案: <change-name>`；提交前 SHALL 展示拟暂存清单
- **`branchMode=none`** → 保持现状（只精确暂存、不提交）

提交失败 SHALL 记 WARN 并继续（MUST NOT 阻断收尾）；**MUST NOT** 使用 `git add -A` / `git add .` / 目录通配。该提交属**实现期隔离动作**，MUST NOT 被表述为归档自动提交。

#### Scenario: 分支模式精确提交

- **WHEN** `branchMode=work-branch` 且全部任务完成
- **THEN** 技能 SHALL 在 `iagent/<change-name>` 上按固定清单精确提交，提交信息尾行 `提案: <change-name>`

#### Scenario: 非分支模式保持只暂存

- **WHEN** `branchMode=none`
- **THEN** 技能 SHALL 只精确暂存、MUST NOT 执行 `git commit`

#### Scenario: 提交失败不阻断

- **WHEN** 精确提交被钩子拒绝或身份未配置
- **THEN** 记 WARN 并继续收尾，MUST NOT 阻断

### Requirement: 归档合并与合并门

`iagent_spec_archive` SHALL 在 **Step 7.5（归档自动提交）之后、Step 8（摘要）之前**执行合并步骤：

1. 读取 `## 分支状态`；`branchMode≠work-branch` → 跳过合并并记日志
2. 呈现 **⛔ 合并门**（归门白名单 `destructive-change`，不可豁免、**MUST NOT 被 `gate-skip` 跳过**）：展示工作分支、基分支、待合并提交数与推送目标；合并与推送 SHALL 在**同一步内一次确认**
3. 确认 → `git merge --no-ff <branch>`（切回 `baseBranch` 后合并）
4. **冲突** → 暂停 + 冲突文件清单，MUST NOT abort；归档结果 MUST NOT 回滚
5. **成功** → `git branch -d <branch>`（失败仅 WARN）→ 推送确认（拒绝则保留本地合并）
6. **拒绝合并** → 保留分支与提交，正常结束归档（不删除分支）

合并失败 MUST NOT 阻断或回滚归档、MUST NOT 改写 `openspec/changes/archive/**`。

#### Scenario: 合并成功并删除分支

- **WHEN** 用户在合并门确认且无冲突
- **THEN** 技能 SHALL 合并回 `baseBranch` 并删除工作分支，摘要记录合并结果

#### Scenario: 合并冲突暂停

- **WHEN** 合并产生冲突
- **THEN** 技能 SHALL 暂停并列出冲突文件，MUST NOT abort、MUST NOT 回滚归档

#### Scenario: 拒绝合并保留工作

- **WHEN** 用户在合并门拒绝
- **THEN** 分支与提交 SHALL 保留，归档正常完成

#### Scenario: 合并门不可跳过

- **WHEN** 调用方传入任何 `gate-skip` 参数
- **THEN** 合并门 SHALL 照常触发

### Requirement: debug 与 spec-update 的验证后自动合并

`iagent_debug` 的 Phase 7 与 `iagent_spec_update` 的 Step 8 SHALL 在验证 PASS 后自动合并工作分支：

- **授权来源**：父流程本阶段的验证 PASS 结论；回执 SHALL 携带合并授权字段（`mergeAuthorized: true`）与合并结果（`mergeResult`）
- **门账本**：合并授权 MUST NOT 写入 `## 已确认门` 段（该段取值域收敛到 `GATE_SKIP_IDS`，写入域外 id 会触发 `invalid-receipt`）；SHALL 以回执字段表达
- **冲突** → 暂停 + 冲突清单，MUST NOT abort，MUST NOT 声明验证失败
- **成功** → 删除工作分支（失败仅 WARN）
- **无分支**（`branchMode=none`）→ 跳过合并并记日志

#### Scenario: debug 验证通过后自动合并

- **WHEN** debug Phase 7 验证 PASS 且 `branchMode=work-branch`
- **THEN** 技能 SHALL 自动合并并删除分支，回执含 `mergeAuthorized: true` 与 `mergeResult`

#### Scenario: 自动合并冲突

- **WHEN** debug 的自动合并产生冲突
- **THEN** 技能 SHALL 暂停并列出冲突，MUST NOT 声称验证失败、MUST NOT abort

#### Scenario: update 验证通过后自动合并

- **WHEN** spec-update Step 8 一致性验证 PASS 且 `branchMode=work-branch`
- **THEN** 技能 SHALL 自动合并，语义与 debug 一致

### Requirement: 非目标声明

分支隔离能力的技能正文 SHALL 显式声明：

- **不覆盖 SVN 项目**（由 `iagent_svn_commit` 承担，分支语义不适用）
- **不实现自动冲突解决**
- **`spec-bulk-archive` 不纳入**本次分支能力（沿用整批一次提交）

#### Scenario: 正文声明非目标

- **WHEN** 审阅 `iagent_spec_apply` / `iagent_spec_archive` 的分支段落
- **THEN** SHALL 可检索到 SVN 非目标声明与「不自动解决冲突」声明

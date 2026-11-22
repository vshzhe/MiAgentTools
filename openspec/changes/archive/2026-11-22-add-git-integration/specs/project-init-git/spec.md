## ADDED Requirements

### Requirement: project-init 前置 Git 环境检查

`iagent_project_init` SHALL 在原 11 步之前执行 Step 0「前置环境检查」，全程**非阻断**（任一步失败记 WARN 并继续初始化）：

1. 运行 `iagent git status --json` 检测
2. **未安装** → 运行安装器探测 → 呈现 **⛔ 安装确认门**（门白名单第 5 类 `destructive-change`，不可豁免）：展示将执行的确切命令；确认后执行，拒绝或安装失败则跳过 Git 能力并记 WARN
3. **已安装** → 运行 `iagent git init --json`（幂等）：
   - 无 `.git/` 且无上级仓库 → 创建
   - 已有 `.git/` → 零改动跳过
   - 存在上级仓库 → 提示并跳过（防嵌套仓库）

MUST NOT 在未获确认时执行任何安装命令；MUST NOT 因 Git 不可用或用户拒绝而中断初始化主流程。

#### Scenario: Git 已安装且项目未初始化

- **WHEN** `git status` 返回 `installed: true`、`isRepo: false`、`parentRepo: null`
- **THEN** 技能 SHALL 执行 `iagent git init` 并在报告中记录「Git 仓库已初始化」

#### Scenario: 已是仓库

- **WHEN** `git status` 返回 `isRepo: true`
- **THEN** 技能 MUST NOT 执行 init，报告记录「已是 Git 仓库，跳过初始化」

#### Scenario: 未安装且用户确认安装

- **WHEN** `installed: false` 且探测到可用安装器，用户在确认门选择安装
- **THEN** 技能 SHALL 执行该安装命令并复检
- **AND** 安装成功后继续执行 init 流程

#### Scenario: 未安装且用户拒绝

- **WHEN** 用户在安装确认门拒绝，或探测不到任何安装器
- **THEN** 技能 SHALL 跳过 Git 能力并记 WARN（含手动安装建议）
- **AND** 初始化其余步骤 SHALL 照常完成，MUST NOT 中断

#### Scenario: 上级仓库防护

- **WHEN** `git status` 返回 `parentRepo` 非空
- **THEN** 技能 MUST NOT 执行 init，报告提示该目录属于上级仓库

### Requirement: project-init 工具白名单

`iagent_project_init` 的 `allowedTools` SHALL 含 `Bash(git:*)`（经 `tool-whitelist.ts` 的共享常量构造），否则 Step 0 的 git 命令会被宿主权限拦截。

#### Scenario: 白名单放行 git

- **WHEN** 技能执行 `git --version` / `git init`
- **THEN** 宿主 SHALL 按白名单放行，MUST NOT 出现权限拦截

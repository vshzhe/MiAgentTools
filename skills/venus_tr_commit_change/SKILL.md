---
name: venus_tr_commit_change
description: 提交变更。当用户要提交代码，需要检查变更、生成规范的提交信息并提交时使用。
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Read, Glob, Grep
license: MIT
compatibility: 需要 git 环境。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_commit
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:31c00210dfd2dd677a0584bb17f785ea25a153837716b3fc74e296a7c5ddd3e4"
---

提交变更 —— 提交前必须核对变更内容，提交信息必须符合规范。

## 执行步骤

1. **检查当前变更**

   ```bash
   git status
   git diff --stat
   ```
   - 列出修改/新增/删除的文件
   - **发现与本次任务无关的变更时明确指出，询问是拆分提交还是一并提交**
   - 发现临时文件、调试代码、含密钥的文件时提醒用户，禁止直接提交

2. **核对提交内容**

   ```bash
   git diff
   ```
   - 浏览关键 diff，确认无意外改动（格式化风暴、无关文件、误删）
   - 如项目有测试/lint 脚本，提醒用户先运行确认通过（用户明确跳过时尊重决定）

3. **生成提交信息**

   遵循 Conventional Commits 规范（一行式）：
   ```text
   type(scope): subject
   ```
   - **type**：feat（新功能）/ fix（修复）/ docs（文档）/ style（格式）/ refactor（重构）/ test（测试）/ chore（构建/工具）
   - **scope**：影响的模块（可省略）
   - **subject**：祈使句、不加句号、50 字符内概括

   示例：`feat(auth): 添加用户登录接口`

4. **暂存并提交**

   - 优先精确暂存相关文件（`git add <files>`），而非无差别 `git add -A`
   - 执行 `git commit`，向用户展示最终提交信息与结果（commit hash、文件数）

## 约束

- 提交是外向且不可轻易撤销的操作：首次执行前向用户展示将要提交的文件与提交信息，确认后再执行
- 一次提交只做一件事：混合了功能与修复时建议拆分
- 禁止提交：密钥、.env、构建产物、用户明确排除的文件

---
name: "Venus: 提交变更"
description: 提交变更 —— 检查变更、生成规范提交信息并提交
allowed-tools: Bash(venus:*)
category: Venus / 提交
tags: [venus, tr_commit, git, commit]
---

提交变更 —— 提交前必须核对变更内容，提交信息必须符合规范。

**输入**：`/venus:commit-change` 后可跟提交信息建议或说明（可省略，省略时自动生成后展示确认）。

## 执行步骤

1. **检查当前变更**：`git status` + `git diff --stat`；无关变更、临时文件、疑似密钥必须先提醒。
2. **核对提交内容**：浏览 diff 确认无意外改动；提醒先跑测试/lint（用户明确跳过时尊重决定）。
3. **生成提交信息**：Conventional Commits 一行式 `type(scope): subject`，如 `feat(auth): 添加用户登录接口`。
4. **暂存并提交**：精确暂存相关文件，展示最终提交信息与结果。

## 约束

- 首次执行前展示将提交的文件与提交信息，确认后再执行
- 一次提交只做一件事，混合变更建议拆分
- 禁止提交密钥、.env、构建产物、用户明确排除的文件

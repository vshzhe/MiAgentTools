---
name: "Venus: 查看当前路径"
description: 查看当前路径 —— 显示当前工作目录的绝对路径
allowed-tools: Bash(venus:*)
category: Venus / 工具
tags: [venus, tr_tools, pwd, path]
---

查看当前路径 —— 给出当前工作目录的绝对路径。

## 执行步骤

1. **获取当前工作目录**：优先 `pwd`（Git Bash / macOS / Linux 通用）；不可用时按 shell 兜底 —— PowerShell 用 `Get-Location`，cmd 用 `echo %CD%`。
2. **展示结果**：以清晰格式呈现绝对路径。
3. **（可选）补充上下文**：顺带说明路径下的关键标志文件（package.json / .git 等）。

## 约束

- 只做只读操作，不切换目录、不修改任何文件
- 始终报告命令实际返回的路径，不做推断

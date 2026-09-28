---
name: venus_tr_tools_pwd
description: 查看当前路径。当用户询问当前目录在哪、需要确认工作目录的绝对路径时使用。
allowed-tools: Bash(pwd:*), Bash(pwd), Bash(echo %CD%:*), Bash(echo %CD%), Read, Glob
license: MIT
compatibility: 无特殊依赖，通用环境可用。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_tools
  generatedBy: "1.2.0"
---

查看当前路径 —— 给出当前工作目录的绝对路径。

## 执行步骤

1. **获取当前工作目录**

   优先运行跨 shell 通用的命令：
   ```bash
   pwd
   ```
   Git Bash / macOS / Linux 环境下直接生效。

   如果 pwd 不可用（如纯 Windows cmd），按环境选择兜底命令：
   - PowerShell：`Get-Location`
   - cmd：`echo %CD%`

2. **展示结果**

   以清晰的格式向用户呈现：
   ```text
   当前工作目录：
   E:\github\VenusAgentTools
   ```

3. **（可选）补充上下文**

   如果用户是在问"我们在哪"的语境下询问，可顺带说明该路径下的关键标志文件
   （package.json / pom.xml / .git 等），帮助用户确认项目身份。

## 约束

- 只做只读操作，不切换目录、不修改任何文件
- 始终报告命令实际返回的路径，不做推断

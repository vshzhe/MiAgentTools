---
name: venus_tr_init_project
description: 初始化项目。当用户要创建新项目、搭建目录结构、生成配置文件或准备开发环境时使用。
allowed-tools: Bash(ls:*), Bash(pwd:*), Read, Write, Glob, Grep
license: MIT
compatibility: 无特殊依赖，通用环境可用。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_init
  generatedBy: "0.1.0"
---

初始化项目 —— 按步骤搭建项目骨架，确保每个决定都得到用户确认。

**核心原则**：初始化是"结构决定"，不是"随手生成"。所有目录与配置在创建前必须向用户说明用途并获得确认。

## 执行步骤

1. **明确初始化目标**

   如果用户未说明，先提问（一次只问一个聚焦问题）：
   - 项目类型是什么（Web 服务 / CLI 工具 / 库 / 其他）？
   - 技术栈偏好（JDK、框架、数据库）？

2. **探查当前环境**

   在创建任何文件之前先检查现状：
   ```bash
   ls -la
   ```
   - 目录是否为空？已有 package.json / pom.xml / build.gradle 等标志文件？
   - 已有 git 仓库？

   **禁止覆盖既有文件**。发现同名文件时停下来向用户说明，等待指示。

3. **输出初始化蓝图**

   以清单形式列出将要创建的目录与文件，等待用户确认后再动手：
   ```text
   将创建：
   ├── src/                 源码目录
   ├── test/                测试目录
   ├── package.json         包定义（含 build/test 脚本）
   └── README.md            项目说明
   ```

4. **创建骨架**

   按蓝图逐项创建。创建完成后：
   - 列出实际创建的文件
   - 给出下一步建议（安装依赖、首次构建、初始化 git）

## 约束

- 不引入用户未要求的功能与依赖（最小可用原则）
- 目录结构遵循用户技术栈的社区惯例（如 Maven 的 src/main/java 分层）
- 每一步可验证：创建完成后用户应能直接构建或运行

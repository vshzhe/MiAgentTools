---
name: "Venus: 列出技能"
description: 列出可用技能 —— 展示已安装的 venus 技能与分类体系
allowed-tools: Bash(venus:*)
category: Venus / 工具
tags: [venus, tr_tools, list, skills]
---

列出可用技能 —— 展示已安装的 venus 技能与分类体系。

## 执行步骤

1. **运行列表命令**：`venus list`（结构化数据用 `venus list --json`）。
2. **展示结果**：按 7 类生命周期分组（tr_init 初始化 / tr_impl 实现 / tr_test 测试 / tr_commit 提交 / tr_review 审查 / tr_release 版本 / tr_tools 工具）。
3. **（可选）说明用法**：各技能对应的斜杠指令形式，及 `venus generate --type <type> --name <name>` 生成新技能的方法。

## 约束

- 只做只读操作
- 输出以命令实际返回为准，不凭记忆罗列

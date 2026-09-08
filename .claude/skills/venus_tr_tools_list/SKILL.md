---
name: venus_tr_tools_list
description: 列出可用技能。当用户想了解当前环境有哪些 venus 技能及其分类时使用。
allowed-tools: Bash(venus:*), Bash(venus), Read, Glob
license: MIT
compatibility: 需要 venus CLI。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_tools
  generatedBy: "0.1.0"
---

列出可用技能 —— 展示已安装的 venus 技能与分类体系。

## 执行步骤

1. **运行列表命令**

   ```bash
   venus list
   ```
   如需结构化数据（供程序处理）：
   ```bash
   venus list --json
   ```

2. **展示结果**

   按 7 类生命周期分组呈现：
   ```text
   tr_init    初始化   venus_init_project
   tr_impl    实现     venus_impl_feature
   tr_test    测试     venus_test_generate
   tr_commit  提交     venus_commit_change
   tr_review  审查     venus_review_code
   tr_release 版本     venus_release_version
   tr_tools   工具     venus_tools_pwd, venus_tools_list
   ```

3. **（可选）说明用法**

   如用户在探索可用能力，补充说明：
   - 每个技能对应的斜杠指令形式（如 `/venus:tools-pwd`）
   - 如何用 `venus generate --type <type> --name <name>` 生成新技能

## 约束

- 只做只读操作
- 输出以命令实际返回为准，不凭记忆罗列

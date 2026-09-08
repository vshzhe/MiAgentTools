---
name: venus_tr_test_generate
description: 生成测试。当用户要为新功能或已有代码编写测试用例、补充测试覆盖时使用。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(npm:*), Bash(node:*)
license: MIT
compatibility: 无特殊依赖，通用环境可用。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_test
  generatedBy: "0.1.0"
---

生成测试 —— 目标驱动：先把验收标准变成可执行的测试，再让它通过。

**核心方法**：将任务转化为可验证目标。"添加校验" → "先写非法输入的测试，再让它通过"；"修 bug" → "先写复现该 bug 的测试，再修复"。

## 执行步骤

1. **确定测试范围**

   - 探查项目已用的测试框架与既有用例风格（JUnit5 / Vitest / pytest 等），保持一致
   - 识别被测目标的公开契约：正常路径、边界条件、异常分支
   - 用户未指定范围时，列出计划覆盖的方法清单请用户确认

2. **设计用例**

   每个被测方法至少覆盖：
   - **正常路径**：合法输入的预期输出
   - **边界条件**：空集合、零值、极值、null 入参
   - **异常分支**：非法输入、依赖失败时的错误传播
   - **业务规则**：状态机约束、幂等性、并发场景（如涉及）

3. **编写测试**

   - 遵循 given-when-then 结构，测试方法名描述场景（如 `getUserById_userNotFound_throwsException`）
   - 一个测试只验证一个行为
   - 外部依赖（数据库/Redis/MQ）使用 mock 或测试容器，不在单测中直连真实环境
   - 测试数据构造集中管理，避免重复字面量

4. **运行与修复**

   ```bash
   pnpm test   # 或项目对应的测试命令
   ```
   - 全部通过后报告结果（通过数 / 总数）
   - 失败时先区分：测试写错还是代码有 bug —— 代码有 bug 时衔接 `venus_impl_feature` 修复，并说明原因

## 约束

- 禁止为凑覆盖率写无断言的"空转测试"
- 测试必须可重复：不依赖执行顺序、不依赖外部状态
- 不修改被测代码来迁就测试（除非该代码确有 bug，且需向用户说明）

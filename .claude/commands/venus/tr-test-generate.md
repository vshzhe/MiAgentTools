---
name: "Venus: 生成测试"
description: 生成测试 —— 结构化全流程：检测框架、BCDE 场景矩阵、分层编写、运行验证
allowed-tools: Bash(venus:*)
category: Venus / 测试
tags: [venus, tr_test, test, tdd]
---

生成测试 —— 结构化全流程：检测框架 → 设计场景 → 分层编写 → 运行验证。

**目标驱动**：先把验收标准变成可执行的测试，再让它通过。

**输入**：`/venus:tr-test-generate` 后跟被测目标（类名、方法名、文件路径或功能描述）。

## 执行步骤

1. **框架检测**：自动检测 Vitest / Jest / Mocha 等测试框架，读取 1-2 个已有测试文件对齐风格。
2. **BCDE 场景矩阵**：按正常(Basic)/边界(Boundary)/业务规则(Design)/异常(Exception) 四象限设计场景。
3. **分层编写**：
   - Service 层：`vi.mock()` Mock 外部依赖 + 验证交互
   - Controller 层：SuperTest + Mock 依赖
   - 工具类：参数化测试（`it.each`）
4. **生成代码**：AAA 结构（Given/When/Then）、一测一行为、精确断言。
5. **运行验证**：`pnpm test`，全部通过后报告结果。

## 约束

- 禁止无断言空转、禁止共享可变状态、禁止 `console.log` 替代断言
- 一个测试只验证一个行为
- 测试必须可重复，不依赖执行顺序
- 不修改被测代码来迁就测试

---
name: "Venus: 生成测试"
description: 生成测试 —— 多 schema 模式：检测 Java/Node 框架、BCDE 场景矩阵、分层编写、运行验证
allowed-tools: Bash(venus:*)
category: Venus / 测试
tags: [venus, tr_test, test, tdd, java, node]
---

生成测试 —— 多 schema 模式：检测语言/框架 → 加载对应 schema → 设计场景 → 分层编写 → 运行验证。

**目标驱动**：先把验收标准变成可执行的测试，再让它通过。

**输入**：`/venus:tr-test-generate` 后跟被测目标（类名、方法名、文件路径或功能描述）。

## 执行步骤

1. **语言/框架检测（schema 路由）**：检测 `pom.xml`/`build.gradle`（Java）或 `package.json`（Node），Read 对应 `references/schema-*.md` 加载框架专属内容。
2. **BCDE 场景矩阵**：按正常(Basic)/边界(Boundary)/业务规则(Design)/异常(Exception) 四象限设计场景。
3. **分层编写**：Service 层 Mock 外部依赖 + 验证交互；Controller 层 HTTP 端到端（Java MockMvc / Node SuperTest）；工具类参数化测试。具体 Mock API 与模板见 schema。
4. **生成代码**：AAA 结构（Given/When/Then）、一测一行为、精确断言。Java 项目生成前执行测试计划确认门。
5. **运行验证**：`mvn test` / `gradle test` / `pnpm test` / `npm test`，全部通过后报告结果。

## 约束

- 禁止无断言空转、禁止共享可变状态、禁止日志替代断言
- 一个测试只验证一个行为
- 测试必须可重复，不依赖执行顺序
- 不修改被测代码来迁就测试
- 语言专属约束见 schema-*.md（Java：禁止通配符导入/@Test(expected)；Node：vi.mock hoisting）

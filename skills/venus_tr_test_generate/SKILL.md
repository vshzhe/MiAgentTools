---
name: venus_tr_test_generate
description: 生成测试。当用户要为新功能或已有代码编写测试用例、补充测试覆盖时使用。多 schema 模式：自动检测 Java（Maven/Gradle）或 Node（Vitest/Jest/Mocha）项目，加载对应框架模板。Java 覆盖 JUnit4/5+Mockito/EasyMock/AssertJ，Node 覆盖 Vitest/Jest/Mocha。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(npm:*), Bash(node:*), Bash(mvn:*), Bash(gradle:*), Bash(mkdir:*), Bash(ls:*), Bash(find:*), Bash(cat:*), Bash(cp:*), Bash(grep:*), Bash(echo:*)
license: MIT
compatibility: 无特殊依赖，通用环境可用。多 schema 自动适配：Java（Maven/Gradle + JUnit4/5/Mockito/EasyMock/AssertJ）与 Node（Vitest/Jest/Mocha/Jasmine）。
metadata:
  author: venus-agent-tools
  version: "3.0"
  type: tr_test
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:8281e6b41fe7ad3d493a9bf7f50d000ae3b0a2a4b590b7f4163a34bda09a1cbe"
---

生成测试 —— 多 schema 模式：检测语言/框架 → 加载对应 schema → BCDE 场景矩阵 → 分层编写 → 运行验证。

**目标驱动**：先把验收标准变成可执行的测试，再让它通过。"添加校验" → "先写非法输入的测试，再让它通过"；"修 bug" → "先写复现该 bug 的测试，再修复"。

---

## 阶段一：语言与框架检测（schema 路由）

本技能采用多 schema 模式：主 SKILL 承载语言无关的通用流程（场景设计、编写规范、反模式），语言/框架专属内容（检测细节、Mock API、代码模板、运行命令）拆分为 `references/schema-*.md`，按检测结果按需 Read 加载，避免单文件上下文膨胀。

### 1.1 检测项目语言与框架

```bash
# Java 项目（Maven / Gradle）
if [ -f "pom.xml" ] || [ -f "build.gradle" ]; then
    echo "java"
fi
# Node 项目
if [ -f "package.json" ]; then
    grep -q "vitest" package.json 2>/dev/null && echo "node:vitest"
    grep -q "jest" package.json 2>/dev/null && echo "node:jest"
    grep -q "mocha" package.json 2>/dev/null && echo "node:mocha"
fi
```

### 1.2 schema 索引表（按检测结果 Read 对应子文件）

| 子文件 | 适用项目 | 包含内容 | 何时 Read |
|---|---|---|---|
| `references/schema-java.md` | Java（Maven/Gradle，Spring Boot/MVC/传统Web/纯Java） | 框架类型判定、测试依赖分析报告、7 级测试位置扫描、模板 A-F（JUnit4/5+Mockito/EasyMock/@WebMvcTest/参数化/遗留 XML）、遗留代码测试策略、mvn/gradle 命令、Java 专属约束 | 检测到 `pom.xml` 或 `build.gradle` |
| `references/schema-node.md` | Node/TS（Vitest/Jest/Mocha/Jasmine） | 框架检测细节、Mock 方式（vi.mock/jest.mock）、分层测试 TS 示例（Service/Controller/Utils）、pnpm/npm 命令、Node 专属约束 | 检测到 `package.json` |

> 子文件路径相对技能目录（如 `.claude/skills/venus_tr_test_generate/references/schema-java.md`）。加载后结合本 SKILL 的通用流程执行后续阶段。

**未识别语言**：输出检测结果并建议用户指定框架，或默认输出与项目最接近的风格代码。

---

## 阶段二：场景设计（BCDE 场景矩阵法）

对每个被测方法，按 **BCDE（Basic/Boundary/Design/Exception）四象限矩阵** 设计场景：

| 场景类型 | 测试目标 | 示例 |
|---------|---------|------|
| **B**asic（正常路径） | 核心业务逻辑按预期工作 | 合法输入返回正确结果 |
| **B**oundary（边界条件） | 临界值/极限条件下的表现 | Null、空值、0、负数、极大值 |
| **D**esign（业务规则） | 业务约束和规则被遵守 | 状态机流转、幂等性、并发控制 |
| **E**xception（异常路径） | 非法输入/依赖故障的处理 | 参数校验失败、依赖服务不可用 |

**场景矩阵模板**：

```markdown
### `被测方法名`
| ID | 类型 | 输入条件 | 预期结果 |
|----|------|---------|---------|
| TC001 | B | 合法参数 | 正常返回正确结果 |
| TC002 | B | 参数为 null | 抛出参数校验异常 |
| TC003 | B | 空集合入参 | 返回空结果 |
| TC004 | D | 重复提交 | 幂等处理，返回已有结果 |
| TC005 | E | 依赖服务超时 | 降级返回缓存/错误提示 |
```

**场景数量要求**：每个方法至少覆盖：
- 1-2 个正常路径（Happy Path）
- 2-3 个边界条件（Null、空值、极值、临界值）
- 1-2 个业务规则（如涉及状态机/幂等/并发）
- 1-2 个异常路径（非法入参、依赖失败）

---

## 阶段三：分层测试策略（通用）

根据被测对象的层次，采用不同的测试策略；具体框架的 Mock API 与代码示例见已加载的 schema-*.md。

#### Service / 业务逻辑层
- **测试目标**：验证业务规则、分支逻辑、异常处理
- **Mock 范围**：DAO/Repository、外部服务、缓存、消息队列
- **核心验证**：返回结果正确性、依赖调用次数与入参验证、异常分支覆盖

#### Controller / 接口层
- **测试目标**：验证请求映射、参数校验、响应格式、权限拦截
- **Mock 范围**：所有 Service 依赖
- **最佳实践**：HTTP 端到端测试（Java: MockMvc + @WebMvcTest；Node: SuperTest）或 mock 请求/响应对象

#### 工具类 / Utils
- **测试目标**：验证输入输出正确性，覆盖所有边界场景
- **Mock 范围**：一般无需 Mock，直接测试
- **最佳实践**：大量使用参数化测试减少重复代码

---

## 阶段四：测试代码生成（通用规范）

**命名规范**：
- 测试类：被测类名 + Test（`UserService → UserServiceTest`）
- 测试方法：业务场景式 或 行为驱动式（二选一，与项目现有风格一致）
  - 业务场景式：`getUserById_userNotExists_throwsException`
  - 行为驱动式（推荐）：`should_throw_exception_when_user_not_exists`

**AAA / Given-When-Then 结构**（强制）：
```
// Given: 准备测试数据 + Mock 外部依赖
// When: 执行被测方法
// Then: 断言结果 + 验证依赖交互
```

**断言规范**：
- **禁止** 日志输出（`console.log()` / `System.out.println()`）替代断言
- **禁止** 只写"存在性"断言不做具体字段校验
- **禁止** 在断言中使用循环、条件判断等逻辑
- 异常断言使用框架对应 API（见 schema）
- 推荐使用精确断言：断言具体字段值而非仅判存在

**一个测试只验证一个业务行为**，避免单个方法中断言多个不相关的场景。

> 框架专属代码模板（Java 模板 A-F、Node vi.mock 示例）见已加载的 schema-*.md。Java 项目在生成代码前需执行测试计划确认门（见 schema-java.md J5.3）。

---

## 阶段五：运行与验证

按项目构建工具运行测试（Java: `mvn test` / `gradle test`；Node: `pnpm test` / `npm test`，具体命令见 schema-*.md）。

**结果验证**：
- 全部通过后报告：`✅ N/M tests passed`
- 失败时先区分：
  1. **测试代码写错** → 修正后重新运行
  2. **被测代码有 bug** → 说明具体情况，给出修复建议，衔接 `/venus:tr-impl-feature`

---

## 反模式清单与约束

### 常见反模式（禁止）

| 反模式 | 危害 | 正确做法 |
|--------|------|---------|
| 无断言空转测试 | 执行即通过，无法发现逻辑错误 | 每个测试必须有明确断言 |
| 测试间共享可变状态 | 执行顺序影响结果 | 每用例前重置状态，每个用例自行构造数据 |
| 日志替代断言 | 无法自动验证 | 所有预期结果使用断言自动验证 |
| 测试方法中写循环/条件 | 测试本身可能有 Bug | 用参数化测试替代 |
| 命名模糊（`test1`） | 失败后无法快速定位 | 场景化命名，见名知意 |

### 强制约束（语言无关）

- 禁止修改被测代码来迁就测试
- 禁止 Mock 值对象、实体类、简单工具类
- 测试数据构造集中管理，避免重复字面量
- 不依赖执行顺序、不依赖外部状态
- 测试必须可重复：任意环境、任意次数执行结果稳定
- 一个测试只验证一个业务行为
- 外部依赖（数据库/Redis/MQ）使用 mock，不在单测中直连真实环境
- 禁止长期跳过测试（`@Disabled` / `it.skip`，临时跳过必须标注原因和修复时间）
- 测试代码与生产代码遵循同等质量标准（无魔法值、无重复代码、命名规范）

> 语言专属约束（如 Java 禁止通配符导入 / `@Test(expected=...)`，Node `vi.mock()` hoisting 等）见 schema-*.md。

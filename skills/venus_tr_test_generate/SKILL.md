---
name: venus_tr_test_generate
description: 生成测试。当用户要为新功能或已有代码编写测试用例、补充测试覆盖时使用。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(npm:*), Bash(node:*)
license: MIT
compatibility: 无特殊依赖，通用环境可用。自动适配 Vitest/Jest/Mocha 等测试框架。
metadata:
  author: venus-agent-tools
  version: "2.0"
  type: tr_test
  generatedBy: "snapshot"
---

生成测试 —— 结构化全流程：检测框架 → 设计场景 → 分层编写 → 运行验证。

**目标驱动**：先把验收标准变成可执行的测试，再让它通过。"添加校验" → "先写非法输入的测试，再让它通过"；"修 bug" → "先写复现该 bug 的测试，再修复"。

---

## 执行步骤

### 阶段一：项目测试框架检测

在编写任何测试前，先自动检测项目使用的测试框架与既有测试风格：

```bash
# 检测 Vitest（优先）
grep -q "vitest" package.json 2>/dev/null && echo "vitest"
# 检测 Jest
grep -q "jest" package.json 2>/dev/null && echo "jest"
# 检测 Mocha
grep -q "mocha" package.json 2>/dev/null && echo "mocha"
# 检测 Jasmine
grep -q "jasmine" package.json 2>/dev/null && echo "jasmine"
```

**检测结果决定**：
- **测试框架选择**：Vitest（`describe/it/expect`）、Jest（`describe/test/expect`）、Mocha（`describe/it/assert`）
- **Mock 方式**：Vitest → `vi.mock()` / `vi.spyOn()`；Jest → `jest.mock()` / `jest.spyOn()`
- **配置文件**：`vitest.config.ts`、`jest.config.js` 等

**既有测试风格对齐**：
- 读取 1-2 个已有测试文件，了解项目的命名风格、注释习惯、断言方式
- 命名为：业务场景式（`getUserById_userNotFound_throwsException`）或行为驱动式（`should_throw_exception_when_user_not_exists`）

> **找不到测试框架时**：输出提示并建议用户指定框架，或默认输出 Vitest 风格代码。

---

### 阶段二：场景设计（BCDE 场景矩阵法）

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
| TC002 | B | 参数为 null | 抛出 TypeError |
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

### 阶段三：分层测试指导

根据被测对象的层次，采用不同的测试策略：

#### Service / 业务逻辑层
- **测试目标**：验证业务规则、分支逻辑、异常处理
- **Mock 范围**：DAO/Repository、外部服务、缓存、消息队列
- **核心验证**：返回结果正确性、依赖调用次数与入参验证、异常分支覆盖
- **技术**：ViTest 的 `vi.mock()` / `vi.spyOn()` 隔离外部依赖

```typescript
// TypeScript Service 测试示例 — AAA 结构
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 外部依赖
vi.mock('../repositories/user-repository');

describe('UserService', () => {
    it('should_return_user_when_query_by_valid_id', async () => {
        // Given: 准备测试数据 + Mock 外部依赖
        const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
        vi.mocked(findById).mockResolvedValue(mockUser);

        // When: 执行被测方法
        const result = await userService.getUserById(1);

        // Then: 断言返回结果 + 验证交互
        expect(result).toBeDefined();
        expect(result.name).toBe('Alice');
        expect(findById).toHaveBeenCalledWith(1);
    });

    it('should_throw_exception_when_user_not_exists', async () => {
        // Given
        vi.mocked(findById).mockResolvedValue(null);

        // When + Then
        await expect(userService.getUserById(999))
            .rejects.toThrow('用户不存在');
    });
});
```

#### Controller / 接口层
- **测试目标**：验证请求映射、参数校验、响应格式、权限拦截
- **Mock 范围**：所有 Service 依赖
- **最佳实践**：使用 SuperTest（HTTP）或 mock 请求/响应对象

```typescript
// Controller 测试示例
import { describe, it, expect } from 'vitest';
import request from 'supertest'; // 如适用

describe('UserController', () => {
    it('should_return_200_when_get_user', async () => {
        const res = await request(app).get('/api/user/1');
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBeDefined();
    });
});
```

#### 工具类 / Utils
- **测试目标**：验证输入输出正确性，覆盖所有边界场景
- **Mock 范围**：一般无需 Mock，直接测试
- **最佳实践**：大量使用参数化测试减少重复代码

```typescript
// 工具类参数化测试示例
import { describe, it, expect } from 'vitest';

describe('StringUtils', () => {
    it.each([
        [null, true],
        ['', true],
        ['  ', true],
        ['hello', false],
    ])('should_judge_blank_correctly(%s, %s)', (input, expected) => {
        expect(isBlank(input)).toBe(expected);
    });
});
```

---

### 阶段四：测试代码生成

#### 通用编写规范

**命名规范**：
```typescript
// 测试类：被测类名 + Test
UserService → UserServiceTest

// 测试方法：业务场景式 或 行为驱动式（二选一，与项目现有风格一致）
// 业务场景式
getUserById_userNotExists_throwsException()
// 行为驱动式（推荐）
should_throw_exception_when_user_not_exists()
```

**AAA / Given-When-Then 结构**（强制）：
```typescript
it('should_throw_exception_when_user_not_exists', async () => {
    // Given: 准备测试数据 + Mock 外部依赖
    // When: 执行被测方法
    // Then: 断言结果 + 验证依赖交互
});
```

**断言规范**：
- **禁止** `console.log()` 替代断言
- **禁止** 只写 `expect(result).toBeDefined()` 不做具体字段校验
- **禁止** 在断言中使用循环、条件判断等逻辑
- 异常断言使用 `expect(fn).rejects.toThrow()` 或 `expect(fn).toThrow()`
- 推荐使用精确断言：`expect(result.name).toBe('Alice')` 而非 `expect(result).toBeDefined()`

**一个测试只验证一个业务行为**，避免单个方法中断言多个不相关的场景。

---

### 阶段五：运行与验证

```bash
# 运行指定测试文件
pnpm test -- <测试文件路径>

# 运行所有测试
pnpm test

# 或项目对应的测试命令
npm test
```

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
| 测试间共享可变状态 | 执行顺序影响结果 | `beforeEach` 重置状态，每个用例自行构造数据 |
| `console.log()` 替代断言 | 无法自动验证 | 所有预期结果使用断言自动验证 |
| 测试方法中写循环/条件 | 测试本身可能有 Bug | 用参数化测试替代 |
| 命名模糊（`test1`） | 失败后无法快速定位 | 场景化命名，见名知意 |

### 强制约束

- 禁止修改被测代码来迁就测试
- 禁止 Mock 值对象、实体类、简单工具类
- 测试数据构造集中管理，避免重复字面量
- 不依赖执行顺序、不依赖外部状态
- 测试必须可重复：任意环境、任意次数执行结果稳定
- 一个测试只验证一个业务行为
- 外部依赖（数据库/Redis/MQ）使用 mock，不在单测中直连真实环境
- 禁止使用 `@Disabled` / `it.skip` 长期跳过测试（临时跳过必须标注原因和修复时间）
- 测试代码与生产代码遵循同等质量标准（无魔法值、无重复代码、命名规范）

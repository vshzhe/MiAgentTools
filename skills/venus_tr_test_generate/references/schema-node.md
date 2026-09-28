## Node Schema —— 框架检测、分层示例与运行

> 本 schema 在主 SKILL 阶段一检测到 `package.json` 时加载。
> 通用流程（BCDE 场景矩阵、命名/AAA/断言规范、反模式清单）见主 SKILL，本文件不重复。

### N1. 测试框架检测

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

### N2. 分层测试示例（TypeScript / Vitest）

分层策略（Service/Controller/Utils 的目标与 Mock 范围）见主 SKILL 阶段三，本节给出 Vitest 代码示例。

#### Service / 业务逻辑层

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

#### 工具类 / Utils（参数化测试）

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

### N2.5 功能级测试（Functional）

当主 SKILL 阶段一 1.3 判定为**功能级层级**时，使用本节写法。功能级测试验证跨组件的完整功能链路，仅 Mock 真正的外部系统。

**工具链检测（先执行）**：

```bash
grep -q "supertest" package.json 2>/dev/null && echo "supertest" || echo "missing"
```

**降级规则**：检测不到 `supertest`（或等价 HTTP 测试工具）时 MUST 降级为单元测试层级并提示，MUST NOT 生成无法运行的测试代码。

**模板：功能级测试（supertest）**

```typescript
// 功能级测试示例 — 从功能入口发起，断言可观测结果
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { startTestDb, stopTestDb } from './helpers/test-db';

describe('提交流程（功能级）', () => {
    beforeAll(async () => {
        await startTestDb();   // 仅准备真实外部依赖，不 Mock 内部组件
    });

    afterAll(async () => {
        await stopTestDb();
    });

    it('should_create_order_and_deduct_stock_when_submit_valid_order', async () => {
        // Given: 通过功能入口准备前置数据
        const payload = { userId: 1, skuCode: 'SKU-001', quantity: 2 };

        // When: 从功能入口发起完整链路
        const res = await request(app).post('/api/orders').send(payload);

        // Then: 断言可观测的最终结果
        expect(res.status).toBe(201);
        expect(res.body.orderNo).toBeTruthy();

        const stockRes = await request(app).get('/api/stock/SKU-001');
        expect(stockRes.body.quantity).toBe(8);
    });
});
```

**Node 功能级测试约束**：

- MUST 断言**可观测的最终结果**（HTTP 状态、响应体、再次查询的数据），MUST NOT 断言内部函数的调用次数
- 涉及数据写入的用例 MUST 在 `beforeAll`/`afterAll` 或 `beforeEach`/`afterEach` 中准备与清理数据，确保可重复（FIRST 的 R）
- MUST NOT 在功能级测试中 Mock 内部模块（`vi.mock()` 内部 Service/Repository）——那会让测试退化为单元测试而失去层级价值
- 用例命名 MUST 表达完整功能意图（如 `should_create_order_and_deduct_stock_when_submit_valid_order`）

### N3. 运行与验证

```bash
# 运行指定测试文件
pnpm test -- <测试文件路径>

# 运行所有测试
pnpm test

# 或项目对应的测试命令
npm test

# 覆盖度实测（主 SKILL 5.1 方式 1）——项目已配置 c8 / vitest coverage 时
pnpm test -- --coverage
# 或：pnpm exec c8 pnpm test
# 未配置覆盖度工具（package.json 无 c8 / @vitest/coverage-*）→ 走方式 2 静态矩阵并标注"未实测覆盖度"

# 仅运行功能级测试（按文件名约定筛选）
pnpm test -- <功能级测试文件路径>
```

### N4. Node 专属约束

- 异常断言使用 `expect(fn).rejects.toThrow()`（异步）或 `expect(fn).toThrow()`（同步）
- 禁止使用 `it.skip` / `it.todo` 长期跳过测试（临时跳过必须标注原因和修复时间）
- `vi.mock()` / `jest.mock()` 的工厂函数必须提升到文件顶部（hoisting），不可放在条件分支内
- 推荐使用精确断言：`expect(result.name).toBe('Alice')` 而非 `expect(result).toBeDefined()`
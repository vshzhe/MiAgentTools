# 测试生成技能使用说明（test_generate 多 schema 五阶段流程与 BCDE 场景详解）

> 适用技能：venus_tr_test_generate（多 schema 模式，version 3.0）
> 文档日期：2026-09-16
> 依据：`skills/venus_tr_test_generate/SKILL.md` 静态快照原文（version 3.0）
> 配套文档：[skills-manual.md](skills-manual.md)（全技能总说明书）

---

## 目录

1. [技能定位与选择决策](#1-技能定位与选择决策)
2. [定位与触发](#2-定位与触发)
3. [五阶段流程详解](#3-五阶段流程详解)
4. [BCDE 场景矩阵法](#4-bcde-场景矩阵法)
5. [分层测试策略](#5-分层测试策略)
6. [调用示例](#6-调用示例)
7. [反模式清单与强制约束](#7-反模式清单与强制约束)
8. [常见问题与限制](#8-常见问题与限制)

---

# 1. 技能定位与选择决策

test_generate 是**多 schema 测试生成技能**——结构化全流程：检测语言/框架 → 加载对应 schema →
设计场景 → 分层编写 → 运行验证。目标驱动：**先把验收标准变成可执行的测试，再让它通过**。

- "添加校验" → "先写非法输入的测试，再让它通过"
- "修 bug" → "先写复现该 bug 的测试，再修复"

## 1.1 多 schema 架构（v3.0 合并）

v3.0 将原 `venus_tr_test_generate`（TS 专属）与 `venus_tr_test_gentest_java`（Java 专属）
合并为单一技能的多 schema 模式。主 SKILL 语言无关，语言专属内容拆为 `references/schema-*.md`
按检测结果按需 Read：

| 你的需求 | 加载的 schema |
| :--- | :--- |
| **Java 项目**（有 `pom.xml` / `build.gradle`）生成 JUnit/Mockito 单元测试 | `references/schema-java.md`（JUnit4/5 + Mockito/EasyMock/AssertJ，6 模板 A-F，7 级位置扫描，遗留策略） |
| 前端 / Node.js / 通用项目（Vitest / Jest / Mocha / Jasmine） | `references/schema-node.md`（vi.mock/jest.mock，分层 TS 示例） |
| Java 遗留项目（静态方法耦合、system scope 依赖、JDK 8） | `references/schema-java.md`（J7 遗留代码测试策略） |
| 修 bug 前先写复现测试 | 主 SKILL 目标驱动模式（语言无关） |
| 调试工作流（复现→根因→修复→回归） | `venus_tr_impl_debug`（完整的调试循环） |

**单一技能的好处**：用户无需按语言选技能，主 SKILL 自动检测路由；新语言扩展 = 新增一个
schema 文件 + 路由表加一行。allowed-tools 已并集预授权 `pnpm/npm/node/mvn/gradle` 等，
纯 Java 项目 `mvn test` 与 Node 项目 `pnpm test` 均无需额外授权。

## 1.2 NOT-for 边界

- 调试（复现→根因→修复循环）→ 用 `venus_tr_impl_debug`
- 未识别语言/框架 → 输出检测结果并建议用户指定，或默认输出最接近风格代码

---

# 2. 定位与触发

- **斜杠命令**：`/venus:tr-test-generate`
- **description**：生成测试。为新功能或已有代码编写测试用例、补充测试覆盖。多 schema 模式：自动检测 Java（Maven/Gradle）或 Node（Vitest/Jest/Mocha）项目，加载对应框架模板
- **allowed-tools**：`Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(npm:*), Bash(node:*), Bash(mvn:*), Bash(gradle:*), Bash(mkdir:*), Bash(ls:*), Bash(find:*), Bash(cat:*), Bash(cp:*)`
- **compatibility**：无特殊依赖，通用环境可用。多 schema 自动适配：Java（Maven/Gradle + JUnit4/5/Mockito/EasyMock/AssertJ）与 Node（Vitest/Jest/Mocha/Jasmine）
- **version**：3.0（多 schema 模式 + 五阶段结构化流程 + BCDE 场景矩阵法）

## 2.1 输入

| 输入项 | 必填 | 说明 |
| :--- | :--- | :--- |
| 被测目标 | **是** | 方法 / 类 / 模块 |
| 测试范围 | 否 | 未指定时列出方法清单请用户确认 |

---

# 3. 五阶段流程详解

```
阶段一  语言与框架检测（schema 路由）
   ├─ 检测 pom.xml / build.gradle → Java，Read references/schema-java.md
   ├─ 检测 package.json → Node，Read references/schema-node.md
   │   （Node schema 内按优先级检测：Vitest → Jest → Mocha → Jasmine）
   ├─ schema 索引表：子文件 / 适用项目 / 包含内容 / 何时 Read
   └─ 既有测试风格对齐：读 1-2 个已有测试文件，了解项目的命名风格、
       注释习惯、断言方式（业务场景式 getUserById_userNotFound_throwsException
       或行为驱动式 should_throw_exception_when_user_not_exists）
   ⚠ 未识别语言 → 输出检测结果并建议用户指定框架，或默认输出最接近风格代码
   │
   ▼
阶段二  场景设计（BCDE 场景矩阵法，详见第 4 章）
   └─ 对每个被测方法按 Basic/Boundary/Design/Exception 四象限设计场景
   │
   ▼
阶段三  分层测试策略（详见第 5 章）
   └─ 按被测对象层次（Service / Controller / Utils）采用不同测试策略
      （具体框架 Mock API 与代码示例见已加载的 schema-*.md）
   │
   ▼
阶段四  测试代码生成
   ├─ 命名规范：测试类 = 被测类名 + Test；
   │   测试方法 = 业务场景式 或 行为驱动式（二选一，与项目现有风格一致）
   ├─ AAA / Given-When-Then 结构（强制）：
   │   // Given: 准备测试数据 + Mock 外部依赖
   │   // When: 执行被测方法
   │   // Then: 断言结果 + 验证依赖交互
   ├─ 断言规范：
   │   禁止日志替代断言 / 禁止只判存在不做具体字段校验 /
   │   禁止在断言中使用循环、条件判断等逻辑 /
   │   异常断言使用框架对应 API（见 schema） / 推荐精确断言
   ├─ 一个测试只验证一个业务行为
   └─ Java 项目生成前执行测试计划确认门（schema-java.md J5.3）
      （框架专属模板：Java 模板 A-F、Node vi.mock 示例，见 schema-*.md）
   │
   ▼
阶段五  运行与验证
   ├─ 运行：Java → mvn test / gradle test；Node → pnpm test -- <文件> 或 pnpm test / npm test
   ├─ 全部通过 → 报告 ✅ N/M tests passed
   └─ 失败时先区分（见 6.4 示例）：
       ① 测试代码写错 → 修正后重新运行
       ② 被测代码有 bug → 说明具体情况，给出修复建议，衔接 /venus:tr-impl-feature
```

---

# 4. BCDE 场景矩阵法

对每个被测方法，按 **BCDE（Basic / Boundary / Design / Exception）四象限矩阵**设计场景：

| 场景类型 | 测试目标 | 示例 |
| :--- | :--- | :--- |
| **B**asic（正常路径） | 核心业务逻辑按预期工作 | 合法输入返回正确结果 |
| **B**oundary（边界条件） | 临界值 / 极限条件下的表现 | Null、空值、0、负数、极大值 |
| **D**esign（业务规则） | 业务约束和规则被遵守 | 状态机流转、幂等性、并发控制 |
| **E**xception（异常路径） | 非法输入 / 依赖故障的处理 | 参数校验失败、依赖服务不可用 |

## 4.1 场景矩阵模板

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

## 4.2 场景数量要求（每个方法至少覆盖）

- 1-2 个正常路径（Happy Path）
- 2-3 个边界条件（Null、空值、极值、临界值）
- 1-2 个业务规则（如涉及状态机 / 幂等 / 并发）
- 1-2 个异常路径（非法入参、依赖失败）

> 技能未显式声明覆盖率百分比目标——**以 BCDE 四类场景完整性替代覆盖率指标**。

---

# 5. 分层测试策略

根据被测对象的层次，采用不同的测试策略：

| 层次 | 测试目标 | Mock 范围 | 核心技术 |
| :--- | :--- | :--- | :--- |
| **Service / 业务逻辑层** | 业务规则、分支逻辑、异常处理 | DAO/Repository、外部服务、缓存、消息队列 | Vitest 的 `vi.mock()` / `vi.spyOn()` 隔离外部依赖；验证返回结果 + 依赖调用次数与入参 |
| **Controller / 接口层** | 请求映射、参数校验、响应格式、权限拦截 | 所有 Service 依赖 | SuperTest（HTTP）或 mock 请求/响应对象 |
| **工具类 / Utils** | 输入输出正确性，覆盖所有边界场景 | 一般无需 Mock，直接测试 | 大量使用参数化测试减少重复代码 |

Service 层测试示例（AAA 结构）：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/user-repository');

describe('UserService', () => {
    it('should_return_user_when_query_by_valid_id', async () => {
        // Given: 准备测试数据 + Mock 外部依赖
        const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
        vi.mocked(findById).mockResolvedValue(mockUser);

        // When: 执行被测方法
        const result = await userService.getUserById(1);

        // Then: 断言返回结果 + 验证交互
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

---

# 6. 调用示例

以下示例均为示意（假设 TypeScript + Vitest 项目）。

## 示例 1：为指定方法生成测试（最小调用）

```
用户：/venus:tr-test-generate 给 src/utils/paginator.ts 的 calculateOffset 方法写测试
```

流程：检测到 `vitest` 依赖（Vitest）→ 读 1-2 个已有测试对齐风格 → 对 `calculateOffset`
设计 BCDE 矩阵 → 生成 `src/utils/__tests__/paginator.test.ts`（参数化测试为主，工具类无需
Mock）→ 运行 `pnpm test -- src/utils/__tests__/paginator.test.ts` → 报告通过率。

## 示例 2：未指定范围时的方法清单确认

```
用户：/venus:tr-test-generate 给 UserService 写测试
AI：UserService 共 8 个公开方法：
     1. getUserById      5. resetPassword
     2. createUser       6. lockAccount
     3. updateUser       7. unlockAccount
     4. deleteUser       8. listByCondition
     请确认测试范围：[全部 8 个] [仅核心 4 个（1-4）] [自定义]
用户：仅核心 4 个
```

## 示例 3：目标驱动——修 bug 先写复现测试

```
用户：/venus:tr-test-generate calculateOffset 在页码超出总页数时返回负偏移，
      先写复现测试再修
```

流程：先写 `should_return_zero_offset_when_page_exceeds_total`（断言期望行为——
当前实际为负数，**测试应 FAIL**）→ 报告失败详情并给出修复建议 → 衔接
`/venus:tr-impl-feature` 修复被测代码 → 重跑测试确认 PASS。

## 示例 4：运行失败时的区分（阶段五）

```
AI：运行结果 7/9 通过，2 个失败：
     ✗ should_return_empty_when_page_exceeds_total —— 期望 [] 实际 undefined
     ✗ should_throw_when_page_size_zero —— 未抛出异常
     判断：
       #1 被测代码 bug：页码越界分支未处理（paginator.ts:34）
       #2 测试代码写错：断言类型不匹配（应断言 toThrow(TypeError)）
     #2 已修正重跑；#1 属被测代码问题——修复建议：越界时 clamp 到最后一页并返回空数组。
     是否衔接 /venus:tr-impl-feature 修复？
用户：是，衔接修复
```

区分原则：**先判断"测试写错"还是"代码有 bug"**——测试写错则修正测试重跑；
代码有 bug 则说明情况、给出修复建议、衔接 `/venus:tr-impl-feature`，
**不修改被测代码迁就测试**（除非确有 bug 且说明）。

---

# 7. 反模式清单与强制约束

## 7.1 常见反模式（禁止）

| 反模式 | 危害 | 正确做法 |
| :--- | :--- | :--- |
| 无断言空转测试 | 执行即通过，无法发现逻辑错误 | 每个测试必须有明确断言 |
| 测试间共享可变状态 | 执行顺序影响结果 | `beforeEach` 重置状态，每个用例自行构造数据 |
| `console.log()` 替代断言 | 无法自动验证 | 所有预期结果使用断言自动验证 |
| 测试方法中写循环/条件 | 测试本身可能有 Bug | 用参数化测试替代 |
| 命名模糊（`test1`） | 失败后无法快速定位 | 场景化命名，见名知意 |

## 7.2 强制约束

- 禁止修改被测代码来迁就测试
- 禁止 Mock 值对象、实体类、简单工具类
- 测试数据构造集中管理，避免重复字面量
- 不依赖执行顺序、不依赖外部状态；测试必须可重复（任意环境、任意次数执行结果稳定）
- 一个测试只验证一个业务行为
- 外部依赖（数据库 / Redis / MQ）使用 mock，不在单测中直连真实环境
- 禁止使用 `@Disabled` / `it.skip` 长期跳过测试（临时跳过必须标注原因和修复时间）
- 测试代码与生产代码遵循同等质量标准（无魔法值、无重复代码、命名规范）

---

# 8. 常见问题与限制

| 场景 | 行为 |
| :--- | :--- |
| 找不到测试框架（package.json 无 vitest/jest/mocha/jasmine） | 输出提示并建议用户指定框架，或默认输出 Vitest 风格代码 |
| 项目无既有测试（无风格可对齐） | 按 SKILL 默认风格生成（行为驱动式命名 + AAA 结构） |
| 纯 Maven/Gradle 项目 | 检测到 `pom.xml`/`build.gradle` 自动加载 schema-java.md；`mvn test` / `gradle test` 已在预授权范围，无需额外授权 |
| 覆盖率目标 | 未显式声明百分比目标，以 BCDE 四类场景完整性替代 |
| 被测代码有 bug | 不修改被测代码迁就测试——说明情况、给修复建议、衔接 `/venus:tr-impl-feature`（确有 bug 且说明的情况除外） |
| 测试失败 | 先区分"测试代码写错"（修正重跑）与"被测代码 bug"（衔接修复），绝不静默跳过 |

---

*本文档基于 `skills/venus_tr_test_generate/SKILL.md` 静态快照编写；
技能行为以 SKILL.md 实际内容为准。*

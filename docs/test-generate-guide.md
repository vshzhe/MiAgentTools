# 测试生成技能使用说明（test_generate 多 schema 模式）

> 适用技能：venus_tr_test_generate（version 3.0，多 schema 模式）
> 文档日期：2026-09-16
> 依据：`skills/venus_tr_test_generate/SKILL.md` + `references/schema-java.md` + `references/schema-node.md` 静态快照原文
> 配套文档：[skills-manual.md](skills-manual.md)（全技能总说明书）

---

## 目录

1. [技能定位与多 schema 架构](#1-技能定位与多-schema-架构)
2. [定位与触发](#2-定位与触发)
3. [五阶段流程详解](#3-五阶段流程详解)
4. [BCDE 场景矩阵法](#4-bcde-场景矩阵法)
5. [分层测试策略（双语言对照）](#5-分层测试策略双语言对照)
6. [Java 专项（schema-java.md）](#6-java-专项schema-javamd)
7. [调用示例](#7-调用示例)
8. [反模式清单与强制约束](#8-反模式清单与强制约束)
9. [常见问题与限制](#9-常见问题与限制)

---

# 1. 技能定位与多 schema 架构

test_generate 是**多 schema 测试生成技能**——结构化全流程：检测语言/框架 → 加载对应 schema →
设计场景 → 分层编写 → 运行验证。目标驱动：**先把验收标准变成可执行的测试，再让它通过**。

- "添加校验" → "先写非法输入的测试，再让它通过"
- "修 bug" → "先写复现该 bug 的测试，再修复"

## 1.1 多 schema 架构（v3.0 合并）

v3.0 将原 `venus_tr_test_generate`（TS 专属）与 `venus_tr_test_gentest_java`（Java 专属，
独立 `tr_test_gentest` 类型）合并为单一技能的多 schema 模式：

- **主 SKILL 语言无关**：承载通用流程（语言检测路由 + BCDE 场景矩阵 + 通用编写规范 + 反模式清单）
- **语言/框架专属内容**拆为 `references/schema-*.md`，按检测结果按需 Read 加载，避免单文件上下文膨胀
- **新语言扩展** = 新增一个 schema 文件 + 主 SKILL 路由表加一行
- **allowed-tools 并集预授权** `pnpm/npm/node/mvn/gradle` 等，纯 Java 项目 `mvn test` 与 Node 项目
  `pnpm test` 均无需额外授权

## 1.2 schema 索引表（按检测结果 Read 对应子文件）

| 子文件 | 适用项目 | 包含内容 | 何时 Read |
| :--- | :--- | :--- | :--- |
| `references/schema-java.md` | Java（Maven/Gradle，Spring Boot/MVC/传统Web/纯Java） | 框架类型判定、测试依赖分析报告、7 级测试位置扫描、模板 A-F（JUnit4/5+Mockito/EasyMock/@WebMvcTest/参数化/遗留 XML）、遗留代码测试策略、mvn/gradle 命令、Java 专属约束 | 检测到 `pom.xml` 或 `build.gradle` |
| `references/schema-node.md` | Node/TS（Vitest/Jest/Mocha/Jasmine） | 框架检测细节、Mock 方式（vi.mock/jest.mock）、分层测试 TS 示例（Service/Controller/Utils）、pnpm/npm 命令、Node 专属约束 | 检测到 `package.json` |

> 子文件路径相对技能目录（如 `.claude/skills/venus_tr_test_generate/references/schema-java.md`）。
> 加载后结合主 SKILL 的通用流程执行后续阶段。

## 1.3 选择决策与 NOT-for

| 你的需求 | 用哪个技能 |
| :--- | :--- |
| Java 项目生成 JUnit/Mockito 单元测试 | `venus_tr_test_generate`（自动加载 schema-java.md） |
| 前端 / Node.js / 通用项目（Vitest/Jest/Mocha） | `venus_tr_test_generate`（自动加载 schema-node.md） |
| Java 遗留项目（静态方法耦合、system scope 依赖、JDK 8） | `venus_tr_test_generate`（schema-java.md J7 遗留策略） |
| 修 bug 前先写复现测试 | `venus_tr_test_generate`（目标驱动模式，语言无关） |
| 调试工作流（复现→根因→修复→回归） | `venus_tr_impl_debug`（完整调试循环） |

**NOT-for 边界**：

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
   │   （schema-java 内：J1 项目类型判定 → J3 现有测试风格 → J4 框架分析报告）
   ├─ 检测 package.json → Node，Read references/schema-node.md
   │   （schema-node 内：N1 按优先级检测 Vitest → Jest → Mocha → Jasmine）
   ├─ 既有测试风格对齐：读 1-2 个已有测试文件，了解命名/注释/断言方式
   │   （业务场景式 getUserById_userNotFound_throwsException
   │    或行为驱动式 should_throw_exception_when_user_not_exists）
   └─ ⚠ 未识别语言 → 输出检测结果并建议用户指定，或默认输出最接近风格代码
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
阶段四  测试代码生成（通用规范）
   ├─ 命名：测试类 = 被测类名 + Test；方法 = 业务场景式 或 行为驱动式（与项目一致）
   ├─ AAA / Given-When-Then 结构（强制）
   ├─ 断言规范：禁止日志替代断言 / 禁止只判存在不校验字段 /
   │   禁止断言中循环条件 / 异常用框架对应 API（见 schema）/ 推荐精确断言
   ├─ 一个测试只验证一个业务行为
   └─ Java 项目生成前执行测试计划确认门（schema-java.md J5.3）
      （框架专属模板：Java 模板 A-F、Node vi.mock 示例，见 schema-*.md）
   │
   ▼
阶段五  运行与验证
   ├─ 运行：Java → mvn test / gradle test；Node → pnpm test / npm test（命令见 schema）
   ├─ 全部通过 → 报告 ✅ N/M tests passed
   └─ 失败时先区分（见 7.4 示例）：
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
| TC002 | B | 参数为 null | 抛出参数校验异常 |
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

# 5. 分层测试策略（双语言对照）

根据被测对象的层次，采用不同的测试策略；下表为通用策略，右侧给出 Java/Node 两种语言的
Mock API 与核心做法对照（代码示例见对应 schema-*.md）：

| 层次 | 测试目标 | Mock 范围 | Java（schema-java.md） | Node（schema-node.md） |
| :--- | :--- | :--- | :--- | :--- |
| **Service / 业务逻辑层** | 业务规则、分支逻辑、异常处理 | DAO/Repository、外部服务、缓存、消息队列 | `@Mock` + `@InjectMocks` + `when()`；`verify()` 验证调用次数入参（模板 A/B） | `vi.mock()` / `vi.spyOn()` 隔离；`toHaveBeenCalledWith()` 验证交互 |
| **Controller / 接口层** | 请求映射、参数校验、响应格式、权限拦截 | 所有 Service 依赖 | `@WebMvcTest` + `MockMvc` 端到端（模板 D） | SuperTest（HTTP）或 mock 请求/响应对象 |
| **工具类 / Utils** | 输入输出正确性，覆盖所有边界场景 | 一般无需 Mock，直接测试 | JUnit 4 `@Parameterized` / JUnit 5 `@ParameterizedTest`（模板 E） | `it.each()` 参数化测试 |

**通用核心验证**（两种语言一致）：返回结果正确性 + 依赖调用次数与入参验证 + 异常分支覆盖。

---

# 6. Java 专项（schema-java.md）

检测到 `pom.xml` 或 `build.gradle` 时加载 schema-java.md，承载 Java 专属的检测、模板、位置
扫描与遗留策略。以下为关键要点，完整内容见 schema 文件。

## 6.1 项目类型判定（J1）

| 检测特征 | 项目类型 | 测试策略 |
| :--- | :--- | :--- |
| `spring-boot-starter-parent` / `spring-boot-starter-web` | Spring Boot | `spring-boot-starter-test`，支持切片测试 |
| `spring-webmvc` / `spring-orm`（无 starter） | 传统 Spring MVC | 可能 XML 配置，需 Spring Test（模板 F） |
| `struts2-core` / `jfinal` | 传统 Web | 纯 JUnit，手动 Mock |
| 无 Web 框架特征 | 纯 Java 工具 | 无需 Mock，直接测试 |
| 源码在 `src/` 根（非 `src/main/java`） | 非标准 Maven | 调整测试路径 |

## 6.2 测试计划：7 级位置扫描 + 确认门（J5）

**J5.1 测试范围与优先级**：Service 层 P0（核心业务/高复杂度）→ Controller 层 P1 → 工具类 P2。

**J5.2 7 级测试位置扫描**（自动推荐最优测试文件放置位置）：

| 优先级 | 检测目标 | 命中规则 |
| :--- | :--- | :--- |
| 1 | `src/test/java/` | 标准 Maven |
| 2 | `*/src/test/java` | Gradle 多模块 |
| 3 | `*/test/*Test*.java` | 非标准 |
| 4 | `test/` | 传统 Eclipse |
| 5 | `*/src/*test*` | 其他 |
| 6 | `tests/` | 纯测试目录 |
| 7 | 已有测试文件最多的目录 | 跟随项目惯例 |

推荐规则：标准 Maven → `src/test/java` + 同包路径；非标准 → 跟随被测包路径。

**J5.3 计划确认门**（Java 项目必经，genfull 的 Stage 3.3 桥梁点）——必须将测试计划展示给
用户确认后才开始生成代码：

```markdown
## 📋 待确认：测试计划

| 被测类 | 计划方法数 | 覆盖场景 | 依赖 |
|--------|----------|---------|------|
| UserService | 8 | 正常3+边界3+异常2 | UserDao, RedisService |

### 测试风格对齐
- 框架：JUnit 4 + Mockito（与项目现有风格一致）
- Mock 初始化：MockitoAnnotations.initMocks(this)
- 命名风格：should_xxx_when_xxx（行为驱动式）

### 📁 生成位置
推荐位置 → src/test/java/cn/com/venustech/user/service/UserServiceTest.java

👉 回复"确认"后开始生成代码。
```

## 6.3 模板选择逻辑（J6）

| 项目类型 | 测试框架 | 选用模板 |
| :--- | :--- | :--- |
| Spring Boot 2.2+ / JUnit 5 | Mockito + AssertJ | **模板 B**（JUnit 5 @ExtendWith） |
| Spring Boot 2.1.x / JUnit 4 | Mockito | **模板 A**（JUnit 4 @RunWith） |
| 传统 Spring MVC | JUnit 4 + Mockito | **模板 A + F** |
| 传统 Spring MVC | EasyMock | **模板 C + F** |
| 纯 Java 项目 | JUnit 4/5 | **模板 A/B + E** |

6 个模板（A: JUnit4+Mockito / B: JUnit5+Mockito+AssertJ / C: JUnit4+EasyMock 遗留 /
D: @WebMvcTest Controller / E: 参数化 / F: 传统 Spring XML），完整代码见 schema-java.md。

## 6.4 遗留 Java 代码测试策略（J7）

当被测代码存在可测试性障碍时，采用对应策略——**核心原则：能测多少测多少，参数校验和
异常分支是基本盘**：

| 障碍类型 | 典型特征 | 应对策略 |
| :--- | :--- | :--- |
| 静态方法耦合 | `AppDao.getXxx()` 等静态调用 | 优先测试不依赖静态方法的参数校验/异常分支 |
| 方法内 new 对象 | `new CallService()` 在方法内 | 只测试参数校验逻辑，建议重构为构造注入 |
| 构造函数调数据库 | 构造函数中执行 `AppDao.getXxx()` | `@BeforeClass` + 反射预设静态字段 |
| 超大类（>1000 行） | 一个类大量不相关方法 | 按功能分组 `@Nested`，优先 public 方法 |
| system scope 依赖 | `<scope>system</scope>` | 以注释方式提供标准 Maven 依赖配置 |

## 6.5 Java 专属约束（J9）

- 禁止通配符 `*` 导入
- 禁止 `@Test(expected=...)` 做异常断言（改用 `assertThrows()` / `assertThatThrownBy()`）
- 禁止 `System.out.println()` 代替断言
- 加分：`@DisplayName` 可读报告 / `verify` 验证调用 / 参数化测试 / 时间逻辑注入 `Clock` /
  Builder 或工厂方法构造测试数据

---

# 7. 调用示例

以下示例均为示意。

## 7.1 Node 项目：为指定方法生成测试（最小调用）

```
用户：/venus:tr-test-generate 给 src/utils/paginator.ts 的 calculateOffset 方法写测试
```

流程：检测 `package.json` → 加载 schema-node.md → 检测到 `vitest` 依赖 → 读 1-2 个已有测试
对齐风格 → 对 `calculateOffset` 设计 BCDE 矩阵 → 生成 `src/utils/__tests__/paginator.test.ts`
（参数化测试为主，工具类无需 Mock）→ 运行 `pnpm test -- src/utils/__tests__/paginator.test.ts`
→ 报告通过率。

## 7.2 Java 项目：Service 层测试（触发 J5.3 确认门）

```
用户：/venus:tr-test-generate 给 UserServiceImpl 写单元测试
```

流程：检测 `pom.xml` → 加载 schema-java.md → J1 判定 Spring Boot 项目 → J3 读已有测试
发现 JUnit 4 + Mockito 风格 → J4 框架分析报告（Mockito 可用、AssertJ 缺失建议添加）→
J5.1 任务矩阵（UserServiceImpl 8 方法，P0）→ J5.2 7 级扫描定位 `src/test/java/.../` →

```
AI：## 📋 待确认：测试计划（J5.3）
     | 被测类 | 计划方法数 | 覆盖场景 | 依赖 |
     | UserServiceImpl | 8 | 正常3+边界3+异常2 | UserDao, RedisService |
     框架：JUnit 4 + Mockito（与项目现有风格一致）
     生成位置：src/test/java/cn/com/venustech/user/service/UserServiceImplTest.java
     👉 回复"确认"后开始生成代码。
用户：确认
```

→ J6 模板选择（Spring Boot 2.1.x + JUnit 4 → 模板 A）→ 生成代码 → `mvn test -Dtest=UserServiceImplTest`
→ 结果报告（生成类/用例/覆盖方法/通过率 + 文件清单）。

## 7.3 未指定范围时的方法清单确认

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

## 7.4 目标驱动——修 bug 先写复现测试

```
用户：/venus:tr-test-generate calculateOffset 在页码超出总页数时返回负偏移，
      先写复现测试再修
```

流程：先写 `should_return_zero_offset_when_page_exceeds_total`（断言期望行为——当前实际
为负数，**测试应 FAIL**）→ 报告失败详情并给出修复建议 → 衔接 `/venus:tr-impl-feature`
修复被测代码 → 重跑测试确认 PASS。

## 7.5 运行失败时的区分（阶段五）

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

区分原则：**先判断"测试写错"还是"代码有 bug"**——测试写错则修正测试重跑；代码有 bug 则
说明情况、给出修复建议、衔接 `/venus:tr-impl-feature`，**不修改被测代码迁就测试**
（除非确有 bug 且说明）。

---

# 8. 反模式清单与强制约束

## 8.1 常见反模式（禁止，语言无关）

| 反模式 | 危害 | 正确做法 |
| :--- | :--- | :--- |
| 无断言空转测试 | 执行即通过，无法发现逻辑错误 | 每个测试必须有明确断言 |
| 测试间共享可变状态 | 执行顺序影响结果 | 每用例前重置状态，每个用例自行构造数据 |
| 日志替代断言（`console.log()` / `System.out.println()`） | 无法自动验证 | 所有预期结果使用断言自动验证 |
| 测试方法中写循环/条件 | 测试本身可能有 Bug | 用参数化测试替代 |
| 命名模糊（`test1`） | 失败后无法快速定位 | 场景化命名，见名知意 |

## 8.2 强制约束（语言无关）

- 禁止修改被测代码来迁就测试
- 禁止 Mock 值对象、实体类、简单工具类
- 测试数据构造集中管理，避免重复字面量
- 不依赖执行顺序、不依赖外部状态；测试必须可重复（任意环境、任意次数执行结果稳定）
- 一个测试只验证一个业务行为
- 外部依赖（数据库 / Redis / MQ）使用 mock，不在单测中直连真实环境
- 禁止长期跳过测试（`@Disabled` / `it.skip`，临时跳过必须标注原因和修复时间）
- 测试代码与生产代码遵循同等质量标准（无魔法值、无重复代码、命名规范）

## 8.3 语言专属约束

| 语言 | 专属约束 |
| :--- | :--- |
| Java（schema-java.md J9） | 禁止通配符 `*` 导入 / 禁止 `@Test(expected=...)` 异常断言 / 异常用 `assertThrows()` 或 `assertThatThrownBy()` |
| Node（schema-node.md N4） | `vi.mock()` / `jest.mock()` 工厂函数必须提升到文件顶部（hoisting），不可放在条件分支内 / 异常用 `rejects.toThrow()`（异步）或 `toThrow()`（同步） |

---

# 9. 常见问题与限制

| 场景 | 行为 |
| :--- | :--- |
| 未识别语言（无 pom.xml / build.gradle / package.json） | 输出检测结果并建议用户指定框架，或默认输出与项目最接近的风格代码 |
| 找不到 Node 测试框架（package.json 无 vitest/jest/mocha/jasmine） | 输出提示并建议用户指定框架，或默认输出 Vitest 风格代码 |
| 项目无既有测试（无风格可对齐） | 按 SKILL 默认风格生成（行为驱动式命名 + AAA 结构） |
| Java：system scope 依赖 | 检查 `pom.xml` 中 `lib/` 目录；测试代码以注释方式提供标准 Maven 依赖配置 |
| Java：Mockito 版本冲突 | Spring Boot 内置版本不匹配 → `mvn dependency:tree` 查看版本 |
| Java：JUnit 4 与 5 共存 | Spring Boot 2.2+ 需排除 `junit-vintage-engine` |
| Java：Java 8 兼容 | 测试使用 Java 9+ API 时确保测试代码 JDK 8 兼容 |
| 覆盖率目标 | 未显式声明百分比目标，以 BCDE 四类场景完整性替代 |
| 被测代码有 bug | 不修改被测代码迁就测试——说明情况、给修复建议、衔接 `/venus:tr-impl-feature`（确有 bug 且说明的情况除外） |
| 测试失败 | 先区分"测试代码写错"（修正重跑）与"被测代码 bug"（衔接修复），绝不静默跳过 |

---

*本文档基于 `skills/venus_tr_test_generate/SKILL.md` + `references/schema-java.md` +
`references/schema-node.md` 静态快照编写；技能行为以 SKILL.md 与 schema 文件实际内容为准。*

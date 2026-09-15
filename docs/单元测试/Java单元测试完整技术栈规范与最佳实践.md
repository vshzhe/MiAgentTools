# Java 单元测试完整技术栈规范与最佳实践

> 版本：v1.0 适用场景：Java 后端项目单元测试体系建设、团队编码规范落地、Skill 能力底座 核心目标：统一技术栈、规范编写标准、提升测试质量、保障代码可维护性

------

## 1. 文档说明

### 1.1 目的

本文档定义 Java 生态下单元测试的完整技术栈选型、编写标准、设计原则、分层实践与验收标准，为团队提供可落地、可复制的单元测试作业指导，同时作为自动化 Skill 能力的知识基准。

### 1.2 适用范围

- 所有 Java 8 及以上版本的后端业务项目
- Spring Boot / Spring 全家桶项目、普通 Java 工具类项目
- 单元测试、组件级单元测试场景
- 代码评审、CI 流水线门禁、测试质量度量

### 1.3 术语定义

表格

| 术语       | 定义                                                         |
| ---------- | ------------------------------------------------------------ |
| 单元测试   | 针对最小可测试单元（单个类 / 方法）的逻辑验证，隔离所有外部依赖 |
| Mock       | 模拟外部依赖的行为与返回值，仅验证被测单元自身逻辑           |
| Stub       | 仅模拟返回值，不验证交互的模拟对象                           |
| 代码覆盖率 | 被测代码被测试用例执行的比例，分行、分支、类覆盖率           |
| 变异测试   | 通过篡改业务代码验证测试用例有效性的质量评估手段             |

------

## 2. 技术栈选型规范

### 2.1 核心测试框架

表格

| 技术选型              | 版本要求 | 选型理由                                                     | 适用场景             |
| --------------------- | -------- | ------------------------------------------------------------ | -------------------- |
| **JUnit 5 (Jupiter)** | ≥ 5.9.0  | Java 生态标准测试框架，Spring Boot 2.2+ 默认集成；支持嵌套测试、参数化测试、扩展模型、条件执行，全面替代 JUnit 4 | 所有单元测试基础框架 |

> ❌ 禁用：JUnit 4（老旧无维护，逐步全量迁移至 JUnit 5）

### 2.2 断言增强库

表格

| 技术选型    | 版本要求 | 选型理由                                                     | 适用场景               |
| ----------- | -------- | ------------------------------------------------------------ | ---------------------- |
| **AssertJ** | ≥ 3.24.0 | 流式链式断言 API，可读性远高于 JUnit 原生断言；支持对象、集合、字符串、异常、时间、数值等全类型断言 | 所有测试场景的结果断言 |

> ✅ 强制要求：所有单元测试统一使用 AssertJ 断言，禁止使用 JUnit 原生 `Assert.assertEquals`

### 2.3 Mock 框架

表格

| 技术选型           | 版本要求 | 选型理由                                                     | 适用场景                         |
| ------------------ | -------- | ------------------------------------------------------------ | -------------------------------- |
| **Mockito Core**   | ≥ 4.11.0 | Java 生态最主流 Mock 工具，性能优异、API 简洁，与 Spring 生态深度集成 | 普通 Bean、接口依赖的 Mock       |
| **Mockito Inline** | ≥ 4.11.0 | 扩展 Mockito 能力，支持静态方法、私有方法、构造函数、Final 类的 Mock | 复杂场景下的静态 / 构造方法 Mock |

> ❌ 不推荐：PowerMock（维护停滞、与 JUnit 5 兼容性差、侵入性强；优先通过代码重构 + Mockito-inline 替代）

### 2.4 测试增强组件

表格

| 技术选型             | 用途                                               |
| -------------------- | -------------------------------------------------- |
| `@Nested`            | 测试类内部分组，按业务场景组织测试用例，提升可读性 |
| `@DisplayName`       | 自定义测试用例显示名称，优化测试报告可读性         |
| `@ParameterizedTest` | 参数化测试，多组输入复用同一测试逻辑，减少重复代码 |

### 2.5 质量度量工具

表格

| 技术选型   | 版本要求 | 用途                                                         |
| ---------- | -------- | ------------------------------------------------------------ |
| **JaCoCo** | ≥ 0.8.10 | 代码覆盖率统计，支持行、分支、类覆盖率；集成 Maven/Gradle 与 CI 流水线 |
| **Pitest** | ≥ 1.14.0 | 变异测试工具，验证测试用例的真实有效性，比单纯覆盖率更能反映测试质量 |

### 2.6 集成测试扩展工具

表格

| 技术选型           | 用途                                                         |
| ------------------ | ------------------------------------------------------------ |
| **Testcontainers** | 通过 Docker 启动真实数据库 / 中间件容器，用于集成测试，替代内存模拟 |
| **WireMock**       | 模拟外部 HTTP 接口，用于依赖第三方服务的测试场景             |
| **MockMvc**        | Spring 官方提供，用于 Controller 层接口测试，无需启动完整容器 |

### 2.7 禁用 / 不推荐清单

1. 禁止使用 PowerMock 作为主力 Mock 工具
2. 禁止在单元测试中使用 Spring 完整上下文启动（集成测试除外）
3. 禁止使用 JUnit 4 编写新的测试用例
4. 禁止使用 `System.out.println` 替代自动断言

------

## 3. 核心编写规范

### 3.1 命名规范

#### 3.1.1 测试类命名

- 规则：`被测试类名 + Test`，统一以 `Test` 结尾
- 示例：`UserService` → `UserServiceTest`、`OrderUtils` → `OrderUtilsTest`
- 路径：与被测试类保持相同包路径，位于 `src/test/java` 目录下

#### 3.1.2 测试方法命名

团队统一选择以下一种格式，禁止混用：

- 格式一（业务场景式）

  ：

  ```
  方法名_场景描述_预期结果
  ```

  - 示例：`login_userNotExists_throwBusinessException`、`getUserById_returnUserInfo_whenIdValid`

- 格式二（行为驱动式）

  ：

  ```
  should_预期行为_when_触发场景
  ```

  - 示例：`should_return_token_when_login_success`、`should_throw_exception_when_param_is_null`

> ❌ 禁止：`test1`、`testMethod`、`testLogin` 等模糊无意义命名

#### 3.1.3 嵌套测试类命名

- 使用 `@Nested` 标注，按业务场景分组，类名描述场景分组
- 示例：`@Nested class LoginSuccessScene {}`、`@Nested class ParamInvalidScene {}`

### 3.2 注解使用规范

#### 3.2.1 基础注解

表格

| 注解          | 使用规则                                                     |
| ------------- | ------------------------------------------------------------ |
| `@Test`       | 标记单元测试方法；**禁止使用 `expected` 属性**，异常场景改用 AssertJ 异常断言 |
| `@BeforeEach` | 每个测试方法执行前的初始化操作，如重置 Mock 状态、构造公共对象 |
| `@AfterEach`  | 每个测试方法执行后的清理操作，如清除 ThreadLocal、临时数据   |
| `@BeforeAll`  | 全局静态资源初始化，必须搭配 `static` 方法；仅用于无状态资源，禁止共享可变状态 |
| `@AfterAll`   | 全局静态资源销毁，必须搭配 `static` 方法                     |

#### 3.2.2 参数化测试注解

- 优先使用 `@ParameterizedTest` 替代多组重复测试代码
- 数据源注解选型：
  - 简单单值：`@ValueSource`
  - 多组键值对：`@CsvSource`
  - 空值 / Null 场景：`@NullSource`、`@EmptySource`、`@NullAndEmptySource`
  - 复杂对象：`@MethodSource`

#### 3.2.3 禁用与跳过注解

- 禁止使用 `@Disabled` 长期跳过测试
- 临时跳过必须标注原因与修复时间：`@Disabled("待修复XX问题，修复截止：202X-XX-XX")`
- 不允许存在无理由永久禁用的测试用例

### 3.3 隔离性规范

1. **用例独立**：每个测试方法完全独立，互不依赖，不允许测试方法之间共享成员变量状态
2. **无顺序依赖**：禁止依赖测试执行顺序，JUnit 5 默认执行顺序不固定，依赖顺序的测试属于脆弱测试
3. **依赖全隔离**：所有外部依赖（DAO、RPC、缓存、消息队列、第三方接口）必须通过 Mock 替换，单元测试禁止连接真实环境
4. **状态重置**：每个测试执行前必须重置 Mock 与公共对象状态，避免上下文污染

### 3.4 可维护性规范

1. 测试代码与业务代码遵循同等代码质量标准，禁止魔法值、重复代码、复杂逻辑
2. 测试数据构造优先使用构造方法、Builder 模式，禁止通过反射强制设置私有字段
3. 公共抽取逻辑控制在最小范围，避免过度封装导致测试逻辑不透明

------

## 4. 测试结构与设计原则

### 4.1 标准三段式结构：Given-When-Then

所有单元测试必须严格遵循 **Given-When-Then** 三段式结构，保证可读性与可维护性：

```
@Test
void should_return_user_info_when_query_by_valid_id() {
    // Given：准备测试数据 + Mock 外部依赖行为
    Long userId = 1L;
    User mockUser = new User(1L, "张三", 18);
    when(userDao.selectById(userId)).thenReturn(mockUser);

    // When：执行被测方法，触发目标逻辑
    User result = userService.getUserById(userId);

    // Then：断言返回结果 + 验证依赖交互
    assertThat(result).isNotNull();
    assertThat(result.getName()).isEqualTo("张三");
    assertThat(result.getAge()).isEqualTo(18);
    verify(userDao, times(1)).selectById(userId);
}
```

- **Given**：预置条件，构造测试入参、模拟外部依赖的返回值
- **When**：执行唯一的被测方法，是测试的核心动作
- **Then**：验证结果正确性，包括返回值断言、依赖交互次数验证

### 4.2 FIRST 核心设计原则

#### 4.2.1 Fast（快速性）

- 单条测试用例执行时间控制在毫秒级
- 不依赖网络、磁盘 IO、数据库、远程服务等外部资源
- 禁止启动完整 Spring 上下文，单元测试仅加载必要组件

#### 4.2.2 Independent（独立性）

- 测试用例之间无任何依赖，任意单独执行结果一致
- 不共享可变成员变量，每个用例自行构造数据
- 不依赖执行顺序，任意顺序执行结果相同

#### 4.2.3 Repeatable（可重复）

- 任意环境、任意次数执行结果稳定一致
- 不依赖时间、随机数、外部系统状态等不稳定因素
- 涉及时间的逻辑使用 Clock 抽象注入，禁止直接调用 `LocalDateTime.now()`

#### 4.2.4 Self-validating（自验证）

- 测试自动判断成功 / 失败，通过断言自动验证
- 禁止人工查看日志、控制台输出判断结果
- 所有预期行为必须有明确的断言校验

#### 4.2.5 Timely（及时性）

- 单元测试与业务代码同步编写、同步提交
- 优先覆盖核心业务逻辑、复杂分支、边界场景
- 代码变更必须同步更新对应测试用例

------

## 5. 分层测试编写指南

### 5.1 Service 业务逻辑层

- **测试目标**：验证业务规则、分支逻辑、异常处理、数据转换的正确性

- **Mock 范围**：DAO/Repository、外部 RPC 服务、缓存、消息队列、配置项

- 核心验证点

  ：

  1. 正常主流程业务逻辑正确性
  2. 所有业务分支、异常分支覆盖
  3. 入参校验、边界值处理
  4. 外部依赖的调用次数、入参正确性

- **最佳实践**：使用 `@ExtendWith(MockitoExtension.class)` 启动 Mock，不启动 Spring 上下文

### 5.2 Controller 接口层

- **测试目标**：验证请求映射、参数校验、响应封装、异常处理、权限拦截的正确性

- **Mock 范围**：所有 Service 层依赖，不 Mock HttpServletRequest/Response

- 核心验证点

  ：

  1. HTTP 状态码正确性
  2. 响应体格式、字段正确性
  3. 参数校验异常（@Valid）的处理
  4. 接口路径、请求方法匹配

- **最佳实践**：使用 `@WebMvcTest` + MockMvc，仅加载 Web 层上下文，执行速度快

### 5.3 工具类 / 方法层

- **测试目标**：验证工具方法的输入输出正确性，覆盖所有边界场景

- **Mock 范围**：无外部依赖，无需 Mock；若工具类依赖其他工具，Mock 直接依赖

- 核心验证点

  ：

  1. 正常输入输出正确性
  2. Null、空值、极值等边界场景
  3. 异常入参的异常抛出逻辑

- **最佳实践**：大量使用参数化测试，减少重复代码

### 5.4 DAO/Repository 数据访问层

- **说明**：纯 SQL 逻辑不建议做单元测试，归为集成测试范畴
- **测试方式**：使用 Testcontainers 启动真实数据库，验证 SQL 正确性
- **禁止**：单元测试中连接真实开发数据库

### 5.5 外部客户端调用层

- **测试目标**：验证请求参数封装、响应解析、异常处理逻辑

- **Mock 范围**：HTTP 客户端、RPC 框架，使用 WireMock 模拟服务端响应

- 核心验证点

  ：

  1. 请求 URL、方法、Header、Body 正确性
  2. 成功响应解析正确性
  3. 超时、异常、错误码的处理逻辑

------

## 6. 工具链集成配置规范

### 6.1 Maven 依赖配置标准

#### Spring Boot 项目（推荐）

`spring-boot-starter-test` 已默认集成 JUnit 5、AssertJ、Mockito、MockMvc，无需额外引入核心依赖：

```
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
```

#### 普通 Java 项目

```
<!-- JUnit 5 核心 -->
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter-api</artifactId>
    <version>5.9.2</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter-engine</artifactId>
    <version>5.9.2</version>
    <scope>test</scope>
</dependency>

<!-- AssertJ 断言 -->
<dependency>
    <groupId>org.assertj</groupId>
    <artifactId>assertj-core</artifactId>
    <version>3.24.2</version>
    <scope>test</scope>
</dependency>

<!-- Mockito -->
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-core</artifactId>
    <version>4.11.0</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-inline</artifactId>
    <version>4.11.0</version>
    <scope>test</scope>
</dependency>
```

### 6.2 JaCoCo 代码覆盖率配置

```
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.10</version>
    <executions>
        <execution>
            <goals>
                <goal>prepare-agent</goal>
                <goal>check</goal>
            </goals>
            <configuration>
                <rules>
                    <rule>
                        <element>BUNDLE</element>
                        <limits>
                            <limit>
                                <counter>LINE</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.80</minimum>
                            </limit>
                            <limit>
                                <counter>BRANCH</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.70</minimum>
                            </limit>
                        </limits>
                    </rule>
                </rules>
            </configuration>
        </execution>
    </executions>
</plugin>
```

### 6.3 Mockito 最佳实践配置

- 开启严格 Stub 检测，避免未使用的 Mock 定义
- 使用 `@Mock`、`@InjectMocks` 注解注入依赖，减少样板代码
- 静态方法 Mock 使用 `try-with-resources` 保证作用域隔离

```
try (MockedStatic<IdGenerator> mocked = mockStatic(IdGenerator.class)) {
    mocked.when(IdGenerator::nextId).thenReturn(1001L);
    // 执行被测逻辑
}
```

------

## 7. 最佳实践准则

### 7.1 用例设计最佳实践

1. **一个测试只验证一个行为**：避免单个方法中断言多个不相关的业务场景
2. **边界值优先覆盖**：重点覆盖 Null、空值、极值、临界值、非法入参等边界场景
3. **等价类划分**：同一类输入仅保留代表性用例，配合参数化测试减少重复
4. **异常场景全覆盖**：业务定义的所有异常分支必须有对应测试用例
5. **核心逻辑优先**：优先覆盖复杂业务、高频变更、高风险代码模块

### 7.2 Mock 最佳实践

1. **只 Mock 直接依赖**：只 Mock 当前类的直接依赖，不要 Mock 数据模型、简单工具类
2. **不 Mock 被测类本身**：禁止 Mock 被测类的方法，需要拆分的优先重构代码
3. **验证交互行为**：关键外部调用必须使用 `verify` 验证调用次数与入参正确性
4. **避免过度 Mock**：简单对象直接构造即可，过度 Mock 会导致测试与真实逻辑脱节
5. **返回合理数据**：Mock 返回值要符合业务语义，不要随意返回 Null 或默认值

### 7.3 断言最佳实践

1. **精准断言**：不仅验证结果不为空，必须断言核心业务字段的取值

2. 异常断言标准化

   ：使用 AssertJ 的 

   ```
   assertThatThrownBy
   ```

    进行异常断言

   ```
   assertThatThrownBy(() -> userService.login(null, "123456"))
       .isInstanceOf(IllegalArgumentException.class)
       .hasMessage("用户名不能为空");
   ```

3. **禁止宽泛断言**：禁止只写 `assertThat(result).isNotNull()` 不校验具体内容

4. **避免逻辑断言**：禁止在断言中使用循环、条件判断等业务逻辑

### 7.4 代码可测试性设计建议

1. **依赖注入**：使用构造注入，禁止硬编码依赖对象，方便 Mock 替换
2. **面向接口编程**：依赖抽象而非具体实现，降低 Mock 成本
3. **单一职责**：类和方法职责单一，避免超大类、超长方法
4. **减少静态方法**：避免滥用静态方法，增加测试难度；工具类优先设计为无状态
5. **分离外部交互**：将业务逻辑与外部调用分离，核心业务逻辑纯函数化
6. **时间抽象**：涉及时间的逻辑注入 Clock 对象，禁止直接获取系统时间

------

## 8. 常见反模式与避坑指南

### 8.1 设计类反模式

表格

| 反模式                                      | 危害                             | 正确做法                                   |
| ------------------------------------------- | -------------------------------- | ------------------------------------------ |
| 单元测试连接真实数据库 / Redis / 第三方接口 | 测试慢、不稳定、依赖环境         | 全部依赖 Mock 替换，集成测试再使用真实环境 |
| 一个测试方法验证多个业务场景                | 失败定位困难，可读性差           | 拆分多个测试方法，每个验证一个行为         |
| 过度 Mock，连简单对象、实体类都 Mock        | 测试与真实逻辑脱节，失去验证意义 | 简单对象直接构造，只 Mock 外部依赖         |

### 8.2 编写类反模式

表格

| 反模式                                   | 危害                             | 正确做法                                  |
| ---------------------------------------- | -------------------------------- | ----------------------------------------- |
| 测试方法包含循环、条件判断等业务逻辑     | 测试本身可能有 Bug，失去测试意义 | 测试逻辑保持简单直白，用参数化替代循环    |
| 测试间共享静态变量或成员变量状态         | 执行顺序影响结果，测试不稳定     | 每个用例独立构造数据，BeforeEach 重置状态 |
| 使用 System.out.println 打印日志代替断言 | 无法自动验证，需要人工核对       | 所有预期结果使用断言自动验证              |
| 测试方法名模糊不清（test1、testMethod）  | 可读性差，失败后无法快速定位问题 | 使用场景化命名，见名知意                  |

### 8.3 工具类反模式

表格

| 反模式                          | 危害                         | 正确做法                           |
| ------------------------------- | ---------------------------- | ---------------------------------- |
| 为了凑覆盖率写无意义的测试      | 浪费精力，无法提升代码质量   | 覆盖率作为参考，优先覆盖核心逻辑   |
| 大量使用 @Disabled 永久跳过测试 | 测试逐渐失效，失去防护作用   | 及时修复失效测试，临时跳过标注期限 |
| 使用反射测试私有方法            | 破坏封装，重构后测试大量失效 | 通过公共方法间接覆盖私有方法逻辑   |

------

## 9. 典型代码示例集

### 9.1 Service 层标准单元测试示例

```
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserDao userDao;

    @InjectMocks
    private UserService userService;

    @Test
    void should_return_user_info_when_query_by_valid_id() {
        // Given
        Long userId = 1L;
        User mockUser = new User(1L, "张三", 18);
        when(userDao.selectById(userId)).thenReturn(mockUser);

        // When
        User result = userService.getUserById(userId);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("张三");
        assertThat(result.getAge()).isEqualTo(18);
        verify(userDao, times(1)).selectById(userId);
    }
}
```

### 9.2 参数化测试示例

```
@ParameterizedTest
@CsvSource({
    "18, true",
    "17, false",
    "120, true",
    "0, false"
})
void should_judge_adult_correctly(int age, boolean expected) {
    // When
    boolean result = UserUtils.isAdult(age);

    // Then
    assertThat(result).isEqualTo(expected);
}
```

### 9.3 异常场景测试示例

```
@Test
void should_throw_exception_when_user_not_exists() {
    // Given
    Long userId = 999L;
    when(userDao.selectById(userId)).thenReturn(null);

    // When + Then
    assertThatThrownBy(() -> userService.getUserById(userId))
        .isInstanceOf(BusinessException.class)
        .hasMessage("用户不存在")
        .hasFieldOrPropertyWithValue("code", "USER_NOT_FOUND");
}
```

### 9.4 Controller 层 MockMvc 测试示例

```
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void should_return_user_info_when_get_by_id() throws Exception {
        // Given
        when(userService.getUserById(1L)).thenReturn(new UserVO(1L, "张三"));

        // When + Then
        mockMvc.perform(get("/api/user/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.name").value("张三"));
    }
}
```

### 9.5 工具类单元测试示例

```
class StringUtilsTest {

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  ", "\t", "\n"})
    void should_return_true_when_string_is_blank(String input) {
        boolean result = StringUtils.isBlank(input);
        assertThat(result).isTrue();
    }

    @Test
    void should_return_false_when_string_has_content() {
        boolean result = StringUtils.isBlank("hello");
        assertThat(result).isFalse();
    }
}
```

------

## 10. 度量与验收标准

### 10.1 覆盖率指标

表格

| 代码类型          | 行覆盖率要求 | 分支覆盖率要求 |
| ----------------- | ------------ | -------------- |
| 核心业务 Service  | ≥ 85%        | ≥ 80%          |
| 通用工具类        | ≥ 80%        | ≥ 75%          |
| Controller 层     | ≥ 70%        | ≥ 60%          |
| 普通配置 / 常量类 | ≥ 50%        | -              |

> 说明：覆盖率为参考指标，禁止为了达标而写无意义测试

### 10.2 测试质量指标

1. 单元测试通过率 100%，不允许存在失败用例
2. 不允许存在无理由永久禁用的测试用例
3. 变异测试得分（可选）：核心代码 ≥ 60%
4. 单条用例执行时间 < 1s，单个测试类执行时间 < 10s

### 10.3 验收红线

1. 核心业务模块覆盖率低于 80%，代码不允许合并
2. 单元测试执行失败，代码不允许合并
3. 存在严重反模式（连接真实环境、无断言、测试逻辑混乱），代码不允许合并
4. 新增核心业务代码未同步编写单元测试，代码不允许合并
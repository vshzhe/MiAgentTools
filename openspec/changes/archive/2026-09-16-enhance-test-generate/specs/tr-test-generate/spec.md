## MODIFIED Requirements

### Requirement: 结构化场景设计方法论

增强版 `venus_tr_test_generate` SHALL 提供 BCDE 场景矩阵法（Basic/Boundary/Design/Exception）作为默认的场景设计方法，覆盖正常路径、边界条件、业务规则、异常分支四种场景类型。

#### Scenario: 用户使用场景矩阵设计用例
- **WHEN** 用户执行 `venus:tr-test-generate` 并指定被测目标
- **THEN** 技能输出 BCDE 场景矩阵模板，针对每个被测方法列出至少 4 种场景类型（正常/边界/设计/异常）

### Requirement: FIRST 原则

增强版 `venus_tr_test_generate` SHALL 遵循 FIRST 原则（Fast/Independent/Repeatable/Self-validating/Timely）约束用例设计。

#### Scenario: 用例质量自检
- **WHEN** 技能生成测试代码
- **THEN** 每用例必须满足 Fast（毫秒级）、Independent（无顺序依赖）、Repeatable（可重复）、Self-validating（自动断言）、Timely（与生产代码同步）

### Requirement: AAA / Given-When-Then 结构

增强版 `venus_tr_test_generate` SHALL 强制使用 AAA（Arrange-Act-Assert）或 Given-When-Then 三段式结构编写测试。

#### Scenario: 结构对齐
- **WHEN** 技能输出测试代码
- **THEN** 代码体现显式的 Given/When/Then 注释标记，且一个方法只验证一个业务行为

### Requirement: 分层测试编写指南

增强版 `venus_tr_test_generate` SHALL 根据被测对象的层次（Service/Controller/Utils）提供不同的测试策略指导。

#### Scenario: Service 层测试
- **WHEN** 被测对象为 Service 类
- **THEN** 技能应用 Mock 隔离外部 DAO 依赖，使用 Vitest 的 `vi.mock()` 或 `vi.spyOn()`

#### Scenario: 工具类层测试
- **WHEN** 被测对象为工具类/Utils
- **THEN** 技能使用参数化测试（Vitest `test.each`），无需 Mock

### Requirement: 项目测试框架检测

增强版 `venus_tr_test_generate` SHALL 在编写测试前自动检测项目使用的测试框架与既有测试风格，保持一致性。

#### Scenario: Vitest 项目
- **WHEN** 检测到 `vitest.config.ts` 或 `package.json` 含 `vitest` 依赖
- **THEN** 使用 Vitest 的 `describe/it/expect` 风格生成测试代码

#### Scenario: Jest 项目
- **WHEN** 检测到 `jest.config` 或 `package.json` 含 `jest` 依赖
- **THEN** 使用 Jest 的 `describe/test/expect` 风格

#### Scenario: 未知框架
- **WHEN** 无法检测到已知测试框架
- **THEN** 输出框架检测失败提示并建议配置方式

### Requirement: 反模式清单

增强版 `venus_tr_test_generate` SHALL 内置常见测试反模式清单，在生成和审查时检出不规范写法。

#### Scenario: 反模式检查
- **WHEN** 技能生成测试或审查已有测试
- **THEN** 检出并提示以下反模式：无断言空转测试、测试间共享可变状态、`console.log` 替代断言、测试方法中写循环/条件逻辑、泛泛命名（`test1`）

## ADDED Requirements

### Requirement: Java 项目框架检测

`venus_tr_test_gentest_java` SHALL 在开始前检测 Java 项目的框架类型（Spring Boot / Spring MVC / 传统 Web / 纯 Java）、构建工具（Maven/Gradle）和 JDK 版本，据以确定测试策略。

#### Scenario: Spring Boot 项目
- **WHEN** 检测到 `spring-boot-starter-parent` 或 `spring-boot-starter-web`
- **THEN** 识别为 Spring Boot 项目，推荐 `spring-boot-starter-test`

#### Scenario: 非 Java 项目
- **WHEN** 未检测到 Java 项目特征（无 `pom.xml` 或 `build.gradle`）
- **THEN** 输出"本项目非 Java 项目，请使用 /venus:tr-test-generate 替代"并退出

### Requirement: Java 测试框架分析报告

`venus_tr_test_gentest_java` SHALL 分析 pom.xml/build.gradle 中的测试依赖（JUnit/Mockito/AssertJ/JaCoCo），输出框架分析报告，记录每个组件的版本、可用状态和升级建议。

#### Scenario: 输出分析报告
- **WHEN** 检测到项目中已有测试依赖
- **THEN** 输出包括组件版本、状态（可用/缺失/可升级）的框架分析报告

#### Scenario: 缺失依赖
- **WHEN** 检测到项目无测试框架依赖
- **THEN** 按 JDK 版本推荐最合适的测试框架组合并输出 Maven/Gradle 依赖代码

### Requirement: 测试计划与场景矩阵

`venus_tr_test_gentest_java` SHALL 在生成测试代码前输出测试计划，包含 BCDE 场景矩阵、被测类与方法范围、优先级评定，待用户确认后方可进入代码生成。

#### Scenario: 测试计划确认
- **WHEN** 场景矩阵设计完成
- **THEN** 输出测试计划（含位置信息、测试风格对齐说明）给用户确认

### Requirement: Java 多层次测试模板

`venus_tr_test_gentest_java` SHALL 根据检测到的项目类型和测试框架提供对应的模板代码，至少覆盖：

- JUnit 4 + Mockito（传统项目）
- JUnit 5 + Mockito（新项目/Spring Boot 2.2+）
- Controller @WebMvcTest 切片测试
- 工具类参数化测试
- 遗留项目 EasyMock 模板

#### Scenario: JUnit 5 项目
- **WHEN** 检测到 JUnit 5（junit-jupiter）依赖
- **THEN** 使用 `@ExtendWith(MockitoExtension.class)`、`@DisplayName` 和 AssertJ 断言生成

#### Scenario: 遗留 JUnit 4 项目
- **WHEN** 检测到仅 JUnit 4 依赖
- **THEN** 使用 `@RunWith(MockitoJUnitRunner.class)` 和 JUnit 4 断言生成

### Requirement: 遗留 Java 代码测试策略

`venus_tr_test_gentest_java` SHALL 提供遗留代码（静态方法耦合、方法内 new 对象、构造函数调数据库等）的专项测试策略。

#### Scenario: 静态方法耦合
- **WHEN** 被测类存在大量 static 方法调用
- **THEN** 优先测试不依赖静态方法的参数校验/异常分支，使用反射绕过静态初始化

### Requirement: 多级测试位置扫描

Java 技能 SHALL 执行 7 级优先级扫描自动推荐最优测试文件放置位置，支持标准 Maven、非标准 Maven、传统 Eclipse、纯 Java 等多种项目结构。

#### Scenario: 标准 Maven 结构
- **WHEN** `src/test/java` 存在
- **THEN** 推荐 `src/test/java` + 与被测类相同包路径

#### Scenario: 非标准 Maven 结构
- **WHEN** 源码在 `src/` 根目录而非 `src/main/java`
- **THEN** 推荐 `src/test/` + 跟随被测包路径

### Requirement: 运行验证与报告

`venus_tr_test_gentest_java` SHALL 在生成代码后自动运行测试（`mvn test -Dtest=...` 或 `gradle test --tests ...`），输出运行结果报告。

#### Scenario: 测试全部通过
- **WHEN** 运行测试后全部通过
- **THEN** 输出通过率、用例数统计

#### Scenario: 测试失败
- **WHEN** 运行测试后存在失败用例
- **THEN** 分析失败原因（测试代码写错 vs 被测代码有 bug），给出修复建议
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

`venus_tr_test_gentest_java` SHALL 执行 7 级优先级扫描自动推荐最优测试文件放置位置。

#### Scenario: 标准 Maven 结构
- **WHEN** `src/test/java` 存在
- **THEN** 推荐 `src/test/java` + 与被测类相同包路径

#### Scenario: 非标准 Maven 结构
- **WHEN** 源码在 `src/` 根目录而非 `src/main/java`
- **THEN** 推荐 `src/test/` + 跟随被测包路径

### Requirement: 运行验证与报告

`venus_tr_test_gentest_java` SHALL 在生成代码后自动运行测试，输出运行结果报告。

#### Scenario: 测试通过
- **WHEN** 运行测试后全部通过
- **THEN** 输出通过率、用例数统计

#### Scenario: 测试失败
- **WHEN** 存在失败用例
- **THEN** 分析原因给出修复建议
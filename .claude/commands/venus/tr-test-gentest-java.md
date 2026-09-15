---
name: "Venus: Java 测试生成"
description: Java 项目单元测试生成 —— 5 阶段全流程：项目检测、框架分析、BCDE 场景矩阵、多模板代码生成、运行验证
allowed-tools: Bash(venus:*)
category: Venus / 测试
tags: [venus, tr_test_gentest, java, junit, mockito]
---

Java 单元测试生成 —— 一站式 5 阶段流程。

**输入**：`/venus:tr-test-gentest-java` 后跟被测类或功能描述。

## 阶段一：项目检测
检测框架类型（Spring Boot / MVC / 传统 Web / 纯 Java）、构建工具（Maven/Gradle）、JDK 版本、源码结构、已有测试风格。

**非 Java 项目检测**：无 pom.xml / build.gradle → 提示"请使用 /venus:tr-test-generate"并退出。

## 阶段二：框架分析
读取 pom.xml / build.gradle 中的测试依赖（JUnit/Mockito/AssertJ/JaCoCo），输出分析报告与升级建议。

## 阶段三：测试计划
生成 BCDE 场景矩阵 + 7 级位置扫描自动推荐最优质测试目录。**待用户确认后**进入代码生成。

## 阶段四：代码生成（多模板自动匹配）
| 项目类型 | 模板 |
|---------|------|
| JUnit 4 + Mockito | @RunWith + @Mock + @InjectMocks |
| JUnit 5 + Mockito | @ExtendWith + AssertJ (@DisplayName) |
| EasyMock 遗留 | @RunWith(EasyMockRunner) |
| Controller | @WebMvcTest + MockMvc |
| 工具类 | @ParameterizedTest |
| 遗留代码 | 优先参数校验/异常分支，反射绕过静态初始化 |

## 阶段五：运行验证
mvn test / gradle test — 全部通过后输出报告；失败时区分测试写错还是代码有 Bug。

## 约束
- 非 Java 项目自动退出
- 禁止无断言空转测试
- 禁止修改被测代码来迁就测试
- 保持与项目现有测试框架和风格一致

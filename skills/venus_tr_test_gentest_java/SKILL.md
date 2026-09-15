---
name: venus_tr_test_gentest_java
description: Java 单元测试生成。为 Java 项目生成 JUnit/Mockito 单元测试，覆盖项目检测、框架分析、BCDE 场景矩阵、多模板代码生成、运行验证全流程。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(mvn:*), Bash(gradle:*), Bash(mkdir:*), Bash(ls:*), Bash(find:*), Bash(cat:*), Bash(cp:*)
license: MIT
compatibility: 需要 Java 项目（Maven/Gradle），自动兼容 JUnit 4/5、Mockito、EasyMock、AssertJ。支持 JDK 8+。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_test_gentest
  generatedBy: "snapshot"
---

Java 单元测试生成 —— 一站式 5 阶段流程：项目检测 → 框架分析 → 测试计划 → 代码生成 → 运行验证。

---

## 阶段一：Java 项目检测

> **目标**：确定项目类型、构建工具、JDK 版本、源码结构和已有测试风格。

### 1.1 检测项目框架类型

```bash
# 检测是否为 Java 项目——无 pom.xml / build.gradle 则提示退出
if [ ! -f "pom.xml" ] && [ ! -f "build.gradle" ]; then
    echo "本项目非 Java 项目（未检测到 pom.xml 或 build.gradle），请使用 /venus:tr-test-generate 替代"
    exit 1
fi

# Maven 项目
grep -q "spring-boot-starter-parent|spring-boot-starter-web" pom.xml 2>/dev/null && echo "spring-boot"
grep -q "spring-webmvc|spring-orm" pom.xml 2>/dev/null && echo "spring-mvc"
grep -q "struts2-core|jfinal" pom.xml 2>/dev/null && echo "traditional-web"

# JDK 版本检测
grep -E "<java.version>|<maven.compiler.source>" pom.xml 2>/dev/null | head -3
grep -E "sourceCompatibility|JavaVersion" build.gradle 2>/dev/null | head -3
```

**项目类型判定表**：

| 检测特征 | 项目类型 | 说明 |
|---------|---------|------|
| `spring-boot-starter-parent` 或 `spring-boot-starter-web` | **Spring Boot 项目** | 使用 `spring-boot-starter-test`，支持切片测试 |
| `spring-webmvc`、`spring-orm` 但无 `spring-boot-starter-*` | **传统 Spring MVC 项目** | 可能使用 XML 配置，需 Spring Test 支持 |
| `struts2-core`、`jfinal` 等非 Spring 框架 | **传统 Web 项目** | 纯 JUnit 测试，手动 Mock |
| 无 Web 框架特征 | **纯 Java 工具项目** | 无需 Mock，直接测试 |
| 源码在 `src/` 根目录而非 `src/main/java` | **非标准 Maven 项目** | 常见于遗留项目，需调整测试路径 |

### 1.2 检测源码结构

```bash
# 标准 Maven 结构
if [ -d "src/main/java" ]; then
    SRC_DIR="src/main/java"
# 非标准结构
elif [ -d "src/cn" ] || [ -d "src/com" ]; then
    SRC_DIR="src"
else
    SRC_DIR=$(find . -name "*.java" -not -path "*/test/*" -not -path "*/target/*" 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
fi

# 统计各层类数
find "$SRC_DIR" -name "*Service*.java" -o -name "*ServiceImpl*.java" 2>/dev/null | wc -l
find "$SRC_DIR" -name "*Controller*.java" 2>/dev/null | wc -l
find "$SRC_DIR" -name "*Util*.java" -o -name "*Utils*.java" -o -name "*Helper*.java" 2>/dev/null | wc -l
# 统计已有测试
find . -name "*Test*.java" -not -path "*/target/*" 2>/dev/null | wc -l
```

### 1.3 检测现有测试风格

当已有测试文件时，**读取 1-2 个**了解项目测试风格：

- 使用框架：JUnit 4（`org.junit.Test`）还是 JUnit 5（`org.junit.jupiter.api`）
- Mock 框架：Mockito（`@Mock`、`when()`）还是 EasyMock（`EasyMock.expect()`）
- Mock 初始化：`@RunWith(MockitoJUnitRunner.class)` 还是 `MockitoAnnotations.initMocks(this)` 还是 `@ExtendWith(MockitoExtension.class)`
- 断言方式：JUnit 原生还是 AssertJ 流式断言

---

## 阶段二：测试框架分析

> **目标**：读取 `pom.xml` 或 `build.gradle` 中的测试依赖，输出分析报告。

### 2.1 读取测试依赖

```bash
# pom.xml — 查找测试相关依赖
grep -A3 "junit|junit-jupiter|mockito|easymock|assertj|jacoco" pom.xml 2>/dev/null | head -30
# build.gradle
grep -i "junit|mockito|easymock|assertj" build.gradle 2>/dev/null | head -20
# system scope - lib/ 目录
ls lib/*junit* lib/*mockito* lib/*easymock* lib/*assertj* 2>/dev/null
```

### 2.2 输出框架分析报告

```markdown
## 📊 测试框架分析报告

### 当前状态
| 组件 | 当前版本 | 状态 |
|------|---------|------|
| JUnit | 4.12 | ✅ 可用 / ⚠️ 可升级到 5.x |
| Mockito | 未检测到 | ❌ 缺失 / ⚠️ 建议添加 |
| AssertJ | 未检测到 | ❌ 缺失 / ⚠️ 建议添加 |
| JaCoCo | 未检测到 | ❌ 缺失 / ⚠️ 建议添加 |

### 本次测试生成策略
- 使用框架：JUnit 4.x（保持项目现有框架）
- Mock 框架：Mockito（如项目无 Mock 框架优先推荐 Mockito）
- 特殊处理：如项目依赖为 `system` scope，测试代码以注释方式提供依赖声明
```

**标准化配置推荐**（缺失依赖时同时输出 Maven/Gradle 代码）：
- JDK 8+ 推荐：JUnit 5 + Mockito + AssertJ + JaCoCo
- 遗留项目推荐：JUnit 4 + Mockito（保持现有框架）

---

## 阶段三：测试计划

> **目标**：生成测试任务矩阵 + BCDE 场景矩阵，**待用户确认后**进入代码生成。

### 3.1 测试范围与优先级

```markdown
## 📋 测试任务矩阵

### Service 层（优先级：最高）
| 类名 | 方法数 已 | 复杂度评估 | 优先级 |
|------|---------|-----------|-------|
| UserServiceImpl | 8 | 高（含事务） | P0 |

### Controller 层（优先级：高）
| 类名 | 已有测试 | 测试策略 |
|------|---------|---------|
| UserController | 无 | @WebMvcTest + MockMvc |

### 工具类（优先级：中）
| 类名 | 方法数 | 测试策略 |
|------|-------|---------|
| StringUtils | 6 | 参数化测试 |
```

优先级标准：**P0**（核心业务/高复杂度）→ **P1**（常规业务）→ **P2**（工具类）

### 3.2 BCDE 场景矩阵设计

对每个被测方法，按 **BCDE（Basic/Boundary/Design/Exception）四象限**设计场景：

| 场景ID | 类型 | 输入条件 | 预期结果 |
|--------|------|---------|---------|
| TC001 | B | 合法参数 | 创建成功，返回订单 ID |
| TC002 | B | 商品数量为 0 | 抛出 IllegalArgumentException |
| TC003 | B | 入参为 null | 抛出 IllegalArgumentException |
| TC004 | D | 重复提交订单号 | 幂等处理，返回已有订单 |
| TC005 | E | 库存不足 | 抛出 StockInsufficientException |

**场景数量要求**（每个方法）：1-2 正常 + 2-3 边界 + 1-2 业务规则 + 1-2 异常

### 3.3 7 级测试位置扫描

执行 7 级优先级扫描，自动推荐最优测试文件放置位置：

```bash
# 优先级 1-7 逐级检测
ls -d src/test/java/ 2>/dev/null && echo "found:src/test/java"     # 标准 Maven
find . -path "*/src/test/java" -type d 2>/dev/null                 # Gradle 多模块
find . -path "*/test/*" -name "*Test*.java" -not -path "*/target/*" 2>/dev/null | head -5  # 非标准
ls -d test/ 2>/dev/null && echo "found:test"                       # 传统 Eclipse
find . -path "*/src/*test*" -type d -not -path "*/target/*" 2>/dev/null | head -5  # 其他
ls -d tests/ 2>/dev/null && echo "found:tests"                     # 纯测试目录
# 已有测试文件最多的目录
find . -name "*Test*.java" -not -path "*/target/*" 2>/dev/null | xargs -I{} dirname {} | sort | uniq -c | sort -rn | head -3
```

**推荐规则**：标准 Maven → `src/test/java` + 同包路径；非标准 → `src/test/` + 跟随被测包路径；传统 → `test/` + 同包路径

### 3.4 计划确认

**必须将测试计划展示给用户确认**，格式如下：

```markdown
## 📋 待确认：测试计划

| 被测类 | 计划方法数 | 覆盖场景 | 依赖 |
|--------|----------|---------|------|
| UserService | 8 | 正常3+边界3+异常2 | UserDao, RedisService |

### 测试风格对齐
- 框架：JUnit 4 + Mockito（与项目现有风格一致）
- Mock 初始化：`MockitoAnnotations.initMocks(this)`
- 命名风格：`should_xxx_when_xxx`（行为驱动式）

### 📁 生成位置
推荐位置 → `src/test/java/cn/com/venustech/user/service/UserServiceTest.java`
需要创建目录：否

👉 *回复"确认"后开始生成代码。*
```

---

## 阶段四：测试代码生成

### 4.1 通用编写规范

- 测试类命名：`被测类名 + Test`（`UserService → UserServiceTest`）
- 测试方法命名（二选一，与项目一致）：
  - 业务场景式：`getUserById_userNotExists_throwBusinessException`
  - 行为驱动式：`should_throw_exception_when_user_not_exists`
- 标准三段式：`// Given` → `// When` → `// Then`
- 一个测试只验证一个业务行为
- 禁止 `System.out.println()`、禁止无断言空转、禁止在断言中使用循环/条件

### 4.2 模板选择逻辑

| 项目类型 | 测试框架 | 选用模板 |
|---------|---------|---------|
| Spring Boot 2.2+ / JUnit 5 | Mockito + AssertJ | **模板 B**（JUnit 5 @ExtendWith） |
| Spring Boot 2.1.x / JUnit 4 | Mockito | **模板 A**（JUnit 4 @RunWith） |
| 传统 Spring MVC | JUnit 4 + Mockito | **模板 A + F** |
| 传统 Spring MVC | EasyMock | **模板 C + F** |
| 纯 Java 项目 | JUnit 4/5 | **模板 A/B + E** |

#### 模板 A：JUnit 4 + Mockito

```java
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

@RunWith(MockitoJUnitRunner.class)
public class UserServiceTest {

    @Mock
    private UserDao userDao;

    @InjectMocks
    private UserService userService;

    @Test
    public void should_return_user_when_query_by_valid_id() {
        // Given
        Long userId = 1L;
        User mockUser = new User();
        mockUser.setId(userId);
        mockUser.setName("张三");
        when(userDao.selectById(userId)).thenReturn(mockUser);

        // When
        User result = userService.getUserById(userId);

        // Then
        assertNotNull(result);
        assertEquals("张三", result.getName());
        verify(userDao, times(1)).selectById(userId);
    }

    @Test
    public void should_throw_exception_when_user_not_exists() {
        // Given
        when(userDao.selectById(999L)).thenReturn(null);

        // When + Then
        assertThatThrownBy(() -> userService.getUserById(999L))
            .isInstanceOf(BusinessException.class)
            .hasMessage("用户不存在");
    }
}
```

#### 模板 B：JUnit 5 + Mockito

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService 单元测试")
class UserServiceTest {

    @Mock
    private UserDao userDao;

    @InjectMocks
    private UserService userService;

    @Test
    @DisplayName("根据有效ID查询用户，应返回用户信息")
    void should_return_user_when_query_by_valid_id() {
        // Given
        Long userId = 1L;
        User mockUser = new User(1L, "张三", 18);
        when(userDao.selectById(userId)).thenReturn(mockUser);

        // When
        User result = userService.getUserById(userId);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getName()).isEqualTo("张三");
        verify(userDao, times(1)).selectById(userId);
    }
}
```

#### 模板 C：JUnit 4 + EasyMock（遗留项目）

```java
import org.junit.Test;
import org.junit.runner.RunWith;
import org.easymock.EasyMock;
import org.easymock.EasyMockRunner;
import org.easymock.Mock;
import org.easymock.TestSubject;
import static org.junit.Assert.*;

@RunWith(EasyMockRunner.class)
public class UserServiceTest {

    @Mock
    private UserDao userDao;

    @TestSubject
    private UserService userService = new UserService();

    @Test
    public void should_return_user_when_query_by_valid_id() {
        // Given
        Long userId = 1L;
        User mockUser = new User();
        EasyMock.expect(userDao.selectById(userId)).andReturn(mockUser);
        EasyMock.replay(userDao);

        // When
        User result = userService.getUserById(userId);

        // Then
        assertNotNull(result);
        EasyMock.verify(userDao);
    }
}
```

#### 模板 D：Spring Boot Controller 测试（@WebMvcTest）

```java
@RunWith(SpringRunner.class)
@WebMvcTest(UserController.class)
public class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    public void should_return_user_when_get_by_id() throws Exception {
        // Given
        when(userService.getUserById(1L)).thenReturn(new UserVO(1L, "张三"));

        // When + Then
        mockMvc.perform(get("/api/user/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
```

#### 模板 E：工具类参数化测试

```java
// JUnit 4
@RunWith(Parameterized.class)
public class StringUtilsTest {

    @Parameterized.Parameters
    public static Collection<Object[]> data() {
        return Arrays.asList(new Object[][]{
            {null, true},
            {"", true},
            {"  ", true},
            {"hello", false}
        });
    }
}

// JUnit 5
@ParameterizedTest
@NullAndEmptySource
@ValueSource(strings = {"  ", "	", "
"})
void should_return_true_when_string_is_blank(String input) {
    assertThat(StringUtils.isBlank(input)).isTrue();
}
```

#### 模板 F：传统 Spring 项目（XML 配置）

```java
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(locations = {"classpath:applicationContext.xml"})
public class UserServiceTest {
    @Autowired
    private UserService userService;

    @Test
    public void should_return_user_when_query_by_valid_id() {
        User user = userService.getUserById(1L);
        assertNotNull(user);
    }
}
```

### 4.3 遗留 Java 代码测试策略

当被测代码存在以下可测试性障碍时，采用对应策略：

| 障碍类型 | 典型特征 | 应对策略 |
|---------|---------|---------|
| **静态方法耦合** | `AppDao.getXxx()` 等静态调用 | 优先测试不依赖静态方法的参数校验/异常分支 |
| **方法内 new 对象** | `new CallService()` 在方法内 | 只测试参数校验逻辑，建议重构为构造注入 |
| **构造函数调数据库** | 构造函数中执行 `AppDao.getXxx()` | 使用 `@BeforeClass` + 反射预设静态字段 |
| **超大类（>1000 行）** | 一个类大量不相关方法 | 按功能分组 `@Nested`，优先 public 方法 |
| **system scope 依赖** | 依赖使用 `<scope>system</scope>` | 以注释方式提供标准 Maven 依赖配置 |

**核心原则**：能测多少测多少，参数校验和异常分支是基本盘。

---

## 阶段五：运行与验证

```bash
# Maven
mvn test -Dtest=UserServiceTest -DfailIfNoTests=false

# Gradle
gradle test --tests "*UserServiceTest*"

# 运行全部测试
mvn test -DfailIfNoTests=false
```

### 常见问题排查

| 问题 | 可能原因 | 排查方法 |
|------|---------|---------|
| 测试类找不到依赖 | system scope 或内部仓库 | 检查 `pom.xml` 中 `lib/` 目录 |
| Mockito 版本冲突 | Spring Boot 内置版本不匹配 | `mvn dependency:tree` 查看版本 |
| JUnit 版本冲突 | 同时存在 JUnit 4 和 5 | Spring Boot 2.2+ 需排除 `junit-vintage-engine` |
| Java 8 兼容 | 测试使用 Java 9+ API | 确保测试代码 JDK 8 兼容 |

### 结果报告

```markdown
## 📋 单元测试生成报告

### 测试统计
- 生成测试类：5 个
- 生成测试用例：24 个
- 覆盖方法：18 个
- 运行通过率：100%

### 生成文件清单
| 测试类 | 对应被测类 | 用例数 | 状态 |
|--------|-----------|-------|------|
| UserServiceTest | UserService | 8 | ✅ 通过 |
| OrderServiceTest | OrderService | 6 | ✅ 通过 |
```

---

## 约束与最佳实践

### 禁止
- 禁止修改被测代码来迁就测试
- 禁止生成无断言的空测试方法
- 禁止在测试中使用 `System.out.println()` 代替断言
- 禁止 Mock 值对象、实体类、简单工具类
- 禁止在测试方法中写循环、条件等业务逻辑（使用参数化测试替代）
- 禁止测试之间共享可变成员变量状态
- 禁止连接真实数据库/Redis 等外部依赖
- 禁止使用 `@Disabled` 长期跳过测试
- 禁止使用通配符 `*` 导入
- 禁止使用 `@Test(expected=...)` 做异常断言

### 加分实践
- 对边界值（Null、空值、极值、0、负数）优先覆盖
- 异常场景使用 `assertThatThrownBy()`（AssertJ）或 `assertThrows()`（JUnit 5）
- 使用 `@DisplayName`（JUnit 5）使测试报告更可读
- 使用 `verify` 验证外部依赖的调用次数和入参正确性
- 使用参数化测试减少重复代码
- 涉及时间的逻辑注入 `Clock` 或 `TimeSource`，禁止直接调用 `LocalDateTime.now()`
- 测试数据构造使用 Builder 模式或工厂方法

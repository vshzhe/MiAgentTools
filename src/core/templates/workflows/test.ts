/**
 * test 类型技能模板：测试生成（多 schema 模式）。
 *
 * 主 SKILL 承载语言无关的通用流程（语言/框架检测路由 + BCDE 场景矩阵
 * + 分层测试策略 + 通用编写规范 + 反模式清单），语言/框架专属内容
 * （检测细节、Mock API、代码模板、运行命令）拆分为 references/schema-*.md，
 * 按检测结果按需 Read 加载。新语言扩展 = 新增一个 schema 文件 + 路由表加一行。
 *
 * schema 划分：
 * - schema-java.md：Java（Maven/Gradle，Spring Boot/MVC/传统Web/纯Java），JUnit4/5 + Mockito/EasyMock/AssertJ
 * - schema-node.md：Node/TS（Vitest/Jest/Mocha/Jasmine），vi.mock/jest.mock
 *
 * 历史：本技能由原 TS 专属与 Java 专属（独立类型）两个测试技能合并而来，
 * 合并后删除后者及其类型。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { deriveCommandContent } from '../derive-command.js';

const SCHEMA_JAVA = `## Java Schema —— 项目检测、框架分析、模板与运行

> 本 schema 在主 SKILL 阶段一检测到 \`pom.xml\` 或 \`build.gradle\` 时加载。
> 通用流程（BCDE 场景矩阵、命名/AAA/断言规范、反模式清单）见主 SKILL，本文件不重复。

### J1. 项目框架类型检测

\`\`\`bash
# Maven 项目
grep -q "spring-boot-starter-parent\\|spring-boot-starter-web" pom.xml 2>/dev/null && echo "spring-boot"
grep -q "spring-webmvc\\|spring-orm" pom.xml 2>/dev/null && echo "spring-mvc"
grep -q "struts2-core\\|jfinal" pom.xml 2>/dev/null && echo "traditional-web"

# JDK 版本检测
grep -E "<java.version>|<maven.compiler.source>" pom.xml 2>/dev/null | head -3
grep -E "sourceCompatibility|JavaVersion" build.gradle 2>/dev/null | head -3
\`\`\`

**项目类型判定表**：

| 检测特征 | 项目类型 | 说明 |
|---------|---------|------|
| \`spring-boot-starter-parent\` 或 \`spring-boot-starter-web\` | **Spring Boot 项目** | 使用 \`spring-boot-starter-test\`，支持切片测试 |
| \`spring-webmvc\`、\`spring-orm\` 但无 \`spring-boot-starter-*\` | **传统 Spring MVC 项目** | 可能使用 XML 配置，需 Spring Test 支持 |
| \`struts2-core\`、\`jfinal\` 等非 Spring 框架 | **传统 Web 项目** | 纯 JUnit 测试，手动 Mock |
| 无 Web 框架特征 | **纯 Java 工具项目** | 无需 Mock，直接测试 |
| 源码在 \`src/\` 根目录而非 \`src/main/java\` | **非标准 Maven 项目** | 常见于遗留项目，需调整测试路径 |

### J2. 源码结构检测

\`\`\`bash
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
\`\`\`

### J3. 现有测试风格检测

当已有测试文件时，**读取 1-2 个**了解项目测试风格：

- 使用框架：JUnit 4（\`org.junit.Test\`）还是 JUnit 5（\`org.junit.jupiter.api\`）
- Mock 框架：Mockito（\`@Mock\`、\`when()\`）还是 EasyMock（\`EasyMock.expect()\`）
- Mock 初始化：\`@RunWith(MockitoJUnitRunner.class)\` 还是 \`MockitoAnnotations.initMocks(this)\` 还是 \`@ExtendWith(MockitoExtension.class)\`
- 断言方式：JUnit 原生还是 AssertJ 流式断言

### J4. 测试框架分析报告

读取 \`pom.xml\` 或 \`build.gradle\` 中的测试依赖，输出分析报告：

\`\`\`bash
# pom.xml — 查找测试相关依赖
grep -A3 "junit|junit-jupiter|mockito|easymock|assertj|jacoco" pom.xml 2>/dev/null | head -30
# build.gradle
grep -i "junit|mockito|easymock|assertj" build.gradle 2>/dev/null | head -20
# system scope - lib/ 目录
ls lib/*junit* lib/*mockito* lib/*easymock* lib/*assertj* 2>/dev/null
\`\`\`

报告格式示例：

\`\`\`markdown
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
- 特殊处理：如项目依赖为 \`system\` scope，测试代码以注释方式提供依赖声明
\`\`\`

**标准化配置推荐**（缺失依赖时同时输出 Maven/Gradle 代码）：
- JDK 8+ 推荐：JUnit 5 + Mockito + AssertJ + JaCoCo
- 遗留项目推荐：JUnit 4 + Mockito（保持现有框架）

### J5. 测试计划（7 级位置扫描 + 确认门）

#### J5.1 测试范围与优先级

\`\`\`markdown
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
\`\`\`

优先级标准：**P0**（核心业务/高复杂度）→ **P1**（常规业务）→ **P2**（工具类）

> BCDE 场景矩阵设计见主 SKILL 阶段二，本 schema 不重复。

#### J5.2 7 级测试位置扫描

执行 7 级优先级扫描，自动推荐最优测试文件放置位置：

\`\`\`bash
# 优先级 1-7 逐级检测
ls -d src/test/java/ 2>/dev/null && echo "found:src/test/java"     # 标准 Maven
find . -path "*/src/test/java" -type d 2>/dev/null                 # Gradle 多模块
find . -path "*/test/*" -name "*Test*.java" -not -path "*/target/*" 2>/dev/null | head -5  # 非标准
ls -d test/ 2>/dev/null && echo "found:test"                       # 传统 Eclipse
find . -path "*/src/*test*" -type d -not -path "*/target/*" 2>/dev/null | head -5  # 其他
ls -d tests/ 2>/dev/null && echo "found:tests"                     # 纯测试目录
# 已有测试文件最多的目录
find . -name "*Test*.java" -not -path "*/target/*" 2>/dev/null | xargs -I{} dirname {} | sort | uniq -c | sort -rn | head -3
\`\`\`

**推荐规则**：标准 Maven → \`src/test/java\` + 同包路径；非标准 → \`src/test/\` + 跟随被测包路径；传统 → \`test/\` + 同包路径

#### J5.3 计划确认门

**必须将测试计划展示给用户确认**，格式如下：

\`\`\`markdown
## 📋 待确认：测试计划

| 被测类 | 计划方法数 | 覆盖场景 | 依赖 |
|--------|----------|---------|------|
| UserService | 8 | 正常3+边界3+异常2 | UserDao, RedisService |

### 测试风格对齐
- 框架：JUnit 4 + Mockito（与项目现有风格一致）
- Mock 初始化：\`MockitoAnnotations.initMocks(this)\`
- 命名风格：\`should_xxx_when_xxx\`（行为驱动式）

### 📁 生成位置
推荐位置 → \`src/test/java/<package-path>/UserServiceTest.java\`
需要创建目录：否

👉 *回复"确认"后开始生成代码。*
\`\`\`

### J6. 模板选择逻辑

| 项目类型 | 测试框架 | 选用模板 |
|---------|---------|---------|
| Spring Boot 2.2+ / JUnit 5 | Mockito + AssertJ | **模板 B**（JUnit 5 @ExtendWith） |
| Spring Boot 2.1.x / JUnit 4 | Mockito | **模板 A**（JUnit 4 @RunWith） |
| 传统 Spring MVC | JUnit 4 + Mockito | **模板 A + F** |
| 传统 Spring MVC | EasyMock | **模板 C + F** |
| 纯 Java 项目 | JUnit 4/5 | **模板 A/B + E** |

#### 模板 A：JUnit 4 + Mockito

\`\`\`java
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
\`\`\`

#### 模板 B：JUnit 5 + Mockito

\`\`\`java
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
\`\`\`

#### 模板 C：JUnit 4 + EasyMock（遗留项目）

\`\`\`java
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
\`\`\`

#### 模板 D：Spring Boot Controller 测试（@WebMvcTest）

\`\`\`java
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
\`\`\`

#### 模板 E：工具类参数化测试

\`\`\`java
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
@ValueSource(strings = {"  ", "\\t", "\\n"})
void should_return_true_when_string_is_blank(String input) {
    assertThat(StringUtils.isBlank(input)).isTrue();
}
\`\`\`

#### 模板 F：传统 Spring 项目（XML 配置）

\`\`\`java
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
\`\`\`

### J6.5 功能级测试（Functional）

当主 SKILL 阶段一 1.3 判定为**功能级层级**时，使用本节写法。功能级测试验证跨组件的完整功能链路，仅 Mock 真正的外部系统。

**工具链检测（先执行）**：

\`\`\`bash
# Spring Boot 测试支持（提供 @SpringBootTest / @WebMvcTest / MockMvc）
grep -q "spring-boot-starter-test" pom.xml 2>/dev/null && echo "spring-boot-test" || echo "missing"
\`\`\`

**降级规则**：检测不到 \`spring-boot-starter-test\` 时 MUST 降级为单元测试层级并提示，MUST NOT 生成无法运行的测试代码。

**写法选择**：

| 场景 | 注解 | 依赖处理 |
|---|---|---|
| 仅验证接口层（请求映射、参数校验、响应格式、权限拦截） | \`@WebMvcTest(XxxController.class)\` + MockMvc | \`@MockBean\` 替换 Service 依赖 |
| 验证跨层协作（Service→DAO 连通、事务、数据一致性） | \`@SpringBootTest\` + \`@Transactional\`（用例后回滚） | 仅 Mock 外部系统（第三方接口、消息中间件） |

**模板 G：功能级测试（@SpringBootTest）**

\`\`\`java
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional  // 用例结束自动回滚，保证可重复
class OrderFlowFunctionalTest {

    @Autowired
    private OrderFacade orderFacade;

    @Test
    void should_create_order_and_deduct_stock_when_submit_valid_order() {
        // Given: 通过功能入口构造前置数据（不做内部组件 Mock）
        Long userId = 1L;
        String skuCode = "SKU-001";

        // When: 从功能入口发起完整链路
        String orderNo = orderFacade.submit(userId, skuCode, 2);

        // Then: 断言可观测结果（而非内部方法调用）
        assertThat(orderNo).isNotBlank();
        assertThat(orderFacade.queryStock(skuCode)).isEqualTo(8);
    }
}
\`\`\`

**Java 功能级测试约束**：

- MUST 断言**可观测的最终结果**（返回值、落库数据、外部可见状态），MUST NOT 断言内部组件的调用次数
- 涉及写库的用例 MUST 使用 \`@Transactional\` 保证回滚，或显式清理数据，确保可重复（FIRST 的 R）
- MUST NOT 在功能级测试中 Mock 内部协作组件（Service/DAO）——那会让测试退化为单元测试而失去层级价值
- 用例命名 MUST 表达完整功能意图（如 \`should_create_order_and_deduct_stock_when_submit_valid_order\`）

### J7. 遗留 Java 代码测试策略

当被测代码存在以下可测试性障碍时，采用对应策略：

| 障碍类型 | 典型特征 | 应对策略 |
|---------|---------|---------|
| **静态方法耦合** | \`AppDao.getXxx()\` 等静态调用 | 优先测试不依赖静态方法的参数校验/异常分支 |
| **方法内 new 对象** | \`new CallService()\` 在方法内 | 只测试参数校验逻辑，建议重构为构造注入 |
| **构造函数调数据库** | 构造函数中执行 \`AppDao.getXxx()\` | 使用 \`@BeforeClass\` + 反射预设静态字段 |
| **超大类（>1000 行）** | 一个类大量不相关方法 | 按功能分组 \`@Nested\`，优先 public 方法 |
| **system scope 依赖** | 依赖使用 \`<scope>system</scope>\` | 以注释方式提供标准 Maven 依赖配置 |

**核心原则**：能测多少测多少，参数校验和异常分支是基本盘。

### J8. 运行与验证

\`\`\`bash
# Maven
mvn test -Dtest=UserServiceTest -DfailIfNoTests=false

# Gradle
gradle test --tests "*UserServiceTest*"

# 运行全部测试
mvn test -DfailIfNoTests=false

# 覆盖度实测（主 SKILL 5.1 方式 1）——项目已配置 JaCoCo 时
mvn test jacoco:report
# 报告位置：target/site/jacoco/index.html（行覆盖 / 分支覆盖）
# 未配置 JaCoCo（pom.xml 无 jacoco-maven-plugin）→ 走方式 2 静态矩阵并标注"未实测覆盖度"

# 仅运行功能级测试（按命名约定筛选）
mvn test -Dtest="*FunctionalTest" -DfailIfNoTests=false
\`\`\`

#### 常见问题排查

| 问题 | 可能原因 | 排查方法 |
|------|---------|---------|
| 测试类找不到依赖 | system scope 或内部仓库 | 检查 \`pom.xml\` 中 \`lib/\` 目录 |
| Mockito 版本冲突 | Spring Boot 内置版本不匹配 | \`mvn dependency:tree\` 查看版本 |
| JUnit 版本冲突 | 同时存在 JUnit 4 和 5 | Spring Boot 2.2+ 需排除 \`junit-vintage-engine\` |
| Java 8 兼容 | 测试使用 Java 9+ API | 确保测试代码 JDK 8 兼容 |

#### 结果报告

\`\`\`markdown
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
\`\`\`

### J9. Java 专属约束与加分实践

**Java 专属禁止**：
- 禁止使用通配符 \`*\` 导入
- 禁止使用 \`@Test(expected=...)\` 做异常断言（改用 \`assertThrows()\` 或 \`assertThatThrownBy()\`）
- 禁止在测试中使用 \`System.out.println()\` 代替断言

**Java 加分实践**：
- 异常场景使用 \`assertThatThrownBy()\`（AssertJ）或 \`assertThrows()\`（JUnit 5）
- 使用 \`@DisplayName\`（JUnit 5）使测试报告更可读
- 使用 \`verify\` 验证外部依赖的调用次数和入参正确性
- 使用参数化测试减少重复代码
- 涉及时间的逻辑注入 \`Clock\` 或 \`TimeSource\`，禁止直接调用 \`LocalDateTime.now()\`
- 测试数据构造使用 Builder 模式或工厂方法`;

const SCHEMA_NODE = `## Node Schema —— 框架检测、分层示例与运行

> 本 schema 在主 SKILL 阶段一检测到 \`package.json\` 时加载。
> 通用流程（BCDE 场景矩阵、命名/AAA/断言规范、反模式清单）见主 SKILL，本文件不重复。

### N1. 测试框架检测

\`\`\`bash
# 检测 Vitest（优先）
grep -q "vitest" package.json 2>/dev/null && echo "vitest"
# 检测 Jest
grep -q "jest" package.json 2>/dev/null && echo "jest"
# 检测 Mocha
grep -q "mocha" package.json 2>/dev/null && echo "mocha"
# 检测 Jasmine
grep -q "jasmine" package.json 2>/dev/null && echo "jasmine"
\`\`\`

**检测结果决定**：
- **测试框架选择**：Vitest（\`describe/it/expect\`）、Jest（\`describe/test/expect\`）、Mocha（\`describe/it/assert\`）
- **Mock 方式**：Vitest → \`vi.mock()\` / \`vi.spyOn()\`；Jest → \`jest.mock()\` / \`jest.spyOn()\`
- **配置文件**：\`vitest.config.ts\`、\`jest.config.js\` 等

**既有测试风格对齐**：
- 读取 1-2 个已有测试文件，了解项目的命名风格、注释习惯、断言方式
- 命名为：业务场景式（\`getUserById_userNotFound_throwsException\`）或行为驱动式（\`should_throw_exception_when_user_not_exists\`）

> **找不到测试框架时**：输出提示并建议用户指定框架，或默认输出 Vitest 风格代码。

### N2. 分层测试示例（TypeScript / Vitest）

分层策略（Service/Controller/Utils 的目标与 Mock 范围）见主 SKILL 阶段三，本节给出 Vitest 代码示例。

#### Service / 业务逻辑层

\`\`\`typescript
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
\`\`\`

#### Controller / 接口层

\`\`\`typescript
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
\`\`\`

#### 工具类 / Utils（参数化测试）

\`\`\`typescript
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
\`\`\`

### N2.5 功能级测试（Functional）

当主 SKILL 阶段一 1.3 判定为**功能级层级**时，使用本节写法。功能级测试验证跨组件的完整功能链路，仅 Mock 真正的外部系统。

**工具链检测（先执行）**：

\`\`\`bash
grep -q "supertest" package.json 2>/dev/null && echo "supertest" || echo "missing"
\`\`\`

**降级规则**：检测不到 \`supertest\`（或等价 HTTP 测试工具）时 MUST 降级为单元测试层级并提示，MUST NOT 生成无法运行的测试代码。

**模板：功能级测试（supertest）**

\`\`\`typescript
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
\`\`\`

**Node 功能级测试约束**：

- MUST 断言**可观测的最终结果**（HTTP 状态、响应体、再次查询的数据），MUST NOT 断言内部函数的调用次数
- 涉及数据写入的用例 MUST 在 \`beforeAll\`/\`afterAll\` 或 \`beforeEach\`/\`afterEach\` 中准备与清理数据，确保可重复（FIRST 的 R）
- MUST NOT 在功能级测试中 Mock 内部模块（\`vi.mock()\` 内部 Service/Repository）——那会让测试退化为单元测试而失去层级价值
- 用例命名 MUST 表达完整功能意图（如 \`should_create_order_and_deduct_stock_when_submit_valid_order\`）

### N3. 运行与验证

\`\`\`bash
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
\`\`\`

### N4. Node 专属约束

- 异常断言使用 \`expect(fn).rejects.toThrow()\`（异步）或 \`expect(fn).toThrow()\`（同步）
- 禁止使用 \`it.skip\` / \`it.todo\` 长期跳过测试（临时跳过必须标注原因和修复时间）
- \`vi.mock()\` / \`jest.mock()\` 的工厂函数必须提升到文件顶部（hoisting），不可放在条件分支内
- 推荐使用精确断言：\`expect(result.name).toBe('Alice')\` 而非 \`expect(result).toBeDefined()\``;

export function getTestSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_test',
        description:
            '生成测试。当用户要为新功能或已有代码编写测试用例、补充测试覆盖时使用；触发词"写测试 / 生成测试 / 测试用例 / test / 覆盖率"；NOT for 验证实现与制品一致性（改用 iagent_spec_verify）。多 schema 模式：自动检测 Java（Maven/Gradle）或 Node（Vitest/Jest/Mocha）项目，加载对应框架模板。Java 覆盖 JUnit4/5+Mockito/EasyMock/AssertJ，Node 覆盖 Vitest/Jest/Mocha。',
        allowedTools:
            'Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(npm:*), Bash(node:*), Bash(mvn:*), Bash(gradle:*), Bash(mkdir:*), Bash(ls:*), Bash(find:*), Bash(cat:*), Bash(cp:*), Bash(grep:*), Bash(echo:*)',
        type: 'test',
        instructions: `生成测试 —— 多 schema 模式：检测语言/框架 → 加载对应 schema → BCDE 场景矩阵 → 分层编写 → 运行验证。

**目标驱动**：先把验收标准变成可执行的测试，再让它通过。"添加校验" → "先写非法输入的测试，再让它通过"；"修 bug" → "先写复现该 bug 的测试，再修复"。

**输入**：\`/iagent:test\` 后跟被测目标（类名、方法名、文件路径或功能描述）。

---

## 阶段一：语言与框架检测（schema 路由）

本技能采用多 schema 模式：主 SKILL 承载语言无关的通用流程（场景设计、编写规范、反模式），语言/框架专属内容（检测细节、Mock API、代码模板、运行命令）拆分为 \`references/schema-*.md\`，按检测结果按需 Read 加载，避免单文件上下文膨胀。

### 1.1 检测项目语言与框架

\`\`\`bash
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
\`\`\`

### 1.2 schema 索引表（按检测结果 Read 对应子文件）

| 子文件 | 适用项目 | 包含内容 | 何时 Read |
|---|---|---|---|
| \`references/schema-java.md\` | Java（Maven/Gradle，Spring Boot/MVC/传统Web/纯Java） | 框架类型判定、测试依赖分析报告、7 级测试位置扫描、模板 A-F（JUnit4/5+Mockito/EasyMock/@WebMvcTest/参数化/遗留 XML）、遗留代码测试策略、mvn/gradle 命令、Java 专属约束 | 检测到 \`pom.xml\` 或 \`build.gradle\` |
| \`references/schema-node.md\` | Node/TS（Vitest/Jest/Mocha/Jasmine） | 框架检测细节、Mock 方式（vi.mock/jest.mock）、分层测试 TS 示例（Service/Controller/Utils）、pnpm/npm 命令、Node 专属约束 | 检测到 \`package.json\` |

> 子文件路径相对技能目录（如 \`.claude/skills/iagent-test/references/schema-java.md\`）。加载后结合本 SKILL 的通用流程执行后续阶段。

**未识别语言**：输出检测结果并建议用户指定框架，或默认输出与项目最接近的风格代码。

### 1.3 测试层级路由（与语言维度正交）

语言/框架维度决定**用什么框架写**，测试层级维度决定**测到哪一层**。二者正交，MUST 分别判定：

| 层级 | 被测对象 | 断言点 | 依赖策略 |
|---|---|---|---|
| **单元测试（Unit）** | 单个类或函数（Service、工具类、独立业务方法） | 返回值与依赖交互 | Mock 全部外部依赖 |
| **功能级测试（Functional）** | 跨组件的完整功能链路（接口端到端、多服务协作的业务流程） | 功能入口到可观测结果 | 仅 Mock 真正的外部系统（第三方、消息中间件），不 Mock 内部协作组件 |

**层级判定依据**（按顺序判定，命中即采用）：

1. 被测目标为**功能入口**（请求处理入口、对外接口端点）→ 功能级测试
2. 被测流程**跨 ≥2 个组件**且需验证协作结果 → 功能级测试
3. 其余情形（单个类/函数/方法）→ 单元测试

**降级规则（MUST）**：项目依赖中不存在功能级测试所需框架时（Java 无 \`spring-boot-starter-test\`、Node 无 \`supertest\`），MUST **降级为单元测试层级**并输出明确提示，MUST NOT 生成无法运行的测试代码。

> 各语言的功能级测试写法（Java 的 \`@SpringBootTest\`/\`@WebMvcTest\`、Node 的 supertest）见已加载的 \`references/schema-*.md\`。

---

## 阶段二：场景设计（BCDE 场景矩阵法）

### 2.1 该不该测闸门（前置判定）

在进入场景设计之前，MUST 先判定被测目标是否值得测试。落入**不测清单**的目标 MUST NOT 进入 2.2 场景设计，且 MUST 输出"已评估、判定不生成测试"的结论与判定依据（见 2.5 结论留痕）——**不得静默跳过**，使"没写测试"与"没评估过"可区分。

**不测清单**（MANUAL：无业务分支、无输入校验、无状态变化的目标）：

| 不测目标 | 判定依据 |
|---|---|
| 纯数据类（DTO/VO/Entity）的取值读写方法 | 无逻辑，编译器与语言运行时已保证 |
| 无分支的转发方法 | 方法体仅委托调用，无业务判定 |
| 私有方法 | 由被测的公开方法间接覆盖，单独测试会耦合实现细节 |
| 框架生命周期回调 | 由框架驱动，行为不属于被测业务逻辑 |
| 自动生成的代码 | 非人工维护，变更风险不由本团队承担 |

**边界情形**：目标落入清单但其调用方为 P0 核心链路时，测试应由**调用方**（公开方法/功能入口）覆盖，MUST NOT 直接测该目标本身。

### 2.2 BCDE 场景矩阵

对通过 2.1 闸门的被测方法，按 **BCDE（Basic/Boundary/Design/Exception）四象限矩阵** 设计场景：

| 场景类型 | 测试目标 | 示例 |
|---------|---------|------|
| **B**asic（正常路径） | 核心业务逻辑按预期工作 | 合法输入返回正确结果 |
| **B**oundary（边界条件） | 临界值/极限条件下的表现 | Null、空集合、空字符串、0、负数、极大值、临界值 |
| **D**esign（业务规则） | 业务约束和规则被遵守 | 状态机流转、幂等性、并发控制 |
| **E**xception（异常路径） | 非法输入/依赖故障的处理 | 参数校验失败、依赖服务不可用 |

**标注自洽约束（MUST）**：入参为 null、空集合、空字符串、零值、极值、临界值的场景 MUST 标注为 \`Boundary\`，MUST NOT 标注为 \`Basic\`。仅当输入合法、路径为正常业务流转时才标 \`Basic\`。

**场景矩阵模板**：

\`\`\`markdown
### \`被测方法名\`
| ID | 类型 | 输入条件 | 预期结果 |
|----|------|---------|---------|
| TC001 | B | 合法参数 | 正常返回正确结果 |
| TC002 | Boundary | 参数为 null | 抛出参数校验异常 |
| TC003 | Boundary | 空集合入参 | 返回空结果 |
| TC004 | D | 重复提交 | 幂等处理，返回已有结果 |
| TC005 | E | 依赖服务超时 | 降级返回缓存/错误提示 |
\`\`\`

### 2.3 场景数量（由复杂度与优先级决定，无固定配额）

**本技能不设固定的场景数量配额**。场景数量 SHALL 由被测方法的**分支复杂度**与**用例优先级分级**共同决定：

- **分支驱动**：被测方法有多少条独立可执行路径（含异常分支），就设计多少个场景——无分支的方法通常只需 1 个场景，多分支方法可能需 5 个以上
- **分级驱动**：P0 目标需覆盖其全部 BCDE 象限；P1 目标覆盖正常路径 + 关键边界；P2 目标仅设计正常路径，且需显式确认才生成（见 2.4）
- **禁止凑数**：MUST NOT 为满足数量而生成低价值用例（重复断言、无业务含义的入参组合、仅验证框架行为的用例）

### 2.4 用例优先级分级（影响生成决策）

为每条设计的用例标注优先级，**分级 MUST 影响生成决策**，而非仅作标注：

| 级别 | 定义 | 生成决策 |
|---|---|---|
| **P0** | 覆盖核心业务链路的正常路径与关键异常分支 | MUST 生成，无需额外确认 |
| **P1** | 覆盖常规业务与关键边界条件 | 默认生成 |
| **P2** | 边界补充、非核心分支、极端入参组合 | MUST 经显式确认后才生成；未确认时记入报告但不生成 |

**判定依据**：用例所覆盖的路径是否属于业务主流程、失败后是否影响用户可感知的功能、是否构成数据正确性风险。

### 2.5 用例去重与合并

设计完成后 MUST 执行去重与合并，避免为凑数产生冗余用例：

- **同构输入合并**：同一被测方法的同构输入（仅数据不同、执行路径与断言结构相同）MUST 合并为 1 个**参数化用例**，MUST NOT 生成多个独立用例
- **跨方法重复归并**：多个被测方法对同一返回结构做相同字段断言时，MUST 提取为共享断言或工厂方法
- **重复检测口径**：两条用例的"输入维度 + 执行路径 + 断言集合"均相同时视为重复，后者 MUST 合并或删除

### 2.6 结论留痕（生成报告要求）

生成报告 MUST 同时包含两类清单，使减少可见且可追溯：

1. **已生成用例的目标**：目标名 + 用例数 + 各级别分布
2. **判定不生成的目标及依据**：落入 2.1 不测清单的目标 + 依据；未获确认的 P2 用例 + 原因

---

## 阶段三：分层测试策略（通用）

本节按**代码层次**给出测试策略；**测试层级**（单元 / 功能级）的判定见阶段一 1.3。两者关系：代码层次决定"测什么"，测试层级决定"用多重的隔离"。例如 Service 层在单元层级下 Mock 全部数据访问依赖，在功能级层级下则连通数据访问层验证协作结果。

**语言无关约束（MUST）**：本节 MUST NOT 绑定单一语言的 Mock 或参数化 API——具体 API 按检测到的语言从已加载的 \`schema-*.md\` 取用（Java: Mockito/EasyMock 与 \`@ParameterizedTest\`；Node: \`vi.mock()\`/\`jest.mock()\` 与 \`it.each\`）。

#### Service / 业务逻辑层
- **测试目标**：验证业务规则、分支逻辑、异常处理
- **Mock 范围**：DAO/Repository、外部服务、缓存、消息队列
- **核心验证**：返回结果正确性、依赖调用次数与入参验证、异常分支覆盖

#### Controller / 接口层
- **测试目标**：验证请求映射、参数校验、响应格式、权限拦截
- **Mock 范围**：单元层级 Mock 全部 Service 依赖；功能级层级连通至业务层，仅 Mock 外部系统
- **最佳实践**：HTTP 端到端测试（Java: MockMvc + \`@WebMvcTest\`；Node: supertest）或 mock 请求/响应对象

#### 工具类 / Utils
- **测试目标**：验证输入输出正确性，覆盖所有边界场景
- **Mock 范围**：一般无需 Mock，直接测试
- **最佳实践**：大量使用参数化测试减少重复代码（参数化 API 按语言分流）

---

## 阶段四：测试代码生成（通用规范）

**命名规范**：
- 测试类：被测类名 + Test（\`UserService → UserServiceTest\`）
- 测试方法：业务场景式 或 行为驱动式（二选一，与项目现有风格一致）
  - 业务场景式：\`getUserById_userNotExists_throwsException\`
  - 行为驱动式（推荐）：\`should_throw_exception_when_user_not_exists\`

**AAA / Given-When-Then 结构**（强制）：
\`\`\`
// Given: 准备测试数据 + Mock 外部依赖
// When: 执行被测方法
// Then: 断言结果 + 验证依赖交互
\`\`\`

**断言规范**：
- **禁止** 日志输出（\`console.log()\` / \`System.out.println()\`）替代断言
- **禁止** 只写"存在性"断言不做具体字段校验
- **禁止** 在断言中使用循环、条件判断等逻辑
- 异常断言使用框架对应 API（见 schema）
- 推荐使用精确断言：断言具体字段值而非仅判存在

**一个测试只验证一个业务行为**，避免单个方法中断言多个不相关的场景。

> 框架专属代码模板（Java 模板 A-F、Node vi.mock 示例）见已加载的 schema-*.md。Java 项目在生成代码前需执行测试计划确认门（见 schema-java.md J5.3）。

---

## 阶段五：运行与验证

按项目构建工具运行测试（Java: \`mvn test\` / \`gradle test\`；Node: \`pnpm test\` / \`npm test\`，具体命令见 schema-*.md）。

**结果验证**：
- 全部通过后报告：\`✅ N/M tests passed\`
- 失败时先区分：
  1. **测试代码写错** → 修正后重新运行
  2. **被测代码有 bug** → 说明具体情况，给出修复建议，衔接 \`/iagent:workflow\`

### 5.1 覆盖度度量

运行验证通过后 MUST 输出覆盖度度量。度量按以下优先级选择，MUST NOT 把降级结果表述为实测覆盖度：

| 优先级 | 方式 | 触发条件 | 输出 |
|---|---|---|---|
| 1（优先） | **实测覆盖度** | 项目已配置覆盖度工具（Java: JaCoCo；Node: c8 或 coverage） | 行覆盖与分支覆盖数据 |
| 2（降级） | **静态场景→用例映射矩阵** | 无可用覆盖度工具链 | 每个规格场景是否被用例覆盖的映射表 |

**降级标注（MUST）**：采用方式 2 时 MUST 显式标注"**未实测覆盖度**"，MUST NOT 让读者误认为已有实测数据。

**未覆盖清单（MUST）**：无论采用哪种方式，报告 MUST 包含明确列出的未覆盖项——未覆盖的规格场景、或未被任何用例引用的场景；MUST NOT 仅给出覆盖度百分比。

**实测命令**（具体写法见 schema-*.md）：Java 走 JaCoCo，Node 走 c8 或 \`--coverage\`。

---

## 反模式清单与约束

### 常见反模式（禁止）

| 反模式 | 危害 | 正确做法 |
|--------|------|---------|
| 无断言空转测试 | 执行即通过，无法发现逻辑错误 | 每个测试必须有明确断言 |
| 测试间共享可变状态 | 执行顺序影响结果 | 每用例前重置状态，每个用例自行构造数据 |
| 日志替代断言 | 无法自动验证 | 所有预期结果使用断言自动验证 |
| 测试方法中写循环/条件 | 测试本身可能有 Bug | 用参数化测试替代 |
| 命名模糊（\`test1\`） | 失败后无法快速定位 | 场景化命名，见名知意 |

### FIRST 原则（用例质量五要素）

每一条用例 MUST 同时满足以下五项，缺一即需返工：

| 要素 | 要求 | 违例特征 |
|---|---|---|
| **F**ast（快） | 单条用例毫秒级完成，整个测试套件秒级 | 用例中做真实网络/磁盘/数据库等待 |
| **I**ndependent（独立） | 用例之间无顺序依赖，单独运行与全量运行结果一致 | 依赖前一条用例写入的数据 |
| **R**epeatable（可重复） | 任意环境、任意次数执行结果稳定 | 依赖当前时间、随机数、机器时区而未注入 |
| **S**elf-validating（自验证） | 预期结果由断言自动判定，无需人工比对输出 | 用日志打印结果供人眼看 |
| **T**imely（及时） | 测试与生产代码同步编写或先于实现 | 功能上线后补测，或长期搁置 |

### 强制约束（语言无关）

- 禁止修改被测代码来迁就测试
- 禁止 Mock 值对象、实体类、简单工具类
- 测试数据构造集中管理，避免重复字面量
- 不依赖执行顺序、不依赖外部状态
- 测试必须可重复：任意环境、任意次数执行结果稳定
- 一个测试只验证一个业务行为
- 外部依赖（数据库/Redis/MQ）使用 mock，不在单测中直连真实环境
- 禁止长期跳过测试（\`@Disabled\` / \`it.skip\`，临时跳过必须标注原因和修复时间）
- 测试代码与生产代码遵循同等质量标准（无魔法值、无重复代码、命名规范）

> 语言专属约束（如 Java 禁止通配符导入 / \`@Test(expected=...)\`，Node \`vi.mock()\` hoisting 等）见 schema-*.md。`,
        license: 'MIT',
        compatibility:
            '无特殊依赖，通用环境可用。多 schema 自动适配：Java（Maven/Gradle + JUnit4/5/Mockito/EasyMock/AssertJ）与 Node（Vitest/Jest/Mocha/Jasmine）。',
        metadata: { author: 'mi-agent-tools' },
        references: [
            { path: 'references/schema-java.md', content: SCHEMA_JAVA },
            { path: 'references/schema-node.md', content: SCHEMA_NODE },
        ],
    };
}

export function getTestCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 生成测试',
        description:
            '生成测试 —— 多 schema 模式：检测 Java/Node 框架、测试层级路由（单元/功能级）、不测闸门、用例分级、BCDE 场景矩阵、覆盖度度量',
        category: 'iAgent / 测试',
        tags: ['iagent', 'test', 'test', 'tdd', 'java', 'node', 'unit', 'functional'],
        content: deriveCommandContent(getTestSkillTemplate().instructions),
    };
}

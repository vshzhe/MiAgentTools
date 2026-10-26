## MODIFIED Requirements

### Requirement: 结构化场景设计方法论

`venus_tr_test_generate` SHALL 提供 BCDE 场景矩阵法（Basic/Boundary/Design/Exception）作为默认的场景设计方法，覆盖正常路径、边界条件、业务规则、异常分支四种场景类型。

技能 MUST 保证场景矩阵示例的标注与 BCDE 定义自洽：入参为 null、空集合、空字符串、零值、极值、临界值的场景 MUST 标注为 `Boundary`，MUST NOT 标注为 `Basic`。

技能 MUST NOT 对被测方法施加固定的场景数量配额（原文"每个方法至少 1-2 正常 + 2-3 边界 + 1-2 业务规则 + 1-2 异常"已废除）。场景数量 SHALL 由被测方法的复杂度与优先级分级共同决定。

#### Scenario: 用户使用场景矩阵设计用例
- **WHEN** 用户执行 `venus:tr-test-generate` 并指定被测目标
- **THEN** 技能输出 BCDE 场景矩阵模板，针对每个被测方法列出适用的场景类型（正常/边界/设计/异常），且示例标注与 BCDE 定义自洽

#### Scenario: 边界场景标注
- **WHEN** 技能为"参数为 null → 抛出参数校验异常"设计场景
- **THEN** 该场景标注为 `Boundary`，MUST NOT 标注为 `Basic`

#### Scenario: 无固定场景配额
- **WHEN** 技能为一个无分支的简单转发方法设计场景
- **THEN** 技能不为凑足场景数量而生成多余用例，仅产出该方法实际适用的场景

### Requirement: 分层测试编写指南

`venus_tr_test_generate` SHALL 根据被测对象的层次（Service/Controller/Utils）提供不同的测试策略指导，并以**语言无关**方式表述分层策略；框架专属的 Mock API 与代码示例 MUST 由 `references/schema-*.md` 承载，MUST NOT 在语言无关的主 SKILL 中写死某一语言的 API。

#### Scenario: Service 层测试
- **WHEN** 被测对象为 Service 类
- **THEN** 技能应用 Mock 隔离外部 DAO 依赖，Mock API 按检测到的语言从对应 schema 取用（Java: Mockito/EasyMock；Node: `vi.mock()`/`jest.mock()`）

#### Scenario: 工具类层测试
- **WHEN** 被测对象为工具类/Utils
- **THEN** 技能使用参数化测试，且参数化 API 按检测到的语言从对应 schema 取用（Java: `@ParameterizedTest`；Node: `it.each`）

#### Scenario: 框架专属表述不泄漏进主 SKILL
- **WHEN** 审阅主 SKILL 正文的分层测试编写指南
- **THEN** 正文中不出现绑定单一语言的 Mock API（如 `vi.mock()`）作为通用要求

## ADDED Requirements

### Requirement: 测试层级路由

`venus_tr_test_generate` SHALL 在语言/框架 schema 路由之外提供**测试层级（Test Level）**维度，取值为单元测试（Unit）与功能级测试（Functional）。层级与语言正交，技能 MUST 依据被测对象与变更性质自动判定层级，并为两个层级分别提供编写指导。

#### Scenario: 判定为单元测试
- **WHEN** 被测对象为单个类或函数（Service、工具类、独立业务方法）
- **THEN** 技能选择单元测试层级，Mock 全部外部依赖，按 BCDE 矩阵设计场景

#### Scenario: 判定为功能级测试
- **WHEN** 被测对象为跨组件的完整功能链路（接口端到端、多服务协作的业务流程）
- **THEN** 技能选择功能级测试层级，Java 项目使用 `@SpringBootTest` 或 `@WebMvcTest` + MockMvc，Node 项目使用 supertest，断言点为功能入口到可观测结果

#### Scenario: 项目缺少功能级测试工具链
- **WHEN** 项目依赖中不存在功能级测试所需的框架（Java 无 `spring-boot-starter-test`、Node 无 `supertest`）
- **THEN** 技能降级为单元测试层级并输出明确提示，MUST NOT 生成无法运行的测试代码

### Requirement: 该不该测闸门

`venus_tr_test_generate` SHALL 在场景设计之前提供"该不该测"判定闸门，并公开一份**不测清单**。落入不测清单的被测对象 MUST NOT 进入 BCDE 场景设计环节，MUST 记录"已评估、判定不生成测试"的结论，MUST NOT 静默跳过。

不测清单 MUST 至少覆盖：纯数据类（DTO/VO/Entity 的 getter/setter）、无分支的转发方法、私有方法、框架生命周期回调、自动生成的代码。

#### Scenario: 落入不测清单
- **WHEN** 被测目标为纯数据类的 getter/setter
- **THEN** 技能输出"已评估、判定不生成测试"的结论与判定依据，不为该目标生成用例

#### Scenario: 不落入不测清单
- **WHEN** 被测目标含有业务分支逻辑
- **THEN** 技能进入 BCDE 场景设计环节，正常生成用例

#### Scenario: 判定结论留痕
- **WHEN** 技能完成一次测试生成
- **THEN** 生成报告中同时包含"已生成用例的目标"与"判定不生成的目标及依据"两类清单，二者可区分

### Requirement: 用例优先级分级

`venus_tr_test_generate` SHALL 为设计的用例标注优先级分级（P0 核心业务链路 / P1 常规业务 / P2 边界补充），且**分级 MUST 影响生成决策**：

- P0 用例 MUST 生成
- P1 用例默认生成
- P2 用例 MUST 经显式确认后才生成

#### Scenario: P0 用例
- **WHEN** 用例覆盖核心业务链路的正常路径
- **THEN** 技能将其标为 P0 并生成，不需要额外确认

#### Scenario: P2 用例需确认
- **WHEN** 用例为边界补充性质
- **THEN** 技能将其标为 P2，并在生成前向用户确认；用户未确认时该用例不生成且记入报告

#### Scenario: 分级作为减少低价值用例的执行手段
- **WHEN** 某被测方法仅有 P2 级可设计场景
- **THEN** 技能不为该目标批量生成用例，而是列出 P2 候选并等待确认

### Requirement: 用例去重与合并规则

`venus_tr_test_generate` SHALL 对设计的用例执行去重与合并：同一被测方法的同构输入（仅数据不同、路径与断言结构相同）MUST 合并为参数化用例；跨方法的重复断言 MUST 归并或提取为共享断言。

#### Scenario: 同构输入合并
- **WHEN** 某方法有 4 组入参走同一条成功路径
- **THEN** 技能合并为 1 个参数化用例，MUST NOT 生成 4 个独立用例

#### Scenario: 跨方法重复
- **WHEN** 两个被测方法对同一返回结构做相同字段断言
- **THEN** 技能将重复断言提取为共享断言或工厂方法

### Requirement: 覆盖度度量

`venus_tr_test_generate` SHALL 在运行验证通过后输出覆盖度度量。度量 MUST 优先采用实测工具（Java: JaCoCo；Node: c8 或 coverage），并在无可用工具链时降级为静态"specs Scenario → 用例"映射矩阵，且 MUST 显式标注该矩阵为"未实测"，MUST NOT 将降级结果表述为实测覆盖度。

#### Scenario: 有工具链时实测
- **WHEN** 项目已配置 JaCoCo 或 c8/coverage
- **THEN** 技能运行实测并输出行覆盖与分支覆盖数据

#### Scenario: 无工具链时降级
- **WHEN** 项目未配置任何覆盖度工具
- **THEN** 技能输出"specs Scenario → 用例"映射矩阵与未覆盖场景清单，并标注"未实测覆盖度"

#### Scenario: 覆盖度报告含未覆盖清单
- **WHEN** 技能输出覆盖度报告
- **THEN** 报告包含明确列出的未覆盖项（未覆盖的场景或未被任何用例引用的 Scenario）

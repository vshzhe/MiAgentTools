# init-project-scan 增量规格

## MODIFIED Requirements

### Requirement: 信号与候选分层

预扫描输出 SHALL 分为两个判定层级，且 **MUST NOT 输出框架结论**：

- **信号**：直接观察到的事实（如"发现 `build.xml`"、"发现 `DataBase.properties`"、"发现目录 `src/` 直挂"），维度含构建设施、源码骨架、配置键名、路由声明位置、既有文档，以及本次新增的**测试探针**（`signals.tests`）：
  - **测试目录探测**：对标准测试目录名（如 `test/`、`tests/`、`__tests__/`、`e2e/`、`spec/`）按存在性记录事实；
  - **测试文件名模式计数**：对既有命名模式（如 `*.test.*`、`*.spec.*`、`*Test.java`、`*Tests.java`、`*_test.go`）计数记录，触及扫描上限时 MUST 标注「上限所致」；
  - 测试探针 MUST 保持只读机械事实（目录名 / 文件名 / 计数），MUST NOT 读取测试代码内容，MUST NOT 输出「项目使用某测试框架」的结论。
- **候选**：可能的技术栈线索（如"发现 `spring-2.0.5.jar`"），MUST 显式标注为候选。

系统 MUST NOT 依据文件或 jar 的**存在**断言框架正在被使用 —— 存在与实际使用是两件事，框架结论 MUST 由语义扫描阶段结合源码实际使用情况判定。

#### Scenario: jar 存在但未被源码使用

- **WHEN** 项目 lib 目录含某框架 jar，但源码中该框架的 import 命中数为 0 或极少
- **THEN** 基线 SHALL 仅将该 jar 记为「候选」线索，MUST NOT 输出"项目使用该框架"的结论

#### Scenario: 观察到的事实记为信号

- **WHEN** 预扫描在项目根发现 `build.xml`
- **THEN** 基线 SHALL 将「发现 `build.xml`」记为信号（观察事实），并在需要时附带解析出的 target 名称

#### Scenario: 测试目录探针记录事实

- **WHEN** 项目根存在 `test/` 目录（且不在排除清单内）
- **THEN** 基线 SHALL 在 `signals.tests` 记录该测试目录事实，MUST NOT 因目录存在而断言测试框架

#### Scenario: 测试文件模式计数触上限

- **WHEN** 测试文件名模式命中超扫描上限
- **THEN** 基线 SHALL 记录部分计数并标注「上限所致」WARN 口径，MUST NOT 静默截断且 MUST NOT 以计数推断框架占比或结论

#### Scenario: 无测试探针时为空

- **WHEN** 项目未检出任何测试目录与测试文件名模式
- **THEN** `signals.tests` SHALL 为空（无内容即 NULL 语义），MUST NOT 生成"无测试"推断结论之外的编造条目

## Why

当前项目缺少一套结构化的单元测试能力。现有 `venus_tr_test_generate` 技能仅 50 行，描述过于简洁，缺少：
- 项目框架与测试框架自动检测
- 结构化的场景设计方法论（BCDE 场景矩阵）
- 分层测试编写指南（Service/Controller/Utils）
- 定位与运行测试的完整流程

同时，项目中已有 `skills/venus_java_unit_test/SKILL.md`（970 行）Java 单元测试技能快照，但未集成到正式技能体系，无法通过 `venus init` 安装使用。

将此能力系统化地迁移并融入当前项目，可补齐技能体系的重要缺口。

## What Changes

### 增强现有技能
- `venus_tr_test_generate`（type=tr_test）：从 50 行大幅扩充为 300+ 行结构化指令
  - 新增 BCDE 场景矩阵法、FIRST 原则、AAA 结构规范
  - 新增分层测试编写指南（TypeScript/Vitest 适配）
  - 新增反模式与避坑清单
  - 新增项目测试框架自动检测与风格对齐

### 新增 Java 专用技能
- `venus_tr_test_gentest_java`（type=tr_test_gentest）：970 行精华提炼的 400+ 行 Java 单元测试技能
  - 新增 `tr_test_gentest` 生命周期类型（SKILL_TYPES 第 10 类）
  - 5 阶段完整流程（项目检测→框架分析→测试计划→代码生成→运行验证）
  - JUnit 4/5 + Mockito + EasyMock 等多模板支持
  - 遗留 Java 项目测试策略
  - Maven/Gradle 依赖配置生成

### 基础设施变更
- DEFAULT_WORKFLOWS 从 7→9 项（加入 `tr-test-generate` 和 `tr-test-gentest-java`）
- 变更涉及 7 文件（config/registry/profiles/onboarding + 2 模板文件 + 测试）

## Capabilities

### New Capabilities
- `tr-test-gentest-java`: Java 项目单元测试生成（JUnit/Mockito 框架检测、Java 代码分析、JDK 版本适配）

### Modified Capabilities
- `tr-test-generate`: 从 50 行简洁指令增强为 300+ 行结构化测试生成技能，补充 BCDE 场景矩阵、FIRST 原则、分层测试编写指南、反模式清单

## Impact

### 直接影响的文件

- `src/core/config.ts`: 新增 `tr_test_gentest` 类型
- `src/core/templates/registry.ts`: 注册 Java 技能模板对
- `src/core/templates/workflows/tr-test.ts`: 大幅增强现有测试技能模板
- `src/core/templates/workflows/tr-test-gentest-java.ts`: **新建** Java 专用测试技能模板
- `src/core/profiles.ts`: DEFAULT_WORKFLOWS 7→9 项
- `src/commands/onboarding.ts`: 新增引导提示
- `test/profiles.test.ts`: 更新默认集长度断言 7→9

### 向后兼容
- 增强版 `tr_test_generate` 向前兼容——指令名、调用方式、id 均不变，仅内容扩充
- `tr_test_gentest` 为全新类型，无向后兼容问题
- 默认集扩展：从 7→9 项，已有项目已有显式 workflows 配置的不受影响；未配置的会自动获得两新技能

## 设计修订（v3.0 多 schema 合并，2026-09-16）

> 原方案将 Java 测试拆为独立技能 `venus_tr_test_gentest_java` + 独立类型 `tr_test_gentest`。
> 经实际使用后改为**多 schema 合并**模式：Java 能力并入 `venus_tr_test_generate`，
> 删除独立技能与类型。详见 design.md "设计修订" 段。

### 修订后的 What Changes

- **合并而非新增**：`venus_tr_test_generate` 重构为多 schema 模式（version 3.0）——主 SKILL 语言无关
  （检测路由 + BCDE + 通用规范 + 反模式），语言专属内容拆为 `references/schema-java.md` 与
  `references/schema-node.md` 按需 Read。
- **删除**：`venus_tr_test_gentest_java` 技能、`tr_test_gentest` 类型、`/venus:tr-test-gentest-java` 指令。
- **基础设施回退**：DEFAULT_WORKFLOWS 9→8 项；SKILL_TYPES 10→9 类；技能总数 26→25。
- **genfull 联动**：`tr-impl-genfull` Stage 3.3 委派对象改为 `venus_tr_test_generate`，DEPS 同步。

### 修订后的 Impact

- `src/core/config.ts`: 删除 `tr_test_gentest` 类型
- `src/core/templates/registry.ts`: 移除 Java 技能注册项
- `src/core/templates/workflows/tr-test.ts`: 重写为多 schema（含 references）
- `src/core/templates/workflows/tr-test-gentest-java.ts`: **删除**
- `src/core/profiles.ts`: DEFAULT_WORKFLOWS 9→8；genfull DEPS 替换
- `src/commands/onboarding.ts`: 两条 hint 合并为一条
- `src/core/templates/workflows/tr-impl-genfull.ts`: 3.3 子阶段委派对象 + compatibility 更新
- 多个测试文件：技能数/类型数/默认集长度断言更新（26→25、10→9、9→8）
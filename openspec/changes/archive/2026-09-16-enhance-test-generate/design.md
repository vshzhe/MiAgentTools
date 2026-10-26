## Context

当前项目（VenusAgentTools）的技能体系缺少结构化的单元测试生成能力。

### 相关代码

- `src/core/templates/workflows/tr-test.ts` — 现有 50 行通用测试技能模板
- `src/core/templates/registry.ts` — WORKFLOW_PAIRS 技能注册表
- `src/core/profiles.ts` — DEFAULT_WORKFLOWS 默认集 + DEPS 依赖注入
- `src/core/config.ts` — SkillType 定义
- `src/commands/onboarding.ts` — ONBOARDING_HINTS 引导提示

### 源参考

- `skills/venus_java_unit_test/SKILL.md` — 970 行 Java 单元测试技能（5 阶段）
- `docs/单元测试/Java单元测试技能与覆盖率提升指南.md`
- `docs/单元测试/Java单元测试完整技术栈规范与最佳实践.md`

### 受影响文件

| 文件 | 变更类型 | 影响面 |
|------|---------|--------|
| src/core/templates/workflows/tr-test.ts | MODIFY | 技能内容增强 50→300+ 行 |
| src/core/templates/workflows/tr-test-gentest-java.ts | CREATE | 新 Java 技能模板 |
| src/core/templates/registry.ts | MODIFY | 注册新技能对 |
| src/core/config.ts | MODIFY | 新增 SkillType |
| src/core/profiles.ts | MODIFY | 默认集 7→9 |
| src/commands/onboarding.ts | MODIFY | 新增引导提示 |
| test/profiles.test.ts | MODIFY | 测试断言更新 |
| skills/venus_tr_test_generate/SKILL.md | MODIFY | 快照生成（pnpm generate:skills） |

## Goals / Non-Goals

**Goals**:
- 大幅增强 `venus_tr_test_generate`（通用测试生成技能），补充结构化测试方法论
- 新增 `venus_tr_test_gentest_java`（Java 专用测试生成技能），集成 5 阶段完整流程
- 将 `tr-test-generate` 和 `tr-test-gentest-java` 加入默认安装集
- 保持向后兼容：现有指令名、调用方式不变

**Non-Goals**:
- 不改动现有 spec 系列的技能流程
- 不修改已有测试的运行方式
- 不添加编译/构建工具的变化
- 不修改 Java 技能快照的源文件（skills/venus_java_unit_test/SKILL.md）

## Decisions

### D1: 新类型 tr_test_gentest
- **选择**: 新增 `'tr_test_gentest'` 到 SkillType 联合类型和 SKILL_TYPES 数组
- **理由**: Java 技能与通用技能类型不同（语言特定），独立类型便于安装过滤和分类展示
- **备选**: 复用 `tr_test` 类型（A: 语义不精确，无法区分语言通用 vs Java 专用）

### D2: 默认集扩展（7→9）
- **选择**: 将 `tr-test-generate` 和 `tr-test-gentest-java` 加入 DEFAULT_WORKFLOWS
- **理由**: 测试生成是大多数项目的基本需求，默认安装让用户开箱即用
- **备选**: 仅加一个（A: 不够完整）；都不加（B: 需要用户手动 venus config 启用，发现门槛高）

### D3: 无依赖注入
- **选择**: 两者均不加入 DEPS 表
- **理由**: 测试生成技能独立可用，不依赖其他技能的输出，也不被其他技能依赖
- **备选**: 将 tr-test-generate 加入 tr-impl-feature 的 DEPS（A: 实现功能后不必然需要写测试）

### D4: 内容分割原则
- **选择**: BCDE/FIRST/AAA/反模式/覆盖率策略等语言无关内容入通用版；框架检测/JUnit/Mockito/Maven/遗留策略入 Java 版
- **理由**: 避免重复，职责清晰；每个技能自包含，不依赖另一个技能

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 增强后的 tr_test_generate 内容过长（300+ 行）可能影响 Claude Code 指令加载 | 保持结构化 Markdown 格式，使用标题分级便于 AI 快速定位 |
| Java 技能因项目无 pom.xml 而自动退出，用户可能困惑 | 退出信息中包含明确建议"请使用 /venus:tr-test-generate" |
| skills/ 快照漂移（修改模板后未运行 generate:skills） | AGENTS.md 修改守则第 1 条已有约束，skills-parity.test.ts 会阻断 CI |
| tr_test_gentest 新类型在 list 命令展示中可能显示异常 | 只需在 SKILL_TYPES 数组添加，list 命令自动适配（遍历 SKILL_TYPES） |

## 设计修订（v3.0 多 schema 合并，2026-09-16）

> 本段记录对原始决策 D1/D2/D4 的修订。原方案将 Java 测试拆为独立技能 `venus_tr_test_gentest_java` +
> 独立类型 `tr_test_gentest`；经实际使用后改为**多 schema 合并**模式，回退为单一技能。

### 修订背景

原方案两技能存在大量重复内容（BCDE 矩阵、命名规范、反模式清单），且"按语言选技能"的负担落在用户身上。
参照 `venus_tr_impl_frontend` 已确立的 references 架构先例（主 SKILL 承载设计决策，实现模板拆为
references/*.md 按需 Read），将测试生成重构为多 schema 模式。

### 修订决策

- **R1（推翻 D1）**：删除 `tr_test_gentest` 类型与 `venus_tr_test_gentest_java` 技能。Java 测试能力
  并入 `venus_tr_test_generate`（type 仍为 `tr_test`），不再独立类型。技能数 26→25，类型数 10→9。
- **R2（修订 D2）**：DEFAULT_WORKFLOWS 从 9 项回退为 8 项（移除 `tr-test-gentest-java`，
  保留 `tr-test-generate`）。
- **R3（修订 D4）**：内容分割从"两技能自包含"改为"主 SKILL 语言无关 + references/schema-*.md 按需加载"：
  - 主 SKILL：语言/框架检测路由 + BCDE 场景矩阵 + 分层测试策略 + 通用编写规范 + 反模式清单（语言无关版）
  - `references/schema-java.md`：原 gentest_java 全部 Java 专属内容（项目类型判定/框架分析/7级位置扫描/模板A-F/遗留策略/mvn 命令/Java 约束）
  - `references/schema-node.md`：原 test_generate 的 TS 专属内容（vitest/jest 检测/分层 TS 示例/pnpm 命令/Node 约束）
- **R4**：`tr-impl-genfull` Stage 3.3 Java 测试子阶段委派对象由 `venus_tr_test_gentest_java`
  改为 `venus_tr_test_generate`（多 schema 自动检测 Java）；DEPS 中 genfull 依赖同步替换。

### 扩展性收益

新语言扩展从"新建类型 + 新建技能 + 注册 + 文档章节"降为"新增一个 schema 文件 + 主 SKILL 路由表加一行"，
对称且零类型系统改动。

### 向后兼容

`/venus:tr-test-generate` 指令名与调用方式不变（仅内容扩充为多 schema）。`/venus:tr-test-gentest-java`
指令被移除——已安装该技能的项目运行 `venus update` 后会清理残留目录与指令文件。
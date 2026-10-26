# 探索：单元测试功能迁移与增强

## Background

将 skills/venus_java_unit_test（Java 单元测试生成技能，970 行，5 阶段完整流程）与 docs/单元测试/ 下的规则文档中的最佳实践，迁移到当前项目，增强现有的 venus_tr_test_generate 技能（当前为简洁版 50 行），并对不合理的地方进行调整优化。

当前项目为 TypeScript CLI（VenusAgentTools），使用 Vitest 作为测试框架。

## 术语表

| 术语 | 定义 | 避免使用 |
|------|------|---------|
| **tr_test_generate** | venus 中测试生成类型的现有技能，id=tr-test-generate | test skill、旧名 |
| **tr_test_gentest** | 新增 venus 技能生命周期类型（SKILL_TYPES 第 10 类），用于语言特定测试生成 | 测试类型（宽泛） |
| **tr-test-gentest-java** | venus_tr_test_gentest_java 的指令 id，Java 项目专用单元测试技能 | java-test（非规范） |
| **单元测试** | 针对最小可测试单元（单个类/方法）的逻辑验证，隔离所有外部依赖 | 单测 |
| **AAA** | Arrange-Act-Assert 三段式结构，等价于 Given-When-Then | — |
| **BCDE 原则** | 场景矩阵法：正常(Basic)/边界(Boundary)/设计(Design)/异常(Exception) | — |

## Codebase Findings

### 源技能：venus_java_unit_test（Java 焦点）
- 位置：`skills/venus_java_unit_test/SKILL.md`
- 5 阶段流程：项目检测 → 框架分析 → 测试计划 → 代码生成 → 运行验证
- 6 套测试模板（JUnit 4/5 + Mockito/EasyMock + Controller/Util）
- 遗留代码测试策略
- 位置确认流程（7 级优先级扫描）

### 规则文档
- `docs/单元测试/Java单元测试技能与覆盖率提升指南.md`：8 章节最佳实践
- `docs/单元测试/Java单元测试完整技术栈规范与最佳实践.md`：10 章节技术规范

### 当前项目测试架构
- 框架：Vitest（vitest.config.ts，`test/` 目录，node 环境）
- 现有技能：`venus_tr_test_generate`（~50 行，4 步骤）
- 现有风格：`describe/it/expect` + Given-When-Then
- 源码：75 个 TypeScript 文件，617 个节点
- 项目类型：CLI 工具（Commander.js + ESM）

### 能力探索记忆（注入）
skill-profile 探索记忆无直接与 test/generate 相关的历史决策。

## Decisions

### D1: 技能架构（双轨制）
- 增强现有 `venus_tr_test_generate`（type=tr_test）→ 语言无关通用测试技能
- 新创建 `venus_tr_test_gentest_java`（type=tr_test_gentest）→ Java 项目专用测试技能
- 内容分割：语言无关（BCDE/FIRST/AAA/反模式）入通用版；Java 专属（JUnit/Mockito/框架检测/Maven）入 Java 版

### D2: 新类型 tr_test_gentest
- 在 `src/core/config.ts` 的 SkillType 联合类型和 SKILL_TYPES 数组中新增 `'tr_test_gentest'`
- 描述定位：语言特定单元测试生成（Java 等）
- 指令 id 派生规则不变：`venus_tr_test_gentest_java` → `tr-test-gentest-java`

### D3: 默认集扩展
- `tr-test-generate`（增强版）加入 DEFAULT_WORKFLOWS
- `tr-test-gentest-java` 加入 DEFAULT_WORKFLOWS → 默认集从 7→9 项
- 两者均无依赖注入关系（DEPS 表无需变更）

### D4: 异常处理策略
- 非 Java 项目调用 Java 技能 → 检测后提示错误，建议使用通用版
- 用户未指定目标 → 自动扫描源码，输出候选清单让用户选择
- 同名测试文件冲突 → 询问覆盖/追加/跳过，默认跳过
- 非标准 Maven 结构 → 7 级优先级扫描自动推荐最优位置

### D5: 一致性变更范围（6 文件）
| 文件 | 变更 |
|------|------|
| src/core/config.ts | 新增 tr_test_gentest 类型 |
| src/core/templates/registry.ts | 新增一对技能+指令模板 |
| src/core/templates/workflows/tr-test.ts | 大幅增强模板内容 |
| src/core/templates/workflows/tr-test-gentest-java.ts | 新建 Java 专用模板 |
| src/core/profiles.ts | 默认集 7→9 项 |
| src/commands/onboarding.ts | 新增引导提示 |
| test/profiles.test.ts | length 断言 7→9 |

## Questions

### L1: 意图确认
- Q: 增强现有技能还是新增 Java 技能？
- A: **两者都要** — 增强现有 + 新增 Java 技能

### L2: 方案确认
- Q: 新技能类型与名称？
- A: 类型 `tr_test_gentest`，名称 `venus_tr_test_gentest_java`
- Q: 内容分割方案？
- A: 按"语言无关 vs Java 专属"分割（同意推荐方案）
- Q: 默认加入安装集？
- A: **新 Java 技能入默认集**；增强后 tr-test-generate 也入默认集（共 9 项）

### L3: 异常处理确认
- 非 Java 项目调用 → 提示错误退出（同意推荐）
- 未指定目标 → 自动扫描 + 用户选择（同意推荐）
- 文件冲突 → 询问覆盖/追加/跳过（同意推荐）

### L4: 一致性确认
- 6 文件变更清单（config/registry/tr-test/tr-test-gentest-java/profiles/onboarding/test）
- 默认集 7→9（profiles.test.ts 需要同步更新）
- 确认通过

### L5: 边界场景确认
- 非标准 Maven 结构 7 级优先级扫描（同意推荐）
- 确认通过

## 边界场景

- [ ] 非 Node.js 项目中增强版 tr_test_generate 的运行命令检测（fallback 到通用描述）
- [ ] 非 Java 项目中调用 tr-test-gentest-java 的错误提示与自动建议
- [ ] JUnit 4 vs JUnit 5 混合项目（Java 技能中的检测逻辑）
- [ ] 增强版 tr_test_generate 中 Vitest 专属模板 vs 通用测试指导

## Pending

### For Phase 2 Impact Analysis
- `getTrTestGenerateSkillTemplate` (src/core/templates/workflows/tr-test.ts:6) — 需大幅增强
- `getTrTestGenerateCommandTemplate` (src/core/templates/workflows/tr-test.ts:58) — 需同步更新
- `src/core/config.ts:SkillType` — 新增类型
- `src/core/profiles.ts:DEFAULT_WORKFLOWS` — 默认集扩展

### Unresolved Decisions
（无 — 所有决策已确认）

## 架构决策

- ADR-0002: 测试技能双轨制 — 通用测试技能增强 + Java 专用技能新增
  File: `openspec/docs/adr/0002-dual-test-skill-architecture.md`
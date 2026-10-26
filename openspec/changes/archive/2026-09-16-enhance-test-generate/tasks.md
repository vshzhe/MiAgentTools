# Tasks: enhance-test-generate

## 1. 基础设施变更

- [x] 1.1 [代码] 在 `src/core/config.ts` 新增 `tr_test_gentest` 类型
  - 文件：`src/core/config.ts`
  - 操作：SkillType 联合类型追加 `\| 'tr_test_gentest'`；SKILL_TYPES 数组追加 `{ id: 'tr_test_gentest', name: 'Java 测试', description: '语言特定运行测试生成：Java 项目单元测试' }`
  - 验证：TS 编译通过；`venus list` 展示中可见 Java 测试分类

- [x] 1.2 [代码] 扩展 DEFAULT_WORKFLOWS 加入新技能
  - 文件：`src/core/profiles.ts`
  - 操作：DEFAULT_WORKFLOWS 追加 `'tr-test-generate'` 和 `'tr-test-gentest-java'`（共 9 项）
  - 验证：单元测试 1.3 验证通过

- [x] 1.3 [代码] 更新 profiles.test.ts 默认集长度断言
  - 文件：`test/profiles.test.ts`
  - 操作：第 13 行 `toBe(7)` → `toBe(9)`
  - 验证：pnpm test 中 profiles 测试全通过

- [x] 1.4 [代码] 在 onboarding.ts 新增引导提示
  - 文件：`src/commands/onboarding.ts`
  - 操作：ONBOARDING_HINTS 追加两条（tr-test-generate 和 tr-test-gentest-java）
  - 验证：pnpm build 通过

## 2. 增强现有测试技能（venus_tr_test_generate）

- [x] 2.1 [代码] 重写 `src/core/templates/workflows/tr-test.ts` 的 skill 模板
  - 文件：`src/core/templates/workflows/tr-test.ts`
  - 内容：
    - 阶段一：项目检测（package.json / vitest / jest / 自定义）
    - 阶段二：场景设计（BCDE 场景矩阵法）
    - 阶段三：分层测试指导（Utils/Service/Controller）
    - 阶段四：代码生成（AAA 结构、参数化测试、断言规范）
    - 阶段五：运行验证（pnpm test）
    - 反模式清单与约束
  - 验证：`pnpm build` 通过

- [x] 2.2 [代码] 同步更新 command 模板
  - 文件：`src/core/templates/workflows/tr-test.ts`
  - 操作：getTrTestGenerateCommandTemplate 内容与 skill 版同步增强（压缩版）
  - 验证：`pnpm build` 通过

## 3. 新建 Java 专属测试技能（venus_tr_test_gentest_java）

- [x] 3.1 [代码] 创建 `src/core/templates/workflows/tr-test-gentest-java.ts`
  - 文件：`src/core/templates/workflows/tr-test-gentest-java.ts`（新建）
  - 内容：含 5 阶段完整流程
    - 阶段一：Java 项目检测（Maven/Gradle/Spring Boot/传统 Web）
    - 阶段二：测试框架分析报告（JUnit 4/5、Mockito、AssertJ、JaCoCo）
    - 阶段三：测试计划（BCDE 场景矩阵 + 7 级位置扫描）
    - 阶段四：代码生成（6 套模板 + 遗留策略）
    - 阶段五：运行验证（mvn test / gradle test）
    - 约束与最佳实践
  - 验证：`pnpm build` 通过

- [x] 3.2 [代码] 在 registry.ts 注册新技能对
  - 文件：`src/core/templates/registry.ts`
  - 操作：import 新模板函数；在 WORKFLOW_PAIRS 追加 `{ skill: getTrTestGentestJavaSkillTemplate(), command: getTrTestGentestJavaCommandTemplate() }`
  - 验证：`pnpm build` 通过

## 4. 快照与最终验证

- [x] 4.1 [代码] 重新生成 skills/ 快照
  - 操作：运行 `pnpm build && pnpm generate:skills`
  - 验证：快照一致性测试通过（`test/skills-parity.test.ts`）

- [x] 4.2 [使用说明] 技能使用说明
  - 产出：`attachments/test-skill-usage-guide.md`
  - 内容：两个技能的使用场景区分、参数说明、常见问题
  - 验证：文档可读
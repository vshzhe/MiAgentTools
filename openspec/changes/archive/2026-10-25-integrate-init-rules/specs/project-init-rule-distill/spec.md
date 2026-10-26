# project-init-rule-distill 增量规格

## ADDED Requirements

### Requirement: 规则蒸馏步骤（文档完成时点触发）

`iagent_project_init` 技能 SHALL 在项目信息产出流程（五类 docs/project 文档落盘、`AGENTS.md` 生成/对齐、`context` 回写）**完成之后**执行「实现/测试规则蒸馏」步骤（触发顺序：文档 → AGENTS.md → context → rules）。蒸馏输入 SHALL 为：扫描基线 `signals`（含新增测试探针维度）/ `candidates`、五类 docs/project 文档、`AGENTS.md` 与既有 `.iagent/config.yaml`；证据不足的维度 SHALL 按零猜测规则补扫（Glob / Grep / Read）。蒸馏产出 SHALL 写入 `.iagent/rules/coding-rules.md` 与 `.iagent/rules/testing-rules.md` 的**人工域标记区间内**（实现类项目特异性约定与测试类约定各归其位）；目标文件缺失时 SHALL 先按 init 同源模板常量创建（含标记骨架）再写入，并记 WARN 说明为运行中补建；目标文件存在但**不含人工域标记对**时 SHALL 在常量块之后追加一对空人工域骨架区间并记 WARN，再把蒸馏行写入该区间，MUST NOT 改写常量块（亦 MUST NOT 依赖用户先跑 `iagent update`）。技能扫描步骤失败或文件写入失败一律记 WARN 继续，MUST NOT 中断流程（沿用扫描全程非阻断约束）。蒸馏步骤 MUST NOT 需要技能委派或新增工具授权（写入动作用既有 Write）。

#### Scenario: 文档完成时点触发蒸馏

- **WHEN** 技能已完成五类文档落盘、`AGENTS.md` 处理与 `context` 回写
- **THEN** 技能 SHALL 执行规则蒸馏步骤并更新两个语义名规则文件的人工域区间

#### Scenario: 目标文件缺失时补建

- **WHEN** `testing-rules.md` 不存在（项目未跑过 init 的规则生成或文件被删）
- **THEN** 技能 SHALL 按模板常量创建该文件（含标记骨架）、写入蒸馏行并记 WARN，MUST NOT 终止流程

#### Scenario: 目标文件存在但无人工域区间

- **WHEN** 实现/测试规则文件已存在且不含人工域标记对
- **THEN** 技能 SHALL 在常量块之后追加一对空人工域骨架区间并记 WARN，再把蒸馏行写入该区间；MUST NOT 改写常量块

#### Scenario: 蒸馏写入人工域保护生效

- **WHEN** 语义名文件的人工域标记区间已含用户先前手写规则
- **THEN** 技能写入蒸馏行时 MUST 逐字保留区间内既有内容，仅在区间内追加或整合，MUST NOT 覆盖区间外常量域

### Requirement: 测试规则蒸馏与占位兜底

测试类规则行的主体 SHALL 由技能**扫描既有测试代码**（测试框架、命名约定、目录约定）蒸馏得来；项目无任何测试代码时 SHALL 以「（待补充）测试框架与既有用例保持一致」类占位行兜底。基于可用证据，技能 MUST NOT 编造测试框架名、版本或不存在约定（零猜测）；框架判定区别于依赖存在（候选不等于使用）。

#### Scenario: 有测试代码时蒸馏

- **WHEN** 项目存在测试代码（如含测试框架依赖声明与 `*Test.java` / `test/`、`__tests__/` 目录结构）
- **THEN** 技能 SHALL 把框架、命名与目录约定蒸馏为规则行写入 `testing-rules.md` 人工域区间

#### Scenario: 无测试代码时占位兜底

- **WHEN** 项目未探测到任何测试代码或测试目录
- **THEN** 技能 SHALL 保留兜底占位行并在汇报中注明「未发现测试代码，规则为占位」，MUST NOT 编造框架或约定

#### Scenario: 候选依赖不作使用断言

- **WHEN** 依赖清单或目录中存在某测试框架条目但源码/测试代码无实际使用证据
- **THEN** 技能 SHALL 仅列候选，MUST NOT 写出「项目使用该框架」类规则行

### Requirement: 蒸馏内容跨宿主统一

规则文件内容为**项目约束语义**，MUST NOT 引入宿主差异化分支或宿主目录（`.claude/` / `.pi/` / `.opencode/`）特定写法；宿主差异由既有适配层（`rewriteCommandRefs` / `adaptSkillContentForHost`）承担，rule 文件本身跨宿主同一套内容（D-Q8）。

#### Scenario: 多宿主项目同一内容

- **WHEN** 项目同时安装 claude / pi / opencode 三宿主产物并运行规则蒸馏
- **THEN** `.iagent/rules/` 的语义名文件 SHALL 保持同一份内容，MUST NOT 按宿主分叉或包含宿主专属路径引用

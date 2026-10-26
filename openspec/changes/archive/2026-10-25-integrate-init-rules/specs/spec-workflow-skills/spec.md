# spec-workflow-skills 增量规格

## MODIFIED Requirements

### Requirement: spec 技能类型注册

MiAgentTools SHALL 新增第 8 个生命周期类型 `spec`（名称：规格），扩展 SkillType 联合类型与 SKILL_TYPES 注册表；6 个 spec 技能 SHALL 成对（SkillTemplate + CommandTemplate）注册到 WORKFLOW_PAIRS，命名遵循现有派生规则（`iagent_spec_<name>` → 指令 `spec-<name>`）。成对注册中的 `CommandTemplate.content` SHALL 由派生函数从对应 `SkillTemplate.instructions`（唯一源）生成，SHALL NOT 以独立维护的字符串形式存在（消除"两份模板均为手工维护一等制品"的历史读法）。

`iagent init` 为 spec 类型项目规则生成的默认文件 SHALL 是 **`.iagent/rules/spec.md`**（类型→语义名映射中 `spec` 显式保留原名）；MUST NOT 生成以技能名命名的规则文件（如 `spec_propose.md`）。

#### Scenario: init 安装 6 个 spec 技能

- **WHEN** 在全新项目运行 `iagent init`
- **THEN** 6 个技能安装到 `.claude/skills/`（iagent_spec_explore / iagent_spec_propose / iagent_spec_apply / iagent_spec_archive / iagent_spec_verify / iagent_spec_verify_proposal），6 个指令安装到 `.claude/commands/iagent/`（spec-explore.md ~ spec-verify-proposal.md），指令正文为派生生成的 command content

#### Scenario: 成对注册与单一源派生共存

- **WHEN** spec-*.ts 的模板对注册到 WORKFLOW_PAIRS
- **THEN** 注册结构仍为 { skill: SkillTemplate, command: CommandTemplate } 成对形式，但 command 的 content 字段在注册时即由派生函数从 skill.instructions 生成，源码中不存在第二份手工维护的同名正文字符串

#### Scenario: list 分组展示

- **WHEN** 运行 `iagent list`
- **THEN** 输出含"规格"分组，展示 6 个 spec 技能，与现有 7 类 tr_* 分组并列

#### Scenario: validate 校验 spec 类型

- **WHEN** 运行 `iagent validate` 且 spec 技能已安装
- **THEN** 6 个技能通过类型校验（frontmatter metadata.type=spec 属于合法类型）

#### Scenario: 指令 id 派生

- **WHEN** 技能名为 iagent_spec_verify_proposal
- **THEN** deriveCommandId 派生指令 id 为 spec-verify-proposal（下划线转连字符、去 iagent 前缀）

#### Scenario: init 生成 spec 规则文件

- **WHEN** 首次运行 `iagent init`（配置刚创建）
- **THEN** `.iagent/rules/` 下生成 `spec.md` 规则文件（spec 类型项目规则，经类型→语义名映射派生；MUST NOT 生成 `spec_propose.md` 一类以技能名命名的规则文件）

#### Scenario: 与 impl 技能触发区分

- **WHEN** 用户请求实现功能且技能需要被选择
- **THEN** impl 适用于用户直接描述需求的即时代码实现；spec_apply 适用于 openspec/changes/ 下已有变更制品（proposal/specs/design/tasks）的规格驱动实现，两者的 description MUST 明确表达该边界

### Requirement: spec-apply 派发协议与共享资源协议

`iagent_spec_apply` SHALL 在批次调度中建立**共享资源协议**，使每个子代理的上下文消耗与派发单元数解耦：协调者一次性产出共享制品，子代理只读共享制品而非各自重读变更制品。

**派发协议（补齐既有规格缺口）**：批次由**派发单元**构成 —— 同一 `group` 标签的任务聚为一个单元，单元内任务由同一子代理按序串行实现。技能 SHALL 每单元派发一个子代理（Agent/Task 工具），同时运行的子代理数 MUST NOT 超过 `openspec/config.yaml` 的 `apply.concurrency`（缺省 3，非法值回退 3 并告警），并 SHALL 采用滑动窗口派发。跨派发单元会修改同一文件的任务 MUST 从并发组拆出串行执行。运行时不提供子代理分派工具时 SHALL 降级为全串行实现并告知用户。任务勾选与失败重试 SHALL 由协调者集中管理，子代理 MUST NOT 修改 tasks.md。

**共享资源协议（四载体）**：

- **共享上下文包**：协调者 SHALL 在设计确认后、**首次派发前一次性**产出 `context-pack.md` 于流程级临时工作区，含六节 —— `## 变更摘要`（proposal Why/What 蒸馏）、`## 契约`（接口签名 / 数据结构 / 表字段，由 specs + design 蒸馏）、`## 规范要点`（**项目侧** `.iagent/rules/coding-rules.md` 的关键防护摘要，协调者蒸馏一次；该文件为 `openspec/rules/ai-coding.md` 要点经 `iagent init` 蒸馏的产物）、`## 文件归属表`（派发单元 → 允许改动的文件）、`## Codebase 摘要`（协调者预扫描结论）、`## 已产出（跨单元可见）`。上下文包是子代理的**唯一必读制品**；产出后 MUST NOT 整包重产。
- **产出登记表**：每批完成后协调者 SHALL 向 `## 已产出（跨单元可见）` 节**追加**该批产出文件与公开签名，使后续批次子代理无需重扫代码即可获知前序产出。
- **回执最小化**：子代理回执 SHALL 采用固定格式 `<任务 id> | <状态> | <产出文件> | <公开签名>`，MUST NOT 粘贴代码正文；失败任务回执仍 MUST 含失败原因摘要。协调者 SHALL 据回执更新 tasks.md 与登记表。**「公开签名」定义**：该单元产出中**可被其他单元引用**的符号签名 —— 函数 / 方法 / 类型 / 接口 / 导出常量 / CLI 命令（含参数与返回类型）的声明行；无此类产出时记「无」。
- **共享指令前缀**：调度指令 SHALL 采用固定顺序「共享前缀（包路径 / 规范要点引用 / 回执格式 / 禁止项）→ 单元差异（本单元任务清单）」，使前缀在同一流程内跨派发字节一致。

**调度指令瘦身**：调度指令 MUST 含「上下文包路径 + 本单元任务清单（含每任务全量细节与 Spec Ref）+ 回执格式 + 禁止项」，MUST NOT 再内联 coding 规范摘要全文（改引用包 `## 规范要点` 节）。任务细节 MUST 保持在指令内联，使子代理无需读 tasks.md。

**禁止项与包缺口回执**：子代理 MUST NOT 重读 proposal/specs/design（包已覆盖）与重跑包已覆盖的 CodeGraph 查询；MAY 查询包未覆盖内容，但回执 MUST 附**包缺口回执**（缺什么、补查了什么），协调者 SHALL 据此回填包，回填失败记 WARN 且 MUST NOT 阻断。包是制品的**蒸馏视图**而非替代品：包缺项时子代理 MUST 补查制品本身，MUST NOT 凭包内容猜测字段或契约。

**fail-safe 降级**：工作区不可写 / 包产出失败 / **项目无 `.iagent/rules/coding-rules.md`** 时，技能 SHALL **退化为既有内联注入行为**并记 WARN，MUST NOT 阻断实现；流程级临时工作区不可写时先回退系统临时目录，再失败方退化。

**批次形态豁免**：批次含少于 2 个派发单元时，协调者 SHALL 直接实现，MUST NOT 派发子代理且 MUST NOT 产出上下文包。`auto-mode=true` 只跳过设计确认门，共享资源协议 SHALL 照常生效。

#### Scenario: 上下文包一次性产出

- **WHEN** 批次含 2 个及以上派发单元且即将首次派发
- **THEN** 协调者在流程级临时工作区产出 `context-pack.md`，含变更摘要 / 契约 / 规范要点 / 文件归属表 / Codebase 摘要 / 已产出六节；后续批次 MUST NOT 重产整包

#### Scenario: 调度指令瘦身与唯一必读制品

- **WHEN** 协调者构造某派发单元的调度指令
- **THEN** 指令含包路径、本单元任务清单、回执格式与禁止项，**不含** coding 规范摘要全文；子代理按「读包 + 本单元任务清单」即可开工，无需读 proposal/specs/design

#### Scenario: 产出登记表跨批共享

- **WHEN** 一批的多个派发单元全部返回且协调者完成校验
- **THEN** 协调者把该批产出文件与公开签名追加进包 `## 已产出（跨单元可见）` 节；下一批子代理读包即可获知前序产出，无需重扫代码

#### Scenario: 回执最小化

- **WHEN** 子代理完成其派发单元
- **THEN** 回执为 `<任务 id> | <状态> | <产出文件> | <公开签名>` 四列格式，不含代码正文；失败任务额外含失败原因摘要

#### Scenario: 共享指令前缀字节一致

- **WHEN** 同一流程向内多次派发不同派发单元
- **THEN** 各次调度指令的共享前缀部分（包路径 / 规范要点引用 / 回执格式 / 禁止项）字节一致，仅单元差异部分不同

#### Scenario: 禁止重读与禁止重跑已覆盖查询

- **WHEN** 子代理收到含上下文包的调度指令
- **THEN** 子代理 MUST NOT 重读 proposal/specs/design，MUST NOT 重跑包已覆盖的 CodeGraph 查询

#### Scenario: 空值处置不留空不编造

- **WHEN** 变更不涉及接口 / 数据结构 / 表字段，或某派发单元无可被其他单元引用的符号
- **THEN** 包 `## 契约` 节相应位置与回执「公开签名」列记「无」，MUST NOT 留空、MUST NOT 编造签名

#### Scenario: 包缺口回执与回填

- **WHEN** 子代理发现上下文包未覆盖其所需信息
- **THEN** 子代理 MAY 补查，但回执 MUST 附包缺口回执（缺什么、补查了什么）；协调者据此回填包，回填失败记 WARN 且不阻断流程

#### Scenario: 包机制失效 fail-safe 降级

- **WHEN** 临时工作区不可写、包产出失败，或项目无 `.iagent/rules/coding-rules.md`
- **THEN** 技能退化为既有内联注入行为并记 WARN，实现流程 MUST NOT 被阻断

#### Scenario: 单任务批次不产出包

- **WHEN** 批次含少于 2 个派发单元
- **THEN** 协调者直接实现该任务，不派发子代理，不产出上下文包

#### Scenario: auto-mode 不豁免共享资源协议

- **WHEN** 技能以 `auto-mode=true` 被调用（如 auto-workflow Phase 4）
- **THEN** 设计确认门被跳过，但上下文包产出、产出登记表、回执最小化与共享指令前缀均照常生效

#### Scenario: 派发单元与并发上限

- **WHEN** 批次含多个派发单元
- **THEN** 技能每单元派发一个子代理，同时运行数不超过 `apply.concurrency`（缺省 3），并采用滑动窗口派发；`apply.concurrency` 非法（非正整数）时告警并回退为 3

#### Scenario: 跨单元同文件拆出并发组

- **WHEN** 不同派发单元的任务会修改同一文件
- **THEN** 该任务从并发组拆出、串行执行；文件归属表须反映该拆分结果

#### Scenario: 无子代理能力的运行时降级

- **WHEN** 运行时不提供子代理分派工具
- **THEN** 技能降级为全串行实现并告知用户

#### Scenario: 任务勾选与失败重试由协调者集中管理

- **WHEN** 某个派发单元返回
- **THEN** 协调者按任务要求校验结果后集中更新 tasks.md 勾选（仅确认完整实现者勾选），子代理 MUST NOT 修改 tasks.md；某任务失败时协调者串行重试一次，仍失败则暂停并报告

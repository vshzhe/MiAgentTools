# project-init-skill-dispatch 能力规格（delta）

## ADDED Requirements

### Requirement: 并发派发两侧生成侧技能

project-init 第 11 步 SHALL 在宿主具备子代理派发能力时，经 `${SUBAGENT_DISPATCH}`（`Agent, Task` 双写共享常量）**并发**派发 `frontend-skill-gen` 与 `backend-skill-gen` 两个子代理；委派指令只传 Stage Envelope 式最小输入（扫描基线路径 / 五类文档路径 / config 路径 / 输出路径），不内联制品正文 (D3)。

#### Scenario: 具备子代理能力时并发派发
- **WHEN** project-init 执行到第 11 步且宿主具备子代理派发能力
- **THEN** 同一回合并发启动前端、后端两个子代理，各生成对应侧项目技能文件，委派输入仅含路径与结构化字段

### Requirement: 降级串行执行

宿主不具备子代理能力或派发失败（自动重试一次后仍失败）时，project-init SHALL 降级为主 agent 串行内联执行该侧蒸馏协议，并在报告标注「降级路径（非并发）」；degraded 状态 MUST NOT 被表述为已并发委派 (D3/D6)。

#### Scenario: 无子代理能力降级
- **WHEN** 宿主无子代理派发能力
- **THEN** 主 agent 串行内联执行两侧蒸馏，报告标注降级路径，流程继续非阻断

#### Scenario: 派发失败重试后降级
- **WHEN** 某侧子代理派发失败且自动重试一次仍失败
- **THEN** 该侧降级为主 agent 内联执行，另一侧不受影响

### Requirement: config 注册单点串行

两个子代理 SHALL 只写各自 `.iagent/skills/<side>-*.md`（及前端设计模板）文件，MUST NOT 写 `.iagent/config.yaml`；project-init SHALL 在两侧全部完成后**单点串行**执行注册：逐行段替换幂等追加成功侧条目到 `skills:` 对应角色组；注册失败记 WARN 不回滚已生成文件 (D4)。

#### Scenario: 子代理不写 config
- **WHEN** 子代理完成生成
- **THEN** 其产出仅含技能文件（与设计模板）与回执，config.yaml 未被其修改

#### Scenario: 注册幂等且失败不回滚
- **WHEN** project-init 执行单点注册
- **THEN** 已登记条目不重复；注册失败时记 WARN，已生成的技能文件保留

### Requirement: 单侧失败隔离

单侧子代理失败或证据不足时 SHALL 只影响该侧：该侧不生成并报告原因，另一侧继续完成；config 注册只登记成功侧；全流程保持非阻断 (D6)。

#### Scenario: 单侧失败另一侧继续
- **WHEN** 前端侧子代理失败（重试与降级后仍失败）而后端侧正常
- **THEN** 后端侧技能正常生成并注册，报告呈现前端侧失败原因，流程不中断

### Requirement: 汇总报告

project-init SHALL 在第 11 步末尾输出汇总报告：逐侧生成文件、C1-C6 结论、设计模板清单（前端侧）、不适用项依据、冲突项、降级与失败原因 (D2/D8)。

#### Scenario: 报告呈现两侧结论与模板清单
- **WHEN** 第 11 步执行完成（含部分失败情形）
- **THEN** 报告逐侧列出产物与结论，未生成侧写明原因，前端侧含设计模板清单或未生成依据

### Requirement: 固定顺序保持

技能蒸馏编排 SHALL 维持既有固定触发顺序：五类文档 → AGENTS.md → context 回写 → 规则蒸馏 → 技能蒸馏；生成侧技能的派发 MUST NOT 先于第 10 步规则蒸馏完成 (D1)。

#### Scenario: 技能蒸馏在规则蒸馏之后
- **WHEN** project-init 执行第 11 步
- **THEN** 派发输入引用的第 9/10 步产物（config context、rules 文件）已存在，顺序断言可在模板正文中核验

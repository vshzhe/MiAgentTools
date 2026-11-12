# skill-gen-workflows 能力规格（delta）

## ADDED Requirements

### Requirement: 前端生成侧技能独立调用

系统 SHALL 提供独立技能模板 `iagent_frontend_skill_gen`（workflowId `frontend-skill-gen`，类型 `init`，成对斜杠指令 `/iagent:frontend-skill-gen` 自动派生），用户在目标项目上不经 project-init 即可单独调用，执行前端侧证据判定 → 生成项目技能 → 前端设计模板生成 → C1-C6 自检 → 自身注册 → 单侧报告 (D1/D5/D8)。

#### Scenario: 独立调用生成前端技能与设计模板
- **WHEN** 用户在具备前端证据的目标项目直接调用 `/iagent:frontend-skill-gen`
- **THEN** 生成 `.iagent/skills/frontend-design.md`（或按既有拆分条件的 design/implement 两文件）与设计模板 `.iagent/templates/frontend/`（页面骨架 / 弹窗骨架 / 数据交换约定），并幂等注册到 `.iagent/config.yaml` 的 `skills:` frontend 组

#### Scenario: 证据不足该侧不生成
- **WHEN** 目标项目无任何前端证据（基线 signals/candidates、五类文档、源码补扫均无命中）
- **THEN** 该侧不生成任何文件，MUST NOT 造占位空壳，报告写明「证据不足」原因 (D6)

### Requirement: 后端生成侧技能独立调用

系统 SHALL 提供独立技能模板 `iagent_backend_skill_gen`（workflowId `backend-skill-gen`，类型 `init`，成对斜杠指令 `/iagent:backend-skill-gen`），独立调用语义与前端侧同构，但无设计模板产出 (D1/D5)。

#### Scenario: 独立调用生成后端技能
- **WHEN** 用户在具备后端证据的目标项目直接调用 `/iagent:backend-skill-gen`
- **THEN** 生成 `.iagent/skills/backend-design.md`（或按既有拆分条件的两文件），幂等注册到 `skills:` backend 组并输出单侧报告

#### Scenario: 后端证据不足不生成
- **WHEN** 目标项目无后端证据
- **THEN** 该侧不生成任何文件并报告原因

### Requirement: 生成范围细化清单

两个生成侧技能模板正文 SHALL 携带单侧**扫描维度清单**作为生成内容范围的约束：前端侧覆盖前端框架、常用组件设计（选择框、下拉框、复选框、tree、单选框）、分页、table、前后端交互逻辑、新能力 vs 历史能力注意事项、页面设计、弹窗设计；后端侧覆盖技术框架、数据库设计、MVC 架构设计、接口设计、前后端接口交互、网络安全 (D2/D8)。清单是扫描维度而非内容模板：生成内容 MUST 受 C1-C6 证据约束，无证据维度标「不适用 + 探测依据」(D2)。

#### Scenario: 前端范围清单覆盖
- **WHEN** 审阅 `frontend-skill-gen` 模板正文的扫描维度清单
- **THEN** 清单逐项列出前端框架、五类常用组件、分页、table、前后端交互逻辑、新能力 vs 历史能力注意事项、页面设计、弹窗设计，且每项注明证据来源要求

#### Scenario: 后端范围清单覆盖
- **WHEN** 审阅 `backend-skill-gen` 模板正文的扫描维度清单
- **THEN** 清单逐项列出技术框架、数据库设计、MVC 架构、接口设计、前后端接口交互、网络安全，且每项注明证据来源要求

#### Scenario: 无证据维度标不适用
- **WHEN** 清单某维度在目标项目无证据（如项目无弹窗场景）
- **THEN** 生成产物在对应章节写「不适用 + 探测依据」，MUST NOT 编造内容，MUST NOT 留空

### Requirement: 前端设计模板生成

前端生成侧技能 SHALL 在具备 UI 证据时按目标项目蒸馏生成设计模板，供后续页面生成、弹窗生成、主页面与弹窗页面数据交换等技能读取复用；模板落点为 `.iagent/templates/frontend/`，含页面骨架、弹窗骨架、主页面↔弹窗数据交换约定三类；同样受 C1-C6 证据约束，无证据不生成 (D8)。

#### Scenario: 按 UI 证据生成设计模板
- **WHEN** 目标项目存在页面与弹窗相关 UI 证据（页面骨架、弹窗组件用法、主页面与弹窗间数据传递方式）
- **THEN** 生成 `.iagent/templates/frontend/` 下页面骨架、弹窗骨架、数据交换约定三类模板文件，内容逐条带证据锚点

#### Scenario: 无 UI 证据不生成模板
- **WHEN** 目标项目无页面 / 弹窗 UI 证据
- **THEN** 不生成设计模板目录，报告写明「无 UI 证据，设计模板未生成」

### Requirement: 蒸馏质量自检 C1-C6

生成侧技能 SHALL 复用与 project-init Step 11 同源的 C1-C6 完整性自检（frontmatter 必填 / 必需章节齐全 / 证据锚点 / 禁占位符 / 冲突标注 / 长度拆分），全部通过才可写入；自检不通过先补齐，无法补齐时 MUST NOT 写入该侧 (D1)。

#### Scenario: 自检通过写入
- **WHEN** 生成内容通过 C1-C6 全部检查
- **THEN** 写入目标项目技能文件并进入注册环节

#### Scenario: 自检不通过不写入
- **WHEN** 生成内容存在缺失章节 / 无证据规则行 / 占位符且无法补齐
- **THEN** MUST NOT 写入该文件，报告列出缺失项

### Requirement: 已存在处理复用

生成侧技能对目标项目已存在的技能文件 SHALL 复用 project-init 第 5/6 步语义：逐份确认（确认重新生成 / 修改 / 跳过）与人工域标记逐字保留（破损取保留侧）；全部跳过时正常结束 (D5)。

#### Scenario: 已存在走逐份确认与人工域
- **WHEN** 目标 `.iagent/skills/frontend-design.md` 已存在
- **THEN** 先逐份呈现确认选项；确认重新生成时人工域区间逐字保留、区间外重新派生

### Requirement: 注册模式双态

生成侧技能的 config.yaml 注册 SHALL 为双态：**独立调用**时执行自身幂等注册（逐行段替换追加 `skills:` 对应角色组）；**被 project-init 委派**时 MUST 跳过自身注册（注册由 project-init 单点承担）(D1/D4)。

#### Scenario: 独立调用自身注册
- **WHEN** 生成侧技能被独立调用且写入成功
- **THEN** 幂等追加 config.yaml `skills:` 对应角色组（保留注释与未知段）；注册失败记 WARN 不回滚

#### Scenario: 被委派跳过自身注册
- **WHEN** 生成侧技能由 project-init 委派执行
- **THEN** 只产出技能文件与回执，MUST NOT 写 config.yaml（父级单点注册）

### Requirement: 依赖注入安装

选装 project-init 的 workflow 配置 SHALL 经依赖注入自动带上 `frontend-skill-gen` 与 `backend-skill-gen`，保证「单独调用」与「集成调用」两条路径的技能均可用 (D7)。

#### Scenario: 选装 project-init 自动安装两技能
- **WHEN** 用户在 workflows 中仅选择 `project-init`
- **THEN** 生效 workflow 集自动补全 `frontend-skill-gen` / `backend-skill-gen` 并标注注入来源

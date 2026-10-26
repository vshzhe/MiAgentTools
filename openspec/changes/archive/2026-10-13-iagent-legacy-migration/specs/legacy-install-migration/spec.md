## ADDED Requirements

### Requirement: 遗留产物检测
系统 SHALL 在 init 与 update 入口检测三类旧版标识产物：旧配置目录、各工具目录下以旧技能前缀开头的技能目录、各工具指令目录下旧命名空间子目录内的指令文件。三者均不存在时 MUST 判定为无需迁移。

#### Scenario: 检测到旧配置目录
- **GIVEN** 项目根下存在旧配置目录 .venus/
- **WHEN** 执行 iagent init
- **THEN** 判定需要迁移，进入配置搬运与产物清理

#### Scenario: 检测到旧技能产物
- **GIVEN** .claude/skills/ 下存在以旧技能前缀开头的目录
- **WHEN** 执行 iagent update
- **THEN** 判定需要迁移，进入产物清理

#### Scenario: 全新项目无需迁移
- **GIVEN** 项目既无旧配置目录也无旧前缀产物
- **WHEN** 执行 iagent init
- **THEN** 静默跳过迁移，输出中不出现迁移段落

### Requirement: 配置内容搬运与类型改名
系统 SHALL 将旧配置目录的 config.yaml 内容搬运到新配置目录，SHALL 保留 context 多行块与用户自写的全部行（含注释行与未知段）。rules 列表项与 rules/ 下的规则文件名 SHALL 按类型改名映射成对改写。workflows 列表项 SHALL 按旧→新 workflow id 映射改写——旧指令 id 无法匹配任何技能模板，不改写则搬运后首次 init 装 0 个技能。搬运 MUST NOT 通过重新序列化 YAML 实现。

#### Scenario: context 逐字保留
- **GIVEN** 旧 config.yaml 的 context 多行块含用户自写内容
- **WHEN** 执行迁移
- **THEN** 新 config.yaml 的 context 与原文逐字一致

#### Scenario: rules 列表与文件名成对改名
- **GIVEN** 旧 config.yaml 的 rules 列表为 [tr_impl, tr_test, spec] 且 rules/ 下有 tr_impl.md 与 tr_test.md
- **WHEN** 执行迁移
- **THEN** 新 config 的 rules 列表为 [impl, test, spec]，新 rules/ 下为 impl.md 与 test.md，无缺失规则文件

#### Scenario: workflows 列表按旧→新映射改名
- **GIVEN** 旧 config.yaml 的 workflows 列表为 [tr-test-generate, tr-impl-debug]，其中 tr-impl-debug 依赖 spec-verify-proposal
- **WHEN** 执行迁移并随后执行 init
- **THEN** 新 config 的 workflows 列表为 [test, debug]，init 按该集安装技能（含依赖注入补全项）而非装 0 个技能

#### Scenario: 注释行保留
- **GIVEN** 旧 config.yaml 含 # 注释行
- **WHEN** 执行迁移
- **THEN** 新 config.yaml 保留这些注释行

#### Scenario: 扫描基线随目录搬移
- **GIVEN** 旧配置目录含扫描基线文件
- **WHEN** 执行迁移
- **THEN** 扫描基线出现在新配置目录下

#### Scenario: 未知段与自定义字段逐字保留
- **GIVEN** 旧 config.yaml 含 auto_package.runtime_dir 等技能运行时依赖的自定义字段与未知段
- **WHEN** 执行迁移
- **THEN** 这些字段在新 config.yaml 中逐字保留，不因类型改名而丢弃

### Requirement: 旧产物清理
系统 SHALL 删除所有以旧技能前缀开头的技能目录与旧命名空间子目录下的指令文件，MUST NOT 区分其是否被手工修改。系统 MUST NOT 触碰任何非旧前缀产物。

#### Scenario: 清理旧技能与指令
- **GIVEN** 各工具目录下存在旧前缀技能与旧命名空间指令
- **WHEN** 执行迁移
- **THEN** 旧前缀技能目录与旧命名空间指令文件全部删除

#### Scenario: 手工修改过的旧技能同样删除
- **GIVEN** 某旧前缀技能目录内容与生成内容不一致（用户手工修改过）
- **WHEN** 执行迁移
- **THEN** 该目录仍被删除，且迁移报告中对该情况给出告警

#### Scenario: 非旧前缀产物不受影响
- **GIVEN** 同一技能目录下存在其他工具生成的技能（既非旧前缀也非本工具命名）
- **WHEN** 执行迁移
- **THEN** 该技能保留不动

#### Scenario: 其他工具的旧产物一并清理
- **GIVEN** 除 claude 外，pi 等工具目录下也存在旧前缀技能与旧命名空间指令
- **WHEN** 执行迁移
- **THEN** 各工具的旧产物均被清理，不只处理单一工具

### Requirement: 迁移报告
系统 SHALL 在发生迁移时输出报告，分别列出搬运项、删除项与跳过项的计数与明细；删除旧技能或指令时 SHALL 附显式告警，说明其中可能包含的手工修改已随删除丢失。未发生迁移时 MUST NOT 输出报告。

#### Scenario: 报告列出三类结果
- **GIVEN** 迁移搬运了配置并删除了旧产物
- **WHEN** 执行 iagent init
- **THEN** 输出包含搬运项、删除项与跳过项的计数与明细

#### Scenario: 删除附带告警
- **GIVEN** 迁移删除了旧技能
- **WHEN** 输出迁移报告
- **THEN** 报告中提示旧技能已被删除且其中可能的手工修改已丢失

#### Scenario: 无迁移则无报告
- **GIVEN** 项目无任何旧版产物
- **WHEN** 执行 iagent init
- **THEN** 输出中不出现迁移段落

### Requirement: 迁移幂等性
系统 SHALL 保证迁移可安全重复执行：迁移已完成的项目再次执行 init 或 update 时 MUST 无任何副作用，且 MUST NOT 再次输出迁移报告。

#### Scenario: 二次执行无副作用
- **GIVEN** 项目已完成一次迁移
- **WHEN** 再次执行 iagent init
- **THEN** 新配置目录内容与产物均不变，且不输出迁移段落

#### Scenario: 部分迁移后可续做
- **GIVEN** 上次迁移因异常只完成了配置搬运，旧技能仍存在
- **WHEN** 再次执行 iagent init
- **THEN** 补齐未完成的清理，配置搬运不重复执行

### Requirement: 迁移边界容错与跳过开关
迁移过程的任何异常 MUST NOT 阻断 init 与 update 主流程。旧配置目录缺失、仅部分旧产物存在、配置解析失败时 SHALL 降级处理：解析失败时 MUST 保留原始配置且 MUST NOT 写入内容残缺的新配置，并以告警说明未迁移。系统 SHALL 提供跳过迁移的开关。

#### Scenario: 旧配置目录缺失
- **GIVEN** 项目有旧前缀技能但无旧配置目录
- **WHEN** 执行 iagent init
- **THEN** 仅执行产物清理，不报错

#### Scenario: 配置解析失败保留原物
- **GIVEN** 旧 config.yaml 格式异常无法解析
- **WHEN** 执行 iagent init
- **THEN** 旧配置目录保留不删，不写入新配置，输出告警说明未迁移，主流程继续

#### Scenario: 跳过开关生效
- **GIVEN** 项目存在旧版产物
- **WHEN** 执行 iagent init --no-migrate
- **THEN** 不执行任何搬运与删除，也不输出迁移报告

#### Scenario: 异常不阻断主流程
- **GIVEN** 迁移过程中发生未预期异常
- **WHEN** 执行 iagent update
- **THEN** 异常降级为告警，update 的技能刷新与后续步骤照常完成

### Requirement: 既有新配置目录不覆盖
当新配置目录的 config.yaml 已存在（用户已按新口径自建）时，迁移 MUST NOT 覆盖其内容，SHALL 保留既有内容并输出告警说明旧配置未搬运；旧配置目录同时 SHALL 保留不删，供用户自行比对合并。

#### Scenario: 新配置已存在时保留
- **GIVEN** 项目同时存在旧配置目录与用户自建的新配置目录
- **WHEN** 执行 iagent init
- **THEN** 新配置目录的 config.yaml 内容不被覆盖

#### Scenario: 保留时输出告警
- **GIVEN** 新配置已存在导致跳过搬运
- **WHEN** 输出迁移报告
- **THEN** 报告说明旧配置未搬运、旧目录已保留，并提示用户手工合并

#### Scenario: 旧配置目录不被删除
- **GIVEN** 因新配置已存在而跳过搬运
- **WHEN** 迁移结束
- **THEN** 旧配置目录及其 rules/ 完整保留

### Requirement: 删除操作的边界安全
旧产物清理 SHALL 限制在目标工具目录的对应子目录内：删除前 SHALL 校验目标路径位于该子目录之下，越界目标 MUST 被拒绝并记入报告的跳过项；MUST NOT 跟随符号链接；清理旧指令后 SHALL 移除遗留的空目录；对 commandsDir 为空字符串的工具 MUST NOT 拼接指令路径，SHALL 跳过其指令侧清理。

#### Scenario: 越界路径被拒绝
- **GIVEN** 某目标路径解析后位于该工具目录的 skills 子目录之外
- **WHEN** 执行清理
- **THEN** 该目标被拒绝，记入报告的跳过项，不执行删除

#### Scenario: 空 commandsDir 工具跳过指令侧清理
- **GIVEN** 某工具的 commandsDir 配置为空字符串
- **WHEN** 遍历各工具执行旧指令清理
- **THEN** 跳过该工具的指令侧清理，不做路径拼接

#### Scenario: 项目根下同名目录不受影响
- **GIVEN** 项目根下存在与本工具无关的同名目录
- **WHEN** 执行迁移
- **THEN** 该目录不被扫描也不被删除

#### Scenario: 符号链接不跟随
- **GIVEN** 旧前缀技能目录是指向工具目录之外的符号链接
- **WHEN** 执行清理
- **THEN** 仅移除链接本身，链接目标的内容不被删除

#### Scenario: 空目录清理
- **GIVEN** 旧命名空间目录内的指令文件已全部删除
- **WHEN** 清理完成
- **THEN** 该空目录一并移除

### Requirement: 旧版品牌产物清理
迁移 SHALL 清理四类旧版品牌命名的遗留产物：用户主目录下的旧 bash 补全脚本与 PowerShell profile 补全脚本；rc/profile 文件中由旧起止标记成对包围的旧标记块；变更目录下的旧遗留 sidecar 目录；跨变更索引目录下的旧索引库。清理 MUST 以旧起止标记成对出现为前提，未成对时 MUST NOT 改动 rc/profile。索引库删除后 SHALL 在报告中提示可由 reindex 重建。

#### Scenario: 旧补全脚本与标记块一并清理
- **GIVEN** rc 文件中存在旧起止标记包围的标记块，且用户主目录下存在对应旧补全脚本文件
- **WHEN** 执行 iagent init
- **THEN** 旧标记块从 rc 文件中移除，旧补全脚本文件被删除，二者均记入报告

#### Scenario: 标记块不成对时不改动 rc
- **GIVEN** rc 文件中只存在旧起始标记而无旧结束标记
- **WHEN** 执行迁移
- **THEN** rc 文件不被修改，该情况记入报告的跳过项并告警

#### Scenario: 旧侧车目录清理
- **GIVEN** 变更目录下存在旧遗留 sidecar 目录
- **WHEN** 执行迁移
- **THEN** 该目录被删除并记入报告

#### Scenario: 旧索引库清理与重建提示
- **GIVEN** 跨变更索引目录下存在旧索引库文件
- **WHEN** 执行迁移
- **THEN** 旧索引库被删除，报告提示可用 reindex 重建索引

#### Scenario: 无旧产物时不触碰用户主目录
- **GIVEN** rc 与 user home 中不存在任何旧版补全产物
- **WHEN** 执行 iagent init
- **THEN** 用户主目录与 rc/profile 文件均不被读写

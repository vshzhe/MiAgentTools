## ADDED Requirements

### Requirement: 身份 token 单一来源
系统 SHALL 以单一来源常量维护全部身份 token：技能名前缀、斜杠指令命名空间、工具指令子目录、项目配置目录名、CLI 二进制名、包名。任一 token 的取值 MUST 只在该来源定义一次，其余代码 MUST 引用该常量而非重复字面量。

#### Scenario: 技能前缀取自常量
- **GIVEN** 身份 token 常量定义为技能前缀 iagent_
- **WHEN** 生成任一技能产物
- **THEN** 技能目录名与 frontmatter name 均为 iagent_ 前缀，且前缀值来自该常量而非硬编码

#### Scenario: 配置目录取自常量
- **GIVEN** 身份 token 常量定义为配置目录 .iagent
- **WHEN** init 创建项目配置或 project-scan 写入扫描基线
- **THEN** 写入路径为 .iagent/config.yaml 与 .iagent/scan-baseline.json，且均引用同一常量

### Requirement: 技能命名方案
技能名 SHALL 形如 `<技能前缀><功能名>`，其中功能名以该技能的功能命名（下划线分词）。功能名 MUST NOT 包含生命周期类型段（如 tr_）。承载「依赖 openspec/ 与 openspec CLI」语义的技能 SHALL 在功能名前保留 `spec_` 领域段。

#### Scenario: 功能技能不带类型段
- **GIVEN** 实现类功能技能
- **WHEN** 确定其技能名
- **THEN** 名称为 iagent_feature，不含任何生命周期类型段

#### Scenario: spec 域技能保留领域段
- **GIVEN** 规格驱动工作流的提案技能
- **WHEN** 确定其技能名
- **THEN** 名称为 iagent_spec_propose，spec_ 领域段保留

#### Scenario: 名字自解释性
- **GIVEN** 任一技能名
- **WHEN** 仅阅读其名字
- **THEN** 可推断该技能的功能用途，不存在 genfull 一类无法推断的缩写名

### Requirement: 指令 id 派生与命名空间
斜杠指令 id SHALL 由技能名去掉技能前缀后将下划线替换为连字符派生；指令文件 SHALL 生成到 `<工具指令目录>/<命名空间>/<指令 id>.md`，调用形式为 `/<命名空间>:<指令 id>`。

#### Scenario: 派生功能技能指令 id
- **GIVEN** 技能名 iagent_workflow
- **WHEN** 派生指令 id
- **THEN** 得到 workflow，指令文件为 .claude/commands/iagent/workflow.md，调用形式 /iagent:workflow

#### Scenario: 派生 spec 域指令 id
- **GIVEN** 技能名 iagent_spec_verify_proposal
- **WHEN** 派生指令 id
- **THEN** 得到 spec-verify-proposal，调用形式 /iagent:spec-verify-proposal

#### Scenario: 非前缀技能名报错
- **GIVEN** 技能名不以技能前缀开头
- **WHEN** 调用指令 id 派生
- **THEN** 抛出以技能前缀为说明的错误

### Requirement: 类型 id 集
系统 SHALL 定义且仅定义 9 个技能类型 id：init、impl、test、commit、review、release、tools、docs、spec。类型 id MUST NOT 携带 tr 前缀。类型 SHALL 作为 frontmatter 的 metadata.type 与 `.iagent/rules/<type>.md` 的文件名来源。`spec` 兼具类型 id 与技能名领域段两重身份，两者取值 SHALL 一致。

#### Scenario: 类型 id 无 tr 前缀
- **GIVEN** 系统类型注册表
- **WHEN** 枚举全部类型 id
- **THEN** 得到 init/impl/test/commit/review/release/tools/docs/spec，无一以 tr 开头

#### Scenario: 规则文件名取自类型 id
- **GIVEN** config.yaml 的 rules 列表含 impl
- **WHEN** 解析并读取规则文件
- **THEN** 读取 .iagent/rules/impl.md，缺失时记为 missingRuleFiles

#### Scenario: 非法类型被拒
- **GIVEN** 传入类型 id tr_impl
- **WHEN** 执行类型合法性校验
- **THEN** 判定为非法类型

### Requirement: generate 名称组合规则
`iagent generate` SHALL 以 `<技能前缀><name 参数>` 组合技能名，类型 MUST 仅写入产物 frontmatter 的 metadata.type，MUST NOT 进入技能名。

#### Scenario: 生成的技能名不含类型段
- **GIVEN** 执行 iagent generate --type impl --name foo
- **WHEN** 计算技能名
- **THEN** 技能名为 iagent_foo，frontmatter metadata.type 为 impl

#### Scenario: 与内置技能命名一致
- **GIVEN** 27 个内置技能名
- **WHEN** 与 generate 的组合规则比对
- **THEN** 生成名与内置名遵循同一规则，不存在一类带类型段、一类不带的不一致

### Requirement: 旧新标识映射表
系统 SHALL 提供 27 项技能名与指令名的旧→新一对一映射，作为重命名与旧装机迁移的唯一依据；映射 MUST 覆盖全部 27 个技能且无重复目标名。

#### Scenario: 映射覆盖完整
- **GIVEN** 旧命名下的 27 个技能
- **WHEN** 应用映射表
- **THEN** 27 个旧名均有一对一的新名，新名集合大小为 27 且无冲突

#### Scenario: 映射用于迁移
- **GIVEN** 旧装机存在 venus_* 技能
- **WHEN** 执行遗留迁移
- **THEN** 迁移逻辑与该映射表使用同一份来源，不另立第二份映射

### Requirement: 规格 id 命名约束
本项目的 openspec 规格 id SHALL NOT 使用 tr 前缀。存量的 4 个带 tr- 前缀的规格 id SHALL 在本变更内改名。

#### Scenario: 存量规格 id 改名
- **GIVEN** 规格 id tr-workflow-suite-skills、tr-commit-push-skill、tr-migration-skills、tr-test-generate
- **WHEN** 执行本变更
- **THEN** 四个规格目录分别改名为 workflow-suite-skills、commit-push-skill、migration-skills、test-generate

#### Scenario: 新增规格不得带 tr 前缀
- **GIVEN** 新建一个规格
- **WHEN** 命名其 id
- **THEN** id 不以 tr- 开头

### Requirement: 旧标识零残留
本变更完成后，仓库源码、模板、技能快照、测试与文档中 MUST NOT 残留旧标识 token（技能前缀 venus_、配置目录 .venus、类型前缀 tr_、指令命名空间 venus/）；例外仅限旧新映射表、遗留迁移代码与 CHANGELOG 的历史记录。

#### Scenario: 源码零残留
- **GIVEN** 本变更实现完成
- **WHEN** 在 src/ 与 test/ 中检索 venus_ 与 .venus
- **THEN** 仅在映射表与遗留迁移模块中命中，其余位置零命中

#### Scenario: 产物零残留
- **GIVEN** 重新生成 skills/ 快照
- **WHEN** 在 skills/ 中检索旧技能名前缀
- **THEN** 零命中，27 个技能目录均为 iagent_ 前缀

### Requirement: 品牌标识与产品领域名的区分
标识重命名 SHALL 仅作用于本工具品牌标识：技能名前缀 `venus_`、配置目录 `.venus`、CLI 名 `venus`、指令命名空间 `/venus:`、工具指令子目录 `venus`、项目名 `VenusAgentTools`、指令 tags 中的 `venus` 标签、metadata.author 的 venus-agent-tools 取值。产品与仓库领域名 MUST NOT 被替换：`Venus4A`（产品名）、`Venustech`（公司名）、SVN 仓库路径中的 `/svn/venus/` 段、本地项目路径 `E:\WorkSpaces_ahdx\Venus4A`、业务标识符。替换 MUST 按标识符边界精确匹配，MUST NOT 使用不分大小写的裸 `venus` 模式。

#### Scenario: 产品领域名保持不变
- **GIVEN** vendor/auto-package-svn/ 下的打包脚本与使用说明含 34 处 venus 命中，全部为 Venus4A 产品名与 /svn/venus/ 仓库路径
- **WHEN** 执行本变更的品牌替换
- **THEN** 该目录逐字不变

#### Scenario: 技能正文中的产品语境保持
- **GIVEN** 技能正文含 Venus4A 项目前端开发等产品语境描述（skills/** 内 74 处）
- **WHEN** 重命名技能名与品牌标识
- **THEN** 正文中的 Venus4A 与 Venustech 字符串保持不变，仅技能名与品牌 token 被替换

#### Scenario: 禁止不分大小写的裸模式替换
- **GIVEN** 实现者准备执行品牌替换
- **WHEN** 界定替换范围
- **THEN** 仅使用 venus_ / .venus / /venus: / commands/venus / VenusAgentTools 这五类精确模式

### Requirement: 模板正文引用分类替换
模板正文内的旧标识引用 SHALL 按四类分别替换并以各自计数收口：技能名交叉引用与自引用（`venus_`，197 处）、指令名引用（`/venus:`，49 处）、配置目录路径引用（`.venus/`，34 处）、tags 与 metadata.author 的品牌与类型 token。四类 MUST NOT 合并为一次笼统替换。

#### Scenario: 配置目录路径引用替换
- **GIVEN** release-package 模板正文要求读取 .venus/config.yaml 的 auto_package.runtime_dir 字段
- **WHEN** 执行重命名
- **THEN** 正文改为读取 .iagent/config.yaml 的同名字段

#### Scenario: 含配置目录引用的模板全部替换
- **GIVEN** 8 个模板含 .venus/ 引用，共 34 处（frontend 12、release-package 6、proposal-review 6、project-init 4、requirement-doc 3、spec-archive / spec-bulk-archive / spec-explore 各 1）
- **WHEN** 执行重命名
- **THEN** 34 处全部替换为 .iagent/，零残留

#### Scenario: 指令名引用替换
- **GIVEN** 模板正文引用 /venus:spec-propose
- **WHEN** 执行重命名
- **THEN** 正文改为 /iagent:spec-propose，49 处 /venus: 引用全部替换

### Requirement: 指令元数据品牌字段
指令模板的 tags 数组 SHALL 以 `iagent` 替换 `venus` 品牌标签，其中的类型标签 SHALL 使用去 tr 后的新类型 id；技能与指令模板的 metadata.author SHALL 为 mi-agent-tools，与 generator 的默认值一致。

#### Scenario: tags 品牌与类型标签替换
- **GIVEN** 某指令的 tags 为 ['venus', 'tr_release', 'package', 'auto-package', 'svn', 'verify', 'upgrade-doc']
- **WHEN** 执行重命名
- **THEN** tags 为 ['iagent', 'release', 'package', 'auto-package', 'svn', 'verify', 'upgrade-doc']

#### Scenario: 全部 tags 收口
- **GIVEN** 27 个指令模板各含一个 tags 数组
- **WHEN** 执行重命名
- **THEN** 27 处 tags 中的品牌标签与类型标签全部替换完毕，零残留

#### Scenario: 模板 author 与默认值一致
- **GIVEN** 26 个模板显式设置 metadata.author 为 venus-agent-tools
- **WHEN** 执行重命名
- **THEN** 全部改为 mi-agent-tools，与 generator.ts 的 frontmatter 默认值一致

### Requirement: 空指令目录工具的安全遍历
对于 commandsDir 配置为空字符串的工具，系统 MUST NOT 以其拼接指令目录路径（否则 path.join 会得到项目根下的同名目录），指令侧遍历 SHALL 跳过该工具。

#### Scenario: 无指令适配器的工具被跳过
- **GIVEN** 某工具的 commandsDir 配置为空字符串
- **WHEN** uninstall 删除指令目录、或 reconcile 扫描孤立指令
- **THEN** 该工具的指令侧处理被跳过，路径拼接不发生

#### Scenario: 项目根下同名目录不受影响
- **GIVEN** 项目根下存在与本工具无关的 venus/ 或 iagent/ 同名目录
- **WHEN** 执行 uninstall 或 reconcile
- **THEN** 该目录不被扫描、不被删除、不列入孤立产物

#### Scenario: 迁移遍历沿用同一守卫
- **GIVEN** 伴生变更的迁移遍历全部工具目录
- **WHEN** 遍历到 commandsDir 为空的工具
- **THEN** 跳过其指令侧清理，不做路径拼接

### Requirement: 品牌命名的磁盘产物一同改名
除项目配置目录外，工具的品牌命名还出现在四类磁盘产物上，均 SHALL 改用 iagent 口径：遗留 sidecar 目录（变更目录下的 SIDECAR_DIR，@deprecated 布局）、跨变更索引目录（INDEX_DB_PATH 所在的 .venus 目录）、shell 补全产物（bash 脚本文件、PowerShell profile 脚本、rc/profile 标记块）、会话级权限条目中的 CLI 标识。旧产物的清理 MUST NOT 由本变更完成，SHALL 交由伴生变更 iagent-legacy-migration 处理。

#### Scenario: 遗留 sidecar 目录改名
- **GIVEN** 变更目录下的遗留 sidecar 布局常量 SIDECAR_DIR 取值为 '.venus'
- **WHEN** 执行重命名
- **THEN** 常量为 '.iagent'，读取该目录的降级路径同步为新值

#### Scenario: 索引目录改名
- **GIVEN** 跨变更索引路径常量指向 changes/archive/.venus/index.db
- **WHEN** 执行重命名
- **THEN** 路径指向 changes/archive/.iagent/index.db，确保目录存在的逻辑同步

#### Scenario: 补全产物改名
- **GIVEN** 补全安装产出 bash 脚本文件、PowerShell profile 脚本与 rc/profile 标记块
- **WHEN** 执行重命名
- **THEN** 脚本文件名为新品牌口径，标记块起止标记为 IAGENT 口径，安装与卸载使用同一组标记常量

#### Scenario: 标记块一致性
- **GIVEN** 标记块的起止常量被安装与卸载共用
- **WHEN** 执行 completion install 后再执行 uninstall
- **THEN** 安装写入的标记块被卸载精确识别并移除，不残留空标记

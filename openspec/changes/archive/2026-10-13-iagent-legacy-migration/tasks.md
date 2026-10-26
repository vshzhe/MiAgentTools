# Tasks: iagent-legacy-migration

## 迁移核心

- [x] [代码] 1.1 新建 src/core/legacy-migration.ts：定义旧标识常量（旧配置目录名、旧技能前缀、旧指令命名空间子目录）、类型改名映射表（tr_init→init / tr_impl→impl / tr_test→test / tr_commit→commit / tr_review→review / tr_release→release / tr_tools→tools / tr_docs→docs，spec 不变；由 SKILL_TYPES 派生）、遗留产物检测函数（返回三类旧物的存在性与明细）、迁移报告的数据结构；技能与指令的旧→新逐项映射表在本模块落为**唯一代码真源**（承载 agent-tool-identity 的「旧新标识映射表」需求，其余位置 MUST NOT 再立第二份；实施期修订：旧装机 config 的 workflows 列表须按该表改名，否则旧 id 无法解析）
  - 实施期修订: 决策见 design.md「D10: workflows 列表按旧→新映射改名」——原「不另立映射」措辞改为「本模块即该映射表的唯一代码真源」
  - 对应: legacy-install-migration#遗留产物检测
  - 产出文件: `src/core/legacy-migration.ts`

- [x] [代码] 1.2 实现配置内容搬运：读取旧 config.yaml 的 context 多行块、rules 列表、workflows 列表、tools 列表；按类型映射成对改写 rules 列表项与 rules/ 下规则文件名；写入新配置目录。严格沿用 project-config.ts 的 replaceConfigSection 逐行段替换语义，保留用户注释行、未知段与自定义字段（如 auto_package.runtime_dir），MUST NOT 重新序列化 YAML；扫描基线文件随目录搬移。已存在新配置目录时 MUST NOT 覆盖其 config.yaml，改为保留既有内容并告警，旧配置目录同时保留不删（与 ensureProjectConfig 的「已存在则保留」语义对齐）
  - 依赖: 1.1
  - 对应: legacy-install-migration#既有新配置目录不覆盖
  - 产出文件: `src/core/legacy-migration.ts`, `src/core/project-config.ts`

- [x] [代码] 1.3 实现旧产物清理：遍历全部已配置工具目录，删除以旧技能前缀开头的技能目录与旧命名空间子目录下的指令文件；一律删除不区分是否手工修改；非旧前缀产物完全不触碰；删除明细记入报告。安全边界：commandsDir 为空字符串的工具（codex）跳过指令侧清理，不做 path.join 拼接；删除前校验目标路径位于该工具对应子目录之下，越界即拒绝并记入跳过项；不跟随符号链接；清理旧指令后移除遗留的空目录
  - 依赖: 1.1
  - 对应: legacy-install-migration#删除操作的边界安全
  - 产出文件: `src/core/legacy-migration.ts`

- [x] [代码] 1.4 实现幂等判定与报告渲染：以「旧配置目录不存在且无旧前缀产物」为静默跳过条件；实现三报告段（搬运项、删除项、跳过项）的计数与明细输出；删除旧技能或指令时附手工修改可能已丢失的显式告警；整体以容错包裹，异常降级为告警不抛出
  - 依赖: 1.2, 1.3
  - 对应: legacy-install-migration#迁移报告
  - 产出文件: `src/core/legacy-migration.ts`

- [x] [代码] 1.5 入口接线：src/commands/init.ts 与 update.ts 在配置创建/产物生成之前调用迁移（先于 reconcile 扫描，避免旧产物被误报为孤立产物），输出迁移报告段落；src/cli/index.ts 为 init 与 update 注册 --no-migrate 选项及说明文案；解析失败时保留原物并告警，不阻断主流程
  - 依赖: 1.4
  - 对应: legacy-install-migration#迁移边界容错与跳过开关
  - 产出文件: `src/commands/init.ts`, `src/commands/update.ts`, `src/cli/index.ts`

- [x] [代码] 1.6 实现旧版品牌产物清理：删除用户主目录下的旧 bash 补全脚本与旧 PowerShell profile 补全脚本；从 rc/profile 文件中移除由旧起止标记成对包围的旧标记块（仅当成对出现时触碰文件，不成对则记入跳过项并告警，MUST NOT 改动文件）；删除变更目录下的旧遗留 sidecar 目录；删除跨变更索引目录下的旧索引库并在报告中提示可由 reindex 重建。旧值常量与伴生变更的「品牌命名的磁盘产物一同改名」需求使用同一份来源，不另立第二份
  - 依赖: 1.1, 1.5
  - 对应: legacy-install-migration#旧版品牌产物清理
  - 产出文件: `src/core/legacy-migration.ts`, `src/commands/completion.ts`

## 迁移测试

- [x] [测试][单元][P0] 2.1 检测与映射单测：覆盖三类旧物各自存在与缺失的组合；断言类型改名映射表覆盖 9 个类型且 spec 不变；断言技能与指令映射取自 agent-tool-identity 的同一来源（不另立映射）
  - 依赖: 1.1
  - 对应: legacy-install-migration#遗留产物检测
  - 实施期修订: 「来自同一来源」在本实现中落为「`LEGACY_WORKFLOW_ID_MAP` 是唯一代码真源」——断言其映射目标集恒等于注册表当前 27 个 commandId（映射不可能漂移），并断言清理按旧前缀进行、不依赖该表（表外旧名同样被清理，故不存在第二份删除清单）
  - 产出文件: `test/legacy-migration.test.ts`

- [x] [测试][单元][P0] 2.2 配置搬运保真单测：断言 context 多行块逐字保留、注释行保留、未知段保留；断言 rules 列表与 rules/ 文件名成对改名后无缺失规则文件；断言 workflows 与 tools 列表内容不丢项
  - 依赖: 1.2
  - 对应: legacy-install-migration#配置内容搬运与类型改名
  - 实施期修订: workflows 列表按 `LEGACY_WORKFLOW_ID_MAP` 改名后断言不丢项（原样搬运会使旧 id 无法解析、init 装 0 个技能）；另补 `readListSection` / `replaceConfigSectionInRaw` 两个新导出原语的单测（迁移读旧值所依赖，`parseProjectConfig` 会按新类型过滤故无法复用）
  - 产出文件: `test/legacy-migration.test.ts`, `test/project-config-context.test.ts`

- [x] [测试][功能][P0] 2.3 端到端迁移测试：在临时目录构造旧装机夹具（旧配置目录含 config.yaml 与 rules/ 与扫描基线、各工具目录下旧前缀技能与旧命名空间指令，其中至少一个技能内容被手工改动过），执行 init 后断言新配置内容正确、旧产物全部清零、非旧前缀产物保留、迁移报告三段落与告警文案符合预期
  - 依赖: 1.5, 2.1, 2.2
  - 对应: legacy-install-migration#旧产物清理
  - 产出文件: `test/legacy-migration.test.ts`

- [x] [测试][功能][P1] 2.4 幂等与续做测试：连续执行两次 init，断言第二次无任何文件变化且不输出迁移段落；构造「配置已搬运但旧技能仍存在」的部分迁移状态，断言第二次执行只补齐清理、不重复搬运配置
  - 依赖: 1.5
  - 对应: legacy-install-migration#迁移幂等性
  - 产出文件: `test/legacy-migration.test.ts`

- [x] [测试][功能][P1] 2.5 边界容错测试矩阵：旧配置目录缺失但存在旧技能、配置解析失败（断言原物保留且不写入残缺新配置、输出未迁移告警、主流程继续）、仅部分旧物存在、新配置目录已存在（断言既有 config.yaml 内容不被覆盖、旧配置目录保留、输出合并提示告警）、--no-migrate 跳过（断言零搬运零删除且无报告）、迁移内部抛异常时 update 主流程仍完成
  - 依赖: 1.5
  - 对应: legacy-install-migration#既有新配置目录不覆盖
  - 产出文件: `test/legacy-migration.test.ts`, `test/commands.test.ts`

- [x] [测试][功能][P0] 2.6 安全边界测试：越界目标被拒绝并记入报告的跳过项（断言不删除）；commandsDir 为空字符串的工具跳过指令侧清理，且项目根下同名目录零影响；符号链接不被跟随（断言仅移除链接本身、链接目标内容仍在）；清理后遗留的空目录被移除；配置搬运保留未知段与自定义字段（断言 auto_package.runtime_dir 等 YAML 文本逐字不变）
  - 依赖: 1.2, 1.3
  - 对应: legacy-install-migration#删除操作的边界安全
  - 产出文件: `test/legacy-migration.test.ts`

- [x] [测试][功能][P0] 2.7 旧版品牌产物清理测试：在临时 HOME 下构造旧补全脚本与含旧起止标记块的 rc 文件，断言清理后标记块被移除、旧脚本被删除、rc 中其余内容逐字不变；构造只有旧起始标记的 rc，断言文件零改动且报告含跳过项与告警；构造旧遗留 sidecar 目录与旧索引库，断言被删除且报告含 reindex 重建提示；构造无任何旧产物的场景，断言用户主目录与 rc/profile 均未被读写
  - 依赖: 1.6
  - 对应: legacy-install-migration#旧版品牌产物清理
  - 产出文件: `test/legacy-migration.test.ts`

## 迁移文档

- [x] [使用说明] 3.1 文档更新：AGENTS.md 与 README.md 补充旧装机升级指引（迁移会自动做什么、删除行为与告警含义、--no-migrate 用法、需要保留手工修改时的升级前动作）；CHANGELOG 记录该迁移能力及其对旧装机的影响
  - 依赖: 1.5
  - 产出文件: `AGENTS.md`, `README.md`, `CHANGELOG.md`

- [x] [使用说明] 3.2 docs/ 下补充升级迁移说明章节（与 iagent-rebrand 的破坏性说明互相引用），明确「旧技能一律删除、配置内容保真搬运」两条边界，使升级用户在执行前即可知情
  - 依赖: 3.1
  - 实施期说明: 版本号不另行递增——2.0.0 由伴生变更 iagent-rebrand 递增且尚未发布，其 BREAKING 小节已声明本次迁移，两个变更同版交付；本变更的迁移能力记入同一 2.0.0 小节的 Added 段，并新增 docs/upgrade-guide.md 与之互相引用（AGENTS.md 修改守则第 8 条以 package.json 当前 version 为基线，此处基线即 2.0.0）
  - 产出文件: `docs/`

> 进度: 0/15 (0%)

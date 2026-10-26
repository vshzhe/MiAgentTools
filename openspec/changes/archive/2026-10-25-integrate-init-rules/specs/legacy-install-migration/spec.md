# legacy-install-migration 增量规格

## MODIFIED Requirements

### Requirement: 配置内容搬运与类型改名

系统 SHALL 将旧配置目录的 config.yaml 内容搬运到新配置目录，SHALL 保留 context 多行块与用户自写的全部行（含注释行与未知段）。rules 列表项 SHALL 按类型改名映射改写；`rules/` 下规则文件的**落点文件名 SHALL 经类型→语义名映射派生**——`tr_impl.md` → `.iagent/rules/coding-rules.md`、`tr_test.md` → `.iagent/rules/testing-rules.md`、`spec.md` 保持不变，映射外类型回退 `<type>.md`。搬运 MUST 逐字保留文件内容，MUST NOT 改写正文、MUST NOT 为其注入人工域标记或任何包装文本。workflows 列表项 SHALL 按旧→新 workflow id 映射改写——旧指令 id 无法匹配任何技能模板，不改写则搬运后首次 init 装 0 个技能。搬运 MUST NOT 通过重新序列化 YAML 实现。

迁移报告 SHALL 额外提供机读字段 `movedRules`（本轮写入的规则文件项目相对路径列表），供 init/update 的 rules 重建/修复步骤在该轮跳过对迁移产物的常量对齐，避免用户既有规则内容被同轮重写。

#### Scenario: context 逐字保留

- **GIVEN** 旧 config.yaml 的 context 多行块含用户自写内容
- **WHEN** 执行迁移
- **THEN** 新 config.yaml 的 context 与原文逐字一致

#### Scenario: rules 列表改名与落点直达语义名

- **GIVEN** 旧 config.yaml 的 rules 列表为 [tr_impl, tr_test, spec] 且 rules/ 下有 tr_impl.md 与 tr_test.md
- **WHEN** 执行迁移
- **THEN** 新 config 的 rules 列表为 [impl, test, spec]，新 rules/ 下为 `coding-rules.md`、`testing-rules.md` 与 `spec.md`，MUST NOT 生成 `impl.md` / `test.md`，无缺失规则文件

#### Scenario: 搬运内容逐字保留且登记 movedRules

- **GIVEN** 旧 rules/tr_impl.md 含用户自写规则行
- **WHEN** 执行迁移
- **THEN** `coding-rules.md` 内容与旧文件逐字一致，且迁移报告的 `movedRules` 含该文件路径，使同轮 rules 修复不对其做常量对齐

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

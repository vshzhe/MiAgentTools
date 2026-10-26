# artifact-markdown-source 增量规格

> 本 delta 只做**措辞收口**：跨变更索引（`iagent spec reindex`）随本变更整体退役后，本 Requirement 不应再把「索引」列为只读兼容的产出去向。

## MODIFIED Requirements

### Requirement: Legacy JSON artifacts require explicit migration

历史 `change.json`、`tasks.json` 与旧 sidecar SHALL 被视为兼容输入而非新真源。若相应 Markdown 已存在，Markdown SHALL 优先且系统 MUST NOT 合并 JSON 内容；若只有 JSON，读取方 MAY 以只读兼容方式提供**状态**并发出 WARN（索引类消费方已随 `sqlite-cross-change-index` 退役，MUST NOT 再产出或要求索引），写操作 SHALL 引导先执行显式迁移。迁移 SHALL 不覆盖已有 Markdown，且默认 MUST NOT 删除 JSON。

#### Scenario: 历史 JSON-only 变更只读检查

- **WHEN** `status` 等只读查询检查只有 JSON 制品的历史变更
- **THEN** 系统 MAY 读取 JSON 生成兼容状态并记录 WARN
- **AND** 普通查询 MUST NOT 修改 JSON 或生成隐式 Markdown 副本
- **AND** MUST NOT 尝试写入任何跨变更索引（该索引能力已退役）

#### Scenario: Markdown 与历史 JSON 并存

- **WHEN** 同一变更同时存在 Markdown 制品和对应 JSON 数据
- **THEN** Markdown SHALL 是唯一权威来源，JSON MUST NOT 覆盖、补全或与 Markdown 自动合并

#### Scenario: 显式迁移遇到已存在目标文件

- **WHEN** 用户对 JSON-only 变更运行显式迁移且目标 Markdown 文件已存在
- **THEN** 迁移 SHALL 拒绝覆盖并报告冲突路径，除非用户先显式处理该冲突

#### Scenario: 显式迁移成功

- **WHEN** 用户显式请求 JSON 到 Markdown 迁移且目标文件均不存在
- **THEN** 系统 SHALL 生成 OpenSpec Markdown 并校验其结构
- **AND** JSON 源文件 SHALL 保留，只有再次显式指定删除选项且校验成功后才可删除

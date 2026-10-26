## ADDED Requirements

### Requirement: 技能 description SHALL 采用统一结构

每个技能的 `description` SHALL 采用统一结构：**中文一句话用途 + 触发词（中英）+ `NOT for …（改用 X）` 排歧**。既有仅含中文用途的技能 MUST 在本变更内补齐触发词与排歧；英文式描述 MUST 保留原英文触发关键词。

#### Scenario: 全部技能具备触发词

- **WHEN** 运行 description 结构测试
- **THEN** 每个技能 description SHALL 含触发词段（中英关键词）
- **AND** 缺触发词的技能 SHALL 使测试失败

#### Scenario: 跨技能边界含 NOT for 排歧

- **WHEN** 两个技能职责相邻（如 `workflow` / `auto_workflow` / `debug`；`feature_doc` / `requirement_doc`）
- **THEN** 相邻技能的 description SHALL 含 `NOT for` 排歧指向正确替代技能
- **AND** 排歧覆盖范围 SHALL 由测试以清单形式锁定

#### Scenario: 长度约束保持

- **WHEN** 运行 description 长度测试
- **THEN** 长度 SHALL ≤ 1024（硬上限）
- **AND** ≥ 800 时 SHALL 触发软告警（不失败）

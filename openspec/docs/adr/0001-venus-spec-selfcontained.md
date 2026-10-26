# ADR-0001: venus spec 功能自持，不依赖 openspec CLI

- **状态**：已接受（2026-09-08）
- **背景**：OpenSpec 自定义分支的 explore/propose/apply/archive/verify 技能依赖 openspec CLI（status/instructions/new change/archive 命令）驱动 artifact 状态机
- **决策**：迁移到 VenusAgentTools 后，由 venus CLI 自研 spec 命令组（venus spec new/status/instructions/archive）提供状态校验与流程支撑，技能正文全部改调 venus 命令，零 openspec CLI 依赖
- **理由**：用户明确要求 venus 全流程自持；venus 自身即 CLI，技能由 venus init 安装，运行前提天然满足
- **影响**：
  - artifact 依赖图内置硬编码（spec-driven：proposal→specs/design→tasks），不读取 openspec/schemas/ 下的 schema.yaml
  - 沿用 openspec/ 目录约定（changes/、specs/、explorations/），写 .openspec.yaml 兼容元数据 —— venus 与 openspec CLI 创建的变更互认
  - delta spec→主 spec 合并由 spec-archive 技能 AI 执行（源项目 sync-specs 同为 AI 驱动），CLI 仅做状态检查+目录移动
- **备选方案**：保留 openspec CLI 依赖 + 降级模式（被否决：不满足自持要求）；纯文件系统推断无 CLI（被否决：状态校验是确定性逻辑，应由 CLI 保证）

# Design: improve-template-dual-layer-optimization

## Context

VenusAgentTools 的 SKILL 模板存储在 `src/core/templates/workflows/*.ts`（26 个文件，合计 ~15,690 行源代码），每个模板的 `instructions` 字符串是 AI 加载技能时读入的完整指令文本。产物通过 `venus generate` / `venus init` / `venus update` 写入 `.claude/skills/` 和 `.claude/commands/venus/`。

**关键组件**：
- `generateSkillContent()` (`src/core/command-generation/generator.ts:15`)：将 SkillTemplate 拼装为 frontmatter + instructions 的 SKILL.md
- `SkillTemplate.references` (`src/core/templates/types.ts:11-16`)：SkillReference[] 类型，定义附加参考文件
- `writeSkillReferences()` (`src/utils/file-system.ts:38-48`)：将 references 写入 `<skillDir>/references/*.md`
- `runUpdate` 的 `syncReferences` (`src/commands/update.ts:120-123`)：先 removeDir 再 writeSkillReferences
- `buildPromptGateBlock/Compact` (`src/core/templates/prompt-gate.ts:119-172`)：Gate 全文渲染 vs 压缩渲染
- `buildFlowchartBlock/Compact` (`src/core/templates/flowchart-gate.ts:109-172`)：流程图全文渲染 vs 压缩
- `deriveCommandContent()` (`src/core/templates/derive-command.ts:23-87`)：CMD:SKIP 裁剪
- `SPEC_DRIVEN_SCHEMA` (`src/core/spec/schema.ts:41-82`)：artifact 输出路径定义（proposal.md / design.md / specs / tasks.md）

**现有 artifact 数据流**：
```
spec-propose → 写 proposal.md / design.md / specs/*.md / tasks.md
spec-apply   → 读 tasks.md（解析 checkbox）→ 更新 tasks.md checkbox
spec-verify  → 读全部 MD → 正则提取需求/任务 → 对比
requirement-doc → 读 design.md → AI 推理决策表 → 渲染
spec-explore → Glob openspec/specs/*/explorations.md → Read 全部匹配文件
```

## Goals / Non-Goals

**Goals**:
- 将 5 个 Gate 注入模板的 instructions 从 ~320 行重复注入缩减为 ~20 行 compact + references
- 将 26 个模板的通用护栏文本从 ~10 行/个缩减为 1 行
- 将 5 个模板的输出示例（~345 行）移入 references
- 建立 JSON sidecar 层：tasks.json / decisions.json / capabilities.json / manifest.json 从 MD 同步生成
- 建立 SQLite 索引：归档写入、探索/提案查询
- init/update/hand-modified 保护完全兼容

**Non-Goals**:
- 不修改 release-package.ts（外部独立技能）
- 不建立 JSON→MD 的反向同步（JSON 是只读加速层）
- 不实现 index.db 多机同步（不入库，本地生成）
- 不实现实时 JSON Schema 校验（离线生成，运行时降级容错）
- 不修改 artifact 的 MD 格式本身（MD 仍是真源）

## Decisions

### D1: Gate 采用 compact inline + 全文 references
- **选择**: SKILL instructions 用 `buildPromptGateCompact()` + `buildFlowchartCompact()`（~20 行），全文版写入 `references/prompt-gate.md` + `references/flowchart-gate.md`
- **理由**: Compact 函数已存在且经过测试；tr-init.ts 已验证 references 机制可行；AI 在清晰输入时不读 references（零额外 token），仅在 Gate 触发时按需读取
- **备选**: 
  - 保持 full inline → 否决：每个模板浪费 320 行
  - 全部移 references + 模板仅留一行引用 → 否决：AI 需要 compact 版的核心判定规则来决策是否触发 Gate

### D2: JSON Sidecar 存储于变更目录 .venus/ 下
- **选择**: `openspec/changes/<name>/.venus/manifest.json` / `tasks.json` / `decisions.json` / `capabilities.json`
- **理由**: `.venus/` 已在 .gitignore 中忽略，不入库；与项目级 `.venus/config.yaml` 目录层级一致；变更归档时随目录整体移动
- **备选**:
  - 存在 `openspec/.venus/sidecars/<name>/` → 否决：归档时需要额外移动逻辑
  - 内联在 MD frontmatter → 否决：破坏 MD 的人类可读性

### D3: JSON 缺失时降级解析 MD（而非报错）
- **选择**: 所有 JSON sidecar 的消费方 MUST 在文件缺失时 fallback 到解析对应 MD（保持与当前行为完全一致），并记录 WARN
- **理由**: 存量变更和第三方手动创建的变更可能没有 JSON sidecar；降级保证零破坏性
- **备选**: 
  - 缺失时报错 → 否决：破坏兼容性
  - 静默降级不 WARN → 否决：用户无法知晓使用了降级路径

### D4: SQLite 通过 better-sqlite3 或 sqlite3 CLI 操作
- **选择**: 优先使用 Node.js `better-sqlite3`（同步 API，无编译问题）；其不可用时降级为 `sqlite3` CLI（`Bash(sqlite3:*)`）
- **理由**: better-sqlite3 是 CodeGraph 已有的依赖（同在项目中），同步 API 适合 CLI 工具；CLI 降级保证 Windows 环境兼容
- **备选**:
  - 纯 CLI → 否决：每操作一个进程，慢
  - 纯 better-sqlite3 → 否决：Windows 上 native 模块可能有编译问题

### D5: references 生命周期由 update 的 syncReferences 统一管理
- **选择**: `syncReferences` 先 `removeDir(references/)` 再 `writeSkillReferences`（整体替换），不保留旧 references 文件
- **理由**: references 是生成的派生文件（与 SKILL.md 同源），不应保留旧版本；整体替换最简单且无残留
- **备选**:
  - 逐文件对比更新 → 否决：实现复杂度高，残留风险大
  - 不删除旧文件 → 否决：重命名/删除的 reference 文件会残留

### D6: 前端模板（tr-impl-frontend）按组件类型拆分 references
- **选择**: 拆分为 5 个文件：jsp-page-structure.md / component-selection-tree.md / form-validation-templates.md / dwr-ajax-call-patterns.md / page-generation-flow.md
- **理由**: 2,160 行的单文件过大；组件类型是自然的拆分边界；AI 在生成特定类型页面时只需读对应 reference
- **备选**:
  - 全部内联 → 否决：体积问题
  - 拆分更细（按组件实例） → 否决：文件过多，维护复杂

## Risks / Trade-offs

| 风险 | 缓解 |
|:---|:---|
| AI 不主动读取 references 文件（即使 Gate 触发也不读） | instructions 中显式写 `> 完整的 Gate 细则见 references/prompt-gate.md。**仅在 Gate 实际触发时读取全文。**`；tr-init 已验证可行 |
| Compact 版丢失全文版中的关键规则 | compact 函数与 full 函数同一源（参数化渲染），差异仅在详细程度；测试覆盖保证 |
| Windows 上 better-sqlite3 编译失败 | 降级为 sqlite3 CLI（`Bash(sqlite3:*)`）；再失败则跳过索引功能（WARN） |
| JSON sidecar 与 MD 不一致（用户手改 MD 后 JSON 未更新） | JSON 缺失时降级解析 MD；不一致时以 MD 为准并自动修正 JSON（WARN 日志） |
| references 中的大文本与 SKILL.md 同步更新时产生版本漂移 | 两者由同一次 `generateSkillContent()` 调用的同一 template 对象生成，保证一致性 |
| artifacts 的 JSON sidecar 写入失败（磁盘满/权限） | 非阻断：SKILL 继续，仅 WARN 缺失 sidecar；下次写入时重试 |
| 存量已归档变更无 JSON sidecar | `venus spec reindex` 降级解析 MD 提取数据；不影响已经归档的变更 |
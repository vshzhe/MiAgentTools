# Design: improve-artifact-full-json-primary

## Context

### 当前架构（工作区基线）
- `tasks.json` 已是 JSON-primary（`renderTasksMd()` + `venus spec tasks render` 已实现，未发布）
- `spec-propose.ts` L277-320 已有"JSON Sidecar Generation"显式步骤段，但基于 **4 独立薄文件**设计（manifest/tasks/decisions/capabilities），且引用的 `venus spec sidecar manifest` 子命令与旧设计耦合
- `src/commands/spec.ts` 已有：`spec new / status / instructions / archive / reindex / tasks render / sidecar init / sidecar manifest`
- 需求文档（`tr-docs-requirement-doc.ts`）从 proposal.md/design.md 散文 AI 推理提取章节；仅"关键技术决策"表有 decisions.json 可选优化
- 归档主 spec 同步（`spec-archive.ts` L60-79 / `spec-bulk-archive.ts` L158-171）从 specs/*.md 散文 AI 分类操作
- 生成协议（`openspec/rules/artifact-generation.md`）为 MD 模板填充式，**无 JSON 步骤**——被 spec-propose / tr-impl-workflow / tr-impl-auto-workflow 三条路径共享

### 相关变更
- `improve-template-dual-layer-optimization`（已归档）：设计 Layer B JSON Sidecar + SQLite 索引
- `fix-spec-sidecar-primary-artifact`（在途未提交）：4 文件 primary 模式部分落地——**被本变更取代**（其剩余任务不再需要独立完成）
- `improve-auto-workflow-allowed-tools`（在途）：不受影响

### 影响链
```
sidecar-schema.ts（合并 ChangeSchema）
  → sidecar-writer.ts（read/write/init + 3 render）
    → spec.ts（render 命令 + sidecar init + reindex）
      → instructions.ts（jsonTemplate）
        → artifact-generation.md（JSON-first 协议）
          → 10 个模板（生成 3 + 消费 7）
```

## Goals / Non-Goals

**Goals**:
- 提案结构化数据合并为单一主产物 `.venus/change.json`（proposal/design/specs 三段）
- 全部下游消费（需求文档/归档同步/验证评分/调试同步/复查）优先读 JSON，MD 降级
- 生成协议单一源：JSON-first 步骤收敛进 artifact-generation.md，三条生成路径统一生效
- `venus spec instructions` 提供 jsonTemplate，AI 写 JSON 不猜 schema
- 降级链完整：new JSON → 旧 JSON → MD（逐级 WARN）

**Non-Goals**:
- exploration.md / tasks.json 的格式变更（tasks.json 保持独立现状）
- 旧 3 文件的批量迁移脚本（渐进覆盖）
- 主 spec（openspec/specs/**/spec.md）自身的 JSON 化（仅其**同步输入**改为 JSON）
- SQLite 表结构变更
- Markdown→JSON 反向同步

## Decisions

### D1: 合并为单一 `.venus/change.json`（三段：proposal / design / specs）
- **选择**: `{ "$schema": "venus/change/v1", changeName, createdAt, updatedAt, phase, proposal: {...}, design: {...}, specs: [...] }`
- **理由**: 用户明确要求合并；单一写点消除多文件同步问题；读方一次读取获得全部结构化上下文；旧 manifest 根字段全量吸收；tasks.json 独立保持 apply 进度管线不变
- **备选**: 保持 3 独立文件——碎片化、多文件探测、名字不达意

### D2: proposal 段结构
- **选择**: `{ why: string, whatChanges: string[], capabilities: { new: [{name, description}], modified: [{name, description}] }, impact: { files: [{path, description}], breaking: boolean, compatibility: string } }`（new/modified 统一 CapabilityDecl 形状）
- **理由**: 与 proposal.md 的 Why/What Changes/Capabilities/Impact 四段一一对应；capabilities.new/modified 按模板分组；breaking 布尔便于索引与校验
- **备选**: capabilities 单层数组带 type 字段——与模板的 New/Modified 双标题结构不匹配

### D3: specs 段数组嵌套 + 完整操作字段
- **选择**: `specs: [{ name, path, operations: [{ type, requirement, description, scenarios: [{name, given, when, then}], reason?, migration?, from?, to? }] }]`
- **理由**: 数组嵌套键序确定；REMOVED 的 reason/migration 与 RENAMED 的 from/to 是归档合并的必需字段（旧 capabilities.json 缺失）；`path` 记录渲染目标（`specs/<name>/spec.md`）
- **备选**: capability 名为顶层 key——键序不确定，校验困难

### D4: design 段 context 用 string，其余结构化
- **选择**: `{ context: string, goals: string[], nonGoals: string[], decisions: DecisionEntry[]（复用）, risks: [{risk, mitigation}] }`
- **理由**: Context 是叙述性段落；Goals/Non-Goals/Decisions/Risks 已充分结构化；decisions 复用既有 DecisionEntry（相关文件/理由/备选/风险字段完整）
- **备选**: context 结构化拆分——过度设计，AI 填写成本高

### D5: render 函数为段落级纯函数
- **选择**: `renderProposalMd(proposal: ProposalSection, changeName): string` 等三个，输入段落级对象而非整个 ChangeSchema
- **理由**: 与 renderTasksMd 模式一致；可独立测试；CLI 层负责从 change.json 提取段落再调用
- **备选**: 输入整个 ChangeSchema——耦合无用字段，测试构造膨胀

### D6: CLI 统一 `venus spec render <type>` 取代 `spec tasks render`
- **选择**: 单命令 `venus spec render <type> --change <name>`，type ∈ {proposal, specs, design, tasks}；proposal/specs/design 读 change.json 对应段，tasks 读 tasks.json；**读取时校验**（校验失败报字段名+原因，退出码非零）
- **理由**: 单命令面；校验点前移到渲染（AI 修 JSON → 重渲染）；替换未发布的 tasks render 不构成对外破坏
- **备选**: 保留 tasks render + 新增三个命令——命令面膨胀

### D7: change.json 写入采用「整文件 Write + 段落累积」
- **选择**: AI 按依赖序逐段累积写入（Step1 写含 proposal 段的完整文件 → Step2 重写含 proposal+specs 段 → Step3 含三段），每次整文件 Write；CLI 提供 `sidecar init` 生成含根字段的空骨架
- **理由**: AI 全程持有各段内容，整文件 Write 无读改写竞态；避免复杂的分段 CLI 写入 API
- **备选**: CLI `sidecar set --section` 分段写入——引入文件锁/合并语义复杂度，收益不匹配

### D8: 生成协议单一源（artifact-generation.md 承载 JSON-first 步骤）
- **选择**: JSON-first 生成步骤（写段 → render → 校验失败修正 → 渲染失败降级手写 MD）写入 `openspec/rules/artifact-generation.md` G2；spec-propose.ts 的 JSON 段改为引用协议 + 仅保留变更特有细节
- **理由**: 三条生成路径（spec-propose 独立 / tr-impl-workflow 内联 / tr-impl-auto-workflow 内联）统一生效，避免三处重复维护（项目既有「单一源」防漂移模式）
- **备选**: 仅改 spec-propose——工作流内联路径绕过 JSON，产生两类变更

### D9: 下游消费统一「JSON 优先 → MD 降级」链
- **选择**: 需求文档 / 归档同步 / verify / verify-proposal / review-proposal / debug 六个技能统一读取链：`.venus/change.json`（段落）→ 旧 JSON → MD 散文（逐级 WARN）
- **理由**: 结构化读取替代散文推理（需求文档决策表、归档操作分类、验证覆盖对比）；降级链保证存量变更与异常场景不阻断
- **备选**: 强制 JSON（无降级）——存量变更全部阻断，违反渐进原则

### D10: jsonTemplate 契约（instructions 输出新增字段）
- **选择**: `venus spec instructions <artifact>` 输出新增 `jsonTemplate`（该 artifact 对应段落的 JSON schema 模板字符串）；`templates/index.ts` 导出常量，`instructions.ts` 组装
- **理由**: AI 写 JSON 前获得机器提供的确切 schema，消除字段名猜测；字段为新增（向后兼容）
- **备选**: schema 只写在协议文档——AI 需跨文件检索，且协议文档非机器校验源

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| AI 整文件重写 change.json 时丢失先前段落 | 协议指令明确"累积写入、不得丢弃已有段"；render 校验失败会暴露段缺失；测试覆盖段保留性（write→再 write 含新段→旧段仍在由 AI 保证，CLI 侧提供 init 骨架格式基准） |
| 模板指令量增大（三段 schema + 步骤） | schema 单一源放 instructions 的 jsonTemplate + 协议文档；模板正文引用不复制 |
| 归档合并从散文改结构化后，AI 对 operations 的语义仍可能有偏差 | specs 段的 operations 由 propose 阶段写入（与 delta spec MD 同源生成，一致性由渲染保证——MD 从 JSON 渲染，天然一致） |
| 3 个生成路径中 auto-workflow 未直接引用协议文件 | 任务中显式更新 auto-workflow Phase 2 引用协议；artifact-dataflow 类测试核验 |
| 在途变更 fix-spec-sidecar-primary-artifact 与本变更文件重叠 | 本变更取代其剩余工作；其被取代后的定位由用户在归档/关闭时裁决（在途未提交，无发布破坏） |
| `spec tasks render` / `sidecar manifest` 移除影响在途文档 | 两者均未发布（工作区在途态）；全部引用点（spec-propose L286/L301 等）在本变更中一并更新 |
| Windows 路径：change.json 位于 `.venus/` 子目录 | 复用 ensureSidecarDir + path.join 既有设施；测试含 Windows 归一化断言 |
| instructions.jsonTemplate 字段新增破坏解析方 | 纯新增字段；现有解析方（技能模板）仅读已知字段，向后兼容 |
| design 段为结构化契约（context 字符串 + 结构化字段），原先散写 design.md 的自由表格（D6/D7/D8 交互矩阵、API 契约表、DB 映射表）不再有独立渲染位 | 改由 `context` 字符串（可内嵌 Markdown）或 decisions 描述承载；verify 技能对缺失表自然降级（"可用时参考"→ 跳过/WARNING，其既有契约已覆盖）；后续如确需结构化承载可扩展 DesignSection 字段（本期不做） |

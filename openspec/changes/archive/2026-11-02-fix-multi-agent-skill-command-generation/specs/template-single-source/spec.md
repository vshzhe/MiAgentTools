## ADDED Requirements

### Requirement: Pi 与 OpenCode 指令适配器中英 Input 参数占位符注入与代码块隔离

Pi 与 OpenCode 指令适配器（`piAdapter` 与 `opencodeAdapter`）在格式化指令正文时 SHALL 使用统一的共享参数注入规则：
- 仅在围栏代码块（` ``` `）外部匹配顶层输入契约段落（支持英文 `**Input**:` 与中文 `**输入**：` / `**输入**:`），在该段落末尾注入一行 `**Provided arguments**: $ARGUMENTS`；
- 围栏代码块内部出现的 `**Input**:` 或 `**输入**：`（如报告模板示例）MUST NOT 触发参数占位符注入；
- 当顶层输入段落声明 `None required` 或 `无需参数`（如 `spec-bulk-archive`），或指令正文已包含 `$ARGUMENTS` 或 `$1`..`$9` 位置参数占位符时，适配器 MUST 跳过注入；
- 接受用户参数的内置模板（含 `migration`、`proposal-review`、`spec-verify-proposal`）SHALL 提供标准顶层 `**输入**：` 或 `**Input**:` 声明行，确保全部有参指令在 Pi 与 OpenCode 下均获得 `$ARGUMENTS` 注入。

#### Scenario: 顶层中英文输入段落均正确注入参数占位符

- **WHEN** 为 Pi 或 OpenCode 生成顶层含 `**Input**: <说明>` 或 `**输入**：<说明>`（且非无参声明）的指令产物（含补齐 `**输入**：` 后的 `migration`、`proposal-review`、`spec-verify-proposal`）
- **THEN** 产物正文 SHALL 在该顶层输入段落末尾紧接注入一行 `**Provided arguments**: $ARGUMENTS`

#### Scenario: 围栏代码块内的输入示例不触发误注入

- **WHEN** 指令模板的围栏代码块（` ``` `）内部包含 `**输入**:` 或 `**Input**:` 示例文本（如报告模板 / 代码示例内的同形行）
- **THEN** 适配器 MUST NOT 在围栏代码块内部注入 `**Provided arguments**: $ARGUMENTS`，注入仅发生在代码块外的顶层输入声明段
- **AND** 非围栏的非顶层示例段（如 `proposal-review` 的 `## 检查示例` 段，第 714 行）MUST 由「仅匹配首个顶层输入段」语义排除，MUST NOT 被当作注入锚点

#### Scenario: references 内容不承载 CMD:SKIP 标记

- **WHEN** 生成任一技能的 `references/*.md`
- **THEN** 其内容 MUST NOT 含 `CMD:SKIP` / `/CMD:SKIP` 字面量（`CMD:SKIP` 仅作用于 `SkillTemplate.instructions`，参考文件不经派生，标记会原样发布给用户）

#### Scenario: 中英文无参声明与已有占位符跳过注入

- **WHEN** 指令顶层输入声明为 `None required` 或 `无需参数`（如 `spec-bulk-archive`），或正文已含 `$ARGUMENTS` / `$1`
- **THEN** 生成的 Pi 与 OpenCode 指令产物 MUST NOT 注入 `**Provided arguments**: $ARGUMENTS`

## MODIFIED Requirements

### Requirement: 派生正文支持技能版与指令版差异

当技能版需要比指令版承载更多参考性内容时，模板 MUST 使用成对的 `<!-- CMD:SKIP -->` 与 `<!-- /CMD:SKIP -->` 标记裁剪仅技能版内容；未标记内容默认保留到指令版，Guardrails 和执行必需的防护语句不得被裁剪。

各模板的 `CMD:SKIP` 边界 SHALL 保证派生后的指令版（Command）语义自洽且不丢失关键步骤或防护规则：
- `spec-explore.ts` SHALL 删除常量 `EXPLORATION_PROTOCOL_FULL`（唯一落点 `references/exploration-protocol.md`）中冗余的英文 `**Input**:` 行；因该内容不进入 `deriveCommandContent` 派生面，MUST NOT 用 `CMD:SKIP` 包裹（标记会原样写入参考文件），指令版输入段由主正文唯一提供；
- `spec-archive.ts` SHALL 在指令版中保留 `ARCHIVE-INDEX.md` 补充标注标签白名单规则（`[代码]` / `[测试]` / `[DB脚本]` / `[使用说明]`），不得将其随示例一并裁剪；实现上 SHALL 将该白名单规则句移出 `CMD:SKIP` 区块，MUST NOT 仅平移起止标记（平移会连带裁掉需保留的白名单句）；
- `spec-propose.ts` SHALL 在指令版中保留 Step 0.2~0.7 探索文件扫描、提示用户关联、`CONTEXT.md` 检查与探索文件移动逻辑，使独立执行 `/iagent:spec-propose` 指令时具备完整的探索文件关联能力。

#### Scenario: 仅技能版内容被安全裁剪

- **WHEN** skill 正文包含成对 `CMD:SKIP` 标记的参考性段落（如 `spec-propose` 的 Step 0.2~0.7 逐步操作细节、`spec-archive` 的 a/b/c/d 归档索引操作步骤）
- **THEN** `deriveCommandContent()` 从 command 正文移除该段及标记本身，消除仅技能版可见内容
- **AND** skill 正文仍保留该段内容

#### Scenario: 关键防护语句与核心步骤在指令版保留

- **WHEN** 派生 `spec-archive` 与 `spec-propose` 的 command 正文
- **THEN** `spec-archive` 指令版 SHALL 保留 `ARCHIVE-INDEX.md` 补充标注标签白名单防护规则，`spec-propose` 指令版 SHALL 保留 Step 0.2~0.7 探索文件扫描与迁移步骤
- **AND** 派生结果不泄漏 `CMD:SKIP` 标记

#### Scenario: 异常裁剪标记按 fail-safe 处理

- **WHEN** skill 正文包含未闭合起始标记、孤立结束标记或嵌套/乱序标记
- **THEN** 派生结果遵循 `deriveCommandContent()` 的 fail-safe 规则，不因异常标记丢失正文或防护语句
- **AND** 输出正文不包含任何 `CMD:SKIP` 标记行

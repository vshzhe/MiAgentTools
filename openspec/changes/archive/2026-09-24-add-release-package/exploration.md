## Background

用户请求（3 部分）：
1. **迁移自动打包技能到当前项目**：把 `C:\Users\venus\.claude\skills\auto-package-verifier` 迁移到 VenusAgentTools（本项目）。
2. **关联脚本随 SKILL/初始化时一起生成**：检查自动打包技能的关联脚本（pre-package-check.sh、verify-package.sh）也迁移到本项目，后续随 SKILL 或初始化时一起生成。
3. **增强：升级信息归集**：迁移版本的 SKILL 需要根据"打包文件 + 提案"，自动查找对应的 SQL、配置参数信息，输出到对应文档中，用于升级使用。

源技能位置：`C:\Users\venus\.claude\skills\auto-package-verifier\`
- `SKILL.md`（技能主指令，三阶段校验：打包前预检→打包执行监控→打包后一致性校验）
- `使用说明.md`（用户文档）
- `scripts/pre-package-check.sh`（15KB，打包前预检）
- `scripts/verify-package.sh`（29KB，打包后一致性校验）
- `references/build-config-spec.md`（build.xml 配置规范与项目类型判定）
- `references/error-codes.md`（错误码与诊断手册）

源技能定位：基于 `auto-package.sh`（`E:\github\Auto-Package-Svn\`）的 SVN 增量打包质量校验，适用 `E:\WorkSpaces_ahdx\` 下 Venus4A 系列 Web 项目与 AccountManager/AuthServer 等 Server 项目。校验基准为 SVN 变更清单（非 build.xml）。

## Analysis (optional - if analysis run)

### Capability Exploration Memory (injected)

注入两个最相关迁移先例的能力探索记忆（`openspec/specs/tr-migration-skills/explorations.md` + `tr-workflow-suite-skills/explorations.md`）：

**迁移先例共识（tr-migration-skills add-tr-migration-suite 2026-09-11）**：
- D1 命名以用户显式输入为准；按 deriveCommandId 反推类型归属；新增类型需用户裁决（tr_docs 8→9 类先例）。否决了名称冲突的 tr_migration。
- D2 迁移技能**不入默认集**（可选扩展件），DEFAULT_WORKFLOWS 不变，经 workflows 字段勾选或 DEPS 注入安装。
- D6 allowedTools 分技能盘点（正文实际命令逐项核对）。
- D7 迁移方式=**逐段复制+定点替换**（instructions/content 从源模板逐段复制为基准，按替换表做生态引用适配，禁止重写正文防行为漂移）。
- D9 registry 按类型分区注册（与 SKILL_TYPES 顺序一致）。
- 边界：**全量测试的技能数量断言随技能总数联动**，新增技能需同步 `test/{commands,validate-update,uninstall-show,config-command,skills-parity}.test.ts` 的硬编码计数。

**迁移先例共识（tr-workflow-suite-skills add-tr-workflow-suite 2026-09-14）**：
- 技能名硬约束：`venus_<type>_<name>` + `tr-` 前缀联立（type=spec 与 tr_ 前缀冲突曾导致命名修正）。
- 5 技能均不入默认集，经 workflows 勾选或 DEPS 注入。
- allowedTools 白名单逐项核对（AGENTS.md 守则 2）。
- 输出路径路由模式：active→changes/{name}/，archived→devdocs/{date}-{name}-（从归档目录名 YYYY-MM-DD- 前缀解析）。

### Deep Analysis Trigger
- Triggered: Yes
- Reason: 本质是"迁移+增强"现有技能体系（向 VenusAgentTools 新增一个带脚本的技能），属修改现有代码（registry/profiles/templates 体系），触发深度分析。
- Scope: src/core/templates/workflows/（新模板）、src/core/templates/registry.ts（注册）、src/core/profiles.ts（默认集/DEPS）、test/*（计数断言）、skills/ 快照、.claude/skills/ dogfood 产物。

## Codebase Findings

### Discovered Files

**源技能（待迁移）**：
- `C:\Users\venus\.claude\skills\auto-package-verifier\SKILL.md`：技能主指令，三阶段校验流程 + 参数传递追问规则 + 错误诊断。
- `C:\Users\venus\.claude\skills\auto-package-verifier\使用说明.md`：用户向使用文档（与 SKILL.md 内容部分重叠）。
- `C:\Users\venus\.claude\skills\auto-package-verifier\scripts\pre-package-check.sh`：打包前预检脚本（5 类校验：参数/路径/配置/工具链/版本号≤HEAD）。
- `C:\Users\venus\.claude\skills\auto-package-verifier\scripts\verify-package.sh`：打包后一致性校验脚本（SVN 变更清单基准 + 路径映射 + 内部类 + ECJ 字节码抽检 + 并行优化）。
- `C:\Users\venus\.claude\skills\auto-package-verifier\references\build-config-spec.md`：build.xml 配置规范、项目类型判定矩阵、各项目配置一览。
- `C:\Users\venus\.claude\skills\auto-package-verifier\references\error-codes.md`：完整错误码与诊断手册。

**本项目迁移落点（已确认机制）**：
- `src/core/templates/workflows/tr-<name>.ts`：技能模板源（TS，导出 get<Name>SkillTemplate + get<Name>CommandTemplate）。
- `src/core/templates/registry.ts`：WORKFLOW_PAIRS 注册表（101-134 行数组）。
- `src/core/templates/types.ts`：SkillTemplate 接口（含 references: SkillReference[] 字段，{path, content}）。
- `src/core/templates/registry.ts:88` deriveCommandId：venus_<type>_<name> → <type>-<name>。
- `src/core/profiles.ts`：DEFAULT_WORKFLOWS（8 项）+ DEPS 依赖注入表 + resolveWorkflows。
- `src/core/config.ts`：SKILL_TYPES 9 类（tr_init/tr_impl/tr_test/tr_commit/tr_review/tr_release/tr_tools/tr_docs/spec）。
- `src/core/command-generation/generator.ts:50` generateSkillContent：生成 SKILL.md，references 透传。
- `src/utils/file-system.ts:52` writeSkillReferences：写入 references（content 无关 utf8，**支持非 markdown**——脚本可作为 references 嵌入）。
- `scripts/generate-skills.mjs`：生成 skills/ 快照，处理 references（44-51 行）。
- `src/commands/init.ts:137`：init 时 writeSkillReferences 部署 references（**脚本随 init 生成**的落点）。
- `skills/`：静态快照（勿手编，pnpm generate:skills 生成，skills-parity.test.ts 防漂移）。
- `.claude/skills/`：dogfood 安装产物。

**带 references 的先例技能**（脚本嵌入参考）：
- `skills/venus_tr_test_generate/references/schema-java.md` + `schema-node.md`（多 schema 测试生成）
- `skills/venus_tr_impl_frontend/references/*.md`（5 个前端模板文件，tr-impl-frontend.ts 达 92KB）

### Identified Symbols

- `SkillTemplate` (src/core/templates/types.ts:22)：技能模板接口，references 字段为 SkillReference[]。
- `SkillReference` (src/core/templates/types.ts:11)：{path, content}，content 为正文（类型签名是 string，不限定 markdown）。
- `generateSkillContent` (src/core/command-generation/generator.ts:50)：生成 SKILL.md，透传 references。
- `writeSkillReferences` (src/utils/file-system.ts:52)：写入 references 到技能目录（content 无关）。
- `deriveCommandId` (src/core/templates/registry.ts:88)：技能名→指令 id 派生。
- `resolveWorkflows` (src/core/profiles.ts:81)：解析生效 workflow 集（默认集/用户配置+依赖注入）。
- `DEFAULT_WORKFLOWS` (src/core/profiles.ts:17)：默认 8 项。
- `DEPS` (src/core/profiles.ts:44)：依赖注入规则表。

### Pattern Matches

- **references 嵌入模式**：模板 TS 文件内嵌 references 为 {path, content} 字符串数组，generateSkillContent 透传，writeSkillReferences/generate-skills.mjs 写入。content 无关 → 脚本（.sh）可走同一通道（path: "scripts/pre-package-check.sh"）。
- **迁移逐段复制模式**（先例 D7）：从源模板逐段复制，按替换表做生态引用适配，禁止重写正文。
- **可选扩展件模式**（先例 D2）：不入 DEFAULT_WORKFLOWS，经 workflows 勾选或 DEPS 注入。

### Other Project Findings

源技能依赖的外部资源（非本项目，环境依赖）：
- `E:\github\Auto-Package-Svn\auto-package.sh`：增量打包脚本本体（阶段二调用）。
- `E:\github\Auto-Package-Svn\auto-package.conf`：默认 JDK/Ant/输出目录配置。
- `E:\WorkSpaces_ahdx\*`：被打包的 SVN 项目（Venus4A 系列 + Server 项目）。
- 环境：Git Bash、SVN CLI、JDK（ECJ 编译）、Ant（可选）。

## Questions

### Q1-Q4（第3部分输入/输出定义，L1 意图，已确认）

**Q1 提案指什么？** → 答：**OpenSpec 变更提案**（openspec/changes/\<name\>/proposal.md）。本项目用 OpenSpec 规划 Venus4A 变更，打包时关联对应提案，从 design/tasks 抽取 SQL 与配置说明。

**Q2 SQL 信息来源？** → 答：**全部四源**（多选）：
1. 产出中的 .sql 文件（增量包内变更的 .sql 直接归集）
2. Java/Mapper XML 内嵌 SQL（扫描变更 DAO/Service/Mapper 抽取建表/改表/DML）
3. 独立 db/migration 目录（按版本号对应查找）
4. 提案 tasks 的 [DB脚本] 标记（从 tasks.md 标 [DB脚本] 任务抽取）

**Q3 配置参数来源？** → 答：**全部三源**（多选）：
1. 产出中的配置文件（.properties/.xml/.yaml diff 出新增/修改参数项）
2. 提案声明的配置项（从 proposal/design 显式声明抽取）
3. 特定配置文件（固定关注 auto-package.conf / 项目 config 等关键参数）

**Q4 升级文档输出位置？** → 答：**产出目录 升级文档.md**（与 readme.txt/filelist.txt 同级，随增量包交付运维）。

## 术语表

| 术语 | 定义 | 避免使用 |
|------|------|---------|
| 自动打包技能 | auto-package-verifier，基于 auto-package.sh 的 SVN 增量打包三阶段质量校验技能 | 打包技能（宽泛） |
| 打包文件 | 打包产出目录中的变更文件（增量包内容），校验基准 | 产出（口语） |
| 提案 | OpenSpec 变更提案 proposal.md，第3部分升级信息归集的变更来源输入（已写入 CONTEXT.md） | 提案文档、proposal 英混 |
| 升级文档 | 阶段四输出物，产出目录 升级文档.md，归集 SQL（四源）+ 配置参数（三源）供升级部署（已写入 CONTEXT.md） | 升级说明、release notes |

> 已加载 openspec/CONTEXT.md 全部术语（spec 技能、变更、artifact、delta spec、依赖图、前置验证门、迁移技能套件、工作流技能套件、制品生成协议、单一 prompt 源、skip_specs 等）。本探索沿用既有术语，不重复定义。

## 架构决策

（grill 确认后累积）

## 边界场景

- [x] 脚本作为 references 嵌入：generate-skills.mjs 与 init 的 writeSkillReferences 按 utf8 写入 .sh，Windows 无 +x 位，靠 `bash <技能目录>/scripts/xxx.sh` 调用（与源 SKILL.md 调用模式一致，无新风险）。
- [x] 只校验已有产出场景（跳过阶段一二）：阶段四仍可触发——基于已有产出目录 + readme.txt 反查提案 + 扫描产出文件归集 SQL/配置。readme.txt 不存在时跳过反查，仅产出文件归集（D11）。
- [x] 被打包项目无 OpenSpec 提案 / readme.txt 提交说明无 change 名：静默跳过提案来源（D11），仅归集产出文件中的 SQL（D7 ①②③）/配置（D8 ①③），升级文档头部注明"未关联到 OpenSpec 提案"。
- [x] 多版本多 change：按 change 名去重分组（D12），一升级文档含多 change 区段；全部 revision 均无 change 名时退化为单区段产出文件归集。
- [x] readme.txt 不存在（非 auto-package.sh 产出 / 手工打包）：跳过反查，仅产出文件归集，文档头部注明。
- [x] 一个 change 跨多 revision：去重后归一为该 change 区段，区段内列全部关联 revision。
- [x] 测试数量断言联动：新增 1 技能（总计 23→24），同步 test/{commands,validate-update,uninstall-show,config-command,skills-parity}.test.ts 硬编码计数（先例边界）。
- [x] 技能部署上下文：技能运行处需有 openspec/changes/（即从 VenusAgentTools 或采用 OpenSpec 的项目运行），Venus4A SVN 项目本身不需 OpenSpec——产出在 -o 路径，提案在运行项目的 openspec/。

## Decision Process

### Decision: 技能类型归属与命名（待确认）
**Options Considered**:
- Option A: 归 `tr_release` 类型，名 `venus_tr_release_package_verify`（打包校验属发布/交付活动，无需扩类型体系）
- Option B: 新增 `tr_package` 类型（9→10 类），名 `venus_tr_package_verify`（语义独立但扩类型体系改动大）
- Option C: 保持 `auto-package-verifier` 原名不 venus 化（违反硬约束，否决）

**Chosen**: [待确认，倾向 A]
**Rationale**: 打包校验是发布交付环节，tr_release 已有"版本发布"技能（venus_tr_release_version 管 git tag/changelog），打包校验与之互补；先例 D1 表明新增类型需用户裁决，能不扩则不扩。

### Decision: 脚本嵌入策略（待确认）
**Options Considered**:
- Option A: 两个 .sh 脚本作为 references 嵌入（path: scripts/*.sh），随 build/init 生成（满足"随 SKILL 或初始化时一起生成"）
- Option B: 脚本独立存仓库，SKILL 引用绝对路径（不随 init 生成，违背需求2）
- Option C: 脚本内联进 SKILL.md instructions（44KB 过大，否决）

**Chosen**: [待确认，倾向 A]
**Rationale**: writeSkillReferences content 无关，先例 tr_test_generate/tr_impl_frontend 已用 references 嵌入多文件；脚本走同通道即满足"随 SKILL/初始化生成"。references/*.md（build-config-spec、error-codes）同理嵌入。

### Decision: 第3部分增强的形态（待确认 — 核心 ambiguity）
**Options Considered**:
- Option A: 作为打包技能的"阶段四：升级信息归集"，打包校验通过后扫描产出+关联提案+抽取 SQL/配置，生成升级文档
- Option B: 独立新技能（如 venus_tr_release_upgrade_doc），与打包技能解耦
- Option C: 嵌入阶段三 verify-package.sh 脚本内（脚本化抽取）

**Chosen**: [待确认，倾向 A]
**Rationale**: 保持 打包→校验→升级文档 管线内聚；脚本化（C）难以处理"提案"关联这类需语义判断的输入。

## Decisions

- **D1 类型与命名**：归 `tr_release` 类型（发布交付活动，与 venus_tr_release_version 互补，不扩类型体系——先例 D1 能不扩则不扩），名 `venus_tr_release_package_verify`，command id `tr-release-package-verify`。
  > 命名修订（用户裁决，两次：2026-09-16 弃用 `_verify` 后缀 / 2026-09-24 去除 `tr_` 前缀）。**最终名 `venus_release_package`，command id `release-package`，模板文件 `src/core/templates/workflows/release-package.ts`，导出 `getReleasePackageSkillTemplate()` / `getReleasePackageCommandTemplate()`，`metadata.type` 仍为 `tr_release`。** 见 design D16 与下方 Scope Changes 表。
  > 注意：最终名不含类型段，是全仓首个突破 `venus_<type>_<name>` 约定的技能（类型语义改由 frontmatter `metadata.type` 承载）。`deriveCommandId` 与 `validate` 均不强制名字含类型段，校验通过。
- **D2 脚本嵌入策略**：两个 .sh 脚本（pre-package-check.sh、verify-package.sh）+ 两个 references/*.md（build-config-spec.md、error-codes.md）作为 `references` 嵌入模板（path: scripts/*.sh 与 references/*.md），随 build/init 生成——满足"随 SKILL 或初始化时一起生成"。writeSkillReferences content 无关，先例 tr_test_generate/tr_impl_frontend 已验证多文件嵌入。
- **D3 不入默认集**：DEFAULT_WORKFLOWS 保持 8 项不变，经 `.venus/config.yaml` workflows 字段勾选安装（先例 D2，所有迁移技能均不入默认集）。
- **D4 迁移方式**：逐段复制 + 定点替换（源 SKILL.md/使用说明.md → 模板 instructions/references，按替换表做生态引用适配，禁重写正文防行为漂移——先例 D7）。
- **D5 第3部分形态**：作为打包技能"阶段四：升级信息归集"，阶段三校验通过后触发，形成 打包→校验→升级文档 内聚管线（同一技能内）。
- **D6 提案定义**：OpenSpec 变更提案 openspec/changes/\<name\>/（proposal.md + design.md + tasks.md），升级信息归集的变更来源输入。
- **D7 SQL 来源**：全四源归集——①产出中的 .sql 文件 ②Java/Mapper XML 内嵌 SQL ③独立 db/migration 目录 ④提案 tasks 的 [DB脚本] 标记。
- **D8 配置参数来源**：全三源归集——①产出中的配置文件（.properties/.xml/.yaml diff）②提案声明的配置项 ③特定配置文件（auto-package.conf/项目 config 等关键参数）。
- **D9 升级文档输出**：产出目录 `升级文档.md`（与 readme.txt/filelist.txt 同级，随增量包交付运维）。
- **D10 提案关联机制**：SVN revision 反查——读产出 readme.txt（auto-package.sh 已含各 revision 提交作者/日期/说明），按约定格式从提交说明提取 change 名 → 定位 openspec/changes/\<name\>/。复用产出已有信息，无需额外 svn 远程调用。
- **D11 反查失败处理**：静默跳过提案来源（提交说明无 change 名/提案不存在时），仅归集产出文件中的 SQL/配置，不阻断、不提示用户手动指定。升级文档头部注明是否关联到提案。
- **D12 多版本组织**：按反查到的 change 名去重分组——一文档含多 change 区段，或一 change 跨多 revision。适应各种提交粒度。
- **D13 allowedTools**：按正文实际命令盘点（先例 D6/AGENTS.md 守则 2）——Bash(bash:*)（调脚本）、Read/Write/Edit/Glob/Grep（扫描产出+提案+生成文档）、Bash(svn:*)（readme.txt 缺失时可选 svn log fallback，但主路径读 readme.txt 不需 svn）。
  > 修订（2026-09-24，用户裁决）：白名单扩为 `Bash(bash:*), Bash(svn:*), Bash(javac:*), Bash(cat:*), Read, Write, Edit, Glob, Grep`。依据为**正文实际命令盘点**而非 svn fallback 假设——正文"诊断辅助命令"与参数追问段实际含 `svn info/diff/log/update`、`javac`（单独编译定位编译缺失）、`cat`（仅扫描，不拦截）。见 design D13。

## Scope Changes

| 变更时间 | 变更类型 | 变更描述 | 原因 |
|---------|---------|---------|------|
| 2026-09-16 | 范围扩张 | 新增 D14：把外部 `E:\github\Auto-Package-Svn` 运行时（auto-package.sh + conf + ps1 + lib/ecj-4.6.3.jar + 使用说明）备份到项目内 `vendor/auto-package-svn/` | 打包脚本本体外部依赖，不可版本控制、不可移植（proposal Why 第 3 条） |
| 2026-09-16 | 范围扩张 | 新增 D15：技能不写死 vendor 路径，读 `.venus/config.yaml` 的 `auto_package.runtime_dir`（默认 `vendor/auto-package-svn`） | 用户裁决"增加可配置路径"，解耦技能与运行时位置 |
| 2026-09-16 | 命名修订 | D1 命名 `venus_tr_release_package_verify` → `venus_tr_release_package`（command id `tr-release-package-verify` → `tr-release-package`） | 用户裁决 drop `_verify` |
| 2026-09-24 | 命名修订 | 再去除 `tr_` 前缀：`venus_tr_release_package` → `venus_release_package`（command id `tr-release-package` → `release-package`）；同步模板文件名 `tr-release-package.ts` → `release-package.ts`、导出函数 `getTrReleasePackage*` → `getReleasePackage*`、变更目录 `add-tr-release-package` → `add-release-package`、能力目录 `specs/tr-release-package/` → `specs/release-package/`；`metadata.type` 仍为 `tr_release` | 用户裁决去掉 `tr_` 前缀 |

## Pending

### For Phase 2 Impact Analysis
- `WORKFLOW_PAIRS` (src/core/templates/registry.ts:102)：新增技能注册项的插入位置影响安装/展示顺序。
- `DEFAULT_WORKFLOWS` / `DEPS` (src/core/profiles.ts)：若入默认集或需依赖注入则改动；倾向不入。
- `test/commands.test.ts` / `validate-update.test.ts` / `uninstall-show.test.ts` / `config-command.test.ts` / `skills-parity.test.ts`：技能数量硬编码断言需同步（先例边界）。
- `SKILL_TYPES` (src/core/config.ts:33)：若选 Option B（新类型）则改动；倾向不改。

### Security Concerns
- 无（本任务为技能模板迁移，无安全敏感操作）。

### Business Validation
- [x] 第3部分"提案"指什么 → OpenSpec 变更提案（D6，已确认）。
- [x] SQL 来源 → 全四源（D7，已确认）。
- [x] 配置参数来源 → 全三源（D8，已确认）。
- [x] 升级文档输出位置 → 产出目录/升级文档.md（D9，已确认）。
- [x] 提案关联机制 → 读 readme.txt 反查 change 名（D10，已确认）。
- [x] 反查失败处理 → 静默跳过提案来源（D11，已确认）。
- [x] 多版本组织 → 按 change 名去重分组（D12，已确认）。

### Unresolved Decisions
- 无（全部 L1-L5 决策已确认，一致性门通过）。

## Implementation Deep-Dive

### Design Rationale
- references 机制设计为 content 无关的 {path, content}（types.ts:11 注释提"Markdown 正文"但类型签名是 string，writeSkillReferences 按 utf8 写入不限定格式）——支撑脚本嵌入无需改机制。
- 迁移技能不入默认集的设计（先例 D2）：保持默认集精简，可选扩展件经 workflows 勾选安装。

### Constraints
- AGENTS.md 守则 1：改技能模板后必须 `pnpm build && pnpm generate:skills`，否则 skills-parity.test.ts 失败。
- AGENTS.md 守则 2：allowedTools 必须覆盖正文实际命令，否则权限拦截。
- AGENTS.md 守则 4：新增技能类型需改 SKILL_TYPES（倾向不改）。
- 硬约束：技能名 `venus_<type>_<name>`，type 必须是 SKILL_TYPES 之一。

### Trade-offs
- 脚本作为 references 嵌入 vs 独立文件：嵌入满足"随 init 生成"但 TS 模板文件增大（+44KB，先例 tr-impl-frontend.ts 92KB 可接受）；独立文件违背需求2。
- 第3部分作为阶段四 vs 独立技能：阶段四内聚但技能职责扩大；独立技能解耦但管线割裂。

### Pattern Usage
- references 嵌入模式（tr_test_generate/tr_impl_frontend 先例）。
- 逐段复制+定点替换迁移模式（tr-migration-skills 先例 D7）。
- 可选扩展件模式（不入默认集，先例 D2）。

### Historical Context
- tr_test_generate v3.0 多 schema 模式：主 SKILL 语言无关，语言专属内容拆 references/schema-*.md 按需 Read——可借鉴"主 SKILL + references 脚本"结构。
- 迁移套件/工作流套件均从源项目 OpenSpec 迁移，经 workflows 勾选安装，不入默认集。

### Implicit Assumptions
- [x] 被打包项目（Venus4A 等 SVN 项目）不使用 OpenSpec——OpenSpec 提案在 VenusAgentTools（运行技能的项目），通过 readme.txt 反查关联（D6/D10，已确认）。
- [x] 增量包产出可能含 .sql 文件与配置文件（Venus4A 增量变更覆盖 src/conf/*.sql、*.properties/*.xml 等）；不含时该源归集为空，不报错（D7/D8 多源互补）。

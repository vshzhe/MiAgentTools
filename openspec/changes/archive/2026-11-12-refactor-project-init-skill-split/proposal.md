# 变更提案：refactor-project-init-skill-split

## Why

project-init 第 11 步「项目前后端技能蒸馏」当前内嵌于单一模板正文（`src/core/templates/workflows/project-init.ts:303-320`），存在三个问题：

1. **不可单独调用**：用户无法在已有项目上只生成前端或后端设计技能，必须完整跑一遍 project-init；
2. **串行慢**：两侧蒸馏由主 agent 内联串行执行，无法利用宿主子代理并发能力；
3. **生成范围粗**：内嵌正文只有「框架证据 → 生成 → C1-C6」骨架，未细化前后端各自应覆盖的设计维度（前端组件 / 分页 / table / 页面 / 弹窗 / 数据交换，后端数据库 / MVC / 接口 / 网络安全），也未承载用户要求的「新能力 vs 历史能力注意事项」与前端设计模板（页面骨架 / 弹窗骨架 / 数据交换约定）产出。

本次变更把该能力拆分为两个独立可调用的生成侧技能（exploration.md D1），project-init 改为编排者（并发派发 + 单点注册 + 汇总报告，D3/D4），并按用户清单细化两侧生成范围（D2/D8）。

## What Changes

- **新增技能模板** `iagent_frontend_skill_gen`（workflowId `frontend-skill-gen`，类型 `init`）：承载前端侧证据判定 → 生成项目技能 → 前端设计模板生成 → C1-C6 自检协议；可独立调用（自身注册），也可被 project-init 委派（跳过自身注册）(D1/D2/D8)
- **新增技能模板** `iagent_backend_skill_gen`（workflowId `backend-skill-gen`，类型 `init`）：承载后端侧同构协议（无设计模板产出）(D1/D2)
- **改写 project-init Step 11**：从内联蒸馏正文改为「派发环境判定 → 并发派发两侧生成侧技能 → 单点注册 config.yaml → 汇总报告」；新增降级路径（无子代理能力 / 派发失败 → 主 agent 串行内联，标注降级）(D3/D4/D6)
- **注册表扩容**：`WORKFLOW_PAIRS` 新增 2 个成对注册（skill + command 自动派生）(D1)
- **依赖注入**：`DEPS` 表新增 project-init → frontend-skill-gen / backend-skill-gen 注入边，选装 project-init 自动带上两技能 (D7)
- **产物契约不变**：目标项目技能默认 `phases: both` 单文件 + 既有拆分条件；`ProjectSkillScope` 枚举不变 (D5)
- 全流程保持非阻断语义与 C1-C6 证据约束；共享清单 ≠ 内容模板，无证据维度标「不适用 + 探测依据」(D2/D6)

## Capabilities

### New Capabilities

- `skill-gen-workflows`: 前后端生成侧技能（frontend-skill-gen / backend-skill-gen）——单侧技能蒸馏协议（证据判定、范围清单、设计模板、C1-C6、独立调用自身注册、被委派时跳过注册）
- `project-init-skill-dispatch`: project-init 的技能蒸馏编排——并发子代理派发、降级串行、单点注册、汇总报告、依赖注入安装

### Modified Capabilities

（无既有 spec 能力被修改——openspec/specs/ 当前无已归档能力规格）

## Impact

### Impact Analysis

影响分析（Phase 2.0，按 exploration.md Pending 符号逐一执行）：

- `getProjectInitSkillTemplate`（src/core/templates/workflows/project-init.ts:153）：6 个调用方位于 `src/core/templates/registry.ts` 与本文件；测试影响 `test/project-init-scan.test.ts`、`test/codegraph-protocol.test.ts` —— Step 11 正文改写后两测试文件需同步核对断言
- `WORKFLOW_PAIRS` / `getSkillTemplates`（src/core/templates/registry.ts:97,131）：约 50 个调用方（生成、更新、opencode-v2、pi-native 等）与 20+ 测试文件 —— 新增成对注册后 `test/skills-parity.test.ts`、`test/template-derivation.test.ts`、`test/templates.test.ts` 等自动覆盖新模板；`src/commands/config.ts:41` 的「14 项」注释需更新为 16 项
- `DEPS`（src/core/profiles.ts:53）：3 个调用方在本文件内，测试 `test/profiles.test.ts`、`test/stage-continuation.test.ts` —— 新增注入边需补 profiles 测试断言
- `collectFileSignals`（src/core/version-bump.ts:312）：新增技能模板属「新增技能模板」minor 信号，需核对信号是否按模板注册表枚举自动覆盖（若按硬编码清单则需补条目）
- `getKnownCommandIds`（src/core/templates/registry.ts:180）：指令引用校验集合自动扩大，无额外改动

### 直接影响的文件

- `src/core/templates/workflows/frontend-skill-gen.ts`: [新增] 前端生成侧技能模板（含设计模板协议）
- `src/core/templates/workflows/backend-skill-gen.ts`: [新增] 后端生成侧技能模板
- `src/core/templates/workflows/project-init.ts`: Step 11 改写为编排（派发判定 / 并发派发 / 降级 / 单点注册 / 报告）；allowedTools 增加 `skillDelegation(['frontend_skill_gen','backend_skill_gen'])` 与 `${SUBAGENT_DISPATCH}`
- `src/core/templates/registry.ts`: `WORKFLOW_PAIRS` 注册 2 个新成对模板
- `src/core/profiles.ts`: `DEPS` 注入 project-init → 两新技能
- `src/core/version-bump.ts`: 核对/补齐「新增技能模板」版本判定信号
- `src/commands/config.ts`: listAllWorkflowIds 计数注释更新
- `skills/`: `pnpm generate:skills` 重新生成的快照
- `AGENTS.md`: 仓库地图模板计数（20 → 22）与新技能说明同步
- `test/`: 新增两技能模板测试（结构 / 白名单 / 派生一致性 / 项目技能蒸馏自检引用）；更新 `test/project-init-scan.test.ts` 等 Step 11 相关断言

### 向后兼容

无破坏性变更。新增技能模板与注入边为纯增量；project-init Step 11 对外行为（产物形态、非阻断、已存在处理）保持兼容；既有装机不受影响（新技能随下次 update 安装）。

# 技术设计：refactor-project-init-skill-split

## Context

### 现状与影响链

- project-init 第 11 步「项目前后端技能蒸馏」内嵌于模板正文（`src/core/templates/workflows/project-init.ts:303-320`），固定排在第 10 步规则蒸馏之后（`:290`）；产物为 `.iagent/skills/frontend-design.md` / `backend-design.md`（默认 `phases: both`，满足拆分条件时 design/implement 两文件），写入前执行 C1-C6 自检（`:309-316`），写入后自动注册 config.yaml `skills:` 段（`:318`）
- 白名单调用类条目单一源在 `src/core/templates/tool-whitelist.ts`：`skillDelegation`（:93，委派条目归一化）、`SUBAGENT_DISPATCH`（:52，`Agent, Task` 双写）——派发条目仅正文确有派发动作的技能持有
- 注册表 `WORKFLOW_PAIRS`（`src/core/templates/registry.ts:97`）成对注册技能+指令，指令白名单由配对技能单点回填（`:167-171`）；`deriveCommandId`（`:75`）派生指令 id
- 依赖注入真源 `DEPS`（`src/core/profiles.ts:53`）；默认集 `DEFAULT_WORKFLOWS`（`profiles.ts:17`）
- 项目技能 frontmatter 契约已含 `ProjectSkillPhases`（design|implement|both，`src/core/project-skills.ts:22`）与 `ProjectSkillScope`（frontend|backend|both，`:25`），生成产物无需扩枚举 (D5)

### 流程基准（经确认，exploration.md `## 功能流程图`）

本设计引用探索文件中经用户确认的功能流程图（Mermaid `flowchart TD`，节点 N1-N12）与关键操作节点清单表，**不重建流程**。节点概览：N1 调用 project-init → N2 前置 Step 1-10 → N3 派发能力判定 →（是）N4 并发派发 /（否）N9 降级串行 → N5 前端侧执行（含设计模板）/ N6 后端侧执行 → N7 单点注册 → N8 汇总报告；独立路径 N10 单独调用 → N11 单侧执行+自身注册 → N12 单侧报告。任务与节点的逐一映射见 tasks.md 的 `[N<id>]` 标注。

## Goals / Non-Goals

**Goals**:

- 把前后端技能蒸馏拆为两个独立可调用的生成侧技能（单独调用 + project-init 集成调用）(D1)
- project-init 经子代理并发生成两侧，含降级路径 (D3/D6)
- 按用户清单细化两侧生成范围，前端含页面设计 / 弹窗设计与设计模板产出 (D2/D8)
- config.yaml 注册收敛为父级单点串行 (D4)

**Non-Goals**:

- 不改变目标项目技能的产物契约（默认 `phases: both` + 既有拆分条件、`ProjectSkillScope` 枚举）(D5)
- 不改变 C1-C6 自检、人工域标记、非阻断语义（沿用既有协议）
- 不新增 CLI 命令与 `SKILL_TYPES` 条目（新技能类型用既有 `init`）
- 不改变本仓 spec 工作流的分级执行约定（D3 的并发是**生成给目标项目的 project-init 技能**在目标项目内的派发，与本仓编排阶段无关）

## Decisions

### D1: 拆分形态——两个独立技能模板
- **选择**: 新增 `iagent_frontend_skill_gen` / `iagent_backend_skill_gen`（类型 `init`），各承载单侧协议；project-init Step 11 改为编排者
- **理由**: 单侧职责单一、可单独调用、正文长度与语言一致性约束可控
- **备选**: 单技能参数分侧（正文双分支膨胀、单独调用粒度粗）；维持内联（不满足诉求）——均否决

### D2/D8: 生成范围——扫描维度清单而非内容模板
- **选择**: 用户清单（前端含页面设计 / 弹窗设计 / 设计模板；后端六维度）写入两模板正文作为扫描维度清单；生成内容仍受 C1-C6 约束，无证据标「不适用 + 依据」；设计模板落 `.iagent/templates/frontend/`（页面骨架 / 弹窗骨架 / 数据交换约定）
- **理由**: 清单约束范围、证据约束内容，二者正交；防止凭清单编造项目没有的能力
- **备选**: 把清单当作内容模板逐项硬填——违反零猜测原则，否决

### D3: 并发与降级
- **选择**: project-init 正文新增派发指令段并持有 `${SUBAGENT_DISPATCH}`；无子代理能力或派发失败（重试一次）→ 主 agent 串行内联 + 报告标注降级
- **理由**: 复用 spec-apply 派发协议范式与 project-init 既有降级同构模式（`:201-202`）；degraded MUST NOT 伪装委派完成
- **备选**: 仅串行内联（不满足并发诉求）；强制要求子代理能力（阻断非阻断原则），否决

### D4: 注册单点
- **选择**: 子代理只写技能文件；config.yaml 注册由 project-init 在两侧完成后单点串行执行（逐行段替换、幂等）
- **理由**: 逐行段替换不支持并发写同一文件；注册聚合属 project-init 编排职责
- **备选**: 子代理各自注册（并发写 config 冲突风险），否决

### D5: 产物契约不变
- **选择**: 目标项目技能默认 `phases: both` 单文件 + 既有拆分条件；scope 枚举不变
- **理由**: 本次只拆「生成能力」，不改「生成产物」契约；兼容性优先

### D6: 异常语义
- **选择**: 单侧失败 / 证据不足 → 该侧不生成并报告原因，另一侧继续；重试一次后降级内联；全流程非阻断
- **理由**: 沿用 project-init 非阻断原则（`:171`）与既有「注册失败不回滚」语义

### D7: 依赖注入安装
- **选择**: `DEPS` 表新增 project-init → frontend-skill-gen / backend-skill-gen；`DEFAULT_WORKFLOWS` 不显式加入（注入承担）
- **理由**: 与「选 spec-propose 自动带 spec-verify-proposal」同构；避免默认集膨胀
- **备选**: 加入默认集显式列表（未选 project-init 的用户也安装，无意义），否决

### D9（实现细节）: 被委派时跳过自身注册
- **选择**: 生成侧技能正文声明双态注册：独立调用执行自身注册；被 project-init 委派（委派输入含集成模式标记）时跳过自身注册
- **理由**: 避免双写 config 与并发冲突；硬约束见 exploration.md `## 硬约束` 末条
- **备选**: 始终自身注册 + project-init 不注册（破坏单点语义），否决

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 两模板与 project-init 残留正文漂移（C1-C6 双写） | 共享蒸馏检查清单提取为模板共享常量模块（同 `codegraph-protocol.ts` 模式），三处引用同一真源 |
| 并发子代理报告回执不一致 | 固定四列最小回执（任务 id / 状态 / 产出文件 / 公开签名），父级按回执汇总 |
| 安装面扩大（+2 workflow） | 依赖注入仅在选装 project-init 时生效；config 交互清单计数注释同步 |
| 新增模板触发 parity / derivation / 语言一致性等既有回归 | 改模板后执行 `pnpm build && pnpm generate:skills`；测试先行覆盖结构断言 |
| 版本判定信号遗漏 | `collectFileSignals` 按注册表枚举核对；若为硬编码清单则补条目（任务清单含核对项） |

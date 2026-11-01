# 宿主权限手工验证清单（Claude UI / CLI / headless）

> 变更来源：`fix-mode-delegation-host-parity`（M1 权限层 canonical 化 + M3 运行表面）。
> 用途：仓库内测试只能锁定**生成侧结构**（白名单形态、宿主产物、协议一致性），宿主弹窗
> 无法自动化断言。本清单用于发布前在真实宿主上区分「权限弹窗」与「业务门」，并核对
> 落盘规则形态。
>
> **判定前提（强制）**：每条用例 MUST 记录当次**权限姿态**（Claude：`default` /
> `acceptEdits` / `plan` / `bypassPermissions`；CLI 等价物同理）。`bypassPermissions`
> 或等价全放行姿态下的「无弹窗」**不构成通过证据** —— 必须以非 bypass 姿态重跑后才可判定。
>
> **背景**：旧产物写入的裸名条目（`Skill(spec_apply)`）是**死条目**（宿主按完整技能名
> 匹配授权，裸名永不放行），无任何放行作用；它不是「缺陷未修复」的证据，也不得据此
> 判定通过/失败。canonical 形态为 `Skill(iagent-<workflowId>)`。

## 0. 准备

- [ ] 在测试项目执行 `iagent init --force`（或 `iagent update`），确认技能与指令已刷新
- [ ] 确认 `.claude/settings.json` 的 `permissions.allow` 含 `Skill(iagent-...)` 条目
      （可 `grep "Skill(iagent-" .claude/settings.json`）
- [ ] 清理 `.claude/settings.local.json` 中**本次验证前**记录的旧裸名规则（可选；仅
      避免干扰观察，不要删除用户自建的其它规则）

## 1. Claude UI（IDE / 桌面插件）

### 1.1 技能间委派免审批（权限层）

- [ ] 权限姿态：`default`（**非** bypassPermissions）
- [ ] 用例：在 UI 会话中调用 `/iagent:spec-explore <主题>`，随后由其委派
      `iagent_spec_propose`
- [ ] 预期观察：
  - [ ] 委派 `iagent_spec_propose` 时**不出现**权限弹窗
  - [ ] 若仍弹窗，记录**弹窗来源**（工具名 / 技能名）与提示文本
- [ ] 批准一次后检查 `.claude/settings.local.json`：
  - [ ] 新增规则形态为 `Skill(iagent-spec-propose)`（完整技能名）
  - [ ] **不是** `Skill(spec_propose)`（裸名条目为死条目，不能作为通过证据）
- [ ] 判定：新增规则为 canonical 且重复委派不再弹窗 → 通过

### 1.2 业务门仍在（语义层，不被权限放行掩盖）

- [ ] 权限姿态：`default`
- [ ] 用例：运行 `/iagent:auto-workflow <需求>` 至 Phase 4（自动实现）
- [ ] 预期观察：
  - [ ] 设计确认门（spec-apply Step 5.5）**被跳过**（gate-skip 生效）
  - [ ] **测试执行门 / 范围蔓延确认 / 编译失败处理**照常生效（业务门未被跳过）
- [ ] 判定：仅设计确认门被跳过 → 通过；若其它门被跳过 → 失败并记录

### 1.3 业务门与权限弹窗可区分

- [ ] 记录本次会话中所有「停下来等待用户」的时点，逐条归类为：
      **权限弹窗**（宿主工具审批）或 **业务门**（技能正文声明的确认门）
- [ ] 判定：两类必须可区分；把业务门归类为权限问题（或反之）→ 判定失败

## 2. Claude CLI（`claude` 交互式）

### 2.1 权限姿态差异

- [ ] 记录姿态：`default` / `acceptEdits` / `plan` / `bypassPermissions`（本次实际值）
- [ ] 用例：同 1.1（`/iagent:spec-explore` → 委派 propose）
- [ ] 预期观察：
  - [ ] `bypassPermissions` 下无弹窗 **不构成证据**（该姿态放行一切工具）
  - [ ] 以 `default` 重跑后，canonical 条目使委派免审批
- [ ] 判定：仅在非 bypass 姿态下验证通过才算通过

### 2.2 落盘规则形态

- [ ] 检查 `settings.local.json` 新增规则的**规则名**：`Skill(iagent-<workflowId>)`
- [ ] 检查不存在新增的裸名条目（`Skill(<裸名>)`）
- [ ] 判定：形态为 canonical → 通过；出现裸名新增 → 失败

## 3. headless（`claude -p` / SDK）

- [ ] 用例：`claude -p "/iagent:spec-explore <主题>"`（无交互 TTY）
- [ ] 预期观察：
  - [ ] 条件门（需求澄清类）**记录决策并继续**，输出 WARN；不得谎称已获用户确认
  - [ ] 不可豁免门（实现 + 测试桥 / 归档桥 / 破坏性改动确认）遇到未确认时以
        `status=blocked` 回执中止，并给出恢复路径（改为交互式执行或显式 degraded）
- [ ] 判定：headless 不伪装可交互 strict → 通过；静默越门 → 失败

## 4. 旧裸名条目核对

- [ ] 在存量项目的 `settings.local.json` / `settings.json` 中检查是否存在
      `Skill(spec_apply)` 一类裸名条目
- [ ] 预期结论：记为「死条目、无放行作用」；执行 `iagent update` 后新写入的条目为
      canonical，旧条目可在确认无其它依赖后手工清理
- [ ] 判定：**MUST NOT** 把「旧裸名条目存在」当作缺陷未修复的证据

## 5. 记录表

| 用例 | 宿主 | 表面 | 权限姿态 | 是否弹窗 | 弹窗来源 / 规则名 | 业务门是否生效 | 判定 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | Claude | UI | | | | | |
| 1.2 | Claude | UI | | | | | |
| 2.1 | Claude | CLI | | | | | |
| 3 | Claude | headless | | | | | |

> 说明：本清单为发布前的**人工闸**；仓库内自动化只覆盖生成侧结构断言（见
> `test/allowed-tools.test.ts` / `test/host-orchestration.test.ts`）。

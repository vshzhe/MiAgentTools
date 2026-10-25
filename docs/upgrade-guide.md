# 旧装机升级指引（venus → iagent）

本指引面向上一个版本（品牌与命名为 `venus` 口径）的既有装机，说明升级到 2.0.0 时
`iagent init` / `iagent update` **会自动做什么、会删掉什么、告警怎么读**，以及需要保留手工修改时
应在升级前做什么。

破坏性变更本身（技能名前缀、指令命名空间、配置目录、CLI 二进制名全部改名）见
[变更日志 2.0.0 的 BREAKING 小节](../CHANGELOG.md)与
[`iagent-rebrand` 变更提案](../openspec/changes/iagent-rebrand/proposal.md)；
本文只讲旧装机如何安全落地。

## 两条边界

升级时请先记住这两条，其余细节都由此推导：

| 边界 | 含义 |
|---|---|
| **旧技能一律删除** | 各工具目录下 `venus_*` 技能与 `commands/venus/` 指令**整体删除，不区分是否被手工修改过**。新旧并存会让技能清单与补全列表出现两套相似条目，且旧条目永不更新。丢失风险以**显式告警**对冲，而不是保留副本 |
| **配置内容保真搬运** | `.venus/config.yaml` 的 `context` 多行块、用户自写的规则行、注释行、未知段与自定义字段（如 `auto_package.runtime_dir`）**逐字保留**；只有 `rules:` 与 `workflows:` 两个列表项及 `rules/` 下的规则文件名会改名 |

## 迁移会自动做什么

`iagent init` 与 `iagent update` 的最开头内置一次性迁移，先于配置读取与产物生成执行
（也先于孤立产物扫描，因此旧产物不会被误报为「不在生效 workflows 配置中」）。

1. **配置搬运**（`.venus/` → `.iagent/`）
   - `context` 多行块、注释行、未知段、自定义字段逐字搬移（逐行段替换，不重新序列化 YAML）
   - `rules:` 列表项按类型映射改名（`tr_impl→impl`、`tr_test→test`、`spec` 不变 …），
     规则文件**落点直达语义名**：`tr_impl.md` → `.iagent/rules/coding-rules.md`、
     `tr_test.md` → `.iagent/rules/testing-rules.md`、`spec.md` 不变；搬运内容**逐字保留**
     （不改写正文、不注入人工域标记），并登记在迁移报告的 `movedRules` 机读字段中
   - `workflows:` 列表项按旧→新指令 id 映射改名（如 `tr-impl-workflow` → `workflow`、
     `tr-commit-push` → `svn-commit`、`spec-explore` 不变）。**这一步很关键**：旧指令 id 无法匹配任何技能
     模板，不改名则升级后首次 `init` 会装 0 个技能
   - 4.0.0 起已移除技能（`tr-impl-feature` / `tr-release-version` / `release-package` /
     `tr-tools-pwd` / `tr-tools-list` / `tr-impl-frontend`）不再有映射项，其旧 id 原样保留后
     因无匹配技能被忽略；`tr-impl-genfull` 与 `tr-impl-workflow` 均映射到 `workflow`
   - `scan-baseline.json` 随目录搬移
   - 内容全部搬运完成后，`.venus/` 目录被移除
2. **旧产物清理**
   - 各工具目录（`.claude/` / `.pi/` / `.codex/`）下 `venus_*` 技能目录与 `commands/venus/` 指令文件
   - 旧版品牌产物的四类：`~/.venus-completion.sh`、PowerShell profile 下的 `VenusCompletion.ps1`、
     rc/profile 中 `# VENUS-COMPLETION:START/END` 成对标记块、变更目录下的旧 sidecar 目录
     `openspec/changes/<name>/.venus/`、跨变更索引库 `openspec/changes/archive/.venus/index.db`
   - 非 `venus_` 前缀的技能与指令**完全不触碰**
3. **报告**：搬运项 / 删除项 / 跳过项三段计数与明细，加告警与提示

## 升级前需要做什么

- **要保留手工修改过的旧技能正文**：迁移会删除旧技能且不做备份。请先在升级前把改动**手动抄到**
  新口径技能上（升级后由 `iagent init` 重新生成），或至少把旧技能目录复制到本工具作用范围之外
  （`.claude/skills/` 等目录之外）保存。升级后再从副本里取内容。
- **想先看清影响面再动手**：直接跑 `iagent init --no-migrate` 安装新口径产物，`.venus/` 与旧产物
  原样保留；确认无误后再跑一次 `iagent init` 让迁移发生。
- **旧 `~/` 下的补全痕迹**：迁移会删除旧补全脚本并移除 rc/profile 中的旧标记块。旧标记块不被新
  工具识别（`iagent completion uninstall` 匹配不到它）却仍会 source 旧脚本，造成补全项重复与冲突，
  因此这一步是必要的。

## 规则文件：旧名删除与人工域（8.0.0）

8.0.0 起 `.iagent/rules/` 的规则文件名改为**语义名**：`impl` → `coding-rules.md`、
`test` → `testing-rules.md`、`spec` → `spec.md`。映射外类型（如 `commit`）仍在 `rules/`
下建 `<type>.md`。

### 1. 旧名文件会被整体删除

`iagent init` / `iagent update` 检测到 `.iagent/rules/impl.md` / `test.md` 即**整体删除**
（不合并内容、不做兼容读取），并逐文件输出丢失风险告警：

```text
! 旧名规则文件 .iagent/rules/impl.md 已整体删除：该文件可能承载你手写的内容，删除存在丢失风险；新规则请写入 .iagent/rules/coding-rules.md
```

升级前若曾在旧名文件里手写内容，请先改名或合并到 `coding-rules.md`（`test.md` →
`testing-rules.md`）再跑 init/update。

### 2. 人工域：手写规则的长期落点

规则文件分两段：

| 区段 | 内容 | 谁维护 |
|---|---|---|
| **常量域** | 头注释 + 蒸馏基线规则行 | `iagent init` / `iagent update` 确定性重建与对齐 |
| **人工域** | `<!-- 人工域:开始 -->` 与 `<!-- 人工域:结束 -->` 之间 | 你手写或 `project-init` 技能蒸馏写入；自动更新**逐字保留** |

把项目特异性规则写在人工域区间内，即不会再被常量对齐重写：

```markdown
# coding-rules.md 项目规则（impl 域，每行一条，# 开头为注释）
零猜测：未明确的字段、参数与业务规则一律标 [待确认] 并询问用户，禁止猜测或推迟为 todo

<!-- 人工域:开始 -->
# 人工域：可自由增删规则行，自动更新逐字保留
本项目 DAO 层禁止直接拼接 SQL，统一走 Mapper
<!-- 人工域:结束 -->
```

区间内以 `#` 开头的行是注释（不注入生成产物），其余非空行与常量域规则同等生效。

### 3. `.venus` 搬运内容的升级步骤

`.venus/rules/tr_impl.md`、`tr_test.md` 会直达 `coding-rules.md` / `testing-rules.md`，
内容**逐字保留**（不改写、不注入标记）。因此首轮迁移后这些内容位于**常量域**：

1. **首轮** `iagent init` / `iagent update`：搬运产物登记为 `preserved`，本轮跳过常量对齐
   （文件字节与迁移前一致），CLI 输出提示行：
   `迁移规则已原样保留；如需长期保留请将其移入人工域标记区间，否则下次 init/update 的常量对齐会重写该文件`
2. 把这些规则行手工移入 `<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->` 之间（保留原有行序即可）
3. 此后的 init/update 只对齐常量域，人工域内容逐字保留

### 4. 「第二轮对齐」的语义

`preservePaths`（迁移报告的 `movedRules`）**只豁免一轮**，不构成永久保留：第二次执行
init/update 时若内容仍留在常量域，会被重写为最新常量（并因「未检出人工域标记」输出 WARN）。
该提示只出现在 `iagent init` / `iagent update` 的 **CLI 输出**，不进入旧装机迁移报告段落
（报告仍是「搬运项 / 删除项 / 跳过项 + 告警与提示」四段式）。

## `--no-migrate`

```bash
iagent init --no-migrate      # 跳过迁移：零搬运、零删除、不输出迁移报告
iagent update --no-migrate
```

用途是手工控制迁移时机（例如先自行备份、或想分批处理多个项目）。跳过时 `.venus/` 与旧产物
原样保留，不影响本次技能与指令的生成。

## 告警怎么读

| 输出 | 含义与处理 |
|---|---|
| `已删除 N 个旧技能与 M 条旧指令：其中可能包含你手工修改过的内容，已随删除丢失` | 提示删除的破坏性。若你确实手改过，见上文「升级前需要做什么」 |
| `旧配置未搬运：.iagent/config.yaml 已存在，已保留既有内容；.venus/ 亦保留不删，请手工比对合并` | 你已经按新口径自建过 `.iagent/config.yaml`，迁移**不会覆盖它**。请手工把 `.venus/config.yaml` 的 context 与 rules 合并进来 |
| `旧配置未迁移（.venus/ 原物已保留，可修复后重跑）：…` | 旧 `config.yaml` 读取失败（如格式异常、被占用）。原物未动、也未写入残缺新配置；修好后重跑即可 |
| `旧配置目录保留未删（未处理项：…）` | `.venus/` 里有迁移不处理的条目（例如 `rules/` 下的子目录、顶层非预期文件，或目标规则文件已存在）。确认后可自行删除 `.venus/` |
| `规则文件未搬运：… 已存在，旧文件保留在 .venus/rules/ 中` | `.iagent/rules/` 下已有同名规则文件，迁移不覆盖（避免丢用户内容）。请手工比对 |
| `旧名规则文件 .iagent/rules/impl.md 已整体删除：…删除存在丢失风险` | 8.0.0 起 `impl.md` / `test.md` 整体删除、不做兼容读取。升级前手写内容请先迁入 `coding-rules.md` / `testing-rules.md` 的人工域区间（见上文「规则文件：旧名删除与人工域」） |
| `规则文件 … 未检出人工域标记，已整块重写为常量内容` | 该规则文件没有 `<!-- 人工域:开始 -->` / `<!-- 人工域:结束 -->` 区间，常量对齐把区间外内容视为旧版常量。手写规则请放入人工域区间 |
| `补全标记块不成对：~/.bashrc 未被修改…` | rc/profile 里只有 `START` 没有 `END`（或反之）。迁移**不会**改动该文件，请手工检查并把旧标记块整段删掉 |
| `i 旧索引库已删除，可用 iagent spec reindex 重建` | 跨变更索引是可由 `openspec` 归档过程重建的本地缓存，需要时重跑 `iagent spec reindex` |

## 边界场景

| 场景 | 行为 |
|---|---|
| 全新项目 / 已升级过的项目 | 无旧物 → 静默跳过，输出中不出现迁移段落 |
| 重复执行 `init` / `update` | 幂等：无任何副作用，也不重复输出报告 |
| 只有部分旧物（如只剩旧技能） | 只处理存在的那部分，其余不报错 |
| 上次迁移中断（配置已搬、旧技能仍在） | 续做：只补齐清理，不重复搬运配置 |
| `.venus/` 不存在但存在旧产物 | 跳过配置搬运，只做产物清理 |
| 迁移过程发生异常 | 降级为告警，`init` / `update` 主流程照常完成 |

## 相关文档

- [快速上手](getting-started.md)
- [变更日志](../CHANGELOG.md) —— 2.0.0 的 BREAKING 小节列出全部破坏性改名
- [`iagent-legacy-migration` 变更提案](../openspec/changes/iagent-legacy-migration/proposal.md) —— 迁移能力的规格与设计依据
- [`iagent-rebrand` 变更提案](../openspec/changes/iagent-rebrand/proposal.md) —— 改名本身的范围界定

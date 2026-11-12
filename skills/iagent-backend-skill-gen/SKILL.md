---
name: iagent-backend-skill-gen
description: "生成后端设计技能。当用户要在目标项目单独生成后端设计/实现技能（项目技能）或由 project-init 委派执行后端侧技能蒸馏时使用；触发词\"后端技能蒸馏 / backend skill gen / 生成后端技能\"；NOT for 前端侧（改用 iagent-frontend-skill-gen）、整库初始化（改用 iagent-project-init）。"
allowed-tools: Read, Write, Glob, Grep, mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore
license: MIT
compatibility: 无特殊依赖，通用环境可用。CodeGraph 索引为可选增强，缺失时自动降级为 Glob / Grep / Read。
metadata:
  author: mi-agent-tools
  type: init
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:1d77516b2d360097468422e2d732a00a0adb8c2362246009f033835d581af493"
---

生成后端设计技能 —— 后端侧证据判定 → 扫描维度清单 → 生成项目技能 → C1-C6 自检 → 双态注册。

**调用形态双态**：本技能可被**独立调用**（用户直接发起），也可被 `iagent-project-init` **委派**（并发子代理）。两种形态共用同一蒸馏协议；差异仅在注册归属（见第 6 步）。

**输入**：`/iagent:backend-skill-gen`（独立调用，目标项目为当前项目根）；被委派时委派输入含 `integration-mode: project-init` 标记与 Stage Envelope 式最小输入（扫描基线路径 / 五类文档路径 / config 路径 / 输出路径），MUST NOT 依赖内联制品正文。

> 全程**非阻断**：任一步失败记 WARN 并继续，MUST NOT 使流程以失败收场。

## 执行步骤

### 1. 读取证据

- 优先读 `.iagent/scan-baseline.json` 的 `signals` / `candidates`（`skipped` / `failures` 计数 MUST 呈现，跳过所致 ≠ 项目无该内容）；缺失或无法解析时记 WARN 降级为机械探测（Glob / Grep / Read），MUST NOT 终止
- 复用五类 `docs/project/` 文档、`AGENTS.md` 与 `.iagent/config.yaml` 的 `context` 段；CodeGraph 索引可用时用 `codegraph_explore` 获取分层与调用链结构，不可用时改用 Glob / Grep / Read，MUST NOT 阻断

### 2. 证据判定

- **证据判定**：依据扫描基线 `signals` / `candidates`、五类 `docs/project/` 文档与源码实际使用证据判定本侧框架；依赖或 jar 的存在只作候选，MUST NOT 据此断言使用；证据不足按零猜测补扫，仍不足则该侧**不生成**（MUST NOT 造占位空壳）。

### 3. 后端扫描维度清单（生成范围约束）

逐维度扫描并判定，**清单是扫描维度而非内容模板**：生成内容 MUST 受 C1-C6 证据约束，无证据维度标「不适用 + 探测依据」，MUST NOT 编造：

技术框架（证据来源：构建文件 / 依赖清单 / 源码 import / `.iagent/config.yaml` context）
数据库设计（证据来源：DDL / 建表脚本 / ORM 映射 / `docs/project/database/` 文档；数据源配置只记录键名）
MVC 架构设计（证据来源：分层目录结构 / 控制器-服务-数据访问层调用链）
接口设计（证据来源：路由 / 控制器 / `docs/project/api/` 文档；请求与响应字段与实现一致，无法确证标「未知」）
前后端接口交互（证据来源：前端调用点与后端处理器对应关系 / 统一返回结构 / 错误码约定）
网络安全（证据来源：认证 / 鉴权 / 输入校验落点与 `docs/project/security/` 文档）

### 4. 生成项目技能

- **产物形态**：默认本侧一份 `.iagent/skills/<side>-design.md`（含设计要点与实现规范，frontmatter `phases: both`、`scope`、`source: distilled`）。满足任一条件时按阶段拆分：同侧 ≥2 框架 / 后端 ≥3 个分层或模块族 / 设计或实现任一段超约 150 行 → `<side>-design.md`（`phases: design`）+ `<side>-implement.md`（`phases: implement`）。多框架未拆分时在同侧文档内按框架分节，`frameworks` 逐项列出。拆分判据与结论写入报告。

本侧**无设计模板产出**（设计模板仅前端生成侧技能承担）。

### 5. 写入前完整性自检 C1-C6

- **写入前完整性自检 C1-C6**（全部通过才可写入）：
  - C1 frontmatter 必填：`name` / `description` / `phases` / `scope` / `frameworks` / `source`；`name` 必须等于文件名主干；`frameworks` 为检测到的框架逐项列出（能进入生成本侧即已有框架证据，MUST NOT 留空）；
  - C2 必需章节齐全：`## 框架与版本` / `## 目录与分层` / `## 设计规范` / `## 实现规范` / `## 约定与禁止项` / `## 证据索引` / `## 不适用项`；无内容须写「不适用 + 探测依据」，不得删章节或留空；拆分文件按 `phases` 计算（design 可把实现规范标不适用，implement 可把设计规范标不适用）；
  - C3 每条规则行必须带证据锚点（`文件:行` / 类.方法 / `docs/project/` 章节），无证据不写入；
  - C4 禁止占位符：`[待补充]` / `TODO` / `TBD` / `<...>`；
  - C5 与 `.iagent/rules/*.md` 冲突时以代码事实为准并记 WARN，冲突项在 `## 证据索引` 标注；
  - C6 单文件超约 300 行时拆分或下沉，禁止超长无结构文件；
  - 自检不通过先补齐；无法补齐时 MUST NOT 写入该侧，报告列出缺失章节 / 证据 / 不适用依据。

### 6. 注册双态

- **独立调用**：写入成功后把条目幂等追加到 `.iagent/config.yaml` 的 `skills:` backend 角色组（逐行段替换、保留注释与未知段，MUST NOT 重新序列化整个 YAML）；注册失败记 WARN，不回滚已生成文件
- **被 project-init 委派**（委派输入含 `integration-mode: project-init`）：MUST NOT 写 `.iagent/config.yaml` —— 注册由父级在两侧完成后单点串行承担，只产出技能文件并返回回执

### 7. 委派回执

- **委派回执**：完成或终止时输出四列最小回执：`<任务 id> | <状态> | <产出文件> | <公开签名>`；不粘贴文件正文，MUST NOT 把本地降级执行表述为已并发委派完成。

### 8. 已存在处理

- **已存在处理**：复用逐份确认（确认重新生成 / 修改 / 跳过）与人工域标记（`<!-- 人工域:开始 -->` 与 `<!-- 人工域:结束 -->` 区间**逐字保留**，破损取保留侧——未闭合由开始标记至文末整体保留，嵌套或乱序取最外层最大连续区间）；全部跳过时正常结束。

### 9. 安全边界

- **安全边界**：MUST NOT 写入凭据值（口令、密钥、令牌、连接串中的口令段，只写键名与位置），MUST NOT 写入可利用的绕过细节。

### 10. 单侧报告

- **报告**：逐侧给出生成文件、C1-C6 结论、不适用项依据、冲突项；未生成侧写明原因（证据不足）。

## 约束

- 只生成后端侧：MUST NOT 越界生成前端侧技能或注册到 frontend 组（前端侧由 iagent-frontend-skill-gen 承担）
- 不引入用户未要求的功能与依赖（最小可用原则）
- 清单 ≠ 内容模板：清单约束扫描范围，证据约束写入内容，二者正交

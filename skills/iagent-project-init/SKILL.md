---
name: iagent-project-init
description: "初始化项目。当用户要创建新项目、搭建目录结构、生成配置文件、初始化知识文档或准备开发环境时使用；触发词\"初始化项目 / project init / 搭建项目 / 生成配置\"；NOT for 扫描源项目功能模块（改用 iagent_feature_doc）。"
allowed-tools: Bash(ls:*), Bash(pwd:*), Read, Write, Glob, Grep, mcp__codegraph, mcp__codegraph__codegraph_status, mcp__codegraph__codegraph_files, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_explore, Skill(feature_doc)
license: MIT
compatibility: 无特殊依赖，通用环境可用。CodeGraph 索引与文档能力技能均为可选增强，缺失时自动降级。
metadata:
  author: mi-agent-tools
  type: init
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:15b1dc89fd2d648398bfabb94574705bac60d4bba463d3f2177ff7bb4952056b"
---

初始化项目 —— 读扫描基线 → 五类语义扫描 → 逐份确认 → 落盘 → 回写 context。

**核心原则**：初始化是"结构决定"，不是"随手生成"。所有目录与配置在创建前必须向用户说明用途并获得确认。

**输入**：`/iagent:project-init`（可跟项目类型或技术栈描述；省略时逐步询问）。

> 扫描全程**非阻断**：任一步骤失败 MUST 记 WARN 并继续，MUST NOT 中断流程，MUST NOT 使流程以失败收场。

## 执行步骤

### 1. 读取扫描基线

先读 `.iagent/scan-baseline.json` —— 由 `iagent init` 的确定性预扫描产出，内含机械探测得到的 `signals`（构建文件 / 骨架 / 配置键名 / 路由 / 文档）与 `candidates`。

- **存在且可解析**：直接复用其中的 `signals` 与 `candidates`，免去重复机械探测；仅对基线未覆盖的维度补扫
- **缺失或无法解析**：记 WARN（写明缺失原因），自行用 Glob / Grep / Read 机械探测，MUST NOT 因此终止
- 基线中的 `failures` MUST 在报告中呈现，MUST NOT 静默丢弃

### 2. 技术框架语义扫描

识别**语言 / 框架 / 版本 / 构建工具 / 包管理器**，逐维度给出结论与证据。

- **版本判定走四级回退链**（命中即止，逐级记录）：
  1. 构建文件声明（如 `pom.xml` / `build.gradle` / `package.json`）
  2. 工具链配置文件（如 toolchains 声明、`.nvmrc` 等运行时声明）
  3. 构建脚本编译参数（如 `build.xml` 中 `javac` 的 `source` / `target`）
  4. 既有项目文档文本
  5. 以上均无 → **标「未知」**；MUST NOT 编造版本
- **优先采信已结构化的技术栈声明**：`.iagent/config.yaml` 的 `context` 段、`openspec/config.yaml` 的声明，其可信度高于从依赖文件推测
- **框架判定 MUST 结合源码实际使用情况**（如 import 频次、注解出现次数）；MUST NOT 仅凭 jar / 依赖存在就断言「项目使用某框架」——依赖目录中的 jar 只作为候选列出

### 3. 委派 `iagent_feature_doc`（模块与功能点 / 数据库 / API 规范）

五类中「模块与功能点 / 数据库 / API 规范」的信息基础，MUST 优先经 `Skill` 工具委派 `iagent_feature_doc` 获取，复用其框架档案能力。

- **降级路径一（委派不可得）**：该技能不可调用或执行失败 → 记 WARN，改为自行扫描（Glob / Grep / Read），MUST NOT 因此终止
- **降级路径二（无 CodeGraph 索引）**：目标项目未初始化 CodeGraph 索引时，改用 Glob / Grep / Read 完成扫描
- 有索引时先用 `codegraph_status` 确认索引可用性，再用 `codegraph_files` / `codegraph_search` / `codegraph_context` 获取模块与符号结构
- 该技能是信息基础的可选来源，MUST NOT 写成必须依赖；无索引亦 MUST NOT 阻断流程

### 4. 安全规范扫描

扫描并归纳：

- **认证机制** —— 会话 / 令牌 / 单点登录等登录态方案
- **鉴权机制** —— 角色、权限判定的落点
- **输入校验策略** —— 校验位置（前端 / 控制器 / 服务）、校验方式与范围
- **配置约定** —— 配置项类别与**键名**

两条显式禁令：

- MUST NOT 在文档中写入任何**凭据值**（口令、密钥、令牌、连接串中的口令段），只写键名与存放位置
- MUST NOT 写入任何**可利用的绕过细节**（绕过校验的具体构造、可复现的越权路径）——本文件定位为机制与约定说明，不是攻击面图

### 5. 已存在文档逐份确认

写入任何项目知识文档或 `AGENTS.md` **之前**，先检测目标是否存在：

- 目标**不存在** → 直接生成
- 目标**已存在** → **逐份**呈现（一次一份，MUST NOT 合并为一次性总确认），并取得选择：「确认重新生成」/「修改」/「跳过」
- 选「跳过」→ 该文档**逐字保持**，MUST NOT 改动其中任何字符
- **全部跳过** → 流程**正常结束**（仍完成扫描基线与 `context` 回写），MUST NOT 视为失败

### 6. 增量对齐与人工域标记

用户选「确认重新生成」时执行**增量对齐**，MUST NOT 整体重写：

- `<!-- 人工域:开始 -->` 与 `<!-- 人工域:结束 -->` 区间内的内容 **逐字保留**
- 区间**外**的内容按本次扫描结果重新派生
- 文档不含任何标记 → 退化为整体重派生，MUST NOT 报错

**破损情形一律取保留侧**：

| 破损类型 | 处理 |
|---|---|
| 未闭合（有开始标记、无结束标记） | 由开始标记**至文末整体保留**并记 WARN；MUST NOT 猜测闭合位置 |
| 嵌套或乱序 | 保留**最外层最大连续区间**并记 WARN |

### 7. 五类文档与索引落盘

按下列路径落盘（某类**无对应内容时不生成该类文档**，MUST NOT 生成仅含「无内容」占位的空壳文档）：

| 类型 | 路径 |
|---|---|
| 技术框架 | `docs/project/architecture/技术框架.md` |
| 模块与功能点 | `docs/project/modules/模块与功能点.md` |
| 数据库 | `docs/project/database/数据库.md` |
| API 规范 | `docs/project/api/API规范.md` |
| 安全规范 | `docs/project/security/安全规范.md` |
| 索引 | `docs/project/README.md` |

索引 `docs/project/README.md` MUST 列出**全部五类**：未生成的类标**「不适用」并附探测依据**（如「未发现 DDL 与 ORM 映射」），使「项目中确实没有」与「扫描未曾评估」可区分；MUST NOT 静默省略。

### 8. `AGENTS.md` 生成 / 对齐

依扫描结果生成项目根 `AGENTS.md`（面向 AI 编码代理的仓库导航）：

- **项目是什么** —— 一句话定位 + 技术栈
- **仓库地图** —— 主要目录与职责
- **常用命令** —— 构建 / 测试 / 运行
- **修改守则** —— 本项目特有的约定与禁区

已存在 `AGENTS.md` 时，MUST 走第 5 步 / 第 6 步**同一分支**（逐份确认 + 增量对齐），MUST NOT 为其另立覆盖策略。

### 9. `context` 回写

把扫描得到的技术栈与项目约定写入 `.iagent/config.yaml` 的 `context` 段（该段原为「待补充」占位）。

- 写入 MUST 沿用**逐行保留 + 段替换**：只替换 `context` 段，其余行原样保留
- MUST NOT 重新序列化整个 YAML —— 注释与未知段（如 `auto_package`）MUST 保留
- 写入**失败记 WARN 并继续**，MUST NOT 中断流程

## 参考文件（references/）

五类文档的骨架模板（章节结构、表格形态、证据要求）拆分为下列子文件，写该类文档前按需 Read：

| 子文件 | 对应文档 |
|---|---|
| `references/doc-architecture.md` | 技术框架 |
| `references/doc-modules.md` | 模块与功能点 |
| `references/doc-database.md` | 数据库 |
| `references/doc-api.md` | API 规范 |
| `references/doc-security.md` | 安全规范 |

> 子文件路径相对技能目录（如 `.claude/skills/iagent-project-init/references/doc-api.md`）。

## 约束

- 不引入用户未要求的功能与依赖（最小可用原则）
- 目录结构遵循用户技术栈的社区惯例（如 Maven 的 src/main/java 分层）
- 每一步可验证：创建完成后用户应能直接构建或运行
- 生成的文档只记录配置**键名**，MUST NOT 记录任何取值

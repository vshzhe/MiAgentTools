---
name: "Venus: 提案复查"
description: 变更提案完整性复查：代码库深探 + 8 维度完整性检查 + 合规性验证 + 量化评分
allowed-tools: Bash(venus:*)
category: Venus / 实现
tags: [venus, spec, review, proposal, completeness, compliance]
---

**Before proceeding, read openspec/rules/ai-coding.md for AI coding guardrails.** Mark undefined items as **[待确认]** and ask the user rather than guessing.

变更提案完整性复查：深度代码库探索 + 8 维度完整性检查 + 合规性验证 + 量化评分 + 遗漏场景补充。在 /venus:spec-propose 创建提案后或 /venus:spec-explore 探索后调用，确保提案完整后再进入实现。

---

## Phase 1: 加载变更提案
`venus spec status --change "<change-name>" --json` -> 读取 proposal.md、design.md、specs/*.md、tasks.md。

## Phase 2: 深度代码库探索（关键）
用 Grep/Glob/Read 工具追溯调用链（入口层 -> 业务层 -> 数据访问层 -> 跨模块）、数据流（输入 -> 处理 -> 输出 -> 异常）、现有实现模式对比。必须实际阅读代码，不依赖提案描述。

## Phase 3: 多维度完整性检查（8 维度）
参数配置(6 场景)、输入输出(7 场景)、数据库操作(6 项)、前端交互(6 项)、错误处理(5 项)、日志记录(5 项)、安全性(6 项)、兼容性(4 项)——逐一对照场景-检查点-常见遗漏三列表。检查点语言无关，具体异常类名/日志框架/浏览器兼容等 Java 专项见下文。

## Java / Venus4A 项目专项检查
触发条件：检测到 Java 项目特征（pom.xml、src/cn/ 包结构、JSP 文件）。涵盖：包名规范(`cn.com.venustech.venus4a.{module}.{layer}`)、JDK 7 特性约束、Log4j 1.2.x Logger 声明、DataStore/DataObject 小写列名与 rowCount()、html:page 分页标签 pageForm 参数、Oracle 11g SQL 方言、IE 兼容(禁 ES6+/箭头函数)、异常体系(ValidateException/SystemException/DataNotFoundException)。含 JSP 页面结构、分页标签、数据绑定、表单提交、权限检查、状态流转、编辑场景、批量处理、LIKE 转义等代码模板。

## Phase 4: 实现合规性验证
4.1 技术栈合规（对照 openspec/config.yaml）、4.2 架构分层合规（入口层/业务层/数据访问层）、4.3 命名规范合规、4.4 数据库操作合规（对照 CLAUDE.md DAO 层规范）。

## Phase 5: 特殊功能场景检查
导出功能(6 项)、导入功能(6 项)、外部系统回调(4 项)、并发安全(4 项)、搜索条件处理(4 项)——含 LIKE 特殊字符转义、SQL 注入防护。

## Phase 6: 页面设计细节检查
页面结构、表单元素、数据绑定、分页标签、JS 逻辑、CSS 样式、前端组件——通用检查点，JSP 专项细节见 Java 专项小节 F。

## Phase 7: 逻辑实现细节检查
业务逻辑完整性(CRUD/状态流转/关联数据)、数据一致性、编辑场景(旧数据清理)、缓存处理、定时任务、批量操作、权限控制细节。

## Phase 8: 量化评分
11 维度覆盖率 + 合规率评分 + 总体评分（>=90% 可进入实现，70%-90% 补充 P0，<70% 重新完善）。

## Phase 9: 发现遗漏时更新文档
P0 必须补充（specs/design/tasks 添加 Requirement + `#### Scenario:` + WHEN/THEN/AND）、P1 建议补充、P2 可选补充。

## 输出格式
10 节检查报告：深度探索发现、多维度完整性检查、实现合规性验证、量化评分、页面设计检查、逻辑实现细节、建议补充 Scenario、页面设计遗漏 Scenario、逻辑实现遗漏 Scenario、修正建议汇总。

## 常见高频遗漏速查表
编辑场景未删除旧数据（高频）、分页标签结构不完整（高频）、隐藏字段缺失（高频）、数据访问组件列名大小写（中频）、权限检查缺少请求参数（中频）、refreshList 缺少 submit（中频）、EL 表达式用于 hidden（低频）、批量操作未分批（中频）。

Guardrails: 必须实际阅读代码；搜索项目现有模式；对照 config.yaml 验证技术栈；对照 CLAUDE.md 验证架构命名；发现 P0 遗漏立即更新文档；提供可直接使用的 Scenario 内容。

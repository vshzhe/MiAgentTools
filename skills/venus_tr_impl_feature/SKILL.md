---
name: venus_tr_impl_feature
description: 实现功能。当用户要开发新功能、修改业务逻辑或对接接口，需要按分层架构编写代码时使用。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(npm:*), Bash(node:*)
license: MIT
compatibility: 无特殊依赖，通用环境可用。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_impl
  generatedBy: "snapshot"
---

实现功能 —— 严格遵循四阶段流程与分层架构规范。

**规划边界**：本技能负责编写实现代码。开始编码前必须先与用户就技术方案达成一致；用户只描述需求时，先输出方案概要确认，再动手。

## 执行步骤

1. **理解需求与探查代码**

   - 重述需求要点，标注不明确之处（打上 `[待确认]` 标记向用户求证）
   - 检索项目中已有的相似实现、统一异常处理、工具类与编码风格
   - 对任何跨文件修改或新功能，先输出简要技术方案（涉及文件、分层、接口契约）并获用户确认

2. **按分层架构实现**

   严格遵循 Controller → Service → DAO（Mapper）分层：
   - **Controller**：接收请求、参数校验（JSR-380 注解）、统一封装返回（Result<T>），不写业务逻辑
   - **Service**：核心业务逻辑、事务控制（@Transactional 放本层）、复杂业务拆子方法
   - **DAO/Mapper**：仅数据访问，禁止业务逻辑；优先使用条件构造器，禁止 ${} 拼接 SQL
   - **对象分离**：ReqDTO（入参 + 校验注解）/ VO（响应，隐去敏感字段）/ Entity（库表映射）严格分离，禁止混用

3. **编码规范自检**

   每完成一个代码块立即自检：
   - 命名符合驼峰规范（类大驼峰、方法/变量小驼峰、常量全大写下划线）
   - 禁止空 catch 块、禁止 e.printStackTrace()，异常必须记日志并处理
   - 禁止魔法数字与硬编码，用常量替代
   - 禁止在循环中创建对象或发起数据库/Redis 请求
   - 优先使用 LocalDateTime/LocalDate，禁止过期 API

4. **实现后总结**

   - 列出新增/修改的文件及各自职责
   - 说明如何验证（编译、运行、调用的入口）
   - 主动提示配套测试（可衔接 `venus_test_generate`）

## 约束

- 最小修改原则：只改与需求直接相关的代码，不顺手重构无关内容
- 与现有代码库逻辑/技术栈冲突时立即暂停，向用户确认后再继续
- 所有用户输入入库前必须做非空、格式、范围校验

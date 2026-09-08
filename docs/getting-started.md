# 快速上手

> 前置条件：Node.js ≥ 20.19，pnpm ≥ 10。安装方式见 [README · 安装](../README.md#安装)。

## 5 分钟走通全流程

**命令在哪输入？** 两个地方，别混淆：

- `venus ...`（如 `venus init`）在**终端**输入
- `/venus:...`（如 `/venus:tools-pwd`）在 **Claude Code 对话框**输入

```text
终端      $ cd your-project
终端      $ venus init                    （生成技能 + 指令 + .venus 配置）
Claude      /venus:tools-pwd              （试试最简单的：查当前路径）
终端      $ venus list                    （随时查看装了什么）
终端      $ venus generate --type tr_impl --name my-first-rule
Claude      /venus:impl-feature 实现xxx   （正式开始用）
```

## init 之后项目多了什么

```text
your-project/
├── .claude/
│   ├── skills/
│   │   └── venus_tr_*/SKILL.md       # 8 个技能（Claude 自动触发）
│   └── commands/venus/
│       └── tr-*.md                   # 8 个斜杠指令（/venus:xxx 手动触发）
└── .venus/
    ├── config.yaml                   # 项目背景 + 规则引用（可编辑）
    └── rules/
        ├── tr_impl.md                # 实现类规则（每行一条）
        └── tr_test.md                # 测试类规则
```

`.venus/` 建议提交到 git —— 团队成员 init 后即共享同一套项目约束。

## 定制项目约束

编辑 `.venus/config.yaml`：

```yaml
context: |                  # 项目背景 → generate 的骨架正文头部
  技术栈：JDK 17 + Spring Boot 3 + MySQL 8
  分层约定：Controller → Service → DAO

rules:                      # 引用 rules/ 下的文件
  - tr_impl                 # 删除行 = 停用；顺序即注入顺序
  - tr_test
```

编辑规则文件（如 `.venus/rules/tr_impl.md`）：

```markdown
# 每行一条规则，# 开头为注释
遵循项目分层架构，禁止跨层调用
实现类需补充 JavaDoc/方法注释
```

之后 `venus generate` 生成的骨架自动带上这些约束 —— 填正文时项目约定就在眼前。

## 生成自己的技能

```bash
# 按类型生成骨架（类型必填，见下方分类表）
venus generate --type tr_tools --name env-check --desc "检查 Node/JDK 版本"
```

生成物：

- `skills/venus_tr_tools_env_check/SKILL.md` —— 源文件（提交 git，在此填充正文）
- `.claude/skills/venus_tr_tools_env_check/SKILL.md` —— 安装位置（Claude 即刻可用）

骨架正文是引导结构（功能说明/执行步骤/约束），填完即成正式技能。

## 7 类分类速查

| 类型 | 场景 | 代表指令 |
| :--- | :--- | :--- |
| `tr_init` | 建项目、搭结构 | `/venus:init-project` |
| `tr_impl` | 写功能、改逻辑 | `/venus:impl-feature` |
| `tr_test` | 补测试、跑测试 | `/venus:test-generate` |
| `tr_commit` | 提交代码 | `/venus:commit-change` |
| `tr_review` | 审查变更 | `/venus:review-code` |
| `tr_release` | 发版本 | `/venus:release-version` |
| `tr_tools` | 杂项工具 | `/venus:tools-pwd` |

## 日常维护

```bash
venus list                # 装了什么
venus show venus_tr_tools_pwd   # 某个技能的详情（支持前缀/片段匹配）
venus validate            # 规范校验（CI 可用，CRITICAL 时退出码 1）
venus update              # 升级到最新模板（你手改过的技能会被保护跳过）
venus uninstall --yes     # 移除（.venus 配置默认保留）
```

## 下一步

- 全部命令参数：[README · CLI 命令](../README.md#cli-命令)
- 技能怎么被 Claude 触发：[README · 关联指令](../README.md#如何在-claude-code-中使用关联指令)
- 想给本项目贡献代码：[AGENTS.md](../AGENTS.md)

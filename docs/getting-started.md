# 快速上手

> 前置条件：Node.js ≥ 20.19，pnpm ≥ 10。安装方式见 [README · 安装](../README.md#安装)。

## 5 分钟走通全流程

**命令在哪输入？** 两个地方，别混淆：

- `iagent ...`（如 `iagent init`）在**终端**输入
- `/iagent:...`（如 `/iagent:workflow`）在 **Claude Code 对话框**输入

```text
终端      $ cd your-project
终端      $ iagent init                    （生成技能 + 指令 + .iagent 配置）
Claude      /iagent:workflow 实现xxx        （一站式引导：探索→提案→验证→实现→归档）
终端      $ iagent list                    （随时查看装了什么）
终端      $ iagent generate --type impl --name my-first-rule
```

## init 之后项目多了什么

```text
your-project/
├── .claude/
│   ├── skills/
│   │   └── iagent_<功能名>/SKILL.md    # 20 个技能（Claude 自动触发）
│   └── commands/iagent/
│       └── <指令 id>.md               # 20 个斜杠指令（/iagent:xxx 手动触发）
├── .pi/                               # Pi 工具（skills + prompts/iagent-<id>.md）
├── .codex/skills/                     # Codex 工具（仅技能）
└── .iagent/
    ├── config.yaml                    # 项目背景 + 规则引用 + workflow 选择
    └── rules/
        ├── impl.md                    # 实现类规则（每行一条）
        └── test.md                    # 测试类规则
```

`.iagent/` 建议提交到 git —— 团队成员 init 后即共享同一套项目约束。

## 定制项目约束

编辑 `.iagent/config.yaml`：

```yaml
context: |                  # 项目背景 → generate 的骨架正文头部
  技术栈：JDK 17 + Spring Boot 3 + MySQL 8
  分层约定：Controller → Service → DAO

rules:                      # 引用 rules/ 下的文件
  - impl                 # 删除行 = 停用；顺序即注入顺序
  - test

workflows:                  # 选择要安装的技能（留空/删除 = 默认集）
  - project-init
  - workflow
  - spec-explore
  - spec-propose
  - spec-apply
  - spec-archive

tools:                      # 目标 AI 工具（留空 = 全部）
  - claude
  - pi
```

编辑规则文件（如 `.iagent/rules/impl.md`）：

```markdown
# 每行一条规则，# 开头为注释
遵循项目分层架构，禁止跨层调用
实现类需补充 JavaDoc/方法注释
```

之后 `iagent generate` 生成的骨架自动带上这些约束 —— 填正文时项目约定就在眼前。

## 生成自己的技能

```bash
# 按类型生成骨架（类型见分类表；type 只写入 frontmatter metadata.type，不进技能名）
iagent generate --type tools --name env-check --desc "检查 Node/JDK 版本"
```

生成物：

- `skills/iagent-env-check/SKILL.md` —— 源文件（提交 git，在此填充正文）
- `.claude/skills/iagent-env-check/SKILL.md` —— 安装位置（Claude 即刻可用）

骨架正文是引导结构（功能说明/执行步骤/约束），填完即成正式技能。

## 分类速查

| 类型 | 场景 | 代表技能 / 指令 |
| :--- | :--- | :--- |
| `init` | 建项目、搭结构 | `iagent_project_init` / `/iagent:project-init` |
| `impl` | 一站式工作流与迁移 | `iagent_workflow` / `/iagent:workflow`、`iagent_migration` / `/iagent:migration` |
| `test` | 补测试、跑测试 | `iagent_test` / `/iagent:test`（多 schema：Java/Node） |
| `commit` | 提交代码 | `iagent_commit` / `/iagent:commit`、`iagent_svn_commit` / `/iagent:svn-commit` |
| `review` | 审查变更 | `iagent_review` / `/iagent:review` |
| `docs` | 扫描 / 需求文档 | `iagent_feature_doc`、`iagent_requirement_doc` |
| `spec` | 规格驱动闭环 | `iagent_spec_explore` / `/iagent:spec-explore` 等 7 个 |
| `release` / `tools` | 扩展位 | 当前无内置技能，供 `iagent generate --type` 扩展 |

## 日常维护

```bash
iagent list                # 装了什么（多工具间去重）
iagent show iagent_spec_apply   # 某个技能的详情（支持前缀/片段匹配）
iagent validate            # 规范校验（CI 可用，CRITICAL 时退出码 1）
iagent update              # 升级到最新模板（你手改过的技能会被保护跳过）
iagent uninstall --yes     # 移除（.iagent 配置默认保留）
iagent --version           # 工具版本
```

## 下一步

- 全部命令参数：[README · CLI 命令](../README.md#cli-命令)
- 技能导读：[技能使用说明书](skills-manual.md)
- 想给本项目贡献代码：[AGENTS.md](../AGENTS.md)

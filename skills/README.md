# MiAgentTools 技能快照

本目录是内置技能模板的静态快照（`skills/<name>/SKILL.md`），
与 `iagent init` 写入项目的技能内容一致。

## 使用

在目标项目中安装全部技能：

```bash
iagent init
```

或直接复制需要的 `iagent_*/SKILL.md` 到目标项目
`.claude/skills/<name>/SKILL.md`。

## 维护

> 这些文件由模板生成 —— 禁止手工编辑。
> 修改模板后运行 `pnpm build && pnpm generate:skills`，
> `test/skills-parity.test.ts` 会在快照与模板漂移时报错。

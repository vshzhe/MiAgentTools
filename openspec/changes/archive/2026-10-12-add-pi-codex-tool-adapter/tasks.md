# Tasks: add-pi-codex-tool-adapter

## 1. 工具配置扩展

- [ ] [代码] 1.1 AI_TOOLS 配置表新增 Pi 和 Codex 工具条目。
  - Pi：value='pi', name='Pi', skillsDir='.pi', commandsDir='.pi/commands'
  - Codex：value='codex', name='Codex', skillsDir='.codex', commandsDir=''（空，skills-invocable 模式）
  - 验证：`node -e "require('./dist/core/config.js').AI_TOOLS.length === 3"`
  - 对应: multi-tool-adapter / AI_TOOLS 多工具配置
  - 产出文件: `src/core/config.ts`

## 2. Pi 适配器实现

- [ ] [代码] 2.1 新建 Pi 指令适配器 src/core/command-generation/adapters/pi.ts。
  - 实现 ToolCommandAdapter 接口：toolId='pi'，getFilePath 返回 .pi/commands/venus/<id>.md，formatFile 复用与 claudeAdapter 相同的 YAML frontmatter + Markdown 格式
  - 参考 claudeAdapter 实现，仅 toolId 和目录路径不同
  - 验证：TypeScript 编译通过，类型检查无错误
  - 依赖: 1.1
  - 对应: multi-tool-adapter / Pi 指令适配器
  - 产出文件: `src/core/command-generation/adapters/pi.ts`

- [ ] [代码] 2.2 CommandAdapterRegistry 静态块注册 piAdapter。
  - import piAdapter
  - 在 static 块中添加 CommandAdapterRegistry.register(piAdapter)
  - 验证：`node -e "const r = require('./dist/core/command-generation/index.js').CommandAdapterRegistry; console.log(r.has('pi'))"` 输出 true
  - 依赖: 2.1
  - 对应: multi-tool-adapter / 适配器注册表扩展
  - 产出文件: `src/core/command-generation/adapters/registry.ts`

- [ ] [代码] 2.3 统一导出 piAdapter。
  - 在 src/core/command-generation/index.ts 中添加 `export { piAdapter } from './adapters/pi.js'`
  - 验证：TypeScript 编译通过
  - 依赖: 2.1
  - 产出文件: `src/core/command-generation/index.ts`

## 3. update.ts 解耦重构

- [ ] [代码] 3.1 解耦 update.ts 的技能生成与指令生成循环。
  - 将当前 `if (!adapter) continue` 改为仅跳过指令生成，技能生成不受适配器门控
  - 技能生成：独立循环遍历 AI_TOOLS，每个工具无论有无适配器均生成 SKILL.md
  - 指令生成：仅当 CommandAdapterRegistry.get(tool.value) 存在时生成
  - 权限合并：每个工具均独立执行（不受适配器影响）
  - 验证：`pnpm build && node bin/venus.js update` 在 dogfood 项目中正常运行，codex 工具不报错
  - 依赖: 1.1, 2.1
  - 对应: skills-only-tool / 无适配器工具的技能生成；command-generation / update 技能与指令生成解耦
  - 产出文件: `src/commands/update.ts`

## 4. 测试验证

- [ ] [测试][单元][P1] 4.1 验证 AI_TOOLS 配置表包含三个工具条目（claude、pi、codex）。 [N2]
  - 检查 AI_TOOLS 长度为 3
  - 检查每个条目的 value/name/skillsDir/commandsDir 字段完整性
  - 验证：`pnpm test` 通过
  - 依赖: 1.1
  - 对应: multi-tool-adapter / AI_TOOLS 多工具配置
  - 产出文件: `test/config.test.ts 或现有测试文件中追加`

- [ ] [测试][单元][P1] 4.2 验证 piAdapter 的 getFilePath 和 formatFile 行为正确。 [N7]
  - getFilePath 返回 .pi/commands/venus/<id>.md 格式
  - formatFile 产出的 YAML frontmatter 与 claudeAdapter 字段名一致
  - 验证：`pnpm test` 通过
  - 依赖: 2.1, 2.2
  - 对应: multi-tool-adapter / Pi 指令适配器
  - 产出文件: `test/adapter.test.ts 或现有测试文件中追加`

> 进度: 0/7 (0%)

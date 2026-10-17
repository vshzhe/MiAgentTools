/**
 * 全局配置与类型常量。
 *
 * 定义 MiAgentTools 的技能类型体系（init / impl / test / commit / review /
 * release / tools / docs / spec）与目标 AI 工具配置。
 */

/** SKILL 名称强制前缀（Agent Skills 规范要求目录名 = name 字段） */
export const SKILL_PREFIX = 'iagent_';

/** 斜杠指令命名空间（生成到 .claude/commands/iagent/ 下） */
export const COMMAND_NAMESPACE = 'iagent';

/** 技能类型 */
export type SkillType =
    | 'init'
    | 'impl'
    | 'test'
    | 'commit'
    | 'review'
    | 'release'
    | 'tools'
    | 'docs'
    | 'spec';

/** 类型元数据：id + 中文名 + 说明（用于 list 展示与文档生成） */
export interface SkillTypeMeta {
    id: SkillType;
    name: string;
    description: string;
    /** 预留类型：已注册但当前无内置技能，供 `iagent generate --type` 扩展 */
    reserved?: boolean;
}

/** 全部技能类型的注册表（顺序即文档展示顺序） */
export const SKILL_TYPES: SkillTypeMeta[] = [
    { id: 'init', name: '初始化', description: '项目与工作环境的初始化：目录结构、配置、脚手架' },
    { id: 'impl', name: '实现', description: '实现域编排：工作流编排、调试、迁移等实现相关技能' },
    { id: 'test', name: '测试', description: '测试相关：编写用例、运行测试、覆盖率检查（多 schema：Java/Node 自动适配）' },
    { id: 'commit', name: '提交', description: '代码提交：变更检查、提交信息规范、暂存管理' },
    { id: 'review', name: '审查 / 检查', description: '审查与检查：代码审查、提案完整性审查、迁移一致性检查' },
    { id: 'release', name: '版本', description: '版本发布：版本号管理、变更日志、发布流程（预留类型）', reserved: true },
    { id: 'tools', name: '工具', description: '通用工具：路径查询、环境探测等辅助操作（预留类型）', reserved: true },
    {
        id: 'docs',
        name: '文档',
        description: '文档生成：源项目功能扫描、需求实现文档、项目功能地图',
    },
    {
        id: 'spec',
        name: '规格',
        description: '规格驱动工作流：探索、提案、实现、归档、验证（依赖 iagent spec 命令组）',
    },
];

/** 全部合法类型 id（用于参数校验） */
export const SKILL_TYPE_IDS = SKILL_TYPES.map((t) => t.id);

/** 校验字符串是否为合法技能类型 */
export function isSkillType(value: string): value is SkillType {
    return (SKILL_TYPE_IDS as string[]).includes(value);
}

/** 指令产物布局 */
export type CommandLayout = 'namespace-dir' | 'prefixed-file';

/** 目标 AI 工具配置（支持 Claude Code / Pi / Codex / OpenCode，架构预留多工具扩展） */
export interface AIToolOption {
    /** 工具标识 */
    value: string;
    /** 展示名 */
    name: string;
    /** 技能生成根目录（项目相对路径），生成时自动追加 /skills */
    skillsDir: string;
    /**
     * 指令生成根目录（项目相对路径）。
     * 空字符串表示该工具无指令产物（skills-only 模式，如 Codex）。
     */
    commandsDir: string;
    /**
     * 指令产物布局（commandsDir 为空时省略）：
     *  - `namespace-dir`：`<commandsDir>/<namespace>/<id>.md`（Claude Code）
     *  - `prefixed-file`：`<commandsDir>/<namespace>-<id>.md`（Pi / OpenCode 扁平布局）
     */
    commandsLayout?: CommandLayout;
    /**
     * 可选（opt-in）工具：未配置 `tools` 时的默认回退集不包含它，
     * 仅在 `--tools` 显式指定或 `.iagent/config.yaml` 的 `tools` 显式列出时纳入生效集。
     */
    optIn?: boolean;
    /**
     * 是否写会话级权限载体（`<skillsDir>/settings.json` 的 Claude 风格 `permissions.allow`）。
     * 默认 `true`。OpenCode 为 `false`——其权限走 `opencode.json` 的 `permission` 段
     * （语法不同）且默认宽松，写 `.opencode/settings.json` 是不被读取的惰性文件。
     */
    sessionPermissions?: boolean;
}

export const AI_TOOLS: AIToolOption[] = [
    {
        value: 'claude',
        name: 'Claude Code',
        skillsDir: '.claude',
        commandsDir: '.claude/commands',
        commandsLayout: 'namespace-dir',
    },
    {
        value: 'pi',
        name: 'Pi',
        skillsDir: '.pi',
        // Pi 从 .pi/prompts/ 加载 prompt 模板（扁平、前缀命名），不是 .pi/commands/ 子目录
        commandsDir: '.pi/prompts',
        commandsLayout: 'prefixed-file',
    },
    {
        value: 'codex',
        name: 'Codex',
        skillsDir: '.codex',
        commandsDir: '',
    },
    {
        value: 'opencode',
        name: 'OpenCode',
        skillsDir: '.opencode',
        // OpenCode 递归扫描 .opencode/commands/**/*.md，指令名 = 相对路径去 .md；
        // 扁平前缀布局得 `/iagent-<id>`（与 Pi 约定一致），避免命名空间嵌套名
        commandsDir: '.opencode/commands',
        commandsLayout: 'prefixed-file',
        // 可选（opt-in）工具：未配置不生成，显式列入 tools 才纳入生效集
        optIn: true,
        // OpenCode 权限走 opencode.json 的 permission 段，不写 .opencode/settings.json
        sessionPermissions: false,
    },
];

/** 工具目录中的技能安装子目录（Agent Skills 规范） */
export const TOOL_SKILLS_SUBDIR = 'skills';

/** 指令安装子目录（按命名空间分组） */
export const TOOL_COMMANDS_SUBDIR = 'iagent';

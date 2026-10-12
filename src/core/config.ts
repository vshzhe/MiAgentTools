/**
 * 全局配置与类型常量。
 *
 * 定义 VenusAgentTools 的技能生命周期类型体系（tr_*）与目标 AI 工具配置。
 */

/** SKILL 名称强制前缀（Agent Skills 规范要求目录名 = name 字段） */
export const SKILL_PREFIX = 'venus_';

/** 斜杠指令命名空间（生成到 .claude/commands/venus/ 下） */
export const COMMAND_NAMESPACE = 'venus';

/** 技能生命周期类型 */
export type SkillType =
    | 'tr_init'
    | 'tr_impl'
    | 'tr_test'
    | 'tr_commit'
    | 'tr_review'
    | 'tr_release'
    | 'tr_tools'
    | 'tr_docs'
    | 'spec';

/** 类型元数据：id + 中文名 + 说明（用于 list 展示与文档生成） */
export interface SkillTypeMeta {
    id: SkillType;
    name: string;
    description: string;
}

/** 全部技能类型的注册表（顺序即文档展示顺序） */
export const SKILL_TYPES: SkillTypeMeta[] = [
    { id: 'tr_init', name: '初始化', description: '项目与工作环境的初始化：目录结构、配置、脚手架' },
    { id: 'tr_impl', name: '实现', description: '功能开发与实现：编写代码、修改逻辑、接口对接' },
    { id: 'tr_test', name: '测试', description: '测试相关：编写用例、运行测试、覆盖率检查（多 schema：Java/Node 自动适配）' },
    { id: 'tr_commit', name: '提交', description: '代码提交：变更检查、提交信息规范、暂存管理' },
    { id: 'tr_review', name: '审查', description: '代码审查：质量检查、规范核对、问题发现' },
    { id: 'tr_release', name: '版本', description: '版本发布：版本号管理、变更日志、发布流程' },
    { id: 'tr_tools', name: '工具', description: '通用工具：路径查询、环境探测等辅助操作' },
    {
        id: 'tr_docs',
        name: '文档',
        description: '文档生成：源项目功能扫描、需求实现文档、项目功能地图',
    },
    {
        id: 'spec',
        name: '规格',
        description: '规格驱动工作流：探索、提案、实现、归档、验证（依赖 venus spec 命令组）',
    },
];

/** 全部合法类型 id（用于参数校验） */
export const SKILL_TYPE_IDS = SKILL_TYPES.map((t) => t.id);

/** 校验字符串是否为合法技能类型 */
export function isSkillType(value: string): value is SkillType {
    return (SKILL_TYPE_IDS as string[]).includes(value);
}

/** 目标 AI 工具配置（MVP 仅支持 Claude Code，架构预留多工具扩展） */
export interface AIToolOption {
    /** 工具标识 */
    value: string;
    /** 展示名 */
    name: string;
    /** 技能生成根目录（项目相对路径），生成时自动追加 /skills */
    skillsDir: string;
    /** 指令生成根目录（项目相对路径） */
    commandsDir: string;
}

export const AI_TOOLS: AIToolOption[] = [
    {
        value: 'claude',
        name: 'Claude Code',
        skillsDir: '.claude',
        commandsDir: '.claude/commands',
    },
    {
        value: 'pi',
        name: 'Pi',
        skillsDir: '.pi',
        commandsDir: '.pi/commands',
    },
    {
        value: 'codex',
        name: 'Codex',
        skillsDir: '.codex',
        commandsDir: '',
    },
];

/** 工具目录中的技能安装子目录（Agent Skills 规范） */
export const TOOL_SKILLS_SUBDIR = 'skills';

/** 指令安装子目录（按命名空间分组） */
export const TOOL_COMMANDS_SUBDIR = 'venus';

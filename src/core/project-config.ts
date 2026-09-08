/**
 * 项目级配置（.venus/ 目录）。
 *
 * 结构（参照 openspec/config.yaml 的 context + rules 模式）：
 *   .venus/
 *   ├── config.yaml    # context（项目背景）+ rules（显式引用 rules/ 下文件）
 *   └── rules/
 *       ├── tr_impl.md  # 每文件一个类型的规则（每行一条，支持 # 注释）
 *       └── tr_test.md
 *
 * config.yaml 通过 rules 列表显式 include 规则文件：
 *   - 顺序即注入顺序
 *   - 未列出的规则文件不生效（用户可通过删除引用停用）
 *
 * 采用极简 YAML 解析（键: 值 + 缩进列表），不引入 YAML 依赖。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { isSkillType, type SkillType } from './config.js';

/** 配置目录名（项目根下） */
export const VENUS_DIR_NAME = '.venus';

/** 配置文件路径（项目根下） */
export const CONFIG_FILE_NAME = path.join(VENUS_DIR_NAME, 'config.yaml');

/** 规则目录路径（项目根下） */
export const RULES_DIR_NAME = path.join(VENUS_DIR_NAME, 'rules');

/** 项目配置结构 */
export interface ProjectConfig {
    /** 项目背景（多行文本） */
    context: string;
    /** 显式引用的规则类型（顺序即注入顺序） */
    rules: SkillType[];
}

/** 解析后的完整配置（rules 文件内容已展开） */
export interface ResolvedProjectConfig {
    context: string;
    /** 类型 → 规则列表（仅含 config 引用且文件存在的内容） */
    rules: Partial<Record<SkillType, string[]>>;
    /** config 引用了但文件缺失的类型（提示用户） */
    missingRuleFiles: SkillType[];
}

/** 默认 config.yaml 内容 */
export function defaultConfigFileContent(): string {
    return `# VenusAgentTools 项目配置
# 修改后对后续 venus generate / 技能引导生效

context: |
  项目背景（供技能参考的技术栈与约定）：
  - 技术栈：待补充（如 TypeScript + Node.js 20+ / JDK 17 + Spring Boot 3）
  - 包管理器：待补充（如 pnpm / maven）
  - 分层约定：待补充（如 Controller → Service → DAO）

# 引用 rules/ 目录下的规则文件（每文件一个类型，每行一条规则）
# 列表顺序即注入顺序；删除某行即停用对应规则
rules:
  - tr_impl
  - tr_test
`;
}

/** 各类型默认规则文件内容 */
export function defaultRuleFileContent(type: SkillType): string {
    const typeMeta: Partial<Record<SkillType, string[]>> = {
        tr_impl: [
            '遵循项目分层架构，禁止跨层调用',
            '（待补充）实现类需补充 JavaDoc/方法注释',
        ],
        tr_test: ['（待补充）测试框架与既有用例保持一致'],
    };
    const lines = [
        `# ${type} 类型项目规则（每行一条，# 开头为注释）`,
        '',
        ...(typeMeta[type] ?? ['（待补充）本项目该类型的约束']),
        '',
    ];
    return lines.join('\n');
}

/** 读取 config.yaml 原始内容（目录不存在返回 null） */
function readConfigRaw(projectRoot: string): string | null {
    const configPath = path.join(projectRoot, CONFIG_FILE_NAME);
    if (!fs.existsSync(configPath)) {
        return null;
    }
    return fs.readFileSync(configPath, 'utf8');
}

/**
 * 极简解析 config.yaml：
 *   context: | 后跟缩进块（多行文本）
 *   rules: 下挂 "- <type>" 列表项
 */
export function parseProjectConfig(raw: string): ProjectConfig {
    const lines = raw.split(/\r?\n/);
    const config: ProjectConfig = { context: '', rules: [] };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        // context 多行块
        if (/^context:\s*\|/.test(line)) {
            const block: string[] = [];
            i++;
            while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
                block.push(lines[i].replace(/^  /, ''));
                i++;
            }
            config.context = block.join('\n').trimEnd();
            continue;
        }
        // rules 列表
        if (/^rules:/.test(line)) {
            i++;
            while (i < lines.length && /^\s+-\s/.test(lines[i])) {
                const item = lines[i].replace(/^\s+-\s/, '').trim();
                if (isSkillType(item)) {
                    config.rules.push(item);
                }
                i++;
            }
            continue;
        }
        i++;
    }
    return config;
}

/** 读取单个规则文件内容（每行一条，忽略空行与 # 注释） */
function readRuleFile(filePath: string): string[] {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    return fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * 读取并解析项目配置（config.yaml 引用 + rules 文件内容展开）。
 * 目录不存在返回 null；存在则返回解析结果（含缺失文件提示）。
 */
export function readProjectConfig(projectRoot: string): ResolvedProjectConfig | null {
    const raw = readConfigRaw(projectRoot);
    if (raw === null) {
        return null;
    }
    const { context, rules } = parseProjectConfig(raw);
    const resolved: ResolvedProjectConfig = { context, rules: {}, missingRuleFiles: [] };

    for (const type of rules) {
        const ruleFile = path.join(projectRoot, RULES_DIR_NAME, `${type}.md`);
        if (!fs.existsSync(ruleFile)) {
            resolved.missingRuleFiles.push(type);
            continue;
        }
        const items = readRuleFile(ruleFile);
        if (items.length > 0) {
            resolved.rules[type] = items;
        }
    }
    return resolved;
}

/**
 * init 时创建 .venus/ 目录结构（已存在则跳过，保留用户修改）。
 * 返回状态与本次新建的规则文件（已存在时无新建，返回空）。
 */
export function ensureProjectConfig(projectRoot: string): {
    state: 'created' | 'exists';
    ruleFiles: string[];
} {
    const configPath = path.join(projectRoot, CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
        return { state: 'exists', ruleFiles: [] };
    }

    const rulesDir = path.join(projectRoot, RULES_DIR_NAME);
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(configPath, defaultConfigFileContent(), 'utf8');
    // 默认规则文件（已存在的不覆盖）
    const created: string[] = [];
    for (const type of ['tr_impl', 'tr_test'] as SkillType[]) {
        const ruleFile = path.join(rulesDir, `${type}.md`);
        if (!fs.existsSync(ruleFile)) {
            fs.writeFileSync(ruleFile, defaultRuleFileContent(type), 'utf8');
            created.push(path.relative(projectRoot, ruleFile));
        }
    }
    return { state: 'created', ruleFiles: created };
}

/** 列出 rules/ 目录下已有的规则文件（项目相对路径） */
export function listRuleFiles(projectRoot: string): string[] {
    const rulesDir = path.join(projectRoot, RULES_DIR_NAME);
    if (!fs.existsSync(rulesDir)) {
        return [];
    }
    return fs
        .readdirSync(rulesDir)
        .filter((name) => name.endsWith('.md') && isSkillType(name.replace(/\.md$/, '')))
        .map((name) => path.join(RULES_DIR_NAME, name));
}

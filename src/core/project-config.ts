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
 * 回写（writeWorkflowsToConfig / writeContextToConfig）采用逐行段替换：
 * 只替换命中的目标段，其余行（含注释行与未知段）逐字保留，
 * MUST NOT 重新序列化整个 YAML（否则会丢注释与未知段）。
 *
 * 采用极简 YAML 解析（键: 值 + 缩进列表），不引入 YAML 依赖。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { isSkillType, type SkillType, type AIToolOption } from './config.js';

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
    /** 用户选择的 workflow id 列表（空=未配置，用默认集） */
    workflows: string[];
    /** 用户选择的目标工具 id 列表（空=未配置，用全部工具） */
    tools: string[];
}

/** 解析后的完整配置（rules 文件内容已展开） */
export interface ResolvedProjectConfig {
    context: string;
    /** 类型 → 规则列表（仅含 config 引用且文件存在的内容） */
    rules: Partial<Record<SkillType, string[]>>;
    /** config 引用了但文件缺失的类型（提示用户） */
    missingRuleFiles: SkillType[];
    /** 用户选择的 workflow id 列表（空=未配置，用默认集） */
    workflows: string[];
    /** 用户选择的目标工具 id 列表（空=未配置，用全部工具） */
    tools: string[];
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
  - spec

# 选择本项目要安装的 workflow（venus init/update 据此过滤生成）
# 未配置或为空时使用默认集（7 项：tr-init-project + spec 全 6）
# 选了 spec-propose 自动带 spec-verify-proposal；选了 spec-archive 自动带 spec-verify
workflows:
  - tr-init-project
  - spec-explore
  - spec-propose
  - spec-apply
  - spec-archive
  - spec-verify
  - spec-verify-proposal

# 选择要生成适配的目标 AI 工具（venus init/update 据此过滤生成）
# 未配置或为空时默认全部工具（当前：claude, pi, codex）
tools:
  - claude
  - pi
  - codex
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
        spec: [
            '变更制品位于 openspec/changes/，按 spec-driven 依赖序生成（proposal → specs/design → tasks）',
            '提案实现前必须通过 venus_spec_verify_proposal 评分门（阈值 90%）',
            '（待补充）本项目规格驱动工作流约束',
        ],
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
    const config: ProjectConfig = { context: '', rules: [], workflows: [], tools: [] };

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
        // workflows 列表（workflow id，连字符形式如 spec-explore；不校验类型，与 rules 正交）
        if (/^workflows:/.test(line)) {
            i++;
            while (i < lines.length && /^\s+-\s/.test(lines[i])) {
                const item = lines[i].replace(/^\s+-\s/, '').trim();
                if (item.length > 0) {
                    config.workflows.push(item);
                }
                i++;
            }
            continue;
        }
        // tools 列表（目标 AI 工具 id，如 claude / pi / codex）
        if (/^tools:/.test(line)) {
            i++;
            while (i < lines.length && /^\s+-\s/.test(lines[i])) {
                const item = lines[i].replace(/^\s+-\s/, '').trim();
                if (item.length > 0) {
                    config.tools.push(item);
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
    const { context, rules, workflows, tools } = parseProjectConfig(raw);
    const resolved: ResolvedProjectConfig = { context, rules: {}, missingRuleFiles: [], workflows, tools };

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
    for (const type of ['tr_impl', 'tr_test', 'spec'] as SkillType[]) {
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

/**
 * 段替换公共实现：逐行扫描 config.yaml，只替换命中的目标段，其余行逐字保留
 * （含注释行与未知段），MUST NOT 重新序列化整个 YAML。
 *
 * 命中目标段时以 renderSection 渲染的新内容替换原段头与段体；未命中则在文末追加。
 * 写入前确保 .venus/ 目录存在（config.yaml 不存在时先以默认内容为基底）。
 *
 * @param projectRoot - 项目根目录
 * @param sectionHead - 目标段头的行匹配（如 /^workflows:/）
 * @param findSectionBodyEnd - 传入段头下一行的下标，返回原段体结束后的下标（段体行被跳过）
 * @param renderSection - 渲染新段内容（段头 + 缩进体），逐行压入 out
 */
function replaceConfigSection(
    projectRoot: string,
    sectionHead: RegExp,
    findSectionBodyEnd: (lines: string[], start: number) => number,
    renderSection: (out: string[]) => void
): void {
    const configPath = path.join(projectRoot, CONFIG_FILE_NAME);
    const raw = readConfigRaw(projectRoot) ?? defaultConfigFileContent();
    const lines = raw.split(/\r?\n/);
    const out: string[] = [];
    let i = 0;
    let found = false;

    while (i < lines.length) {
        // 命中目标段：替换为渲染内容，并跳过原段体
        if (sectionHead.test(lines[i])) {
            found = true;
            renderSection(out);
            i = findSectionBodyEnd(lines, i + 1);
            continue;
        }
        out.push(lines[i]);
        i++;
    }
    // 原 config 无该段：文末追加（与上一行以空行分隔）
    if (!found) {
        if (out.length > 0 && out[out.length - 1] !== '') {
            out.push('');
        }
        renderSection(out);
    }

    // 确保配置目录存在（config.yaml 不存在时首次创建）
    const configDir = path.join(projectRoot, VENUS_DIR_NAME);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, out.join('\n') + '\n', 'utf8');
}

/** workflows 段体结束位置：缩进的 "- xxx" 列表项 */
function findWorkflowListEnd(lines: string[], start: number): number {
    let i = start;
    while (i < lines.length && /^\s+-\s/.test(lines[i])) {
        i++;
    }
    return i;
}

/**
 * context 段体（`context: |` 后的缩进块）结束位置。
 * 空行仅在其后方仍有缩进行时才计入段体（YAML 块标量允许块内空行），
 * 从而不吞掉段体之后的空行——其余行必须逐字保留。
 */
function findContextBlockEnd(lines: string[], start: number): number {
    let i = start;
    let bodyEnd = start;
    while (i < lines.length) {
        if (lines[i].startsWith('  ')) {
            i++;
            bodyEnd = i;
            continue;
        }
        if (lines[i].trim() === '') {
            i++;
            continue;
        }
        break;
    }
    return bodyEnd;
}

/**
 * 更新 config.yaml 的 workflows 字段（保留 context/rules 不动）。
 * 若 config.yaml 不存在则先创建目录与默认 context/rules，再写入指定 workflows。
 *
 * @param projectRoot - 项目根目录
 * @param workflows - 要写入的 workflow id 列表
 */
export function writeWorkflowsToConfig(projectRoot: string, workflows: string[]): void {
    replaceConfigSection(
        projectRoot,
        /^workflows:/,
        findWorkflowListEnd,
        (out) => {
            out.push('workflows:');
            for (const wf of workflows) {
                out.push(`  - ${wf}`);
            }
        }
    );
}

/**
 * 回写 config.yaml 的 context 段（`context: |` + 缩进块），其余行逐字保留。
 * 若 config.yaml 不存在则先创建 .venus/ 目录与默认配置，再写入指定 context。
 *
 * @param projectRoot - 项目根目录
 * @param context - 项目背景多行文本（每行统一缩进 2 空格）
 */
export function writeContextToConfig(projectRoot: string, context: string): void {
    const contentLines = context.trimEnd().split(/\r?\n/);
    replaceConfigSection(
        projectRoot,
        /^context:\s*\|/,
        findContextBlockEnd,
        (out) => {
            out.push('context: |');
            for (const line of contentLines) {
                // 块内空行保持为空行，不写出行尾多余空格
                out.push(line.length > 0 ? `  ${line}` : '');
            }
        }
    );
}

/**
 * 更新 config.yaml 的 tools 字段（保留其他段不动）。
 * 若 config.yaml 不存在则先创建目录与默认配置，再写入指定 tools。
 *
 * @param projectRoot - 项目根目录
 * @param tools - 要写入的工具 id 列表
 */
export function writeToolsToConfig(projectRoot: string, tools: string[]): void {
    replaceConfigSection(
        projectRoot,
        /^tools:/,
        findWorkflowListEnd,
        (out) => {
            out.push('tools:');
            for (const t of tools) {
                out.push(`  - ${t}`);
            }
        }
    );
}

/**
 * 解析生效的工具列表：CLI --tools >  config tools > 全部 AI_TOOLS。
 *
 * @param cliTools - CLI --tools 参数值（逗号分隔字符串，可选）
 * @param configTools - .venus/config.yaml 的 tools 列表（可选）
 * @param allTools - AI_TOOLS 全量列表
 * @returns 生效的工具对象列表；非法 id 直接抛错
 */
export function resolveActiveTools(
    cliTools: string | undefined,
    configTools: string[] | undefined,
    allTools: AIToolOption[]
): AIToolOption[] {
    const raw: string[] = cliTools
        ? cliTools.split(/[,\s]+/).filter((t) => t.length > 0)
        : configTools && configTools.length > 0
            ? configTools
            : allTools.map((t) => t.value);

    const resolved: AIToolOption[] = [];
    for (const id of raw) {
        const tool = allTools.find((t) => t.value === id);
        if (!tool) {
            throw new Error(`未知的工具标识：${id}（可选：${allTools.map((t) => t.value).join(', ')}）`);
        }
        resolved.push(tool);
    }
    return resolved;
}

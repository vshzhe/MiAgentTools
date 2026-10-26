/**
 * 项目级配置（.iagent/ 目录）。
 *
 * 结构（参照 openspec/config.yaml 的 context + rules 模式）：
 *   .iagent/
 *   ├── config.yaml    # context（项目背景）+ rules（显式引用 rules/ 下文件）
 *   └── rules/
 *       ├── coding-rules.md   # impl 域（每行一条，支持 # 注释）
 *       ├── testing-rules.md  # test 域
 *       └── spec.md           # spec 域（显式声明，与回退名形态一致）
 *
 * 命名唯一真源：类型 → 语义名映射见 `RULE_FILE_NAMES` / `ruleFileNameFor` /
 * `ruleFileTypeFor`（映射外类型回退 `<type>.md`）。读 / 列 / 写 / 修复四条路径
 * MUST NOT 另写文件名字面量，新增消费点 MUST 调用同一派生函数。
 *
 * 生命周期：**常量域**（头注释 + 蒸馏规则行）由 `iagent init` / `iagent update`
 * 确定性维护（缺失重建、旧版常量对齐）；**人工域**（`MANUAL_DOMAIN_MARKS` 标记区间）
 * 内为用户手写规则，自动更新逐字保留。旧名文件（`impl.md` / `test.md`）整体删除，
 * 不做兼容读取。
 *
 * config.yaml 通过 rules 列表显式 include 规则文件：
 *   - 顺序即注入顺序
 *   - 未列出的规则文件不生效（用户可通过删除引用停用）
 *   - 列表项是**类型 id**，与规则文件名正交（文件名由映射派生）
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
export const IAGENT_DIR_NAME = '.iagent';

/** 配置文件路径（项目根下） */
export const CONFIG_FILE_NAME = path.join(IAGENT_DIR_NAME, 'config.yaml');

/** 规则目录路径（项目根下） */
export const RULES_DIR_NAME = path.join(IAGENT_DIR_NAME, 'rules');

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
    return `# MiAgentTools 项目配置
# 修改后对后续 iagent generate / 技能引导生效

context: |
  项目背景（供技能参考的技术栈与约定）：
  - 技术栈：待补充（如 TypeScript + Node.js 20+ / JDK 17 + Spring Boot 3）
  - 包管理器：待补充（如 pnpm / maven）
  - 分层约定：待补充（如 Controller → Service → DAO）

# 引用 rules/ 目录下的规则文件（每文件一个类型，每行一条规则）
# 列表顺序即注入顺序；删除某行即停用对应规则
rules:
  - impl
  - test
  - spec

# 选择本项目要安装的 workflow（iagent init/update 据此过滤生成）
# 未配置或为空时使用默认集（7 项：project-init + spec 全 6）
# 选了 spec-propose 自动带 spec-verify-proposal；选了 spec-archive 自动带 spec-verify
workflows:
  - project-init
  - spec-explore
  - spec-propose
  - spec-apply
  - spec-archive
  - spec-verify
  - spec-verify-proposal

# 选择要生成适配的目标 AI 工具（iagent init/update 据此过滤生成）
# iagent init 会把本次选择的工具集回写到此处（可查看、可编辑）；
# iagent update 仅在显式传入 --tools 时回写；删除该字段（或留空）则回退默认工具集
# 默认工具集：claude, pi, codex；可选（opt-in）工具：opencode（需显式加入此列表或 --tools 才生成）
tools:
  - claude
  - pi
  - codex
`;
}

// ── 命名映射与人工域常量（单一源） ────────────────────────────────

/**
 * 类型 → 规则文件语义名（D-Q3 / D-Q9）。
 *
 * 管理型三类型使用语义名；映射外的合法类型回退 `<type>.md`（见 `ruleFileNameFor`）。
 * `spec` 的语义名恰与回退名一致，属**显式契约**而非巧合。
 */
export const RULE_FILE_NAMES: Readonly<Partial<Record<SkillType, string>>> = {
    impl: 'coding-rules.md',
    test: 'testing-rules.md',
    spec: 'spec.md',
};

/**
 * 由本变更改名产生的旧名规则文件（检测删除对象）。
 *
 * 只含 `.iagent/rules/` 域内的旧名；`.venus/rules/tr_*.md` 属旧装机迁移域，
 * 由 legacy-migration 的 `LEGACY_TYPE_RENAME` 一次性搬移（落点直达语义名），
 * MUST NOT 并入本清单。
 */
export const LEGACY_RULE_FILE_NAMES = ['impl.md', 'test.md'] as const;

/**
 * 人工域标记字面量（唯一代码真源）。
 *
 * project-init 技能模板正文从此常量插值渲染，避免第二份手写字面量；
 * 读取链过滤标记行本身，标记区间内的规则行照常注入。
 */
export const MANUAL_DOMAIN_MARKS = {
    start: '<!-- 人工域:开始 -->',
    end: '<!-- 人工域:结束 -->',
} as const;

/** 管理型类型（默认内容生成 / 缺失重建 / 常量对齐的固定作用域） */
const MANAGED_RULE_TYPES: readonly SkillType[] = ['impl', 'test', 'spec'];

/** 类型 → 规则文件语义名（映射优先，映射外回退 `<type>.md`） */
export function ruleFileNameFor(type: SkillType): string {
    return RULE_FILE_NAMES[type] ?? `${type}.md`;
}

/**
 * 文件名 → 类型反查（仅认语义名与**映射外**类型的合法 id 回退名）。
 *
 * 映射内类型的旧名（`impl.md` / `test.md`）返回 `null` —— 旧名整体删除、不做兼容读取，
 * 故 `listRuleFiles` 不会把旧名文件当合法规则列出。非 `.md` 与未知类型同样返回 `null`。
 */
export function ruleFileTypeFor(fileName: string): SkillType | null {
    for (const [type, name] of Object.entries(RULE_FILE_NAMES)) {
        if (name === fileName) {
            return type as SkillType;
        }
    }
    if (!fileName.endsWith('.md')) {
        return null;
    }
    const bare = fileName.slice(0, -'.md'.length);
    if (!isSkillType(bare)) {
        return null;
    }
    // 映射内类型只认语义名：旧名（impl.md / test.md）不识别
    if (RULE_FILE_NAMES[bare] !== undefined) {
        return null;
    }
    return bare;
}

/** 项目相对 posix 路径（报告字段统一口径，Windows 反斜杠归一） */
function toPosixPath(relativePath: string): string {
    return relativePath.replaceAll('\\', '/');
}

/** 管理型类型的规则文件项目相对 posix 路径 */
function ruleRelPath(type: SkillType): string {
    return toPosixPath(path.join(RULES_DIR_NAME, ruleFileNameFor(type)));
}

/**
 * 蒸馏常量规则行（D-5：要点行级，不复制源仓全文）。
 *
 * - `impl` 域蒸馏 `.iagent/rules` 之前的源仓护栏要点（零猜测 / 设计先行 / 数据与分层 /
 *   UI 四状态 / 生成交付）；
 * - `spec` 域蒸馏 Markdown-first 制品协议要点（真源 / 依赖序 / 写后校验 / JSON 弃用），
 *   并补 G1（变更目录创建）与 G6（上下文包）各一行；
 * - `test` 域 CLI 侧只有占位兜底行，项目特异性约定由 project-init 技能蒸馏进人工域。
 */
const RULE_CONSTANT_LINES: Readonly<Partial<Record<SkillType, readonly string[]>>> = {
    impl: [
        '零猜测：未明确的字段、参数与业务规则一律标 [待确认] 并询问用户，禁止猜测或推迟为 todo',
        '设计先行：实现前先给设计与影响面，过确认门后再改码；父编排已完成实现桥（implementation-bridge）时子技能不再重复设计确认，仅在无父流程授权时独立执行确认',
        '数据变更须明确字段 / 类型 / 约束；Schema 变更单独确认',
        '严格分层，禁止跨层调用；异常统一走 ErrorCode',
        'UI 组件须显式覆盖四状态：Loading → Empty → Error → Data',
        '按依赖层级顺序生成；破坏性改动先暂停并确认',
    ],
    test: ['（待补充）测试框架与既有用例保持一致'],
    spec: [
        '变更真源为 openspec/changes/ 下的 Markdown（proposal.md / design.md / specs/**/*.md / tasks.md）',
        '按依赖序生成：proposal → specs/design → tasks',
        '写入后运行 `iagent spec validate` 校验循环，失败则修正 Markdown 并重跑',
        '不创建 change.json / tasks.json（JSON 制品已弃用，MUST NOT 重新引入）',
        '提案实现前须通过评分门（阈值 90%）',
        '变更目录不存在时先 `iagent spec new`；已存在则询问复用或改名',
        '变更级 handoff 包：propose 一次性产出、跨阶段只读并只追加阶段结论，MUST NOT 逐阶段重复蒸馏（`.openspec-tmp/pipeline-<change>/handoff-pack.md`）',
    ],
    review: ['（待补充）审查/检查类技能的项目约束：评审与检查走只读，不在审查阶段改码'],
};

/** 常量块：头注释行 → 蒸馏常量规则行 → 空行（不含人工域标记对，D-5 第 1 条） */
function ruleConstantBlock(type: SkillType): string[] {
    const rules = RULE_CONSTANT_LINES[type] ?? ['（待补充）本项目该类型的约束'];
    return [`# ${ruleFileNameFor(type)} 项目规则（${type} 域，每行一条，# 开头为注释）`, ...rules, ''];
}

/** 新建文件时附带的空人工域骨架（标记对 + `#` 使用指引，D-5 第 7 条） */
function manualDomainSkeletonLines(): string[] {
    return [MANUAL_DOMAIN_MARKS.start, '# 人工域：可自由增删规则行，自动更新逐字保留', MANUAL_DOMAIN_MARKS.end];
}

/**
 * 组装规则文件内容：常量块 + 按原序拼接的人工域区间原文（D-5 对齐输出算法）。
 *
 * 文末统一单个换行；区间原文（含其标记行与区间内每一行）逐字保留，不重排、不合并、不去重。
 */
function composeRuleFileContent(type: SkillType, intervals: readonly string[][]): string {
    const lines = [...ruleConstantBlock(type)];
    for (const interval of intervals) {
        lines.push(...interval);
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }
    return `${lines.join('\n')}\n`;
}

/**
 * 解析人工域区间（含破损取保留侧语义）。
 *
 * - 未闭合（有开始标记、无结束标记）：保留开始标记至文末并记问题；
 * - 嵌套 / 乱序：按最外层最大连续区间保留（嵌套的开始标记收进区间原文）并记问题；
 * - 孤立结束标记：该行属常量域（会被丢弃）并记问题。
 */
function parseManualDomains(content: string): { intervals: string[][]; issues: string[] } {
    const lines = content.split(/\r?\n/);
    const intervals: string[][] = [];
    const issues = new Set<string>();
    let open: number | null = null;
    for (let index = 0; index < lines.length; index++) {
        const trimmed = lines[index].trim();
        if (trimmed === MANUAL_DOMAIN_MARKS.start) {
            if (open === null) {
                open = index;
            } else {
                issues.add('人工域标记嵌套或乱序，已按最外层最大连续区间保留');
            }
            continue;
        }
        if (trimmed === MANUAL_DOMAIN_MARKS.end) {
            if (open === null) {
                issues.add('人工域结束标记缺少开始标记，该行已忽略');
                continue;
            }
            intervals.push(lines.slice(open, index + 1));
            open = null;
        }
    }
    if (open !== null) {
        intervals.push(lines.slice(open));
        issues.add('人工域标记未闭合（缺结束标记），已保留开始标记至文末');
    }
    return { intervals, issues: [...issues] };
}

/** 各类型默认规则文件内容：常量块 + 一对空人工域骨架 */
export function defaultRuleFileContent(type: SkillType): string {
    return composeRuleFileContent(type, [manualDomainSkeletonLines()]);
}

/** 规则重建/修复明细（路径均为**项目相对 posix 路径**；warnings 为面向用户的告警行） */
export interface RuleRepairReport {
    /** 检测并整体删除的旧名规则文件（`impl.md` / `test.md`） */
    removedOldName: string[];
    /** 本次新建（缺失重建）的规则文件 */
    created: string[];
    /** 本次按常量对齐重写的规则文件（人工域区间逐字保留） */
    aligned: string[];
    /** 本轮 legacy 迁移产出、按 preservePaths 跳过对齐的文件（只登记不重写） */
    preserved: string[];
    /** 告警行（删除丢失风险、标记破损、写入失败等） */
    warnings: string[];
}

/** 规则重建/修复选项 */
export interface RuleRepairOptions {
    /**
     * 本轮 legacy 迁移产出的规则文件（项目相对 posix 路径）。
     *
     * 命中的文件只登记 `preserved`、跳过常量对齐；目标不存在或非管理型三类型时安全忽略。
     * 该豁免只延后一轮对齐，不构成永久保留。
     */
    preservePaths?: readonly string[];
}

/** `ensureProjectConfig` 选项 */
export interface EnsureProjectConfigOptions {
    /** 同 {@link RuleRepairOptions.preservePaths}（两分支均透传） */
    preservePaths?: readonly string[];
}

/** 空修复明细 */
function emptyRuleRepair(): RuleRepairReport {
    return { removedOldName: [], created: [], aligned: [], preserved: [], warnings: [] };
}

/** 错误文本（失败原因须可读，禁止空 catch） */
function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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
        // context 多行块
        if (/^context:\s*\|/.test(lines[i])) {
            const block: string[] = [];
            i++;
            while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
                block.push(lines[i].replace(/^  /, ''));
                i++;
            }
            config.context = block.join('\n').trimEnd();
            continue;
        }
        i++;
    }
    // 列表段（workflow id 连字符形式如 spec-explore，与 rules 类型正交，故这里不校验类型）
    config.rules = readListSection(raw, /^rules:/).filter(isSkillType);
    config.workflows = readListSection(raw, /^workflows:/);
    config.tools = readListSection(raw, /^tools:/);
    return config;
}

/**
 * 读取 config.yaml 中某个缩进列表段的条目（按出现顺序）。
 *
 * 供解析与遗留迁移共用：迁移须读**旧**类型 id 与旧 workflow id，
 * 而 `parseProjectConfig` 会按新类型过滤，故不能复用它读旧值。
 *
 * @param raw - config 原始内容
 * @param sectionHead - 段头匹配（如 /^rules:/）
 * @returns 段内 `- <item>` 的非空条目（段不存在返回空数组）
 */
export function readListSection(raw: string, sectionHead: RegExp): string[] {
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        if (!sectionHead.test(lines[i])) {
            continue;
        }
        const items: string[] = [];
        let j = i + 1;
        while (j < lines.length && /^\s+-\s/.test(lines[j])) {
            const item = lines[j].replace(/^\s+-\s/, '').trim();
            if (item.length > 0) {
                items.push(item);
            }
            j++;
        }
        return items;
    }
    return [];
}

/**
 * 读取单个规则文件内容（每行一条，忽略空行与 # 注释）。
 *
 * 人工域标记行本身不参与注入（`MANUAL_DOMAIN_MARKS` 两枚均过滤），
 * 标记区间内的规则行照常注入 —— 用户人工域规则与常量域规则同等生效。
 */
function readRuleFile(filePath: string): string[] {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    return fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(
            (line) =>
                line.length > 0 &&
                !line.startsWith('#') &&
                line !== MANUAL_DOMAIN_MARKS.start &&
                line !== MANUAL_DOMAIN_MARKS.end
        );
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
        const ruleFile = path.join(projectRoot, RULES_DIR_NAME, ruleFileNameFor(type));
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
 * 旧名规则文件检测删除单步。
 *
 * init 的 created 分支与 `repairRuleFiles` 共用本函数，保证两条路径的删除行为与告警
 * 文案完全一致。检出即**整体删除**（不做内容合并读取），逐文件输出丢失风险 WARN。
 *
 * @param projectRoot - 项目根目录
 * @returns removed（已删除的项目相对 posix 路径）与 warnings（面向用户的告警行）
 */
export function removeLegacyRuleFiles(projectRoot: string): { removed: string[]; warnings: string[] } {
    const removed: string[] = [];
    const warnings: string[] = [];
    const rulesDir = path.join(projectRoot, RULES_DIR_NAME);
    if (!fs.existsSync(rulesDir)) {
        return { removed, warnings };
    }
    for (const legacyName of LEGACY_RULE_FILE_NAMES) {
        const target = path.join(rulesDir, legacyName);
        if (!fs.existsSync(target)) {
            continue;
        }
        const rel = toPosixPath(path.relative(projectRoot, target));
        const bare = legacyName.slice(0, -'.md'.length);
        const replacement = isSkillType(bare) ? `.iagent/rules/${ruleFileNameFor(bare)}` : '语义名规则文件';
        try {
            fs.rmSync(target, { force: true });
            removed.push(rel);
            warnings.push(
                `旧名规则文件 ${rel} 已整体删除：该文件可能承载你手写的内容，删除存在丢失风险；` +
                    `新规则请写入 ${replacement}`
            );
        } catch (error) {
            warnings.push(`旧名规则文件 ${rel} 删除失败（已跳过）：${describeError(error)}`);
        }
    }
    return { removed, warnings };
}

/**
 * 规则文件重建/修复（幂等、非阻断）：preservePaths 登记 → 旧名删除 → 缺失重建 →
 * 人工域外常量对齐（D-2 契约 / D-5 算法）。
 *
 * 项目无 `.iagent/`（未 init）时为空操作，MUST NOT 凭空创建配置目录。
 * 读写失败（权限 / 只读 / IO 异常）只记 WARN，MUST NOT 抛出或中断调用方。
 *
 * @param projectRoot - 项目根目录
 * @param options - preservePaths：本轮 legacy 迁移产出的规则文件（项目相对 posix 路径）
 * @returns 修复明细（路径为项目相对 posix 路径）
 */
export function repairRuleFiles(projectRoot: string, options: RuleRepairOptions = {}): RuleRepairReport {
    const report = emptyRuleRepair();
    const iagentDir = path.join(projectRoot, IAGENT_DIR_NAME);
    if (!fs.existsSync(iagentDir)) {
        return report;
    }
    const rulesDir = path.join(projectRoot, RULES_DIR_NAME);
    const preserve = new Set((options.preservePaths ?? []).map((item) => toPosixPath(item)));

    // 1. 本轮迁移产出：只登记、不对齐（目标不存在或非管理型路径安全忽略）
    const preservedTypes = new Set<SkillType>();
    for (const type of MANAGED_RULE_TYPES) {
        const rel = ruleRelPath(type);
        if (!preserve.has(rel)) {
            continue;
        }
        if (!fs.existsSync(path.join(projectRoot, rel))) {
            continue;
        }
        report.preserved.push(rel);
        preservedTypes.add(type);
    }

    // 2. 旧名检测删除（与 init 的 created 分支同一单步）
    const legacy = removeLegacyRuleFiles(projectRoot);
    report.removedOldName.push(...legacy.removed);
    report.warnings.push(...legacy.warnings);

    // 3/4. 缺失重建与人工域外对齐
    let rulesDirReady = fs.existsSync(rulesDir);
    for (const type of MANAGED_RULE_TYPES) {
        if (preservedTypes.has(type)) {
            continue;
        }
        const rel = ruleRelPath(type);
        const abs = path.join(projectRoot, rel);
        if (!fs.existsSync(abs)) {
            try {
                if (!rulesDirReady) {
                    fs.mkdirSync(rulesDir, { recursive: true });
                    rulesDirReady = true;
                }
                fs.writeFileSync(abs, defaultRuleFileContent(type), 'utf8');
                report.created.push(rel);
            } catch (error) {
                report.warnings.push(`规则文件 ${rel} 重建失败（已跳过）：${describeError(error)}`);
            }
            continue;
        }

        let existing: string;
        try {
            existing = fs.readFileSync(abs, 'utf8');
        } catch (error) {
            report.warnings.push(`规则文件 ${rel} 读取失败（已跳过错位对齐）：${describeError(error)}`);
            continue;
        }
        const parsed = parseManualDomains(existing);
        for (const issue of parsed.issues) {
            report.warnings.push(`规则文件 ${rel}：${issue}`);
        }
        const aligned = composeRuleFileContent(type, parsed.intervals);
        if (aligned === existing) {
            continue;
        }
        if (parsed.intervals.length === 0) {
            report.warnings.push(
                `规则文件 ${rel} 未检出人工域标记，已整块重写为常量内容：` +
                    `手写规则请置于 ${MANUAL_DOMAIN_MARKS.start} 与 ${MANUAL_DOMAIN_MARKS.end} 之间`
            );
        }
        try {
            fs.writeFileSync(abs, aligned, 'utf8');
            report.aligned.push(rel);
        } catch (error) {
            report.warnings.push(`规则文件 ${rel} 对齐写入失败（已跳过）：${describeError(error)}`);
        }
    }
    return report;
}

/**
 * init 时创建/修复 `.iagent/` 目录结构。
 *
 * 双层语义：
 * - `config.yaml` 不存在（created）→ 创建 config.yaml + 三份语义名规则文件；
 *   写文件前**先执行旧名检测删除**（无 config.yaml 但存在 impl.md 时不得逃过清理）；
 *   已存在的语义名文件不覆盖、不做常量对齐，记 WARN 提示改用 `iagent update` 修复；
 * - `config.yaml` 已存在（exists）→ 转 `repairRuleFiles`（旧名清理 / 缺失重建 / 人工域外对齐）。
 *
 * `config.yaml` 本身仍按「已存在不重生成、逐字保留用户内容」处理。
 *
 * @param projectRoot - 项目根目录
 * @param options - preservePaths：本轮 legacy 迁移产出的规则文件（两分支均透传）
 */
export function ensureProjectConfig(
    projectRoot: string,
    options: EnsureProjectConfigOptions = {}
): {
    state: 'created' | 'exists';
    ruleFiles: string[];
    ruleRepair: RuleRepairReport;
} {
    const configPath = path.join(projectRoot, CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
        return {
            state: 'exists',
            ruleFiles: [],
            ruleRepair: repairRuleFiles(projectRoot, { preservePaths: options.preservePaths }),
        };
    }

    const ruleRepair = emptyRuleRepair();
    const preserve = new Set((options.preservePaths ?? []).map((item) => toPosixPath(item)));
    const rulesDir = path.join(projectRoot, RULES_DIR_NAME);
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(configPath, defaultConfigFileContent(), 'utf8');

    // 旧名清理无条件执行（先于新名文件写入）
    const legacy = removeLegacyRuleFiles(projectRoot);
    ruleRepair.removedOldName.push(...legacy.removed);
    ruleRepair.warnings.push(...legacy.warnings);

    const created: string[] = [];
    for (const type of MANAGED_RULE_TYPES) {
        const ruleFile = path.join(rulesDir, ruleFileNameFor(type));
        const rel = ruleRelPath(type);
        if (fs.existsSync(ruleFile)) {
            // created 分支不进入常量对齐：既有文件字节不变
            if (preserve.has(rel)) {
                ruleRepair.preserved.push(rel);
            } else {
                ruleRepair.warnings.push(
                    `规则文件 ${rel} 已存在，未做常量对齐；内容可能过期，可运行 \`iagent update\` 修复`
                );
            }
            continue;
        }
        fs.writeFileSync(ruleFile, defaultRuleFileContent(type), 'utf8');
        created.push(path.relative(projectRoot, ruleFile));
        ruleRepair.created.push(rel);
    }
    return { state: 'created', ruleFiles: created, ruleRepair };
}

/**
 * 列出 rules/ 目录下已有的规则文件（项目相对路径）。
 *
 * 双形态识别：语义名（`coding-rules.md` / `testing-rules.md` / `spec.md`）与
 * **映射外**类型的合法 id 回退名（如用户自建的 `commit.md`）；映射内类型的旧名
 * （`impl.md` / `test.md`）不列出（旧名整体删除、不做兼容读取）。
 */
export function listRuleFiles(projectRoot: string): string[] {
    const rulesDir = path.join(projectRoot, RULES_DIR_NAME);
    if (!fs.existsSync(rulesDir)) {
        return [];
    }
    return fs
        .readdirSync(rulesDir)
        .filter((name) => ruleFileTypeFor(name) !== null)
        .map((name) => path.join(RULES_DIR_NAME, name));
}

/**
 * 段替换的纯函数实现：逐行扫描原始内容，只替换命中的目标段，其余行逐字保留
 * （含注释行与未知段），MUST NOT 重新序列化整个 YAML。
 *
 * 命中目标段时以 renderSection 渲染的新内容替换原段头与段体。
 * 返回内容统一以单个换行结尾（与原回写路径的落盘格式一致）。
 *
 * @param raw - config 原始内容
 * @param sectionHead - 目标段头的行匹配（如 /^workflows:/）
 * @param findSectionBodyEnd - 传入段头下一行的下标，返回原段体结束后的下标（段体行被跳过）
 * @param renderSection - 渲染新段内容（段头 + 缩进体），逐行压入 out
 * @param options - appendWhenMissing：段头未命中时是否在文末追加（默认 true，回写路径沿用；
 *                  遗留迁移传 false —— 旧配置本就没有该段时不得凭空补一个）
 * @returns 替换后的内容，以及是否命中目标段
 */
export function replaceConfigSectionInRaw(
    raw: string,
    sectionHead: RegExp,
    findSectionBodyEnd: (lines: string[], start: number) => number,
    renderSection: (out: string[]) => void,
    options: { appendWhenMissing?: boolean } = {}
): { content: string; found: boolean } {
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
    // 原 config 无该段
    if (!found) {
        if (options.appendWhenMissing === false) {
            return { content: raw, found: false };
        }
        // 文末追加（与上一行以空行分隔）
        if (out.length > 0 && out[out.length - 1] !== '') {
            out.push('');
        }
        renderSection(out);
    }
    // 统一以单个换行结尾：去掉原文末尾的空行（否则每次回写都会累积一个空行，破坏幂等）
    while (out.length > 0 && out[out.length - 1] === '') {
        out.pop();
    }
    return { content: out.join('\n') + '\n', found };
}

/**
 * 段替换并落盘：写入前确保 .iagent/ 目录存在
 * （config.yaml 不存在时先以默认内容为基底）。
 *
 * @param projectRoot - 项目根目录
 * @param sectionHead - 目标段头的行匹配（如 /^workflows:/）
 * @param findSectionBodyEnd - 传入段头下一行的下标，返回原段体结束后的下标
 * @param renderSection - 渲染新段内容（段头 + 缩进体），逐行压入 out
 */
function replaceConfigSection(
    projectRoot: string,
    sectionHead: RegExp,
    findSectionBodyEnd: (lines: string[], start: number) => number,
    renderSection: (out: string[]) => void
): void {
    const raw = readConfigRaw(projectRoot) ?? defaultConfigFileContent();
    const { content } = replaceConfigSectionInRaw(raw, sectionHead, findSectionBodyEnd, renderSection);

    // 确保配置目录存在（config.yaml 不存在时首次创建）
    const configDir = path.join(projectRoot, IAGENT_DIR_NAME);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(path.join(projectRoot, CONFIG_FILE_NAME), content, 'utf8');
}

/** 缩进列表段（rules / workflows / tools）的段体结束位置 */
export function findListSectionEnd(lines: string[], start: number): number {
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
        findListSectionEnd,
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
 * 若 config.yaml 不存在则先创建 .iagent/ 目录与默认配置，再写入指定 context。
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
        findListSectionEnd,
        (out) => {
            out.push('tools:');
            for (const t of tools) {
                out.push(`  - ${t}`);
            }
        }
    );
}

/**
 * 解析生效的工具列表：CLI --tools > config tools > 默认工具集（全部 AI_TOOLS 排除 opt-in）。
 *
 * @param cliTools - CLI --tools 参数值（逗号分隔字符串，可选）
 * @param configTools - .iagent/config.yaml 的 tools 列表（可选）
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
            : allTools.filter((t) => !t.optIn).map((t) => t.value);

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

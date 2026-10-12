/**
 * JSON Sidecar 写入器 —— 代码级 JSON sidecar 文件的写入、校验与渲染。
 *
 * 职责边界：
 *   - 本模块负责 JSON 文件的写入路径（路径构造、目录创建、schema 校验、文件写入）
 *   - 不负责 Markdown → JSON 的提取转换（JSON 是主产物，非 MD 派生）
 *   - tasks.json → tasks.md 的确定性渲染由 renderTasksMd() 承担
 *   - change.json（合并主产物）的读写由 readChangeJson / writeChangeJson / initChangeJson 承担；
 *     proposal / design / specs 段 → MD 的确定性渲染由 renderProposalMd / renderDesignMd / renderSpecsMd 承担
 *
 * 依赖：sidecar-schema.ts（类型定义 + 枚举校验 + 空模板工厂）
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    createEmptyTasks,
    createEmptyDecisions,
    createEmptyCapabilities,
    createEmptyChange,
    isValidPhase,
    isValidTaskStatus,
    isValidOperation,
} from './sidecar-schema.js';
import type {
    ManifestSchema,
    TasksSchema,
    TaskEntry,
    DecisionsSchema,
    DecisionEntry,
    CapabilitiesSchema,
    CapabilityEntry,
    CapabilityOperationEntry,
    ChangePhase,
    ChangeSchema,
    ProposalSection,
    DesignSection,
    SpecsSection,
    CapabilityDecl,
} from './sidecar-schema.js';

// ── 常量 ──────────────────────────────────────────────────────────

/** 变更目录下 sidecar 子目录名 */
const SIDECAR_DIR = '.venus';

/** specs 段渲染时的操作类型分组顺序 */
const OPERATION_RENDER_ORDER = ['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'] as const;

// ── 校验结果 ──────────────────────────────────────────────────────

/** schema 校验结果 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// ── manifest 元信息入参 ──────────────────────────────────────────

/** writeManifestJson 的元信息参数（changeName 必填，其余可选） */
export interface ManifestMeta {
    changeName: string;
    phase?: ChangePhase;
    capabilities?: string[];
    impactAreas?: string[];
}

// ── 目录工具 ──────────────────────────────────────────────────────

/**
 * 确保变更目录下的 .venus/ 子目录存在（幂等）。
 * @param changeDir - 变更目录绝对路径
 * @returns .venus/ 目录的绝对路径
 */
export function ensureSidecarDir(changeDir: string): string {
    const sidecarDir = path.join(changeDir, SIDECAR_DIR);
    if (!fs.existsSync(sidecarDir)) {
        fs.mkdirSync(sidecarDir, { recursive: true });
    }
    return sidecarDir;
}

// ── 校验函数 ──────────────────────────────────────────────────────

/**
 * 校验 JSON sidecar 数据是否满足对应 schema 的必填字段约束。
 *
 * 校验粒度：
 *   - manifest: changeName / phase 合法性
 *   - tasks:     tasks 数组项 id/label/description/status 必填 + status 合法性
 *   - decisions: decisions 数组项 id/title/choice 必填
 *   - capabilities: capabilities 数组项 name 必填，operations 项 type 合法性
 *   - change:    根字段（$schema/changeName/phase）+ proposal/design/specs 三段递归校验
 *
 * @param type - sidecar 类型（'manifest' | 'tasks' | 'decisions' | 'capabilities' | 'change'）
 * @param data - 待校验的 JSON 数据
 * @returns 校验结果
 */
export function validateSidecar(type: string, data: unknown): ValidationResult {
    if (data === null || data === undefined) {
        return { valid: false, errors: ['数据不能为 null/undefined'] };
    }

    switch (type) {
        case 'manifest':
            return validateManifest(data as ManifestSchema);
        case 'tasks':
            return validateTasks(data as TasksSchema);
        case 'decisions':
            return validateDecisions(data as DecisionsSchema);
        case 'capabilities':
            return validateCapabilities(data as CapabilitiesSchema);
        case 'change':
            return validateChange(data as ChangeSchema);
        default:
            return { valid: false, errors: [`未知 sidecar 类型: ${type}`] };
    }
}

function validateManifest(data: ManifestSchema): ValidationResult {
    const errors: string[] = [];
    if (!data.changeName || typeof data.changeName !== 'string') {
        errors.push('manifest: changeName 必填且须为字符串');
    }
    if (!data.$schema) {
        errors.push('manifest: $schema 必填');
    }
    if (data.phase && !isValidPhase(data.phase)) {
        errors.push(`manifest: phase 值非法 "${data.phase}"，合法值: proposal/apply/archive`);
    }
    return { valid: errors.length === 0, errors };
}

function validateTasks(data: TasksSchema): ValidationResult {
    const errors: string[] = [];
    if (!data.$schema) {
        errors.push('tasks: $schema 必填');
    }
    if (!Array.isArray(data.tasks)) {
        errors.push('tasks: tasks 必须为数组');
        return { valid: false, errors };
    }
    data.tasks.forEach((t: TaskEntry, i: number) => {
        if (!t.id) {
            errors.push(`tasks[${i}].id 必填`);
        }
        if (!t.label) {
            errors.push(`tasks[${i}].label 必填`);
        }
        if (!t.description) {
            errors.push(`tasks[${i}].description 必填`);
        }
        if (t.status && !isValidTaskStatus(t.status)) {
            errors.push(`tasks[${i}].status 值非法 "${t.status}"，合法值: pending/done`);
        }
    });
    return { valid: errors.length === 0, errors };
}

function validateDecisions(data: DecisionsSchema): ValidationResult {
    const errors: string[] = [];
    if (!data.$schema) {
        errors.push('decisions: $schema 必填');
    }
    if (!Array.isArray(data.decisions)) {
        errors.push('decisions: decisions 必须为数组');
        return { valid: false, errors };
    }
    data.decisions.forEach((d: DecisionEntry, i: number) => {
        if (!d.id) {
            errors.push(`decisions[${i}].id 必填`);
        }
        if (!d.title) {
            errors.push(`decisions[${i}].title 必填`);
        }
        if (!d.choice) {
            errors.push(`decisions[${i}].choice 必填`);
        }
    });
    return { valid: errors.length === 0, errors };
}

function validateCapabilities(data: CapabilitiesSchema): ValidationResult {
    const errors: string[] = [];
    if (!data.$schema) {
        errors.push('capabilities: $schema 必填');
    }
    if (!Array.isArray(data.capabilities)) {
        errors.push('capabilities: capabilities 必须为数组');
        return { valid: false, errors };
    }
    data.capabilities.forEach((c: CapabilityEntry, ci: number) => {
        if (!c.name) {
            errors.push(`capabilities[${ci}].name 必填`);
        }
        if (!Array.isArray(c.operations)) {
            errors.push(`capabilities[${ci}].operations 必须为数组`);
            return;
        }
        c.operations.forEach((op: CapabilityOperationEntry, oi: number) => {
            if (op.type && !isValidOperation(op.type)) {
                errors.push(
                    `capabilities[${ci}].operations[${oi}].type 值非法 "${op.type}"，合法值: ADDED/MODIFIED/REMOVED/RENAMED`,
                );
            }
        });
    });
    return { valid: errors.length === 0, errors };
}

function validateChange(data: ChangeSchema): ValidationResult {
    const errors: string[] = [];
    if (!data.$schema) {
        errors.push('$schema 必填');
    }
    if (!data.changeName || typeof data.changeName !== 'string') {
        errors.push('changeName 必填且须为字符串');
    }
    if (!data.phase) {
        errors.push('phase 必填');
    } else if (!isValidPhase(data.phase)) {
        errors.push(`phase 值非法 "${data.phase}"，合法值: proposal/apply/archive`);
    }
    if (data.proposal) {
        validateProposalSection(data.proposal, errors);
    }
    if (data.design) {
        validateDesignSection(data.design, errors);
    }
    if (data.specs) {
        validateSpecsSection(data.specs, errors);
    }
    return { valid: errors.length === 0, errors };
}

/**
 * 递归校验 proposal 段，错误信息带字段路径（如 "proposal.whatChanges 必须为数组"）。
 */
function validateProposalSection(proposal: ProposalSection, errors: string[]): void {
    if (!proposal.why || typeof proposal.why !== 'string') {
        errors.push('proposal.why 必填且须为字符串');
    }
    if (!Array.isArray(proposal.whatChanges)) {
        errors.push('proposal.whatChanges 必须为数组');
    } else {
        proposal.whatChanges.forEach((item, i) => {
            if (typeof item !== 'string') {
                errors.push(`proposal.whatChanges[${i}] 必须为字符串`);
            }
        });
    }
    if (!proposal.capabilities) {
        errors.push('proposal.capabilities 必填');
    } else {
        validateCapabilityDecls(proposal.capabilities.new, 'proposal.capabilities.new', errors);
        validateCapabilityDecls(proposal.capabilities.modified, 'proposal.capabilities.modified', errors);
    }
    if (!proposal.impact) {
        errors.push('proposal.impact 必填');
    } else {
        if (!Array.isArray(proposal.impact.files)) {
            errors.push('proposal.impact.files 必须为数组');
        } else {
            proposal.impact.files.forEach((file, i) => {
                if (!file.path) {
                    errors.push(`proposal.impact.files[${i}].path 必填`);
                }
                if (!file.description) {
                    errors.push(`proposal.impact.files[${i}].description 必填`);
                }
            });
        }
        if (typeof proposal.impact.breaking !== 'boolean') {
            errors.push('proposal.impact.breaking 必须为布尔值');
        }
        if (!proposal.impact.compatibility || typeof proposal.impact.compatibility !== 'string') {
            errors.push('proposal.impact.compatibility 必填且须为字符串');
        }
    }
}

/**
 * 校验能力声明数组（new / modified 共用），错误路径以 fieldPath 为前缀。
 */
function validateCapabilityDecls(decls: CapabilityDecl[], fieldPath: string, errors: string[]): void {
    if (!Array.isArray(decls)) {
        errors.push(`${fieldPath} 必须为数组`);
        return;
    }
    decls.forEach((decl, i) => {
        if (!decl.name) {
            errors.push(`${fieldPath}[${i}].name 必填`);
        }
        if (!decl.description || typeof decl.description !== 'string') {
            errors.push(`${fieldPath}[${i}].description 必填且须为字符串`);
        }
    });
}

/**
 * 递归校验 design 段，错误信息带字段路径（如 "design.decisions[0].id 必填"）。
 */
function validateDesignSection(design: DesignSection, errors: string[]): void {
    if (!design.context || typeof design.context !== 'string') {
        errors.push('design.context 必填且须为字符串');
    }
    if (!Array.isArray(design.goals)) {
        errors.push('design.goals 必须为数组');
    }
    if (!Array.isArray(design.nonGoals)) {
        errors.push('design.nonGoals 必须为数组');
    }
    if (!Array.isArray(design.decisions)) {
        errors.push('design.decisions 必须为数组');
    } else {
        design.decisions.forEach((decision, i) => {
            if (!decision.id) {
                errors.push(`design.decisions[${i}].id 必填`);
            }
            if (!decision.title) {
                errors.push(`design.decisions[${i}].title 必填`);
            }
            if (!decision.choice) {
                errors.push(`design.decisions[${i}].choice 必填`);
            }
        });
    }
    if (!Array.isArray(design.risks)) {
        errors.push('design.risks 必须为数组');
    } else {
        design.risks.forEach((risk, i) => {
            if (!risk.risk) {
                errors.push(`design.risks[${i}].risk 必填`);
            }
            if (!risk.mitigation) {
                errors.push(`design.risks[${i}].mitigation 必填`);
            }
        });
    }
}

/**
 * 递归校验 specs 段，错误信息带下标路径
 * （如 "specs[0].operations[1].type 值非法"），并按操作类型校验必填字段：
 * ADDED/MODIFIED 要求 description；REMOVED 要求 reason + migration；RENAMED 要求 from + to。
 */
function validateSpecsSection(specs: SpecsSection, errors: string[]): void {
    if (!Array.isArray(specs)) {
        errors.push('specs 必须为数组');
        return;
    }
    specs.forEach((spec, si) => {
        if (!spec.name || typeof spec.name !== 'string') {
            errors.push(`specs[${si}].name 必填且须为字符串`);
        }
        if (!spec.path || typeof spec.path !== 'string') {
            errors.push(`specs[${si}].path 必填且须为字符串`);
        }
        if (!Array.isArray(spec.operations)) {
            errors.push(`specs[${si}].operations 必须为数组`);
            return;
        }
        spec.operations.forEach((op, oi) => {
            const opPath = `specs[${si}].operations[${oi}]`;
            if (!op.type) {
                errors.push(`${opPath}.type 必填`);
            } else if (!isValidOperation(op.type)) {
                errors.push(`${opPath}.type 值非法 "${op.type}"，合法值: ADDED/MODIFIED/REMOVED/RENAMED`);
            }
            if (!op.requirement) {
                errors.push(`${opPath}.requirement 必填`);
            }
            if (op.type === 'ADDED' || op.type === 'MODIFIED') {
                if (!op.description) {
                    errors.push(`${opPath}.description 必填`);
                }
            } else if (op.type === 'REMOVED') {
                if (!op.reason) {
                    errors.push(`${opPath}.reason 必填`);
                }
                if (!op.migration) {
                    errors.push(`${opPath}.migration 必填`);
                }
            } else if (op.type === 'RENAMED') {
                if (!op.from) {
                    errors.push(`${opPath}.from 必填`);
                }
                if (!op.to) {
                    errors.push(`${opPath}.to 必填`);
                }
            }
            if (op.scenarios !== undefined) {
                if (!Array.isArray(op.scenarios)) {
                    errors.push(`${opPath}.scenarios 必须为数组`);
                } else {
                    op.scenarios.forEach((scenario, sci) => {
                        if (!scenario.name) {
                            errors.push(`${opPath}.scenarios[${sci}].name 必填`);
                        }
                        if (!scenario.when) {
                            errors.push(`${opPath}.scenarios[${sci}].when 必填`);
                        }
                        if (!scenario.then) {
                            errors.push(`${opPath}.scenarios[${sci}].then 必填`);
                        }
                    });
                }
            }
        });
    });
}

// ── 写入函数 ──────────────────────────────────────────────────────

/**
 * 原子写入 JSON 到文件。
 *
 * 五步流程确保数据完整性：
 *   1. JSON.stringify 加 try-catch（避免序列化异常损坏原文件）
 *   2. 写入 .tmp.<pid>.<timestamp> 临时文件
 *   3. 回读临时文件验证 JSON.parse 可解析
 *   4. 原有文件备份到 .bak
 *   5. rename 原子替换（同盘原子；跨盘失败时 copyFile + unlink 兜底）
 *
 * 任一步失败 → 清理 .tmp，保留原文件与 .bak 备份。
 * 写入成功后删除 .bak。
 */
function writeJsonFile(filePath: string, data: unknown): void {
    // 1. JSON 序列化（try-catch 保护，异常不落盘）
    let json: string;
    try {
        json = JSON.stringify(data, null, 2);
    } catch (error: unknown) {
        throw new Error(
            `JSON 序列化失败 (${filePath}): ${(error as Error).message}（原文件未受影响）`,
        );
    }

    // 2. 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // 3. 写入临时文件
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + Date.now();
    try {
        fs.writeFileSync(tmpPath, json, 'utf8');
    } catch (error: unknown) {
        // 清理临时文件（忽略清理错误）
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        throw new Error(`写入临时文件失败 (${tmpPath}): ${(error as Error).message}`);
    }

    // 4. 写入验证：回读并解析，确保 JSON 合法
    try {
        const verifyContent = fs.readFileSync(tmpPath, 'utf8');
        JSON.parse(verifyContent);
    } catch (error: unknown) {
        // 验证失败：清理临时文件，保留原文件
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        throw new Error(`写入后验证失败 (${filePath}): ${(error as Error).message}`);
    }

    // 5. 备份原有文件
    const bakPath = filePath + '.bak';
    if (fs.existsSync(filePath)) {
        try {
            fs.copyFileSync(filePath, bakPath);
        } catch {
            // 备份失败不阻断（尽力而为），继续写入
        }
    }

    // 6. 原子重命名
    try {
        fs.renameSync(tmpPath, filePath);
    } catch {
        // rename 失败时尝试用 copyFile + unlink 兜底（跨设备/分区场景）
        try {
            fs.copyFileSync(tmpPath, filePath);
            fs.unlinkSync(tmpPath);
        } catch (copyError: unknown) {
            // 兜底也失败：清理临时文件，保留原文件与 .bak
            try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
            throw new Error(
                `原子写入失败 (${filePath}): ${(copyError as Error).message}`,
            );
        }
    }

    // 7. 写入成功：删除 .bak
    try { fs.unlinkSync(bakPath); } catch { /* ignore */ }
}

/**
 * 写入 manifest.json（自动填充 timestamps + phase）。
 *
 * @param changeDir - 变更目录绝对路径
 * @param meta - 元信息（changeName 必填，其余可选）
 * @returns 写入后的完整 ManifestSchema
 */
export function writeManifestJson(changeDir: string, meta: ManifestMeta): ManifestSchema {
    const now = new Date().toISOString();
    const manifest: ManifestSchema = {
        $schema: 'venus/manifest/v1',
        changeName: meta.changeName,
        createdAt: now,
        updatedAt: now,
        capabilities: meta.capabilities ?? [],
        impactAreas: meta.impactAreas ?? [],
        phase: meta.phase ?? 'proposal',
    };

    const validation = validateSidecar('manifest', manifest);
    if (!validation.valid) {
        throw new Error(`manifest.json 校验失败: ${validation.errors.join('; ')}`);
    }

    const sidecarDir = ensureSidecarDir(changeDir);
    writeJsonFile(path.join(sidecarDir, 'manifest.json'), manifest);
    return manifest;
}

/**
 * 写入 tasks.json。写入前做 schema 校验，失败时报错引导 AI 修正。
 *
 * @param changeDir - 变更目录绝对路径
 * @param tasks - 待写入的 TasksSchema
 * @returns 写入后的完整 TasksSchema
 */
export function writeTasksJson(changeDir: string, tasks: TasksSchema): TasksSchema {
    const validation = validateSidecar('tasks', tasks);
    if (!validation.valid) {
        throw new Error(`tasks.json 校验失败: ${validation.errors.join('; ')}`);
    }

    // 自动修正 progress 统计（防止 AI 忘记更新）
    const complete = tasks.tasks.filter((t) => t.status === 'done').length;
    tasks.progress = {
        total: tasks.tasks.length,
        complete,
        remaining: tasks.tasks.length - complete,
    };

    writeJsonFile(path.join(changeDir, 'tasks.json'), tasks);
    return tasks;
}

/**
 * 写入 decisions.json。写入前做 schema 校验。
 */
export function writeDecisionsJson(changeDir: string, decisions: DecisionsSchema): DecisionsSchema {
    const validation = validateSidecar('decisions', decisions);
    if (!validation.valid) {
        throw new Error(`decisions.json 校验失败: ${validation.errors.join('; ')}`);
    }

    const sidecarDir = ensureSidecarDir(changeDir);
    writeJsonFile(path.join(sidecarDir, 'decisions.json'), decisions);
    return decisions;
}

/**
 * 写入 capabilities.json。写入前做 schema 校验。
 */
export function writeCapabilitiesJson(
    changeDir: string,
    capabilities: CapabilitiesSchema,
): CapabilitiesSchema {
    const validation = validateSidecar('capabilities', capabilities);
    if (!validation.valid) {
        throw new Error(`capabilities.json 校验失败: ${validation.errors.join('; ')}`);
    }

    const sidecarDir = ensureSidecarDir(changeDir);
    writeJsonFile(path.join(sidecarDir, 'capabilities.json'), capabilities);
    return capabilities;
}

// ── change.json 读写（合并主产物） ────────────────────────────────

/**
 * 读取 <changeDir>/change.json。
 *
 * 容错语义：文件缺失时返回 null；JSON 解析失败时尝试从 .bak 备份恢复，
 * 恢复失败才返回 null（由调用方走降级链，不在此处抛错）。
 *
 * @param changeDir - 变更目录绝对路径
 * @returns 解析后的 ChangeSchema；文件缺失且无备份时 null
 */
export function readChangeJson(changeDir: string): ChangeSchema | null {
    const filePath = path.join(changeDir, 'change.json');
    const bakPath = filePath + '.bak';

    // 主文件缺失：尝试从 .bak 恢复
    if (!fs.existsSync(filePath)) {
        if (fs.existsSync(bakPath)) {
            try {
                fs.copyFileSync(bakPath, filePath);
                const recovered: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (recovered !== null && typeof recovered === 'object') {
                    return recovered as ChangeSchema;
                }
            } catch {
                // 恢复失败，返回 null
            }
        }
        return null;
    }

    // 主文件存在：解析
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed === null || typeof parsed !== 'object') {
            return null;
        }
        return parsed as ChangeSchema;
    } catch {
        // 解析失败：尝试从 .bak 恢复
        if (fs.existsSync(bakPath)) {
            try {
                fs.copyFileSync(bakPath, filePath);
                const recovered: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (recovered !== null && typeof recovered === 'object') {
                    return recovered as ChangeSchema;
                }
            } catch {
                // 恢复失败，返回 null
            }
        }
        return null;
    }
}

/**
 * 写入 <changeDir>/change.json（合并主产物）。
 *
 * 写入前做 schema 校验（失败抛错，错误信息含字段路径），
 * 校验通过后自动刷新 data.updatedAt 为当前时间。
 *
 * @param changeDir - 变更目录绝对路径
 * @param data - 完整 ChangeSchema（proposal / design / specs 段可缺省）
 * @returns 写入后的 ChangeSchema（updatedAt 已刷新）
 * @throws Error - 校验失败时（错误信息含字段路径）
 */
export function writeChangeJson(changeDir: string, data: ChangeSchema): ChangeSchema {
    const validation = validateSidecar('change', data);
    if (!validation.valid) {
        throw new Error(`change.json 校验失败: ${validation.errors.join('; ')}`);
    }

    data.updatedAt = new Date().toISOString();

    writeJsonFile(path.join(changeDir, 'change.json'), data);
    return data;
}

// ── tasks.md 渲染 ─────────────────────────────────────────────────

/**
 * 从 TasksSchema 确定性渲染 tasks.md。
 *
 * 渲染规则：
 *   1. 按 batchGroup 分组，每组生成一个 `## N` 章节
 *   2. 每个 task: `- [x]/[ ] [label] id description`
 *   3. 子字段缩进渲染：nodeRef / specRef / dependencies / files
 *   4. description 原样保留（支持多行子列表）
 *   5. 文件末尾渲染 progress 统计
 *
 * @param tasks - TasksSchema 数据
 * @param changeName - 变更名（用于 tasks.md 标题）
 * @returns 渲染后的 Markdown 字符串
 */
export function renderTasksMd(tasks: TasksSchema, changeName: string): string {
    const lines: string[] = [];
    lines.push(`# Tasks: ${changeName}`);
    lines.push('');

    // 按 batchGroup 分组
    const groups = new Map<string, TaskEntry[]>();
    const noGroup: TaskEntry[] = [];

    for (const task of tasks.tasks) {
        if (task.batchGroup) {
            const group = groups.get(task.batchGroup);
            if (group) {
                group.push(task);
            } else {
                groups.set(task.batchGroup, [task]);
            }
        } else {
            noGroup.push(task);
        }
    }

    // 渲染有分组的任务
    for (const [groupName, groupTasks] of groups) {
        // 保留原始 batchGroup 大标题（如 "1. 代码级 JSON sidecar 写入器"）
        lines.push(`## ${groupName}`);
        lines.push('');
        for (const task of groupTasks) {
            renderTaskEntry(task, lines);
        }
    }

    // 渲染无分组的任务
    if (noGroup.length > 0) {
        lines.push('## 其他任务');
        lines.push('');
        for (const task of noGroup) {
            renderTaskEntry(task, lines);
        }
    }

    // progress 统计 — 从各 task.status 实际计算（防止 AI 忘记更新 progress 字段）
    const complete = tasks.tasks.filter((t) => t.status === 'done').length;
    const total = tasks.tasks.length;
    const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
    lines.push(`> 进度: ${complete}/${total} (${pct}%)`);

    return lines.join('\n') + '\n';
}

/**
 * 渲染单个任务条目到 lines 数组。
 */
function renderTaskEntry(task: TaskEntry, lines: string[]): void {
    const checkbox = task.status === 'done' ? 'x' : ' ';
    const labels = [task.label];
    if (task.subLabel) {
        labels.push(task.subLabel);
    }
    if (task.priority) {
        labels.push(task.priority);
    }
    // 容忍带方括号的存量写法（如 "[代码]"）：先剥离再统一包裹，避免渲染出 "[[代码]]"
    const labelStr = labels.map((l) => `[${l.replace(/^\[+|\]+$/g, '').trim()}]`).join('');
    const nodeStr = task.nodeRef ? ` [${task.nodeRef}]` : '';

    // description 首行作为标题行，多行时其余行在下方缩进渲染
    const descLines = task.description.split('\n');
    const firstDescLine = descLines[0].trim();
    lines.push(`- [${checkbox}] ${labelStr} ${task.id} ${firstDescLine}${nodeStr}`);

    // description 多行子列表（从第二行开始）
    for (let i = 1; i < descLines.length; i++) {
        const trimmed = descLines[i].trim();
        if (trimmed) {
            lines.push(`  ${trimmed}`);
        }
    }

    // 子字段
    if (task.dependencies.length > 0) {
        lines.push(`  - 依赖: ${task.dependencies.join(', ')}`);
    }
    if (task.specRef) {
        lines.push(`  - 对应: ${task.specRef}`);
    }
    if (task.files.length > 0) {
        lines.push(`  - 产出文件: ${task.files.map((f) => `\`${f}\``).join(', ')}`);
    }

    lines.push('');
}

// ── change.json 段落渲染（纯函数，确定性） ───────────────────────

/**
 * 从 ProposalSection 确定性渲染 proposal.md。
 *
 * 渲染规则：Why / What Changes（列表）/ Capabilities（New + Modified）/ Impact（文件列表 + 向后兼容）。
 * 纯函数：相同输入产出相同输出（无时间戳注入）。
 *
 * @param proposal - change.json 的 proposal 段
 * @param changeName - 变更名（用于标题）
 * @returns 渲染后的 Markdown 字符串
 */
export function renderProposalMd(proposal: ProposalSection, changeName: string): string {
    const lines: string[] = [];
    lines.push(`# Proposal: ${changeName}`);
    lines.push('');
    lines.push('## Why');
    lines.push('');
    lines.push(proposal.why);
    lines.push('');
    lines.push('## What Changes');
    lines.push('');
    for (const item of proposal.whatChanges) {
        lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push('## Capabilities');
    lines.push('');
    lines.push('### New Capabilities');
    lines.push('');
    for (const capability of proposal.capabilities.new) {
        lines.push(`- \`${capability.name}\`: ${capability.description}`);
    }
    lines.push('');
    lines.push('### Modified Capabilities');
    lines.push('');
    for (const capability of proposal.capabilities.modified) {
        lines.push(`- \`${capability.name}\`: ${capability.description}`);
    }
    lines.push('');
    lines.push('## Impact');
    lines.push('');
    lines.push('### 直接影响的文件');
    lines.push('');
    for (const file of proposal.impact.files) {
        lines.push(`- \`${file.path}\`: ${file.description}`);
    }
    lines.push('');
    lines.push('### 向后兼容');
    lines.push('');
    if (proposal.impact.breaking) {
        lines.push('**BREAKING** —— 含破坏性变更。');
        lines.push('');
    }
    lines.push(proposal.impact.compatibility);

    return lines.join('\n') + '\n';
}

/**
 * 从 DesignSection 确定性渲染 design.md。
 *
 * 渲染规则：Context / Goals-NonGoals（两列表）/ Decisions（选择/理由/备选）/ Risks（表格）。
 * 纯函数：相同输入产出相同输出（无时间戳注入）。
 *
 * @param design - change.json 的 design 段
 * @param changeName - 变更名（用于标题）
 * @returns 渲染后的 Markdown 字符串
 */
export function renderDesignMd(design: DesignSection, changeName: string): string {
    const lines: string[] = [];
    lines.push(`# Design: ${changeName}`);
    lines.push('');
    lines.push('## Context');
    lines.push('');
    lines.push(design.context);
    lines.push('');
    lines.push('## Goals / Non-Goals');
    lines.push('');
    lines.push('**Goals**:');
    for (const goal of design.goals) {
        lines.push(`- ${goal}`);
    }
    lines.push('');
    lines.push('**Non-Goals**:');
    for (const nonGoal of design.nonGoals) {
        lines.push(`- ${nonGoal}`);
    }
    lines.push('');
    lines.push('## Decisions');
    lines.push('');
    for (const decision of design.decisions) {
        lines.push(`### ${decision.id}: ${decision.title}`);
        lines.push(`- **选择**: ${decision.choice}`);
        lines.push(`- **理由**: ${decision.rationale}`);
        lines.push(`- **备选**: ${decision.alternatives.join('；')}`);
        lines.push('');
    }
    lines.push('## Risks / Trade-offs');
    lines.push('');
    lines.push('| 风险 | 缓解 |');
    lines.push('|------|------|');
    for (const risk of design.risks) {
        lines.push(`| ${risk.risk} | ${risk.mitigation} |`);
    }

    return lines.join('\n') + '\n';
}

/**
 * 从 SpecsSection 确定性渲染各 spec 文件内容（每个 SpecEntry 一组 { path, content }）。
 *
 * 渲染规则：
 *   1. content 按 operation.type 分组渲染 `## <TYPE> Requirements` 章节，顺序 ADDED / MODIFIED / REMOVED / RENAMED
 *   2. 空分组不渲染
 *   3. 每条操作渲染 `### Requirement: <requirement>` + description + scenarios
 *   4. ADDED/MODIFIED 渲染 scenarios（given 非空时在 WHEN 前渲染 `- **GIVEN**`）
 *   5. REMOVED 渲染 `- **Reason**:` / `- **Migration**:`；RENAMED 渲染 `- FROM:` / `- TO:`
 * 纯函数：相同输入产出相同输出（无时间戳注入）。
 *
 * @param specs - change.json 的 specs 段
 * @param changeName - 变更名（保留参数：spec 文件正文不引用变更名，仅为与其他 render 函数接口一致）
 * @returns 每个 SpecEntry 一项：{ path（如 specs/<name>/spec.md）, content（Markdown 文本）}
 */
export function renderSpecsMd(specs: SpecsSection, changeName: string): Array<{ path: string; content: string }> {
    // changeName 保留以保证三个 render 函数接口一致；spec 文件正文不引用变更名
    void changeName;

    const files: Array<{ path: string; content: string }> = [];
    for (const spec of specs) {
        const lines: string[] = [];
        for (const type of OPERATION_RENDER_ORDER) {
            const operations = spec.operations.filter((op) => op.type === type);
            if (operations.length === 0) {
                continue;
            }
            lines.push(`## ${type} Requirements`);
            lines.push('');
            for (const op of operations) {
                lines.push(`### Requirement: ${op.requirement}`);
                if (op.description) {
                    lines.push(op.description);
                }
                if (type === 'ADDED' || type === 'MODIFIED') {
                    for (const scenario of op.scenarios ?? []) {
                        lines.push('');
                        lines.push(`#### Scenario: ${scenario.name}`);
                        if (scenario.given) {
                            lines.push(`- **GIVEN** ${scenario.given}`);
                        }
                        lines.push(`- **WHEN** ${scenario.when}`);
                        lines.push(`- **THEN** ${scenario.then}`);
                    }
                }
                if (type === 'REMOVED') {
                    lines.push(`- **Reason**: ${op.reason}`);
                    lines.push(`- **Migration**: ${op.migration}`);
                }
                if (type === 'RENAMED') {
                    lines.push(`- FROM: ${op.from}`);
                    lines.push(`- TO: ${op.to}`);
                }
                lines.push('');
            }
        }
        // 去掉末尾多余空行，保持单换行结尾
        while (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        files.push({ path: spec.path, content: lines.join('\n') + '\n' });
    }
    return files;
}

// ── 工厂函数（供模板通过 Bash 调用） ──────────────────────────────

/**
 * 创建空的 tasks.json 骨架并写入文件。
 * 供 spec-propose 模板在 AI 开始填写 task 条目之前调用（确保文件存在 + schema 正确）。
 */
export function initTasksJson(changeDir: string): TasksSchema {
    const empty = createEmptyTasks();
    writeJsonFile(path.join(changeDir, 'tasks.json'), empty);
    return empty;
}

/**
 * 创建空的 decisions.json 骨架并写入文件。
 */
export function initDecisionsJson(changeDir: string): DecisionsSchema {
    const empty = createEmptyDecisions();
    const sidecarDir = ensureSidecarDir(changeDir);
    writeJsonFile(path.join(sidecarDir, 'decisions.json'), empty);
    return empty;
}

/**
 * 创建空的 capabilities.json 骨架并写入文件。
 */
export function initCapabilitiesJson(changeDir: string): CapabilitiesSchema {
    const empty = createEmptyCapabilities();
    const sidecarDir = ensureSidecarDir(changeDir);
    writeJsonFile(path.join(sidecarDir, 'capabilities.json'), empty);
    return empty;
}

/**
 * 创建空的 change.json 骨架并写入文件（幂等）。
 *
 * 文件已存在时读取现有文件原样返回，不覆盖（保护已写入的段落）。
 * 写入失败时重新尝试读取（处理并发竞争场景，另一进程可能已写入）。
 *
 * @param changeDir - 变更目录绝对路径
 * @param changeName - 变更名（骨架根字段）
 * @returns 新建骨架或既有 ChangeSchema
 */
export function initChangeJson(changeDir: string, changeName: string): ChangeSchema {
    const existing = readChangeJson(changeDir);
    if (existing) {
        return existing;
    }

    const empty = createEmptyChange(changeName);
    const filePath = path.join(changeDir, 'change.json');

    try {
        writeJsonFile(filePath, empty);
    } catch (error: unknown) {
        // 写入失败：可能因并发竞争，尝试读取已有文件
        const retry = readChangeJson(changeDir);
        if (retry) {
            return retry;
        }
        throw error;
    }

    return empty;
}
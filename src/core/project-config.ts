/**
 * 项目级配置文件（venus.config.yaml）。
 *
 * 类似 openspec/config.yaml 的 context / rules 结构：
 *   context: 项目背景（技术栈、约定、约束）—— 写入技能生成时的引导
 *   rules:   按类型分组的约束 —— 生成骨架与校验时的项目规则
 *
 * 采用极简 YAML 解析（键: 值 + 两空格缩进列表），不引入 YAML 依赖。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SKILL_TYPE_IDS, isSkillType, type SkillType } from './config.js';

/** 配置文件名（项目根下） */
export const CONFIG_FILE_NAME = 'venus.config.yaml';

/** 项目配置结构 */
export interface ProjectConfig {
    /** 项目背景（多行文本） */
    context: string;
    /** 按技能类型分组的项目规则 */
    rules: Partial<Record<SkillType, string[]>>;
}

/** 默认配置（init 时写入的模板） */
export function defaultProjectConfig(): ProjectConfig {
    return {
        context: [
            '项目背景（供技能参考的技术栈与约定）：',
            '- 技术栈：待补充（如 TypeScript + Node.js 20+ / JDK 17 + Spring Boot 3）',
            '- 包管理器：待补充（如 pnpm / maven）',
            '- 分层约定：待补充（如 Controller → Service → DAO）',
        ].join('\n'),
        rules: {
            tr_impl: [
                '遵循项目分层架构，禁止跨层调用',
                '（待补充）实现类需补充 JavaDoc/方法注释',
            ],
            tr_test: [
                '（待补充）测试框架与既有用例保持一致',
            ],
        },
    };
}

/** 读取项目配置（不存在返回 null，解析失败抛错） */
export function readProjectConfig(projectRoot: string): ProjectConfig | null {
    const configPath = path.join(projectRoot, CONFIG_FILE_NAME);
    if (!fs.existsSync(configPath)) {
        return null;
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    return parseProjectConfig(raw);
}

/**
 * 极简 YAML 解析：只支持本配置文件使用的子集。
 *   context: | 后跟缩进块（多行文本）
 *   rules: 下挂 <type>: 与 "- " 列表项
 * 不匹配的行忽略（容忍注释与未知键）。
 */
export function parseProjectConfig(raw: string): ProjectConfig {
    const lines = raw.split(/\r?\n/);
    const config: ProjectConfig = { context: '', rules: {} };

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
        // rules 下的类型组
        const typeMatch = line.match(/^  (tr_[a-z]+):/);
        if (typeMatch && isSkillType(typeMatch[1])) {
            const type = typeMatch[1] as SkillType;
            const items: string[] = [];
            i++;
            while (i < lines.length && /^\s+-\s/.test(lines[i])) {
                items.push(lines[i].replace(/^\s+-\s/, '').trim());
                i++;
            }
            config.rules[type] = items;
            continue;
        }
        i++;
    }
    return config;
}

/** 序列化为 YAML（固定模板格式，保证 round-trip 稳定） */
export function serializeProjectConfig(config: ProjectConfig): string {
    const lines: string[] = ['# VenusAgentTools 项目配置', '# 修改后对后续 venus generate / 技能引导生效', ''];
    lines.push('context: |');
    for (const line of config.context.split('\n')) {
        lines.push(`  ${line}`);
    }
    lines.push('');
    lines.push('rules:');
    let hasRule = false;
    for (const typeId of SKILL_TYPE_IDS) {
        const rules = config.rules[typeId as SkillType];
        if (!rules || rules.length === 0) {
            continue;
        }
        hasRule = true;
        lines.push(`  ${typeId}:`);
        for (const rule of rules) {
            lines.push(`    - ${rule}`);
        }
    }
    if (!hasRule) {
        lines.push('  # （按类型补充规则，如 tr_impl:）');
        lines.push('  #   - 遵循项目分层架构');
    }
    lines.push('');
    return lines.join('\n');
}

/** init 时写入配置模板（已存在则跳过） */
export function ensureProjectConfig(projectRoot: string): 'created' | 'exists' {
    const configPath = path.join(projectRoot, CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
        return 'exists';
    }
    fs.writeFileSync(configPath, serializeProjectConfig(defaultProjectConfig()), 'utf8');
    return 'created';
}

/**
 * iagent rules 命令：枚举项目规则源（读取完整性检查的确定性来源）。
 *
 * 枚举集合（MUST NOT 含 `openspec/rules/**`，该目录是初始化期的蒸馏源）：
 *   - `.iagent/config.yaml`（context + rules 列表）
 *   - `.iagent/rules/*.md`
 *   - 项目根 `CLAUDE.md` / `AGENTS.md`
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { Command } from 'commander';
import {
    CONFIG_FILE_NAME,
    RULES_DIR_NAME,
} from '../core/project-config.js';

export type RuleSourceKind = 'config' | 'rule-file' | 'claude-md' | 'agents-md';

export interface RuleSource {
    /** 项目相对路径（正斜杠） */
    path: string;
    kind: RuleSourceKind;
    exists: boolean;
    bytes: number;
    /** sha256 前 12 位；不存在时为 null */
    sha256: string | null;
    lines: number;
    /** 仅 config 源：配置中声明的 rules 列表 */
    rules?: string[];
}

export interface RulesOutput {
    sources: RuleSource[];
}

/** 枚举项目规则源（纯只读）。 */
export function collectRuleSources(projectRoot: string): RulesOutput {
    const sources: RuleSource[] = [];
    const configRel = toPosix(CONFIG_FILE_NAME);
    const configAbs = path.join(projectRoot, CONFIG_FILE_NAME);
    sources.push(describeSource(configAbs, configRel, 'config'));
    const configSource = sources[0];
    if (configSource !== undefined) {
        const declared = readDeclaredRules(configAbs);
        if (declared.length > 0) {
            configSource.rules = declared;
        }
    }

    const rulesDir = path.join(projectRoot, RULES_DIR_NAME);
    if (fs.existsSync(rulesDir)) {
        const files = fs.readdirSync(rulesDir)
            .filter((name) => name.endsWith('.md'))
            .sort();
        for (const file of files) {
            sources.push(describeSource(
                path.join(rulesDir, file),
                toPosix(path.join(RULES_DIR_NAME, file)),
                'rule-file',
            ));
        }
    }

    sources.push(describeSource(path.join(projectRoot, 'CLAUDE.md'), 'CLAUDE.md', 'claude-md'));
    sources.push(describeSource(path.join(projectRoot, 'AGENTS.md'), 'AGENTS.md', 'agents-md'));
    return { sources };
}

function describeSource(
    absolutePath: string,
    relativePath: string,
    kind: RuleSourceKind,
): RuleSource {
    const exists = fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
    if (!exists) {
        return {
            path: relativePath,
            kind,
            exists: false,
            bytes: 0,
            sha256: null,
            lines: 0,
        };
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    return {
        path: relativePath,
        kind,
        exists: true,
        bytes: Buffer.byteLength(content, 'utf8'),
        sha256: createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 12),
        lines: content.split('\n').length,
    };
}

/** 读取 config.yaml 的 `rules:` 列表（逐行解析，不做 YAML 重序列化）。 */
function readDeclaredRules(configPath: string): string[] {
    if (!fs.existsSync(configPath)) return [];
    const lines = fs.readFileSync(configPath, 'utf8').split('\n');
    const result: string[] = [];
    let inRules = false;
    for (const raw of lines) {
        const line = raw.trimEnd();
        if (/^rules:\s*$/.test(line)) {
            inRules = true;
            continue;
        }
        if (inRules) {
            const match = /^\s*-\s*(\S+)\s*$/.exec(line);
            if (match !== null) {
                result.push(match[1]);
                continue;
            }
            if (line.trim().length > 0 && !line.startsWith('#')) {
                inRules = false;
            }
        }
    }
    return result;
}

function toPosix(value: string): string {
    return value.replaceAll('\\', '/');
}

/** 渲染人类可读文本。 */
export function renderRulesText(output: RulesOutput): string {
    const lines = ['项目规则源：'];
    for (const source of output.sources) {
        if (!source.exists) {
            lines.push(`  - ${source.path}（不存在）`);
            continue;
        }
        const rules = source.rules !== undefined && source.rules.length > 0
            ? `；rules: ${source.rules.join(', ')}`
            : '';
        lines.push(`  - ${source.path}（${source.bytes} 字节 / ${source.lines} 行 / sha256:${source.sha256}${rules}）`);
    }
    return lines.join('\n');
}

/** 构造 rules 子命令。 */
export function buildRulesCommand(): Command {
    return new Command('rules')
        .description('枚举项目规则源（.iagent/config.yaml、.iagent/rules/*.md、CLAUDE.md、AGENTS.md）')
        .option('--json', '以 JSON 输出（供程序处理）')
        .action((options: { json?: boolean }) => {
            const output = collectRuleSources(process.cwd());
            console.log(options.json === true ? JSON.stringify(output, null, 2) : renderRulesText(output));
        });
}

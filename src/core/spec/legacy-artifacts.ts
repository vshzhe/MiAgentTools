import * as fs from 'node:fs';
import * as path from 'node:path';

export type LegacySection = 'proposal' | 'design' | 'specs';

export interface LegacyReadResult {
    exists: boolean;
    sourcePath?: string;
    warning?: string;
}

/**
 * 历史 JSON 只读读取边界。
 * Markdown 主链路不调用此模块；只有对应 Markdown 缺失时才允许降级。
 */
export function readLegacySection(changeRoot: string, section: LegacySection): LegacyReadResult {
    const candidates = [
        path.join(changeRoot, 'change.json'),
        path.join(changeRoot, '.iagent', 'change.json'),
    ];
    for (const filePath of candidates) {
        if (!fs.existsSync(filePath)) continue;
        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
            const exists = section === 'specs'
                ? Array.isArray(parsed.specs) && parsed.specs.length > 0
                : parsed[section] !== undefined;
            if (exists) {
                return {
                    exists: true,
                    sourcePath: filePath,
                    warning: `缺少 Markdown ${section}，降级只读历史 JSON：${filePath}`,
                };
            }
        } catch {
            return {
                exists: true,
                sourcePath: filePath,
                warning: `历史 JSON 无法解析，未将其作为 ${section} 真源：${filePath}`,
            };
        }
    }

    const sidecarCandidates: Record<LegacySection, string[]> = {
        proposal: [path.join(changeRoot, '.iagent', 'manifest.json')],
        design: [path.join(changeRoot, '.iagent', 'decisions.json')],
        specs: [path.join(changeRoot, '.iagent', 'capabilities.json')],
    };
    for (const filePath of sidecarCandidates[section]) {
        if (fs.existsSync(filePath)) {
            return {
                exists: true,
                sourcePath: filePath,
                warning: `缺少 Markdown ${section}，降级只读旧 sidecar：${filePath}`,
            };
        }
    }
    return { exists: false };
}

export function readLegacyTasks(changeRoot: string): LegacyReadResult {
    const candidates = [path.join(changeRoot, 'tasks.json'), path.join(changeRoot, '.iagent', 'tasks.json')];
    for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
            return {
                exists: true,
                sourcePath: filePath,
                warning: `缺少 tasks.md，降级只读历史 JSON：${filePath}`,
            };
        }
    }
    return { exists: false };
}

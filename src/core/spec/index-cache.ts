import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** 归档索引缓存的内容指纹；它不是 OpenSpec artifact。 */
export function hashIndexSource(changeDir: string): string {
    const hash = crypto.createHash('sha256');
    const files: string[] = [];
    const visit = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue;
            const filePath = path.join(dir, entry.name);
            if (entry.isDirectory()) visit(filePath);
            else if (entry.isFile() && /\.(md|json|yaml|yml)$/i.test(entry.name)) files.push(filePath);
        }
    };
    visit(changeDir);
    files.sort().forEach((filePath) => {
        const relative = path.relative(changeDir, filePath).replaceAll('\\', '/');
        hash.update(relative);
        hash.update(fs.readFileSync(filePath));
    });
    return hash.digest('hex');
}

export function readIndexManifest(filePath: string): Record<string, string> {
    if (!fs.existsSync(filePath)) return {};
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
        return parsed !== null && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function writeIndexManifest(filePath: string, manifest: Record<string, string>): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

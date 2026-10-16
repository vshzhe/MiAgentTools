#!/usr/bin/env node

/**
 * 构建脚本：清理 dist 目录并执行 TypeScript 编译。
 * 与 OpenSpec 的 build.js 保持一致的简洁模式。
 */

import { execFileSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const runTsc = (args = []) => {
    const tscPath = require.resolve('typescript/bin/tsc');
    execFileSync(process.execPath, [tscPath, ...args], { stdio: 'inherit' });
};

console.log('🔨 Building MiAgentTools...\n');

if (existsSync('dist')) {
    console.log('Cleaning dist directory...');
    rmSync('dist', { recursive: true, force: true });
}

console.log('Compiling TypeScript...');
try {
    runTsc(['--version']);
    runTsc();
    console.log('\n✅ Build completed successfully!');
} catch (error) {
    console.error('\n❌ Build failed!');
    process.exit(1);
}

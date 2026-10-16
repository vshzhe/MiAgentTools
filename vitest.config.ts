import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        environment: 'node',
        // 用户主目录沙箱化：init/update 的旧装机迁移会读写主目录下的旧版补全产物，
        // 测试不得触碰开发者本机的真实主目录
        setupFiles: ['./test/setup-home-sandbox.ts'],
        // 默认 5s 对 shell 调用外部 CLI 的用例（如 spec-commands 的 iagent↔openspec
        // 互认校验，单跑约 3.9s）余量不足，全量并发下会间歇性超时失败
        testTimeout: 20000,
    },
});

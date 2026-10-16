/**
 * 测试全局沙箱：把用户主目录指向临时目录。
 *
 * iagent init / update 内置旧装机迁移，会读取并按需清理用户主目录下的旧版补全产物
 * 与 rc/profile 标记块。若沿用真实主目录，`pnpm test` 会在开发者本机上删除
 * `~/.venus-completion.sh` 一类文件——测试 MUST NOT 产生这种副作用。
 *
 * 本文件在用例开始前把 HOME / USERPROFILE 换到临时目录（node:os 的 homedir() 优先读
 * 这两个环境变量），并在进程退出时清理。需要指定主目录的用例仍可显式注入
 * homeDir（迁移接口）或 env（CLI 子进程）。
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-test-home-'));
process.env.HOME = sandboxHome;
process.env.USERPROFILE = sandboxHome;

process.on('exit', () => {
    fs.rmSync(sandboxHome, { recursive: true, force: true });
});

---
name: "Venus: 打包校验"
description: 打包校验 —— 预检→打包监控→一致性校验→升级信息归集四阶段
allowed-tools: Bash(venus:*)
category: Venus / 版本
tags: [venus, tr_release, package, auto-package, svn, verify, upgrade-doc]
---

打包校验 —— 打包前预检 → 打包执行监控 → 打包后一致性校验 → 升级信息归集四阶段，每步确认后执行。

**输入**：`/venus:release-package` 后可跟项目名/版本号，或自然语言描述打包需求。

## 执行步骤

1. **阶段一预检**：`bash <技能目录>/scripts/pre-package-check.sh` 校验参数/路径/配置/工具链/版本号≤HEAD，FAIL 不打包。
2. **阶段二打包监控**：读 `.venus/config.yaml` 的 `auto_package.runtime_dir`（默认 `vendor/auto-package-svn`）→ `bash <runtime_dir>/auto-package.sh -v` 监控输出，失败暂停。
3. **阶段三一致性校验**：`bash <技能目录>/scripts/verify-package.sh --strict` 以 SVN 变更清单核对产出，FAIL 不进阶段四。
4. **阶段四升级信息归集**：读产出 `readme.txt` 反查 OpenSpec 提案 → 归集 SQL 四源 + 配置三源 → 输出 `升级文档.md` 到产出目录。反查失败静默降级。

## 必需参数（4 个，缺一不可）

项目名 `-n` / 版本号 `-r`（绝不猜测）/ 项目路径 `-l`（默认 `E:\WorkSpaces_ahdx\<项目名>` 推断确认）/ 输出目录 `-o`（默认 `E:/ProjectPackage` 并告知）。

## 约束

- 版本号绝不自行猜测，缺失追问
- 阶段二/三失败立即暂停，不继续
- 阶段四不阻断：提案反查失败仍输出升级文档（标注降级）
- 打包脚本本体在项目内 `vendor/auto-package-svn/`，路径可配置；校验脚本在技能 `scripts/` 下

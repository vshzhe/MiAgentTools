#!/bin/bash
# ============================================================
# pre-package-check.sh - 打包前预检
# 在调用 auto-package.sh 之前，对参数、项目结构、构建配置、
# 工具链环境做静态校验，提前拦截会导致打包失败的问题。
#
# 退出码约定：
#   0 = 全部通过，可进入打包
#   1 = 存在错误（参数缺失/路径不存在/配置不一致/工具缺失）
#   2 = 脚本自身使用错误（参数不合法）
#
# 用法：
#   bash pre-package-check.sh \
#     -n <项目名> -r <版本号列表> -l <本地项目路径> -o <输出目录> \
#     [-s <svn-url>] [-j <java-home>] [-a <ant-home>] [--cmd auto-pack|pack]
# ============================================================
set -uo pipefail

# ---------- 颜色输出 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_CNT=0
WARN_CNT=0
FAIL_CNT=0

# 说明：用 printf '%s' 输出消息体，避免路径中的反斜杠被 echo -e 当作转义符
# （如 \a 被解释为响铃、\t 被解释为制表符，导致路径显示错乱）
ok()   { printf '%b[PASS]%b %s\n' "${GREEN}" "${NC}" "$*"; PASS_CNT=$((PASS_CNT+1)); }
warn() { printf '%b[WARN]%b %s\n' "${YELLOW}" "${NC}" "$*"; WARN_CNT=$((WARN_CNT+1)); }
fail() { printf '%b[FAIL]%b %s\n' "${RED}" "${NC}" "$*"; FAIL_CNT=$((FAIL_CNT+1)); }
info() { printf '%b[INFO]%b %s\n' "${BLUE}" "${NC}" "$*"; }

# ---------- 路径转换（与 auto-package.sh 保持一致）----------
to_posix_path() {
    local path="$1"
    if [[ "$path" == /* ]]; then
        echo "$path"; return
    fi
    echo "$path" | sed 's|^\([A-Za-z]\):\\|/\L\1/|g; s|^\([A-Za-z]\):/|/\L\1/|g; s|\\|/|g'
}

# ---------- 参数默认值 ----------
PROJECT_NAME=""
REVISIONS=""
PROJECT_PATH=""
OUTPUT_DIR=""
SVN_URL=""
JAVA_HOME_OPT=""
ANT_HOME_OPT=""
CMD="auto-pack"

# ---------- 参数解析 ----------
while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--name)        PROJECT_NAME="$2"; shift 2 ;;
        -r|--revisions)   REVISIONS="$2"; shift 2 ;;
        -l|--local-path)  PROJECT_PATH="$(to_posix_path "$2")"; shift 2 ;;
        -o|--output)      OUTPUT_DIR="$(to_posix_path "$2")"; shift 2 ;;
        -s|--svn-url)     SVN_URL="$2"; shift 2 ;;
        -j|--java-home)   JAVA_HOME_OPT="$(to_posix_path "$2")"; shift 2 ;;
        -a|--ant-home)    ANT_HOME_OPT="$(to_posix_path "$2")"; shift 2 ;;
        --cmd)            CMD="$2"; shift 2 ;;
        -h|--help)
            cat << EOF
用法: bash pre-package-check.sh [options]
必填: -n 项目名 -r 版本号 -l 项目路径 -o 输出目录
可选: -s svn-url(pack模式) -j java-home -a ant-home --cmd auto-pack|pack
EOF
            exit 2
            ;;
        *) fail "未知参数: $1"; exit 2 ;;
    esac
done

echo "========================================"
echo "  打包前预检报告"
echo "========================================"
info "命令模式: ${CMD}"
info "项目名称: ${PROJECT_NAME:-<未提供>}"
info "版本号:   ${REVISIONS:-<未提供>}"
info "项目路径: ${PROJECT_PATH:-<未提供>}"
info "输出目录: ${OUTPUT_DIR:-<未提供>}"
if [[ -n "${SVN_URL}" ]]; then info "SVN地址:  ${SVN_URL}"; fi
echo "----------------------------------------"

# ============================================================
# 1. 必填参数齐全性校验
# ============================================================
info "【1/5】校验必填参数"
PARAM_FAIL=0
[[ -z "${PROJECT_NAME}" ]] && { fail "缺少 -n/--name (项目名称)"; PARAM_FAIL=1; }
[[ -z "${PROJECT_PATH}" ]] && { fail "缺少 -l/--local-path (项目路径)"; PARAM_FAIL=1; }
[[ -z "${REVISIONS}" ]] && { fail "缺少 -r/--revisions (版本号)"; PARAM_FAIL=1; }
[[ -z "${OUTPUT_DIR}" ]] && { fail "缺少 -o/--output (输出目录)"; PARAM_FAIL=1; }
if [[ "${CMD}" == "pack" && -z "${SVN_URL}" ]]; then
    fail "pack 模式缺少 -s/--svn-url (SVN 仓库地址)"
    PARAM_FAIL=1
fi
if [[ ${PARAM_FAIL} -eq 0 ]]; then ok "必填参数齐全"; fi

# 版本号格式校验（应为逗号分隔的纯数字）
if [[ -n "${REVISIONS}" ]]; then
    if [[ ! "${REVISIONS}" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
        fail "版本号格式错误: '${REVISIONS}'，应为逗号分隔的数字（如 64561,64562）"
    else
        ok "版本号格式合法: ${REVISIONS}"
    fi
fi
echo "----------------------------------------"

# ============================================================
# 2. 项目路径存在性 + SVN 工作副本
# ============================================================
info "【2/5】校验项目路径与 SVN 工作副本"
if [[ -n "${PROJECT_PATH}" ]]; then
    if [[ ! -d "${PROJECT_PATH}" ]]; then
        fail "项目路径不存在: ${PROJECT_PATH}"
    else
        ok "项目路径存在: ${PROJECT_PATH}"
        # auto-pack 模式要求 .svn 目录
        if [[ "${CMD}" == "auto-pack" ]]; then
            if [[ ! -d "${PROJECT_PATH}/.svn" ]]; then
                fail "auto-pack 模式要求项目为 SVN 工作副本（缺少 .svn 目录）: ${PROJECT_PATH}"
            else
                ok "存在 .svn 目录（SVN 工作副本）"
            fi
        fi
    fi
fi

# 输出目录：若父目录不存在则告警（打包时会自动 mkdir，但父级不可写会失败）
if [[ -n "${OUTPUT_DIR}" ]]; then
    PARENT_DIR="$(dirname "${OUTPUT_DIR}")"
    if [[ ! -d "${PARENT_DIR}" ]]; then
        warn "输出目录的父目录不存在: ${PARENT_DIR}（auto-package.sh 会尝试创建，但需确认可写权限）"
    else
        ok "输出目录父级存在: ${PARENT_DIR}"
    fi
fi
echo "----------------------------------------"

# ============================================================
# 3. 项目类型识别 + build.xml 配置一致性
# ============================================================
info "【3/5】校验项目类型与 build.xml 配置一致性"
PROJECT_TYPE=""
if [[ -d "${PROJECT_PATH}" ]]; then
    if [[ -d "${PROJECT_PATH}/WebRoot" ]]; then
        PROJECT_TYPE="web"
        ok "识别为 Web 项目（存在 WebRoot/）"
    elif [[ -d "${PROJECT_PATH}/bin" && -d "${PROJECT_PATH}/lib" ]]; then
        PROJECT_TYPE="server"
        ok "识别为 Server 项目（存在 bin/ + lib/）"
    else
        fail "无法识别项目类型：缺少 WebRoot/ 或 bin/+lib/ 目录（auto-package.sh 会判为 unknown）"
    fi
fi

# build.xml 配置一致性校验
BUILD_XML="${PROJECT_PATH}/build.xml"
if [[ -n "${PROJECT_TYPE}" && -f "${BUILD_XML}" ]]; then
    ok "存在 build.xml: ${BUILD_XML}"

    # 读取 project name 属性（提取 name="..." 内容）
    # 用 ERE（-E）而非 PCRE（-P），兼容性更好；[[:space:]]\+ 匹配一个或多个空白
    XML_PROJECT_NAME=$(grep -oE '<project[[:space:]]+name="[^"]*"' "${BUILD_XML}" | head -1 | sed 's/.*name="//;s/"$//')
    if [[ -n "${XML_PROJECT_NAME}" ]]; then
        info "  build.xml project name: \"${XML_PROJECT_NAME}\""
    fi

    if [[ "${PROJECT_TYPE}" == "web" ]]; then
        # Web 项目 build.xml 应引用 WebRoot
        if grep -q 'WebRoot' "${BUILD_XML}"; then
            ok "build.xml 引用了 WebRoot（与项目结构一致）"
        else
            warn "build.xml 未引用 WebRoot，可能与 Web 项目结构不匹配"
        fi
        # Web 项目常见 target：war/zip/tar/update
        HAS_BUILD_TARGET=0
        for tgt in war zip tar update; do
            if grep -q "name=\"${tgt}\"" "${BUILD_XML}"; then HAS_BUILD_TARGET=1; break; fi
        done
        if [[ ${HAS_BUILD_TARGET} -eq 1 ]]; then
            ok "build.xml 含 Web 项目常见 target（war/zip/tar/update）"
        else
            warn "build.xml 未发现 war/zip/tar/update target，可能为自定义结构"
        fi
        # build.increment.xml 占位符校验（仅 Venus4A 系列使用模板）
        INCREMENT_XML="${PROJECT_PATH}/build.increment.xml"
        if [[ -f "${INCREMENT_XML}" ]]; then
            info "  发现 build.increment.xml（增量构建模板）"
            if grep -q 'UPDATE-PART\|DELETE-PART' "${INCREMENT_XML}"; then
                warn "build.increment.xml 含 \${UPDATE-PART}/\${DELETE-PART} 占位符未填充 —— 直接 ant 执行会失败，需先用 svnpackage.jar 生成具体 build.<rev>.xml"
            else
                ok "build.increment.xml 占位符已填充"
            fi
        fi
    elif [[ "${PROJECT_TYPE}" == "server" ]]; then
        # Server 项目 build.xml 应含 bin/lib/run property
        local_miss=0
        for prop in bin lib run; do
            if grep -q "name=\"${prop}\"" "${BUILD_XML}"; then
                ok "build.xml 含 property: ${prop}"
            else
                warn "build.xml 缺少 property: ${prop}"
                local_miss=1
            fi
            # 校验对应物理目录存在
            if [[ ! -d "${PROJECT_PATH}/${prop}" ]]; then
                fail "项目缺少物理目录: ${prop}/（build.xml 引用但实际不存在）"
            fi
        done
        # Server 项目常见 target：copy/init/tar/zip
        HAS_BUILD_TARGET=0
        for tgt in copy init tar zip update; do
            if grep -q "name=\"${tgt}\"" "${BUILD_XML}"; then HAS_BUILD_TARGET=1; break; fi
        done
        if [[ ${HAS_BUILD_TARGET} -eq 1 ]]; then
            ok "build.xml 含 Server 项目常见 target（copy/init/tar/zip）"
        fi
    fi
elif [[ -n "${PROJECT_TYPE}" && ! -f "${BUILD_XML}" ]]; then
    warn "项目根目录无 build.xml（auto-package.sh 用 ECJ 直接增量编译，不依赖 Ant，可不阻塞，但全量打包/打 war 时会缺）"
fi
echo "----------------------------------------"

# ============================================================
# 4. 工具链环境校验（JDK / Ant / SVN）
# ============================================================
info "【4/5】校验工具链环境（JDK / Ant / SVN）"

# SVN（必须）
if command -v svn &>/dev/null; then
    SVN_VER=$(svn --version --quiet 2>/dev/null || echo "未知")
    ok "svn 可用: ${SVN_VER}"
else
    fail "svn 命令不可用 —— auto-package.sh 依赖系统 SVN 客户端（TortoiseSVN 命令行需加入 PATH）"
fi

# JDK（必须，auto-package.sh 用 ECJ 编译需 java；此处检查 javac 以确认完整 JDK 存在，字节码抽检需 javap）
JAVA_HOME_TO_USE="${JAVA_HOME_OPT:-${JAVA_HOME:-${DEFAULT_JAVA_HOME:-}}}"
if [[ -n "${JAVA_HOME_TO_USE}" ]]; then
    JAVAC_BIN="${JAVA_HOME_TO_USE}/bin/javac"
    [[ ! -f "${JAVAC_BIN}" ]] && JAVAC_BIN="${JAVA_HOME_TO_USE}/bin/javac.exe"
    if [[ -f "${JAVAC_BIN}" ]]; then
        JAVAC_VER=$("${JAVAC_BIN}" -version 2>&1 | head -1)
        ok "javac 可用: ${JAVAC_VER}（${JAVAC_BIN}）"
    else
        fail "JAVA_HOME 下找不到 javac: ${JAVA_HOME_TO_USE}/bin/javac"
    fi
else
    # 没有显式 JAVA_HOME，检查 PATH 中的 javac
    if command -v javac &>/dev/null; then
        ok "PATH 中 javac 可用: $(javac -version 2>&1 | head -1)"
    else
        fail "找不到 javac —— 需通过 -j/--java-home 或 auto-package.conf 的 DEFAULT_JAVA_HOME 指定 JDK 路径"
    fi
fi

# Ant（可选，仅 Ant 模式/build.increment.xml 路线需要）
ANT_HOME_TO_USE="${ANT_HOME_OPT:-${ANT_HOME:-${DEFAULT_ANT_HOME:-}}}"
if [[ -n "${ANT_HOME_TO_USE}" ]]; then
    ANT_BIN="${ANT_HOME_TO_USE}/bin/ant"
    [[ ! -f "${ANT_BIN}" ]] && ANT_BIN="${ANT_HOME_TO_USE}/bin/ant.bat"
    if [[ -f "${ANT_BIN}" ]] || command -v ant &>/dev/null; then
        ok "Ant 可用: ${ANT_HOME_TO_USE}"
    else
        warn "ANT_HOME 指定但找不到 ant 可执行: ${ANT_HOME_TO_USE}/bin/ant（不阻塞 auto-package.sh，但 Ant 路线不可用）"
    fi
else
    if command -v ant &>/dev/null; then
        ok "PATH 中 ant 可用: $(ant -version 2>&1 | head -1)"
    else
        warn "Ant 不可用（不阻塞 auto-package.sh 增量编译；若需 build.increment.xml 路线则需安装 Ant）"
    fi
fi
echo "----------------------------------------"

# ============================================================
# 5. 版本号有效性预检（检查版本号不超过 SVN 仓库 HEAD）
# 注意：上限必须用仓库 HEAD（svn info -r HEAD 远程查询），不能用本地
# 工作副本根目录 revision —— SVN 是 mixed-revision 模型，commit 只
# bump 被提交文件的 revision，根目录 revision 停留在上次 update，
# 用它做上限会把用户自己刚提交的版本误判为"超限"。
# 打包取清单走 svn diff -r A:B（服务器端对比），与本地副本版本无关。
# ============================================================
info "【5/5】校验版本号有效性（对比 SVN 仓库 HEAD）"
if [[ "${CMD}" == "auto-pack" && -d "${PROJECT_PATH}/.svn" && -n "${REVISIONS}" && "${REVISIONS}" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
    # 仓库 HEAD（一次远程查询）；本地根目录 revision 仅用于内容一致性提示
    HEAD_REV=$(svn info -r HEAD --show-item revision "${PROJECT_PATH}" 2>/dev/null || echo "")
    LOCAL_REV=$(svn info --show-item revision "${PROJECT_PATH}" 2>/dev/null || echo "")
    # HEAD 查询失败（如离线）时回退用本地 revision 做上限，保持降级行为
    UPPER_REV="${HEAD_REV:-${LOCAL_REV}}"
    if [[ -n "${UPPER_REV}" ]]; then
        info "SVN 仓库 HEAD 版本: ${HEAD_REV:-未知（离线？）}（本地工作副本根目录: ${LOCAL_REV:-未知}）"
        IFS=',' read -ra REV_ARR <<< "${REVISIONS}"
        REV_EXCEED=0
        MAX_REV=0
        for rev in "${REV_ARR[@]}"; do
            [[ ${rev} -gt ${MAX_REV} ]] && MAX_REV=${rev}
            if [[ ${rev} -gt ${UPPER_REV} ]]; then
                fail "版本号 ${rev} 超过 SVN 仓库 HEAD ${UPPER_REV} —— 仓库中不存在该版本，请核对版本号"
                REV_EXCEED=1
            fi
        done
        if [[ ${REV_EXCEED} -eq 0 ]]; then
            ok "所有版本号均 ≤ 仓库 HEAD ${UPPER_REV}"
            # mixed-revision 提示：本地根目录版本低于最大目标版本时提醒（不阻断）
            # 根目录 revision 老不代表文件内容旧（用户自己 commit 的场景文件就是新的），
            # 但若本地确实未包含目标版本内容，编译产物会是旧内容，提示人工确认
            if [[ -n "${HEAD_REV}" && -n "${LOCAL_REV}" && ${MAX_REV} -gt ${LOCAL_REV} ]]; then
                warn "本地工作副本根目录版本 ${LOCAL_REV} 低于最大目标版本 ${MAX_REV}：若本地未包含这些版本的变更内容，请先 svn update（mixed-revision 下根目录版本老不一定代表文件内容旧，自己提交的版本内容即为最新）"
            fi
        fi
    else
        warn "无法获取 SVN 版本信息（svn info 失败），跳过版本号上限校验"
    fi
fi
echo "----------------------------------------"

# ============================================================
# 汇总
# ============================================================
echo "========================================"
echo "  预检汇总"
echo "========================================"
echo "  通过: ${PASS_CNT}  警告: ${WARN_CNT}  失败: ${FAIL_CNT}"
echo "----------------------------------------"

if [[ ${FAIL_CNT} -gt 0 ]]; then
    echo -e "${RED}结论: FAIL - 存在 ${FAIL_CNT} 个错误，不建议进入打包${NC}"
    exit 1
elif [[ ${WARN_CNT} -gt 0 ]]; then
    echo -e "${YELLOW}结论: WARN - 存在 ${WARN_CNT} 个警告，可打包但需关注${NC}"
    exit 0
else
    echo -e "${GREEN}结论: PASS - 全部通过，可执行打包${NC}"
    exit 0
fi

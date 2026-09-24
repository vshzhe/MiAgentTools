#!/bin/bash
# ============================================================
# verify-package.sh - 打包后一致性校验
# 以 SVN 变更清单（svn diff --summarize）为基准，逐项核对产出目录
# 中的文件是否齐全、是否多余、目录结构是否正确、编译产物是否缺失。
#
# 校验基准：SVN 变更清单为准（A/M 操作 → 产出应有对应文件；
#           D 操作 → 产出不应有该文件）。
# 编译产物校验：主类 .class 必须存在；内部类 Bar$*.class 以源项目
#           本地编译输出目录（WebRoot/WEB-INF/classes/ 或 bin/）为基准
#           逐一核对，防止内部类在复制/清理环节丢失。
# 路径映射规则：与 auto-package.sh 的 run_web_build/run_server_build
#           完全对齐，确保校验口径与打包口径一致。
#
# 退出码约定：
#   0 = 一致性通过（无缺失、无多余、无错位）
#   1 = 存在差异（缺失/多余/应删未删/编译缺失）
#   2 = 无法校验（环境/参数错误，如产出目录不存在、SVN 不可用）
#
# 用法：
#   bash verify-package.sh \
#     -n <项目名> -r <版本号列表> -l <本地项目路径> -o <产出目录> \
#     [-s <svn-url>] [--cmd auto-pack|pack] [--strict] [--workers N]
#
# 性能说明（并行加速）：
#   - SVN diff 按版本并行收集（并发数 = --workers，默认 4）
#   - 变更文件分块并行核对（worker 数 = --workers，默认 4）
#   - 内部类基准批量预收集 + 内存查表，消除逐文件 find/sort 的 fork 开销
#   - --workers 1 退化为完全串行（对照/调试用）
# ============================================================
set -uo pipefail

# ---------- 颜色输出 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
MISS_CNT=0          # 缺失文件
EXTRA_CNT=0         # 多余文件
NOTDEL_CNT=0        # 应删未删
NOCOMPILE_CNT=0     # 编译产物缺失
INNER_MISS_CNT=0    # 内部类缺失
BYTECODE_DIFF_CNT=0 # 字节码差异（ECJ产物 vs IDE产物）
BYTECODE_CHECK_CNT=0 # 字节码抽检数
MATCH_CNT=0         # 匹配成功

# 用 printf '%s' 输出消息体，避免路径反斜杠被转义
ok()     { printf '%b[ OK ]%b %s\n' "${GREEN}"  "${NC}" "$*"; }
miss()   { printf '%b[缺失]%b %s\n'   "${RED}"    "${NC}" "$*"; MISS_CNT=$((MISS_CNT+1)); }
extra()  { printf '%b[多余]%b %s\n'   "${YELLOW}" "${NC}" "$*"; EXTRA_CNT=$((EXTRA_CNT+1)); }
notdel() { printf '%b[应删未删]%b %s\n' "${RED}" "${NC}" "$*"; NOTDEL_CNT=$((NOTDEL_CNT+1)); }
nocompile() { printf '%b[编译缺失]%b %s\n' "${RED}" "${NC}" "$*"; NOCOMPILE_CNT=$((NOCOMPILE_CNT+1)); }
innermiss() { printf '%b[内部类缺失]%b %s\n' "${RED}" "${NC}" "$*"; INNER_MISS_CNT=$((INNER_MISS_CNT+1)); }
bytecode_diff() { printf '%b[字节码差异]%b %s\n' "${RED}" "${NC}" "$*"; BYTECODE_DIFF_CNT=$((BYTECODE_DIFF_CNT+1)); }
info()   { printf '%b[INFO]%b %s\n'   "${BLUE}"   "${NC}" "$*"; }

# ---------- 路径转换（与 auto-package.sh 一致）----------
to_posix_path() {
    local path="$1"
    if [[ "$path" == /* ]]; then echo "$path"; return; fi
    echo "$path" | sed 's|^\([A-Za-z]\):\\|/\L\1/|g; s|^\([A-Za-z]\):/|/\L\1/|g; s|\\|/|g'
}

# ============================================================
# 路径映射函数（对齐 auto-package.sh 的 run_web_build/run_server_build）
# 必须在主流程调用前定义
# ============================================================

# map_path: 将 SVN 路径映射为产出目录中的相对路径（非 Java 资源文件）
# 结果写入全局变量 MAPPED（不走 echo，避免 $( ) 命令替换的 fork 开销）
# 参数: $1 = SVN 变更路径（已转正斜杠）, $2 = 项目类型
map_path() {
    local file_path="$1"
    local ptype="$2"

    if [[ "${ptype}" == "web" ]]; then
        # Web 项目（run_web_build 行421-427）
        if [[ "${file_path}" == src/* ]]; then
            MAPPED="WEB-INF/classes/${file_path#src/}"
        elif [[ "${file_path}" == WebRoot/* ]]; then
            MAPPED="${file_path#WebRoot/}"
        else
            MAPPED="${file_path}"
        fi
    else
        # Server 项目（run_server_build 行486-490）
        if [[ "${file_path}" == src/* ]]; then
            MAPPED="bin/${file_path#src/}"
        else
            MAPPED="${file_path}"
        fi
    fi
}

# map_java_to_class: 将 Java 源文件路径映射为产出 .class 路径
# 结果写入全局变量 CLASS_MAPPED（不走 echo，避免 $( ) 命令替换的 fork 开销）
# 参数: $1 = SVN 变更路径（已转正斜杠，.java 结尾）, $2 = 项目类型
map_java_to_class() {
    local file_path="$1"
    local ptype="$2"
    # 先去掉 .java 后缀，换成 .class
    local class_path="${file_path%.java}.class"

    if [[ "${ptype}" == "web" ]]; then
        # src/foo/Bar.java → WEB-INF/classes/foo/Bar.class
        if [[ "${file_path}" == src/* ]]; then
            CLASS_MAPPED="WEB-INF/classes/${class_path#src/}"
        else
            CLASS_MAPPED="${class_path}"
        fi
    else
        # src/foo/Bar.java → bin/foo/Bar.class
        if [[ "${file_path}" == src/* ]]; then
            CLASS_MAPPED="bin/${class_path#src/}"
        else
            CLASS_MAPPED="${class_path}"
        fi
    fi
}

# ---------- 参数默认值 ----------
PROJECT_NAME=""
REVISIONS=""
PROJECT_PATH=""
OUTPUT_DIR=""
SVN_URL=""
CMD="auto-pack"
STRICT="false"
WORKERS=4
JAVA_HOME="${JAVA_HOME:-}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--name)        PROJECT_NAME="$2"; shift 2 ;;
        -r|--revisions)   REVISIONS="$2"; shift 2 ;;
        -l|--local-path)  PROJECT_PATH="$(to_posix_path "$2")"; shift 2 ;;
        -o|--output)      OUTPUT_DIR="$(to_posix_path "$2")"; shift 2 ;;
        -s|--svn-url)     SVN_URL="$2"; shift 2 ;;
        --cmd)            CMD="$2"; shift 2 ;;
        --strict)         STRICT="true"; shift ;;
        --workers)        WORKERS="$2"; shift 2 ;;
        -j|--java-home)   JAVA_HOME="$(to_posix_path "$2")"; shift 2 ;;
        -h|--help)
            cat << EOF
用法: bash verify-package.sh [options]
必填: -n 项目名 -r 版本号 -l 项目路径(SVN工作副本) -o 产出目录
可选: --cmd auto-pack|pack  --strict(严格模式：多余文件也算FAIL)
      --workers N(并行数，默认4；1=串行，同时控制svn diff并发与核对分块)
      -j/--java-home <path> JDK路径(可选，默认环境JAVA_HOME；用于ECJ字节码抽检)
说明：以 svn diff --summarize 变更清单为基准核对产出。
EOF
            exit 2
            ;;
        *) info "未知参数: $1"; exit 2 ;;
    esac
done

# 并行数合法性校验
if ! [[ "${WORKERS}" =~ ^[1-9][0-9]*$ ]]; then
    info "--workers 必须为正整数，当前值: ${WORKERS}"
    exit 2
fi

# ---------- 基本参数校验 ----------
ERR=0
[[ -z "${PROJECT_NAME}" ]] && { info "缺少 -n/--name"; ERR=1; }
[[ -z "${PROJECT_PATH}" ]] && { info "缺少 -l/--local-path"; ERR=1; }
[[ -z "${REVISIONS}" ]] && { info "缺少 -r/--revisions"; ERR=1; }
[[ -z "${OUTPUT_DIR}" ]] && { info "缺少 -o/--output"; ERR=1; }
if [[ ${ERR} -eq 1 ]]; then exit 2; fi

# auto-pack 模式需 SVN 工作副本；pack 模式需 SVN_URL
if [[ "${CMD}" == "auto-pack" && ! -d "${PROJECT_PATH}/.svn" ]]; then
    info "auto-pack 模式要求 ${PROJECT_PATH} 为 SVN 工作副本（缺 .svn）"; exit 2
fi
if [[ "${CMD}" == "pack" && -z "${SVN_URL}" ]]; then
    info "pack 模式需 -s/--svn-url"; exit 2
fi

# 产出目录必须存在（打包后才有东西可校验）
# 注意：auto-package.sh 实际产出在 OUTPUT_DIR/PROJECT_NAME/ 下
FINAL_OUTPUT="${OUTPUT_DIR}/${PROJECT_NAME}"
if [[ ! -d "${FINAL_OUTPUT}" ]]; then
    info "产出目录不存在: ${FINAL_OUTPUT}"
    info "请先执行 auto-package.sh 完成打包，再运行校验"
    exit 2
fi

echo "========================================"
echo "  打包一致性校验报告"
echo "========================================"
info "项目名称: ${PROJECT_NAME}"
info "版本号:   ${REVISIONS}"
info "项目路径: ${PROJECT_PATH}"
info "产出目录: ${FINAL_OUTPUT}"
info "校验模式: ${CMD}（基准=SVN变更清单）"
info "并行数:   ${WORKERS}（SVN diff 并发收集 + 核对分块）"
echo "----------------------------------------"

# ---------- 项目类型识别（与 auto-package.sh detect_project_type 一致）----------
PROJECT_TYPE=""
if [[ -d "${PROJECT_PATH}/WebRoot" ]]; then
    PROJECT_TYPE="web"
elif [[ -d "${PROJECT_PATH}/bin" && -d "${PROJECT_PATH}/lib" ]]; then
    PROJECT_TYPE="server"
fi

if [[ -z "${PROJECT_TYPE}" ]]; then
    info "无法识别项目类型（缺 WebRoot/ 或 bin/+lib/），按 Server 口径映射"
    PROJECT_TYPE="server"
fi
info "项目类型: ${PROJECT_TYPE}"

# 源项目编译输出目录（内部类验证基准）
# javac 单次编译必然同时产出主类与全部内部类（Bar$*.class），
# 因此本地编译输出目录即该类应有的完整 class 清单
if [[ "${PROJECT_TYPE}" == "web" ]]; then
    SRC_CLASSES_DIR="${PROJECT_PATH}/WebRoot/WEB-INF/classes"
    PROD_CLASS_PREFIX="WEB-INF/classes"
else
    SRC_CLASSES_DIR="${PROJECT_PATH}/bin"
    PROD_CLASS_PREFIX="bin"
fi
info "内部类基准: ${SRC_CLASSES_DIR}"
echo "----------------------------------------"

# ============================================================
# 收集 SVN 变更清单（基准）—— 按版本并行
# 复用 auto-package.sh collect_changed_files 的核心逻辑：
#   按版本升序，svn diff --summarize -r base:rev，过滤 IDE 配置
# 性能优化：各版本 diff 后台并行执行（并发数 = WORKERS，分批 wait），
#   结果落 diff_<rev>.txt，全部完成后按版本升序合并（保证去重语义不变），
#   IDE 过滤改为合并后一次性完成（每版本 2 次 grep -> 全局 2 次）
# ============================================================
info "并行收集 SVN 变更清单（并发 ${WORKERS}）..."

# 切换到项目目录执行 svn 命令
ORIG_DIR="$(pwd)"
cd "${PROJECT_PATH}" 2>/dev/null || { info "无法进入项目目录: ${PROJECT_PATH}"; exit 2; }

# 解析版本号列表（升序）
IFS=',' read -ra REV_LIST <<< "${REVISIONS}"
SORTED_REVS=$(printf "%s\n" "${REV_LIST[@]}" | sort -n)

# 临时文件存放合并后的变更清单（去重，保留最新版本状态）
TMP_DIR="${FINAL_OUTPUT}/.verify-tmp"
mkdir -p "${TMP_DIR}"
RAW_FILE="${TMP_DIR}/raw_changes.txt"
MERGED_FILE="${TMP_DIR}/merged_changes.txt"
> "${RAW_FILE}"

DIFF_START=${SECONDS}

# 并行收集：每个版本一个后台子壳，输出到独立文件（无竞争）
diff_batch=0
for rev in ${SORTED_REVS}; do
    (
        base_rev=$((rev - 1))
        out=$(LANG=C LC_ALL=C svn diff --summarize -r "${base_rev}:${rev}" --non-interactive . 2>/dev/null)
        if [[ -z "${out}" ]]; then
            # diff 失败时回退到 svn log
            out=$(LANG=C LC_ALL=C svn log -v -r "${rev}" --non-interactive . 2>/dev/null)
            out=$(printf '%s\n' "${out}" | grep -E '^[[:space:]]+[MARD][[:space:]]+' | \
                sed -E 's/^[[:space:]]+([MARD])[[:space:]]+/\1 /' | \
                sed "s|^[MARD] /${PROJECT_NAME}/||" || true)
        fi
        printf '%s\n' "${out}" > "${TMP_DIR}/diff_${rev}.txt"
    ) &
    diff_batch=$((diff_batch + 1))
    # 分批等待：每 WORKERS 个一批，控制并发数
    if (( diff_batch % WORKERS == 0 )); then
        wait
    fi
done
wait

# 按版本升序合并（后出现的记录覆盖先出现的，去重语义依赖此顺序）
for rev in ${SORTED_REVS}; do
    [[ -f "${TMP_DIR}/diff_${rev}.txt" ]] && cat "${TMP_DIR}/diff_${rev}.txt" >> "${RAW_FILE}"
done
# 统一过滤 IDE 配置文件（与 auto-package.sh 同口径，一次性完成）
if [[ -s "${RAW_FILE}" ]]; then
    grep -vE '^\s*[MARD]\s+\.(settings|classpath|project|git)/' "${RAW_FILE}" | \
        grep -vE '^\s*[MARD]\s+\.(settings|classpath|project)$' > "${RAW_FILE}.filtered" || true
    mv "${RAW_FILE}.filtered" "${RAW_FILE}"
fi
rm -f "${TMP_DIR}"/diff_*.txt

cd "${ORIG_DIR}"

info "SVN 清单收集完成，耗时 $((SECONDS - DIFF_START)) 秒"

# 去重：同一文件路径保留最后出现的记录（最新版本状态）
# 用于 A/M/D 判定 —— 若先 A 后 D，最终状态是 D；若先 D 后 A，最终状态是 A
awk '{
    path = $2
    # 路径中的反斜杠统一成正斜杠，便于后续比对
    gsub(/\\/, "/", path)
    # 记录每个路径的最终状态（op）与原始行
    final[path] = $1
    order[path] = (order[path] ? order[path] "\n" : "") $0
}
END {
    for (p in final) {
        print final[p] "\t" p
    }
}' "${RAW_FILE}" | sort > "${MERGED_FILE}"

# 统计操作类型
CNT_A=0; CNT_M=0; CNT_D=0
while IFS=$'\t' read -r op path; do
    case "${op}" in
        A) CNT_A=$((CNT_A+1)) ;;
        M) CNT_M=$((CNT_M+1)) ;;
        D) CNT_D=$((CNT_D+1)) ;;
    esac
done < "${MERGED_FILE}"

TOTAL_CHANGES=$((CNT_A + CNT_M + CNT_D))
info "变更清单统计: 文件数 ${TOTAL_CHANGES}（A:${CNT_A} M:${CNT_M} D:${CNT_D}）"
echo "----------------------------------------"

if [[ ${TOTAL_CHANGES} -eq 0 ]]; then
    info "变更清单为空，无文件需要校验"
    echo "========================================"
    echo "  一致性: PASS（空变更）"
    echo "========================================"
    rm -rf "${TMP_DIR}"
    exit 0
fi

# ============================================================
# 逐项核对产出 —— 分块并行
# 路径映射规则（对齐 auto-package.sh）：
#   Web 项目 run_web_build（行421-427）：
#     src/X.java     → WEB-INF/classes/X（编译，.java→.class）
#     src/conf/X.xml → WEB-INF/classes/conf/X.xml
#     WebRoot/X      → X（剥离 WebRoot/ 前缀）
#     其他前缀       → 保持原样
#   Server 项目 run_server_build（行486-490）：
#     src/X          → bin/X（src→bin 前缀替换；.java 编译为 .class）
#     其他前缀       → 保持原样
# 性能优化（消除 Git Bash/MSYS2 下昂贵的 fork）：
#   1. 内部类基准批量预收集：1 次 find 扫源项目编译输出全部 *$*.class，
#      构建关联数组 INNER_MAP[主类key]=内部类列表，循环内内存查表
#      （替代每个 .java 一次 find+sort，消除数百次 fork）
#   2. dirname/basename 改纯 bash 参数展开（${var%/*}、${var##*/}）
#   3. 变更清单 split 均分为 WORKERS 块，每块一个后台 worker 并行核对，
#      各写独立报告/期望清单/计数器文件，wait 后按块序合并
# ============================================================
info "逐项核对产出文件（${WORKERS} 个并行 worker）..."

CHECK_START=${SECONDS}

# 先收集产出目录的全部文件清单（用于"多余文件"检测）
# 排除 readme.txt、filelist.txt（auto-package.sh 自动生成的辅助文件）
PRODUCED_FILE="${TMP_DIR}/produced_files.txt"
find "${FINAL_OUTPUT}" -type f \
    -not -name "readme.txt" \
    -not -name "filelist.txt" \
    -not -path "${TMP_DIR}/*" \
    2>/dev/null | sed "s|${FINAL_OUTPUT}/||" | sort > "${PRODUCED_FILE}"
PRODUCED_CNT=$(wc -l < "${PRODUCED_FILE}")
info "产出文件数: ${PRODUCED_CNT}"

# ---------- 内部类基准批量预收集（源项目编译输出，1 次 find） ----------
# 按主类 key（去掉第一个 $ 起后缀的相对路径）分组：
#   cn/foo/Bar$1.class、cn/foo/Bar$Inner.class、cn/foo/Bar$1$In.class → key=cn/foo/Bar
# 基准目录不存在时清单为空，内部类校验自然全部跳过（与逐目录 find 行为一致）
INNER_BASE_FILE="${TMP_DIR}/inner_base.txt"
( cd "${SRC_CLASSES_DIR}" 2>/dev/null && find . -type f -name "*\$*.class" -printf '%P\n' 2>/dev/null ) > "${INNER_BASE_FILE}"
declare -A INNER_MAP=()
while IFS= read -r inner_rel; do
    [[ -z "${inner_rel}" ]] && continue
    INNER_MAP["${inner_rel%%\$*}"]+="${inner_rel}"$'\n'
done < "${INNER_BASE_FILE}"
info "内部类基准: ${#INNER_MAP[@]} 个主类含内部类"

# ---------- 产出内部类索引（D 操作残留检测用，查表 0 fork） ----------
# key 与 INNER_MAP 一致：去掉产出前缀和 $ 后缀（如 cn/foo/Bar），value 保留产出相对路径
declare -A PROD_INNER_MAP=()
while IFS= read -r prod_rel; do
    [[ -z "${prod_rel}" ]] && continue
    [[ "${prod_rel}" == *\$*.class ]] || continue
    prod_key="${prod_rel#${PROD_CLASS_PREFIX}/}"
    PROD_INNER_MAP["${prod_key%%\$*}"]+="${prod_rel}"$'\n'
done < "${PRODUCED_FILE}"

# 期望产出清单（worker 各写分片，合并后用于多余文件检测）
EXPECTED_FILE="${TMP_DIR}/expected_files.txt"
> "${EXPECTED_FILE}"

# ---------- 单块核对函数（worker：主进程后台并行调用） ----------
# 入参：$1 = 分块文件（op\tpath 行）
# 输出：stdout → 分块报告；<chunk>.expected → 期望清单分片；<chunk>.counts → 计数器
# worker 是主 shell 的子壳副本，函数/变量/关联数组快照继承，
# 计数器与期望清单通过文件传回主进程合并
verify_chunk() {
    local chunk_file="$1"
    EXPECTED_FILE="${chunk_file}.expected"
    > "${EXPECTED_FILE}"

    while IFS=$'\t' read -r op path; do
        [[ -z "${path}" ]] && continue

        # 跳过目录变更条目：SVN diff --summarize 在新增/删除文件时会
        # 额外列出其所在目录本身（如 "A src/.../service"，无文件扩展名）。
        # auto-package.sh 处理时对目录走 cp 跳过（[[ ! -f src_file ]]），
        # 此处对齐：无扩展名的路径视为目录，跳过，避免误报缺失。
        if [[ "${path}" != *.* ]]; then
            info "  跳过目录变更: ${path}"
            continue
        fi

        if [[ "${op}" == "D" ]]; then
            # 删除操作：产出不应包含该文件
            map_path "${path}" "${PROJECT_TYPE}"
            if [[ -n "${MAPPED}" ]]; then
                if [[ "${path}" == *.java ]]; then
                    map_java_to_class "${path}" "${PROJECT_TYPE}"
                    if [[ -n "${CLASS_MAPPED}" ]]; then
                        # 主类残留
                        if [[ -f "${FINAL_OUTPUT}/${CLASS_MAPPED}" ]]; then
                            notdel "${path} → 已删除但产出仍含 ${CLASS_MAPPED}"
                        fi
                        # 内部类残留（查产出内部类索引）
                        inner_key="${CLASS_MAPPED#${PROD_CLASS_PREFIX}/}"
                        inner_key="${inner_key%.class}"
                        while IFS= read -r leftover; do
                            [[ -z "${leftover}" ]] && continue
                            notdel "${path} → 已删除但产出仍含 ${leftover}"
                        done <<< "${PROD_INNER_MAP[${inner_key}]-}"
                    fi
                elif [[ -f "${FINAL_OUTPUT}/${MAPPED}" ]]; then
                    notdel "${path} → 已删除但产出仍含 ${MAPPED}"
                fi
            fi
            continue
        fi

        # A / M 操作：产出应有对应文件
        if [[ "${path}" == *.java ]]; then
            # Java 文件 → 编译为 .class
            # 主类 Bar.class 必须存在；内部类 Bar$*.class 以源项目编译输出为基准逐一核对
            map_java_to_class "${path}" "${PROJECT_TYPE}"
            if [[ -z "${CLASS_MAPPED}" ]]; then
                miss "${path} → 无法映射 class 路径（项目类型未知）"
                continue
            fi

            # 主类产物必须存在（javac 编译 .java 必产顶层类 .class）
            if [[ ! -f "${FINAL_OUTPUT}/${CLASS_MAPPED}" ]]; then
                nocompile "${path} → 未找到 ${CLASS_MAPPED}（编译可能失败或该类未被编译）"
                continue
            fi
            ok "${path} → ${CLASS_MAPPED}"
            MATCH_CNT=$((MATCH_CNT+1))
            # 记录期望产出：主类（用于多余文件检测）
            echo "${CLASS_MAPPED}" >> "${EXPECTED_FILE}"

            # ---------- 内部类验证（查 INNER_MAP，0 fork） ----------
            # key = 产出 class 路径去掉前缀和 .class 后缀（如 cn/foo/Bar）
            inner_key="${CLASS_MAPPED#${PROD_CLASS_PREFIX}/}"
            inner_key="${inner_key%.class}"
            inner_list="${INNER_MAP[${inner_key}]-}"
            if [[ -n "${inner_list}" ]]; then
                while IFS= read -r inner_rel; do
                    [[ -z "${inner_rel}" ]] && continue
                    inner_prod="${PROD_CLASS_PREFIX}/${inner_rel}"
                    if [[ -f "${FINAL_OUTPUT}/${inner_prod}" ]]; then
                        ok "${path} → ${inner_prod}（内部类）"
                        # 记录期望产出：内部类（避免 strict 模式误报多余）
                        echo "${inner_prod}" >> "${EXPECTED_FILE}"
                    else
                        innermiss "${path} → 内部类缺失: ${inner_prod}（基准: ${SRC_CLASSES_DIR}/${inner_rel}）"
                    fi
                done <<< "${inner_list}"
            fi
        else
            # 非 Java 资源文件 → 直接路径映射
            map_path "${path}" "${PROJECT_TYPE}"
            if [[ -z "${MAPPED}" ]]; then
                miss "${path} → 无法映射路径（项目类型未知）"
                continue
            fi
            if [[ -f "${FINAL_OUTPUT}/${MAPPED}" ]]; then
                ok "${path} → ${MAPPED}"
                MATCH_CNT=$((MATCH_CNT+1))
                echo "${MAPPED}" >> "${EXPECTED_FILE}"
            else
                miss "${path} → 期望 ${MAPPED}，未找到"
            fi
        fi
    done < "${chunk_file}"

    # 计数器落盘（主进程汇总）：匹配 缺失 多余 应删未删 编译缺失 内部类缺失
    printf '%d %d %d %d %d %d\n' \
        "${MATCH_CNT}" "${MISS_CNT}" "${EXTRA_CNT}" "${NOTDEL_CNT}" "${NOCOMPILE_CNT}" "${INNER_MISS_CNT}" \
        > "${chunk_file}.counts"
}

# ---------- 分块并行核对 ----------
# split -n l/N：按行均分为 N 块不切断记录，生成 chunk_aa/chunk_ab/...（有序）
split -n "l/${WORKERS}" "${MERGED_FILE}" "${TMP_DIR}/chunk_"

for chunk_file in "${TMP_DIR}"/chunk_??; do
    [[ -f "${chunk_file}" ]] || continue
    verify_chunk "${chunk_file}" > "${chunk_file}.report" 2>&1 &
done
wait

# ---------- 合并：按块序拼接报告与期望清单，汇总计数器 ----------
for report_file in "${TMP_DIR}"/chunk_*.report; do
    [[ -f "${report_file}" ]] || continue
    cat "${report_file}"
    chunk_base="${report_file%.report}"
    [[ -f "${chunk_base}.expected" ]] && cat "${chunk_base}.expected" >> "${EXPECTED_FILE}"
done

MATCH_CNT=0; MISS_CNT=0; EXTRA_CNT=0; NOTDEL_CNT=0; NOCOMPILE_CNT=0; INNER_MISS_CNT=0
ALL_COUNTS="${TMP_DIR}/all_counts.txt"
cat "${TMP_DIR}"/chunk_*.counts > "${ALL_COUNTS}" 2>/dev/null || > "${ALL_COUNTS}"
while read -r c_match c_miss c_extra c_notdel c_nocompile c_innermiss; do
    [[ -z "${c_match}" ]] && continue
    MATCH_CNT=$((MATCH_CNT + c_match))
    MISS_CNT=$((MISS_CNT + c_miss))
    EXTRA_CNT=$((EXTRA_CNT + c_extra))
    NOTDEL_CNT=$((NOTDEL_CNT + c_notdel))
    NOCOMPILE_CNT=$((NOCOMPILE_CNT + c_nocompile))
    INNER_MISS_CNT=$((INNER_MISS_CNT + c_innermiss))
done < "${ALL_COUNTS}"
rm -f "${TMP_DIR}"/chunk_*

info "核对完成，耗时 $((SECONDS - CHECK_START)) 秒"
echo "----------------------------------------"

# ============================================================
# 多余文件检测：产出中有但变更清单中没有的文件
# 仅在 strict 模式下报 FAIL；非 strict 模式仅 INFO 提示
# ============================================================
if [[ "${STRICT}" == "true" ]]; then
    info "严格模式：检测多余文件..."
    # comm 一次差集替代逐文件 grep（产出清单已排序；期望清单 sort -u 去重）
    # comm -23 = 仅在产出清单中出现（即期望之外的多余文件）
    comm -23 "${PRODUCED_FILE}" <(sort -u "${EXPECTED_FILE}") > "${TMP_DIR}/extras.txt" 2>/dev/null || > "${TMP_DIR}/extras.txt"
    while IFS= read -r extra_file; do
        [[ -z "${extra_file}" ]] && continue
        extra "${extra_file}（变更清单中无此文件）"
    done < "${TMP_DIR}/extras.txt"
    echo "----------------------------------------"
fi

# ============================================================
# 目录结构校验
# ============================================================
info "目录结构校验..."
if [[ "${PROJECT_TYPE}" == "web" ]]; then
    if [[ -d "${FINAL_OUTPUT}/WEB-INF/classes" ]]; then
        ok "Web 项目产出含 WEB-INF/classes/"
    else
        miss "Web 项目产出缺 WEB-INF/classes/ 目录"
    fi
elif [[ "${PROJECT_TYPE}" == "server" ]]; then
    [[ -d "${FINAL_OUTPUT}/bin" ]] && ok "Server 项目产出含 bin/" || miss "Server 项目产出缺 bin/ 目录"
    # lib/ 和 run/ 仅在变更涉及 jar/脚本时才出现，不强校验
fi
echo "----------------------------------------"

# ============================================================
# ECJ 字节码抽检：产出 class vs IDE 产物（SRC_CLASSES_DIR）字节码一致性
# auto-package.sh 改用 ECJ 后，产物字节码应与 IDE（Eclipse）100% 一致。
# 用 javap -c -p 精确对比指令序列（去除地址/#索引/注释），diff=0 通过。
# 跳过条件：javap 不可用、源项目编译输出目录不存在（不报错，仅 INFO）
# ============================================================
clean_bytecode() {
    # $1=javap_bin  $2=class 文件
    "$1" -c -p "$2" 2>/dev/null | sed 's|//.*||; s|#[0-9]*||g' | awk '{$1=""; sub(/^ +/,""); print}'
}

check_bytecode_align() {
    local prod_classes="${FINAL_OUTPUT}/${PROD_CLASS_PREFIX}"
    [[ -d "${prod_classes}" ]] || { info "字节码抽检跳过：产出无 ${PROD_CLASS_PREFIX}/ 目录"; return 0; }
    [[ -d "${SRC_CLASSES_DIR}" ]] || { info "字节码抽检跳过：源项目编译输出目录不存在 ${SRC_CLASSES_DIR}"; return 0; }

    local javap_bin="${JAVA_HOME}/bin/javap"
    [[ ! -f "${javap_bin}" ]] && javap_bin="${JAVA_HOME}/bin/javap.exe"
    if [[ ! -f "${javap_bin}" ]]; then
        info "字节码抽检跳过：javap 不可用（用 -j/--java-home 指定 JDK，或设环境 JAVA_HOME）"
        return 0
    fi

    info "ECJ 字节码抽检：产出 vs IDE 产物（${SRC_CLASSES_DIR}）"
    local prod_cls ide_cls rel d
    while IFS= read -r prod_cls; do
        rel="${prod_cls#${prod_classes}/}"
        ide_cls="${SRC_CLASSES_DIR}/${rel}"
        [[ -f "${ide_cls}" ]] || continue  # IDE 无对应产物（新增类），跳过
        BYTECODE_CHECK_CNT=$((BYTECODE_CHECK_CNT+1))
        d=$(diff <(clean_bytecode "${javap_bin}" "${prod_cls}") <(clean_bytecode "${javap_bin}" "${ide_cls}") | grep -cE "^[<>]")
        if [[ ${d} -eq 0 ]]; then
            ok "字节码一致: ${rel}"
        else
            bytecode_diff "${rel}（指令差异 ${d} 行）"
        fi
    done < <(find "${prod_classes}" -name "*.class" 2>/dev/null)
    info "字节码抽检完成：${BYTECODE_CHECK_CNT} 个类比对，${BYTECODE_DIFF_CNT} 个差异"
    echo "----------------------------------------"
}

check_bytecode_align

# ============================================================
# 汇总
# ============================================================
TOTAL_ISSUES=$((MISS_CNT + EXTRA_CNT + NOTDEL_CNT + NOCOMPILE_CNT + INNER_MISS_CNT + BYTECODE_DIFF_CNT))
SCORE_BASE=$((CNT_A + CNT_M))
SCORE_BASE=${SCORE_BASE:-0}
if [[ ${SCORE_BASE} -gt 0 ]]; then
    SCORE_PCT=$(awk "BEGIN { printf \"%.1f\", (${MATCH_CNT} / ${SCORE_BASE}) * 100 }")
else
    SCORE_PCT="100.0"
fi

echo "========================================"
echo "  一致性校验汇总"
echo "========================================"
echo "  变更文件数:   ${TOTAL_CHANGES}（A:${CNT_A} M:${CNT_M} D:${CNT_D}）"
echo "  产出文件数:   ${PRODUCED_CNT}"
echo "  匹配成功:     ${MATCH_CNT}"
echo "  缺失文件:     ${MISS_CNT}"
echo "  编译缺失:     ${NOCOMPILE_CNT}"
echo "  内部类缺失:   ${INNER_MISS_CNT}"
echo "  应删未删:     ${NOTDEL_CNT}"
echo "  多余文件:     ${EXTRA_CNT}"
echo "  字节码差异:   ${BYTECODE_DIFF_CNT}（抽检 ${BYTECODE_CHECK_CNT} 个类）"
echo "----------------------------------------"
echo "  一致性评分:   ${MATCH_CNT}/${SCORE_BASE} (${SCORE_PCT}%)"
echo "========================================"

if [[ ${TOTAL_ISSUES} -gt 0 ]]; then
    printf '%b结论: FAIL - 发现 %d 个问题（缺失%d / 编译缺失%d / 内部类缺失%d / 应删未删%d / 多余%d / 字节码差异%d）%b\n' \
        "${RED}" "${TOTAL_ISSUES}" "${MISS_CNT}" "${NOCOMPILE_CNT}" "${INNER_MISS_CNT}" "${NOTDEL_CNT}" "${EXTRA_CNT}" "${BYTECODE_DIFF_CNT}" "${NC}"
    rm -rf "${TMP_DIR}"
    exit 1
else
    printf '%b结论: PASS - 产出与变更清单一致%b\n' "${GREEN}" "${NC}"
    rm -rf "${TMP_DIR}"
    exit 0
fi

#!/bin/bash
# ============================================================
# auto-package.sh - 自动打包工具
# 功能：根据 SVN 版本号，使用指定 Java 和 Ant 路径，
#       自动提取变更文件、编译、打包到对应版本目录；
#       变更文件内容按版本从 SVN 服务器拉取（不读本地副本）
# 适用平台：Git Bash (Windows)
# ============================================================
set -euo pipefail

# ============================================================
# 全局变量
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/auto-package.conf"
# 临时目录（变更清单、SVN 日志、按版本拉取的源码等中间产物）
TMP_DIR="${SCRIPT_DIR}/.openspec-tmp/apply-improve-auto-package-incremental-build"

# 项目参数
PROJECT_NAME=""
PROJECT_PATH=""
SVN_URL=""
SVN_USER=""
SVN_PASS=""
REVISIONS=""
OUTPUT_DIR=""
JAVA_HOME=""
ANT_HOME=""
ECJ_JAR=""
# 工作副本对应的 SVN 仓库 URL（do_package 中赋值，按版本拉取文件的基准）
SVN_REPO_URL=""

# 控制参数
GEN_README="true"
COMPILE_MEMORY="512"
SOURCE_ENCODING="UTF-8"
VERBOSE="false"

# ============================================================
# 颜色输出
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*" >&2; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()  { echo -e "${BLUE}[STEP]${NC} $*" >&2; }
log_debug() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo "[DEBUG] $*" >&2
    fi
}

# ============================================================
# 加载配置文件
# ============================================================
load_config() {
    if [[ -f "${CONFIG_FILE}" ]]; then
        log_info "加载配置文件: ${CONFIG_FILE}"
        source "${CONFIG_FILE}"
        [[ -z "${JAVA_HOME}" ]] && JAVA_HOME="${DEFAULT_JAVA_HOME:-}"
        [[ -z "${ANT_HOME}" ]] && ANT_HOME="${DEFAULT_ANT_HOME:-}"
        [[ -z "${SVN_USER}" ]] && SVN_USER="${DEFAULT_SVN_USER:-}"
        [[ -z "${SVN_PASS}" ]] && SVN_PASS="${DEFAULT_SVN_PASS:-}"
        [[ -z "${OUTPUT_DIR}" ]] && OUTPUT_DIR="${DEFAULT_OUTPUT_DIR:-}"
        [[ -z "${ECJ_JAR}" ]] && ECJ_JAR="${DEFAULT_ECJ_JAR:-}"
        GEN_README="${GEN_README:-true}"
        COMPILE_MEMORY="${COMPILE_MEMORY:-512}"
        SOURCE_ENCODING="${SOURCE_ENCODING:-UTF-8}"
    else
        log_warn "配置文件不存在: ${CONFIG_FILE}，使用默认参数"
    fi
}

# ============================================================
# 路径转换工具
# ============================================================
to_posix_path() {
    local path="$1"
    if [[ "$path" == /* ]]; then
        echo "$path"
        return
    fi
    echo "$path" | sed 's|^\([A-Za-z]\):\\|/\L\1/|g; s|^\([A-Za-z]\):/|/\L\1/|g; s|\\|/|g'
}

to_win_path() {
    local path="$1"
    if [[ "$path" == [A-Za-z]:* ]]; then
        echo "$path"
        return
    fi
    echo "$path" | sed 's|^/\([a-z]\)/|\U\1:/|g; s|/$||g'
}

# ============================================================
# 显示帮助信息
# ============================================================
show_usage() {
    cat << EOF
用法: $(basename "$0") <command> [options]

命令:
  pack        手动指定版本号打包（需要 SVN 仓库地址）
  auto-pack   自动从本地 SVN 工作副本获取版本号并打包
  help        显示帮助信息

pack 参数:
  -s, --svn-url <url>       SVN 仓库地址
  -n, --name <name>         项目名称（如 Venus4A）
  -r, --revisions <revs>    版本号列表，逗号分隔（如 64561,64562）
  -l, --local-path <path>   本地项目路径
  -o, --output <dir>        输出目录
  -j, --java-home <path>    JDK 路径（可选）
  -a, --ant-home <path>     Ant 路径（可选）
  -u, --svn-user <user>     SVN 用户名（可选）
  -p, --svn-pass <pass>     SVN 密码（可选）
  -v, --verbose             详细输出

auto-pack 参数:
  -l, --local-path <path>   本地项目路径（必须有 .svn 目录）
  -n, --name <name>         项目名称
  -r, --revisions <revs>    增量版本号列表，逗号分隔
  -o, --output <dir>        输出目录
  -j, --java-home <path>    JDK 路径（可选）
  -a, --ant-home <path>     Ant 路径（可选）
  -v, --verbose             详细输出

示例:
  # 手动指定版本号打包
  $(basename "$0") pack -s https://svn.example.com/svn/Venus4A/ -n Venus4A \\
    -r 64561,64562 -l /e/WorkSpaces_ahdx/Venus4A -o /f/ProjectPackage

  # 自动从本地工作副本打包
  $(basename "$0") auto-pack -l /e/WorkSpaces_ahdx/Venus4A -n Venus4A \\
    -r 64561 -o /f/ProjectPackage

  # 指定 JDK 和 Ant 路径
  $(basename "$0") pack -n Venus4A -r 64561 \\
    -l /e/WorkSpaces_ahdx/Venus4A -o /f/ProjectPackage \\
    -j "D:/Program/Java/jdk1.8.0_202" \\
    -a "E:/devtools/apache-ant-1.10.15-bin/apache-ant-1.10.15"
EOF
}

# ============================================================
# 参数解析
# ============================================================
parse_args() {
    local cmd="$1"
    shift

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -s|--svn-url)     SVN_URL="$2"; shift 2 ;;
            -n|--name)        PROJECT_NAME="$2"; shift 2 ;;
            -r|--revisions)   REVISIONS="$2"; shift 2 ;;
            -l|--local-path)  PROJECT_PATH="$(to_posix_path "$2")"; shift 2 ;;
            -o|--output)      OUTPUT_DIR="$(to_posix_path "$2")"; shift 2 ;;
            -j|--java-home)   JAVA_HOME="$(to_posix_path "$2")"; shift 2 ;;
            -a|--ant-home)    ANT_HOME="$(to_posix_path "$2")"; shift 2 ;;
            -u|--svn-user)    SVN_USER="$2"; shift 2 ;;
            -p|--svn-pass)    SVN_PASS="$2"; shift 2 ;;
            -v|--verbose)     VERBOSE="true"; shift ;;
            -h|--help)        show_usage; exit 0 ;;
            *)                log_error "未知参数: $1"; show_usage; exit 1 ;;
        esac
    done

    # 验证必需参数
    if [[ -z "${PROJECT_NAME}" ]]; then
        log_error "缺少必需参数: -n/--name (项目名称)"
        exit 1
    fi
    if [[ -z "${PROJECT_PATH}" ]]; then
        log_error "缺少必需参数: -l/--local-path (本地项目路径)"
        exit 1
    fi
    if [[ -z "${REVISIONS}" ]]; then
        log_error "缺少必需参数: -r/--revisions (版本号)"
        exit 1
    fi
    if [[ -z "${OUTPUT_DIR}" ]]; then
        log_error "缺少必需参数: -o/--output (输出目录)"
        exit 1
    fi
    if [[ "$cmd" == "pack" && -z "${SVN_URL}" ]]; then
        log_error "pack 模式缺少必需参数: -s/--svn-url (SVN 仓库地址)"
        exit 1
    fi

    # 解析版本号列表
    IFS=',' read -ra REVISION_LIST <<< "${REVISIONS}"

    log_debug "参数汇总:"
    log_debug "  命令: ${cmd}"
    log_debug "  项目: ${PROJECT_NAME}"
    log_debug "  路径: ${PROJECT_PATH}"
    log_debug "  版本: ${REVISIONS}"
    log_debug "  输出: ${OUTPUT_DIR}"
    log_debug "  JDK: ${JAVA_HOME}"
    log_debug "  Ant: ${ANT_HOME}"
}

# ============================================================
# 项目类型检测
# ============================================================
detect_project_type() {
    local project_path="$1"

    if [[ -d "${project_path}/WebRoot" ]]; then
        echo "web"
    elif [[ -d "${project_path}/bin" && -d "${project_path}/lib" ]]; then
        echo "server"
    else
        echo "unknown"
    fi
}

# ============================================================
# 设置 Java 环境
# ============================================================
setup_env() {
    local java_home="$1"
    local ant_home="$2"

    # 设置 JAVA_HOME
    if [[ -n "${java_home}" ]]; then
        local java_home_win
        java_home_win="$(to_win_path "${java_home}")"
        export JAVA_HOME="${java_home_win}"
        export PATH="${java_home_win}/bin:${PATH}"
        log_info "设置 JAVA_HOME=${java_home_win}"
    fi

    # 设置 ANT_HOME
    if [[ -n "${ant_home}" ]]; then
        local ant_home_win
        ant_home_win="$(to_win_path "${ant_home}")"
        export ANT_HOME="${ant_home_win}"
        export PATH="${ant_home_win}/bin:${PATH}"
        log_info "设置 ANT_HOME=${ant_home_win}"
    fi

    # 验证 Java（使用指定 JAVA_HOME 的 java）
    local java_exe="java"
    if [[ -n "${java_home}" ]]; then
        local java_check="${java_home}/bin/java"
        [[ ! -f "${java_check}" ]] && java_check="${java_home}/bin/java.exe"
        if [[ -f "${java_check}" ]]; then
            java_exe="${java_check}"
        fi
    fi

    if ! "${java_exe}" -version &>/dev/null; then
        log_error "Java 不可用，请检查 JAVA_HOME 设置"
        return 1
    fi
    log_info "Java 版本: $("${java_exe}" -version 2>&1 | head -1)"

    # 验证 Ant
    if ! ant -version &>/dev/null; then
        log_warn "Ant 不可用，但不影响打包（仅 Ant 模式需要）"
    else
        log_info "Ant 版本: $(ant -version 2>&1 | head -1)"
    fi
}

# ============================================================
# 执行 ECJ 编译（使用参数文件规避命令行参数过长）
# 当源文件较多时，直接传参会触发 "Argument list too long"（Windows 命令行长度限制）
# 通过 ECJ 参数文件（@argfile）传递源文件列表解决该问题
# 使用 Eclipse ECJ 编译器（java -jar ${ECJ_JAR}）替代 javac，对齐 IDE 编译产物字节码
# 参数: dest_dir classpath memory compile_log java_files...
#   dest_dir   : 编译输出目录（Windows 格式，对应 -d）
#   classpath  : classpath（Windows 格式，对应 -classpath）
#   memory     : 编译内存上限(MB)，作为 java -Xmx JVM 参数
#   compile_log  : 编译日志文件路径
#   java_files : 待编译的源文件列表（POSIX 路径，函数内转换为 Windows 格式）
# 返回: 0 成功，1 失败（失败时已输出日志内容到 stderr）
# ============================================================
compile_java_files() {
    local dest_dir="$1"
    local classpath="$2"
    local memory="$3"
    local compile_log="$4"
    shift 4
    local java_files=("$@")

    # 校验 ECJ jar 存在（缺失则报错，避免模糊失败）
    if [[ ! -f "${ECJ_JAR}" ]]; then
        log_error "ECJ jar 不存在: ${ECJ_JAR}，请检查 auto-package.conf 的 DEFAULT_ECJ_JAR 配置"
        return 1
    fi

    # 将源文件列表写入参数文件，规避命令行参数过长
    # 注意：argfile 内路径不会被 MSYS2 自动转换，需手动转为 Windows 格式并用双引号包裹（防空格）
    local argfile="${compile_log}.argfile"
    : > "${argfile}"
    local jf
    for jf in "${java_files[@]}"; do
        printf '"%s"\n' "$(to_win_path "${jf}")" >> "${argfile}"
    done
    log_debug "  参数文件源文件数: $(wc -l < "${argfile}")"

    local argfile_win
    argfile_win="$(to_win_path "${argfile}")"
    local ecj_jar_win
    ecj_jar_win="$(to_win_path "${ECJ_JAR}")"
    local java_bin="${JAVA_HOME}/bin/java"
    [[ ! -f "${java_bin}" ]] && java_bin="${JAVA_HOME}/bin/java.exe"

    # ECJ 编译：选项对齐 Eclipse .prefs（-1.8/-g/-preserveAllLocals 对应 compliance/debug/unusedLocal=preserve）
    # memory 作为 java -Xmx JVM 参数（-jar 前），替代 javac 的 -J-Xmx
    local rc=0
    "${java_bin}" -Xmx${memory}m -jar "${ecj_jar_win}" \
        -1.8 \
        -g \
        -preserveAllLocals \
        -nowarn \
        -encoding UTF-8 \
        -d "${dest_dir}" \
        -classpath "${classpath}" \
        @"${argfile_win}" > "${compile_log}" 2>&1 || rc=$?
    if [[ ${rc} -ne 0 ]]; then
        cat "${compile_log}" >&2
        rm -f "${argfile}"
        return 1
    fi
    # 过滤 ECJ 警告行（"N. WARNING in"），保留错误行（"N. ERROR in"），其余正常输出
    grep -vE "^[0-9]+\. WARNING in" "${compile_log}" 2>/dev/null || true
    rm -f "${argfile}"
    return 0
}

# ============================================================
# Web 项目：执行增量编译
# ============================================================
run_web_build() {
    local project_path="$1"
    local merged_file="$2"
    local output_dir="$3"

    log_step "执行 Web 项目增量编译（统一打包）"

    local project_path_win
    project_path_win="$(to_win_path "${project_path}")"

    # 创建输出目录结构（对齐 WebRoot/）
    local classes_dir="${output_dir}/WEB-INF/classes"
    mkdir -p "${classes_dir}"

    # 构建 classpath（使用 Windows 路径格式，因为 javac 是 Windows 原生程序）
    local classpath=""
    local lib_dir="${project_path}/WebRoot/WEB-INF/lib"
    local tomcat_lib
    tomcat_lib=$(ls -d /e/devtools/tomcat/*/lib 2>/dev/null | head -1)
    [[ -z "${tomcat_lib}" ]] && tomcat_lib=$(ls -d E:/devtools/tomcat/*/lib 2>/dev/null | head -1)

    local all_jars=()
    while IFS= read -r jar; do
        all_jars+=("$(to_win_path "${jar}")")
    done < <(find "${lib_dir}" -name "*.jar" 2>/dev/null)
    if [[ -n "${tomcat_lib}" ]]; then
        while IFS= read -r jar; do
            all_jars+=("$(to_win_path "${jar}")")
        done < <(find "${tomcat_lib}" -name "*.jar" 2>/dev/null)
    fi

    classpath=""
    for jar in "${all_jars[@]}"; do
        classpath="${classpath}${jar};"
    done

    # 从合并文件中读取变更文件列表（每行格式: op path rev）
    local java_files=()
    local resource_files=()
    log_info "从 SVN 服务器按版本拉取 Java 源码"
    while IFS= read -r line; do
        [[ -z "${line}" ]] && continue
        local op
        op=$(echo "${line}" | awk '{print $1}')
        local file_path
        file_path=$(echo "${line}" | awk '{print $2}')
        file_path="${file_path//\\//}"
        local rev
        rev=$(echo "${line}" | awk '{print $3}')

        [[ "${op}" == "D" ]] && continue

        if [[ "${file_path}" == *.java ]]; then
            # 按版本从 SVN 服务器拉取源码到临时源码目录，再编译（不读本地副本）
            local svn_src_file="${TMP_DIR}/svn_src/${file_path}"
            mkdir -p "$(dirname "${svn_src_file}")"
            fetch_file_from_svn "${SVN_REPO_URL}/${file_path}" "${svn_src_file}" "${rev}" || exit 1
            java_files+=("${svn_src_file}")
            log_debug "  拉取源码 (r${rev}): ${file_path}"
        else
            resource_files+=("${line}")
        fi
    done < "${merged_file}"

    log_debug "  Java文件数: ${#java_files[@]}, 资源文件数: ${#resource_files[@]}"

    # 编译 Java 文件
    if [[ ${#java_files[@]} -gt 0 ]]; then
        log_info "编译 ${#java_files[@]} 个 Java 文件"
        local compile_start
        compile_start=$(date '+%H:%M:%S')
        log_info "编译开始: ${compile_start}"
        local existing_classes
        existing_classes="$(to_win_path "${project_path}/WebRoot/WEB-INF/classes")"
        local full_cp="${existing_classes};${classpath}"

        # 编译失败则中止打包（使用参数文件规避源文件过多时的命令行长度限制）
        local compile_log="${classes_dir}/../compile_output.log"
        if ! compile_java_files "$(to_win_path "${classes_dir}")" "${full_cp}" "${COMPILE_MEMORY}" "${compile_log}" "${java_files[@]}"; then
            log_error "编译失败，打包中止"
            exit 1
        fi
        rm -f "${compile_log}"
        local compile_end
        compile_end=$(date '+%H:%M:%S')
        log_info "编译结束: ${compile_end}"
    else
        log_info "没有需要编译的 Java 文件"
    fi

    # 按版本从 SVN 服务器拉取资源文件（不读本地副本）
    local resource_count=0
    if [[ ${#resource_files[@]} -gt 0 ]]; then
        log_info "从 SVN 服务器按版本拉取 ${#resource_files[@]} 个资源文件"
    fi
    for resource_line in "${resource_files[@]}"; do
        local file_path
        file_path=$(echo "${resource_line}" | awk '{print $2}')
        file_path="${file_path//\\//}"
        local rev
        rev=$(echo "${resource_line}" | awk '{print $3}')

        local rel_path
        if [[ "${file_path}" == src/* ]]; then
            rel_path="WEB-INF/classes/${file_path#src/}"
        elif [[ "${file_path}" == WebRoot/* ]]; then
            rel_path="${file_path#WebRoot/}"
        else
            rel_path="${file_path}"
        fi

        local dest_file="${output_dir}/${rel_path}"
        mkdir -p "$(dirname "${dest_file}")"
        fetch_file_from_svn "${SVN_REPO_URL}/${file_path}" "${dest_file}" "${rev}" || exit 1
        log_debug "  拉取资源 (r${rev}): ${rel_path}"
        resource_count=$((resource_count + 1))
    done

    if [[ ${resource_count} -gt 0 ]]; then
        log_info "已从 SVN 拉取 ${resource_count} 个资源文件"
    fi
}

# ============================================================
# Server 项目：生成增量文件列表
# ============================================================
run_server_build() {
    local project_path="$1"
    local merged_file="$2"
    local output_dir="$3"

    log_step "执行 Server 项目增量编译（统一打包）"

    mkdir -p "${output_dir}/bin"
    mkdir -p "${output_dir}/lib"
    mkdir -p "${output_dir}/run"

    local file_list="${output_dir}/filelist.txt"
    > "${file_list}"

    # 构建 classpath（lib/*.jar + bin/ 已有编译输出）
    local classpath=""
    local lib_dir="${project_path}/lib"
    while IFS= read -r jar; do
        classpath="${classpath}$(to_win_path "${jar}");"
    done < <(find "${lib_dir}" -name "*.jar" 2>/dev/null)
    local bin_dir
    bin_dir="$(to_win_path "${project_path}/bin")"
    classpath="${classpath}${bin_dir};"

    # 从合并文件中读取变更文件（每行格式: op path rev）
    local java_files=()
    local file_count=0
    log_info "从 SVN 服务器按版本拉取变更文件"
    while IFS= read -r line; do
        [[ -z "${line}" ]] && continue

        local op
        op=$(echo "${line}" | awk '{print $1}')
        local file_path
        file_path=$(echo "${line}" | awk '{print $2}')
        file_path="${file_path//\\//}"
        local rev
        rev=$(echo "${line}" | awk '{print $3}')

        [[ "${op}" == "D" ]] && continue

        # 资源文件路径映射：src/ 前缀替换为 bin/，对齐真实 bin 目录结构
        # （src/conf/ehcache.xml -> bin/conf/ehcache.xml，src/DataBase.properties -> bin/DataBase.properties）
        # 其他前缀（lib/、run/ 等）保持原路径
        local rel_path
        if [[ "${file_path}" == src/* ]]; then
            rel_path="bin/${file_path#src/}"
        else
            rel_path="${file_path}"
        fi
        echo "${rel_path}" >> "${file_list}"

        local dest_file="${output_dir}/${rel_path}"

        if [[ "${file_path}" == *.java ]]; then
            # 按版本从 SVN 服务器拉取源码到临时源码目录，再编译（不读本地副本）
            local svn_src_file="${TMP_DIR}/svn_src/${file_path}"
            mkdir -p "$(dirname "${svn_src_file}")"
            fetch_file_from_svn "${SVN_REPO_URL}/${file_path}" "${svn_src_file}" "${rev}" || exit 1
            java_files+=("${svn_src_file}")
            log_debug "  拉取源码 (r${rev}): ${file_path}"
        else
            mkdir -p "$(dirname "${dest_file}")"
            fetch_file_from_svn "${SVN_REPO_URL}/${file_path}" "${dest_file}" "${rev}" || exit 1
            log_debug "  拉取 (r${rev}): ${file_path} -> ${rel_path}"
            file_count=$((file_count + 1))
        fi
    done < "${merged_file}"

    # 编译 Java 文件到 bin/
    if [[ ${#java_files[@]} -gt 0 ]]; then
        log_info "编译 ${#java_files[@]} 个 Java 文件到 bin/"
        local compile_start
        compile_start=$(date '+%H:%M:%S')
        log_info "编译开始: ${compile_start}"
        local compile_log="${output_dir}/../compile_output.log"
        if ! compile_java_files "$(to_win_path "${output_dir}/bin")" "${classpath}" "${COMPILE_MEMORY}" "${compile_log}" "${java_files[@]}"; then
            log_error "编译失败，打包中止"
            exit 1
        fi
        rm -f "${compile_log}"
        local compile_end
        compile_end=$(date '+%H:%M:%S')
        log_info "编译结束: ${compile_end}"
    fi

    log_info "已从 SVN 拉取 ${file_count} 个资源文件"
    log_info "文件列表: ${file_list}"
}

# ============================================================
# 生成 readme.txt
# ============================================================
generate_readme() {
    local output_dir="$1"
    local project_name="$2"
    shift 2
    local revision_list=("$@")

    if [[ "${GEN_README}" != "true" || ${#revision_list[@]} -eq 0 ]]; then
        return
    fi

    log_step "生成版本说明文件"

    local readme_file="${output_dir}/readme.txt"
    local log_dir="${TMP_DIR}"

    {
        echo "========================================"
        echo "项目: ${project_name}"
        echo "打包日期: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "SVN 版本: ${revision_list[*]}"
        echo "========================================"
        echo ""
        echo "版本变更详情:"
        echo "----------------------------------------"
    } > "${readme_file}"

    # 按版本列出变更文件和提交信息
    for rev in "${revision_list[@]}"; do
        echo "" >> "${readme_file}"
        echo "--- 版本 ${rev} ---" >> "${readme_file}"

        # 读取SVN提交信息
        local log_parsed_file="${log_dir}/svn_log_parsed_${rev}.tmp"
        if [[ -f "${log_parsed_file}" ]]; then
            local log_content
            log_content=$(< "${log_parsed_file}")
            local author date msg
            author=$(echo "${log_content}" | awk -F'|' '{print $1}')
            date=$(echo "${log_content}" | awk -F'|' '{print $2}')
            msg=$(echo "${log_content}" | awk -F'|' '{print $3}')
            echo "  提交者: ${author}" >> "${readme_file}"
            echo "  提交日期: ${date}" >> "${readme_file}"
            echo "  提交说明: ${msg}" >> "${readme_file}"
        else
            echo "  提交信息: 无法获取" >> "${readme_file}"
        fi

        echo "  变更文件:" >> "${readme_file}"
        local rev_file="${log_dir}/rev_files_${rev}.txt"
        if [[ -f "${rev_file}" ]]; then
            local rev_content
            rev_content=$(< "${rev_file}")
            if [[ -n "${rev_content}" ]]; then
                echo "${rev_content}" >> "${readme_file}"
            fi
        fi
    done

    # 最终输出汇总
    echo "" >> "${readme_file}"
    echo "----------------------------------------" >> "${readme_file}"
    echo "输出汇总:" >> "${readme_file}"
    echo "  输出目录: ${output_dir}" >> "${readme_file}"
    local total_files
    total_files=$(find "${output_dir}" -type f -not -name "readme.txt" 2>/dev/null | wc -l)
    echo "  文件总数: ${total_files}" >> "${readme_file}"
    echo "" >> "${readme_file}"
    echo "  输出文件列表:" >> "${readme_file}"
    find "${output_dir}" -type f -not -name "readme.txt" -not -name "filelist.txt" 2>/dev/null | \
        sort | sed "s|${output_dir}/|    |" >> "${readme_file}"

    log_info "版本说明文件已生成: ${readme_file}"
}

# ============================================================
# 获取本地 SVN 工作副本版本号
# ============================================================
get_local_svn_revision() {
    local project_path="$1"

    local current_dir
    current_dir=$(pwd)
    cd "${project_path}" 2>/dev/null || {
        log_error "无法切换到项目目录: ${project_path}"
        return 1
    }

    local revision
    revision=$(svn info --show-item revision . 2>/dev/null) || {
        cd "${current_dir}"
        log_error "无法获取本地 SVN 版本号"
        return 1
    }

    cd "${current_dir}"
    echo "${revision}"
}

# ============================================================
# 获取工作副本对应的 SVN 仓库 URL（作为按版本拉取文件的基准）
# 以 svn info 结果为准（与 svn diff 的相对路径基准一致），
# 不使用 -s 参数值，避免其与本地工作副本不一致导致路径对不上
# ============================================================
get_repo_url() {
    local project_path="$1"

    local repo_url
    repo_url=$(cd "${project_path}" 2>/dev/null && svn info --show-item url . 2>/dev/null) || {
        log_error "无法获取 SVN 仓库 URL（需在 SVN 工作副本中执行）: ${project_path}"
        return 1
    }

    [[ -z "${repo_url}" ]] && {
        log_error "SVN 仓库 URL 为空"
        return 1
    }

    # 去掉尾部斜杠，避免拼接文件路径时出现 //
    echo "${repo_url%/}"
}

# ============================================================
# 从 SVN 服务器拉取指定版本的文件内容（替代从本地工作副本读取）
# 使用 peg revision 语法 URL@rev：当文件在目标版本之后被删除/重命名时，
# 仍能取到该历史版本内容（-r 形式会因 HEAD 无此路径而失败）
# 参数: file_url dest_file rev
#   file_url  : 文件在仓库中的完整 URL（项目根 URL + 相对路径）
#   dest_file : 本地保存路径（文件内容写入此处）
#   rev       : 目标版本号
# 返回: 0 成功，1 失败（失败时已输出错误信息并清理残留文件）
# ============================================================
fetch_file_from_svn() {
    local file_url="$1"
    local dest_file="$2"
    local rev="$3"

    if [[ -z "${rev}" ]]; then
        log_error "版本号为空，无法从 SVN 拉取: ${file_url}"
        return 1
    fi

    local err_file="${dest_file}.svn_err"
    if ! svn cat --non-interactive "${file_url}@${rev}" > "${dest_file}" 2>"${err_file}"; then
        log_error "从 SVN 拉取失败 (r${rev}): ${file_url}"
        [[ -s "${err_file}" ]] && sed 's/^/  /' "${err_file}" >&2
        rm -f "${err_file}" "${dest_file}"
        return 1
    fi
    rm -f "${err_file}"
    return 0
}

# ============================================================
# SVN 日期格式化：ISO8601 UTC -> 本地化显示
# svn log --xml 的 <date> 形如 2026-09-07T08:27:48.437646Z（UTC，带微秒）
# 转换为与原 svn log 一致的本地化格式：2026-09-07 16:27:48 +0800 (周日, 07 9月 2026)
# 优先使用 zh_CN.UTF-8 locale 输出中文周几/月份；不可用时降级为纯数字时区格式
# ============================================================
format_svn_date() {
    local iso_date="$1"
    [[ -z "${iso_date}" ]] && { echo "N/A"; return; }

    local formatted
    formatted=$(LC_ALL=zh_CN.UTF-8 date -d "${iso_date}" "+%Y-%m-%d %H:%M:%S %z (%a, %d %b %Y)" 2>/dev/null)
    if [[ -z "${formatted}" ]]; then
        # zh_CN locale 不可用时，降级为不含本地化的纯数字格式
        formatted=$(date -d "${iso_date}" "+%Y-%m-%d %H:%M:%S %z" 2>/dev/null)
    fi
    [[ -z "${formatted}" ]] && formatted="${iso_date}"
    echo "${formatted}"
}

# ============================================================
# 反转义 XML 实体：&amp; &lt; &gt; &quot; &apos;
# 注意：必须先转 &amp;，避免对其他实体中的 & 产生二次替换
# ============================================================
unescape_xml() {
    sed 's/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g; s/&quot;/"/g; s/&apos;/'\''/g'
}

# ============================================================
# 从 svn log --xml 输出中提取 <msg> 内容（支持多行）并反转义实体
# 多行提交说明会被合并为单行（与原逻辑保持一致）
# ============================================================
extract_xml_msg() {
    local xml_file="$1"
    local msg
    # 合并整个 XML 为单行（换行转空格），正则提取 <msg>...</msg> 之间的内容
    # 该方式同时兼容单行和多行提交说明，多行会被合并为空格分隔的单行
    msg=$(tr '\n' ' ' < "${xml_file}" | sed -n 's/.*<msg>\(.*\)<\/msg>.*/\1/p')
    # 反转义 XML 实体
    msg=$(printf '%s' "${msg}" | unescape_xml)
    # 去首尾空格
    msg=$(printf '%s' "${msg}" | sed 's/^ *//;s/ *$//')
    printf '%s' "${msg}"
}

# ============================================================
# 获取多个版本的 SVN 提交信息
# 使用 svn log --xml 获取，XML 输出强制 UTF-8，规避 Windows
# console codepage 导致提交说明中文被替换成 '?' 的乱码问题
# ============================================================
get_svn_log_messages() {
    local project_path="$1"
    shift
    local revisions=("$@")

    local current_dir
    current_dir=$(pwd)
    cd "${project_path}" 2>/dev/null || {
        log_error "无法切换到项目目录: ${project_path}"
        return 1
    }

    local log_dir
    log_dir="${TMP_DIR}"
    mkdir -p "${log_dir}"

    for rev in "${revisions[@]}"; do
        local log_file="${log_dir}/svn_log_${rev}.tmp"
        # --xml 强制 UTF-8 输出，避免提交说明在 GBK console 下丢字符变 '?'
        svn log --xml -r "${rev}" --non-interactive . 2>"${log_dir}/svn_log_err_${rev}.tmp" > "${log_file}" || {
            log_warn "版本 ${rev}: 无法获取 SVN 提交信息"
            echo "N/A|N/A|无法获取提交信息" > "${log_dir}/svn_log_parsed_${rev}.tmp"
            continue
        }

        # svn log --xml 输出示例：
        # <?xml version="1.0" encoding="UTF-8"?>
        # <log>
        # <logentry revision="66591">
        # <author>ma_chunzhi</author>
        # <date>2026-09-07T08:27:48.437646Z</date>
        # <msg>feat:新增集团两级4A变更操作...</msg>
        # </logentry>
        # </log>
        local author iso_date date msg
        author=$(sed -n 's/.*<author>\(.*\)<\/author>.*/\1/p' "${log_file}")
        iso_date=$(sed -n 's/.*<date>\(.*\)<\/date>.*/\1/p' "${log_file}")
        date=$(format_svn_date "${iso_date}")
        msg=$(extract_xml_msg "${log_file}")
        [[ -z "${msg}" ]] && msg="(无提交说明)"

        echo "${author}|${date}|${msg}" > "${log_dir}/svn_log_parsed_${rev}.tmp"
        log_debug "  版本 ${rev}: ${author}, ${date}"
    done

    cd "${current_dir}"
}

# ============================================================
# 统一收集多版本变更文件（从低到高，新文件覆盖旧文件）
# ============================================================
collect_changed_files() {
    local project_path="$1"
    local project_name="$2"
    shift 2
    local revisions=("$@")

    local current_dir
    current_dir=$(pwd)
    cd "${project_path}" 2>/dev/null || {
        log_error "无法切换到项目目录: ${project_path}"
        return 1
    }

    local tmp_dir="${TMP_DIR}"
    mkdir -p "${tmp_dir}"
    local merged_file="${tmp_dir}/merged_files.txt"
    local raw_file="${tmp_dir}/raw_files.txt"
    > "${raw_file}"

    # 按版本号升序排序
    local sorted_revs
    sorted_revs=$(printf "%s\n" "${revisions[@]}" | sort -n)

    for rev in ${sorted_revs}; do
        local base_rev=$((rev - 1))
        log_info "收集版本 ${rev} 变更文件 (${base_rev}:${rev})"

        local svn_output
        svn_output=$(LANG=C LC_ALL=C svn diff --summarize \
            -r "${base_rev}:${rev}" \
            --non-interactive . 2>/dev/null) || {
            log_warn "版本 ${rev}: SVN diff 失败，尝试使用 svn log"
            svn_output=$(LANG=C LC_ALL=C svn log -v -r "${rev}" \
                --non-interactive . 2>/dev/null) || {
                log_warn "版本 ${rev}: SVN 操作失败，跳过"
                continue
            }
            svn_output=$(echo "${svn_output}" | grep -E '^[[:space:]]+[MARD][[:space:]]+' | \
                sed -E 's/^[[:space:]]+([MARD])[[:space:]]+/\1 /' | \
                sed "s|^[MARD] /${project_name}/||" || true)
        }

        # 过滤 IDE 配置文件
        svn_output=$(echo "${svn_output}" | grep -vE '^\s*[MARD]\s+\.(settings|classpath|project|git)/' | \
            grep -vE '^\s*[MARD]\s+\.(settings|classpath|project)$' || true)

        # 保存每个版本的变更文件列表（用于 readme.txt，保持 op path 原始格式）
        echo "${svn_output}" | grep -v '^$' > "${tmp_dir}/rev_files_${rev}.txt" 2>/dev/null || true

        # 追加到原始文件，行末记录该文件对应的版本号（格式: op path rev），
        # 供后续按版本从 SVN 服务器拉取文件内容
        echo "${svn_output}" | grep -v '^$' | sed "s/$/ ${rev}/" >> "${raw_file}"
    done

    # 将原始文件按文件路径去重（行格式: op path rev）
    # 按版本升序追加，因此保留每个路径"最后一次出现"的记录，
    # 即同文件多版本变更时保留最新版本号（用于按版本从 SVN 拉取内容）
    # 输出按各路径首次出现的顺序排列
    awk '{
        path = $2
        # 记录首次出现的顺序
        if (!(path in order)) {
            order[path] = ++count
            seq[count] = path
        }
        # 每次覆盖，最终保留该路径最后一次出现的记录（最新版本）
        content[path] = $0
    }
    END {
        for (i = 1; i <= count; i++) {
            print content[seq[i]]
        }
    }' "${raw_file}" > "${merged_file}"

    cd "${current_dir}"
    echo "${merged_file}"
}

# ============================================================
# 清理临时文件
# ============================================================
cleanup() {
    :
}

# ============================================================
# 主打包流程
# ============================================================
do_package() {
    local project_type="$1"

    log_step "===== 开始打包 ====="
    log_info "项目: ${PROJECT_NAME}"
    log_info "类型: ${project_type}"

    # 输出目录追加项目名
    local final_output_dir="${OUTPUT_DIR}/${PROJECT_NAME}"
    log_info "输出: ${final_output_dir}"

    # 清空输出目录（如果已存在）
    if [[ -d "${final_output_dir}" ]]; then
        log_info "清空输出目录: ${final_output_dir}"
        rm -rf "${final_output_dir}"
    fi
    mkdir -p "${final_output_dir}"

    # 设置环境
    setup_env "${JAVA_HOME}" "${ANT_HOME}" || exit 1

    # 获取工作副本对应的 SVN 仓库 URL（按版本拉取文件的基准，与 svn diff 路径口径一致）
    SVN_REPO_URL=$(get_repo_url "${PROJECT_PATH}") || {
        log_error "获取 SVN 仓库 URL 失败，打包中止"
        exit 1
    }
    log_info "SVN 仓库: ${SVN_REPO_URL}"

    # 清空临时源码目录，保证本次打包源码均为本次按版本拉取（不含历史残留）
    rm -rf "${TMP_DIR}/svn_src"
    mkdir -p "${TMP_DIR}/svn_src"

    # 收集所有版本的变更文件（从低到高，新文件覆盖旧文件）
    local merged_file
    merged_file=$(collect_changed_files "${PROJECT_PATH}" "${PROJECT_NAME}" "${REVISION_LIST[@]}") || {
        log_error "收集变更文件失败，打包中止"
        exit 1
    }

    # 检查是否有变更文件
    if [[ ! -s "${merged_file}" ]]; then
        log_warn "没有找到任何变更文件，打包中止"
        exit 0
    fi

    # 获取SVN提交信息
    get_svn_log_messages "${PROJECT_PATH}" "${REVISION_LIST[@]}"

    # 统一打包
    if [[ "${project_type}" == "web" ]]; then
        run_web_build "${PROJECT_PATH}" "${merged_file}" "${final_output_dir}"
    elif [[ "${project_type}" == "server" ]]; then
        run_server_build "${PROJECT_PATH}" "${merged_file}" "${final_output_dir}"
    fi

    # 生成 readme.txt
    generate_readme "${final_output_dir}" "${PROJECT_NAME}" "${REVISION_LIST[@]}"

    log_step "===== 打包完成 ====="
    log_info "输出目录: ${final_output_dir}"
    ls -la "${final_output_dir}"
}

# ============================================================
# pack 命令处理
# ============================================================
cmd_pack() {
    if [[ ! -d "${PROJECT_PATH}" ]]; then
        log_error "项目路径不存在: ${PROJECT_PATH}"
        exit 1
    fi

    local project_type
    project_type=$(detect_project_type "${PROJECT_PATH}")
    do_package "${project_type}"
}

# ============================================================
# auto-pack 命令处理
# ============================================================
cmd_auto_pack() {
    if [[ ! -d "${PROJECT_PATH}" ]]; then
        log_error "项目路径不存在: ${PROJECT_PATH}"
        exit 1
    fi

    if [[ ! -d "${PROJECT_PATH}/.svn" ]]; then
        log_error "项目路径不是 SVN 工作副本（缺少 .svn 目录）"
        exit 1
    fi

    local local_revision
    local_revision=$(get_local_svn_revision "${PROJECT_PATH}")
    log_info "本地 SVN 版本号: ${local_revision}"

    local project_type
    project_type=$(detect_project_type "${PROJECT_PATH}")
    do_package "${project_type}"
}

# ============================================================
# 主入口
# ============================================================
main() {
    local cmd="${1:-help}"

    load_config

    case "${cmd}" in
        pack)
            shift
            parse_args "pack" "$@"
            cmd_pack
            ;;
        auto-pack)
            shift
            parse_args "auto-pack" "$@"
            cmd_auto_pack
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "未知命令: ${cmd}"
            show_usage
            exit 1
            ;;
    esac
}

# 执行主入口
main "$@"
<#
.SYNOPSIS
    auto-package.ps1 - 自动打包工具（PowerShell 包装器）
.DESCRIPTION
    调用 auto-package.sh 执行打包操作，自动处理 Windows 路径到 POSIX 路径的转换。
    支持 Git Bash 环境下的 auto-package.sh 所有功能。
.EXAMPLE
    .\auto-package.ps1 help
    .\auto-package.ps1 auto-pack -n Venus4A -r 66525 -l D:\WorkSpaces_ahdx\Venus4A -o D:\ProjectPackage
    .\auto-package.ps1 pack -s https://svn.example.com/svn/Venus4A/ -n Venus4A -r 64561 -l D:\Projects\Venus4A -o D:\Output
#>

# 不使用 param() 参数绑定，避免 PowerShell 的 -o 与 -OutVariable 冲突
# 直接通过 $args 手动解析所有参数

function Find-Bash {
    # 从 PATH 中查找
    $bashPath = (Get-Command "bash.exe" -ErrorAction SilentlyContinue).Source
    if ($bashPath) { return $bashPath }

    # 搜索常见安装路径（包括 usr/bin 和 bin 两种子目录）
    $gitRoots = @(
        "$env:ProgramFiles\Git",
        "${env:ProgramFiles(x86)}\Git",
        "$env:LocalAppData\Programs\Git",
        "$env:SystemDrive\Git",
        "D:\Program Files\Git",
        "E:\Program Files\Git"
    )
    foreach ($root in $gitRoots) {
        $paths = @(
            "$root\bin\bash.exe",
            "$root\usr\bin\bash.exe"
        )
        foreach ($p in $paths) {
            if (Test-Path $p) { return $p }
        }
    }
    return $null
}

function ConvertTo-PosixPath {
    param([string]$Path)
    if (-not $Path) { return "" }
    $Path = $Path.Trim('"').Trim("'")
    if ($Path -match '^/[a-zA-Z]/') { return $Path }
    if ($Path -match '^([a-zA-Z]):\\(.*)$') {
        return "/$($matches[1].ToLower())/$($matches[2] -replace '\\', '/')"
    }
    if ($Path -match '^([a-zA-Z]):/(.*)$') {
        return "/$($matches[1].ToLower())/$($matches[2])"
    }
    return $Path
}

function Is-PathParam {
    param([string]$Name)
    return ($Name -eq '-l' -or $Name -eq '--local-path' -or
            $Name -eq '-o' -or $Name -eq '--output' -or
            $Name -eq '-j' -or $Name -eq '--java-home' -or
            $Name -eq '-a' -or $Name -eq '--ant-home')
}

# 查找 bash.exe
$bashExe = Find-Bash
if (-not $bashExe) {
    Write-Host "Error: bash.exe not found. Please install Git for Windows." -ForegroundColor Red
    exit 1
}

# 检查 auto-package.sh 是否存在
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bashScript = Join-Path $scriptDir "auto-package.sh"
if (-not (Test-Path $bashScript)) {
    Write-Host "Error: auto-package.sh not found in $scriptDir" -ForegroundColor Red
    exit 1
}
$bashScriptPosix = ConvertTo-PosixPath $bashScript

# 从 $args 中提取命令（第一个参数）
$command = "help"
$remainingArgs = @()
if ($args.Length -gt 0) {
    $command = $args[0]
    for ($i = 1; $i -lt $args.Length; $i++) {
        $remainingArgs += $args[$i]
    }
}

# 转换路径参数
$bashArgs = @()
$i = 0
while ($i -lt $remainingArgs.Length) {
    $arg = $remainingArgs[$i]
    if (Is-PathParam $arg) {
        $bashArgs += $arg
        $i++
        if ($i -lt $remainingArgs.Length) {
            $converted = ConvertTo-PosixPath $remainingArgs[$i]
            $bashArgs += $converted
        }
    } else {
        $bashArgs += $arg
    }
    $i++
}

# 执行 bash 脚本
try {
    $cmdLine = "`"$bashScriptPosix`" $command"
    if ($bashArgs.Count -gt 0) {
        $argStr = [string]::Join(' ', $bashArgs)
        $cmdLine = "$cmdLine $argStr"
    }
    & $bashExe -c $cmdLine
    exit $LASTEXITCODE
} catch {
    Write-Host "Execution error: $_" -ForegroundColor Red
    exit 1
}
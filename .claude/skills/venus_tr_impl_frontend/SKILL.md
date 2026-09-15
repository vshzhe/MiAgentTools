---
name: venus_tr_impl_frontend
description: 前端页面设计与生成。当用户要进行 Venus4A 项目前端开发、创建 JSP 页面、设计页面组件、选择前端技术栈、修改现有页面或生成页面代码时使用。涵盖组件选择决策（zTree/select2/layui/ymPrompt/ECharts等）和完整页面代码生成。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(*), Bash(pnpm:*), Bash(npm:*), Bash(node:*)
license: MIT
compatibility: 适用 Venus4A 系列项目（JSP + Struts2 + DWR 技术栈）。依赖项目特有的前端库路径（init.jsp、DWR、zTree、select2 等），非 Venus4A 项目需调整路径。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_impl
  generatedBy: "0.1.0"
---

# 前端页面设计与生成 Skill

## 概述

本 SKILL 将 **组件设计决策** 与 **代码模板生成** 合并为单一工作流：
1. **设计阶段**：根据需求选择合适的前端组件和技术方案
2. **生成阶段**：输出完整的 JSP 页面代码

> ⚠️ **适用项目**: Venus4A 系列（JSP + Struts2 + DWR 技术栈）
> 基于 1106 个 JSP 文件的真实扫描统计

---

## Phase 1: 设计决策

### 1.1 真实技术栈全景

#### TOP 10 前端库（按使用文件数排名）

| 排名 | 技术 | 文件数 | 用途 |
|------|------|--------|------|
| 1 | jQuery | 415 | DOM 操作、Ajax |
| 2 | DWR | 165 | 后端异步调用 |
| 3 | calendar.js | 161 | 日期选择 |
| 4 | zTree | 149 | 树形组件 |
| 5 | ymPrompt | 123 | 弹窗提示 |
| 6 | dTree | 69 | 自定义树形 |
| 7 | Bootstrap | ~25 | 样式框架 |
| 8 | ECharts | 18 | 图表可视化 |
| 9 | select2 | 14 | 增强下拉框 |
| 10 | layer | 6 | 弹窗层 |

#### 存在但未使用的库（避免使用）
- jqGrid — 0 文件使用
- Highcharts — 0 文件使用（全部使用 ECharts）
- Angular — 0 文件使用
- jquery-1.12.4.min.js — 虽然存在但无实际引用

#### 仅本地存在的库
- layui v2.2.0 / v2.6.8 — 少数页面使用
- Ace Admin — 3 个文件，后台模板
- bootstrap-fileinput、ckeditor、DataTables — 个别页面

### 1.2 组件选择决策表

| 需求场景 | 推荐组件 | 替代方案 | 关键决策依据 |
|----------|----------|----------|-------------|
| 树形选择（基础） | **zTree** | dTree | zTree 有 149 文件使用；dTree 仅 69 且不支持异步 |
| 树形选择（checkbox多选） | **zTree.excheck** | dTree | zTree 有完整 checkbox 控制（chkboxType） |
| 下拉选择（简单） | **原生 select + util:Option** | — | 零依赖，样式统一 |
| 下拉选择（远程搜索） | **select2** | — | 14 文件使用，支持 Ajax 搜索 |
| 日期选择 | **calendar.js** | My97DatePicker | calendar.js 161 文件 vs My97 仅 5 |
| 图表展示 | **ECharts** | Highcharts/jqGrid | ECharts 18 文件，Highcharts/jqGrid 0 |
| 消息提示 | **ymPrompt** | layer | ymPrompt 123 文件，layer 仅 6 |
| 复杂弹窗交互 | **layer** | ymPrompt | layer 支持 iframe 弹窗 |
| 数据表格 | **html:vectorobject** | jqGrid/DataTables | 自定义标签，0 额外依赖 |
| 分页 | **html:page** | — | 自定义标签，0 额外依赖 |
| 异步调用 | **DWR** | jQuery.ajax | DWR 165 文件，注册 40+ Java 接口 |
| 文本输入 | **util:Text / util:TextArea** | — | 自定义标签，样式统一 |

#### 核心选择原则
1. **zTree > dTree**：优先使用 zTree v3.5.18，除非页面已有 dTree 引用
2. **calendar.js > My97DatePicker**：优先使用 calendar.js，My97 尽量不引入
3. **ECharts >= Highcharts**：ECharts v3.1.5 或 v4.8.0，Highcharts 虽存在但已无实际引用
4. **原生 select > select2**：仅远程搜索场景才用 select2
5. **html:vectorobject > jqGrid**：自定义标签优先，减少额外依赖
6. **ymPrompt > layer**：简单消息提示用 ymPrompt；复杂弹窗用 layer
7. **DWR > jQuery.ajax**：项目已有 40+ Java 接口注册，优先使用 DWR

### 1.3 jQuery 版本选择指南

| 场景 | 推荐版本 | 引入路径 | 原因 |
|------|----------|----------|------|
| 传统页面（IE8兼容） | **v1.8.3** | `./js/jquery.js` | 最大兼容性 |
| Ace Admin 模板 | **v2.1.1** | `./common/assets/js/jquery.2.1.1.min.js` | Ace 模板要求 |
| zTree 页面 | **zTree 自带** | `./zTree_v3/js/jquery.js` | 避免版本冲突 |
| layui 页面 | **layui.$**（内置） | layui 模块化加载 | 混用外部 jQuery 出问题 |
| 现代浏览器 | **v3.6.0** | `./common/assets/js/jquery.3.6.0.min.js` | 最新特性 |

### 1.4 标准引入顺序

~~~
1. JSP 指令和 taglib 声明
2. <%@ include file="/init.jsp"%>（自动引入 frm.js、common.js、calendar.js、style.css）
3. <meta> 标签（编码、兼容性）
4. <title> 标题
5. 【CSS 部分】（按优先级）
   ├─ 基础框架 CSS（bootstrap.min.css）
   ├─ 字体 CSS（font-awesome.min.css）
   ├─ 插件 CSS（select2.css, zTreeStyle.css, layui.css）
   ├─ 自定义主题 CSS（style.css）
   └─ 内联样式 <style>
6. 【JavaScript 部分】（按依赖顺序）
   ├─ DWR 脚本（interface/xxx.js → engine.js → util.js）
   ├─ jQuery 核心库（必须是 JS 第一个）
   ├─ jQuery 插件（jquery-ui, select2, zTree 等）
   ├─ 公共工具 JS（common.js — 已通过 init.jsp 引入）
   ├─ 其他库（layui.js, echarts 等）
   └─ 页面特定 JS
7. 内联脚本 <script>
~~~

### 1.5 IE 兼容性约束

> Venus4A 项目兼容 **IE8+**，禁止使用以下 ES6+ 特性

| 禁止使用 | ES5 替代方案 |
|----------|-------------|
| `const` / `let` | `var` |
| 箭头函数 `() => {}` | `function() {}` |
| 模板字符串 ``...\${}`` | 字符串拼接 `"..." + var` |
| Promise / async/await | 回调函数 |
| fetch | jQuery.ajax / DWR |
| for...of | for 循环 |
| Array.includes / find | indexOf / 手动循环 |
| Object.assign | 手动属性赋值 |
| Map / Set | Object / Array |
| class 语法 | 构造函数 + prototype |
| let 块级作用域 | 函数作用域 |

> 新引入第三方库时**必须确认**其 IE8 兼容性

### 1.6 弹窗技术选择

| 场景 | 推荐方式 | 说明 |
|------|----------|------|
| 消息提示 | `ymPrompt.alert` | 简单提示，import ymPrompt.js |
| 确认对话框 | `ymPrompt.confirm` | 确认/取消，handler 回调 |
| iframe 弹窗 | `layer.open({type: 2})` | 复杂交互弹窗 |
| 新窗口弹窗 | `browser(url, w, h, name)` | 独立页面选择器 |
| 错误提示 | `ymPrompt.error` | 错误消息显示 |

#### browser() 函数注意
- browser() 第 5 个参数控制滚动条：**必须传 `1`** 启用滚动条
- 示例: `browser('url', 800, 600, 'name', 1)`

### 1.7 组件兼容性速查

| 冲突风险 | 说明 | 解决方案 |
|----------|------|----------|
| zTree 自带 jQuery vs 页面已有 jQuery | $ 冲突 | 使用 zTree 目录下 jQuery，保持同一实例 |
| select2 与 ymPrompt | CSS 样式冲突 | 调整样式优先级 |
| layer 与 ymPrompt | 弹窗层级冲突 | 不要混用，选一种 |
| Bootstrap 与 style.css | 样式覆盖 | style.css 在 Bootstrap CSS 之后引入 |

**标准 import 顺序**: DWR → jQuery → 插件 CSS → 插件 JS → common.js → 页面脚本

### 1.8 前端-后端交互方式选择

| 交互场景 | 推荐方式 | 说明 |
|----------|----------|------|
| 简单数据查询 | DWR | 40+ 已注册接口，零配置 |
| 复杂表单提交 | form submit | 传统方式，支持文件上传 |
| 列表查询/刷新 | form submit + state_form.jsp | 保持分页状态 |
| 异步数据刷新 | jQuery.ajax | 灵活的数据交互 |
| 实时推送 | DWR（startGetAuditList） | 监控场景 |

### 1.9 分页参数安全处理

后端设置分页参数时可能使用 Integer 或 String 类型，JSP 中必须做类型兼容处理：

```jsp
<%
    Object pageSizeObj = request.getAttribute("pageSize");
    int pageSizeInt = 15;
    if (pageSizeObj != null) {
        if (pageSizeObj instanceof Integer) {
            pageSizeInt = (Integer) pageSizeObj;
        } else if (pageSizeObj instanceof String) {
            String ps = (String) pageSizeObj;
            if (!"null".equals(ps) && !ps.isEmpty()) {
                pageSizeInt = Integer.parseInt(ps);
            }
        }
    }
%>
```

---

## Phase 2: 页面生成

### 2.0 执行流程

1. **理解需求**：确认页面类型（list/add/edit/detail/tree）、模块、字段
2. **设计决策**：选择合适的组件（Phase 1 决策表）
3. **用户确认**：输出设计方案，获确认后进入生成
4. **生成代码**：按页面类型选择对应模板
5. **配齐组件**：按需引入组件代码（zTree/select2/layui 等）
6. **安全防护**：添加 XSS 防护、分页安全处理
7. **避坑检查**：检查常见错误（附避坑清单）


### 实现模板索引（按需 Read 子文件）

> 本 SKILL 的完整页面/组件/弹窗/路由/样式实现模板拆分为 5 个参考文件，按页面类型与交互场景按需加载（allowed-tools 已含 Read 工具）。执行时按需 Read 对应子文件，不必全部加载，避免上下文膨胀。

| 子文件 | 包含内容 | 何时 Read |
|---|---|---|
| `references/page-templates.md` | 列表/添加/编辑/树形选择页面完整 JSP 模板 | 生成或修改上述页面类型时 |
| `references/component-templates.md` | zTree/select2/ymPrompt/calendar/ECharts/DWR/layui 组件模板 | 页面需要某组件时 |
| `references/popup-selectors.md` | 组织机构/主账号多选/资源选择弹窗 + 父子窗口回传7写法 | 实现选择器弹窗或数据回传时 |
| `references/action-routing.md` | 前端-后端数据传递规范 + Action 路由机制 | 涉及前后端交互、路由配置时 |
| `references/style-and-security.md` | XSS 安全 + 组件速查 + 先查已有实现 + 样式匹配换行规则 | 安全加固、选型前置、修改现有页面时 |

> 子文件路径相对技能目录（如 `.claude/skills/venus_tr_impl_frontend/references/page-templates.md`）。生成页面时先读本 SKILL 的 Phase 1 决策表选型，再按索引 Read 对应实现模板。

---

## 约束与检查清单

### 避坑检查清单（列表/详情页创建前必查）

- [ ] Calendar.setup 在 `</body>` 前独立 script（非 head）？
- [ ] browser() 调用传第 5 参数 `1`（启用滚动条）？
- [ ] state_form.jsp 在 body 末尾（html:pageForm 之后）？
- [ ] sub() 用 `document.form1`（按名）非 `document.forms[0]`？
- [ ] 查询条件分行 + label/value 分列 td + nowrap？
- [ ] 详情弹窗用 browser() + 独立 JSP（非 layer.open 字符串 content）？
- [ ] 图片用 HTML `width` 属性约束（非 CSS max-width）？
- [ ] 用 layer 则显式引入 layer.css？
- [ ] 所有用户输出使用 StringUtils.htmlEncode()？
- [ ] 分页参数做 Integer/String 类型兼容处理？
- [ ] DataStore 列名全小写？方法用 rowCount() 非 size()？
- [ ] 权限检查传 request 参数？
- [ ] init.jsp 在页面顶部引入？

### JSP 页面开发规范

#### 权限检查
```jsp
<%-- 正确：必须传 request 参数 --%>
<% if (LoginBo.isHaveControl(request, RightConstants.XXX)) { %>
    <a href="javascript:openPage();">操作</a>
<% } %>
```

#### DataStore/DataObject 方法
| 正确方法 | 错误方法 | 说明 |
|----------|----------|------|
| `ds.rowCount()` | `ds.size()` | 获取行数 |
| `obj.getInt("column")` | `obj.getInteger("column")` | 获取整数值 |
| `obj.getString("column")` | `obj.getString("COLUMN")` | 列名小写 |

#### 列名大小写
- SQL 中使用小写别名: `SELECT r.id, r.rule_code`
- JSP 中使用小写列名: `obj.getString("rule_code")`

---

## 综合执行步骤

1. **需求分析**：明确页面类型、模块、字段列表、组件需求
2. **设计决策**（Phase 1）：按决策表选择组件、版本、引入路径，设计方案后**向用户确认**
3. **页面生成**（Phase 2）：按页面类型选择模板，填入对应字段和组件
4. **安全加固**：添加 XSS 防护、分页安全处理、权限检查
5. **避坑自检**：逐项检查避坑清单
6. **输出总结**：列出生成的文件、使用的组件、后续注意事项

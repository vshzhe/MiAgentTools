### 2.12 XSS 安全防护

> **所有用户输入输出必须使用 `StringUtils.htmlEncode()` 转义**

```jsp
<%@ page import="cn.com.venustech.venus4a.common.util.StringUtils"%>

<%-- 安全输出 --%>
<input type="text" value="<%=StringUtils.htmlEncode(userInput)%>">

<%-- 搜索条件回显 --%>
<%=StringUtils.htmlEncode(keyword)%>

<%-- 表格数据 --%>
<%=StringUtils.htmlEncode(dataObject.getString("field_name"))%>
```

### 2.13 组件类型速查（标签库对照）

| 组件 | 标签/JS | 数据源 | 说明 |
|------|---------|--------|------|
| 文本输入 | `<util:Text>` | request 属性 | 自定义标签，自动回显 |
| 文本域 | `<util:TextArea>` | request 属性 | 多行文本 |
| 下拉框 | `<util:Option>` | List/Map/NameElement[] | 自定义标签 |
| 数据表格 | `<html:vectorobject>` + `<html:databean>` | DataStore | 遍历数据行 |
| 数据显示 | `<html:show>` | 任意 Java 类型 | 显示 Bean 属性 |
| 分页 | `<html:page>` | 数字参数 | 列表分页 |
| 复选框 | `<input type="checkbox">` + JS | JS 操作 | 配合 checkItems() |
| 单选框 | `<input type="radio">` + JS | JS 操作 | 配合 set_input_checked() |

### 2.14 先查已有实现原则（选型前置要求）

> **重要**：Venus4A 是大型存量项目，选型前必须先判断"项目是否已有同类实现可复用"。盲目按选型表新写代码会破坏一致性，也浪费既有资产。

**决策流程**：

~~~
1. 用 Grep/Glob 搜索目标模块（及相邻模块）是否已有同类组件实现
   例：gotoAddfireWall.jsp 要加树选择 → 先 grep 该页是否已用 zTree
   ↓
2a. 已有实现 → 复用既有组件 + 既有写法（chkboxType/引入路径/回传模式都与既有页面一致）
    ↓ 不按选型表"另起炉灶"，保持模块内风格统一
2b. 无既有实现 → 按本 skill 选型决策表选型（基于真实使用统计）
~~~

**为什么这条原则重要**：
- **一致性优先于"最优"**：某模块若已用 select2 做远程搜索，新同类需求也用 select2，不要因为"layui formSelects 更现代"就换。模块内约定统一 > 跨模块组件最优。
- **既有实现可省工**：项目常有现成 Action 接口和选择器弹窗（如 `UserManagerAction.findUser`、`dataMaskRuleSelect.jsp`、`selectMaster.jsp`），先搜后写，避免重复造轮子。
- **风格匹配**：同一页面的相邻字段（如"业务系统"用 zTree 下拉浮层），新增同类字段应照搬同一交互模式（同样 menuContent 浮层、同样 onCheck 回填），不要引入新弹窗组件。

**搜索方法**：

| 需求 | 搜索什么 | 命令示例 |
|---|---|---|
| 目标页面是否已用某组件 | grep 组件名 | `grep -l "ztree|select2" WebRoot/authorization/firewall/*.jsp` |
| 是否有现成选择器弹窗 | grep 关键词 | `grep -rl "selectMaster|dataMaskRuleSelect" WebRoot/` |
| 是否有现成 Ajax 接口 | grep Action 方法 | `grep -rn "method=findUser|method=findOrg" WebRoot/ src/` |
| 同模块弹窗模式 | grep 弹窗调用 | `grep -l "window.open|layer.open|ymPrompt" WebRoot/datamask/*.jsp` |

**适用判断**：若搜索命中既有实现，本 skill 的选型表让位给"既有实现复用"原则——跟着既有约定走。只有项目无同类实现时，才用选型表做全新决策。

### 2.19 修改现有页面：样式匹配与换行规则

> **⚠️ 重要**：修改现有页面（加按钮/字段等）时，**禁止**直接套用新页面模板的样式，必须先检测现有页面样式模式，保持一致性，避免换行问题。

#### 步骤1：检测现有页面样式模式

修改前必须 Read 目标页面文件，检测以下样式特征：

| 检测项 | 检测方法（搜索关键词） | 关键标识 |
|--------|----------|----------|
| **按钮样式类型** | `left.gif`、`middle.gif`、`input type="button"`、`class="btn"` | 确定使用哪种按钮样式 |
| **表格布局结构** | `liststyle`、`biaodan-`、`table width=` | 确定表格样式类名 |
| **换行控制方式** | `nowrap`、`word-break`、`white-space` | 确定换行处理方式 |
| **间距设置** | `&nbsp;`、`cellspacing`、`cellpadding` | 确定间距规范 |
| **颜色样式** | `STYLE7`、`STYLE3`、`STYLE5` | 确定颜色类名 |

#### 步骤2：3种按钮样式分类与匹配

项目中存在 **3种主要按钮样式**，必须根据现有页面使用的样式进行匹配：

**样式A：图片组合按钮（传统样式，最常用）**

```html
<!-- 检测标识：left.gif + middle.gif + right.gif -->
<table width="80" border="0" cellpadding="0" cellspacing="0">
    <tr>
        <td width="5"><img src="<%=request.getContextPath()%>/images/left.gif" width="5" height="19"></td>
        <td align="center" background="<%=request.getContextPath()%>/images/middle.gif" onclick="xxx()" style="cursor:hand"><span class="STYLE7">按钮文字</span></td>
        <td width="5"><img src="<%=request.getContextPath()%>/images/right.gif" width="5" height="19"></td>
    </tr>
</table>
```
> 特点：三张图片(left/middle/right)拼接成按钮，高度固定 19px，文字白色(STYLE7)。

**样式B：简单 input 按钮**

```html
<!-- 检测标识：input type="button" + class="btn" 或内联样式 -->
<input type="button" value="按钮文字" onclick="xxx()" class="btn">
<!-- 或带内联样式 -->
<input type="button" value="按钮文字" onclick="xxx()" style="background-color:#0033FF;color:white;height:23px;">
```
> 特点：原生 input 按钮，可能带 `class="btn"` 或内联样式。

**样式C：图标按钮（操作列常用）**

```html
<!-- 检测标识：class="iconButton" + edit.gif/delete.gif -->
<a href="javascript:xxx()"><img src="<%=request.getContextPath()%>/images/img/edit.gif" class="iconButton" alt="修改"></a>
<a href="javascript:xxx()"><img src="<%=request.getContextPath()%>/images/img/delete.gif" class="iconButton" alt="删除"></a>
```
> 特点：图片图标 + `class="iconButton"`，常用于列表操作列。

#### 步骤3：样式匹配决策表

| 现有页面检测结果 | 新增按钮应使用样式 | 参考 |
|------------------|-------------------|------|
| 发现 `left.gif/middle.gif/right.gif` | **样式A** 图片组合按钮 | 样式A模板 |
| 发现 `input type="button" class="btn"` | **样式B** 简单input按钮 | `<input type="button" class="btn" ...>` |
| 发现 `iconButton` 且在操作列 | **样式C** 图标按钮 | `<img src="xxx.gif" class="iconButton">` |
| 混合使用多种样式 | **优先匹配最近相邻按钮** | 查看目标位置附近的按钮样式 |
| 无法确定样式 | **询问用户** | "请确认按钮样式：图片按钮/简单按钮/图标按钮" |

#### 步骤4：换行处理规则

**规则1：在 table 同一行内添加元素，勿新增行破坏布局**

```html
<!-- ❌ 错误：新增行导致布局断裂 -->
<tr><td>原有字段</td><td>原有按钮</td></tr>
<tr><td>新增按钮</td></tr>  <!-- 新增行导致换行 -->

<!-- ✅ 正确：在现有行内扩展 td -->
<tr><td>原有字段</td><td>原有按钮</td><td nowrap>新增按钮</td></tr>
```

**规则2：按钮组必须保持在同一 table 结构内**

```html
<!-- ❌ 错误：按钮脱离原有 table -->
</table>
<input type="button" value="新按钮">  <!-- 独立在 table 外 -->
<table>

<!-- ✅ 正确：按钮加入原有按钮 table，使用相同结构 -->
<table border="0" cellpadding="0" cellspacing="0">
    <tr>
        <td class="title5"><table width="80"><!-- 原有按钮结构 -->...</table></td>
        <td class="title5"><table width="80"><!-- 新增按钮，同结构 -->
            <tr>
                <td width="5"><img src="images/left.gif"></td>
                <td align="center" background="images/middle.gif"><span class="STYLE7">新按钮</span></td>
                <td width="5"><img src="images/right.gif"></td>
            </tr>
        </table></td>
    </tr>
</table>
```

**规则3：操作列/按钮列用 `nowrap` 防止换行**

```html
<td align="center" class="liststyle1" nowrap>
    <a href="#"><img src="images/img/edit.gif" class="iconButton"></a>
    <a href="#"><img src="images/img/delete.gif" class="iconButton"></a>
    <a href="#"><img src="images/img/new.gif" class="iconButton"></a>  <!-- 新增图标 -->
</td>
```

**规则4：宽度计算避免超出容器**

```html
<!-- ❌ 错误：新增字段导致总宽度超出 -->
<table width="90%">
    <tr><td width="15%">字段1</td><td width="15%">字段2</td><td width="70%">操作</td></tr>  <!-- 已占满 -->
</table>

<!-- ✅ 正确：重新分配宽度 -->
<table width="90%">
    <tr><td width="12%">字段1</td><td width="12%">字段2</td><td width="10%">新增字段</td><td width="66%">操作</td></tr>
</table>
```

#### 步骤5：修改现有页面执行流程

~~~
1. Read 目标页面文件
   ↓
2. 检测样式模式（按钮类型、表格结构、换行控制）
   ↓
3. 确定匹配样式（参考步骤3决策表）
   ↓
4. 生成修改代码（严格匹配现有样式）
   ↓
5. 检查换行问题（使用 nowrap、宽度计算）
   ↓
6. 展示修改对比（标注新增部分）
   ↓
7. 用户确认后保存
~~~

> **⚠️ 关键提醒**：修改现有页面时，**禁止**直接使用新页面模板的样式；必须**先检测**现有页面样式再生成匹配代码；添加元素时**必须考虑**原有布局的换行控制；无法确定样式时**必须询问用户**。

### 2.1 列表页面模板

> 列表页面使用多个独立 table（标题、搜索、数据列表、分页）。
> **所有动态输出必须使用 `StringUtils.htmlEncode()` 进行转义。**

```jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<%@ page import="com.beststar.framework.common.dao.DataStore"%>
<%@ page import="cn.com.venustech.venus4a.common.util.StringUtils"%>
<HTML>
<HEAD>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>${pageTitle}</TITLE>

<!-- CSS -->
<link rel="stylesheet" href="<%=request.getContextPath()%>/style/style.css" type="text/css">
<link rel="stylesheet" href="<%=request.getContextPath()%>/images/venus4a/ymPrompt.css" type="text/css">

<!-- JS -->
<script type="text/javascript" src="<%=request.getContextPath()%>/js/jquery.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/js/ymPrompt.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/js/common.js"></script>

<style type="text/css">
.STYLE7 { color: #FFFFFF }
.STYLE3 { color: #FF6600 }
.STYLE5 { color: #FF6600; font-weight: bold }
</style>

<script type="text/javascript">
// ——— 弹窗函数 ———
function browser1(url, factorx, factory, n) {
    if (!factorx) factorx = 1;
    if (!factory) factory = 1;
    var l = (factorx > 1) ? (screen.availWidth - factorx) / 2 : screen.availWidth * (1 - factorx) / 2;
    var t = (factorx > 1) ? (screen.availHeight - factory) / 2 : screen.availHeight * (1 - factory) / 2;
    var w = (factorx > 1) ? factorx : factorx * screen.availWidth;
    var h = (factory > 1) ? factory : factory * screen.availHeight;
    if (!n) n = "__popup";
    var bd = window.open(url, n, "left=" + l + ",top=" + t + ",width=" + w + ",height=" + h + ",location=0,titlebar=0,menubar=0,status=0,toolbar=0,scrollbars=1,resizable=1");
    bd.focus();
    bd.moveTo(l, t);
    bd.resizeTo(w, h);
    return bd;
}

function gotoAdd() {
    browser1('<%=request.getContextPath()%>/XXXAction.do?method=toAdd', 0.8, 0.6, 'add');
}

function gotoEdit(id) {
    browser1('<%=request.getContextPath()%>/XXXAction.do?method=toEdit&id=' + id, 0.8, 0.6, 'edit');
}

function gotoDelete(id) {
    ymPrompt.confirm({
        message: '确认删除该记录吗？',
        title: '确认删除',
        handler: function(tp) {
            if (tp == 'ok') {
                $.ajax({
                    type: 'post',
                    url: '<%=request.getContextPath()%>/XXXAction.do?method=delete&id=' + id,
                    dataType: 'json',
                    success: function(data) {
                        if (data && data.status == 1) {
                            ymPrompt.alert({message: '删除成功', handler: function() { location.reload(); }});
                        } else {
                            ymPrompt.error({message: data.message || '删除失败'});
                        }
                    },
                    error: function() {
                        ymPrompt.error({message: '请求失败'});
                    }
                });
            }
        }
    });
}

function search() {
    var keyword = $("#keyword").val();
    location.href = '<%=request.getContextPath()%>/XXXAction.do?method=list&keyword=' + encodeURIComponent(keyword);
}
</script>
</HEAD>
<BODY>
<%@ include file="/state_form.jsp"%>

<!-- 标题区域 -->
<table width="95%" border="0" align="center" cellpadding="0" cellspacing="0">
    <tr>
        <td width="48"><IMG SRC="<%=request.getContextPath()%>/images/6.jpg" WIDTH=48 HEIGHT=47 ALT=""></td>
        <td><table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr><td class="title">${pageTitle}</td></tr>
            <tr><td height="1" background="<%=request.getContextPath()%>/images/line2.gif"></td></tr>
        </table></td>
    </tr>
</table>

<!-- 搜索区域 -->
<form name="form1" method="post" action="XXXAction.do?method=list">
<%
    String keyword = request.getParameter("keyword");
    keyword = keyword != null ? keyword : "";
%>
<table width="90%" border="0" align="center" cellpadding="0" cellspacing="2">
    <tr><td>
        <table border="0" cellpadding="0" cellspacing="0">
            <tr>
                <td align="right">关键字：<input type="text" id="keyword" name="keyword" value="<%=StringUtils.htmlEncode(keyword)%>" size="30" class="biaodan-word"></td>
                <td align="left">
                    <table width="70" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td width="5"><img src="<%=request.getContextPath()%>/images/left.gif" width="5" height="19"></td>
                            <td align="center" background="<%=request.getContextPath()%>/images/middle.gif" onclick="search()" style="cursor:hand"><span class="STYLE7">查询</span></td>
                            <td width="5"><img src="<%=request.getContextPath()%>/images/right.gif" width="5" height="19"></td>
                        </tr>
                    </table>
                </td>
                <td align="left">
                    <table width="70" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td width="5"><img src="<%=request.getContextPath()%>/images/left.gif" width="5" height="19"></td>
                            <td align="center" background="<%=request.getContextPath()%>/images/middle.gif" onclick="gotoAdd()" style="cursor:hand"><span class="STYLE7">新增</span></td>
                            <td width="5"><img src="<%=request.getContextPath()%>/images/right.gif" width="5" height="19"></td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </td></tr>
</table>
</form>

<!-- 数据列表 -->
<form id="lockAll" method="post">
<table width="90%" border="0" align="center" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr class="liststyle">
        <td width="10%" align="center" class="liststyle">序号</td>
        <td width="25%" align="center" class="liststyle">列标题1</td>
        <td width="50%" align="center" class="liststyle">列标题2</td>
        <td width="15%" align="center" class="liststyle">操作</td>
    </tr>
    <html:present name="dataList" scope="request">
        <% int rowIndex = 0; %>
        <html:vectorobject id="item" name="dataList" scope="request">
            <html:databean id="bean" name="item">
                <% rowIndex++; %>
                <tr class="liststyle1" onmouseover="this.className='liststyle2'" onmouseout="this.className='liststyle1'">
                    <td class="liststyle1"><%=rowIndex%></td>
                    <td class="liststyle1" style="word-break:break-all;"><html:show name='bean' type='String' property='field1'/></td>
                    <td class="liststyle1" style="word-break:break-all;"><html:show name='bean' type='String' property='field2'/></td>
                    <td align="center" class="liststyle1" nowrap>
                        <a href="javascript:gotoEdit(<bean:write name='bean' property='id'/>)"><img src="<%=request.getContextPath()%>/images/img/edit.gif" class="iconButton" alt="修改"></a>
                        <a href="javascript:gotoDelete(<bean:write name='bean' property='id'/>)"><img src="<%=request.getContextPath()%>/images/img/delete.gif" class="iconButton" alt="删除"></a>
                    </td>
                </tr>
            </html:databean>
        </html:vectorobject>
    </html:present>
    <% // 空行填充（处理分页参数类型兼容）
        DataStore ds = (DataStore)request.getAttribute("dataList");
        int listCount = ds != null ? ds.rowCount() : 0;
        Object pso = request.getAttribute("pageSize");
        int psi = 15;
        if (pso != null) {
            if (pso instanceof Integer) psi = (Integer)pso;
            else if (pso instanceof String) { String s = (String)pso; if (!"null".equals(s) && !s.isEmpty()) psi = Integer.parseInt(s); }
        }
        int emptyRows = Math.max(0, psi - listCount);
        for (int i = 0; i < emptyRows; i++) {
    %>
    <tr class="liststyle1"><td class="liststyle1">&nbsp;</td><td class="liststyle1">&nbsp;</td><td class="liststyle1">&nbsp;</td><td class="liststyle1">&nbsp;</td></tr>
    <% } %>
</table>

<!-- 分页 -->
<%
    Object rco = request.getAttribute("rowCount");
    int rcv = 0;
    if (rco != null) {
        if (rco instanceof Integer) rcv = (Integer)rco;
        else if (rco instanceof String) { String s = (String)rco; if (!"null".equals(s) && !s.isEmpty()) rcv = Integer.parseInt(s); }
    }
%>
<table width="90%" border="0" align="center" cellpadding="0" cellspacing="0">
    <tr><td height="5"></td></tr>
    <tr><td align="right" class="liststyle4">
        <table border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td align="right">
            <table border="0" cellspacing="3" cellpadding="0"><tr><td align="right">
                <form name="pageForm">
                    <html:page page="XXXAction.do?method=list" pageTag="pageNum" sizeTag="pageSize" pageSize="<%=String.valueOf(psi)%>" totalNum="<%=String.valueOf(rcv)%>">
                        <div align="right">
                            <html:pageInfo />
                            &nbsp;&nbsp;共 <%=rcv%> 条记录&nbsp;&nbsp;
                            <html:pageItem />
                            <html:pageGoto styleClass="bt" />
                        </div>
                    </html:page>
                    <input type="hidden" name="keyword" value="<%=StringUtils.htmlEncode(keyword)%>">
                </form>
            </td></tr></table>
        </td></tr></table>
    </td></tr>
</table>
</form>

<html:pageForm param="gk_param" />
</BODY>
</HTML>
```

### 2.2 添加页面模板

> 所有字段、组件必须放到**同一个主 table** 中（与列表页的多 table 不同）。

```jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<%@ page import="cn.com.venustech.venus4a.common.util.StringUtils"%>
<HTML>
<HEAD>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>${pageTitle}</TITLE>
<link rel="stylesheet" href="<%=request.getContextPath()%>/style/style.css" type="text/css">
<script type="text/javascript" src="<%=request.getContextPath()%>/js/jquery.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/js/common.js"></script>

<script type="text/javascript">
function saveForm() {
    if (validateForm()) {
        document.getElementById("dataForm").submit();
    }
}

function validateForm() {
    var name = document.getElementById("name").value;
    if (name.trim() == "") {
        alert("名称不能为空");
        return false;
    }
    return true;
}
</script>
</HEAD>
<BODY>
<%@ include file="/state_form.jsp"%>

<form id="dataForm" name="dataForm" method="post" action="XXXAction.do?method=save">
<table width="95%" border="0" align="center" cellpadding="0" cellspacing="0">
    <tr><td>&nbsp;</td></tr>
    <tr>
        <td width="48"><IMG SRC="<%=request.getContextPath()%>/images/6.jpg" WIDTH=48 HEIGHT=47 ALT=""></td>
        <td><table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr><td class="title">${pageTitle}</td></tr>
            <tr><td height="1" background="<%=request.getContextPath()%>/images/line2.gif"></td></tr>
        </table></td>
    </tr>
</table>

<!-- 主字段区域：所有组件放同一个 table -->
<table width="60%" border="0" align="center" cellpadding="0" cellspacing="0" class="liststyle4">
    <tr>
        <td width="20%" align="right" class="liststyle" nowrap>字段名称：</td>
        <td width="40%" class="liststyle1">
            <span class="iRequired">*</span>
            <input type="text" id="name" name="name" size="30" class="biaodan-word" maxlength="50">
        </td>
    </tr>
    <tr>
        <td align="right" class="liststyle" nowrap>字段类型：</td>
        <td class="liststyle1">
            <select id="type" name="type" style="width:200px;">
                <option value="">请选择</option>
                <option value="1">类型A</option>
                <option value="2">类型B</option>
            </select>
        </td>
    </tr>
    <tr>
        <td align="right" class="liststyle" nowrap>备注：</td>
        <td class="liststyle1">
            <textarea id="remark" name="remark" rows="3" cols="40" class="biaodan-word" maxlength="200"></textarea>
        </td>
    </tr>
    <tr>
        <td colspan="2" align="center" style="padding:10px;">
            <input type="button" value="保存" onclick="saveForm()" class="button">
            <input type="button" value="关闭" onclick="window.close()" class="button">
        </td>
    </tr>
</table>
</form>
</BODY>
</HTML>
```

### 2.15 编辑页面模板

> **⚠️ 布局规范**：所有字段、组件必须放到**同一个主 table** 中（与列表页多 table 不同），除非用户明确要求分开。
> 编辑页与添加页差异：需回显数据（`set_input_checked` 设单选、`set_select_checked` 设下拉），保存用 `.ajax` 提交到 `method=edit`，成功后回调返回列表。

```jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<HTML>
<HEAD>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>编辑${pageTitle}</TITLE>
<link rel="stylesheet" href="<%=request.getContextPath()%>/style/style.css" type="text/css">
<link rel="stylesheet" href="<%=request.getContextPath()%>/images/venus4a/ymPrompt.css" type="text/css">
<script type="text/javascript" src="<%=request.getContextPath()%>/js/jquery.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/js/ymPrompt.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/js/common.js"></script>

<style type="text/css">
.STYLE7 { color: #FFFFFF }
.STYLE3 { color: #FF6600 }
.STYLE5 { color: #FF6600; font-weight: bold }
</style>

<script type="text/javascript">
function safe(){
    var bn = true;
    var nameVal = $("#name").val();
    if(nameVal == null || nameVal.trim() == ""){
        ymPrompt.alert({message: "请填写名称！"});
        return false;
    }
    return bn;
}
function gotoSubmit(){
    if(safe()){
        $.ajax({
            type: "post",
            url: "<%=request.getContextPath()%>/XXXAction.do?method=edit",
            data: {
                id: "${id}",
                name: $("#name").val(),
                type: $("#type").val(),
                status: $("input[name='status']:checked").val()
            },
            dataType: "json",
            success: function(data){
                if(data && data.status == 1){
                    ymPrompt.alert({message: "修改成功", title: "成功", handler: function(){
                        callbackList("XXXAction.do?method=list");
                    }});
                } else {
                    ymPrompt.error({message: data.message || "修改失败"});
                }
            },
            error: function(){
                ymPrompt.error({message: "请求失败，请重试"});
            }
        });
    }
}
function gotoReset(){
    location.reload();
}
function callbackList(url){
    location.replace(url);
}

// 初始化数据（DOM加载完成后）—— 编辑页回显关键
$(document).ready(function(){
    // 设置单选框选中（name 为 radio name，value 为待回显值）
    set_input_checked('status', '${status}');
    // 设置下拉框选中
    set_select_checked('type', '${type}');
});
</script>
</HEAD>
<BODY BGCOLOR=#FFFFFF LEFTMARGIN=0 TOPMARGIN=0 MARGINWIDTH=0 MARGINHEIGHT=0>
<%@ include file="/state_form.jsp"%>
<%
    String message = (String)request.getAttribute("message");
%>
<center><span style="color: red"><b><%=message == null ? "" : message%></b></span></center>

<form id="form1" name="form1" method="post">
<input type="hidden" id="id" name="id" value="${id}">
<!-- ⚠️ 主容器table：包含标题、字段、按钮所有内容 -->
<table width="95%" border="0" align="center" cellpadding="0" cellspacing="0">
    <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
    <!-- 标题区域 -->
    <tr>
        <td width="48"><IMG SRC="<%=request.getContextPath()%>/images/4.jpg" WIDTH=48 HEIGHT=47 ALT=""></td>
        <td><table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr><td class="title">编辑${pageTitle}</td></tr>
            <tr><td height="1" background="<%=request.getContextPath()%>/images/line2.gif"></td></tr>
        </table></td>
    </tr>
    <!-- 字段区域：在主table内嵌套table -->
    <tr>
        <td>&nbsp;</td>
        <td><table width="100%" border="0" cellpadding="0" cellspacing="2">
            <tr>
                <td width="14%" align="right">名称：</td>
                <td colspan="3">
                    <input type="text" id="name" name="name" size="30" value="${name}" class="biaodan-word">
                    &nbsp;&nbsp;&nbsp;&nbsp;<font color="#FF0000">(* 必填)</font>
                </td>
            </tr>
            <tr>
                <td align="right">类型：</td>
                <td colspan="3">
                    <select id="type" name="type" class="biaodan-work" style="width:150px;">
                        <option value="">请选择</option>
                        <option value="1">类型A</option>
                        <option value="2">类型B</option>
                    </select>
                    &nbsp;&nbsp;&nbsp;&nbsp;<font color="#FF0000">(* 必填)</font>
                </td>
            </tr>
            <tr>
                <td align="right">状态：</td>
                <td colspan="3">
                    <input type="radio" name="status" value="1" class="biaodan-danxuan">启用
                    <input type="radio" name="status" value="0" class="biaodan-danxuan">禁用
                    &nbsp;&nbsp;&nbsp;&nbsp;<font color="#FF0000">(* 必填)</font>
                </td>
            </tr>
            <!-- 更多字段继续添加在此table中... -->
        </table></td>
    </tr>
    <!-- 分隔线 -->
    <tr>
        <td>&nbsp;</td>
        <td><table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr><td height="1" background="<%=request.getContextPath()%>/images/line2.gif"></td></tr>
        </table></td>
    </tr>
    <!-- 按钮区域：图片组合按钮（样式A） -->
    <tr>
        <td>&nbsp;</td>
        <td><table border="0" cellpadding="0" cellspacing="2">
            <tr>
                <td width="80" align="right">&nbsp;</td>
                <td><table border="0" cellpadding="0" cellspacing="2">
                    <tr>
                        <td><table width="260" border="0" cellpadding="0" cellspacing="0">
                            <tr>
                                <td class="title5"><table width="80" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="5"><img src="<%=request.getContextPath()%>/images/left.gif" width="5" height="19"></td>
                                        <td align="center" background="<%=request.getContextPath()%>/images/middle.gif" onclick="gotoSubmit()" style="cursor:hand"><span class="STYLE7">保存</span></td>
                                        <td width="5"><img src="<%=request.getContextPath()%>/images/right.gif" width="5" height="19"></td>
                                    </tr>
                                </table></td>
                                <td><table width="70" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="5"><img src="<%=request.getContextPath()%>/images/left.gif" width="5" height="19"></td>
                                        <td align="center" background="<%=request.getContextPath()%>/images/middle.gif" onclick="gotoReset()" style="cursor:hand"><span class="STYLE7">重置</span></td>
                                        <td width="5"><img src="<%=request.getContextPath()%>/images/right.gif" width="5" height="19"></td>
                                    </tr>
                                </table></td>
                                <td align="left"><table width="80" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="5"><img src="<%=request.getContextPath()%>/images/left.gif" width="5" height="19"></td>
                                        <td align="center" background="<%=request.getContextPath()%>/images/middle.gif"><a href="javascript:callbackList('XXXAction.do?method=list')" style="cursor:hand"><span class="STYLE7">返回列表</span></a></td>
                                        <td width="5"><img src="<%=request.getContextPath()%>/images/right.gif" width="5" height="19"></td>
                                    </tr>
                                </table></td>
                            </tr>
                        </table></td>
                    </tr>
                </table></td>
            </tr>
        </table></td>
    </tr>
    <tr><td width="48">&nbsp;</td><td>&nbsp;</td></tr>
</table>
</form>

</BODY>
</HTML>
```

> **回显工具函数**：`set_input_checked(radioName, value)` 遍历同名 radio/checkbox 勾选匹配项；`set_select_checked(selectId, value)` 设下拉框选中 option。两者均由 `common.js` 提供。

### 2.16 带树形选择的添加页面模板

> **⚠️ 布局规范**：字段、zTree 组件、按钮全部放同一个主 table；zTree 下拉浮层容器 `#menuContent` 放 form 外，绝对定位。
> 交互：点击 `#selectedNames` 输入框弹出 zTree 浮层，`onCheck` 回填 id/name 到隐藏域，`onBodyDown` 点外部收起浮层。

```jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<HTML>
<HEAD>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>添加${pageTitle}</TITLE>
<link rel="stylesheet" href="<%=request.getContextPath()%>/style/style.css" type="text/css">
<link rel="stylesheet" href="<%=request.getContextPath()%>/zTree_v3/css/zTreeStyle/zTreeStyle.css" type="text/css">
<link rel="stylesheet" href="<%=request.getContextPath()%>/images/venus4a/ymPrompt.css" type="text/css">

<!-- ⚠️ zTree自带jQuery，使用zTree目录下的jQuery避免$冲突 -->
<script type="text/javascript" src="<%=request.getContextPath()%>/zTree_v3/js/jquery.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/zTree_v3/js/jquery.ztree.core-3.5.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/zTree_v3/js/jquery.ztree.excheck-3.5.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/js/ymPrompt.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/js/common.js"></script>

<style type="text/css">
.STYLE7 { color: #FFFFFF }
.STYLE3 { color: #FF6600 }
.STYLE5 { color: #FF6600; font-weight: bold }
</style>

<script type="text/javascript">
// ========== zTree配置 ==========
var setting = {
    check: { enable: true, chkboxType: {"Y":"s", "N":"ps"} },
    view: { dblClickExpand: false },
    data: { simpleData: { enable: true, idKey: "id", pIdKey: "pId", name: "name" } },
    callback: { onCheck: onCheck }
};

var zNodes = ${treeNodes}; // 后端提供的JSON数据

// ========== 初始化 ==========
$(document).ready(function(){
    $.fn.zTree.init($("#treeDemo"), setting, zNodes);
    // 回显已选中数据（如有）
    var selectedIds = "${selectedIds}";
    if(selectedIds){
        var treeObj = $.fn.zTree.getZTreeObj("treeDemo");
        var ids = selectedIds.split(",");
        for(var i=0; i<ids.length; i++){
            var node = treeObj.getNodeByParam("id", Number(ids[i]), null);
            if(node) treeObj.checkNode(node, true, true);
        }
    }
});

// ========== zTree事件回调：选中后回填隐藏域 ==========
function onCheck(e, treeId, treeNode) {
    var zTree = $.fn.zTree.getZTreeObj("treeDemo"),
        nodes = zTree.getCheckedNodes(true),
        ids = [], names = [];
    for(var i=0; i<nodes.length; i++){
        ids.push(nodes[i].id);
        names.push(nodes[i].name);
    }
    $("#selectedIds").val(ids.join(","));
    $("#selectedNames").val(names.join(","));
}

// ========== 下拉浮层显隐 ==========
function showTree() {
    var offset = $("#selectedNames").offset();
    $("#menuContent").css({
        left: offset.left + "px",
        top: offset.top + $("#selectedNames").outerHeight() + "px"
    }).slideDown("fast");
    $("body").bind("mousedown", onBodyDown);
}
function hideTree() {
    $("#menuContent").fadeOut("fast");
    $("body").unbind("mousedown", onBodyDown);
}
function onBodyDown(event) {
    if(!(event.target.id=="selectedNames" || event.target.id=="menuContent" || $(event.target).parents("#menuContent").length>0)){
        hideTree();
    }
}

// ========== 表单提交 ==========
function gotoSubmit(){
    var nameVal = $("#name").val();
    if(nameVal == null || nameVal.trim() == ""){
        ymPrompt.alert({message: "请填写名称"});
        return;
    }
    $.ajax({
        type: "post",
        url: "<%=request.getContextPath()%>/XXXAction.do?method=add",
        data: {
            name: $("#name").val(),
            selectedIds: $("#selectedIds").val()
        },
        dataType: "json",
        success: function(data){
            if(data && data.status == 1){
                ymPrompt.alert({message: "添加成功", title: "成功", handler: function(){
                    callbackList("XXXAction.do?method=list");
                }});
            } else {
                ymPrompt.error({message: data.message || "添加失败"});
            }
        },
        error: function(){ ymPrompt.error({message: "请求失败"}); }
    });
}
function callbackList(url){ location.replace(url); }
</script>
</HEAD>
<BODY BGCOLOR=#FFFFFF LEFTMARGIN=0 TOPMARGIN=0 MARGINWIDTH=0 MARGINHEIGHT=0>
<%@ include file="/state_form.jsp"%>

<form id="form1" name="form1" method="post">
<!-- ⚠️ 主容器table：标题+字段+按钮 -->
<table width="95%" border="0" align="center" cellpadding="0" cellspacing="0">
    <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr>
        <td width="48"><IMG SRC="<%=request.getContextPath()%>/images/4.jpg" WIDTH=48 HEIGHT=47 ALT=""></td>
        <td><table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr><td class="title">添加${pageTitle}</td></tr>
            <tr><td height="1" background="<%=request.getContextPath()%>/images/line2.gif"></td></tr>
        </table></td>
    </tr>
    <tr>
        <td>&nbsp;</td>
        <td><table width="100%" border="0" cellpadding="0" cellspacing="2">
            <tr>
                <td width="14%" align="right">名称：</td>
                <td colspan="3">
                    <input type="text" id="name" name="name" size="30" class="biaodan-word">
                    &nbsp;&nbsp;&nbsp;&nbsp;<font color="#FF0000">(* 必填)</font>
                </td>
            </tr>
            <tr>
                <td align="right">选择资源：</td>
                <td colspan="3">
                    <input type="text" id="selectedNames" readonly onclick="showTree()" style="width:200px;cursor:pointer;" class="biaodan-word">
                    <input type="hidden" id="selectedIds" name="selectedIds">
                    &nbsp;&nbsp;&nbsp;&nbsp;<font color="#FF0000">(* 必填)</font>
                </td>
            </tr>
        </table></td>
    </tr>
    <!-- 分隔线 + 按钮区（同编辑页样式A） -->
</table>
</form>

<!-- ⚠️ zTree下拉树容器：放在form外，绝对定位 -->
<div id="menuContent" style="display:none; position:absolute; background-color:#fff; border:1px solid #ccc; z-index:1000;">
    <ul id="treeDemo" class="ztree" style="width:200px; height:300px;"></ul>
</div>

</BODY>
</HTML>
```

> **关键点**：zTree 下拉浮层用 `position:absolute` 的 `#menuContent` 包裹 `<ul id="treeDemo" class="ztree">`；`showTree()` 按触发输入框位置定位浮层；`onBodyDown` 监听 body 点击外部收起。回显用 `getNodeByParam("id", ...)` + `checkNode(node, true, true)`。

/**
 * tr_impl 类型技能模板：前端页面设计与生成（create-page + frontend-design 合并版）。
 *
 * 主 SKILL 承载"设计决策"（Phase 1 组件选型 + 执行流程 + 约束清单），
 * 完整页面/组件/弹窗/路由/样式"实现模板"拆分为 5 个 references 子文件，
 * 主 SKILL 通过索引段引用，AI 按需 Read 加载，避免单文件上下文膨胀。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

const PAGE_TEMPLATES = `### 2.1 列表页面模板

> 列表页面使用多个独立 table（标题、搜索、数据列表、分页）。
> **所有动态输出必须使用 \`StringUtils.htmlEncode()\` 进行转义。**

\`\`\`jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<%@ page import="com.beststar.framework.common.dao.DataStore"%>
<%@ page import="cn.com.venustech.venus4a.common.util.StringUtils"%>
<HTML>
<HEAD>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>\${pageTitle}</TITLE>

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
            <tr><td class="title">\${pageTitle}</td></tr>
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
\`\`\`

### 2.2 添加页面模板

> 所有字段、组件必须放到**同一个主 table** 中（与列表页的多 table 不同）。

\`\`\`jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<%@ page import="cn.com.venustech.venus4a.common.util.StringUtils"%>
<HTML>
<HEAD>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>\${pageTitle}</TITLE>
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
            <tr><td class="title">\${pageTitle}</td></tr>
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
\`\`\`

### 2.15 编辑页面模板

> **⚠️ 布局规范**：所有字段、组件必须放到**同一个主 table** 中（与列表页多 table 不同），除非用户明确要求分开。
> 编辑页与添加页差异：需回显数据（\`set_input_checked\` 设单选、\`set_select_checked\` 设下拉），保存用 \`.ajax\` 提交到 \`method=edit\`，成功后回调返回列表。

\`\`\`jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<HTML>
<HEAD>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>编辑\${pageTitle}</TITLE>
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
                id: "\${id}",
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
    set_input_checked('status', '\${status}');
    // 设置下拉框选中
    set_select_checked('type', '\${type}');
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
<input type="hidden" id="id" name="id" value="\${id}">
<!-- ⚠️ 主容器table：包含标题、字段、按钮所有内容 -->
<table width="95%" border="0" align="center" cellpadding="0" cellspacing="0">
    <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
    <!-- 标题区域 -->
    <tr>
        <td width="48"><IMG SRC="<%=request.getContextPath()%>/images/4.jpg" WIDTH=48 HEIGHT=47 ALT=""></td>
        <td><table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr><td class="title">编辑\${pageTitle}</td></tr>
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
                    <input type="text" id="name" name="name" size="30" value="\${name}" class="biaodan-word">
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
\`\`\`

> **回显工具函数**：\`set_input_checked(radioName, value)\` 遍历同名 radio/checkbox 勾选匹配项；\`set_select_checked(selectId, value)\` 设下拉框选中 option。两者均由 \`common.js\` 提供。

### 2.16 带树形选择的添加页面模板

> **⚠️ 布局规范**：字段、zTree 组件、按钮全部放同一个主 table；zTree 下拉浮层容器 \`#menuContent\` 放 form 外，绝对定位。
> 交互：点击 \`#selectedNames\` 输入框弹出 zTree 浮层，\`onCheck\` 回填 id/name 到隐藏域，\`onBodyDown\` 点外部收起浮层。

\`\`\`jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<HTML>
<HEAD>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>添加\${pageTitle}</TITLE>
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

var zNodes = \${treeNodes}; // 后端提供的JSON数据

// ========== 初始化 ==========
$(document).ready(function(){
    $.fn.zTree.init($("#treeDemo"), setting, zNodes);
    // 回显已选中数据（如有）
    var selectedIds = "\${selectedIds}";
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
            <tr><td class="title">添加\${pageTitle}</td></tr>
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
\`\`\`

> **关键点**：zTree 下拉浮层用 \`position:absolute\` 的 \`#menuContent\` 包裹 \`<ul id="treeDemo" class="ztree">\`；\`showTree()\` 按触发输入框位置定位浮层；\`onBodyDown\` 监听 body 点击外部收起。回显用 \`getNodeByParam("id", ...)\` + \`checkNode(node, true, true)\`。
`;

const COMPONENT_TEMPLATES = `### 2.3 zTree 树形组件模板

\`\`\`jsp
<link rel="stylesheet" href="<%=request.getContextPath()%>/zTree_v3/css/zTreeStyle/zTreeStyle.css" type="text/css">
<script type="text/javascript" src="<%=request.getContextPath()%>/zTree_v3/js/jquery.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/zTree_v3/js/jquery.ztree.core-3.5.js"></script>
<script type="text/javascript" src="<%=request.getContextPath()%>/zTree_v3/js/jquery.ztree.excheck-3.5.js"></script>

<ul id="treeDemo" class="ztree" style="width:180px; height:300px;"></ul>

<script type="text/javascript">
var setting = {
    check: { enable: true, chkboxType: {"Y":"s", "N":"ps"} },
    view: { dblClickExpand: false },
    data: { simpleData: { enable: true, idKey: "id", pIdKey: "pId", name: "name" } },
    callback: {
        beforeClick: function(treeId, treeNode) {
            var zTree = $.fn.zTree.getZTreeObj("treeDemo");
            zTree.checkNode(treeNode, !treeNode.checked, null, true);
            return false;
        },
        onCheck: function(e, treeId, treeNode) {
            var zTree = $.fn.zTree.getZTreeObj("treeDemo"),
                nodes = zTree.getCheckedNodes(true),
                ids = [], names = [];
            for (var i = 0; i < nodes.length; i++) {
                ids.push(nodes[i].id);
                names.push(nodes[i].name);
            }
            $("#selectedIds").val(ids.join(","));
            $("#selectedNames").val(names.join(","));
        }
    }
};

// 后端 JSON: [{id:1, pId:0, name:"节点1"}, ...]
var zNodes = \${nodes};

$(document).ready(function(){
    $.fn.zTree.init($("#treeDemo"), setting, zNodes);
});
</script>
\`\`\`

### 2.4 select2 下拉选择组件

\`\`\`jsp
<link href="<%=request.getContextPath()%>/aaa/css/select2.css" rel="stylesheet">
<script src="<%=request.getContextPath()%>/aaa/js/select2.full.min.js"></script>

<select class="js-example-basic-single" id="selectField" name="selectField" style="width:200px;">
    <option value="">请选择</option>
</select>

<script type="text/javascript">
$(document).ready(function(){
    // 基础初始化
    $("#selectField").select2({ placeholder: "请选择", allowClear: true });

    // Ajax 远程搜索（可选）
    // $("#selectField").select2({
    //     ajax: {
    //         url: "<%=request.getContextPath()%>/XXXAction.do?method=getData",
    //         dataType: 'json', delay: 250,
    //         data: function(params) { return { keyword: params.term }; },
    //         processResults: function(data) { return { results: data.items }; },
    //         cache: true
    //     },
    //     minimumInputLength: 1,
    //     placeholder: "请输入关键字搜索"
    // });

    // 设置选中值
    // $("#selectField").val("\${selectedValue}").trigger("change");
});
</script>
\`\`\`

### 2.5 ymPrompt 弹窗组件

\`\`\`jsp
<link rel="stylesheet" href="<%=request.getContextPath()%>/images/venus4a/ymPrompt.css">
<script src="<%=request.getContextPath()%>/js/ymPrompt.js"></script>

<script type="text/javascript">
ymPrompt.alert({ message: '操作成功!', title: '提示', width: 300, height: 185 });

ymPrompt.confirm({
    message: '确认删除该记录吗？',
    title: '确认',
    handler: function(tp) {
        if (tp == 'ok') { /* 执行删除 */ }
    }
});

ymPrompt.error({ message: '操作失败，请重试!' });
</script>
\`\`\`

### 2.6 calendar 日期选择组件

\`\`\`jsp
<link rel="stylesheet" href="<%=request.getContextPath()%>/js/calendar/calendar.css">
<script src="<%=request.getContextPath()%>/js/calendar/calendar.js"></script>
<script src="<%=request.getContextPath()%>/js/calendar/calendar-setup.js"></script>
<script src="<%=request.getContextPath()%>/js/calendar/calendar-zh.js"></script>

<input type="text" id="startDate" name="startDate" size="16">
<input type="text" id="endDate" name="endDate" size="16">

<script type="text/javascript">
Calendar.setup({ inputField: "startDate", ifFormat: "%Y-%m-%d", showsTime: false, button: "startDateBtn" });
Calendar.setup({ inputField: "endDate", ifFormat: "%Y-%m-%d %H:%M:%S", showsTime: true, button: "endDateBtn" });
</script>
\`\`\`

> ⚠️ Calendar.setup 必须放在 \`</body>\` 前的独立 script 块中（不能在 head 内）

### 2.7 ECharts 图表组件

\`\`\`jsp
<script src="<%=request.getContextPath()%>/common/assets/echarts/echarts.all.min.js"></script>

<div id="chartContainer" style="width:600px;height:400px;"></div>

<script type="text/javascript">
var chart = echarts.init(document.getElementById('chartContainer'));
chart.setOption({
    title: { text: '数据统计' },
    tooltip: {},
    xAxis: { data: ['类别1', '类别2', '类别3'] },
    yAxis: {},
    series: [{ name: '数量', type: 'bar', data: [10, 20, 30] }]
});
</script>
\`\`\`

### 2.8 DWR 调用组件

\`\`\`jsp
<script src='<%=request.getContextPath()%>/dwr/interface/XXXDao.js'></script>
<script src='<%=request.getContextPath()%>/dwr/engine.js'></script>
<script src='<%=request.getContextPath()%>/dwr/util.js'></script>

<script type="text/javascript">
// 1. 基础 DWR 调用
XXXDao.getData(param, function(data) {
    // 处理返回数据
});

// 2. DWR 填充下拉框
function fillSelectByDWR() {
    DWRUtil.removeAllOptions("selectId");
    XXXDao.getOptions(function(list) {
        for (var i = 0; i < list.length; i++) {
            var option = new Option(list[i].name, list[i].id);
            document.getElementById("selectId").add(option);
        }
    });
}

// 3. DWR 实时推送（监控场景）
AccountDao.startGetAuditList(function(data) { updateTable(data); });
// 停止推送: AccountDao.removeListener();
</script>
\`\`\`

### 2.10 layui 组件模板

\`\`\`jsp
<link rel="stylesheet" href="<%=request.getContextPath()%>/js/layui-v2.6.8/layui/css/layui.css">
<script src="<%=request.getContextPath()%>/js/layui-v2.6.8/layui/layui.js"></script>

<script type="text/javascript">
layui.use(['form', 'layer', 'table', 'jquery'], function() {
    var form = layui.form;
    var layer = layui.layer;
    var $ = layui.$;

    // 表单事件
    form.on('submit(formDemo)', function(data) {
        layer.msg('提交成功');
        return false;
    });

    // 弹窗
    layer.open({
        type: 1,
        title: '标题',
        area: ['600px', '400px'],
        content: '内容'
    });
});
</script>
\`\`\`
`;

const POPUP_SELECTORS = `### 2.9 弹窗选择器模板

#### 组织机构选择（dTree + DWR）

\`\`\`jsp
<link rel="StyleSheet" href="<%=request.getContextPath()%>/css/dtree.css" type="text/css" />
<script type="text/javascript" src="<%=request.getContextPath()%>/js/dtree.js"></script>
<script src='<%=request.getContextPath()%>/dwr/interface/OrganiseListDao.js'></script>
<script src='<%=request.getContextPath()%>/dwr/engine.js'></script>

<script type="text/javascript">
var treeList = new dTree('treeList');
treeList.add(0, -1, "组织树", '');

<% // 后端数据
com.beststar.framework.common.dao.DataStore store = (com.beststar.framework.common.dao.DataStore)request.getAttribute("treeList");
if (store != null) {
    for (int i = 0; i < store.rowCount(); i++) {
        String id = store.getString(i, "id");
        String pid = store.getString(i, "parentorgid");
        String name = store.getString(i, "name");
        String autoid = store.getString(i, "autoid");
        if ("-1".equals(pid)) pid = "-5";
%>
    treeList.add(<%=id%>, <%=pid%>, '<%=name%>', <%=autoid%>);
<% }} %>

treeList.write(document.getElementById("treeinfo"));

treeList.update = function() {
    var sel = treeList.getSelected();
    document.getElementById("orgname").value = sel.text;
    document.getElementById("autoid").value = sel.value;
};

function getOrg() {
    if (document.getElementById("autoid").value != "") {
        // 回传父页面
        if (window.opener.document.getElementById("orgName") != undefined)
            window.opener.document.getElementById("orgName").value = document.getElementById("orgname").value;
        if (window.opener.document.getElementById("orgId") != undefined)
            window.opener.document.getElementById("orgId").value = document.getElementById("autoid").value;
        window.close();
    } else {
        alert("请选择组织");
    }
}
</script>
\`\`\`

### 2.17 主账号多选弹窗选择器（组织树 + 左右双列表）

> **完整示例参考**: \`WebRoot/account/userprimaryselect/selectMaster.jsp\`
> **特点**：dTree 组织树 + 左侧账号列表 + 右侧已选列表 + DWR 搜索/加载 + 已选回显 + 多选数据回传。

**父页面调用**：

\`\`\`jsp
<script type="text/javascript">
function selectMaster(){
    browser('<%=request.getContextPath()%>/UserPrimarySelect.do?method=toSelect', 600, 500, 'masterSelect');
}
// ⚠️ 弹窗回调函数（弹窗关闭后由 window.opener.location="javascript:exePara()" 触发）
function exePara(){
    var masterinfo = document.getElementById("masterinfo").value;
    // 处理选中数据，刷新页面显示...
}
</script>

<!-- 父页面隐藏域 -->
<input type="hidden" id="masterid" name="masterid">
<input type="hidden" id="masterinfo" name="masterinfo">
<!-- masterinfo格式：master_id,master_name,master_type,master_realname,orgid,orgname;多个用分号分隔 -->
\`\`\`

**弹窗页面骨架**（DWR 异步加载）：

\`\`\`jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<HTML>
<HEAD>
<base target="_self">
<TITLE>主账号选择</TITLE>
<link rel="StyleSheet" href="<%=request.getContextPath()%>/css/dtree.css" type="text/css" />
<script type="text/javascript" src="<%=request.getContextPath()%>/js/dtree.js"></script>
<script src='dwr/interface/UserPrimarySelectDao.js'></script>
<script src='dwr/engine.js'></script>
<script src='dwr/util.js'></script>
<script language="JavaScript">
String.prototype.Trim = function() { return this.replace(/(^\\s*)|(\\s*$)/g, ""); }
</script>
</HEAD>
<BODY>
<!-- 搜索框 -->
主帐号：<input type="text" id="mastername" size="20">
<input type="button" value="查询" onclick="getFindMaster()">
<br>所属组织：<span id="orgNameStr"></span>

<!-- 左侧组织树 + 中间移动按钮 + 右侧已选列表 -->
<table>
    <tr>
        <td width="180" valign="top">
            <div id="treeinfo" style="width:250px;height:280px;overflow:scroll"></div>
        </td>
        <td width="100" valign="top">
            <select style="width:140px;height:280px;" name="listleft" id="listleft" size="20" multiple="multiple" onchange="changeMaster(this);">
            </select>
        </td>
        <td valign="top">
            <table>
                <tr><td><img src="images/right1.gif" onClick="gotoRight()"></td></tr>
                <tr><td><img src="images/right2.gif" onClick="gotoRightAll()"></td></tr>
                <tr><td><img src="images/left2.gif" onClick="gotoLeftAll()"></td></tr>
                <tr><td><img src="images/left1.gif" onClick="gotoLeft()"></td></tr>
            </table>
        </td>
        <td valign="top">
            <select style="width:140px;height:280px;" name="listright" id="listright" size="20" multiple="multiple">
            </select>
        </td>
    </tr>
</table>

<script type="text/javascript">
// ⚠️ treeItem数组存储树节点信息，供changeMaster使用
var treeItem = new Array();
var treeList = new dTree('treeList');
treeList.config.useIcon = false;
treeList.config.useCheckbox = false;
treeList.add(0, -1, "组织树", '');
treeList.add(-5, 0, "内部组织", '');  // 内部组织挂载到 -5
treeList.add(-4, 0, "外部组织", '');  // 外部组织挂载到 -4

<%
// ===== 内部组织（从 request.treeList 构建）=====
com.beststar.framework.common.dao.DataStore store = (com.beststar.framework.common.dao.DataStore)request.getAttribute("treeList");
if(store != null){
    for(int i=0; i<store.rowCount(); i++){
        String id = store.getString(i, "id");
        String parent_id = store.getString(i, "parentorgid");
        String name = store.getString(i, "name");
        String autoid = store.getString(i, "autoid");
        if("-1".equals(parent_id)) parent_id = "-5";
%>
        treeItem[<%=i%>] = new Array(<%=id%>, <%=parent_id%>, "<%=name%>", "<%=autoid%>");
        treeList.add(<%=id%>, <%=parent_id%>, '<%=name%>', <%=autoid%>);
<%
    }
}
%>

treeList.write(document.getElementById("treeinfo"));

// 点击组织节点 → DWR 加载该组织下主账号
treeList.update = function(){
    var sel = treeList.getSelected();
    getAccounts(sel.text, sel.value);
};

// DWR加载主账号列表
function getAccounts(name, orgid){
    if(orgid != ""){
        document.getElementById("orgname").value = name;
        document.getElementById("autoid").value = orgid;
        document.getElementById("orgNameStr").innerHTML = name;
        DWRUtil.removeAllOptions("listleft");
        UserPrimarySelectDao.getMasterList(orgid, function(list){
            for(var i=0; i<list.length; i++){
                // ⚠️ 数据格式：master_id,master_name,master_type,master_realname,orgid,orgname
                var option = new Option(list[i].master_realname,
                    list[i].master_id+","+list[i].master_name+","+list[i].master_type+","+list[i].master_realname+","+orgid+","+name);
                document.getElementById("listleft").add(option);
            }
        });
    } else {
        document.getElementById("listleft").options.length = 0;
    }
}

// DWR搜索主账号（按名称跨组织搜索）
function getFindMaster(){
    var mastername = document.getElementById("mastername").value;
    if(mastername.Trim() != ""){
        DWRUtil.removeAllOptions("listleft");
        UserPrimarySelectDao.findMasterList(mastername, function(list){
            for(var i=0; i<list.length; i++){
                var option = new Option(list[i].master_realname,
                    list[i].master_id+","+list[i].master_name+","+list[i].master_type+","+list[i].master_realname+","+list[i].orgof_id+","+list[i].orgof_name);
                document.getElementById("listleft").add(option);
            }
        });
    } else {
        alert("请输入要查询的主帐号");
        document.getElementById("listleft").options.length = 0;
    }
}

// ⚠️ 选中左侧项时展开组织树到对应节点
function changeMaster(select){
    var values = select.value.split(",");
    document.getElementById("orgNameStr").innerHTML = values[5];
    treeList.openTo(values[4]); // 展开到组织ID
}

// ⚠️ 页面加载时从父页面回显已选数据
selectedMaster();
function selectedMaster(){
    var masterinfo = window.opener.document.getElementById("masterinfo").value;
    if(masterinfo != ""){
        var select_root = document.getElementById("listright");
        select_root.options.length = 0;
        var masterinfo_list = masterinfo.split(";");
        for(var i=0; i<masterinfo_list.length; i++){
            if(masterinfo_list[i] != ""){
                var msinfo = masterinfo_list[i].split(",");
                if(msinfo[0].trim() != "" && msinfo.length >= 6){
                    var option = new Option(msinfo[3], masterinfo_list[i]);
                    select_root.add(option);
                }
            }
        }
    }
}

// 确认选择：收集右侧已选 → 回传父页面 → 触发回调 → 关闭
function getOrg(){
    var str_obj = document.getElementById("listright");
    var str = "";
    for(var i=0; i<str_obj.length; i++){
        str += (str == "" ? "" : ";") + str_obj.options[i].value;
    }
    if(str != ""){
        // 解析出 masterid 列表
        var userinfo = str.split(";");
        var masterid = "";
        for(var i=0; i<userinfo.length; i++){
            var temp = userinfo[i].split(",");
            if(temp != null && temp.length >= 4){
                masterid += (masterid == "" ? "" : ",") + temp[0];
            }
        }
        window.opener.document.getElementById("masterid").value = masterid;
        window.opener.document.getElementById("masterinfo").value = str;
    } else {
        window.opener.document.getElementById("masterid").value = "";
        window.opener.document.getElementById("masterinfo").value = "";
    }
    // ⚠️ 触发父页面回调
    window.opener.location = "javascript:exePara()";
    window.close();
}
</script>

<input type="hidden" id="orgname">
<input type="hidden" id="autoid">
<table align="center">
    <tr>
        <td><input type="button" value="确认" onclick="getOrg()"></td>
        <td><input type="button" value="关闭" onclick="window.close()"></td>
    </tr>
</table>
</BODY>
</HTML>
\`\`\`

> **⚠️ 注意事项**：
> - 内部组织挂 \`-5\` 节点，外部组织挂 \`-4\` 节点；\`parentorgid=-1\` 的归到 \`-5\`。
> - \`treeItem\` 数组存储节点信息供 \`changeMaster\` 展开。
> - \`selectedMaster()\` 在页面加载时从 \`window.opener.masterinfo\` 回显已选到右侧列表。
> - 数据格式：\`master_id,master_name,master_type,master_realname,orgid,orgname\`；多项用分号 \`;\` 分隔。
> - 回传后用 \`window.opener.location = "javascript:exePara()"\` 触发父页面回调。

### 2.18 资源选择弹窗（dTree 单选 + DWR 搜索 + 多场景回传）

> **完整示例参考**: \`WebRoot/account/resTree.jsp\`
> **特点**：dTree 单选树（资源组 type=0 / 资源 type=1）+ DWR 按名称/IP 搜索 + \`getFlag\` 区分回传场景（1=添加从账号、2=其他）+ 扩展信息用 \`@^@\` 分隔。

**父页面调用**：

\`\`\`jsp
<script type="text/javascript">
// getFlag参数：1=添加从账号，2=其他场景
function selectResource(){
    browser('<%=request.getContextPath()%>/ResourceAction.do?method=toSelect&getFlag=1', 500, 450, 'resSelect');
}
</script>

<!-- 父页面隐藏域（接收回传） -->
<input type="hidden" id="resid" name="resid">
<input type="hidden" id="resname" name="resname">
<input type="hidden" id="res_type" name="res_type">
<input type="hidden" id="unix_systype" name="unix_systype">
<input type="hidden" id="db_type" name="db_type">
<input type="hidden" id="resip" name="resip">
\`\`\`

**弹窗页面骨架**：

\`\`\`jsp
<%@ page contentType="text/html; charset=UTF-8" language="java"%>
<%@ include file="/init.jsp"%>
<%@ page import="cn.com.venustech.venus4a.common.util.StringUtils"%>
<HTML>
<HEAD>
<TITLE>资源选择</TITLE>
<link rel="StyleSheet" href="<%=request.getContextPath()%>/css/dtree.css" type="text/css" />
<script type="text/javascript" src="<%=request.getContextPath()%>/js/dtree.js"></script>
<script type='text/javascript' src='<%=request.getContextPath()%>/dwr/interface/ResourceDao.js'></script>
<script type='text/javascript' src='<%=request.getContextPath()%>/dwr/engine.js'></script>
<script type='text/javascript' src='<%=request.getContextPath()%>/dwr/util.js'></script>
</HEAD>
<BODY>
<!-- 搜索条件 -->
资源名称：<input type="text" id="resnameforsearch" size="16">
资源IP：<input type="text" id="resipforsearch" size="16">
<input type="button" value="查询" onclick="searchRes()">

<div id="treeContainer" class="dtree" style="width:100%;height:400px;overflow:scroll;border:1px solid #ADC1FA"></div>
<input type="hidden" name="resid" id="resid">
<input type="hidden" name="resname" id="resname">

<script type="text/javascript">
<%
// ⚠️ 获取场景参数
String getFlag = (String)request.getAttribute("getFlag");
String getPage = (String)request.getAttribute("getPage");
%>

treeList = new dTree('treeList');
treeList.config.useCheckbox = false;
// 根节点（type=0 表示资源组）
treeList.add(1, 0, '资源', '', '', '', '', '', 'img/folder.gif', 'img/folderopen.gif', '0');

<%
// ===== 资源组节点（type=0，文件夹图标）=====
com.beststar.framework.common.dao.DataStore store = (com.beststar.framework.common.dao.DataStore)request.getAttribute("tree_store");
for(int i=0; i<store.rowCount(); i++){
    String id = store.getString(i, "id");
    String parent_id = store.getString(i, "pid");
    String name = store.getString(i, "name");
    if("-1".equals(parent_id)) parent_id = "0";
%>
    treeList.add(<%=id%>, <%=parent_id%>, '<%=name%>', '', '', '', '', '', 'img/folder.gif', 'img/folderopen.gif', '0');
<%
}

// ===== 资源节点（叶子，type=1，value传递扩展信息）=====
com.beststar.framework.common.dao.DataStore treeLeafStore = (com.beststar.framework.common.dao.DataStore)request.getAttribute("tree_leaf_store");
for(int i=0; i<treeLeafStore.rowCount(); i++){
    String lid = treeLeafStore.getString(i, "id");
    String lparent_id = treeLeafStore.getString(i, "pid");
    String lname = treeLeafStore.getString(i, "name");
    // ⚠️ 扩展信息（用于从账号添加场景，用 @^@ 分隔）
    String name = treeLeafStore.getString(i, "name");
    if(getFlag.equals("1") || getFlag.equals("2")){
        name = name + "@^@" + treeLeafStore.getString(i, "type")
                  + "@^@" + treeLeafStore.getString(i, "unix_systype")
                  + "@^@" + treeLeafStore.getString(i, "db_type")
                  + "@^@" + treeLeafStore.getString(i, "ip")
                  + "@^@" + treeLeafStore.getInt(i, "acctsetowned");
    }
    // ⚠️ IPv6 支持
    String ip = treeLeafStore.getString(i, "ip");
    String ipvsix = treeLeafStore.getString(i, "ipvsix");
    if(!StringUtils.isNull(ipvsix) && !StringUtils.isNull(ip)){
        ip = ip + "/" + ipvsix;
    } else if(!StringUtils.isNull(ipvsix)){
        ip = ipvsix;
    }
    if("-1".equals(lparent_id)) lparent_id = "0";
    if(!StringUtils.isNull(ip) && !"null".equals(ip)){
        lname += "(" + ip + ")";
    }
%>
    // 资源节点（叶子），type=1，value 承载扩展信息
    treeList.add(<%=lid%>, <%=lparent_id%>, '<%=lname%>', '<%=name%>', '', '', '', '', '', '', '1');
<%
}
%>

treeList.write(document.getElementById("treeContainer"));

// ⚠️ 点击节点时更新选中值（仅资源节点 type=1 可选）
treeList.update = function(){
    var sel = treeList.getSelected();
    if(sel.type == 1){
        document.getElementById("resid").value = sel.id;
        document.getElementById("resname").value = sel.value;
    }
};

// DWR搜索资源（按名称+IP）
function searchRes(){
    var resname = document.getElementById("resnameforsearch").value;
    var ip = document.getElementById("resipforsearch").value;
    if((resname == null || resname == "") && (ip == null || ip == "")){
        alert("请输入查询条件！");
        return;
    }
    ResourceDao.findResID(resname, ip, function(ids){
        if(ids == null){ alert("未找到满足条件的资源"); return; }
        if(ids.length == 1){
            treeList.openTo(ids);
            document.getElementById("resid").value = treeList.getSelected(ids).id;
            document.getElementById("resname").value = treeList.getSelected(ids).value;
        } else if(ids.length > 1){
            treeList.openTo(ids[0]);
            document.getElementById("resid").value = treeList.getSelected(ids[0]).id;
            document.getElementById("resname").value = treeList.getSelected(ids[0]).value;
            alert("记录不唯一，请手动选择！");
        } else {
            alert("未找到满足条件的资源");
        }
    });
}

// ⚠️ 确认选择（多场景回传，按 getFlag 分支）
function setRes(){
    if(document.getElementById("resid").value != ""){
        if(window.opener.document.getElementById("resid") != undefined) {
            window.opener.document.getElementById("resid").value = document.getElementById("resid").value;
        }
        var getFlag = "<%=getFlag%>";
        // ⚠️ getFlag=1: 添加从账号场景，解析扩展信息回传多字段
        if(getFlag == "1"){
            var list = document.getElementById("resname").value.split("@^@");
            if(window.opener.document.getElementById("resname") != undefined)
                window.opener.document.getElementById("resname").value = list[0];
            if(window.opener.document.getElementById("res_type") != undefined)
                window.opener.document.getElementById("res_type").value = list[1];
            if(window.opener.document.getElementById("unix_systype") != undefined)
                window.opener.document.getElementById("unix_systype").value = list[2];
            if(window.opener.document.getElementById("db_type") != undefined)
                window.opener.document.getElementById("db_type").value = list[3];
            if(window.opener.document.getElementById("resip") != undefined)
                window.opener.document.getElementById("resip").value = list[4];
            // owned=3/4/5 走特殊页面，否则按资源类型分流
            var owned = list[5];
            if(owned != null && (owned == 3 || owned == 4 || owned == 5)){
                window.opener.location.href = "SlaveAccManager.do?actionType=addAccInIt&resId=" + document.getElementById("resid").value + "&resRelation=1";
            } else {
                var type = window.opener.document.getElementById("res_type").value;
                if(type == "null"){
                    window.opener.location.href = "SlaveAppRes.do?actionType=nextYY&resId=" + document.getElementById("resid").value;
                } else {
                    window.opener.refulsh();
                }
            }
        }
        // ⚠️ getFlag=2: 其他场景，只回传 resid/resname/db_type
        else if(getFlag == "2"){
            var list = document.getElementById("resname").value.split("@^@");
            if(window.opener.document.getElementById("resid") != undefined)
                window.opener.document.getElementById("resid").value = document.getElementById("resid").value;
            if(window.opener.document.getElementById("resname") != undefined)
                window.opener.document.getElementById("resname").value = list[0];
            if(window.opener.document.getElementById("db_type") != undefined)
                window.opener.document.getElementById("db_type").value = list[3];
        }
        // ⚠️ 默认场景
        else {
            if(window.opener.document.getElementById("resname") != undefined)
                window.opener.document.getElementById("resname").value = document.getElementById("resname").value;
        }
        window.close();
    } else {
        alert("请选择资源");
    }
}
</script>

<table align="center">
    <tr>
        <td><input type="button" value="确认" onclick="setRes()"></td>
        <td><input type="button" value="关闭" onclick="window.close()"></td>
    </tr>
</table>
</BODY>
</HTML>
\`\`\`

> **⚠️ 注意事项**：
> - \`getFlag\` 区分场景：\`1\`=添加从账号（回传多字段+分流），\`2\`=其他（回传 resid/resname/db_type）。
> - 资源节点扩展信息：\`name@^@type@^@unix_systype@^@db_type@^@ip@^@acctsetowned\`。
> - 支持 IPv6（\`ipvsix\` 字段，有则拼接 \`ip/ipvsix\`）。
> - 资源组节点 \`type=0\`（文件夹图标，不可选），资源节点 \`type=1\`（叶子，可选）。
> - 不同 \`getFlag\` 场景的回传字段和后续跳转逻辑不同，必须按分支处理。

### 2.21 父子窗口数据回传7种写法

> 项目**统一用 \`window.opener\` 通信**回传选择器弹窗数据（不用 ymPrompt 的 doHandler/getArgument，项目零调用）。
> 按回传数据形态和触发方式，沉淀为 7 种写法，按场景选用。

#### 写法 A — 直接写父页面表单字段（最常用，单选场景）

\`\`\`javascript
// 子页面（选择器弹窗）确认后回传
function confirmSelect() {
    var selectedId = document.getElementById("selectedId").value;
    var selectedName = document.getElementById("selectedName").value;
    if (window.opener.document.getElementById("targetId") != undefined) {
        window.opener.document.getElementById("targetId").value = selectedId;
    }
    if (window.opener.document.getElementById("targetName") != undefined) {
        window.opener.document.getElementById("targetName").value = selectedName;
    }
    window.close();
}
\`\`\`
> 真实示例：\`authorization/assessor/selectMaster.jsp\`。

#### 写法 B — 回调父页面函数（字符串数据 + 触发父方法）

\`\`\`javascript
// 子页面
function confirmSelect() {
    var data = "id,name,type";
    window.opener.document.getElementById("selectedData").value = data;
    window.opener.location = "javascript:exeCallback('" + data + "')";  // 触发父页面函数
    window.close();
}
\`\`\`

\`\`\`javascript
// 父页面定义回调
function exeCallback(data) {
    var arr = data.split(",");
    document.getElementById("selectedId").value = arr[0];
    document.getElementById("selectedName").value = arr[1];
    refreshRelatedData();
}
\`\`\`
> 真实示例：\`account/userprimaryselect/selectMaster.jsp\`（\`window.opener.location = "javascript:exePara()"\`）。

#### 写法 C — 直接调用父页面函数（多分支，按场景分流）

\`\`\`javascript
// 子页面按 pagetype/isExcludeMode 分流回传到不同字段
if (pagetype && pagetype == 'fileapproval') {
    window.opener.document.getElementById("approvalmasterid_tmp").value = masterid;
    window.opener.document.getElementById("approvalmasterinfo_tmp").value = str;
} else if (isExcludeMode) {
    window.opener.document.getElementById("excludeMasterid").value = masterid;
    window.opener.document.getElementById("excludeMasterinfo").value = str;
} else {
    window.opener.document.getElementById("masterid").value = masterid;
    window.opener.document.getElementById("masterinfo").value = str;
}
if (isExcludeMode) {
    window.opener.location = "javascript:exeExcludeMaster()";
} else {
    window.opener.location = "javascript:exePara()";
}
\`\`\`
> 真实示例：\`authorization/assessor/selectMaster.jsp\`。

#### 写法 D — 对象数组回传（多选，传结构化数据）

\`\`\`javascript
// 子页面
function getSelectedRules() {
    updateSelectedRules();
    return selectedRules;   // 对象数组 [{id, name, ...}, ...]
}
function confirmSelection() {
    updateSelectedRules();
    if (selectedRules.length == 0) { alert("请至少选择一个规则"); return; }
    if (window.opener && window.opener.receiveSelectedRules) {
        window.opener.receiveSelectedRules(selectedRules);
    }
    window.close();
}
\`\`\`
> 真实示例：\`datamask/dataMaskRuleSelect.jsp\`。

#### 写法 E — layer iframe 子方法调用（layer.open type:2）

\`\`\`javascript
// 父页面（layer.open 的 yes 回调）
yes: function(index, layero) {
    var iframeWin = window[layero.find('iframe')[0]['name']];
    var status = iframeWin.saveClientRegister();   // 调子 iframe 方法回传
    if (status == '0') {
        reload($("#pid").val(), $("#id").val());
        layer.close(index);
        return true;
    }
    return false;
}
\`\`\`
> 真实示例：\`personalfolder/folderFileList.jsp\`。

#### 写法 F — 子页面调父方法 + 关闭（仅触发刷新，不传数据）

\`\`\`javascript
// 子页面保存成功后刷新父列表
if (window.opener && window.opener.refreshList) {
    window.opener.refreshList();
}
window.close();
\`\`\`
> 真实示例：\`datamask/dataMaskSceneAdd.jsp\`。

#### 写法 G — 工作流资源选择回写父表单（带行号索引）

\`\`\`javascript
// 子页面按行号 i 回写到父页面对应行字段
function setRes(i) {
    if (document.getElementById("resid").value != "") {
        if (window.opener.document.getElementById("resId" + i) != undefined) {
            window.opener.document.getElementById("resId" + i).value = document.getElementById("resid").value;
        }
        if (window.opener.document.getElementById("textOne" + i) != undefined) {
            window.opener.document.getElementById("textOne" + i).value = document.getElementById("resname").value;
        }
        closeWindow();
    } else { alert("请选择资源"); }
}
\`\`\`
> 真实示例：\`workflow/form/resTree.jsp\`。

#### 选型决策表

| 场景 | 推荐写法 | 回传数据形态 | 触发父页面方式 |
|---|---|---|---|
| 单选弹窗回填表单 | **A** | 标量（id/name） | 直接写 \`window.opener\` 字段 |
| 字符串数据 + 需父页面处理 | **B** | 分隔字符串 | \`window.opener.location = "javascript:fn()"\` |
| 多场景分流回传 | **C** | 分支字段 | 按标志分流 + 触发对应回调 |
| 多选结构化数据 | **D** | 对象数组 | \`window.opener.receiveFn(array)\` |
| layer iframe 弹窗 | **E** | 子方法返回值 | \`iframeWin.method()\` |
| 仅刷新父列表 | **F** | 无数据 | \`window.opener.refreshList()\` |
| 按行号回写父表单 | **G** | 带行号索引 | \`window.opener.getElementById("field"+i)\` |

#### 关键约束（所有写法通用）

- **不用 ymPrompt 的 doHandler/getArgument 数据回传**（项目零调用），ymPrompt 仅用于无回传的提示/确认。
- 回传前检查 \`window.opener\` 是否存在（避免父页面刷新后 opener 丢失）。
- 多选数据用 \`data-*\` 属性或分隔符携带多字段，收集成对象数组回传。
- \`window.close()\` 关闭子窗口前完成回传。
- 使用 \`window.opener.document.getElementById()\` 而非 \`window.opener.$()\`（IE 兼容）。
`;

const ACTION_ROUTING = `### 2.11 前端-后端数据传递规范

#### NameElement 对象引用问题

> **问题**: 不同 JSP 页面中 NameElement 对象的 \`name\` 和 \`value\` 属性引用同一个底层 char[] 数组。
> 修改一个页面的值会意外影响其他页面。

**解决方案**: 使用 \`_\` 前缀约定区分变量作用域
\`\`\`jsp
<%-- Action 层 --%>
// 使用 _ 前缀标记"内部使用"变量
String _tmpName = request.getParameter("name");
NameElement nameEl = new NameElement(_tmpName, _tmpName + "_val");

// 设置到 request
request.setAttribute("_pageData", nameEl);
%>

<%-- JSP 层 --%>
<%
// 读取时始终使用 _ 前缀变量
NameElement _el = (NameElement)request.getAttribute("_pageData");
%>
\`\`\`

#### Action 层规则

\`\`\`java
public ActionForward toList(ActionMapping mapping, ActionForm form,
        HttpServletRequest request, HttpServletResponse response) {
    // 1. 设置页标题
    request.setAttribute("pageTitle", "列表管理");

    // 2. 获取分页参数（兼容 null）
    int pageNum = request.getParameter("pageNum") != null
        ? Integer.parseInt(request.getParameter("pageNum")) : 1;
    int pageSize = 15;

    // 3. 查询数据列表
    DataStore dataList = service.queryList(pageNum, pageSize);
    request.setAttribute("dataList", dataList);

    // 4. 设置分页参数
    request.setAttribute("pageSize", pageSize);
    request.setAttribute("rowCount", dataList != null ? dataList.getTotalRowCount() : 0);

    return mapping.findForward("list");
}
\`\`\`

### 2.20 Action 路由机制与 action_mappings.xml

> Venus4A 前后端交互基于自研框架（\`framework1.4.jar\` + \`venustech-common-2.0.2-SNAPSHOT.jar\`），三个 XML 配置协作。

#### 四层路由体系

| 配置文件 | 位置 | 作用 |
|---|---|---|
| \`action_mappings.xml\` | \`WebRoot/WEB-INF/\` | URL \`*.do\` → Java Action 类映射 |
| \`screen_mappings.xml\` | \`WebRoot/WEB-INF/\` | Action 返回逻辑页名 → 真实 JSP 路径 |
| \`dwr.xml\` | \`WebRoot/WEB-INF/\` | DWR 可调用的 Java 类注册 |

#### 完整路由链路（以 \`TacacsUserAction.do?method=gotoUserList\` 为例）

~~~
1. 浏览器请求 TacacsUserAction.do?method=gotoUserList
2. web.xml 中 *.do → action servlet 拦截
3. 框架查 action_mappings.xml：<TacacsUserAction> → cn.com.venustech.venus4a.aaa.action.TacacsUserAction
4. 调用 Action.perform()，根据 method 参数分发：
   if ("gotoUserList".equals(method)) return gotoTacacsUserList(...);
5. Action 读 pageNum/pageSize，调 DAO 查询，setAttribute 存数据
6. return new ActionRouter("tacacsUserList-page")
7. 框架查 screen_mappings.xml：<tacacsUserList-page> → /aaa/tacacsUser/tacacsUserList.jsp
8. forward 到 JSP 渲染
~~~

#### Action 类骨架（DispatchAction 模式）

\`\`\`java
public class TacacsUserAction extends ActionBase {
    @Override
    public ActionRouter perform(HttpServlet servlet, HttpServletRequest request,
            HttpServletResponse response) throws SystemException, ValidateException {
        String method = ParameterUtil.getParameter(request, "method");
        if ("gotoUserList".equals(method)) { return gotoTacacsUserList(servlet, request, response); }
        if ("addTacacsUser".equals(method)) { return addTacacsUser(servlet, request, response); }
        return gotoTacacsUserList(servlet, request, response);  // 默认分支
    }
}
\`\`\`

#### 两种返回模式

- **页面跳转**：\`return new ActionRouter("逻辑页名-page")\` → 框架查 \`screen_mappings.xml\` → forward 到 JSP
- **Ajax 响应**：\`response.getWriter().write("1"); return null;\` → 直接写流，不跳转

> Ajax 返回 JSON 时，Action 直接 \`response.getWriter().write(json)\`，不要走 ActionRouter。

#### 前端调用四种形态

| 形态 | 写法 | 适用场景 |
|---|---|---|
| 表单提交 | \`<form action="XxxAction.do?method=yyy" onSubmit="return gotoSubmit()">\` | CRUD 保存、列表查询 |
| 编程式提交 | \`document.forms[0].action="XxxAction.do?method=yyy"; document.forms[0].submit();\` | 动态切换 action、列表刷新 |
| jQuery.ajax | \`$.ajax({url:"XxxAction.do?method=yyy", dataType:"json", ...})\` | 异步 CRUD、校验 |
| DWR | \`XxxDao.methodName(params, callback)\` | 调用 DAO 查询逻辑 |

> **关键约束**：URL 一律 \`XxxAction.do?method=methodName\`，**不要写 RESTful 风格**；\`$.ajax\` 同步需 \`async: false\`（级联下拉、zTree 异步加载）；中文参数用 \`encodeURI(params.term)\` 编码。

#### action_mappings.xml 配置参考

**位置**: \`WebRoot/WEB-INF/action_mappings.xml\`

\`\`\`xml
<action-mappings>
    <action name="XXXForm" path="/XXXAction" type="cn.com.venustech.venus4a.{module}.action.XXXAction" parameter="method">
        <forward name="list" path="/{module}/list.jsp"/>
        <forward name="add" path="/{module}/add.jsp"/>
        <forward name="edit" path="/{module}/edit.jsp"/>
        <forward name="detail" path="/{module}/detail.jsp"/>
    </action>
</action-mappings>
\`\`\`

> 新增模块时，必须在此 XML 注册 Action 映射 + 在 \`screen_mappings.xml\` 注册逻辑页名 → JSP 路径，否则 \`*.do\` 请求 404。

#### 分页参数传递链

~~~
前端 → Action:  pageNum / pageSize（表单隐藏字段，html:page 标签生成）
Action → DAO:   request.getParameter("pageNum") + request.getParameter("pageSize")
DAO → DB:       Sql.executePage(sql, pageSize, pageNum) + getTotalRow()
Action → JSP:   setAttribute("rowCount", total) + setAttribute("pageSize", size) + setAttribute("pageNum", pageNum - 1)
JSP 渲染:       <html:page pageSize="<%=...%>" totalNum="<%=...%>">
~~~
`;

const STYLE_AND_SECURITY = `### 2.12 XSS 安全防护

> **所有用户输入输出必须使用 \`StringUtils.htmlEncode()\` 转义**

\`\`\`jsp
<%@ page import="cn.com.venustech.venus4a.common.util.StringUtils"%>

<%-- 安全输出 --%>
<input type="text" value="<%=StringUtils.htmlEncode(userInput)%>">

<%-- 搜索条件回显 --%>
<%=StringUtils.htmlEncode(keyword)%>

<%-- 表格数据 --%>
<%=StringUtils.htmlEncode(dataObject.getString("field_name"))%>
\`\`\`

### 2.13 组件类型速查（标签库对照）

| 组件 | 标签/JS | 数据源 | 说明 |
|------|---------|--------|------|
| 文本输入 | \`<util:Text>\` | request 属性 | 自定义标签，自动回显 |
| 文本域 | \`<util:TextArea>\` | request 属性 | 多行文本 |
| 下拉框 | \`<util:Option>\` | List/Map/NameElement[] | 自定义标签 |
| 数据表格 | \`<html:vectorobject>\` + \`<html:databean>\` | DataStore | 遍历数据行 |
| 数据显示 | \`<html:show>\` | 任意 Java 类型 | 显示 Bean 属性 |
| 分页 | \`<html:page>\` | 数字参数 | 列表分页 |
| 复选框 | \`<input type="checkbox">\` + JS | JS 操作 | 配合 checkItems() |
| 单选框 | \`<input type="radio">\` + JS | JS 操作 | 配合 set_input_checked() |

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
- **既有实现可省工**：项目常有现成 Action 接口和选择器弹窗（如 \`UserManagerAction.findUser\`、\`dataMaskRuleSelect.jsp\`、\`selectMaster.jsp\`），先搜后写，避免重复造轮子。
- **风格匹配**：同一页面的相邻字段（如"业务系统"用 zTree 下拉浮层），新增同类字段应照搬同一交互模式（同样 menuContent 浮层、同样 onCheck 回填），不要引入新弹窗组件。

**搜索方法**：

| 需求 | 搜索什么 | 命令示例 |
|---|---|---|
| 目标页面是否已用某组件 | grep 组件名 | \`grep -l "ztree\|select2" WebRoot/authorization/firewall/*.jsp\` |
| 是否有现成选择器弹窗 | grep 关键词 | \`grep -rl "selectMaster\|dataMaskRuleSelect" WebRoot/\` |
| 是否有现成 Ajax 接口 | grep Action 方法 | \`grep -rn "method=findUser\|method=findOrg" WebRoot/ src/\` |
| 同模块弹窗模式 | grep 弹窗调用 | \`grep -l "window.open\|layer.open\|ymPrompt" WebRoot/datamask/*.jsp\` |

**适用判断**：若搜索命中既有实现，本 skill 的选型表让位给"既有实现复用"原则——跟着既有约定走。只有项目无同类实现时，才用选型表做全新决策。

### 2.19 修改现有页面：样式匹配与换行规则

> **⚠️ 重要**：修改现有页面（加按钮/字段等）时，**禁止**直接套用新页面模板的样式，必须先检测现有页面样式模式，保持一致性，避免换行问题。

#### 步骤1：检测现有页面样式模式

修改前必须 Read 目标页面文件，检测以下样式特征：

| 检测项 | 检测方法（搜索关键词） | 关键标识 |
|--------|----------|----------|
| **按钮样式类型** | \`left.gif\`、\`middle.gif\`、\`input type="button"\`、\`class="btn"\` | 确定使用哪种按钮样式 |
| **表格布局结构** | \`liststyle\`、\`biaodan-\`、\`table width=\` | 确定表格样式类名 |
| **换行控制方式** | \`nowrap\`、\`word-break\`、\`white-space\` | 确定换行处理方式 |
| **间距设置** | \`&nbsp;\`、\`cellspacing\`、\`cellpadding\` | 确定间距规范 |
| **颜色样式** | \`STYLE7\`、\`STYLE3\`、\`STYLE5\` | 确定颜色类名 |

#### 步骤2：3种按钮样式分类与匹配

项目中存在 **3种主要按钮样式**，必须根据现有页面使用的样式进行匹配：

**样式A：图片组合按钮（传统样式，最常用）**

\`\`\`html
<!-- 检测标识：left.gif + middle.gif + right.gif -->
<table width="80" border="0" cellpadding="0" cellspacing="0">
    <tr>
        <td width="5"><img src="<%=request.getContextPath()%>/images/left.gif" width="5" height="19"></td>
        <td align="center" background="<%=request.getContextPath()%>/images/middle.gif" onclick="xxx()" style="cursor:hand"><span class="STYLE7">按钮文字</span></td>
        <td width="5"><img src="<%=request.getContextPath()%>/images/right.gif" width="5" height="19"></td>
    </tr>
</table>
\`\`\`
> 特点：三张图片(left/middle/right)拼接成按钮，高度固定 19px，文字白色(STYLE7)。

**样式B：简单 input 按钮**

\`\`\`html
<!-- 检测标识：input type="button" + class="btn" 或内联样式 -->
<input type="button" value="按钮文字" onclick="xxx()" class="btn">
<!-- 或带内联样式 -->
<input type="button" value="按钮文字" onclick="xxx()" style="background-color:#0033FF;color:white;height:23px;">
\`\`\`
> 特点：原生 input 按钮，可能带 \`class="btn"\` 或内联样式。

**样式C：图标按钮（操作列常用）**

\`\`\`html
<!-- 检测标识：class="iconButton" + edit.gif/delete.gif -->
<a href="javascript:xxx()"><img src="<%=request.getContextPath()%>/images/img/edit.gif" class="iconButton" alt="修改"></a>
<a href="javascript:xxx()"><img src="<%=request.getContextPath()%>/images/img/delete.gif" class="iconButton" alt="删除"></a>
\`\`\`
> 特点：图片图标 + \`class="iconButton"\`，常用于列表操作列。

#### 步骤3：样式匹配决策表

| 现有页面检测结果 | 新增按钮应使用样式 | 参考 |
|------------------|-------------------|------|
| 发现 \`left.gif/middle.gif/right.gif\` | **样式A** 图片组合按钮 | 样式A模板 |
| 发现 \`input type="button" class="btn"\` | **样式B** 简单input按钮 | \`<input type="button" class="btn" ...>\` |
| 发现 \`iconButton\` 且在操作列 | **样式C** 图标按钮 | \`<img src="xxx.gif" class="iconButton">\` |
| 混合使用多种样式 | **优先匹配最近相邻按钮** | 查看目标位置附近的按钮样式 |
| 无法确定样式 | **询问用户** | "请确认按钮样式：图片按钮/简单按钮/图标按钮" |

#### 步骤4：换行处理规则

**规则1：在 table 同一行内添加元素，勿新增行破坏布局**

\`\`\`html
<!-- ❌ 错误：新增行导致布局断裂 -->
<tr><td>原有字段</td><td>原有按钮</td></tr>
<tr><td>新增按钮</td></tr>  <!-- 新增行导致换行 -->

<!-- ✅ 正确：在现有行内扩展 td -->
<tr><td>原有字段</td><td>原有按钮</td><td nowrap>新增按钮</td></tr>
\`\`\`

**规则2：按钮组必须保持在同一 table 结构内**

\`\`\`html
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
\`\`\`

**规则3：操作列/按钮列用 \`nowrap\` 防止换行**

\`\`\`html
<td align="center" class="liststyle1" nowrap>
    <a href="#"><img src="images/img/edit.gif" class="iconButton"></a>
    <a href="#"><img src="images/img/delete.gif" class="iconButton"></a>
    <a href="#"><img src="images/img/new.gif" class="iconButton"></a>  <!-- 新增图标 -->
</td>
\`\`\`

**规则4：宽度计算避免超出容器**

\`\`\`html
<!-- ❌ 错误：新增字段导致总宽度超出 -->
<table width="90%">
    <tr><td width="15%">字段1</td><td width="15%">字段2</td><td width="70%">操作</td></tr>  <!-- 已占满 -->
</table>

<!-- ✅ 正确：重新分配宽度 -->
<table width="90%">
    <tr><td width="12%">字段1</td><td width="12%">字段2</td><td width="10%">新增字段</td><td width="66%">操作</td></tr>
</table>
\`\`\`

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
`;

export function getTrImplFrontendSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_tr_impl_frontend',
        description: '前端页面设计与生成。当用户要进行 Venus4A 项目前端开发、创建 JSP 页面、设计页面组件、选择前端技术栈、修改现有页面或生成页面代码时使用。涵盖组件选择决策（zTree/select2/layui/ymPrompt/ECharts等）和完整页面代码生成。',
        allowedTools: 'Read, Write, Edit, Glob, Grep, Bash(*), Bash(pnpm:*), Bash(npm:*), Bash(node:*)',
        type: 'tr_impl',
        instructions: `# 前端页面设计与生成 Skill

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
| 传统页面（IE8兼容） | **v1.8.3** | \`./js/jquery.js\` | 最大兼容性 |
| Ace Admin 模板 | **v2.1.1** | \`./common/assets/js/jquery.2.1.1.min.js\` | Ace 模板要求 |
| zTree 页面 | **zTree 自带** | \`./zTree_v3/js/jquery.js\` | 避免版本冲突 |
| layui 页面 | **layui.\$**（内置） | layui 模块化加载 | 混用外部 jQuery 出问题 |
| 现代浏览器 | **v3.6.0** | \`./common/assets/js/jquery.3.6.0.min.js\` | 最新特性 |

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
| \`const\` / \`let\` | \`var\` |
| 箭头函数 \`() => {}\` | \`function() {}\` |
| 模板字符串 \`\`...\\\${}\`\` | 字符串拼接 \`"..." + var\` |
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
| 消息提示 | \`ymPrompt.alert\` | 简单提示，import ymPrompt.js |
| 确认对话框 | \`ymPrompt.confirm\` | 确认/取消，handler 回调 |
| iframe 弹窗 | \`layer.open({type: 2})\` | 复杂交互弹窗 |
| 新窗口弹窗 | \`browser(url, w, h, name)\` | 独立页面选择器 |
| 错误提示 | \`ymPrompt.error\` | 错误消息显示 |

#### browser() 函数注意
- browser() 第 5 个参数控制滚动条：**必须传 \`1\`** 启用滚动条
- 示例: \`browser('url', 800, 600, 'name', 1)\`

### 1.7 组件兼容性速查

| 冲突风险 | 说明 | 解决方案 |
|----------|------|----------|
| zTree 自带 jQuery vs 页面已有 jQuery | \$ 冲突 | 使用 zTree 目录下 jQuery，保持同一实例 |
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

\`\`\`jsp
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
\`\`\`

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
| \`references/page-templates.md\` | 列表/添加/编辑/树形选择页面完整 JSP 模板 | 生成或修改上述页面类型时 |
| \`references/component-templates.md\` | zTree/select2/ymPrompt/calendar/ECharts/DWR/layui 组件模板 | 页面需要某组件时 |
| \`references/popup-selectors.md\` | 组织机构/主账号多选/资源选择弹窗 + 父子窗口回传7写法 | 实现选择器弹窗或数据回传时 |
| \`references/action-routing.md\` | 前端-后端数据传递规范 + Action 路由机制 | 涉及前后端交互、路由配置时 |
| \`references/style-and-security.md\` | XSS 安全 + 组件速查 + 先查已有实现 + 样式匹配换行规则 | 安全加固、选型前置、修改现有页面时 |

> 子文件路径相对技能目录（如 \`.claude/skills/venus_tr_impl_frontend/references/page-templates.md\`）。生成页面时先读本 SKILL 的 Phase 1 决策表选型，再按索引 Read 对应实现模板。

---

## 约束与检查清单

### 避坑检查清单（列表/详情页创建前必查）

- [ ] Calendar.setup 在 \`</body>\` 前独立 script（非 head）？
- [ ] browser() 调用传第 5 参数 \`1\`（启用滚动条）？
- [ ] state_form.jsp 在 body 末尾（html:pageForm 之后）？
- [ ] sub() 用 \`document.form1\`（按名）非 \`document.forms[0]\`？
- [ ] 查询条件分行 + label/value 分列 td + nowrap？
- [ ] 详情弹窗用 browser() + 独立 JSP（非 layer.open 字符串 content）？
- [ ] 图片用 HTML \`width\` 属性约束（非 CSS max-width）？
- [ ] 用 layer 则显式引入 layer.css？
- [ ] 所有用户输出使用 StringUtils.htmlEncode()？
- [ ] 分页参数做 Integer/String 类型兼容处理？
- [ ] DataStore 列名全小写？方法用 rowCount() 非 size()？
- [ ] 权限检查传 request 参数？
- [ ] init.jsp 在页面顶部引入？

### JSP 页面开发规范

#### 权限检查
\`\`\`jsp
<%-- 正确：必须传 request 参数 --%>
<% if (LoginBo.isHaveControl(request, RightConstants.XXX)) { %>
    <a href="javascript:openPage();">操作</a>
<% } %>
\`\`\`

#### DataStore/DataObject 方法
| 正确方法 | 错误方法 | 说明 |
|----------|----------|------|
| \`ds.rowCount()\` | \`ds.size()\` | 获取行数 |
| \`obj.getInt("column")\` | \`obj.getInteger("column")\` | 获取整数值 |
| \`obj.getString("column")\` | \`obj.getString("COLUMN")\` | 列名小写 |

#### 列名大小写
- SQL 中使用小写别名: \`SELECT r.id, r.rule_code\`
- JSP 中使用小写列名: \`obj.getString("rule_code")\`

---

## 综合执行步骤

1. **需求分析**：明确页面类型、模块、字段列表、组件需求
2. **设计决策**（Phase 1）：按决策表选择组件、版本、引入路径，设计方案后**向用户确认**
3. **页面生成**（Phase 2）：按页面类型选择模板，填入对应字段和组件
4. **安全加固**：添加 XSS 防护、分页安全处理、权限检查
5. **避坑自检**：逐项检查避坑清单
6. **输出总结**：列出生成的文件、使用的组件、后续注意事项`,
        references: [
            { path: 'references/page-templates.md', content: PAGE_TEMPLATES },
            { path: 'references/component-templates.md', content: COMPONENT_TEMPLATES },
            { path: 'references/popup-selectors.md', content: POPUP_SELECTORS },
            { path: 'references/action-routing.md', content: ACTION_ROUTING },
            { path: 'references/style-and-security.md', content: STYLE_AND_SECURITY },
        ],
        license: 'MIT',
        compatibility: '适用 Venus4A 系列项目（JSP + Struts2 + DWR 技术栈）。依赖项目特有的前端库路径（init.jsp、DWR、zTree、select2 等），非 Venus4A 项目需调整路径。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getTrImplFrontendCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 前端页面设计与生成',
        description: '前端页面设计与生成 —— 组件选择决策 + JSP 页面代码生成（Venus4A 项目）',
        category: 'Venus / 实现',
        tags: ['venus', 'tr_impl', 'frontend', 'JSP', 'page', 'design'],
        content: `# 前端页面设计与生成

## 两阶段工作流

### Phase 1: 设计决策
1. **分析需求**：页面类型（list/add/edit/detail）、功能模块、字段列表
2. **选择组件**：按决策表选择 zTree/select2/layui/ymPrompt/ECharts 等
3. **确定版本**：jQuery v1.8.3（默认）/ zTree v3.5.18 / ECharts v3.1.5
4. **设计方案确认**：输出组件选择方案，获用户确认后进入生成

### Phase 2: 代码生成
1. **选择页面模板**：列表/添加/编辑/详情/树形选择
2. **引入组件代码**：按需引入 zTree/select2/ymPrompt/calendar/ECharts/DWR
3. **安全加固**：StringUtils.htmlEncode() 转义所有用户输出
4. **分页安全**：分页参数做 Integer/String 类型兼容处理
5. **权限检查**：LoginBo.isHaveControl(request, Right) 传 request 参数
6. **避坑自检**：逐项检查避坑清单

### 核心选择原则
- zTree > dTree（优先 zTree v3.5.18）
- calendar.js > My97DatePicker
- ECharts > Highcharts（ECharts 18 文件使用，Highcharts 0）
- 原生 select > select2（仅远程搜索用 select2）
- html:vectorobject > jqGrid
- ymPrompt > layer（简单弹窗用 ymPrompt）
- DWR > jQuery.ajax（40+ 已注册接口）

### 关键约束
- **IE 兼容**：禁止 ES6+（const/let/箭头函数/Promise/模板字符串）
- **XSS 安全**：所有动态输出使用 StringUtils.htmlEncode()
- **列名小写**：DataStore 列名必须小写
- **类型安全**：分页参数做 Integer/String 兼容
- **引入顺序**：CSS→DWR→jQuery→插件→common.js→页面脚本`,
    };
}

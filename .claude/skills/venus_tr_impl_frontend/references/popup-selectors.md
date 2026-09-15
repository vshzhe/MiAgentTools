### 2.9 弹窗选择器模板

#### 组织机构选择（dTree + DWR）

```jsp
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
```

### 2.17 主账号多选弹窗选择器（组织树 + 左右双列表）

> **完整示例参考**: `WebRoot/account/userprimaryselect/selectMaster.jsp`
> **特点**：dTree 组织树 + 左侧账号列表 + 右侧已选列表 + DWR 搜索/加载 + 已选回显 + 多选数据回传。

**父页面调用**：

```jsp
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
```

**弹窗页面骨架**（DWR 异步加载）：

```jsp
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
String.prototype.Trim = function() { return this.replace(/(^\s*)|(\s*$)/g, ""); }
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
```

> **⚠️ 注意事项**：
> - 内部组织挂 `-5` 节点，外部组织挂 `-4` 节点；`parentorgid=-1` 的归到 `-5`。
> - `treeItem` 数组存储节点信息供 `changeMaster` 展开。
> - `selectedMaster()` 在页面加载时从 `window.opener.masterinfo` 回显已选到右侧列表。
> - 数据格式：`master_id,master_name,master_type,master_realname,orgid,orgname`；多项用分号 `;` 分隔。
> - 回传后用 `window.opener.location = "javascript:exePara()"` 触发父页面回调。

### 2.18 资源选择弹窗（dTree 单选 + DWR 搜索 + 多场景回传）

> **完整示例参考**: `WebRoot/account/resTree.jsp`
> **特点**：dTree 单选树（资源组 type=0 / 资源 type=1）+ DWR 按名称/IP 搜索 + `getFlag` 区分回传场景（1=添加从账号、2=其他）+ 扩展信息用 `@^@` 分隔。

**父页面调用**：

```jsp
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
```

**弹窗页面骨架**：

```jsp
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
```

> **⚠️ 注意事项**：
> - `getFlag` 区分场景：`1`=添加从账号（回传多字段+分流），`2`=其他（回传 resid/resname/db_type）。
> - 资源节点扩展信息：`name@^@type@^@unix_systype@^@db_type@^@ip@^@acctsetowned`。
> - 支持 IPv6（`ipvsix` 字段，有则拼接 `ip/ipvsix`）。
> - 资源组节点 `type=0`（文件夹图标，不可选），资源节点 `type=1`（叶子，可选）。
> - 不同 `getFlag` 场景的回传字段和后续跳转逻辑不同，必须按分支处理。

### 2.21 父子窗口数据回传7种写法

> 项目**统一用 `window.opener` 通信**回传选择器弹窗数据（不用 ymPrompt 的 doHandler/getArgument，项目零调用）。
> 按回传数据形态和触发方式，沉淀为 7 种写法，按场景选用。

#### 写法 A — 直接写父页面表单字段（最常用，单选场景）

```javascript
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
```
> 真实示例：`authorization/assessor/selectMaster.jsp`。

#### 写法 B — 回调父页面函数（字符串数据 + 触发父方法）

```javascript
// 子页面
function confirmSelect() {
    var data = "id,name,type";
    window.opener.document.getElementById("selectedData").value = data;
    window.opener.location = "javascript:exeCallback('" + data + "')";  // 触发父页面函数
    window.close();
}
```

```javascript
// 父页面定义回调
function exeCallback(data) {
    var arr = data.split(",");
    document.getElementById("selectedId").value = arr[0];
    document.getElementById("selectedName").value = arr[1];
    refreshRelatedData();
}
```
> 真实示例：`account/userprimaryselect/selectMaster.jsp`（`window.opener.location = "javascript:exePara()"`）。

#### 写法 C — 直接调用父页面函数（多分支，按场景分流）

```javascript
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
```
> 真实示例：`authorization/assessor/selectMaster.jsp`。

#### 写法 D — 对象数组回传（多选，传结构化数据）

```javascript
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
```
> 真实示例：`datamask/dataMaskRuleSelect.jsp`。

#### 写法 E — layer iframe 子方法调用（layer.open type:2）

```javascript
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
```
> 真实示例：`personalfolder/folderFileList.jsp`。

#### 写法 F — 子页面调父方法 + 关闭（仅触发刷新，不传数据）

```javascript
// 子页面保存成功后刷新父列表
if (window.opener && window.opener.refreshList) {
    window.opener.refreshList();
}
window.close();
```
> 真实示例：`datamask/dataMaskSceneAdd.jsp`。

#### 写法 G — 工作流资源选择回写父表单（带行号索引）

```javascript
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
```
> 真实示例：`workflow/form/resTree.jsp`。

#### 选型决策表

| 场景 | 推荐写法 | 回传数据形态 | 触发父页面方式 |
|---|---|---|---|
| 单选弹窗回填表单 | **A** | 标量（id/name） | 直接写 `window.opener` 字段 |
| 字符串数据 + 需父页面处理 | **B** | 分隔字符串 | `window.opener.location = "javascript:fn()"` |
| 多场景分流回传 | **C** | 分支字段 | 按标志分流 + 触发对应回调 |
| 多选结构化数据 | **D** | 对象数组 | `window.opener.receiveFn(array)` |
| layer iframe 弹窗 | **E** | 子方法返回值 | `iframeWin.method()` |
| 仅刷新父列表 | **F** | 无数据 | `window.opener.refreshList()` |
| 按行号回写父表单 | **G** | 带行号索引 | `window.opener.getElementById("field"+i)` |

#### 关键约束（所有写法通用）

- **不用 ymPrompt 的 doHandler/getArgument 数据回传**（项目零调用），ymPrompt 仅用于无回传的提示/确认。
- 回传前检查 `window.opener` 是否存在（避免父页面刷新后 opener 丢失）。
- 多选数据用 `data-*` 属性或分隔符携带多字段，收集成对象数组回传。
- `window.close()` 关闭子窗口前完成回传。
- 使用 `window.opener.document.getElementById()` 而非 `window.opener.$()`（IE 兼容）。

### 2.3 zTree 树形组件模板

```jsp
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
var zNodes = ${nodes};

$(document).ready(function(){
    $.fn.zTree.init($("#treeDemo"), setting, zNodes);
});
</script>
```

### 2.4 select2 下拉选择组件

```jsp
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
    // $("#selectField").val("${selectedValue}").trigger("change");
});
</script>
```

### 2.5 ymPrompt 弹窗组件

```jsp
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
```

### 2.6 calendar 日期选择组件

```jsp
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
```

> ⚠️ Calendar.setup 必须放在 `</body>` 前的独立 script 块中（不能在 head 内）

### 2.7 ECharts 图表组件

```jsp
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
```

### 2.8 DWR 调用组件

```jsp
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
```

### 2.10 layui 组件模板

```jsp
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
```

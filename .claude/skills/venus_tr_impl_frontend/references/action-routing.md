### 2.11 前端-后端数据传递规范

#### NameElement 对象引用问题

> **问题**: 不同 JSP 页面中 NameElement 对象的 `name` 和 `value` 属性引用同一个底层 char[] 数组。
> 修改一个页面的值会意外影响其他页面。

**解决方案**: 使用 `_` 前缀约定区分变量作用域
```jsp
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
```

#### Action 层规则

```java
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
```

### 2.20 Action 路由机制与 action_mappings.xml

> Venus4A 前后端交互基于自研框架（`framework1.4.jar` + `venustech-common-2.0.2-SNAPSHOT.jar`），三个 XML 配置协作。

#### 四层路由体系

| 配置文件 | 位置 | 作用 |
|---|---|---|
| `action_mappings.xml` | `WebRoot/WEB-INF/` | URL `*.do` → Java Action 类映射 |
| `screen_mappings.xml` | `WebRoot/WEB-INF/` | Action 返回逻辑页名 → 真实 JSP 路径 |
| `dwr.xml` | `WebRoot/WEB-INF/` | DWR 可调用的 Java 类注册 |

#### 完整路由链路（以 `TacacsUserAction.do?method=gotoUserList` 为例）

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

```java
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
```

#### 两种返回模式

- **页面跳转**：`return new ActionRouter("逻辑页名-page")` → 框架查 `screen_mappings.xml` → forward 到 JSP
- **Ajax 响应**：`response.getWriter().write("1"); return null;` → 直接写流，不跳转

> Ajax 返回 JSON 时，Action 直接 `response.getWriter().write(json)`，不要走 ActionRouter。

#### 前端调用四种形态

| 形态 | 写法 | 适用场景 |
|---|---|---|
| 表单提交 | `<form action="XxxAction.do?method=yyy" onSubmit="return gotoSubmit()">` | CRUD 保存、列表查询 |
| 编程式提交 | `document.forms[0].action="XxxAction.do?method=yyy"; document.forms[0].submit();` | 动态切换 action、列表刷新 |
| jQuery.ajax | `$.ajax({url:"XxxAction.do?method=yyy", dataType:"json", ...})` | 异步 CRUD、校验 |
| DWR | `XxxDao.methodName(params, callback)` | 调用 DAO 查询逻辑 |

> **关键约束**：URL 一律 `XxxAction.do?method=methodName`，**不要写 RESTful 风格**；`$.ajax` 同步需 `async: false`（级联下拉、zTree 异步加载）；中文参数用 `encodeURI(params.term)` 编码。

#### action_mappings.xml 配置参考

**位置**: `WebRoot/WEB-INF/action_mappings.xml`

```xml
<action-mappings>
    <action name="XXXForm" path="/XXXAction" type="cn.com.venustech.venus4a.{module}.action.XXXAction" parameter="method">
        <forward name="list" path="/{module}/list.jsp"/>
        <forward name="add" path="/{module}/add.jsp"/>
        <forward name="edit" path="/{module}/edit.jsp"/>
        <forward name="detail" path="/{module}/detail.jsp"/>
    </action>
</action-mappings>
```

> 新增模块时，必须在此 XML 注册 Action 映射 + 在 `screen_mappings.xml` 注册逻辑页名 → JSP 路径，否则 `*.do` 请求 404。

#### 分页参数传递链

~~~
前端 → Action:  pageNum / pageSize（表单隐藏字段，html:page 标签生成）
Action → DAO:   request.getParameter("pageNum") + request.getParameter("pageSize")
DAO → DB:       Sql.executePage(sql, pageSize, pageNum) + getTotalRow()
Action → JSP:   setAttribute("rowCount", total) + setAttribute("pageSize", size) + setAttribute("pageNum", pageNum - 1)
JSP 渲染:       <html:page pageSize="<%=...%>" totalNum="<%=...%>">
~~~

---
name: "Venus: 前端页面设计与生成"
description: 前端页面设计与生成 —— 组件选择决策 + JSP 页面代码生成（Venus4A 项目）
allowed-tools: Bash(venus:*)
category: Venus / 实现
tags: [venus, tr_impl, frontend, JSP, page, design]
---

# 前端页面设计与生成

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
- **引入顺序**：CSS→DWR→jQuery→插件→common.js→页面脚本

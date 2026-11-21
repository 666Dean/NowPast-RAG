---
name: 时知 NowPast
description: 暖白与暗红的课程工作台，通知、安排和可核查的要求。
colors:
  primary: "#961e14"
  primary-deep: "#82170f"
  primary-surface: "#85190f"
  control-red: "#981f15"
  primary-bright: "#bb4e3e"
  ink: "#211914"
  muted: "#855d53"
  ground: "#f7efea"
  surface: "#fffbf7"
  line: "#ead8ce"
  rose: "#e7c3b6"
  peach: "#fff0e7"
typography:
  heading:
    fontFamily: "Segoe UI Variable Text, Segoe UI, PingFang SC, Microsoft YaHei UI, sans-serif"
    fontSize: "29px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, PingFang SC, Microsoft YaHei UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, PingFang SC, Microsoft YaHei UI, sans-serif"
    fontSize: "14px"
    fontWeight: 550
    lineHeight: 1.6
rounded:
  chip: "6px"
  input: "13px"
  button: "15px"
  nav: "19px"
  panel: "28px"
  banner: "30px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.peach}"
    rounded: "{rounded.button}"
    typography: "{typography.label}"
    padding: "11px 19px"
  panel:
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  status:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.chip}"
---

## Overview

**Creative North Star: "晨光中的课程工作台"**

当前界面依据用户提供的暖白、暗红与雪山工作台截图实现。主界面以清晰的日期、通知标题、要求状态和安排为中心。顶部导航组织首页、课程空间、通知中心、课程安排、证据问答和资料六个工作区。

晨光雪山是独立的横幅素材，信息与控件始终由 HTML 渲染。说明收在帮助与折叠区域。按钮动画参考 Bencho 的连续反馈，保留原生按钮、输入、选择器和对话框的键盘语义。

**Key Characteristics:**
- 暖白工作面与暗红操作色。
- 半透明面板与柔和、低位的投影。
- 通知与课程安排的清晰层级。
- 连续移动的选中底板和及时的操作反馈。

## Colors

操作色采用暗红与陶土色，底色为柔和暖白。前景颜色使用上方 tokens，透明背景与渐变的实际组成见 CSS 和 sidecar。

### Primary

- 暗红（primary）：图标、操作文字和关键状态。
- 深红（primary-deep）：重要截止时间与强调文本。
- 深色结果面（primary-surface）：证据回答的主体区域。

### Neutral

- 正文墨色（ink）：通知标题、课程与材料内容。
- 次要棕色（muted）：必要元数据。
- 暖白（ground、surface）：页面和内容表面。
- 浅陶土（line、rose、peach）：分隔、选中背景与状态底色。

**The Meaning Before Color Rule.** 生效、冲突、待定与已替代都同时显示文字，不让颜色单独承担含义。

## Typography

使用现有应用的系统无衬线字体栈，覆盖中英文。关键日期采用等宽数字，通知标题保持清晰的粗细层级。

- 截止时间：clamp(27px, 2.4vw, 40px)，650 weight，1.45 行高。
- 页面标题：heading token；首页称呼单独强调。
- 区域标题：主要为 19–22px、650–700 weight。
- 通知标题：桌面 17–19px，手机 14–15px。
- 正文：body token；原文阅读维持较大的行距。
- 元数据：通常 12–15px。小屏品牌字不低于 11px。

## Layout

顶部横向导航保持图标与文字的组合。1180px 以下收紧文字，700px 以下改为六项底部导航。大于 900px 时首页分为通知主栏和安排副栏；更窄时用同一组真实 DOM 节点顺序显示通知横幅、安排、通知列表、准备清单和快捷提问，视觉顺序与 Tab 顺序一致。

全站另有课程空间、通知、周历、问答、资料和帮助工作区。日期与组别筛选影响当前要求。资料库保留原始材料的核查入口。

**The One Reading Order Rule.** 响应式换位同时移动 DOM 节点并保留焦点，避免仅靠 CSS 排序。

## Elevation & Depth

参考图的半透明面板使用 rgba(255,251,248,.51) 和 18px backdrop blur。白色内缘来自 inset shadow，低位柔影来自 0 14px 40px #7e41210a。导航与主按钮通过渐变和轻微内高光与背景区分。原文抽屉与导入对话框使用更明确的模态遮罩。

图片文件为 web/assets/mountain-dawn.webp。该素材由内置图像生成工具生成并转为 WebP，生成提示词与来源记录见同名 .json 文件。

## Shapes

横幅使用 banner token，面板使用 panel token。导航底板、日期选中态和输入使用各自较小的圆角。图标使用同一组描边 SVG；有语义的线条、日期标记和图标不以文本符号代替。

## Components

### Buttons

所有按钮有悬停、按压和焦点状态。常规按压反馈保持轻微，按操作语义提供不同动画：收藏描边与填充、筛选列表过渡、日历选中底板滑动与周/月翻页、搜索遮罩展开、抽屉横向退出、导入纵向淡出。保存与整理使用 spinner 和忙碌文字，不再用通用大面积扩散统一表现所有操作。

收藏重绘后恢复到对应控件；收藏筛选清空时回到当前筛选按钮。日期点击、Enter、Space 和方向键操作后保留焦点。

### Navigation and filters

选中底板根据按钮实际位置和宽度移动，导航与筛选共用相同反馈节奏。搜索由图标展开，并支持 /、Ctrl 或 ⌘ + K 和 Esc。

### Selectors and date fields

角色、组别、通知状态、查询方式及导入范围使用自定义组合框，浮层以暖白纸面、浅陶土边缘和暗红状态延续主界面。指示底板跟随指针或键盘，选定值采用短距离文本交接，箭头随展开状态旋转。底层 select 保留表单值，程序设置和表单 reset 都同步到触发器。

菜单约 210ms 展开、140ms 收合，使用相同的柔和减速曲线。中途反向操作从当前绘制的透明度、变换和遮罩开始，不跳到预设完全展开状态。浮层在空间不足时向上展开，并向相同方向收回。

日期使用配套月历浮层，保留日期字段的直接输入；主题建议使用同样的选项浮层。支持方向键、Home/End、Enter/Space、Tab 提交和 Esc 取消；月历另支持 PageUp/PageDown。组合框的 aria-controls 直接关联 listbox，活动选项通过 aria-activedescendant 表达。

### Calendar and checklist

仅将通知中明确的截止时间放入日程；验收时间未知时显示待定。全班清单按条款实际生效的组别显示 A、B 组前缀，共同适用的条款合并展示。勾选绘制 SVG 笔画，状态保存在当前浏览器。

### Source drawer and import

原文以右侧抽屉打开，Esc、关闭按钮和遮罩可关闭。导入支持 UTF-8 TXT、原文值校验和明确替代关系。失败保留输入，成功更新看板与检索结果。

### Motion

常规按压约 140ms，菜单进入 210ms、退出 140ms，导航与日历底板约 230–240ms，筛选条目在 160ms 内短距离过渡。抽屉进入 280ms、退出 180ms，导入面板进入 230ms、退出 150ms。业务状态先更新，动画解释状态变化。prefers-reduced-motion 下保留即时显隐、文字、选中和勾选反馈，并停止空间动画。

## Do's and Don'ts

当前校务通知卡片以时间、地点和事项为正文。学校公告与教师课程、作业共用现有暖白和暗红组件；主界面不展示 GNP、论文复现、AI 归类或算法解释。原通知仅列具体标题和公布日期，链接可打开同一通知原文。发布界面提供标题、原文、公布日期和接收范围，省去主题、要求值与替代条款的人工填写。未确认的信息显示待确认，时间与地点不以生效日或旧版本猜测。

### Do:
- Do 保持通知和安排的标题、日期与状态清楚可读。
- Do 为动态按钮保留统一的按压反馈与键盘焦点。
- Do 在帮助中说明演示资料、角色视角和浏览器存储边界。
- Do 用现有原文和有效快照生成要求。

### Don't:
- Don't 将截图作为整页图片或把文字烘焙进背景。
- Don't 把未公布的验收时间编造成课程时刻。
- Don't 将仅对 A 组有效的原“全班”条款标成两组共用。
- Don't 用仅视觉换位造成相反的键盘阅读顺序。

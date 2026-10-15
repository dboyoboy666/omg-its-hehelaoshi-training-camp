# 导航页视觉与特效 · SOP

> 版本：v1.0（2026-10-16 蒸馏）
> 来源：铸铭问鼎论英雄-大篆训练营 第 11–15 轮实战
> 适用范围：本项目导航页（index.html）的背景栈、特效注册表、浦外角标、口令框四大子系统的维护与扩展
> 配套：《导航页视觉与特效-避坑指南》（踩坑记录，动手前必读）

---

## 0. 全景：单文件里的六个视觉层

index.html 单文件自包含，视觉系统全部为纯 CSS + 原生 JS（零依赖）。背景容器 `.bgStage` 内自底向上：

```
bg.jpg 横带（.bgArt，自然比例零失真）
  ↑ 高斯模糊缝合层（.bgSeam，接缝朦胧带）
  ↑ 水色渐变层
  ↑ 涟漪层（.ripples，5 中心伪 3D 涟漪套装）← 特效注册表层
  ↑ 猫形遮挡层（.bgCat，猫身 RGBA 切图）
```

页面前景依次为：headBlock（大标题 + 标语播送带 + 浦外角标）→ 卡片槽位墙 → moreBtn → 版权行。右上角浮动 `#bgBtn` / `#bgPanel`。

**黄金法则**：任何新增视觉层 = HTML 一个容器 + CSS 一块 + JS 一段，三处独立成块，删除任意一处即可完整回滚该功能。

## 1. 背景栈维护

### 1.1 内置背景的规格
- 尺寸 1918×856（自然比例横带，`--art-h: calc(100vw * 856 / 1918)`），JPEG 140–150KB。
- 横带之下靠 `.bgSeam` 高斯模糊缝合 + 水色渐变兜底，任何视口不露白。
- 换图 = 替换文件 + 如分辨率变则同步 `--art-h` 比例常数。

### 1.2 猫形遮挡层（.bgCat）
- **原理**：猫是实体，应挡住水面涟漪。用猫身 RGBA 切图覆在 `.ripples` 之上，比 mask-composite 方案兼容性稳、CSS 单点改动。
- 切图与背景一一对应（cat-cut.png ↔ bg.jpg，cat-cut2.png ↔ bg2.jpg）：bg2 为暖调、色域分割失效，复用 bg1 的 alpha 给 bg2 上色（两图猫姿态一致，轮廓严丝合缝）。
- 联动规则（applyBg）：active 为内置双图之一 → 挂对应切图；导入的自定义图无猫形 → 隐藏遮挡层。applyStretch 同步拉伸几何。
- **验证套路**（受控四象限）：遮挡 ON/OFF × 涟漪 ON/OFF 各截图，比对猫形区像素均值——ON+ON 应≈0（涟漪被挡住）、OFF+OFF 应≈1.3（遮挡层与底图零差异）、OFF+ON 复现旧 bug（mean 1.4+）、ON+ON 猫周水区 mean 3.3（涟漪未误伤）。

## 2. 特效注册表（#fxSec）——新增特效的标准步骤

面板内的「网页动态特效」子菜单由 JS 注册表驱动，**不要改面板结构**：

```js
var FX = [
  { id:'ripple', name:'水面涟漪', layer:'.ripples', def:true }
];
```

新增一个特效（以"樱花飘落"为例）三步：

1. **加效果层 DOM**：在 `.bgStage` 内、`.bgCat` 之前加 `<div class="fx-sakura" aria-hidden="true"></div>`（放猫层之前=猫身压过特效，物理正确）。
2. **写效果层 CSS/JS**：自包含一块，类名带 `fx-` 前缀。
3. **数组登记一行**：`{ id:'sakura', name:'樱花飘落', layer:'.fx-sakura', def:false }`。

面板自动长出勾选项；勾选状态存 localStorage `hehe-fx-switch-v1`（与背景偏好 `hehe-bg-switch-v1` **分开**，互不污染）；多选叠加（各层独立 display 显隐），可全关；`def:true` 的项带「默认」徽标。

**红线**：特效开关只动注册层；`.bgCat` 遮挡层不属特效，永显（除自定义背景联动隐藏外）。

## 3. 浦外角标（.titleBadge）——最娇气的子系统

### 3.1 三层结构（勿合并）

```html
<b class="titleBadge"><i><span>浦外</span></i></b>
```

- `.titleBadge` = 外框（滚动标语同款橙渐变 + titleSheen 高光流光，**不滚动**）
- `i` = 框内填充（**当前背景图同款水色渐变**，sampleBadgeFill 动态采样）
- `i > span` = 框内字（标语橙渐变 + 高光，不滚动）

**为什么必须三层**：`background-clip:text` 必须独占元素——渐变填充与渐变字不能共用同一元素。外框用 `<b>` 不用 `<span>`：避开标题逐字规则（见避坑 #1）。

### 3.2 与大标题同相浮动（第 14 轮定稿机制）

- 角标挂 `.title` **直接子元素**（`.title` 有 `position:relative` 作定位基准），加入与大标题同一套 `titleFloat`（10.4s，keyframes **只上浮不下沉**：0→(2px,-6px)→(0,-10px)→(-2px,-6px)→0）。
- 动画延迟取邻字相位**中点**：「师」0.96s/1.35s 与「多」1.28s/1.8s 的中点 ⇒ `1.12s, 1.575s`。角标悬于二字之间，取中点相位 ⇒ 与两字墨迹漂移 ≤0.5px ⇒ **相对几何恒定**。
- 推论：同相 ⇒ 防压字 limit 只需 `inkTop - 3px`（无需再预留浮动行程）；布局位 = 白框内沿 + 上浮行程 10px + 2px。

### 3.3 定位函数 placeBadge()

- **水平**：墨迹间隙中点 = 「师」墨迹右缘 0.924em 与「多」墨迹左缘 0.227em 的中点；用 `span.offsetLeft`（布局坐标）**不用** getBoundingClientRect（rect 含浮动 transform 位移，误差 ±2px）。
- **垂直**：白框（headBlock 1px 边框）内沿 + 10px 行程 + 2px；防压字让位：底 ≤ min(师 0.500em, 多 0.258em) − 3px。
- **墨迹常数**（66px 字号实测折算 em，同字体比例恒定，改动字体必须重测）：师右缘 0.924em、师顶 0.500em（y33）、多左缘 0.227em、**多顶 0.258em（y17 左上撇）**。
- 重算时机：resize（防抖 180ms）+ fonts.ready。

### 3.4 填充采样 sampleBadgeFill(url)

- canvas 采当前底图在徽标身后区域（badge box 外扩 70%）的上/中/下三段均色，上提亮 10% / 下压暗 10% 成竖向渐变；视口→图像素线性映射。
- **必须用布局坐标**（`titleRect + badge.offsetLeft/Top/Width/Height`，.title 是 offsetParent）——用 rect 会随采样相位漂移，填充色会闪。
- 触发：切背景/导入/拉伸开关/resize；连切用 fillSeq 令牌防竞争；失败兜底图1水色 CSS 渐变。

## 4. 口令框（#bgPwd/#bgUnlock）风格常量

复刻课件 V3.2 彩蛋口令窗（课件第 484-495 行 `#eggIn`/`#eggGo`），改样式只改这一处常量组：

- 深底 `rgba(20,16,10,.92)`，2px 金框 `#c9a227`，金字 `#e8c96a`
- 楷体 `STKaiti/Kaiti SC/KaiTi`，宽字距 `.3em` 居中，focus 金晕 `rgba(232,201,106,.22)`
- 错钥：红框 `#b03a2e` + bgShake 0.38s
- 解锁按钮 = 向右箭头 ➜（U+279C，与课件同字符），解锁后保留仅置灰
- 密码框**无占位符**（第 15 轮起）；输入框 `flex:1` 布局，宽度不依赖占位符

## 5. 密钥体系（两套，彼此独立）

| 用途 | 密钥 | 存储位置 |
| --- | --- | --- |
| 背景/特效面板 | `zyywz2026`（z-y-y-w-z） | index.html JS `var KEY` |
| 课件门禁 | `zyywz` | course.html |

改密钥只改对应文件的 JS 常量；改完必须实测「新密钥通过 + 旧密钥被拒」两档。

## 6. 卡片槽位与课件联通

- **静态 DOM 即数据源**：初始卡片直接写在 HTML 里（`data-href/data-title/data-sub/data-icon/data-pinned`），JS 启动时采集成 items 模型——无 JS 时静态卡片依然可见（渐进增强）。
- 点击课件卡：`window.location.href = data-href`（即 course.html）；虚位卡弹 toast。
- 拖动交换：HTML5 draggable，drop 时交换 items 模型 + 占位节点法换 DOM；`suppressClick` 吞掉拖动结束误触的 click。
- 「添加课件位」固定末尾不参与拖动；同屏上限 10，超出折叠 moreBtn。
- **新增一个课件入口** = HTML 加一个 `<article class="card game" data-href="xx.html" ...>`，无需改 JS。

## 7. 发布与验证方法链（每轮必走）

1. 改完升 build 戳（`NAV-YYYYMMDD-HHMM`）→ 同步备用目录（md5 对照）→ 同目录重发（参数见交接文档 §6）。
2. 线上核验：curl 根路径查 build 戳 + 6 文件（index/course/cat-cut/cat-cut2/bg/bg2）md5 逐字节比对 + live 冒烟（零 JS 错误）。
3. 视觉改动专项（角标/涟漪/遮挡层）：
   - **相位扫描**：冻结全部标题动画到同一 currentTime（保留延迟相位关系），遍历 10.4s 周期 17 个相位，量框内余量与墨迹间隙最小值；
   - **像素级独立验证**：截图后按特征色定框（暖色定框底、紫色定墨迹顶）逐列测间隙；
   - **live 观察窗**：线上不冻结跑满一个周期（14s）记录极值。
4. 回归套件本地全绿后才发布；线上核验全绿才收工。

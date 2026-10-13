# omg-its-hehelaoshi-training-camp

**铸铭问鼎论英雄 · 大篆训练营** —— 何何老师@PFLS 课堂教学专用互动课件应用（线上部署版 + 本地开发版合并仓库）。

- 线上地址：<https://omg-its-hehelaoshi-training-camp.app.workbuddy.host/>
- 部署平台：WorkBuddy 云端（静态站点，域名前缀 `OMG-its-hehelaoshi-training-camp`）
- 课件访问密钥：`zyywz`（前端校验，防误触，详见 docs 内安全边界说明）

## 仓库结构

```
├── deployed/                          # 线上部署版（与线上运行数据逐字节一致）
│   ├── dazhuan-camp-sites/            # 主部署目录（实际发布用的就是这个目录）
│   │   ├── index.html                 # 导航页 = 应用首页（根路径打开的就是它）
│   │   ├── course.html                # 互动课件 + 访问门禁（gkGate）
│   │   ├── bg.jpg                     # 默认背景（图1：蓝白睡猫水彩高清版 1918×856）
│   │   ├── bg2.jpg                    # 备选背景（图2：暖调柔焦梦境风 1918×856）
│   │   └── bg-src.png                 # 旧版背景原图（918×273），可随时还原
│   └── hehelaoshi-training-camp-sites/ # 备用同步目录（逐字节副本，应急切换用）
├── local-courseware/
│   └── battle-royale-chinese-calligraphy-dazhuan-training-camp/
│                                    # 本地开发版（源码仓库快照，独立维护）
│                                    # 它有自己的 GitHub 仓库，与本仓库相互独立：
│                                    # https://github.com/dboyoboy666/battle-royale-chinese-calligraphy-dazhuan-training-camp
└── docs/
    ├── 交接文档-铸铭问鼎论英雄-大篆训练营.md   # 项目当前状态完整交接
    ├── 发布目标解析排障-SOP.md                 # 跨项目可复用排障流程
    └── 发布目标解析排障-避坑指南.md             # 配套避坑清单
```

## 两部分数据的关系

- **deployed/** 是「线上运行什么，这里就存什么」——发布目录 `~/My-Projects/dazhuan-camp-sites` 的干净快照（不含本地 .bak 留档）。
- **local-courseware/** 是「课件怎么来的」——分模块源码（src/ 12 个分页模块 + tools/ 构建校准工具 + docs/ 设计文档），通过 `tools/build.js` 构建出线上运行的单文件课件。
- 两个 GitHub 仓库（本仓库与本地版仓库）**互不合并、各自独立提交**；本仓库中的 local-courseware 只是快照副本，需要同步时以本地版仓库的 `git archive HEAD` 导出覆盖。

## 常用操作

| 目的 | 做法 |
| --- | --- |
| 本地预览 | 在 `deployed/dazhuan-camp-sites/` 起静态服务，打开 `index.html` |
| 发布到线上 | 用 WorkBuddy 发布工具，directory 指向 `~/My-Projects/dazhuan-camp-sites`，language=static，不传 entryHtml/startCmd |
| 换导航页背景 | 打开线上页面 → 右上角 🎨 按钮 → 输密钥 `zyywz` → 切换/导入/删除/智能拉伸 |
| 还原旧背景 | 用 `bg-src.png` 替换 `bg.jpg`（同时改 `--art-h` 常量，见交接文档） |
| 改课件内容 | 在本地版仓库改 `src/` 模块 → `tools/build.js` 构建 → 产物同步到 deployed |

详见 `docs/交接文档-铸铭问鼎论英雄-大篆训练营.md`。

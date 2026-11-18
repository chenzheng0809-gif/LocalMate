# LocalMate v3 设计审查 · Phase 0 / Phase 1

交付包解压在 `design-reference/localmate-v3/`。阅读了全部 Markdown，核对了 HTML 的导航、任务入口、Agent 交互和演示数据处理，并对照 P1、P2、首页预览、四个视口参考图和四张独立透明原图。交付包描述的后续功能用于了解方向；本轮只审计和改界面。

## Phase 0 · 实际项目

| 层 | 现状 | 本轮决定 |
| --- | --- | --- |
| 技术栈 | Next.js 15 App Router、React 19、TypeScript、Tailwind 3、Lucide；Node SQLite、Zod、Vitest | 保留运行时、依赖与数据库结构 |
| 工作区 | `/` 是商品优先入口；`/workspace` 查询项目、董事会和资源；`/workspace/[id]` 有商品确认、研究、证据、对标、测算、决策和内部交付；`/workspace/import` 有链接、图片和手工导入 | 改造首页和工作区外壳；保留路径与原业务组件 |
| 商品服务 | `/api/localmate/projects` 建立草稿，支持请求去重、文本、供应商链接、资料及已有商品；`/api/products/*` 提供导入、更新、确认及详情 | 首页接回原服务，提交后由用户核对结构化商品参数 |
| 研究与决策 | 报告和顾问任务由同库 Worker 处理，SQLite 保存任务、成本、证据、方案与批准；成本函数使用最小货币单位计算。手工市场来源是待核验线索 | 直接读取已有记录；无记录时显示空状态 |
| 旧版商品详情 | `/product/[id]`、`/discover/[id]`、`/markets/[id]`、`/compliance/[id]`、`/lab/[id]`、`/launch/[id]`、`/passport/[id]`、`/agent/[id]` 均保留 | 新导航增加目录入口，深层业务页沿用原组件、样式及滚动 |
| Provider 与数据 | 模型和搜索能力由服务端环境变量控制；本地语料、手工来源、演示和实时结果口径不同。上线平台的 OAuth、实时报价、类目属性及准入核验均有各自条件 | 本地验收使用隔离 SQLite、演示模式。未做外部发布或生产数据库修改 |

项目目录没有 Git 元数据。并列的 `work/localmate-v1-baseline` 是旧版。查看了 README、项目脚本、路由和接口、主要服务、数据模型和测试；工作区中没有 `AGENTS.md`。

## Phase 1 · 改动清单

| 路径 | 改动 |
| --- | --- |
| `app/page.tsx` | 首页口号、工作区指标、当前项目、证据／测算／任务摘要；读取现有持久化数据 |
| `app/globals.css` | 白绿 tokens、横向导航、卡片、弹窗、桌面首屏密度与小屏重排，无页面级裁切 |
| `components/localmate/Shell.tsx` | 六项主导航、项目搜索、任务通知、工作区资源入口 |
| `components/localmate/ProjectComposer.tsx` | 简体中文任务表单、四个快捷意图、资料和链接入口、评估选项、提交与反馈 |
| `components/localmate/DashboardAgents.tsx` | 四张角色卡、角色职责弹窗与任务跳转 |
| `app/workspace/page.tsx`、`app/workspace/import/page.tsx`、`components/localmate/ModuleDirectory.tsx` | 商品档案、市场、合规和上架目录；连接现有项目、报告、预检及草稿工具 |
| `app/icon.svg`、`app/favicon.ico` | 同步浏览器标签页品牌图标，覆盖 Chrome 默认请求 |
| `public/localmate/v3/*.png` | 原始透明角色素材，逐字节复制，无重绘、无合成 |
| `scripts/verify-workspace.mjs` | 更新首页断言，检查新标题、固定 Slogan 和实际任务表单 |
| `README.md`、本文件、`screenshots/` | 审查入口、审计说明和浏览器截图 |

首页将旧版左侧栏与大幅角色合图换为横向导航、紧凑任务入口和次级角色卡。原型展示趋势和报价的区域，现在显示手工来源计数、已保存的单件利润和真实任务。上架工作台同时提供已有商品草稿编辑器和项目的上架准备／交付入口。

后续边界：完整 SKU CRUD、风扇的墨西哥实证与准入、Mercado Libre 实时数据或发布集成都不属于本轮。原有墨西哥西语交付与草稿 CSV 能力继续适用其既有审核与类目约束。未把交付包的模拟数据写进产品默认数据。

## 浏览器与自动化验收

Google Chrome 157（Playwright，100% 缩放，设备像素比 1）。截图取自构建后的实际页面，桌面截图中的商品、观察与成本为通过界面保存的隔离验收记录。对每个视口检查了 15 个元素（核心卡片、Agent 卡片和导航）的布局边界、内部滚动尺寸及图片加载。

| 视口 | 页面实际高度 | 最下方核心卡片 | 截图 |
| --- | ---: | ---: | --- |
| 1366 × 768 | 768 px | 734 px | [桌面](../screenshots/after_1366x768.png) |
| 1440 × 900 | 900 px | 848 px | [桌面](../screenshots/after_1440x900.png) |
| 1536 × 864 | 864 px | 836 px | [桌面](../screenshots/after_1536x864.png) |
| 1280 × 720（加测） | 720 px | 706 px | [桌面](../screenshots/after_1280x720.png) |
| 390 × 844（加测） | 1575 px | 1563 px | [移动端长图](../screenshots/mobile_390x844.png) |

三个目标桌面尺寸和 1280 × 720 内无页面横向或纵向滚动，已测核心卡片内部无意外溢出。390 px 移动端自然纵向滚动，无横向溢出。额外截图：[空状态](../screenshots/empty_1366x768.png)、[Agent 弹窗](../screenshots/agent_scout_1366x768.png)、[已确认商品](../screenshots/sku_confirmed_1366x768.png)。

- 浏览器通过：四个快捷任务、键盘打开与关闭 Agent 弹窗、空输入和错误链接反馈、附件关联与移除、自然语言建档、结构化商品确认、墨西哥与巴西筛选、保存待核验来源、利润计算及回填首页、通知、搜索、六项导航和内页滚动。最终运行无控制台错误或页面异常。
- `npm run lint`、`npm run typecheck`、`npm run build` 均通过；`npm test` 为 17 个文件、73 项通过。
- `npm run verify:workspace` 通过，覆盖现有 HTTP 工作区、证据、测算、版本、队列恢复、西语草稿/CSV 和交付流程。没有请求外部店铺发布。

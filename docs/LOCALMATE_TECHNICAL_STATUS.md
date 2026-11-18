# LocalMate V2 技术现状

产品路径是从商品找市场、从市场找商品机会，再把研究和成本交给 Boardroom。工作台继续承接内部执行事项与后续复盘。技术基线已落在 Product Passport 的 Next.js、TypeScript 和 SQLite。LocalMate V1 的 Python 情报工具、两国样本、本机模型和语义索引仍在 V1 分支，等待迁移到 V2 的统一对象。

| 能力 | 现有实现 | 下一步 |
| --- | --- | --- |
| 商品与市场入口 | 复用 1688、图片、手工录入和商品确认。双入口与项目已持久化。市场优先当前由用户关联商品 | 接入巴西、墨西哥市场证据与候选商品筛选。25 国目录作为研究导航 |
| Boardroom | 按市场保存带来源、成本和准入缺口的方案。输入变化产生新版本。授权按版本，原子创建可跟踪的内部清单 | 按字段依赖派发 Scout、Margin、Guard、Localizer 任务。增加约束优化、正式 Chair 身份、复审与 Launch Studio 产物版本 |
| 状态和可靠性 | 项目、成本、方案和清单均在 SQLite。研究与顾问任务由同库的独立 Worker 执行；进程异常退出后重新接手 | 核对 V2 OpenAPI 后完成数据库映射。补齐主动取消、事件游标和多实例部署 |
| 真实数据和 RAG | V2 现有商品研究覆盖 US、JP、DE、UK。V1 的 BR/MX 竞品快照可作为来源明确的样本迁入 | Mercado Libre OAuth、Keyword Planner 或授权导入，以及带日期、市场和来源的检索。宏观指标、样本和商品销量分别处理 |
| 财务与合规 | 单件成本按人民币最小单位计算。Boardroom 显示采购输入与既有合规记录的缺口 | 多币种、报价有效期、税费口径、运费、退货和预算约束。SKU 适用性、认证与原始法规资料需核验 |
| 部署 | 本机 SQLite 单用户预览，支持版本与重复提交校验 | PostgreSQL/Supabase 数据迁移、身份与租户隔离、角色审批、私有附件、备份恢复和上线验收 |

V2 原版交接 ZIP 尚未出现在可访问目录。当前 Boardroom 接口是本地适配层。正式 OpenAPI、共享状态机和后端集成以原件核对为前提。

外部输入仍需 Mercado Libre 和 Google Ads 等访问权限，或带原始出处的竞品、评论与关键词数据。实际经营还需目标 SKU、供应商和物流报价、报关资料、测试报告与证书。授权凭据留在服务端环境配置。

## LocalMate 3.0 增量

- 首页支持选择两个对比市场。Boardroom 左列读取已授权的任务记录，显示待执行和已完成。异步顾问可通过自然语言 @Agent 派发；浏览器只读取任务状态。
- Deep Comparison 可引用从 V1 迁入的六条巴西、墨西哥可追溯风扇目录快照。仅在商品名称与采样品类匹配时引用。快照保存页面销量口径和日期，不作为实时销量或全市场估算。
- 财务版本支持四种币种。每个情景使用同一币种输入，外币折算必须保存汇率、时间和出处。支持高低价情景，平台佣金和税费目前接受用户输入的每件金额。
- Launch Gate 保存 READY_FOR_PILOT、NEEDS_REVIEW 或 BLOCKED 及触发原因，当前试点为墨西哥。准入缺口继续依赖专业审查。此版本的内部授权可继续准备文案，BLOCKED 会阻止创建开发店草稿。
- 墨西哥方案授权后可保存 es-MX 文案版本和下载状态为 draft 的 Shopify CSV。配置 `LOCALMATE_SHOPIFY_TEST_SHOP` 和 `LOCALMATE_SHOPIFY_ADMIN_TOKEN` 后，可由用户对指定版本授权创建一个 Shopify 开发店草稿。远端请求先写入本地，后续调用回读草稿以避免重复写入。凭据需有商品读取和写入权限。真实开发店调用待验。
- Mercado Libre 批量工具使用卖家后台生成的 Excel 模板，仍需取得目标类目和账号模板才能输出可验的导入成品。参考 [官方批量刊登说明](https://global-selling.mercadolibre.com/learning-center/nota/list-many-products-at-a-time-in-four-steps)。

本轮验证通过类型检查、Lint、69 项自动化测试和生产构建。隔离 HTTP 验收覆盖角色素材、MX/BR 可追溯样本、MXN 折算、过期方案拒绝、幂等授权、任务显示和 Shopify CSV。开发店适配器使用 HTTP 替身验证，尚未向真实店铺发出写请求。

## 工作台验收

- `npm run dev` 和 `npm start` 带起 Web 与 Worker。Web 写入持久队列后即返回；即使没有打开工作台，Worker 也会继续执行。强制终止后，新的 Worker 在租约到期后接手。研究连续中断三次后需手动重试。公开联网能力和队列就绪分别显示；`/api/system/status` 的 `worker.online` 表示当前是否存在有效工作进程租约。
- 25 国市场目录可接收用户提供的项目市场来源。Scout 消费对应商品和市场的线索，部分市场缺来源时仍标为待补充。Boardroom 的新版本读取当前关联的线索，增删相关来源会使旧的未授权方案失效。缺失的市场数据不补造；手工来源不计入试点的已核验来源数。
- 使用 `npm run build && npm run verify:workspace` 复验。验收脚本使用临时库，覆盖真实 HTTP 和 SQL 数据路径，并在研究进行中强制结束 Worker。设置 `REQUIRE_LIVE_SOURCE=1` 时，验收还要求读取到官方公开来源。此部署仍是本机单用户版本。

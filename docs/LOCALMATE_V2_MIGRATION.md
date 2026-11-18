# LocalMate V2 迁移记录

## 基线与复用

| 能力 | 当前代码 | 第一阶段 |
| --- | --- | --- |
| 1688、图片及手工商品导入 | `app/api/agent/intake`、`app/api/products`、`lib/product` | 保留实现，原导入界面从 `/passport-home` 打开 |
| 商品编辑与确认 | `app/product/[id]`、`lib/repositories/product-repository.ts` | 项目引用同一商品记录 |
| 市场研究和任务进度 | `lib/workflow/research.ts`、`lib/market`、`app/api/research` | Mission Control 可启动现有研究并读取该商品与市场范围的记录 |
| 证据、合规、成本模拟、文案 | `lib/repositories`、`lib/compliance`、`lib/simulation`、`lib/launch` | 展示已关联研究证据，保留旧版工具入口。新增成本测算与版本存档 |
| AI 和外部数据 | `lib/ai/factory.ts`、`lib/ai/openai-compatible.ts`、`lib/search` | 原有提供方和运行配置继续可用 |
| 浅薄荷绿和四位 3D 顾问 | LocalMate V1 `public/assets` | 已移植到 `public/localmate`，供新版首页和项目页共用 |

Product Passport 基线为 Next.js、TypeScript、SQLite。LocalMate V1 基线为 React/Vite、PGlite 和 Python 情报模块。已运行 Product Passport 65 项和 V1 11 项基线测试。主应用采用 Product Passport 的 Next.js 项目。V1 的公开情报工具和既有数据库后续按契约迁移。

## 第一阶段可运行范围

- 商品优先从已导入商品创建项目，可指定一个目标市场或稍后研究。市场优先先保存目标市场与目标，再关联已导入商品。市场目录使用旧交接包给出的 25 个市场名称与代码。
- Workspace 列出项目。Mission Control 读取商品、现有研究任务及证据。原商品研究接口当前覆盖美国、日本、德国、英国，其他市场可建项目并测算成本。
- Quick Task 保存用户输入的人民币成交价、五项每件成本和来源，以整数分计算单件贡献。成本记录绑定任务、市场和修订号。
- SQLite 启动时增量创建 `localmate_missions` 和 `localmate_cost_checks`。商品外键使用现有商品表。创建命令支持请求标识重放，更新采用修订号，过期写入返回 409。
- 当前路由 `/api/localmate/missions` 属于本地阶段的界面适配层。它使用现有 Next.js API 错误响应。收到正式 OpenAPI 后再映射公开接口与错误编码。

## 后续集成顺序

1. 将原版 `LocalMate_V2_Handoff_Package.zip` 解包至工程，逐条核对项目规则、产品规范、Codex 与 DeepSeekHarness 任务书、OpenAPI、SQL 和验收。较早的董事会交接包只作为已识别的参考。以正式契约确定项目、Mission、Agent 任务、证据、方案、审批和执行资产的共同实体。
2. 冻结 OpenAPI、状态机、审批策略及契约测试。新增 PostgreSQL 迁移和旧数据的迁移 dry run。对于现有 SQLite 数据，从一致性备份加上传目录开始。旧讨论记录保留为历史，授权只由真实审批记录产生。
3. 接入 Scout 的证据采集和商品机会筛选、Margin 的财务约束、Guard 的动作门槛和 Localizer 的内容策略。用结构化产物驱动依赖任务和受影响方案的重算。市场优先随后补候选发现，按来源记录缺口。
4. Boardroom 读取候选与版本差异，Chair 决定指定方案、版本和动作范围。审批原子写入任务与审计，受批准范围约束的执行任务和本地化资产进入 Workspace。
5. 在测试数据库执行迁移恢复、权限和并发验收，完成可恢复 worker、集成测试和部署准备。

## 本地运行

在项目目录运行 `npm ci`，再运行 `npm run dev -- --hostname 127.0.0.1`。已有依赖时可以直接运行。当前使用阶段副本的 SQLite 文件。原 Product Passport 与 V1 源目录中的数据库、上传及个人凭据没有复制。预览服务应绑定本机，生产部署待身份、权限及迁移验收。

第一阶段已通过类型检查、Lint、生产构建及 67 项测试。使用生产构建和独立 SQLite 文件完成 HTTP 验收，覆盖双路径创建、原商品 API、重复提交、旧修订拒绝、单件成本复算、服务重启后读取和项目页渲染。测试样本留在独立临时库。

## Boardroom 本地增量

Mission Control 从真实商品、市场证据、既有准入记录和成本版本生成可比较的方案。按市场记录不可变版本和 SHA-256 摘要。输入已变化时，旧方案的新增授权返回 409。一次授权在同一事务内保存内部准备范围并创建四位负责人的任务。重复授权返回原记录。任务完成标记可重启恢复。

新版首页已使用用户提供的透明角色合影，四位独立角色卡复用已有素材。技术缺口与外部依赖见 [技术现状](LOCALMATE_TECHNICAL_STATUS.md)。

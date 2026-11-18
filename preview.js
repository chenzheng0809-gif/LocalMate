const demo = document.querySelector("#public-demo");
const showDemo = (title, detail) => {
  demo.querySelector("h2").textContent = title;
  demo.querySelector("p").textContent = detail;
  demo.showModal();
};
const details = {
  Scout: ["Scout · 市场研究", "查找可比竞品、核对市场来源，帮助选择值得优先验证的市场。"],
  Margin: ["Margin · 利润测算", "根据售价、成本和汇率测算单件利润，比较试卖方案。"],
  Guard: ["Guard · 合规审核", "整理官方来源和备料清单，供商家与专业人员复核。"],
  Localizer: ["Localizer · 本地化上架", "生成三套当地语言的文案草稿，供商家选择和确认。"],
};
document.querySelectorAll(".lm-agent-info, .lm-dash-agent").forEach((control) => {
  control.addEventListener("click", (event) => {
    event.preventDefault();
    const agent = control.closest(".lm-agent-tile").querySelector("strong").textContent;
    showDemo(...details[agent]);
  });
});
document.querySelectorAll("[data-preview-link]:not(.lm-dash-agent)").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showDemo(link.textContent.trim(), "这里是 LocalMate 公开首页。项目管理、研究记录和文件交付需要连接完整工作台。");
  });
});
document.querySelectorAll(".lm-search, .lm-composer").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showDemo("出海评估示例", "确认商品与目标市场 → 核对竞品和准入资料 → 测算利润 → 生成当地语言的上架草稿。公开版暂未连接 AI 服务。");
  });
});
document.querySelectorAll(".lm-composer button[type=button], .lm-composer summary").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    showDemo("项目资料", "完整工作台支持商品链接、图片与文件。当前是公开预览。");
  });
});
document.querySelectorAll(".lm-dash-shortcuts button").forEach((item) => {
  item.addEventListener("click", () => {
    const input = document.querySelector("#task-intent");
    input.value = '我有一款便携式充电风扇，想在墨西哥试卖，请帮我' + item.textContent.trim() + '。';
    input.focus();
  });
});

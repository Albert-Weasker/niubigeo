export function renderProductLocalizationScript(): string {
  return `<script>
(() => {
  const entries = {
    "项目": ["Project", "Projeto"],
    "项目总览": ["Project overview", "Visão geral do projeto"],
    "项目只绑定一个域名。可以保存模型和联网方式，作为后续监测的固定配置。": ["A project is linked to one domain. Save the models and web access mode as the fixed monitoring configuration.", "Um projeto está vinculado a um único domínio. Salve os modelos e o modo de acesso à web como configuração fixa do monitoramento."],
    "项目身份已持久化。可以在这里维护域名和名称。": ["The project identity is saved. Maintain its domain and name here.", "A identificação do projeto foi salva. Altere o domínio e o nome aqui."],
    "项目 ID": ["Project ID", "ID do projeto"],
    "/ 项目": ["/ Project", "/ Projeto"],
    "项目切换": ["Project switcher", "Seletor de projeto"],
    "项目导航": ["Project navigation", "Navegação do projeto"],
    "总览": ["Overview", "Visão geral"],
    "AI 模型": ["AI models", "Modelos de IA"],
    "监测配置": ["Monitoring configuration", "Configuração do monitoramento"],
    "域名认知": ["Domain recognition", "Reconhecimento do domínio"],
    "当前报告": ["Current report", "Relatório atual"],
    "持续测量": ["Continuous measurement", "Medição contínua"],
    "新建项目": ["New project", "Novo projeto"],
    "还没有项目": ["No projects yet", "Nenhum projeto ainda"],
    "创建一个项目后再配置 AI 模型与监测配置。": ["Create a project before configuring AI models and monitoring.", "Crie um projeto antes de configurar modelos de IA e o monitoramento."],
    "输入域名后，项目会立即保存为草稿。": ["Enter a domain to save the project immediately as a draft.", "Informe um domínio para salvar o projeto imediatamente como rascunho."],
    "只需输入域名。项目会先保存为草稿，模型配置在下一步完成。": ["Enter a domain. The project is saved as a draft before model configuration.", "Informe um domínio. O projeto será salvo como rascunho antes da configuração dos modelos."],
    "主域名": ["Primary domain", "Domínio principal"],
    "同一个标准化域名只能绑定一个未删除项目。": ["A normalized domain can belong to only one non-deleted project.", "Um domínio normalizado pode pertencer a apenas um projeto não excluído."],
    "项目名称": ["Project name", "Nome do projeto"],
    "品牌名称": ["Brand name", "Nome da marca"],
    "默认语言": ["Default language", "Idioma padrão"],
    "可选": ["Optional", "Opcional"],
    "取消": ["Cancel", "Cancelar"],
    "保存草稿": ["Save draft", "Salvar rascunho"],
    "当前项目": ["Current projects", "Projetos atuais"],
    "已归档": ["Archived", "Arquivados"],
    "最近删除": ["Recently deleted", "Excluídos recentemente"],
    "草稿": ["Draft", "Rascunho"],
    "运行中": ["Active", "Ativo"],
    "已删除": ["Deleted", "Excluído"],
    "恢复项目": ["Restore project", "Restaurar projeto"],
    "永久清除": ["Permanently delete", "Excluir permanentemente"],
    "归档": ["Archive", "Arquivar"],
    "删除": ["Delete", "Excluir"],
    "删除项目": ["Delete project", "Excluir projeto"],
    "草稿已保存": ["Draft saved", "Rascunho salvo"],
    "选择模型": ["Select models", "Selecionar modelos"],
    "已选模型": ["Selected models", "Modelos selecionados"],
    "当前版本": ["Current version", "Versão atual"],
    "尚未保存": ["Not saved", "Ainda não salva"],
    "保存项目": ["Save project", "Salvar projeto"],
    "模型目录": ["Model catalog", "Catálogo de modelos"],
    "搜索模型": ["Search models", "Pesquisar modelos"],
    "全部厂家": ["All vendors", "Todos os fornecedores"],
    "联网能力": ["Web capability", "Capacidade de acesso à web"],
    "全部": ["All", "Todos"],
    "支持原生联网": ["Native web supported", "Acesso nativo à web"],
    "不支持原生联网": ["No native web", "Sem acesso nativo à web"],
    "排序": ["Sort", "Ordenar"],
    "当前模型配置": ["Current model configuration", "Configuração atual dos modelos"],
    "调整模型": ["Adjust models", "Ajustar modelos"],
    "历史配置": ["Configuration history", "Histórico de configurações"],
    "技术详情": ["Technical details", "Detalhes técnicos"],
    "协议": ["Protocol", "Protocolo"],
    "输入范围": ["Input scope", "Escopo de entrada"],
    "仅域名": ["Domain only", "Somente domínio"],
    "输出语言": ["Output language", "Idioma da resposta"],
    "模型认知": ["Model recognition", "Reconhecimento pelos modelos"],
    "竞争对象": ["Competitors", "Concorrentes"],
    "目标品牌关键词": ["Target brand keywords", "Palavras-chave da marca-alvo"],
    "来源": ["Sources", "Fontes"],
    "刷新报告": ["Refresh report", "Atualizar relatório"],
    "全部模型": ["All models", "Todos os modelos"],
    "查看证据": ["View evidence", "Ver evidências"],
    "单独重试": ["Retry separately", "Tentar novamente"],
    "没有可定位的证据片段": ["No locatable evidence excerpt", "Nenhum trecho de evidência localizável"],
    "无法确认": ["Unable to confirm", "Não foi possível confirmar"],
    "不联网": ["Offline", "Sem acesso à web"],
    "Provider 原生联网": ["Provider-native web", "Acesso nativo do provedor à web"],
    "正在保存…": ["Saving…", "Salvando…"],
    "已保存": ["Saved", "Salvo"],
    "保存失败": ["Save failed", "Falha ao salvar"],
    "请求未完成": ["Request not completed", "Solicitação não concluída"]
  };
  const prefixEntries = {
    "更新：": ["Updated: ", "Atualizado: "],
    "品牌：": ["Brand: ", "Marca: "],
    "报告版本 ": ["Report version ", "Versão do relatório "],
    "监测配置v": ["Monitoring configuration v", "Configuração de monitoramento v"]
  };
  const supported = new Set(["zh", "en", "pt-BR"]);
  let locale = localStorage.getItem("niubigeo.product.locale") || "zh";
  if (!supported.has(locale)) locale = "zh";
  const index = () => locale === "pt-BR" ? 1 : 0;
  const translate = (value) => {
    if (locale === "zh") return value;
    const exact = entries[value];
    if (exact) return exact[index()];
    for (const [prefix, translations] of Object.entries(prefixEntries)) {
      if (value.startsWith(prefix)) return translations[index()] + value.slice(prefix.length);
    }
    return value;
  };
  const apply = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const raw = node.nodeValue || "";
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const translated = translate(trimmed);
      if (translated !== trimmed) node.nodeValue = raw.slice(0, raw.indexOf(trimmed)) + translated + raw.slice(raw.indexOf(trimmed) + trimmed.length);
    }
    for (const element of root.querySelectorAll ? root.querySelectorAll("[aria-label],[placeholder],[title]") : []) {
      for (const attribute of ["aria-label", "placeholder", "title"]) {
        const value = element.getAttribute(attribute);
        if (value) element.setAttribute(attribute, translate(value));
      }
    }
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  };
  const switcher = document.createElement("div");
  switcher.className = "product-language-switch";
  switcher.setAttribute("aria-label", "Language");
  switcher.innerHTML = ["zh", "en", "pt-BR"].map((value) => '<button type="button" data-product-locale="' + value + '" aria-pressed="' + String(value === locale) + '">' + (value === "zh" ? "中文" : value === "en" ? "EN" : "PT-BR") + '</button>').join("");
  document.body.appendChild(switcher);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-product-locale]") : null;
    if (!target) return;
    const next = target.getAttribute("data-product-locale") || "zh";
    if (!supported.has(next) || next === locale) return;
    localStorage.setItem("niubigeo.product.locale", next);
    window.location.reload();
  });
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) apply(node);
  }).observe(document.getElementById("app") || document.body, { childList:true, subtree:true });
  apply(document.body);
})();
</script>`;
}

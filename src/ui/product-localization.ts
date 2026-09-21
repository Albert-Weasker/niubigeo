export function renderProductLocalizationScript(): string {
  return `<script>
(() => {
  const entries = {
    "模型能力检查时间": ["Model capability check time", "Horário da verificação de capacidade do modelo"],
    "回答中的普通 URL": ["Ordinary URLs in the answer", "URLs comuns na resposta"],
    "尝试记录": ["Attempt history", "Histórico de tentativas"],
    "尝试": ["Attempt", "Tentativa"],
    "尝试 ": ["Attempt ", "Tentativa "],
    "本地整理版本": ["Local analysis revision", "Versão da análise local"],
    "未调用模型": ["No model call made", "Sem chamada ao modelo"],
    "没有匹配模型。": ["No matching models.", "Nenhum modelo correspondente."],
    "选择": ["Select", "Selecionar"],
    "选择 ": ["Select ", "Selecionar "],
    "个模型": ["models", "modelos"],
    " 个模型": [" models", " modelos"],
    "不安全链接已隐藏": ["Unsafe link hidden", "Link inseguro ocultado"],
    "这个模型没有可展示的原始回答。": ["This model has no raw answer to display.", "Este modelo não tem resposta original para exibir."],
    "竞品字段无法整理，不能解释为空。": ["The competitor field could not be processed; it cannot be treated as empty.", "Não foi possível organizar o campo de concorrentes; isso não significa que esteja vazio."],
    "原始回答": ["Original answer", "Resposta original"],
    "Provider 原始响应": ["Original provider response", "Resposta original do provedor"],
    "关键词只属于对应的原始竞争对象记录，不会跨对象共享。": ["Keywords belong only to their original competitor record and are not shared across competitors.", "As palavras-chave pertencem apenas ao registro original do concorrente e não são compartilhadas entre concorrentes."],
    "该对象本次没有可展示的关键词。": ["This competitor has no keywords to display for this run.", "Este concorrente não tem palavras-chave para exibir nesta execução."],
    "先选择项目": ["Select a project first", "Selecione um projeto primeiro"],
    "无法准备报告": ["Unable to prepare the report", "Não foi possível preparar o relatório"],
    "重新读取": ["Reload", "Recarregar"],
    "还没有可展示的认知报告": ["No recognition report to display yet", "Ainda não há relatório de reconhecimento para exibir"],
    "完成一次认知测试后，系统会基于固定的本次证据生成报告。": ["Complete a recognition test to generate a report from its saved evidence.", "Conclua um teste de reconhecimento para gerar um relatório com as evidências salvas dessa execução."],
    "当前筛选没有不联网模型。": ["No offline models match the current filter.", "Nenhum modelo sem acesso à web corresponde ao filtro atual."],
    "当前筛选没有联网模型。": ["No web-enabled models match the current filter.", "Nenhum modelo com acesso à web corresponde ao filtro atual."],
    "分子": ["Numerator", "Numerador"],
    "管理模型": ["Manage models", "Gerenciar modelos"],
    "选择后续运行的模型，并设置每个模型的联网方式。": ["Choose models for future runs and set each model's web access mode.", "Escolha os modelos das próximas execuções e defina como cada um acessa a web."],
    "模型名称或标识符": ["Model name or identifier", "Nome ou identificador do modelo"],
    "仅显示已选模型": ["Show selected models only", "Exibir somente selecionados"],
    "没有符合筛选条件的模型。": ["No models match the filters.", "Nenhum modelo corresponde aos filtros."],
    "联网方式": ["Web access mode", "Modo de acesso à web"],
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
  const ptEntries = {
    "关闭": "Fechar",
    "尚未运行": "Ainda não executado",
    "无法读取项目数据。请检查本地服务与项目配置。": "Não foi possível carregar os dados do projeto. Verifique o serviço e a configuração do projeto.",
    "暂无数据": "Sem dados",
    "品牌名称": "Nome da marca",
    "回答正文域名": "Domínio no corpo da resposta",
    "关联次数": "Quantidade de associações",
    "关联覆盖率": "Cobertura das associações",
    "相对权重": "Peso relativo",
    "缺少域名": "Domínio ausente",
    "尚未选择对象": "Nenhum objeto selecionado",
    "尚未选择对象或关键词": "Nenhum objeto ou palavra-chave selecionado",
    "尚未选择可对照对象或关键词": "Nenhum objeto de comparação ou palavra-chave selecionado",
    "对象或关键词：": "Objeto ou palavra-chave: ",
    "证明：": "Evidência: ",
    "计算：": "Cálculo: ",
    "尚未形成可计算数据。先保存监测范围并完成对应探针运行。": "Ainda não há dados calculáveis. Salve o escopo do monitoramento e conclua a execução correspondente.",
    "覆盖不完整": "Cobertura incompleta",
    "完整": "Completo",
    "时间": "Data e hora",
    "模型": "Modelo",
    "联网方式": "Modo de acesso à web",
    "值": "Valor",
    "命中 / 可判定": "Ocorrências / respostas avaliáveis",
    "预定": "Planejadas",
    "失败或排除": "Falhas ou exclusões",
    "完整性": "Integridade",
    "查看数据明细": "Ver detalhes dos dados",
    "查看范围": "Escopo exibido",
    "筛选仅读取已保存证据，不会发起模型请求。管理模型会改变后续运行；这里仅控制图例。": "Os filtros leem somente evidências salvas e não fazem solicitações aos modelos. A gestão de modelos afeta execuções futuras; aqui apenas a visualização é controlada.",
    "显示历史停用模型": "Exibir modelos históricos desativados",
    "对象": "Objeto",
    "中性关键词": "Palavra-chave neutra",
    "时间范围": "Período",
    "全部时间": "Todo o período",
    "最近 7 天": "Últimos 7 dias",
    "最近 30 天": "Últimos 30 dias",
    "最近 90 天": "Últimos 90 dias",
    "过去 7 天": "Últimos 7 dias",
    "过去 30 天": "Últimos 30 dias",
    "过去 90 天": "Últimos 90 dias",
    "执行方式": "Modo de execução",
    "全部联网方式": "Todos os modos de acesso",
    "联网筛选": "Filtro de acesso à web",
    "手动与定时": "Manual e agendado",
    "手动运行": "Execução manual",
    "定时运行": "Execução agendada",
    "尚未设置定时监测。任务只在固定监测配置和范围下运行，不会混合历史配置。": "Nenhum monitoramento agendado foi configurado. As tarefas usam uma configuração e um escopo fixos, sem misturar configurações históricas.",
    "运行中": "Em execução",
    "已暂停": "Pausado",
    "配置不兼容": "Configuração incompatível",
    "每天": "Diariamente",
    "每周": "Semanalmente",
    "每月": "Mensalmente",
    "自定义": "Personalizado",
    "预览": "Visualizar",
    "暂停": "Pausar",
    "恢复": "Retomar",
    "编辑": "Editar",
    "确认删除": "Confirmar exclusão",
    "下三次：": "Próximas três: ",
    "当前监测配置已保存": "A configuração atual do monitoramento está salva",
    "模型或联网方式已变更": "Os modelos ou o modo de acesso à web foram alterados",
    "尚未保存监测配置": "A configuração do monitoramento ainda não foi salva",
    "✓ 当前配置已保存": "✓ Configuração atual salva",
    "保存为新监测配置": "Salvar como nova configuração",
    "保存监测配置": "Salvar configuração do monitoramento",
    "当前模型、联网方式、域名和语言与已保存版本一致。": "Os modelos, o modo de acesso à web, o domínio e o idioma correspondem à versão salva.",
    "保存后会创建新版本；旧运行和历史证据不会被改写。": "Ao salvar, uma nova versão será criada; execuções e evidências anteriores não serão alteradas.",
    "每条线只连接同一项目、监测配置、模型、联网方式和协议下的真实样本。刷新页面不会调用模型。": "Cada linha conecta somente amostras reais do mesmo projeto, configuração, modelo, modo de acesso à web e protocolo. Atualizar a página não chama os modelos.",
    "管理模型": "Gerenciar modelos",
    "保存监测范围": "Salvar escopo do monitoramento",
    "开始认知测试": "Iniciar teste de reconhecimento",
    "操作未完成": "Operação não concluída",
    "当前数据": "Dados atuais",
    "哪些模型明确识别了这个域名？": "Quais modelos reconheceram explicitamente este domínio?",
    "模型收到对象域名后的本次识别结果，不代表自然推荐。": "Resultado deste reconhecimento após o modelo receber o domínio; não representa uma recomendação espontânea.",
    "明确识别 / 可判定域名回答": "Reconhecimento explícito / respostas de domínio avaliáveis",
    "中性关键词回答是否实际写出该对象名称": "Se a resposta à palavra-chave neutra realmente menciona o nome do objeto",
    "模型在对象的独立域名回答中是否将该关键词关联给对象": "Se o modelo associa a palavra-chave ao objeto em uma resposta independente sobre o domínio",
    "未点名品牌时的名称提及": "Menções ao nome sem citar previamente a marca",
    "写出名称 / 可判定关键词回答": "Nome mencionado / respostas de palavra-chave avaliáveis",
    "未点名品牌时的域名提及": "Menções ao domínio sem citar previamente a marca",
    "中性关键词回答正文是否实际写出对象域名": "Se o domínio do objeto realmente aparece no corpo da resposta à palavra-chave neutra",
    "正文写出域名 / 可判定关键词回答": "Domínio mencionado no corpo / respostas de palavra-chave avaliáveis",
    "关键词关联覆盖率": "Cobertura da associação de palavras-chave",
    "关联回答 / 可判定域名回答": "Respostas associadas / respostas de domínio avaliáveis",
    "问当前关键词时，哪些模型推荐这个对象？": "Quais modelos recomendam este objeto para a palavra-chave atual?",
    "模型在未点名品牌的关键词回答中明确建议考虑该对象。": "O modelo recomendou explicitamente considerar este objeto em uma resposta que não citava previamente a marca.",
    "肯定推荐 / 可判定关键词回答": "Recomendações positivas / respostas de palavra-chave avaliáveis",
    "问当前关键词时，这个对象有多少次首先被提到？": "Quantas vezes este objeto foi mencionado primeiro para a palavra-chave atual?",
    "按回答正文中的可核验位置统计，不代表模型内部思考顺序。": "Calculado pela posição verificável no texto da resposta; não representa a ordem interna de raciocínio do modelo.",
    "唯一首提 / 可判定关键词回答": "Primeira menção exclusiva / respostas de palavra-chave avaliáveis",
    "问当前关键词时，这个对象有多少次首先被推荐？": "Quantas vezes este objeto foi recomendado primeiro para a palavra-chave atual?",
    "按明确推荐证据及顺序统计，不代表模型内部思考顺序。": "Calculado pelas evidências e pela ordem das recomendações explícitas; não representa a ordem interna de raciocínio do modelo.",
    "唯一首荐 / 可判定关键词回答": "Primeira recomendação exclusiva / respostas de palavra-chave avaliáveis",
    "同一个关键词下，我与竞品的推荐差距如何变化？": "Como varia a diferença de recomendações entre minha marca e os concorrentes para a mesma palavra-chave?",
    "同一模型、同一关键词、同一批样本中，目标推荐占比减去竞品推荐占比。": "No mesmo modelo, palavra-chave e conjunto de amostras: percentual de recomendações da marca-alvo menos o percentual do concorrente.",
    "目标推荐占比 - 竞品推荐占比（百分点）": "Percentual da marca-alvo − percentual do concorrente (pontos percentuais)",
    "问当前关键词时，哪些联网模型引用了这个官网？": "Quais modelos com acesso à web citaram este site oficial para a palavra-chave atual?",
    "仅统计 Provider 原生联网实际返回的官网 Citation；正文 URL 不计入本图。": "Conta apenas citações do site oficial retornadas pelo acesso nativo do provedor; URLs no corpo da resposta não entram neste gráfico.",
    "官网 Citation / 可判定联网回答": "Citação do site oficial / respostas com acesso à web avaliáveis",
    "AI 对你品牌的回答变化": "Evolução das respostas da IA sobre sua marca",
    "每个点代表一次完整运行。每条线只代表一个模型；不同协议、联网方式或配置指纹不会被连成同一条线。": "Cada ponto representa uma execução completa. Cada linha representa um único modelo; protocolos, modos de acesso ou configurações diferentes não são conectados.",
    "每条线代表一个固定模型、实际联网方式与探针指纹；每个点代表一次真实运行。悬停或聚焦数据点可查看完整统计。": "Cada linha representa um modelo fixo, seu modo real de acesso à web e a identificação da medição; cada ponto é uma execução real. Passe o cursor ou foque o ponto para ver as estatísticas completas.",
    "点击数据点查看组成数据和原始回答": "Clique em um ponto para ver os dados e as respostas originais",
    "查看图表数据": "Ver dados do gráfico",
    "结果": "Resultado",
    "覆盖": "Cobertura",
    "监测范围": "Escopo do monitoramento",
    "尚未保存监测范围。范围只使用已存认知档案中的候选对象和关键词；身份不明确的对象不会被独立域名测试。": "O escopo do monitoramento ainda não foi salvo. Ele usa somente objetos e palavras-chave do reconhecimento já armazenado; objetos sem identidade confirmada não são testados separadamente por domínio.",
    "当前版本": "Versão atual",
    "次重复": "repetição",
    "固定后不会改写历史运行。": "Depois de fixado, não altera execuções históricas.",
    "本次运行": "Execução atual",
    "尚未创建测量运行。保存范围后可以开始多模型认知与中性关键词测试。": "Nenhuma execução de medição foi criada. Depois de salvar o escopo, será possível iniciar testes de reconhecimento com vários modelos e palavras-chave neutras.",
    "状态": "Estado",
    "探针": "Medições",
    "一个模型失败不会覆盖其他模型的证据。可在单个探针中查看和重试。": "A falha de um modelo não substitui as evidências dos demais. Cada execução pode ser consultada e repetida separadamente.",
    "只测试新增模型": "Testar somente novos modelos",
    "定时监测": "Monitoramento agendado",
    "计划任务复用相同的测量执行路径，并记录每次发生的运行。": "As tarefas agendadas reutilizam o mesmo fluxo de medição e registram cada execução.",
    "设置定时监测": "Configurar monitoramento agendado",
    "每个项目只绑定自己的域名、模型、范围、运行和任务。": "Cada projeto mantém seu próprio domínio, modelos, escopo, execuções e tarefas.",
    "域名": "Domínio",
    "创建草稿项目": "Criar projeto como rascunho",
    "当前监测范围": "Escopo atual do monitoramento",
    "当前范围已保存。模型、关键词和对象的历史证据保留在原版本中；配置改变后需要新的范围版本。": "O escopo atual está salvo. Evidências históricas de modelos, palavras-chave e objetos permanecem na versão original; alterações exigem uma nova versão do escopo.",
    "系统会从该项目已保存的认知档案中提出对象和关键词候选，不会猜测竞争对象域名。": "O sistema sugere objetos e palavras-chave a partir do reconhecimento salvo do projeto, sem adivinhar domínios de concorrentes.",
    "保存并确认范围": "Salvar e confirmar escopo",
    "选择一个或多个当前可用模型。新增模型只在“只测试新增模型”时创建自己的探针；移除不会删除历史证据。": "Selecione um ou mais modelos disponíveis. Novos modelos serão executados separadamente; removê-los não apaga evidências históricas.",
    "保存模型选择": "Salvar seleção de modelos",
    "下三次执行": "Próximas três execuções",
    "编辑定时监测": "Editar monitoramento agendado",
    "任务使用冻结的监测配置和范围。改动未来安排，不改写已经保存的运行和证据。": "A tarefa usa uma configuração e um escopo fixos. Alterações afetam apenas o agendamento futuro, sem modificar execuções e evidências salvas.",
    "任务名称": "Nome da tarefa",
    "定期监测": "Monitoramento periódico",
    "频率": "Frequência",
    "时区": "Fuso horário",
    "小时": "Hora",
    "分钟": "Minuto",
    "每周日期": "Dia da semana",
    "每月日期": "Dia do mês",
    "周日": "Domingo",
    "周一": "Segunda-feira",
    "周二": "Terça-feira",
    "周三": "Quarta-feira",
    "周四": "Quinta-feira",
    "周五": "Sexta-feira",
    "周六": "Sábado",
    "本任务执行的模型": "Modelos executados por esta tarefa",
    "模型范围固定在任务版本内。模型变更后，旧任务会在下一次执行前检查兼容性。": "O conjunto de modelos fica fixado na versão da tarefa. Após mudanças, a compatibilidade será verificada antes da próxima execução.",
    "预览下三次": "Visualizar próximas três",
    "保存任务": "Salvar tarefa",
    "创建监测任务": "Criar tarefa de monitoramento",
    "数据点证据": "Evidências do ponto de dados",
    "数据点": "Ponto de dados",
    "证据": "Evidências",
    "计入分子": "Incluído no numerador",
    "计入分母": "Incluído no denominador",
    "已排除": "Excluído",
    "可判定": "Avaliável",
    "未创建": "Não criado",
    "此样本没有可展示的原始回答。": "Esta amostra não possui uma resposta original para exibição.",
    "正在读取…": "Carregando…",
    "正在读取项目数据，不会重新调用模型。": "Carregando os dados do projeto sem chamar os modelos novamente.",
    "新建一个域名项目后，模型、监测范围、运行、图表和任务都会严格归属到这个项目。": "Crie um projeto de domínio; modelos, escopo, execuções, gráficos e tarefas ficarão vinculados exclusivamente a ele.",
    "竞争对照": "Comparação com concorrentes",
    "关键词": "Palavras-chave",
    "监测": "Monitoramento",
    "数据来源": "Origem dos dados",
    "Provider API 观察": "Observações da API do provedor",
    "筛选与图表不会调用模型。": "Filtros e gráficos não chamam os modelos.",
    "✓ 已完成": "✓ Concluído",
    "操作未完成。请检查当前项目的配置、范围、模型、预算或任务状态。": "Operação não concluída. Verifique a configuração, o escopo, os modelos, o orçamento ou o estado da tarefa.",
    "操作失败 · 重试": "Falha na operação · Tentar novamente",
    "无法读取这个数据点的证据。": "Não foi possível carregar as evidências deste ponto de dados.",
    "NiubiGEO AI 顾问": "Consultor de IA do NiubiGEO",
    "AI 顾问": "Consultor de IA",
    "与 NiubiGEO 对话": "Fale com o NiubiGEO",
    "聊聊你的 GEO 问题": "Converse sobre suas questões de GEO",
    "NiubiGEO AI 顾问：前往官网咨询（新标签页）": "Consultor de IA do NiubiGEO: consultar no site oficial (nova aba)"
    ,"项目输入无效，请检查域名和名称。": "Os dados do projeto são inválidos. Verifique o domínio e o nome."
    ,"项目不存在或已被删除。": "O projeto não existe ou foi excluído."
    ,"这个域名已经被其他项目使用。": "Este domínio já está sendo usado por outro projeto."
    ,"当前项目状态不支持此操作。": "O estado atual do projeto não permite esta operação."
    ,"请求的项目操作不存在。": "A operação solicitada para o projeto não existe."
    ,"监测配置无效，请检查模型和联网方式。": "A configuração do monitoramento é inválida. Verifique os modelos e o modo de acesso à web."
    ,"当前配置已经保存，无需重复保存。": "A configuração atual já foi salva."
    ,"监测配置版本不存在。": "A versão da configuração do monitoramento não existe."
    ,"模型目录暂时不可用，请稍后重试。": "O catálogo de modelos está temporariamente indisponível. Tente novamente mais tarde."
    ,"保存监测配置失败，请重试。": "Não foi possível salvar a configuração do monitoramento. Tente novamente."
    ,"当前认知测试无法开始，请检查监测配置或等待正在进行的测试结束。": "Não foi possível iniciar o teste de reconhecimento. Verifique a configuração ou aguarde o teste atual terminar."
    ,"认知测试记录不存在。": "O registro do teste de reconhecimento não existe."
    ,"模型执行记录不存在。": "O registro de execução do modelo não existe."
    ,"认知测试操作失败，请重试。": "A operação do teste de reconhecimento falhou. Tente novamente."
    ,"项目操作失败，请重试。": "A operação do projeto falhou. Tente novamente."
    ,"请求未完成，请检查网络后重试。": "A solicitação não foi concluída. Verifique a conexão e tente novamente."
    ,"没有已归档项目": "Nenhum projeto arquivado"
    ,"没有最近删除项目": "Nenhum projeto excluído recentemente"
    ,"没有最近删除的项目": "Nenhum projeto excluído recentemente"
    ,"这里保留项目生命周期记录。": "O histórico do ciclo de vida dos projetos aparece aqui."
    ,"目录未提供上架时间": "O catálogo não informou a data de publicação"
    ,"目录上架：": "Publicado no catálogo: "
    ,"可用": "Disponível"
    ,"不可用": "Indisponível"
    ,"配置尚未保存": "A configuração ainda não foi salva"
    ,"重试保存模型配置": "Tentar salvar a configuração dos modelos novamente"
    ,"保存模型配置": "Salvar configuração dos modelos"
    ,"目录可用": "Catálogo disponível"
    ,"目录错误": "Erro no catálogo"
    ,"读取中": "Carregando"
    ,"搜索模型名称、模型 ID 或厂家": "Pesquisar por nome, ID ou fornecedor do modelo"
    ,"新增模型：": "Modelos adicionados: "
    ,"移除模型：": "Modelos removidos: "
    ,"联网方式变化：": "Alterações no modo de acesso à web: "
    ,"协议版本变化：": "Alteração da versão do protocolo: "
    ,"域名变化：": "Alteração do domínio: "
    ,"输出语言变化：": "Alteração do idioma da resposta: "
    ,"将在首次保存时记录": "Será registrado no primeiro salvamento"
    ,"保存监测配置v1": "Salvar configuração de monitoramento v1"
    ,"保存为监测配置v": "Salvar como configuração de monitoramento v"
    ,"✓ 已保存为v": "✓ Salva como v"
    ,"重新保存": "Salvar novamente"
    ,"选择至少一个可用模型后才能保存监测配置。": "Selecione pelo menos um modelo disponível para salvar a configuração do monitoramento."
    ,"还没有保存监测配置。保存后会固定当前域名、语言、模型和联网方式。": "Nenhuma configuração de monitoramento foi salva. Ao salvar, o domínio, o idioma, os modelos e os modos de acesso atuais serão fixados."
    ,"模型或联网方式已变化。保存后会生成新的监测配置版本。": "Os modelos ou modos de acesso à web foram alterados. Ao salvar, uma nova versão da configuração será criada."
    ,"当前模型和联网方式已保存。": "Os modelos e modos de acesso atuais estão salvos."
    ,"正在创建项目草稿": "Criando rascunho do projeto"
    ,"删除后项目会从当前列表移除。": "Após a exclusão, o projeto será removido da lista atual."
    ,"永久清除后无法恢复。": "Após a exclusão permanente, não será possível recuperar o projeto."
    ,"正在归档…": "Arquivando…"
    ,"归档失败": "Falha ao arquivar"
    ,"正在恢复…": "Restaurando…"
    ,"已恢复": "Restaurado"
    ,"恢复失败": "Falha ao restaurar"
    ,"正在清除…": "Excluindo permanentemente…"
    ,"已清除": "Excluído permanentemente"
    ,"清除失败": "Falha ao excluir permanentemente"
    ,"正在删除…": "Excluindo…"
    ,"删除失败": "Falha ao excluir"
    ,"正在保存每个模型的独立联网方式…": "Salvando o modo de acesso à web de cada modelo…"
    ,"模型配置已保存": "Configuração dos modelos salva"
    ,"正在保存当前域名、语言、模型和联网方式…": "Salvando o domínio, o idioma, os modelos e os modos de acesso atuais…"
    ,"已保存为监测配置v": "Salva como configuração de monitoramento v"
    ,"当前配置已经保存，无需重复保存": "A configuração atual já está salva"
    ,"等待开始": "Aguardando início"
    ,"正在运行": "Em execução"
    ,"已完成": "Concluído"
    ,"部分完成": "Concluído parcialmente"
    ,"执行失败": "Falha na execução"
    ,"正在调用": "Consultando o modelo"
    ,"回答已收到": "Resposta recebida"
    ,"本地整理失败": "Falha no processamento local"
    ,"模型无法确认": "O modelo não conseguiu confirmar"
    ,"模型不支持": "Modelo não compatível"
    ,"Provider 调用失败": "Falha na chamada ao provedor"
    ,"本次未使用 Provider 原生联网。": "O acesso nativo à web do provedor não foi usado nesta execução."
    ,"本模型本次没有 Provider Citation。": "Este modelo não retornou citações do provedor nesta execução."
    ,"整理完成": "Processamento concluído"
    ,"部分信息可用": "Informações parciais disponíveis"
    ,"整理失败": "Falha no processamento"
    ,"本次回答未列出竞争对象": "A resposta não listou concorrentes"
    ,"本次回答未提供此项": "A resposta não forneceu esta informação"
    ,"本次回答未列出关联关键词": "A resposta não listou palavras-chave relacionadas"
    ,"此项格式不符合要求": "O formato desta informação é inválido"
    ,"本次回答未明确返回认知状态": "A resposta não informou claramente o estado do reconhecimento"
    ,"模型明确表示已识别": "O modelo informou que reconheceu"
    ,"模型明确表示未识别": "O modelo informou que não reconheceu"
    ,"模型表示无法确认": "O modelo informou que não conseguiu confirmar"
    ,"本次回答未提供详细描述": "A resposta não forneceu uma descrição detalhada"
    ,"Provider 原生联网发现": "Descoberta com acesso nativo do provedor"
    ,"不联网域名认知": "Reconhecimento do domínio sem acesso à web"
    ,"正在创建测试…": "Criando teste…"
    ,"正在为每个模型创建独立执行记录…": "Criando uma execução independente para cada modelo…"
    ,"认知测试已开始，正在等待模型返回。": "O teste de reconhecimento foi iniciado e aguarda as respostas dos modelos."
    ,"正在重试…": "Tentando novamente…"
    ,"已开始": "Iniciado"
    ,"重试失败": "Falha ao tentar novamente"
    ,"已为该模型创建新的执行尝试。": "Uma nova tentativa de execução foi criada para este modelo."
    ,"正在整理已保存回答…": "Processando as respostas salvas…"
    ,"已完成本地整理": "Processamento local concluído"
    ,"已从保存的原始回答生成新的本地整理版本，未调用模型。": "Uma nova versão processada localmente foi gerada a partir da resposta salva, sem chamar o modelo."
    ,"本次明确表示认识": "Reconhecido explicitamente nesta execução"
    ,"本次部分识别": "Reconhecido parcialmente nesta execução"
    ,"本次无法确认": "Não foi possível confirmar nesta execução"
    ,"本次识别存在歧义": "Reconhecimento ambíguo nesta execução"
    ,"本次明确表示不认识": "Não reconhecido explicitamente nesta execução"
    ,"已收到回答，整理失败": "Resposta recebida, mas o processamento falhou"
    ,"本次请求失败": "A solicitação desta execução falhou"
    ,"当前模型或执行方式不支持": "O modelo ou modo de execução atual não é compatível"
    ,"证据完整性错误": "Erro de integridade das evidências"
    ,"已列出": "Listado"
    ,"本次未列出": "Não listado nesta execução"
    ,"请求失败": "Falha na solicitação"
    ,"不支持": "Não compatível"
    ,"身份未确认": "Identidade não confirmada"
    ,"该模型没有可用于报告的结构化结果。": "Este modelo não possui um resultado estruturado disponível para o relatório."
    ,"模型识别的品牌": "Marca reconhecida pelo modelo"
    ,"业务描述": "Descrição do negócio"
    ,"产品类别": "Categoria do produto"
    ,"关键词关联次数": "Quantidade de associações da palavra-chave"
    ,"模型在对象的独立域名回答中将该关键词关联给对象的回答份数": "Quantidade de respostas independentes sobre o domínio em que o modelo associa a palavra-chave ao objeto"
    ,"关联回答份数": "Quantidade de respostas associadas"
    ,"关键词相对权重": "Peso relativo da palavra-chave"
    ,"固定监测词集合中该词关联回答所占份额": "Participação das respostas associadas a esta palavra no conjunto fixo de palavras monitoradas"
    ,"关联回答份额 / 全部监测词关联回答": "Participação das respostas associadas / respostas associadas de todas as palavras monitoradas"
    ,"待确认身份": "Identidade pendente de confirmação"
    ,"不用于中性测试": "Não usado em testes neutros"
    ,"读取预览": "Carregar visualização"
    ,"保存": "Salvar"
    ,"创建运行": "Criar execução"
    ,"创建新增模型运行": "Criar execução para os novos modelos"
    ,"创建项目": "Criar projeto"
    ,"创建任务": "Criar tarefa"
    ,"输入一个域名，立即保存为项目草稿。": "Informe um domínio para salvar imediatamente um rascunho do projeto."
    ,"正在创建项目草稿": "Criando rascunho do projeto"
    ,"已保存草稿": "Rascunho salvo"
    ,"项目草稿已保存": "Rascunho do projeto salvo"
    ,"项目已保存": "Projeto salvo"
    ,"项目已归档": "Projeto arquivado"
    ,"删除后项目将从当前列表移除。仍可在最近删除中恢复或永久清除。": "Após a exclusão, o projeto será removido da lista atual. Ele ainda poderá ser restaurado ou excluído permanentemente na lista de itens excluídos recentemente."
    ,"项目已删除": "Projeto excluído"
    ,"项目已恢复": "Projeto restaurado"
    ,"永久删除后无法恢复。": "Após a exclusão permanente, não será possível restaurar o projeto."
    ,"项目已永久删除": "Projeto excluído permanentemente"
    ,"显示 ": "Exibindo "
    ," 个模型。按上架时间排序时，目录未提供时间的模型会排在最后。": " modelos. Ao ordenar por data de publicação, modelos sem data aparecem por último."
    ," 从“": " de “"
    ,"”改为“": "” para “"
    ," · 当前版本": " · Versão atual"
    ,"已收到回答 ": "Respostas recebidas "
    ,"完整整理 ": "Processamento completo "
    ,"部分可用 ": "Parcialmente disponível "
    ,"整理失败 ": "Falha no processamento "
    ,"请求受限或失败 ": "Solicitação limitada ou com falha "
    ,"仍在运行 ": "Ainda em execução "
    ,"计划 ": "Planejados "
    ," 个模型 · 打开此运行查看执行状态": " modelos · Abra esta execução para ver o estado"
    ," · 身份未确认": " · Identidade não confirmada"
    ," · 监测配置v": " · Configuração de monitoramento v"
    ," 次": " vezes"
    ," 个百分点": " pontos percentuais"
    ," 与 ": " e "
    ," · 覆盖不完整": " · Cobertura incompleta"
    ," · 命中 ": " · Ocorrências "
    ," / 可判定 ": " / avaliáveis "
    ," · 预定 ": " · Planejadas "
    ," · 失败或排除 ": " · Falhas ou exclusões "
    ," · 待确认身份": " · Identidade pendente de confirmação"
    ," · 不用于中性测试": " · Não usado em testes neutros"
    ," · 缺少域名": " · Domínio ausente"
    ," 个模型 · ": " modelos · "
    ," 个请求 · 下次：": " solicitações · Próxima execução: "
    ," / 分母 ": " / denominador "
    ,"这里会保留项目生命周期记录。": "O histórico do ciclo de vida dos projetos será mantido aqui."
    ,"显示": "Exibindo"
    ,"个模型。按上架时间排序时，目录未提供时间的模型会排在最后。": "modelos. Ao ordenar por data de publicação, modelos sem data aparecem por último."
    ,"从“": "de “"
    ,"已收到回答": "Respostas recebidas"
    ,"完整整理": "Processamento completo"
    ,"部分可用": "Parcialmente disponível"
    ,"请求受限或失败": "Solicitação limitada ou com falha"
    ,"仍在运行": "Ainda em execução"
    ,"计划": "Planejados"
    ,"个模型 · 打开此运行查看执行状态": "modelos · Abra esta execução para ver o estado"
    ,"次": "vezes"
    ,"个百分点": "pontos percentuais"
    ,"与": "e"
    ,"· 命中": "· Ocorrências"
    ,"个模型 ·": "modelos ·"
    ,"个请求 · 下次：": "solicitações · Próxima execução:"
    ,"/ 分母": "/ denominador"
    ,"域名认知测试": "Teste de reconhecimento do domínio"
    ,"模型只接收域名、语言、监测协议和自己的联网方式。未联网与原生联网结果分开记录。": "O modelo recebe apenas o domínio, o idioma, o protocolo de monitoramento e seu próprio modo de acesso à web. Os resultados sem acesso à web e com acesso nativo são registrados separadamente."
    ,"每个模型独立调用、独立归档；模型描述仅代表本次模型回答。": "Cada modelo é consultado e arquivado separadamente; a descrição representa somente a resposta desta execução."
    ,"当前模型所选请求配置没有可用接口": "A configuração escolhida para este modelo não possui um endpoint disponível"
    ,"检查模型配置": "Verificar configuração do modelo"
    ,"本次请求没有找到可用端点。请检查模型联网配置后再决定是否重新请求。": "Nenhum endpoint disponível foi encontrado para esta solicitação. Verifique a configuração de acesso à web do modelo antes de tentar novamente."
    ,"查看原始回答与证据": "Ver resposta original e evidências"
    ,"缺失或格式不正确的字段会明确保留为空，不会推断。": "Campos ausentes ou com formato inválido permanecem vazios explicitamente; nenhum valor é inferido."
    ,"模型本次识别的品牌": "Marca reconhecida pelo modelo nesta execução"
    ,"认知状态": "Estado do reconhecimento"
    ,"详细描述": "Descrição detalhada"
    ,"识别的竞争对象": "Concorrentes reconhecidos"
    ,"关联关键词": "Palavras-chave associadas"
    ,"各竞争对象关键词": "Palavras-chave por concorrente"
    ,"字段整理说明": "Observações sobre o processamento dos campos"
    ,"运行记录": "Histórico de execuções"
    ,"每条记录都保留独立模型执行和证据。": "Cada registro preserva a execução e as evidências de cada modelo separadamente."
    ,"认知测试": "Teste de reconhecimento"
    ,"正在查看": "Em exibição"
    ,"查看此运行": "Ver esta execução"
    ,"当前认知报告": "Relatório atual de reconhecimento"
    ,"模型数": "Quantidade de modelos"
    ,"成功整理": "Processados com sucesso"
    ,"模型的描述只代表本次回答。离线认知与实际联网发现分开显示。": "A descrição do modelo representa somente esta resposta. O reconhecimento sem acesso à web e a descoberta com acesso real são exibidos separadamente."
    ,"未联网": "Sem acesso à web"
    ,"竞争对象字段无法整理，不能解释为空。": "Não foi possível processar os concorrentes; isso não significa que não existam."
    ,"关键词字段无法整理。": "Não foi possível processar o campo de palavras-chave."
    ,"查看原始回答与技术证据": "Ver resposta original e evidências técnicas"
    ,"本次未返回目标品牌关键词。": "Esta execução não retornou palavras-chave da marca-alvo."
    ,"联网执行路径未确认": "O caminho de execução com acesso à web não foi confirmado"
    ,"本次没有可展示的记录。": "Esta execução não possui registros para exibição."
    ,"每一格只表示该模型本次是否返回对应记录，不代表市场事实。": "Cada célula indica apenas se o modelo retornou o registro nesta execução; não representa um fato de mercado."
    ,"本次没有竞争对象关键词。": "Esta execução não retornou palavras-chave de concorrentes."
    ,"Provider Citation 与回答正文中的 URL 分开保存和展示。": "As citações do provedor e as URLs presentes na resposta são salvas e exibidas separadamente."
    ,"无法整理": "Não foi possível processar"
    ,"本次未返回 Provider Citation。": "Esta execução não retornou citações do provedor."
    ,"回答正文 URL": "URLs presentes na resposta"
    ,"本次没有普通 URL。": "Esta execução não retornou outras URLs."
    ,"查看固定来源与协议": "Ver fontes e protocolo fixados"
    ,"模型目录直接来自 OpenRouter。每个模型独立保存联网方式，不会共享开关。": "O catálogo de modelos vem diretamente da OpenRouter. O modo de acesso à web é salvo separadamente para cada modelo."
    ,"可选择一个或多个模型。": "Selecione um ou mais modelos."
    ,"该模型支持原生联网，可由你选择。": "Este modelo oferece acesso nativo à web, que pode ser ativado."
    ,"该模型不支持原生联网。": "Este modelo não oferece acesso nativo à web."
    ,"可搜索、多选；目录失败时不会显示伪造模型。": "Pesquise e selecione vários modelos. Se o catálogo falhar, nenhum modelo fictício será exibido."
    ,"模型厂家": "Fornecedor do modelo"
    ,"名称 A-Z": "Nome de A a Z"
    ,"厂家 A-Z": "Fornecedor de A a Z"
    ,"上架时间：新到旧": "Publicação: mais recentes primeiro"
    ,"上架时间：旧到新": "Publicação: mais antigos primeiro"
    ,"厂家：": "Fornecedor: "
    ,"选择 ": "Selecionar "
    ,"保存域名、回答语言和每个模型的联网方式，作为可重复使用的监测条件。": "Salve o domínio, o idioma da resposta e o modo de acesso à web de cada modelo como condições reutilizáveis de monitoramento."
    ,"目标域名：": "Domínio-alvo: "
    ,"每个模型单独保存联网方式。": "O modo de acesso à web é salvo separadamente para cada modelo."
    ,"本次变更": "Alterações desta versão"
    ,"保存后会生成新的监测配置版本。": "Ao salvar, uma nova versão da configuração de monitoramento será criada."
    ,"只读快照。保存新版本不会覆盖历史配置。": "Snapshot somente leitura. Salvar uma nova versão não substitui configurações anteriores."
    ,"正在读取 OpenRouter 模型目录…": "Carregando catálogo de modelos da OpenRouter…"
    ," 个已选": " selecionados"
    ," 个模型": " modelos"
    ,"保存域名、输出语言和每个模型的联网方式，作为可重复使用的监测条件。": "Salve o domínio, o idioma da resposta e o modo de acesso à web de cada modelo como condições reutilizáveis de monitoramento."
    ,"还没有认知测试记录。保存监测配置后即可开始。": "Ainda não há testes de reconhecimento. Salve a configuração do monitoramento para começar."
    ,"正在读取当前报告": "Carregando relatório atual"
    ,"不会重新调用模型。": "Os modelos não serão consultados novamente."
  };
  const ptExactEnglish = {
    queued:"Na fila", running:"Em execução", completed:"Concluído", partial:"Parcial", failed:"Falhou",
    active:"Ativo", paused:"Pausado", deleted:"Excluído", manual:"Manual", scheduled:"Agendado"
  };
  const prefixEntries = {
    "更新：": ["Updated: ", "Atualizado: "],
    "品牌：": ["Brand: ", "Marca: "],
    "报告版本 ": ["Report version ", "Versão do relatório "],
    "监测配置v": ["Monitoring configuration v", "Configuração de monitoramento v"]
  };
  const ptPrefixEntries = {
    "对象或关键词：": "Objeto ou palavra-chave: ",
    "证明：": "Evidência: ",
    "计算：": "Cálculo: ",
    "当前版本 v": "Versão atual v",
    "模型：": "Modelo: ",
    "分子 ": "Numerador ",
    "下次：": "Próxima execução: ",
    "下三次：": "Próximas três: ",
    "◌ 正在": "◌ Em andamento: ",
    "命中 ": "Ocorrências ",
    "查看": "Ver "
  };
  const supported = new Set(["zh", "en", "pt-BR"]);
  let locale = localStorage.getItem("niubigeo.product.locale") || "zh";
  if (!supported.has(locale)) locale = "zh";
  const index = () => locale === "pt-BR" ? 1 : 0;
  const replacements = locale === "pt-BR" ? [
    ...Object.entries(ptEntries),
    ...Object.entries(entries).map(([source, translations]) => [source, translations[1]])
  ].sort((left, right) => right[0].length - left[0].length) : [];
  const translate = (value) => {
    if (locale === "zh") return value;
    if (locale === "pt-BR" && Object.hasOwn(ptExactEnglish, value)) return ptExactEnglish[value];
    if (locale === "pt-BR" && Object.hasOwn(ptEntries, value)) return ptEntries[value];
    if (locale === "pt-BR") {
      let composite = value;
      for (const [source, translation] of replacements) composite = composite.split(source).join(translation);
      if (composite !== value) return composite;
    }
    const exact = Object.hasOwn(entries, value) ? entries[value] : null;
    if (exact) return exact[index()];
    for (const [prefix, translations] of Object.entries(prefixEntries)) {
      if (value.startsWith(prefix)) return translations[index()] + value.slice(prefix.length);
    }
    if (locale === "pt-BR") for (const [prefix, translation] of Object.entries(ptPrefixEntries)) {
      if (value.startsWith(prefix)) return translation + value.slice(prefix.length);
    }
    return value;
  };
  // Only pass application-owned copy to this helper; interpolate data afterwards.
  window.__niubigeoProductText = translate;
  const selector = "[data-product-i18n],[data-product-i18n-aria-label],[data-product-i18n-placeholder],[data-product-i18n-title]";
  // Translation is opt-in. New user/provider fields remain verbatim by default.
  const apply = (root) => {
    const elements = [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    for (const element of elements) {
      if (element.closest("[data-product-i18n-preserve],pre,script,style")) continue;
      if (element.hasAttribute("data-product-i18n")) for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const raw = node.nodeValue || "";
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const translated = translate(trimmed);
        if (translated !== trimmed) node.nodeValue = raw.slice(0, raw.indexOf(trimmed)) + translated + raw.slice(raw.indexOf(trimmed) + trimmed.length);
      }
      for (const attribute of ["aria-label", "placeholder", "title"]) {
        if (!element.hasAttribute("data-product-i18n-" + attribute)) continue;
        const value = element.getAttribute(attribute);
        if (value && translate(value) !== value) element.setAttribute(attribute, translate(value));
      }
    }
  };
  document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  const switcher = document.createElement("div");
  switcher.className = "product-language-switch";
  switcher.setAttribute("aria-label", "Language");
  const languageLabels = locale === "pt-BR" ? { zh:"Chinês", en:"Inglês", "pt-BR":"Português" } : { zh:"中文", en:"EN", "pt-BR":"PT-BR" };
  switcher.innerHTML = ["zh", "en", "pt-BR"].map((value) => '<button type="button" data-product-locale="' + value + '" aria-pressed="' + String(value === locale) + '">' + languageLabels[value] + '</button>').join("");
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
    const roots = new Set(records.map((record) => record.target instanceof Element ? record.target : record.target.parentElement));
    for (const root of roots) if (root && root.isConnected) apply(root);
  }).observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["aria-label", "placeholder", "title"] });
  apply(document.body);
})();
</script>`;
}

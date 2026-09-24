/* ============================================================
   caso-state.js — schema do Caso, backbone de 7 fases, template
   padrão de Governança (matriz Controller real) e persistência.
   ============================================================ */
window.CasoState = (function(){
  "use strict";

  var LS_KEY = "construtorProcessos.casoAtual.v1";

  var FASES_BACKBONE = [
    {
      ordem: 0, id: "fase0", nome: "PM Canvas do Projeto",
      objetivo: "Definir o projeto (Porquê, O quê, Quem, Como, Quando e Quanto) e registrar quem aprova e revisa cada uma das 7 fases, antes do processo nascer de fato — um projeto só se torna processo depois que a Fase 7 fecha."
    },
    {
      ordem: 1, id: "diagnostico", nome: "Diagnóstico e Viabilidade",
      objetivo: "Mapear o estado atual das operações para identificar desvios específicos, estabelecendo uma linha de base com indicadores mensuráveis que justifiquem a viabilidade e o cronograma de padronização do processo junto aos clientes e fornecedores."
    },
    {
      ordem: 2, id: "governanca", nome: "Governança e Compliance",
      objetivo: "Formalizar a estrutura de responsabilidades via Matriz RACI, definindo segregação de funções, limites financeiros exatos para alçadas de aprovação e regras sistêmicas estritas para mitigar riscos de forma objetiva e auditável."
    },
    {
      ordem: 3, id: "modelagem", nome: "Modelagem do Processo",
      objetivo: "Desenhar o fluxo ponta a ponta, da requisição inicial ao faturamento, estabelecendo metas de eficiência e tempos de ciclo (SLA) para cada etapa, garantindo a sincronização fluida de materiais e informações para zerar o retrabalho."
    },
    {
      ordem: 4, id: "auditoria", nome: "Auditoria, Riscos e Controles",
      objetivo: "Estruturar a matriz de riscos com controles preventivos e detectivos, estipulando taxas de amostragem estatística, periodicidade exata de verificação e prazos definidos para o registro e a resolução de não conformidades."
    },
    {
      ordem: 5, id: "sistemas", nome: "Sistemas, Tecnologia e Documentação",
      objetivo: "Parametrizar formulários sistêmicos com regras de validação e campos obrigatórios, garantindo 100% de rastreabilidade das ações e disponibilizando bases de conciliação e indicadores atualizados em tempo real."
    },
    {
      ordem: 6, id: "piloto", nome: "Piloto e Gestão de Mudança",
      objetivo: "Validar o novo modelo em um escopo controlado por um período determinado, mensurando a taxa de acerto operacional em relação à linha de base e atestando a capacitação prática de todos os usuários envolvidos antes da expansão."
    },
    {
      ordem: 7, id: "implantacao", nome: "Implantação e Estabelecimento",
      objetivo: "Aplicar correções baseadas exclusivamente nos dados do piloto, registrar formalmente as aprovações gerenciais da versão final e transferir o processo estabilizado para a operação, habilitando o ciclo de monitoramento contínuo."
    }
  ];

  /* As 7 fases "reais" do processo (exclui a Fase 0, que é definição de
     projeto/PM Canvas, não uma etapa do backbone RACI-governado). Usado
     pra montar as activities da RACI e o registro de Aprovador/Revisor. */
  function fasesReais(){
    return FASES_BACKBONE.filter(function(f){ return f.id !== "fase0"; });
  }

  /* Papéis e RACI da matriz Controller (controller.pdf) — template padrão
     da fase Governança e Compliance para todo caso novo. Área e Cargo vêm
     do template real; Nome fica em branco (é dado pessoal de colegas, não
     estrutural) — quem usar o template preenche com os nomes do seu time. */
  function seedControllerTemplate(){
    var roles = [
      {id:"role_1", area:"Controller", nome:"", cargo:"Auditor"},
      {id:"role_2", area:"PMO", nome:"", cargo:"Coordenadora"},
      {id:"role_3", area:"SoftwareHouse", nome:"", cargo:"Analista"},
      {id:"role_4", area:"LEAN", nome:"", cargo:"Analista"},
      {id:"role_5", area:"Planejamento", nome:"", cargo:"Analista"},
      {id:"role_6", area:"Unidade de Negócios", nome:"", cargo:"Gerente UN"},
      {id:"role_7", area:"CSC", nome:"", cargo:"Coordenadora"},
      {id:"role_8", area:"COO", nome:"", cargo:"Diretor"},
      {id:"role_9", area:"CFO", nome:"", cargo:"Diretor"}
    ];

    var activities = fasesReais().map(function(f, i){
      return {id:"act_" + (i+1), titulo:f.nome, descricao:f.objetivo};
    });

    /* Matriz RACI de cada fase (mesma ordem de roles acima), extraída linha a linha do controller.pdf. */
    var raciPorFase = {
      "Diagnóstico e Viabilidade":              ["R","A","I","I","I","C","C","C","C"],
      "Governança e Compliance":                ["R","A","I","I","I","C","C","C","C"],
      "Modelagem do Processo":                  ["R","C","I","C","I","C","I","A","C"],
      "Auditoria, Riscos e Controles":          ["R","C","I","I","I","I","I","A","C"],
      "Sistemas, Tecnologia e Documentação":    ["R","C","C","C","C","C","I","A","C"],
      "Piloto e Gestão de Mudança":              ["R","A","I","I","I","C","I","C","C"],
      "Implantação e Estabelecimento":           ["R","A","I","I","I","C","I","C","C"]
    };

    var cells = {};
    activities.forEach(function(act){
      var codigos = raciPorFase[act.titulo];
      if(!codigos) return;
      roles.forEach(function(role, idx){
        cells[act.id + "|" + role.id] = codigos[idx];
      });
    });

    return {
      variant: "RACI",
      title: "Matriz de Governança — Controller",
      desc: "Papéis e responsabilidades do Controller (consultor interno de processos) ao longo das 7 fases do caso.",
      roles: roles,
      activities: activities,
      cells: cells
    };
  }

  function raciEmBranco(){
    return {variant: "RACI", title: "Matriz de Governança", desc: "", roles: [], activities: [], cells: {}};
  }

  function construirFase(f, semRaciPadrao){
    return {
      ordem: f.ordem,
      id: f.id,
      nome: f.nome,
      objetivo: f.objetivo,
      status: "aberta",
      tarefas: [],
      entregaveis: [],
      ferramentas: {
        pmCanvas: f.id === "fase0" ? {
          pitch: "",
          justificativas: [], objetivosSmart: [], beneficios: [],
          produto: [], requisitos: [],
          stakeholders: [], equipe: [],
          premissas: [], entregaveisChave: [], restricoes: [],
          riscos: [], custos: []
        } : null,
        aprovadoresRevisores: f.id === "fase0" ? fasesReais().map(function(x){
          return {faseId: x.id, aprovador: "", revisor: ""};
        }) : null,
        raci: f.id === "governanca" ? (semRaciPadrao ? raciEmBranco() : seedControllerTemplate()) : null,
        w2h: f.id === "modelagem" ? {acoes: []} : null,
        fluxograma: f.id === "modelagem" ? {fluxos: []} : null,
        pop: f.id === "modelagem" ? {itens: []} : null,
        rastreabilidade: f.id === "sistemas" ? {itens: []} : null,
        sistemas: f.id === "sistemas" ? {itens: []} : null,
        abertura: f.id === "diagnostico" ? {objetivo: "", prazoAlvo: "", patrocinadorRoleId: "", patrocinadorNome: "", escopoDentro: [], escopoFora: [], criteriosSucesso: [], stakeholders: []} : null,
        gut: f.id === "diagnostico" ? {itens: []} : null,
        ishikawa: f.id === "diagnostico" ? {diagramas: []} : null,
        porques: f.id === "diagnostico" ? {analises: []} : null,
        riscos: f.id === "auditoria" ? {itens: []} : null,
        planoAuditoria: f.id === "auditoria" ? {itens: []} : null,
        regrasDivergencia: f.id === "auditoria" ? {itens: []} : null,
        alcadas: f.id === "governanca" ? {itens: []} : null,
        segregacao: f.id === "governanca" ? {pares: []} : null,
        checklist: f.id === "implantacao" ? {itens: []} : null,
        kpis: f.id === "implantacao" ? {itens: []} : null,
        encerramento: f.id === "implantacao" ? {resultadosAlcancados: "", dataEncerramento: "", criteriosAvaliados: [], licoesAprendidas: [], pendencias: []} : null,
        treinamento: f.id === "piloto" ? {itens: []} : null
      },
      fechamentos: []
    };
  }

  function novoCaso(nomeCaso, opcoes){
    var semRaciPadrao = opcoes && opcoes.semRaciPadrao;
    var agora = new Date().toISOString();
    return {
      id: "caso_" + Date.now(),
      nome: nomeCaso || "Novo caso",
      criadoEm: agora,
      atualizadoEm: agora,
      /* cicloAtual conta quantas vezes o processo inteiro já passou por
         "Reabrir Processo" (melhoria contínua) — começa em 1. dossieVersoes
         guarda o histórico de Dossiês gerados ao fechar um ciclo (mesmo
         padrão de fase.fechamentos[], só que no nível do caso inteiro em
         vez de uma fase só). O Dossiê "avulso" (botão da barra do caso,
         a qualquer momento) continua sem versionar — só o que marca o
         fim de um ciclo entra aqui. */
      cicloAtual: 1,
      dossieVersoes: [],
      fases: FASES_BACKBONE.map(function(f){ return construirFase(f, semRaciPadrao); })
    };
  }

  /* ---------------- Persistência ---------------- */
  function salvarCasoLocalStorage(caso){
    caso.atualizadoEm = new Date().toISOString();
    try{ localStorage.setItem(LS_KEY, JSON.stringify(caso)); }catch(e){ console.error("Falha ao salvar caso no localStorage", e); }
  }
  function carregarCasoLocalStorage(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(!raw) return null;
      var caso = JSON.parse(raw);
      /* Backfill pra casos salvos antes de cicloAtual/dossieVersoes existirem
         — mesmo espírito do backfill de ferramenta por ferramenta já feito
         em montarFases() (app.js), só que aqui no nível do caso inteiro. */
      if(caso){
        if(caso.cicloAtual == null) caso.cicloAtual = 1;
        if(!Array.isArray(caso.dossieVersoes)) caso.dossieVersoes = [];
        /* Backfill da Fase 0 (PM Canvas + registro de Aprovador/Revisor) pra
           casos salvos antes dela existir — insere no início do array, com
           estado vazio, sem mexer nas fases 1-7 já existentes. */
        if(Array.isArray(caso.fases) && !caso.fases.some(function(f){ return f.id === "fase0"; })){
          caso.fases.unshift(construirFase(FASES_BACKBONE[0], false));
        }
      }
      return caso;
    }catch(e){ console.error("Falha ao carregar caso do localStorage", e); return null; }
  }

  function slugCaso(s){
    return (s||"caso").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") || "caso";
  }

  function baixarRascunhoCaso(caso){
    var payload = {__casoDraft:true, version:1, savedAt:new Date().toISOString(), caso:caso};
    var blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = slugCaso(caso.nome) + "-rascunho.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importarRascunhoDeArquivo(file, onDone){
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var data = JSON.parse(String(reader.result));
        if(!data || typeof data !== "object" || !data.caso || !Array.isArray(data.caso.fases)){
          throw new Error("Formato inválido");
        }
        onDone(data.caso, null);
      }catch(err){
        onDone(null, err);
      }
    };
    reader.onerror = function(){ onDone(null, new Error("Não foi possível ler o arquivo")); };
    reader.readAsText(file);
  }

  return {
    FASES_BACKBONE: FASES_BACKBONE,
    novoCaso: novoCaso,
    seedControllerTemplate: seedControllerTemplate,
    salvarCasoLocalStorage: salvarCasoLocalStorage,
    carregarCasoLocalStorage: carregarCasoLocalStorage,
    baixarRascunhoCaso: baixarRascunhoCaso,
    importarRascunhoDeArquivo: importarRascunhoDeArquivo,
    slugCaso: slugCaso
  };
})();

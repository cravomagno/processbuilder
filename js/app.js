/* ============================================================
   app.js — bootstrap do Construtor de Processos: cria/carrega o
   Caso, monta os módulos de cada fase, liga a navegação e a
   persistência (localStorage + rascunho .json do caso inteiro).
   ============================================================ */
(function(){
  "use strict";

  var caso = window.CasoState.carregarCasoLocalStorage() || window.CasoState.novoCaso("Implantação de Novo Processo");

  var faseIds = window.CasoState.FASES_BACKBONE.map(function(f){ return f.id; });

  function porId(id){ return caso.fases.filter(function(f){ return f.id === id; })[0]; }

  function persistir(){
    window.CasoState.salvarCasoLocalStorage(caso);
    atualizarNavStatus();
    atualizarCasoBar();
  }

  function atualizarNavStatus(){
    document.querySelectorAll(".nav-tab").forEach(function(tab){
      var fase = porId(tab.dataset.fase);
      if(!fase) return;
      tab.classList.toggle("status-fechada", fase.status === "fechada");
    });
  }

  function atualizarCasoBar(){
    var nomeEl = document.getElementById("casoNome");
    var metaEl = document.getElementById("casoMeta");
    if(nomeEl) nomeEl.textContent = caso.nome;
    if(metaEl){
      var fechadas = caso.fases.filter(function(f){ return f.status === "fechada"; }).length;
      metaEl.textContent = fechadas + " de " + caso.fases.length + " fases fechadas — atualizado em " + new Date(caso.atualizadoEm).toLocaleString("pt-BR");
    }
  }

  function atualizarFaseHead(faseId){
    var fase = porId(faseId);
    var badge = document.querySelector("#fase-view-" + faseId + " .fase-status-badge");
    var historico = document.querySelector("#fase-view-" + faseId + " .historico");
    if(badge){
      badge.textContent = fase.status === "fechada" ? "Fechada (v" + fase.fechamentos.length + ")" : "Aberta";
      badge.classList.toggle("fechada", fase.status === "fechada");
    }
    if(historico){
      historico.textContent = fase.fechamentos.length === 0
        ? "Nenhum fechamento ainda."
        : "Último fechamento: v" + fase.fechamentos[fase.fechamentos.length-1].versao + " em " + new Date(fase.fechamentos[fase.fechamentos.length-1].dataFechamento).toLocaleDateString("pt-BR");
    }
  }

  /* Gatilho de reabertura de ciclo — só perguntado ao fechar a Fase 7
     (a última do backbone). Se o gap encontrado for estrutural, faz
     backup do caso atual (.json) e abre um novo caso do zero para o
     próximo ciclo de melhoria contínua, sem perder o histórico do caso
     que está sendo encerrado agora. */
  function sugerirNomeProximoCiclo(nomeAtual){
    var m = nomeAtual.match(/^(.*)—\s*Ciclo\s*(\d+)\s*$/i);
    if(m){
      var base = m[1].replace(/\s+$/, "");
      var n = parseInt(m[2], 10) + 1;
      return base + " — Ciclo " + n;
    }
    return nomeAtual + " — Ciclo 2";
  }

  function ofertarReaberturaDeCiclo(){
    var estrutural = window.confirm(
      "Fase 7 (Implantação e Estabelecimento) fechada.\n\n" +
      "O gap encontrado durante a implantação é estrutural e exige um novo ciclo de melhoria contínua neste processo?\n\n" +
      "Se confirmar, um backup deste caso será salvo (.json) e um novo caso será aberto do zero, com as 7 fases prontas para o próximo ciclo."
    );
    if(!estrutural) return;

    window.CasoState.baixarRascunhoCaso(caso);
    if(window.AppToast) window.AppToast.show("Backup do caso atual salvo. Preparando o novo ciclo...");

    var nomeSugerido = sugerirNomeProximoCiclo(caso.nome);
    var nomeNovo = window.prompt("Nome do novo caso (próximo ciclo):", nomeSugerido);
    if(nomeNovo === null) return;
    nomeNovo = nomeNovo.trim();
    if(!nomeNovo) return;

    var novo = window.CasoState.novoCaso(nomeNovo);
    window.CasoState.salvarCasoLocalStorage(novo);
    location.reload();
  }

  function wireFecharFase(faseId){
    var btn = document.querySelector("#fase-view-" + faseId + " .btn-fechar");
    if(!btn) return;
    btn.addEventListener("click", function(){
      try{
        var resultado = window.Fechamento.gerarPdfFechamentoFase(caso, faseId);
        persistir();
        atualizarFaseHead(faseId);
        if(window.AppToast) window.AppToast.show("Fase fechada. PDF gerado (versão " + resultado.versao + ").");
        if(faseId === "implantacao"){
          ofertarReaberturaDeCiclo();
        }
      }catch(err){
        console.error(err);
        if(window.AppToast) window.AppToast.show("Não foi possível gerar o PDF de fechamento.", true);
      }
    });

    var reabrirBtn = document.querySelector("#fase-view-" + faseId + " .btn-reabrir");
    if(reabrirBtn){
      reabrirBtn.addEventListener("click", function(){
        porId(faseId).status = "aberta";
        persistir();
        atualizarFaseHead(faseId);
      });
    }
  }

  function montarFases(){
    window.CasoState.FASES_BACKBONE.forEach(function(f){
      var fase = porId(f.id);

      if(f.id === "diagnostico"){
        // Fase com quatro ferramentas simultâneas — Termo de Abertura delimita
        // o processo antes de tudo, GUT prioriza qual problema atacar, Ishikawa
        // mapeia por que ele pode estar acontecendo (6M), 5 Porquês aprofunda
        // uma causa específica até a raiz.
        fase.ferramentas.abertura = fase.ferramentas.abertura || {objetivo: "", prazoAlvo: "", patrocinadorRoleId: "", patrocinadorNome: "", escopoDentro: [], escopoFora: [], criteriosSucesso: [], stakeholders: []}; // backfill p/ casos salvos antes deste módulo existir
        fase.ferramentas.gut = fase.ferramentas.gut || {itens: []};
        fase.ferramentas.ishikawa = fase.ferramentas.ishikawa || {diagramas: []};
        fase.ferramentas.porques = fase.ferramentas.porques || {analises: []};
        var governancaFaseDiagnostico = porId("governanca");
        window.AberturaModule.mount(document.getElementById("fase-root-diagnostico-abertura"), fase.ferramentas.abertura, function(){ persistir(); }, governancaFaseDiagnostico && governancaFaseDiagnostico.ferramentas.raci);
        window.GUTModule.mount(document.getElementById("fase-root-diagnostico-gut"), fase.ferramentas.gut, function(){ persistir(); });
        window.IshikawaModule.mount(document.getElementById("fase-root-diagnostico-ishikawa"), fase.ferramentas.ishikawa, function(){ persistir(); }, fase.ferramentas.gut);
        window.PorquesModule.mount(document.getElementById("fase-root-diagnostico-porques"), fase.ferramentas.porques, function(){ persistir(); }, fase.ferramentas.gut);
      } else if(f.id === "implantacao"){
        // Fase com três ferramentas simultâneas — KPIs mede, Checklist confirma
        // cobertura, Termo de Encerramento fecha o par com o Termo de Abertura.
        fase.ferramentas.checklist = fase.ferramentas.checklist || {itens: []}; // backfill p/ casos salvos antes deste módulo existir
        fase.ferramentas.kpis = fase.ferramentas.kpis || {itens: []};
        fase.ferramentas.encerramento = fase.ferramentas.encerramento || {resultadosAlcancados: "", dataEncerramento: "", criteriosAvaliados: [], licoesAprendidas: [], pendencias: []};
        var diagnosticoFaseImplantacao = porId("diagnostico");
        window.KpisModule.mount(document.getElementById("fase-root-implantacao-kpis"), fase.ferramentas.kpis, function(){ persistir(); });
        window.ChecklistModule.mount(document.getElementById("fase-root-implantacao-checklist"), fase.ferramentas.checklist, function(){ persistir(); });
        window.EncerramentoModule.mount(document.getElementById("fase-root-implantacao-encerramento"), fase.ferramentas.encerramento, function(){ persistir(); }, diagnosticoFaseImplantacao && diagnosticoFaseImplantacao.ferramentas.abertura);
      } else if(f.id === "governanca"){
        // Fase com três ferramentas simultâneas — RACI define papéis, Alçadas
        // define limites, Segregação de Funções detecta conflitos entre elas.
        fase.ferramentas.alcadas = fase.ferramentas.alcadas || {itens: []}; // backfill p/ casos salvos antes deste módulo existir
        fase.ferramentas.segregacao = fase.ferramentas.segregacao || {pares: []};
        window.RaciModule.mount(document.getElementById("fase-root-governanca"), fase.ferramentas.raci, function(){ persistir(); });
        window.AlcadasModule.mount(document.getElementById("fase-root-governanca-alcadas"), fase.ferramentas.alcadas, function(){ persistir(); }, fase.ferramentas.raci);
        window.SegregacaoModule.mount(document.getElementById("fase-root-governanca-segregacao"), fase.ferramentas.segregacao, function(){ persistir(); }, fase.ferramentas.raci);
      } else if(f.id === "auditoria"){
        // Fase com três ferramentas simultâneas — Riscos identifica e pontua,
        // Plano de Auditoria define como e com que frequência cada um é
        // verificado, Regras de Divergência/Exceção cataloga tipos de
        // achado com severidade, prazo e escalonamento.
        fase.ferramentas.riscos = fase.ferramentas.riscos || {itens: []}; // backfill p/ casos salvos antes deste módulo existir
        fase.ferramentas.planoAuditoria = fase.ferramentas.planoAuditoria || {itens: []};
        fase.ferramentas.regrasDivergencia = fase.ferramentas.regrasDivergencia || {itens: []};
        var governancaFase = porId("governanca");
        window.RiscosModule.mount(document.getElementById("fase-root-auditoria"), fase.ferramentas.riscos, function(){ persistir(); });
        window.PlanoAuditoriaModule.mount(document.getElementById("fase-root-auditoria-plano"), fase.ferramentas.planoAuditoria, function(){ persistir(); }, fase.ferramentas.riscos, governancaFase && governancaFase.ferramentas.raci);
        window.RegrasDivergenciaModule.mount(document.getElementById("fase-root-auditoria-regrasdiv"), fase.ferramentas.regrasDivergencia, function(){ persistir(); }, governancaFase && governancaFase.ferramentas.raci);
      } else if(f.id === "modelagem"){
        // Fase com três ferramentas simultâneas — 5W2H planeja as ações,
        // Fluxograma desenha o processo "to-be" com raias por papel, POPs
        // documenta o passo a passo de cada etapa do fluxo.
        fase.ferramentas.w2h = fase.ferramentas.w2h || {acoes: []}; // backfill p/ casos salvos antes deste módulo existir
        fase.ferramentas.fluxograma = fase.ferramentas.fluxograma || {fluxos: []};
        fase.ferramentas.pop = fase.ferramentas.pop || {itens: []};
        var governancaFaseModelagem = porId("governanca");
        window.W2HModule.mount(document.getElementById("fase-root-modelagem"), fase.ferramentas.w2h, function(){ persistir(); });
        window.FluxogramaModule.mount(document.getElementById("fase-root-modelagem-fluxograma"), fase.ferramentas.fluxograma, function(){ persistir(); }, governancaFaseModelagem && governancaFaseModelagem.ferramentas.raci);
        window.PopModule.mount(document.getElementById("fase-root-modelagem-pop"), fase.ferramentas.pop, function(){ persistir(); }, fase.ferramentas.fluxograma, governancaFaseModelagem && governancaFaseModelagem.ferramentas.raci);
      } else if(f.id === "sistemas"){
        // Fase com duas ferramentas simultâneas — Matriz de Rastreabilidade
        // acompanha cada campo/dado do início ao fim do processo, Sistemas
        // registra a aquisição de terceiros ou o desenvolvimento interno.
        fase.ferramentas.rastreabilidade = fase.ferramentas.rastreabilidade || {itens: []}; // backfill p/ casos salvos antes deste módulo existir
        fase.ferramentas.sistemas = fase.ferramentas.sistemas || {itens: []};
        var governancaFaseSistemas = porId("governanca");
        var modelagemFaseSistemas = porId("modelagem");
        window.RastreabilidadeModule.mount(document.getElementById("fase-root-sistemas"), fase.ferramentas.rastreabilidade, function(){ persistir(); }, modelagemFaseSistemas && modelagemFaseSistemas.ferramentas.fluxograma, governancaFaseSistemas && governancaFaseSistemas.ferramentas.raci);
        window.SistemasModule.mount(document.getElementById("fase-root-sistemas-aquisicao"), fase.ferramentas.sistemas, function(){ persistir(); }, governancaFaseSistemas && governancaFaseSistemas.ferramentas.raci);
      } else {
        var root = document.getElementById("fase-root-" + f.id);
        if(f.id === "piloto"){
          fase.ferramentas.treinamento = fase.ferramentas.treinamento || {itens: []}; // backfill p/ casos salvos antes deste módulo existir
          window.TreinamentoModule.mount(root, fase.ferramentas.treinamento, function(){ persistir(); });
        } else {
          window.PlaceholderModule.mount(root, fase, persistir);
        }
      }

      document.querySelectorAll("#fase-view-" + f.id + " .fase-objetivo").forEach(function(el){ el.textContent = f.objetivo; });
      atualizarFaseHead(f.id);
      wireFecharFase(f.id);
    });
  }

  function montarNavTabs(){
    var nav = document.getElementById("faseNav");
    window.CasoState.FASES_BACKBONE.forEach(function(f){
      var tab = document.createElement("button");
      tab.className = "nav-tab";
      tab.dataset.fase = f.id;
      tab.innerHTML = '<span class="nav-tab-top"><span class="status-dot"></span><span class="n">F' + f.ordem + '</span></span><span class="nav-tab-label">' + f.nome + '</span>';
      nav.appendChild(tab);
    });
  }

  function wireCasoBar(){
    document.getElementById("btnGerarDossie").addEventListener("click", function(){
      try{
        window.Dossie.gerarDossiePdf(caso);
        if(window.AppToast) window.AppToast.show("Dossiê consolidado gerado.");
      }catch(err){
        console.error(err);
        if(window.AppToast) window.AppToast.show("Não foi possível gerar o dossiê.", true);
      }
    });
    document.getElementById("btnSalvarRascunho").addEventListener("click", function(){
      window.CasoState.baixarRascunhoCaso(caso);
      if(window.AppToast) window.AppToast.show("Rascunho do caso salvo.");
    });
    document.getElementById("btnCarregarRascunho").addEventListener("click", function(){
      document.getElementById("inputCarregarRascunho").click();
    });
    document.getElementById("btnNovoCaso").addEventListener("click", function(){
      var ok = window.confirm(
        "Iniciar um novo caso do zero, com as 7 fases em branco?\n\n" +
        "Antes de limpar a tela, um backup do caso atual (\"" + caso.nome + "\") será salvo automaticamente (.json) — você pode recarregá-lo depois em \"Carregar rascunho\" para continuar de onde parou."
      );
      if(!ok) return;

      window.CasoState.baixarRascunhoCaso(caso);
      if(window.AppToast) window.AppToast.show("Backup do caso atual salvo. Preparando o novo caso...");

      var nomeNovo = window.prompt("Nome do novo caso:", "Novo processo");
      if(nomeNovo === null) return;
      nomeNovo = nomeNovo.trim();
      if(!nomeNovo) return;

      var novo = window.CasoState.novoCaso(nomeNovo, {semRaciPadrao: true});
      window.CasoState.salvarCasoLocalStorage(novo);
      location.reload();
    });
    document.getElementById("inputCarregarRascunho").addEventListener("change", function(e){
      var file = e.target.files && e.target.files[0];
      if(!file) return;
      var ok = window.confirm("Carregar este rascunho substitui o caso aberto agora. Continuar?");
      if(!ok){ e.target.value = ""; return; }
      window.CasoState.importarRascunhoDeArquivo(file, function(casoCarregado, err){
        if(err){
          if(window.AppToast) window.AppToast.show("Esse arquivo não parece ser um rascunho válido.", true);
          return;
        }
        caso = casoCarregado;
        window.CasoState.salvarCasoLocalStorage(caso);
        location.reload();
      });
      e.target.value = "";
    });
  }

  function boot(){
    montarNavTabs();
    montarFases();
    wireCasoBar();
    atualizarCasoBar();
    atualizarNavStatus();
    window.Nav.init(faseIds, "diagnostico");
    if(window.DocsFase) window.DocsFase.init();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();

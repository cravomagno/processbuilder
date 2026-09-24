/* ============================================================
   app.js — bootstrap do Construtor de Processos: cria/carrega o
   Caso, monta os módulos de cada fase, liga a navegação e a
   persistência (localStorage + rascunho .json do caso inteiro).
   ============================================================ */
(function(){
  "use strict";

  var caso = window.CasoState.carregarCasoLocalStorage();

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
      metaEl.textContent = fechadas + " de " + caso.fases.length + " fases fechadas   •   Ciclo " + caso.cicloAtual + "   •   atualizado em " + new Date(caso.atualizadoEm).toLocaleString("pt-BR");
    }
    /* Mesmo brasão embutido usado no cabeçalho dos PDFs (js/core/logo-data.js)
       — bloco opcional, se o arquivo não tiver sido carregado a imagem
       simplesmente não aparece (hidden por padrão no app.html). */
    var brasaoEl = document.getElementById("casoBrasao");
    if(brasaoEl && window.LOGO_BASE64 && !brasaoEl.src){
      brasaoEl.src = window.LOGO_BASE64;
      brasaoEl.hidden = false;
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
    /* "Reabrir fase" só faz sentido (e só aparece) quando há algo pra
       reabrir — com a fase aberta, clicar nele não teria efeito nenhum
       e só confundia (o mesmo tipo de confusão que o aviso de bloqueio
       com bug de CSS causou). Usa style.display em vez do atributo
       hidden de propósito: .btn já define display:inline-flex com a
       mesma especificidade de [hidden]{display:none} — um estilo
       inline sempre vence qualquer regra de folha de estilo externa,
       então não corre o mesmo risco que o aviso teve. */
    var reabrirBtnHead = document.querySelector("#fase-view-" + faseId + " .btn-reabrir");
    if(reabrirBtnHead) reabrirBtnHead.style.display = (fase.status === "fechada") ? "" : "none";

    var fecharBtnHead = document.querySelector("#fase-view-" + faseId + " .btn-fechar");
    if(fecharBtnHead){
      fecharBtnHead.dataset.tooltip = fase.status === "fechada"
        ? "A fase já está fechada — clique gera de novo o PDF da versão atual, sem criar uma versão nova."
        : "Fecha a fase e gera o PDF — trava a edição dos campos até 'Reabrir fase'.";
    }

    aplicarBloqueioFase(faseId);
    atualizarBotaoReabrirProcesso();

    var proximaBtn = document.querySelector("#fase-view-" + faseId + " .fase-proxima-btn");
    if(proximaBtn) proximaBtn.disabled = fase.status !== "fechada";
  }

  /* Ícones das ações de fechamento (mesmo padrão visual dos ícones da
     barra do caso e da nav: SVG 24x24, traço 1.8, sem preenchimento,
     cor via currentColor) + o botão "Próxima fase", que só existe
     quando há uma fase seguinte no backbone (a última, Implantação,
     não tem — o "próximo passo" dela é "Reabrir Processo"). Chamada
     uma vez por fase, no momento em que ela é montada. */
  var ICONE_FECHAR = '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
  var ICONE_REABRIR = '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.3-2.2"/>';
  var ICONE_PROXIMA = '<line x1="4" y1="12" x2="17" y2="12"/><path d="M12 6l6 6-6 6"/>';

  function svgIcone(paths){
    return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  function prepararBotoesFechamento(faseId){
    var fecharBtn = document.querySelector("#fase-view-" + faseId + " .btn-fechar");
    if(fecharBtn) fecharBtn.insertAdjacentHTML("afterbegin", svgIcone(ICONE_FECHAR));

    var reabrirBtn = document.querySelector("#fase-view-" + faseId + " .btn-reabrir");
    if(reabrirBtn) reabrirBtn.insertAdjacentHTML("afterbegin", svgIcone(ICONE_REABRIR));

    var bloco = window.CasoState.FASES_BACKBONE;
    var idx = bloco.map(function(f){ return f.id; }).indexOf(faseId);
    var proxima = idx !== -1 ? bloco[idx + 1] : null;
    if(!proxima) return; // última fase (Implantação) — não tem "próxima", tem "Reabrir Processo"

    var fechamentoEl = document.querySelector("#fase-view-" + faseId + " .fase-fechamento");
    if(!fechamentoEl) return;

    var wrap = document.createElement("div");
    wrap.className = "fase-proxima";
    var btn = document.createElement("button");
    btn.className = "fase-proxima-btn";
    btn.type = "button";
    btn.disabled = true;
    btn.dataset.tooltip = "Libera assim que esta fase for fechada.";
    btn.innerHTML = "Próxima fase — Fase " + proxima.ordem + ": " + proxima.nome + " " + svgIcone(ICONE_PROXIMA);
    btn.addEventListener("click", function(){
      if(btn.disabled) return;
      window.Nav.irParaFase(proxima.id);
    });
    wrap.appendChild(btn);
    fechamentoEl.insertAdjacentElement("afterend", wrap);
  }

  /* Bloqueia (ou libera) os campos de uma fase conforme seu status —
     "fechada" trava tudo até "Reabrir fase" ser clicado. Percorre todos
     os mount points da fase (`fase-root-<id>*`) e desabilita cada
     input/select/textarea/button encontrado, mais o campo de texto rico
     (contenteditable, que não é um controle de formulário nativo e por
     isso precisa ser tratado à parte). Botões marcados com a classe
     .fase-nao-bloquear (ex.: Exportar PDF/Excel da RACI) ficam de fora
     — são leitura, não edição, continuam liberados mesmo com a fase
     fechada. O cabeçalho da fase e os botões "Fechar fase"/"Reabrir
     fase" nunca são tocados aqui (ficam fora de qualquer fase-root). */
  function aplicarBloqueioFase(faseId){
    var fase = porId(faseId);
    var bloqueado = fase.status === "fechada";

    var aviso = document.getElementById("fase-bloqueio-" + faseId);
    if(aviso) aviso.hidden = !bloqueado;

    document.querySelectorAll('[id^="fase-root-' + faseId + '"]').forEach(function(raiz){
      raiz.classList.toggle("fase-campos-bloqueada", bloqueado);
      raiz.querySelectorAll("input, select, textarea, button").forEach(function(el){
        if(el.classList.contains("fase-nao-bloquear")) return;
        el.disabled = bloqueado;
      });
      raiz.querySelectorAll("[contenteditable]").forEach(function(el){
        el.contentEditable = bloqueado ? "false" : "true";
      });
    });
  }

  /* "Reabrir Processo" — melhoria contínua dentro do MESMO caso, em vez
     de criar um caso novo do zero (mecanismo antigo, removido: forçava
     recriar RACI/Fluxograma/POPs a cada ciclo). Só aparece na Fase 7
     quando as 7 fases já estão fechadas; ao confirmar, baixa um backup,
     versiona o Dossiê marcando o fim do ciclo atual, e reabre as 7
     fases pra edição — nenhum dado é apagado. */
  function todasFasesFechadas(){
    return caso.fases.every(function(f){ return f.status === "fechada"; });
  }

  function atualizarBotaoReabrirProcesso(){
    var btn = document.getElementById("btnReabrirProcesso");
    if(btn) btn.style.display = todasFasesFechadas() ? "" : "none";
  }

  function reabrirProcesso(){
    if(!todasFasesFechadas()) return;
    var confirmar = window.confirm(
      "Reabrir o processo para o Ciclo " + (caso.cicloAtual + 1) + " de melhoria contínua?\n\n" +
      "Isso vai:\n" +
      "• Baixar um backup do caso atual (.json)\n" +
      "• Gerar e versionar o Dossiê consolidado, marcando o fechamento do Ciclo " + caso.cicloAtual + "\n" +
      "• Reabrir as 7 fases para edição\n\n" +
      "Nenhum dado é apagado — só libera os campos de novo."
    );
    if(!confirmar) return;

    try{
      window.CasoState.baixarRascunhoCaso(caso);
      var resultadoDossie = window.Dossie.gerarDossieVersionadoDeCiclo(caso);

      caso.fases.forEach(function(f){ f.status = "aberta"; });
      caso.cicloAtual += 1;
      persistir();
      caso.fases.forEach(function(f){ atualizarFaseHead(f.id); });

      if(window.AppToast) window.AppToast.show("Processo reaberto — Ciclo " + caso.cicloAtual + " iniciado. Backup e Dossiê v" + resultadoDossie.versao + " salvos.");
    }catch(err){
      console.error(err);
      if(window.AppToast) window.AppToast.show("Não foi possível reabrir o processo.", true);
    }
  }

  function wireReabrirProcesso(){
    var btn = document.getElementById("btnReabrirProcesso");
    if(btn) btn.addEventListener("click", reabrirProcesso);
  }

  function wireFecharFase(faseId){
    var btn = document.querySelector("#fase-view-" + faseId + " .btn-fechar");
    if(!btn) return;
    btn.addEventListener("click", function(){
      try{
        /* A fase já fechada não tem nada de novo pra virar versão — os
           campos estão travados desde o último fechamento (ver
           aplicarBloqueioFase). Clicar de novo aqui só rebaixa o PDF da
           versão atual, sem criar uma versão nova nem mexer no
           histórico; só "Reabrir fase" + fechar de novo cria uma versão. */
        var jaFechada = porId(faseId).status === "fechada";
        var resultado = jaFechada
          ? window.Fechamento.regerarPdfUltimaVersao(caso, faseId)
          : window.Fechamento.gerarPdfFechamentoFase(caso, faseId);
        persistir();
        atualizarFaseHead(faseId);
        if(window.AppToast){
          window.AppToast.show(jaFechada
            ? "PDF da versão " + resultado.versao + " gerado novamente (sem criar versão nova)."
            : "Fase fechada. PDF gerado (versão " + resultado.versao + ").");
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

      if(f.id === "fase0"){
        // Tela de definição do projeto (PM Canvas) + registro vivo de
        // Aprovador(a)/Revisor(a) por fase — antecede as 7 fases reais
        // do processo. Estado passado como um wrapper com as duas
        // referências (mesmos objetos de fase.ferramentas, não cópias),
        // pra persistir() continuar serializando o caso original certo.
        window.Fase0Module.mount(
          document.getElementById("fase-root-fase0"),
          {pmCanvas: fase.ferramentas.pmCanvas, aprovadoresRevisores: fase.ferramentas.aprovadoresRevisores},
          function(){ persistir(); }
        );
      } else if(f.id === "diagnostico"){
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
      prepararBotoesFechamento(f.id);
      atualizarFaseHead(f.id);
      wireFecharFase(f.id);
    });
  }

  /* Um ícone de linha por fase (mesmo padrão visual dos ícones da barra do
     caso: viewBox 24x24, stroke 1.8, cantos/junções arredondados, sem
     preenchimento) — puramente decorativo (aria-hidden), a cor vem de
     `stroke:currentColor` em .nav-tab-icon, então já acompanha o estado
     normal/hover/active da aba sem precisar de uma versão colorida à parte. */
  var NAV_TAB_ICONS = {
    fase0: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4"/>',
    diagnostico: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.2" y2="15.2"/>',
    governanca: '<path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z"/>',
    modelagem: '<circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M6.8 7.8L11 16M17.2 7.8L13 16"/>',
    auditoria: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z"/><path d="M8.5 13l2.2 2.2L15.5 10.5"/>',
    sistemas: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><line x1="7" y1="7" x2="9.5" y2="7"/><line x1="7" y1="17" x2="9.5" y2="17"/>',
    piloto: '<path d="M12 2c2.5 2 4 5.5 4 9 0 2-.5 3.5-1.3 5H9.3C8.5 13.5 8 12 8 11c0-3.5 1.5-7 4-9z"/><circle cx="12" cy="10" r="1.6"/><path d="M8.3 15l-2.6 2.6M15.7 15l2.6 2.6M10.2 18.2l-.9 2.8M13.8 18.2l.9 2.8"/>',
    implantacao: '<line x1="5" y1="3" x2="5" y2="21"/><path d="M5 4h13l-3 4 3 4H5"/>'
  };

  function montarNavTabs(){
    var nav = document.getElementById("faseNav");
    window.CasoState.FASES_BACKBONE.forEach(function(f){
      var tab = document.createElement("button");
      tab.className = "nav-tab tooltip-abaixo";
      tab.dataset.fase = f.id;
      tab.dataset.tooltip = "Fase " + f.ordem + " — " + f.nome + ". Bolinha verde = fase fechada; cinza = ainda aberta.";
      var iconPaths = NAV_TAB_ICONS[f.id] || "";
      tab.innerHTML =
        '<svg class="nav-tab-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + iconPaths + '</svg>' +
        '<span class="nav-tab-top"><span class="status-dot"></span><span class="n">F' + f.ordem + '</span></span>' +
        '<span class="nav-tab-label">' + f.nome + '</span>';
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

  function wireLanding(){
    var landing = document.getElementById("landingScreen");
    var shell = document.querySelector(".app-shell");
    shell.style.display = "none";
    landing.style.display = "flex";

    document.getElementById("landingNovoBtn").addEventListener("click", function(){
      var nome = window.prompt("Nome do novo processo:", "Novo processo");
      if(nome === null) return;
      nome = nome.trim();
      if(!nome) return;
      var novo = window.CasoState.novoCaso(nome, {semRaciPadrao: true});
      window.CasoState.salvarCasoLocalStorage(novo);
      location.reload();
    });

    document.getElementById("landingCarregarBtn").addEventListener("click", function(){
      document.getElementById("landingInputCarregar").click();
    });
    document.getElementById("landingInputCarregar").addEventListener("change", function(e){
      var file = e.target.files && e.target.files[0];
      if(!file) return;
      window.CasoState.importarRascunhoDeArquivo(file, function(casoCarregado, err){
        if(err){
          window.alert("Esse arquivo não parece ser um rascunho válido.");
          return;
        }
        window.CasoState.salvarCasoLocalStorage(casoCarregado);
        location.reload();
      });
      e.target.value = "";
    });

    document.getElementById("landingDocsBtn").addEventListener("click", function(){
      if(!window.DocsFase) return;
      window.DocsFase.abrir("geral", "Documentação", "Visão geral do sistema", landing);
    });

    if(window.DocsFase) window.DocsFase.init();
  }

  function boot(){
    var anoEl = document.getElementById("copyrightAno");
    if(anoEl) anoEl.textContent = new Date().getFullYear();

    if(!caso){
      wireLanding();
      return;
    }
    montarNavTabs();
    montarFases();
    wireCasoBar();
    wireReabrirProcesso();
    atualizarCasoBar();
    atualizarNavStatus();
    window.Nav.init(faseIds, "fase0");
    if(window.DocsFase) window.DocsFase.init();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();

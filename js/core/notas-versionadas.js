/* ============================================================
   notas-versionadas.js — controlador reutilizável para um campo de
   "notas" (texto rico, via RichText) com tela dedicada, que:
   - fica editável enquanto a fase está aberta;
   - vira somente-leitura quando a fase fecha (congela o conteúdo
     atual como uma versão no histórico, carimbada com data/versão);
   - continua como rascunho ao reabrir a fase (não é limpo — o
     usuário continua refinando o mesmo texto até a próxima vez que
     fechar, quando uma NOVA versão é congelada);
   - o histórico de versões fica sempre consultável na própria tela;
   - o PDF de fechamento da fase imprime só a versão atual (a última
     congelada), com seu carimbo de data/hora.

   Cada ferramenta que usa isso (Matriz de Alçadas, Segregação de
   Funções) chama criarControlador({overlayId, slotId, backBtnId,
   placeholder}) uma vez, no escopo do módulo, e usa o controlador
   devolvido nos 4 pontos de integração: abrir (clique no botão),
   atualizarBloqueio (a partir de aplicarBloqueioFase em app.js),
   congelar (a partir de Fechamento.gerarPdfFechamentoFase) e
   desenharNoDoc (a partir do desenharNoDoc da própria ferramenta).

   O "state" passado para abrir/congelar/desenharNoDoc é o objeto de
   estado da própria ferramenta (ex.: fase.ferramentas.alcadas), que
   ganha dois campos: `notas` (string HTML, rascunho atual) e
   `notasHistorico` (array de {versao, data, html}, mais antiga
   primeiro) — ambos com backfill automático se ainda não existirem.
   ============================================================ */
window.NotasVersionadas = (function(){
  "use strict";

  function formatarData(iso){
    return window.PdfDoc ? window.PdfDoc.formatarDataHora(iso) : new Date(iso).toLocaleString("pt-BR");
  }

  function criarControlador(cfg){
    cfg = cfg || {};
    var elOverlay = null, elSlot = null, elBackBtn = null;
    var faseFechada = false;

    function garantirCampos(state){
      if(state.notas === undefined) state.notas = "";
      if(!Array.isArray(state.notasHistorico)) state.notasHistorico = [];
    }

    function fechar(){
      if(!elOverlay) return;
      elOverlay.style.display = "none";
      var shell = document.querySelector(".app-shell");
      if(shell) shell.style.display = "";
    }

    function renderHistorico(container, state){
      container.innerHTML = "";
      if(!state.notasHistorico.length){
        var vazio = document.createElement("p");
        vazio.className = "notas-historico-vazio";
        vazio.textContent = "Nenhuma versão fechada ainda — o histórico nasce na primeira vez que esta fase for fechada.";
        container.appendChild(vazio);
        return;
      }
      state.notasHistorico.slice().reverse().forEach(function(v){
        var card = document.createElement("div");
        card.className = "notas-historico-card";

        var topo = document.createElement("div");
        topo.className = "notas-historico-topo";
        var rotulo = document.createElement("strong");
        rotulo.textContent = "Versão " + v.versao + " — " + formatarData(v.data);
        topo.appendChild(rotulo);
        var verBtn = document.createElement("button");
        verBtn.type = "button";
        verBtn.className = "btn btn-ghost";
        verBtn.textContent = "Ver";
        topo.appendChild(verBtn);
        card.appendChild(topo);

        var corpo = document.createElement("div");
        corpo.className = "richtext-editor richtext-editor-readonly notas-historico-corpo";
        corpo.innerHTML = v.html || '<span class="notas-vazio">(sem conteúdo)</span>';
        corpo.style.display = "none";
        card.appendChild(corpo);

        verBtn.addEventListener("click", function(){
          var aberto = corpo.style.display !== "none";
          corpo.style.display = aberto ? "none" : "block";
          verBtn.textContent = aberto ? "Ver" : "Ocultar";
        });

        container.appendChild(card);
      });
    }

    function abrir(state, onChangeCb){
      if(!elOverlay){
        elOverlay = document.getElementById(cfg.overlayId);
        elSlot = document.getElementById(cfg.slotId);
        elBackBtn = document.getElementById(cfg.backBtnId);
        if(!elOverlay) return;
        elBackBtn.addEventListener("click", fechar);
      }
      garantirCampos(state);

      var shell = document.querySelector(".app-shell");
      if(shell) shell.style.display = "none";
      elOverlay.style.display = "block";
      window.scrollTo(0, 0);

      elSlot.innerHTML = "";

      var painelAtual = document.createElement("div");
      painelAtual.className = "riscos-panel notas-painel notas-atual-painel";
      var tituloAtual = document.createElement("h3");
      tituloAtual.textContent = faseFechada ? "Notas (somente leitura — fase fechada)" : "Notas — rascunho atual";
      painelAtual.appendChild(tituloAtual);

      if(faseFechada){
        var aviso = document.createElement("p");
        aviso.className = "notas-aviso-readonly";
        aviso.textContent = "A fase está fechada — reabra-a para editar. O texto abaixo é o congelado na última versão fechada.";
        painelAtual.appendChild(aviso);

        var view = document.createElement("div");
        view.className = "richtext-editor richtext-editor-readonly";
        view.innerHTML = state.notas || '<span class="notas-vazio">(nenhuma nota registrada)</span>';
        painelAtual.appendChild(view);
      } else {
        var editorWrap = document.createElement("div");
        painelAtual.appendChild(editorWrap);
        window.RichText.montarEditor(editorWrap, state.notas, function(html){
          state.notas = html;
          if(onChangeCb) onChangeCb(state);
        }, {placeholder: cfg.placeholder || "Escreva suas notas..."});
      }
      elSlot.appendChild(painelAtual);

      var painelHistorico = document.createElement("div");
      painelHistorico.className = "riscos-panel notas-painel";
      var tituloHist = document.createElement("h3");
      tituloHist.textContent = "Histórico de versões";
      painelHistorico.appendChild(tituloHist);
      var listaHist = document.createElement("div");
      painelHistorico.appendChild(listaHist);
      renderHistorico(listaHist, state);
      elSlot.appendChild(painelHistorico);
    }

    /* Chamado a partir de aplicarBloqueioFase (app.js) a cada mudança de
       status da fase-dona — só guarda o estado atual pra abrir() decidir
       editável vs. somente-leitura na próxima vez que a tela for aberta. */
    function atualizarBloqueio(bloqueado){
      faseFechada = !!bloqueado;
    }

    /* Congela o rascunho atual como uma nova versão no histórico — chamado
       de dentro de Fechamento.gerarPdfFechamentoFase, ANTES de desenhar o
       PDF, pra que desenharNoDoc já leia a versão recém-congelada. Não
       limpa `state.notas`: o rascunho continua existindo, editável de novo
       assim que a fase for reaberta, até a próxima vez que fechar. */
    function congelar(state, versao, dataISO){
      if(!state) return;
      garantirCampos(state);
      state.notasHistorico.push({versao: versao, data: dataISO, html: state.notas});
    }

    /* Desenha a seção de notas num PDF já em andamento (fechamento de fase
       ou Dossiê) — sempre a ÚLTIMA versão congelada (a "atual"), nunca o
       histórico inteiro. Se a fase nunca fechou ainda (ex.: Dossiê gerado
       com a fase ainda aberta), cai no rascunho sem carimbo de versão. */
    function desenharNoDoc(doc, state, y, pageW, pageH, tituloSecao){
      garantirCampos(state);
      var ultima = state.notasHistorico.length ? state.notasHistorico[state.notasHistorico.length - 1] : null;

      /* Respiro + linha divisória antes do título — sem isso, esta seção
         ficava colada direto na última linha da tabela anterior (relatado
         com print: "Notas da Matriz" grudado na tabela de faixas). Mesmo
         estilo de divisor já usado entre diagramas no Ishikawa. */
      y += 14;
      doc.setDrawColor(218,223,230); doc.setLineWidth(0.8);
      doc.line(40, y, pageW - 40, y);
      y += 18;

      doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
      doc.setTextColor(28,36,48);
      doc.text(tituloSecao || "Notas", 40, y);
      y += 13;

      doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
      doc.setTextColor(120,128,144);
      doc.text(ultima ? ("Versão " + ultima.versao + " — " + formatarData(ultima.data)) : "Ainda não versionado (esta fase nunca foi fechada)", 40, y);
      y += 14;

      y = window.RichText.desenharNoDoc(doc, ultima ? ultima.html : state.notas, 40, y, pageW - 80, pageH, {
        fontSize: 9, lineHeight: 12.5, cor: [60,66,78], vazio: "(sem notas registradas)"
      });
      return y + 6;
    }

    return {
      abrir: abrir,
      atualizarBloqueio: atualizarBloqueio,
      congelar: congelar,
      desenharNoDoc: desenharNoDoc
    };
  }

  return { criarControlador: criarControlador };
})();

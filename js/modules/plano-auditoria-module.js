/* ============================================================
   plano-auditoria-module.js — módulo "Plano de Auditoria" (Fase 4,
   Auditoria, Riscos e Controles). Mesmo padrão mount/desenharNoDoc
   dos demais módulos. Divide a fase com a Matriz de Riscos: a Matriz
   de Riscos identifica e pontua os riscos, o Plano de Auditoria
   define *como* e *com que frequência* cada um é verificado —
   método e tamanho de amostra, periodicidade da checagem e prazo
   para resolver as não conformidades encontradas.

   Retroalimentação dupla, mesmo mecanismo já usado no 5 Porquês e
   na Matriz de Alçadas: "Risco relacionado" é escolhido entre os
   riscos já cadastrados na Matriz de Riscos da mesma fase; "Respon-
   sável pela verificação" é escolhido entre os papéis já cadastrados
   na Matriz RACI da Governança (fase diferente, mesmo caso).
   ============================================================ */
window.PlanoAuditoriaModule = (function(){
  "use strict";

  var METODOS = ["", "Amostragem estatística", "Verificação integral (100%)", "Por exceção/denúncia"];
  var PERIODICIDADES = [
    {valor:"", label:"Periodicidade..."},
    {valor:"mensal", label:"Mensal"},
    {valor:"trimestral", label:"Trimestral"},
    {valor:"semestral", label:"Semestral"},
    {valor:"anual", label:"Anual"}
  ];

  var state = null;
  var el = null;
  var onChange = null;
  var riscosRef = null;
  var raciRef = null;
  var casoNomeRef = "";

  /* Execução funcional do checklist — estado da tela dedicada (fora do
     fluxo normal mount/render deste módulo, porque continua em uso
     mesmo com a fase fechada; ver aplicarBloqueioFase em app.js e a
     classe fase-nao-bloquear no botão "Executar checklist"). */
  var elExec = null;
  var execItemAtual = null;
  var execFormAtual = null;

  /* Contrato/Obra — texto livre digitado ANTES de "+ Nova execução",
     trava assim que a execução começa (fica gravado em
     execFormAtual.contratoObra e depois em execucao.contratoObra,
     permanente no histórico). Reseta a cada abertura da tela e a cada
     execução concluída/cancelada, pra próxima poder ser de um
     contrato/obra diferente. */
  var contratoObraAtual = "";

  /* Filtro de Contrato/Obra do indicador — um valor selecionado por
     item (não por caso inteiro), guardado em memória só nesta sessão
     (não persiste no .json do caso; é estado de visualização, não
     dado). */
  var filtroContratoObraRef = {};

  /* Status da Fase 4 (aberta/fechada), espelhado aqui via
     atualizarBloqueio(faseFechada) — chamado por aplicarBloqueioFase em
     app.js toda vez que a fase fecha/reabre. "Executar checklist" só
     libera com a fase FECHADA (garante que os pesos em vigor não mudam
     mais durante as execuções) e com os pesos balanceados; ver
     renderChecklistSecao. */
  var faseFechadaRef = false;

  /* Cores literais pro gráfico de barras exportado (mesmo motivo do
     kpis-module.js: o <canvas> não lê variável CSS). */
  var BRAND_HEX = "#2B3A67";
  var INK_FAINT_HEX = "#88909B";
  var SURFACE_HEX = "#FFFFFF";
  var INK_HEX = "#1C2430";

  function uid(prefixo){ return (prefixo || "audp") + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  /* Itens salvos antes do checklist existir não têm este campo — mesmo
     espírito de backfill já usado em outros lugares do projeto,
     aplicado no ponto de uso (não existe migração em massa). */
  function garantirChecklist(item){
    if(!item.checklist) item.checklist = {template: [], execucoes: []};
    return item.checklist;
  }

  /* Peso (1-10) de cada item do template, mas o efeito no balanço/%
     de conformidade é o peso × 10 (cada unidade do stepper vale 10
     pontos dos 100 necessários) — assim dá pra balancear um checklist
     com poucos itens em vez de exigir no mínimo 10 itens pra fechar
     em 100. O que fica salvo em tItem.peso continua 1-10 (é o valor
     que aparece no campo); só o cálculo usa o valor efetivo. */
  var FATOR_PESO = 10;
  function pesoEfetivo(t){ return Math.round((t && t.peso ? t.peso : 0) * FATOR_PESO); }

  /* Peso aceita casas decimais (uma casa), de 0 a 10 — arredonda pra
     1 casa decimal e trava no intervalo, defensivo contra digitação
     fora da faixa (min/max do <input> não impede digitar valor livre). */
  function clampPeso(v){
    var n = parseFloat(v);
    if(isNaN(n)) n = 0;
    n = Math.max(0, Math.min(10, n));
    return Math.round(n * 10) / 10;
  }

  function somaPesos(chk){
    return chk.template.reduce(function(s, t){ return s + pesoEfetivo(t); }, 0);
  }
  function balanceado(chk){
    return chk.template.length > 0 && somaPesos(chk) === 100;
  }

  /* % de conformidade de uma execução — soma o peso efetivo dos itens
     marcados "conforme"; "não conforme" e "sem resposta" não pontuam.
     Congelado no momento da conclusão (ver concluirExecucaoAtual), não
     recalculado depois mesmo que o template mude. */
  function calcularPercentualConformidade(respostas, template){
    var total = 0, obtido = 0;
    respostas.forEach(function(r){
      var t = template.filter(function(x){ return x.id === r.itemId; })[0];
      var peso = pesoEfetivo(t);
      total += peso;
      if(r.status === "conforme") obtido += peso;
    });
    return total > 0 ? Math.round((obtido/total)*100) : 0;
  }

  function periodicidadeLabel(valor){
    if(!valor) return "";
    var found = PERIODICIDADES.filter(function(p){ return p.valor === valor; })[0];
    return found ? found.label : "";
  }

  function roleLabel(role){
    var sub = [role.nome, role.cargo].filter(Boolean).join(" · ");
    return sub ? role.area + " — " + sub : role.area;
  }

  function roleById(id){
    if(!raciRef || !raciRef.roles) return null;
    return raciRef.roles.filter(function(r){ return r.id === id; })[0] || null;
  }

  function riscoById(id){
    if(!riscosRef || !riscosRef.itens) return null;
    return riscosRef.itens.filter(function(r){ return r.id === id; })[0] || null;
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("audplano-addInput"),
      addBtn: q("audplano-addBtn"),
      lista: q("audplano-lista")
    };
  }

  function popularSelectRisco(select, valorAtual){
    select.innerHTML = "";
    var optPadrao = document.createElement("option");
    optPadrao.value = "";
    optPadrao.textContent = (riscosRef && riscosRef.itens && riscosRef.itens.length) ? "— nenhum —" : "— nenhum risco cadastrado ainda —";
    select.appendChild(optPadrao);
    if(riscosRef && riscosRef.itens){
      riscosRef.itens.forEach(function(risco){
        var opt = document.createElement("option");
        opt.value = risco.id;
        opt.textContent = risco.risco || "(sem descrição)";
        if(valorAtual === risco.id) opt.selected = true;
        select.appendChild(opt);
      });
    }
  }

  function popularSelectPapel(select, valorAtual){
    select.innerHTML = "";
    var optPadrao = document.createElement("option");
    optPadrao.value = "";
    optPadrao.textContent = (raciRef && raciRef.roles && raciRef.roles.length) ? "— escolher —" : "— nenhum papel na Governança ainda —";
    select.appendChild(optPadrao);
    if(raciRef && raciRef.roles){
      raciRef.roles.forEach(function(role){
        var opt = document.createElement("option");
        opt.value = role.id;
        opt.textContent = roleLabel(role);
        if(valorAtual === role.id) opt.selected = true;
        select.appendChild(opt);
      });
    }
  }

  function popularSelectMetodo(select, valorAtual){
    select.innerHTML = "";
    METODOS.forEach(function(m){
      var opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m || "Método de amostragem...";
      if(valorAtual === m) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function popularSelectPeriodicidade(select, valorAtual){
    select.innerHTML = "";
    PERIODICIDADES.forEach(function(p){
      var opt = document.createElement("option");
      opt.value = p.valor;
      opt.textContent = p.label;
      if(valorAtual === p.valor) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function campoComRotulo(rotulo, campoEl){
    var wrap = document.createElement("label");
    wrap.className = "treinamento-date-wrap";
    var span = document.createElement("span");
    span.textContent = rotulo;
    wrap.appendChild(span);
    wrap.appendChild(campoEl);
    return wrap;
  }

  function renderCard(item){
    var li = document.createElement("li");
    li.className = "riscos-card audit-item-card";

    var layout = document.createElement("div");
    layout.className = "audit-item-layout";

    var main = document.createElement("div");
    main.className = "audit-item-main";

    var top = document.createElement("div");
    top.className = "riscos-card-top";

    var itemInput = document.createElement("input");
    itemInput.className = "riscos-field-main";
    itemInput.placeholder = "O que será auditado";
    itemInput.maxLength = 160;
    itemInput.value = item.item || "";
    itemInput.addEventListener("change", function(){
      item.item = itemInput.value.trim() || item.item;
      renderAll();
    });
    top.appendChild(itemInput);

    var rm = document.createElement("button");
    rm.className = "icon-btn";
    rm.title = "Remover";
    rm.innerHTML = "&times;";
    rm.addEventListener("click", function(){
      state.itens = state.itens.filter(function(x){ return x.id !== item.id; });
      renderAll();
    });
    top.appendChild(rm);
    main.appendChild(top);

    var grid = document.createElement("div");
    grid.className = "audplano-grid";

    var riscoSelect = document.createElement("select");
    popularSelectRisco(riscoSelect, item.riscoRelacionadoId);
    riscoSelect.addEventListener("change", function(){
      item.riscoRelacionadoId = riscoSelect.value;
      var risco = riscoById(riscoSelect.value);
      item.riscoRelacionadoTexto = risco ? (risco.risco || "") : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Risco relacionado", riscoSelect));

    var metodoSelect = document.createElement("select");
    popularSelectMetodo(metodoSelect, item.metodoAmostragem);
    metodoSelect.addEventListener("change", function(){ item.metodoAmostragem = metodoSelect.value; renderAll(); });
    grid.appendChild(campoComRotulo("Método de amostragem", metodoSelect));

    var tamanhoInput = document.createElement("input");
    tamanhoInput.placeholder = "Ex.: 10% dos lançamentos";
    tamanhoInput.maxLength = 60;
    tamanhoInput.value = item.tamanhoAmostra || "";
    tamanhoInput.addEventListener("change", function(){ item.tamanhoAmostra = tamanhoInput.value.trim(); renderAll(); });
    grid.appendChild(campoComRotulo("Tamanho da amostra", tamanhoInput));

    var periodicidadeSelect = document.createElement("select");
    popularSelectPeriodicidade(periodicidadeSelect, item.periodicidade);
    periodicidadeSelect.addEventListener("change", function(){ item.periodicidade = periodicidadeSelect.value; renderAll(); });
    grid.appendChild(campoComRotulo("Periodicidade da verificação", periodicidadeSelect));

    var prazoInput = document.createElement("input");
    prazoInput.type = "number"; prazoInput.min = "0"; prazoInput.step = "1";
    prazoInput.placeholder = "Dias";
    prazoInput.value = item.prazoResolucaoDias || "";
    prazoInput.addEventListener("change", function(){ item.prazoResolucaoDias = prazoInput.value; renderAll(); });
    grid.appendChild(campoComRotulo("Prazo p/ resolver não conformidade (dias)", prazoInput));

    var respSelect = document.createElement("select");
    popularSelectPapel(respSelect, item.responsavelRoleId);
    respSelect.addEventListener("change", function(){
      item.responsavelRoleId = respSelect.value;
      var role = roleById(respSelect.value);
      item.responsavelNome = role ? roleLabel(role) : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Responsável pela verificação", respSelect));

    main.appendChild(grid);
    main.appendChild(renderChecklistSecao(item));

    layout.appendChild(main);
    layout.appendChild(renderIndicadorPanel(item));
    li.appendChild(layout);
    return li;
  }

  /* Seção "Checklist" dentro do card do item — o TEMPLATE (o que será
     verificado) trava normalmente com a fase, igual ao resto do card.
     O botão "Executar checklist" tem fase-nao-bloquear pelo motivo
     inverso do uso comum dessa classe: aqui ela existe pra ele NÃO
     seguir o sweep genérico (que desabilitaria tudo não-exempto quando
     a fase fecha) — o disabled dele é 100% controlado por esta função,
     com uma regra própria: só libera com a fase FECHADA (trava os
     critérios em vigor antes de qualquer execução) e com os pesos
     balanceados em 100%. Enquanto a fase está aberta, fica sempre
     bloqueado, mesmo já balanceado. */
  function renderChecklistSecao(item){
    var chk = garantirChecklist(item);
    var wrap = document.createElement("div");
    wrap.className = "audit-checklist-secao";

    var head = document.createElement("div");
    head.className = "audit-checklist-head";
    var titulo = document.createElement("p");
    titulo.className = "audit-checklist-titulo";
    titulo.textContent = "Checklist de verificação";
    head.appendChild(titulo);

    var soma = somaPesos(chk);
    var bal = balanceado(chk);
    var balanco = document.createElement("span");
    balanco.dataset.tooltip = "Soma dos pesos dos itens — cada ponto vale 10%. Precisa fechar em 100% para liberar a execução.";
    if(!chk.template.length){
      balanco.className = "audit-balanco aviso";
      balanco.textContent = "Checklist não cadastrado";
    }else{
      balanco.className = "audit-balanco " + (bal ? "ok" : "erro");
      balanco.textContent = bal ? "Pesos balanceados (100%)" : "Pesos desbalanceados (soma atual: " + soma + "%)";
    }
    head.appendChild(balanco);
    wrap.appendChild(head);

    var addRow = document.createElement("div");
    addRow.className = "fase0-canvas-add";
    var input = document.createElement("input");
    input.type = "text";
    input.maxLength = 200;
    input.placeholder = "O que será conferido neste item";
    var pesoAdd = document.createElement("input");
    pesoAdd.type = "number";
    pesoAdd.className = "audit-peso-input";
    pesoAdd.min = "0"; pesoAdd.max = "10"; pesoAdd.step = "0.1";
    pesoAdd.value = "";
    pesoAdd.placeholder = "0";
    pesoAdd.dataset.tooltip = "Peso deste item (0 a 10, uma casa decimal) — cada ponto vale 10% do total.";
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "+";
    function addTemplateItem(){
      var texto = input.value.trim();
      if(!texto) return;
      var peso = clampPeso(pesoAdd.value);
      chk.template.push({id: uid("audpchk"), texto: texto, peso: peso});
      input.value = "";
      pesoAdd.value = "";
      renderAll();
    }
    addBtn.addEventListener("click", addTemplateItem);
    input.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addTemplateItem(); } });
    addRow.appendChild(input);
    addRow.appendChild(pesoAdd);
    addRow.appendChild(addBtn);
    wrap.appendChild(addRow);

    var ul = document.createElement("ul");
    ul.className = "fase0-lista";
    if(!chk.template.length){
      var vazio = document.createElement("li");
      vazio.className = "fase0-item-vazio";
      vazio.textContent = "Nenhum item de checklist ainda.";
      ul.appendChild(vazio);
    }else{
      chk.template.forEach(function(tItem){
        if(tItem.peso == null) tItem.peso = 1;
        var li2 = document.createElement("li");
        li2.className = "fase0-item";
        var texto = document.createElement("textarea");
        texto.className = "fase0-item-texto";
        texto.rows = 1;
        texto.maxLength = 200;
        texto.value = tItem.texto || "";
        texto.addEventListener("change", function(){
          tItem.texto = texto.value.trim();
          if(onChange) onChange(state);
        });
        li2.appendChild(texto);
        var pesoInput = document.createElement("input");
        pesoInput.type = "number";
        pesoInput.className = "audit-peso-input";
        pesoInput.min = "0"; pesoInput.max = "10"; pesoInput.step = "0.1";
        pesoInput.value = tItem.peso;
        pesoInput.dataset.tooltip = "Peso deste item (0 a 10, uma casa decimal) — cada ponto vale 10% do total.";
        pesoInput.addEventListener("change", function(){
          tItem.peso = clampPeso(pesoInput.value);
          renderAll();
        });
        li2.appendChild(pesoInput);
        var rm2 = document.createElement("button");
        rm2.className = "fase0-item-remove";
        rm2.type = "button";
        rm2.title = "Remover";
        rm2.innerHTML = "&times;";
        rm2.addEventListener("click", function(){
          chk.template = chk.template.filter(function(x){ return x.id !== tItem.id; });
          renderAll();
        });
        li2.appendChild(rm2);
        ul.appendChild(li2);
      });
    }
    wrap.appendChild(ul);

    var rodape = document.createElement("div");
    rodape.className = "audit-checklist-rodape";

    var resumo = document.createElement("span");
    resumo.className = "audit-checklist-resumo";
    var n = chk.execucoes.length;
    if(n === 0){
      resumo.textContent = "Nenhuma execução registrada ainda.";
    }else{
      var ultima = chk.execucoes[n - 1];
      resumo.textContent = n + " execuç" + (n === 1 ? "ão" : "ões") + " registrada" + (n === 1 ? "" : "s") + " · última em " + new Date(ultima.dataConclusao).toLocaleDateString("pt-BR");
    }
    rodape.appendChild(resumo);

    var execBtn = document.createElement("button");
    execBtn.className = "btn btn-secondary fase-nao-bloquear";
    execBtn.type = "button";
    execBtn.textContent = "Executar checklist";
    execBtn.disabled = !chk.template.length || !bal || !faseFechadaRef;
    execBtn.dataset.tooltip = !chk.template.length
      ? "Cadastre pelo menos um item de checklist antes de executar."
      : (!faseFechadaRef
        ? "Disponível somente depois de fechar a fase — trava os critérios antes de qualquer execução."
        : (!bal
          ? "Os pesos dos itens precisam somar exatamente 100% para liberar a execução (soma atual: " + soma + "%)."
          : "Fase fechada e pesos balanceados — execução liberada, inclusive em sessões futuras."));
    execBtn.addEventListener("click", function(){ abrirExecucao(item); });
    rodape.appendChild(execBtn);

    wrap.appendChild(rodape);
    return wrap;
  }

  /* ---------------- Execução funcional do checklist ----------------
     Tela dedicada, fora da .app-shell — mesmo mecanismo de troca de
     tela já usado pela documentação (js/core/docs-fase.js): esconde
     a .app-shell, mostra um <div> irmão. Como esse <div> nunca fica
     dentro de nenhum fase-root, tudo aqui continua editável mesmo com
     a Fase 4 fechada, sem precisar de nenhuma exceção além do próprio
     botão-gatilho (ver renderChecklistSecao). */

  function buildElExecRefs(){
    function q(id){ return document.getElementById(id); }
    return {
      overlay: q("auditExecOverlay"),
      titulo: q("auditExecTitulo"),
      subtitulo: q("auditExecSubtitulo"),
      meta: q("auditExecMeta"),
      slot: q("auditExecSlot"),
      backBtn: q("auditExecBackBtn")
    };
  }

  /* Cabeçalho da tela de execução: 5 campos somente-leitura do item
     (risco, amostragem, periodicidade, prazo, responsável — retrato do
     item, não um formulário) + 1 campo editável, Contrato/Obra, que
     identifica a PRÓXIMA execução a ser criada. Contrato/Obra trava
     assim que "+ Nova execução" é clicado (execFormAtual passa a
     existir) — por isso esta função é chamada de novo a cada
     renderExecSlot(), não só na abertura da tela, pra refletir o
     travamento ao vivo. */
  function renderExecMeta(item){
    var panel = document.createElement("div");
    panel.className = "riscos-panel";

    var head = document.createElement("div");
    head.className = "tool-head";
    var h3 = document.createElement("h3");
    h3.textContent = "Dados do item auditado";
    head.appendChild(h3);
    panel.appendChild(head);

    var amostragem = [item.metodoAmostragem, item.tamanhoAmostra].filter(Boolean).join(" — ");
    var campos = [
      ["Risco relacionado", item.riscoRelacionadoTexto],
      ["Método de amostragem / tamanho", amostragem],
      ["Periodicidade da verificação", periodicidadeLabel(item.periodicidade)],
      ["Prazo p/ resolver não conformidade", item.prazoResolucaoDias ? (item.prazoResolucaoDias + " dias") : ""],
      ["Responsável pela verificação", item.responsavelNome]
    ];

    var grid = document.createElement("div");
    grid.className = "audit-exec-meta-grid";
    campos.forEach(function(c){
      var wrap = document.createElement("div");
      wrap.className = "audit-exec-meta-item";
      var label = document.createElement("span");
      label.textContent = c[0];
      var valor = document.createElement("strong");
      valor.textContent = c[1] || "—";
      wrap.appendChild(label);
      wrap.appendChild(valor);
      grid.appendChild(wrap);
    });

    var contratoWrap = document.createElement("div");
    contratoWrap.className = "audit-exec-meta-item";
    var contratoLabel = document.createElement("span");
    contratoLabel.textContent = "Contrato/Obra";
    contratoWrap.appendChild(contratoLabel);
    var contratoInput = document.createElement("input");
    contratoInput.type = "text";
    contratoInput.maxLength = 120;
    contratoInput.className = "audit-exec-contrato-input";
    contratoInput.placeholder = "Ex.: Contrato 123 — Obra XPTO";
    contratoInput.value = contratoObraAtual;
    contratoInput.disabled = !!execFormAtual;
    contratoInput.dataset.tooltip = "Identifica a que contrato/obra esta execução pertence — trava assim que a execução começa e vira filtro no indicador.";
    /* Letras sempre maiúsculas (números e símbolos passam direto) — ao
       vivo, enquanto digita, preservando a posição do cursor (setar
       .value reseta o cursor pro fim se não recolocar a seleção). */
    contratoInput.addEventListener("input", function(){
      var ini = contratoInput.selectionStart, fim = contratoInput.selectionEnd;
      contratoInput.value = contratoInput.value.toUpperCase();
      contratoInput.setSelectionRange(ini, fim);
    });
    contratoInput.addEventListener("change", function(){
      contratoObraAtual = contratoInput.value.trim().toUpperCase();
      renderExecSlot();
    });
    contratoWrap.appendChild(contratoInput);
    grid.appendChild(contratoWrap);

    panel.appendChild(grid);

    return panel;
  }

  function fecharExecucao(){
    if(!elExec || !elExec.overlay) return;
    elExec.overlay.style.display = "none";
    var shell = document.querySelector(".app-shell");
    if(shell) shell.style.display = "";
    execItemAtual = null;
    execFormAtual = null;
    /* O card do item (resumo de execuções, badge e indicador) fica em
       segundo plano enquanto a tela de execução está aberta — não é
       re-renderizado ao vivo. Sem isso, voltar mostraria dados
       desatualizados até alguma outra mudança forçar um re-render. */
    renderAll();
  }

  function abrirExecucao(item){
    if(!elExec){
      elExec = buildElExecRefs();
      if(!elExec.overlay) return;
      elExec.backBtn.addEventListener("click", fecharExecucao);
    }
    execItemAtual = item;
    execFormAtual = null;
    contratoObraAtual = "";
    elExec.titulo.textContent = "Checklist — " + (item.item || "Item de auditoria");
    elExec.subtitulo.textContent = "Execução funcional — disponível com a fase fechada e os pesos balanceados, inclusive em sessões futuras.";
    var shell = document.querySelector(".app-shell");
    if(shell) shell.style.display = "none";
    elExec.overlay.style.display = "block";
    window.scrollTo(0, 0);
    renderExecSlot();
  }

  function resumoExecucao(execucao){
    var conforme = 0, naoConforme = 0, semResposta = 0;
    execucao.itens.forEach(function(r){
      if(r.status === "conforme") conforme++;
      else if(r.status === "nao_conforme") naoConforme++;
      else semResposta++;
    });
    var partes = [];
    if(conforme) partes.push(conforme + " conforme" + (conforme === 1 ? "" : "s"));
    if(naoConforme) partes.push(naoConforme + " não conforme" + (naoConforme === 1 ? "" : "s"));
    if(semResposta) partes.push(semResposta + " sem resposta");
    return partes.join(" · ") || "sem itens";
  }

  function renderHistorico(){
    var chk = garantirChecklist(execItemAtual);
    var panel = document.createElement("div");
    panel.className = "riscos-panel";

    var head = document.createElement("div");
    head.className = "tool-head";
    var h3 = document.createElement("h3");
    h3.textContent = "Histórico de execuções";
    head.appendChild(h3);
    panel.appendChild(head);

    var novaBtn = document.createElement("button");
    novaBtn.className = "btn btn-primary";
    novaBtn.type = "button";
    novaBtn.textContent = "+ Nova execução";
    novaBtn.style.marginBottom = "14px";
    novaBtn.disabled = !contratoObraAtual;
    novaBtn.dataset.tooltip = contratoObraAtual
      ? "Trava o Contrato/Obra informado no cabeçalho e inicia uma nova execução."
      : "Preencha o Contrato/Obra no cabeçalho acima antes de iniciar uma nova execução.";
    novaBtn.addEventListener("click", function(){
      if(!contratoObraAtual) return;
      execFormAtual = {
        referencia: "",
        contratoObra: contratoObraAtual,
        itens: chk.template.map(function(t){ return {itemId: t.id, status: null, observacao: ""}; })
      };
      renderExecSlot();
    });
    panel.appendChild(novaBtn);

    var ul = document.createElement("ul");
    ul.className = "riscos-lista";
    if(!chk.execucoes.length){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhuma execução registrada ainda.";
      ul.appendChild(vazio);
    }else{
      chk.execucoes.slice().reverse().forEach(function(execucao){
        ul.appendChild(renderExecucaoCard(execucao));
      });
    }
    panel.appendChild(ul);
    return panel;
  }

  function renderExecucaoCard(execucao){
    var li = document.createElement("li");
    li.className = "riscos-card";

    var top = document.createElement("div");
    top.className = "riscos-card-top";
    var titulo = document.createElement("span");
    titulo.className = "riscos-field-main";
    titulo.style.cursor = "default";
    titulo.textContent = execucao.referencia || ("Execução de " + window.PdfDoc.formatarDataHora(execucao.dataConclusao));
    top.appendChild(titulo);
    li.appendChild(top);

    var resumo = document.createElement("p");
    resumo.style.cssText = "font-size:12px;color:var(--ink-faint);margin:0 0 10px;";
    var conformidadeTxt = execucao.percentualConformidade != null ? (" · Conformidade: " + execucao.percentualConformidade + "%") : "";
    var contratoTxt = execucao.contratoObra ? (" · Contrato/Obra: " + execucao.contratoObra) : "";
    resumo.textContent = "Concluída em " + window.PdfDoc.formatarDataHora(execucao.dataConclusao) + " — " + resumoExecucao(execucao) + conformidadeTxt + contratoTxt;
    li.appendChild(resumo);

    var detalhes = document.createElement("ul");
    detalhes.className = "fase0-lista";
    detalhes.style.display = "none";
    execucao.itens.forEach(function(r){
      var tItem = execItemAtual.checklist.template.filter(function(t){ return t.id === r.itemId; })[0];
      var li2 = document.createElement("li");
      li2.className = "fase0-item";
      var statusLabel = r.status === "conforme" ? "Conforme" : (r.status === "nao_conforme" ? "Não conforme" : "Sem resposta");
      var texto = document.createElement("div");
      texto.style.cssText = "flex:1;min-width:0;font-size:12.5px;padding:2px 0;";
      texto.innerHTML = ((tItem && tItem.texto) || "(item removido do template)") + (r.observacao ? "<br><span style=\"color:var(--ink-faint)\">" + r.observacao + "</span>" : "");
      li2.appendChild(texto);
      if(r.status === "conforme" || r.status === "nao_conforme"){
        var pill = document.createElement("span");
        pill.className = "audit-pill audit-pill-readonly " + (r.status === "conforme" ? "conforme ativo" : "nao-conforme ativo");
        pill.textContent = statusLabel;
        li2.appendChild(pill);
      }
      detalhes.appendChild(li2);
    });
    li.appendChild(detalhes);

    var acoes = document.createElement("div");
    acoes.className = "add-row";
    var verBtn = document.createElement("button");
    verBtn.className = "btn btn-ghost";
    verBtn.type = "button";
    verBtn.textContent = "Ver detalhes";
    verBtn.addEventListener("click", function(){
      var aberto = detalhes.style.display !== "none";
      detalhes.style.display = aberto ? "none" : "flex";
      verBtn.textContent = aberto ? "Ver detalhes" : "Ocultar detalhes";
    });
    acoes.appendChild(verBtn);

    var pdfBtn = document.createElement("button");
    pdfBtn.className = "btn btn-ghost";
    pdfBtn.type = "button";
    pdfBtn.textContent = "Exportar PDF";
    pdfBtn.addEventListener("click", function(){ exportarPdfExecucao(execItemAtual, execucao); });
    acoes.appendChild(pdfBtn);

    li.appendChild(acoes);
    return li;
  }

  function renderFormNovaExecucao(){
    var panel = document.createElement("div");
    panel.className = "riscos-panel";

    var head = document.createElement("div");
    head.className = "tool-head";
    var h3 = document.createElement("h3");
    h3.textContent = "Nova execução — " + (execItemAtual.item || "");
    head.appendChild(h3);
    panel.appendChild(head);

    var refWrap = campoComRotulo("Referência (opcional)", (function(){
      var input = document.createElement("input");
      input.type = "text";
      input.maxLength = 120;
      input.placeholder = "Ex.: Auditoria de Janeiro/2027";
      input.value = execFormAtual.referencia || "";
      input.addEventListener("change", function(){ execFormAtual.referencia = input.value.trim(); });
      return input;
    })());
    refWrap.style.maxWidth = "360px";
    refWrap.style.marginBottom = "14px";
    panel.appendChild(refWrap);

    var ul = document.createElement("ul");
    ul.className = "riscos-lista";
    execFormAtual.itens.forEach(function(resposta){
      var tItem = execItemAtual.checklist.template.filter(function(t){ return t.id === resposta.itemId; })[0];
      var li = document.createElement("li");
      li.className = "riscos-card";

      var titulo = document.createElement("p");
      titulo.style.cssText = "font-weight:600;font-size:13.5px;margin:0 0 8px;";
      titulo.textContent = (tItem && tItem.texto) || "(item removido do template)";
      li.appendChild(titulo);

      var pills = document.createElement("div");
      pills.className = "audit-status-pills";

      function criarPill(label, valor, classeExtra){
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "audit-pill " + classeExtra + (resposta.status === valor ? " ativo" : "");
        btn.textContent = label;
        btn.addEventListener("click", function(){
          resposta.status = (resposta.status === valor) ? null : valor;
          renderExecSlot();
        });
        return btn;
      }
      pills.appendChild(criarPill("Conforme", "conforme", "conforme"));
      pills.appendChild(criarPill("Não conforme", "nao_conforme", "nao-conforme"));
      li.appendChild(pills);

      var obsObrigatoria = resposta.status === "nao_conforme" && !(resposta.observacao && resposta.observacao.trim());
      var obs = document.createElement("textarea");
      obs.className = "audit-observacao" + (obsObrigatoria ? " obrigatoria" : "");
      obs.rows = 2;
      obs.maxLength = 400;
      obs.placeholder = resposta.status === "nao_conforme" ? "Observação (obrigatória para \"Não conforme\")" : "Observação (opcional)";
      obs.value = resposta.observacao || "";
      obs.addEventListener("change", function(){
        resposta.observacao = obs.value.trim();
        renderExecSlot();
      });
      li.appendChild(obs);

      ul.appendChild(li);
    });
    panel.appendChild(ul);

    var acoes = document.createElement("div");
    acoes.className = "add-row";
    acoes.style.marginTop = "16px";

    var faltamObs = execFormAtual.itens.filter(function(r){ return r.status === "nao_conforme" && !(r.observacao && r.observacao.trim()); }).length;
    var concluirBtn = document.createElement("button");
    concluirBtn.className = "btn btn-primary";
    concluirBtn.type = "button";
    concluirBtn.textContent = "Concluir execução";
    concluirBtn.disabled = faltamObs > 0;
    concluirBtn.dataset.tooltip = faltamObs > 0
      ? "Preencha a observação dos itens marcados \"Não conforme\" (" + faltamObs + " pendente" + (faltamObs === 1 ? "" : "s") + ") antes de concluir."
      : "Registra a execução no histórico, com data e hora carimbadas.";
    concluirBtn.addEventListener("click", concluirExecucaoAtual);
    acoes.appendChild(concluirBtn);

    var cancelarBtn = document.createElement("button");
    cancelarBtn.className = "btn btn-ghost";
    cancelarBtn.type = "button";
    cancelarBtn.textContent = "Cancelar";
    cancelarBtn.addEventListener("click", function(){
      var ok = window.confirm("Descartar esta execução em andamento? Nada foi salvo ainda.");
      if(!ok) return;
      execFormAtual = null;
      contratoObraAtual = "";
      renderExecSlot();
    });
    acoes.appendChild(cancelarBtn);

    panel.appendChild(acoes);
    return panel;
  }

  function concluirExecucaoAtual(){
    var faltamObs = execFormAtual.itens.some(function(r){ return r.status === "nao_conforme" && !(r.observacao && r.observacao.trim()); });
    if(faltamObs) return;
    var agora = new Date().toISOString();
    var chk = garantirChecklist(execItemAtual);
    var pct = calcularPercentualConformidade(execFormAtual.itens, chk.template);
    chk.execucoes.push({
      id: uid("audpexec"),
      referencia: execFormAtual.referencia || "",
      contratoObra: execFormAtual.contratoObra || "",
      dataInicio: agora,
      dataConclusao: agora,
      concluido: true,
      itens: execFormAtual.itens,
      percentualConformidade: pct
    });
    execFormAtual = null;
    contratoObraAtual = "";
    if(onChange) onChange(state);
    renderExecSlot();
    if(window.AppToast) window.AppToast.show("Execução do checklist registrada.");
  }

  function renderExecSlot(){
    if(!elExec || !elExec.slot) return;
    if(elExec.meta && execItemAtual){
      elExec.meta.innerHTML = "";
      elExec.meta.appendChild(renderExecMeta(execItemAtual));
    }
    elExec.slot.innerHTML = "";
    elExec.slot.appendChild(execFormAtual ? renderFormNovaExecucao() : renderHistorico());
  }

  function slugLocal(s){
    return (s || "documento").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "documento";
  }

  function exportarPdfExecucao(item, execucao){
    try{
      if(!window.jspdf || !window.jspdf.jsPDF){ throw new Error("jsPDF não carregado"); }
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({unit: "pt"});
      var pageW = doc.internal.pageSize.getWidth();
      var ctx = {metaDireita: "Gerado em " + window.PdfDoc.formatarDataHora()};

      var y = window.PdfDoc.desenharCabecalhoPrincipal(doc, {
        titulo: (casoNomeRef || "Caso") + " — Checklist de Auditoria",
        subtitulo: item.item || "",
        meta: "Concluída em " + window.PdfDoc.formatarDataHora(execucao.dataConclusao)
          + (execucao.contratoObra ? "   •   " + execucao.contratoObra : "")
          + (execucao.referencia ? "   •   " + execucao.referencia : "")
      });

      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.setTextColor(28, 36, 48);
      var conformidadeTxt = execucao.percentualConformidade != null ? ("   •   Conformidade: " + execucao.percentualConformidade + "%") : "";
      doc.text("Resultado: " + resumoExecucao(execucao) + conformidadeTxt, 40, y);
      y += 18;

      var head = [["Item", "Status", "Observação"]];
      var body = execucao.itens.map(function(r){
        var tItem = item.checklist.template.filter(function(t){ return t.id === r.itemId; })[0];
        var statusLabel = r.status === "conforme" ? "Conforme" : (r.status === "nao_conforme" ? "Não conforme" : "—");
        return [(tItem && tItem.texto) || "(item removido)", statusLabel, r.observacao || "—"];
      });

      doc.autoTable({
        startY: y,
        head: head, body: body,
        theme: "grid",
        rowPageBreak: "avoid",
        styles:{fontSize:9, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
        headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
        columnStyles:{0:{halign:"left", cellWidth:220}, 1:{halign:"center", cellWidth:80}, 2:{halign:"left"}}
      });

      window.PdfDoc.finalizarDocumento(doc, ctx);

      var nomeArquivo = "Checklist_" + slugLocal(item.item) + "_" + slugLocal(window.PdfDoc.formatarDataHora(execucao.dataConclusao)) + ".pdf";
      doc.save(nomeArquivo);
      execucao.pdfFileName = nomeArquivo;
      if(onChange) onChange(state);
      if(window.AppToast) window.AppToast.show("PDF da execução exportado.");
    }catch(err){
      console.error(err);
      if(window.AppToast) window.AppToast.show("Não foi possível exportar o PDF desta execução.", true);
    }
  }

  /* ---------------- Indicador de conformidade (card do item) ----------------
     Compara o % de conformidade da última execução concluída com a média
     histórica das execuções anteriores do MESMO item — é o "comparar
     números com base em histórico" pedido. Sem sparkline: só o número
     da última, a média e uma seta de tendência (resumo, não gráfico).
     Recebe a lista de execuções JÁ FILTRADA por Contrato/Obra (ver
     renderIndicadorPanel) — não conhece o item nem o filtro em si. */
  function ultimaMediaTendencia(execs){
    if(!execs.length) return null;
    var ultima = execs[execs.length - 1];
    var anteriores = execs.slice(0, -1);
    var mediaTodas = execs.reduce(function(s,e){ return s + e.percentualConformidade; }, 0) / execs.length;
    var tendencia = null;
    if(anteriores.length){
      var mediaAnteriores = anteriores.reduce(function(s,e){ return s + e.percentualConformidade; }, 0) / anteriores.length;
      tendencia = ultima.percentualConformidade - mediaAnteriores;
    }
    return {ultima: ultima.percentualConformidade, media: Math.round(mediaTodas), tendencia: tendencia};
  }

  /* Contratos/obras distintos já usados nas execuções concluídas deste
     item — alimenta o dropdown de filtro do indicador, em ordem
     alfabética. Execuções sem Contrato/Obra (histórico salvo antes
     deste campo existir) não entram na lista, mas continuam contando
     na visão "Todos". */
  function contratosObraDoItem(chk){
    var set = {};
    chk.execucoes.forEach(function(e){
      if(e.percentualConformidade != null && e.contratoObra) set[e.contratoObra] = true;
    });
    return Object.keys(set).sort(function(a,b){ return a.localeCompare(b, "pt-BR"); });
  }

  var ICONE_EXPORTAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';

  /* Índices dos pontos que ganham data no eixo X — no máximo 4, sempre
     incluindo o primeiro e o último (mesmo critério do gráfico de KPIs,
     kpis-module.js). Com poucas barras (≤4) todas ganham data; com mais,
     rotular todas apertaria e sobrepõe texto. O rótulo de valor (%) em
     cima de cada barra continua sempre presente — é bem mais curto. */
  function indicesEixoXLocal(n){
    if(n <= 1) return [0];
    if(n <= 4){ var todos = []; for(var i = 0; i < n; i++) todos.push(i); return todos; }
    var idx = [0, Math.round((n-1)/3), Math.round((n-1)*2/3), n-1];
    return idx.filter(function(v, i){ return idx.indexOf(v) === i; });
  }

  /* Gráfico de barras compacto (SVG, em tela) com o histórico de
     conformidade já filtrado por Contrato/Obra — complementa o número
     grande/média/tendência com uma visão de tendência ao longo do
     tempo, sem sair do card. Cores via var(--...) pra acompanhar o
     tema da página (claro/escuro), diferente do gráfico gerado pro
     Excel (canvas, sem acesso a variável CSS, por isso hex fixo lá). */
  function renderGraficoIndicador(execs){
    var wrap = document.createElement("div");
    wrap.className = "audit-indicador-grafico";
    if(!execs.length) return wrap;

    var W = 220, H = 108, padL = 18, padR = 4, padT = 20, padB = 16;
    var plotW = W - padL - padR, plotH = H - padT - padB, plotBottom = H - padB;
    var n = execs.length;
    var slot = plotW / n;
    var barW = Math.max(3, Math.min(20, slot - 4));
    var indicesData = indicesEixoXLocal(n);

    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="audit-indicador-svg" role="img" aria-label="Histórico de conformidade, ' + n + ' execuç' + (n === 1 ? "ão" : "ões") + '">'];

    /* Linhas horizontais discretas + valores do eixo Y (0/50/100). */
    [0, 50, 100].forEach(function(v){
      var y = (plotBottom - (v/100) * plotH).toFixed(1);
      svg.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + plotW) + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"/>');
      svg.push('<text x="' + (padL - 4) + '" y="' + (parseFloat(y) + 2.5) + '" text-anchor="end" font-size="7" fill="var(--ink-faint)">' + v + '</text>');
    });

    execs.forEach(function(e, i){
      var cx = padL + slot * i + slot / 2;
      var val = Math.max(0, Math.min(100, e.percentualConformidade));
      var barH = (val / 100) * plotH;
      var x = (cx - barW / 2).toFixed(1), y = (plotBottom - barH).toFixed(1);
      var titulo = escapeXmlLocal(dataBrCurtaLocal(e.dataConclusao) + ": " + val + "%" + (e.contratoObra ? " — " + e.contratoObra : ""));
      svg.push('<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH.toFixed(1) + '" rx="1.5" fill="var(--brand)"><title>' + titulo + '</title></rect>');

      /* Rótulo de valor sempre por CIMA, do lado de fora da barra — mesmo
         numa barra de 100% (encostando na grade do topo). padT reserva
         espaço suficiente pra isso, então não há mais um "modo dentro
         da barra" de fallback. */
      var labelY = (parseFloat(y) - 5).toFixed(1);
      svg.push('<text x="' + cx.toFixed(1) + '" y="' + labelY + '" text-anchor="middle" font-size="7.5" font-weight="700" fill="var(--ink)">' + val + '%</text>');

      if(indicesData.indexOf(i) !== -1){
        svg.push('<text x="' + cx.toFixed(1) + '" y="' + (plotBottom + 11) + '" text-anchor="middle" font-size="7" fill="var(--ink-faint)">' + escapeXmlLocal(dataBrCurtaLocal(e.dataConclusao)) + '</text>');
      }
    });
    svg.push('</svg>');

    var holder = document.createElement("div");
    holder.innerHTML = svg.join("");
    wrap.appendChild(holder.firstChild);
    return wrap;
  }

  function escapeXmlLocal(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];
    });
  }

  function renderIndicadorPanel(item){
    var chk = garantirChecklist(item);
    var panel = document.createElement("div");
    panel.className = "audit-item-indicador";

    var todasComConformidade = chk.execucoes.filter(function(e){ return e.percentualConformidade != null; });
    var contratos = contratosObraDoItem(chk);
    var filtroAtual = filtroContratoObraRef[item.id] || "";
    if(filtroAtual && contratos.indexOf(filtroAtual) === -1) filtroAtual = ""; // contrato filtrado não existe mais (ex.: dado de teste removido)
    var execsFiltradas = filtroAtual ? todasComConformidade.filter(function(e){ return e.contratoObra === filtroAtual; }) : todasComConformidade;

    /* Filtro (90%) e "Exportar" (10%, ícone + texto curto) dividem a
       mesma linha no topo do painel — o filtro só aparece quando há
       pelo menos um Contrato/Obra no histórico; sem ele, o botão
       ocupa a linha inteira sozinho. */
    var topo = document.createElement("div");
    topo.className = "audit-indicador-topo";

    if(contratos.length){
      var filtroSelect = document.createElement("select");
      filtroSelect.className = "audit-indicador-filtro";
      filtroSelect.dataset.tooltip = "Filtra o indicador e a exportação por Contrato/Obra.";
      var optTodos = document.createElement("option");
      optTodos.value = "";
      optTodos.textContent = "Todos os contratos/obras";
      filtroSelect.appendChild(optTodos);
      contratos.forEach(function(c){
        var opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        if(c === filtroAtual) opt.selected = true;
        filtroSelect.appendChild(opt);
      });
      filtroSelect.addEventListener("change", function(){
        filtroContratoObraRef[item.id] = filtroSelect.value;
        renderAll();
      });
      topo.appendChild(filtroSelect);
    }

    var exportBtn = document.createElement("button");
    exportBtn.className = "audit-indicador-exportar fase-nao-bloquear";
    exportBtn.type = "button";
    exportBtn.innerHTML = ICONE_EXPORTAR + "<span>Exportar</span>";
    exportBtn.disabled = !execsFiltradas.length;
    exportBtn.dataset.tooltip = "Exportar Excel — continua disponível mesmo com a fase fechada, é só leitura/exportação do que já está registrado.";
    exportBtn.addEventListener("click", function(){ exportarIndicadorExcel(item, execsFiltradas, filtroAtual); });
    topo.appendChild(exportBtn);

    panel.appendChild(topo);

    var titulo = document.createElement("p");
    titulo.className = "audit-indicador-titulo";
    titulo.textContent = "Conformidade";
    panel.appendChild(titulo);

    var info = ultimaMediaTendencia(execsFiltradas);
    if(!info){
      var vazio = document.createElement("p");
      vazio.className = "audit-indicador-vazio";
      vazio.textContent = filtroAtual ? "Nenhuma execução deste contrato/obra ainda." : "Nenhuma execução concluída ainda.";
      panel.appendChild(vazio);
    }else{
      var numero = document.createElement("p");
      numero.className = "audit-indicador-numero";
      numero.textContent = info.ultima + "%";
      panel.appendChild(numero);

      var label = document.createElement("p");
      label.className = "audit-indicador-label";
      label.textContent = "Última execução";
      panel.appendChild(label);

      var media = document.createElement("p");
      media.className = "audit-indicador-media";
      media.textContent = "Média histórica: " + info.media + "%";
      panel.appendChild(media);

      if(info.tendencia != null){
        var arred = Math.round(info.tendencia);
        var seta = arred > 0 ? "↑" : (arred < 0 ? "↓" : "→");
        var tend = document.createElement("p");
        tend.className = "audit-indicador-tendencia " + (arred > 0 ? "up" : (arred < 0 ? "down" : "flat"));
        tend.textContent = seta + " " + (arred > 0 ? "+" : "") + arred + "pp vs. média anterior";
        panel.appendChild(tend);
      }

      panel.appendChild(renderGraficoIndicador(execsFiltradas));
    }

    return panel;
  }

  function dataBrCurtaLocal(iso){
    var d = new Date(iso);
    if(isNaN(d.getTime())) return "";
    function pad(n){ return String(n).length < 2 ? "0" + n : String(n); }
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
  }

  /* Gráfico de colunas → PNG, mesma técnica de kpis-module.js
     (gerarImagemGraficoPNG): <canvas> fora da tela em escala 3x,
     cores hex fixas. O ExcelJS embutido neste projeto não escreve
     objetos de gráfico nativos (conferido no bundle) — a imagem entra
     na planilha via workbook.addImage/worksheet.addImage. */
  function gerarImagemGraficoConformidade(execucoes){
    if(!execucoes.length) return null;

    var escala = 3;
    var W = 360, H = 160;
    var padL = 24, padR = 10, padT = 14, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB, plotBottom = H - padB;

    var canvas = document.createElement("canvas");
    canvas.width = W * escala; canvas.height = H * escala;
    var ctx = canvas.getContext("2d");
    ctx.scale(escala, escala);
    ctx.fillStyle = SURFACE_HEX;
    ctx.fillRect(0, 0, W, H);

    ctx.lineWidth = 1;
    ctx.font = "7px Helvetica, Arial, sans-serif";
    ctx.textAlign = "right";
    [0, 50, 100].forEach(function(v){
      var y = plotBottom - (v/100) * plotH;
      ctx.strokeStyle = "#E3E7EE";
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillStyle = INK_FAINT_HEX;
      ctx.fillText(String(v), padL - 4, y + 2.5);
    });

    var n = execucoes.length;
    var slot = plotW / n;
    var barW = Math.max(4, Math.min(28, slot - 6));

    execucoes.forEach(function(e, i){
      var cx = padL + slot * i + slot/2;
      var val = Math.max(0, Math.min(100, e.percentualConformidade));
      var barH = (val/100) * plotH;
      var x = cx - barW/2, y = plotBottom - barH;

      ctx.fillStyle = BRAND_HEX;
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = INK_FAINT_HEX;
      ctx.font = "7px Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(dataBrCurtaLocal(e.dataConclusao), cx, plotBottom + 12);

      ctx.font = "bold 7.5px Helvetica, Arial, sans-serif";
      ctx.fillStyle = INK_HEX;
      var labelY = (y - 4 < padT + 6) ? (y + 9) : (y - 4);
      ctx.fillText(val + "%", cx, labelY);
    });

    return canvas.toDataURL("image/png");
  }

  /**
   * Exporta o histórico de conformidade do item em Excel. `execs` já
   * vem filtrada por Contrato/Obra quando aplicável (ver
   * renderIndicadorPanel) — a exportação sempre reflete exatamente o
   * que está sendo mostrado no indicador no momento do clique.
   * `filtro` é só o rótulo (vazio = "todos"), usado no nome do arquivo.
   */
  function exportarIndicadorExcel(item, execs, filtro){
    try{
      if(typeof ExcelJS === "undefined"){ throw new Error("ExcelJS não carregado"); }
      if(!execs || !execs.length){
        if(window.AppToast) window.AppToast.show("Nenhuma execução concluída para exportar ainda.", true);
        return;
      }

      var wb = new ExcelJS.Workbook();
      wb.creator = casoNomeRef || "Construtor de Processos";
      var sheet = wb.addWorksheet("Histórico");

      var headRow = sheet.getRow(1);
      ["Data", "Contrato/Obra", "Referência", "% Conformidade"].forEach(function(t, i){
        var cell = headRow.getCell(i + 1);
        cell.value = t;
        cell.font = {bold:true, color:{argb:"FFFFFFFF"}};
        cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF2B3A67"}};
        cell.alignment = {horizontal:"center", vertical:"middle"};
      });

      execs.forEach(function(e, i){
        var row = sheet.getRow(i + 2);
        row.getCell(1).value = window.PdfDoc.formatarDataHora(e.dataConclusao);
        row.getCell(2).value = e.contratoObra || "—";
        row.getCell(3).value = e.referencia || "—";
        row.getCell(4).value = e.percentualConformidade;
        row.getCell(4).alignment = {horizontal:"center"};
      });
      sheet.columns = [{width:22},{width:28},{width:32},{width:16}];

      var imgData = gerarImagemGraficoConformidade(execs);
      if(imgData){
        var imgId = wb.addImage({base64: imgData, extension: "png"});
        sheet.addImage(imgId, {tl:{col: 5, row: 1}, ext:{width: 360, height: 160}});
      }

      var sufixo = filtro ? ("-" + slugLocal(filtro)) : "";
      wb.xlsx.writeBuffer().then(function(buffer){
        var blob = new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = slugLocal(item.item) + "-conformidade" + sufixo + ".xlsx";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if(window.AppToast) window.AppToast.show("Excel de conformidade exportado.");
      }).catch(function(err){
        console.error(err);
        if(window.AppToast) window.AppToast.show("Não foi possível gerar o arquivo Excel.", true);
      });
    }catch(err){
      console.error(err);
      if(window.AppToast) window.AppToast.show("Não foi possível exportar o Excel. Tente novamente.", true);
    }
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum item de auditoria ainda.";
      el.lista.appendChild(vazio);
      return;
    }
    state.itens.forEach(function(item){ el.lista.appendChild(renderCard(item)); });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(state);
  }

  function addItem(){
    var item = el.addInput.value.trim();
    if(!item) return;
    state.itens.push({
      id: uid(), item: item,
      riscoRelacionadoId: "", riscoRelacionadoTexto: "",
      metodoAmostragem: "", tamanhoAmostra: "",
      periodicidade: "", prazoResolucaoDias: "",
      responsavelRoleId: "", responsavelNome: "",
      checklist: {template: [], execucoes: []}
    });
    el.addInput.value = "";
    renderAll();
    el.addInput.focus();
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addItem);
    el.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addItem(); } });
  }

  /* Chamada por aplicarBloqueioFase (app.js) toda vez que a Fase 4
     fecha/reabre — inclusive na montagem inicial, já que a mesma
     função roda logo depois de mount() dentro de montarFases(). Só
     re-renderiza a lista (sem disparar onChange/persistir de novo —
     nada mudou nos dados, só o status da fase). */
  function atualizarBloqueio(faseFechada){
    faseFechadaRef = !!faseFechada;
    if(el) renderLista();
  }

  function mount(rootEl, initialState, onChangeCb, riscosStateRef, raciStateRef, casoNome){
    var tpl = document.getElementById("audplano-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    onChange = onChangeCb || null;
    riscosRef = riscosStateRef || null;
    raciRef = raciStateRef || null;
    casoNomeRef = casoNome || "";
    wireEvents();
    renderAll();
  }

  /**
   * Desenha o Plano de Auditoria num documento jsPDF já criado, mesmo
   * padrão dos demais módulos. Usa os nomes já resolvidos
   * (`riscoRelacionadoTexto`/`responsavelNome`) — não depende de
   * receber a Matriz de Riscos ou a RACI de novo aqui. Retorna a
   * posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum item de auditoria registrado.", 40, startY);
      return startY + 16;
    }

    var head = [["Item", "Risco relacionado", "Amostragem", "Periodicidade", "Prazo (dias)", "Responsável", "Execuções"]];
    var body = docState.itens.map(function(item){
      var amostragem = [item.metodoAmostragem, item.tamanhoAmostra].filter(Boolean).join(" — ");
      var chk = garantirChecklist(item);
      return [
        item.item || "",
        item.riscoRelacionadoTexto || "—",
        amostragem || "—",
        periodicidadeLabel(item.periodicidade) || "—",
        item.prazoResolucaoDias || "—",
        item.responsavelNome || "—",
        chk.execucoes.length ? String(chk.execucoes.length) : "—"
      ];
    });

    doc.autoTable({
      startY: startY,
      head: head, body: body,
      theme: "grid",
      rowPageBreak: "avoid",
      styles:{fontSize:8, cellPadding:5, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:8},
      columnStyles:{
        0:{halign:"left", cellWidth:90},
        1:{halign:"left", cellWidth:95},
        2:{halign:"left", cellWidth:90},
        3:{halign:"center", cellWidth:55},
        4:{halign:"center", cellWidth:50},
        5:{halign:"left", cellWidth:90},
        6:{halign:"center", cellWidth:45}
      }
    });

    var y = doc.lastAutoTable.finalY + 10;
    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  /**
   * Lista os itens do Plano de Auditoria cujo checklist tem pelo menos
   * um item de template, mas os pesos NÃO somam 100% — usada por
   * app.js ao fechar a Fase 4, pra avisar quais checklists ficarão
   * bloqueados (sem poder executar) por causa do desbalanceamento.
   * Checklist vazio (nenhum item ainda) não entra aqui — isso é
   * "não cadastrado", um estado diferente de "desbalanceado".
   */
  function checklistsDesbalanceados(planoState){
    if(!planoState || !planoState.itens) return [];
    return planoState.itens
      .filter(function(item){
        var chk = garantirChecklist(item);
        return chk.template.length > 0 && !balanceado(chk);
      })
      .map(function(item){
        var chk = garantirChecklist(item);
        return {nome: item.item || "Item sem nome", soma: somaPesos(chk)};
      });
  }

  return {
    mount: mount,
    desenharNoDoc: desenharNoDoc,
    atualizarBloqueio: atualizarBloqueio,
    checklistsDesbalanceados: checklistsDesbalanceados
  };
})();

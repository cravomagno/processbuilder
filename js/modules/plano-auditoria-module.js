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

  function uid(){ return "audp_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

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
    li.className = "riscos-card";

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
    li.appendChild(top);

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

    li.appendChild(grid);
    return li;
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
      responsavelRoleId: "", responsavelNome: ""
    });
    el.addInput.value = "";
    renderAll();
    el.addInput.focus();
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addItem);
    el.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addItem(); } });
  }

  function mount(rootEl, initialState, onChangeCb, riscosStateRef, raciStateRef){
    var tpl = document.getElementById("audplano-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    onChange = onChangeCb || null;
    riscosRef = riscosStateRef || null;
    raciRef = raciStateRef || null;
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

    var head = [["Item", "Risco relacionado", "Amostragem", "Periodicidade", "Prazo (dias)", "Responsável"]];
    var body = docState.itens.map(function(item){
      var amostragem = [item.metodoAmostragem, item.tamanhoAmostra].filter(Boolean).join(" — ");
      return [
        item.item || "",
        item.riscoRelacionadoTexto || "—",
        amostragem || "—",
        periodicidadeLabel(item.periodicidade) || "—",
        item.prazoResolucaoDias || "—",
        item.responsavelNome || "—"
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
        0:{halign:"left", cellWidth:95},
        1:{halign:"left", cellWidth:100},
        2:{halign:"left", cellWidth:100},
        3:{halign:"center", cellWidth:60},
        4:{halign:"center", cellWidth:55},
        5:{halign:"left"}
      }
    });

    var y = doc.lastAutoTable.finalY + 10;
    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

/* ============================================================
   alcadas-module.js — módulo "Matriz de Alçadas" (Fase 2, Governança
   e Compliance). Mesmo padrão mount/desenharNoDoc dos demais
   módulos, com a mesma retroalimentação já usada no 5 Porquês: o
   Responsável (e o Escala para) de cada faixa são escolhidos entre
   os papéis já cadastrados na Matriz RACI da mesma fase.

   Uma alçada não é sempre um valor em R$ — pode ser prazo,
   quantidade, nível de risco etc. Por isso o limite é um número
   neutro + uma Unidade livre (mesmo padrão de Meta+Unidade dos
   KPIs). Cada faixa pertence a um Critério (ex.: "Aprovação de
   compras", "Horas extras") — faixas do mesmo critério formam uma
   hierarquia de escalonamento; o campo "Escala para" deixa explícito
   quem assume a responsabilidade a partir daquele limite.
   ============================================================ */
window.AlcadasModule = (function(){
  "use strict";

  var SEM_LIMITE = "—"; // travessão — "sem limite superior" ou "ninguém acima"

  var state = null;
  var el = null;
  var onChange = null;
  var raciRef = null;

  function uid(){ return "alc_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function roleLabel(role){
    var sub = [role.nome, role.cargo].filter(Boolean).join(" · ");
    return sub ? role.area + " — " + sub : role.area;
  }

  function roleById(id){
    if(!raciRef || !raciRef.roles) return null;
    return raciRef.roles.filter(function(r){ return r.id === id; })[0] || null;
  }

  /* Migra itens do formato antigo (descricao/valorAte/aprovadorRoleId,
     sempre implicitamente em R$, sem agrupamento por critério). */
  function migrarItem(item){
    if(item.criterio === undefined){
      item.criterio = item.descricao || "Alçada";
      item.limite = item.valorAte !== undefined ? item.valorAte : "";
      item.unidade = item.limite !== "" ? "R$" : "";
      item.responsavelRoleId = item.aprovadorRoleId || "";
      item.responsavelNome = item.aprovadorNome || "";
      item.escalaParaRoleId = "";
      item.escalaParaNome = "";
      delete item.descricao; delete item.valorAte; delete item.aprovadorRoleId; delete item.aprovadorNome;
    }
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("alcadas-addInput"),
      addBtn: q("alcadas-addBtn"),
      addDatalist: q("alcadas-criterios"),
      lista: q("alcadas-lista")
    };
  }

  function popularSelectPapel(select, valorAtual, placeholderTxt){
    select.innerHTML = "";
    var optPadrao = document.createElement("option");
    optPadrao.value = "";
    optPadrao.textContent = (raciRef && raciRef.roles && raciRef.roles.length) ? placeholderTxt : "— nenhum papel na Governança ainda —";
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

  function criteriosDistintos(){
    var vistos = [], nomes = [];
    state.itens.forEach(function(item){
      if(nomes.indexOf(item.criterio) === -1){ nomes.push(item.criterio); vistos.push(item.criterio); }
    });
    return vistos;
  }

  function renderCardFaixa(item){
    var li = document.createElement("li");
    li.className = "riscos-card";

    var top = document.createElement("div");
    top.className = "riscos-card-top";

    var criterioInput = document.createElement("input");
    criterioInput.className = "riscos-field-main";
    criterioInput.placeholder = "Critério (ex.: Aprovação de compras)";
    criterioInput.maxLength = 120;
    criterioInput.value = item.criterio || "";
    criterioInput.addEventListener("change", function(){
      item.criterio = criterioInput.value.trim() || item.criterio;
      renderAll();
    });
    top.appendChild(criterioInput);

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
    grid.className = "alcadas-grid";

    var limiteWrap = document.createElement("label");
    limiteWrap.className = "treinamento-date-wrap";
    limiteWrap.innerHTML = "<span>Limite — vazio = sem limite</span>";
    var limiteInput = document.createElement("input");
    limiteInput.type = "number"; limiteInput.step = "any"; limiteInput.min = "0";
    limiteInput.placeholder = "Sem limite";
    limiteInput.value = item.limite || "";
    limiteInput.addEventListener("change", function(){ item.limite = limiteInput.value; renderAll(); });
    limiteWrap.appendChild(limiteInput);
    grid.appendChild(limiteWrap);

    var unidadeWrap = document.createElement("label");
    unidadeWrap.className = "treinamento-date-wrap";
    unidadeWrap.innerHTML = "<span>Unidade</span>";
    var unidadeInput = document.createElement("input");
    unidadeInput.placeholder = "R$, dias, unidades...";
    unidadeInput.maxLength = 20;
    unidadeInput.value = item.unidade || "";
    unidadeInput.addEventListener("change", function(){ item.unidade = unidadeInput.value.trim(); renderAll(); });
    unidadeWrap.appendChild(unidadeInput);
    grid.appendChild(unidadeWrap);

    var respWrap = document.createElement("label");
    respWrap.className = "treinamento-date-wrap";
    respWrap.innerHTML = "<span>Responsável nesta faixa</span>";
    var respSelect = document.createElement("select");
    popularSelectPapel(respSelect, item.responsavelRoleId, "— escolher —");
    respSelect.addEventListener("change", function(){
      item.responsavelRoleId = respSelect.value;
      var role = roleById(respSelect.value);
      item.responsavelNome = role ? roleLabel(role) : "";
      renderAll();
    });
    respWrap.appendChild(respSelect);
    grid.appendChild(respWrap);

    var escalaWrap = document.createElement("label");
    escalaWrap.className = "treinamento-date-wrap";
    escalaWrap.innerHTML = "<span>Escala para (acima do limite)</span>";
    var escalaSelect = document.createElement("select");
    popularSelectPapel(escalaSelect, item.escalaParaRoleId, "— ninguém acima —");
    escalaSelect.addEventListener("change", function(){
      item.escalaParaRoleId = escalaSelect.value;
      var role = roleById(escalaSelect.value);
      item.escalaParaNome = role ? roleLabel(role) : "";
      renderAll();
    });
    escalaWrap.appendChild(escalaSelect);
    grid.appendChild(escalaWrap);

    li.appendChild(grid);
    return li;
  }

  function renderLista(){
    el.lista.innerHTML = "";
    el.addDatalist.innerHTML = "";
    criteriosDistintos().forEach(function(nome){
      var opt = document.createElement("option");
      opt.value = nome;
      el.addDatalist.appendChild(opt);
    });

    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhuma faixa de alçada ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    criteriosDistintos().forEach(function(criterio){
      var grupoLi = document.createElement("li");
      grupoLi.className = "alcadas-grupo";
      grupoLi.style.listStyle = "none";

      var titulo = document.createElement("h4");
      titulo.className = "alcadas-grupo-titulo";
      titulo.textContent = criterio || "(sem critério)";
      grupoLi.appendChild(titulo);

      var subLista = document.createElement("ul");
      subLista.className = "alcadas-grupo-lista";

      var itensDoGrupo = state.itens
        .filter(function(item){ return item.criterio === criterio; })
        .sort(function(a,b){
          var av = a.limite === "" ? Infinity : parseFloat(a.limite);
          var bv = b.limite === "" ? Infinity : parseFloat(b.limite);
          return av - bv;
        });
      itensDoGrupo.forEach(function(item){ subLista.appendChild(renderCardFaixa(item)); });

      grupoLi.appendChild(subLista);
      el.lista.appendChild(grupoLi);
    });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(state);
  }

  function addItem(){
    var criterio = el.addInput.value.trim();
    if(!criterio) return;
    state.itens.push({
      id: uid(), criterio: criterio, limite: "", unidade: "",
      responsavelRoleId: "", responsavelNome: "", escalaParaRoleId: "", escalaParaNome: ""
    });
    el.addInput.value = "";
    renderAll();
    el.addInput.focus();
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addItem);
    el.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addItem(); } });
  }

  function mount(rootEl, initialState, onChangeCb, raciStateRef){
    var tpl = document.getElementById("alcadas-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    state.itens.forEach(migrarItem);
    onChange = onChangeCb || null;
    raciRef = raciStateRef || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha a Matriz de Alçadas num documento jsPDF já criado, um
   * bloco por Critério (cada um sua própria tabela ordenada por
   * limite), mesmo padrão dos demais módulos. Usa os nomes já
   * resolvidos (`responsavelNome`/`escalaParaNome`) — não depende de
   * receber a Matriz RACI de novo aqui. Retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();
    var y = startY;

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhuma faixa de alçada registrada.", 40, y);
      return y + 16;
    }

    var criterios = [];
    docState.itens.forEach(function(item){ if(criterios.indexOf(item.criterio) === -1) criterios.push(item.criterio); });

    criterios.forEach(function(criterio, idx){
      if(idx > 0) y += 6;
      if(y > pageH - 60){ doc.addPage(); y = 40; }

      doc.setFont("helvetica","bold"); doc.setFontSize(10);
      doc.setTextColor(28,36,48);
      doc.text(criterio || "(sem critério)", 40, y);
      y += 12;

      var itensDoGrupo = docState.itens
        .filter(function(item){ return item.criterio === criterio; })
        .sort(function(a,b){
          var av = a.limite === "" ? Infinity : parseFloat(a.limite);
          var bv = b.limite === "" ? Infinity : parseFloat(b.limite);
          return av - bv;
        });

      var head = [["Limite","Responsável","Escala para (acima do limite)"]];
      var body = itensDoGrupo.map(function(item){
        var limiteTxt = item.limite !== "" ? (item.limite + (item.unidade ? (" "+item.unidade) : "")) : SEM_LIMITE;
        return [limiteTxt, item.responsavelNome || SEM_LIMITE, item.escalaParaNome || SEM_LIMITE];
      });

      doc.autoTable({
        startY: y,
        head: head, body: body,
        theme: "grid",
        rowPageBreak: "avoid",
        styles:{fontSize:9, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
        headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
        columnStyles:{0:{halign:"center", cellWidth:100}, 1:{halign:"left"}, 2:{halign:"left"}}
      });

      y = doc.lastAutoTable.finalY + 10;
    });

    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

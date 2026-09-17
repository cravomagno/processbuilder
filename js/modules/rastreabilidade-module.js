/* ============================================================
   rastreabilidade-module.js — módulo "Matriz de Rastreabilidade"
   (Fase 5, Sistemas, Tecnologia e Documentação). Mesmo padrão
   mount/desenharNoDoc dos demais módulos, dividindo a fase com
   "Sistemas (Aquisição/Desenvolvimento)".

   Retroalimentação dupla, mesmo mecanismo já usado no Plano de
   Auditoria (Risco ← Matriz de Riscos + Responsável ← RACI): aqui,
   Etapa de origem e Etapa de destino vêm do Fluxograma do Processo
   (Fase 3, cross-fase) — como o Fluxograma agora suporta vários
   fluxos nomeados, os dois selects agrupam as etapas por fluxo
   (<optgroup>) em vez de precisar escolher fluxo e etapa em dois
   passos separados. Responsável vem da Matriz RACI da Governança
   (Fase 2, cross-fase), mesmo padrão já usado em vários módulos.
   ============================================================ */
window.RastreabilidadeModule = (function(){
  "use strict";

  var state = null;
  var el = null;
  var onChange = null;
  var fluxogramaRef = null;
  var raciRef = null;

  function uid(){ return "rastr_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function roleLabel(role){
    var sub = [role.nome, role.cargo].filter(Boolean).join(" · ");
    return sub ? role.area + " — " + sub : role.area;
  }

  function roleById(id){
    if(!raciRef || !raciRef.roles) return null;
    return raciRef.roles.filter(function(r){ return r.id === id; })[0] || null;
  }

  function etapaById(id){
    if(!fluxogramaRef || !fluxogramaRef.fluxos) return null;
    for(var i=0; i<fluxogramaRef.fluxos.length; i++){
      var found = fluxogramaRef.fluxos[i].etapas.filter(function(e){ return e.id === id; })[0];
      if(found) return found;
    }
    return null;
  }

  function popularSelectEtapa(select, valorAtual){
    select.innerHTML = "";
    var optPadrao = document.createElement("option");
    optPadrao.value = "";
    optPadrao.textContent = "— nenhuma —";
    select.appendChild(optPadrao);
    var temFluxo = fluxogramaRef && fluxogramaRef.fluxos && fluxogramaRef.fluxos.length;
    if(!temFluxo){
      optPadrao.textContent = "— nenhum fluxo no Fluxograma ainda —";
      return;
    }
    fluxogramaRef.fluxos.forEach(function(fluxo){
      if(!fluxo.etapas.length) return;
      var grupo = document.createElement("optgroup");
      grupo.label = fluxo.nome || "(sem nome)";
      fluxo.etapas.forEach(function(etapa){
        var opt = document.createElement("option");
        opt.value = etapa.id;
        opt.textContent = etapa.titulo || "(sem título)";
        if(valorAtual === etapa.id) opt.selected = true;
        grupo.appendChild(opt);
      });
      select.appendChild(grupo);
    });
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

  function campoComRotulo(rotulo, campoEl){
    var wrap = document.createElement("label");
    wrap.className = "treinamento-date-wrap";
    var span = document.createElement("span");
    span.textContent = rotulo;
    wrap.appendChild(span);
    wrap.appendChild(campoEl);
    return wrap;
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("rastreabilidade-addInput"),
      addBtn: q("rastreabilidade-addBtn"),
      lista: q("rastreabilidade-lista")
    };
  }

  function renderCard(item){
    var li = document.createElement("li");
    li.className = "riscos-card";

    var top = document.createElement("div");
    top.className = "riscos-card-top";

    var campoInput = document.createElement("input");
    campoInput.className = "riscos-field-main";
    campoInput.placeholder = "Campo ou dado rastreado";
    campoInput.maxLength = 140;
    campoInput.value = item.campo || "";
    campoInput.addEventListener("change", function(){
      item.campo = campoInput.value.trim() || item.campo;
      renderAll();
    });
    top.appendChild(campoInput);

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
    grid.className = "rastreabilidade-grid";

    var origemSelect = document.createElement("select");
    popularSelectEtapa(origemSelect, item.etapaOrigemId);
    origemSelect.addEventListener("change", function(){
      item.etapaOrigemId = origemSelect.value;
      var etapa = etapaById(origemSelect.value);
      item.etapaOrigemTexto = etapa ? (etapa.titulo || "") : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Etapa de origem", origemSelect));

    var sistemaInput = document.createElement("input");
    sistemaInput.placeholder = "Ex.: SAP, planilha, ERP...";
    sistemaInput.maxLength = 80;
    sistemaInput.value = item.sistema || "";
    sistemaInput.addEventListener("change", function(){ item.sistema = sistemaInput.value.trim(); renderAll(); });
    grid.appendChild(campoComRotulo("Sistema onde é parametrizado", sistemaInput));

    var regraInput = document.createElement("input");
    regraInput.placeholder = "Ex.: obrigatório, numérico...";
    regraInput.maxLength = 140;
    regraInput.value = item.regraValidacao || "";
    regraInput.addEventListener("change", function(){ item.regraValidacao = regraInput.value.trim(); renderAll(); });
    grid.appendChild(campoComRotulo("Regra de validação", regraInput));

    var destinoSelect = document.createElement("select");
    popularSelectEtapa(destinoSelect, item.etapaDestinoId);
    destinoSelect.addEventListener("change", function(){
      item.etapaDestinoId = destinoSelect.value;
      var etapa = etapaById(destinoSelect.value);
      item.etapaDestinoTexto = etapa ? (etapa.titulo || "") : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Etapa de destino", destinoSelect));

    var respSelect = document.createElement("select");
    popularSelectPapel(respSelect, item.responsavelRoleId);
    respSelect.addEventListener("change", function(){
      item.responsavelRoleId = respSelect.value;
      var role = roleById(respSelect.value);
      item.responsavelNome = role ? roleLabel(role) : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Responsável", respSelect));

    li.appendChild(grid);
    return li;
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum item de rastreabilidade ainda.";
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
    var campo = el.addInput.value.trim();
    if(!campo) return;
    state.itens.push({
      id: uid(), campo: campo,
      etapaOrigemId: "", etapaOrigemTexto: "",
      sistema: "", regraValidacao: "",
      etapaDestinoId: "", etapaDestinoTexto: "",
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

  function mount(rootEl, initialState, onChangeCb, fluxogramaStateRef, raciStateRef){
    var tpl = document.getElementById("rastreabilidade-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    onChange = onChangeCb || null;
    fluxogramaRef = fluxogramaStateRef || null;
    raciRef = raciStateRef || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha a Matriz de Rastreabilidade num documento jsPDF já criado,
   * mesmo padrão dos demais módulos. Usa os nomes já resolvidos
   * (`etapaOrigemTexto`/`etapaDestinoTexto`/`responsavelNome`) — não
   * depende de receber o Fluxograma/RACI de novo aqui. Retorna a
   * posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum item de rastreabilidade registrado.", 40, startY);
      return startY + 16;
    }

    var head = [["Campo/Dado", "Origem", "Sistema", "Regra de validação", "Destino", "Responsável"]];
    var body = docState.itens.map(function(item){
      return [
        item.campo || "",
        item.etapaOrigemTexto || "—",
        item.sistema || "—",
        item.regraValidacao || "—",
        item.etapaDestinoTexto || "—",
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
      columnStyles:{0:{halign:"left", cellWidth:90}, 1:{halign:"left", cellWidth:85}, 2:{halign:"left", cellWidth:70}, 4:{halign:"left", cellWidth:85}}
    });

    var y = doc.lastAutoTable.finalY + 10;
    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

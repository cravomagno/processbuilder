/* ============================================================
   sistemas-module.js — módulo "Sistemas (Aquisição/Desenvolvimento)"
   (Fase 5, Sistemas, Tecnologia e Documentação). Mesmo padrão
   mount/desenharNoDoc dos demais módulos, dividindo a fase com a
   Matriz de Rastreabilidade.

   Cobre a dinâmica de aquisição de sistema terceirizado OU
   desenvolvimento interno: fornecedor (só relevante na aquisição),
   investimento, período de teste/piloto e status de aprovação.

   Retroalimentação: Responsável vem da Matriz RACI da Governança
   (Fase 2, cross-fase) — mesmo padrão já usado em vários módulos.
   ============================================================ */
window.SistemasModule = (function(){
  "use strict";

  var TIPOS = [
    {valor:"aquisicao", label:"Aquisição (terceirizado)"},
    {valor:"desenvolvimento", label:"Desenvolvimento (interno)"}
  ];
  var STATUS = [
    {valor:"avaliacao", label:"Em avaliação", hex:"#88909B"},
    {valor:"teste", label:"Em teste", hex:"#A67C3D"},
    {valor:"aprovado", label:"Aprovado", hex:"#1E8E64"},
    {valor:"reprovado", label:"Reprovado", hex:"#D9432B"},
    {valor:"producao", label:"Em produção", hex:"#2B3A67"}
  ];

  var state = null;
  var el = null;
  var onChange = null;
  var raciRef = null;

  function uid(){ return "sist_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function tipoLabel(valor){
    var f = TIPOS.filter(function(t){ return t.valor === valor; })[0];
    return f ? f.label : valor;
  }

  function statusInfo(valor){
    return STATUS.filter(function(s){ return s.valor === valor; })[0] || STATUS[0];
  }

  function roleLabel(role){
    var sub = [role.nome, role.cargo].filter(Boolean).join(" · ");
    return sub ? role.area + " — " + sub : role.area;
  }

  function roleById(id){
    if(!raciRef || !raciRef.roles) return null;
    return raciRef.roles.filter(function(r){ return r.id === id; })[0] || null;
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

  function migrarItem(item){
    if(item.tipo === undefined) item.tipo = "aquisicao";
    if(item.fornecedor === undefined) item.fornecedor = "";
    if(item.investimento === undefined) item.investimento = "";
    if(item.testeInicio === undefined) item.testeInicio = "";
    if(item.testeFim === undefined) item.testeFim = "";
    if(item.status === undefined) item.status = "avaliacao";
    if(item.responsavelRoleId === undefined) item.responsavelRoleId = "";
    if(item.responsavelNome === undefined) item.responsavelNome = "";
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("sistemas-addInput"),
      addBtn: q("sistemas-addBtn"),
      lista: q("sistemas-lista")
    };
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

    var nomeInput = document.createElement("input");
    nomeInput.className = "riscos-field-main";
    nomeInput.placeholder = "Nome do sistema";
    nomeInput.maxLength = 100;
    nomeInput.value = item.nome || "";
    nomeInput.addEventListener("change", function(){
      item.nome = nomeInput.value.trim() || item.nome;
      renderAll();
    });
    top.appendChild(nomeInput);

    var status = statusInfo(item.status);
    var badge = document.createElement("span");
    badge.className = "gut-score-badge";
    badge.style.background = status.hex;
    badge.style.fontSize = "10px";
    badge.textContent = status.label;
    top.appendChild(badge);

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
    grid.className = "sistemas-grid";

    var tipoSelect = document.createElement("select");
    TIPOS.forEach(function(t){
      var opt = document.createElement("option");
      opt.value = t.valor; opt.textContent = t.label;
      if(item.tipo === t.valor) opt.selected = true;
      tipoSelect.appendChild(opt);
    });
    tipoSelect.addEventListener("change", function(){ item.tipo = tipoSelect.value; renderAll(); });
    grid.appendChild(campoComRotulo("Tipo", tipoSelect));

    if(item.tipo === "aquisicao"){
      var fornecedorInput = document.createElement("input");
      fornecedorInput.placeholder = "Nome do fornecedor";
      fornecedorInput.maxLength = 100;
      fornecedorInput.value = item.fornecedor || "";
      fornecedorInput.addEventListener("change", function(){ item.fornecedor = fornecedorInput.value.trim(); renderAll(); });
      grid.appendChild(campoComRotulo("Fornecedor", fornecedorInput));
    }

    var investimentoInput = document.createElement("input");
    investimentoInput.placeholder = "Ex.: R$ 50.000,00";
    investimentoInput.maxLength = 40;
    investimentoInput.value = item.investimento || "";
    investimentoInput.addEventListener("change", function(){ item.investimento = investimentoInput.value.trim(); renderAll(); });
    grid.appendChild(campoComRotulo("Investimento estimado", investimentoInput));

    var inicioInput = document.createElement("input");
    inicioInput.type = "date";
    inicioInput.value = item.testeInicio || "";
    inicioInput.addEventListener("change", function(){ item.testeInicio = inicioInput.value; renderAll(); });
    grid.appendChild(campoComRotulo("Início do teste/piloto", inicioInput));

    var fimInput = document.createElement("input");
    fimInput.type = "date";
    fimInput.value = item.testeFim || "";
    fimInput.addEventListener("change", function(){ item.testeFim = fimInput.value; renderAll(); });
    grid.appendChild(campoComRotulo("Fim do teste/piloto", fimInput));

    var statusSelect = document.createElement("select");
    STATUS.forEach(function(s){
      var opt = document.createElement("option");
      opt.value = s.valor; opt.textContent = s.label;
      if(item.status === s.valor) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.addEventListener("change", function(){ item.status = statusSelect.value; renderAll(); });
    grid.appendChild(campoComRotulo("Status", statusSelect));

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
      vazio.textContent = "Nenhum sistema ainda.";
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
    var nome = el.addInput.value.trim();
    if(!nome) return;
    state.itens.push({
      id: uid(), nome: nome, tipo: "aquisicao", fornecedor: "",
      investimento: "", testeInicio: "", testeFim: "", status: "avaliacao",
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

  function mount(rootEl, initialState, onChangeCb, raciStateRef){
    var tpl = document.getElementById("sistemas-template");
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

  function dataBr(iso){
    if(!iso) return "";
    var partes = iso.split("-");
    return partes.length === 3 ? (partes[2] + "/" + partes[1] + "/" + partes[0]) : iso;
  }

  /**
   * Desenha os sistemas (aquisição/desenvolvimento) num documento
   * jsPDF já criado, mesmo padrão dos demais módulos. Retorna a
   * posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum sistema registrado.", 40, startY);
      return startY + 16;
    }

    function hexToRgb(hex){
      hex = hex.replace("#","");
      return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
    }

    var head = [["Sistema", "Tipo", "Fornecedor", "Investimento", "Teste", "Status", "Responsável"]];
    var body = docState.itens.map(function(item){
      var periodo = (item.testeInicio || item.testeFim)
        ? (dataBr(item.testeInicio) || "—") + " a " + (dataBr(item.testeFim) || "—")
        : "—";
      return [
        item.nome || "",
        tipoLabel(item.tipo),
        item.tipo === "aquisicao" ? (item.fornecedor || "—") : "—",
        item.investimento || "—",
        periodo,
        statusInfo(item.status).label,
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
      columnStyles:{0:{halign:"left", cellWidth:85}, 5:{halign:"center", cellWidth:65}},
      didParseCell:function(data){
        if(data.section === "body" && data.column.index === 5){
          var item = docState.itens[data.row.index];
          var rgb = hexToRgb(statusInfo(item.status).hex);
          data.cell.styles.textColor = rgb;
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    var y = doc.lastAutoTable.finalY + 10;
    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

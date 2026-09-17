/* ============================================================
   regras-divergencia-module.js — módulo "Regras de Divergência /
   Exceção" (Fase 4, Auditoria, Riscos e Controles). Mesmo padrão
   mount/desenharNoDoc dos demais módulos — terceira ferramenta
   simultânea na Fase 4, junto com a Matriz de Riscos e o Plano de
   Auditoria.

   Enquanto o Plano de Auditoria define *como e com que frequência*
   cada risco é verificado, este módulo é um catálogo de *tipos* de
   divergência/exceção que podem ser encontrados em qualquer auditoria
   — cada um com severidade, prazo de resolução e uma cadeia de
   escalonamento (mesmo padrão Responsável/Escala para já usado na
   Matriz de Alçadas), retroalimentada da Matriz RACI da Governança.
   ============================================================ */
window.RegrasDivergenciaModule = (function(){
  "use strict";

  var SEVERIDADES = [
    {valor:"baixa", label:"Baixa", hex:"#1E8E64"},
    {valor:"media", label:"Média", hex:"#A67C3D"},
    {valor:"alta", label:"Alta", hex:"#D9432B"}
  ];

  var state = null;
  var el = null;
  var onChange = null;
  var raciRef = null;

  function uid(){ return "div_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function severidadeInfo(valor){
    return SEVERIDADES.filter(function(s){ return s.valor === valor; })[0] || SEVERIDADES[0];
  }

  function roleLabel(role){
    var sub = [role.nome, role.cargo].filter(Boolean).join(" · ");
    return sub ? role.area + " — " + sub : role.area;
  }

  function roleById(id){
    if(!raciRef || !raciRef.roles) return null;
    return raciRef.roles.filter(function(r){ return r.id === id; })[0] || null;
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

  function migrarItem(item){
    if(item.severidade === undefined) item.severidade = "media";
    if(item.prazoResolucaoDias === undefined) item.prazoResolucaoDias = "";
    if(item.responsavelRoleId === undefined) item.responsavelRoleId = "";
    if(item.responsavelNome === undefined) item.responsavelNome = "";
    if(item.escalaParaRoleId === undefined) item.escalaParaRoleId = "";
    if(item.escalaParaNome === undefined) item.escalaParaNome = "";
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("regrasdiv-addInput"),
      addBtn: q("regrasdiv-addBtn"),
      lista: q("regrasdiv-lista")
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

    var tituloInput = document.createElement("input");
    tituloInput.className = "riscos-field-main";
    tituloInput.placeholder = "Tipo de divergência ou exceção";
    tituloInput.maxLength = 140;
    tituloInput.value = item.tipo || "";
    tituloInput.addEventListener("change", function(){
      item.tipo = tituloInput.value.trim() || item.tipo;
      renderAll();
    });
    top.appendChild(tituloInput);

    var badge = document.createElement("span");
    badge.className = "gut-score-badge";
    var sev = severidadeInfo(item.severidade);
    badge.style.background = sev.hex;
    badge.textContent = sev.label;
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
    grid.className = "regrasdiv-grid";

    var severidadeSelect = document.createElement("select");
    SEVERIDADES.forEach(function(s){
      var opt = document.createElement("option");
      opt.value = s.valor; opt.textContent = s.label;
      if(item.severidade === s.valor) opt.selected = true;
      severidadeSelect.appendChild(opt);
    });
    severidadeSelect.addEventListener("change", function(){ item.severidade = severidadeSelect.value; renderAll(); });
    grid.appendChild(campoComRotulo("Severidade", severidadeSelect));

    var prazoInput = document.createElement("input");
    prazoInput.type = "number"; prazoInput.min = "0"; prazoInput.step = "1";
    prazoInput.placeholder = "Dias";
    prazoInput.value = item.prazoResolucaoDias || "";
    prazoInput.addEventListener("change", function(){ item.prazoResolucaoDias = prazoInput.value; renderAll(); });
    grid.appendChild(campoComRotulo("Prazo para resolução (dias)", prazoInput));

    var respSelect = document.createElement("select");
    popularSelectPapel(respSelect, item.responsavelRoleId, "— escolher —");
    respSelect.addEventListener("change", function(){
      item.responsavelRoleId = respSelect.value;
      var role = roleById(respSelect.value);
      item.responsavelNome = role ? roleLabel(role) : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Responsável pela resolução", respSelect));

    var escalaSelect = document.createElement("select");
    popularSelectPapel(escalaSelect, item.escalaParaRoleId, "— ninguém acima —");
    escalaSelect.addEventListener("change", function(){
      item.escalaParaRoleId = escalaSelect.value;
      var role = roleById(escalaSelect.value);
      item.escalaParaNome = role ? roleLabel(role) : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Escala para (se não resolvido no prazo)", escalaSelect));

    li.appendChild(grid);
    return li;
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhuma regra ainda.";
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
    var tipo = el.addInput.value.trim();
    if(!tipo) return;
    state.itens.push({
      id: uid(), tipo: tipo, severidade: "media", prazoResolucaoDias: "",
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
    var tpl = document.getElementById("regrasdiv-template");
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
   * Desenha as Regras de Divergência/Exceção num documento jsPDF já
   * criado, mesmo padrão dos demais módulos. Retorna a posição Y
   * final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhuma regra de divergência/exceção registrada.", 40, startY);
      return startY + 16;
    }

    function hexToRgb(hex){
      hex = hex.replace("#","");
      return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
    }

    var head = [["Tipo", "Severidade", "Prazo (dias)", "Responsável", "Escala para"]];
    var body = docState.itens.map(function(item){
      return [
        item.tipo || "",
        severidadeInfo(item.severidade).label,
        item.prazoResolucaoDias || "—",
        item.responsavelNome || "—",
        item.escalaParaNome || "—"
      ];
    });

    doc.autoTable({
      startY: startY,
      head: head, body: body,
      theme: "grid",
      rowPageBreak: "avoid",
      styles:{fontSize:8.5, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:8.5},
      columnStyles:{0:{halign:"left", cellWidth:130}, 1:{halign:"center", cellWidth:70}, 2:{halign:"center", cellWidth:70}},
      didParseCell:function(data){
        if(data.section === "body" && data.column.index === 1){
          var item = docState.itens[data.row.index];
          var rgb = hexToRgb(severidadeInfo(item.severidade).hex);
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

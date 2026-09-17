/* ============================================================
   segregacao-module.js — módulo "Segregação de Funções" (Fase 2,
   Governança e Compliance). Mesmo padrão mount/desenharNoDoc dos
   demais módulos — terceira ferramenta simultânea na Fase 2, junto
   com a Matriz RACI e a Matriz de Alçadas.

   Diferente de todo módulo anterior: aqui o conflito não é digitado
   nem escolhido manualmente — é **calculado automaticamente**
   comparando, para cada par de atividades marcado como incompatível,
   se algum papel está com R ou A em ambas ao mesmo tempo na Matriz
   RACI da mesma fase. O usuário só escolhe QUAIS pares checar; o
   resultado (conflito ou não, e quem está em conflito) é recalculado
   a cada renderização, sempre refletindo o estado atual da RACI.
   ============================================================ */
window.SegregacaoModule = (function(){
  "use strict";

  var state = null;
  var el = null;
  var onChange = null;
  var raciRef = null;

  function uid(){ return "seg_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function roleLabel(role){
    var sub = [role.nome, role.cargo].filter(Boolean).join(" · ");
    return sub ? role.area + " — " + sub : role.area;
  }

  function roleById(id){
    if(!raciRef || !raciRef.roles) return null;
    return raciRef.roles.filter(function(r){ return r.id === id; })[0] || null;
  }

  function atividadeById(id){
    if(!raciRef || !raciRef.activities) return null;
    return raciRef.activities.filter(function(a){ return a.id === id; })[0] || null;
  }

  function popularSelectAtividade(select, valorAtual, excluirId){
    select.innerHTML = "";
    var optPadrao = document.createElement("option");
    optPadrao.value = "";
    optPadrao.textContent = (raciRef && raciRef.activities && raciRef.activities.length) ? "— escolher —" : "— nenhuma atividade na RACI ainda —";
    select.appendChild(optPadrao);
    if(raciRef && raciRef.activities){
      raciRef.activities.forEach(function(a){
        if(a.id === excluirId) return;
        var opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.titulo || "(sem título)";
        if(valorAtual === a.id) opt.selected = true;
        select.appendChild(opt);
      });
    }
  }

  /* Papéis com R ou A numa atividade — mesma leitura de célula já usada
     em fechamento.js (buscarAprovadorNaGovernanca), aqui generalizada
     pra qualquer papel com responsabilidade de execução ou aprovação,
     não só o aprovador. */
  function rolesComResponsabilidade(atividadeId){
    if(!raciRef || !raciRef.cells || !atividadeId) return [];
    var ids = [];
    Object.keys(raciRef.cells).forEach(function(chave){
      var partes = chave.split("|");
      var valor = raciRef.cells[chave];
      if(partes[0] === atividadeId && (valor === "R" || valor === "A") && ids.indexOf(partes[1]) === -1){
        ids.push(partes[1]);
      }
    });
    return ids;
  }

  function recalcularConflito(par){
    if(!par.atividadeAId || !par.atividadeBId){ par.rolesConflitantes = []; return; }
    var rolesA = rolesComResponsabilidade(par.atividadeAId);
    var rolesB = rolesComResponsabilidade(par.atividadeBId);
    var conflitantesIds = rolesA.filter(function(id){ return rolesB.indexOf(id) !== -1; });
    par.rolesConflitantes = conflitantesIds.map(function(id){
      var role = roleById(id);
      return role ? roleLabel(role) : id;
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

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addBtn: q("segregacao-addBtn"),
      lista: q("segregacao-lista")
    };
  }

  function renderCard(par){
    recalcularConflito(par);

    var li = document.createElement("li");
    li.className = "riscos-card";

    var top = document.createElement("div");
    top.className = "riscos-card-top";

    var badge = document.createElement("span");
    badge.className = "gut-score-badge";
    badge.style.fontSize = "10px";
    if(par.rolesConflitantes.length){
      badge.style.background = "#D9432B";
      badge.textContent = "Conflito";
    } else {
      badge.style.background = "#1E8E64";
      badge.textContent = "Sem conflito";
    }
    top.appendChild(badge);

    var rm = document.createElement("button");
    rm.className = "icon-btn";
    rm.title = "Remover";
    rm.innerHTML = "&times;";
    rm.style.marginLeft = "auto";
    rm.addEventListener("click", function(){
      state.pares = state.pares.filter(function(x){ return x.id !== par.id; });
      renderAll();
    });
    top.appendChild(rm);
    li.appendChild(top);

    var grid = document.createElement("div");
    grid.className = "segregacao-grid";

    var selectA = document.createElement("select");
    popularSelectAtividade(selectA, par.atividadeAId, par.atividadeBId);
    selectA.addEventListener("change", function(){
      par.atividadeAId = selectA.value;
      var atv = atividadeById(selectA.value);
      par.atividadeATexto = atv ? atv.titulo : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Atividade A", selectA));

    var selectB = document.createElement("select");
    popularSelectAtividade(selectB, par.atividadeBId, par.atividadeAId);
    selectB.addEventListener("change", function(){
      par.atividadeBId = selectB.value;
      var atv = atividadeById(selectB.value);
      par.atividadeBTexto = atv ? atv.titulo : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Atividade B", selectB));

    var justInput = document.createElement("input");
    justInput.placeholder = "Ex.: quem solicita não deveria aprovar";
    justInput.maxLength = 160;
    justInput.value = par.justificativa || "";
    justInput.addEventListener("change", function(){ par.justificativa = justInput.value.trim(); renderAll(); });
    grid.appendChild(campoComRotulo("Justificativa (opcional)", justInput));

    li.appendChild(grid);

    if(par.rolesConflitantes.length){
      var aviso = document.createElement("p");
      aviso.style.cssText = "margin:8px 0 0;font-size:11.5px;color:#D9432B;font-weight:600;";
      aviso.textContent = "Papel(is) em conflito: " + par.rolesConflitantes.join(", ");
      li.appendChild(aviso);
    }

    return li;
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.pares.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum par de atividades incompatíveis ainda.";
      el.lista.appendChild(vazio);
      return;
    }
    state.pares.forEach(function(par){ el.lista.appendChild(renderCard(par)); });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(state);
  }

  function addPar(){
    state.pares.push({
      id: uid(), atividadeAId: "", atividadeATexto: "", atividadeBId: "", atividadeBTexto: "",
      justificativa: "", rolesConflitantes: []
    });
    renderAll();
  }

  function migrarState(s){
    if(!s.pares) s.pares = [];
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addPar);
  }

  function mount(rootEl, initialState, onChangeCb, raciStateRef){
    var tpl = document.getElementById("segregacao-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    migrarState(state);
    onChange = onChangeCb || null;
    raciRef = raciStateRef || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha os pares de Segregação de Funções num documento jsPDF já
   * criado, mesmo padrão dos demais módulos. Usa `rolesConflitantes`
   * já recalculado na última renderização em tela (não recalcula de
   * novo aqui, não recebe a RACI). Retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!docState.pares || docState.pares.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum par de atividades incompatíveis registrado.", 40, startY);
      return startY + 16;
    }

    function hexToRgb(hex){
      hex = hex.replace("#","");
      return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
    }

    var head = [["Atividade A", "Atividade B", "Justificativa", "Situação"]];
    var body = docState.pares.map(function(par){
      var conflito = par.rolesConflitantes && par.rolesConflitantes.length;
      return [
        par.atividadeATexto || "—",
        par.atividadeBTexto || "—",
        par.justificativa || "—",
        conflito ? ("Conflito: " + par.rolesConflitantes.join(", ")) : "Sem conflito"
      ];
    });

    doc.autoTable({
      startY: startY,
      head: head, body: body,
      theme: "grid",
      rowPageBreak: "avoid",
      styles:{fontSize:8.5, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:8.5},
      columnStyles:{0:{halign:"left", cellWidth:110}, 1:{halign:"left", cellWidth:110}, 2:{halign:"left", cellWidth:130}},
      didParseCell:function(data){
        if(data.section === "body" && data.column.index === 3){
          var par = docState.pares[data.row.index];
          var conflito = par.rolesConflitantes && par.rolesConflitantes.length;
          var rgb = hexToRgb(conflito ? "#D9432B" : "#1E8E64");
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

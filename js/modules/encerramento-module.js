/* ============================================================
   encerramento-module.js — módulo "Termo de Encerramento" (Fase 7,
   Implantação e Estabelecimento). Mesmo padrão mount/desenharNoDoc
   dos demais módulos — terceira ferramenta simultânea na Fase 7,
   junto com KPIs e Checklist de Implantação.

   Fecha o par com o Termo de Abertura (Fase 1): resultados
   alcançados, data de encerramento, e uma retroalimentação nova —
   os Critérios de sucesso definidos lá no início são trazidos de
   volta aqui (cross-fase, sincronizados por id) para você reavaliar
   um a um, sem redigitar nada. Lições aprendidas e pendências
   remanescentes são listas livres.
   ============================================================ */
window.EncerramentoModule = (function(){
  "use strict";

  var SUBLISTAS = ["licoesAprendidas", "pendencias"];

  var STATUS_CRITERIO = [
    {valor:"nao_avaliado", label:"Não avaliado", hex:"#88909B"},
    {valor:"atingido", label:"Atingido", hex:"#1E8E64"},
    {valor:"parcial", label:"Parcialmente atingido", hex:"#A67C3D"},
    {valor:"nao_atingido", label:"Não atingido", hex:"#D9432B"}
  ];

  var state = null;
  var el = null;
  var onChange = null;
  var aberturaRef = null;

  function uid(prefixo){ return prefixo + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function statusInfo(valor){
    return STATUS_CRITERIO.filter(function(s){ return s.valor === valor; })[0] || STATUS_CRITERIO[0];
  }

  function migrarState(s){
    if(s.resultadosAlcancados === undefined) s.resultadosAlcancados = "";
    if(s.dataEncerramento === undefined) s.dataEncerramento = "";
    if(!s.criteriosAvaliados) s.criteriosAvaliados = [];
    SUBLISTAS.forEach(function(chave){ if(!s[chave]) s[chave] = []; });
  }

  /* Sincroniza com os Critérios de sucesso do Termo de Abertura (Fase 1,
     cross-fase): cada critério de lá vira uma linha aqui, preservando o
     status já avaliado (casado por id) e descartando linhas de
     critérios que não existem mais na Abertura. */
  function sincronizarCriterios(){
    var criteriosAbertura = (aberturaRef && aberturaRef.criteriosSucesso) || [];
    var existentesPorId = {};
    state.criteriosAvaliados.forEach(function(c){ existentesPorId[c.criterioId] = c; });
    state.criteriosAvaliados = criteriosAbertura.map(function(c){
      var existente = existentesPorId[c.id];
      return {
        criterioId: c.id,
        criterioTexto: c.texto,
        status: existente ? existente.status : "nao_avaliado"
      };
    });
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      resultadosInput: q("encerramento-resultadosInput"),
      dataInput: q("encerramento-dataInput"),
      criteriosLista: q("encerramento-criteriosLista"),
      licoesAprendidas: {lista: q("encerramento-licoesLista"), input: q("encerramento-licoesInput"), btn: q("encerramento-licoesBtn")},
      pendencias: {lista: q("encerramento-pendenciasLista"), input: q("encerramento-pendenciasInput"), btn: q("encerramento-pendenciasBtn")}
    };
  }

  function renderCriterios(){
    el.criteriosLista.innerHTML = "";
    if(state.criteriosAvaliados.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum critério de sucesso definido no Termo de Abertura ainda.";
      el.criteriosLista.appendChild(vazio);
      return;
    }
    state.criteriosAvaliados.forEach(function(criterio){
      var li = document.createElement("li");
      li.className = "encerramento-criterio-row";

      var span = document.createElement("span");
      span.textContent = criterio.criterioTexto;
      li.appendChild(span);

      var select = document.createElement("select");
      STATUS_CRITERIO.forEach(function(s){
        var opt = document.createElement("option");
        opt.value = s.valor; opt.textContent = s.label;
        if(criterio.status === s.valor) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", function(){
        criterio.status = select.value;
        if(onChange) onChange(state);
      });
      li.appendChild(select);

      el.criteriosLista.appendChild(li);
    });
  }

  function renderSublista(chave){
    var refs = el[chave];
    refs.lista.innerHTML = "";
    var itens = state[chave] || [];
    if(itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:11.5px;color:var(--ink-faint);list-style:none;";
      vazio.textContent = "Nenhum item ainda.";
      refs.lista.appendChild(vazio);
      return;
    }
    itens.forEach(function(item){
      var li = document.createElement("li");
      li.className = "ishikawa-causa-row";
      var span = document.createElement("span");
      span.textContent = item.texto;
      li.appendChild(span);
      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        state[chave] = state[chave].filter(function(x){ return x.id !== item.id; });
        renderSublista(chave);
        if(onChange) onChange(state);
      });
      li.appendChild(rm);
      refs.lista.appendChild(li);
    });
  }

  function wireSublista(chave){
    var refs = el[chave];
    function adicionar(){
      var texto = refs.input.value.trim();
      if(!texto) return;
      state[chave].push({id: uid(chave), texto: texto});
      refs.input.value = "";
      renderSublista(chave);
      if(onChange) onChange(state);
    }
    refs.btn.addEventListener("click", adicionar);
    refs.input.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); adicionar(); } });
    renderSublista(chave);
  }

  function wireEvents(){
    el.resultadosInput.addEventListener("change", function(){
      state.resultadosAlcancados = el.resultadosInput.value.trim();
      if(onChange) onChange(state);
    });
    el.dataInput.addEventListener("change", function(){
      state.dataEncerramento = el.dataInput.value;
      if(onChange) onChange(state);
    });
    SUBLISTAS.forEach(wireSublista);
  }

  function mount(rootEl, initialState, onChangeCb, aberturaStateRef){
    var tpl = document.getElementById("encerramento-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    migrarState(state);
    onChange = onChangeCb || null;
    aberturaRef = aberturaStateRef || null;

    el.resultadosInput.value = state.resultadosAlcancados || "";
    el.dataInput.value = state.dataEncerramento || "";

    sincronizarCriterios();
    renderCriterios();
    wireEvents();
  }

  function dataBr(iso){
    if(!iso) return "";
    var partes = iso.split("-");
    return partes.length === 3 ? (partes[2] + "/" + partes[1] + "/" + partes[0]) : iso;
  }

  function hexToRgb(hex){
    hex = hex.replace("#","");
    return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
  }

  var LABELS_BLOCO = {
    licoesAprendidas: "Lições aprendidas",
    pendencias: "Pendências remanescentes"
  };

  /**
   * Desenha o Termo de Encerramento num documento jsPDF já criado
   * (mesmo padrão dos demais módulos) — resultados alcançados, data,
   * uma tabela de critérios de sucesso reavaliados e uma tabela
   * Bloco/Itens para lições aprendidas e pendências. Retorna a
   * posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();
    var y = startY;

    doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.setTextColor(28,36,48);
    doc.text("Resultados alcançados", 40, y);
    y += 13;
    doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
    doc.setTextColor(80,88,100);
    var linhas = doc.splitTextToSize(docState.resultadosAlcancados || "(não definido)", 500);
    doc.text(linhas, 40, y);
    y += linhas.length * 12 + 10;

    if(y > pageH - 40){ doc.addPage(); y = 40; }
    doc.setFont("helvetica","bold"); doc.setFontSize(9.5);
    doc.setTextColor(28,36,48);
    doc.text("Data de encerramento: " + (docState.dataEncerramento ? dataBr(docState.dataEncerramento) : "—"), 40, y);
    y += 16;

    if(docState.criteriosAvaliados && docState.criteriosAvaliados.length){
      if(y > pageH - 60){ doc.addPage(); y = 40; }
      doc.autoTable({
        startY: y,
        head: [["Critério de sucesso", "Status"]],
        body: docState.criteriosAvaliados.map(function(c){ return [c.criterioTexto || "", statusInfo(c.status).label]; }),
        theme: "grid",
        rowPageBreak: "avoid",
        styles:{fontSize:9, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
        headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
        columnStyles:{0:{halign:"left"}, 1:{halign:"center", cellWidth:140}},
        didParseCell:function(data){
          if(data.section === "body" && data.column.index === 1){
            var item = docState.criteriosAvaliados[data.row.index];
            var rgb = hexToRgb(statusInfo(item.status).hex);
            data.cell.styles.textColor = rgb;
            data.cell.styles.fontStyle = "bold";
          }
        }
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    if(y > pageH - 60){ doc.addPage(); y = 40; }
    var body = SUBLISTAS.map(function(chave){
      var itens = (docState[chave] || []).map(function(i){ return i.texto; }).join("; ");
      return [LABELS_BLOCO[chave], itens || "—"];
    });
    doc.autoTable({
      startY: y,
      head: [["Bloco", "Itens"]], body: body,
      theme: "grid",
      rowPageBreak: "avoid",
      styles:{fontSize:9, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
      columnStyles:{0:{halign:"left", cellWidth:150, fontStyle:"bold"}, 1:{halign:"left"}}
    });
    y = doc.lastAutoTable.finalY + 10;

    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

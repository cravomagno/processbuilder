/* ============================================================
   gut-module.js — módulo "Matriz GUT" (Fase 1, Diagnóstico e
   Viabilidade). Mesmo padrão de RaciModule/W2HModule: mount(root,
   state, onChange) + desenharNoDoc(doc, state, startY) reutilizada
   por fechamento.js. Prioriza problemas por Gravidade × Urgência ×
   Tendência (1-5 cada), score automático, lista ordenada por score.
   ============================================================ */
window.GUTModule = (function(){
  "use strict";

  var gutState = null;
  var el = null;
  var onChange = null;

  function uid(){ return "gut_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("gut-addInput"),
      addBtn: q("gut-addBtn"),
      lista: q("gut-lista")
    };
  }

  function score(item){ return item.gravidade * item.urgencia * item.tendencia; }

  function tierOf(s){
    if(s >= 60) return {label:"Alta prioridade", hex:"#D9432B"};
    if(s >= 20) return {label:"Média prioridade", hex:"#A67C3D"};
    return {label:"Baixa prioridade", hex:"#1E8E64"};
  }

  function selectDeNota(valorAtual, onSelecionar){
    var select = document.createElement("select");
    select.className = "gut-nota-select";
    for(var n=1; n<=5; n++){
      var opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      if(n === valorAtual) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", function(){
      onSelecionar(parseInt(select.value, 10));
      renderAll();
    });
    return select;
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(gutState.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum problema ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    var ordenados = gutState.itens.slice().sort(function(a,b){ return score(b) - score(a); });

    ordenados.forEach(function(item){
      var li = document.createElement("li");
      li.className = "gut-row";

      var problemaInput = document.createElement("input");
      problemaInput.className = "gut-problema";
      problemaInput.placeholder = "Problema / causa";
      problemaInput.maxLength = 160;
      problemaInput.value = item.problema || "";
      problemaInput.addEventListener("change", function(){
        item.problema = problemaInput.value.trim() || item.problema;
        renderAll();
      });
      li.appendChild(problemaInput);

      var notas = document.createElement("div");
      notas.className = "gut-notas";
      [
        {label:"G", campo:"gravidade"},
        {label:"U", campo:"urgencia"},
        {label:"T", campo:"tendencia"}
      ].forEach(function(def){
        var wrap = document.createElement("div");
        wrap.className = "gut-nota-wrap";
        var lab = document.createElement("span");
        lab.className = "gut-nota-label";
        lab.textContent = def.label;
        wrap.appendChild(lab);
        wrap.appendChild(selectDeNota(item[def.campo], function(v){ item[def.campo] = v; }));
        notas.appendChild(wrap);
      });
      li.appendChild(notas);

      var s = score(item);
      var tier = tierOf(s);
      var badge = document.createElement("span");
      badge.className = "gut-score-badge";
      badge.style.background = tier.hex;
      badge.title = tier.label;
      badge.textContent = s;
      li.appendChild(badge);

      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        gutState.itens = gutState.itens.filter(function(x){ return x.id !== item.id; });
        renderAll();
      });
      li.appendChild(rm);

      el.lista.appendChild(li);
    });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(gutState);
  }

  function addItem(){
    var problema = el.addInput.value.trim();
    if(!problema) return;
    gutState.itens.push({id: uid(), problema: problema, gravidade:3, urgencia:3, tendencia:3});
    el.addInput.value = "";
    renderAll();
    el.addInput.focus();
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addItem);
    el.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addItem(); } });
  }

  function mount(rootEl, initialState, onChangeCb){
    var tpl = document.getElementById("gut-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    gutState = initialState;
    onChange = onChangeCb || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha a matriz GUT (ordenada por score) num documento jsPDF já
   * criado, no mesmo padrão de RaciModule.desenharMatrizNoDoc e
   * W2HModule.desenharNoDoc. Retorna a posição Y final.
   */
  function desenharNoDoc(doc, state, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!state.itens || state.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum problema registrado na Matriz GUT.", 40, startY);
      return startY + 16;
    }

    var ordenados = state.itens.slice().sort(function(a,b){ return score(b) - score(a); });
    var head = [["Problema","G","U","T","Score","Prioridade"]];
    var body = ordenados.map(function(item){
      var s = score(item);
      return [item.problema||"", item.gravidade, item.urgencia, item.tendencia, s, tierOf(s).label];
    });

    function hexToRgb(hex){
      hex = hex.replace("#","");
      return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
    }

    doc.autoTable({
      startY: startY,
      head: head, body: body,
      theme: "grid",
      rowPageBreak: "avoid",
      styles:{fontSize:9, cellPadding:5, halign:"center", valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
      columnStyles:{0:{halign:"left", cellWidth:220}},
      didParseCell:function(data){
        if(data.section === "body" && data.column.index === 5){
          var row = ordenados[data.row.index];
          var rgb = hexToRgb(tierOf(score(row)).hex);
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

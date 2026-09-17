/* ============================================================
   riscos-module.js — módulo "Matriz de Riscos" (Fase 4, Auditoria,
   Riscos e Controles). Mesmo padrão mount/desenharNoDoc dos demais
   módulos. Combina o esquema de pontuação e ordenação da Matriz
   GUT (Probabilidade × Impacto em vez de G×U×T) com o layout de
   card + campos secundários do W2H (controles preventivo/detectivo).
   ============================================================ */
window.RiscosModule = (function(){
  "use strict";

  var state = null;
  var el = null;
  var onChange = null;

  function uid(){ return "risco_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("riscos-addInput"),
      addBtn: q("riscos-addBtn"),
      lista: q("riscos-lista")
    };
  }

  function score(item){ return item.probabilidade * item.impacto; }

  function tierOf(s){
    if(s >= 16) return {label:"Risco alto", hex:"#D9432B"};
    if(s >= 6) return {label:"Risco médio", hex:"#A67C3D"};
    return {label:"Risco baixo", hex:"#1E8E64"};
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
    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum risco ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    var ordenados = state.itens.slice().sort(function(a,b){ return score(b) - score(a); });

    ordenados.forEach(function(item){
      var li = document.createElement("li");
      li.className = "riscos-card";

      var top = document.createElement("div");
      top.className = "riscos-card-top";

      var riscoInput = document.createElement("input");
      riscoInput.className = "riscos-field-main";
      riscoInput.placeholder = "Risco";
      riscoInput.maxLength = 160;
      riscoInput.value = item.risco || "";
      riscoInput.addEventListener("change", function(){
        item.risco = riscoInput.value.trim() || item.risco;
        renderAll();
      });
      top.appendChild(riscoInput);

      var notas = document.createElement("div");
      notas.className = "gut-notas";
      [
        {label:"P", campo:"probabilidade"},
        {label:"I", campo:"impacto"}
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
      top.appendChild(notas);

      var s = score(item);
      var tier = tierOf(s);
      var badge = document.createElement("span");
      badge.className = "gut-score-badge";
      badge.style.background = tier.hex;
      badge.title = tier.label;
      badge.textContent = s;
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
      grid.className = "riscos-grid";
      [
        {campo:"controlePreventivo", label:"Controle preventivo"},
        {campo:"controleDetectivo", label:"Controle detectivo"}
      ].forEach(function(def){
        var input = document.createElement("input");
        input.placeholder = def.label;
        input.maxLength = 160;
        input.value = item[def.campo] || "";
        input.addEventListener("change", function(){
          item[def.campo] = input.value.trim();
          renderAll();
        });
        grid.appendChild(input);
      });
      li.appendChild(grid);

      el.lista.appendChild(li);
    });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(state);
  }

  function addItem(){
    var risco = el.addInput.value.trim();
    if(!risco) return;
    state.itens.push({id: uid(), risco: risco, probabilidade:3, impacto:3, controlePreventivo:"", controleDetectivo:""});
    el.addInput.value = "";
    renderAll();
    el.addInput.focus();
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addItem);
    el.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addItem(); } });
  }

  function mount(rootEl, initialState, onChangeCb){
    var tpl = document.getElementById("riscos-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    onChange = onChangeCb || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha a matriz de riscos (ordenada por score) num documento
   * jsPDF já criado, mesmo padrão dos demais módulos. Retorna a
   * posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum risco registrado na Matriz de Riscos.", 40, startY);
      return startY + 16;
    }

    var ordenados = docState.itens.slice().sort(function(a,b){ return score(b) - score(a); });
    var head = [["Risco","P","I","Score","Nível","Controle preventivo","Controle detectivo"]];
    var body = ordenados.map(function(item){
      var s = score(item);
      return [item.risco||"", item.probabilidade, item.impacto, s, tierOf(s).label, item.controlePreventivo||"", item.controleDetectivo||""];
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
      styles:{fontSize:8, cellPadding:5, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:8},
      columnStyles:{0:{halign:"left", cellWidth:110}, 1:{halign:"center"}, 2:{halign:"center"}, 3:{halign:"center"}, 4:{halign:"center"}},
      didParseCell:function(data){
        if(data.section === "body" && data.column.index === 4){
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

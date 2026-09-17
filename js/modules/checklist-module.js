/* ============================================================
   checklist-module.js — módulo "Checklist de Implantação" (Fase 7,
   Implantação e Estabelecimento). Mesmo padrão mount/desenharNoDoc
   dos demais módulos. Fecha a cobertura das 7 fases do backbone.
   ============================================================ */
window.ChecklistModule = (function(){
  "use strict";

  var STATUS = [
    {valor:"pendente", label:"Pendente", hex:"#88909B"},
    {valor:"conforme", label:"Conforme", hex:"#1E8E64"},
    {valor:"nao-conforme", label:"Não conforme", hex:"#D9432B"}
  ];

  var state = null;
  var el = null;
  var onChange = null;

  function uid(){ return "check_" + Date.now() + "_" + Math.floor(Math.random()*10000); }
  function statusDef(valor){
    for(var i=0;i<STATUS.length;i++){ if(STATUS[i].valor===valor) return STATUS[i]; }
    return STATUS[0];
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("checklist-addInput"),
      addBtn: q("checklist-addBtn"),
      lista: q("checklist-lista"),
      resumo: q("checklist-resumo")
    };
  }

  function renderResumo(){
    var total = state.itens.length;
    var conformes = state.itens.filter(function(i){ return i.status === "conforme"; }).length;
    el.resumo.textContent = total === 0 ? "" : (conformes + " de " + total + " itens conformes");
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum item ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    state.itens.forEach(function(item){
      var li = document.createElement("li");
      li.className = "checklist-row";

      var input = document.createElement("input");
      input.className = "checklist-item-field";
      input.value = item.item || "";
      input.placeholder = "Item de verificação";
      input.addEventListener("change", function(){
        item.item = input.value.trim() || item.item;
        renderAll();
      });
      li.appendChild(input);

      var statusGroup = document.createElement("div");
      statusGroup.className = "checklist-status-group";
      STATUS.forEach(function(s){
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "checklist-status-btn" + (item.status === s.valor ? " active" : "");
        btn.textContent = s.label;
        btn.style.setProperty("--status-hex", s.hex);
        btn.addEventListener("click", function(){
          item.status = s.valor;
          renderAll();
        });
        statusGroup.appendChild(btn);
      });
      li.appendChild(statusGroup);

      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        state.itens = state.itens.filter(function(x){ return x.id !== item.id; });
        renderAll();
      });
      li.appendChild(rm);

      el.lista.appendChild(li);
    });
  }

  function renderAll(){
    renderLista();
    renderResumo();
    if(onChange) onChange(state);
  }

  function addItem(){
    var texto = el.addInput.value.trim();
    if(!texto) return;
    state.itens.push({id: uid(), item: texto, status: "pendente"});
    el.addInput.value = "";
    renderAll();
    el.addInput.focus();
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addItem);
    el.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addItem(); } });
  }

  function mount(rootEl, initialState, onChangeCb){
    var tpl = document.getElementById("checklist-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    onChange = onChangeCb || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha o checklist num documento jsPDF já criado, mesmo padrão
   * dos demais módulos. Retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();
    var y = startY;

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum item registrado no checklist de implantação.", 40, y);
      return y + 16;
    }

    function hexToRgb(hex){
      hex = hex.replace("#","");
      return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
    }

    docState.itens.forEach(function(item){
      if(y > pageH - 40){ doc.addPage(); y = 40; }
      var def = statusDef(item.status);
      var rgb = hexToRgb(def.hex);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.circle(44, y-3, 3.5, "F");

      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(28,36,48);
      var linhas = doc.splitTextToSize(item.item || "", 380);
      doc.text(linhas, 54, y);

      doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(def.label, 460, y);

      y += Math.max(linhas.length * 12, 14) + 4;
    });

    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

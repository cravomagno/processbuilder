/* ============================================================
   porques-module.js — módulo "5 Porquês" (Fase 1, Diagnóstico e
   Viabilidade). Mesmo padrão de mount/desenharNoDoc dos demais
   módulos, com uma diferença: recebe também uma referência (só
   leitura) ao estado da Matriz GUT da mesma fase, para deixar
   escolher um problema já cadastrado em vez de redigitar — a
   retroalimentação entre ferramentas da mesma fase.
   ============================================================ */
window.PorquesModule = (function(){
  "use strict";

  var N_NIVEIS = 5;
  var state = null;
  var el = null;
  var onChange = null;
  var gutRef = null;

  function uid(){ return "porque_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      gutSelect: q("porques-gutSelect"),
      problemaInput: q("porques-problemaInput"),
      addBtn: q("porques-addBtn"),
      lista: q("porques-lista")
    };
  }

  function causaRaizDe(analise){
    for(var i = analise.porques.length - 1; i >= 0; i--){
      if(analise.porques[i]) return analise.porques[i];
    }
    return null;
  }

  function popularSelectGut(){
    el.gutSelect.innerHTML = "";
    var optPadrao = document.createElement("option");
    optPadrao.value = "";
    optPadrao.textContent = gutRef && gutRef.itens && gutRef.itens.length
      ? "— escolher um problema da Matriz GUT —"
      : "— nenhum problema na Matriz GUT ainda —";
    el.gutSelect.appendChild(optPadrao);
    if(gutRef && gutRef.itens){
      gutRef.itens.forEach(function(item){
        var opt = document.createElement("option");
        opt.value = item.problema;
        opt.textContent = item.problema;
        el.gutSelect.appendChild(opt);
      });
    }
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.analises.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhuma análise ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    state.analises.forEach(function(analise){
      var li = document.createElement("li");
      li.className = "porques-card";

      var top = document.createElement("div");
      top.className = "porques-card-top";
      var titleInput = document.createElement("input");
      titleInput.className = "porques-problema-field";
      titleInput.value = analise.problema || "";
      titleInput.placeholder = "Problema";
      titleInput.addEventListener("change", function(){
        analise.problema = titleInput.value.trim() || analise.problema;
        renderAll();
      });
      top.appendChild(titleInput);

      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        state.analises = state.analises.filter(function(a){ return a.id !== analise.id; });
        renderAll();
      });
      top.appendChild(rm);
      li.appendChild(top);

      var chain = document.createElement("div");
      chain.className = "porques-chain";
      for(var i = 0; i < N_NIVEIS; i++){
        (function(idx){
          var row = document.createElement("div");
          row.className = "porques-why";
          row.style.marginLeft = (idx * 16) + "px";

          var label = document.createElement("span");
          label.className = "porques-why-label";
          label.textContent = "Por quê " + (idx + 1) + "?";
          row.appendChild(label);

          var input = document.createElement("input");
          input.value = analise.porques[idx] || "";
          input.placeholder = idx === 0 ? "Por que isso acontece?" : "E por que isso acontece?";
          input.addEventListener("change", function(){
            analise.porques[idx] = input.value.trim();
            renderAll();
          });
          row.appendChild(input);

          chain.appendChild(row);
        })(i);
      }
      li.appendChild(chain);

      var raiz = causaRaizDe(analise);
      if(raiz){
        var raizBox = document.createElement("div");
        raizBox.className = "porques-raiz";
        raizBox.innerHTML = "<b>Causa raiz identificada:</b> ";
        raizBox.appendChild(document.createTextNode(raiz));
        li.appendChild(raizBox);
      }

      el.lista.appendChild(li);
    });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(state);
  }

  function addAnalise(){
    var problema = el.problemaInput.value.trim();
    if(!problema) return;
    state.analises.push({id: uid(), problema: problema, porques: ["","","","",""]});
    el.problemaInput.value = "";
    el.gutSelect.value = "";
    renderAll();
    el.problemaInput.focus();
  }

  function wireEvents(){
    el.gutSelect.addEventListener("change", function(){
      if(el.gutSelect.value) el.problemaInput.value = el.gutSelect.value;
    });
    el.addBtn.addEventListener("click", addAnalise);
    el.problemaInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addAnalise(); } });
  }

  function mount(rootEl, initialState, onChangeCb, gutStateRef){
    var tpl = document.getElementById("porques-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    onChange = onChangeCb || null;
    gutRef = gutStateRef || null;
    popularSelectGut();
    wireEvents();
    renderAll();
  }

  /**
   * Desenha as análises de 5 Porquês num documento jsPDF já criado
   * (mesmo padrão dos demais módulos). Como não é tabular, desenha
   * como texto/outline. Retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();
    var y = startY;

    if(!docState.analises || docState.analises.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhuma análise de 5 Porquês registrada.", 40, y);
      return y + 16;
    }

    docState.analises.forEach(function(analise){
      if(y > pageH - 60){ doc.addPage(); y = 40; }
      doc.setFont("helvetica","bold"); doc.setFontSize(9.5);
      doc.setTextColor(28,36,48);
      var problemaLinhas = doc.splitTextToSize("Problema: " + (analise.problema||""), 500);
      doc.text(problemaLinhas, 40, y);
      y += problemaLinhas.length * 12 + 4;

      doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.setTextColor(80,88,100);
      analise.porques.forEach(function(resp, idx){
        if(!resp) return;
        if(y > pageH - 40){ doc.addPage(); y = 40; }
        var linhas = doc.splitTextToSize("Por quê " + (idx+1) + "? " + resp, 480 - idx*10);
        doc.text(linhas, 46 + idx*10, y);
        y += linhas.length * 11;
      });

      var raiz = causaRaizDe(analise);
      if(raiz){
        if(y > pageH - 30){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(9);
        doc.setTextColor(30,142,100);
        var raizLinhas = doc.splitTextToSize("Causa raiz identificada: " + raiz, 500);
        doc.text(raizLinhas, 40, y+2);
        y += raizLinhas.length * 11 + 4;
      }
      y += 10;
    });

    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

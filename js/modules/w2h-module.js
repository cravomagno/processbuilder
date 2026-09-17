/* ============================================================
   w2h-module.js — módulo "5W2H" (Fase 3, Modelagem do Processo).
   Segue o mesmo padrão do RaciModule: mount(root, state, onChange)
   + uma função de desenho exposta para reuso no PDF de fechamento
   de fase (fechamento.js). Diferente do RACI, nasce em branco —
   não existe um template padrão de plano de ação.
   ============================================================ */
window.W2HModule = (function(){
  "use strict";

  var CAMPOS_SECUNDARIOS = [
    {key:"porQue", label:"Por quê"},
    {key:"quem", label:"Quem"},
    {key:"quando", label:"Quando"},
    {key:"onde", label:"Onde"},
    {key:"como", label:"Como"},
    {key:"quantoCusta", label:"Quanto custa"}
  ];

  var w2hState = null;
  var el = null;
  var onChange = null;

  function uid(){ return "acao_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      progressPct: q("w2h-progressPct"),
      progressFill: q("w2h-progressFill"),
      addInput: q("w2h-addInput"),
      addBtn: q("w2h-addBtn"),
      lista: q("w2h-lista"),
      validationBox: q("w2h-validationBox")
    };
  }

  function acaoCompleta(a){
    return !!(a.oQue && a.porQue && a.quem && a.quando && a.onde && a.como && a.quantoCusta);
  }

  function renderProgress(){
    var total = w2hState.acoes.length;
    var completas = w2hState.acoes.filter(acaoCompleta).length;
    var pct = total ? Math.round((completas/total)*100) : 0;
    el.progressPct.textContent = pct + "%";
    el.progressFill.style.width = pct + "%";
  }

  function renderValidation(){
    el.validationBox.innerHTML = "";
    if(w2hState.acoes.length === 0) return;

    var avisos = [];
    w2hState.acoes.forEach(function(a){
      var nome = a.oQue || "(ação sem título)";
      if(!a.quem) avisos.push("“" + nome + "” não tem responsável (Quem) definido.");
      if(!a.quando) avisos.push("“" + nome + "” não tem prazo (Quando) definido.");
    });

    var h = document.createElement("h3");
    h.textContent = avisos.length === 0 ? "Nenhuma pendência encontrada" : (avisos.length + (avisos.length===1 ? " pendência encontrada" : " pendências encontradas"));
    el.validationBox.appendChild(h);

    if(avisos.length === 0){
      var ok = document.createElement("p");
      ok.className = "val-ok";
      ok.textContent = "Toda ação tem responsável e prazo definidos.";
      el.validationBox.appendChild(ok);
      return;
    }

    var ul = document.createElement("ul");
    ul.className = "val-list";
    avisos.forEach(function(msg){
      var li = document.createElement("li");
      li.className = "val-item warning";
      var dot = document.createElement("span");
      dot.className = "dot";
      li.appendChild(dot);
      var span = document.createElement("span");
      span.textContent = msg;
      li.appendChild(span);
      ul.appendChild(li);
    });
    el.validationBox.appendChild(ul);
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(w2hState.acoes.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhuma ação ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    w2hState.acoes.forEach(function(acao){
      var li = document.createElement("li");
      li.className = "w2h-card";

      var top = document.createElement("div");
      top.className = "w2h-card-top";

      var mainInput = document.createElement("input");
      mainInput.className = "w2h-field-main";
      mainInput.placeholder = "O quê";
      mainInput.maxLength = 140;
      mainInput.value = acao.oQue || "";
      mainInput.addEventListener("change", function(){
        acao.oQue = mainInput.value.trim() || acao.oQue;
        renderAll();
      });
      top.appendChild(mainInput);

      var feitoLabel = document.createElement("label");
      feitoLabel.className = "w2h-feito";
      var feitoChk = document.createElement("input");
      feitoChk.type = "checkbox";
      feitoChk.checked = !!acao.feito;
      feitoChk.addEventListener("change", function(){
        acao.feito = feitoChk.checked;
        if(onChange) onChange(w2hState);
      });
      feitoLabel.appendChild(feitoChk);
      feitoLabel.appendChild(document.createTextNode("Feito"));
      top.appendChild(feitoLabel);

      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        w2hState.acoes = w2hState.acoes.filter(function(a){ return a.id !== acao.id; });
        renderAll();
      });
      top.appendChild(rm);

      li.appendChild(top);

      var grid = document.createElement("div");
      grid.className = "w2h-grid";
      CAMPOS_SECUNDARIOS.forEach(function(campo){
        var input = document.createElement("input");
        input.placeholder = campo.label;
        input.maxLength = 140;
        input.value = acao[campo.key] || "";
        input.addEventListener("change", function(){
          acao[campo.key] = input.value.trim();
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
    renderProgress();
    renderValidation();
    if(onChange) onChange(w2hState);
  }

  function addAcao(){
    var oQue = el.addInput.value.trim();
    if(!oQue) return;
    w2hState.acoes.push({
      id: uid(), oQue: oQue, porQue:"", quem:"", quando:"", onde:"", como:"", quantoCusta:"", feito:false
    });
    el.addInput.value = "";
    renderAll();
    el.addInput.focus();
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addAcao);
    el.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addAcao(); } });
  }

  function mount(rootEl, initialState, onChangeCb){
    var tpl = document.getElementById("w2h-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    w2hState = initialState;
    onChange = onChangeCb || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha a tabela do plano de ação num documento jsPDF já criado
   * (mesmo padrão do RaciModule.desenharMatrizNoDoc). Recebe w2hState
   * explicitamente para poder ser chamada de fora (fechamento.js).
   * Retorna a posição Y final.
   */
  function desenharNoDoc(doc, state, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!state.acoes || state.acoes.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhuma ação registrada no plano 5W2H.", 40, startY);
      return startY + 16;
    }

    var head = [["O quê","Por quê","Quem","Quando","Onde","Como","Quanto custa","Status"]];
    var body = state.acoes.map(function(a){
      return [a.oQue||"", a.porQue||"", a.quem||"", a.quando||"", a.onde||"", a.como||"", a.quantoCusta||"", a.feito ? "Feito" : "Pendente"];
    });

    doc.autoTable({
      startY: startY,
      head: head, body: body,
      theme: "grid",
      rowPageBreak: "avoid",
      styles:{fontSize:8, cellPadding:5, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:8},
      columnStyles:{7:{cellWidth:52, halign:"center"}},
      didParseCell:function(data){
        if(data.section === "body" && data.column.index === 7){
          data.cell.styles.textColor = data.cell.raw === "Feito" ? [30,142,100] : [110,116,128];
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

/* ============================================================
   pop-module.js — módulo "POPs / Instruções de Trabalho" (Fase 3,
   Modelagem do Processo). Mesmo padrão mount/desenharNoDoc dos
   demais módulos — terceira ferramenta simultânea na Fase 3, junto
   com o 5W2H e o Fluxograma do Processo.

   Retroalimentação dupla: Etapa vinculada vem do Fluxograma da
   *mesma* fase (como o Fluxograma tem vários fluxos nomeados, o
   select agrupa as etapas por fluxo com <optgroup>, mesma técnica já
   usada na Matriz de Rastreabilidade); Responsável pela execução vem
   da Matriz RACI da Governança (Fase 2, cross-fase).
   ============================================================ */
window.PopModule = (function(){
  "use strict";

  var state = null;
  var el = null;
  var onChange = null;
  var fluxogramaRef = null;
  var raciRef = null;

  function uid(){ return "pop_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

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

  function migrarItem(item){
    if(item.versao === undefined) item.versao = "1.0";
    if(item.conteudo === undefined) item.conteudo = "";
    if(item.etapaId === undefined) item.etapaId = "";
    if(item.etapaTexto === undefined) item.etapaTexto = "";
    if(item.responsavelRoleId === undefined) item.responsavelRoleId = "";
    if(item.responsavelNome === undefined) item.responsavelNome = "";
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("pop-addInput"),
      addBtn: q("pop-addBtn"),
      lista: q("pop-lista")
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
    tituloInput.placeholder = "Título do procedimento";
    tituloInput.maxLength = 140;
    tituloInput.value = item.titulo || "";
    tituloInput.addEventListener("change", function(){
      item.titulo = tituloInput.value.trim() || item.titulo;
      renderAll();
    });
    top.appendChild(tituloInput);

    var versaoInput = document.createElement("input");
    versaoInput.placeholder = "Versão";
    versaoInput.maxLength = 10;
    versaoInput.style.cssText = "flex:none;width:70px;border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 8px;font-size:12px;font-family:inherit;";
    versaoInput.value = item.versao || "1.0";
    versaoInput.title = "Versão do procedimento";
    versaoInput.addEventListener("change", function(){ item.versao = versaoInput.value.trim() || "1.0"; renderAll(); });
    top.appendChild(versaoInput);

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
    grid.className = "pop-grid";

    var etapaSelect = document.createElement("select");
    popularSelectEtapa(etapaSelect, item.etapaId);
    etapaSelect.addEventListener("change", function(){
      item.etapaId = etapaSelect.value;
      var etapa = etapaById(etapaSelect.value);
      item.etapaTexto = etapa ? (etapa.titulo || "") : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Etapa vinculada (do Fluxograma)", etapaSelect));

    var respSelect = document.createElement("select");
    popularSelectPapel(respSelect, item.responsavelRoleId);
    respSelect.addEventListener("change", function(){
      item.responsavelRoleId = respSelect.value;
      var role = roleById(respSelect.value);
      item.responsavelNome = role ? roleLabel(role) : "";
      renderAll();
    });
    grid.appendChild(campoComRotulo("Responsável pela execução", respSelect));

    li.appendChild(grid);

    var conteudoWrap = document.createElement("div");
    conteudoWrap.className = "treinamento-date-wrap";
    conteudoWrap.style.marginTop = "10px";
    var conteudoSpan = document.createElement("span");
    conteudoSpan.textContent = "Instruções / passo a passo";
    conteudoWrap.appendChild(conteudoSpan);
    var richtextContainer = document.createElement("div");
    conteudoWrap.appendChild(richtextContainer);
    window.RichText.montarEditor(richtextContainer, item.conteudo || "", function(html){
      item.conteudo = html;
      renderAll();
    }, {placeholder: "Descreva o procedimento passo a passo"});
    li.appendChild(conteudoWrap);

    return li;
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum procedimento ainda.";
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
    var titulo = el.addInput.value.trim();
    if(!titulo) return;
    state.itens.push({
      id: uid(), titulo: titulo, versao: "1.0", etapaId: "", etapaTexto: "",
      conteudo: "", responsavelRoleId: "", responsavelNome: ""
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
    var tpl = document.getElementById("pop-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    state.itens.forEach(migrarItem);
    onChange = onChangeCb || null;
    fluxogramaRef = fluxogramaStateRef || null;
    raciRef = raciStateRef || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha os POPs num documento jsPDF já criado — um bloco de texto
   * por procedimento (título + metadados + instruções), mesmo padrão
   * não-tabular já usado no 5 Porquês, já que o conteúdo é dissertativo.
   * Retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var y = startY;

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum procedimento registrado.", 40, y);
      return y + 16;
    }

    docState.itens.forEach(function(item, idx){
      /* Reserva espaço mínimo pro título+meta atomicamente (evita um POP
         começar com o título sozinho no fim de uma página) — mesma
         técnica do bloco de aprovação e do Fluxograma. */
      var tituloLinhasPrevia = doc.splitTextToSize((item.titulo || "(sem título)") + "  —  v" + (item.versao || "1.0"), pageW - 80);
      var alturaCabecalho = tituloLinhasPrevia.length * 12 + 4 + 14;

      if(idx > 0){
        var espaco = window.PdfDoc.garantirEspaco(doc, y, 20 + alturaCabecalho, 60);
        if(espaco.quebrou){
          y = espaco.y;
        } else {
          y += 18;
          doc.setDrawColor(230,233,238); doc.setLineWidth(0.6);
          doc.line(40, y, pageW - 40, y);
          y += 18;
        }
      } else {
        y = window.PdfDoc.garantirEspaco(doc, y, alturaCabecalho, 60).y;
      }

      doc.setFont("helvetica","bold"); doc.setFontSize(10);
      doc.setTextColor(28,36,48);
      doc.text(tituloLinhasPrevia, 40, y);
      y += tituloLinhasPrevia.length * 12 + 4;

      doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
      doc.setTextColor(110,116,128);
      doc.text("Etapa: " + (item.etapaTexto || "—") + "   •   Responsável: " + (item.responsavelNome || "—"), 40, y);
      y += 16;

      y = window.RichText.desenharNoDoc(doc, item.conteudo, 40, y, pageW - 80, pageH, {
        fontSize: 9, lineHeight: 12.5, cor: [60,66,78], vazio: "(sem instruções registradas)"
      });
    });

    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

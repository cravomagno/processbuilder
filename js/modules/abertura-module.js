/* ============================================================
   abertura-module.js — módulo "Termo de Abertura" (Fase 1,
   Diagnóstico e Viabilidade). Mesmo padrão mount/desenharNoDoc dos
   demais módulos, com uma diferença estrutural: é um documento único
   por caso (não uma lista de itens que se acumula) — objetivo, prazo
   alvo, patrocinador e quatro blocos (escopo dentro/fora, critérios
   de sucesso, stakeholders).

   Retroalimentação: o Patrocinador é escolhido entre os papéis já
   cadastrados na Matriz RACI da Governança — mesma retroalimentação
   entre fases já usada no Plano de Auditoria (Responsável ← RACI da
   Governança), não só dentro da própria fase.
   ============================================================ */
window.AberturaModule = (function(){
  "use strict";

  var SUBLISTAS = ["escopoDentro", "escopoFora", "criteriosSucesso", "stakeholders"];

  var state = null;
  var el = null;
  var onChange = null;
  var raciRef = null;

  function uid(prefixo){ return prefixo + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

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

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      objetivoInput: q("abertura-objetivoInput"),
      prazoInput: q("abertura-prazoInput"),
      patrocinadorSelect: q("abertura-patrocinadorSelect"),
      escopoDentro: {lista: q("abertura-escopoDentroLista"), input: q("abertura-escopoDentroInput"), btn: q("abertura-escopoDentroBtn")},
      escopoFora: {lista: q("abertura-escopoForaLista"), input: q("abertura-escopoForaInput"), btn: q("abertura-escopoForaBtn")},
      criteriosSucesso: {lista: q("abertura-criteriosLista"), input: q("abertura-criteriosInput"), btn: q("abertura-criteriosBtn")},
      stakeholders: {lista: q("abertura-stakeholdersLista"), input: q("abertura-stakeholdersInput"), btn: q("abertura-stakeholdersBtn")}
    };
  }

  function migrarState(s){
    SUBLISTAS.forEach(function(chave){ if(!s[chave]) s[chave] = []; });
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
    el.objetivoInput.addEventListener("change", function(){
      state.objetivo = el.objetivoInput.value.trim();
      if(onChange) onChange(state);
    });
    el.prazoInput.addEventListener("change", function(){
      state.prazoAlvo = el.prazoInput.value;
      if(onChange) onChange(state);
    });
    el.patrocinadorSelect.addEventListener("change", function(){
      state.patrocinadorRoleId = el.patrocinadorSelect.value;
      var role = roleById(el.patrocinadorSelect.value);
      state.patrocinadorNome = role ? roleLabel(role) : "";
      if(onChange) onChange(state);
    });
    SUBLISTAS.forEach(wireSublista);
  }

  function mount(rootEl, initialState, onChangeCb, raciStateRef){
    var tpl = document.getElementById("abertura-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    migrarState(state);
    onChange = onChangeCb || null;
    raciRef = raciStateRef || null;

    el.objetivoInput.value = state.objetivo || "";
    el.prazoInput.value = state.prazoAlvo || "";
    popularSelectPapel(el.patrocinadorSelect, state.patrocinadorRoleId);

    wireEvents();
  }

  var LABELS_BLOCO = {
    escopoDentro: "Escopo — dentro",
    escopoFora: "Escopo — fora",
    criteriosSucesso: "Critérios de sucesso",
    stakeholders: "Stakeholders"
  };

  function dataBr(iso){
    if(!iso) return "";
    var partes = iso.split("-");
    return partes.length === 3 ? (partes[2] + "/" + partes[1] + "/" + partes[0]) : iso;
  }

  /**
   * Desenha o Termo de Abertura num documento jsPDF já criado (mesmo
   * padrão dos demais módulos) — objetivo, prazo/patrocinador e uma
   * tabela Bloco/Itens com os quatro blocos. Retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();
    var y = startY;

    doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.setTextColor(28,36,48);
    doc.text("Objetivo", 40, y);
    y += 13;
    doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
    doc.setTextColor(80,88,100);
    var objetivoLinhas = doc.splitTextToSize(docState.objetivo || "(não definido)", 500);
    doc.text(objetivoLinhas, 40, y);
    y += objetivoLinhas.length * 12 + 10;

    if(y > pageH - 40){ doc.addPage(); y = 40; }
    doc.setFont("helvetica","bold"); doc.setFontSize(9.5);
    doc.setTextColor(28,36,48);
    var prazoTxt = docState.prazoAlvo ? dataBr(docState.prazoAlvo) : "—";
    doc.text("Prazo alvo: " + prazoTxt + "   •   Patrocinador: " + (docState.patrocinadorNome || "—"), 40, y);
    y += 16;

    var head = [["Bloco", "Itens"]];
    var body = SUBLISTAS.map(function(chave){
      var itens = (docState[chave] || []).map(function(i){ return i.texto; }).join("; ");
      return [LABELS_BLOCO[chave], itens || "—"];
    });

    doc.autoTable({
      startY: y,
      head: head, body: body,
      theme: "grid",
      rowPageBreak: "avoid",
      styles:{fontSize:9, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
      columnStyles:{0:{halign:"left", cellWidth:110, fontStyle:"bold"}, 1:{halign:"left"}}
    });

    y = doc.lastAutoTable.finalY + 10;
    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

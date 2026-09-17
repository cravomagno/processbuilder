/* ============================================================
   ishikawa-module.js — módulo "Diagrama de Ishikawa (6M)" (Fase 1,
   Diagnóstico e Viabilidade). Mesmo padrão de mount/desenharNoDoc
   dos demais módulos, com a mesma retroalimentação já usada no 5
   Porquês: o problema mapeado pode vir de um item já cadastrado na
   Matriz GUT, em vez de redigitado do zero.

   Fecha o trio clássico de diagnóstico desta fase: a Matriz GUT
   prioriza QUAL problema atacar; o Ishikawa mapeia POR QUE ele pode
   estar acontecendo, organizando as causas nas 6 categorias
   clássicas (Método, Mão de obra, Máquina, Material, Meio ambiente,
   Medida); o 5 Porquês aprofunda UMA causa específica até a raiz.
   ============================================================ */
window.IshikawaModule = (function(){
  "use strict";

  var CATEGORIAS = [
    {chave:"metodo", label:"Método"},
    {chave:"maoDeObra", label:"Mão de obra"},
    {chave:"maquina", label:"Máquina"},
    {chave:"material", label:"Material"},
    {chave:"meioAmbiente", label:"Meio ambiente"},
    {chave:"medida", label:"Medida"}
  ];

  var state = null;
  var el = null;
  var onChange = null;
  var gutRef = null;

  function uid(prefixo){ return prefixo + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function causasVazias(){
    var obj = {};
    CATEGORIAS.forEach(function(c){ obj[c.chave] = []; });
    return obj;
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      gutSelect: q("ishikawa-gutSelect"),
      problemaInput: q("ishikawa-problemaInput"),
      addBtn: q("ishikawa-addBtn"),
      lista: q("ishikawa-lista")
    };
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

  function renderCategoria(diagrama, def){
    var box = document.createElement("div");
    box.className = "ishikawa-categoria";

    var h5 = document.createElement("h5");
    h5.textContent = def.label;
    box.appendChild(h5);

    var lista = document.createElement("ul");
    lista.className = "ishikawa-causas-lista";
    var causas = diagrama.causas[def.chave] || [];
    if(causas.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:11.5px;color:var(--ink-faint);list-style:none;";
      vazio.textContent = "Nenhuma causa ainda.";
      lista.appendChild(vazio);
    } else {
      causas.forEach(function(causa){
        var li = document.createElement("li");
        li.className = "ishikawa-causa-row";
        var span = document.createElement("span");
        span.textContent = causa.texto;
        li.appendChild(span);
        var rm = document.createElement("button");
        rm.className = "icon-btn";
        rm.title = "Remover";
        rm.innerHTML = "&times;";
        rm.addEventListener("click", function(){
          diagrama.causas[def.chave] = diagrama.causas[def.chave].filter(function(x){ return x.id !== causa.id; });
          renderAll();
        });
        li.appendChild(rm);
        lista.appendChild(li);
      });
    }
    box.appendChild(lista);

    var addRow = document.createElement("div");
    addRow.className = "ishikawa-add-causa";
    var input = document.createElement("input");
    input.placeholder = "Nova causa";
    input.maxLength = 140;
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "+";
    addBtn.title = "Adicionar causa em " + def.label;
    function adicionar(){
      var texto = input.value.trim();
      if(!texto) return;
      diagrama.causas[def.chave].push({id: uid("causa"), texto: texto});
      renderAll();
    }
    addBtn.addEventListener("click", adicionar);
    input.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); adicionar(); } });
    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    box.appendChild(addRow);

    return box;
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.diagramas.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum diagrama ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    state.diagramas.forEach(function(diagrama){
      var li = document.createElement("li");
      li.className = "porques-card";

      var top = document.createElement("div");
      top.className = "porques-card-top";
      var titleInput = document.createElement("input");
      titleInput.className = "porques-problema-field";
      titleInput.value = diagrama.problema || "";
      titleInput.placeholder = "Problema";
      titleInput.addEventListener("change", function(){
        diagrama.problema = titleInput.value.trim() || diagrama.problema;
        renderAll();
      });
      top.appendChild(titleInput);

      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        state.diagramas = state.diagramas.filter(function(d){ return d.id !== diagrama.id; });
        renderAll();
      });
      top.appendChild(rm);
      li.appendChild(top);

      var categorias = document.createElement("div");
      categorias.className = "ishikawa-categorias";
      CATEGORIAS.forEach(function(def){ categorias.appendChild(renderCategoria(diagrama, def)); });
      li.appendChild(categorias);

      el.lista.appendChild(li);
    });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(state);
  }

  function addDiagrama(){
    var problema = el.problemaInput.value.trim();
    if(!problema) return;
    state.diagramas.push({id: uid("ishikawa"), problema: problema, causas: causasVazias()});
    el.problemaInput.value = "";
    el.gutSelect.value = "";
    renderAll();
    el.problemaInput.focus();
  }

  function wireEvents(){
    el.gutSelect.addEventListener("change", function(){
      if(el.gutSelect.value) el.problemaInput.value = el.gutSelect.value;
    });
    el.addBtn.addEventListener("click", addDiagrama);
    el.problemaInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addDiagrama(); } });
  }

  /* Migra diagramas salvos antes de alguma categoria nova ser adicionada
     ao mnemônico (defensivo — hoje as 6 categorias já nascem juntas, mas
     mantém o mesmo cuidado dos demais módulos com dados já salvos). */
  function migrarDiagrama(diagrama){
    if(!diagrama.causas) diagrama.causas = causasVazias();
    CATEGORIAS.forEach(function(def){
      if(!diagrama.causas[def.chave]) diagrama.causas[def.chave] = [];
    });
  }

  function mount(rootEl, initialState, onChangeCb, gutStateRef){
    var tpl = document.getElementById("ishikawa-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    state.diagramas.forEach(migrarDiagrama);
    onChange = onChangeCb || null;
    gutRef = gutStateRef || null;
    popularSelectGut();
    wireEvents();
    renderAll();
  }

  /* Layout fixo da espinha de peixe: 3 categorias acima do eixo, 3 abaixo,
     na ordem em que aparecem no formulário. Mantido separado de CATEGORIAS
     porque aqui a ordem determina posição visual (topo/base), não só rótulo. */
  var LAYOUT_ESPINHA = [
    {chave:"metodo", lado:"topo"},
    {chave:"maquina", lado:"topo"},
    {chave:"meioAmbiente", lado:"topo"},
    {chave:"maoDeObra", lado:"base"},
    {chave:"material", lado:"base"},
    {chave:"medida", lado:"base"}
  ];
  var FRACOES_ESPINHA = [0.24, 0.50, 0.76];
  var ALTURA_ESPINHA = 176;

  /* Paleta usada só no desenho da espinha — tons da própria marca do app
     (mesmo azul dos cabeçalhos de tabela), não uma paleta nova. */
  var COR_MARCA = [43,58,103];
  var COR_MARCA_TINT = [225,229,240];
  var COR_INK = [28,36,48];
  var COR_INK_FAINT = [122,130,145];

  function labelDaCategoria(chave){
    var found = CATEGORIAS.filter(function(c){ return c.chave === chave; })[0];
    return found ? found.label : chave;
  }

  /**
   * Desenha o diagrama clássico de espinha de peixe (linhas/formas nativas
   * do jsPDF, sem imagem/canvas — traços, triângulo, círculo e texto) dentro
   * da largura disponível, com uma "espinha" por categoria do 6M e a
   * contagem de causas de cada uma. O texto completo de cada causa continua
   * na tabela desenhada logo abaixo, esta é só a visão geral clássica.
   *
   * As espinhas (bones) partem do eixo central em direção à cauda (à
   * esquerda), como num peixe de verdade — não em direção à cabeça — por
   * isso `dx` é negativo: da junção no eixo até o rótulo, o traço sempre
   * recua para a esquerda antes de abrir para cima/baixo.
   */
  function desenharEspinha(doc, diagrama, x0, y0, largura){
    var ySpine = y0 + ALTURA_ESPINHA / 2;
    var xSpineStart = x0 + 14;
    var xHeadBase = x0 + largura - 62;
    var xHeadTip = x0 + largura - 8;

    doc.setLineCap("round");
    doc.setLineJoin("round");

    /* Cauda — duas aletas pequenas na ponta esquerda do eixo, só um
       floreio pra ficar mais parecido com um peixe de verdade. */
    doc.setFillColor(COR_MARCA_TINT[0], COR_MARCA_TINT[1], COR_MARCA_TINT[2]);
    doc.setDrawColor(COR_MARCA[0], COR_MARCA[1], COR_MARCA[2]);
    doc.setLineWidth(1);
    doc.triangle(xSpineStart, ySpine, xSpineStart-16, ySpine-13, xSpineStart-2, ySpine-2, "FD");
    doc.triangle(xSpineStart, ySpine, xSpineStart-16, ySpine+13, xSpineStart-2, ySpine+2, "FD");

    /* Eixo central */
    doc.setDrawColor(COR_MARCA[0], COR_MARCA[1], COR_MARCA[2]);
    doc.setLineWidth(1.4);
    doc.line(xSpineStart, ySpine, xHeadBase, ySpine);

    /* Cabeça — triângulo com leve preenchimento na cor da marca + "olho" */
    doc.setFillColor(COR_MARCA_TINT[0], COR_MARCA_TINT[1], COR_MARCA_TINT[2]);
    doc.setLineWidth(1.2);
    doc.triangle(xHeadBase, ySpine-24, xHeadBase, ySpine+24, xHeadTip, ySpine, "FD");
    doc.setFillColor(COR_MARCA[0], COR_MARCA[1], COR_MARCA[2]);
    doc.circle(xHeadBase+16, ySpine-8, 2.1, "F");

    doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
    doc.setTextColor(COR_MARCA[0], COR_MARCA[1], COR_MARCA[2]);
    doc.text("PROBLEMA", xHeadBase+24, ySpine+3, {align:"center"});

    var porLado = {topo: [], base: []};
    LAYOUT_ESPINHA.forEach(function(def){ porLado[def.lado].push(def); });

    ["topo","base"].forEach(function(lado){
      porLado[lado].forEach(function(def, idx){
        var anchorX = xSpineStart + FRACOES_ESPINHA[idx] * (xHeadBase - xSpineStart);
        var dx = -46, dy = 48;
        var endX = anchorX + dx;
        var endY = lado === "topo" ? ySpine - dy : ySpine + dy;

        doc.setDrawColor(90,100,124);
        doc.setLineWidth(1);
        doc.line(anchorX, ySpine, endX, endY);

        var causas = diagrama.causas[def.chave] || [];
        var subLabel = "(" + causas.length + (causas.length === 1 ? " causa)" : " causas)");

        doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
        doc.setTextColor(COR_INK[0], COR_INK[1], COR_INK[2]);
        doc.text(labelDaCategoria(def.chave), endX, lado === "topo" ? endY - 10 : endY + 12, {align:"center"});
        doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
        doc.setTextColor(COR_INK_FAINT[0], COR_INK_FAINT[1], COR_INK_FAINT[2]);
        doc.text(subLabel, endX, lado === "topo" ? endY - 2 : endY + 20, {align:"center"});
      });
    });

    return y0 + ALTURA_ESPINHA;
  }

  /**
   * Desenha um cabeçalho em destaque ("faixa") com o texto do problema,
   * separando visualmente cada diagrama quando há mais de um no mesmo
   * fechamento de fase. Retorna a nova posição Y.
   */
  function desenharTituloProblema(doc, problema, x0, y0, largura){
    doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
    var linhas = doc.splitTextToSize("Problema: " + (problema || ""), largura - 20);
    var alturaFaixa = linhas.length * 13 + 12;

    doc.setFillColor(COR_MARCA_TINT[0], COR_MARCA_TINT[1], COR_MARCA_TINT[2]);
    doc.setDrawColor(COR_MARCA[0], COR_MARCA[1], COR_MARCA[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(x0, y0, largura, alturaFaixa, 4, 4, "FD");

    doc.setTextColor(COR_MARCA[0], COR_MARCA[1], COR_MARCA[2]);
    doc.text(linhas, x0 + 10, y0 + 15);

    return y0 + alturaFaixa;
  }

  /**
   * Desenha os diagramas de Ishikawa num documento jsPDF já criado
   * (mesmo padrão dos demais módulos) — o diagrama clássico de espinha
   * de peixe seguido de uma tabela Categoria/Causas por diagrama.
   * Retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();
    var pageW = doc.internal.pageSize.getWidth();
    var largura = pageW - 80;
    var y = startY;

    if(!docState.diagramas || docState.diagramas.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum diagrama de Ishikawa registrado.", 40, y);
      return y + 16;
    }

    docState.diagramas.forEach(function(diagrama, idx){
      if(idx > 0){
        y += 12;
        if(y > pageH - (ALTURA_ESPINHA + 100)){ doc.addPage(); y = 40; }
        doc.setDrawColor(218,223,230); doc.setLineWidth(0.8);
        doc.line(40, y, 40 + largura, y);
        y += 16;
      }
      if(y > pageH - (ALTURA_ESPINHA + 90)){ doc.addPage(); y = 40; }

      y = desenharTituloProblema(doc, diagrama.problema, 40, y, largura) + 10;

      y = desenharEspinha(doc, diagrama, 40, y, largura) + 10;

      var head = [["Categoria (6M)", "Causas identificadas"]];
      var body = CATEGORIAS.map(function(def){
        var causas = (diagrama.causas[def.chave] || []).map(function(c){ return c.texto; }).join("; ");
        return [def.label, causas || "—"];
      });

      doc.autoTable({
        startY: y,
        head: head, body: body,
        theme: "grid",
        rowPageBreak: "avoid",
        styles:{fontSize:9, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
        headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
        columnStyles:{0:{halign:"left", cellWidth:100, fontStyle:"bold"}, 1:{halign:"left"}}
      });

      y = doc.lastAutoTable.finalY + 10;
    });

    if(y > pageH - 30){ doc.addPage(); y = 40; }
    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

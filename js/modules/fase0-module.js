/* ============================================================
   fase0-module.js — módulo "Fase 0" (PM Canvas do projeto +
   registro de Aprovador(a)/Revisor(a) por fase). Mesmo padrão
   mount/desenharNoDoc dos demais módulos; a lista de itens de cada
   bloco do Canvas reaproveita o mesmo visual de .riscos-lista/-card
   já usado por 8 outros módulos, sem inventar classes novas para
   isso. Excel (modelo + importação) clona quase literalmente o par
   gerarModeloXlsx/importarParticipantes de treinamento-module.js.
   ============================================================ */
window.Fase0Module = (function(){
  "use strict";

  var state = null;
  var el = null;
  var onChange = null;

  /* As 12 caixas do PM Canvas, agrupadas nas 5 perguntas clássicas
     (Porquê / O quê / Quem / Como / Quando e Quanto) — mesmos nomes
     do print da ferramenta interna da Enops. A chave é o campo em
     fase.ferramentas.pmCanvas; o título é também o texto esperado na
     coluna "Bloco" do Excel de importação. */
  var BLOCOS = [
    {pergunta: "Porquê?", key: "justificativas", titulo: "Justificativas (Passado)", placeholder: "O que motivou este projeto até agora"},
    {pergunta: "Porquê?", key: "objetivosSmart", titulo: "Objetivos SMART", placeholder: "Objetivo específico, mensurável, com prazo"},
    {pergunta: "Porquê?", key: "beneficios", titulo: "Benefícios (Futuro)", placeholder: "Ganho esperado depois de pronto"},
    {pergunta: "O quê?", key: "produto", titulo: "Produto", placeholder: "O que será entregue"},
    {pergunta: "O quê?", key: "requisitos", titulo: "Requisitos", placeholder: "Condição que o produto precisa atender"},
    {pergunta: "Quem?", key: "stakeholders", titulo: "Stakeholders (Externo)", placeholder: "Interessado ou impactado fora do time"},
    {pergunta: "Quem?", key: "equipe", titulo: "Equipe (Interno)", placeholder: "Quem executa o projeto"},
    {pergunta: "Como?", key: "premissas", titulo: "Premissas", placeholder: "O que se assume como verdade"},
    {pergunta: "Como?", key: "entregaveisChave", titulo: "Entregáveis-Chave", placeholder: "Entrega concreta do projeto"},
    {pergunta: "Como?", key: "restricoes", titulo: "Restrições", placeholder: "Limite que o projeto precisa respeitar"},
    {pergunta: "Quando e Quanto?", key: "riscos", titulo: "Riscos", placeholder: "Risco que pode afetar o projeto"},
    {pergunta: "Quando e Quanto?", key: "custos", titulo: "Custos", placeholder: "Item de custo previsto"}
  ];

  function uid(prefixo){ return prefixo + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      pitch: q("fase0-pitch"),
      modeloBtn: q("fase0-modeloBtn"),
      importarBtn: q("fase0-importarBtn"),
      limparBtn: q("fase0-limparBtn"),
      canvasGrid: q("fase0-canvasGrid"),
      registroTbody: q("fase0-registroTbody")
    };
  }

  /* ---------------- PM Canvas ---------------- */

  function renderBlocoLista(ul, key){
    ul.innerHTML = "";
    var itens = state.pmCanvas[key];
    if(!itens.length){
      var vazio = document.createElement("li");
      vazio.className = "fase0-item-vazio";
      vazio.textContent = "Nenhum item ainda.";
      ul.appendChild(vazio);
      return;
    }
    itens.forEach(function(item){
      var li = document.createElement("li");
      li.className = "fase0-item";

      var texto = document.createElement("textarea");
      texto.className = "fase0-item-texto";
      texto.rows = 1;
      texto.maxLength = 240;
      texto.value = item.texto || "";
      texto.addEventListener("change", function(){
        item.texto = texto.value.trim();
        if(onChange) onChange(state);
      });
      li.appendChild(texto);

      var rm = document.createElement("button");
      rm.className = "fase0-item-remove";
      rm.type = "button";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        state.pmCanvas[key] = state.pmCanvas[key].filter(function(x){ return x.id !== item.id; });
        renderAll();
      });
      li.appendChild(rm);

      ul.appendChild(li);
    });
  }

  function renderCanvas(){
    el.canvasGrid.innerHTML = "";
    var perguntas = [];
    BLOCOS.forEach(function(b){ if(perguntas.indexOf(b.pergunta) === -1) perguntas.push(b.pergunta); });

    perguntas.forEach(function(pergunta){
      var col = document.createElement("div");
      col.className = "fase0-canvas-col";

      var h = document.createElement("p");
      h.className = "fase0-canvas-pergunta";
      h.textContent = pergunta;
      col.appendChild(h);

      BLOCOS.filter(function(b){ return b.pergunta === pergunta; }).forEach(function(b){
        var bloco = document.createElement("div");
        bloco.className = "fase0-bloco";

        var titulo = document.createElement("p");
        titulo.className = "fase0-bloco-titulo";
        titulo.textContent = b.titulo;
        bloco.appendChild(titulo);

        var addRow = document.createElement("div");
        addRow.className = "fase0-canvas-add";

        var input = document.createElement("input");
        input.type = "text";
        input.maxLength = 200;
        input.placeholder = b.placeholder;

        var addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "+";

        function addItem(){
          var texto = input.value.trim();
          if(!texto) return;
          state.pmCanvas[b.key].push({id: uid("pm"), texto: texto});
          input.value = "";
          renderAll();
        }
        addBtn.addEventListener("click", addItem);
        input.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addItem(); } });

        addRow.appendChild(input);
        addRow.appendChild(addBtn);
        bloco.appendChild(addRow);

        var ul = document.createElement("ul");
        ul.className = "fase0-lista";
        bloco.appendChild(ul);
        renderBlocoLista(ul, b.key);

        col.appendChild(bloco);
      });

      el.canvasGrid.appendChild(col);
    });
  }

  function wirePitch(){
    el.pitch.value = state.pmCanvas.pitch || "";
    el.pitch.addEventListener("change", function(){
      state.pmCanvas.pitch = el.pitch.value;
      if(onChange) onChange(state);
    });
  }

  /* ---------------- Excel: modelo + importação ---------------- */

  /* Formato de importação/exportação = o mesmo que a ferramenta de PM Canvas
     já usada internamente na Enops exporta de verdade (inspecionado num
     arquivo real: colunas Propriedade/Projeto/Título/Criado por/
     Description/SprintPeriod/Valor/Tipo de Item, uma linha por item). Não
     inventamos um formato próprio — assim um export de lá entra direto
     aqui, sem passo manual no meio.

     Propriedade → bloco do Canvas (nomes no singular, sem acento/caixa
     padronizados na comparação). "Pitch" e "Nome" são casos especiais
     (Pitch vira o campo de texto livre; Nome é metadado do projeto,
     ignorado). Qualquer Propriedade que não bata com a lista abaixo é
     tratada como um papel da Equipe (Interno) — é assim que a ferramenta de
     origem exporta cada integrante (ex.: "Dev", "Product Owner", "Scrum
     Master" — o nome do papel, livre, não uma categoria fixa). */
  var PROPRIEDADE_PARA_BLOCO = {
    "beneficio": "beneficios",
    "justificativa": "justificativas",
    "objetivo smart": "objetivosSmart",
    "produto": "produto",
    "requisito": "requisitos",
    "premissa": "premissas",
    "entregavel-chave": "entregaveisChave",
    "restricao": "restricoes",
    "risco": "riscos",
    "custo": "custos",
    "stakeholder": "stakeholders"
  };

  function normalizarPropriedade(s){
    return String(s == null ? "" : s).trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function compuserTextoImportado(titulo, description, sprintPeriod, valor){
    var principal = String(titulo == null ? "" : titulo).trim();
    var extra = [];
    if(sprintPeriod != null && sprintPeriod !== "") extra.push(sprintPeriod + " dia(s)");
    if(valor != null && valor !== "") extra.push("R$ " + valor);
    if(extra.length) principal += " (" + extra.join(" · ") + ")";
    var desc = description == null ? "" : String(description).trim();
    return desc ? (principal + " — " + desc) : principal;
  }

  function gerarModeloPmCanvasXlsx(){
    try{
      if(typeof ExcelJS === "undefined"){ throw new Error("ExcelJS não carregado"); }
      var wb = new ExcelJS.Workbook();
      var sheet = wb.addWorksheet("PM Canvas");
      var cabecalho = ["Propriedade", "Projeto", "Título", "Criado por", "Description", "SprintPeriod", "Valor", "Tipo de Item"];
      var header = sheet.getRow(1);
      cabecalho.forEach(function(texto, i){ header.getCell(i + 1).value = texto; });
      header.eachCell(function(c){
        c.font = {bold:true, color:{argb:"FFFFFFFF"}};
        c.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF2B3A67"}};
      });

      var nomeExemplo = "Meu Projeto";
      [
        ["Pitch", nomeExemplo, "Resumo de uma frase do projeto", "", "", "", "", "Item"],
        ["Nome", nomeExemplo, nomeExemplo, "", "", "", "", "Item"],
        ["Justificativa", nomeExemplo, "O que motivou este projeto até agora", "", "", "", "", "Item"],
        ["Objetivo SMART", nomeExemplo, "Objetivo específico, mensurável, com prazo", "", "", "", "", "Item"],
        ["Benefício", nomeExemplo, "Ganho esperado depois de pronto", "", "", "", "", "Item"],
        ["Produto", nomeExemplo, "O que será entregue", "", "", "", "", "Item"],
        ["Requisito", nomeExemplo, "Condição que o produto precisa atender", "", "Detalhe opcional", "", "", "Item"],
        ["Stakeholder", nomeExemplo, "Interessado ou impactado fora do time", "", "", "", "", "Item"],
        ["Product Owner", nomeExemplo, "Nome da pessoa nesse papel", "", "", "", "", "Item"],
        ["Premissa", nomeExemplo, "O que se assume como verdade", "", "", "", "", "Item"],
        ["Entregavel-Chave", nomeExemplo, "Nome da entrega", "", "Detalhe opcional", 30, "", "Item"],
        ["Restrição", nomeExemplo, "Limite que o projeto precisa respeitar", "", "", "", "", "Item"],
        ["Risco", nomeExemplo, "Risco que pode afetar o projeto", "", "", "", "", "Item"],
        ["Custo", nomeExemplo, "Item de custo previsto", "", "", "", 5000, "Item"]
      ].forEach(function(linha){ sheet.addRow(linha); });

      sheet.columns = [{width:18},{width:16},{width:44},{width:20},{width:30},{width:14},{width:12},{width:12}];

      wb.xlsx.writeBuffer().then(function(buffer){
        var blob = new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "modelo-pm-canvas.xlsx";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }catch(err){
      console.error(err);
      if(window.AppToast) window.AppToast.show("Não foi possível gerar o modelo.", true);
    }
  }

  function importarPmCanvasXlsx(file){
    var reader = new FileReader();
    reader.onload = function(){
      try{
        if(typeof ExcelJS === "undefined"){ throw new Error("ExcelJS não carregado"); }
        var wb = new ExcelJS.Workbook();
        wb.xlsx.load(reader.result).then(function(){
          var ws = wb.worksheets[0];
          var colunaPor = {};
          ws.getRow(1).eachCell(function(cell, colNumber){
            colunaPor[normalizarPropriedade(cell.value)] = colNumber;
          });
          var colPropriedade = colunaPor["propriedade"];
          var colTitulo = colunaPor["titulo"];
          if(!colPropriedade || !colTitulo){
            if(window.AppToast) window.AppToast.show('Esse Excel não tem as colunas "Propriedade" e "Título" — use o modelo baixado ou o export da ferramenta de PM Canvas.', true);
            return;
          }
          var colDescricao = colunaPor["description"];
          var colSprint = colunaPor["sprintperiod"];
          var colValor = colunaPor["valor"];

          var total = 0;
          ws.eachRow(function(row, rowNumber){
            if(rowNumber === 1) return; // pula cabeçalho
            var propriedadeOriginal = String((row.getCell(colPropriedade).value != null ? row.getCell(colPropriedade).value : "")).trim();
            var tituloOriginal = row.getCell(colTitulo).value;
            if(!propriedadeOriginal || tituloOriginal == null || String(tituloOriginal).trim() === "") return;

            var norm = normalizarPropriedade(propriedadeOriginal);
            if(norm === "nome") return; // metadado do projeto, não é um bloco do Canvas

            if(norm === "pitch"){
              state.pmCanvas.pitch = String(tituloOriginal).trim();
              total++;
              return;
            }

            var description = colDescricao ? row.getCell(colDescricao).value : null;
            var sprintPeriod = colSprint ? row.getCell(colSprint).value : null;
            var valor = colValor ? row.getCell(colValor).value : null;

            var blocoKey = PROPRIEDADE_PARA_BLOCO[norm];
            var texto;
            if(blocoKey){
              texto = compuserTextoImportado(tituloOriginal, description, sprintPeriod, valor);
            }else{
              // Propriedade não reconhecida = papel específico da Equipe (Dev, Product Owner, Scrum Master...)
              blocoKey = "equipe";
              texto = propriedadeOriginal + " — " + String(tituloOriginal).trim();
            }
            state.pmCanvas[blocoKey].push({id: uid("pm"), texto: texto});
            total++;
          });

          if(window.AppToast) window.AppToast.show(total + " item(ns) importado(s) do Excel.");
          renderAll();
        }).catch(function(err){
          console.error(err);
          if(window.AppToast) window.AppToast.show("Não foi possível ler esse arquivo .xlsx.", true);
        });
      }catch(err){
        console.error(err);
        if(window.AppToast) window.AppToast.show("Não foi possível ler esse arquivo.", true);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function limparPmCanvas(){
    var ok = window.confirm('Limpar o PM Canvas? Isso apaga o Pitch e todos os itens dos 12 blocos (Justificativas, Objetivos, Benefícios, Produto, Requisitos, Stakeholders, Equipe, Premissas, Entregáveis-Chave, Restrições, Riscos, Custos). Não afeta o registro de Aprovador(a)/Revisor(a). Essa ação não pode ser desfeita.');
    if(!ok) return;
    state.pmCanvas.pitch = "";
    BLOCOS.forEach(function(b){ state.pmCanvas[b.key] = []; });
    el.pitch.value = "";
    renderAll();
    if(window.AppToast) window.AppToast.show("PM Canvas limpo.");
  }

  function wireExcelButtons(){
    el.modeloBtn.addEventListener("click", gerarModeloPmCanvasXlsx);
    el.limparBtn.addEventListener("click", limparPmCanvas);

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".xlsx";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", function(){
      if(fileInput.files && fileInput.files[0]) importarPmCanvasXlsx(fileInput.files[0]);
      fileInput.value = "";
    });
    el.importarBtn.parentNode.appendChild(fileInput);
    el.importarBtn.addEventListener("click", function(){ fileInput.click(); });
  }

  /* ---------------- Registro de Aprovador(a)/Revisor(a) ----------------
     "Documentação viva": os <input> desta tabela levam a classe
     fase-nao-bloquear (ver aplicarBloqueioFase em app.js) para
     continuarem editáveis mesmo com a Fase 0 fechada — o registro
     muda conforme o usuário avança pelas 7 fases reais do processo. */

  function renderRegistro(){
    el.registroTbody.innerHTML = "";
    var fasesPorId = {};
    (window.CasoState.FASES_BACKBONE || []).forEach(function(f){ fasesPorId[f.id] = f; });

    state.aprovadoresRevisores.forEach(function(linha){
      var info = fasesPorId[linha.faseId] || {ordem: "", nome: linha.faseId};
      var tr = document.createElement("tr");

      var thFase = document.createElement("th");
      thFase.textContent = "Fase " + info.ordem + " — " + info.nome;
      tr.appendChild(thFase);

      ["aprovador", "revisor"].forEach(function(campo){
        var td = document.createElement("td");
        var input = document.createElement("input");
        input.type = "text";
        input.className = "fase-nao-bloquear";
        input.maxLength = 120;
        input.value = linha[campo] || "";
        input.addEventListener("change", function(){
          linha[campo] = input.value.trim();
          if(onChange) onChange(state);
        });
        td.appendChild(input);
        tr.appendChild(td);
      });

      el.registroTbody.appendChild(tr);
    });
  }

  /* ---------------- Ciclo de vida ---------------- */

  function renderAll(){
    renderCanvas();
    if(onChange) onChange(state);
  }

  function mount(rootEl, initialState, onChangeCb){
    var tpl = document.getElementById("fase0-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    onChange = onChangeCb || null;

    wirePitch();
    wireExcelButtons();
    renderCanvas();
    renderRegistro();
  }

  var MARGEM_X = 40;
  var MARGEM_INFERIOR = 40;
  var GAP_COLUNA = 8;

  function perguntasUnicas(){
    var perguntas = [];
    BLOCOS.forEach(function(b){ if(perguntas.indexOf(b.pergunta) === -1) perguntas.push(b.pergunta); });
    return perguntas;
  }

  function desenharCabecalhosColuna(doc, colunas, y){
    colunas.forEach(function(col){
      doc.setFillColor(220, 226, 238);
      doc.rect(col.x, y, col.largura, 16, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.setTextColor(43, 58, 103);
      doc.text(col.pergunta.toUpperCase(), col.x + 4, y + 11);
    });
  }

  var CELL_PAD = 6;
  var CELL_GAP = 7;

  /* Só mede (sem desenhar) a altura da CÉLULA inteira de um bloco (texto +
     preenchimento em volta) numa coluna de largura `largura` — usada pra
     decidir, ANTES de desenhar, se a linha inteira da grade (o mesmo
     bloco nas 5 colunas) cabe na página atual ou se todas as colunas
     precisam virar de página juntas, e também pra desenhar o retângulo
     de fundo/borda da célula com a altura certa. */
  function medirAlturaBloco(doc, largura, bloco, pmCanvasState){
    var larguraTexto = largura - CELL_PAD * 2 - 4;
    var h = 12; // título do bloco
    var itens = pmCanvasState ? pmCanvasState[bloco.key] : null;
    if(!itens || !itens.length){
      h += 11;
    }else{
      itens.forEach(function(item){
        var linhas = doc.splitTextToSize("• " + (item.texto || ""), larguraTexto);
        h += linhas.length * 9 + 2;
      });
    }
    return h + CELL_PAD * 2;
  }

  /* Desenha o bloco como uma célula de tabela de verdade — fundo +
     borda em volta do texto, não só o texto solto — pra deixar a
     divisão entre blocos evidente mesmo lado a lado na mesma coluna
     (pedido explícito depois de um teste real: "parecia que os blocos
     se misturavam"). Retorna o Y logo depois da célula (já com o
     espaçamento até a próxima). */
  function desenharBlocoColuna(doc, x, y, largura, bloco, pmCanvasState){
    var altura = medirAlturaBloco(doc, largura, bloco, pmCanvasState);

    doc.setFillColor(244, 245, 248);
    doc.rect(x, y, largura, altura, "F");
    doc.setDrawColor(196, 204, 214);
    doc.setLineWidth(0.7);
    doc.rect(x, y, largura, altura);

    var tx = x + CELL_PAD;
    var ty = y + CELL_PAD + 8;
    var larguraTexto = largura - CELL_PAD * 2 - 4;

    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    doc.setTextColor(28, 36, 48);
    doc.text(bloco.titulo, tx, ty);
    ty += 11;

    var itens = pmCanvasState ? pmCanvasState[bloco.key] : null;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    if(!itens || !itens.length){
      doc.setTextColor(150, 158, 168);
      doc.text("—", tx + 2, ty);
    }else{
      doc.setTextColor(60, 68, 80);
      itens.forEach(function(item){
        var linhas = doc.splitTextToSize("• " + (item.texto || ""), larguraTexto);
        doc.text(linhas, tx + 2, ty);
        ty += linhas.length * 9 + 2;
      });
    }

    return y + altura + CELL_GAP;
  }

  /* Grade de 5 colunas (Porquê/O quê/Quem/Como/Quando e Quanto), cada
     bloco alinhado na mesma "linha" nas 5 colunas ao mesmo tempo — mesma
     distribuição de layout da ferramenta de PM Canvas original (print),
     em vez de uma lista linear bloco-por-bloco que desperdiçava a
     largura da página. A quebra de página é sincronizada por linha: se
     o bloco mais alto daquela linha não cabe, as 5 colunas viram de
     página juntas (evita colunas de alturas desencontradas entre
     páginas, mais simples que paginação independente por coluna). */
  function desenharGradeCanvas(doc, pmCanvasState, startY){
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var perguntas = perguntasUnicas();
    var nCols = perguntas.length;
    var larguraColuna = (pageW - MARGEM_X * 2 - GAP_COLUNA * (nCols - 1)) / nCols;

    var colunas = perguntas.map(function(p, i){
      return {
        pergunta: p,
        x: MARGEM_X + i * (larguraColuna + GAP_COLUNA),
        largura: larguraColuna,
        blocos: BLOCOS.filter(function(b){ return b.pergunta === p; })
      };
    });

    var y = startY;
    desenharCabecalhosColuna(doc, colunas, y);
    y += 22;

    var maxLinhas = colunas.reduce(function(max, c){ return Math.max(max, c.blocos.length); }, 0);
    for(var linha = 0; linha < maxLinhas; linha++){
      var alturaLinha = colunas.reduce(function(max, col){
        var b = col.blocos[linha];
        return b ? Math.max(max, medirAlturaBloco(doc, col.largura, b, pmCanvasState)) : max;
      }, 0);

      if(y + alturaLinha > pageH - MARGEM_INFERIOR){
        doc.addPage();
        y = 40;
        desenharCabecalhosColuna(doc, colunas, y);
        y += 22;
      }

      var proximoY = y;
      colunas.forEach(function(col){
        var b = col.blocos[linha];
        if(!b) return;
        var yColuna = desenharBlocoColuna(doc, col.x, y, col.largura, b, pmCanvasState);
        if(yColuna > proximoY) proximoY = yColuna;
      });
      y = proximoY;
    }

    return y;
  }

  /**
   * Desenha o Pitch + a grade do PM Canvas num documento jsPDF já
   * criado — mesmo padrão dos demais módulos. `pmCanvasState` é
   * fase.ferramentas.pmCanvas (não o wrapper com aprovadoresRevisores).
   * Retorna a posição Y final. Assume página em paisagem (ver
   * `calcularPrecisaPaisagem` em fechamento.js — a Fase 0 é sempre
   * paisagem, a grade de 5 colunas não cabe bem em retrato).
   */
  function desenharNoDoc(doc, pmCanvasState, startY){
    var pageW = doc.internal.pageSize.getWidth();
    var y = startY;

    if(pmCanvasState && pmCanvasState.pitch){
      var chk = window.PdfDoc.garantirEspaco(doc, y, 20, MARGEM_INFERIOR);
      y = chk.y;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.setTextColor(43, 58, 103);
      doc.text("PITCH:", MARGEM_X, y);
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5);
      doc.setTextColor(50, 58, 70);
      var pitchLinhas = doc.splitTextToSize(pmCanvasState.pitch, pageW - MARGEM_X - 78);
      doc.text(pitchLinhas, MARGEM_X + 38, y);
      y += Math.max(pitchLinhas.length * 11, 14) + 12;
    }

    return desenharGradeCanvas(doc, pmCanvasState, y);
  }

  /**
   * Devolve {aprovador, revisor} da Fase 0 para uma fase real (1-7) do
   * processo, dado o caso inteiro e o id da fase — usado por
   * fechamento.js e dossie.js pra montar a tabela de assinatura.
   */
  function buscarAprovadorRevisor(caso, faseId){
    var fase0 = (caso.fases || []).filter(function(f){ return f.id === "fase0"; })[0];
    var lista = fase0 && fase0.ferramentas && fase0.ferramentas.aprovadoresRevisores;
    if(!lista) return {aprovador: "", revisor: ""};
    var linha = lista.filter(function(x){ return x.faseId === faseId; })[0];
    return {aprovador: (linha && linha.aprovador) || "", revisor: (linha && linha.revisor) || ""};
  }

  return {
    mount: mount,
    desenharNoDoc: desenharNoDoc,
    buscarAprovadorRevisor: buscarAprovadorRevisor
  };
})();

/* ============================================================
   treinamento-module.js — módulo "Plano de Treinamento por Perfil"
   (Fase 6, Piloto e Gestão de Mudança). Mesmo padrão mount/
   desenharNoDoc dos demais módulos.

   Cada treinamento pode se desdobrar numa lista de participantes
   (nome + CPF), importável via modelo .xlsx, e gerar uma Lista de
   Presença em PDF (Nome/CPF/Assinatura) — o comprovante físico do
   treinamento. Datas usam <input type="date"> nativo (sem máscara
   feita à mão) e o status "No prazo"/"Atrasado" é calculado
   automaticamente a partir da Data de Término; só Pendente/Concluído
   continuam manuais.
   ============================================================ */
window.TreinamentoModule = (function(){
  "use strict";

  var STATUS_MANUAL = [
    {valor:"pendente", label:"Pendente", hex:"#88909B"},
    {valor:"concluido", label:"Concluído", hex:"#1E8E64"}
  ];

  var state = null;
  var el = null;
  var onChange = null;
  var abertos = {}; // ids de treinamento com o bloco de participantes expandido (só UI, não persiste)

  function uid(p){ return (p||"trein") + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function statusEfetivo(item){
    if(item.status === "concluido") return {label:"Concluído", hex:"#1E8E64"};
    var hoje = new Date().toISOString().slice(0,10);
    var atrasado = item.dataTermino && item.dataTermino < hoje;
    return atrasado ? {label:"Atrasado", hex:"#D9432B"} : {label:"No prazo", hex:"#3D5FDB"};
  }

  function dataBr(iso){
    if(!iso) return "";
    var partes = iso.split("-");
    return partes.length === 3 ? (partes[2] + "/" + partes[1] + "/" + partes[0]) : iso;
  }

  function converterDataBrParaISO(str){
    if(!str) return "";
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str.trim());
    return m ? (m[3] + "-" + m[2] + "-" + m[1]) : "";
  }

  /* Migra itens salvos no formato antigo (dataPrevista única, status podia
     ser "atrasado" manual) para o formato novo, sem perder dado existente. */
  function migrarItem(item){
    if(item.dataInicio === undefined){
      item.dataInicio = "";
      item.dataTermino = converterDataBrParaISO(item.dataPrevista);
      item.cargaHoraria = "";
    }
    if(!Array.isArray(item.participantes)) item.participantes = [];
    if(item.status === "atrasado") item.status = "pendente";
  }

  function slug(s){
    return (s||"documento").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") || "documento";
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("treinamento-addInput"),
      addBtn: q("treinamento-addBtn"),
      lista: q("treinamento-lista")
    };
  }

  /* ---------------- Participantes ---------------- */
  function gerarModeloXlsx(){
    try{
      if(typeof ExcelJS === "undefined"){ throw new Error("ExcelJS não carregado"); }
      var wb = new ExcelJS.Workbook();
      var sheet = wb.addWorksheet("Participantes");
      var header = sheet.getRow(1);
      header.getCell(1).value = "Nome";
      header.getCell(2).value = "CPF";
      header.eachCell(function(c){
        c.font = {bold:true, color:{argb:"FFFFFFFF"}};
        c.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF2B3A67"}};
      });
      sheet.addRow(["Fulano da Silva", "000.000.000-00"]);
      sheet.columns = [{width:32},{width:20}];

      wb.xlsx.writeBuffer().then(function(buffer){
        var blob = new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "modelo-lista-presenca.xlsx";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }catch(err){
      console.error(err);
      if(window.AppToast) window.AppToast.show("Não foi possível gerar o modelo.", true);
    }
  }

  function importarParticipantes(file, item){
    var reader = new FileReader();
    reader.onload = function(){
      try{
        if(typeof ExcelJS === "undefined"){ throw new Error("ExcelJS não carregado"); }
        var wb = new ExcelJS.Workbook();
        wb.xlsx.load(reader.result).then(function(){
          var ws = wb.worksheets[0];
          var novos = [];
          ws.eachRow(function(row, rowNumber){
            if(rowNumber === 1) return; // pula cabeçalho
            var nome = String((row.getCell(1).value != null ? row.getCell(1).value : "")).trim();
            var cpf = String((row.getCell(2).value != null ? row.getCell(2).value : "")).trim();
            if(nome) novos.push({id: uid("part"), nome: nome, cpf: cpf});
          });
          item.participantes = item.participantes.concat(novos);
          if(window.AppToast) window.AppToast.show(novos.length + " participante(s) importado(s).");
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

  function gerarListaPresenca(item){
    try{
      if(!window.jspdf || !window.jspdf.jsPDF){ throw new Error("jsPDF não carregado"); }
      if(!item.participantes.length){
        if(window.AppToast) window.AppToast.show("Adicione ao menos um participante antes de gerar a lista.", true);
        return;
      }
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({orientation:"portrait", unit:"pt"});

      doc.setFont("helvetica","bold"); doc.setFontSize(16);
      doc.setTextColor(28,36,48);
      doc.text("Lista de Presença", 40, 42);

      doc.setFont("helvetica","bold"); doc.setFontSize(11);
      doc.text(item.perfil || "", 40, 64);

      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      var y = 80;
      if(item.conteudo){
        var linhas = doc.splitTextToSize(item.conteudo, 500);
        doc.text(linhas, 40, y);
        y += linhas.length * 12 + 4;
      }
      var periodo = "Período: " + (dataBr(item.dataInicio) || "?") + " a " + (dataBr(item.dataTermino) || "?") +
        "   •   Carga horária: " + (item.cargaHoraria || "?") + "h";
      doc.text(periodo, 40, y);
      y += 20;

      doc.autoTable({
        startY: y,
        head: [["Nome","CPF","Assinatura"]],
        body: item.participantes.map(function(p){ return [p.nome||"", p.cpf||"", ""]; }),
        theme: "grid",
        styles:{fontSize:10, cellPadding:8, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
        headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold"},
        columnStyles:{0:{cellWidth:200}, 1:{cellWidth:110}, 2:{cellWidth:190}}
      });

      doc.save("lista-presenca-" + slug(item.perfil) + ".pdf");
      if(window.AppToast) window.AppToast.show("Lista de presença gerada.");
    }catch(err){
      console.error(err);
      if(window.AppToast) window.AppToast.show("Não foi possível gerar a lista de presença.", true);
    }
  }

  function renderParticipantesBloco(item){
    var wrap = document.createElement("div");
    wrap.className = "treinamento-participantes";

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "treinamento-participantes-toggle";
    var aberto = !!abertos[item.id];
    toggle.textContent = (aberto ? "▾ " : "▸ ") + "Participantes (" + item.participantes.length + ")";
    toggle.addEventListener("click", function(){
      abertos[item.id] = !aberto;
      renderAll();
    });
    wrap.appendChild(toggle);

    if(!aberto) return wrap;

    var body = document.createElement("div");
    body.className = "treinamento-participantes-body";

    var addRow = document.createElement("div");
    addRow.className = "treinamento-participantes-add";
    var nomeInput = document.createElement("input");
    nomeInput.placeholder = "Nome";
    nomeInput.maxLength = 120;
    var cpfInput = document.createElement("input");
    cpfInput.placeholder = "CPF";
    cpfInput.maxLength = 20;
    var addBtn = document.createElement("button");
    addBtn.className = "btn btn-secondary";
    addBtn.type = "button";
    addBtn.textContent = "Adicionar";
    addBtn.addEventListener("click", function(){
      var nome = nomeInput.value.trim();
      if(!nome) return;
      item.participantes.push({id: uid("part"), nome: nome, cpf: cpfInput.value.trim()});
      renderAll();
    });
    addRow.appendChild(nomeInput); addRow.appendChild(cpfInput); addRow.appendChild(addBtn);
    body.appendChild(addRow);

    var importRow = document.createElement("div");
    importRow.className = "treinamento-participantes-import";
    var modeloBtn = document.createElement("button");
    modeloBtn.className = "btn btn-ghost";
    modeloBtn.type = "button";
    modeloBtn.textContent = "Baixar modelo (.xlsx)";
    modeloBtn.addEventListener("click", gerarModeloXlsx);
    importRow.appendChild(modeloBtn);

    var importarBtn = document.createElement("button");
    importarBtn.className = "btn btn-ghost";
    importarBtn.type = "button";
    importarBtn.textContent = "Importar lista (.xlsx)";
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".xlsx";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", function(){
      if(fileInput.files && fileInput.files[0]) importarParticipantes(fileInput.files[0], item);
      fileInput.value = "";
    });
    importarBtn.addEventListener("click", function(){ fileInput.click(); });
    importRow.appendChild(importarBtn);
    importRow.appendChild(fileInput);
    body.appendChild(importRow);

    var lista = document.createElement("ul");
    lista.className = "treinamento-participantes-lista";
    if(item.participantes.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum participante ainda.";
      lista.appendChild(vazio);
    } else {
      item.participantes.forEach(function(p){
        var li = document.createElement("li");
        var txt = document.createElement("span");
        txt.className = "txt";
        txt.textContent = p.nome + (p.cpf ? " — " + p.cpf : "");
        li.appendChild(txt);
        var rm = document.createElement("button");
        rm.className = "icon-btn";
        rm.title = "Remover";
        rm.innerHTML = "&times;";
        rm.addEventListener("click", function(){
          item.participantes = item.participantes.filter(function(x){ return x.id !== p.id; });
          renderAll();
        });
        li.appendChild(rm);
        lista.appendChild(li);
      });
    }
    body.appendChild(lista);

    var gerarBtn = document.createElement("button");
    gerarBtn.className = "btn btn-primary";
    gerarBtn.type = "button";
    gerarBtn.textContent = "Gerar lista de presença (PDF)";
    gerarBtn.disabled = item.participantes.length === 0;
    gerarBtn.addEventListener("click", function(){ gerarListaPresenca(item); });
    body.appendChild(gerarBtn);

    wrap.appendChild(body);
    return wrap;
  }

  /* ---------------- Render principal ---------------- */
  function renderLista(){
    el.lista.innerHTML = "";
    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum treinamento ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    state.itens.forEach(function(item){
      var li = document.createElement("li");
      li.className = "treinamento-card";

      var top = document.createElement("div");
      top.className = "treinamento-card-top";

      var perfilInput = document.createElement("input");
      perfilInput.className = "treinamento-field-main";
      perfilInput.placeholder = "Perfil / público-alvo";
      perfilInput.maxLength = 100;
      perfilInput.value = item.perfil || "";
      perfilInput.addEventListener("change", function(){
        item.perfil = perfilInput.value.trim() || item.perfil;
        renderAll();
      });
      top.appendChild(perfilInput);

      var statusGroup = document.createElement("div");
      statusGroup.className = "checklist-status-group";
      STATUS_MANUAL.forEach(function(s){
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
      top.appendChild(statusGroup);

      var efetivo = statusEfetivo(item);
      if(item.status !== "concluido"){
        var badge = document.createElement("span");
        badge.className = "treinamento-auto-badge";
        badge.style.setProperty("--status-hex", efetivo.hex);
        badge.textContent = efetivo.label;
        badge.title = "Calculado automaticamente a partir da Data de Término";
        top.appendChild(badge);
      }

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

      var conteudoInput = document.createElement("input");
      conteudoInput.className = "treinamento-conteudo-field";
      conteudoInput.placeholder = "Conteúdo do treinamento";
      conteudoInput.maxLength = 200;
      conteudoInput.value = item.conteudo || "";
      conteudoInput.addEventListener("change", function(){
        item.conteudo = conteudoInput.value.trim();
        renderAll();
      });
      li.appendChild(conteudoInput);

      var grid = document.createElement("div");
      grid.className = "treinamento-grid";

      var inicioWrap = document.createElement("label");
      inicioWrap.className = "treinamento-date-wrap";
      inicioWrap.innerHTML = "<span>Início</span>";
      var inicioInput = document.createElement("input");
      inicioInput.type = "date";
      inicioInput.value = item.dataInicio || "";
      inicioInput.addEventListener("change", function(){ item.dataInicio = inicioInput.value; renderAll(); });
      inicioWrap.appendChild(inicioInput);
      grid.appendChild(inicioWrap);

      var terminoWrap = document.createElement("label");
      terminoWrap.className = "treinamento-date-wrap";
      terminoWrap.innerHTML = "<span>Término</span>";
      var terminoInput = document.createElement("input");
      terminoInput.type = "date";
      terminoInput.value = item.dataTermino || "";
      terminoInput.addEventListener("change", function(){ item.dataTermino = terminoInput.value; renderAll(); });
      terminoWrap.appendChild(terminoInput);
      grid.appendChild(terminoWrap);

      var cargaWrap = document.createElement("label");
      cargaWrap.className = "treinamento-date-wrap";
      cargaWrap.innerHTML = "<span>Carga horária</span>";
      var cargaInput = document.createElement("input");
      cargaInput.type = "number";
      cargaInput.min = "0";
      cargaInput.step = "0.5";
      cargaInput.placeholder = "h";
      cargaInput.value = item.cargaHoraria || "";
      cargaInput.addEventListener("change", function(){ item.cargaHoraria = cargaInput.value; renderAll(); });
      cargaWrap.appendChild(cargaInput);
      grid.appendChild(cargaWrap);

      var respInput = document.createElement("input");
      respInput.placeholder = "Responsável";
      respInput.maxLength = 140;
      respInput.value = item.responsavel || "";
      respInput.addEventListener("change", function(){ item.responsavel = respInput.value.trim(); renderAll(); });
      grid.appendChild(respInput);

      li.appendChild(grid);
      li.appendChild(renderParticipantesBloco(item));

      el.lista.appendChild(li);
    });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(state);
  }

  function addItem(){
    var perfil = el.addInput.value.trim();
    if(!perfil) return;
    state.itens.push({
      id: uid(), perfil: perfil, conteudo:"", responsavel:"",
      dataInicio:"", dataTermino:"", cargaHoraria:"",
      status:"pendente", participantes: []
    });
    el.addInput.value = "";
    renderAll();
    el.addInput.focus();
  }

  function wireEvents(){
    el.addBtn.addEventListener("click", addItem);
    el.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addItem(); } });
  }

  function mount(rootEl, initialState, onChangeCb){
    var tpl = document.getElementById("treinamento-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    state.itens.forEach(migrarItem);
    onChange = onChangeCb || null;
    wireEvents();
    renderAll();
  }

  /**
   * Desenha o plano de treinamento (resumo) num documento jsPDF já
   * criado, mesmo padrão dos demais módulos. Retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum treinamento registrado no plano.", 40, startY);
      return startY + 16;
    }

    function hexToRgb(hex){
      hex = hex.replace("#","");
      return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
    }

    var head = [["Perfil","Conteúdo","Início","Término","Carga","Status"]];
    var body = docState.itens.map(function(item){
      return [
        item.perfil||"", item.conteudo||"",
        dataBr(item.dataInicio), dataBr(item.dataTermino),
        (item.cargaHoraria ? item.cargaHoraria+"h" : ""),
        statusEfetivo(item).label
      ];
    });

    doc.autoTable({
      startY: startY,
      head: head, body: body,
      theme: "grid",
      rowPageBreak: "avoid",
      styles:{fontSize:9, cellPadding:5, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
      columnStyles:{0:{halign:"left", cellWidth:100}, 1:{halign:"left"}, 5:{halign:"center"}},
      didParseCell:function(data){
        if(data.section === "body" && data.column.index === 5){
          var row = docState.itens[data.row.index];
          var rgb = hexToRgb(statusEfetivo(row).hex);
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

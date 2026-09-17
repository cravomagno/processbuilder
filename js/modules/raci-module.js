/* ============================================================
   RaciModule — módulo "Governança e Compliance" do Construtor de Processos
   Evoluído de matriz-raci-builder-v7.html (linhas 1512–2495).
   Validação, popover, matriz, export PDF/Excel: lógica preservada.
   Mudou: deixou de ser IIFE auto-inicializada e global para virar
   uma factory montável (mount/getState), sem seed genérica própria
   (o estado inicial vem de fora, normalmente o template Controller),
   sem salvar/carregar rascunho próprio (isso subiu para o nível do
   Caso, em caso-state.js), e com o desenho da matriz em PDF exposto
   para reuso no relatório de fechamento de fase (fechamento.js).
   ============================================================ */
window.RaciModule = (function(){
  "use strict";

  /* ---------------- Variant definitions ---------------- */
  var VARIANTS = {
    RACI: {
      label: "RACI",
      types: [
        {code:"R", label:"Responsável", desc:"Executa a atividade", color:"var(--c-r)", hex:"#1E8E64"},
        {code:"A", label:"Aprovador",   desc:"Responde pelo resultado final (único por linha)", color:"var(--c-a)", hex:"#D9432B"},
        {code:"C", label:"Consultado",  desc:"Fornece opinião antes da decisão", color:"var(--c-c)", hex:"#3D5FDB"},
        {code:"I", label:"Informado",   desc:"Recebe o resultado depois de pronto", color:"var(--c-i)", hex:"#A67C3D"}
      ]
    },
    RASCI: {
      label: "RASCI",
      types: [
        {code:"R", label:"Responsável", desc:"Executa a atividade", color:"var(--c-r)", hex:"#1E8E64"},
        {code:"A", label:"Aprovador",   desc:"Responde pelo resultado final (único por linha)", color:"var(--c-a)", hex:"#D9432B"},
        {code:"S", label:"Suporte",     desc:"Apoia operacionalmente quem executa", color:"var(--c-s1)", hex:"#16879A"},
        {code:"C", label:"Consultado",  desc:"Fornece opinião antes da decisão", color:"var(--c-c)", hex:"#3D5FDB"},
        {code:"I", label:"Informado",   desc:"Recebe o resultado depois de pronto", color:"var(--c-i)", hex:"#A67C3D"}
      ]
    },
    RACIVS: {
      label: "RACI-VS",
      types: [
        {code:"R", label:"Responsável", desc:"Executa a atividade", color:"var(--c-r)", hex:"#1E8E64"},
        {code:"A", label:"Aprovador",   desc:"Responde pelo resultado final (único por linha)", color:"var(--c-a)", hex:"#D9432B"},
        {code:"C", label:"Consultado",  desc:"Fornece opinião antes da decisão", color:"var(--c-c)", hex:"#3D5FDB"},
        {code:"I", label:"Informado",   desc:"Recebe o resultado depois de pronto", color:"var(--c-i)", hex:"#A67C3D"},
        {code:"V", label:"Verifica",    desc:"Confere se o trabalho atende aos requisitos", color:"var(--c-v)", hex:"#7A4FB0"},
        {code:"S", label:"Autoriza",    desc:"Formaliza a aprovação final (sign-off)", color:"var(--c-s2)", hex:"#B23A66"}
      ]
    }
  };

  function typesFor(variant){ return VARIANTS[variant].types; }
  function typeDef(variant, code){
    if(!code) return null;
    var list = typesFor(variant);
    for(var i=0;i<list.length;i++){ if(list[i].code===code) return list[i]; }
    return null;
  }

  /* ---------------- State (de closure — só existe uma instância montada por vez) ---------------- */
  var uidCounter = 0;
  function uid(p){ uidCounter++; return p+"_"+uidCounter; }
  function bumpUidCounterFromState(){
    var maxN = 0;
    [state.roles, state.activities].forEach(function(list){
      list.forEach(function(item){
        var m = /_(\d+)$/.exec(item.id || "");
        if(m){ maxN = Math.max(maxN, parseInt(m[1], 10)); }
      });
    });
    if(maxN > uidCounter) uidCounter = maxN;
  }

  var state = null;
  var el = null;
  var onStateChange = null;
  var openPopover = null;
  var toastTimer = null;

  function cellKey(actId, roleId){ return actId+"|"+roleId; }
  function getCell(actId, roleId){ return state.cells[cellKey(actId, roleId)]; }
  function setCell(actId, roleId, code){
    var k = cellKey(actId, roleId);
    if(code){ state.cells[k]=code; } else { delete state.cells[k]; }
  }
  function updateRole(id, field, value){
    state.roles.forEach(function(r){ if(r.id===id) r[field]=value; });
  }
  function updateActivity(id, field, value){
    state.activities.forEach(function(a){ if(a.id===id) a[field]=value; });
  }
  function roleSubtext(role){
    return [role.nome, role.cargo].filter(Boolean).join(" · ");
  }
  function roleLabel(role){
    var sub = roleSubtext(role);
    return sub ? role.area + " — " + sub : role.area;
  }
  function truncate(str, n){
    if(!str) return "";
    return str.length > n ? str.slice(0, n).trim() + "…" : str;
  }
  function hexToRgb(hex){
    hex = hex.replace("#","");
    return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
  }
  function slug(s){
    return (s||"matriz-raci").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") || "matriz-raci";
  }

  /* ---------------- DOM refs ---------------- */
  function buildElRefs(root){
    function q(id){ return root.querySelector("#raci-" + id); }
    return {
      variantSelect: q("variantSelect"),
      progressPct: q("progressPct"),
      progressFill: q("progressFill"),
      rolesList: q("rolesList"),
      activitiesList: q("activitiesList"),
      roleAreaInput: q("roleAreaInput"),
      roleNomeInput: q("roleNomeInput"),
      roleCargoInput: q("roleCargoInput"),
      activityTitleInput: q("activityTitleInput"),
      activityDescInput: q("activityDescInput"),
      addRoleBtn: q("addRoleBtn"),
      addActivityBtn: q("addActivityBtn"),
      resetBtn: q("resetBtn"),
      emptyState: q("emptyState"),
      matrixScroll: q("matrixScroll"),
      matrixTable: q("matrixTable"),
      validationBox: q("validationBox"),
      wheel: q("wheel"),
      legendList: q("legendList"),
      exportPdfBtn: q("exportPdfBtn"),
      exportExcelBtn: q("exportExcelBtn"),
      toast: q("toast")
    };
  }

  /* ---------------- Toast ---------------- */
  function showToast(msg, isError){
    el.toast.textContent = msg;
    el.toast.className = "toast show" + (isError?" error":"");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.toast.className = "toast"; }, 3200);
  }

  /* ---------------- Render: header ---------------- */
  function renderHeader(){
    el.variantSelect.innerHTML = "";
    Object.keys(VARIANTS).forEach(function(key){
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = VARIANTS[key].label;
      if(key === state.variant) opt.selected = true;
      el.variantSelect.appendChild(opt);
    });

    var totalCells = state.roles.length * state.activities.length;
    var filled = Object.keys(state.cells).length;
    var pct = totalCells ? Math.round((filled/totalCells)*100) : 0;
    el.progressPct.textContent = pct + "%";
    el.progressFill.style.width = pct + "%";
  }

  /* ---------------- Render: sidebar lists ---------------- */
  function emptyListItem(container, label){
    var li = document.createElement("li");
    li.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:4px 2px;";
    li.textContent = label;
    container.appendChild(li);
  }

  function renderRolesList(){
    var container = el.rolesList;
    container.innerHTML = "";
    if(state.roles.length===0){ emptyListItem(container, "Nenhum papel ainda."); return; }

    state.roles.forEach(function(role){
      var li = document.createElement("li");
      li.className = "item-row";

      var dot = document.createElement("span");
      dot.className = "role-dot";
      li.appendChild(dot);

      var fields = document.createElement("div");
      fields.className = "role-fields";

      var areaInput = document.createElement("input");
      areaInput.className = "name-input area-field";
      areaInput.placeholder = "Área";
      areaInput.maxLength = 60;
      areaInput.value = role.area;
      areaInput.addEventListener("change", function(){
        updateRole(role.id, "area", areaInput.value.trim() || role.area);
        renderAll();
      });
      fields.appendChild(areaInput);

      var sub = document.createElement("div");
      sub.className = "role-sub-fields";

      var nomeInput = document.createElement("input");
      nomeInput.className = "sub-field";
      nomeInput.placeholder = "Nome";
      nomeInput.maxLength = 60;
      nomeInput.value = role.nome || "";
      nomeInput.addEventListener("change", function(){
        updateRole(role.id, "nome", nomeInput.value.trim());
        renderAll();
      });
      sub.appendChild(nomeInput);

      var cargoInput = document.createElement("input");
      cargoInput.className = "sub-field";
      cargoInput.placeholder = "Cargo";
      cargoInput.maxLength = 60;
      cargoInput.value = role.cargo || "";
      cargoInput.addEventListener("change", function(){
        updateRole(role.id, "cargo", cargoInput.value.trim());
        renderAll();
      });
      sub.appendChild(cargoInput);

      fields.appendChild(sub);
      li.appendChild(fields);

      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        state.roles = state.roles.filter(function(r){ return r.id!==role.id; });
        Object.keys(state.cells).forEach(function(k){ if(k.indexOf("|"+role.id)===k.length-("|"+role.id).length) delete state.cells[k]; });
        renderAll();
      });
      li.appendChild(rm);

      container.appendChild(li);
    });
  }

  function renderActivitiesList(){
    var container = el.activitiesList;
    container.innerHTML = "";
    if(state.activities.length===0){ emptyListItem(container, "Nenhuma atividade ainda."); return; }

    state.activities.forEach(function(act){
      var li = document.createElement("li");
      li.className = "item-row";

      var dot = document.createElement("span");
      dot.className = "role-dot";
      li.appendChild(dot);

      var fields = document.createElement("div");
      fields.className = "activity-fields";

      var titleInput = document.createElement("input");
      titleInput.className = "name-input";
      titleInput.placeholder = "Título da atividade";
      titleInput.maxLength = 50;
      titleInput.value = act.titulo;
      titleInput.addEventListener("change", function(){
        updateActivity(act.id, "titulo", titleInput.value.trim() || act.titulo);
        renderAll();
      });
      fields.appendChild(titleInput);

      var descInput = document.createElement("textarea");
      descInput.className = "desc-field-input";
      descInput.rows = 2;
      descInput.placeholder = "Descrição (opcional)";
      descInput.value = act.descricao || "";
      descInput.addEventListener("change", function(){
        updateActivity(act.id, "descricao", descInput.value.trim());
        renderAll();
      });
      fields.appendChild(descInput);

      li.appendChild(fields);

      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        state.activities = state.activities.filter(function(a){ return a.id!==act.id; });
        Object.keys(state.cells).forEach(function(k){ if(k.indexOf(act.id+"|")===0) delete state.cells[k]; });
        renderAll();
      });
      li.appendChild(rm);

      container.appendChild(li);
    });
  }

  function renderSidebar(){
    renderRolesList();
    renderActivitiesList();
  }

  /* ---------------- Validation ---------------- */
  function computeValidation(){
    var rowIssues = {};
    var errors = [], warnings = [], infos = [];

    state.activities.forEach(function(act){
      var codes = state.roles.map(function(role){ return getCell(act.id, role.id); }).filter(Boolean);
      var countA = codes.filter(function(c){ return c==="A"; }).length;
      var countR = codes.filter(function(c){ return c==="R"; }).length;
      var level = null;

      if(countA===0){
        errors.push({activity:act.titulo, msg:"“"+act.titulo+"” não tem Aprovador (A) definido."});
        level = "error";
      } else if(countA>1){
        errors.push({activity:act.titulo, msg:"“"+act.titulo+"” tem mais de um Aprovador (A) — deve haver apenas um."});
        level = "error";
      }
      if(countR===0){
        warnings.push({activity:act.titulo, msg:"“"+act.titulo+"” não tem nenhum Responsável (R) definido."});
        if(!level) level="warning";
      }
      rowIssues[act.id]=level;
    });

    if(state.roles.length>0 && state.activities.length>0){
      state.roles.forEach(function(role){
        var used = state.activities.some(function(act){ return !!getCell(act.id, role.id); });
        if(!used){
          infos.push({msg:"O papel “"+role.area+"” ainda não foi utilizado na matriz."});
        }
      });
    }

    return {rowIssues:rowIssues, errors:errors, warnings:warnings, infos:infos};
  }

  function renderValidation(v){
    el.validationBox.innerHTML = "";
    var total = v.errors.length + v.warnings.length + v.infos.length;
    if(state.activities.length===0){ return; }

    var h = document.createElement("h3");
    h.textContent = total===0 ? "Nenhuma pendência encontrada" : (total+(total===1?" pendência encontrada":" pendências encontradas"));
    el.validationBox.appendChild(h);

    if(total===0){
      var ok = document.createElement("p");
      ok.className = "val-ok";
      ok.textContent = "Cada atividade tem exatamente um Aprovador e ao menos um Responsável.";
      el.validationBox.appendChild(ok);
      return;
    }

    var ul = document.createElement("ul");
    ul.className = "val-list";
    function addItems(list, level){
      list.forEach(function(item){
        var li = document.createElement("li");
        li.className = "val-item " + level;
        var dot = document.createElement("span");
        dot.className = "dot";
        li.appendChild(dot);
        var span = document.createElement("span");
        span.textContent = item.msg;
        li.appendChild(span);
        ul.appendChild(li);
      });
    }
    addItems(v.errors, "error");
    addItems(v.warnings, "warning");
    addItems(v.infos, "info");
    el.validationBox.appendChild(ul);
  }

  /* ---------------- Popover ---------------- */
  function closePopover(){
    if(openPopover && openPopover.parentNode){ openPopover.parentNode.removeChild(openPopover); }
    openPopover = null;
  }

  function openCellPopover(btn, act, role){
    closePopover();
    var rect = btn.getBoundingClientRect();
    var pop = document.createElement("div");
    pop.className = "cell-popover";

    var title = document.createElement("div");
    title.className = "popover-title";
    title.textContent = act.titulo + " × " + roleLabel(role);
    pop.appendChild(title);

    typesFor(state.variant).forEach(function(t){
      var opt = document.createElement("button");
      opt.className = "popover-option";
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = t.hex;
      dot.textContent = t.code;
      opt.appendChild(dot);
      var txt = document.createElement("span");
      txt.className = "txt";
      var b = document.createElement("b"); b.textContent = t.label;
      var s = document.createElement("span"); s.textContent = t.desc;
      txt.appendChild(b); txt.appendChild(s);
      opt.appendChild(txt);
      opt.addEventListener("click", function(){
        setCell(act.id, role.id, t.code);
        closePopover();
        renderAll();
      });
      pop.appendChild(opt);
    });

    var clear = document.createElement("button");
    clear.className = "popover-clear";
    clear.textContent = "Limpar célula";
    clear.addEventListener("click", function(){
      setCell(act.id, role.id, null);
      closePopover();
      renderAll();
    });
    pop.appendChild(clear);

    document.body.appendChild(pop);
    var popRect = pop.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left;
    if(left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
    if(top + popRect.height > window.innerHeight - 12) top = rect.top - popRect.height - 6;
    pop.style.top = top + "px";
    pop.style.left = Math.max(12,left) + "px";
    openPopover = pop;
  }

  /* ---------------- Render: matrix ---------------- */
  function renderMatrix(v){
    var hasContent = state.roles.length>0 && state.activities.length>0;
    el.emptyState.style.display = hasContent ? "none" : "block";
    el.matrixScroll.style.display = hasContent ? "block" : "none";
    if(!hasContent){ el.matrixTable.innerHTML=""; return; }

    var table = el.matrixTable;
    table.innerHTML = "";

    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "corner";
    corner.textContent = "Atividade";
    trh.appendChild(corner);
    state.roles.forEach(function(role){
      var th = document.createElement("th");
      var primary = document.createElement("div");
      primary.className = "col-primary";
      primary.textContent = role.area;
      th.appendChild(primary);
      var subtext = roleSubtext(role);
      if(subtext){
        var secondary = document.createElement("div");
        secondary.className = "col-secondary";
        secondary.textContent = subtext;
        th.appendChild(secondary);
      }
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    state.activities.forEach(function(act){
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      var titleDiv = document.createElement("div");
      titleDiv.className = "row-primary";
      titleDiv.textContent = act.titulo;
      th.appendChild(titleDiv);
      if(act.descricao){
        var descDiv = document.createElement("div");
        descDiv.className = "row-secondary";
        descDiv.textContent = truncate(act.descricao, 100);
        th.appendChild(descDiv);
      }
      var level = v.rowIssues[act.id];
      if(level==="error") th.className="row-error";
      else if(level==="warning") th.className="row-warning";
      tr.appendChild(th);

      state.roles.forEach(function(role){
        var td = document.createElement("td");
        var btn = document.createElement("button");
        btn.className = "cell-btn";
        var code = getCell(act.id, role.id);
        var t = typeDef(state.variant, code);
        btn.setAttribute("aria-label", act.titulo + " × " + roleLabel(role) + ": " + (t?t.label:"vazio"));
        if(t){
          var badge = document.createElement("span");
          badge.className = "badge";
          badge.style.background = t.hex;
          badge.textContent = t.code;
          btn.appendChild(badge);
        } else {
          var empty = document.createElement("span");
          empty.className = "badge-empty";
          btn.appendChild(empty);
        }
        btn.addEventListener("click", function(){ openCellPopover(btn, act, role); });
        td.appendChild(btn);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  /* ---------------- Render: legend / wheel ---------------- */
  function renderLegend(){
    var types = typesFor(state.variant);
    el.wheel.innerHTML = "";
    var center = document.createElement("div");
    center.className = "wheel-center";
    center.textContent = state.variant;
    el.wheel.appendChild(center);

    var n = types.length, R = 58;
    types.forEach(function(t, i){
      var angle = (Math.PI*2/n)*i - Math.PI/2;
      var x = 75 + R*Math.cos(angle);
      var y = 75 + R*Math.sin(angle);
      var dot = document.createElement("div");
      dot.className = "wheel-dot";
      dot.style.left = x+"px";
      dot.style.top = y+"px";
      dot.style.background = t.hex;
      dot.textContent = t.code;
      el.wheel.appendChild(dot);
    });

    el.legendList.innerHTML = "";
    types.forEach(function(t){
      var entry = document.createElement("div");
      entry.className = "legend-entry";
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = t.hex;
      dot.textContent = t.code;
      entry.appendChild(dot);
      var text = document.createElement("div");
      var b = document.createElement("b"); b.textContent = t.label;
      var p = document.createElement("p"); p.textContent = t.desc;
      text.appendChild(b); text.appendChild(p);
      entry.appendChild(text);
      el.legendList.appendChild(entry);
    });
  }

  /* ---------------- Master render ---------------- */
  function renderAll(){
    renderHeader();
    renderSidebar();
    var v = computeValidation();
    renderMatrix(v);
    renderValidation(v);
    renderLegend();
    var canExport = state.roles.length>0 && state.activities.length>0 && Object.keys(state.cells).length>0;
    el.exportPdfBtn.disabled = !canExport;
    el.exportExcelBtn.disabled = !canExport;
    if(typeof onStateChange === "function"){ onStateChange(state); }
  }

  /* ---------------- Adição/remoção ---------------- */
  function addRole(){
    var area = el.roleAreaInput.value.trim();
    if(!area){ showToast("Informe a área do papel.", true); el.roleAreaInput.focus(); return; }
    state.roles.push({
      id: uid("role"),
      area: area,
      nome: el.roleNomeInput.value.trim(),
      cargo: el.roleCargoInput.value.trim()
    });
    el.roleAreaInput.value = "";
    el.roleNomeInput.value = "";
    el.roleCargoInput.value = "";
    renderAll();
    el.roleAreaInput.focus();
  }
  function addActivity(){
    var titulo = el.activityTitleInput.value.trim();
    if(!titulo){ showToast("Informe um título para a atividade.", true); el.activityTitleInput.focus(); return; }
    state.activities.push({
      id: uid("act"),
      titulo: titulo,
      descricao: el.activityDescInput.value.trim()
    });
    el.activityTitleInput.value = "";
    el.activityDescInput.value = "";
    renderAll();
    el.activityTitleInput.focus();
  }

  /* ---------------- Export: PDF ---------------- */
  function montarCabecalhoPdf(doc, titulo, variantLabel, desc, orientation){
    doc.setFont("helvetica","bold"); doc.setFontSize(17);
    doc.setTextColor(28,36,48);
    doc.text(titulo || "Matriz RACI", 40, 42);

    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.setTextColor(110,116,128);
    var meta = "Variante: " + variantLabel + "   •   Gerado em " + new Date().toLocaleDateString("pt-BR");
    doc.text(meta, 40, 58);

    var startY = 70;
    if(desc){
      var lines = doc.splitTextToSize(desc, orientation==="landscape"?740:500);
      doc.text(lines, 40, 74);
      startY = 74 + lines.length*12 + 8;
    }
    return startY;
  }

  /**
   * Desenha a tabela RACI (autoTable) + legenda dentro de um documento jsPDF já criado.
   * Recebe raciState explicitamente (não lê da closure) para poder ser reaproveitada
   * pelo relatório de fechamento de fase (fechamento.js), que monta seu próprio
   * cabeçalho antes de chamar esta função. Retorna a posição Y final (após a legenda),
   * útil para quem for continuar desenhando no mesmo doc.
   */
  function desenharMatrizNoDoc(doc, raciState, startY){
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var landscape = pageW > pageH;
    var col0Width = landscape ? 190 : 155;

    function cellOf(actId, roleId){ return raciState.cells[actId+"|"+roleId]; }

    var head = [["Atividade"].concat(raciState.roles.map(function(r){
      var subtext = roleSubtext(r);
      return subtext ? r.area + "\n" + subtext : r.area;
    }))];
    var body = raciState.activities.map(function(act){
      var col0 = act.titulo + (act.descricao ? "\n" + act.descricao : "");
      return [col0].concat(raciState.roles.map(function(role){ return cellOf(act.id, role.id) || ""; }));
    });

    doc.autoTable({
      startY:startY,
      head:head, body:body,
      theme:"grid",
      rowPageBreak:"avoid",
      styles:{fontSize:9.5, cellPadding:6, halign:"center", valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", halign:"center", fontSize:9},
      columnStyles:{0:{halign:"left", fillColor:[238,240,244], textColor:[28,36,48], cellWidth:col0Width, fontSize:9}},
      didParseCell:function(data){
        if(data.section==="body" && data.column.index>0){
          var code = data.cell.raw;
          var t = typeDef(raciState.variant, code);
          if(t){
            data.cell.styles.fillColor = hexToRgb(t.hex);
            data.cell.styles.textColor = [255,255,255];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawCell:function(data){
        if(data.section==="body" && data.column.index===0){
          var pad = 6;
          doc.setFillColor(238,240,244);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          var act = raciState.activities[data.row.index];
          if(!act) return;
          var x = data.cell.x + pad;
          var y = data.cell.y + pad + 7;
          var maxW = data.cell.width - pad*2;
          doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(28,36,48);
          var titleLines = doc.splitTextToSize(act.titulo || "", maxW);
          doc.text(titleLines, x, y);
          y += titleLines.length * 11;
          if(act.descricao){
            doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,106,118);
            var descLines = doc.splitTextToSize(act.descricao, maxW);
            doc.text(descLines, x, y);
          }
        }
      }
    });

    var y = doc.lastAutoTable.finalY + 22;
    if(y > pageH - 90){ doc.addPage(); y = 40; }

    doc.setFont("helvetica","bold"); doc.setFontSize(11);
    doc.setTextColor(28,36,48);
    doc.text("Legenda", 40, y);
    y += 16;
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    typesFor(raciState.variant).forEach(function(t){
      if(y > pageH - 30){ doc.addPage(); y = 40; }
      var rgb = hexToRgb(t.hex);
      doc.setFillColor(rgb[0],rgb[1],rgb[2]);
      doc.circle(45, y-3, 4, "F");
      doc.setTextColor(28,36,48);
      doc.text(t.code + " — " + t.label + ": " + t.desc, 58, y);
      y += 15;
    });

    return y;
  }

  function exportPdf(){
    try{
      if(!window.jspdf || !window.jspdf.jsPDF){ throw new Error("jsPDF não carregado"); }
      var jsPDF = window.jspdf.jsPDF;
      var orientation = state.roles.length>4 ? "landscape" : "portrait";
      var doc = new jsPDF({orientation:orientation, unit:"pt"});
      var startY = montarCabecalhoPdf(doc, state.title, VARIANTS[state.variant].label, state.desc, orientation);
      desenharMatrizNoDoc(doc, state, startY);
      doc.save(slug(state.title) + ".pdf");
      showToast("PDF exportado com sucesso.");
    }catch(err){
      console.error(err);
      showToast("Não foi possível exportar o PDF. Tente novamente ou recarregue a página.", true);
    }
  }

  /* ---------------- Export: Excel ---------------- */
  function exportExcel(){
    try{
      if(typeof ExcelJS === "undefined"){ throw new Error("ExcelJS não carregado"); }
      var wb = new ExcelJS.Workbook();
      wb.creator = state.title || "Matriz RACI";
      var sheet = wb.addWorksheet("Matriz");

      var headerRow = sheet.getRow(1);
      var col0Header = headerRow.getCell(1);
      col0Header.value = "Atividade";
      col0Header.font = {bold:true, color:{argb:"FFFFFFFF"}};
      col0Header.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF2B3A67"}};
      col0Header.alignment = {horizontal:"center", vertical:"middle", wrapText:true};

      var headerHasSubtext = state.roles.some(function(r){ return !!roleSubtext(r); });
      state.roles.forEach(function(role, idx){
        var cell = headerRow.getCell(idx+2);
        var subtext = roleSubtext(role);
        if(subtext){
          cell.value = {richText:[
            {text:role.area, font:{bold:true, color:{argb:"FFFFFFFF"}, size:11}},
            {text:"\n"+subtext, font:{bold:false, color:{argb:"FFD7DCEC"}, size:9}}
          ]};
        } else {
          cell.value = role.area;
          cell.font = {bold:true, color:{argb:"FFFFFFFF"}};
        }
        cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF2B3A67"}};
        cell.alignment = {horizontal:"center", vertical:"middle", wrapText:true};
      });
      headerRow.height = headerHasSubtext ? 32 : 18;

      state.activities.forEach(function(act, i){
        var row = sheet.getRow(i+2);
        var col0 = row.getCell(1);
        if(act.descricao){
          col0.value = {richText:[
            {text:act.titulo, font:{bold:true, size:11, color:{argb:"FF1C2430"}}},
            {text:"\n"+act.descricao, font:{bold:false, size:10, color:{argb:"FF5B6472"}}}
          ]};
        } else {
          col0.value = act.titulo;
          col0.font = {bold:true};
        }
        col0.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FFEEF0F4"}};
        col0.alignment = {vertical:"middle", wrapText:true};

        var descLineEstimate = act.descricao ? Math.max(1, Math.ceil(act.descricao.length/30)) : 0;
        row.height = Math.max(20, (1+descLineEstimate)*14);

        state.roles.forEach(function(role, j){
          var code = getCell(act.id, role.id);
          var cell = row.getCell(j+2);
          cell.value = code || "";
          cell.alignment = {horizontal:"center", vertical:"middle"};
          var t = typeDef(state.variant, code);
          if(t){
            cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF"+t.hex.replace("#","")}};
            cell.font = {bold:true, color:{argb:"FFFFFFFF"}};
          }
        });
      });

      sheet.columns.forEach(function(col, idx){ col.width = idx===0 ? 42 : 22; });
      sheet.views = [{state:"frozen", xSplit:1, ySplit:1}];

      var legend = wb.addWorksheet("Legenda");
      legend.addRow(["Código","Significado","Descrição"]);
      legend.getRow(1).font = {bold:true, color:{argb:"FFFFFFFF"}};
      legend.getRow(1).eachCell(function(c){ c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF2B3A67"}}; });
      typesFor(state.variant).forEach(function(t){
        var r = legend.addRow([t.code, t.label, t.desc]);
        r.getCell(1).fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF"+t.hex.replace("#","")}};
        r.getCell(1).font = {bold:true, color:{argb:"FFFFFFFF"}};
        r.getCell(1).alignment = {horizontal:"center"};
      });
      legend.columns = [{width:10},{width:22},{width:55}];

      wb.xlsx.writeBuffer().then(function(buffer){
        var blob = new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = slug(state.title) + ".xlsx";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Excel exportado com sucesso.");
      }).catch(function(err){
        console.error(err);
        showToast("Não foi possível gerar o arquivo Excel.", true);
      });
    }catch(err){
      console.error(err);
      showToast("Não foi possível exportar o Excel. Tente novamente ou recarregue a página.", true);
    }
  }

  /* ---------------- Wire events (uma vez, no mount) ---------------- */
  function wireEvents(root){
    document.addEventListener("click", function(e){
      if(openPopover && !openPopover.contains(e.target) && !e.target.closest(".cell-btn")){
        closePopover();
      }
    });
    document.addEventListener("keydown", function(e){ if(e.key==="Escape") closePopover(); });

    el.variantSelect.addEventListener("change", function(){
      var next = el.variantSelect.value;
      if(next===state.variant) return;
      if(Object.keys(state.cells).length>0){
        var ok = window.confirm("Trocar de variante limpa as atribuições preenchidas na matriz. Continuar?");
        if(!ok){ el.variantSelect.value = state.variant; return; }
        state.cells = {};
      }
      state.variant = next;
      renderAll();
    });

    el.addRoleBtn.addEventListener("click", addRole);
    el.addActivityBtn.addEventListener("click", addActivity);
    [el.roleAreaInput, el.roleNomeInput, el.roleCargoInput].forEach(function(input){
      input.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); addRole(); }});
    });
    el.activityTitleInput.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); addActivity(); }});

    el.resetBtn.addEventListener("click", function(){
      var ok = window.confirm("Isso apaga papéis, atividades e atribuições atuais desta matriz. Deseja continuar?");
      if(!ok) return;
      state.roles = []; state.activities = []; state.cells = {};
      renderAll();
    });

    el.exportPdfBtn.addEventListener("click", exportPdf);
    el.exportExcelBtn.addEventListener("click", exportExcel);
  }

  /* ---------------- API pública ---------------- */
  function mount(rootEl, initialState, onChange){
    var tpl = document.getElementById("raci-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    onStateChange = onChange || null;
    bumpUidCounterFromState();
    wireEvents(rootEl);
    renderAll();
  }

  function getState(){ return state; }

  return {
    mount: mount,
    getState: getState,
    desenharMatrizNoDoc: desenharMatrizNoDoc
  };
})();

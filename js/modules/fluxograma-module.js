/* ============================================================
   fluxograma-module.js — módulo "Fluxograma do Processo" (Fase 3,
   Modelagem do Processo). Mesmo padrão mount/desenharNoDoc dos
   demais módulos, dividindo a fase com o 5W2H.

   Construído do zero (sem biblioteca de terceiros) por decisão
   explícita: a biblioteca padrão de mercado para BPMN 2.0 completo
   (bpmn-js) exige manter uma marca "powered by bpmn.io" fixa em todo
   diagrama, sem opção gratuita de remover. Em troca, este módulo se
   aproxima visualmente do BPMN com RAIAS por papel/área (retroali-
   mentadas da Matriz RACI da Governança), sem adotar a notação
   formal completa (sem pools, sub-processos ou gateways paralelos).

   Suporta **vários fluxos nomeados dentro do mesmo caso** (ex.:
   "Fluxo de Compras", "Fluxo de Devolução") — cada fluxo tem suas
   próprias raias e etapas; uma faixa de abas seleciona qual fluxo
   está sendo editado por vez, pra não empilhar tudo na tela de uma
   vez só.

   O editor é um formulário (lista de raias + lista de etapas), não
   um canvas de arrastar-e-soltar — mesmo espírito de todo módulo já
   construído. O diagrama é uma *função de geometria compartilhada*
   (calcularLayout) desenhada por dois renderizadores independentes:
   SVG na tela e primitivas vetoriais do jsPDF no PDF — mesmo padrão
   já usado no gráfico dos KPIs e na espinha de peixe do Ishikawa.
   ============================================================ */
window.FluxogramaModule = (function(){
  "use strict";

  var TIPOS = [
    {valor:"inicio", label:"Início"},
    {valor:"etapa", label:"Etapa"},
    {valor:"decisao", label:"Decisão"},
    {valor:"fim", label:"Fim"}
  ];

  /* Geometria — mesmas unidades usadas na tela (SVG, sem unidade real)
     e no PDF (pt), sem precisar de conversão entre os dois. */
  var MARGIN = 24, RAIA_LABEL_W = 92, RAIA_H = 100, COL_W = 150;
  var NODE_W = 120, NODE_H = 46, DEC_SIZE = 64, EVT_R = 16;

  var state = null;
  var el = null;
  var onChange = null;
  var raciRef = null;
  var fluxoAtivoId = null;

  function uid(prefixo){ return prefixo + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function tipoLabel(valor){
    var f = TIPOS.filter(function(t){ return t.valor === valor; })[0];
    return f ? f.label : valor;
  }

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
    optPadrao.textContent = (raciRef && raciRef.roles && raciRef.roles.length) ? "— sem vínculo com a RACI —" : "— nenhum papel na Governança ainda —";
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

  /* Migra do formato antigo (um único fluxo direto na raiz, {raias,
     etapas}) para o formato com múltiplos fluxos nomeados — sem
     perder nenhum dado já cadastrado, virando "Fluxo 1". */
  function migrarState(s){
    if(!s.fluxos){
      var raiasAntigas = s.raias || [];
      var etapasAntigas = s.etapas || [];
      s.fluxos = [{id: uid("fluxo"), nome: "Fluxo 1", raias: raiasAntigas, etapas: etapasAntigas}];
      delete s.raias;
      delete s.etapas;
    }
    s.fluxos.forEach(function(f){
      if(!f.raias) f.raias = [];
      if(!f.etapas) f.etapas = [];
    });
  }

  function fluxoAtivo(){
    return state.fluxos.filter(function(f){ return f.id === fluxoAtivoId; })[0] || state.fluxos[0] || null;
  }

  /* ============================================================
     Geometria compartilhada — usada tanto pelo SVG da tela quanto
     pelo desenho vetorial do PDF. Opera sempre em cima de um único
     fluxo (raias/etapas), nunca do state inteiro.
     ============================================================ */
  function calcularLayout(raias, etapas){
    var raiaIndex = {};
    raias.forEach(function(r, i){ raiaIndex[r.id] = i; });
    var nRaias = raias.length;

    var raiasOut = raias.map(function(r, i){
      var y0 = MARGIN + i * RAIA_H;
      return {id: r.id, nome: r.nome || "(sem nome)", y0: y0, yCenter: y0 + RAIA_H/2, h: RAIA_H};
    });

    var ySemRaia = MARGIN + nRaias * RAIA_H;
    var temSemRaia = etapas.some(function(e){ return !raiaIndex.hasOwnProperty(e.raiaId); });

    var etapasOut = etapas.map(function(e, j){
      var idx = raiaIndex.hasOwnProperty(e.raiaId) ? raiaIndex[e.raiaId] : null;
      var cy = idx !== null ? (MARGIN + idx * RAIA_H + RAIA_H/2) : (ySemRaia + RAIA_H/2);
      var cx = MARGIN + RAIA_LABEL_W + COL_W/2 + j * COL_W;
      var evento = e.tipo === "inicio" || e.tipo === "fim";
      var w = e.tipo === "decisao" ? DEC_SIZE : (evento ? EVT_R*2 : NODE_W);
      var h = e.tipo === "decisao" ? DEC_SIZE : (evento ? EVT_R*2 : NODE_H);
      return {id: e.id, titulo: e.titulo || "(sem título)", tipo: e.tipo, cx: cx, cy: cy, w: w, h: h};
    });

    var largura = MARGIN*2 + RAIA_LABEL_W + Math.max(etapas.length, 1) * COL_W;
    var altura = MARGIN*2 + (nRaias + (temSemRaia ? 1 : 0)) * RAIA_H;

    return {raias: raiasOut, etapas: etapasOut, largura: largura, altura: altura, temSemRaia: temSemRaia, ySemRaia: ySemRaia};
  }

  function noPorId(layout, id){ return layout.etapas.filter(function(n){ return n.id === id; })[0] || null; }

  function listarConexoes(etapas, layout){
    var conexoes = [];
    etapas.forEach(function(e){
      var orig = noPorId(layout, e.id);
      if(!orig) return;
      if(e.tipo === "decisao"){
        if(e.ramoSimId){
          var destS = noPorId(layout, e.ramoSimId);
          if(destS) conexoes.push({de: orig, para: destS, rotulo: e.ramoSimRotulo || "Sim"});
        }
        if(e.ramoNaoId){
          var destN = noPorId(layout, e.ramoNaoId);
          if(destN) conexoes.push({de: orig, para: destN, rotulo: e.ramoNaoRotulo || "Não"});
        }
      } else if(e.tipo !== "fim" && e.proximoId){
        var dest = noPorId(layout, e.proximoId);
        if(dest) conexoes.push({de: orig, para: dest, rotulo: null});
      }
    });
    return conexoes;
  }

  /* Caminho ortogonal: sai do centro-direita da origem, cotovelo no
     meio do caminho, entra sempre pelo centro-esquerda do destino —
     por isso a seta final é sempre horizontal, não precisa girar. */
  function caminhoOrtogonal(de, para){
    var p0 = {x: de.cx + de.w/2, y: de.cy};
    var p3 = {x: para.cx - para.w/2, y: para.cy};
    var midX = (p0.x + p3.x) / 2;
    return [p0, {x: midX, y: p0.y}, {x: midX, y: p3.y}, p3];
  }

  function quebrarPorCaracteres(texto, maxChars, maxLinhas){
    var palavras = String(texto || "").split(/\s+/).filter(Boolean);
    var linhas = [], atual = "";
    palavras.forEach(function(p){
      var tentativa = atual ? atual + " " + p : p;
      if(tentativa.length > maxChars && atual){
        linhas.push(atual);
        atual = p;
      } else {
        atual = tentativa;
      }
    });
    if(atual) linhas.push(atual);
    if(linhas.length > maxLinhas){
      linhas = linhas.slice(0, maxLinhas);
      linhas[maxLinhas-1] += "…";
    }
    return linhas.length ? linhas : [""];
  }

  function escapeXml(s){
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ============================================================
     Render SVG (tela) — sempre do fluxo ativo.
     ============================================================ */
  function renderDiagramaSvg(){
    var fluxo = fluxoAtivo();
    var raias = fluxo ? fluxo.raias : [];
    var etapas = fluxo ? fluxo.etapas : [];

    if(raias.length === 0 && etapas.length === 0){
      el.svgWrap.innerHTML = '<p style="font-size:12.5px;color:var(--ink-faint);margin:0;padding:6px 2px;">'+(fluxo ? "Adicione ao menos uma raia e uma etapa para ver o diagrama." : "Adicione um fluxo para começar.")+'</p>';
      return;
    }
    var layout = calcularLayout(raias, etapas);
    var conexoes = listarConexoes(etapas, layout);
    var svg = [];
    svg.push('<svg viewBox="0 0 '+layout.largura+' '+layout.altura+'" class="fluxograma-svg" role="img" aria-label="Fluxograma do processo">');

    layout.raias.forEach(function(r){
      svg.push('<rect x="0" y="'+r.y0+'" width="'+layout.largura+'" height="'+r.h+'" fill="none" stroke="var(--border)" stroke-width="1"/>');
      svg.push('<text x="8" y="'+(r.yCenter+3)+'" font-size="11" font-weight="700" fill="var(--ink-soft)">'+escapeXml(r.nome)+'</text>');
    });
    if(layout.temSemRaia){
      svg.push('<rect x="0" y="'+layout.ySemRaia+'" width="'+layout.largura+'" height="'+RAIA_H+'" fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 3"/>');
      svg.push('<text x="8" y="'+(layout.ySemRaia+RAIA_H/2+3)+'" font-size="11" font-weight="700" fill="var(--ink-faint)">Sem raia</text>');
    }

    conexoes.forEach(function(c){
      var pts = caminhoOrtogonal(c.de, c.para);
      var pontosStr = pts.map(function(p){ return p.x+","+p.y; }).join(" ");
      svg.push('<polyline points="'+pontosStr+'" fill="none" stroke="var(--ink-faint)" stroke-width="1.4"/>');
      var tip = pts[3];
      svg.push('<polygon points="'+(tip.x-9)+','+(tip.y-4)+' '+(tip.x-9)+','+(tip.y+4)+' '+tip.x+','+tip.y+'" fill="var(--ink-faint)"/>');
      if(c.rotulo){
        var midX = pts[1].x, topY = pts[0].y;
        svg.push('<rect x="'+(midX-18)+'" y="'+(topY-17)+'" width="36" height="14" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="0.8"/>');
        svg.push('<text x="'+midX+'" y="'+(topY-7)+'" font-size="9" text-anchor="middle" fill="var(--ink-soft)">'+escapeXml(c.rotulo)+'</text>');
      }
    });

    layout.etapas.forEach(function(n){
      var tituloTag = '<title>'+escapeXml(tipoLabel(n.tipo)+": "+n.titulo)+'</title>';
      if(n.tipo === "inicio" || n.tipo === "fim"){
        svg.push('<circle cx="'+n.cx+'" cy="'+n.cy+'" r="'+(n.w/2)+'" fill="var(--brand-tint)" stroke="var(--brand)" stroke-width="'+(n.tipo === "fim" ? 2.6 : 1.4)+'">'+tituloTag+'</circle>');
        var linhasEvt = quebrarPorCaracteres(n.titulo, 16, 2);
        linhasEvt.forEach(function(linha, i){
          svg.push('<text x="'+n.cx+'" y="'+(n.cy + n.w/2 + 12 + i*11)+'" font-size="9" text-anchor="middle" fill="var(--ink)">'+escapeXml(linha)+'</text>');
        });
      } else if(n.tipo === "decisao"){
        var half = n.w/2;
        var pts = [n.cx+","+(n.cy-half), (n.cx+half)+","+n.cy, n.cx+","+(n.cy+half), (n.cx-half)+","+n.cy].join(" ");
        svg.push('<polygon points="'+pts+'" fill="var(--brand-tint)" stroke="var(--brand)" stroke-width="1.4">'+tituloTag+'</polygon>');
        var linhasDec = quebrarPorCaracteres(n.titulo, 11, 3);
        linhasDec.forEach(function(linha, i){
          var y = n.cy - (linhasDec.length-1)*5.5 + i*11 + 3;
          svg.push('<text x="'+n.cx+'" y="'+y+'" font-size="8.5" text-anchor="middle" fill="var(--ink)">'+escapeXml(linha)+'</text>');
        });
      } else {
        svg.push('<rect x="'+(n.cx-n.w/2)+'" y="'+(n.cy-n.h/2)+'" width="'+n.w+'" height="'+n.h+'" rx="8" fill="var(--brand-tint)" stroke="var(--brand)" stroke-width="1.4">'+tituloTag+'</rect>');
        var linhasEtp = quebrarPorCaracteres(n.titulo, 16, 2);
        linhasEtp.forEach(function(linha, i){
          var y = n.cy - (linhasEtp.length-1)*6 + i*12 + 3;
          svg.push('<text x="'+n.cx+'" y="'+y+'" font-size="9.5" text-anchor="middle" fill="var(--ink)">'+escapeXml(linha)+'</text>');
        });
      }
    });

    svg.push('</svg>');
    el.svgWrap.innerHTML = svg.join("");
  }

  /* ============================================================
     Abas — um fluxo nomeado por vez
     ============================================================ */
  function renderTabs(){
    el.tabs.innerHTML = "";
    state.fluxos.forEach(function(fluxo){
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fluxograma-tab" + (fluxo.id === fluxoAtivoId ? " active" : "");
      btn.textContent = fluxo.nome || "(sem nome)";
      btn.addEventListener("click", function(){ fluxoAtivoId = fluxo.id; renderAll(); });
      el.tabs.appendChild(btn);
    });

    el.fluxoHead.style.display = fluxoAtivo() ? "" : "none";
  }

  function renomearFluxoAtivo(){
    var fluxo = fluxoAtivo();
    if(!fluxo) return;
    var novoNome = window.prompt("Novo nome do fluxo:", fluxo.nome || "");
    if(novoNome === null) return;
    novoNome = novoNome.trim();
    if(!novoNome) return;
    fluxo.nome = novoNome;
    renderAll();
  }

  function addFluxo(){
    var nome = el.novoFluxoInput.value.trim();
    if(!nome) return;
    var novo = {id: uid("fluxo"), nome: nome, raias: [], etapas: []};
    state.fluxos.push(novo);
    fluxoAtivoId = novo.id;
    el.novoFluxoInput.value = "";
    renderAll();
  }

  function removerFluxoAtivo(){
    var ativo = fluxoAtivo();
    if(!ativo) return;
    var ok = window.confirm('Remover o fluxo "' + (ativo.nome || "(sem nome)") + '" e todas as suas raias/etapas? Essa ação não pode ser desfeita.');
    if(!ok) return;
    state.fluxos = state.fluxos.filter(function(f){ return f.id !== ativo.id; });
    fluxoAtivoId = state.fluxos.length ? state.fluxos[0].id : null;
    renderAll();
  }

  /* ============================================================
     Formulário — Raias (sempre do fluxo ativo)
     ============================================================ */
  function renderRaias(){
    var fluxo = fluxoAtivo();
    var raias = fluxo ? fluxo.raias : [];
    el.raiasLista.innerHTML = "";
    if(raias.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = fluxo ? "Nenhuma raia ainda." : "Adicione um fluxo para começar.";
      el.raiasLista.appendChild(vazio);
      return;
    }
    raias.forEach(function(raia, idx){
      var li = document.createElement("li");
      li.className = "riscos-card";

      var top = document.createElement("div");
      top.className = "riscos-card-top";

      var upBtn = document.createElement("button");
      upBtn.className = "icon-btn"; upBtn.title = "Mover para cima"; upBtn.innerHTML = "&uarr;";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", function(){ moverRaia(idx, -1); });
      top.appendChild(upBtn);

      var downBtn = document.createElement("button");
      downBtn.className = "icon-btn"; downBtn.title = "Mover para baixo"; downBtn.innerHTML = "&darr;";
      downBtn.disabled = idx === raias.length - 1;
      downBtn.addEventListener("click", function(){ moverRaia(idx, 1); });
      top.appendChild(downBtn);

      var nomeInput = document.createElement("input");
      nomeInput.className = "riscos-field-main";
      nomeInput.placeholder = "Nome da raia";
      nomeInput.maxLength = 60;
      nomeInput.value = raia.nome || "";
      nomeInput.addEventListener("change", function(){
        raia.nome = nomeInput.value.trim() || raia.nome;
        renderAll();
      });
      top.appendChild(nomeInput);

      var rm = document.createElement("button");
      rm.className = "icon-btn"; rm.title = "Remover"; rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        fluxo.raias = fluxo.raias.filter(function(x){ return x.id !== raia.id; });
        renderAll();
      });
      top.appendChild(rm);
      li.appendChild(top);

      var grid = document.createElement("div");
      grid.className = "fluxograma-grid";
      var papelSelect = document.createElement("select");
      popularSelectPapel(papelSelect, raia.raciRoleId);
      papelSelect.addEventListener("change", function(){
        raia.raciRoleId = papelSelect.value;
        var role = roleById(papelSelect.value);
        if(role){ raia.raciRoleNome = roleLabel(role); raia.nome = raia.nome || roleLabel(role); }
        renderAll();
      });
      grid.appendChild(papelSelect);
      li.appendChild(grid);

      el.raiasLista.appendChild(li);
    });
  }

  function moverRaia(idx, delta){
    var fluxo = fluxoAtivo();
    if(!fluxo) return;
    var novoIdx = idx + delta;
    if(novoIdx < 0 || novoIdx >= fluxo.raias.length) return;
    var tmp = fluxo.raias[idx];
    fluxo.raias[idx] = fluxo.raias[novoIdx];
    fluxo.raias[novoIdx] = tmp;
    renderAll();
  }

  function addRaia(){
    var fluxo = fluxoAtivo();
    if(!fluxo) return;
    var nome = el.raiaNomeInput.value.trim();
    if(!nome) return;
    fluxo.raias.push({id: uid("raia"), nome: nome, raciRoleId: "", raciRoleNome: ""});
    el.raiaNomeInput.value = "";
    renderAll();
    el.raiaNomeInput.focus();
  }

  /* ============================================================
     Formulário — Etapas (sempre do fluxo ativo)
     ============================================================ */
  function popularSelectEtapa(select, valorAtual, excluirId){
    var fluxo = fluxoAtivo();
    var etapas = fluxo ? fluxo.etapas : [];
    select.innerHTML = "";
    var optPadrao = document.createElement("option");
    optPadrao.value = "";
    optPadrao.textContent = "— escolher —";
    select.appendChild(optPadrao);
    etapas.forEach(function(e){
      if(e.id === excluirId) return;
      var opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.titulo || "(sem título)";
      if(valorAtual === e.id) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function popularSelectRaia(select, valorAtual){
    var fluxo = fluxoAtivo();
    var raias = fluxo ? fluxo.raias : [];
    select.innerHTML = "";
    var optPadrao = document.createElement("option");
    optPadrao.value = "";
    optPadrao.textContent = raias.length ? "— escolher raia —" : "— nenhuma raia ainda —";
    select.appendChild(optPadrao);
    raias.forEach(function(r){
      var opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.nome || "(sem nome)";
      if(valorAtual === r.id) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function renderEtapas(){
    var fluxo = fluxoAtivo();
    var etapas = fluxo ? fluxo.etapas : [];
    el.etapasLista.innerHTML = "";
    if(etapas.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = fluxo ? "Nenhuma etapa ainda." : "Adicione um fluxo para começar.";
      el.etapasLista.appendChild(vazio);
      return;
    }
    etapas.forEach(function(etapa, idx){
      var li = document.createElement("li");
      li.className = "riscos-card";

      var top = document.createElement("div");
      top.className = "riscos-card-top";

      var upBtn = document.createElement("button");
      upBtn.className = "icon-btn"; upBtn.title = "Mover para cima"; upBtn.innerHTML = "&uarr;";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", function(){ moverEtapa(idx, -1); });
      top.appendChild(upBtn);

      var downBtn = document.createElement("button");
      downBtn.className = "icon-btn"; downBtn.title = "Mover para baixo"; downBtn.innerHTML = "&darr;";
      downBtn.disabled = idx === etapas.length - 1;
      downBtn.addEventListener("click", function(){ moverEtapa(idx, 1); });
      top.appendChild(downBtn);

      var tituloInput = document.createElement("input");
      tituloInput.className = "riscos-field-main";
      tituloInput.placeholder = "Título da etapa";
      tituloInput.maxLength = 100;
      tituloInput.value = etapa.titulo || "";
      tituloInput.addEventListener("change", function(){
        etapa.titulo = tituloInput.value.trim() || etapa.titulo;
        renderAll();
      });
      top.appendChild(tituloInput);

      var rm = document.createElement("button");
      rm.className = "icon-btn"; rm.title = "Remover"; rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        fluxo.etapas = fluxo.etapas.filter(function(x){ return x.id !== etapa.id; });
        renderAll();
      });
      top.appendChild(rm);
      li.appendChild(top);

      var grid = document.createElement("div");
      grid.className = "fluxograma-grid";

      var tipoSelect = document.createElement("select");
      TIPOS.forEach(function(t){
        var opt = document.createElement("option");
        opt.value = t.valor; opt.textContent = t.label;
        if(etapa.tipo === t.valor) opt.selected = true;
        tipoSelect.appendChild(opt);
      });
      tipoSelect.addEventListener("change", function(){
        etapa.tipo = tipoSelect.value;
        renderAll();
      });
      grid.appendChild(tipoSelect);

      var raiaSelect = document.createElement("select");
      popularSelectRaia(raiaSelect, etapa.raiaId);
      raiaSelect.addEventListener("change", function(){ etapa.raiaId = raiaSelect.value; renderAll(); });
      grid.appendChild(raiaSelect);

      if(etapa.tipo === "decisao"){
        var simSelect = document.createElement("select");
        popularSelectEtapa(simSelect, etapa.ramoSimId, etapa.id);
        simSelect.addEventListener("change", function(){ etapa.ramoSimId = simSelect.value; renderAll(); });
        grid.appendChild(simSelect);

        var simRotulo = document.createElement("input");
        simRotulo.placeholder = "Rótulo (ex.: Sim)";
        simRotulo.maxLength = 20;
        simRotulo.value = etapa.ramoSimRotulo || "";
        simRotulo.addEventListener("change", function(){ etapa.ramoSimRotulo = simRotulo.value.trim(); renderAll(); });
        grid.appendChild(simRotulo);

        var naoSelect = document.createElement("select");
        popularSelectEtapa(naoSelect, etapa.ramoNaoId, etapa.id);
        naoSelect.addEventListener("change", function(){ etapa.ramoNaoId = naoSelect.value; renderAll(); });
        grid.appendChild(naoSelect);

        var naoRotulo = document.createElement("input");
        naoRotulo.placeholder = "Rótulo (ex.: Não)";
        naoRotulo.maxLength = 20;
        naoRotulo.value = etapa.ramoNaoRotulo || "";
        naoRotulo.addEventListener("change", function(){ etapa.ramoNaoRotulo = naoRotulo.value.trim(); renderAll(); });
        grid.appendChild(naoRotulo);
      } else if(etapa.tipo !== "fim"){
        var proximoSelect = document.createElement("select");
        popularSelectEtapa(proximoSelect, etapa.proximoId, etapa.id);
        proximoSelect.addEventListener("change", function(){ etapa.proximoId = proximoSelect.value; renderAll(); });
        grid.appendChild(proximoSelect);
      }

      li.appendChild(grid);
      el.etapasLista.appendChild(li);
    });
  }

  function moverEtapa(idx, delta){
    var fluxo = fluxoAtivo();
    if(!fluxo) return;
    var novoIdx = idx + delta;
    if(novoIdx < 0 || novoIdx >= fluxo.etapas.length) return;
    var tmp = fluxo.etapas[idx];
    fluxo.etapas[idx] = fluxo.etapas[novoIdx];
    fluxo.etapas[novoIdx] = tmp;
    renderAll();
  }

  function addEtapa(){
    var fluxo = fluxoAtivo();
    if(!fluxo) return;
    var titulo = el.etapaTituloInput.value.trim();
    if(!titulo) return;
    fluxo.etapas.push({
      id: uid("etapa"), titulo: titulo, tipo: "etapa", raiaId: "",
      proximoId: "", ramoSimId: "", ramoSimRotulo: "", ramoNaoId: "", ramoNaoRotulo: ""
    });
    el.etapaTituloInput.value = "";
    renderAll();
    el.etapaTituloInput.focus();
  }

  /* ============================================================
     Ciclo de vida do módulo
     ============================================================ */
  function renderAll(){
    renderTabs();
    renderRaias();
    renderEtapas();
    renderDiagramaSvg();
    if(onChange) onChange(state);
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      tabs: q("fluxo-tabs"),
      novoFluxoInput: q("fluxo-novoFluxoInput"),
      novoFluxoBtn: q("fluxo-novoFluxoBtn"),
      fluxoHead: q("fluxo-head"),
      renomearFluxoBtn: q("fluxo-renomearFluxoBtn"),
      removerFluxoBtn: q("fluxo-removerFluxoBtn"),
      raiaNomeInput: q("fluxo-raiaNomeInput"),
      raiaAddBtn: q("fluxo-raiaAddBtn"),
      raiasLista: q("fluxo-raiasLista"),
      etapaTituloInput: q("fluxo-etapaTituloInput"),
      etapaAddBtn: q("fluxo-etapaAddBtn"),
      etapasLista: q("fluxo-etapasLista"),
      svgWrap: q("fluxo-svgWrap")
    };
  }

  function wireEvents(){
    el.novoFluxoBtn.addEventListener("click", addFluxo);
    el.novoFluxoInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addFluxo(); } });
    el.renomearFluxoBtn.addEventListener("click", renomearFluxoAtivo);
    el.removerFluxoBtn.addEventListener("click", removerFluxoAtivo);
    el.raiaAddBtn.addEventListener("click", addRaia);
    el.raiaNomeInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addRaia(); } });
    el.etapaAddBtn.addEventListener("click", addEtapa);
    el.etapaTituloInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addEtapa(); } });
  }

  function mount(rootEl, initialState, onChangeCb, raciStateRef){
    var tpl = document.getElementById("fluxograma-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    el = buildElRefs(rootEl);
    state = initialState;
    migrarState(state);
    onChange = onChangeCb || null;
    raciRef = raciStateRef || null;
    fluxoAtivoId = state.fluxos.length ? state.fluxos[0].id : null;

    wireEvents();
    renderAll();
  }

  /* ============================================================
     PDF — mesma geometria (calcularLayout), primitivas vetoriais do
     jsPDF (sem imagem/canvas), com escala automática se o fluxo for
     mais largo que a página disponível. Um bloco por fluxo nomeado,
     com divisor entre eles quando há mais de um (mesmo padrão do
     Diagrama de Ishikawa para vários diagramas).
     ============================================================ */
  function desenharUmFluxo(doc, raias, etapas, startY){
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var disponivel = pageW - 80;

    if(!etapas || etapas.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhuma etapa registrada neste fluxo.", 40, startY);
      return startY + 16;
    }

    var layout = calcularLayout(raias, etapas);
    var conexoes = listarConexoes(etapas, layout);
    var escala = Math.min(1, disponivel / layout.largura);

    if(startY + layout.altura*escala > pageH - 40){ doc.addPage(); startY = 40; }
    var offY = startY;

    function px(x){ return 40 + x*escala; }
    function py(y){ return offY + y*escala; }

    layout.raias.forEach(function(r){
      doc.setDrawColor(218,223,230); doc.setLineWidth(0.6);
      doc.rect(px(0), py(r.y0), layout.largura*escala, r.h*escala);
      doc.setFont("helvetica","bold"); doc.setFontSize(8.5*Math.max(escala,0.75));
      doc.setTextColor(100,108,122);
      doc.text(r.nome, px(6), py(r.yCenter)+3);
    });
    if(layout.temSemRaia){
      doc.setDrawColor(218,223,230); doc.setLineWidth(0.6);
      doc.rect(px(0), py(layout.ySemRaia), layout.largura*escala, RAIA_H*escala);
      doc.setFont("helvetica","bold"); doc.setFontSize(8.5*Math.max(escala,0.75));
      doc.setTextColor(140,148,160);
      doc.text("Sem raia", px(6), py(layout.ySemRaia+RAIA_H/2)+3);
    }

    conexoes.forEach(function(c){
      var pts = caminhoOrtogonal(c.de, c.para).map(function(p){ return {x: px(p.x), y: py(p.y)}; });
      doc.setDrawColor(120,128,140); doc.setLineWidth(1);
      for(var i=0; i<pts.length-1; i++){ doc.line(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y); }
      var tip = pts[3];
      doc.setFillColor(120,128,140);
      doc.triangle(tip.x-8, tip.y-4, tip.x-8, tip.y+4, tip.x, tip.y, "F");
      if(c.rotulo){
        doc.setFont("helvetica","normal"); doc.setFontSize(7.5*Math.max(escala,0.75));
        doc.setTextColor(80,88,100);
        doc.text(c.rotulo, pts[1].x, pts[0].y - 5, {align:"center"});
      }
    });

    layout.etapas.forEach(function(n){
      var cx = px(n.cx), cy = py(n.cy), w = n.w*escala, h = n.h*escala;
      doc.setFillColor(225,229,240);
      doc.setDrawColor(43,58,103);
      doc.setLineWidth(n.tipo === "fim" ? 1.6 : 1.1);

      if(n.tipo === "inicio" || n.tipo === "fim"){
        doc.circle(cx, cy, w/2, "FD");
        doc.setFont("helvetica","normal"); doc.setFontSize(8*Math.max(escala,0.75));
        doc.setTextColor(28,36,48);
        var linhasEvt = quebrarPorCaracteres(n.titulo, 16, 2);
        doc.text(linhasEvt, cx, cy + w/2 + 12, {align:"center"});
      } else if(n.tipo === "decisao"){
        var half = w/2;
        doc.triangle(cx-half, cy, cx+half, cy, cx, cy-half, "FD");
        doc.triangle(cx-half, cy, cx+half, cy, cx, cy+half, "FD");
        doc.setFont("helvetica","normal"); doc.setFontSize(7.5*Math.max(escala,0.75));
        doc.setTextColor(28,36,48);
        var linhasDec = quebrarPorCaracteres(n.titulo, 11, 3);
        doc.text(linhasDec, cx, cy - (linhasDec.length-1)*4.5 + 3, {align:"center"});
      } else {
        doc.roundedRect(cx-w/2, cy-h/2, w, h, 4, 4, "FD");
        doc.setFont("helvetica","normal"); doc.setFontSize(8.5*Math.max(escala,0.75));
        doc.setTextColor(28,36,48);
        var linhasEtp = quebrarPorCaracteres(n.titulo, 16, 2);
        doc.text(linhasEtp, cx, cy - (linhasEtp.length-1)*5 + 3, {align:"center"});
      }
    });

    return offY + layout.altura*escala + 12;
  }

  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();
    var pageW = doc.internal.pageSize.getWidth();
    var y = startY;

    if(!docState.fluxos || docState.fluxos.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum fluxo registrado.", 40, y);
      return y + 16;
    }

    docState.fluxos.forEach(function(fluxo, idx){
      if(idx > 0){
        y += 10;
        if(y > pageH - 100){ doc.addPage(); y = 40; }
        doc.setDrawColor(218,223,230); doc.setLineWidth(0.8);
        doc.line(40, y, pageW - 40, y);
        y += 16;
      }
      if(y > pageH - 100){ doc.addPage(); y = 40; }

      doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
      doc.setTextColor(28,36,48);
      doc.text("Fluxo: " + (fluxo.nome || "(sem nome)"), 40, y);
      y += 16;

      y = desenharUmFluxo(doc, fluxo.raias || [], fluxo.etapas || [], y);
    });

    return y;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

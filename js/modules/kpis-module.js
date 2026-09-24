/* ============================================================
   kpis-module.js — módulo "KPIs / Indicadores" (Fase 7, Implantação
   e Estabelecimento). Mesmo padrão mount/desenharNoDoc dos demais
   módulos. Convive com o ChecklistModule na mesma fase.

   Cada indicador acumula um HISTÓRICO de leituras (data + valor) em
   vez de um único "valor atual" solto — "valor atual" é sempre a
   leitura mais recente, pra nunca ficar dessincronizado. Tem uma
   Periodicidade esperada (informativa, sem automação de lembrete) e
   um "Válido até" opcional: passada essa data, o indicador ganha uma
   etiqueta "Expirado" (só aviso visual, não bloqueia nada) — sinal
   de que é hora de substituir por um indicador mais completo.
   ============================================================ */
window.KpisModule = (function(){
  "use strict";

  var DIRECOES = [
    {valor:"maior_melhor", label:"Quanto maior, melhor"},
    {valor:"menor_melhor", label:"Quanto menor, melhor"}
  ];
  var PERIODICIDADES = [
    {valor:"", label:"Periodicidade..."},
    {valor:"diaria", label:"Diária"},
    {valor:"semanal", label:"Semanal"},
    {valor:"quinzenal", label:"Quinzenal"},
    {valor:"mensal", label:"Mensal"}
  ];
  var LEITURAS_VISIVEIS = 5;

  var state = null;
  var el = null;
  var onChange = null;
  var historicoAberto = {}; // ids de indicador com "ver histórico completo" expandido (só UI, não persiste)

  function uid(p){ return (p||"kpi") + "_" + Date.now() + "_" + Math.floor(Math.random()*10000); }
  function hoje(){ return new Date().toISOString().slice(0,10); }

  function ultimaLeitura(item){
    if(!item.historico.length) return null;
    return item.historico.slice().sort(function(a,b){ return a.data < b.data ? 1 : -1; })[0];
  }

  function metaStatus(item){
    var ultima = ultimaLeitura(item);
    var meta = parseFloat(item.meta);
    if(!ultima || isNaN(meta) || isNaN(parseFloat(ultima.valor))) return {label:"Sem dados", hex:"#88909B"};
    var valor = parseFloat(ultima.valor);
    var atingiu = item.direcao === "menor_melhor" ? (valor <= meta) : (valor >= meta);
    return atingiu ? {label:"Dentro da meta", hex:"#1E8E64"} : {label:"Fora da meta", hex:"#D9432B"};
  }

  function expirado(item){
    return !!(item.validoAte && item.validoAte < hoje());
  }

  function dataBr(iso){
    if(!iso) return "";
    var p = iso.split("-");
    return p.length === 3 ? (p[2]+"/"+p[1]+"/"+p[0]) : iso;
  }

  function escapeXml(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];
    });
  }

  function periodicidadeLabel(valor){
    if(!valor) return "";
    var found = PERIODICIDADES.filter(function(p){ return p.valor === valor; })[0];
    return found ? found.label : "";
  }

  /* Cores literais (mesmas do tema, mas hex fixo — o <canvas> usado pra
     gerar a imagem do PDF não enxerga variáveis CSS). */
  var BRAND_HEX = "#2B3A67";
  var INK_FAINT_HEX = "#88909B";
  var SURFACE_HEX = "#FFFFFF";

  /**
   * Geometria compartilhada do gráfico de tendência — usada tanto pelo
   * SVG em tela (renderGraficoBloco) quanto pelo <canvas> que vira
   * imagem no PDF (gerarImagemGraficoPNG), pra desenhar exatamente a
   * mesma coisa nos dois lugares.
   */
  function calcularGeometria(item, opts){
    opts = opts || {};
    var pontos = item.historico.slice()
      .sort(function(a,b){ return a.data < b.data ? -1 : 1; })
      .map(function(l){ return {data:l.data, valor: parseFloat(l.valor)}; })
      .filter(function(p){ return !isNaN(p.valor); });

    var meta = parseFloat(item.meta);
    var temMeta = !isNaN(meta);
    /* W/H/padding aceitam override — a tela (renderGraficoBloco) usa os
       valores padrão de sempre; o PDF (gerarImagemGraficoPNG) pede um
       gráfico maior com mais respiro embaixo/em cima pra caber datas no
       eixo X e rótulo nos pontos-chave, sem mudar o gráfico em tela. */
    var W = opts.W || 220, H = opts.H || 100;
    var padL = opts.padL != null ? opts.padL : 8;
    var padR = opts.padR != null ? opts.padR : 8;
    var padT = opts.padT != null ? opts.padT : 10;
    var padB = opts.padB != null ? opts.padB : 20;
    var plotW = W - padL - padR, plotH = H - padT - padB, plotBottom = H - padB;

    if(pontos.length === 0){
      return {pontos: pontos, temMeta: temMeta, meta: meta, W:W, H:H, padL:padL, padR:padR, padT:padT, padB:padB, plotW:plotW, plotBottom:plotBottom};
    }

    var valores = pontos.map(function(p){ return p.valor; });
    if(temMeta) valores = valores.concat([meta]);
    var vmin = Math.min.apply(null, valores), vmax = Math.max.apply(null, valores);
    var range = (vmax - vmin) || Math.abs(vmax) || 1;
    vmin -= range * 0.12; vmax += range * 0.12;

    function xAt(i){ return pontos.length > 1 ? padL + (i/(pontos.length-1)) * plotW : padL + plotW/2; }
    function yAt(v){ return plotBottom - ((v - vmin)/(vmax - vmin)) * plotH; }

    return {pontos:pontos, temMeta:temMeta, meta:meta, W:W, H:H, padL:padL, padR:padR, padT:padT, padB:padB, plotW:plotW, plotBottom:plotBottom, xAt:xAt, yAt:yAt};
  }

  /**
   * Gráfico de linha compacto (SVG) com a tendência das leituras e uma
   * linha de referência tracejada na Meta. Só o ponto mais recente é
   * destacado, na cor do status atual (mesma cor da etiqueta acima do
   * formulário) — os demais ficam discretos, formando o traçado.
   * A lista "Ver histórico completo" já cumpre o papel de tabela
   * acessível dos mesmos dados.
   */
  function renderGraficoBloco(item){
    var wrap = document.createElement("div");
    wrap.className = "kpis-chart-col";

    var titulo = document.createElement("p");
    titulo.className = "kpis-chart-titulo";
    titulo.textContent = "Tendência";
    wrap.appendChild(titulo);

    var geo = calcularGeometria(item);
    if(geo.pontos.length === 0){
      var vazio = document.createElement("div");
      vazio.className = "kpis-chart-vazio";
      vazio.textContent = "Sem leituras ainda";
      wrap.appendChild(vazio);
      return wrap;
    }

    var svg = [];
    svg.push('<svg viewBox="0 0 '+geo.W+' '+geo.H+'" class="kpis-chart-svg" role="img" aria-label="Tendência de '+escapeXml(item.indicador||"indicador")+', '+geo.pontos.length+' leitura(s)">');

    if(geo.temMeta){
      var my = geo.yAt(geo.meta).toFixed(1);
      svg.push('<line x1="'+geo.padL+'" y1="'+my+'" x2="'+(geo.padL+geo.plotW)+'" y2="'+my+'" stroke="var(--ink-faint)" stroke-width="1" stroke-dasharray="3 3"/>');
      svg.push('<text x="'+(geo.padL+geo.plotW)+'" y="'+(parseFloat(my)-4)+'" text-anchor="end" font-size="8" fill="var(--ink-faint)">Meta '+escapeXml(item.meta)+(item.unidade?(' '+escapeXml(item.unidade)):'')+'</text>');
    }

    if(geo.pontos.length > 1){
      var pts = geo.pontos.map(function(p,i){ return geo.xAt(i).toFixed(1)+','+geo.yAt(p.valor).toFixed(1); }).join(' ');
      svg.push('<polyline points="'+pts+'" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
    }

    geo.pontos.forEach(function(p, i){
      var isLast = i === geo.pontos.length - 1;
      var cx = geo.xAt(i).toFixed(1), cy = geo.yAt(p.valor).toFixed(1);
      var tituloTxt = escapeXml(dataBr(p.data) + ": " + p.valor + (item.unidade ? " "+item.unidade : ""));
      if(isLast){
        svg.push('<circle cx="'+cx+'" cy="'+cy+'" r="5" fill="'+metaStatus(item).hex+'" stroke="var(--surface)" stroke-width="2"><title>'+tituloTxt+'</title></circle>');
      } else {
        svg.push('<circle cx="'+cx+'" cy="'+cy+'" r="2.8" fill="var(--brand)"><title>'+tituloTxt+'</title></circle>');
      }
    });

    svg.push('</svg>');

    var svgHolder = document.createElement("div");
    svgHolder.innerHTML = svg.join('');
    wrap.appendChild(svgHolder.firstChild);
    return wrap;
  }

  /**
   * Mesmo gráfico, desenhado num <canvas> fora da tela e exportado como
   * PNG (data URL) — é o que entra no PDF de fechamento via
   * doc.addImage(), já que jsPDF não lê SVG diretamente. Desenhado em
   * escala 3x pra sair nítido mesmo impresso. Retorna null se não há
   * nenhuma leitura numérica ainda.
   */
  function dataBrCurta(iso){
    if(!iso) return "";
    var p = iso.split("-");
    return p.length === 3 ? (p[2]+"/"+p[1]) : iso;
  }

  /* Índices dos pontos que ganham data no eixo X — no máximo 4, sempre
     incluindo o primeiro e o último, espaçados uniformemente entre eles.
     Rotular todo ponto (podem ser 10-15 leituras) apertaria demais e
     sobrepunha texto; poucos pontos-chave bem espaçados dão a noção do
     período coberto sem esse risco. */
  function indicesEixoX(n){
    if(n <= 1) return [0];
    if(n <= 4) { var todos = []; for(var i=0;i<n;i++) todos.push(i); return todos; }
    var idx = [0, Math.round((n-1)/3), Math.round((n-1)*2/3), n-1];
    return idx.filter(function(v, i){ return idx.indexOf(v) === i; }); // remove duplicata se o arredondamento colidir
  }

  function gerarImagemGraficoPNG(item, opts){
    var geo = calcularGeometria(item, opts);
    if(geo.pontos.length === 0) return null;

    var escala = 3;
    var canvas = document.createElement("canvas");
    canvas.width = geo.W * escala;
    canvas.height = geo.H * escala;
    var ctx = canvas.getContext("2d");
    ctx.scale(escala, escala);
    ctx.fillStyle = SURFACE_HEX;
    ctx.fillRect(0, 0, geo.W, geo.H);

    var my = null;
    if(geo.temMeta){
      my = geo.yAt(geo.meta);
      ctx.save();
      ctx.strokeStyle = INK_FAINT_HEX;
      ctx.lineWidth = 1;
      ctx.setLineDash([3,3]);
      ctx.beginPath();
      ctx.moveTo(geo.padL, my);
      ctx.lineTo(geo.padL + geo.plotW, my);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = INK_FAINT_HEX;
      ctx.font = "8px Helvetica, Arial, sans-serif";
      /* Rótulo da meta no lado ESQUERDO da linha (não mais no direito) —
         de propósito: o ponto mais recente também fica no extremo
         direito do gráfico e também ganha um rótulo de valor agora;
         deixar os dois no mesmo canto competindo pelo mesmo espaço era
         exatamente o tipo de sobreposição que este pedido veio evitar. */
      ctx.textAlign = "left";
      ctx.fillText("Meta " + item.meta + (item.unidade ? (" "+item.unidade) : ""), geo.padL, my - 4);
    }

    if(geo.pontos.length > 1){
      ctx.strokeStyle = BRAND_HEX;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      geo.pontos.forEach(function(p, i){
        var x = geo.xAt(i), y = geo.yAt(p.valor);
        if(i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }

    /* Datas no eixo X — só nos índices selecionados (ver indicesEixoX),
       um tracinho + a data curta (DD/MM) logo abaixo do eixo. */
    if(opts && opts.rotulosEixoX){
      ctx.fillStyle = INK_FAINT_HEX;
      ctx.strokeStyle = INK_FAINT_HEX;
      ctx.font = "7px Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      indicesEixoX(geo.pontos.length).forEach(function(i){
        var x = geo.xAt(i);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, geo.plotBottom);
        ctx.lineTo(x, geo.plotBottom + 3);
        ctx.stroke();
        ctx.fillText(dataBrCurta(geo.pontos[i].data), x, geo.plotBottom + 13);
      });
    }

    geo.pontos.forEach(function(p, i){
      var isLast = i === geo.pontos.length - 1;
      var x = geo.xAt(i), y = geo.yAt(p.valor);
      ctx.beginPath();
      ctx.arc(x, y, isLast ? 5 : 2.8, 0, Math.PI*2);
      ctx.fillStyle = isLast ? metaStatus(item).hex : BRAND_HEX;
      ctx.fill();
      if(isLast){
        ctx.lineWidth = 2;
        ctx.strokeStyle = SURFACE_HEX;
        ctx.stroke();
      }
    });

    /* Rótulo de valor só no primeiro e no último ponto (o mais recente)
       — os "elementos a mais" pedidos, sem rotular ponto a ponto (com
       10-15 leituras isso sobrepõe garantido). Pulado quando não cabe
       (perto demais da borda de cima) em vez de forçar uma posição
       ruim. */
    if(opts && opts.rotulosValor){
      ctx.font = "bold 7.5px Helvetica, Arial, sans-serif";
      var candidatos = geo.pontos.length > 1 ? [0, geo.pontos.length-1] : [0];
      candidatos.forEach(function(i){
        var isLast = i === geo.pontos.length - 1;
        var x = geo.xAt(i), y = geo.yAt(geo.pontos[i].valor);
        var labelY = y - 8;
        if(labelY < geo.padT * 0.5) return; // muito perto do topo, não força
        var alinhamento = i === 0 ? "left" : "right";
        var labelX = i === 0 ? Math.max(x, geo.padL) : Math.min(x, geo.padL+geo.plotW);
        var texto = geo.pontos[i].valor + (item.unidade ? (" "+item.unidade) : "");

        /* Fundo branco atrás do texto — sem isso, a própria linha do
           gráfico pode cruzar por cima do rótulo (ex.: quando o valor
           seguinte ao primeiro ponto sobe bastante) e cortar o texto.
           Garante legibilidade não importa o formato da linha ali. */
        var largura = ctx.measureText(texto).width;
        ctx.save();
        ctx.fillStyle = SURFACE_HEX;
        ctx.globalAlpha = 0.88;
        var halo = alinhamento === "left" ? labelX - 2 : labelX - largura - 2;
        ctx.fillRect(halo, labelY - 7, largura + 4, 9);
        ctx.restore();

        ctx.fillStyle = isLast ? metaStatus(item).hex : INK_FAINT_HEX;
        ctx.textAlign = alinhamento;
        ctx.fillText(texto, labelX, labelY);
      });
    }

    return canvas.toDataURL("image/png");
  }

  /* Migra itens salvos no formato antigo (valorAtual solto, sem histórico). */
  function migrarItem(item){
    if(!Array.isArray(item.historico)){
      item.historico = [];
      if(item.valorAtual !== undefined && item.valorAtual !== ""){
        item.historico.push({id: uid("leit"), data: hoje(), valor: item.valorAtual});
      }
      delete item.valorAtual;
    }
    if(item.periodicidade === undefined) item.periodicidade = "";
    if(item.validoAte === undefined) item.validoAte = "";
  }

  function buildElRefs(root){
    function q(id){ return root.querySelector("#" + id); }
    return {
      addInput: q("kpis-addInput"),
      addBtn: q("kpis-addBtn"),
      lista: q("kpis-lista")
    };
  }

  function renderHistorico(item){
    var wrap = document.createElement("div");
    wrap.className = "kpis-historico";

    var addRow = document.createElement("div");
    addRow.className = "kpis-historico-add";
    var dataInput = document.createElement("input");
    dataInput.type = "date";
    dataInput.value = hoje();
    var valorInput = document.createElement("input");
    valorInput.type = "number"; valorInput.step = "any";
    valorInput.placeholder = "Valor da leitura";
    var registrarBtn = document.createElement("button");
    registrarBtn.className = "btn btn-secondary";
    registrarBtn.type = "button";
    registrarBtn.textContent = "Registrar leitura";
    registrarBtn.addEventListener("click", function(){
      if(valorInput.value === "") return;
      item.historico.push({id: uid("leit"), data: dataInput.value || hoje(), valor: valorInput.value});
      renderAll();
    });
    addRow.appendChild(dataInput); addRow.appendChild(valorInput); addRow.appendChild(registrarBtn);
    wrap.appendChild(addRow);

    if(item.historico.length === 0){
      var vazio = document.createElement("p");
      vazio.className = "kpis-historico-vazio";
      vazio.textContent = "Nenhuma leitura registrada ainda.";
      wrap.appendChild(vazio);
      return wrap;
    }

    var ordenado = item.historico.slice().sort(function(a,b){ return a.data < b.data ? 1 : -1; });
    var aberto = !!historicoAberto[item.id];
    var visiveis = aberto ? ordenado : ordenado.slice(0, LEITURAS_VISIVEIS);

    var lista = document.createElement("ul");
    lista.className = "kpis-historico-lista";
    visiveis.forEach(function(leit){
      var li = document.createElement("li");
      var txt = document.createElement("span");
      var partes = leit.data.split("-");
      var dataBr = partes.length === 3 ? (partes[2]+"/"+partes[1]+"/"+partes[0]) : leit.data;
      txt.textContent = dataBr + " — " + leit.valor + (item.unidade ? " " + item.unidade : "");
      li.appendChild(txt);
      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover leitura";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        item.historico = item.historico.filter(function(x){ return x.id !== leit.id; });
        renderAll();
      });
      li.appendChild(rm);
      lista.appendChild(li);
    });
    wrap.appendChild(lista);

    if(ordenado.length > LEITURAS_VISIVEIS){
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "kpis-historico-toggle";
      toggle.textContent = aberto ? "Mostrar menos" : "Ver histórico completo (" + ordenado.length + ")";
      toggle.addEventListener("click", function(){
        historicoAberto[item.id] = !aberto;
        renderAll();
      });
      wrap.appendChild(toggle);
    }

    return wrap;
  }

  function renderLista(){
    el.lista.innerHTML = "";
    if(state.itens.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);padding:2px 4px;list-style:none;";
      vazio.textContent = "Nenhum indicador ainda.";
      el.lista.appendChild(vazio);
      return;
    }

    state.itens.forEach(function(item){
      var li = document.createElement("li");
      li.className = "riscos-card";

      var top = document.createElement("div");
      top.className = "riscos-card-top";

      var indicadorInput = document.createElement("input");
      indicadorInput.className = "riscos-field-main";
      indicadorInput.placeholder = "Indicador";
      indicadorInput.maxLength = 140;
      indicadorInput.value = item.indicador || "";
      indicadorInput.addEventListener("change", function(){
        item.indicador = indicadorInput.value.trim() || item.indicador;
        renderAll();
      });
      top.appendChild(indicadorInput);

      var status = metaStatus(item);
      var badge = document.createElement("span");
      badge.className = "treinamento-auto-badge";
      badge.style.setProperty("--status-hex", status.hex);
      badge.textContent = status.label;
      badge.title = "Calculado a partir da leitura mais recente e da Meta";
      top.appendChild(badge);

      if(expirado(item)){
        var badgeExp = document.createElement("span");
        badgeExp.className = "treinamento-auto-badge";
        badgeExp.style.setProperty("--status-hex", "#A67C3D");
        badgeExp.textContent = "Expirado";
        badgeExp.title = "Passou da data ‘Válido até’ — considere substituir por um indicador mais completo";
        top.appendChild(badgeExp);
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

      var grid1 = document.createElement("div");
      grid1.className = "kpis-grid";

      var metaInput = document.createElement("input");
      metaInput.type = "number"; metaInput.step = "any";
      metaInput.placeholder = "Meta";
      metaInput.value = item.meta || "";
      metaInput.addEventListener("change", function(){ item.meta = metaInput.value; renderAll(); });
      grid1.appendChild(metaInput);

      var unidadeInput = document.createElement("input");
      unidadeInput.placeholder = "Unidade (%, dias...)";
      unidadeInput.maxLength = 20;
      unidadeInput.value = item.unidade || "";
      unidadeInput.addEventListener("change", function(){ item.unidade = unidadeInput.value.trim(); renderAll(); });
      grid1.appendChild(unidadeInput);

      var direcaoSelect = document.createElement("select");
      DIRECOES.forEach(function(d){
        var opt = document.createElement("option");
        opt.value = d.valor; opt.textContent = d.label;
        if(item.direcao === d.valor) opt.selected = true;
        direcaoSelect.appendChild(opt);
      });
      direcaoSelect.addEventListener("change", function(){ item.direcao = direcaoSelect.value; renderAll(); });
      grid1.appendChild(direcaoSelect);

      var periodicidadeSelect = document.createElement("select");
      PERIODICIDADES.forEach(function(p){
        var opt = document.createElement("option");
        opt.value = p.valor; opt.textContent = p.label;
        if((item.periodicidade || "") === p.valor) opt.selected = true;
        periodicidadeSelect.appendChild(opt);
      });
      periodicidadeSelect.addEventListener("change", function(){ item.periodicidade = periodicidadeSelect.value; renderAll(); });
      grid1.appendChild(periodicidadeSelect);

      var validoAteWrap = document.createElement("label");
      validoAteWrap.className = "treinamento-date-wrap";
      validoAteWrap.innerHTML = "<span>Válido até</span>";
      var validoAteInput = document.createElement("input");
      validoAteInput.type = "date";
      validoAteInput.value = item.validoAte || "";
      validoAteInput.addEventListener("change", function(){ item.validoAte = validoAteInput.value; renderAll(); });
      validoAteWrap.appendChild(validoAteInput);
      grid1.appendChild(validoAteWrap);

      var body = document.createElement("div");
      body.className = "kpis-card-body";

      var formCol = document.createElement("div");
      formCol.className = "kpis-form-col";
      formCol.appendChild(grid1);
      formCol.appendChild(renderHistorico(item));
      body.appendChild(formCol);
      body.appendChild(renderGraficoBloco(item));

      li.appendChild(body);
      el.lista.appendChild(li);
    });
  }

  function renderAll(){
    renderLista();
    if(onChange) onChange(state);
  }

  function addItem(){
    var indicador = el.addInput.value.trim();
    if(!indicador) return;
    state.itens.push({
      id: uid(), indicador: indicador, meta:"", unidade:"", direcao:"maior_melhor",
      periodicidade:"", validoAte:"", historico: []
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
    var tpl = document.getElementById("kpis-template");
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
   * Desenha os KPIs num documento jsPDF já criado — um bloco por
   * indicador (nome + status, meta/periodicidade/validade, gráfico de
   * tendência e a tabela completa de leituras), não só um resumo da
   * última leitura, pra servir de registro de verdade. Mesmo padrão
   * dos demais módulos: recebe o doc e retorna a posição Y final.
   */
  function desenharNoDoc(doc, docState, startY){
    var pageH = doc.internal.pageSize.getHeight();
    var pageW = doc.internal.pageSize.getWidth();
    var y = startY;

    if(!docState.itens || docState.itens.length === 0){
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      doc.text("Nenhum indicador registrado.", 40, y);
      return y + 16;
    }

    function hexToRgb(hex){
      hex = hex.replace("#","");
      return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
    }

    /* Gráfico e tabela dimensionados pra ocupar a largura útil da
       página inteira (antes eram 170pt+170pt fixos, sobrando bastante
       espaço em branco à direita numa página de ~515pt úteis) — e o
       gráfico ganha altura extra (proporção 2:1, não mais 2.2:1
       comprimido) pra caber datas no eixo X e rótulo de valor sem
       apertar. */
    var GAP = 20;
    var LARGURA_UTIL = pageW - 80;
    var CHART_W = Math.round(LARGURA_UTIL * 0.56);
    var CHART_H = Math.round(CHART_W * 0.5);
    var TABELA_W = LARGURA_UTIL - CHART_W - GAP;

    docState.itens.forEach(function(item, idx){
      if(idx > 0){
        if(y > pageH - 40){ doc.addPage(); y = 40; } else { y += 14; }
        doc.setDrawColor(218,223,230);
        doc.line(40, y - 8, doc.internal.pageSize.getWidth() - 40, y - 8);
      }
      if(y > pageH - (CHART_H + 50)){ doc.addPage(); y = 40; }

      var status = metaStatus(item);
      var statusRgb = hexToRgb(status.hex);

      doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
      doc.setTextColor(28,36,48);
      var nomeTxt = item.indicador || "";
      doc.text(nomeTxt, 40, y);
      var nomeW = doc.getTextWidth(nomeTxt);
      doc.setTextColor(statusRgb[0], statusRgb[1], statusRgb[2]);
      var statusTxt = "  •  " + status.label + (expirado(item) ? "  •  Expirado" : "");
      doc.text(statusTxt, 40 + nomeW, y);
      y += 13;

      doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
      doc.setTextColor(80,88,100);
      var metaLinha = "Meta: " + (item.meta !== "" ? item.meta : "—") + (item.unidade ? " "+item.unidade : "") +
        "   •   Periodicidade: " + (periodicidadeLabel(item.periodicidade) || "—") +
        (item.validoAte ? ("   •   Válido até: " + dataBr(item.validoAte)) : "");
      doc.text(metaLinha, 40, y);
      y += 12;

      var topoBloco = y;
      var imgData = gerarImagemGraficoPNG(item, {W: CHART_W, H: CHART_H, padL: 14, padR: 14, padT: 26, padB: 26, rotulosEixoX: true, rotulosValor: true});
      if(imgData){
        doc.addImage(imgData, "PNG", 40, topoBloco, CHART_W, CHART_H);
      } else {
        doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
        doc.setTextColor(150,155,163);
        doc.text("Sem leituras ainda.", 40, topoBloco + 12);
      }

      var tabelaX = 40 + CHART_W + GAP;
      if(item.historico.length){
        var ordenado = item.historico.slice().sort(function(a,b){ return a.data < b.data ? 1 : -1; });
        doc.autoTable({
          startY: topoBloco,
          margin:{left: tabelaX},
          tableWidth: TABELA_W,
          head: [["Data","Valor"]],
          body: ordenado.map(function(l){ return [dataBr(l.data), l.valor + (item.unidade ? " "+item.unidade : "")]; }),
          theme: "grid",
          rowPageBreak: "avoid",
          styles:{fontSize:8, cellPadding:4, halign:"center", valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
          headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:8}
        });
        y = Math.max(topoBloco + CHART_H, doc.lastAutoTable.finalY);
      } else {
        y = topoBloco + CHART_H;
      }
    });

    return y + 10;
  }

  return { mount: mount, desenharNoDoc: desenharNoDoc };
})();

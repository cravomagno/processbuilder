/* ============================================================
   richtext.js — campo de texto rico reutilizável: negrito, itálico,
   sublinhado, tachado, lista com marcadores e lista numerada — sem
   nenhuma biblioteca externa, usando um <div contenteditable> e
   document.execCommand (mesmo espírito "construído do zero" do
   Fluxograma). O conteúdo é guardado como HTML simples (b/i/u/s,
   ul/ol/li, div/br).

   Além do editor, expõe desenharNoDoc(doc, html, ...) — um desenho
   desse HTML em texto formatado dentro de um PDF do jsPDF (negrito/
   itálico/sublinhado/tachado de verdade, listas com marcador/número),
   com quebra de linha palavra a palavra e paginação automática —
   mesmo padrão de geometria compartilhada (tela + PDF) já usado no
   Fluxograma e no Ishikawa.
   ============================================================ */
window.RichText = (function(){
  "use strict";

  var BOTOES = [
    {cmd:"bold", label:"B", titulo:"Negrito", estilo:"font-weight:700;"},
    {cmd:"italic", label:"I", titulo:"Itálico", estilo:"font-style:italic;"},
    {cmd:"underline", label:"S", titulo:"Sublinhado", estilo:"text-decoration:underline;"},
    {cmd:"strikeThrough", label:"T", titulo:"Tachado", estilo:"text-decoration:line-through;"},
    {cmd:"insertUnorderedList", label:"•≡", titulo:"Lista com marcadores"},
    {cmd:"insertOrderedList", label:"1≡", titulo:"Lista numerada"}
  ];

  var TAGS_INLINE = {B:"bold", STRONG:"bold", I:"italic", EM:"italic", U:"underline", S:"strike", STRIKE:"strike"};

  /* A fonte padrão do jsPDF (Helvetica, codificação WinAnsi) só cobre
     Latin-1 + um pequeno extra de pontuação "esperta" do Windows-1252.
     Texto colado do Word costuma trazer marcadores decorativos de uma
     fonte de símbolos (Wingdings/Webdings) ou emoji — fora desse
     alfabeto, esses caracteres viram lixo ilegível no PDF (o padrão
     "Ø=ÞÒ" relatado). Em vez disso, qualquer caractere fora do alfabeto
     suportado vira um marcador neutro ("•"), nunca um glifo quebrado. */
  var EXTRAS_WINANSI_SEGUROS = {
    0x2018:1, 0x2019:1, 0x201A:1, 0x201C:1, 0x201D:1, 0x201E:1,
    0x2013:1, 0x2014:1, 0x2020:1, 0x2021:1, 0x2022:1, 0x2026:1,
    0x2030:1, 0x2039:1, 0x203A:1, 0x2122:1, 0x20AC:1, 0x0152:1,
    0x0153:1, 0x0160:1, 0x0161:1, 0x0178:1, 0x017D:1, 0x017E:1
  };
  function sanitizarTexto(texto){
    return String(texto || "").replace(/[Ā-\u{10FFFF}]/gu, function(ch){
      var cp = ch.codePointAt(0);
      return EXTRAS_WINANSI_SEGUROS[cp] ? ch : "•";
    });
  }

  /* Converte quebras de linha antigas (texto puro salvo antes deste
     recurso existir) em <br>, pra não perder a estrutura de linhas
     ao carregar um POP salvo há mais tempo. HTML gerado pelo próprio
     editor não tem \n "soltos" entre tags, então isso é seguro. */
  function normalizarEntrada(html){
    return String(html || "").replace(/\r\n|\r|\n/g, "<br>");
  }

  /* ---------------- Editor (tela) ---------------- */
  function montarEditor(container, valorInicialHtml, onSalvar, opts){
    opts = opts || {};
    container.innerHTML = "";
    if(container.className.indexOf("richtext-wrap") === -1){
      container.className = (container.className ? container.className + " " : "") + "richtext-wrap";
    }

    var toolbar = document.createElement("div");
    toolbar.className = "richtext-toolbar";

    var editor = document.createElement("div");
    editor.className = "richtext-editor";
    editor.contentEditable = "true";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    if(opts.placeholder) editor.setAttribute("data-placeholder", opts.placeholder);
    editor.innerHTML = normalizarEntrada(valorInicialHtml);

    BOTOES.forEach(function(b){
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "richtext-btn";
      btn.title = b.titulo;
      btn.innerHTML = '<span style="' + (b.estilo || "") + '">' + b.label + '</span>';
      /* mousedown com preventDefault evita que o clique no botão tire
         o foco/seleção do editor antes do comando ser aplicado. */
      btn.addEventListener("mousedown", function(e){ e.preventDefault(); });
      btn.addEventListener("click", function(){
        editor.focus();
        try{ document.execCommand(b.cmd, false, null); }catch(e){}
      });
      toolbar.appendChild(btn);
    });

    editor.addEventListener("focus", function(){
      try{ document.execCommand("styleWithCSS", false, false); }catch(e){}
    });
    editor.addEventListener("blur", function(){
      if(onSalvar) onSalvar(editor.innerHTML);
    });

    container.appendChild(toolbar);
    container.appendChild(editor);
    return editor;
  }

  /* ---------------- PDF ---------------- */

  /* Divide um texto já sanitizado em palavras, preservando quebras de
     linha REAIS que tenham ficado como caractere solto (\n) dentro de
     um nó de texto — comum em conteúdo colado (Word, e-mail, Teams)
     que não chega a gerar um <br>/<div> por linha. Sem isso, `\s+`
     trata \n como um espaço qualquer e o texto vira um bloco só. */
  function dividirComQuebras(texto){
    var linhas = String(texto || "").split(/\r\n|\r|\n/);
    var itens = [];
    linhas.forEach(function(linha, idx){
      if(idx > 0) itens.push({quebra: true});
      linha.split(/\s+/).filter(function(p){ return p.length > 0; }).forEach(function(p){ itens.push(p); });
    });
    return itens;
  }

  /* Percorre um nó e devolve uma lista plana de "palavras" com o
     estilo acumulado até ali — {texto, bold, italic, underline,
     strike} — ou {quebra:true} no lugar de cada <br> (ou \n literal). */
  function coletarPalavras(node, estiloBase){
    var palavras = [];
    function andar(n, estilo){
      for(var i = 0; i < n.childNodes.length; i++){
        var c = n.childNodes[i];
        if(c.nodeType === 3){
          dividirComQuebras(sanitizarTexto(c.textContent)).forEach(function(p){
            if(p && p.quebra){ palavras.push(p); return; }
            palavras.push({texto: p, bold: !!estilo.bold, italic: !!estilo.italic, underline: !!estilo.underline, strike: !!estilo.strike});
          });
        } else if(c.nodeType === 1){
          if(c.tagName === "BR"){ palavras.push({quebra: true}); continue; }
          /* Reforço defensivo: se por algum motivo um bloco (div/p/li)
             aparecer aqui dentro (fora do caminho normal de extrairBlocos,
             que já trata blocos separadamente), nunca deixar o texto dele
             colar sem separação nenhuma no bloco anterior. */
          var eBloco = c.tagName === "DIV" || c.tagName === "P" || c.tagName === "LI";
          if(eBloco && palavras.length){ palavras.push({quebra: true}); }
          var novoEstilo = {bold: estilo.bold, italic: estilo.italic, underline: estilo.underline, strike: estilo.strike};
          var marca = TAGS_INLINE[c.tagName];
          if(marca) novoEstilo[marca] = true;
          andar(c, novoEstilo);
        }
      }
    }
    andar(node, estiloBase || {});
    return palavras;
  }

  /* Um nó "é um wrapper" quando tem, entre seus filhos diretos, algum
     elemento de bloco (div/p/li/ul/ol) — nesse caso ele não é, ele
     mesmo, um parágrafo/item de folha: precisa ser percorrido de novo,
     não lido como texto corrido. Sem essa checagem, uma lista colada
     que o navegador aninhou um ou mais níveis mais fundo do que o
     comum (ex.: <div><div><ol>...</ol></div></div>) era lida como um
     único parágrafo de texto corrido, perdendo números e quebras. */
  var TAGS_BLOCO = {DIV:1, P:1, LI:1, UL:1, OL:1};
  function temFilhoDeBloco(el){
    for(var i = 0; i < el.children.length; i++){
      if(TAGS_BLOCO[el.children[i].tagName]) return true;
    }
    return false;
  }

  /* Identifica os blocos do conteúdo — parágrafos e itens de lista
     (numerada ou com marcadores) — percorrendo a árvore inteira,
     recursivamente, independente de em qual profundidade o navegador
     tenha aninhado cada <div>/<ol>/<li> (não assume uma forma fixa de
     DOM — só que blocos "de folha" viram parágrafo, e <li> dentro de
     <ul>/<ol> vira item numerado/com marcador, em qualquer nível). */
  function extrairBlocos(container){
    var blocos = [];
    var acumulador = null;

    function fecharAcumulador(){
      if(acumulador && acumulador.length){ blocos.push({tipo: "paragrafo", palavras: acumulador}); }
      acumulador = null;
    }

    function visitarLista(el){
      var ordenada = el.tagName === "OL";
      var idx = 0;
      Array.prototype.slice.call(el.children).forEach(function(li){
        if(li.tagName !== "LI") return;
        idx++;
        if(temFilhoDeBloco(li)){
          /* <li> com bloco aninhado (ex.: parágrafo + sublista dentro do
             mesmo item) — o texto solto direto do <li> (antes de
             qualquer bloco filho) vira o item numerado; o restante
             (parágrafos/sublistas aninhados) é achatado em blocos
             adicionais na sequência, sem numeração hierárquica (fora do
             escopo — v1 do editor não tem indentação de sub-nível). */
          var textoDireto = document.createElement("div");
          Array.prototype.slice.call(li.childNodes).forEach(function(c){
            if(c.nodeType === 1 && TAGS_BLOCO[c.tagName]) return;
            textoDireto.appendChild(c.cloneNode(true));
          });
          blocos.push({tipo: "item", ordenada: ordenada, indice: idx, palavras: coletarPalavras(textoDireto, {})});
          visitar(li);
        } else {
          blocos.push({tipo: "item", ordenada: ordenada, indice: idx, palavras: coletarPalavras(li, {})});
        }
      });
    }

    function visitar(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(el){
        if(el.nodeType === 1 && (el.tagName === "UL" || el.tagName === "OL")){
          fecharAcumulador();
          visitarLista(el);
        } else if(el.nodeType === 1 && (el.tagName === "DIV" || el.tagName === "P")){
          fecharAcumulador();
          if(temFilhoDeBloco(el)){
            visitar(el);
          } else {
            blocos.push({tipo: "paragrafo", palavras: coletarPalavras(el, {})});
          }
        } else if(el.nodeType === 1 && el.tagName === "BR"){
          fecharAcumulador();
          acumulador = [];
        } else if(el.nodeType === 3){
          if(!acumulador) acumulador = [];
          dividirComQuebras(sanitizarTexto(el.textContent)).forEach(function(p){
            if(p && p.quebra){ acumulador.push(p); return; }
            acumulador.push({texto: p, bold: false, italic: false, underline: false, strike: false});
          });
        } else if(el.nodeType === 1){
          if(temFilhoDeBloco(el)){
            fecharAcumulador();
            visitar(el);
          } else {
            if(!acumulador) acumulador = [];
            var estiloInline = {};
            var marcaInline = TAGS_INLINE[el.tagName];
            if(marcaInline) estiloInline[marcaInline] = true;
            acumulador = acumulador.concat(coletarPalavras(el, estiloInline));
          }
        }
      });
    }

    visitar(container);
    fecharAcumulador();
    return blocos;
  }

  /* Desenha o HTML formatado no jsPDF a partir de (x0, y0), quebrando
     linha palavra a palavra dentro de maxWidth e paginando sozinho
     quando ultrapassa pageH. Devolve o y final (após a última linha). */
  function desenharNoDoc(doc, html, x0, y0, maxWidth, pageH, opts){
    opts = opts || {};
    var fontSize = opts.fontSize || 9;
    var lineHeight = opts.lineHeight || 12.5;
    var cor = opts.cor || [60, 66, 78];

    var textoLimpo = String(html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if(!textoLimpo){
      doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
      doc.setTextColor(cor[0], cor[1], cor[2]);
      doc.text(opts.vazio || "(sem conteúdo)", x0, y0);
      return y0 + lineHeight;
    }

    var container = document.createElement("div");
    container.innerHTML = normalizarEntrada(html);
    var blocos = extrairBlocos(container);

    var y = y0;

    function fonteDaPalavra(p){
      var estilo = "normal";
      if(p.bold && p.italic) estilo = "bolditalic";
      else if(p.bold) estilo = "bold";
      else if(p.italic) estilo = "italic";
      doc.setFont("helvetica", estilo);
      doc.setFontSize(fontSize);
      doc.setTextColor(cor[0], cor[1], cor[2]);
    }

    function proximaLinha(){
      y += lineHeight;
      if(y > pageH - 40){ doc.addPage(); y = 40; }
    }

    blocos.forEach(function(bloco){
      var indent = 0;
      var x = x0;
      if(bloco.tipo === "item"){
        var prefixo = bloco.ordenada ? (bloco.indice + ". ") : "•  ";
        doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize); doc.setTextColor(cor[0], cor[1], cor[2]);
        doc.text(prefixo, x0, y);
        indent = doc.getTextWidth(prefixo);
        x = x0 + indent;
      }

      (bloco.palavras || []).forEach(function(p){
        if(p.quebra){ proximaLinha(); x = x0 + indent; return; }
        fonteDaPalavra(p);
        var w = doc.getTextWidth(p.texto);
        if(x + w > x0 + maxWidth && x > x0 + indent){ proximaLinha(); x = x0 + indent; }
        doc.text(p.texto, x, y);
        if(p.underline || p.strike){
          var ly = p.strike ? (y - fontSize * 0.32) : (y + 1.6);
          doc.setDrawColor(cor[0], cor[1], cor[2]);
          doc.setLineWidth(0.5);
          doc.line(x, ly, x + w, ly);
        }
        x += w + doc.getTextWidth(" ");
      });

      proximaLinha();
    });

    return y;
  }

  return { montarEditor: montarEditor, desenharNoDoc: desenharNoDoc };
})();

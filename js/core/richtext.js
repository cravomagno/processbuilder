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

  /* Percorre um nó e devolve uma lista plana de "palavras" com o
     estilo acumulado até ali — {texto, bold, italic, underline,
     strike} — ou {quebra:true} no lugar de cada <br>. */
  function coletarPalavras(node, estiloBase){
    var palavras = [];
    function andar(n, estilo){
      for(var i = 0; i < n.childNodes.length; i++){
        var c = n.childNodes[i];
        if(c.nodeType === 3){
          var partes = String(c.textContent || "").split(/\s+/).filter(function(p){ return p.length > 0; });
          partes.forEach(function(p){
            palavras.push({texto: p, bold: !!estilo.bold, italic: !!estilo.italic, underline: !!estilo.underline, strike: !!estilo.strike});
          });
        } else if(c.nodeType === 1){
          if(c.tagName === "BR"){ palavras.push({quebra: true}); continue; }
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

  /* Identifica os blocos de nível superior do conteúdo — parágrafos
     (div/p, ou texto solto antes do primeiro Enter) e itens de lista
     (li dentro de ul/ol, guardando se é numerada e a posição). */
  function extrairBlocos(container){
    var blocos = [];
    var acumulador = null;

    function fecharAcumulador(){
      if(acumulador){ blocos.push({tipo: "paragrafo", palavras: acumulador}); acumulador = null; }
    }

    Array.prototype.slice.call(container.childNodes).forEach(function(el){
      if(el.nodeType === 1 && (el.tagName === "UL" || el.tagName === "OL")){
        fecharAcumulador();
        var ordenada = el.tagName === "OL";
        Array.prototype.slice.call(el.children).filter(function(li){ return li.tagName === "LI"; })
          .forEach(function(li, idx){
            blocos.push({tipo: "item", ordenada: ordenada, indice: idx + 1, palavras: coletarPalavras(li, {})});
          });
      } else if(el.nodeType === 1 && (el.tagName === "DIV" || el.tagName === "P")){
        fecharAcumulador();
        blocos.push({tipo: "paragrafo", palavras: coletarPalavras(el, {})});
      } else if(el.nodeType === 1 && el.tagName === "BR"){
        fecharAcumulador();
        acumulador = [];
      } else if(el.nodeType === 3){
        if(!acumulador) acumulador = [];
        String(el.textContent || "").split(/\s+/).filter(function(p){ return p.length > 0; })
          .forEach(function(p){ acumulador.push({texto: p, bold: false, italic: false, underline: false, strike: false}); });
      } else if(el.nodeType === 1){
        if(!acumulador) acumulador = [];
        var estiloInline = {};
        var marcaInline = TAGS_INLINE[el.tagName];
        if(marcaInline) estiloInline[marcaInline] = true;
        acumulador = acumulador.concat(coletarPalavras(el, estiloInline));
      }
    });
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

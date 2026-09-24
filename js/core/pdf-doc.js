/* ============================================================
   pdf-doc.js — infraestrutura compartilhada de formatação para todos
   os PDFs gerados pela solução (fechamento de fase e Dossiê
   consolidado): cabeçalho padronizado (com brasão opcional), bloco de
   encerramento/aprovação, e rodapé com numeração de página + data/hora
   + contexto do documento — aplicado numa passada final sobre todas as
   páginas já geradas (única forma correta de escrever "Página N de M"
   no jsPDF, já que o total só é conhecido depois de tudo desenhado).

   Mesmo espírito "construído do zero, compartilhado entre módulos" já
   usado no RichText e na geometria do Fluxograma/Ishikawa — em vez de
   repetir cabeçalho/rodapé em cada gerador de PDF.
   ============================================================ */
window.PdfDoc = (function(){
  "use strict";

  var MARGEM_X = 40;
  var COR_TEXTO_PRINCIPAL = [28, 36, 48];
  var COR_TEXTO_SECUNDARIO = [110, 116, 128];
  var COR_RODAPE = [140, 148, 160];
  var COR_LINHA = [218, 223, 230];
  var COR_ACCENT = [43, 58, 103];

  function formatarDataHora(isoOuData){
    var d = isoOuData ? new Date(isoOuData) : new Date();
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR").slice(0, 5);
  }

  /* Desenha o brasão embutido (js/core/logo-data.js) num quadrado
     x,y,tamanho — bloco 100% opcional: se o arquivo não estiver
     carregado, ou o addImage falhar por qualquer motivo, a geração do
     PDF continua normalmente sem o brasão (nunca lança erro). */
  function desenharBrasao(doc, x, y, tamanho){
    if(!window.LOGO_BASE64) return false;
    try{
      doc.addImage(window.LOGO_BASE64, "PNG", x, y, tamanho, tamanho);
      return true;
    }catch(e){
      return false;
    }
  }

  /* Cabeçalho "hero" padronizado — usado na primeira página do PDF de
     fechamento de fase, na capa do Dossiê e no início de cada página
     de fase dentro do Dossiê. Devolve o Y onde o conteúdo pode
     começar (já depois da linha de destaque). */
  function desenharCabecalhoPrincipal(doc, opts){
    opts = opts || {};
    var pageW = doc.internal.pageSize.getWidth();
    var logoTam = 34;
    var temLogo = desenharBrasao(doc, pageW - MARGEM_X - logoTam, 24, logoTam);
    var larguraTexto = pageW - MARGEM_X * 2 - (temLogo ? (logoTam + 16) : 0);

    var y = 40;
    doc.setFont("helvetica", "bold"); doc.setFontSize(opts.tamanhoTitulo || 17);
    doc.setTextColor(COR_TEXTO_PRINCIPAL[0], COR_TEXTO_PRINCIPAL[1], COR_TEXTO_PRINCIPAL[2]);
    var tituloLinhas = doc.splitTextToSize(opts.titulo || "", larguraTexto);
    doc.text(tituloLinhas, MARGEM_X, y);
    y += tituloLinhas.length * ((opts.tamanhoTitulo || 17) + 2);

    if(opts.subtitulo){
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      doc.setTextColor(70, 80, 100);
      doc.text(opts.subtitulo, MARGEM_X, y);
      y += 16;
    }

    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.setTextColor(COR_TEXTO_SECUNDARIO[0], COR_TEXTO_SECUNDARIO[1], COR_TEXTO_SECUNDARIO[2]);
    doc.text(opts.meta || ("Gerado em " + formatarDataHora()), MARGEM_X, y);
    y += 12;

    doc.setDrawColor(COR_ACCENT[0], COR_ACCENT[1], COR_ACCENT[2]);
    doc.setLineWidth(1.6);
    doc.line(MARGEM_X, y, pageW - MARGEM_X, y);
    y += 22;

    return y;
  }

  /* Título de seção "capa de capítulo" — usado no topo da página própria
     de cada ferramenta dentro do PDF de fechamento de fase/Dossiê:
     rótulo pequeno em caixa alta (caso + fase), uma barra vertical de
     destaque, o nome da ferramenta em negrito, e uma linha divisória —
     mesma linguagem visual do cabeçalho principal, repetida em escala
     menor no início de cada ferramenta, para dar identidade própria a
     cada página sem competir com o cabeçalho da primeira página. */
  function desenharTituloSecao(doc, eyebrow, titulo){
    var pageW = doc.internal.pageSize.getWidth();
    var y = 44;

    if(eyebrow){
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.setTextColor(COR_ACCENT[0], COR_ACCENT[1], COR_ACCENT[2]);
      var eyebrowLinhas = doc.splitTextToSize(String(eyebrow).toUpperCase(), pageW - MARGEM_X * 2);
      doc.text(eyebrowLinhas[0], MARGEM_X, y);
      y += 20;
    }

    doc.setFillColor(COR_ACCENT[0], COR_ACCENT[1], COR_ACCENT[2]);
    doc.rect(MARGEM_X, y - 13, 4, 17, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.setTextColor(COR_TEXTO_PRINCIPAL[0], COR_TEXTO_PRINCIPAL[1], COR_TEXTO_PRINCIPAL[2]);
    doc.text(titulo, MARGEM_X + 13, y);
    y += 14;

    doc.setDrawColor(COR_LINHA[0], COR_LINHA[1], COR_LINHA[2]);
    doc.setLineWidth(0.8);
    doc.line(MARGEM_X, y, pageW - MARGEM_X, y);
    y += 22;

    return y;
  }

  /* Bloco de encerramento/aprovação — linha divisória + rótulo pequeno
     + valor em destaque, para nunca mais parecer um resto de texto
     colado no fim da página ("Aprovado por: ..."). */
  function desenharBlocoAprovacao(doc, x0, y, largura, rotulo, valor){
    doc.setDrawColor(COR_LINHA[0], COR_LINHA[1], COR_LINHA[2]);
    doc.setLineWidth(0.8);
    doc.line(x0, y, x0 + largura, y);
    y += 17;

    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.setTextColor(COR_TEXTO_SECUNDARIO[0], COR_TEXTO_SECUNDARIO[1], COR_TEXTO_SECUNDARIO[2]);
    doc.text(String(rotulo || "").toUpperCase(), x0, y);
    y += 13;

    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.setTextColor(COR_TEXTO_PRINCIPAL[0], COR_TEXTO_PRINCIPAL[1], COR_TEXTO_PRINCIPAL[2]);
    doc.text(String(valor || ""), x0, y);
    return y + 8;
  }

  /* Garante que um bloco de altura conhecida caiba no restante da
     página atual — se não couber, quebra a página e devolve o novo Y
     (40, topo útil padrão). Substitui os `if(y > pageH-N){addPage()}`
     espalhados por um único critério, baseado na altura real do
     bloco, não numa estimativa fixa (causa raiz da desconexão entre
     título e conteúdo relatada no Fluxograma). */
  function garantirEspaco(doc, y, alturaNecessaria, margemInferior){
    var pageH = doc.internal.pageSize.getHeight();
    if(y + alturaNecessaria > pageH - (margemInferior == null ? 40 : margemInferior)){
      doc.addPage();
      return {y: 40, quebrou: true};
    }
    return {y: y, quebrou: false};
  }

  /* Registra, no contexto do documento, a que página pertence cada
     seção (fase) — usado só no Dossiê, onde um único PDF tem várias
     fases e o rodapé precisa mostrar o rótulo certo em cada página.
     Chamar logo depois de doc.addPage() para a seção. */
  function registrarSecao(doc, ctx, rotulo){
    ctx.secoes = ctx.secoes || [];
    ctx.secoes.push({pagina: doc.internal.getNumberOfPages(), rotulo: rotulo});
  }

  function rotuloDaPagina(ctx, pagina){
    if(!ctx.secoes || !ctx.secoes.length) return ctx.rotulo || "";
    var atual = ctx.secoes[0].rotulo;
    for(var i = 0; i < ctx.secoes.length; i++){
      if(ctx.secoes[i].pagina <= pagina) atual = ctx.secoes[i].rotulo;
      else break;
    }
    return atual;
  }

  /* Corta uma linha de texto (com "…" no fim) se ela ultrapassar a
     largura disponível — mede a largura real no jsPDF em vez de
     confiar num limite de caracteres, mesma técnica já usada na
     quebra de texto dentro das caixas do Fluxograma. */
  function truncarLinha(doc, texto, maxWidth){
    texto = String(texto || "");
    if(doc.getTextWidth(texto) <= maxWidth) return texto;
    while(texto.length > 1 && doc.getTextWidth(texto + "…") > maxWidth){ texto = texto.slice(0, -1); }
    return texto + "…";
  }

  /* Chamado por último, depois de TODO o conteúdo do documento já
     desenhado (inclusive todas as quebras de página) — percorre as
     páginas já existentes e desenha o rodapé em cada uma, em DUAS
     linhas: o contexto do documento (caso — fase) sozinho na primeira,
     ocupando a largura toda; data/hora/versão ao centro e "Página N de
     M" à direita na segunda. Duas linhas em vez de uma de propósito —
     com tudo numa linha só, um nome de caso/fase comprido invadia o
     texto central (relatado com um print real). Sempre dentro da
     margem inferior já reservada pelos próprios módulos (nunca
     sobrepõe conteúdo). */
  function finalizarDocumento(doc, ctx){
    ctx = ctx || {};
    var total = doc.internal.getNumberOfPages();
    for(var i = 1; i <= total; i++){
      doc.setPage(i);
      var pageW = doc.internal.pageSize.getWidth();
      var pageH = doc.internal.pageSize.getHeight();

      doc.setDrawColor(COR_LINHA[0], COR_LINHA[1], COR_LINHA[2]);
      doc.setLineWidth(0.6);
      doc.line(MARGEM_X, pageH - 42, pageW - MARGEM_X, pageH - 42);

      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.setTextColor(COR_RODAPE[0], COR_RODAPE[1], COR_RODAPE[2]);

      var rotulo = truncarLinha(doc, rotuloDaPagina(ctx, i), pageW - MARGEM_X * 2);
      doc.text(rotulo, MARGEM_X, pageH - 29);

      doc.text(ctx.metaDireita || ("Gerado em " + formatarDataHora()), pageW / 2, pageH - 16, {align: "center"});
      doc.text("Página " + i + " de " + total, pageW - MARGEM_X, pageH - 16, {align: "right"});
    }
  }

  return {
    formatarDataHora: formatarDataHora,
    desenharBrasao: desenharBrasao,
    desenharCabecalhoPrincipal: desenharCabecalhoPrincipal,
    desenharTituloSecao: desenharTituloSecao,
    desenharBlocoAprovacao: desenharBlocoAprovacao,
    garantirEspaco: garantirEspaco,
    registrarSecao: registrarSecao,
    finalizarDocumento: finalizarDocumento
  };
})();

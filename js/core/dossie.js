/* ============================================================
   dossie.js — Dossiê PDF consolidado do caso inteiro: uma capa com
   o resumo das 7 fases seguida do conteúdo de cada uma, reaproveitando
   a mesma função de desenho (`Fechamento.desenharConteudoFase`) usada
   no PDF de fechamento de fase única — para não duplicar a lógica de
   "qual ferramenta desenhar em qual fase" em dois lugares.

   Diferente do fechamento de fase, o dossiê não é versionado nem
   registrado no estado do caso — é uma exportação "retrato do momento
   atual", pode ser gerado quantas vezes quiser, a qualquer momento,
   mesmo com fases ainda abertas (mostra "Aberta" no lugar da versão).
   ============================================================ */
window.Dossie = (function(){
  "use strict";

  function slugCaso(nome){ return window.CasoState.slugCaso(nome); }

  function statusLabel(fase){
    if(fase.status === "fechada" && fase.fechamentos.length){
      var ultimo = fase.fechamentos[fase.fechamentos.length - 1];
      return "Fechada (v" + ultimo.versao + ") em " + new Date(ultimo.dataFechamento).toLocaleDateString("pt-BR");
    }
    return "Ainda aberta";
  }

  function desenharCapa(doc, caso, opts){
    opts = opts || {};
    var fechadas = caso.fases.filter(function(f){ return f.status === "fechada"; }).length;
    var meta = "Gerado em " + window.PdfDoc.formatarDataHora() + "   •   " + fechadas + " de " + caso.fases.length + " fases fechadas";
    if(opts.rotuloVersao) meta = opts.rotuloVersao + "   •   " + meta;

    var y = window.PdfDoc.desenharCabecalhoPrincipal(doc, {
      titulo: caso.nome,
      tamanhoTitulo: 20,
      subtitulo: opts.rotuloVersao ? "Dossiê Consolidado — Fechamento de Ciclo" : "Dossiê Consolidado do Processo",
      meta: meta
    });
    y += 8;

    var head = [["Fase", "Status"]];
    var body = caso.fases.map(function(f){
      return ["Fase " + f.ordem + " — " + f.nome, statusLabel(f)];
    });

    doc.autoTable({
      startY: y,
      head: head, body: body,
      theme: "grid",
      styles:{fontSize:9.5, cellPadding:7, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9.5},
      columnStyles:{0:{halign:"left", cellWidth:220, fontStyle:"bold"}, 1:{halign:"left"}}
    });
  }

  function desenharPaginaFase(doc, caso, fase){
    var pageW = doc.internal.pageSize.getWidth();

    var y = window.PdfDoc.desenharCabecalhoPrincipal(doc, {
      titulo: "Fase " + fase.ordem + " — " + fase.nome,
      tamanhoTitulo: 14,
      meta: statusLabel(fase)
    });

    doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
    doc.setTextColor(28,36,48);
    doc.text("Objetivo da fase", 40, y);
    y += 14;
    doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
    doc.setTextColor(80,88,100);
    var objetivoLinhas = doc.splitTextToSize(fase.objetivo || "", pageW - 80);
    doc.text(objetivoLinhas, 40, y);
    y += objetivoLinhas.length * 12 + 18;

    var resultado = window.Fechamento.desenharConteudoFase(doc, caso, fase, y);

    /* Tabela de Aprovador(a)/Revisor(a) por fase — só faz sentido para
       fases com pelo menos um fechamento (a Fase 0 nunca tem, porque
       não aprova/revisa a si mesma) e usa o snapshot histórico gravado
       no ÚLTIMO fechamento daquela fase, não o registro ao vivo da
       Fase 0 (que pode já ter mudado desde então). */
    if(fase.id !== "fase0" && fase.fechamentos.length){
      var ultimo = fase.fechamentos[fase.fechamentos.length - 1];
      window.Fechamento.desenharTabelaAprovacao(doc, resultado.y, ultimo.aprovador || "", ultimo.revisor || "", ultimo.versao, ultimo.dataFechamento);
    }
  }

  /* Monta o PDF do Dossiê (capa + uma página por fase) — compartilhado
     entre o Dossiê avulso de sempre (`gerarDossiePdf`, sem versão) e o
     Dossiê de fechamento de ciclo (`gerarDossieVersionadoDeCiclo`, que
     grava uma versão no histórico do caso). `opts.rotuloVersao`, quando
     presente, estampa a capa como um "retrato oficial" do fechamento de
     um ciclo, não só um export de conferência do momento atual. */
  function construirDossiePdf(caso, opts){
    if(!window.jspdf || !window.jspdf.jsPDF){ throw new Error("jsPDF não carregado"); }
    var jsPDF = window.jspdf.jsPDF;

    var doc = new jsPDF({orientation:"portrait", unit:"pt"});
    var ctx = {metaDireita: "Gerado em " + window.PdfDoc.formatarDataHora()};
    window.PdfDoc.registrarSecao(doc, ctx, caso.nome + " — Dossiê Consolidado");
    desenharCapa(doc, caso, opts);

    caso.fases.forEach(function(fase){
      doc.addPage("a4", window.Fechamento.calcularPrecisaPaisagem(fase) ? "landscape" : "portrait");
      window.PdfDoc.registrarSecao(doc, ctx, caso.nome + " — Fase " + fase.ordem + ": " + fase.nome);
      desenharPaginaFase(doc, caso, fase);
    });

    window.PdfDoc.finalizarDocumento(doc, ctx);
    return doc;
  }

  function gerarDossiePdf(caso){
    var doc = construirDossiePdf(caso);
    var nomeArquivo = "Casos_" + slugCaso(caso.nome) + "_dossie-consolidado.pdf";
    doc.save(nomeArquivo);
    return {pdfFileName: nomeArquivo};
  }

  /* Gera o Dossiê marcando o fechamento de um ciclo inteiro do processo
     (as 7 fases fechadas) — chamado só por "Reabrir Processo" (app.js),
     nunca pelo botão avulso "Gerar dossiê". Diferente do Dossiê de
     sempre, este grava uma entrada em `caso.dossieVersoes` — vira um
     retrato oficial e permanente daquele ciclo, não um export solto que
     pode ser refeito e substituído a qualquer momento. */
  function gerarDossieVersionadoDeCiclo(caso){
    var versao = caso.dossieVersoes.length + 1;
    var doc = construirDossiePdf(caso, {rotuloVersao: "Ciclo " + caso.cicloAtual + " — Dossiê v" + versao});
    var nomeArquivo = "Casos_" + slugCaso(caso.nome) + "_dossie-ciclo" + caso.cicloAtual + "-v" + versao + ".pdf";
    doc.save(nomeArquivo);
    caso.dossieVersoes.push({
      versao: versao,
      ciclo: caso.cicloAtual,
      dataFechamento: new Date().toISOString(),
      pdfFileName: nomeArquivo
    });
    return {versao: versao, pdfFileName: nomeArquivo};
  }

  return { gerarDossiePdf: gerarDossiePdf, gerarDossieVersionadoDeCiclo: gerarDossieVersionadoDeCiclo };
})();

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

  function desenharCapa(doc, caso){
    var fechadas = caso.fases.filter(function(f){ return f.status === "fechada"; }).length;

    var y = window.PdfDoc.desenharCabecalhoPrincipal(doc, {
      titulo: caso.nome,
      tamanhoTitulo: 20,
      subtitulo: "Dossiê Consolidado do Processo",
      meta: "Gerado em " + window.PdfDoc.formatarDataHora() + "   •   " + fechadas + " de " + caso.fases.length + " fases fechadas"
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

    window.Fechamento.desenharConteudoFase(doc, caso, fase, y);
  }

  function gerarDossiePdf(caso){
    if(!window.jspdf || !window.jspdf.jsPDF){ throw new Error("jsPDF não carregado"); }
    var jsPDF = window.jspdf.jsPDF;

    var doc = new jsPDF({orientation:"portrait", unit:"pt"});
    var ctx = {metaDireita: "Gerado em " + window.PdfDoc.formatarDataHora()};
    window.PdfDoc.registrarSecao(doc, ctx, caso.nome + " — Dossiê Consolidado");
    desenharCapa(doc, caso);

    caso.fases.forEach(function(fase){
      doc.addPage("a4", window.Fechamento.calcularPrecisaPaisagem(fase) ? "landscape" : "portrait");
      window.PdfDoc.registrarSecao(doc, ctx, caso.nome + " — Fase " + fase.ordem + ": " + fase.nome);
      desenharPaginaFase(doc, caso, fase);
    });

    window.PdfDoc.finalizarDocumento(doc, ctx);

    var nomeArquivo = "Casos_" + slugCaso(caso.nome) + "_dossie-consolidado.pdf";
    doc.save(nomeArquivo);
    return {pdfFileName: nomeArquivo};
  }

  return { gerarDossiePdf: gerarDossiePdf };
})();

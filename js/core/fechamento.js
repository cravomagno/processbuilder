/* ============================================================
   fechamento.js — aprovador automático (vindo da Governança) e
   geração do PDF de fechamento de fase, com versionamento.
   ============================================================ */
window.Fechamento = (function(){
  "use strict";

  function buscarAprovadorNaGovernanca(caso, nomeFaseAlvo){
    var governanca = caso.fases.filter(function(f){ return f.id === "governanca"; })[0];
    var raci = governanca && governanca.ferramentas && governanca.ferramentas.raci;
    if(!raci) return null;

    var atividade = raci.activities.filter(function(a){ return a.titulo === nomeFaseAlvo; })[0];
    if(!atividade) return null;

    var chaveA = Object.keys(raci.cells).filter(function(k){
      return k.indexOf(atividade.id + "|") === 0 && raci.cells[k] === "A";
    })[0];
    if(!chaveA) return null;

    var roleId = chaveA.split("|")[1];
    var role = raci.roles.filter(function(r){ return r.id === roleId; })[0];
    if(!role) return null;
    return role.nome ? (role.area + " — " + role.nome) : role.area;
  }

  function slug(s){
    return (s||"documento").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") || "documento";
  }

  /* Paisagem quando a fase tem uma Matriz RACI com muitos papéis (mesmo critério
     do RaciModule.exportPdf) — em retrato, 9 colunas ficam estreitas demais e o
     cabeçalho quebra letra por letra, inflando a tabela para várias páginas — ou
     quando o Fluxograma tem etapas demais para caber na largura do retrato sem
     encolher demais o desenho — ou quando é a Fase 0, cujo PM Canvas é sempre
     uma grade de 5 colunas (Porquê/O quê/Quem/Como/Quando e Quanto), estreita
     demais em retrato de qualquer jeito. Compartilhada com o Dossiê consolidado,
     que decide a orientação de cada página de fase com o mesmo critério. */
  function calcularPrecisaPaisagem(fase){
    return !!(fase.id === "fase0" ||
      (fase.ferramentas && fase.ferramentas.raci && fase.ferramentas.raci.roles.length > 4) ||
      (fase.ferramentas && fase.ferramentas.fluxograma && fase.ferramentas.fluxograma.fluxos && fase.ferramentas.fluxograma.fluxos.some(function(f){ return f.etapas.length > 3; })));
  }

  /* Desenha o conteúdo das ferramentas auxiliares de uma fase num
     documento jsPDF já criado — mesma lógica usada tanto no PDF de
     fechamento de uma única fase quanto em cada página de fase do
     Dossiê consolidado. Cada ferramenta começa numa página própria
     (nunca se misturam no documento) com um título de seção próprio;
     retorna a posição Y final (fim da última ferramenta desenhada). */
  function desenharConteudoFase(doc, caso, fase, startY){
    var pageW = doc.internal.pageSize.getWidth();
    var y = startY;
    var eyebrow = caso.nome + " — Fase " + fase.ordem + ": " + fase.nome;

    function iniciarFerramenta(titulo){
      doc.addPage();
      y = window.PdfDoc.desenharTituloSecao(doc, eyebrow, titulo);
    }

    if(fase.id === "fase0"){
      if(fase.ferramentas.pmCanvas && window.Fase0Module){
        iniciarFerramenta("PM Canvas do Projeto");
        y = window.Fase0Module.desenharNoDoc(doc, fase.ferramentas.pmCanvas, y);
      }
    } else if(fase.id === "diagnostico"){
      /* Fase com quatro ferramentas simultâneas — Termo de Abertura delimita
         o processo, GUT prioriza, Ishikawa mapeia as causas (6M), 5 Porquês
         aprofunda uma causa até a raiz. */
      if(fase.ferramentas.abertura && window.AberturaModule){
        iniciarFerramenta("Termo de Abertura");
        y = window.AberturaModule.desenharNoDoc(doc, fase.ferramentas.abertura, y);
      }
      if(fase.ferramentas.gut && window.GUTModule){
        iniciarFerramenta("Matriz GUT");
        y = window.GUTModule.desenharNoDoc(doc, fase.ferramentas.gut, y);
      }
      if(fase.ferramentas.ishikawa && window.IshikawaModule){
        iniciarFerramenta("Diagrama de Ishikawa (6M)");
        y = window.IshikawaModule.desenharNoDoc(doc, fase.ferramentas.ishikawa, y);
      }
      if(fase.ferramentas.porques && window.PorquesModule){
        iniciarFerramenta("5 Porquês");
        y = window.PorquesModule.desenharNoDoc(doc, fase.ferramentas.porques, y);
      }
    } else if(fase.id === "implantacao"){
      /* Fase com três ferramentas simultâneas — KPIs mede, Checklist confirma
         cobertura, Termo de Encerramento fecha o par com o Termo de Abertura. */
      if(fase.ferramentas.kpis && window.KpisModule){
        iniciarFerramenta("KPIs / Indicadores");
        y = window.KpisModule.desenharNoDoc(doc, fase.ferramentas.kpis, y);
      }
      if(fase.ferramentas.checklist && window.ChecklistModule){
        iniciarFerramenta("Checklist de Implantação");
        y = window.ChecklistModule.desenharNoDoc(doc, fase.ferramentas.checklist, y);
      }
      if(fase.ferramentas.encerramento && window.EncerramentoModule){
        iniciarFerramenta("Termo de Encerramento");
        y = window.EncerramentoModule.desenharNoDoc(doc, fase.ferramentas.encerramento, y);
      }
    } else if(fase.id === "governanca"){
      /* Fase com duas ferramentas simultâneas — RACI define papéis, Alçadas define limites financeiros. */
      if(fase.ferramentas.raci && window.RaciModule){
        iniciarFerramenta("Matriz RACI da fase");
        y = window.RaciModule.desenharMatrizNoDoc(doc, fase.ferramentas.raci, y);
      }
      if(fase.ferramentas.alcadas && window.AlcadasModule){
        iniciarFerramenta("Matriz de Alçadas");
        y = window.AlcadasModule.desenharNoDoc(doc, fase.ferramentas.alcadas, y);
      }
      if(fase.ferramentas.segregacao && window.SegregacaoModule){
        iniciarFerramenta("Segregação de Funções");
        y = window.SegregacaoModule.desenharNoDoc(doc, fase.ferramentas.segregacao, y);
      }
    } else if(fase.id === "auditoria"){
      /* Fase com duas ferramentas simultâneas — Riscos identifica e pontua,
         Plano de Auditoria define como e com que frequência cada um é verificado. */
      if(fase.ferramentas.riscos && window.RiscosModule){
        iniciarFerramenta("Matriz de Riscos");
        y = window.RiscosModule.desenharNoDoc(doc, fase.ferramentas.riscos, y);
      }
      if(fase.ferramentas.planoAuditoria && window.PlanoAuditoriaModule){
        iniciarFerramenta("Plano de Auditoria");
        y = window.PlanoAuditoriaModule.desenharNoDoc(doc, fase.ferramentas.planoAuditoria, y);
      }
      if(fase.ferramentas.regrasDivergencia && window.RegrasDivergenciaModule){
        iniciarFerramenta("Regras de Divergência/Exceção");
        y = window.RegrasDivergenciaModule.desenharNoDoc(doc, fase.ferramentas.regrasDivergencia, y);
      }
    } else if(fase.id === "modelagem"){
      /* Fase com duas ferramentas simultâneas — 5W2H planeja as ações,
         Fluxograma desenha o processo "to-be" com raias por papel. */
      if(fase.ferramentas.w2h && window.W2HModule){
        iniciarFerramenta("Plano de ação (5W2H)");
        y = window.W2HModule.desenharNoDoc(doc, fase.ferramentas.w2h, y);
      }
      if(fase.ferramentas.fluxograma && window.FluxogramaModule){
        iniciarFerramenta("Fluxograma do Processo");
        y = window.FluxogramaModule.desenharNoDoc(doc, fase.ferramentas.fluxograma, y);
      }
      if(fase.ferramentas.pop && window.PopModule){
        iniciarFerramenta("POPs / Instruções de Trabalho");
        y = window.PopModule.desenharNoDoc(doc, fase.ferramentas.pop, y);
      }
    } else if(fase.id === "sistemas"){
      /* Fase com duas ferramentas simultâneas — Matriz de Rastreabilidade
         acompanha cada campo/dado do início ao fim, Sistemas registra a
         aquisição de terceiros ou o desenvolvimento interno. */
      if(fase.ferramentas.rastreabilidade && window.RastreabilidadeModule){
        iniciarFerramenta("Matriz de Rastreabilidade");
        y = window.RastreabilidadeModule.desenharNoDoc(doc, fase.ferramentas.rastreabilidade, y);
      }
      if(fase.ferramentas.sistemas && window.SistemasModule){
        iniciarFerramenta("Sistemas (Aquisição/Desenvolvimento)");
        y = window.SistemasModule.desenharNoDoc(doc, fase.ferramentas.sistemas, y);
      }
    } else if(fase.ferramentas && fase.ferramentas.treinamento && window.TreinamentoModule){
      iniciarFerramenta("Plano de Treinamento");
      y = window.TreinamentoModule.desenharNoDoc(doc, fase.ferramentas.treinamento, y);
    } else {
      iniciarFerramenta("Tarefas e entregáveis");
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
      doc.setTextColor(80,88,100);
      if(fase.tarefas.length === 0 && fase.entregaveis.length === 0){
        doc.text("Nenhuma tarefa ou entregável registrado.", 40, y);
        y += 14;
      } else {
        fase.tarefas.forEach(function(t){
          if(y > doc.internal.pageSize.getHeight() - 40){ doc.addPage(); y = 40; }
          doc.text((t.feito ? "[x] " : "[ ] ") + t.titulo, 40, y);
          y += 13;
        });
        fase.entregaveis.forEach(function(en){
          if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
          var linhas = doc.splitTextToSize("• " + en.texto, pageW - 80);
          doc.text(linhas, 40, y);
          y += linhas.length * 12 + 4;
        });
      }
    }

    var aprovador = buscarAprovadorNaGovernanca(caso, fase.nome);
    return {y: y, aprovador: aprovador};
  }

  /* Tabela de assinatura (1 linha x 3 colunas: Aprovador(a) | Revisor(a) |
     Data e Versão) desenhada no fim do conteúdo de uma fase — tanto no
     PDF de fechamento de fase única (construirPdfFase) quanto em cada
     página de fase dentro do Dossiê (dossie.js). Os valores de
     aprovador/revisor vêm do registro da Fase 0 (ver fase0-module.js);
     versão/data vêm de quem chamou, porque o significado muda conforme
     o contexto (versão sendo criada agora vs. último fechamento já
     registrado). Retorna o Y final, depois da tabela. */
  function desenharTabelaAprovacao(doc, y, aprovador, revisor, versao, data){
    var chk = window.PdfDoc.garantirEspaco(doc, y, 50, 40);
    y = chk.y;
    doc.autoTable({
      startY: y,
      head: [["Aprovador(a)", "Revisor(a)", "Data e Versão"]],
      body: [[
        aprovador || "—",
        revisor || "—",
        (data ? window.PdfDoc.formatarDataHora(data) : "—") + "  ·  v" + versao
      ]],
      theme: "grid",
      styles:{fontSize:9, cellPadding:6, valign:"middle", lineColor:[218,223,230], lineWidth:0.6, textColor:[28,36,48]},
      headStyles:{fillColor:[43,58,103], textColor:255, fontStyle:"bold", fontSize:9},
      columnStyles:{2:{cellWidth:140}}
    });
    return doc.lastAutoTable.finalY + 10;
  }

  /* Monta o PDF de fechamento de uma fase para uma versão/data já
     definidas — compartilhado entre gerar uma versão NOVA
     (`gerarPdfFechamentoFase`) e regenerar o arquivo da versão ATUAL
     sem criar uma versão nova (`regerarPdfUltimaVersao`). `dataRotulo`
     é a data histórica que aparece como "Fechado em" no cabeçalho (não
     muda ao regerar); `dataGeracaoArquivo` é o instante em que este
     arquivo específico está sendo produzido, usado só no rodapé
     ("Gerado em") — as duas coincidem na primeira vez que a fase fecha,
     e divergem quando o mesmo PDF é baixado de novo depois. */
  function construirPdfFase(caso, fase, versao, dataRotulo, dataGeracaoArquivo, aprovadorFase0, revisorFase0){
    if(!window.jspdf || !window.jspdf.jsPDF){ throw new Error("jsPDF não carregado"); }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({orientation: calcularPrecisaPaisagem(fase) ? "landscape" : "portrait", unit:"pt"});
    var pageW = doc.internal.pageSize.getWidth();

    var ctx = {
      rotulo: caso.nome + " — Fase " + fase.ordem + ": " + fase.nome,
      metaDireita: "v" + versao + " • Gerado em " + window.PdfDoc.formatarDataHora(dataGeracaoArquivo)
    };

    var y = window.PdfDoc.desenharCabecalhoPrincipal(doc, {
      titulo: caso.nome + " — Fase " + fase.ordem + ": " + fase.nome,
      subtitulo: "Documento de fechamento de fase",
      meta: "Versão " + versao + "   •   Fechado em " + window.PdfDoc.formatarDataHora(dataRotulo)
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

    var resultado = desenharConteudoFase(doc, caso, fase, y);
    var aprovador = resultado.aprovador;

    if(fase.id !== "fase0"){
      desenharTabelaAprovacao(doc, resultado.y, aprovadorFase0, revisorFase0, versao, dataRotulo);
    }

    window.PdfDoc.finalizarDocumento(doc, ctx);

    /* O navegador não cria subpastas a partir de "/" no nome sugerido do download
       (testado manualmente: vira "_" em vez de pasta) — então o nome já é gerado
       achatado, de propósito, em vez de confiar nesse comportamento. */
    var nomeArquivo = "Casos_" + window.CasoState.slugCaso(caso.nome) + "_0" + fase.ordem + "-" + slug(fase.nome) + "-v" + versao + ".pdf";
    doc.save(nomeArquivo);

    return {doc: doc, aprovador: aprovador, nomeArquivo: nomeArquivo};
  }

  /* Fecha a fase de verdade: só é chamado quando ela está "aberta"
     (fase nova ou recém-reaberta) — cria uma versão NOVA, grava no
     histórico de fechamentos e trava a edição (ver app.js). */
  function gerarPdfFechamentoFase(caso, faseId){
    var fase = caso.fases.filter(function(f){ return f.id === faseId; })[0];
    if(!fase) return null;

    var versao = fase.fechamentos.length + 1;
    var agora = new Date();
    var av = window.Fase0Module ? window.Fase0Module.buscarAprovadorRevisor(caso, faseId) : {aprovador:"", revisor:""};
    var construido = construirPdfFase(caso, fase, versao, agora, agora, av.aprovador, av.revisor);

    fase.fechamentos.push({
      versao: versao,
      dataFechamento: agora.toISOString(),
      aprovadoPor: construido.aprovador || null,
      aprovador: av.aprovador || "",
      revisor: av.revisor || "",
      pdfFileName: construido.nomeArquivo
    });
    fase.status = "fechada";

    return {versao: versao, aprovador: construido.aprovador, pdfFileName: construido.nomeArquivo};
  }

  /* Rebaixa o PDF da fase que JÁ está fechada, sem criar uma versão
     nova — usado quando "Fechar fase" é clicado de novo sem a fase ter
     sido reaberta (nada pode ter mudado, os campos estão travados; ver
     app.js). Reaproveita o número de versão e a data de "Fechado em" já
     registrados; o rodapé do arquivo mostra a data de HOJE em "Gerado
     em", já que é quando esse arquivo específico está sendo produzido —
     não altera `fase.fechamentos` nem `fase.status`. */
  function regerarPdfUltimaVersao(caso, faseId){
    var fase = caso.fases.filter(function(f){ return f.id === faseId; })[0];
    if(!fase || !fase.fechamentos.length) return null;

    var ultimo = fase.fechamentos[fase.fechamentos.length - 1];
    var construido = construirPdfFase(caso, fase, ultimo.versao, new Date(ultimo.dataFechamento), new Date(), ultimo.aprovador || "", ultimo.revisor || "");

    return {versao: ultimo.versao, aprovador: construido.aprovador, pdfFileName: construido.nomeArquivo};
  }

  return {
    buscarAprovadorNaGovernanca: buscarAprovadorNaGovernanca,
    calcularPrecisaPaisagem: calcularPrecisaPaisagem,
    desenharConteudoFase: desenharConteudoFase,
    desenharTabelaAprovacao: desenharTabelaAprovacao,
    gerarPdfFechamentoFase: gerarPdfFechamentoFase,
    regerarPdfUltimaVersao: regerarPdfUltimaVersao
  };
})();

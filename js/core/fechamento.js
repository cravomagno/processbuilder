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
     encolher demais o desenho. Compartilhada com o Dossiê consolidado, que decide
     a orientação de cada página de fase com o mesmo critério. */
  function calcularPrecisaPaisagem(fase){
    return !!((fase.ferramentas && fase.ferramentas.raci && fase.ferramentas.raci.roles.length > 4) ||
      (fase.ferramentas && fase.ferramentas.fluxograma && fase.ferramentas.fluxograma.fluxos && fase.ferramentas.fluxograma.fluxos.some(function(f){ return f.etapas.length > 3; })));
  }

  /* Desenha o conteúdo das ferramentas auxiliares de uma fase + a linha
     "Aprovado por" num documento jsPDF já criado, a partir de startY —
     mesma lógica usada tanto no PDF de fechamento de uma única fase
     quanto em cada página de fase do Dossiê consolidado. Retorna a
     posição Y final. */
  function desenharConteudoFase(doc, caso, fase, startY){
    var pageW = doc.internal.pageSize.getWidth();
    var y = startY;

    if(fase.id === "diagnostico"){
      /* Fase com quatro ferramentas simultâneas — Termo de Abertura delimita
         o processo, GUT prioriza, Ishikawa mapeia as causas (6M), 5 Porquês
         aprofunda uma causa até a raiz. */
      if(fase.ferramentas.abertura && window.AberturaModule){
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Termo de Abertura", 40, y);
        y += 14;
        y = window.AberturaModule.desenharNoDoc(doc, fase.ferramentas.abertura, y);
        y += 10;
      }
      if(fase.ferramentas.gut && window.GUTModule){
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Matriz GUT", 40, y);
        y += 14;
        y = window.GUTModule.desenharNoDoc(doc, fase.ferramentas.gut, y);
        y += 10;
      }
      if(fase.ferramentas.ishikawa && window.IshikawaModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Diagrama de Ishikawa (6M)", 40, y);
        y += 14;
        y = window.IshikawaModule.desenharNoDoc(doc, fase.ferramentas.ishikawa, y);
        y += 10;
      }
      if(fase.ferramentas.porques && window.PorquesModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("5 Porquês", 40, y);
        y += 14;
        y = window.PorquesModule.desenharNoDoc(doc, fase.ferramentas.porques, y);
        y += 10;
      }
    } else if(fase.id === "implantacao"){
      /* Fase com três ferramentas simultâneas — KPIs mede, Checklist confirma
         cobertura, Termo de Encerramento fecha o par com o Termo de Abertura. */
      if(fase.ferramentas.kpis && window.KpisModule){
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("KPIs / Indicadores", 40, y);
        y += 14;
        y = window.KpisModule.desenharNoDoc(doc, fase.ferramentas.kpis, y);
        y += 10;
      }
      if(fase.ferramentas.checklist && window.ChecklistModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Checklist de Implantação", 40, y);
        y += 14;
        y = window.ChecklistModule.desenharNoDoc(doc, fase.ferramentas.checklist, y);
        y += 10;
      }
      if(fase.ferramentas.encerramento && window.EncerramentoModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Termo de Encerramento", 40, y);
        y += 14;
        y = window.EncerramentoModule.desenharNoDoc(doc, fase.ferramentas.encerramento, y);
        y += 10;
      }
    } else if(fase.id === "governanca"){
      /* Fase com duas ferramentas simultâneas — RACI define papéis, Alçadas define limites financeiros. */
      if(fase.ferramentas.raci && window.RaciModule){
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Matriz RACI da fase", 40, y);
        y += 14;
        y = window.RaciModule.desenharMatrizNoDoc(doc, fase.ferramentas.raci, y);
        y += 10;
      }
      if(fase.ferramentas.alcadas && window.AlcadasModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Matriz de Alçadas", 40, y);
        y += 14;
        y = window.AlcadasModule.desenharNoDoc(doc, fase.ferramentas.alcadas, y);
        y += 10;
      }
      if(fase.ferramentas.segregacao && window.SegregacaoModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Segregação de Funções", 40, y);
        y += 14;
        y = window.SegregacaoModule.desenharNoDoc(doc, fase.ferramentas.segregacao, y);
        y += 10;
      }
    } else if(fase.id === "auditoria"){
      /* Fase com duas ferramentas simultâneas — Riscos identifica e pontua,
         Plano de Auditoria define como e com que frequência cada um é verificado. */
      if(fase.ferramentas.riscos && window.RiscosModule){
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Matriz de Riscos", 40, y);
        y += 14;
        y = window.RiscosModule.desenharNoDoc(doc, fase.ferramentas.riscos, y);
        y += 10;
      }
      if(fase.ferramentas.planoAuditoria && window.PlanoAuditoriaModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Plano de Auditoria", 40, y);
        y += 14;
        y = window.PlanoAuditoriaModule.desenharNoDoc(doc, fase.ferramentas.planoAuditoria, y);
        y += 10;
      }
      if(fase.ferramentas.regrasDivergencia && window.RegrasDivergenciaModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Regras de Divergência/Exceção", 40, y);
        y += 14;
        y = window.RegrasDivergenciaModule.desenharNoDoc(doc, fase.ferramentas.regrasDivergencia, y);
        y += 10;
      }
    } else if(fase.id === "modelagem"){
      /* Fase com duas ferramentas simultâneas — 5W2H planeja as ações,
         Fluxograma desenha o processo "to-be" com raias por papel. */
      if(fase.ferramentas.w2h && window.W2HModule){
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Plano de ação (5W2H)", 40, y);
        y += 14;
        y = window.W2HModule.desenharNoDoc(doc, fase.ferramentas.w2h, y);
        y += 10;
      }
      if(fase.ferramentas.fluxograma && window.FluxogramaModule){
        if(y > doc.internal.pageSize.getHeight() - 100){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Fluxograma do Processo", 40, y);
        y += 14;
        y = window.FluxogramaModule.desenharNoDoc(doc, fase.ferramentas.fluxograma, y);
        y += 10;
      }
      if(fase.ferramentas.pop && window.PopModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("POPs / Instruções de Trabalho", 40, y);
        y += 14;
        y = window.PopModule.desenharNoDoc(doc, fase.ferramentas.pop, y);
        y += 10;
      }
    } else if(fase.id === "sistemas"){
      /* Fase com duas ferramentas simultâneas — Matriz de Rastreabilidade
         acompanha cada campo/dado do início ao fim, Sistemas registra a
         aquisição de terceiros ou o desenvolvimento interno. */
      if(fase.ferramentas.rastreabilidade && window.RastreabilidadeModule){
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Matriz de Rastreabilidade", 40, y);
        y += 14;
        y = window.RastreabilidadeModule.desenharNoDoc(doc, fase.ferramentas.rastreabilidade, y);
        y += 10;
      }
      if(fase.ferramentas.sistemas && window.SistemasModule){
        if(y > doc.internal.pageSize.getHeight() - 60){ doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
        doc.setTextColor(28,36,48);
        doc.text("Sistemas (Aquisição/Desenvolvimento)", 40, y);
        y += 14;
        y = window.SistemasModule.desenharNoDoc(doc, fase.ferramentas.sistemas, y);
        y += 10;
      }
    } else if(fase.ferramentas && fase.ferramentas.treinamento && window.TreinamentoModule){
      doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
      doc.setTextColor(28,36,48);
      doc.text("Plano de Treinamento", 40, y);
      y += 14;
      y = window.TreinamentoModule.desenharNoDoc(doc, fase.ferramentas.treinamento, y);
      y += 10;
    } else {
      doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
      doc.setTextColor(28,36,48);
      doc.text("Tarefas e entregáveis", 40, y);
      y += 14;
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
      y += 10;
    }

    var aprovador = buscarAprovadorNaGovernanca(caso, fase.nome);
    if(y > doc.internal.pageSize.getHeight() - 40){ doc.addPage(); y = 40; }
    doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
    doc.setTextColor(28,36,48);
    doc.text("Aprovado por: " + (aprovador || "(não definido na Governança)"), 40, y);

    return {y: y, aprovador: aprovador};
  }

  function gerarPdfFechamentoFase(caso, faseId){
    var fase = caso.fases.filter(function(f){ return f.id === faseId; })[0];
    if(!fase) return null;
    if(!window.jspdf || !window.jspdf.jsPDF){ throw new Error("jsPDF não carregado"); }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({orientation: calcularPrecisaPaisagem(fase) ? "landscape" : "portrait", unit:"pt"});
    var versao = fase.fechamentos.length + 1;
    var pageW = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica","bold"); doc.setFontSize(16);
    doc.setTextColor(28,36,48);
    var titulo = caso.nome + " — Fase " + fase.ordem + ": " + fase.nome;
    var tituloLinhas = doc.splitTextToSize(titulo, pageW - 80);
    doc.text(tituloLinhas, 40, 42);
    var y = 42 + tituloLinhas.length * 16;

    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.setTextColor(110,116,128);
    doc.text("Versão " + versao + "   •   Fechado em " + new Date().toLocaleDateString("pt-BR"), 40, y + 6);
    y += 26;

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

    /* O navegador não cria subpastas a partir de "/" no nome sugerido do download
       (testado manualmente: vira "_" em vez de pasta) — então o nome já é gerado
       achatado, de propósito, em vez de confiar nesse comportamento. */
    var nomeArquivo = "Casos_" + window.CasoState.slugCaso(caso.nome) + "_0" + fase.ordem + "-" + slug(fase.nome) + "-v" + versao + ".pdf";
    doc.save(nomeArquivo);

    fase.fechamentos.push({
      versao: versao,
      dataFechamento: new Date().toISOString(),
      aprovadoPor: aprovador || null,
      pdfFileName: nomeArquivo
    });
    fase.status = "fechada";

    return {versao:versao, aprovador:aprovador, pdfFileName:nomeArquivo};
  }

  return {
    buscarAprovadorNaGovernanca: buscarAprovadorNaGovernanca,
    calcularPrecisaPaisagem: calcularPrecisaPaisagem,
    desenharConteudoFase: desenharConteudoFase,
    gerarPdfFechamentoFase: gerarPdfFechamentoFase
  };
})();

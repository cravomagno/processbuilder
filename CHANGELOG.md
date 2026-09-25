# Changelog — Construtor de Processos

Histórico de versões publicadas no GitHub Pages. Formato: [v.MAJOR.MINOR] — o que mudou desde a versão anterior.

> **Nota (23/09/2026):** o sistema está em beta-teste de produção controlada. Todas as versões `v1.x` são versões de teste — correções e atualizações frequentes são esperadas até o beta amadurecer.

## [v1.9] — 25/09/2026

Foco: o Plano de Auditoria (Fase 4) ganha um checklist que continua funcional mesmo depois de a fase fechar.

### Adicionado

- **Checklist de verificação por item do Plano de Auditoria**: cada item passa a ter uma lista do que será conferido, com status Conforme/Não conforme e observação por linha.
- **Execução funcional, liberada só a partir do fechamento da fase**: o botão "Executar checklist" fica bloqueado enquanto a Fase 4 está aberta (mesmo com os pesos balanceados) e só libera depois que a fase fecha e os pesos somam exatamente 100% — trava os critérios em vigor antes de qualquer execução. Uma vez liberado, continua disponível daí em diante (inclusive após reabrir e fechar a fase de novo): cada execução (data/hora carimbada, status e observações) entra num histórico que acumula dentro do próprio caso, salvo/carregado junto com o rascunho `.json`.
- **Exportar PDF por execução**: cada execução concluída pode ser exportada isoladamente em PDF, com a tabela de status e observações.
- **Coluna "Execuções"** no PDF de fechamento do Plano de Auditoria, mostrando quantas execuções cada item já teve.
- **Peso (0 a 10, com uma casa decimal) por item de checklist** e cálculo de balanço dos pesos (cada ponto de peso vale 10% do total, precisa somar exatamente 100%) — junto com a fase fechada, condiciona a liberação do botão "Executar checklist". A pílula de balanço tem tooltip explicando o cálculo.
- **% de conformidade por execução**, ponderado pelos pesos dos itens marcados "Conforme", congelado no momento da conclusão.
- **Indicador de conformidade** ao lado dos campos de cada item do Plano de Auditoria: última execução, média histórica, tendência e um gráfico de colunas com o histórico, comparando as execuções do mesmo item ao longo do tempo. Filtro e botão de exportar dividem a mesma linha, no topo.
- **Pílulas coloridas (verde/vermelho) no histórico de execuções**, sempre alinhadas à direita de cada item conferido. Marcar um item como "Não conforme" torna a observação obrigatória para concluir a execução.
- **Exportar Excel do indicador**: tabela de datas/% de conformidade por execução + gráfico de colunas embutido como imagem.
- **Cabeçalho "Dados do item auditado" na tela de execução**: repete risco relacionado, método/tamanho da amostra, periodicidade, prazo e responsável — sem precisar voltar ao card pra lembrar o contexto do item.
- **Aviso ao fechar a Fase 4 com checklist desbalanceado**: se algum item tiver um checklist com pesos que não somam 100%, o toast de fechamento avisa qual item e o quanto os pesos somam, deixando claro que esse checklist não poderá ser executado até a correção.
- **Campo Contrato/Obra por execução**: texto livre (letras sempre em maiúsculas, números e símbolos preservados) no cabeçalho da tela de execução, obrigatório para liberar "+ Nova execução" e travado assim que a execução começa. Vira filtro no indicador de conformidade (dropdown discreto listando os contratos/obras já usados) e na exportação em Excel — permite comparar o histórico de conformidade de um item específico por contrato/obra.

### Documentação

- **Revisão completa da documentação do app** (item 46 do backlog): a documentação da Fase 4 (botão "? Documentação" → Plano de Auditoria) e o texto explicativo do próprio módulo foram conferidos e atualizados pra refletir todo o incremento de checklist/peso/conformidade/Contrato/Obra desta versão — incluindo uma menção que tinha ficado de fora, "Exportar PDF" por execução. As demais 7 fases, a documentação geral (tela inicial) e os textos de cada outro módulo foram revisados e continuam batendo com o comportamento atual — nenhuma outra divergência encontrada.

## [v1.8] — 24/09/2026

### Corrigido

- **Tela inicial e documentação geral desatualizadas**: ainda diziam "em 7 fases" (sem contar a Fase 0) — corrigido na landing, nos tooltips de "Gerar dossiê"/"Reabrir Processo" e na documentação geral.
- **Documentação da Fase 7 descrevendo o mecanismo antigo de reabertura de ciclo** (criar cópia do caso com nome novo) — substituído pela descrição real de "Reabrir Processo" (mesmo caso, backup, Dossiê versionado, contador de Ciclo).

## [v1.7] — 24/09/2026

Foco: melhoria contínua no fechamento da Fase 7 deixa de recriar o caso do zero; nova Fase 0 define o projeto e quem aprova/revisa cada fase.

### Adicionado

- **Fase 0 — PM Canvas do Projeto**: nova tela, antes da Fase 1, com os 12 blocos do PM Canvas (Porquê/O quê/Quem/Como/Quando e Quanto — mesma estrutura já usada internamente na Enops), campo de Pitch, e importação/exportação em Excel (modelo baixável, reimportação do preenchido). Segue o mesmo mecanismo de fechar/reabrir/PDF das demais fases.
- **Registro de Aprovador(a)/Revisor(a) por fase**: dentro da Fase 0, uma tabela viva (sempre editável, mesmo com a Fase 0 fechada) define quem aprova e quem revisa cada uma das 7 fases. Essa informação passa a aparecer, automaticamente, como uma tabela no fim do PDF de fechamento de cada fase e em cada página de fase do Dossiê consolidado — substitui, na prática, o antigo "Aprovado por" derivado sozinho da Matriz RACI (que nunca chegou a aparecer visualmente em nenhum PDF).
- **Ícone por fase na barra de navegação**: as 8 abas (Fase 0 a 7) ganharam um ícone próprio, no mesmo estilo visual já usado na barra do caso.
- **Documentação da Fase 0**: botão "? Documentação" com conceito, campos, boas práticas e erros comuns — mesmo padrão das outras 7 fases.
- **Botão "Limpar PM Canvas"**: apaga o Pitch e os 12 blocos de uma vez, com confirmação antes.
- **Botão "Próxima fase"**: ao fim de cada fase (exceto a última), libera assim que ela fecha e navega direto para a fase seguinte.
- **Rodapé de copyright**: "© {ano} Emerson da Cunha — Controller. Todos os direitos reservados." no fim da tela.
- **Importação compatível com o export real do PM Canvas**: além do modelo próprio, a Fase 0 agora lê o mesmo formato que a ferramenta de PM Canvas já usada internamente exporta (colunas Propriedade/Projeto/Título/...) — dá pra subir esse arquivo direto, sem editar nada antes.

### Corrigido

- **Barra de navegação quebrando em duas linhas**: a grade de abas estava fixa em 7 colunas, sem contar com a nova Fase 0 — corrigido para 8.
- **Nome da Fase 0 duplicado** em tooltips e no Dossiê ("Fase 0 — Fase 0 — PM Canvas...").
- **Cards do PM Canvas**: texto cortado (sem quebra de linha), botão de remover desalinhado, sem separação visual entre itens e a coluna — cards reconstruídos com quebra de linha real e contraste de fundo.
- **PDF da Fase 0**: desenhava os 12 blocos em lista linear (retrato, muito espaço vazio) — agora sai em paisagem, numa grade de 5 colunas com os blocos alinhados por linha, igual à distribuição visual da ferramenta de PM Canvas original, e cada bloco desenhado como uma célula com fundo e borda (não só texto solto) pra deixar a separação entre eles evidente.
- **"Fechar fase (gerar PDF)" → "Fechar Fase"**: texto simplificado em todas as 8 fases; botão ganhou o mesmo visual (`.btn.btn-primary`) e ícone do resto do app; "Reabrir fase" também ganhou ícone.
- **"Baixar modelo"/"Importar Excel"** da Fase 0 ficaram mais discretos (estilo `btn-ghost`, antes tão destacados quanto uma ação primária); texto explicativo que estava entre parênteses nos botões virou tooltip.
- **Blocos do PM Canvas com altura variável**: cada bloco crescia sem limite conforme o número de itens, quebrando a leitura em grade — agora têm altura fixa com rolagem própria (mesmo padrão de Papéis/Atividades da Matriz RACI).

### Alterado

- **"Reabrir Processo" substitui o gatilho automático de reabertura de ciclo**: ao fechar a Fase 7, o sistema não pergunta mais se deve criar um caso novo do zero — em vez disso, um botão "Reabrir Processo" aparece ao lado de "Reabrir Fase" na Fase 7 **só quando as 7 fases estão fechadas** (agora incluindo a Fase 0). Ao clicar (com confirmação antes), o processo continua no **mesmo caso**: baixa um backup (.json), gera e versiona o Dossiê consolidado marcando o fechamento do ciclo atual, e reabre as 7 fases para edição — nenhum dado é apagado, nenhuma ferramenta precisa ser recriada do zero a cada ciclo.
- **Dossiê ganha versionamento de ciclo**: `caso.dossieVersoes[]` (novo) registra cada Dossiê gerado ao fechar um ciclo — mesmo padrão já usado no histórico de fechamentos de cada fase, agora também no nível do processo inteiro. O Dossiê avulso ("Gerar dossiê" na barra do caso, a qualquer momento) continua sem versionar.
- **Contador de Ciclo**: a barra do caso agora mostra em qual ciclo do processo você está ("Ciclo 1", "Ciclo 2"...) — incrementado a cada "Reabrir Processo".

## [v1.6] — 23/09/2026

Sétima publicação. Foco: fases fechadas passam a bloquear a edição de verdade (até então só um badge cosmético), mais uma leva de ajustes visuais e de layout a partir de testes reais dentro do app.

### Adicionado

- **Bloqueio de campos ao fechar uma fase**: ao fechar uma fase (gerar a primeira ou qualquer versão do PDF), todos os campos dela (inputs, selects, textareas, botões de adicionar/remover/reordenar, células da Matriz RACI, o campo de texto rico das POPs) ficam bloqueados — clique e teclado não respondem mais, com um aviso visual explicando o motivo. O botão "Reabrir fase" (já existia, mas até agora só mudava a cor do badge) volta a liberar a edição.
- **Exceção deliberada**: botões de leitura (Exportar PDF/Excel da Matriz RACI) continuam liberados mesmo com a fase fechada — bloquear só o que edita dado, não o que só lê/exporta o que já está lá.
- Construído sem tocar em nenhum dos 20 módulos de ferramenta — reaproveita o fato de todos usarem elementos HTML nativos de formulário (`input`/`select`/`button`), bloqueados de uma vez a partir de `app.js`; só o campo de texto rico (que usa `contenteditable`, não um controle nativo) recebeu tratamento à parte, também sem mexer no `richtext.js`.
- **"Fechar fase" não cria mais uma versão nova se a fase já estiver fechada**: como os campos ficam travados assim que a fase fecha, clicar em "Fechar fase (gerar PDF)" de novo sem ter passado por "Reabrir fase" antes agora só baixa novamente o PDF da versão atual (mesmo número, mesma data de "Fechado em") — sem criar uma entrada nova no histórico de fechamentos. Só reabrir e fechar de novo cria uma versão nova de verdade.

### Corrigido

- **Aviso de "Fase fechada" aparecendo em fases que nunca foram fechadas**: bug de CSS — a regra do aviso definia `display:flex` sem levar em conta o atributo `hidden`, então ele aparecia sempre, independente do estado real da fase (mesmo com o badge corretamente mostrando "Aberta"). Os campos continuavam liberados corretamente (isso nunca teve bug), só o aviso mentia visualmente.
- **Botão "Reabrir fase" visível mesmo em fases nunca fechadas**: não tinha efeito nenhum nesse caso, só confundia — agora só aparece quando há de fato algo pra reabrir.
- **Texto do rodapé se sobrepondo nos PDFs**: com um nome de caso e/ou fase mais longo (ex.: "Controle de Agregados — Fase 7: Implantação e Estabelecimento"), o rótulo à esquerda invadia visualmente o texto central de data/hora. Rodapé reestruturado em duas linhas — o rótulo sozinho numa linha, ocupando a largura toda; data/hora e "Página N de M" na linha de baixo — nunca mais colide, além de uma quebra de segurança (texto cortado com "…") se algum dia o rótulo for longo até demais pra uma linha inteira.

### Adicionado

- **Brasão da empresa no cabeçalho do app** (não só nos PDFs) — mesma imagem embutida já usada nos documentos, ao lado do nome do caso na barra superior.
- **Ícones nos botões da barra do caso** (Gerar dossiê, Salvar rascunho, Carregar rascunho, Novo caso) — desenhados do zero como SVG simples (sem biblioteca externa), no mesmo estilo minimalista de traço fino do resto do app.
- **Textos de orientação ao passar o mouse (tooltips)** — componente reutilizável em CSS puro (`data-tooltip="texto"` em qualquer elemento), sem JS nem biblioteca. Aplicado nesta rodada aos botões da barra do caso, abas de fase, badge de status, "Fechar fase"/"Reabrir fase" e botão de Documentação — o texto de "Fechar fase" muda dinamicamente conforme a fase já estar fechada ou não. Pronto pra ser aplicado em campos específicos sempre que solicitado, mesmo padrão do RichText.
- **Gráfico e tabela dos KPIs redesenhados no PDF**: antes ocupavam só ~350pt de uma página com ~515pt úteis, sobrando bastante espaço em branco à direita — gráfico e tabela agora dimensionados pra usar a largura útil da página inteira. O gráfico também ganhou datas no eixo X (até 4, bem espaçadas, nunca uma por ponto) e o valor do primeiro e do último ponto rotulado diretamente na plotagem — com um fundo branco atrás de cada rótulo pra continuar legível mesmo quando a linha do gráfico passa por cima.

## [v1.5] — 23/09/2026

Sexta publicação. Foco: revisão completa da formatação de todos os PDFs gerados pela solução (fechamento de fase e Dossiê consolidado), a partir de PDFs reais exportados do caso "Controle de Agregados" e de pontos apontados diretamente sobre eles — com duas rodadas de correção a partir dos seus testes reais dentro do app (estouro de texto no Fluxograma, lista numerada sumindo no PDF, bloco "Aprovado por", página própria por ferramenta) — **testada e validada por você em 23/09/2026**.

### Adicionado

- **Cabeçalho e rodapé padronizados em todos os PDFs**: cabeçalho com brasão da empresa, título, versão e data/hora completa (dia + horário) na primeira página do fechamento de fase e na capa/cada página de fase do Dossiê; rodapé com linha de contexto (caso — fase), data/hora de geração e **"Página N de M"** em absolutamente todas as páginas de qualquer PDF gerado.
- Novo módulo reutilizável `js/core/pdf-doc.js` — infraestrutura compartilhada de cabeçalho/rodapé/paginação/título de seção, usada tanto pelo fechamento de fase quanto pelo Dossiê (mesmo princípio de módulo compartilhado já usado no RichText e na geometria do Fluxograma).
- Brasão da empresa embutido (`js/core/logo-data.js`) para uso no cabeçalho dos PDFs — carregado localmente (sem depender de internet ou de o app estar publicado).
- **Bloco de aprovação reformulado e depois removido**: "Aprovado por" deixou de ser uma linha solta no fim da página (virou um bloco com linha divisória, rótulo e valor em destaque) e, numa segunda rodada a seu pedido, foi **removido de todos os documentos** (fechamento de fase e Dossiê, inclusive a tabela-resumo da capa) — funcionalidade não utilizada no momento; o cálculo interno continua existindo (histórico de fechamentos), só não é mais impresso.
- **Cada ferramenta agora começa numa página própria** no PDF de fechamento de fase e em cada página de fase do Dossiê — nenhuma ferramenta divide página com outra, evitando qualquer mistura de conteúdo entre elas.
- **Novo título de seção para cada ferramenta**: rótulo pequeno (caso + fase) em caixa alta na cor de destaque, uma barra vertical colorida, o nome da ferramenta em negrito e uma linha divisória — a mesma identidade visual do cabeçalho principal, repetida em escala menor no início de cada ferramenta.

### Corrigido

- **Título do Fluxograma desconectado do diagrama entre páginas**: tanto o título de seção ("Fluxograma do Processo") quanto o título de cada fluxo ("Fluxo: Nome") agora calculam a altura real do diagrama *antes* de decidir se quebram a página — título e desenho sempre ficam juntos, nunca mais um em cada página (superado depois pela página própria por ferramenta, que resolve isso de forma ainda mais direta).
- **Texto ilegível nas POPs vindo de conteúdo colado do Word**: marcadores decorativos (Wingdings/Webdings) ou emojis colados no campo "Instruções / passo a passo" apareciam como caracteres quebrados no PDF (ex.: "Ø=ÞÒ") — agora qualquer caractere fora do alfabeto suportado pela fonte do PDF vira um marcador neutro ("•"), nunca um glifo ilegível.
- **Texto do Fluxograma estourando para fora da caixa da etapa**: a quebra de linha usava contagem de caracteres, que não sabia que a fonte tinha um tamanho mínimo diferente da caixa quando o diagrama era escalado para baixo (muitas raias). Agora a quebra mede a largura real do texto no PDF — nunca mais ultrapassa a borda da caixa.
- **Formatação de lista (numerada/com marcadores) sumindo no PDF**: causa raiz confirmada — o leitor do conteúdo do campo de texto rico só reconhecia listas/parágrafos no nível superior do conteúdo; quando o navegador aninhava a lista mais fundo (ex.: dentro de mais de um `<div>` envolvendo outros parágrafos ao redor), ela virava texto corrido, sem números nem quebra de linha nenhuma. Reescrito para percorrer a árvore inteira recursivamente — reconhece listas e parágrafos em qualquer profundidade de aninhamento, não só no nível superior.
- Respiro visual entre POPs (linha divisória + espaçamento maior entre um procedimento e o próximo) e entre o cabeçalho de cada POP (título/etapa/responsável) e o texto das instruções.

### Testado

- Harness headless (chamadas diretas às funções de desenho + `doc.output()`, sem acionar o download real) cobrindo: Fluxograma de 6 raias forçando quebra de página, POP com 10 parágrafos incluindo negrito/itálico/caractere fora do alfabeto/emoji, título de etapa longo sem espaços quebráveis, lista `<ol>/<li>` real, e texto com `\n` literal dentro de um único bloco — PDF de fechamento de fase e Dossiê inspecionados página a página em cada rodada.

## [v1.4] — 23/09/2026

Quinta publicação. Foco: campo de texto rico no procedimento operacional (POP), Fase 3 — Modelagem.

### Adicionado
- **Campo "Instruções / passo a passo" (POPs) com formatação de texto**: barra com negrito, itálico, sublinhado, tachado, lista com marcadores e lista numerada — a formatação aplicada aparece também no PDF de fechamento da fase, não só na tela.
- Novo módulo reutilizável `js/core/richtext.js` — base para aplicar esse mesmo campo de texto rico em outros pontos do app quando solicitado.

### Alterado
- O campo de instruções dos POPs deixou de ter limite de 2000 caracteres — agora aceita qualquer tamanho de procedimento.

### Corrigido
- Nenhuma correção nesta versão (POPs já salvos com texto simples continuam funcionando normalmente, sem necessidade de ação).

## [v1.3.2] — 22/09/2026

Correção de infraestrutura — sem mudança visível na ferramenta em si. Depois de publicar a v1.3, você reportou que a atualização "não surtiu nenhuma alteração" no site já publicado.

### Corrigido
- **Cache do navegador escondendo atualizações**: `index.html` carregava `css/app.css`, `js/app.js` e todos os outros arquivos `.css`/`.js` sempre pelo mesmo nome — o navegador guardava uma cópia antiga em cache e não buscava a versão nova mesmo depois do GitHub Pages já estar atualizado. Corrigido adicionando um carimbo de versão (`?v=1.3.2`) em todo link/script interno do `index.html` — a cada nova versão publicada, esse carimbo muda, obrigando o navegador a buscar os arquivos de novo em vez de reaproveitar o cache antigo.
- A partir de agora, toda nova versão deste changelog deve vir acompanhada da atualização desse carimbo em `index.html` (buscar e trocar `?v=1.3.2` pelo número novo em todas as ocorrências).

## [v1.3] — 22/09/2026

Quarta publicação. Foco: correções e polimento visual do Fluxograma do Processo (Fase 3 — Modelagem), a partir de testes reais feitos direto no app já publicado.

### Adicionado
- **Cores por tipo de nó e por ramo de decisão**: Início (círculo verde), Fim (quadrado vermelho, antes era círculo), Decisão (losango em amarelo escuro). Ramo "Sim" de uma decisão sempre verde, ramo "Não" sempre vermelho — na linha do conector e no rótulo, tela e PDF.
- **Roteamento de conectores sem sobreposição**: conexões entre raias diferentes agora entram pelo topo ou por baixo do destino (conforme a raia de origem estiver acima ou abaixo), em vez de sempre cruzar pelo meio do diagrama. Conexões de fluxo circular (voltando para uma etapa anterior) saem pela esquerda da caixa de origem, espelhando a lógica usada para o fluxo em frente.
- **Rótulo do ramo proporcional ao texto**: a caixa atrás do texto do rótulo (ex.: "Autorizado") agora mede o texto real antes de desenhar, em vez de usar uma largura fixa que estourava em palavras mais longas.
- **Papel vinculado exibido na prévia do diagrama e no PDF**: quando uma raia tem um papel da Matriz RACI vinculado, o nome do papel aparece discretamente abaixo do nome da raia, na lateral esquerda do diagrama — tela e PDF.

### Corrigido
- Linha do conector "colada" na borda da caixa de origem (efeito de gancho) — agora a linha anda um pequeno trecho reto se afastando da caixa antes de virar.
- Trecho de travessia entre raias estava enviesado para o lado contrário ao do destino, alongando o caminho desnecessariamente.

## [v1.2] — data não confirmada

Publicação intermediária — mesmo conteúdo da v1.1 (tela inicial), sem alterações de código identificadas neste histórico.

## [v1.1] — 22/09/2026

Terceira publicação. Foco: tela de entrada do sistema.

### Adicionado
- **Tela inicial (landing)**: ao abrir o site sem nenhum caso salvo no navegador, aparece uma tela com dois botões — "Iniciar novo processo" e "Carregar processo" (mesmas funções de "Novo caso" e "Carregar rascunho") — e um botão de documentação geral explicando o sistema como um todo e avisando que cada fase tem sua própria documentação.

## [v1.0] — 17/09/2026

Primeira publicação no GitHub Pages.

### Adicionado
- Aplicativo completo do Construtor de Processos: 7 fases (Diagnóstico, Governança, Modelagem, Auditoria, Sistemas, Piloto, Implantação), 18 ferramentas ao longo delas, fechamento de fase em PDF, dossiê consolidado do caso, salvar/carregar rascunho (.json).
- Documentação por fase ("? Documentação" em cada fase) com conceito, campos, boas práticas, erros comuns e exemplo prático de cada ferramenta.
- Cabeçalho leve padronizado em todas as ferramentas; cabeçalho da Matriz RACI adaptado ao mesmo padrão.
- Botão "Novo caso" para acompanhar mais de um processo em paralelo.

### Alterado
- **Template padrão da Matriz RACI (Fase 2) sem nomes reais**: o modelo pré-preenchido (baseado no papel de Controller) mantém a estrutura de área/cargo, mas o campo Nome ficou em branco — os nomes reais de colegas foram removidos do código-fonte antes da primeira publicação pública.

---

*Este arquivo é atualizado a cada preparação de novos arquivos para o GitHub — peça para eu prepará-lo junto na próxima vez que subir uma alteração.*

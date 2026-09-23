# Changelog — Construtor de Processos

Histórico de versões publicadas no GitHub Pages. Formato: [v.MAJOR.MINOR] — o que mudou desde a versão anterior.

> **Nota (23/09/2026):** o sistema está em beta-teste de produção controlada. Todas as versões `v1.x` são versões de teste — correções e atualizações frequentes são esperadas até o beta amadurecer.

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

# Construtor de Processos

**Ferramenta de consultoria interna da Enops** para conduzir a implantação de um processo de negócio do diagnóstico ao encerramento, em **7 fases estruturadas** — com uma ferramenta própria por etapa, documentação de apoio integrada e fechamento formal em PDF a cada fase concluída.

🔗 **Acesse:** [cravomagno.github.io/processbuilder](https://cravomagno.github.io/processbuilder/)

> **Beta-teste de produção controlada.** Todas as versões `v1.x` são versões de teste — correções e atualizações frequentes são esperadas até o beta amadurecer. Veja o [`CHANGELOG.md`](CHANGELOG.md) para o histórico completo de cada versão publicada.

## O que a ferramenta faz

O Construtor de Processos guia um processo de negócio por um backbone fixo de 7 fases, cada uma com suas próprias ferramentas de análise e registro:

| Fase | Ferramentas |
|---|---|
| 1. Diagnóstico e Viabilidade | Termo de Abertura, Matriz GUT, Diagrama de Ishikawa (6M), 5 Porquês |
| 2. Governança e Compliance | Matriz RACI, Matriz de Alçadas, Segregação de Funções |
| 3. Modelagem do Processo | Plano de Ação (5W2H), Fluxograma do Processo (com raias por papel), POPs / Instruções de Trabalho |
| 4. Auditoria, Riscos e Controles | Matriz de Riscos, Plano de Auditoria, Regras de Divergência/Exceção |
| 5. Sistemas, Tecnologia e Documentação | Matriz de Rastreabilidade, Sistemas (Aquisição/Desenvolvimento) |
| 6. Piloto e Gestão de Mudança | Plano de Treinamento (com lista de presença) |
| 7. Implantação e Estabelecimento | KPIs/Indicadores, Checklist de Implantação, Termo de Encerramento |

Cada ferramenta se retroalimenta das demais (ex.: responsáveis vêm da Matriz RACI, etapas do Fluxograma alimentam as POPs) para manter os dados consistentes entre fases, em vez de digitados soltos em cada uma.

**Recursos transversais** (não amarrados a uma fase específica):

- **Fechamento de fase em PDF**, versionado — cada fechamento gera um documento formal (cabeçalho com brasão, rodapé com numeração de página, uma página própria por ferramenta) e fica registrado no histórico da fase; reabrir uma fase fechada libera a edição de novo.
- **Dossiê consolidado**: um único PDF com a capa-resumo das 7 fases e o conteúdo de cada uma, gerado a qualquer momento.
- **Salvar/Carregar rascunho**: exporta e importa o caso inteiro como um arquivo `.json`, para continuar depois ou manter um backup.
- **Documentação por fase**: cada fase e cada campo tem uma explicação própria (conceito, boas práticas, erros comuns), acessível direto na tela.
- **Múltiplos casos em paralelo** — "Novo caso" abre um processo do zero sem descartar o atual.

## Como funciona por dentro

- **100% estático** — HTML/CSS/JavaScript puro, sem build step, sem backend e sem framework. Basta abrir `index.html` num navegador.
- **Sem servidor**: todos os dados ficam apenas no `localStorage` do navegador de quem está usando — nada é enviado a servidores externos.
- Geração de PDF via [jsPDF](https://github.com/parallax/jsPDF) e exportação de planilha (Matriz RACI) via [ExcelJS](https://github.com/exceljs/exceljs), ambos embutidos localmente (sem dependência de CDN em tempo de uso).
- Publicado no [GitHub Pages](https://pages.github.com/) diretamente a partir deste repositório.

## Usar localmente

Não há instalação nem dependências — é só abrir o arquivo:

```bash
git clone https://github.com/cravomagno/processbuilder.git
cd processbuilder
# abra index.html no navegador
```

## Estrutura do repositório

```
index.html            → ponto de entrada do app
css/                   → estilos (shell + telas)
js/
  core/                → infraestrutura compartilhada (estado do caso, PDFs, texto rico, navegação)
  modules/              → uma ferramenta por arquivo (RACI, Fluxograma, KPIs, etc.)
  lib/                   → bibliotecas embutidas (jsPDF, ExcelJS)
assets/                → brasão usado no cabeçalho do app e dos PDFs
CHANGELOG.md           → histórico de versões publicadas
```

---

*Enops Engenharia — uso interno.*

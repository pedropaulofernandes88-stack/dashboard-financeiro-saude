# Validação da primeira versão

Executada em 10/09/2026, Windows, Node.js 24.19.0 e npm 11.17.0.

## Verificações automatizadas

- `npm run check`: TypeScript estrito, 21 testes e build de produção aprovados.
- `npm audit --omit=dev`: nenhuma vulnerabilidade reportada nas dependências de produção nessa data.
- Testes de finanças: integridade da base, pagamentos parciais, contas antigas, corte temporal, glosas/reversões/baixas, recuperação, filtros, nulos, duplicidades e ordenação dos eventos.
- Testes de CSV: centavos, separadores, aspas, BOM UTF-8, proteção de fórmulas e correspondência entre recorte e linhas exportadas.

## Conferência de interface

- Navegação, cartões, gráficos e tabelas no navegador do Codex.
- Mês final alterado para janeiro: posição atualizada para 31/01/2026 e valores limitados ao período.
- Filtro de pagador na página de custos: resultado indisponível, com explicação de ausência de rateio.
- Pesquisa da conta F-0006 e abertura do seu histórico de pagamentos e glosa.
- Fechamento do diálogo com Escape e retorno do foco ao botão da conta, verificado na versão compilada.
- Layout em viewport desktop e em 390 × 844; visão geral e página de glosas sem rolagem horizontal da página. Tabelas largas conservam rolagem interna.
- Menu mobile abre, navega e fecha.
- Versão compilada servida localmente em porta 4173, sem erros de console observados nas jornadas verificadas.
- Botão Exportar CSV acionado e confirmação apresentada. O conteúdo foi validado pelos testes; a captura automatizada do evento de download não foi confirmada pelo navegador integrado.

## Limites

Esta é uma validação funcional amostrada. Não equivale a auditoria completa de acessibilidade, teste de carga, homologação contábil, validação em todos os navegadores ou integração com dados reais. A demonstração não é um sistema de produção com autenticação, autorização ou persistência.

# Validação do Pulso

## Versão 2 — inteligência assistencial e central de glosas

Executada em 10/09/2026, com base sintética de 384 contas e 48 casos de glosa. A versão 2 exclui glosas do pagador Particular e varia o intervalo serviço→faturamento; por isso alguns valores demonstrativos diferem da versão 1.

- TypeScript estrito, 43 testes em cinco arquivos e build de produção aprovados.
- Novos testes: composição dos itens, perfis assistenciais, cobertura conta/caso/evento, datas e protocolo, coortes, Pareto limitado a 100%, período sem histórico, comparação preservando filtros, hipóteses de recuperação, CSV assistencial e proteção de fórmulas.
- Glosas parciais verificadas: baixa não encerra uma disputa restante; valor parcialmente liberado continua na fila; recuperação recebida é separada de reversão; encerramento com perda parcial não aparece como recuperação integral.
- Revisão independente dos casos de alocação, temporalidade e estados; ajustes incorporados e testes direcionados aprovados.
- Versão compilada inspecionada no navegador integrado em 1280 × 900 e 390 × 844. Novas telas sem rolagem horizontal do documento; tabelas extensas e itens no diálogo têm rolagem interna.
- Verificados: filtro de notificação somente agosto mantendo carteira anterior; busca de F-0006 e cronologia do recurso; situação Em análise + prazo Vencido; fechamento com Escape e retorno do foco; menu mobile; pesquisa de F-0003 e composição da conta; simulação a 100% limitada ao saldo elegível; janeiro sem histórico anterior; botão por pagador levando à carteira e estado Particular sem glosas.
- CSV validado por conteúdo nos testes. O componente de fila oferece exportação do recorte local; a captura do arquivo salvo pelo navegador integrado não foi validada automaticamente.

As limitações de validação amostrada, ausência de backend e ausência de homologação clínica/contábil continuam aplicáveis.

## Registro da primeira versão

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

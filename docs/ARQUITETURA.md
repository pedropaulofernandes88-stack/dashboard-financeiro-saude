# Arquitetura e caminho de integração

## Separação de responsabilidades

```mermaid
flowchart LR
  A[Dataset sintético determinístico] --> B[Validação estrutural e financeira]
  B --> C[Cálculos por período e posição]
  C --> D[Cartões, gráficos e tabelas]
  C --> E[Exportação CSV]
```

`src/domain/types.ts` descreve unidades, pagadores, contas, eventos, custos e metas. `src/domain/finance.ts` é a única origem dos valores financeiros. `App.tsx` aplica filtros e apresenta o contexto. As telas e o exportador consomem o mesmo resultado.

A aplicação opera no navegador e não faz chamadas de dados a serviços externos. A base demonstrativa é distribuída junto com a aplicação. Não existe login, multiusuário, escrita financeira, importador ou persistência de registros.

## Fontes e grãos

| Entidade | Grão                                    | Observações                                                                        |
| -------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| Conta    | Uma cobrança original                   | Identificador único, unidade, pagador, serviço, datas e valor inteiro em centavos. |
| Evento   | Um movimento financeiro de uma conta    | Pagamento, glosa, reversão ou baixa. Valores positivos; o tipo determina o efeito. |
| Custo    | Lançamento por unidade, mês e categoria | Não atribuído a pagador.                                                           |
| Meta     | Unidade e mês                           | Uma versão nesta demo; versionamento e vigência exigem expansão do contrato.       |

`serviceDate`, `billedDate`, `dueDate` e `FinancialEvent.date` são campos distintos. O resultado demonstrativo é baseado na emissão. Não se deve renomeá-lo para receita contábil reconhecida sem definir a política do prestador.

## Validação

O motor verifica integridade e consistência aritmética antes da apresentação. Testes cobrem corte temporal, pagamentos parciais, eventos posteriores à posição, glosas, valores nulos sem base comparável, metas alinhadas e reconciliação. O CSV é testado para preservação monetária e proteção contra execução de fórmulas em planilhas.

Na integração real, uma validação de entrada em tempo de execução deverá verificar também a forma de JSON/CSV externo, antes de tratá-lo como `Dataset`. A função do modelo é voltada ao contrato tipado; TypeScript sozinho não valida dados recebidos pela rede.

## Integração real, em sequência

1. Definir clínica, hospital, laboratório ou outro prestador, unidades e pagadores.
2. Selecionar a fonte autorizada: ERP/faturamento, retornos dos pagadores, banco, custos e orçamento.
3. Mapear IDs estáveis de conta, item, lote, parcela, pagamento e recurso. A versão atual tem eventos por conta; contratos complexos podem exigir itens e alocação de pagamentos entre várias contas.
4. Definir política de cancelamento, estorno, impostos, retenções, provisões e reconhecimento da receita. Esses eventos não devem ser codificados como glosas por conveniência.
5. Implementar adaptador com extração reproduzível, validação, deduplicação e reconciliação. Não sobrescrever dados originais.
6. Acrescentar backend autenticado, autorização por unidade/função e acesso ao detalhe. Dados reais ficam fora do bundle e do Git.
7. Conciliar um período fechado, por conta e total, com os relatórios oficiais do prestador antes de uso operacional.

## Escopo dos alertas

Os alertas derivam dos números disponíveis: saldo vencido, saldo em disputa, resultado negativo e metas. Não atribuem causas clínicas ou comerciais e não utilizam IA. Os limiares demonstrativos não são parâmetros setoriais ou limites oficiais.

## Extensão assistencial da versão 2

`HealthData` complementa `Dataset` por identidade de conta e evento de glosa. A fonte financeira continua responsável pelos pagamentos, reversões e baixas. `calculateHealth` mantém o mesmo corte temporal e reconcilia o valor glosado em discussão, liberado sem recebimento, recuperado e baixado. O validador exige cobertura da extensão e rejeita múltiplas glosas por conta enquanto não houver alocação explícita por caso.

`GlosasPage` apresenta carteira acumulada e coorte de notificações do período com nomes diferentes. Filtros locais afetam somente a fila e sua exportação. Os estados de recurso dependem de submissão/protocolo; o status financeiro `Em disputa` não atesta que um recurso foi enviado.

`IntelligencePage` reúne análises por especialidade e pagador e a inspeção de guias/itens. `compareLatestMonth` compara os dois últimos meses calendários completos, preservando unidade/pagador e exigindo cobertura do mês anterior. O início de cobertura de faturamento da demo é janeiro de 2026; um adaptador real deve fornecer esse metadado. Não há ajuste por sazonalidade ou dias úteis.

`recoveryScenario` trata percentuais como hipóteses declaradas, com valores em centavos. Aplica as hipóteses separadamente aos saldos exclusivos em disputa e liberados sem caixa, sem incorporar perdas ou valores recuperados. Não produz lançamento financeiro nem previsão de prazo.

Esta versão mantém execução no navegador e dados sintéticos. Envio de recursos, anexos, resposta de operadoras, gestão documental e autenticação não são simulados como ações persistentes. Ao integrar dados reais, essas ações devem possuir backend, autorização, trilha de auditoria e alocação por guia/item/caso.

## Referências de domínio

- [ANS: faturamento e pagamento dos serviços prestados](https://www.gov.br/ans/pt-br/assuntos/prestadores/fator-de-qualidade-1/obrigatoriedade-do-contrato-escrito-1/faturamento-e-pagamento-dos-servicos-prestados): condições e prazos próprios da relação entre prestador e operadora.
- [ANS: indicadores de glosa](https://www.gov.br/ans/pt-br/acesso-a-informacao/perfil-do-setor/dados-e-indicadores-do-setor/painel-de-indicadores-de-glosa): referência externa; as métricas deste projeto não declaram equivalência aos indicadores oficiais.

Os dados públicos dessas páginas não foram usados como se fossem as contas do prestador. Na integração com operadoras, a versão do TISS e o mapeamento de mensagens deverão ser conferidos na documentação vigente naquele momento.

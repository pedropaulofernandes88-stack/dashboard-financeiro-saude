# Pulso · Finanças da saúde

Dashboard de gestão financeira para prestadores de serviços de saúde. Acompanhe faturamento, recebimentos, contas a receber, glosas, recuperação, custos e metas por unidade e pagador.

**Demonstração funcional com dados sintéticos.** A Rede Horizonte, suas unidades, pagadores e contas são fictícios. Nenhuma informação de paciente é utilizada. A aplicação ainda não está integrada a um ERP, banco ou sistema de faturamento real.

## Executar

Requer Node.js 22.12+ (recomendado: Node.js 24) e npm.

```bash
npm ci
npm run dev
```

Abra o endereço local informado pelo Vite, normalmente `http://127.0.0.1:5173`.

```bash
npm run check   # tipos, testes financeiros/CSV e compilação
npm run build   # aplicação estática em dist/
npm run preview # servir localmente o resultado compilado
```

O código é React + TypeScript, com Vite, Recharts e Lucide. Os cálculos usam centavos inteiros e funções puras. Não são necessárias chaves de API ou credenciais.

## O que funciona

| Tela                 | Capacidades                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visão geral          | Faturamento e recebimentos contra metas, carteira em aberto, glosas em recurso, evolução mensal, composição por pagador, alertas e resultado gerencial. |
| Faturamento e caixa  | Séries mensais, tabela por pagador e prazo de quitação.                                                                                                 |
| Contas a receber     | Aging, pesquisa, filtro de situação, paginação e histórico financeiro de cada conta.                                                                    |
| Glosas e recuperação | Glosas do período, taxa da coorte, motivos, saldo em recurso e recuperação recebida.                                                                    |
| Custos e resultado   | Composição de custos, resultado e margem demonstrativos.                                                                                                |
| Guia                 | Definições das métricas, datas e limites da demonstração.                                                                                               |

Filtros de mês inicial/final, unidade e pagador. O mês final define também a data da posição da carteira, limitada à data de corte da base. A carteira inclui contas antigas ainda em aberto; o mês inicial limita os fluxos, não apaga a dívida anterior.

As exportações CSV têm BOM UTF-8, separador `;`, valores em reais, contexto dos filtros e proteção contra fórmulas em campos textuais. O CSV de contas exporta todo o conjunto do recorte global, independentemente da página da tabela, pesquisa ou filtro local de situação.

A interface se adapta a desktop e celular, usa controles nativos e oferece tabelas como alternativa aos gráficos. O detalhe de conta abre em diálogo com suporte a Escape e retorno do foco.

## Modelo financeiro

- Faturamento é apurado pela emissão da conta; recebimentos, pela data do pagamento.
- Saldo aberto = faturado − pagamentos − baixas definitivas, até a posição selecionada.
- Glosas em recurso fazem parte do saldo aberto. Não são somadas novamente à carteira.
- Reversão administrativa da glosa não é entrada de caixa. Recuperação só é contada em pagamento vinculado à reversão.
- Resultado gerencial = faturamento − baixas definitivas registradas no período − custos da competência. **Não é lucro contábil** e não inclui impostos, provisões ou todos os ajustes de uma DRE real.
- Custos, resultado e metas não são apresentados por pagador, pois o exemplo não possui rateio nessa dimensão.
- Metas mensais são somadas para os mesmos meses do realizado. A demo usa uma versão de orçamento por unidade/mês.

Leia [as definições completas](docs/METRICAS.md) e [a arquitetura e integração](docs/ARQUITETURA.md).

## Estrutura

```text
src/
  data/demo.ts        # 384 contas e eventos sintéticos determinísticos
  domain/types.ts     # contratos de dados e métricas
  domain/finance.ts   # validação, posição e cálculos
  App.tsx            # navegação, filtros, visão geral e detalhe de conta
  DetailPages.tsx    # telas financeiras e guia
  export.ts          # CSV seguro e contextualizado
  format.ts          # moeda, percentuais e datas pt-BR
tests/               # invariantes financeiros e exportação
docs/                # definições e caminho de integração
.github/workflows/   # verificação automática em push e pull request
```

## Usar dados reais

O ponto de substituição é o contrato `Dataset` em `src/domain/types.ts`. Antes de integrar, definir a origem dos dados, granularidade das contas/itens, regras contratuais, semântica de glosa e reconhecimento da receita. Em seguida, implementar um adaptador e reconciliar a extração com o sistema financeiro.

Não colocar arquivos reais nem credenciais no repositório ou no bundle estático. A versão atual não implementa autenticação, autorização por unidade, importador de arquivos ou banco persistente. Para uma operação real, essas capacidades devem ser construídas e verificadas no servidor conforme a infraestrutura e os acessos definidos pelo prestador.

## Referência conceitual

Inspirado na organização por perguntas de gestão e na separação entre métricas e interface de [dashboard-financeiro-frotas, de Ronald Martins](https://github.com/ronaldmartinsx/dashboard-financeiro-frotas). Esta implementação possui código, identidade visual e modelo financeiro próprios; não incorpora código ou ativos do projeto de referência.

## Escopo da versão

Primeira versão demonstrativa, privada, sem publicação em hospedagem externa. O build está pronto para servir como aplicação estática quando o destino de hospedagem for definido. A escolha de licença para distribuição futura permanece com o proprietário do repositório (`UNLICENSED`).

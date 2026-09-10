# Pulso · Finanças da saúde

Dashboard de gestão financeira para prestadores de serviços de saúde. Acompanhe faturamento, recebimentos, contas a receber, glosas, recuperação, custos e metas por unidade e pagador.

A versão 2 acrescenta inteligência assistencial, contas detalhadas em itens, comparação mensal e uma central de glosas com prazos, protocolos, coortes e fila de trabalho.

**Demonstração funcional com dados sintéticos.** A Rede Horizonte, suas unidades, pagadores e contas são fictícios. Nenhuma informação de paciente é utilizada. A aplicação ainda não está integrada a um ERP, banco ou sistema de faturamento real.

**Uso gratuito exclusivamente não comercial.** Consulte a [licença completa](LICENSE). A gratuidade não autoriza revenda, SaaS pago ou uso em operações comerciais, inclusive de prestadores privados de saúde.

## Acessar o projeto

[Repositório no GitHub](https://github.com/pedropaulofernandes88-stack/dashboard-financeiro-saude) · [Texto de apresentação da ferramenta](docs/PUBLICACAO.md)

O repositório está privado neste momento: é necessário ter acesso concedido pelo proprietário para baixar ou clonar. O texto de apresentação está salvo para divulgação; nenhuma postagem em rede social foi feita.

## Executar

Requer Node.js 22.12+ (recomendado: Node.js 24) e npm.

Com acesso ao repositório, baixe o código ou execute:

```bash
git clone https://github.com/pedropaulofernandes88-stack/dashboard-financeiro-saude.git
cd dashboard-financeiro-saude
```

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

| Tela                      | Capacidades                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visão geral               | Faturamento e recebimentos contra metas, carteira em aberto, glosas em disputa, evolução mensal, composição por pagador, alertas e resultado gerencial.                                     |
| Faturamento e caixa       | Séries mensais, tabela por pagador e prazo de quitação.                                                                                                                                     |
| Contas a receber          | Aging, pesquisa, filtro de situação, paginação e histórico financeiro de cada conta.                                                                                                        |
| Central de glosas         | Conciliação do valor glosado, coortes por notificação, motivos, prazos de submissão/resposta, responsáveis, checklist e histórico. Fila com busca, filtros, paginação e exportação própria. |
| Inteligência assistencial | Ticket por conta, tempo até faturar, documentação, faturamento por especialidade, comparação entre meses, exposição por pagador, guias/procedimentos e simulador de recuperação.            |
| Custos e resultado        | Composição de custos, resultado e margem demonstrativos.                                                                                                                                    |
| Guia                      | Definições das métricas, datas e limites da demonstração.                                                                                                                                   |

Filtros de mês inicial/final, unidade e pagador. O mês final define também a data da posição da carteira, limitada à data de corte da base. A carteira inclui contas antigas ainda em aberto; o mês inicial limita os fluxos, não apaga a dívida anterior.

As exportações CSV têm BOM UTF-8, separador `;`, valores em reais, contexto dos filtros e proteção contra fórmulas em campos textuais. O CSV de contas exporta todo o conjunto do recorte global, independentemente da página da tabela, pesquisa ou filtro local de situação.

A interface se adapta a desktop e celular, usa controles nativos e oferece tabelas como alternativa aos gráficos. O detalhe de conta abre em diálogo com suporte a Escape e retorno do foco.

Na central de glosas, os totais acumulados até a posição incluem casos anteriores ao mês inicial. O bloco de coorte do período considera apenas notificações entre os meses escolhidos e acompanha a recuperação dessas mesmas glosas. O CSV do topo segue os filtros globais; **Exportar fila atual** inclui também busca, situação, categoria, responsável e prazo, independentemente da paginação.

Os sinais de inteligência são cálculos e regras explicáveis. O simulador aplica percentuais escolhidos pelo usuário aos saldos em discussão e liberados ainda sem caixa. Não utiliza IA generativa, probabilidades preditivas ou benchmarks setoriais e não altera os valores realizados.

## Modelo financeiro

- Faturamento é apurado pela emissão da conta; recebimentos, pela data do pagamento.
- Saldo aberto = faturado − pagamentos − baixas definitivas, até a posição selecionada.
- Glosas em disputa fazem parte do saldo aberto. Não são somadas novamente à carteira.
- Reversão administrativa da glosa não é entrada de caixa. Recuperação só é contada em pagamento vinculado à reversão.
- Resultado gerencial = faturamento − baixas definitivas registradas no período − custos da competência. **Não é lucro contábil** e não inclui impostos, provisões ou todos os ajustes de uma DRE real.
- Custos, resultado e metas não são apresentados por pagador, pois o exemplo não possui rateio nessa dimensão.
- Metas mensais são somadas para os mesmos meses do realizado. A demo usa uma versão de orçamento por unidade/mês.

Leia [as definições financeiras](docs/METRICAS.md), [os indicadores assistenciais e as glosas](docs/SAUDE-E-GLOSAS.md) e [a arquitetura e integração](docs/ARQUITETURA.md).

## Estrutura

```text
src/
  data/demo.ts        # 384 contas e eventos sintéticos determinísticos
  domain/types.ts     # contratos de dados e métricas
  domain/finance.ts   # validação, posição e cálculos
  domain/health.ts    # extensão assistencial, conciliação e fila de glosas
  domain/intelligence.ts # comparação mensal e cenários explícitos
  data/health-demo.ts # guias, procedimentos, itens e recursos fictícios
  App.tsx            # navegação, filtros, visão geral e detalhe de conta
  DetailPages.tsx    # telas financeiras e guia
  IntelligencePage.tsx # análises assistenciais e simulador
  GlosasPage.tsx     # central e detalhe dos casos
  export.ts          # CSV seguro e contextualizado
  health-export.ts   # CSV assistencial e de casos acumulados
  format.ts          # moeda, percentuais e datas pt-BR
tests/               # invariantes financeiros e exportação
docs/                # definições e caminho de integração
.github/workflows/   # verificação automática em push e pull request
```

## Usar dados reais

O ponto de substituição é o contrato `Dataset` em `src/domain/types.ts`. Antes de integrar, definir a origem dos dados, granularidade das contas/itens, regras contratuais, semântica de glosa e reconhecimento da receita. Em seguida, implementar um adaptador e reconciliar a extração com o sistema financeiro.

A extensão `HealthData` exige cobertura das contas e glosas da fonte. Os códigos `INT-*` não são TUSS e a demo não troca mensagens TISS. O checklist representa a condição na emissão, sem gestão de anexos ou atualização posterior. Recursos reais por item, múltiplas reapresentações e diferentes versões de contratos exigem eventos e alocações explícitas; a demonstração admite uma ocorrência de glosa por conta.

Não colocar arquivos reais nem credenciais no repositório ou no bundle estático. A versão atual não implementa autenticação, autorização por unidade, importador de arquivos ou banco persistente. Para uma operação real, essas capacidades devem ser construídas e verificadas no servidor conforme a infraestrutura e os acessos definidos pelo prestador.

## Referência conceitual

Inspirado na organização por perguntas de gestão e na separação entre métricas e interface de [dashboard-financeiro-frotas, de Ronald Martins](https://github.com/ronaldmartinsx/dashboard-financeiro-frotas). Esta implementação possui código, identidade visual e modelo financeiro próprios; não incorpora código ou ativos do projeto de referência.

## Escopo da versão

Versão demonstrativa privada, sem publicação em hospedagem externa. O build está pronto para servir como aplicação estática quando o destino de hospedagem for definido, respeitada a licença.

## Licença

O material original do Pulso está sob a **Licença Pulso — Uso Gratuito Não Comercial 1.0** (`LicenseRef-Pulso-NonCommercial-1.0`). O texto integral está no arquivo [LICENSE](LICENSE); os metadados npm apontam para esse arquivo.

- Permite baixar, executar, estudar, copiar, modificar e compartilhar gratuitamente para finalidades não comerciais, preservando a licença e os avisos de autoria.
- Proíbe venda, revenda, monetização, SaaS pago, incorporação a ofertas comerciais e uso na operação de atividades comerciais, mesmo que o software tenha sido obtido sem custo.
- Uso comercial exige autorização expressa e escrita dos titulares, em instrumento separado.
- Bibliotecas e outros componentes de terceiros mantêm suas próprias licenças.

É código disponível para uso não comercial; não é uma licença de software livre ou open source. A licença é específica deste projeto e não substitui uma análise jurídica do caso concreto.

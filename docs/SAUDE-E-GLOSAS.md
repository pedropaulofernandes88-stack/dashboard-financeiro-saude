# Inteligência de saúde e glosas

## Escopo demonstrativo

Os dados deste projeto são sintéticos, determinísticos e não contêm paciente, CPF, CID, prontuário ou qualquer identificador pessoal. A extensão assistencial acrescenta especialidade, procedimento, tipo e número fictício de guia, código interno `INT-*`, autorização, documentação e itens da conta. Não usa código TUSS como se fosse oficial. Os documentos retratam o **checklist na emissão da conta**, não uma confirmação atualizada da documentação do recurso.

Cada item da conta assistencial soma exatamente o valor da fatura financeira em centavos. Os itens são classificados como honorários, procedimentos, materiais ou medicamentos somente quando cabíveis ao perfil sintético. O atraso entre assistência e faturamento é calculado pela diferença entre `serviceDate` e `billedDate` da própria fatura.

## Coorte e corte temporal

`calculateHealth(data, healthData, filters)` usa o mesmo corte do motor financeiro: o último dia do mês final, limitado pelo `snapshotDate`. Volume faturado, ticket, prazo de faturamento e documentação referem-se às faturas emitidas entre o início escolhido e o corte, depois de aplicar unidade e pagador.

As três taxas de glosa são calculadas com o mesmo denominador: valor faturado dessa coorte.

| Medida                       | Numerador                                                           | Denominador           |
| ---------------------------- | ------------------------------------------------------------------- | --------------------- |
| Taxa de glosa da coorte      | primeira glosa registrada nas contas da coorte                      | faturamento da coorte |
| Taxa de reversão da coorte   | reversões visíveis no corte das mesmas contas                       | faturamento da coorte |
| Taxa de recuperação em caixa | pagamentos com `recoveredCents` visíveis no corte das mesmas contas | faturamento da coorte |

As coortes dentro da visão de glosas são agrupadas pelo mês de **registro/notificação** da glosa, e não pelo mês de emissão. Um caso ou evento posterior ao corte não aparece no resultado histórico.

## Conciliação da glosa

Há, no demonstrativo, no máximo um caso de glosa por conta. O validador rejeita dois casos para a mesma fatura enquanto não houver uma regra explícita de alocação. Para cada caso visível:

`glosado = em discussão + reversão aguardando caixa + recuperação em caixa + baixa`

- **Em discussão**: glosa menos reversões e baixas.
- **Reversão aguardando caixa**: reversões menos pagamentos identificados como recuperação.
- **Recuperação em caixa**: somente pagamento com `recoveredCents`; uma reversão não é recebimento.
- **Baixa**: valor de `write_off` da conta.

O status é derivado apenas de eventos disponíveis no corte: `A preparar`, `Em análise`, `Liberada a receber`, `Recebida` ou `Baixada`. Um saldo disputado não é apresentado como “em recurso” por inferência. `Em análise` requer submissão e protocolo demonstrativos. Havendo discussão ou valor liberado ainda sem caixa, a situação permanece ativa mesmo com baixa parcial. `Baixada` só indica encerramento quando os dois saldos zeram e houve perda; a recomendação distingue baixa integral e recuperação com baixa parcial. Casos parcialmente resolvidos podem participar de mais de uma fila, mas os valores dos quatro destinos são exclusivos.

## Prioridades e prazos

As filas são ordenadas por regra explícita: prazo vencido, prazo próximo, reversão aguardando caixa e, dentro de cada grupo, maior valor ainda em discussão. Não há modelo preditivo ou probabilidade inventada.

O prazo de submissão e o prazo de resposta usados nos dados são convenções fictícias de contratos por pagador, feitas apenas para permitir testar filas. Cada caso expõe `contractId`, rótulo e número de dias demonstrativos; o mesmo número contratual é aplicado tanto à submissão como à resposta no conjunto fictício. Após a submissão, o motor troca o prazo de submissão pelo prazo de resposta e deixa esse tipo de prazo explícito. Portanto, não chama um caso já enviado de “recurso vencido”.

O painel separa **estoque no corte** (todos os casos visíveis do pagador e unidade selecionados) do fluxo `periodNotifications`, que contém somente notificações de glosa no período filtrado. O Pareto usa o total do próprio estoque exibido, para que a linha acumulada sempre termine em 100% mesmo quando o período de faturamento for mais curto.

Não existe prazo legal universal neste projeto. As regras variam por contrato, modalidade, pagador, instrumento, vigência e fluxo. Há heterogeneidade relevante entre SUS, saúde suplementar e particular; esta demonstração não deve ser usada para determinar prazo, direito, conformidade ou decisão de glosa real.

## Referências de contexto

- A [orientação da ANS sobre faturamento e pagamento](https://www.gov.br/ans/pt-br/assuntos/prestadores/fator-de-qualidade-1/obrigatoriedade-do-contrato-escrito-1/faturamento-e-pagamento-dos-servicos-prestados) trata a relação contratual e a resposta a contestações no contexto indicado pela Agência.
- O [Componente Organizacional do Padrão TISS, maio de 2026](https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/PadroTISS_ComponenteOrganizacional_202605.pdf) contextualiza elementos de protocolo e resposta na troca de informações.

Essas fontes não tornam a classificação local `Administrativa`, `Técnica` e `Contratual` um benchmark ou uma declaração de conformidade TISS. Em uma integração real, registrar a versão contratual, a tabela aplicável, o evento de contestação, a regra de prazo e o identificador de protocolo recebido da fonte.

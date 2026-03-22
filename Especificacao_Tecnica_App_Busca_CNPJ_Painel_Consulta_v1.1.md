# App Busca CNPJ — Especificação Técnica: Painel de Consulta
**Versão:** v1.1
**Escopo:** Consulta de CNPJ + escrita na Empresa vinculada
**Entidade destino:** Empresa (CRM_COMPANY)
**Contexto de exibição:** Aba no Negócio (CRM_DEAL)
**Campos:** 24
**Status:** Pronto para desenvolvimento

---

## Histórico de Revisões

| Versão | Data | Descrição |
|--------|------|-----------|
| v1.0 | 2026-03 | Versão inicial — Painel de Consulta. Pronto para desenvolvimento. |
| v1.1 | 2026-03 | Sincronização com Painel de Configurações v5.0: expansão de 18 para 24 campos; adição das seções Informações Adicionais e Quadro Societário; inclusão de campos Data da Situação, Matriz/Filial, Simples Nacional, MEI, Código CNAE, Status da Busca; decisões D6–D9 registradas; seção de conversão de dados críticos adicionada. |

---

# 1. Visão Geral

## 1.1 Objetivo do Painel

- Permitir que o usuário consulte um CNPJ e visualize os dados retornados pela API externa da Receita Federal, organizados em **5 seções visuais**: Dados Fiscais, CNAE Principal, Endereço, Contato e Informações Adicionais.
- Salvar os dados consultados nos campos da Empresa vinculada ao Negócio atual, respeitando o mapeamento configurado pelo administrador no Painel de Configurações.
- Armazenar em cache a última consulta realizada por negócio, exibindo os dados automaticamente ao reabrir o painel.
- Tratar com elegância os casos de negócio sem empresa vinculada, CNPJ não encontrado e falhas na API externa.

## 1.2 Contexto de Exibição — Aba no Negócio (CRM_DEAL)

O Painel de Consulta é exibido como uma aba inserida no detalhe do Negócio (`CRM_DEAL_DETAIL_TAB`). O registro do placement é gerenciado pelo Painel de Configurações. O usuário acessa o painel diretamente dentro do card do negócio no Bitrix24, sem necessidade de navegação externa.

**Placement registrado:** `CRM_DEAL_DETAIL_TAB` (aba no detalhe do Negócio)
**Entidade de contexto:** `CRM_DEAL` — o `DEAL_ID` é sempre disponível no escopo do app

## 1.3 Regra Fundamental de Escrita

> **Regra fundamental: dados sempre salvos na Empresa, nunca no Negócio.**
> Todos os dados retornados pela consulta à Receita Federal são escritos exclusivamente na entidade Empresa (`CRM_COMPANY`) vinculada ao Negócio. O Negócio (`CRM_DEAL`) serve apenas como contexto de acesso ao painel — nenhum campo de CNPJ é salvo diretamente nele.

## 1.4 Dependência com o Painel de Configurações

O Painel de Consulta depende do mapeamento de campos definido pelo administrador no Painel de Configurações. Na inicialização, o app recupera esse mapeamento via `app.option.get`. Cada dado da Receita Federal só é salvo na Empresa se houver um campo mapeado correspondente — dados sem mapeamento são exibidos na tela mas não persistidos no CRM.

- **Mapeamento ausente:** campo exibido no resultado, mas botão "Salvar em Empresa" ignora esse dado.
- **Mapeamento presente:** campo incluído no payload do `crm.company.update` ao salvar.

---

# 2. Endpoints Bitrix24 Utilizados

Todos os endpoints pertencem à REST API oficial do Bitrix24. A autenticação é feita via OAuth 2.0 no fluxo padrão de marketplace. Os scopes necessários são: `crm` e `app`.

## 2.1 Recuperação do Mapeamento de Campos

Chamada realizada na inicialização do painel para carregar o mapeamento `campo_receita → field_id` da Empresa.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `app.option.get` | Recupera o mapeamento salvo pelo Painel de Configurações. Retorna objeto com `campo_receita → { entity, field_id }` para todos os 24 campos configurados. |

## 2.2 Recuperação da Empresa Vinculada ao Negócio

Chamada executada ao clicar em "Salvar em Empresa" para obter o `COMPANY_ID` associado ao Negócio atual.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `crm.deal.get` | Recupera os dados do Negócio atual pelo `DEAL_ID` disponível no escopo do placement. O campo `COMPANY_ID` do retorno identifica a Empresa vinculada. Retorna `null` se nenhuma empresa estiver vinculada. |

## 2.3 Escrita dos Dados na Empresa

Chamada executada após confirmar que `COMPANY_ID` não é nulo e que existe mapeamento configurado.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `crm.company.update` | Atualiza os campos mapeados da Empresa identificada pelo `COMPANY_ID`. O payload contém apenas os campos que possuem mapeamento ativo no `app.option.get` e para os quais a consulta retornou valor não-vazio. |

## 2.4 Registro do Cache de Última Consulta

Chamadas de leitura/escrita do cache por negócio, usando o armazenamento nativo do app no Bitrix24.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `app.option.set` | Salva o cache da consulta com a chave `deal_{DEAL_ID}_last_query`. Executado após cada consulta bem-sucedida à API externa. |
| GET | `app.option.get` | Recupera o cache da última consulta para o `DEAL_ID` atual na inicialização do painel. Mesma chamada da seção 2.1 — pode ser feita em batch ou combinada. |

---

# 3. Campos Exibidos no Resultado da Consulta

O resultado é organizado em **5 seções visuais**. Cada campo possui nome exibido na tela, dado correspondente da Receita Federal e campo destino na Empresa conforme o mapeamento do admin.

## 3.1 Dados Fiscais

| Nome Exibido | Campo Receita Federal | Campo Destino (Empresa) | Tipo |
|---|---|---|---|
| Razão Social | `razao_social` | `TITLE` (nativo) ou `UF_CRM_CNPJ_RAZ_XX` | string |
| Nome Fantasia | `nome_fantasia` | `UF_CRM_CNPJ_FAN_XX` | string |
| CNPJ | `cnpj` | `UF_CRM_CNPJ_NUM_XX` | string |
| Situação Cadastral | `situacao_cadastral` | `UF_CRM_CNPJ_SIT_XX` | string |
| **Data da Situação** | `data_situacao_cadastral` | `UF_CRM_CNPJ_DST_XX` | date |
| Capital Social | `capital_social` | `UF_CRM_CNPJ_CAP_XX` | double |
| Porte da Empresa | `porte_empresa` | `UF_CRM_CNPJ_POR_XX` | string |
| Natureza Jurídica | `natureza_juridica` | `UF_CRM_CNPJ_NAT_XX` | string |
| Data de Abertura | `data_inicio_atividade` | `UF_CRM_CNPJ_DAB_XX` | date |
| **Matriz / Filial** | `matriz_filial` | `UF_CRM_CNPJ_MTZ_XX` | string |
| **Simples Nacional** | `opcao_simples` | `UF_CRM_CNPJ_SMP_XX` | string |
| **MEI** | `opcao_mei` | `UF_CRM_CNPJ_MEI_XX` | string |

> **Campos em negrito** são novos na v1.1, adicionados na sincronização com o Painel de Configurações v5.0.

> **Atenção — Simples Nacional e MEI:** esses campos chegam da API como `"Sim"`, `"Não"` ou `null`. O tipo no Bitrix24 é `string`. **NUNCA usar boolean ou enumeration.**

## 3.2 CNAE Principal

| Nome Exibido | Campo Receita Federal | Campo Destino (Empresa) | Tipo |
|---|---|---|---|
| Atividade Econômica | `cnae_fiscal_descricao` | `UF_CRM_CNPJ_NAE_XX` | string |
| Código CNAE | `cnae_fiscal` | — (exibido como tag visual; não mapeado separadamente) | string |

> O Código CNAE é exibido como tag visual ao lado da descrição. O campo destino no mapeamento cobre apenas a descrição da atividade econômica.

## 3.3 Endereço

| Nome Exibido | Campo Receita Federal | Campo Destino (Empresa) | Tipo |
|---|---|---|---|
| Logradouro | `logradouro` | `UF_CRM_CNPJ_LOG_XX` | string |
| Número | `numero` | `UF_CRM_CNPJ_NRO_XX` | string |
| Complemento | `complemento` | `UF_CRM_CNPJ_CMP_XX` | string |
| Bairro | `bairro` | `UF_CRM_CNPJ_BAI_XX` | string |
| CEP | `cep` | `UF_CRM_CNPJ_CEP_XX` | string |
| Município | `municipio` | `UF_CRM_CNPJ_CID_XX` | string |
| Estado (UF) | `uf` | `UF_CRM_CNPJ_UF_XX` | string |

## 3.4 Contato

| Nome Exibido | Campo Receita Federal | Campo Destino (Empresa) | Tipo |
|---|---|---|---|
| Telefone | `telefones[0]` filtrado (`is_fax: false`) | `UF_CRM_CNPJ_TEL_XX` | string |
| E-mail | `email` | `UF_CRM_CNPJ_EML_XX` | string |

## 3.5 Informações Adicionais *(novo na v1.1)*

| Nome Exibido | Campo Receita Federal | Campo Destino (Empresa) | Tipo |
|---|---|---|---|
| Quadro Societário | `QSA` (array) | `UF_CRM_CNPJ_QSA_XX` | string (texto multilinha formatado — ver Seção 5B) |
| Status da Busca | gerado pelo app | `UF_CRM_CNPJ_STS_XX` | string |

> **Status da Busca** é gerado internamente pelo app — não vem da Receita Federal. Valores possíveis: `"Encontrado"`, `"Não encontrado"`, `"Erro"`. É salvo automaticamente a cada consulta, **independente do botão "Salvar em Empresa"**.

---

# 4. Fluxo Completo do Painel

## Passo 1 — Inicialização

Ao abrir o painel, o app dispara em paralelo:

- `app.option.get` → carrega o mapeamento de campos definido pelo administrador
- `app.option.get` (chave `deal_{DEAL_ID}_last_query`) → verifica existência de cache para o negócio atual

O `DEAL_ID` é extraído do contexto do placement via `BX24.placement.getContext()` ou parâmetro de URL injetado pelo Bitrix24 no iframe do app.

## Passo 2 — Estado de Cache

Se existe consulta anterior para este negócio (chave `deal_{DEAL_ID}_last_query` presente e válida):

- Exibir banner amarelo informando a data/hora da última consulta e o CNPJ consultado.
- Carregar e renderizar automaticamente os dados armazenados no cache — sem nova chamada à API externa.
- Disponibilizar botão "Atualizar" que limpa o cache local e dispara nova consulta para o mesmo CNPJ.

> **Estado de cache carregado automaticamente.** Ao abrir o painel em um negócio com cache, os dados da última consulta são exibidos imediatamente sem aguardar nova chamada à API externa. Isso reduz latência percebida e carga na API de CNPJ.

## Passo 3 — Input e Validação

- O campo de input exibe máscara automática no formato `XX.XXX.XXX/XXXX-XX` à medida que o usuário digita.
- Validação de 14 dígitos é realizada no frontend antes de disparar qualquer chamada à API externa.
- CNPJ com menos de 14 dígitos ou formato inválido: exibir erro inline imediato sem chamar a API.
- O campo aceita entrada com ou sem formatação (pontos, barra e hífen são aceitos e normalizados).
- Enter no campo dispara a consulta equivalente ao clique no botão "Consultar CNPJ".

## Passo 4 — Chamada à API de CNPJ

- Ao confirmar CNPJ válido (14 dígitos), o app dispara chamada à API externa de consulta (OpenCNPJ/BrasilAPI ou equivalente) **diretamente do frontend** (CORS confirmado — ver Decisão D9).
- Spinner de loading é exibido durante toda a chamada — input e botão de consulta ficam desabilitados.
- Timeout recomendado: 10 segundos. Após timeout, exibir mensagem de erro com opção de nova tentativa.

## Passo 5 — Exibição do Resultado

- Spinner some. Os **24 campos** são renderizados nas **5 seções visuais** (Dados Fiscais, CNAE Principal, Endereço, Contato, Informações Adicionais).
- Campos sem valor na resposta da API exibem `"—"` (traço) como placeholder.
- O botão "Salvar em Empresa" é exibido habilitado se `COMPANY_ID > 0`, ou desabilitado com tooltip se `COMPANY_ID` é nulo.
- O **Status da Busca** é gravado via `app.option.set` imediatamente após renderizar o resultado, com valor `"Encontrado"`.
- O cache completo é salvo via `app.option.set` imediatamente após renderizar o resultado (independente de o usuário clicar em Salvar).

## Passo 6 — Salvar em Empresa

Ao clicar em "Salvar em Empresa", o app executa a seguinte sequência:

1. Chamada GET `crm.deal.get` com o `DEAL_ID` atual para obter o `COMPANY_ID` vinculado.
2. Verificação: se `COMPANY_ID` é nulo, exibir aviso não-bloqueante (ver Seção 6) e interromper o fluxo de escrita.
3. Construção do payload para `crm.company.update`: incluir apenas os campos que possuem mapeamento ativo (`field_id != null`) e para os quais a consulta retornou valor não-vazio (ver filtro de nulos na Seção 5A.5).
4. Chamada POST `crm.company.update` com `ID = COMPANY_ID` e `FIELDS = payload construído`.
5. Sucesso: exibir feedback visual no botão ("Salvo em [Nome da Empresa]") e toast de confirmação.
6. Falha: exibir mensagem de erro específica (ver Passo 7).

> **Payload de escrita — apenas campos mapeados e com valor.** O `crm.company.update` nunca envia campos nulos ou sem mapeamento. Isso garante que campos da Empresa preenchidos manualmente pelo usuário não sejam sobrescritos com valores vazios inadvertidamente.

## Passo 7 — Tratamento de Erros

| Tipo de Erro | Condição | Comportamento |
|---|---|---|
| CNPJ não encontrado na API | A API retorna 404 ou payload vazio. | Exibir bloco de erro com ícone de alerta, mensagem "CNPJ não encontrado" e orientação para verificar o número. Salvar `"Não encontrado"` no campo Status da Busca. |
| Negócio sem empresa vinculada | `crm.deal.get` retorna `COMPANY_ID = null`. | Botão "Salvar em Empresa" desabilitado com tooltip. Exibir aviso não-bloqueante (Seção 6). |
| Falha na API externa (timeout / 5xx) | Timeout ou erro de servidor da API de CNPJ. | Exibir mensagem de erro com botão "Tentar Novamente". Salvar `"Erro"` no campo Status da Busca. Não armazenar cache parcial. |
| Falha no `crm.company.update` | Erro retornado pela API do Bitrix24. | Exibir mensagem de erro específica com o campo `error` do retorno. Manter dados exibidos na tela para nova tentativa. |
| Mapeamento não configurado | `app.option.get` retorna objeto vazio ou sem mapeamentos. | Exibir aviso orientando o admin a acessar o Painel de Configurações para mapear os campos. |
| Quadro Societário vazio | API retorna `QSA = []` ou `null`. | Campo não é incluído no payload. Exibir `"—"` na seção Informações Adicionais. |

---

# 5. Cache de Última Consulta

## 5.1 Estrutura do Objeto Salvo

O cache é salvo via `app.option.set` com a seguinte chave e estrutura:

| Atributo | Valor / Descrição |
|---|---|
| Chave (key) | `deal_{DEAL_ID}_last_query` — uma entrada por negócio |
| `cnpj` | CNPJ consultado no formato `XX.XXX.XXX/XXXX-XX` |
| `timestamp` | Unix timestamp em segundos da consulta (ex: `1711987200`) |
| `razao_social` | Razão Social da empresa consultada — exibida no banner de cache |
| `dados_completos` | Objeto JSON com todos os **24 campos** retornados pela API externa |

## 5.2 Comportamento do Cache

- Na abertura do painel, o app verifica se a chave `deal_{DEAL_ID}_last_query` existe via `app.option.get`.
- Se existir: banner amarelo é exibido com data, hora e CNPJ. Os dados do campo `dados_completos` são renderizados automaticamente nas 5 seções visuais.
- Se não existir: painel inicia no estado vazio, aguardando input do usuário.
- O cache é sobrescrito a cada nova consulta bem-sucedida (não há histórico de consultas anteriores).
- **TTL:** 7 dias. Após expirar, o cache é ignorado e o painel inicia em estado vazio. O botão "Atualizar" renova o TTL.
- O botão "Atualizar" do banner de cache executa nova chamada à API com o CNPJ armazenado e sobrescreve o cache atual.
- O botão "Nova Consulta" limpa apenas o estado visual — não apaga o cache persistido no `app.option`.

---

# 5A. Conversão de Dados Críticos

## 5A.1 Capital Social

O campo `capital_social` chega como **string** com separador de milhar brasileiro. Conversão obrigatória antes de enviar ao Bitrix24 (campo **double**):

```javascript
parseFloat(v.replace(/\./g, '').replace(',', '.'))

// "1.000.000,00"  →  1000000.00  ✅
// "180.000,00"    →  180000.00   ✅
// ATENÇÃO: omitir o replace de ponto resulta em NaN  ❌
```

## 5A.2 Datas (`data_inicio_atividade` e `data_situacao_cadastral`)

As datas chegam no formato `YYYY-MM-DD`. Enviar ao Bitrix24 com sufixo `T12:00:00` para evitar rollover de fuso horário que pode recuar a data 1 dia:

```javascript
// Recebido: "2000-01-01"
const dataFormatada = dataISO + "T12:00:00";
// Resultado: "2000-01-01T12:00:00"  ✅
```

## 5A.3 Simples Nacional e MEI

`opcao_simples` e `opcao_mei` são tipo **string** na API OpenCNPJ. Chegam como `"Sim"`, `"Não"` ou `null`. `USER_TYPE_ID` no Bitrix24 = `"string"`. **NUNCA usar boolean ou enumeration.**

## 5A.4 Chave QSA no JSON Bruto

A API retorna a chave em maiúsculo: `"QSA"`. Usar fallback defensivo:

```javascript
const socios = data.QSA || data.qsa || [];
```

## 5A.5 Filtro de Nulos no Payload do `crm.company.update`

```javascript
// Rejeita null, '', 'null', undefined
const campoValido = (v) =>
  v !== null && v !== undefined && v !== '' && v !== 'null';
```

---

# 5B. Formatação do Quadro Societário

## 5B.1 Tipo do Campo no Bitrix24

`string` (texto multilinha). `USER_TYPE_ID = "string"`.

## 5B.2 Função de Formatação

```javascript
function formatarQSA(qsa) {
  const socios = qsa || [];
  if (socios.length === 0) return null;
  return socios.map((s, i) => {
    const entrada = s.data_entrada_sociedade
      ? s.data_entrada_sociedade.split('-').reverse().join('/')
      : '—';
    return `SÓCIO ${i + 1}\nNome: ${s.nome_socio}\nQualificação: ${s.qualificacao_socio}\nEntrada: ${entrada}`;
  }).join('\n\n');
}
```

## 5B.3 Exemplo de Saída no Campo Bitrix24

```
SÓCIO 1
Nome: FULANO DE TAL
Qualificação: Administrador
Entrada: 15/03/2018

SÓCIO 2
Nome: EMPRESA ABC LTDA
Qualificação: Sócio-Cotista
Entrada: 20/06/2020
```

---

# 6. Negócio Sem Empresa Vinculada

Este cenário ocorre quando o usuário abre o painel de consulta em um Negócio que não possui Empresa vinculada (`COMPANY_ID = null` no retorno do `crm.deal.get`).

## 6.1 Comportamento Detalhado

- A consulta de CNPJ é permitida normalmente — o usuário pode digitar e consultar sem restrição.
- Os dados retornados pela API são exibidos nas 5 seções visuais normalmente.
- O botão "Salvar em Empresa" é exibido desabilitado (estado visual distinto — cor acinzentada).
- Ao passar o mouse sobre o botão desabilitado, tooltip exibe: *"Vincule uma empresa a este negócio para salvar os dados."*
- Um aviso não-bloqueante é exibido abaixo dos resultados, orientando o usuário a vincular uma empresa.
- O cache da consulta é salvo normalmente via `app.option.set`, mesmo sem empresa vinculada.

> **Consulta sempre permitida — salvar bloqueado apenas se sem empresa vinculada.** O usuário não é bloqueado de consultar o CNPJ. A restrição é somente na ação de escrita no CRM. Isso preserva a utilidade do painel como ferramenta de consulta mesmo em negócios sem empresa atrelada.

## 6.2 Texto do Aviso Exibido

> ⚠ **Este negócio não possui empresa vinculada.**
> Abra o negócio, vincule uma empresa e retorne para salvar os dados consultados.

---

# 7. Permissões (Scopes) Necessárias

| Scope | O que cobre neste módulo |
|---|---|
| `crm` | Leitura do Negócio atual (`crm.deal.get` para obter `COMPANY_ID`) e escrita na Empresa (`crm.company.update` com os campos mapeados). |
| `app` | Leitura do mapeamento de campos (`app.option.get`) e persistência do cache de consulta por negócio (`app.option.set` com chave `deal_{DEAL_ID}_last_query`). |

---

# 8. Decisões Registradas

Registro de todas as decisões tomadas durante o processo de escopo para rastreabilidade futura.

| # | Decisão | Critério Adotado | Alternativa Descartada |
|---|---|---|---|
| D1 | Escrita sempre na Empresa vinculada, nunca no Negócio | O Negócio é apenas contexto de navegação. Todos os dados de CNPJ pertencem semanticamente à Empresa. | Mapear campos direto no Deal para evitar a etapa de `crm.deal.get` |
| D2 | Cache por `DEAL_ID` via `app.option.set` | Permite retomar a última consulta instantaneamente ao reabrir o painel. Reduz chamadas à API externa e melhora a experiência. | Sem cache — sempre exibir painel vazio ao abrir |
| D3 | Consulta permitida sem empresa vinculada | Preserva a utilidade do painel como ferramenta de consulta. O usuário pode visualizar os dados mesmo antes de vincular a empresa. | Bloquear o painel inteiro se não houver empresa vinculada |
| D4 | Cache carregado automaticamente ao abrir | Menor latência percebida. Usuário retoma contexto sem re-digitar o CNPJ. | Exibir painel vazio sempre, mesmo com cache disponível |
| D5 | Validação de CNPJ no frontend antes de chamar a API | Evita chamadas desnecessárias à API externa por CNPJs claramente inválidos. Reduz custo e latência. | Enviar direto à API e tratar erro no retorno |
| **D6** | **Simples Nacional e MEI como string** | API retorna `"Sim"`/`"Não"`/`null` — tipo string preserva esses valores sem perda de informação. | `boolean` — perderia o estado `null` (diferente de "Não") |
| **D7** | **QSA como campo texto multilinha** | Evita criação de múltiplos Contatos no Bitrix24; dados de sócios são informacionais, não operacionais no CRM nesta versão. | Criar entidade Contato para cada sócio do QSA |
| **D8** | **Status da Busca gerado pelo app** | Permite auditoria e filtragem de empresas por resultado de consulta diretamente no CRM, sem depender de logs externos. | Não persistir status — informação perdida após fechar o painel |
| **D9** | **Chamada à API OpenCNPJ direta do frontend** | CORS confirmado na OpenCNPJ — sem necessidade de backend proxy nesta versão. Reduz complexidade e custo de infraestrutura. | Backend proxy — aumentaria complexidade e custo sem benefício atual |

> **Decisões em negrito** são novas na v1.1.

---

# 9. Próximos Passos

- Validar esta especificação v1.1 com o time de desenvolvimento antes de iniciar o desenvolvimento.
- Confirmar comportamento exato de `opcao_simples` / `opcao_mei` na API real (confirmar se chegam como `"Sim"`/`"Não"` ou outra string).
- Confirmar que o Bitrix24 aceita `crm.company.update` com campo `date` no formato `"YYYY-MM-DDT12:00:00"` — testar em portal real.
- Desenvolver lógica de escrita nos campos mapeados da Empresa após validação do Painel de Configurações v5.0.
- Definir estratégia de expiração de cache (TTL de 7 dias registrado na Decisão P4 do Painel de Configurações — validar consistência entre os dois módulos).
- Alinhar com o Painel de Configurações v5.0 o comportamento de criação automática dos 24 campos na primeira instalação.

---

*App Busca CNPJ — Especificação Técnica: Painel de Consulta — v1.1*

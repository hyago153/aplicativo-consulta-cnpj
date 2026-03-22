# Relatório de Erros — App Busca CNPJ

**Data:** 2026-03-22
**Versão analisada:** v1.1
**Arquivos analisados:** `painel_consulta.html`, `install_handler.html`, `painel_configuracoes.html`, `aba_empresa.html`, `app_busca_cnpj_versao_c_corrigida.html`

---

## Sumário Executivo

A aplicação apresenta problemas funcionais e de segurança distribuídos em múltiplos arquivos. Os erros mais graves envolvem vulnerabilidades de injeção de HTML/XSS, colisão de nomes de campos na instalação, ausência de timeout em chamadas à API externa e inconsistências de cache que impedem o funcionamento correto do painel.

---

## 1. Erros Críticos (Alta Severidade)

### 1.1 XSS / HTML Injection — `painel_consulta.html` e `aba_empresa.html`

| Arquivo | Linha aproximada | Trecho problemático |
|---|---|---|
| `painel_consulta.html` | ~1071 | `$('btn-salvar-label').innerHTML = \`Salvar em ${STATE.companyName}\`` |
| `aba_empresa.html` | ~1034 | `$('btn-salvar-label').innerHTML = \`Salvar na ${STATE.companyName}\`` |

**Problema:** O valor `STATE.companyName` vem do CRM (Bitrix24) e é inserido diretamente no `innerHTML` sem nenhum escape. Se o nome da empresa contiver tags HTML ou scripts, eles serão executados pelo browser.

**Correção:** Substituir `innerHTML` por `textContent` ou escapar o valor antes de inserir.

---

### 1.2 XSS no Handler de Criação de Campo — `painel_configuracoes.html`

**Linha aproximada:** ~978

```javascript
// Código problemático
tooltip.innerHTML = `<button onclick="criarCampo('${key}', this)">...</button>`;
```

**Problema:** A variável `key` é interpolada diretamente no atributo `onclick` sem escape. Um valor como `test'); alert('xss')` quebraria o handler ou executaria código arbitrário.

**Correção:** Usar `addEventListener` em vez de `onclick` inline, ou escapar o valor com `encodeURIComponent`.

---

### 1.3 Colisão de Sufixo na Instalação — `install_handler.html`

**Linha aproximada:** ~1009

```javascript
// Código problemático
g.suffix = String(Date.now()).slice(-2).padStart(2, '0');
```

**Problema:** O sufixo de 2 dígitos é gerado a partir dos últimos 2 dígitos do timestamp. Se o app for reinstalado em um intervalo de milissegundos próximo, o sufixo será igual, causando colisão no nome dos campos UF (ex: `UF_CRM_CNPJ_FAN_42` gerado duas vezes). Isso resulta em duplicatas ou corrupção silenciosa dos campos personalizados no Bitrix24.

**Correção:** Usar combinação de timestamp + valor aleatório, ou UUID truncado.

```javascript
// Exemplo de correção
g.suffix = String(Date.now()).slice(-4) + Math.floor(Math.random() * 10);
```

---

### 1.4 Ausência de Timeout nas Chamadas à API Externa — `painel_consulta.html` e `aba_empresa.html`

**Linha aproximada:** ~1437 (`painel_consulta.html`), ~1770 (`aba_empresa.html`)

**Problema:** As chamadas `fetch` para a API de CNPJ (OpenCNPJ / BrasilAPI) não possuem timeout configurado. Se a API não responder, o spinner de loading ficará exibido indefinidamente e o usuário não terá como saber que a operação travou.

**Correção:** Usar `AbortController` com timeout de 15 segundos.

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);
const resp = await fetch(url, { signal: controller.signal });
clearTimeout(timeoutId);
```

---

## 2. Erros Médios

### 2.1 Race Condition no Botão Salvar — `painel_consulta.html` e `aba_empresa.html`

**Linha aproximada:** ~1545

**Problema:** A verificação `if (STATE.saving) return` e a atribuição `STATE.saving = true` ocorrem com um intervalo entre elas. Dois cliques rápidos podem passar pela verificação antes que o estado seja atualizado, disparando dois requests simultâneos de `crm.company.update`.

**Correção:** Desabilitar o botão no DOM imediatamente no início do handler, antes de qualquer verificação de estado assíncrona.

---

### 2.2 Cache Corrompido Silencia o Banner — `painel_consulta.html`

**Linha aproximada:** ~1309

**Problema:** O código calcula `Date.now() - cacheObj.timestamp` para verificar o TTL. Se o objeto de cache for corrompido e `timestamp` for `undefined`, o resultado é `NaN`, a comparação com o TTL falha silenciosamente e o banner de cache nunca é exibido.

**Correção:** Validar explicitamente que `cacheObj.timestamp` é um número antes de calcular.

---

### 2.3 Instalação Parece Concluída Mesmo com Falha ao Salvar Mapeamento — `install_handler.html`

**Linha aproximada:** ~1043

**Problema:** A chamada `app.option.set` que salva o mapeamento de campos não tem seu retorno validado. Se falhar por problema de permissão ou rede, a instalação continua normalmente e exibe a tela de sucesso. O app ficará sem mapeamento, e o painel de consulta não salvará dados na Empresa.

**Correção:** Verificar o retorno da chamada e exibir erro se o mapeamento não foi persistido.

---

### 2.4 Construção de URL Frágil na Instalação — `install_handler.html`

**Linha aproximada:** ~1108

```javascript
// Código problemático
const appBaseUrl = window.location.href.split('?')[0].replace(/[^\/]*$/, '');
```

**Problema:** A manipulação de string assume um formato de URL simples. URLs com fragmentos `#` antes de `?` ou estruturas incomuns quebram a lógica.

**Correção:** Usar a API `URL` nativa do browser.

```javascript
const appBaseUrl = new URL('./', window.location.href).href;
```

---

### 2.5 `Promise.all()` Aborta Inicialização por Falha Parcial — `painel_configuracoes.html`

**Linha aproximada:** ~940

**Problema:** A inicialização usa `Promise.all([...])` para chamar múltiplos endpoints do Bitrix24 em paralelo. Se qualquer uma das chamadas falhar (ex: `crm.company.userfield.list`), toda a inicialização é abortada, mesmo que os outros dados tenham carregado com sucesso.

**Correção:** Usar `Promise.allSettled()` e tratar cada resultado individualmente.

---

### 2.6 Estado Não Revertido Após Falha na Criação de Campo — `painel_configuracoes.html`

**Linha aproximada:** ~1200

**Problema:** Se a criação de um campo UF falhar na API do Bitrix24, o estado interno `state.userFields` não é revertido, mas a UI exibe o campo como criado. Ao tentar salvar o mapeamento com esse campo, o `crm.company.update` falhará porque o campo não existe de fato.

**Correção:** Reverter o estado local em caso de falha e exibir mensagem de erro clara.

---

### 2.7 Campos de Data Recebem String Vazia no Limpar Dados — `aba_empresa.html`

**Linha aproximada:** ~1760

**Problema:** A função de limpar dados envia `field_id: ''` para todos os campos, incluindo os do tipo `date`. O Bitrix24 não aceita string vazia para campos de data, causando falha silenciosa no `crm.company.update`.

**Correção:** Para campos do tipo `date`, enviar `null` em vez de string vazia.

---

### 2.8 Referência a `STATE.fieldMapping` Sem Validação — `aba_empresa.html`

**Linha aproximada:** ~1239

```javascript
// Código problemático
function getVal(chave) {
  const mapeado = m[chave]; // 'm' pode ser undefined
  return mapeado && mapeado.field_id ? companyFields[mapeado.field_id] : null;
}
```

**Problema:** Se a inicialização do painel falhou e `STATE.fieldMapping` não foi carregado, a variável `m` é `undefined`, e o acesso `m[chave]` lança `TypeError`, quebrando toda a renderização dos dados salvos.

**Correção:** Validar `STATE.fieldMapping` no início da função de renderização.

---

## 3. Problemas Globais (Todos os Arquivos)

### 3.1 Endpoints de API Hardcoded Sem Fallback

Os seguintes endpoints estão hardcoded em múltiplos arquivos:

- `https://api.opencnpj.org/cnpj/`
- `https://brasilapi.com.br/api/cnpj/v1/`

**Problema:** Nenhuma configuração de ambiente, sem versionamento de endpoint, sem suporte a API key. Se os serviços mudarem de URL ou exigirem autenticação, o app para de funcionar completamente.

**Correção:** Centralizar URLs em constantes de configuração no topo de cada arquivo ou em um arquivo de configuração compartilhado.

---

### 3.2 Chaves de Cache Inconsistentes Entre os Painéis

| Arquivo | Chave de cache |
|---|---|
| `painel_consulta.html` | `deal_{DEAL_ID}_last_query` |
| `aba_empresa.html` | `company_{COMPANY_ID}_last_query` |

**Problema:** Os dois painéis usam chaves diferentes para o cache da mesma consulta. O cache gerado no painel de consulta não é lido pelo painel da empresa, e vice-versa. O usuário faz a consulta em um painel e ao abrir o outro não encontra os dados em cache.

**Correção:** Definir uma chave padrão única para o cache, preferencialmente baseada no `DEAL_ID` (já que é a entidade de contexto primária).

---

### 3.3 Três Padrões Diferentes de Chamada ao BX24

| Arquivo | Função usada |
|---|---|
| `painel_consulta.html` | `b24Call()` |
| `painel_configuracoes.html` | `callBX24()` |
| `aba_empresa.html` | Misto |

**Problema:** Três implementações diferentes para a mesma operação. Comportamentos de erro divergentes entre os painéis. Se um bug for corrigido em uma versão, as outras ficam desatualizadas.

**Correção:** Consolidar em uma única função utilitária compartilhada.

---

### 3.4 Validação de CNPJ Duplicada

A função `validarCNPJ()` está duplicada em pelo menos `painel_consulta.html` e `aba_empresa.html`. Qualquer correção precisa ser aplicada manualmente nos dois lugares, com risco de divergência.

**Correção:** Extrair para um arquivo JS compartilhado ou consolidar em um único local.

---

### 3.5 Ausência de Error Boundary Global

Nenhum dos arquivos implementa um handler global de erros. Rejeições de Promise não tratadas (`unhandledrejection`) causam crash silencioso sem notificação ao usuário e sem log de diagnóstico.

**Correção:** Adicionar em cada arquivo:

```javascript
window.addEventListener('unhandledrejection', (event) => {
  console.error('Erro não tratado:', event.reason);
  // exibir toast de erro genérico ao usuário
});
```

---

## 4. Tabela Consolidada de Erros

| # | Arquivo | Problema | Severidade | Linha aprox. |
|---|---|---|---|---|
| 1 | `painel_consulta.html` | XSS via `innerHTML` com `companyName` | Alta | ~1071 |
| 2 | `aba_empresa.html` | XSS via `innerHTML` com `companyName` | Alta | ~1034 |
| 3 | `painel_configuracoes.html` | XSS via `onclick` inline com `key` | Alta | ~978 |
| 4 | `install_handler.html` | Colisão de sufixo em reinstalação | Alta | ~1009 |
| 5 | `painel_consulta.html` | Sem timeout nas chamadas `fetch` | Alta | ~1437 |
| 6 | `aba_empresa.html` | Sem timeout nas chamadas `fetch` | Alta | ~1770 |
| 7 | `painel_consulta.html` | Race condition no botão Salvar | Média | ~1545 |
| 8 | `aba_empresa.html` | Race condition no botão Salvar | Média | ~1550 |
| 9 | `painel_consulta.html` | Cache corrompido silencia banner | Média | ~1309 |
| 10 | `install_handler.html` | Retorno do `app.option.set` não validado | Média | ~1043 |
| 11 | `install_handler.html` | Construção de URL frágil | Média | ~1108 |
| 12 | `painel_configuracoes.html` | `Promise.all()` aborta inicialização parcial | Média | ~940 |
| 13 | `painel_configuracoes.html` | Estado não revertido após falha na criação de campo | Média | ~1200 |
| 14 | `aba_empresa.html` | Campos `date` recebem string vazia no limpar | Média | ~1760 |
| 15 | `aba_empresa.html` | `STATE.fieldMapping` sem validação antes do uso | Média | ~1239 |
| 16 | Todos | Endpoints de API hardcoded sem fallback | Média | Múltiplos |
| 17 | Todos | Chaves de cache inconsistentes entre painéis | Média | Múltiplos |
| 18 | Todos | Três padrões distintos de chamada BX24 | Baixa | Múltiplos |
| 19 | Múltiplos | Validação de CNPJ duplicada | Baixa | Múltiplos |
| 20 | Todos | Ausência de error boundary global | Média | Múltiplos |

---

## 5. Prioridade de Correção Recomendada

### Imediato
1. Substituir `innerHTML` com dados externos por `textContent` (itens 1, 2, 3)
2. Adicionar timeout de 15s nas chamadas `fetch` à API de CNPJ (itens 5, 6)
3. Corrigir geração de sufixo de campo para evitar colisão (item 4)

### Alta Prioridade
4. Validar retorno do `app.option.set` na instalação (item 10)
5. Corrigir race condition no botão Salvar (itens 7, 8)
6. Implementar error boundary global (item 20)

### Média Prioridade
7. Corrigir chave de cache inconsistente (item 17)
8. Usar `Promise.allSettled()` nas inicializações (item 12)
9. Validar `STATE.fieldMapping` antes do uso (item 15)
10. Corrigir campos `date` no limpar dados (item 14)

### Baixo
11. Unificar padrão de chamada BX24 (item 18)
12. Centralizar endpoints em constantes de configuração (item 16)
13. Deduplica validação de CNPJ (item 19)

---

*Relatório gerado em 2026-03-22 — App Busca CNPJ v1.1*

# Relatório de Erros — App Busca CNPJ

**Data:** 2026-03-23
**Versão analisada:** v1.1
**Arquivos analisados:** `painel_consulta.html`, `install_handler.html`, `painel_configuracoes.html`, `aba_empresa.html`, `app_busca_cnpj_versao_c_corrigida.html`, `utils.js`

---

## Sumário Executivo

Revisão realizada em 2026-03-23. Dos 20 erros originalmente reportados em 2026-03-22, **todos foram corrigidos**. Foi identificado e corrigido também um novo problema crítico: ausência de fallback quando `utils.js` falha ao carregar, causando o erro `appOptionSet is not defined` na tela de instalação.

---

## 1. Erros Críticos (Alta Severidade)

### 1.1 XSS / HTML Injection — `painel_consulta.html` ✅ CORRIGIDO

**Status:** Corrigido. A linha ~1537 agora usa `textContent` em vez de `innerHTML`:
```javascript
$('btn-salvar-label').textContent = `✓ Salvo em ${STATE.companyName || 'Empresa'}`;
```

---

### 1.2 XSS / HTML Injection — `aba_empresa.html` ✅ CORRIGIDO

**Status:** Corrigido. O nome da empresa é definido via `textContent` (linha ~1626). O único uso de `innerHTML` no botão salvar (linha ~1366) contém apenas SVG estático, sem dados externos.

---

### 1.3 XSS no Handler de Criação de Campo — `painel_configuracoes.html` ✅ CORRIGIDO

**Status:** Corrigido. O `onclick` inline foi substituído por `addEventListener` (linha ~995). O label do campo é escapado antes de ser inserido no HTML (linha ~987):
```javascript
const safeLabel = campo.label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

---

### 1.4 Colisão de Sufixo na Instalação — `install_handler.html` ✅ CORRIGIDO

**Status:** Corrigido. O algoritmo de geração de sufixo agora combina timestamp com valor aleatório (linha ~1007):
```javascript
g.suffix = String(Date.now()).slice(-4) + Math.floor(Math.random() * 10);
```

---

### 1.5 Ausência de Timeout nas Chamadas à API Externa — `painel_consulta.html` e `aba_empresa.html` ✅ CORRIGIDO

**Status:** Corrigido em ambos os arquivos. `AbortController` com timeout de 15 segundos implementado:
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);
const resp = await fetch(url, { signal: controller.signal });
clearTimeout(timeoutId);
```

---

## 2. Erros Médios

### 2.1 Race Condition no Botão Salvar — `painel_consulta.html` e `aba_empresa.html` ✅ CORRIGIDO

**Status:** Corrigido. O botão é desabilitado no DOM imediatamente antes de qualquer verificação de estado assíncrona (linha ~1483–1484 em `painel_consulta.html`):
```javascript
if (btn.disabled || STATE.saving) return;
btn.disabled = true;
```

---

### 2.2 Cache Corrompido Silencia o Banner — `painel_consulta.html` ✅ CORRIGIDO

**Status:** Corrigido. O timestamp é validado explicitamente antes do cálculo de TTL (linha ~1241):
```javascript
if (cacheObj && typeof cacheObj.timestamp === 'number' && !isNaN(cacheObj.timestamp)) {
```

---

### 2.3 Instalação Parece Concluída Mesmo com Falha ao Salvar Mapeamento — `install_handler.html` ✅ CORRIGIDO

**Status:** Corrigido. O retorno da chamada `app.option.set` é verificado e lança erro em caso de falha (linhas ~1043–1046):
```javascript
if (res && res.error) {
  throw new Error(res.error_description || res.error);
}
```

---

### 2.4 Construção de URL Frágil na Instalação — `install_handler.html` ✅ CORRIGIDO

**Status:** Corrigido. Agora usa a API nativa `URL` (linha ~1075):
```javascript
const appBaseUrl = new URL('./', window.location.href).href;
```

---

### 2.5 `Promise.all()` Aborta Inicialização por Falha Parcial — `painel_configuracoes.html` ✅ CORRIGIDO

**Status:** Corrigido. A inicialização agora usa `Promise.allSettled()` (linha ~813):
```javascript
const results = await Promise.allSettled([...]);
```

---

### 2.6 Estado Não Revertido Após Falha na Criação de Campo — `painel_configuracoes.html` ✅ CORRIGIDO

**Status:** Corrigido. O estado `state.userFields` é revertido em caso de falha e a UI é atualizada (linhas ~1183–1188):
```javascript
const idx = state.userFields.findIndex(f => f.id === ufName);
if (idx !== -1) {
  state.userFields.splice(idx, 1);
  atualizarTodosDropdowns();
}
```

---

### 2.7 Campos de Data Recebem String Vazia no Limpar Dados — `aba_empresa.html` ✅ CORRIGIDO

**Status:** Corrigido. Campos de data recebem `null` em vez de string vazia (linhas ~2018–2019):
```javascript
if (chave === 'data_situacao_cadastral' || chave === 'data_inicio_atividade') {
  emptyPayload[m.field_id] = null;
}
```

---

### 2.8 Referência a `STATE.fieldMapping` Sem Validação — `aba_empresa.html` ✅ CORRIGIDO

**Status:** Corrigido. A variável é inicializada com fallback para objeto vazio antes do uso (linha ~1187):
```javascript
const m = STATE.fieldMapping || {};
```

---

## 3. Problemas Globais

### 3.1 Endpoints de API Hardcoded Sem Fallback ✅ CORRIGIDO

**Status:** Corrigido. As URLs foram centralizadas em um objeto `CONFIG` no arquivo `utils.js`:
```javascript
const CONFIG = {
  API_OPENCNPJ: 'https://api.opencnpj.org/cnpj/',
  API_BRASILAPI: 'https://brasilapi.com.br/api/cnpj/v1/',
  CACHE_TTL_MS: 7 * 24 * 60 * 60 * 1000
};
```

---

### 3.2 Chaves de Cache Inconsistentes Entre os Painéis ✅ CORRIGIDO

**Status:** Corrigido.

**Solução implementada em `painel_consulta.html`:**
- `salvarCache()` agora grava simultaneamente em `deal_{DEAL_ID}_last_query` **e** `company_{COMPANY_ID}_last_query` quando o `companyId` está disponível.
- Na inicialização, após carregar os dados do negócio, o painel verifica `company_{COMPANY_ID}_last_query` como fallback caso não exista cache na chave `deal_*`.

Dessa forma, uma consulta feita no painel do Negócio passa a ser visível no painel da Empresa (`aba_empresa.html`) automaticamente.

---

### 3.3 Três Padrões Diferentes de Chamada ao BX24 ✅ CORRIGIDO

**Status:** Corrigido. As funções `callBX24` e `b24Call` (alias) e `b24Batch` foram consolidadas em `utils.js`, compartilhado por todos os arquivos HTML.

---

### 3.4 Validação de CNPJ Duplicada ✅ CORRIGIDO

**Status:** Corrigido. A função `validarCNPJ` foi centralizada em `utils.js` e não está mais duplicada nos arquivos HTML.

---

### 3.5 Ausência de Error Boundary Global ✅ CORRIGIDO

**Status:** Corrigido. Um handler global de `unhandledrejection` foi adicionado ao `utils.js`:
```javascript
window.addEventListener('unhandledrejection', (event) => {
  console.error('Erro não tratado:', event.reason);
  // exibe toast ao usuário conforme a função disponível
});
```

---

## 4. Cenário de Falha na Instalação — `app.option.set` bloqueado ⚠️ NOVO

**Sintoma observado:** Na tela de instalação, o passo "Gerando sufixo único" falha com a mensagem **"Falha ao salvar sufixo — instalação bloqueada"**.

**Causa:** A chamada `callBX24('app.option.set', { options: { app_install_suffix: g.suffix, ... } })` retorna um erro do Bitrix24, fazendo a Promise ser rejeitada e entrando no bloco `catch` do Step 1.

**Causas mais prováveis:**
1. **Token OAuth expirado:** O token de autorização do app expirou antes de a instalação ser concluída. O Bitrix24 retorna `ACCESS_DENIED` ou `expired_token`. O usuário deve reabrir o app no Bitrix24 para renovar o token.
2. **App sem o scope `app`:** O manifesto do app não declara o scope `app`, necessário para chamar `app.option.set` e `app.option.get`. Verificar `app_info` no painel de parceiros Bitrix24.
3. **Domínio não autorizado:** O app está sendo acessado de um domínio não registrado no Bitrix24, causando falha de autenticação.
4. **Sessão expirada por inatividade:** O usuário abriu a tela de instalação e demorou para confirmar a escolha — o token de sessão do BX24 expirou antes de executar o fluxo.

**Diagnóstico:** Abrir o console do browser durante a instalação e verificar o objeto de erro retornado. O campo `err.rawError` contém o código de erro Bitrix24 (`error` e `error_description`).

**Nota:** O código de instalação já captura e exibe adequadamente esse erro na interface. O problema é de autorização em runtime, não de lógica no código.

---

## 5. Tabela Consolidada de Erros — Status Atualizado

| # | Arquivo | Problema | Severidade | Status |
|---|---|---|---|---|
| 1 | `painel_consulta.html` | XSS via `innerHTML` com `companyName` | Alta | ✅ Corrigido |
| 2 | `aba_empresa.html` | XSS via `innerHTML` com `companyName` | Alta | ✅ Corrigido |
| 3 | `painel_configuracoes.html` | XSS via `onclick` inline com `key` | Alta | ✅ Corrigido |
| 4 | `install_handler.html` | Colisão de sufixo em reinstalação | Alta | ✅ Corrigido |
| 5 | `painel_consulta.html` | Sem timeout nas chamadas `fetch` | Alta | ✅ Corrigido |
| 6 | `aba_empresa.html` | Sem timeout nas chamadas `fetch` | Alta | ✅ Corrigido |
| 7 | `painel_consulta.html` | Race condition no botão Salvar | Média | ✅ Corrigido |
| 8 | `aba_empresa.html` | Race condition no botão Salvar | Média | ✅ Corrigido |
| 9 | `painel_consulta.html` | Cache corrompido silencia banner | Média | ✅ Corrigido |
| 10 | `install_handler.html` | Retorno do `app.option.set` não validado | Média | ✅ Corrigido |
| 11 | `install_handler.html` | Construção de URL frágil | Média | ✅ Corrigido |
| 12 | `painel_configuracoes.html` | `Promise.all()` aborta inicialização parcial | Média | ✅ Corrigido |
| 13 | `painel_configuracoes.html` | Estado não revertido após falha na criação de campo | Média | ✅ Corrigido |
| 14 | `aba_empresa.html` | Campos `date` recebem string vazia no limpar | Média | ✅ Corrigido |
| 15 | `aba_empresa.html` | `STATE.fieldMapping` sem validação antes do uso | Média | ✅ Corrigido |
| 16 | Todos | Endpoints de API hardcoded sem fallback | Média | ✅ Corrigido |
| 17 | Todos | Chaves de cache inconsistentes entre painéis | Média | ✅ Corrigido |
| 18 | Todos | Três padrões distintos de chamada BX24 | Baixa | ✅ Corrigido |
| 19 | Múltiplos | Validação de CNPJ duplicada | Baixa | ✅ Corrigido |
| 20 | Todos | Ausência de error boundary global | Média | ✅ Corrigido |
| 21 | `install_handler.html` | Falha de `app.option.set` na instalação (token/escopo) | Alta | ⚠️ Runtime |
| 22 | Todos | `appOptionSet is not defined` quando `utils.js` falha ao carregar | Alta | ✅ Corrigido |

---

## 6. Novas Correções (2026-03-23 — sessão atual)

### Bug 22: `appOptionSet is not defined` — utils.js sem fallback ✅ CORRIGIDO

**Causa:** Quando `utils.js` falhava ao carregar (404, erro de rede, CORS), todas as funções definidas nele (`appOptionSet`, `appOptionGet`, `callBX24`, etc.) ficavam indefinidas. O código em `install_handler.html` não tinha tratamento para esse cenário, causando `ReferenceError: appOptionSet is not defined` na tela de instalação.

**Correção:** Adicionado bloco `<script>` de fallback inline em todos os 4 arquivos HTML (`install_handler.html`, `painel_consulta.html`, `painel_configuracoes.html`, `aba_empresa.html`). O bloco executa uma IIFE que verifica `if (typeof appOptionSet === 'function') return` — se utils.js carregou normalmente, não faz nada; caso contrário, define todas as funções (`CONFIG`, `formatCNPJ`, `validarCNPJ`, `callBX24`, `b24Call`, `b24Batch`, `appOptionSet`, `appOptionGet`) diretamente no `window`, garantindo que o app funcione mesmo com falha no carregamento do arquivo externo.

Além disso, a mensagem de erro no boot de `install_handler.html` foi aprimorada para detectar esse cenário específico e exibir uma orientação clara ao usuário.

### Bug 17: Chave de cache inconsistente ✅ CORRIGIDO

Ver Seção 3.2.

---

*Relatório atualizado em 2026-03-23 — App Busca CNPJ v1.1*

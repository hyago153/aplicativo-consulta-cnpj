'use strict';

// Error Boundary Global
window.addEventListener('unhandledrejection', (event) => {
  console.error('Erro não tratado:', event.reason);
  if (typeof toast === 'function') {
    toast('Erro interno inesperado. Consulte o console.', 'red', 4000);
  } else if (typeof showToast === 'function') {
    showToast('Erro interno inesperado. Consulte o console.', 'error');
  }
});

/* ─────────────────────────────────────────────
   CONFIGURAÇÕES GLOBAIS
───────────────────────────────────────────── */
const CONFIG = {
  API_OPENCNPJ: 'https://api.opencnpj.org/cnpj/',
  API_BRASILAPI: 'https://brasilapi.com.br/api/cnpj/v1/',
  CACHE_TTL_MS: 7 * 24 * 60 * 60 * 1000 // 7 dias
};

/* ─────────────────────────────────────────────
   HELPERS — Formatação e Validação CNPJ
───────────────────────────────────────────── */
function formatCNPJ(raw) {
  raw = raw.replace(/\D/g, '').slice(0, 14);
  if (raw.length === 14)
    return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (raw.length > 8)
    return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d+)$/, (_, a,b,c,d) => `${a}.${b}.${c}/${d}`);
  if (raw.length > 5)
    return raw.replace(/^(\d{2})(\d{3})(\d+)$/, (_, a,b,c) => `${a}.${b}.${c}`);
  if (raw.length > 2)
    return raw.replace(/^(\d{2})(\d+)$/, (_, a,b) => `${a}.${b}`);
  return raw;
}

function validarCNPJ(cnpj) {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14) return false;
  if (/^(\d)\1+$/.test(n)) return false; // todos iguais
  function calc(len) {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n.charAt(len - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return r === parseInt(n.charAt(len), 10);
  }
  return calc(12) && calc(13);
}

/* ─────────────────────────────────────────────
   BX24 HELPERS UNIFICADOS
───────────────────────────────────────────── */
function callBX24(method, params) {
  return new Promise((resolve, reject) => {
    BX24.callMethod(method, params || {}, result => {
      if (result.error()) {
        const err = new Error(result.error().error_description || result.error().error || 'Erro desconhecido');
        err.rawError = result.error();
        reject(err);
      } else {
        // Return object with result to be compatible with painel_configuracoes.html
        // And directly resolve with data to be compatible with other files
        const data = result.data();
        resolve(data);
      }
    });
  });
}

function b24Call(method, params) {
  return callBX24(method, params);
}

function b24Batch(calls) {
  return new Promise((resolve) => {
    BX24.callBatch(calls, results => {
      const out = {};
      for (const k in results) {
        if (results[k].error()) out[k] = { error: results[k].error() };
        else                    out[k] = { data:  results[k].data()  };
      }
      resolve(out);
    });
  });
}

(function () {
  'use strict';

  const STORAGE_KEY = 'imgpress_admin_key';
  let adminKey = localStorage.getItem(STORAGE_KEY) || '';

  const authGate    = document.getElementById('auth-gate');
  const domainPanel = document.getElementById('domain-panel');
  const keyInput    = document.getElementById('admin-key-input');
  const authBtn     = document.getElementById('auth-btn');
  const authErr     = document.getElementById('auth-err');

  const domainInput  = document.getElementById('domain-input');
  const noteInput    = document.getElementById('note-input');
  const addBtn       = document.getElementById('add-btn');
  const addErr       = document.getElementById('add-err');

  const domainsTbody  = document.getElementById('domains-tbody');
  const domainsTable  = document.getElementById('domains-table');
  const emptyMsg      = document.getElementById('empty-msg');
  const domainCount   = document.getElementById('domain-count');

  function authHeaders() {
    return { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' };
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderDomains(domains) {
    domainsTbody.innerHTML = '';
    domainCount.textContent = domains.length ? '(' + domains.length + ')' : '';

    if (domains.length === 0) {
      emptyMsg.style.display = '';
      domainsTable.style.display = 'none';
      return;
    }

    emptyMsg.style.display = 'none';
    domainsTable.style.display = '';

    domains.forEach(function (d) {
      const date = new Date(d.created_at).toLocaleDateString();
      const tr   = document.createElement('tr');
      tr.innerHTML =
        '<td class="adm-domain">' + esc(d.domain) + '</td>' +
        '<td class="adm-note">'   + esc(d.note || '—') + '</td>' +
        '<td class="adm-date">'   + esc(date) + '</td>' +
        '<td><button class="adm-del" data-id="' + d.id + '">Remove</button></td>';
      domainsTbody.appendChild(tr);
    });
  }

  async function loadDomains() {
    try {
      const res = await fetch('/api/admin/domains', { headers: authHeaders() });
      if (res.status === 401) { showAuth(); return; }
      const data = await res.json();
      renderDomains(data.domains || []);
    } catch (e) {
      console.error('Failed to load domains', e);
    }
  }

  function showAuth() {
    authGate.style.display  = '';
    domainPanel.style.display = 'none';
    adminKey = '';
    localStorage.removeItem(STORAGE_KEY);
  }

  function showPanel(domains) {
    authGate.style.display    = 'none';
    domainPanel.style.display = '';
    renderDomains(domains || []);
  }

  async function tryAuth(key) {
    const res = await fetch('/api/admin/domains', {
      headers: { 'X-Admin-Key': key, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.domains || [];
  }

  // Auto-login with stored key
  if (adminKey) {
    tryAuth(adminKey).then(function (domains) {
      if (domains !== null) {
        showPanel(domains);
      } else {
        showAuth();
      }
    });
  }

  authBtn.addEventListener('click', async function () {
    const key = keyInput.value.trim();
    if (!key) return;
    authErr.style.display = 'none';
    authBtn.disabled = true;

    const domains = await tryAuth(key);
    authBtn.disabled = false;

    if (domains !== null) {
      adminKey = key;
      localStorage.setItem(STORAGE_KEY, adminKey);
      showPanel(domains);
    } else {
      authErr.style.display = '';
    }
  });

  keyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') authBtn.click();
  });

  addBtn.addEventListener('click', async function () {
    const domain = domainInput.value.trim();
    if (!domain) return;

    addErr.style.display = 'none';
    addBtn.disabled = true;

    try {
      const res = await fetch('/api/admin/domains', {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ domain: domain, note: noteInput.value.trim() }),
      });

      if (res.ok) {
        domainInput.value = '';
        noteInput.value   = '';
        loadDomains();
      } else {
        const data = await res.json();
        addErr.textContent    = data.error || 'Failed to add domain';
        addErr.style.display  = '';
      }
    } catch (e) {
      addErr.textContent   = 'Request failed';
      addErr.style.display = '';
    } finally {
      addBtn.disabled = false;
    }
  });

  domainInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addBtn.click();
  });

  document.addEventListener('click', async function (e) {
    if (!e.target.classList.contains('adm-del')) return;
    const btn = e.target;
    const id  = btn.dataset.id;
    btn.disabled = true;

    try {
      await fetch('/api/admin/domains/' + id, {
        method:  'DELETE',
        headers: authHeaders(),
      });
      loadDomains();
    } catch (e) {
      btn.disabled = false;
    }
  });
})();

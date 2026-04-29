// ===== API & Auth =====
const API_BASE = window.location.origin;
const TOKEN_KEY = 'knowingre_token';
const USER_KEY = 'knowingre_user';
let dataCache = null;

function sanitizeHeader(s) {
  // Headers only allow ISO-8859-1, strip anything outside that range
  return s.replace(/[^\x00-\xFF]/g, '').trim();
}

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {};
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers[k] = sanitizeHeader(String(v));
    }
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const resp = await fetch(API_BASE + path, { ...options, headers });
  if (resp.status === 401) { clearToken(); window.location.href = '/login.html'; throw new Error('未登录'); }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function getDefaultData() {
  return {
    settings: { baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-v4-flash' },
    recipes: [],
    inventory: [],
    todayMenu: []
  };
}

function getData() {
  if (!dataCache) dataCache = getDefaultData();
  return dataCache;
}

async function updateSettings(s) {
  const d = getData(); d.settings = s;
  await apiFetch('/api/settings', { method: 'PUT', body: { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model } });
}

async function updateRecipes(r) {
  getData().recipes = r;
}

async function updateInventory(i) {
  getData().inventory = i;
}

async function updateTodayMenu(m) {
  getData().todayMenu = m;
}

// ===== SVG Icons =====
const I = {
  plus: '<svg width="14" height="14" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  xmark: '<svg width="14" height="14" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  menu: '<svg width="12" height="12" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="0.5" fill="currentColor"/><circle cx="4" cy="12" r="0.5" fill="currentColor"/><circle cx="4" cy="18" r="0.5" fill="currentColor"/></svg>',
  sync: '<svg width="12" height="12" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  sparkle: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/></svg>',
  cook: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  users: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  lock: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  key: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  export: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  import: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  star: '<svg width="12" height="12" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/></svg>',
  starEmpty: '<svg width="12" height="12" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  home: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
};
function iconSvg(key, cls) { return `<span class="icon ${cls || ''}">${I[key] || ''}</span>`; }

// UUID helper
function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function scoped(path) {
  if (currentScope === 'family' && (path.startsWith('/api/recipes') || path.startsWith('/api/inventory') || path.startsWith('/api/menu') || path.startsWith('/api/cook'))) {
    const sep = path.includes('?') ? '&' : '?';
    return path + sep + 'scope=family';
  }
  return path;
}

async function fetchAllData() {
  const [recipes, inventory, menu, rawSettings] = await Promise.all([
    apiFetch(scoped('/api/recipes')),
    apiFetch(scoped('/api/inventory')),
    apiFetch(scoped('/api/menu')),
    apiFetch('/api/settings').catch(() => ({}))
  ]);
  // Map server snake_case to frontend camelCase
  const settings = {
    baseUrl: rawSettings.base_url || 'https://api.deepseek.com/v1',
    apiKey: rawSettings.api_key || '',
    model: rawSettings.model || 'deepseek-v4-flash'
  };
  dataCache = { recipes, inventory, todayMenu: menu, settings };
  return dataCache;
}

// ===== State =====
let currentTab = 'menu';
let currentScope = 'personal';
let currentFilterTag = null;
let editingRecipeId = null;
let editingInventoryId = null;
let recipeFormDirty = false;

// ===== Toast Notifications =====
function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const icon = type === 'success' ? I.check : type === 'error' ? I.xmark : '';
  toast.innerHTML = `${icon ? '<span class="icon icon-sm">' + icon + '</span> ' : ''}${message}`;
  container.appendChild(toast);
  const duration = type === 'error' ? 4000 : 2500;
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ===== Tab Indicator =====
function updateTabIndicator() {
  const bar = document.querySelector('.tab-bar-inner');
  const activeTab = document.querySelector('.tab.active');
  if (!bar || !activeTab) return;
  const indicator = bar.querySelector('.tab-indicator');
  if (!indicator) return;
  const barRect = bar.getBoundingClientRect();
  const tabRect = activeTab.getBoundingClientRect();
  indicator.style.left = (tabRect.left - barRect.left) + 'px';
  indicator.style.width = tabRect.width + 'px';
}

// ===== Tab Switching =====
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    currentTab = t.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
    document.getElementById('panel-' + currentTab).classList.add('active');
    updateTabIndicator();
    renderCurrentTab();
  });
});

function renderCurrentTab() {
  if (currentTab === 'recipes') renderRecipes();
  else if (currentTab === 'inventory') renderInventory();
  else if (currentTab === 'menu') renderMenu();
  updateStats();
}

// ===== Stats =====
function updateStats() {
  const d = getData();
  const scopeIcon = currentScope === 'family' ? I.users : I.user;
  const scopeLabel = currentScope === 'family' ? '家庭' : '个人';
  document.getElementById('statsText').innerHTML =
    `<span class="icon icon-sm">${scopeIcon}</span> ${scopeLabel} &nbsp;|&nbsp; <span class="icon icon-sm">${I.home}</span> ${d.recipes.length} 份菜谱 &nbsp;|&nbsp; <span class="icon icon-sm">${I.import}</span> ${d.inventory.length} 种食材 &nbsp;|&nbsp; <span class="icon icon-sm">${I.menu}</span> ${d.todayMenu.length} 道今日菜单`;
}

// ===== Settings =====
function switchSettingsTab(name) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t.dataset.stab === name));
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('active', p.id === 'spanel-' + name));
  document.getElementById('pwStatus').textContent = '';
}

document.querySelectorAll('.settings-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchSettingsTab(tab.dataset.stab);
    if (tab.dataset.stab === 'family') loadFamilySettings();
  });
});

document.getElementById('btnSettings').addEventListener('click', async () => {
  const s = getData().settings;
  document.getElementById('sfBaseUrl').value = s.baseUrl || '';
  document.getElementById('sfApiKey').value = s.apiKey || '';
  document.getElementById('sfModel').value = s.model || '';
  document.getElementById('modalSettings').hidden = false;
  switchSettingsTab('api');

  // Show/hide users tab for admin
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    const usersTab = document.getElementById('stabUsers');
    if (user.isAdmin) {
      usersTab.style.display = '';
      const users = await apiFetch('/api/admin/users');
      const list = document.getElementById('adminUserList');
      list.innerHTML = users.map(u => `
        <div class="flex-between" style="padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm)">
          <div>
            <span style="font-weight:600;font-size:0.9rem">${esc(u.username)}</span>
            ${u.is_admin ? '<span style="font-size:0.7rem;background:var(--clay);color:#fff;padding:1px 8px;border-radius:10px;margin-left:6px">管理员</span>' : ''}
          </div>
          <button class="btn btn-sm" data-admin-reset="${u.id}" style="font-size:0.75rem;color:var(--chili)">重置密码</button>
        </div>
      `).join('');
    } else {
      usersTab.style.display = 'none';
    }
  } catch {}
});

document.getElementById('btnSettingsClose').addEventListener('click', () => {
  document.getElementById('modalSettings').hidden = true;
});

// ===== Scope Toggle =====
document.getElementById('scopeToggle').addEventListener('click', async (e) => {
  const btn = e.target.closest('.scope-btn');
  if (!btn || btn.classList.contains('active')) return;
  if (btn.dataset.scope === 'family') {
    try {
      const info = await apiFetch('/api/family');
      if (!info.family) {
        showToast('请先在设置中创建或加入家庭', 'info');
        return;
      }
    } catch { showToast('请先在设置中创建或加入家庭', 'info'); return; }
  }
  currentScope = btn.dataset.scope;
  document.querySelectorAll('.scope-btn').forEach(b => b.classList.toggle('active', b.dataset.scope === currentScope));
  await fetchAllData();
  renderCurrentTab();
  updateStats();
});

// ===== Family Management =====
async function loadFamilySettings() {
  try {
    const data = await apiFetch('/api/family');
    document.getElementById('familyNoFamily').style.display = data.family ? 'none' : '';
    document.getElementById('familyInfo').style.display = data.family ? '' : 'none';
    if (data.family) {
      document.getElementById('familyName').textContent = data.family.name;
      document.getElementById('familyCode').textContent = data.family.inviteCode;
      document.getElementById('familyMemberList').innerHTML = data.members.map(m =>
        `<div style="padding:6px 10px;background:var(--surface);border-radius:var(--radius-sm);font-size:0.88rem">👤 ${esc(m.username)}</div>`
      ).join('');
    }
  } catch { document.getElementById('familyNoFamily').style.display = ''; }
}

document.getElementById('btnCreateFamily').addEventListener('click', async () => {
  const name = prompt('输入家庭名称：');
  if (!name) return;
  try {
    await apiFetch('/api/family/create', { method: 'POST', body: { name } });
    showToast('家庭创建成功', 'success');
    loadFamilySettings();
  } catch (err) { showToast(err.message, 'error'); }
});

document.getElementById('btnJoinFamily').addEventListener('click', async () => {
  const code = document.getElementById('joinCode').value.trim();
  if (!code) { showToast('请输入邀请码', 'error'); return; }
  try {
    await apiFetch('/api/family/join', { method: 'POST', body: { code } });
    showToast('加入成功', 'success');
    document.getElementById('joinCode').value = '';
    loadFamilySettings();
  } catch (err) { showToast(err.message, 'error'); }
});

document.getElementById('btnLeaveFamily').addEventListener('click', async () => {
  if (!confirm('确定离开家庭？')) return;
  try {
    await apiFetch('/api/family/leave', { method: 'POST' });
    showToast('已离开家庭', 'success');
    if (currentScope === 'family') {
      currentScope = 'personal';
      document.querySelectorAll('.scope-btn').forEach(b => b.classList.toggle('active', b.dataset.scope === 'personal'));
      await fetchAllData();
      renderCurrentTab();
      updateStats();
    }
    loadFamilySettings();
  } catch (err) { showToast(err.message, 'error'); }
});

document.getElementById('familyCode').addEventListener('click', () => {
  const code = document.getElementById('familyCode').textContent;
  navigator.clipboard.writeText(code).then(() => showToast('已复制邀请码', 'success'));
});

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = {
    baseUrl: document.getElementById('sfBaseUrl').value.trim(),
    apiKey: document.getElementById('sfApiKey').value.trim(),
    model: document.getElementById('sfModel').value.trim()
  };
  getData().settings = s;
  await apiFetch('/api/settings', { method: 'PUT', body: s });
  document.getElementById('modalSettings').hidden = true;
});

// Change password
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const oldPw = document.getElementById('pwOld').value;
  const newPw = document.getElementById('pwNew').value;
  if (newPw.length < 4) { showToast('新密码至少4位', 'error'); return; }
  const status = document.getElementById('pwStatus');
  status.textContent = '⏳';
  try {
    await apiFetch('/api/auth/password', { method: 'PUT', body: { oldPassword: oldPw, newPassword: newPw } });
    status.textContent = '✅ 已修改';
    document.getElementById('pwOld').value = '';
    document.getElementById('pwNew').value = '';
  } catch (err) {
    status.textContent = '❌ ' + err.message;
  }
});

// Admin: reset user password
document.getElementById('adminUserList').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-admin-reset]');
  if (!btn) return;
  const userId = btn.dataset.adminReset;
  const newPw = prompt('输入新密码（至少4位）：');
  if (!newPw || newPw.length < 4) { showToast('密码至少4位', 'error'); return; }
  try {
    await apiFetch('/api/admin/reset-password', { method: 'POST', body: { userId, newPassword: newPw } });
    showToast('密码已重置', 'success');
  } catch (err) { showToast('操作失败: ' + err.message, 'error'); }
});

// ===== Data Export / Import =====
document.getElementById('btnExportData').addEventListener('click', () => {
  const data = getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `knowingre-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnImportData').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.recipes || !Array.isArray(data.recipes) || !data.inventory || !Array.isArray(data.inventory)) {
          showToast('数据格式不正确。备份文件需包含 recipes 和 inventory 字段。', 'error');
          return;
        }
        if (!data.settings) data.settings = getDefaultData().settings;
        if (!data.todayMenu || !Array.isArray(data.todayMenu)) data.todayMenu = [];
        if (!confirm('导入将覆盖当前所有数据，确定继续吗？')) return;
        try {
          // Upload recipes
          for (const r of data.recipes) {
            await apiFetch(scoped('/api/recipes'), { method: 'POST', body: { ...r, id: r.id || uid() } });
          }
          // Upload inventory
          for (const inv of data.inventory) {
            await apiFetch(scoped('/api/inventory'), { method: 'POST', body: { ...inv, id: inv.id || uid() } });
          }
          // Upload menu
          for (const mid of data.todayMenu) {
            await apiFetch(scoped(`/api/menu/${mid}`), { method: 'POST' }).catch(() => {});
          }
          // Refresh
          dataCache = null;
          await fetchAllData();
        } catch (err) { showToast('导入失败: ' + err.message, 'error'); return; }
        renderCurrentTab();
        showToast('数据导入成功！', 'success');
      } catch (err) {
        showToast('文件解析失败: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target !== overlay) return;
    if (overlay.id === 'modalRecipe' && recipeFormDirty && !recipeViewMode) {
      if (!confirm('有未保存的修改，确定放弃吗？')) return;
    }
    recipeFormDirty = false;
    overlay.hidden = true;
  });
});

// ===== Recipe Rendering =====
function renderRecipes() {
  const d = getData();
  let recipes = d.recipes;
  const search = document.getElementById('recipeSearch').value.trim().toLowerCase();

  if (search) {
    recipes = recipes.filter(r =>
      r.name.toLowerCase().includes(search) ||
      r.tags.some(t => t.toLowerCase().includes(search)) ||
      r.ingredients.some(i => i.name.toLowerCase().includes(search))
    );
  }
  if (currentFilterTag) {
    recipes = recipes.filter(r => r.tags.includes(currentFilterTag));
  }

  renderTagFilters(d.recipes);
  const grid = document.getElementById('recipeGrid');
  const empty = document.getElementById('recipeEmpty');

  if (d.recipes.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
  } else if (recipes.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>🔍 没有匹配的菜谱</p></div>';
    empty.style.display = 'none';
  } else {
    empty.style.display = 'none';
    const todayMenuIds = d.todayMenu || [];
    grid.innerHTML = recipes.map(r => {
      const inMenu = todayMenuIds.includes(r.id);
      const stars = Array.from({length:5}, (_,i) =>
        i < r.rating ? `<span class="star">${I.star}</span>` : `<span class="star-empty">${I.starEmpty}</span>`
      ).join('');
      const lastCooked = r.cookedDates.length
        ? r.cookedDates[r.cookedDates.length - 1].slice(0, 10)
        : '尚未做过';
      return `
        <div class="recipe-card${inMenu ? ' in-menu' : ''}" data-id="${r.id}">
          ${inMenu ? '<button class="card-menu-badge" data-menu-remove-card="' + r.id + '" title="点击从今日菜单移除">' + iconSvg('menu', 'icon-sm') + ' 今日菜单 ' + iconSvg('xmark', 'icon-sm') + '</button>' : ''}
          <div class="card-name">${esc(r.name)}</div>
          <div class="card-tags">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          <div class="card-meta">
            <span>🥬 ${r.ingredients.length}种食材</span>
            <span>📝 ${r.steps.length}步</span>
          </div>
          <div class="card-meta" style="margin-top:4px">
            <span>${stars}</span>
            <span>${lastCooked}</span>
          </div>
          <div class="card-footer">
            <span class="card-hint">点击查看详情 →</span>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="btn btn-xs" data-sync-recipe="${r.id}" title="${currentScope === 'family' ? '同步到个人' : '同步到家庭'}" style="border-color:var(--stone-dark);color:var(--text-muted)">${iconSvg('sync', 'icon-sm')}</button>
              ${inMenu
                ? `<button class="btn btn-xs" data-menu-remove-card="${r.id}" style="border-color:var(--bloom);color:var(--bloom);background:var(--bloom-ghost)">${iconSvg('menu', 'icon-sm')} 移出</button>`
                : `<button class="btn btn-xs btn-primary" data-menu-add="${r.id}">${iconSvg('plus', 'icon-sm')} 加入</button>`
              }
            </div>
          </div>
        </div>`;
    }).join('');

  }
}

function renderTagFilters(recipes) {
  const allTags = [...new Set(recipes.flatMap(r => r.tags))];
  const container = document.getElementById('tagFilters');
  if (allTags.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = allTags.map(t =>
    `<span class="tag-filter${t === currentFilterTag ? ' active' : ''}" data-tag="${esc(t)}">${esc(t)}</span>`
  ).join('');
}

document.getElementById('recipeSearch').addEventListener('input', debounce(renderRecipes, 200));
document.getElementById('btnNewRecipe').addEventListener('click', () => openRecipeModal(null));

// ===== Recipe Modal =====
let recipeViewMode = false;

function setRecipeFormEditable(editable) {
  recipeViewMode = !editable;
  document.getElementById('btnEditRecipe').style.display = editable ? 'none' : '';
  document.getElementById('btnCancelEdit').style.display = editable ? '' : 'none';
  document.getElementById('btnSave').style.display = editable ? '' : 'none';
  document.getElementById('btnDeleteRecipe').style.display = editingRecipeId && editable ? '' : 'none';
  document.getElementById('aiGenSection').hidden = !editable || !!editingRecipeId;
  document.getElementById('aiModifySection').hidden = !editable;

  document.querySelectorAll('#rfIngredients input, #rfIngredients textarea, #rfSteps textarea, #rfName, #rfTags, #rfNotes, #rfSource').forEach(el => {
    el.disabled = !editable;
  });
  document.querySelectorAll('.row-remove').forEach(el => {
    el.style.display = editable ? '' : 'none';
  });
  document.getElementById('btnAddIngredient').style.display = editable ? '' : 'none';
  document.getElementById('btnAddStep').style.display = editable ? '' : 'none';
  // Rating only editable in edit mode
  document.querySelectorAll('#rfRating span').forEach(s => {
    s.style.pointerEvents = editable ? '' : 'none';
    s.style.opacity = editable ? '' : '0.7';
  });

  const title = editingRecipeId ? (editable ? '编辑菜谱' : '菜谱详情') : '新建菜谱';
  document.getElementById('modalTitle').textContent = title;
}

function openRecipeModal(id) {
  const d = getData();
  const recipe = id ? d.recipes.find(r => r.id === id) : null;
  editingRecipeId = id;
  recipeFormDirty = false;
  const isNew = !recipe;

  document.getElementById('aiGenDishName').value = '';
  document.getElementById('aiGenStatus').textContent = '';
  document.getElementById('aiModifyInput').value = '';
  document.getElementById('aiModifyStatus').textContent = '';

  document.getElementById('rfId').value = recipe?.id || '';
  document.getElementById('rfName').value = recipe?.name || '';
  document.getElementById('rfTags').value = recipe?.tags.join(', ') || '';
  document.getElementById('rfNotes').value = recipe?.notes || '';
  document.getElementById('rfSource').value = recipe?.source || 'manual';
  refreshTagChips();

  // Rating
  const rating = recipe?.rating || 0;
  document.querySelectorAll('#rfRating span').forEach((s, i) => {
    s.classList.toggle('on', i < rating);
    s.textContent = i < rating ? '★' : '☆';
  });

  // Ingredients
  const ingDiv = document.getElementById('rfIngredients');
  const ings = recipe?.ingredients || [{ name: '', amount: '', optional: false }];
  ingDiv.innerHTML = ings.map((ing, i) => `
    <div class="ingredient-row">
      <input type="text" placeholder="食材名称" value="${esc(ing.name)}" data-ing-name>
      <input type="text" placeholder="用量 (如200g)" value="${esc(ing.amount)}" data-ing-amount style="max-width:150px">
      <label style="font-weight:normal;display:flex;align-items:center;gap:4px;margin:0;white-space:nowrap">
        <input type="checkbox" ${ing.optional ? 'checked' : ''} data-ing-opt> 可选
      </label>
      <button type="button" class="row-remove" data-remove-ing>×</button>
    </div>
  `).join('');

  // Steps
  const stepDiv = document.getElementById('rfSteps');
  const steps = recipe?.steps || [''];
  stepDiv.innerHTML = steps.map((s, i) => `
    <div class="step-row">
      <span class="step-num">${i + 1}</span>
      <textarea placeholder="步骤 ${i + 1}" data-step>${esc(s)}</textarea>
      <button type="button" class="row-remove" data-remove-step>×</button>
    </div>
  `).join('');

  bindRemoveButtons();

  // View mode for existing recipes, edit mode for new ones
  setRecipeFormEditable(isNew);
  document.getElementById('modalRecipe').hidden = false;
}

document.getElementById('btnEditRecipe').addEventListener('click', () => {
  setRecipeFormEditable(true);
});

function maybeCloseRecipeModal() {
  if (recipeFormDirty && !recipeViewMode && !confirm('有未保存的修改，确定放弃吗？')) return;
  recipeFormDirty = false;
  document.getElementById('modalRecipe').hidden = true;
}

document.getElementById('btnModalClose').addEventListener('click', maybeCloseRecipeModal);

// Cancel — close without saving
document.getElementById('btnCancelEdit').addEventListener('click', maybeCloseRecipeModal);

// Save button in header
document.getElementById('btnSave').addEventListener('click', () => {
  saveRecipeFromModal();
});

// Star rating — delegated
document.getElementById('rfRating').addEventListener('click', (e) => {
  if (e.target.tagName !== 'SPAN') return;
  const v = parseInt(e.target.dataset.v);
  document.querySelectorAll('#rfRating span').forEach((s, i) => {
    s.classList.toggle('on', i < v);
    s.textContent = i < v ? '★' : '☆';
  });
  // Pop animation
  e.target.classList.add('pop');
  e.target.addEventListener('animationend', () => e.target.classList.remove('pop'), { once: true });
});

// AI gen fill in recipe modal
function resetRecipeFormToEmpty() {
  const ingDiv = document.getElementById('rfIngredients');
  const stepDiv = document.getElementById('rfSteps');
  ingDiv.innerHTML = `<div class="ingredient-row">
    <input type="text" placeholder="食材名称" value="" data-ing-name>
    <input type="text" placeholder="用量 (如200g)" value="" data-ing-amount style="max-width:150px">
    <label style="font-weight:normal;display:flex;align-items:center;gap:4px;margin:0;white-space:nowrap">
      <input type="checkbox" data-ing-opt> 可选
    </label>
    <button type="button" class="row-remove" data-remove-ing>×</button>
  </div>`;
  stepDiv.innerHTML = `<div class="step-row">
    <span class="step-num">1</span>
    <textarea placeholder="步骤 1" data-step></textarea>
    <button type="button" class="row-remove" data-remove-step>×</button>
  </div>`;
  bindRemoveButtons();
}

document.getElementById('btnAiGenFill').addEventListener('click', async () => {
  const input = document.getElementById('aiGenDishName');
  const dishName = input.value.trim();
  if (!dishName) { showToast('请输入菜名', 'error'); return; }
  const status = document.getElementById('aiGenStatus');
  const btn = document.getElementById('btnAiGenFill');

  // Show shimmer skeletons
  status.innerHTML = '<span class="ai-spinner"></span> AI 正在生成菜谱...';
  btn.disabled = true;
  const ingDiv = document.getElementById('rfIngredients');
  const stepDiv = document.getElementById('rfSteps');
  ingDiv.innerHTML = Array.from({length: 4}, () =>
    '<div class="shimmer-row"><div class="shimmer-bar w-60"></div><div class="shimmer-bar w-30"></div></div>'
  ).join('');
  stepDiv.innerHTML = Array.from({length: 4}, () =>
    '<div class="shimmer-row"><div class="shimmer-num"></div><div class="shimmer-bar shimmer-bar--tall"></div></div>'
  ).join('');

  try {
    const d = getData();
    if (!d.settings.apiKey) { showToast('请先设置 API Key', 'error'); resetRecipeFormToEmpty(); status.textContent = ''; btn.disabled = false; return; }
    const recipe = await callLLM(dishName, d.settings);
    // Fill form with staggered reveal
    document.getElementById('rfName').value = recipe.name;
    document.getElementById('rfTags').value = (recipe.tags || []).join(', ');
    document.getElementById('rfNotes').value = recipe.notes || '';
    // Ingredients
    ingDiv.innerHTML = (recipe.ingredients || []).map((ing, i) => `
      <div class="ingredient-row reveal-row" style="animation-delay:${i * 0.05}s">
        <input type="text" placeholder="食材名称" value="${esc(ing.name)}" data-ing-name>
        <input type="text" placeholder="用量 (如200g)" value="${esc(ing.amount)}" data-ing-amount style="max-width:150px">
        <label style="font-weight:normal;display:flex;align-items:center;gap:4px;margin:0;white-space:nowrap">
          <input type="checkbox" ${ing.optional ? 'checked' : ''} data-ing-opt> 可选
        </label>
        <button type="button" class="row-remove" data-remove-ing>×</button>
      </div>
    `).join('');
    // Steps
    stepDiv.innerHTML = (recipe.steps || []).map((s, i) => `
      <div class="step-row reveal-row" style="animation-delay:${i * 0.06}s">
        <span class="step-num">${i + 1}</span>
        <textarea placeholder="步骤 ${i + 1}" data-step>${esc(s)}</textarea>
        <button type="button" class="row-remove" data-remove-step>×</button>
      </div>
    `).join('');
    document.getElementById('rfSource').value = 'ai';
    bindRemoveButtons();
    recipeFormDirty = true;
    status.innerHTML = '<span class="ai-check">✓</span> 已填入';
  } catch (err) {
    resetRecipeFormToEmpty();
    status.textContent = '❌ ' + err.message;
  }
  btn.disabled = false;
});

// AI modify — apply modification to current form content
document.getElementById('btnAiModify').addEventListener('click', async () => {
  const instruction = document.getElementById('aiModifyInput').value.trim();
  if (!instruction) { showToast('请输入修改要求', 'error'); return; }
  const current = collectRecipeForm();
  if (!current.name) { showToast('请先填写菜名', 'error'); return; }
  const status = document.getElementById('aiModifyStatus');
  const btn = document.getElementById('btnAiModify');

  // Show shimmer skeletons
  status.innerHTML = '<span class="ai-spinner"></span> AI 正在修改菜谱...';
  btn.disabled = true;
  const ingDiv = document.getElementById('rfIngredients');
  const stepDiv = document.getElementById('rfSteps');
  const ingCount = current.ingredients.length || 4;
  const stepCount = current.steps.length || 4;
  ingDiv.innerHTML = Array.from({length: Math.min(ingCount, 6)}, () =>
    '<div class="shimmer-row"><div class="shimmer-bar w-60"></div><div class="shimmer-bar w-30"></div></div>'
  ).join('');
  stepDiv.innerHTML = Array.from({length: Math.min(stepCount, 6)}, () =>
    '<div class="shimmer-row"><div class="shimmer-num"></div><div class="shimmer-bar shimmer-bar--tall"></div></div>'
  ).join('');

  try {
    const d = getData();
    if (!d.settings.apiKey) { showToast('请设置 API Key', 'error'); resetRecipeFormToEmpty(); status.textContent = ''; btn.disabled = false; return; }
    const updated = await modifyRecipe(current, instruction, d.settings);
    // Fill form with staggered reveal
    document.getElementById('rfName').value = updated.name || current.name;
    document.getElementById('rfTags').value = (updated.tags?.length ? updated.tags : current.tags || []).join(', ');
    document.getElementById('rfNotes').value = updated.notes || current.notes || '';
    const ings = updated.ingredients?.length ? updated.ingredients : current.ingredients;
    ingDiv.innerHTML = ings.map((ing, i) => `
      <div class="ingredient-row reveal-row" style="animation-delay:${i * 0.05}s">
        <input type="text" placeholder="食材名称" value="${esc(ing.name)}" data-ing-name>
        <input type="text" placeholder="用量 (如200g)" value="${esc(ing.amount)}" data-ing-amount style="max-width:150px">
        <label style="font-weight:normal;display:flex;align-items:center;gap:4px;margin:0;white-space:nowrap">
          <input type="checkbox" ${ing.optional ? 'checked' : ''} data-ing-opt> 可选
        </label>
        <button type="button" class="row-remove" data-remove-ing>×</button>
      </div>
    `).join('');
    const stps = updated.steps?.length ? updated.steps : current.steps;
    stepDiv.innerHTML = stps.map((s, i) => `
      <div class="step-row reveal-row" style="animation-delay:${i * 0.06}s">
        <span class="step-num">${i + 1}</span>
        <textarea placeholder="步骤 ${i + 1}" data-step>${esc(s)}</textarea>
        <button type="button" class="row-remove" data-remove-step>×</button>
      </div>
    `).join('');
    document.getElementById('rfSource').value = 'ai';
    bindRemoveButtons();
    recipeFormDirty = true;
    status.innerHTML = '<span class="ai-check">✓</span> 已修改';
    document.getElementById('aiModifyInput').value = '';
  } catch (err) {
    status.textContent = '❌ ' + err.message;
  }
  btn.disabled = false;
});

// Tag suggestion chips — click to add
document.getElementById('tagSuggestions').addEventListener('click', (e) => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  const tag = chip.dataset.tag;
  const input = document.getElementById('rfTags');
  const current = input.value.split(',').map(s => s.trim()).filter(Boolean);
  if (current.includes(tag)) {
    // Remove tag
    input.value = current.filter(t => t !== tag).join(', ');
  } else {
    // Add tag
    current.push(tag);
    input.value = current.join(', ');
  }
  refreshTagChips();
  recipeFormDirty = true;
});

function refreshTagChips() {
  const current = document.getElementById('rfTags').value.split(',').map(s => s.trim()).filter(Boolean);
  document.querySelectorAll('#tagSuggestions .tag-chip').forEach(chip => {
    chip.classList.toggle('used', current.includes(chip.dataset.tag));
  });
}

// Refresh tag chips when typing in tag input
document.getElementById('rfTags').addEventListener('input', refreshTagChips);

document.getElementById('btnAddIngredient').addEventListener('click', () => {
  const div = document.getElementById('rfIngredients');
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.innerHTML = `
    <input type="text" placeholder="食材名称" data-ing-name>
    <input type="text" placeholder="用量 (如200g)" data-ing-amount style="max-width:150px">
    <label style="font-weight:normal;display:flex;align-items:center;gap:4px;margin:0;white-space:nowrap">
      <input type="checkbox" data-ing-opt> 可选
    </label>
    <button type="button" class="row-remove" data-remove-ing>×</button>
  `;
  div.appendChild(row);
  bindRemoveButtons();
});

document.getElementById('btnAddStep').addEventListener('click', () => {
  const div = document.getElementById('rfSteps');
  const idx = div.children.length + 1;
  const row = document.createElement('div');
  row.className = 'step-row';
  row.innerHTML = `
    <span class="step-num">${idx}</span>
    <textarea placeholder="步骤 ${idx}" data-step></textarea>
    <button type="button" class="row-remove" data-remove-step>×</button>
  `;
  div.appendChild(row);
  bindRemoveButtons();
});

function bindRemoveButtons() {
  document.querySelectorAll('[data-remove-ing]').forEach(b => {
    b.removeEventListener('click', removeIngHandler);
    b.addEventListener('click', removeIngHandler);
  });
  document.querySelectorAll('[data-remove-step]').forEach(b => {
    b.removeEventListener('click', removeStepHandler);
    b.addEventListener('click', removeStepHandler);
  });
}

function removeIngHandler(e) {
  const rows = document.querySelectorAll('#rfIngredients .ingredient-row');
  if (rows.length > 1) e.target.closest('.ingredient-row').remove();
}

function removeStepHandler(e) {
  const rows = document.querySelectorAll('#rfSteps .step-row');
  if (rows.length > 1) {
    e.target.closest('.step-row').remove();
    // Renumber
    document.querySelectorAll('#rfSteps .step-row').forEach((r, i) => {
      r.querySelector('.step-num').textContent = i + 1;
      r.querySelector('textarea').placeholder = `步骤 ${i + 1}`;
    });
  }
}

bindRemoveButtons();

function collectRecipeForm() {
  const ingredients = [];
  document.querySelectorAll('#rfIngredients .ingredient-row').forEach(row => {
    const name = row.querySelector('[data-ing-name]').value.trim();
    if (!name) return;
    ingredients.push({
      name,
      amount: row.querySelector('[data-ing-amount]').value.trim(),
      optional: row.querySelector('[data-ing-opt]').checked
    });
  });
  const steps = [];
  document.querySelectorAll('#rfSteps [data-step]').forEach(ta => {
    const v = ta.value.trim();
    if (v) steps.push(v);
  });

  const ratingEls = document.querySelectorAll('#rfRating span.on');
  const rating = ratingEls.length;

  return {
    name: document.getElementById('rfName').value.trim(),
    tags: document.getElementById('rfTags').value.split(',').map(s => s.trim()).filter(Boolean),
    ingredients,
    steps,
    notes: document.getElementById('rfNotes').value.trim(),
    source: document.getElementById('rfSource').value,
    rating
  };
}

async function saveRecipeFromModal() {
  const form = collectRecipeForm();
  if (!form.name) { showToast('请输入菜名', 'error'); return; }
  if (form.ingredients.length === 0) { showToast('请至少添加一种食材', 'error'); return; }

  const d = getData();
  if (editingRecipeId) {
    // Check conflict
    const conflict = d.recipes.find(r => r.name === form.name && r.id !== editingRecipeId);
    if (conflict) {
      if (!confirm(`「${form.name}」已存在于菜谱库中（另一份菜谱）。\n点击"确定"覆盖现有菜谱，点击"取消"放弃保存。`)) return;
    }
    try {
      const body = { ...form, cookedDates: (d.recipes.find(r => r.id === editingRecipeId)?.cookedDates || []) };
      await apiFetch(scoped(`/api/recipes/${editingRecipeId}`), { method: 'PUT', body });
      // Refresh from server
      const recipes = await apiFetch(scoped('/api/recipes'));
      d.recipes = recipes;
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); return; }
  } else {
    const dup = d.recipes.find(r => r.name === form.name);
    if (dup && !confirm(`「${form.name}」已存在于菜谱库中。\n点击"确定"覆盖，点击"取消"保留现有。`)) return;
    try {
      await apiFetch(scoped('/api/recipes'), { method: 'POST', body: { ...form, id: uid() } });
      const recipes = await apiFetch(scoped('/api/recipes'));
      d.recipes = recipes;
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); return; }
  }
  showToast(editingRecipeId ? '菜谱已更新' : '菜谱已创建', 'success');
  recipeFormDirty = false;
  document.getElementById('modalRecipe').hidden = true;
  editingRecipeId = null;
  renderRecipes();
}

document.getElementById('recipeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  saveRecipeFromModal();
});

// Track form dirty state
document.getElementById('recipeForm').addEventListener('input', () => {
  recipeFormDirty = true;
});

document.getElementById('btnDeleteRecipe').addEventListener('click', async () => {
  if (!editingRecipeId) return;
  if (!confirm('确定要删除这份菜谱吗？')) return;
  try {
    await apiFetch(scoped(`/api/recipes/${editingRecipeId}`), { method: 'DELETE' });
    const d = getData();
    d.recipes = d.recipes.filter(r => r.id !== editingRecipeId);
    d.todayMenu = d.todayMenu.filter(id => id !== editingRecipeId);
  } catch (err) { showToast('删除失败: ' + err.message, 'error'); return; }
  recipeFormDirty = false;
  document.getElementById('modalRecipe').hidden = true;
  editingRecipeId = null;
  renderRecipes();
});

// ===== AI Generate (used in recipe modal) =====

async function callLLM(dishName, settings) {
  const systemPrompt = `你是一个专业的中餐厨师助手。用户想了解一道菜的做法。

请返回严格的 JSON 格式，不要包含 markdown 代码块标记，只返回纯 JSON：

{
  "name": "菜名",
  "ingredients": [{"name": "食材名", "amount": "用量", "optional": false}],
  "steps": ["步骤1", "步骤2", ...],
  "tags": ["标签1", "标签2"],
  "notes": "烹饪技巧或备注"
}

对于 ingredients 中的 optional 字段，主要食材设为 false，可选/替代食材设为 true。
标签请从以下列表中优先选择（最多3个）：家常、快手、川菜、粤菜、湘菜、鲁菜、凉菜、汤羹、主食、面食、烘焙、蒸菜、炖煮、煎炸、烧烤、素食、早餐、下酒、宴客、减脂。如果没有合适的，可补充一个自定义标签。`;

  const baseUrl = sanitizeHeader(settings.baseUrl || '');
  const apiKey = sanitizeHeader(settings.apiKey || '');
  if (!apiKey) throw new Error('请先在设置中填写 API Key');

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请告诉我【${dishName}】的做法，包括所需食材和详细步骤。` }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API 请求失败 (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('API 返回格式异常，未找到有效响应内容');
  }
  return safeParseJSON(data.choices[0].message.content);
}

// AI modify — update existing recipe content via LLM
async function modifyRecipe(recipe, instruction, settings) {
  const systemPrompt = `你是一个专业的中餐厨师助手。用户会提供一份菜谱和你需要做的修改。

请返回严格的 JSON 格式，不要包含 markdown 代码块标记，只返回纯 JSON：

{
  "name": "菜名",
  "ingredients": [{"name": "食材名", "amount": "用量", "optional": false}],
  "steps": ["步骤1", "步骤2", ...],
  "tags": ["标签1", "标签2"],
  "notes": "烹饪技巧或备注"
}

对于 ingredients 中的 optional 字段，主要食材设为 false，可选/替代食材设为 true。
标签请从以下列表中优先选择（最多3个）：家常、快手、川菜、粤菜、湘菜、鲁菜、凉菜、汤羹、主食、面食、烘焙、蒸菜、炖煮、煎炸、烧烤、素食、早餐、下酒、宴客、减脂。如果没有合适的，可补充一个自定义标签。
保持 JSON 结构完整，只做用户要求的修改，其他部分尽量保持原样。`;

  const baseUrl = sanitizeHeader(settings.baseUrl || '');
  const apiKey = sanitizeHeader(settings.apiKey || '');
  if (!apiKey) throw new Error('请先在设置中填写 API Key');

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `当前菜谱：\n${JSON.stringify(recipe, null, 2)}\n\n请根据以下要求修改：${instruction}` }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API 请求失败 (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('API 返回格式异常，未找到有效响应内容');
  }
  return safeParseJSON(data.choices[0].message.content);
}

// ===== Inventory =====
function renderInventory() {
  const d = getData();
  document.getElementById('invCount').textContent = d.inventory.length > 0 ? `${d.inventory.length} 种` : '';

  // Inventory list
  const listDiv = document.getElementById('inventoryList');
  if (d.inventory.length === 0) {
    listDiv.innerHTML = '<div class="empty-state" style="padding:30px"><p>🧺 暂无食材，添加一些吧</p></div>';
  } else {
    // Group by category
    const grouped = {};
    d.inventory.forEach(item => {
      const cat = item.category || '其他';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    listDiv.innerHTML = Object.entries(grouped).map(([cat, items]) => `
      <div style="margin-bottom:10px">
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;padding-left:4px">${esc(cat)}</div>
        ${items.map(item => `
          <div class="inv-item">
            <div class="inv-info">
              <span class="inv-name">${esc(item.name)}</span>
              <span class="inv-amount">${esc(item.amount)}${item.category !== '调料' && item.unit ? ' ' + esc(item.unit) : ''}</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="inv-category">${esc(item.category || '其他')}</span>
              <button class="btn btn-sm" data-inv-edit="${item.id}" style="border:none;background:none;cursor:pointer;color:var(--clay)">编辑</button>
              <button class="btn btn-sm" data-inv-del="${item.id}" style="color:var(--danger);border:none;background:none;cursor:pointer">删除</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  // Matchable recipes
  renderMatchableRecipes();

}

// ===== Inventory modal =====
function openInventoryModal(id) {
  editingInventoryId = id;
  document.getElementById('invModalTitle').textContent = id ? '编辑食材' : '添加食材';
  document.getElementById('invEditId').value = id || '';

  if (id) {
    const d = getData();
    const item = d.inventory.find(i => i.id === id);
    if (item) {
      document.getElementById('invCategory').value = item.category || '';
      document.getElementById('invName').value = item.name;
      document.getElementById('invAmount').value = item.amount || '';
      document.getElementById('invUnit').value = item.unit || '';
    }
  } else {
    document.getElementById('invCategory').value = '';
    document.getElementById('invName').value = '';
    document.getElementById('invAmount').value = '';
    document.getElementById('invUnit').value = '';
  }
  document.getElementById('modalInventory').hidden = false;
  setTimeout(() => document.getElementById('invCategory').focus(), 100);
}

document.getElementById('btnAddInventory').addEventListener('click', () => openInventoryModal(null));
// Close inventory modal on overlay click
document.getElementById('modalInventory').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalInventory')) {
    document.getElementById('modalInventory').hidden = true;
    editingInventoryId = null;
  }
});

// Category → default unit presets
const CATEGORY_UNITS = {
  '蔬菜': 'g', '肉类': 'g', '水产': 'g', '蛋奶': '个',
  '豆制品': 'g', '熟食': 'g', '主食': 'g', '干货': 'g', '调料': '', '其他': ''
};
document.getElementById('invCategory').addEventListener('change', () => {
  const cat = document.getElementById('invCategory').value;
  const unitInput = document.getElementById('invUnit');
  const amountInput = document.getElementById('invAmount');
  if (cat === '调料') {
    unitInput.value = '';
    if (!amountInput.value.trim()) amountInput.value = '适量';
  } else if (cat && CATEGORY_UNITS[cat] && !unitInput.value.trim()) {
    unitInput.value = CATEGORY_UNITS[cat];
  }
});

document.getElementById('btnInvModalClose').addEventListener('click', () => {
  document.getElementById('modalInventory').hidden = true;
  editingInventoryId = null;
});

document.getElementById('invForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('invName').value.trim();
  const amount = document.getElementById('invAmount').value.trim();
  const unit = document.getElementById('invUnit').value.trim();
  const category = document.getElementById('invCategory').value || '其他';

  if (!name) { showToast('请输入食材名称', 'error'); return; }

  let normAmount = amount;
  let normUnit = unit;
  if (category === '调料') {
    if (!normAmount.trim()) normAmount = '适量';
    normUnit = '';
  }
  if (normUnit && normAmount.endsWith(normUnit)) {
    normAmount = normAmount.slice(0, -normUnit.length).trim();
  }

  const d = getData();
  try {
    if (editingInventoryId) {
      await apiFetch(scoped(`/api/inventory/${editingInventoryId}`), {
        method: 'PUT',
        body: { name, amount: normAmount, unit: normUnit, category }
      });
    } else {
      await apiFetch(scoped('/api/inventory'), {
        method: 'POST',
        body: { name, amount: normAmount, unit: normUnit, category }
      });
    }
    const inventory = await apiFetch(scoped('/api/inventory'));
    d.inventory = inventory;
  } catch (err) { showToast('保存失败: ' + err.message, 'error'); return; }

  editingInventoryId = null;
  document.getElementById('modalInventory').hidden = true;
  renderCurrentTab();
});

function renderMatchableRecipes() {
  const d = getData();
  const container = document.getElementById('matchableRecipes');

  if (d.recipes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary)">还没有菜谱，先去创建吧</p>';
    return;
  }
  if (d.inventory.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary)">添加食材后，这里会显示能做的菜</p>';
    return;
  }

  const results = d.recipes.map(recipe => {
    const required = recipe.ingredients.filter(i => !i.optional);
    const main = required.filter(i => !isSeasoning(i.name));
    const seasonings = required.filter(i => isSeasoning(i.name));
    const missingMain = main.filter(i => !findInventoryItem(i.name, d.inventory));
    const missingSeas = seasonings.filter(i => !findInventoryItem(i.name, d.inventory));
    const effectiveRequired = main.length;
    const matchRate = effectiveRequired === 0 ? 1 : (effectiveRequired - missingMain.length) / effectiveRequired;
    return { recipe, missingMain, missingSeas, matchRate };
  });

  results.sort((a, b) => b.matchRate - a.matchRate);

  // Only show recipes that are close to makeable (≤2 main ingredients missing)
  const filtered = results.filter(r => r.missingMain.length <= 2);

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary)">库存不足，暂时没有可制作的菜品<br>试试添加更多食材吧 🧺</p>';
    return;
  }

  container.innerHTML = filtered.map(({ recipe, missingMain, missingSeas, matchRate }) => {
    const canMake = missingMain.length === 0;
    let missingHtml = '';
    if (!canMake) missingHtml += `<div class="match-missing">缺少主食材: ${missingMain.map(m => m.name).join('、')}</div>`;
    if (missingSeas.length) missingHtml += `<div class="match-missing" style="color:var(--clay)">缺少调料: ${missingSeas.map(m => m.name).join('、')}</div>`;
    const inMenu = d.todayMenu.includes(recipe.id);
    return `
      <div class="match-card ${canMake ? '' : 'partial'}">
        <div class="match-header">
          <span class="match-name">${esc(recipe.name)}</span>
          <span class="match-badge ${canMake ? 'ready' : 'partial'}">${canMake ? '✅ 可做' : `⚠️ 缺${missingMain.length}种主食材`}</span>
        </div>
        ${missingHtml}
        ${canMake
          ? (inMenu
              ? `<button class="btn btn-xs" data-menu-remove-card="${recipe.id}" style="margin-top:10px;border-color:var(--bloom);color:var(--bloom);background:var(--bloom-ghost)">${iconSvg('menu', 'icon-sm')} 移出菜单</button>`
              : `<button class="btn btn-xs btn-primary" data-menu-add="${recipe.id}" style="margin-top:10px">${iconSvg('plus', 'icon-sm')} 加入菜单</button>`)
          : ''}
      </div>
    `;
  }).join('');
}

function showCookDoneDialog(recipeId) {
  const d = getData();
  const recipe = d.recipes.find(r => r.id === recipeId);
  if (!recipe) return;

  const required = recipe.ingredients.filter(i => !i.optional);
  const matched = required.map(ing => {
    const inv = findInventoryItem(ing.name, d.inventory);
    if (!inv) return null; // skip items not in inventory
    const stockNum = parseAmount(inv.amount);
    const needNum = parseAmount(ing.amount);
    let remaining = inv.amount;
    if (stockNum !== null && needNum !== null) {
      remaining = String(Math.max(0, stockNum - needNum));
    }
    return { ing, inv, remaining };
  }).filter(Boolean);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '300';
  let itemsHtml = matched.map((m, idx) => `
    <div class="done-item">
      <div class="done-item-head">
        <span class="done-item-name">${esc(m.ing.name)}</span>
        <span class="done-item-need">菜谱需: ${esc(m.ing.amount || '—')}</span>
      </div>
      <div class="done-item-edit">
        <label class="done-field">
          <span>当前库存</span>
          <div class="done-stock">
            ${m.inv
              ? `<span class="done-stock-val">${esc(m.inv.amount)} ${esc(m.inv.unit)}</span>`
              : `<span style="color:var(--chili);font-size:0.82rem">库存缺货</span>`
            }
          </div>
        </label>
        <label class="done-field">
          <span>用完剩余</span>
          <div class="inv-row" style="gap:4px">
            <input type="text" class="done-remaining" value="${m.inv ? esc(m.remaining) : ''}" placeholder="剩余" style="flex:1;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:0.85rem;font-family:inherit">
            <input type="text" class="done-unit" value="${m.inv ? esc(m.inv.unit) : ''}" placeholder="单位" style="width:60px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:0.85rem;font-family:inherit">
          </div>
        </label>
        <label class="done-remove-cb">
          <input type="checkbox" class="done-remove-check"> 直接移除该项
        </label>
      </div>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="modal" style="animation:modalIn 0.25s var(--ease-out);max-width:520px">
      <div class="modal-header">
        <h2 style="font-size:1rem">🍽️ ${esc(recipe.name)}</h2>
        <button class="btn-icon modal-close" id="doneClose" style="border:none;background:none;cursor:pointer;font-size:1.2rem">×</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:16px;color:var(--text-muted);font-size:0.85rem">调整做完后的食材库存，留空则保持不变</p>
        <div class="done-list">${itemsHtml}</div>
        <div style="display:flex;gap:8px;margin-top:20px">
          <button class="btn btn-primary" id="doneConfirm">确认做完</button>
          <button class="btn" id="doneCancel">取消</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Checkbox → disable amount inputs
  overlay.querySelectorAll('.done-remove-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const row = cb.closest('.done-item');
      row.querySelector('.done-remaining').disabled = cb.checked;
      row.querySelector('.done-unit').disabled = cb.checked;
    });
  });

  const close = () => overlay.remove();
  overlay.querySelector('#doneClose').onclick = close;
  overlay.querySelector('#doneCancel').onclick = close;
  overlay.querySelector('#doneConfirm').onclick = async () => {
    // Collect deductions
    const deductions = [];
    overlay.querySelectorAll('.done-item').forEach(item => {
      const name = item.querySelector('.done-item-name').textContent;
      const remove = item.querySelector('.done-remove-check').checked;
      const remaining = item.querySelector('.done-remaining').value.trim();
      const unit = item.querySelector('.done-unit').value.trim();
      deductions.push({ name, remove, remaining, unit });
    });

    try {
      await apiFetch(scoped(`/api/cook/${recipe.id}`), { method: 'POST', body: { deductions } });
      // Refresh data
      const [recipes, inventory, menu] = await Promise.all([
        apiFetch(scoped('/api/recipes')),
        apiFetch(scoped('/api/inventory')),
        apiFetch(scoped('/api/menu'))
      ]);
      d.recipes = recipes;
      d.inventory = inventory;
      d.todayMenu = menu;
    } catch (err) { showToast('操作失败: ' + err.message, 'error'); close(); return; }

    close();
    renderCurrentTab();
  };
}

// ===== Utility =====
function esc(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// Parse leading number from "300g" → 300, "3个" → 3, "适量" → null
function parseAmount(s) {
  if (!s) return null;
  const m = s.trim().match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Normalize ingredient name for fuzzy matching
function normalizeIngredientName(name) {
  return name.trim()
    .replace(/[（(][^）)]*[）)]/g, '') // Remove parenthetical notes like （3个）
    .replace(/\s+/g, '')               // Remove all whitespace
    .toLowerCase();
}

// Find matching inventory item with suffix/contains fallback
function findInventoryItem(name, inventory) {
  const norm = normalizeIngredientName(name);
  return inventory.find(i => {
    const invNorm = normalizeIngredientName(i.name);
    if (invNorm === norm) return true;
    // Suffix match: "长茄子" ends with "茄子", "大葱" ends with "葱"
    // Blocklist: names that end with the shorter string but are different ingredients
    const long = invNorm.length >= norm.length ? invNorm : norm;
    const short = invNorm.length >= norm.length ? norm : invNorm;
    if (short.length >= 1 && long.endsWith(short) && !isFalseSuffix(long, short)) return true;
    // Contains fallback: "鸡胸肉" contains "鸡" but not a suffix; requires both ≥2 chars
    if (invNorm.length >= 2 && norm.length >= 2) {
      if (invNorm.includes(norm) || norm.includes(invNorm)) return true;
    }
    return false;
  });
}

// Known false suffix matches: "洋葱" is not a type of "葱", etc.
const SUFFIX_BLOCKLIST = [
  ['洋葱', '葱'],
];

function isFalseSuffix(long, short) {
  return SUFFIX_BLOCKLIST.some(([l, s]) => long === l && short === s);
}

// Common seasoning keywords — matched by substring against normalized ingredient name
const SEASONING_KEYS = [
  '盐', '糖', '酱油', '生抽', '老抽', '醋', '料酒', '蚝油', '味精', '鸡精',
  '胡椒粉', '花椒', '八角', '桂皮', '香叶', '淀粉', '香油', '芝麻油', '花椒油',
  '食用油', '菜籽油', '花生油', '大豆油', '色拉油', '猪油',
  '豆瓣酱', '黄豆酱', '甜面酱', '番茄酱', '辣椒酱', '蒜蓉酱',
  '姜', '葱', '蒜', '干辣椒', '小米辣',
  '白芝麻', '鸡粉', '十三香', '五香粉', '孜然', '咖喱'
];

function isSeasoning(name) {
  const norm = normalizeIngredientName(name);
  return SEASONING_KEYS.some(k => norm.includes(k));
}

// Debounce utility for search input
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Safe JSON parse with fallback for AI responses
function safeParseJSON(str) {
  if (!str) throw new Error('AI 返回内容为空，请重试');

  let trimmed = str.trim();

  // Remove markdown code block fences
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  }

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Try to extract first JSON object from the response
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      let fixed = match[0];
      // Fix trailing commas before ] and }
      fixed = fixed.replace(/,\s*([\]}])/g, '$1');
      // Replace single-quoted keys with double-quoted keys (safe: keys are simple identifiers)
      fixed = fixed.replace(/'([^']+)'\s*:/g, '"$1":');
      // Replace single-quoted string values — be conservative, only when the value
      // looks like it doesn't contain nested single quotes that would break the match
      fixed = fixed.replace(/:\s*'([^'"]*)'\s*([,}\]])/g, ':"$1"$2');
      try {
        return JSON.parse(fixed);
      } catch (e2) {
        throw new Error('AI 返回格式异常，无法解析。请重试。');
      }
    }
    throw new Error('AI 返回格式异常，无法解析。请重试。');
  }
}

// ===== Today Menu =====
function renderMenu() {
  const d = getData();
  const menuIds = d.todayMenu || [];
  const menuRecipes = d.recipes.filter(r => menuIds.includes(r.id));
  const empty = document.getElementById('menuEmpty');
  const listDiv = document.getElementById('menuRecipeList');
  const shopDiv = document.getElementById('menuShoppingList');
  const countSpan = document.getElementById('menuRecipeCount');
  const clearBtn = document.getElementById('btnClearMenu');

  const btnCookAll = document.getElementById('btnCookAll');
  countSpan.textContent = menuIds.length ? `共 ${menuIds.length} 道菜` : '';
  clearBtn.style.display = menuIds.length ? '' : 'none';
  if (btnCookAll) btnCookAll.style.display = menuIds.length ? '' : 'none';

  if (menuIds.length === 0) {
    empty.style.display = 'block';
    listDiv.innerHTML = '';
    shopDiv.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  // Recipe list
  listDiv.innerHTML = `<div class="menu-recipe-list">${menuRecipes.map(r => `
    <div class="menu-recipe-card">
      <div>
        <div class="menu-recipe-name">${esc(r.name)}</div>
        <div class="menu-recipe-meta">${r.ingredients.length} 种食材 · ${r.steps.length} 步</div>
      </div>
      <div class="menu-card-actions">
        <button class="btn btn-xs" data-menu-remove="${r.id}" style="color:var(--chili);border:none;background:none;cursor:pointer">${iconSvg('xmark', 'icon-sm')} 移除</button>
        <button class="btn btn-sm btn-primary" data-menu-cook="${r.id}">${iconSvg('cook', 'icon-sm')} 做完了</button>
      </div>
    </div>
  `).join('')}</div>`;

  // Shopping list — aggregate ingredients across menu, split main vs seasoning
  const neededMain = {};
  const neededSeas = {};
  menuRecipes.forEach(r => {
    r.ingredients.forEach(ing => {
      if (ing.optional) return;
      const target = isSeasoning(ing.name) ? neededSeas : neededMain;
      const key = normalizeIngredientName(ing.name);
      if (!target[key]) target[key] = { name: ing.name, recipes: [], amounts: [] };
      target[key].recipes.push(r.name);
      target[key].amounts.push(ing.amount || '适量');
    });
  });

  const mainItems = Object.values(neededMain);
  const seasItems = Object.values(neededSeas);
  const allItems = [...mainItems, ...seasItems];

  let shopHtml = '';
  if (allItems.length === 0) {
    shopHtml = '<div class="shopping-empty">所有菜谱均无需非可选食材 ✅</div>';
  } else {
    shopHtml = '<div class="shopping-section"><h3>🛒 食材清单</h3><div class="shopping-list">';

    const renderItem = (item, inStock) => {
      const inv = findInventoryItem(item.name, d.inventory);
      const stockInfo = inStock && inv ? `${inv.amount} ${inv.unit} 库存中` : '';
      return `<div class="shopping-item ${inStock ? 'have' : 'missing'}">
        <div>
          <div class="shopping-item-name">${esc(item.name)}</div>
          <div class="shopping-item-detail">用于: ${item.recipes.map(esc).join('、')} (需 ${item.amounts.join(' + ')})</div>
          ${stockInfo ? `<div class="shopping-item-detail" style="color:var(--herb)">✅ ${stockInfo}</div>` : ''}
        </div>
        ${inStock
          ? '<span>✅ 有库存</span>'
          : `<span style="display:flex;align-items:center;gap:6px"><span style="color:var(--chili)">❌ 缺货</span><button class="btn btn-sm btn-primary" data-quick-add="${esc(item.name)}" style="font-size:0.75rem;padding:2px 6px">+</button></span>`
        }
      </div>`;
    };

    // Main ingredients: in-stock first, then missing
    const mainHave = mainItems.filter(item => findInventoryItem(item.name, d.inventory));
    const mainMissing = mainItems.filter(item => !findInventoryItem(item.name, d.inventory));
    mainHave.forEach(item => { shopHtml += renderItem(item, true); });
    mainMissing.forEach(item => { shopHtml += renderItem(item, false); });

    shopHtml += '</div>';

    // Seasonings — separate section with lighter treatment
    if (seasItems.length) {
      shopHtml += '<div class="shopping-list" style="margin-top:12px"><h3 style="font-size:0.85rem;color:var(--clay)">🧂 调料</h3>';
      const seasHave = seasItems.filter(item => findInventoryItem(item.name, d.inventory));
      const seasMissing = seasItems.filter(item => !findInventoryItem(item.name, d.inventory));
      seasHave.forEach(item => { shopHtml += renderItem(item, true); });
      seasMissing.forEach(item => { shopHtml += renderItem(item, false); });
      shopHtml += '</div>';
    }

    // Summary (main ingredients only)
    const totalMain = mainItems.reduce((s, i) => s + i.amounts.length, 0);
    const haveMain = mainHave.reduce((s, i) => s + i.amounts.length, 0);
    shopHtml += `<div style="margin-top:12px;font-size:0.85rem;color:var(--text-secondary)">
      主食材满足率: ${mainItems.length === 0 ? '100%' : Math.round(mainHave.length / mainItems.length * 100) + '%'}
      （${haveMain}/${totalMain} 项有库存，${seasItems.length} 种调料未计入）
    </div></div>`;
  }
  shopDiv.innerHTML = shopHtml;
}

// ===== Recipe Sync =====
async function syncRecipe(recipeId) {
  const to = currentScope === 'family' ? 'personal' : 'family';
  const label = to === 'family' ? '家庭' : '个人';
  try {
    await apiFetch(`/api/recipes/${recipeId}/sync`, { method: 'POST', body: { to } });
    showToast(`已同步到${label}`, 'success');
  } catch (err) { showToast('同步失败: ' + err.message, 'error'); }
}

document.getElementById('btnSyncAll').addEventListener('click', async () => {
  const from = currentScope;
  const to = from === 'personal' ? 'family' : 'personal';
  const label = to === 'family' ? '家庭' : '个人';
  if (!confirm(`确定将所有菜谱从${from === 'personal' ? '个人' : '家庭'}同步到${label}？已存在的不会重复添加。`)) return;
  try {
    const result = await apiFetch('/api/sync-all', { method: 'POST', body: { from, to } });
    showToast(`同步完成: ${result.synced} 份新增，${result.skipped} 份已跳过`, 'success');
    if (to === currentScope) { await fetchAllData(); renderCurrentTab(); updateStats(); }
  } catch (err) { showToast('同步失败: ' + err.message, 'error'); }
});

// ===== Init =====
async function init() {
  // Auth check
  const token = getToken();
  if (!token) { window.location.href = '/login.html'; return; }

  try {
    await apiFetch('/api/auth/me');
  } catch {
    window.location.href = '/login.html';
    return;
  }

  // Load data from server
  try {
    await fetchAllData();
  } catch (err) {
    showToast('加载数据失败: ' + err.message, 'error');
    return;
  }

  // Load settings form defaults
  const d = getData();
  if (!d.settings.baseUrl) {
    d.settings.baseUrl = 'https://api.deepseek.com/v1';
    d.settings.model = 'deepseek-v4-flash';
    await apiFetch('/api/settings', { method: 'PUT', body: d.settings });
  }

  // Event delegation — bind once instead of per-render
  document.getElementById('recipeGrid').addEventListener('click', (e) => {
    const syncBtn = e.target.closest('[data-sync-recipe]');
    if (syncBtn) {
      e.stopPropagation();
      syncRecipe(syncBtn.dataset.syncRecipe);
      return;
    }
    const card = e.target.closest('.recipe-card');
    if (card && !e.target.closest('button')) {
      openRecipeModal(card.dataset.id);
    }
  });

  document.getElementById('panel-recipes').addEventListener('click', (e) => {
    const tag = e.target.closest('.tag-filter');
    if (!tag) return;
    currentFilterTag = tag.dataset.tag === currentFilterTag ? null : tag.dataset.tag;
    renderRecipes();
  });

  document.getElementById('inventoryList').addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-inv-del]');
    if (delBtn) {
      const id = delBtn.dataset.invDel;
      const d = getData();
      await apiFetch(scoped(`/api/inventory/${id}`), { method: 'DELETE' });
      d.inventory = d.inventory.filter(i => i.id !== id);
      renderInventory();
      return;
    }
    const editBtn = e.target.closest('[data-inv-edit]');
    if (editBtn) openInventoryModal(editBtn.dataset.invEdit);
  });

  document.getElementById('matchableRecipes').addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-menu-add]');
    if (addBtn) {
      const id = addBtn.dataset.menuAdd;
      const d = getData();
      if (d.todayMenu.includes(id)) { showToast('已在菜单中', 'info'); return; }
      await apiFetch(scoped(`/api/menu/${id}`), { method: 'POST' });
      d.todayMenu.push(id);
      renderInventory();
      updateStats();
      return;
    }
    const rmBtn = e.target.closest('[data-menu-remove-card]');
    if (rmBtn) {
      const d = getData();
      await apiFetch(scoped(`/api/menu/${rmBtn.dataset.menuRemoveCard}`), { method: 'DELETE' });
      d.todayMenu = d.todayMenu.filter(id => id !== rmBtn.dataset.menuRemoveCard);
      renderInventory();
      updateStats();
    }
  });

  // Menu delegation — add/remove from recipe grid cards
  document.getElementById('recipeGrid').addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-menu-add]');
    if (addBtn) {
      const id = addBtn.dataset.menuAdd;
      const d = getData();
      if (d.todayMenu.includes(id)) { showToast('该菜谱已在今日菜单中', 'info'); return; }
      await apiFetch(scoped(`/api/menu/${id}`), { method: 'POST' });
      d.todayMenu.push(id);
      renderRecipes();
      if (currentTab === 'menu') renderMenu();
      updateStats();
      return;
    }
    const rmCardBtn = e.target.closest('[data-menu-remove-card]');
    if (rmCardBtn) {
      e.stopPropagation();
      const d = getData();
      await apiFetch(scoped(`/api/menu/${rmCardBtn.dataset.menuRemoveCard}`), { method: 'DELETE' });
      d.todayMenu = d.todayMenu.filter(id => id !== rmCardBtn.dataset.menuRemoveCard);
      renderRecipes();
      if (currentTab === 'menu') renderMenu();
      updateStats();
      return;
    }
  });

  // Menu delegation — remove from menu, mark cooked, quick-add ingredient
  document.getElementById('panel-menu').addEventListener('click', async (e) => {
    const rmBtn = e.target.closest('[data-menu-remove]');
    if (rmBtn) {
      const d = getData();
      await apiFetch(scoped(`/api/menu/${rmBtn.dataset.menuRemove}`), { method: 'DELETE' });
      d.todayMenu = d.todayMenu.filter(id => id !== rmBtn.dataset.menuRemove);
      renderMenu();
      updateStats();
      return;
    }
    const cookBtn = e.target.closest('[data-menu-cook]');
    if (cookBtn) {
      showCookDoneDialog(cookBtn.dataset.menuCook);
      return;
    }
    const qaBtn = e.target.closest('[data-quick-add]');
    if (qaBtn) {
      e.preventDefault();
      openInventoryModal(null);
      document.getElementById('invName').value = qaBtn.dataset.quickAdd;
      document.getElementById('invAmount').value = '';
      document.getElementById('invUnit').value = '';
      return;
    }
  });

  // Cook all — deduct inventory for all menu recipes, mark cooked, clear menu
  document.getElementById('btnCookAll').addEventListener('click', async () => {
    const d = getData();
    const menuRecipes = d.recipes.filter(r => d.todayMenu.includes(r.id));
    if (!menuRecipes.length) return;
    if (!confirm(`确定全部做完吗？将扣除 ${menuRecipes.length} 道菜的所有食材库存，并清空今日菜单。`)) return;

    try {
      for (const recipe of menuRecipes) {
        await apiFetch(scoped(`/api/cook/${recipe.id}`), { method: 'POST' });
      }
      // Refresh data
      const [recipes, inventory, menu] = await Promise.all([
        apiFetch(scoped('/api/recipes')),
        apiFetch(scoped('/api/inventory')),
        apiFetch(scoped('/api/menu'))
      ]);
      d.recipes = recipes;
      d.inventory = inventory;
      d.todayMenu = menu;
    } catch (err) { showToast('操作失败: ' + err.message, 'error'); return; }

    renderMenu();
    updateStats();
  });

  // Clear menu
  document.getElementById('btnClearMenu').addEventListener('click', async () => {
    if (!confirm('确定清空今日菜单？')) return;
    await apiFetch(scoped('/api/menu'), { method: 'DELETE' });
    getData().todayMenu = [];
    renderMenu();
    updateStats();
  });

  // Go to recipes from menu empty state
  document.getElementById('btnGoToRecipes').addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="recipes"]').classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-recipes').classList.add('active');
    currentTab = 'recipes';
    updateTabIndicator();
    renderRecipes();
    updateStats();
  });

  renderCurrentTab();
  updateTabIndicator();
  updateStats();

  // Logout button
  document.getElementById('btnLogout').addEventListener('click', () => {
    clearToken();
    window.location.href = '/login.html';
  });
  // Display username
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    document.getElementById('headerUsername').textContent = user.username || '';
  } catch {}

  window.addEventListener('resize', debounce(updateTabIndicator, 150));
}

init();

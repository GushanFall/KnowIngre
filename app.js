import { API_BASE, USER_KEY, getToken, clearToken, apiFetch } from './frontend/api.js';
import { downloadBlob, downloadDatabaseBackup } from './frontend/download.js';
import { safeParseJSON, validateAiRecipe } from './frontend/ai-recipe.js';
import { ingredientReadiness } from './frontend/menu-readiness.js';

let dataCache = null;

function getDefaultData() {
  return {
    settings: { baseUrl: 'https://api.deepseek.com/v1', hasApiKey: false, model: 'deepseek-v4-flash' },
    recipes: [],
    inventory: [],
    todayMenu: [],
    unitConversions: [],
    history: []
  };
}

function getData() {
  if (!dataCache) dataCache = getDefaultData();
  return dataCache;
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

// ===== Low-stock threshold by unit =====
const LOW_STOCK_RULES = {
  small: ['g', 'ml', 'G', 'ML', '克', '毫升'],
  large: ['kg', 'L', 'l', 'KG', '千克', '升'],
  count: ['个', '只', '枚', '条', '块', '袋', '盒', '包', '斤', '把', '瓶'],
};
function isLowStock(item) {
  if (!item || isPantryCategory(item.category)) return false;
  const n = parseFloat(item.amount);
  if (isNaN(n)) return false;
  if (n <= 0) return true;
  const u = (item.unit || '').trim();
  if (LOW_STOCK_RULES.small.includes(u)) return n <= 100;
  if (LOW_STOCK_RULES.large.includes(u)) return n <= 0.2;
  if (LOW_STOCK_RULES.count.includes(u)) return n <= 1;
  return false;
}

function isPantryCategory(category) {
  const value = String(category || '').trim();
  return value === '调料' || value === '调味料' || value === '调味品';
}

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
  if (currentScope === 'family' && (path.startsWith('/api/recipes') || path.startsWith('/api/inventory') || path.startsWith('/api/menu') || path.startsWith('/api/cook') || path.startsWith('/api/history') || path.startsWith('/api/unit-conversions') || path.startsWith('/api/import') || path.startsWith('/api/ai/kitchen-assistant'))) {
    const sep = path.includes('?') ? '&' : '?';
    return path + sep + 'scope=family';
  }
  return path;
}

async function fetchAllData() {
  const [recipes, inventory, menu, unitConversions, history, rawSettings] = await Promise.all([
    apiFetch(scoped('/api/recipes')),
    apiFetch(scoped('/api/inventory')),
    apiFetch(scoped('/api/menu')),
    apiFetch(scoped('/api/unit-conversions')),
    apiFetch(scoped('/api/history')),
    apiFetch('/api/settings').catch(() => ({}))
  ]);
  // Map server snake_case to frontend camelCase
  const settings = {
    baseUrl: rawSettings.base_url || 'https://api.deepseek.com/v1',
    hasApiKey: !!rawSettings.has_api_key,
    model: rawSettings.model || 'deepseek-v4-flash'
  };
  dataCache = { recipes, inventory, todayMenu: menu, unitConversions, history, settings };
  return dataCache;
}

// ===== State =====
let currentTab = 'menu';
let currentScope = 'personal';
let currentFilterTag = null;
let editingRecipeId = null;
let editingInventoryId = null;
let recipeFormDirty = false;
let invSearchText = '';
let invFilterCategory = 'all';
const INVENTORY_SEASONING_VISIBILITY_KEY = 'knowingre_inventory_show_seasonings';
let showInventorySeasonings = localStorage.getItem(INVENTORY_SEASONING_VISIBILITY_KEY) === '1';
let historyRange = '30';
let historyYear = new Date().getFullYear();
let selectedHistoryDate = null;
const historyRecordsState = {
  page: 1,
  pageSize: 10,
  sort: 'newest',
  total: 0,
  totalPages: 1,
  query: '',
  from: '',
  to: '',
  items: [],
  editingId: null,
  requestId: 0,
  filtersCollapsed: false,
};
const kitchenConversations = { personal: [], family: [] };
let kitchenAssistantBusy = false;
let kitchenUseInventory = true;

// ===== Toast Notifications =====
function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const icon = type === 'success' ? I.check : type === 'error' ? I.xmark : '';
  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'icon icon-sm';
    iconEl.innerHTML = icon; // Internal SVG constant, never user content.
    toast.appendChild(iconEl);
    toast.appendChild(document.createTextNode(' '));
  }
  toast.appendChild(document.createTextNode(String(message ?? '')));
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
  else if (currentTab === 'history') renderHistory();
  updateStats();
  updateKitchenFabMode();
}

function updateKitchenFabMode() {
  const button = document.getElementById('btnKitchenAssistant');
  if (!button) return;
  button.classList.toggle('is-compact', currentTab === 'menu' || (currentTab === 'history' && window.scrollY > 160));
}

window.addEventListener('scroll', updateKitchenFabMode, { passive: true });

// ===== Stats =====
function updateStats() {
  const d = getData();
  const scopeIcon = currentScope === 'family' ? I.users : I.user;
  const scopeLabel = currentScope === 'family' ? '家庭' : '个人';
  document.getElementById('statsText').innerHTML =
    `<span class="icon icon-sm">${scopeIcon}</span> ${scopeLabel} &nbsp;|&nbsp; <span class="icon icon-sm">${I.home}</span> ${d.recipes.length} 份菜谱 &nbsp;|&nbsp; <span class="icon icon-sm">${I.import}</span> ${d.inventory.length} 种食材 &nbsp;|&nbsp; <span class="icon icon-sm">${I.menu}</span> ${d.todayMenu.length} 道今日菜单`;
}

// ===== Cooking History =====
function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getHistoryStreak(items) {
  const days = [...new Set(items.map(item => localDateKey(item.cookedAt)).filter(Boolean))].sort().reverse();
  if (!days.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latest = new Date(`${days[0]}T00:00:00`);
  const gap = Math.round((today.getTime() - latest.getTime()) / 86400000);
  if (gap > 1) return 0;
  let streak = 1;
  let cursor = latest;
  for (let index = 1; index < days.length; index++) {
    const expected = new Date(cursor);
    expected.setDate(expected.getDate() - 1);
    if (localDateKey(expected) !== days[index]) break;
    streak++;
    cursor = expected;
  }
  return streak;
}

function rangeFilteredHistory(items) {
  const now = new Date();
  let filtered = items.filter(item => !Number.isNaN(new Date(item.cookedAt).getTime()));
  if (historyRange === '30') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
    filtered = filtered.filter(item => new Date(item.cookedAt) >= start);
  } else if (historyRange === 'year') {
    filtered = filtered.filter(item => new Date(item.cookedAt).getFullYear() === now.getFullYear());
  }
  return filtered;
}

function historyMetric(label, value, hint) {
  return `<div class="history-metric"><span class="history-metric-label">${esc(label)}</span><strong>${esc(String(value))}</strong><span class="history-metric-hint">${esc(hint)}</span></div>`;
}

function historyTimelineHtml(items, emptyText = '还没有烹饪记录') {
  if (!items.length) return `<p class="history-chart-empty">${esc(emptyText)}</p>`;
  return items.map(item => {
    const date = new Date(item.cookedAt);
    const valid = !Number.isNaN(date.getTime());
    const day = valid ? `${date.getMonth() + 1}月${date.getDate()}日` : '日期未知';
    const time = valid ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : item.cookedAt;
    const member = currentScope === 'family' ? (item.username || '历史记录') : '';
    return `<div class="history-timeline-item">
      <div class="history-timeline-dot"></div>
      <div class="history-timeline-date"><strong>${day}</strong><span>${esc(time)}</span></div>
      <div class="history-timeline-main">
        <button type="button" ${item.recipeId ? `data-history-recipe="${escAttr(item.recipeId)}"` : 'disabled'}>${esc(item.recipeName)}</button>
        ${member ? `<span>${esc(member)}</span>` : ''}
        ${item.notes ? `<span class="history-timeline-note">备注：${esc(item.notes)}</span>` : ''}
      </div>
      <button type="button" class="history-undo" data-history-delete="${escAttr(item.id)}" aria-label="撤销这条烹饪记录" title="撤销这条记录">${I.trash}</button>
    </div>`;
  }).join('');
}

function readableHistoryDate(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return dateKey;
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
}

function renderHistory() {
  const content = document.getElementById('historyContent');
  const items = [...(getData().history || [])].sort((a, b) => new Date(b.cookedAt) - new Date(a.cookedAt));

  const now = new Date();
  const thisMonth = items.filter(item => {
    const date = new Date(item.cookedAt);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
  const uniqueDishes = new Set(items.map(item => item.recipeId || item.recipeName)).size;
  const metrics = [
    historyMetric('累计下厨', items.length, '次烹饪记录'),
    historyMetric('做过的菜', uniqueDishes, '道不同菜品'),
    historyMetric('本月下厨', thisMonth, `${now.getMonth() + 1} 月累计`),
    historyMetric('连续下厨', getHistoryStreak(items), '天'),
  ].join('');

  if (!items.length) {
    content.innerHTML = `<div class="history-metrics">${metrics}</div>
      <div class="history-empty"><div class="history-empty-mark">○</div><h3>还没有烹饪足迹</h3><p>菜谱标记为“做完”后，这里会自动留下记录。</p></div>`;
    return;
  }

  const years = [...new Set(items.map(item => new Date(item.cookedAt).getFullYear()).filter(Number.isFinite))];
  if (!years.includes(now.getFullYear())) years.push(now.getFullYear());
  years.sort((a, b) => b - a);
  if (!years.includes(historyYear)) historyYear = years[0];

  const countsByDay = new Map();
  const countsByMonth = Array(12).fill(0);
  items.forEach(item => {
    const key = localDateKey(item.cookedAt);
    if (key && key.startsWith(`${historyYear}-`)) {
      countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
      const date = new Date(item.cookedAt);
      if (!Number.isNaN(date.getTime())) countsByMonth[date.getMonth()]++;
    }
  });
  const yearStart = new Date(historyYear, 0, 1);
  const yearEnd = new Date(historyYear, 11, 31);
  const totalDays = Math.round((yearEnd - yearStart) / 86400000) + 1;
  const weekCount = Math.ceil((yearStart.getDay() + totalDays) / 7);
  const maxDayCount = Math.max(1, ...countsByDay.values());
  const heatCells = [];
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const date = new Date(historyYear, 0, dayIndex + 1);
    const key = localDateKey(date);
    const count = countsByDay.get(key) || 0;
    const level = count ? Math.max(1, Math.ceil((count / maxDayCount) * 4)) : 0;
    const week = Math.floor((yearStart.getDay() + dayIndex) / 7) + 1;
    const weekday = date.getDay() + 1;
    const label = `${date.getMonth() + 1}月${date.getDate()}日，${count ? `做了 ${count} 道菜` : '没有记录'}`;
    heatCells.push(count
      ? `<button type="button" class="history-heat-cell level-${level}${selectedHistoryDate === key ? ' selected' : ''}" style="grid-column:${week};grid-row:${weekday}" data-history-date="${escAttr(key)}" aria-label="${escAttr(label)}" title="${escAttr(label)}"><span>${count}</span></button>`
      : `<span class="history-heat-cell level-0" style="grid-column:${week};grid-row:${weekday}" aria-hidden="true"></span>`);
  }
  const monthLabels = Array.from({ length: 12 }, (_, month) => {
    const date = new Date(historyYear, month, 1);
    const dayIndex = Math.round((date - yearStart) / 86400000);
    const week = Math.floor((yearStart.getDay() + dayIndex) / 7) + 1;
    return `<span style="grid-column:${week}">${month + 1}月</span>`;
  }).join('');
  const maxMonthCount = Math.max(1, ...countsByMonth);
  const monthlyTotal = countsByMonth.reduce((sum, count) => sum + count, 0);
  const monthlyTrendHtml = countsByMonth.map((count, month) => {
    const height = count ? Math.max(8, Math.round(count / maxMonthCount * 100)) : 0;
    const label = `${historyYear}年${month + 1}月，做了 ${count} 次`;
    return `<div class="history-month-column" title="${escAttr(label)}" aria-label="${escAttr(label)}">
      <strong>${count || ''}</strong>
      <div class="history-month-track"><span style="height:${height}%"></span></div>
      <small>${month + 1}月</small>
    </div>`;
  }).join('');

  const visibleItems = rangeFilteredHistory(items);
  const dishCounts = new Map();
  visibleItems.forEach(item => {
    const key = item.recipeId || `deleted:${item.recipeName}`;
    const existing = dishCounts.get(key) || { name: item.recipeName, recipeId: item.recipeId, count: 0 };
    existing.count++;
    dishCounts.set(key, existing);
  });
  const ranking = [...dishCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')).slice(0, 10);
  const maxDishCount = Math.max(1, ...ranking.map(item => item.count));
  const rankingHtml = ranking.length ? ranking.map((item, index) => `<div class="history-rank-row">
    <span class="history-rank-index">${index + 1}</span>
    <button type="button" class="history-rank-name" ${item.recipeId ? `data-history-recipe="${escAttr(item.recipeId)}"` : 'disabled'}>${esc(item.name)}</button>
    <div class="history-rank-track"><span style="width:${Math.max(5, item.count / maxDishCount * 100)}%"></span></div>
    <strong>${item.count} 次</strong>
  </div>`).join('') : '<p class="history-chart-empty">这个时间范围内还没有记录</p>';

  const tagCounts = new Map();
  visibleItems.forEach(item => {
    const tags = Array.isArray(item.recipeTags) && item.recipeTags.length ? item.recipeTags : ['未分类'];
    tags.forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  });
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxTagCount = Math.max(1, ...tags.map(([, count]) => count));
  const tagsHtml = tags.length ? tags.map(([tag, count]) => `<div class="history-tag-row">
    <div class="history-tag-label"><span>${esc(tag)}</span><strong>${count}</strong></div>
    <div class="history-tag-track"><span style="width:${Math.max(4, count / maxTagCount * 100)}%"></span></div>
  </div>`).join('') : '<p class="history-chart-empty">这个时间范围内还没有标签数据</p>';

  const filterLabel = historyRange === '30' ? '近 30 天' : historyRange === 'year' ? '今年' : '全部时间';
  const rangeControlHtml = `<div class="history-analysis-toolbar">
    <div><strong>图表范围</strong><span>仅影响“最常做的菜”和“口味与类型”</span></div>
    <div class="history-range" role="group" aria-label="图表统计范围">
      <button type="button" class="history-range-btn${historyRange === '30' ? ' active' : ''}" data-history-range="30" aria-pressed="${historyRange === '30'}">近 30 天</button>
      <button type="button" class="history-range-btn${historyRange === 'year' ? ' active' : ''}" data-history-range="year" aria-pressed="${historyRange === 'year'}">今年</button>
      <button type="button" class="history-range-btn${historyRange === 'all' ? ' active' : ''}" data-history-range="all" aria-pressed="${historyRange === 'all'}">全部</button>
    </div>
  </div>`;
  const selectedDayItems = selectedHistoryDate
    ? items.filter(item => localDateKey(item.cookedAt) === selectedHistoryDate)
    : [];
  const selectedHtml = selectedHistoryDate ? `<section class="history-section history-day-detail">
    <div class="history-section-head">
      <div><h3>${esc(readableHistoryDate(selectedHistoryDate))}</h3><p>${selectedDayItems.length} 条做菜记录</p></div>
      <button type="button" class="btn btn-sm" data-history-date-clear>关闭当天详情</button>
    </div>
    <div class="history-timeline history-day-timeline">${historyTimelineHtml(selectedDayItems, '这一天没有做菜记录')}</div>
  </section>` : '';
  const recentItems = items.slice(0, 8);
  content.innerHTML = `
    <div class="history-metrics">${metrics}</div>
    <section class="history-section history-calendar-section">
      <div class="history-section-head"><div><h3>下厨日历</h3><p>${historyYear} 年共记录 ${[...countsByDay.values()].reduce((sum, count) => sum + count, 0)} 次</p></div>
        <label class="history-year-select"><span>年份</span><select id="historyYearSelect">${years.map(year => `<option value="${year}" ${year === historyYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label>
      </div>
      <div class="history-calendar-scroll">
        <div class="history-months" style="--history-weeks:${weekCount}">${monthLabels}</div>
        <div class="history-calendar-row"><div class="history-weekdays"><span>日</span><span></span><span>二</span><span></span><span>四</span><span></span><span>六</span></div>
          <div class="history-heatmap" style="--history-weeks:${weekCount}" role="grid" aria-label="${historyYear} 年烹饪日历">${heatCells.join('')}</div>
        </div>
      </div>
      <p class="history-calendar-hint">左右滑动查看全年，有记录的日期可以点击</p>
      <div class="history-legend"><span>少</span><i class="level-0"></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i><span>多</span></div>
    </section>
    <section class="history-section history-monthly-section">
      <div class="history-section-head"><div><h3>月度趋势</h3><p>${historyYear} 年共下厨 ${monthlyTotal} 次</p></div></div>
      <div class="history-monthly-scroll">
        <div class="history-monthly-chart" role="img" aria-label="${historyYear} 年每月下厨次数">${monthlyTrendHtml}</div>
      </div>
    </section>
    ${selectedHtml}
    ${rangeControlHtml}
    <div class="history-charts">
      <section class="history-section"><div class="history-section-head"><div><h3>最常做的菜</h3><p>${filterLabel}</p></div></div><div class="history-ranking">${rankingHtml}</div></section>
      <section class="history-section"><div class="history-section-head"><div><h3>口味与类型</h3><p>${filterLabel}</p></div></div><div class="history-tags-chart">${tagsHtml}</div></section>
    </div>
    <section class="history-section history-recent"><div class="history-section-head"><div><h3>最近做过</h3><p>展示最新 ${recentItems.length} 条</p></div><button type="button" class="btn btn-sm" data-history-open-records>查看全部记录</button></div><div class="history-timeline">${historyTimelineHtml(recentItems)}</div></section>`;

  document.getElementById('historyYearSelect')?.addEventListener('change', event => {
    historyYear = Number(event.target.value);
    if (selectedHistoryDate && !selectedHistoryDate.startsWith(`${historyYear}-`)) selectedHistoryDate = null;
    renderHistory();
  });
}

async function refreshHistoryCache() {
  const [history, recipes] = await Promise.all([
    apiFetch(scoped('/api/history')),
    apiFetch(scoped('/api/recipes')),
  ]);
  getData().history = history;
  getData().recipes = recipes;
}

async function deleteHistoryItem(item) {
  if (!item) return false;
  const ok = await customConfirm({
    title: '撤销烹饪记录',
    message: `撤销“${item.recipeName}”的这次烹饪记录？`,
    warning: '只会移除足迹和菜谱上的做过日期，不会恢复当时扣减的库存。',
    confirmText: '撤销记录',
    type: 'warning',
  });
  if (!ok) return false;
  try {
    await apiFetch(scoped(`/api/history/${item.id}`), { method: 'DELETE' });
    await refreshHistoryCache();
    renderHistory();
    updateStats();
    showToast('已撤销这条烹饪记录', 'success');
    return true;
  } catch (error) {
    showToast('撤销失败: ' + error.message, 'error');
    return false;
  }
}

document.getElementById('historyContent').addEventListener('click', async event => {
  const rangeButton = event.target.closest('[data-history-range]');
  if (rangeButton) {
    historyRange = rangeButton.dataset.historyRange;
    renderHistory();
    return;
  }
  const dateButton = event.target.closest('[data-history-date]');
  if (dateButton) {
    selectedHistoryDate = selectedHistoryDate === dateButton.dataset.historyDate ? null : dateButton.dataset.historyDate;
    renderHistory();
    return;
  }
  if (event.target.closest('[data-history-date-clear]')) {
    selectedHistoryDate = null;
    renderHistory();
    return;
  }
  if (event.target.closest('[data-history-open-records]')) {
    openHistoryRecords();
    return;
  }
  const recipeButton = event.target.closest('[data-history-recipe]');
  if (recipeButton) {
    const recipe = getData().recipes.find(item => item.id === recipeButton.dataset.historyRecipe);
    if (recipe) openRecipeModal(recipe.id);
    else showToast('这份菜谱已被删除，但烹饪记录仍然保留', 'info');
    return;
  }
  const deleteButton = event.target.closest('[data-history-delete]');
  if (!deleteButton) return;
  const item = getData().history.find(entry => entry.id === deleteButton.dataset.historyDelete);
  await deleteHistoryItem(item);
});

function historyDateBoundary(value, endOfDay = false) {
  if (!value) return '';
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function localDateTimeInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderHistoryRecordsList() {
  const list = document.getElementById('historyRecordsList');
  const pagination = document.getElementById('historyRecordsPagination');
  const summary = document.getElementById('historyRecordsSummary');
  summary.textContent = historyRecordsState.total
    ? `共 ${historyRecordsState.total} 条记录，可筛选、修改时间和备注`
    : '查看和整理每一次下厨';
  if (!historyRecordsState.items.length) {
    list.innerHTML = '<div class="history-records-empty"><strong>没有找到记录</strong><span>可以调整搜索词或日期范围再试试</span></div>';
    pagination.hidden = true;
    return;
  }
  list.innerHTML = historyRecordsState.items.map(item => {
    const date = new Date(item.cookedAt);
    const valid = !Number.isNaN(date.getTime());
    const dateLabel = valid ? date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '日期未知';
    const timeLabel = valid ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : item.cookedAt;
    const editing = historyRecordsState.editingId === item.id;
    return `<article class="history-record-row">
      <div class="history-record-date"><strong>${esc(dateLabel)}</strong><span>${esc(timeLabel)}</span></div>
      <div class="history-record-main">
        <button type="button" class="history-record-name" ${item.recipeId ? `data-history-record-recipe="${escAttr(item.recipeId)}"` : 'disabled'}>${esc(item.recipeName)}</button>
        <span>${currentScope === 'family' ? esc(item.username || '历史记录') : '个人记录'}</span>
        ${item.notes ? `<p class="history-record-note">${esc(item.notes)}</p>` : ''}
      </div>
      <div class="history-record-actions">
        <button type="button" class="btn-icon history-record-edit-button" data-history-record-edit="${escAttr(item.id)}" aria-label="编辑时间和备注" title="编辑时间和备注">${I.edit}</button>
        <button type="button" class="btn-icon history-record-delete" data-history-record-delete="${escAttr(item.id)}" aria-label="删除这条记录" title="删除记录">${I.trash}</button>
      </div>
      <form class="history-record-edit${editing ? ' active' : ''}" data-history-record-form="${escAttr(item.id)}" ${editing ? '' : 'hidden'}>
        <label><span>烹饪时间</span><input type="datetime-local" name="cookedAt" value="${escAttr(localDateTimeInputValue(item.cookedAt))}" required></label>
        <label class="history-record-edit-note"><span>备注</span><textarea name="notes" rows="2" maxlength="1000" placeholder="记录这次做菜的心得">${esc(item.notes || '')}</textarea></label>
        <button type="submit" class="btn btn-primary btn-sm">保存</button>
        <button type="button" class="btn btn-sm" data-history-record-cancel>取消</button>
      </form>
    </article>`;
  }).join('');
  pagination.hidden = false;
  document.getElementById('historyRecordsPageInfo').textContent = `第 ${historyRecordsState.page} / ${historyRecordsState.totalPages} 页`;
  document.getElementById('btnHistoryRecordsPrev').disabled = historyRecordsState.page <= 1;
  document.getElementById('btnHistoryRecordsNext').disabled = historyRecordsState.page >= historyRecordsState.totalPages;
}

async function loadHistoryRecords() {
  const requestId = ++historyRecordsState.requestId;
  const list = document.getElementById('historyRecordsList');
  list.innerHTML = '<div class="history-records-loading">正在加载做菜记录…</div>';
  document.getElementById('historyRecordsPagination').hidden = true;
  const params = new URLSearchParams({
    view: 'records',
    page: String(historyRecordsState.page),
    pageSize: String(historyRecordsState.pageSize),
    sort: historyRecordsState.sort,
  });
  if (historyRecordsState.query) params.set('q', historyRecordsState.query);
  const from = historyDateBoundary(historyRecordsState.from);
  const to = historyDateBoundary(historyRecordsState.to, true);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  try {
    const result = await apiFetch(scoped(`/api/history?${params.toString()}`));
    if (requestId !== historyRecordsState.requestId) return;
    historyRecordsState.items = result.items || [];
    historyRecordsState.total = Number(result.total || 0);
    historyRecordsState.page = Number(result.page || 1);
    historyRecordsState.totalPages = Number(result.totalPages || 1);
    historyRecordsState.editingId = null;
    renderHistoryRecordsList();
  } catch (error) {
    if (requestId !== historyRecordsState.requestId) return;
    list.innerHTML = `<div class="history-records-empty"><strong>记录加载失败</strong><span>${esc(error.message)}</span></div>`;
  }
}

function openHistoryRecords() {
  const modal = document.getElementById('modalHistoryRecords');
  document.getElementById('historyRecordsQuery').value = historyRecordsState.query;
  document.getElementById('historyRecordsFrom').value = historyRecordsState.from;
  document.getElementById('historyRecordsTo').value = historyRecordsState.to;
  document.getElementById('historyRecordsSort').value = historyRecordsState.sort;
  document.getElementById('historyRecordsPageSize').value = String(historyRecordsState.pageSize);
  modal.hidden = false;
  setHistoryFiltersCollapsed(window.matchMedia('(max-width: 720px)').matches);
  syncHistoryModalBodyState();
  loadHistoryRecords();
}

function closeHistoryRecords() {
  document.getElementById('modalHistoryRecords').hidden = true;
  syncHistoryModalBodyState();
}

function setHistoryFiltersCollapsed(collapsed) {
  historyRecordsState.filtersCollapsed = !!collapsed;
  const filters = document.getElementById('historyRecordsFilters');
  const toggle = document.getElementById('btnHistoryFiltersToggle');
  filters.classList.toggle('is-collapsed', historyRecordsState.filtersCollapsed);
  toggle.setAttribute('aria-expanded', historyRecordsState.filtersCollapsed ? 'false' : 'true');
  toggle.classList.toggle('active', !historyRecordsState.filtersCollapsed);
}

function syncHistoryModalBodyState() {
  const recordsOpen = !document.getElementById('modalHistoryRecords').hidden;
  const entryOpen = !document.getElementById('modalHistoryEntry').hidden;
  document.body.classList.toggle('history-modal-open', recordsOpen || entryOpen);
}

document.getElementById('btnHistoryRecords').addEventListener('click', openHistoryRecords);
document.getElementById('btnHistoryRecordsClose').addEventListener('click', closeHistoryRecords);
document.getElementById('btnHistoryFiltersToggle').addEventListener('click', () => {
  setHistoryFiltersCollapsed(!historyRecordsState.filtersCollapsed);
});
document.getElementById('historyRecordsFilters').addEventListener('submit', event => {
  event.preventDefault();
  historyRecordsState.query = document.getElementById('historyRecordsQuery').value.trim();
  historyRecordsState.from = document.getElementById('historyRecordsFrom').value;
  historyRecordsState.to = document.getElementById('historyRecordsTo').value;
  if (historyRecordsState.from && historyRecordsState.to && historyRecordsState.from > historyRecordsState.to) {
    showToast('开始日期不能晚于结束日期', 'error');
    return;
  }
  historyRecordsState.page = 1;
  loadHistoryRecords();
});
document.getElementById('btnHistoryRecordsReset').addEventListener('click', () => {
  historyRecordsState.query = '';
  historyRecordsState.from = '';
  historyRecordsState.to = '';
  historyRecordsState.page = 1;
  document.getElementById('historyRecordsFilters').reset();
  loadHistoryRecords();
});
document.getElementById('btnHistoryRecordsPrev').addEventListener('click', () => {
  if (historyRecordsState.page <= 1) return;
  historyRecordsState.page--;
  loadHistoryRecords();
});
document.getElementById('btnHistoryRecordsNext').addEventListener('click', () => {
  if (historyRecordsState.page >= historyRecordsState.totalPages) return;
  historyRecordsState.page++;
  loadHistoryRecords();
});
document.getElementById('historyRecordsSort').addEventListener('change', event => {
  historyRecordsState.sort = event.target.value;
  historyRecordsState.page = 1;
  loadHistoryRecords();
});
document.getElementById('historyRecordsPageSize').addEventListener('change', event => {
  historyRecordsState.pageSize = Number(event.target.value) || 10;
  historyRecordsState.page = 1;
  loadHistoryRecords();
});
document.getElementById('historyRecordsList').addEventListener('click', async event => {
  const recipeButton = event.target.closest('[data-history-record-recipe]');
  if (recipeButton) {
    const recipe = getData().recipes.find(item => item.id === recipeButton.dataset.historyRecordRecipe);
    if (recipe) openRecipeModal(recipe.id);
    else showToast('这份菜谱已被删除，但烹饪记录仍然保留', 'info');
    return;
  }
  const editButton = event.target.closest('[data-history-record-edit]');
  if (editButton) {
    historyRecordsState.editingId = editButton.dataset.historyRecordEdit;
    renderHistoryRecordsList();
    document.querySelector(`[data-history-record-form="${CSS.escape(historyRecordsState.editingId)}"] input`)?.focus();
    return;
  }
  if (event.target.closest('[data-history-record-cancel]')) {
    historyRecordsState.editingId = null;
    renderHistoryRecordsList();
    return;
  }
  const deleteButton = event.target.closest('[data-history-record-delete]');
  if (!deleteButton) return;
  const item = historyRecordsState.items.find(entry => entry.id === deleteButton.dataset.historyRecordDelete);
  if (await deleteHistoryItem(item)) await loadHistoryRecords();
});
document.getElementById('historyRecordsList').addEventListener('submit', async event => {
  const form = event.target.closest('[data-history-record-form]');
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  const value = formData.get('cookedAt');
  const notes = String(formData.get('notes') || '').trim();
  const cookedDate = new Date(String(value || ''));
  if (Number.isNaN(cookedDate.getTime())) {
    showToast('请选择有效的烹饪时间', 'error');
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await apiFetch(scoped(`/api/history/${form.dataset.historyRecordForm}`), {
      method: 'PATCH',
      body: { cookedAt: cookedDate.toISOString(), notes },
    });
    await refreshHistoryCache();
    historyRecordsState.editingId = null;
    renderHistory();
    updateStats();
    await loadHistoryRecords();
    showToast('做菜记录已更新', 'success');
  } catch (error) {
    showToast('修改失败: ' + error.message, 'error');
    submitButton.disabled = false;
  }
});

function getHistoryRecipeMatches(query) {
  const normalized = String(query || '').trim().toLocaleLowerCase();
  if (!normalized) return [];
  return getData().recipes
    .map(recipe => {
      const name = String(recipe.name || '').toLocaleLowerCase();
      const score = name === normalized ? 0 : name.startsWith(normalized) ? 1 : name.includes(normalized) ? 2 : 9;
      return { recipe, score };
    })
    .filter(item => item.score < 9)
    .sort((a, b) => a.score - b.score || a.recipe.name.localeCompare(b.recipe.name, 'zh-CN'))
    .slice(0, 8)
    .map(item => item.recipe);
}

function hideHistoryRecipeSuggestions() {
  const suggestions = document.getElementById('historyRecipeSuggestions');
  if (suggestions) suggestions.hidden = true;
}

function clearHistoryRecipeSelection({ clearName = false } = {}) {
  document.getElementById('historyEntryRecipe').value = '';
  document.getElementById('historyRecipeSelected').hidden = true;
  document.getElementById('historyRecipeSelectedName').textContent = '';
  if (clearName) document.getElementById('historyEntryName').value = '';
}

function renderHistoryRecipeSuggestions() {
  const nameInput = document.getElementById('historyEntryName');
  const suggestions = document.getElementById('historyRecipeSuggestions');
  if (!nameInput || !suggestions) return;
  const query = nameInput.value.trim();
  const matches = getHistoryRecipeMatches(query);
  if (!query || !matches.length) {
    suggestions.innerHTML = '';
    suggestions.hidden = true;
    return;
  }
  suggestions.innerHTML = matches.map(recipe => `
    <button type="button" class="history-recipe-suggestion" role="option" data-history-entry-recipe="${escAttr(recipe.id)}">
      <strong>${esc(recipe.name)}</strong>
      <span>${recipe.tags?.length ? esc(recipe.tags.slice(0, 3).join(' · ')) : '已有菜谱'}</span>
    </button>
  `).join('');
  suggestions.hidden = false;
}

function selectHistoryEntryRecipe(recipeId) {
  const recipe = getData().recipes.find(item => item.id === recipeId);
  if (!recipe) return;
  document.getElementById('historyEntryRecipe').value = recipe.id;
  document.getElementById('historyEntryName').value = recipe.name;
  document.getElementById('historyRecipeSelectedName').textContent = recipe.name;
  document.getElementById('historyRecipeSelected').hidden = false;
  hideHistoryRecipeSuggestions();
}

function openHistoryEntry() {
  const modal = document.getElementById('modalHistoryEntry');
  document.getElementById('historyEntryForm').reset();
  clearHistoryRecipeSelection();
  hideHistoryRecipeSuggestions();
  document.getElementById('historyEntryTime').value = localDateTimeInputValue(new Date());
  modal.hidden = false;
  syncHistoryModalBodyState();
}

function closeHistoryEntry() {
  document.getElementById('modalHistoryEntry').hidden = true;
  syncHistoryModalBodyState();
}

document.getElementById('btnHistoryAdd').addEventListener('click', openHistoryEntry);
document.getElementById('btnHistoryRecordsAdd').addEventListener('click', openHistoryEntry);
document.getElementById('btnHistoryEntryClose').addEventListener('click', closeHistoryEntry);
document.getElementById('btnHistoryEntryCancel').addEventListener('click', closeHistoryEntry);
document.getElementById('historyEntryName').addEventListener('input', () => {
  const selectedId = document.getElementById('historyEntryRecipe').value;
  const selectedRecipe = getData().recipes.find(item => item.id === selectedId);
  if (selectedRecipe && selectedRecipe.name !== document.getElementById('historyEntryName').value.trim()) {
    clearHistoryRecipeSelection();
  }
  renderHistoryRecipeSuggestions();
});
document.getElementById('historyEntryName').addEventListener('focus', renderHistoryRecipeSuggestions);
document.getElementById('historyEntryName').addEventListener('keydown', event => {
  if (event.key === 'Escape') hideHistoryRecipeSuggestions();
});
document.getElementById('historyEntryName').addEventListener('blur', () => {
  window.setTimeout(hideHistoryRecipeSuggestions, 150);
});
document.getElementById('historyRecipeSuggestions').addEventListener('mousedown', event => {
  const option = event.target.closest('[data-history-entry-recipe]');
  if (option) event.preventDefault();
});
document.getElementById('historyRecipeSuggestions').addEventListener('click', event => {
  const option = event.target.closest('[data-history-entry-recipe]');
  if (option) selectHistoryEntryRecipe(option.dataset.historyEntryRecipe);
});
document.getElementById('btnHistoryRecipeClear').addEventListener('click', () => {
  clearHistoryRecipeSelection({ clearName: true });
  document.getElementById('historyEntryName').focus();
});
document.getElementById('historyEntryForm').addEventListener('submit', async event => {
  event.preventDefault();
  const recipeId = document.getElementById('historyEntryRecipe').value;
  const recipeName = document.getElementById('historyEntryName').value.trim();
  const cookedDate = new Date(document.getElementById('historyEntryTime').value);
  const notes = document.getElementById('historyEntryNotes').value.trim();
  if (!recipeName) {
    showToast('请输入菜名', 'error');
    return;
  }
  if (Number.isNaN(cookedDate.getTime())) {
    showToast('请选择有效的烹饪时间', 'error');
    return;
  }
  const saveButton = document.getElementById('btnHistoryEntrySave');
  saveButton.disabled = true;
  try {
    await apiFetch(scoped('/api/history'), {
      method: 'POST',
      body: { recipeId: recipeId || null, recipeName, cookedAt: cookedDate.toISOString(), notes },
    });
    await refreshHistoryCache();
    selectedHistoryDate = localDateKey(cookedDate);
    historyYear = cookedDate.getFullYear();
    closeHistoryEntry();
    renderHistory();
    updateStats();
    if (!document.getElementById('modalHistoryRecords').hidden) {
      historyRecordsState.page = 1;
      await loadHistoryRecords();
    }
    showToast('做菜记录已补记', 'success');
  } catch (error) {
    showToast('补记失败: ' + error.message, 'error');
  } finally {
    saveButton.disabled = false;
  }
});

// ===== Kitchen Assistant =====
function formatKitchenMessage(value) {
  const safe = esc(String(value ?? ''));
  return safe.split('\n').map(line => {
    if (!line) return '<div class="kitchen-message-blank"></div>';
    const content = line
      .replace(/^\s*#{1,3}\s+/, '')
      .replace(/^\s*[-*]\s+/, '• ')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return `<div>${content}</div>`;
  }).join('');
}

function renderKitchenAssistant() {
  const shell = document.getElementById('kitchenAssistant');
  const messagesEl = document.getElementById('kitchenMessages');
  const scopeLabel = document.getElementById('kitchenScopeLabel');
  const inventoryHint = document.getElementById('kitchenInventoryHint');
  const checkbox = document.getElementById('kitchenUseInventory');
  const messages = kitchenConversations[currentScope];
  const lastKitchenMessage = messages[messages.length - 1];
  const waitingForFirstChunk = kitchenAssistantBusy && lastKitchenMessage?.role === 'assistant' && !lastKitchenMessage?.content;
  const visibleMessages = waitingForFirstChunk ? messages.slice(0, -1) : messages;
  const inventoryCount = getData().inventory.length;
  shell.classList.toggle('is-busy', kitchenAssistantBusy);
  document.getElementById('btnKitchenSend').disabled = kitchenAssistantBusy;
  scopeLabel.textContent = currentScope === 'family' ? '家庭范围' : '个人范围';
  checkbox.checked = kitchenUseInventory;
  inventoryHint.textContent = kitchenUseInventory
    ? `会参考当前 ${inventoryCount} 种库存食材`
    : '本次对话不读取库存详情';
  const welcome = `<div class="kitchen-welcome"><div class="kitchen-welcome-mark">✦</div><strong>想问什么都可以</strong><p>可以问“现在能做什么”，也可以只问某种食材有哪些做法。</p></div>`;
  const messageHtml = visibleMessages.map(message => `<div class="kitchen-message kitchen-message--${message.role}">
    <div class="kitchen-message-label">${message.role === 'user' ? '你' : '厨房灵感'}</div>
    <div class="kitchen-message-bubble">${formatKitchenMessage(message.content)}</div>
  </div>`).join('');
  const typing = waitingForFirstChunk ? `<div class="kitchen-message kitchen-message--assistant kitchen-message--typing"><div class="kitchen-message-label">厨房灵感</div><div class="kitchen-message-bubble"><span class="kitchen-typing-dot"></span><span class="kitchen-typing-dot"></span><span class="kitchen-typing-dot"></span></div></div>` : '';
  messagesEl.innerHTML = messages.length ? messageHtml + typing : welcome + typing;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function openKitchenAssistant() {
  const shell = document.getElementById('kitchenAssistant');
  shell.hidden = false;
  renderKitchenAssistant();
  requestAnimationFrame(() => document.getElementById('kitchenInput').focus());
}

function closeKitchenAssistant() {
  document.getElementById('kitchenAssistant').hidden = true;
}

async function sendKitchenMessage(rawMessage) {
  const message = String(rawMessage || '').trim();
  if (!message || kitchenAssistantBusy) return;
  const conversation = kitchenConversations[currentScope];
  const previousMessages = conversation.slice(-8).map(item => ({ role: item.role, content: item.content }));
  conversation.push({ role: 'user', content: message });
  conversation.push({ role: 'assistant', content: '' });
  kitchenAssistantBusy = true;
  document.getElementById('kitchenInput').value = '';
  renderKitchenAssistant();
  try {
    const content = await streamAiContent(scoped('/api/ai/kitchen-assistant'), {
      message,
      useInventory: kitchenUseInventory,
      conversation: previousMessages,
    }, partial => {
      conversation[conversation.length - 1].content = partial;
      renderKitchenAssistant();
    });
    conversation[conversation.length - 1].content = content || '暂时没有得到回复，请换个问法再试试。';
  } catch (error) {
    conversation[conversation.length - 1].content = `暂时无法回答：${error.message || '请求失败'}`;
    showToast('厨房灵感暂时不可用', 'error');
  } finally {
    kitchenAssistantBusy = false;
    renderKitchenAssistant();
  }
}

document.getElementById('btnKitchenAssistant').addEventListener('click', openKitchenAssistant);
document.querySelectorAll('[data-kitchen-close]').forEach(button => button.addEventListener('click', closeKitchenAssistant));
document.getElementById('kitchenUseInventory').addEventListener('change', event => {
  kitchenUseInventory = event.target.checked;
  renderKitchenAssistant();
});
document.getElementById('btnKitchenClear').addEventListener('click', () => {
  if (kitchenAssistantBusy) return;
  kitchenConversations[currentScope].length = 0;
  renderKitchenAssistant();
});
document.getElementById('kitchenComposer').addEventListener('submit', event => {
  event.preventDefault();
  sendKitchenMessage(document.getElementById('kitchenInput').value);
});
document.getElementById('kitchenInput').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendKitchenMessage(event.target.value);
  }
});
document.getElementById('kitchenQuickPrompts').addEventListener('click', event => {
  const button = event.target.closest('[data-kitchen-prompt]');
  if (button) sendKitchenMessage(button.dataset.kitchenPrompt);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.getElementById('kitchenAssistant').hidden) closeKitchenAssistant();
});

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
  const keyInput = document.getElementById('sfApiKey');
  keyInput.value = '';
  keyInput.placeholder = s.hasApiKey ? '已配置，留空保持不变' : 'sk-...';
  document.getElementById('sfModel').value = s.model || '';
  document.getElementById('modalSettings').hidden = false;
  switchSettingsTab('api');

  // Show/hide users tab for admin
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    const usersTab = document.getElementById('stabUsers');
    document.getElementById('databaseBackupSection').hidden = !user.isAdmin;
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
          <button class="btn btn-sm" data-admin-reset="${escAttr(u.id)}" style="font-size:0.75rem;color:var(--chili)">重置密码</button>
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
  const toggle = document.getElementById('scopeToggle');
  if (toggle.dataset.loading === '1') return;
  if (btn.dataset.scope === 'family') {
    try {
      const info = await apiFetch('/api/family');
      if (!info.family) {
        showToast('请先在设置中创建或加入家庭', 'info');
        return;
      }
    } catch { showToast('请先在设置中创建或加入家庭', 'info'); return; }
  }
  toggle.dataset.loading = '1';
  toggle.classList.add('is-loading');
  try {
    currentScope = btn.dataset.scope;
    document.querySelectorAll('.scope-btn').forEach(b => b.classList.toggle('active', b.dataset.scope === currentScope));
    await fetchAllData();
    renderCurrentTab();
    updateStats();
    const activePanel = document.querySelector('.tab-panel.active');
    if (activePanel) {
      activePanel.classList.remove('scope-fade-in');
      void activePanel.offsetWidth;
      activePanel.classList.add('scope-fade-in');
    }
    if (!document.getElementById('kitchenAssistant').hidden) renderKitchenAssistant();
    showToast(currentScope === 'family' ? '已切换到家庭数据' : '已切换到个人数据', 'success');
  } finally {
    toggle.dataset.loading = '0';
    toggle.classList.remove('is-loading');
  }
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
      const me = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
      document.getElementById('familyMemberList').innerHTML = data.members.map(m => {
        const initial = (m.username || '?').trim().charAt(0).toUpperCase();
        const hue = stringHue(m.username);
        const isMe = m.id === me.id;
        return `
          <div class="member-item">
            <span class="member-avatar" style="background:hsl(${hue}, 60%, 92%); color:hsl(${hue}, 55%, 35%)">${esc(initial)}</span>
            <span class="member-name">${esc(m.username)}</span>
            ${isMe ? '<span class="member-tag member-tag--me">我</span>' : ''}
          </div>`;
      }).join('');
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
  if (!await customConfirm({ title: '离开家庭', message: '离开后将不再共享该家庭的菜谱和库存。你在家庭中创建的内容会保留给其他成员。', confirmText: '离开', type: 'warning' })) return;
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
  const keyInput = document.getElementById('sfApiKey');
  const payload = {
    baseUrl: document.getElementById('sfBaseUrl').value.trim(),
    apiKey: keyInput.value,  // empty keeps existing; server handles it
    model: document.getElementById('sfModel').value.trim()
  };
  await apiFetch('/api/settings', { method: 'PUT', body: payload });
  const d = getData();
  d.settings = {
    baseUrl: payload.baseUrl,
    model: payload.model || 'deepseek-v4-flash',
    hasApiKey: d.settings.hasApiKey || payload.apiKey.length > 0
  };
  keyInput.value = '';
  keyInput.placeholder = d.settings.hasApiKey ? '已配置，留空保持不变' : 'sk-...';
  document.getElementById('modalSettings').hidden = true;
  showToast('设置已保存', 'success');
});

// Change password
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const oldPw = document.getElementById('pwOld').value;
  const newPw = document.getElementById('pwNew').value;
  if (newPw.length < 8) { showToast('新密码至少8位', 'error'); return; }
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
  const newPw = prompt('输入新密码（至少8位）：');
  if (!newPw || newPw.length < 8) { showToast('密码至少8位', 'error'); return; }
  try {
    await apiFetch('/api/admin/reset-password', { method: 'POST', body: { userId, newPassword: newPw } });
    showToast('密码已重置', 'success');
  } catch (err) { showToast('操作失败: ' + err.message, 'error'); }
});

// ===== Data Export / Import =====
document.getElementById('btnExportData').addEventListener('click', () => {
  const data = getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `knowingre-backup-${new Date().toISOString().slice(0, 10)}.json`);
});

document.getElementById('btnDownloadDatabase').addEventListener('click', async (event) => {
  try {
    await withLoading(event.currentTarget, downloadDatabaseBackup);
    showToast('数据库备份已生成，已交给浏览器下载', 'success');
  } catch (error) {
    showToast('下载失败: ' + error.message, 'error');
  }
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
        if (!data.unitConversions || !Array.isArray(data.unitConversions)) data.unitConversions = [];
        if (!await customConfirm({ title: '导入数据', message: '相同 ID 的菜谱和库存会更新，新内容会添加；其他现有数据不会删除。建议先导出当前数据作为备份。', confirmText: '安全导入', type: 'warning' })) return;
        try {
          const result = await apiFetch(scoped('/api/import'), { method: 'POST', body: data });
          // Refresh
          dataCache = null;
          await fetchAllData();
          showToast(`导入完成：菜谱新增 ${result.recipesCreated}、更新 ${result.recipesUpdated}，库存新增 ${result.inventoryCreated}、更新 ${result.inventoryUpdated}`, 'success');
        } catch (err) { showToast('导入失败: ' + err.message, 'error'); return; }
        renderCurrentTab();
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
  overlay.addEventListener('click', async (e) => {
    if (e.target !== overlay) return;
    if (overlay.id === 'modalRecipe' && recipeFormDirty && !recipeViewMode) {
      if (!await customConfirm({ title: '放弃修改', message: '有未保存的修改，确定放弃吗？', confirmText: '放弃', type: 'warning' })) return;
    }
    recipeFormDirty = false;
    overlay.hidden = true;
    if (overlay.id === 'modalHistoryRecords' || overlay.id === 'modalHistoryEntry') syncHistoryModalBodyState();
  });
});

// ===== Recipe Rendering =====
function buildInventoryLookup(inventory) {
  const exact = new Set();
  const entries = [];
  for (const inv of inventory) {
    const norm = normalizeIngredientName(inv.name);
    exact.add(norm);
    entries.push(norm);
  }
  return (ingName) => {
    const norm = normalizeIngredientName(ingName);
    if (exact.has(norm)) return true;
    for (const invNorm of entries) {
      const long = invNorm.length >= norm.length ? invNorm : norm;
      const short = invNorm.length >= norm.length ? norm : invNorm;
      if (short.length >= 1 && long.endsWith(short) && !isFalseSuffix(long, short)) return true;
      if (invNorm.length >= 2 && norm.length >= 2) {
        if (invNorm.includes(norm) || norm.includes(invNorm)) return true;
      }
    }
    return false;
  };
}

function countMissingIngredients(ingredients, lookup) {
  if (!ingredients || !ingredients.length) return 0;
  return ingredients.filter(i => !i.optional && i.name && !lookup(i.name)).length;
}

const RECIPE_BATCH = 40;
let recipeRenderState = { list: [], rendered: 0, observer: null };

function recipeCardHtml(r, ctx) {
  const inMenu = ctx.todayMenuIds.includes(r.id);
  const stars = Array.from({length:5}, (_,i) =>
    i < r.rating ? `<span class="star">${I.star}</span>` : `<span class="star-empty">${I.starEmpty}</span>`
  ).join('');
  const cookedCount = r.cookedDates.length;
  const cookedText = cookedCount
    ? `做过 ${cookedCount} 次 · ${formatRelativeDate(new Date(r.cookedDates[cookedCount - 1]))}`
    : '尚未做过';
  const missing = countMissingIngredients(r.ingredients, ctx.lookup);
  return `
    <div class="recipe-card${inMenu ? ' in-menu' : ''}" data-id="${escAttr(r.id)}">
      ${inMenu ? '<button class="card-menu-badge" data-menu-remove-card="' + escAttr(r.id) + '" title="点击从今日菜单移除">' + iconSvg('menu', 'icon-sm') + ' 今日菜单 ' + iconSvg('xmark', 'icon-sm') + '</button>' : ''}
      <div class="card-name">${esc(r.name)}</div>
      <div class="card-tags">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="card-meta">
        <span>🥬 ${r.ingredients.length}种食材</span>
        <span>📝 ${r.steps.length}步</span>
        ${missing > 0 ? `<span class="card-meta__missing" title="库存中缺少的主食材">缺 ${missing} 样</span>` : '<span class="card-meta__ready" title="主食材齐全">✓ 食材齐</span>'}
      </div>
      <div class="card-meta" style="margin-top:4px">
        <span>${stars}</span>
        <span>${cookedText}</span>
      </div>
      <div class="card-footer">
        <span class="card-hint">点击查看详情 →</span>
        <div style="display:flex;gap:4px;align-items:center">
          <button class="btn btn-xs" data-sync-recipe="${escAttr(r.id)}" title="${ctx.scope === 'family' ? '同步到个人' : '同步到家庭'}" style="border-color:var(--stone-dark);color:var(--text-muted)">${iconSvg('sync', 'icon-sm')}</button>
          ${inMenu
            ? `<button class="btn btn-xs" data-menu-remove-card="${escAttr(r.id)}" style="border-color:var(--bloom);color:var(--bloom);background:var(--bloom-ghost)">${iconSvg('menu', 'icon-sm')} 移出</button>`
            : `<button class="btn btn-xs btn-primary" data-menu-add="${escAttr(r.id)}">${iconSvg('plus', 'icon-sm')} 加入</button>`
          }
        </div>
      </div>
    </div>`;
}

function appendRecipeBatch() {
  const grid = document.getElementById('recipeGrid');
  const { list, rendered } = recipeRenderState;
  if (rendered >= list.length) return;
  const d = getData();
  const ctx = {
    todayMenuIds: d.todayMenu || [],
    lookup: recipeRenderState.lookup || buildInventoryLookup(d.inventory),
    scope: currentScope,
  };
  const next = list.slice(rendered, rendered + RECIPE_BATCH);
  const sentinel = grid.querySelector('#recipeSentinel');
  const frag = document.createRange().createContextualFragment(next.map(r => recipeCardHtml(r, ctx)).join(''));
  if (sentinel) grid.insertBefore(frag, sentinel); else grid.appendChild(frag);
  recipeRenderState.rendered = rendered + next.length;
  if (recipeRenderState.rendered >= list.length) {
    sentinel?.remove();
    recipeRenderState.observer?.disconnect();
    recipeRenderState.observer = null;
  }
}

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

  // Reset any prior observer
  recipeRenderState.observer?.disconnect();
  recipeRenderState = { list: recipes, rendered: 0, observer: null, lookup: buildInventoryLookup(d.inventory) };

  if (d.recipes.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  if (recipes.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>🔍 没有匹配的菜谱</p></div>';
    empty.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = recipes.length > RECIPE_BATCH ? '<div id="recipeSentinel" class="recipe-sentinel"></div>' : '';
  appendRecipeBatch();

  if (recipes.length > RECIPE_BATCH && 'IntersectionObserver' in window) {
    const sentinel = grid.querySelector('#recipeSentinel');
    if (sentinel) {
      recipeRenderState.observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) appendRecipeBatch();
      }, { rootMargin: '400px 0px' });
      recipeRenderState.observer.observe(sentinel);
    }
  }
}

function renderTagFilters(recipes) {
  const allTags = [...new Set(recipes.flatMap(r => r.tags))];
  const container = document.getElementById('tagFilters');
  if (allTags.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = allTags.map(t =>
    `<span class="tag-filter${t === currentFilterTag ? ' active' : ''}" data-tag="${escAttr(t)}">${esc(t)}</span>`
  ).join('');
}

document.getElementById('recipeSearch').addEventListener('input', debounce(renderRecipes, 200));
document.getElementById('btnNewRecipe').addEventListener('click', () => openRecipeModal(null));

// ===== Recipe Modal =====
let recipeViewMode = false;

function setRecipeFormEditable(editable) {
  recipeViewMode = !editable;
  const form = document.getElementById('recipeForm');
  const viewer = document.getElementById('rfViewer');
  form.hidden = !editable;
  viewer.hidden = editable;

  document.getElementById('btnEditRecipe').style.display = editable ? 'none' : '';
  document.getElementById('btnCancelEdit').style.display = editable && editingRecipeId ? '' : 'none';
  document.getElementById('btnSave').style.display = editable ? '' : 'none';
  document.getElementById('btnDeleteRecipe').style.display = editingRecipeId && editable ? '' : 'none';
  document.getElementById('aiGenSection').hidden = !editable || !!editingRecipeId;
  document.getElementById('aiModifySection').hidden = !editable;

  const title = editingRecipeId ? (editable ? '编辑菜谱' : '菜谱详情') : '新建菜谱';
  document.getElementById('modalTitle').textContent = title;
}

function renderRecipeViewer(recipe) {
  const viewer = document.getElementById('rfViewer');
  if (!recipe) { viewer.innerHTML = ''; return; }

  const tags = (recipe.tags || []).map(t => `<span class="viewer-tag">${esc(t)}</span>`).join('');
  const stars = '★★★★★'.slice(0, recipe.rating || 0) + '☆☆☆☆☆'.slice(0, 5 - (recipe.rating || 0));

  const ings = (recipe.ingredients || []).map(i => `
    <li class="viewer-ing${i.optional ? ' viewer-ing--opt' : ''}">
      <span class="viewer-ing__name">${esc(i.name)}</span>
      <span class="viewer-ing__amt">${esc(i.amount || '')}</span>
      ${i.optional ? '<span class="viewer-ing__opt">可选</span>' : ''}
    </li>
  `).join('');

  const steps = (recipe.steps || []).filter(s => s && s.trim()).map(s => `
    <li class="viewer-step">${esc(s)}</li>
  `).join('');

  const cookedDates = recipe.cookedDates || recipe.cooked_dates || [];
  const lastCooked = cookedDates.length ? new Date(cookedDates[cookedDates.length - 1]) : null;
  const lastCookedText = lastCooked ? formatRelativeDate(lastCooked) : '尚未制作';
  const cookingNotes = (getData().history || [])
    .filter(item => item.recipeId === recipe.id && String(item.notes || '').trim())
    .sort((a, b) => new Date(b.cookedAt) - new Date(a.cookedAt));
  const cookingNoteHtml = item => {
    const date = new Date(item.cookedAt);
    const dateText = Number.isNaN(date.getTime())
      ? '时间未知'
      : date.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const author = currentScope === 'family' && item.username ? ` · ${item.username}` : '';
    return `<article class="viewer-cooking-note"><div>${esc(dateText + author)}</div><p>${esc(item.notes)}</p></article>`;
  };
  const latestCookingNote = cookingNotes[0];
  const olderCookingNotes = cookingNotes.slice(1);

  viewer.innerHTML = `
    <div class="viewer-head">
      <h3 class="viewer-title">${esc(recipe.name)}</h3>
      ${tags ? `<div class="viewer-tags">${tags}</div>` : ''}
      <div class="viewer-meta">
        <span class="viewer-rating" title="评分">${stars}</span>
        <span class="viewer-stat">🍳 已做 ${cookedDates.length} 次</span>
        <span class="viewer-stat">⏱ ${lastCookedText}</span>
      </div>
    </div>
    ${ings ? `
    <section class="viewer-section">
      <h4 class="viewer-section__title">食材</h4>
      <ul class="viewer-ings">${ings}</ul>
    </section>` : ''}
    ${steps ? `
    <section class="viewer-section">
      <h4 class="viewer-section__title">步骤</h4>
      <ol class="viewer-steps">${steps}</ol>
    </section>` : ''}
    ${recipe.notes ? `
    <section class="viewer-section">
      <h4 class="viewer-section__title">菜谱备注</h4>
      <p class="viewer-notes">${esc(recipe.notes)}</p>
    </section>` : ''}
    ${latestCookingNote ? `
    <section class="viewer-section viewer-cooking-notes">
      <h4 class="viewer-section__title">最近一次做菜备注</h4>
      ${cookingNoteHtml(latestCookingNote)}
      ${olderCookingNotes.length ? `
        <button type="button" class="viewer-notes-toggle" data-viewer-notes-toggle data-count="${olderCookingNotes.length}" aria-expanded="false">查看另外 ${olderCookingNotes.length} 条备注</button>
        <div class="viewer-cooking-notes-all" data-viewer-notes-all hidden>${olderCookingNotes.map(cookingNoteHtml).join('')}</div>
      ` : ''}
    </section>` : ''}
  `;
}

document.getElementById('rfViewer').addEventListener('click', event => {
  const toggle = event.target.closest('[data-viewer-notes-toggle]');
  if (!toggle) return;
  const allNotes = toggle.closest('.viewer-cooking-notes')?.querySelector('[data-viewer-notes-all]');
  if (!allNotes) return;
  const expanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!expanded));
  allNotes.hidden = expanded;
  toggle.textContent = expanded ? `查看另外 ${toggle.dataset.count} 条备注` : '收起历史备注';
});

async function withLoading(btn, fn) {
  if (!btn) return fn();
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  btn.classList.add('is-loading');
  try { return await fn(); }
  finally {
    btn.disabled = wasDisabled;
    btn.classList.remove('is-loading');
  }
}

function stringHue(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

const CONFIRM_ICONS = {
  danger: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  warning: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  default: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
};

function customConfirm({ title = '确认', message = '', details, warning, confirmText = '确定', cancelText = '取消', type = 'default' } = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById('modalConfirm');
    const dialog = modal.querySelector('.confirm-dialog');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const iconEl = document.getElementById('confirmIcon');
    const detailsEl = document.getElementById('confirmDetails');
    const warningEl = document.getElementById('confirmWarning');
    const okBtn = modal.querySelector('[data-confirm-ok]');
    const cancelBtns = modal.querySelectorAll('[data-confirm-cancel]');

    titleEl.textContent = title;
    msgEl.textContent = message;
    msgEl.hidden = !message;
    dialog.dataset.type = type;
    iconEl.innerHTML = CONFIRM_ICONS[type] || CONFIRM_ICONS.default;

    if (Array.isArray(details) && details.length) {
      detailsEl.innerHTML = details.map(d => `<span class="confirm-chip">${esc(d)}</span>`).join('');
      detailsEl.hidden = false;
    } else {
      detailsEl.innerHTML = '';
      detailsEl.hidden = true;
    }

    if (warning) {
      warningEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${esc(warning)}</span>`;
      warningEl.hidden = false;
    } else {
      warningEl.innerHTML = '';
      warningEl.hidden = true;
    }

    okBtn.textContent = confirmText;
    okBtn.className = 'btn ' + (type === 'danger' ? 'btn-danger' : 'btn-primary');
    cancelBtns.forEach(b => {
      if (b.tagName === 'BUTTON' && !b.classList.contains('confirm-close')) b.textContent = cancelText;
    });

    modal.hidden = false;

    const cleanup = (result) => {
      modal.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtns.forEach(b => b.removeEventListener('click', onCancel));
      modal.removeEventListener('click', onOverlay);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlay = (e) => { if (e.target === modal) cleanup(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtns.forEach(b => b.addEventListener('click', onCancel));
    modal.addEventListener('click', onOverlay);
  });
}

function formatRelativeDate(date) {
  const diffMs = Date.now() - date.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return '今天做过';
  const days = Math.floor(diffMs / day);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
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
      <input type="text" placeholder="食材名称" value="${escAttr(ing.name)}" data-ing-name>
      <input type="text" placeholder="用量 (如200g)" value="${escAttr(ing.amount)}" data-ing-amount style="max-width:150px">
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
  renderRecipeViewer(recipe);

  // View mode for existing recipes, edit mode for new ones
  setRecipeFormEditable(isNew);
  document.getElementById('modalRecipe').hidden = false;
  requestAnimationFrame(autoGrowAllSteps);
}

document.getElementById('btnEditRecipe').addEventListener('click', () => {
  setRecipeFormEditable(true);
});

async function maybeCloseRecipeModal() {
  if (recipeFormDirty && !recipeViewMode) {
    if (!await customConfirm({ title: '放弃修改', message: '有未保存的修改，确定放弃吗？', confirmText: '放弃', type: 'warning' })) return;
  }
  recipeFormDirty = false;
  document.getElementById('modalRecipe').hidden = true;
}

document.getElementById('btnModalClose').addEventListener('click', maybeCloseRecipeModal);

// Cancel — for new recipe close; for existing recipe revert to view mode
document.getElementById('btnCancelEdit').addEventListener('click', async () => {
  if (!editingRecipeId) { await maybeCloseRecipeModal(); return; }
  if (recipeFormDirty) {
    if (!await customConfirm({ title: '放弃修改', message: '有未保存的修改，确定放弃吗？', confirmText: '放弃', type: 'warning' })) return;
  }
  const id = editingRecipeId;
  recipeFormDirty = false;
  openRecipeModal(id);
});

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
  renderRecipeRows({ ingredients: [{ name: '', amount: '', optional: false }], steps: [''] });
}

function renderRecipeRows(recipe, animate = false) {
  const ingredients = Array.isArray(recipe?.ingredients) && recipe.ingredients.length
    ? recipe.ingredients
    : [{ name: '', amount: '', optional: false }];
  const steps = Array.isArray(recipe?.steps) && recipe.steps.length ? recipe.steps : [''];
  const ingDiv = document.getElementById('rfIngredients');
  const stepDiv = document.getElementById('rfSteps');
  ingDiv.innerHTML = ingredients.map((ing, i) => `
    <div class="ingredient-row${animate ? ' reveal-row' : ''}"${animate ? ` style="animation-delay:${i * 0.05}s"` : ''}>
      <input type="text" placeholder="食材名称" value="${escAttr(ing.name || '')}" data-ing-name>
      <input type="text" placeholder="用量 (如200克)" value="${escAttr(ing.amount || '')}" data-ing-amount style="max-width:150px">
      <label style="font-weight:normal;display:flex;align-items:center;gap:4px;margin:0;white-space:nowrap">
        <input type="checkbox" ${ing.optional ? 'checked' : ''} data-ing-opt> 可选
      </label>
      <button type="button" class="row-remove" data-remove-ing>×</button>
    </div>
  `).join('');
  stepDiv.innerHTML = steps.map((step, i) => `
    <div class="step-row${animate ? ' reveal-row' : ''}"${animate ? ` style="animation-delay:${i * 0.06}s"` : ''}>
      <span class="step-num">${i + 1}</span>
      <textarea placeholder="步骤 ${i + 1}" data-step>${esc(step || '')}</textarea>
      <button type="button" class="row-remove" data-remove-step>×</button>
    </div>
  `).join('');
  bindRemoveButtons();
  autoGrowAllSteps();
}

function applyAiRecipeToForm(recipe) {
  document.getElementById('rfName').value = recipe.name;
  document.getElementById('rfTags').value = recipe.tags.join(', ');
  document.getElementById('rfNotes').value = recipe.notes;
  document.getElementById('rfSource').value = 'ai';
  renderRecipeRows(recipe, true);
}

document.getElementById('btnAiGenFill').addEventListener('click', async () => {
  const input = document.getElementById('aiGenDishName');
  const dishName = input.value.trim();
  if (!dishName) { showToast('请输入菜名', 'error'); return; }
  const status = document.getElementById('aiGenStatus');
  const btn = document.getElementById('btnAiGenFill');
  const d = getData();
  if (!d.settings.hasApiKey) { showToast('请先设置 API Key', 'error'); return; }
  const previous = collectRecipeForm();

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
    let started = false;
    const recipe = await callLLM(dishName, () => {
      if (!started) { started = true; status.innerHTML = '<span class="ai-spinner"></span> 生成中…'; }
    });
    applyAiRecipeToForm(recipe);
    recipeFormDirty = true;
    status.innerHTML = '<span class="ai-check">✓</span> 已填入';
  } catch (err) {
    renderRecipeRows(previous);
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
  if (!current.ingredients.length && !current.steps.length) {
    showToast('请先填写食材或步骤，AI 才能有依据修改', 'error');
    return;
  }
  const status = document.getElementById('aiModifyStatus');
  const btn = document.getElementById('btnAiModify');
  const d = getData();
  if (!d.settings.hasApiKey) { showToast('请先设置 API Key', 'error'); return; }

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
    let startedModify = false;
    const updated = await modifyRecipe(current, instruction, () => {
      if (!startedModify) { startedModify = true; status.innerHTML = '<span class="ai-spinner"></span> 修改中…'; }
    });
    applyAiRecipeToForm(updated);
    recipeFormDirty = true;
    status.innerHTML = '<span class="ai-check">✓</span> 已修改';
    document.getElementById('aiModifyInput').value = '';
  } catch (err) {
    renderRecipeRows(current);
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

function autoGrowStep(ta) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}
function autoGrowAllSteps() {
  document.querySelectorAll('#rfSteps [data-step]').forEach(autoGrowStep);
}
document.getElementById('rfSteps').addEventListener('input', (e) => {
  if (e.target.matches('[data-step]')) autoGrowStep(e.target);
});

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
  const sameRecipeName = recipe => recipe.name.trim().localeCompare(form.name, 'zh-CN', { sensitivity: 'base' }) === 0;
  let updatedExisting = false;
  if (editingRecipeId) {
    const conflict = d.recipes.find(r => r.id !== editingRecipeId && sameRecipeName(r));
    if (conflict) {
      showToast(`菜谱库中已有另一份「${form.name}」，请换一个名称`, 'error');
      return;
    }
    try {
      await apiFetch(scoped(`/api/recipes/${editingRecipeId}`), { method: 'PUT', body: form });
      // Refresh from server
      const recipes = await apiFetch(scoped('/api/recipes'));
      d.recipes = recipes;
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); return; }
  } else {
    const dup = d.recipes.find(sameRecipeName);
    if (dup && !await customConfirm({
      title: '更新已有菜谱',
      message: `菜谱库中已有「${form.name}」。是否用当前内容更新这份菜谱？原有烹饪记录会保留。`,
      confirmText: '更新原菜谱',
      type: 'warning'
    })) return;
    try {
      if (dup) {
        await apiFetch(scoped(`/api/recipes/${dup.id}`), { method: 'PUT', body: form });
        updatedExisting = true;
      } else {
        await apiFetch(scoped('/api/recipes'), { method: 'POST', body: { ...form, id: uid() } });
      }
      const recipes = await apiFetch(scoped('/api/recipes'));
      d.recipes = recipes;
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); return; }
  }
  showToast(editingRecipeId || updatedExisting ? '菜谱已更新' : '菜谱已创建', 'success');
  recipeFormDirty = false;
  if (editingRecipeId) {
    // Stay open, switch back to view mode with fresh data
    openRecipeModal(editingRecipeId);
  } else {
    document.getElementById('modalRecipe').hidden = true;
    editingRecipeId = null;
  }
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
  const d = getData();
  const recipe = d.recipes.find(r => r.id === editingRecipeId);
  const name = recipe?.name || '这份菜谱';
  if (!await customConfirm({ title: '删除菜谱', message: `确定删除「${name}」？删除后不可恢复。`, confirmText: '删除', type: 'danger' })) return;
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

async function streamAiContent(path, body, onProgress) {
  const separator = path.includes('?') ? '&' : '?';
  const resp = await fetch(API_BASE + path + separator + 'stream=1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getToken()
    },
    body: JSON.stringify(body)
  });
  if (resp.status === 401) { clearToken(); window.location.href = '/login.html'; throw new Error('未登录'); }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  const consumeSseLine = line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const chunk = JSON.parse(data);
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) {
        full += delta;
        onProgress?.(full);
      }
    } catch {}
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(consumeSseLine);
  }
  buffer += decoder.decode();
  buffer.split('\n').forEach(consumeSseLine);
  return full;
}

async function callLLM(dishName, onProgress) {
  const content = await streamAiContent('/api/ai/generate-recipe', { dishName }, onProgress);
  return validateAiRecipe(safeParseJSON(content));
}

// AI modify — update existing recipe content via LLM
async function modifyRecipe(recipe, instruction, onProgress) {
  const content = await streamAiContent('/api/ai/modify-recipe', { recipe, instruction }, onProgress);
  return validateAiRecipe(safeParseJSON(content));
}

// ===== Inventory =====
function renderInventory() {
  const d = getData();
  const seasoningCount = d.inventory.filter(item => isPantryCategory(item.category)).length;
  const regularCount = d.inventory.length - seasoningCount;
  document.getElementById('invCount').textContent = d.inventory.length > 0
    ? (!showInventorySeasonings && seasoningCount > 0
      ? `${regularCount} 种食材，另有 ${seasoningCount} 种调料`
      : `${d.inventory.length} 种`)
    : '';

  // Sync UI to memory state (user might have switched tabs)
  const searchInput = document.getElementById('invSearch');
  if (searchInput && searchInput.value !== invSearchText) searchInput.value = invSearchText;

  // Render filter chips based on what exists
  renderInventoryChips(d.inventory);

  // Apply filter + search
  const q = invSearchText.trim().toLowerCase();
  const filtered = d.inventory.filter(item => {
    if (invFilterCategory === 'low') { if (!isLowStock(item)) return false; }
    else if (invFilterCategory === '调料') { if (!isPantryCategory(item.category)) return false; }
    else if (invFilterCategory !== 'all' && item.category !== invFilterCategory) return false;
    else if (!q && !showInventorySeasonings && isPantryCategory(item.category)) return false;
    if (q && !item.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const listDiv = document.getElementById('inventoryList');
  const bannerDiv = document.getElementById('invBanner');
  const lowItems = invFilterCategory === 'all' && !q ? d.inventory.filter(isLowStock) : [];
  const currentIds = lowItems.map(i => i.id).sort().join(',');
  const dismissedIds = sessionStorage.getItem('knowingre_low_dismissed') || '';
  const bannerHidden = currentIds && currentIds === dismissedIds;
  bannerDiv.innerHTML = lowItems.length > 0 && !bannerHidden ? `
    <div class="low-stock-banner" role="status" data-ids="${escAttr(currentIds)}">
      <span class="low-stock-banner__label">⚠ 低库存 (${lowItems.length})</span>
      ${lowItems.map(i => `<button type="button" data-lowstock-name="${escAttr(i.id)}">${esc(i.name)}</button>`).join('')}
      <button type="button" class="low-stock-banner__close" data-lowstock-dismiss aria-label="收起">×</button>
    </div>` : '';

  if (d.inventory.length === 0) {
    listDiv.innerHTML = '<div class="empty-state" style="padding:30px"><p>🧺 暂无食材，添加一些吧</p></div>';
  } else if (filtered.length === 0) {
    listDiv.innerHTML = `<div class="empty-state" style="padding:24px"><p>未找到匹配的食材</p></div>`;
  } else {
    const items = filtered.map(item => {
      const low = isLowStock(item);
      return `
      <div class="inv-item${low ? ' inv-item--low' : ''}">
        <div class="inv-meta">
          <span class="inv-category">${esc(item.category || '其他')}${low ? '<span class="low-badge">低</span>' : ''}</span>
          <span class="inv-actions">
            <button class="inv-edit-btn" data-inv-edit="${escAttr(item.id)}">编辑</button>
            <button class="inv-del-btn" data-inv-del="${escAttr(item.id)}">删除</button>
          </span>
        </div>
        <div class="inv-info">
          <span class="inv-name">${esc(item.name)}</span>
          <span class="inv-amount">${esc(item.amount)}${!isPantryCategory(item.category) && item.unit ? ' ' + esc(item.unit) : ''}</span>
        </div>
      </div>`;
    }).join('');
    listDiv.innerHTML = items;
  }

  // Matchable recipes
  renderMatchableRecipes();

}

function renderInventoryChips(inventory) {
  const chipsDiv = document.getElementById('invFilterChips');
  if (!chipsDiv) return;
  const counts = {};
  inventory.forEach(i => {
    const category = isPantryCategory(i.category) ? '调料' : (i.category || '其他');
    counts[category] = (counts[category] || 0) + 1;
  });
  const seasoningCount = counts['调料'] || 0;
  const visibleAllCount = showInventorySeasonings ? inventory.length : inventory.length - seasoningCount;
  const lowCount = inventory.filter(isLowStock).length;
  const CAT_ORDER = ['蔬菜', '肉类', '水产', '蛋奶', '豆制品', '熟食', '主食', '干货', '调料', '其他'];
  const chips = [
    { key: 'all', label: `全部 ${visibleAllCount}` },
    ...(lowCount > 0 ? [{ key: 'low', label: `低库存 ${lowCount}`, danger: true }] : []),
    ...CAT_ORDER.filter(c => counts[c]).map(c => ({ key: c, label: `${c} ${counts[c]}` })),
  ];
  const toggle = seasoningCount > 0 ? `
    <button type="button" class="inv-chip inv-chip--toggle${showInventorySeasonings ? ' inv-chip--active' : ''}" data-inv-seasonings-toggle aria-pressed="${showInventorySeasonings ? 'true' : 'false'}">${showInventorySeasonings ? '隐藏调料' : '显示调料'} ${seasoningCount}</button>
  ` : '';
  chipsDiv.innerHTML = chips.slice(0, 1).map(c => `
    <button type="button" class="inv-chip${invFilterCategory === c.key ? ' inv-chip--active' : ''}${c.danger ? ' inv-chip--danger' : ''}" data-inv-filter="${escAttr(c.key)}">${esc(c.label)}</button>
  `).join('') + toggle + chips.slice(1).map(c => `
    <button type="button" class="inv-chip${invFilterCategory === c.key ? ' inv-chip--active' : ''}${c.danger ? ' inv-chip--danger' : ''}" data-inv-filter="${escAttr(c.key)}">${esc(c.label)}</button>
  `).join('');
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
    const amountWithoutUnit = normAmount.slice(0, -normUnit.length).trim();
    if (/^(?:\d+(?:\.\d+)?|\d+\s*[\/／]\s*\d+|半)$/.test(amountWithoutUnit)) {
      normAmount = amountWithoutUnit;
    }
  }

  const d = getData();
  let mergeResult = null;
  try {
    if (editingInventoryId) {
      await apiFetch(scoped(`/api/inventory/${editingInventoryId}`), {
        method: 'PUT',
        body: { name, amount: normAmount, unit: normUnit, category }
      });
    } else {
      mergeResult = await apiFetch(scoped('/api/inventory'), {
        method: 'POST',
        body: { name, amount: normAmount, unit: normUnit, category }
      });
    }
    const inventory = await apiFetch(scoped('/api/inventory'));
    d.inventory = inventory;
  } catch (err) { showToast('保存失败: ' + err.message, 'error'); return; }

  if (mergeResult && !editingInventoryId) {
    const existing = d.inventory.find(i => i.name === name && i.id !== mergeResult.id);
    if (!mergeResult.merged && existing) {
      showToast(`已作为新记录保存 (单位不同于已有 ${existing.amount}${existing.unit || ''})`, 'info');
    } else if (mergeResult.merged) {
      showToast('已合并到现有食材', 'success');
    }
  }

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
    if (!canMake) missingHtml += `<div class="match-missing">缺少主食材: ${missingMain.map(m => esc(m.name)).join('、')}</div>`;
    if (missingSeas.length) missingHtml += `<div class="match-missing" style="color:var(--clay)">缺少调料: ${missingSeas.map(m => esc(m.name)).join('、')}</div>`;
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
              ? `<button class="btn btn-xs" data-menu-remove-card="${escAttr(recipe.id)}" style="margin-top:10px;border-color:var(--bloom);color:var(--bloom);background:var(--bloom-ghost)">${iconSvg('menu', 'icon-sm')} 移出菜单</button>`
              : `<button class="btn btn-xs btn-primary" data-menu-add="${escAttr(recipe.id)}" style="margin-top:10px">${iconSvg('plus', 'icon-sm')} 加入菜单</button>`)
          : ''}
      </div>
    `;
  }).join('');
}

async function quickCook(recipeId) {
  const recipe = getData().recipes.find(r => r.id === recipeId);
  if (!recipe) return;
  try {
    const preview = await apiFetch(scoped(`/api/cook/${recipeId}/preview`), { method: 'POST' });
    await showCookDoneDialog(recipeId, preview);
  } catch (err) {
    showToast('操作失败: ' + err.message, 'error');
  }
}

async function refreshCookData(d) {
  const [recipes, inventory, menu, unitConversions, history] = await Promise.all([
    apiFetch(scoped('/api/recipes')),
    apiFetch(scoped('/api/inventory')),
    apiFetch(scoped('/api/menu')),
    apiFetch(scoped('/api/unit-conversions')),
    apiFetch(scoped('/api/history'))
  ]);
  d.recipes = recipes;
  d.inventory = inventory;
  d.todayMenu = menu;
  d.unitConversions = unitConversions;
  d.history = history;
}

let cookingDialogOpen = false;
async function showCookDoneDialog(recipeId, suppliedPreview = null, draft = null) {
  if (cookingDialogOpen) return;
  const d = getData();
  const batch = Array.isArray(recipeId);
  const recipeIds = batch ? recipeId : [recipeId];
  const recipes = recipeIds.map(id => d.recipes.find(r => r.id === id));
  if (!recipes.length || recipes.some(recipe => !recipe)) return;
  const title = batch ? `全部做完（${recipes.length} 道菜）` : recipes[0].name;
  const endpoint = batch ? '/api/cook-batch' : `/api/cook/${recipeId}`;
  const requestBody = batch ? { recipeIds } : {};
  const dialogScope = currentScope;
  const cookPath = path => dialogScope === 'family' ? path + '?scope=family' : path;
  cookingDialogOpen = true;

  let preview = suppliedPreview;
  if (!preview) {
    try {
      preview = await apiFetch(cookPath(endpoint + '/preview'), { method: 'POST', body: requestBody });
    } catch (err) {
      cookingDialogOpen = false;
      showToast('无法计算库存扣减: ' + err.message, 'error');
      return;
    }
  }
  const pantryItems = preview.items.filter(item => item.inventoryId && item.skipDeduction);
  const matched = preview.items.filter(item => item.inventoryId && !item.skipDeduction);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay cook-overlay';
  overlay.style.zIndex = '300';
  let itemsHtml = matched.map(m => {
    let note = '';
    if (m.status === 'ready' && (m.conversionSource === 'universal' || m.conversionSource === 'custom')) {
      note = `<div class="done-conversion-note done-conversion-note--ok">自动换算后扣减 ${esc(String(m.convertedNeeded))}${m.inventoryUnit ? ' ' + esc(m.inventoryUnit) : ''}</div>`;
    } else if (m.status === 'unparsed-recipe') {
      note = '<div class="done-conversion-note done-conversion-note--warn">菜谱用量无法量化，请填写剩余量，或选择本次保持不变</div>';
    } else if (m.status === 'ambiguous-recipe') {
      note = '<div class="done-conversion-note done-conversion-note--warn">菜谱使用了区间或模糊数量，请手动确认做完后的剩余库存</div>';
    } else if (m.status === 'unparsed-inventory') {
      note = '<div class="done-conversion-note done-conversion-note--warn">当前库存数量无法计算，请手动填写做完后的剩余量</div>';
    } else if (m.status === 'needs-conversion') {
      const prompt = m.conversionPrompt || {};
      const canSave = prompt.fromUnit && prompt.toUnit;
      note = `
        <div class="done-conversion-note done-conversion-note--warn">“${esc(m.neededUnit || '无单位')}”无法自动换算为“${esc(m.inventoryUnit || '无单位')}”，请确认剩余库存</div>
        ${canSave ? `<div class="done-conversion-setup">
          <span>记住换算：1 ${esc(prompt.fromUnit)} =</span>
          <input type="number" class="done-conversion-factor" min="0" step="any" placeholder="换算值">
          <span>${esc(prompt.toUnit)}</span>
          <button type="button" class="btn btn-xs" data-save-conversion>保存并计算</button>
        </div>` : ''}`;
    }
    if (m.insufficient) {
      note += '<div class="done-conversion-note done-conversion-note--warn">菜谱合计用量超过当前库存，默认扣至 0；请按实际剩余量调整后确认。</div>';
    }
    const needsReview = m.status !== 'ready';
    const stockText = `${m.inventoryAmount}${m.inventoryUnit ? ' ' + m.inventoryUnit : ''}`;
    const remainingText = needsReview ? '待确认' : `${m.remaining}${m.inventoryUnit ? ' ' + m.inventoryUnit : ''}`;
    return `
    <details class="done-item" data-name="${escAttr(m.name)}" data-inventory-id="${escAttr(m.inventoryId)}" ${needsReview || m.insufficient ? 'open' : ''}>
      <summary class="cook-line"><strong>${esc(m.name)}</strong><span class="cook-balance"><span>${esc(stockText)}</span><span aria-hidden="true">→</span><strong class="cook-remaining-preview">${esc(remainingText)}</strong></span><span class="cook-edit-caption"></span></summary>
      <div class="cook-adjust-body">
        <p class="cook-recipe-amount">菜谱合计需要 ${esc(m.recipeAmount || '—')}</p>
        ${note}
        <div class="done-item-edit">
          <label class="done-field"><span>当前库存</span><span class="done-stock-val">${esc(stockText)}</span></label>
          <label class="done-field"><span>用完剩余</span><span class="inv-row"><input type="text" inputmode="decimal" class="done-remaining" value="${escAttr(needsReview ? '' : m.remaining)}" placeholder="${needsReview ? '请填写剩余量' : '剩余'}"><input type="text" class="done-unit" value="${escAttr(m.inventoryUnit || '')}" placeholder="单位" aria-label="${escAttr(m.name)}的剩余单位"></span></label>
          <label class="done-field cook-action-field"><span>本次怎么处理</span><select class="done-action"><option value="deduct">按实际剩余量更新</option><option value="skip">本次保持库存不变</option><option value="remove">已经用完，移除库存</option></select></label>
          <input type="checkbox" class="done-remove-check" hidden><input type="checkbox" class="done-skip-check" hidden>
        </div>
      </div>
    </details>`;
  }).join('');
  if (!itemsHtml) itemsHtml = '<p class="prep-empty-text">没有需要扣减的库存，确认后只记录本次做菜。</p>';
  const missing = [...new Set(preview.items.filter(item => !item.inventoryId).map(item => item.name))];
  const missingHtml = missing.length ? `<div class="done-conversion-note done-conversion-note--warn">未找到库存：${esc(missing.join('、'))}。这些食材只记录做菜，不扣减库存。</div>` : '';
  const pantryHtml = pantryItems.length ? `<div class="done-conversion-note done-conversion-note--ok">常备调料 ${esc(pantryItems.map(item => item.name).join('、'))} 本次不扣减。</div>` : '';
  overlay.innerHTML = `
    <div class="modal cook-dialog">
      <div class="modal-header"><div class="cook-dialog-heading">${iconSvg('cook')}<div><span class="meal-eyebrow">完成这顿饭</span><h2 id="cookDialogTitle">${esc(title)}</h2></div></div><button type="button" class="btn-icon modal-close" id="doneClose" aria-label="关闭做菜确认">${iconSvg('xmark')}</button></div>
      <div class="modal-body">
        <p class="cook-intro">${batch ? `${esc(recipes.map(recipe => recipe.name).join('、'))}。同一食材已合并计算。` : '按菜谱用量计算，点击食材可调整。'}<br>看看剩余量是否合适，再记下这顿饭。</p>
        ${missingHtml}${pantryHtml}
        ${matched.length ? '<div class="cook-list-labels"><span>食材</span><span>当前库存 → 做完剩余</span></div>' : ''}<div class="done-list">${itemsHtml}</div>
        <details class="cook-notes"><summary>给这顿饭留句备注 <span>可选${batch ? ' · 用于每道菜' : ''}</span></summary><label class="done-cook-notes"><span class="sr-only">这次做菜的备注</span><textarea id="doneNotes" rows="3" maxlength="1000" placeholder="例如：少放一点盐更合适，下次再试试"></textarea></label></details>
        <div class="cook-error" id="cookError" hidden role="alert"><span></span><button type="button" class="btn btn-sm" id="doneRefresh">重新计算</button></div>
      </div>
      <div class="cook-dialog-footer"><span class="cook-feedback" role="status"></span><div><button type="button" class="btn" id="doneCancel">再看看</button><button type="button" class="btn btn-primary" id="doneConfirm">${batch ? '确认全部做完' : '确认做完'}</button></div></div>
    </div>`;
  const prevFocus = document.activeElement;
  document.body.appendChild(overlay);
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'cookDialogTitle');
  requestAnimationFrame(() => {
    const first = overlay.querySelector('button:not([disabled]), input:not([disabled])');
    if (first) first.focus();
  });

  let busy = false;
  function updateFeedback() {
    const unresolved = [...overlay.querySelectorAll('.done-item')].filter(row => {
      return !row.querySelector('.done-remove-check').checked && !row.querySelector('.done-skip-check').checked && !row.querySelector('.done-remaining').value.trim();
    });
    const feedback = overlay.querySelector('.cook-feedback');
    feedback.textContent = unresolved.length ? `还有 ${unresolved.length} 项需要确认` : '余量已确认，准备记下这顿饭';
    feedback.classList.toggle('needs-review', unresolved.length > 0);
  }
  function syncRow(row) {
    const remove = row.querySelector('.done-remove-check').checked;
    const skip = row.querySelector('.done-skip-check').checked;
    const remaining = row.querySelector('.done-remaining').value.trim();
    const unit = row.querySelector('.done-unit').value.trim();
    row.querySelector('.done-action').value = remove ? 'remove' : skip ? 'skip' : 'deduct';
    row.querySelectorAll('.done-remaining, .done-unit, .done-conversion-factor, [data-save-conversion]').forEach(el => { el.disabled = remove || skip; });
    row.querySelector('.cook-remaining-preview').textContent = remove ? '已用完' : skip ? '不扣减' : remaining ? `${remaining}${unit ? ' ' + unit : ''}` : '待确认';
    updateFeedback();
  }
  function setBusy(value) {
    busy = value;
    overlay.querySelectorAll('button, input, textarea, select').forEach(el => { el.disabled = value; });
    if (!value) overlay.querySelectorAll('.done-item').forEach(syncRow);
  }
  overlay.querySelectorAll('.done-item').forEach(row => {
    row.addEventListener('input', event => {
      if (event.target.matches('.done-remaining, .done-unit')) { row.dataset.edited = '1'; syncRow(row); }
    });
    row.querySelector('.done-action').addEventListener('change', event => {
      row.querySelector('.done-remove-check').checked = event.target.value === 'remove';
      row.querySelector('.done-skip-check').checked = event.target.value === 'skip';
      row.dataset.edited = '1';
      syncRow(row);
    });
  });
  updateFeedback();
  function collectDraft() {
    return {
      notes: overlay.querySelector('#doneNotes').value,
      rows: [...overlay.querySelectorAll('.done-item[data-edited]')].map(row => ({
        id: row.dataset.inventoryId,
        version: matched.find(item => item.inventoryId === row.dataset.inventoryId)?.inventoryVersion,
        remaining: row.querySelector('.done-remaining').value,
        unit: row.querySelector('.done-unit').value,
        remove: row.querySelector('.done-remove-check').checked,
        skip: row.querySelector('.done-skip-check').checked,
      })).filter(row => row.remove || row.skip || row.remaining.trim()),
    };
  }
  if (draft) {
    overlay.querySelector('#doneNotes').value = draft.notes;
    if (draft.notes) overlay.querySelector('.cook-notes').open = true;
    overlay.querySelectorAll('.done-item').forEach(row => {
      const saved = draft.rows.find(item => item.id === row.dataset.inventoryId && item.version === matched.find(entry => entry.inventoryId === item.id)?.inventoryVersion);
      if (!saved) return;
      row.querySelector('.done-remaining').value = saved.remaining;
      row.querySelector('.done-unit').value = saved.unit;
      row.querySelector('.done-remove-check').checked = saved.remove;
      row.querySelector('.done-skip-check').checked = saved.skip;
      row.dataset.edited = '1';
      row.open = true;
      syncRow(row);
    });
  }

  overlay.querySelectorAll('[data-save-conversion]').forEach(button => {
    button.addEventListener('click', async () => {
      const row = button.closest('.done-item');
      const item = matched.find(entry => entry.inventoryId === row.dataset.inventoryId && entry.name === row.dataset.name);
      const factor = Number(row.querySelector('.done-conversion-factor').value);
      if (!item?.conversionPrompt || !Number.isFinite(factor) || factor <= 0) {
        showToast('请输入大于 0 的换算值', 'error');
        return;
      }
      if (busy) return;
      const savedDraft = collectDraft();
      setBusy(true);
      try {
        await apiFetch(cookPath('/api/unit-conversions'), {
          method: 'POST',
          body: {
            ingredientName: item.conversionIngredientName || item.name,
            fromUnit: item.conversionPrompt.fromUnit,
            toUnit: item.conversionPrompt.toUnit,
            factor,
          }
        });
        showToast(`已记住 ${item.name} 的单位换算`, 'success');
        menuReadinessCache = null;
        if (currentTab === 'menu') renderMenu();
        setBusy(false);
        close();
        if (currentScope === dialogScope) await showCookDoneDialog(recipeId, null, savedDraft);
      } catch (err) {
        setBusy(false);
        showDialogError('保存换算失败: ' + err.message);
      }
    });
  });

  const close = () => {
    if (busy) return;
    cookingDialogOpen = false;
    overlay.remove();
    if (prevFocus && document.contains(prevFocus) && typeof prevFocus.focus === 'function') prevFocus.focus();
  };
  function showDialogError(message) {
    const error = overlay.querySelector('#cookError');
    error.querySelector('span').textContent = message;
    error.hidden = false;
    error.scrollIntoView({ block: 'nearest' });
  }
  overlay.querySelector('#doneRefresh').onclick = async () => {
    if (busy) return;
    const saved = collectDraft();
    if (currentScope !== dialogScope) { close(); return; }
    setBusy(true);
    try {
      await fetchAllData();
      setBusy(false);
      close();
      if (currentScope !== dialogScope) return;
      const refreshedIds = batch ? [...getData().todayMenu] : recipeId;
      renderCurrentTab();
      if (batch && !refreshedIds.length) { showToast('今日菜单已经处理完成', 'info'); return; }
      await showCookDoneDialog(refreshedIds, null, saved);
    } catch (error) {
      setBusy(false);
      showDialogError('重新计算失败: ' + error.message);
    }
  };
  overlay.querySelector('#doneClose').onclick = close;
  overlay.querySelector('#doneCancel').onclick = close;
  overlay.querySelector('#doneConfirm').onclick = async () => {
    if (busy) return;
    if (currentScope !== dialogScope) { close(); showToast('范围已切换，请重新确认', 'error'); return; }
    const deductions = [];
    for (const row of overlay.querySelectorAll('.done-item')) {
      const item = matched.find(entry => entry.inventoryId === row.dataset.inventoryId);
      const remove = row.querySelector('.done-remove-check').checked;
      const skip = row.querySelector('.done-skip-check').checked;
      const remaining = row.querySelector('.done-remaining').value.trim();
      if (!remove && !skip && !remaining) {
        row.open = true;
        row.querySelector('.done-remaining').focus();
        showDialogError(`请填写“${item.name}”的剩余量，或选择本次保持库存不变。`);
        return;
      }
      deductions.push({
        name: item.name, inventoryId: item.inventoryId, inventoryVersion: item.inventoryVersion,
        remove, remaining: skip ? '' : remaining, unit: row.querySelector('.done-unit').value.trim(),
      });
    }
    overlay.querySelector('#cookError').hidden = true;
    setBusy(true);
    try {
      await apiFetch(cookPath(endpoint), { method: 'POST', body: {
        ...requestBody, snapshot: preview.snapshot, deductions, notes: overlay.querySelector('#doneNotes').value.trim(),
      } });
    } catch (error) {
      setBusy(false);
      showDialogError(error.message);
      return;
    }
    setBusy(false);
    close();
    try {
      await refreshCookData(d);
      renderCurrentTab();
      updateStats();
      showToast(`✓ ${title}已完成，库存已更新`, 'success');
    } catch (error) {
      showToast('做菜记录已保存，但页面刷新失败，请刷新页面查看，勿重复提交', 'error');
    }
  };
}

// ===== Utility =====
function esc(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

// ===== Today Menu =====
let menuReadinessCache = null;
function menuReadinessKey(d) {
  return JSON.stringify([currentScope, d.todayMenu, d.recipes, d.inventory, d.unitConversions]);
}
function ensureMenuReadiness(d) {
  const key = menuReadinessKey(d);
  if (menuReadinessCache?.key === key) return;
  menuReadinessCache = { key, plan: null, failed: false };
  apiFetch(scoped('/api/cook-batch/preview'), { method: 'POST', body: { recipeIds: [...d.todayMenu] } })
    .then(plan => {
      if (menuReadinessCache?.key !== key) return;
      if (!Array.isArray(plan?.items)) throw new Error("Invalid menu plan");
      menuReadinessCache.plan = plan;
      if (currentTab === 'menu' && menuReadinessKey(getData()) === key) renderMenu();
    })
    .catch(() => {
      if (menuReadinessCache?.key !== key) return;
      menuReadinessCache.failed = true;
      if (currentTab === 'menu' && menuReadinessKey(getData()) === key) renderMenu();
    });
}

function renderMenu() {
  const d = getData();
  const menuIds = d.todayMenu || [];
  const menuRecipes = menuIds.map(id => d.recipes.find(recipe => recipe.id === id)).filter(Boolean);
  const empty = document.getElementById('menuEmpty');
  const listDiv = document.getElementById('menuRecipeList');
  const shopDiv = document.getElementById('menuShoppingList');
  const preparedExpanded = shopDiv.querySelector('.prepared-list')?.open || false;
  document.getElementById('menuDate').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  document.getElementById('menuRecipeCount').textContent = menuIds.length ? `${menuIds.length} 道菜，刚刚好` : '';
  document.getElementById('btnClearMenu').style.display = menuIds.length ? '' : 'none';
  document.getElementById('btnCookAll').style.display = menuIds.length ? '' : 'none';
  if (!menuIds.length) {
    empty.style.display = 'block';
    listDiv.innerHTML = '';
    shopDiv.innerHTML = `<div class="prep-note prep-note--empty"><span class="meal-eyebrow">备料清单</span><h3>选好菜，就知道要买什么</h3><p>这里会按菜单合并食材，并核对家中的库存。</p><div class="prep-note-rule"></div><p class="prep-note-tip">先看看家里有什么，也许今晚的灵感就在那里。</p></div>`;
    return;
  }
  ensureMenuReadiness(d);
  empty.style.display = 'none';
  listDiv.innerHTML = `<div class="meal-dishes">${menuRecipes.map(recipe => {
    const lastCooked = recipe.cookedDates?.length ? `上次 ${formatRelativeDate(new Date(recipe.cookedDates.at(-1)))}` : '第一次尝试';
    return `<article class="meal-dish recipe-card" data-id="${escAttr(recipe.id)}">
      <div class="dish-mark" style="--dish-hue:${stringHue(recipe.name)}" aria-hidden="true">${I.cook}</div>
      <div class="dish-copy"><button type="button" class="dish-title" data-menu-view="${escAttr(recipe.id)}">${esc(recipe.name)}</button>
        <div class="dish-tags">${recipe.tags.slice(0, 2).map(tag => `<span>${esc(tag)}</span>`).join('')}</div>
        <p class="dish-meta">${recipe.ingredients.length} 种食材 <span>·</span> ${recipe.steps.length} 步 <span>·</span> ${esc(lastCooked)}</p>
      </div>
      <div class="dish-actions"><button type="button" class="btn btn-sm dish-cook" data-menu-cook="${escAttr(recipe.id)}">${iconSvg('cook', 'icon-sm')} 做完了</button>
        <button type="button" class="dish-remove" data-menu-remove="${escAttr(recipe.id)}" aria-label="将${escAttr(recipe.name)}移出菜单" title="移出菜单">${iconSvg('xmark', 'icon-sm')}</button>
      </div>
    </article>`;
  }).join('')}</div><button type="button" class="meal-add-row" data-tab-go="recipes">${iconSvg('plus', 'icon-sm')} 再添一道喜欢的菜</button>`;

  const grouped = new Map();
  menuRecipes.forEach(recipe => recipe.ingredients.filter(ingredient => !ingredient.optional).forEach(ingredient => {
    const key = normalizeIngredientName(ingredient.name);
    if (!grouped.has(key)) grouped.set(key, { name: ingredient.name, recipes: [], amounts: [] });
    const item = grouped.get(key);
    item.recipes.push(recipe.name);
    item.amounts.push(ingredient.amount || '适量');
  }));
  const plan = menuReadinessCache?.plan;
  const failed = menuReadinessCache?.failed;
  const items = [...grouped.values()].map(item => ({ ...item, readiness: ingredientReadiness(item.name, plan, failed) }));
  const prepared = items.filter(item => ['ready', 'pantry'].includes(item.readiness.status));
  const rank = { missing: 0, short: 1, review: 2, checking: 3 };
  const attention = items.filter(item => !['ready', 'pantry'].includes(item.readiness.status))
    .sort((a, b) => rank[a.readiness.status] - rank[b.readiness.status]);
  const purchaseCount = items.filter(item => ['missing', 'short'].includes(item.readiness.status)).length;
  const reviewCount = items.filter(item => item.readiness.status === 'review').length;
  const renderItem = item => {
    const { status, label, detail, inventoryId } = item.readiness;
    const inv = d.inventory.find(entry => entry.id === inventoryId) || findInventoryItem(item.name, d.inventory);
    return `<div class="prep-item prep-item--${status}"><div class="prep-item-heading"><strong>${esc(item.name)}</strong><span class="prep-status prep-status--${status}">${esc(label)}</span></div>
      <p class="prep-item-detail">${esc(detail)}</p>
      <div class="prep-item-bottom"><span>${esc(item.amounts.join(' + '))}</span>${status === 'missing' ? `<button type="button" class="prep-inline-action" data-quick-add="${escAttr(item.name)}">入库 ${iconSvg('plus', 'icon-sm')}</button>` : status === 'short' && inv ? `<button type="button" class="prep-inline-action" data-stock-edit="${escAttr(inv.id)}">更新库存</button>` : ''}</div>
      <details class="prep-sources"><summary>用于 ${esc([...new Set(item.recipes)].join('、'))}</summary><p>${item.recipes.map((name, i) => `${esc(name)}：${esc(item.amounts[i])}`).join('<br>')}</p></details>
    </div>`;
  };
  shopDiv.innerHTML = `<div class="prep-note"><div class="prep-heading"><div><span class="meal-eyebrow">下厨之前</span><h3>备料清单</h3></div><span class="prep-total">${items.length} 项食材</span></div>
    <div class="prep-summary" role="status">${!plan && !failed ? '正在按合计用量核对库存…' : failed ? '暂时无法核对库存' : purchaseCount || reviewCount ? `${purchaseCount ? `${purchaseCount} 项待采购` : ''}${purchaseCount && reviewCount ? ' · ' : ''}${reviewCount ? `${reviewCount} 项待确认` : ''}` : '食材已备齐，可以安心下厨了'}</div>
    ${failed ? '<button type="button" class="prep-inline-action" data-menu-recheck>重新核对</button>' : ''}
    <div class="prep-attention">${attention.map(renderItem).join('')}</div>
    ${prepared.length ? `<details class="prepared-list" ${preparedExpanded ? 'open' : ''}><summary><span>${iconSvg('check', 'icon-sm')} 已备齐 ${prepared.length} 项</span><span class="prep-disclosure" aria-hidden="true"></span></summary><div>${prepared.map(renderItem).join('')}</div></details>` : ''}
    ${!items.length ? '<p class="prep-empty-text">这些菜没有需要准备的必选食材。</p>' : ''}
    <div class="prep-note-rule"></div><div class="prep-footer"><span>带上清单，再去采购</span><div><button type="button" class="btn btn-xs" data-shop-copy>复制清单</button><button type="button" class="btn btn-xs" data-shop-image>存为图片</button></div></div>
  </div>`;
}

function buildShoppingPayload() {
  const d = getData();
  const menuRecipes = (d.todayMenu || []).map(id => d.recipes.find(r => r.id === id)).filter(Boolean);
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
  const decorate = (item) => ({
    ...item,
    inv: findInventoryItem(item.name, d.inventory),
    readiness: ingredientReadiness(item.name, menuReadinessCache?.key === menuReadinessKey(d) ? menuReadinessCache.plan : null, menuReadinessCache?.failed),
  });
  const sortByStock = (a, b) => Number(['ready', 'pantry'].includes(a.readiness.status)) - Number(['ready', 'pantry'].includes(b.readiness.status)); // need first
  const main = Object.values(neededMain).map(decorate).sort(sortByStock);
  const seas = Object.values(neededSeas).map(decorate).sort(sortByStock);
  return { main, seas, menuNames: menuRecipes.map(r => r.name) };
}

function formatShoppingText() {
  const { main, seas, menuNames } = buildShoppingPayload();
  const lines = [];
  const today = new Date().toISOString().slice(0, 10);
  lines.push(`🛒 采购清单 · ${today}`);
  if (menuNames.length) lines.push(`菜单: ${menuNames.join('、')}`);
  lines.push('');

  const section = (title, items) => {
    if (!items.length) return;
    lines.push(title);
    items.forEach(item => {
      lines.push(`  · ${item.name} [${item.readiness.label}] ${item.readiness.detail}`);
      lines.push(`    菜谱用量：${item.amounts.join(' + ')}`);
    });
    lines.push('');
  };
  section('主料:', main);
  if (seas.length) section('调料:', seas);
  return lines.join('\n').trim();
}

async function copyShoppingAsText() {
  const text = formatShoppingText();
  if (!text) { showToast('清单为空', 'info'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
  } catch {
    // Fallback: create textarea, select, execCommand
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('已复制到剪贴板', 'success'); }
    catch { showToast('复制失败，请手动选择文本', 'error'); }
    ta.remove();
  }
}

function exportShoppingAsImage() {
  const { main, seas, menuNames } = buildShoppingPayload();
  if (!main.length && !seas.length) { showToast('清单为空', 'info'); return; }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const width = 560, pad = 32;
  const family = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  const blocks = [];
  function block(text, size = 14, color = '#4c6356', weight = 400, gap = 8) {
    const font = `${weight} ${size}px ${family}`;
    ctx.font = font;
    const lines = [];
    let line = '';
    for (const char of text) {
      if (line && ctx.measureText(line + char).width > width - pad * 2) { lines.push(line); line = ''; }
      line += char;
    }
    if (line) lines.push(line);
    blocks.push({ font, lines, color, lineHeight: size * 1.7, gap });
  }
  const date = localDateKey(new Date());
  block('知食分子 / 备料清单', 23, '#203c30', 600, 5);
  block(date, 12, '#66796d', 400, 12);
  if (menuNames.length) block(`这餐准备做：${menuNames.join('、')}`, 13, '#4c6356', 400, 20);
  for (const [title, items] of [['主料', main], ['调料', seas]]) {
    if (!items.length) continue;
    block(title, 16, '#356c50', 600, 12);
    for (const item of items) {
      const color = ['missing', 'short'].includes(item.readiness.status) ? '#855717' : '#203c30';
      block(`${item.name}  ·  ${item.readiness.label}`, 15, color, 600, 2);
      block(item.readiness.detail, 13, '#4c6356', 400, 2);
      block(`菜谱用量：${item.amounts.join(' + ')}`, 12, '#66796d', 400, 16);
    }
  }
  block('把想吃的安排好，再慢慢做一顿饭。', 12, '#66796d', 400, 0);
  const height = Math.ceil(pad * 2 + blocks.reduce((total, item) => total + item.lines.length * item.lineHeight + item.gap, 0));
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#fbfcf5'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#8b9b70'; ctx.fillRect(0, 0, width, 5);
  let y = pad;
  for (const item of blocks) {
    ctx.font = item.font; ctx.fillStyle = item.color;
    for (const line of item.lines) { y += item.lineHeight; ctx.fillText(line, pad, y); }
    y += item.gap;
  }
  canvas.toBlob(blob => {
    if (!blob) { showToast('生成失败，请重试', 'error'); return; }
    downloadBlob(blob, `备料清单-${date}.png`);
    showToast('备料清单已生成', 'success');
  }, 'image/png');
}

// ===== Recipe Sync =====
async function syncRecipe(recipeId) {
  const to = currentScope === 'family' ? 'personal' : 'family';
  const label = to === 'family' ? '家庭' : '个人';
  try {
    const result = await apiFetch(`/api/recipes/${recipeId}/sync`, { method: 'POST', body: { to } });
    showToast(result.updated ? `已覆盖${label}中的同名菜谱` : `已同步到${label}`, 'success');
  } catch (err) { showToast('同步失败: ' + err.message, 'error'); }
}

document.getElementById('btnSyncAll').addEventListener('click', async (e) => {
  const from = currentScope;
  const to = from === 'personal' ? 'family' : 'personal';
  const label = to === 'family' ? '家庭' : '个人';
  if (!await customConfirm({ title: '同步全部菜谱', message: `将所有菜谱从${from === 'personal' ? '个人' : '家庭'}同步到${label}。已存在同名菜谱将被覆盖更新。`, confirmText: '开始同步', type: 'info' })) return;
  await withLoading(e.currentTarget, async () => {
    try {
      const result = await apiFetch('/api/sync-all', { method: 'POST', body: { from, to } });
      showToast(`同步完成: ${result.synced} 份新增，${result.updated || 0} 份已覆盖`, 'success');
      if (to === currentScope) { await fetchAllData(); renderCurrentTab(); updateStats(); }
    } catch (err) { showToast('同步失败: ' + err.message, 'error'); }
  });
});

// ===== Init =====
async function init() {
  // Auth check
  const token = getToken();
  if (!token) { window.location.href = '/login.html'; return; }

  try {
    const { user } = await apiFetch('/api/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
      withLoading(syncBtn, () => syncRecipe(syncBtn.dataset.syncRecipe));
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

  document.getElementById('invBanner').addEventListener('click', (e) => {
    const lowNameBtn = e.target.closest('[data-lowstock-name]');
    if (lowNameBtn) { openInventoryModal(lowNameBtn.dataset.lowstockName); return; }
    const dismissBtn = e.target.closest('[data-lowstock-dismiss]');
    if (dismissBtn) {
      const banner = dismissBtn.closest('.low-stock-banner');
      const ids = banner?.dataset.ids || '';
      if (ids) sessionStorage.setItem('knowingre_low_dismissed', ids);
      banner?.remove();
      return;
    }
  });

  // Inventory search + category filter
  document.getElementById('invSearch').addEventListener('input', (e) => {
    invSearchText = e.target.value;
    renderInventory();
  });
  document.getElementById('invFilterChips').addEventListener('click', (e) => {
    const seasoningToggle = e.target.closest('[data-inv-seasonings-toggle]');
    if (seasoningToggle) {
      showInventorySeasonings = !showInventorySeasonings;
      localStorage.setItem(INVENTORY_SEASONING_VISIBILITY_KEY, showInventorySeasonings ? '1' : '0');
      if (!showInventorySeasonings && invFilterCategory === '调料') invFilterCategory = 'all';
      renderInventory();
      return;
    }
    const chip = e.target.closest('[data-inv-filter]');
    if (!chip) return;
    invFilterCategory = chip.dataset.invFilter;
    renderInventory();
  });

  document.getElementById('matchableRecipes').addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-menu-add]');
    if (addBtn) {
      const id = addBtn.dataset.menuAdd;
      const d = getData();
      if (d.todayMenu.includes(id)) { showToast('已在菜单中', 'info'); return; }
      await withLoading(addBtn, async () => {
        await apiFetch(scoped(`/api/menu/${id}`), { method: 'POST' });
        d.todayMenu.push(id);
        renderInventory();
        updateStats();
      });
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
      await withLoading(addBtn, async () => {
        await apiFetch(scoped(`/api/menu/${id}`), { method: 'POST' });
        d.todayMenu.push(id);
        renderRecipes();
        if (currentTab === 'menu') renderMenu();
        updateStats();
      });
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
    const navigate = e.target.closest('[data-tab-go]');
    if (navigate) { document.querySelector(`.tab[data-tab="${navigate.dataset.tabGo}"]`).click(); return; }
    const view = e.target.closest('[data-menu-view]');
    if (view) { openRecipeModal(view.dataset.menuView); return; }
    const edit = e.target.closest('[data-stock-edit]');
    if (edit) { openInventoryModal(edit.dataset.stockEdit); return; }
    const recheck = e.target.closest('[data-menu-recheck]');
    if (recheck) {
      try { await withLoading(recheck, async () => { await fetchAllData(); menuReadinessCache = null; renderCurrentTab(); }); }
      catch (error) { showToast('核对失败: ' + error.message, 'error'); }
      return;
    }
    if (e.target.closest('[data-shop-copy]')) { copyShoppingAsText(); return; }
    if (e.target.closest('[data-shop-image]')) { exportShoppingAsImage(); return; }
    const rmBtn = e.target.closest('[data-menu-remove]');
    if (rmBtn) {
      const d = getData();
      await apiFetch(scoped(`/api/menu/${rmBtn.dataset.menuRemove}`), { method: 'DELETE' });
      d.todayMenu = d.todayMenu.filter(id => id !== rmBtn.dataset.menuRemove);
      renderMenu();
      updateStats();
      return;
    }
    const adjustBtn = e.target.closest('[data-menu-cook-adjust]');
    if (adjustBtn) {
      showCookDoneDialog(adjustBtn.dataset.menuCookAdjust);
      return;
    }
    const cookBtn = e.target.closest('[data-menu-cook]');
    if (cookBtn) {
      await quickCook(cookBtn.dataset.menuCook);
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
    // Click recipe card to view detail
    const card = e.target.closest('.recipe-card');
    if (card && !e.target.closest('button')) {
      openRecipeModal(card.dataset.id);
      return;
    }
  });

  // Preview and commit the whole menu together, with one remaining amount per stock.
  document.getElementById('btnCookAll').addEventListener('click', async (event) => {
    const recipeIds = [...getData().todayMenu];
    if (!recipeIds.length || cookingDialogOpen) return;
    await withLoading(event.currentTarget, () => showCookDoneDialog(recipeIds));
  });

  // Clear menu
  document.getElementById('btnClearMenu').addEventListener('click', async () => {
    if (!await customConfirm({ title: '清空今日菜单', message: '将移除所有已添加的菜品，库存不受影响。', confirmText: '清空', type: 'warning' })) return;
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
  setupModalKeyboard();
}

// Focus management + Esc close for all modal-overlay elements
function setupModalKeyboard() {
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const observer = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.attributeName !== 'hidden') return;
      const el = m.target;
      if (el.hidden) {
        const saved = el._savedFocus;
        if (saved && document.contains(saved) && typeof saved.focus === 'function') saved.focus();
        el._savedFocus = null;
      } else {
        el._savedFocus = document.activeElement;
        requestAnimationFrame(() => {
          const first = el.querySelector(FOCUSABLE);
          if (first) first.focus();
        });
      }
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(m => {
    observer.observe(m, { attributes: true, attributeFilter: ['hidden'] });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Topmost visible modal — last one in DOM order that isn't hidden
    const visible = [...document.querySelectorAll('.modal-overlay')].filter(m => !m.hidden);
    const top = visible[visible.length - 1];
    if (!top) return;
    e.preventDefault();
    const closeBtn = top.querySelector('.modal-close, [data-modal-close], [data-confirm-cancel]');
    if (closeBtn) closeBtn.click();
    else top.remove(); // Dynamic overlays without named close
  });
}

init();

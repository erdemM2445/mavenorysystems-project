const CFG = window.MAVENORY_CONFIG || {};
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const money = (n) => `${state.settings?.currency || CFG.CURRENCY || 'USD'} ${Number(n || 0).toFixed(2)}`;
const pct = (n) => `${Math.round(Number(n || 0) * 100)}%`;
const num = (n, d = 2) => Number(n || 0).toFixed(d);
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

let client = null;
let authMode = 'signin';
let currentView = 'dashboard';
let state = {
  session: null,
  user: null,
  profile: null,
  settings: null,
  products: [],
  sales: [],
  priceChanges: []
};

const defaultSettings = {
  workspace_name: 'Mavenory Systems Workspace', currency: CFG.CURRENCY || 'USD', listing_fee: .20,
  transaction_fee: .065, payment_rate: .03, payment_fixed_fee: .25, min_profit_hour: 15,
  min_net_margin: .20, default_service_z: 1.65, low_sales_threshold: 3,
  high_return_threshold: .15, default_price_increase: .10
};

function isConfigured(){
  return CFG.SUPABASE_URL && CFG.SUPABASE_PUBLISHABLE_KEY &&
    !CFG.SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
    !CFG.SUPABASE_PUBLISHABLE_KEY.includes('REPLACE_ME') &&
    !CFG.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret');
}

function toast(message, kind = 'info'){
  const box = $('#toast');
  box.textContent = message;
  box.className = `toast ${kind === 'error' ? 'danger-note' : kind === 'success' ? 'success-note' : ''}`;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 4200);
}

function setAuthMode(mode){
  authMode = mode;
  $('#tabSignIn').classList.toggle('active', mode === 'signin');
  $('#tabSignUp').classList.toggle('active', mode === 'signup');
  $('#workspaceNameField').classList.toggle('hidden', mode !== 'signup');
  $('#workspaceBreak').classList.toggle('hidden', mode !== 'signup');
  $('#authSubmit').textContent = mode === 'signin' ? 'Sign in' : 'Create free workspace';
  $('#authHint').textContent = mode === 'signin' ? 'New users can switch to Create free workspace.' : 'Free Starter unlocks every module for up to 3 products.';
}

function initClient(){
  if(!isConfigured()){
    $('#setupWarning').classList.remove('hidden');
    $('#setupWarning').innerHTML = 'Setup needed: open <b>config.js</b> and replace SUPABASE_URL plus SUPABASE_PUBLISHABLE_KEY. Never paste sb_secret/service_role keys here.';
    return false;
  }
  client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return true;
}

async function boot(){
  $$('[data-auth-tab]').forEach(b => b.addEventListener('click', () => setAuthMode(b.dataset.authTab)));
  $('#authSubmit').addEventListener('click', submitAuth);
  $('#signOutBtn').addEventListener('click', signOut);
  $('#refreshBtn').addEventListener('click', loadAll);
  $('#seedBtn').addEventListener('click', seedSampleData);
  $('#upgradeBtn').addEventListener('click', startCheckout);
  $('#sideNav').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if(!btn) return;
    currentView = btn.dataset.view;
    $$('#sideNav button').forEach(x => x.classList.toggle('active', x === btn));
    render();
  });

  if(!initClient()) return;
  const { data } = await client.auth.getSession();
  if(data?.session){
    state.session = data.session; state.user = data.session.user;
    await loadAll();
  }
  client.auth.onAuthStateChange(async (_event, session) => {
    state.session = session; state.user = session?.user || null;
    if(session) await loadAll(); else showAuth();
  });
}

document.addEventListener('DOMContentLoaded', boot);

async function submitAuth(){
  if(!client) return toast('Supabase config is missing.', 'error');
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  const workspace = $('#authWorkspaceName').value.trim() || 'Mavenory Systems Workspace';
  if(!email || !password) return toast('Email and password are required.', 'error');
  $('#authSubmit').disabled = true;
  try{
    let result;
    if(authMode === 'signin'){
      result = await client.auth.signInWithPassword({ email, password });
    } else {
      result = await client.auth.signUp({ email, password, options: { data: { workspace_name: workspace, full_name: workspace } } });
    }
    if(result.error) throw result.error;
    if(result.data?.session){ state.session = result.data.session; state.user = result.data.user; await loadAll(); }
    else toast('Account created. Check your email if confirmation is enabled, then sign in.', 'success');
  }catch(err){ toast(err.message || 'Authentication failed.', 'error'); }
  finally{ $('#authSubmit').disabled = false; }
}

async function signOut(){
  await client.auth.signOut();
  showAuth();
}

function showAuth(){
  $('#authPage').classList.remove('hidden');
  $('#appShell').classList.add('hidden');
}
function showApp(){
  $('#authPage').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
}

async function loadAll(){
  if(!state.user) return showAuth();
  try{
    await ensureBaseRows();
    const [profile, settings, products, sales, priceChanges] = await Promise.all([
      client.from('profiles').select('*').eq('id', state.user.id).maybeSingle(),
      client.from('workspace_settings').select('*').eq('user_id', state.user.id).maybeSingle(),
      client.from('products').select('*').order('created_at', { ascending: true }),
      client.from('sales').select('*').order('sale_date', { ascending: false }),
      client.from('price_changes').select('*')
    ]);
    for(const res of [profile, settings, products, sales, priceChanges]) if(res.error) throw res.error;
    state.profile = profile.data || freeProfile();
    state.settings = settings.data || { ...defaultSettings, user_id: state.user.id };
    state.products = products.data || [];
    state.sales = sales.data || [];
    state.priceChanges = priceChanges.data || [];
    showApp();
    render();
    if(new URLSearchParams(location.search).get('payment') === 'success') toast('Payment received. If Full access is not visible yet, refresh in a few seconds.', 'success');
  }catch(err){ toast(err.message || 'Could not load workspace.', 'error'); }
}

function freeProfile(){
  return { id: state.user.id, email: state.user.email, plan: 'free', access_status: 'active', product_limit: 3, subscription_status: 'free_starter' };
}

async function ensureBaseRows(){
  const uid = state.user.id;
  await client.from('profiles').upsert({ id: uid, email: state.user.email, plan: 'free', access_status: 'active', product_limit: 3, subscription_status: 'free_starter' }, { onConflict: 'id', ignoreDuplicates: true });
  await client.from('workspace_settings').upsert({ user_id: uid, workspace_name: state.user.user_metadata?.workspace_name || 'Mavenory Systems Workspace' }, { onConflict: 'user_id', ignoreDuplicates: true });
}

function isFull(){ return state.profile?.plan === 'full' && ['active','past_due','cancelled'].includes(state.profile?.access_status || 'active'); }
function productLimit(){ return isFull() ? null : Number(state.profile?.product_limit || 3); }
function canAddProducts(count = 1){ const limit = productLimit(); return limit === null || state.products.length + count <= limit; }

function computations(){
  const s = { ...defaultSettings, ...state.settings };
  const sales30 = state.sales.filter(x => x.sale_date >= daysAgoIso(30));
  const bySku = Object.fromEntries(state.products.map(p => [p.sku, { units:0, revenue:0, refunds:0, ad:0 }]));
  for(const sale of sales30){
    if(!bySku[sale.sku]) bySku[sale.sku] = { units:0, revenue:0, refunds:0, ad:0 };
    bySku[sale.sku].units += Number(sale.units_sold || 0);
    bySku[sale.sku].revenue += Number(sale.revenue || 0);
    bySku[sale.sku].refunds += Number(sale.refunds || 0);
    bySku[sale.sku].ad += Number(sale.ad_spend || 0);
  }
  const changes = Object.fromEntries(state.priceChanges.map(x => [x.sku, Number(x.price_change_rate || s.default_price_increase || .1)]));
  const rows = state.products.map(p => {
    const price = Number(p.selling_price || 0);
    const fees = Number(s.listing_fee || 0) + price * Number(s.transaction_fee || 0) + price * Number(s.payment_rate || 0) + Number(s.payment_fixed_fee || 0);
    const costs = Number(p.material_cost||0)+Number(p.packaging_cost||0)+Number(p.shipping_cost||0)+Number(p.ad_spend_unit||0);
    const expectedReturnLoss = price * Number(p.return_rate || 0);
    const profitUnit = price - costs - fees - expectedReturnLoss;
    const margin = price ? profitUnit/price : 0;
    const laborHours = Math.max(Number(p.labor_minutes||0)/60, .001);
    const profitHour = profitUnit / laborHours;
    const sale = bySku[p.sku] || { units:0, revenue:0, refunds:0, ad:0 };
    const avgDaily = sale.units / 30;
    const z = Number(p.service_level_z || s.default_service_z || 1.65);
    const lead = Number(p.lead_time_days || 0);
    const safetyStock = z * Number(p.demand_std_dev_day || 0) * Math.sqrt(Math.max(lead, 0));
    const reorderPoint = avgDaily * lead + safetyStock;
    const daysUntilStockout = avgDaily > 0 ? Number(p.current_stock || 0) / avgDaily : 999;
    const suggestedOrder = Math.max(0, reorderPoint + avgDaily*14 - Number(p.current_stock || 0));
    const priceChange = changes[p.sku] ?? Number(s.default_price_increase || .1);
    const newPrice = price * (1 + priceChange);
    const newFees = Number(s.listing_fee || 0) + newPrice * Number(s.transaction_fee || 0) + newPrice * Number(s.payment_rate || 0) + Number(s.payment_fixed_fee || 0);
    const newProfit = newPrice - costs - newFees - (newPrice * Number(p.return_rate || 0));
    const newMargin = newPrice ? newProfit/newPrice : 0;
    const newProfitHour = newProfit/laborHours;
    let decision = 'Keep';
    if(Number(p.current_stock || 0) <= reorderPoint && avgDaily > 0) decision = 'Order Now';
    if(profitHour < Number(p.target_hourly_wage || s.min_profit_hour || 15) || margin < Number(s.min_net_margin || .2)) decision = 'Raise Price';
    if(profitHour < Number(p.target_hourly_wage || s.min_profit_hour || 15)*.55 || margin < 0.05) decision = 'Stop';
    if(sale.units > 0 && sale.units < Number(s.low_sales_threshold || 3)) decision = 'Test More';
    if(avgDaily > 0 && daysUntilStockout <= lead + 3) decision = 'Order Now';
    return { p, fees, costs, expectedReturnLoss, profitUnit, margin, laborHours, profitHour, sale, avgDaily, safetyStock, reorderPoint, daysUntilStockout, suggestedOrder, priceChange, newPrice, newProfit, newMargin, newProfitHour, decision };
  });
  const totals = rows.reduce((a, r) => {
    a.revenue += r.sale.revenue; a.units += r.sale.units; a.profit += r.profitUnit * r.sale.units; a.ad += r.sale.ad; return a;
  }, { revenue:0, units:0, profit:0, ad:0 });
  totals.avgMargin = totals.revenue ? totals.profit/totals.revenue : 0;
  totals.avgProfitHour = rows.length ? rows.reduce((a,r)=>a+r.profitHour,0)/rows.length : 0;
  return { rows, totals };
}

function render(){
  $('#workspaceLabel').textContent = state.settings?.workspace_name || 'Workspace';
  $('#planPill').textContent = isFull() ? `Full Planner • ${state.profile?.access_status || 'active'}` : `Free Starter • ${state.products.length}/${productLimit()} products`;
  $('#limitNotice').classList.toggle('hidden', isFull() || state.products.length < productLimit());
  $('#limitNotice').innerHTML = isFull() ? '' : `Free Starter limit: ${state.products.length}/${productLimit()} products. Upgrade to Full Planner for unlimited SKUs.`;
  const map = {
    dashboard:['Dashboard','Your weekly operating view.'], products:['Products','Add product costs, labor, inventory and SKU details.'], sales:['Sales Input','Paste or add sales rows from your shop exports.'], reorder:['Reorder Planner','Stockout risk, safety stock and suggested order quantity.'], pricing:['Pricing Simulator','Test price changes before editing your listings.'], report:['Weekly Report','Copy-ready action summary for your weekly review.'], settings:['Settings','Workspace assumptions, fee rates and decision thresholds.']
  };
  $('#viewTitle').textContent = map[currentView][0]; $('#viewSubtitle').textContent = map[currentView][1];
  const fn = { dashboard:renderDashboard, products:renderProducts, sales:renderSales, reorder:renderReorder, pricing:renderPricing, report:renderReport, settings:renderSettings }[currentView];
  $('#viewContainer').innerHTML = fn();
  bindViewEvents();
}

function decisionClass(d){
  if(d === 'Keep') return 'keep'; if(d === 'Order Now') return 'order'; if(d === 'Stop') return 'stop'; return 'raise';
}

function renderDashboard(){
  const { rows, totals } = computations();
  const orderNow = rows.filter(r=>r.decision==='Order Now').length;
  const weak = rows.filter(r=>['Raise Price','Stop'].includes(r.decision)).length;
  return `<div class="app-grid">
    <div class="stat"><span>30-day revenue</span><b>${money(totals.revenue)}</b></div>
    <div class="stat"><span>Estimated profit</span><b>${money(totals.profit)}</b></div>
    <div class="stat"><span>Avg margin</span><b>${pct(totals.avgMargin)}</b></div>
    <div class="stat"><span>Urgent actions</span><b>${orderNow + weak}</b></div>
  </div><br>
  <div class="row">
    <div class="panel col-8"><h3>Decision engine</h3>${productTable(rows)}</div>
    <div class="panel col-4"><h3>Priority list</h3>${priorityList(rows)}</div>
  </div>`;
}

function productTable(rows){
  if(!rows.length) return `<div class="empty">No products yet. Add products manually or reset sample data.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>SKU</th><th>Product</th><th>Profit/unit</th><th>Margin</th><th>Profit/hr</th><th>Stock</th><th>Decision</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="mono">${esc(r.p.sku)}</td><td>${esc(r.p.name)}</td><td>${money(r.profitUnit)}</td><td>${pct(r.margin)}</td><td>${money(r.profitHour)}</td><td>${num(r.p.current_stock,0)}</td><td><span class="tag ${decisionClass(r.decision)}">${r.decision}</span></td></tr>`).join('')}</tbody></table></div>`;
}

function priorityList(rows){
  const sorted = [...rows].sort((a,b)=>scoreDecision(b)-scoreDecision(a)).slice(0,6);
  if(!sorted.length) return `<div class="empty">Priority actions will appear after you add products.</div>`;
  return sorted.map(r=>`<div class="kpi" style="margin-bottom:10px"><b style="font-size:1rem">${esc(r.p.name)}</b><p class="small muted">${r.decision} • ${money(r.profitHour)}/hr • ${num(r.daysUntilStockout,1)} days stock</p><div class="bar"><span style="width:${Math.min(100, Math.max(8, scoreDecision(r)*20))}%"></span></div></div>`).join('');
}
function scoreDecision(r){ return r.decision==='Order Now'?5:r.decision==='Stop'?4:r.decision==='Raise Price'?3:r.decision==='Test More'?2:1; }

function renderProducts(){
  const { rows } = computations();
  return `<div class="row"><div class="panel col-12"><h3>Add product</h3>${productForm()}</div><div class="panel col-12"><h3>Product table</h3>${productTableWithActions(rows)}</div></div>`;
}
function productForm(){
  return `<form id="productForm" class="form-grid">
    ${field('sku','SKU','text','SKU-001')}${field('name','Product name','text','Minimalist Earrings')}${field('category','Category','text','Jewelry')}${field('variant','Variant','text','Gold')}
    ${field('selling_price','Selling price','number','34')}${field('material_cost','Material cost','number','8')}${field('packaging_cost','Packaging cost','number','2')}${field('shipping_cost','Shipping cost','number','4')}
    ${field('labor_minutes','Labor minutes','number','25')}${field('current_stock','Current stock','number','20')}${field('lead_time_days','Lead time days','number','7')}${field('demand_std_dev_day','Demand std/day','number','1.4')}
    ${field('return_rate','Return rate','number','0.03')}${field('ad_spend_unit','Ad spend/unit','number','1.5')}${field('target_hourly_wage','Target hourly wage','number','15')}
    <div class="field"><label>&nbsp;</label><button class="btn btn-primary" type="submit">Add product</button></div>
  </form>`;
}
function productTableWithActions(rows){
  if(!rows.length) return `<div class="empty">No products yet. Add your first product above.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>SKU</th><th>Name</th><th>Price</th><th>Profit/hr</th><th>Reorder point</th><th>Decision</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td class="mono">${esc(r.p.sku)}</td><td>${esc(r.p.name)}</td><td>${money(r.p.selling_price)}</td><td>${money(r.profitHour)}</td><td>${num(r.reorderPoint,1)}</td><td><span class="tag ${decisionClass(r.decision)}">${r.decision}</span></td><td><button class="btn btn-sm btn-danger" data-delete-product="${r.p.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
}

function renderSales(){
  return `<div class="row">
    <div class="panel col-5"><h3>Add sales row</h3>${salesForm()}</div>
    <div class="panel col-7"><h3>CSV paste/import</h3><p class="small muted">Format: sku,sale_date,units_sold,revenue,refunds,ad_spend,channel</p><textarea id="csvInput" placeholder="EARRING-01,${todayIso()},2,68,0,3,Etsy"></textarea><br><br><div class="actions"><button class="btn btn-primary" id="importCsvBtn">Import CSV rows</button><button class="btn" id="exportSalesBtn">Export sales CSV</button></div></div>
    <div class="panel col-12"><h3>Recent sales</h3>${salesTable()}</div>
  </div>`;
}
function salesForm(){
  const opts = state.products.map(p=>`<option value="${esc(p.sku)}">${esc(p.sku)} — ${esc(p.name)}</option>`).join('');
  return `<form id="salesForm" class="form-grid" style="grid-template-columns:1fr 1fr">
    <div class="field"><label>SKU</label><select name="sku">${opts}</select></div>${field('sale_date','Sale date','date',todayIso())}${field('units_sold','Units sold','number','1')}${field('revenue','Revenue','number','34')}${field('refunds','Refunds','number','0')}${field('ad_spend','Ad spend','number','0')}${field('channel','Channel','text','Etsy')}
    <div class="field"><label>&nbsp;</label><button class="btn btn-primary" type="submit">Add sale</button></div>
  </form>`;
}
function salesTable(){
  if(!state.sales.length) return `<div class="empty">No sales rows yet. Add one manually or paste CSV rows.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>SKU</th><th>Units</th><th>Revenue</th><th>Refunds</th><th>Ads</th><th>Channel</th><th></th></tr></thead><tbody>${state.sales.slice(0,80).map(s=>`<tr><td>${esc(s.sale_date)}</td><td class="mono">${esc(s.sku)}</td><td>${num(s.units_sold,0)}</td><td>${money(s.revenue)}</td><td>${money(s.refunds)}</td><td>${money(s.ad_spend)}</td><td>${esc(s.channel||'')}</td><td><button class="btn btn-sm btn-danger" data-delete-sale="${s.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
}

function renderReorder(){
  const { rows } = computations();
  if(!rows.length) return `<div class="panel"><div class="empty">Add products and sales first.</div></div>`;
  return `<div class="panel"><h3>Reorder signals</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>SKU</th><th>Stock</th><th>Avg daily sales</th><th>Lead time</th><th>Safety stock</th><th>Reorder point</th><th>Days left</th><th>Suggested order</th><th>Signal</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="mono">${esc(r.p.sku)}</td><td>${num(r.p.current_stock,0)}</td><td>${num(r.avgDaily,2)}</td><td>${num(r.p.lead_time_days,0)}</td><td>${num(r.safetyStock,1)}</td><td>${num(r.reorderPoint,1)}</td><td>${r.daysUntilStockout>998?'No demand':num(r.daysUntilStockout,1)}</td><td>${num(r.suggestedOrder,0)}</td><td><span class="tag ${r.decision==='Order Now'?'order':'keep'}">${r.decision==='Order Now'?'Order Now':'Monitor'}</span></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderPricing(){
  const { rows } = computations();
  if(!rows.length) return `<div class="panel"><div class="empty">Add products first.</div></div>`;
  return `<div class="panel"><h3>Price increase simulator</h3><p class="small muted">Edit default price change in Settings. You can add SKU-specific rates below.</p><form id="priceChangeForm" class="form-grid"><div class="field"><label>SKU</label><select name="sku">${state.products.map(p=>`<option value="${esc(p.sku)}">${esc(p.sku)} — ${esc(p.name)}</option>`).join('')}</select></div>${field('price_change_rate','Price change rate','number','0.10')}<div class="field"><label>&nbsp;</label><button class="btn btn-primary" type="submit">Save scenario</button></div></form><br><div class="table-wrap"><table class="data-table"><thead><tr><th>SKU</th><th>Current price</th><th>New price</th><th>Current margin</th><th>New margin</th><th>Current profit/hr</th><th>New profit/hr</th><th>Decision</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="mono">${esc(r.p.sku)}</td><td>${money(r.p.selling_price)}</td><td>${money(r.newPrice)}</td><td>${pct(r.margin)}</td><td>${pct(r.newMargin)}</td><td>${money(r.profitHour)}</td><td>${money(r.newProfitHour)}</td><td><span class="tag ${decisionClass(r.decision)}">${r.decision}</span></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderReport(){
  const report = buildReport();
  return `<div class="row"><div class="panel col-8"><h3>Weekly action report</h3><div class="report-box" id="reportText">${esc(report)}</div><br><button class="btn btn-primary" id="copyReportBtn">Copy report</button></div><div class="panel col-4"><h3>Export tools</h3><p class="muted">Export current product or sales data for backup and analysis.</p><div class="actions"><button class="btn" id="exportProductsBtn">Export products CSV</button><button class="btn" id="exportSalesBtn2">Export sales CSV</button></div></div></div>`;
}
function buildReport(){
  const { rows, totals } = computations();
  const actions = [...rows].sort((a,b)=>scoreDecision(b)-scoreDecision(a)).slice(0,8).map((r,i)=>`${i+1}. ${r.p.sku} — ${r.p.name}: ${r.decision}. Profit/hr ${money(r.profitHour)}, margin ${pct(r.margin)}, stock ${num(r.p.current_stock,0)}, reorder point ${num(r.reorderPoint,1)}.`).join('\n') || 'No products yet.';
  return `Mavenory Systems Weekly Review — ${todayIso()}\n\n30-day revenue: ${money(totals.revenue)}\nEstimated 30-day profit: ${money(totals.profit)}\nAverage margin: ${pct(totals.avgMargin)}\nProducts tracked: ${state.products.length}\nPlan: ${isFull() ? 'Full Planner' : 'Free Starter'}\n\nPriority actions:\n${actions}\n\nRecommended routine:\n- Reorder SKUs marked Order Now.\n- Reprice or simplify products marked Raise Price or Stop.\n- Add more sales data for products marked Test More.\n- Review this report weekly before buying materials or editing listings.`;
}

function renderSettings(){
  const s = { ...defaultSettings, ...state.settings };
  return `<div class="panel"><h3>Workspace settings</h3><form id="settingsForm" class="form-grid">
    ${field('workspace_name','Workspace name','text',s.workspace_name)}${field('currency','Currency','text',s.currency)}${field('listing_fee','Listing fee','number',s.listing_fee)}${field('transaction_fee','Transaction fee rate','number',s.transaction_fee)}${field('payment_rate','Payment fee rate','number',s.payment_rate)}${field('payment_fixed_fee','Payment fixed fee','number',s.payment_fixed_fee)}${field('min_profit_hour','Min profit/hour','number',s.min_profit_hour)}${field('min_net_margin','Min net margin','number',s.min_net_margin)}${field('default_service_z','Default service Z','number',s.default_service_z)}${field('low_sales_threshold','Low sales threshold','number',s.low_sales_threshold)}${field('default_price_increase','Default price increase','number',s.default_price_increase)}
    <div class="field"><label>&nbsp;</label><button class="btn btn-primary" type="submit">Save settings</button></div>
  </form></div>`;
}

function field(name,label,type,value){ return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value ?? '')}" step="any" /></div>`; }

function bindViewEvents(){
  $('#productForm')?.addEventListener('submit', saveProduct);
  $('#salesForm')?.addEventListener('submit', saveSale);
  $('#settingsForm')?.addEventListener('submit', saveSettings);
  $('#priceChangeForm')?.addEventListener('submit', savePriceChange);
  $('#importCsvBtn')?.addEventListener('click', importCsv);
  $('#exportProductsBtn')?.addEventListener('click', exportProducts);
  $('#exportSalesBtn')?.addEventListener('click', exportSales);
  $('#exportSalesBtn2')?.addEventListener('click', exportSales);
  $('#copyReportBtn')?.addEventListener('click', () => navigator.clipboard.writeText($('#reportText').textContent).then(()=>toast('Report copied.', 'success')));
  $$('[data-delete-product]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.deleteProduct)));
  $$('[data-delete-sale]').forEach(b => b.addEventListener('click', () => deleteSale(b.dataset.deleteSale)));
}

function formObj(form){
  const obj = Object.fromEntries(new FormData(form).entries());
  for(const k of Object.keys(obj)) if(['selling_price','material_cost','packaging_cost','shipping_cost','labor_minutes','current_stock','lead_time_days','demand_std_dev_day','return_rate','ad_spend_unit','target_hourly_wage','units_sold','revenue','refunds','ad_spend','listing_fee','transaction_fee','payment_rate','payment_fixed_fee','min_profit_hour','min_net_margin','default_service_z','low_sales_threshold','default_price_increase','price_change_rate'].includes(k)) obj[k] = Number(obj[k] || 0);
  return obj;
}

async function saveProduct(e){
  e.preventDefault();
  if(!canAddProducts()) return toast('Free Starter product limit reached. Upgrade to add unlimited SKUs.', 'error');
  const obj = formObj(e.target); obj.user_id = state.user.id; obj.service_level_z = obj.service_level_z || state.settings.default_service_z || 1.65;
  const { error } = await client.from('products').insert(obj);
  if(error) return toast(error.message, 'error');
  toast('Product added.', 'success'); e.target.reset(); await loadAll();
}
async function saveSale(e){
  e.preventDefault();
  const obj = formObj(e.target); obj.user_id = state.user.id;
  const product = state.products.find(p=>p.sku===obj.sku); if(product) obj.product_id = product.id;
  const { error } = await client.from('sales').insert(obj);
  if(error) return toast(error.message, 'error');
  toast('Sale added.', 'success'); await loadAll();
}
async function saveSettings(e){
  e.preventDefault();
  const obj = formObj(e.target); obj.user_id = state.user.id;
  const { error } = await client.from('workspace_settings').upsert(obj, { onConflict:'user_id' });
  if(error) return toast(error.message, 'error');
  toast('Settings saved.', 'success'); await loadAll();
}
async function savePriceChange(e){
  e.preventDefault();
  const obj = formObj(e.target); obj.user_id = state.user.id;
  const { error } = await client.from('price_changes').upsert(obj, { onConflict:'user_id,sku' });
  if(error) return toast(error.message, 'error');
  toast('Pricing scenario saved.', 'success'); await loadAll();
}
async function deleteProduct(id){ if(!confirm('Delete this product?')) return; const { error } = await client.from('products').delete().eq('id', id); if(error) return toast(error.message,'error'); await loadAll(); }
async function deleteSale(id){ const { error } = await client.from('sales').delete().eq('id', id); if(error) return toast(error.message,'error'); await loadAll(); }

async function importCsv(){
  const raw = $('#csvInput').value.trim(); if(!raw) return toast('Paste CSV rows first.', 'error');
  const rows = raw.split(/\n+/).map(line => line.split(',').map(x=>x.trim())).filter(r=>r.length>=4);
  const mapped = rows.map(r => ({ user_id: state.user.id, sku:r[0], sale_date:r[1] || todayIso(), units_sold:Number(r[2]||1), revenue:Number(r[3]||0), refunds:Number(r[4]||0), ad_spend:Number(r[5]||0), channel:r[6]||'Etsy', product_id: state.products.find(p=>p.sku===r[0])?.id || null }));
  const { error } = await client.from('sales').insert(mapped);
  if(error) return toast(error.message,'error');
  toast(`${mapped.length} sales rows imported.`, 'success'); await loadAll();
}

async function seedSampleData(){
  if(!confirm('This will delete your current products and sales, then create sample data. Continue?')) return;
  await client.from('sales').delete().eq('user_id', state.user.id);
  await client.from('products').delete().eq('user_id', state.user.id);
  const uid = state.user.id;
  const products = [
    { user_id:uid, sku:'EARRING-01', name:'Minimalist Earrings', category:'Jewelry', variant:'Gold', selling_price:34, material_cost:7, packaging_cost:1.5, shipping_cost:4, labor_minutes:25, current_stock:24, lead_time_days:7, demand_std_dev_day:1.1, return_rate:.02, ad_spend_unit:1, target_hourly_wage:15 },
    { user_id:uid, sku:'BATH-02', name:'Rose Bath Bomb Set', category:'Bath', variant:'Set of 4', selling_price:22, material_cost:9, packaging_cost:2.5, shipping_cost:5, labor_minutes:42, current_stock:4, lead_time_days:10, demand_std_dev_day:1.7, return_rate:.04, ad_spend_unit:1.2, target_hourly_wage:15 },
    { user_id:uid, sku:'SOAP-03', name:'Wedding Favor Soap', category:'Soap', variant:'Lavender', selling_price:6.5, material_cost:2.1, packaging_cost:.7, shipping_cost:1.2, labor_minutes:18, current_stock:3, lead_time_days:14, demand_std_dev_day:2.2, return_rate:.03, ad_spend_unit:.5, target_hourly_wage:15 }
  ];
  const { data: inserted, error: pErr } = await client.from('products').insert(products).select('*');
  if(pErr) return toast(pErr.message,'error');
  const find = sku => inserted.find(p=>p.sku===sku)?.id;
  const sales = [
    ['EARRING-01', 8, 272, 0, 8], ['EARRING-01', 5, 170, 0, 5], ['BATH-02', 6, 132, 0, 7], ['BATH-02', 3, 66, 0, 3], ['SOAP-03', 18, 117, 0, 8], ['SOAP-03', 11, 71.5, 0, 5]
  ].map((r,i)=>({ user_id:uid, product_id:find(r[0]), sku:r[0], sale_date:daysAgoIso(2+i*4), units_sold:r[1], revenue:r[2], refunds:r[3], ad_spend:r[4], channel:'Etsy' }));
  const { error:sErr } = await client.from('sales').insert(sales);
  if(sErr) return toast(sErr.message,'error');
  toast('Sample data created.', 'success'); await loadAll();
}

async function startCheckout(){
  if(!state.session) return toast('Sign in first.', 'error');
  try{
    $('#upgradeBtn').disabled = true;
    const response = await fetch('/api/create-checkout', {
      method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${state.session.access_token}` },
      body: JSON.stringify({ workspace_name: state.settings?.workspace_name || 'Mavenory Systems Workspace' })
    });
    const json = await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(json.error || json.message || 'Checkout could not be created.');
    location.href = json.url;
  }catch(err){ toast(err.message, 'error'); }
  finally{ $('#upgradeBtn').disabled = false; }
}

function exportProducts(){ downloadCsv('mavenory-products.csv', rowsToCsv(state.products)); }
function exportSales(){ downloadCsv('mavenory-sales.csv', rowsToCsv(state.sales)); }
function rowsToCsv(rows){ if(!rows.length) return ''; const cols = Object.keys(rows[0]).filter(k=>!['user_id','product_id'].includes(k)); return [cols.join(','), ...rows.map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\n'); }
function csvCell(v){ const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
function downloadCsv(name, text){ const blob = new Blob([text], {type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
function esc(v){ return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

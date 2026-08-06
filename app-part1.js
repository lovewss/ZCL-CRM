
/* ===================== Config / options ===================== */
const STAGES = ["陌拜客户","潜在客户","初步接触","跟进中","已拜访","已成交","已流失"];
const STAGE_COLOR = {"陌拜客户":"#7c3aed","潜在客户":"#6b7280","初步接触":"#2563eb","跟进中":"#ca8a04","已拜访":"#ea580c","已成交":"#16a34a","已流失":"#dc2626"};
const ATTRS = ["A+M+","A+M-","A-M+","A-M-"];
const ATTR_COLOR = {"A+M+":"#7c3aed","A+M-":"#dc2626","A-M+":"#ea580c","A-M-":"#6b7280"};
const REGIONS = ["市区","海曙","江北","镇海","北仑","余姚","慈溪","奉化","宁海","象山","绍兴","舟山","市外"];
const SOURCES = ["其他部门合作","膜拜客户","自查资料","公共资料","转介绍","资源分配","微信转入","展会客户"];
const POSITIONS = ["A+","A","A-","非A","外贸经理","小老板","监事"];
const RESULTS = ["有意向","继续跟进","暂无意向","已成交","已流失"];
const RESULT_COLOR = {"有意向":"#16a34a","继续跟进":"#2563eb","暂无意向":"#6b7280","已成交":"#7c3aed","已流失":"#dc2626"};

/* ===================== State / storage ===================== */
let DB = {customers:[], visits:[], users:[], pool:[], seq:0};
let CURRENT = null;                       // 当前登录用户
const LS_KEY = "crm_local_db_v1";
const SESS_KEY = "crm_session_user";
function load(){ try{const r=localStorage.getItem(LS_KEY); if(r) DB=JSON.parse(r);}catch(e){}
  if(!DB.users) DB.users=[];
  if(!DB.pool) DB.pool=[];
  (DB.customers||[]).forEach(c=>{if(c.stage==="已报价")c.stage="已拜访"; if(c.owner==="社媒主管")c.owner="主管"; if(c.inPool)delete c.inPool;});
  (DB.users||[]).forEach(u=>{if(u.name==="社媒主管")u.name="主管";});
}
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(DB)); cloudSync(); }

/* ===================== Supabase 云端 ===================== */
const SB_URL="https://plhyrkyjzpvljcuqctik.supabase.co";
const SB_KEY="sb_publishable_i44MKbgBJmAOs4Lybfh1Hg_c9M7HVO9";
const SB=(window.supabase)?window.supabase.createClient(SB_URL,SB_KEY):null;
let nameToId={}, idToName={};
function buildNameMaps(){ nameToId={}; idToName={}; (DB.users||[]).forEach(u=>{ if(u.name){nameToId[u.name]=u.id;} idToName[u.id]=u.name; }); }
const D=v=>v?v:null;   // 空日期转 null
// 字段映射（前端 camelCase <-> 云端 snake_case）
function custToRow(c){return{id:c.id,name:c.name||"",owner_id:nameToId[c.owner]||null,owner_name:c.owner||"",is_public:!!c.isPublic,stage:c.stage||"潜在客户",attr:c.attr||"",region:c.region||"",visited:c.visited||"未拜访",contact:c.contact||"",position:c.position||"",phone:c.phone||"",trade_contact:c.tradeContact||"",trade_phone:c.tradePhone||"",shareholder:c.shareholder||"",shareholder_phone:c.shareholderPhone||"",product:c.product||"",address:c.address||"",source:c.source||"",platform_url:c.platformUrl||"",site_url:c.siteUrl||"",peer_case:c.peerCase||"",note:c.note||"",create_date:D(c.createDate),next_follow:D(c.nextFollow)};}
function rowToCust(r){return{id:r.id,code:r.code_num?("CUS-"+String(r.code_num).padStart(3,"0")):"",name:r.name,owner:r.owner_name||idToName[r.owner_id]||"",isPublic:!!r.is_public,stage:r.stage||"潜在客户",attr:r.attr||"",region:r.region||"",visited:r.visited||"未拜访",contact:r.contact||"",position:r.position||"",phone:r.phone||"",tradeContact:r.trade_contact||"",tradePhone:r.trade_phone||"",shareholder:r.shareholder||"",shareholderPhone:r.shareholder_phone||"",product:r.product||"",address:r.address||"",source:r.source||"",platformUrl:r.platform_url||"",siteUrl:r.site_url||"",peerCase:r.peer_case||"",note:r.note||"",createDate:r.create_date||"",nextFollow:r.next_follow||"",updatedAt:r.created_at||""};}
function visitToRow(v){return{id:v.id,customer_id:v.customerId||null,type:v.type||"拜访",title:v.title||"",visit_date:D(v.date),visitor:v.visitor||"",decider:v.decider||"",position:v.position||"",phone:v.phone||"",address:v.address||"",situation:v.situation||"",result:v.result||"",next_follow:D(v.nextFollow),a:v.A||"",m:v.M||"",n:v.N||"",t:v.T||"",company:v.company||"",owner:v.owner||"",attr:v.attr||"",signed:v.signed||"",notes:v.notes||"",product:v.product||""};}
function rowToVisit(r){return{id:r.id,customerId:r.customer_id,type:r.type||"拜访",title:r.title||"",date:r.visit_date||"",visitor:r.visitor||"",decider:r.decider||"",position:r.position||"",phone:r.phone||"",address:r.address||"",situation:r.situation||"",result:r.result||"",nextFollow:r.next_follow||"",A:r.a||"",M:r.m||"",N:r.n||"",T:r.t||"",company:r.company||"",owner:r.owner||"",attr:r.attr||"",signed:r.signed||"",notes:r.notes||"",product:r.product||"",_yg:!!r.company};}
function poolToRow(p){return{id:p.id,name:p.name||"",region:p.region||"",attr:p.attr||"",contact:p.contact||"",phone:p.phone||"",product:p.product||"",address:p.address||"",source:p.source||"",platform_url:p.platformUrl||"",site_url:p.siteUrl||"",trade_contact:p.tradeContact||"",trade_phone:p.tradePhone||"",shareholder:p.shareholder||"",shareholder_phone:p.shareholderPhone||"",peer_case:p.peerCase||"",create_date:D(p.createDate),origin:p.origin||"",note:p.note||""};}
function rowToPool(r){return{id:r.id,name:r.name||"",region:r.region||"",attr:r.attr||"",contact:r.contact||"",phone:r.phone||"",product:r.product||"",address:r.address||"",source:r.source||"",platformUrl:r.platform_url||"",siteUrl:r.site_url||"",tradeContact:r.trade_contact||"",tradePhone:r.trade_phone||"",shareholder:r.shareholder||"",shareholderPhone:r.shareholder_phone||"",peerCase:r.peer_case||"",createDate:r.create_date||"",origin:r.origin||"",note:r.note||"",updatedAt:r.created_at||""};}

const _snap={customers:new Map(),visits:new Map(),pool:new Map()};
// PostgREST 单次查询最多返回 1000 行 → 分页取全
async function fetchAllRows(table){
  const step=1000, all=[];
  for(let from=0;;from+=step){
    const {data,error}=await SB.from(table).select("*").order("created_at",{ascending:true}).range(from,from+step-1);
    if(error)throw error;
    all.push(...(data||[]));
    if(!data||data.length<step)break;
  }
  return all;
}
async function loadFromCloud(){
  if(!SB)return;
  const [pf,cu,vi,po]=await Promise.all([
    SB.from("profiles").select("*"),
    fetchAllRows("customers"),
    fetchAllRows("visits"),
    fetchAllRows("pool")
  ]);
  DB.users=(pf.data||[]).map(r=>({id:r.id,name:r.name,role:r.role,username:r.name}));
  buildNameMaps();
  DB.customers=(cu||[]).map(rowToCust);
  DB.visits=(vi||[]).map(rowToVisit);
  DB.pool=(po||[]).map(rowToPool);
  _snap.customers=new Map(DB.customers.map(c=>[c.id,JSON.stringify(custToRow(c))]));
  _snap.visits=new Map(DB.visits.map(v=>[v.id,JSON.stringify(visitToRow(v))]));
  _snap.pool=new Map(DB.pool.map(p=>[p.id,JSON.stringify(poolToRow(p))]));
  localStorage.setItem(LS_KEY,JSON.stringify(DB));
}
let _syncing=false,_syncPending=false;
let _lastErr="",_lastErrAt=0;
async function cloudSync(){
  if(!SB||!CURRENT)return;
  if(_syncing){_syncPending=true;return;}
  _syncing=true;
  // 公海按公司名去重（去掉空名/重名，防唯一约束冲突）
  const seen=new Set(); DB.pool=(DB.pool||[]).filter(p=>{const k=(p.name||"").trim(); if(!k||seen.has(k))return false; seen.add(k); return true;});
  let errMsg=null;
  for(const [tbl,arr,fn] of [["customers",DB.customers,custToRow],["visits",DB.visits,visitToRow],["pool",DB.pool,poolToRow]]){
    try{ await syncTable(tbl,arr,fn); }catch(e){ errMsg=errMsg||(e.message||String(e)); console.error("cloudSync "+tbl,e); }
  }
  _syncing=false;
  if(errMsg && (errMsg!==_lastErr || Date.now()-_lastErrAt>15000)){ _lastErr=errMsg; _lastErrAt=Date.now(); toast("⚠️ 云端同步失败："+errMsg); }
  if(_syncPending){_syncPending=false;cloudSync();}
}
async function syncTable(tbl,arr,toRow){
  const snap=_snap[tbl], now=new Map(), ups=[];
  arr.forEach(o=>{const row=toRow(o);const j=JSON.stringify(row);now.set(o.id,j);if(snap.get(o.id)!==j)ups.push({o,row});});
  const dels=[...snap.keys()].filter(id=>!now.has(id));
  let thrown=null;
  if(ups.length){
    const {error}=await SB.from(tbl).upsert(ups.map(u=>u.row));
    if(error){ // 整批失败→逐条定位；成功的记快照，失败的保留旧快照下次重试
      for(const u of ups){ const {error:e}=await SB.from(tbl).upsert([u.row]);
        if(e){ now.set(u.o.id, snap.get(u.o.id)||"__RETRY__"); if(!thrown)thrown=new Error(tbl+"「"+(u.row.name||u.row.title||u.o.id)+"」"+e.message); } }
    }
  }
  for(let i=0;i<dels.length;i+=50){ const {error}=await SB.from(tbl).delete().in("id",dels.slice(i,i+50)); if(error)console.warn("del",tbl,error); }
  _snap[tbl]=now;
  if(thrown)throw thrown;
}

/* ===== 权限 / 可见范围 ===== */
function isAdmin(){ return CURRENT && CURRENT.role==="admin"; }
// 潜在客户（按权限）
function visibleCustomers(){
  if(!CURRENT) return [];
  return isAdmin()? DB.customers : DB.customers.filter(c=> c.owner===CURRENT.name || c.isPublic);
}
// 已拜访判定：visited 标记 或 阶段已到「已拜访 / 已成交」
function isVisitedCust(c){ return c.visited==="已拜访" || c.stage==="已拜访" || c.stage==="已成交"; }
// 公司名清洗：去掉星号与首尾的逗号/顿号/分号/引号/空白等杂符（导入时防止「,公司名」这类脏数据）
function cleanName(s){
  return String(s==null?"":s)
    .replace(/\*/g,"")
    .replace(/^[\s,，、;；:：|｜"'“”‘’]+/,"")
    .replace(/[\s,，、;；:：|｜"'“”‘’]+$/,"")
    .trim();
}
// 公海客户（独立资料库，全员可见；可与潜在客户同时存在同一公司）
function poolCustomers(){
  if(!CURRENT) return [];
  return DB.pool||[];
}
function visibleCustIds(){ return new Set(visibleCustomers().map(c=>c.id)); }
function visibleVisits(){
  if(isAdmin()) return DB.visits;
  const ids=visibleCustIds();
  return DB.visits.filter(v=> !v.customerId || ids.has(v.customerId));
}
function uid(){ return (crypto&&crypto.randomUUID)?crypto.randomUUID():('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);})); }
function nextCode(){ DB.seq=(DB.seq||0)+1; return "CUS-"+String(DB.seq).padStart(3,"0"); }

/* ===================== Helpers ===================== */
const $=s=>document.querySelector(s);
const esc=s=>(s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2200);}
function fillSelect(el,arr,blank){el.innerHTML=(blank?`<option value="">${blank}</option>`:"")+arr.map(o=>`<option>${o}</option>`).join("");}
// 客户来源固定下拉：8个标准项 + 若记录有旧的非标准来源则保留为额外选项
function setSourceSelect(sel,val){const el=$(sel);if(!el)return;el.innerHTML=`<option value="">未设置</option>`+SOURCES.map(s=>`<option>${esc(s)}</option>`).join("")+((val&&!SOURCES.includes(val))?`<option>${esc(val)}</option>`:"");el.value=val||"";}
function pill(text,color){return text?`<span class="pill" style="background:${color}22;color:${color}">${esc(text)}</span>`:"";}
function today(){return new Date().toISOString().slice(0,10);}
function daysFromNow(d){if(!d)return null;return Math.round((new Date(d)-new Date(today()))/86400000);}
function custName(id){const c=DB.customers.find(x=>x.id===id);return c?c.name:"";}

/* ===================== 分页（每页20条） ===================== */
let PAGE_SIZE=20;
const PAGE={customers:1, pool:1, visited:1, visits:1, won:1, mobai:1};
const PAGE_RENDER={customers:()=>renderCustomers(), pool:()=>renderPool(), visited:()=>renderVisited(), visits:()=>renderVisits(), won:()=>renderWon(), mobai:()=>renderMobai()};
function gotoPage(key,n){ PAGE[key]=n; PAGE_RENDER[key](); }
function setPageSize(key,val){ PAGE_SIZE=parseInt(val)||20; Object.keys(PAGE).forEach(k=>PAGE[k]=1); PAGE_RENDER[key](); }

/* ===================== 勾选 / 批量操作 ===================== */
const SEL={customers:new Set(), pool:new Set(), visited:new Set(), won:new Set(), mobai:new Set()};
function toggleSel(view,id,on){ on?SEL[view].add(id):SEL[view].delete(id); PAGE_RENDER[view](); }
function toggleSelAll(view,ids,on){ ids.forEach(id=>{on?SEL[view].add(id):SEL[view].delete(id);}); PAGE_RENDER[view](); }
function clearSel(view){ SEL[view].clear(); PAGE_RENDER[view](); }
function bulkBar(view){
  const n=SEL[view].size; if(!n)return "";
  // 管理员：批量分配给已有业务员（公海除外）
  const assign = (view!=="pool" && isAdmin())
    ? `<select onchange="bulkAssign('${view}',this.value);this.value=''" style="padding:5px 8px;border:1px solid var(--brand);border-radius:6px;color:var(--brand);font-size:13px;background:#fff"><option value="">👤 分配给…</option>${(DB.users||[]).map(u=>u.name).filter(Boolean).map(nm=>`<option value="${esc(nm)}">${esc(nm)}</option>`).join("")}</select>`
    : "";
  const acts = view==="pool"
    ? `<button class="btn sm" onclick="bulkClaimPool()">捡入到我的潜在客户</button><button class="btn ghost sm" style="color:var(--red)" onclick="bulkDeletePool()">🗑 删除</button>`
    : `${assign}<button class="btn ghost sm" onclick="bulkReleaseToPool('${view}')">🌊 放入公海</button><button class="btn ghost sm" style="color:var(--red)" onclick="bulkDeleteCustomers('${view}')">🗑 删除</button>`;
  return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#eef2ff;border-bottom:1px solid var(--line);flex-wrap:wrap">
    <span style="font-size:13px">已选 <b style="color:var(--brand)">${n}</b> 家</span>${acts}
    <button class="btn ghost sm" onclick="clearSel('${view}')">取消选择</button></div>`;
}
function bulkAssign(view,name){
  if(!name)return;
  if(!isAdmin()){toast("仅管理员可分配客户");return;}
  const sel=SEL[view]; const ids=[...sel]; if(!ids.length)return;
  if(!confirm("确定把选中的 "+ids.length+" 家客户分配给「"+name+"」？"))return;
  let n=0; ids.forEach(id=>{ const c=DB.customers.find(x=>x.id===id); if(c){c.owner=name;c.updatedAt=new Date().toISOString();n++;} });
  sel.clear();
  save();refreshDynamic();renderCustomers();renderMobai();renderWon();renderVisited();renderDash();toast("已把 "+n+" 家分配给「"+name+"」");
}
function selCell(view,id){ return `<td style="width:34px;text-align:center"><input type="checkbox" ${SEL[view].has(id)?"checked":""} onclick="event.stopPropagation();toggleSel('${view}','${id}',this.checked)"></td>`; }
function selHead(view,ids){ const all=ids.length&&ids.every(id=>SEL[view].has(id)); return `<th style="width:34px;text-align:center"><input type="checkbox" ${all?"checked":""} onclick="toggleSelAll('${view}',[${ids.map(id=>`'${id}'`).join(",")}],this.checked)"></th>`; }
function bulkReleaseToPool(view){
  view=view||"customers"; const sel=SEL[view]; const ids=[...sel]; if(!ids.length)return;
  if(!confirm("确定把选中的 "+ids.length+" 家放入公海？将从潜在客户移除。"))return;
  ids.forEach(id=>{ const c=DB.customers.find(x=>x.id===id); if(!c)return;
    const flog=customerVisitsToNote(id);
    let p=(DB.pool||[]).find(x=>x.name===c.name);
    if(!p){ p={id:uid(),origin:"手动放入"}; ["name","region","attr","contact","phone","product","address","source","platformUrl","siteUrl","tradeContact","tradePhone","peerCase","createDate","note"].forEach(k=>p[k]=c[k]||""); DB.pool.push(p);}
    if(flog) p.note=flog;   // 客户跟进/拜访记录 → 公海
    p.updatedAt=new Date().toISOString();
    DB.visits=DB.visits.filter(v=>v.customerId!==id);   // 记录已转存公海
  });
  DB.customers=DB.customers.filter(c=>!sel.has(c.id)); sel.clear();
  save();refreshDynamic();renderCustomers();renderPool();renderVisits();renderDash();renderVisited();toast("已放入公海（跟进记录一并带走）");
}

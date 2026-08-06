function bulkDeleteCustomers(view){
  view=view||"customers"; const sel=SEL[view]; const n=sel.size; if(!n)return;
  if(!confirm("确定删除选中的 "+n+" 家客户？此操作不可恢复。"))return;
  DB.customers=DB.customers.filter(c=>!sel.has(c.id)); sel.clear();
  save();refreshDynamic();renderCustomers();renderDash();renderVisited();toast("已删除 "+n+" 家");
}
function bulkClaimPool(){
  const ids=[...SEL.pool]; if(!ids.length)return;
  let added=0;
  ids.forEach(id=>{ const p=(DB.pool||[]).find(x=>x.id===id); if(!p)return;
    let c=DB.customers.find(x=>x.name===p.name&&x.owner===CURRENT.name);
    if(!c){
      c={id:uid(),code:nextCode(),owner:CURRENT.name,stage:"潜在客户",visited:"未拜访",isPublic:false,updatedAt:new Date().toISOString()};
      ["name","region","attr","contact","phone","product","address","source","platformUrl","siteUrl","tradeContact","tradePhone","peerCase","createDate"].forEach(k=>c[k]=p[k]||""); DB.customers.push(c); added++;
    }
    if(p.note) poolNoteToVisits(p.note, c.id);   // 公海跟进记录 → 客户跟进记录
  });
  DB.pool=(DB.pool||[]).filter(p=>!SEL.pool.has(p.id));   // 从公海移除已捡入的
  SEL.pool.clear();
  save();refreshDynamic();renderPool();renderCustomers();renderVisits();renderVisited();renderDash();toast("已捡入 "+added+" 家（含跟进记录，已从公海移除）");
}
function bulkDeletePool(){
  const n=SEL.pool.size; if(!n)return;
  if(!confirm("确定从公海删除选中的 "+n+" 家？（不影响已捡入的潜在客户）"))return;
  DB.pool=DB.pool.filter(p=>!SEL.pool.has(p.id)); SEL.pool.clear();
  save();renderPool();toast("已删除 "+n+" 家");
}
function pageSlice(rows,key){
  const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
  if(PAGE[key]>pages)PAGE[key]=pages; if(PAGE[key]<1)PAGE[key]=1;
  const s=(PAGE[key]-1)*PAGE_SIZE; return rows.slice(s,s+PAGE_SIZE);
}
function pageBar(total,key){
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const cur=Math.min(PAGE[key],pages);
  let nums=[];
  for(let i=1;i<=pages;i++){ if(i===1||i===pages||Math.abs(i-cur)<=2)nums.push(i); else if(nums[nums.length-1]!=="…")nums.push("…"); }
  const btns=pages<=1?"":`
    <button class="btn ghost sm" ${cur<=1?"disabled":""} onclick="gotoPage('${key}',${cur-1})">上一页</button>
    ${nums.map(n=>n==="…"?'<span style="color:var(--muted);padding:0 2px">…</span>':`<button class="btn ${n===cur?"":"ghost"} sm" onclick="gotoPage('${key}',${n})">${n}</button>`).join("")}
    <button class="btn ghost sm" ${cur>=pages?"disabled":""} onclick="gotoPage('${key}',${cur+1})">下一页</button>`;
  const sizeSel=`每页 <select onchange="setPageSize('${key}',this.value)" style="padding:2px 4px;border:1px solid var(--line);border-radius:5px;font-size:12px;background:#fff">${[20,50,100].map(n=>`<option value="${n}" ${n===PAGE_SIZE?"selected":""}>${n}</option>`).join("")}</select> 条`;
  return `<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;padding:10px 12px;flex-wrap:wrap;border-top:1px solid #f0f1f3">
    <span style="color:var(--muted);font-size:12px;margin-right:auto">共 ${total} 条 · 第 ${cur}/${pages} 页　${sizeSel}</span>${btns}</div>`;
}

/* ===================== Navigation ===================== */
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $("#view-"+b.dataset.view).classList.add("active");
  if(b.dataset.view==="dash")renderDash();
  if(b.dataset.view==="customers")renderCustomers();
  if(b.dataset.view==="pool")renderPool();
  if(b.dataset.view==="visits")renderVisits();
  if(b.dataset.view==="visited")renderVisited();
  if(b.dataset.view==="mobai")renderMobai();
  if(b.dataset.view==="won")renderWon();
  if(b.dataset.view==="users")renderUsers();
});

/* ===================== Auth（Supabase） ===================== */
async function login(){
  if(!SB){$("#loginErr").textContent="Supabase 未加载，请检查网络";return;}
  const email=$("#login_user").value.trim(), pass=$("#login_pass").value;
  if(!email||!pass){$("#loginErr").textContent="请输入邮箱和密码";return;}
  $("#loginErr").textContent="登录中…";
  const {data,error}=await SB.auth.signInWithPassword({email,password:pass});
  if(error){$("#loginErr").textContent="登录失败："+error.message;return;}
  try{ await afterAuth(data.user); }catch(e){$("#loginErr").textContent="加载数据失败："+e.message;}
}
async function afterAuth(user){
  const {data:prof}=await SB.from("profiles").select("*").eq("id",user.id).single();
  CURRENT={id:user.id,name:(prof&&prof.name)||user.email,role:(prof&&prof.role)||"sales"};
  await loadFromCloud();
  $("#login_pass").value=""; $("#loginErr").textContent="";
  enterApp();
}
async function logout(){ if(SB)await SB.auth.signOut(); CURRENT=null; showLogin(); }
function showLogin(){ $("#loginScreen").style.display="flex"; }
function enterApp(){
  $("#loginScreen").style.display="none";
  renderUserBox();
  // 管理员专属页：用户管理 / 数据管理
  document.querySelectorAll('nav button[data-admin]').forEach(b=>b.style.display=isAdmin()?"":"none");
  // 若当前停留在无权限页，则回到仪表盘
  const active=document.querySelector('nav button.active');
  if(active && active.dataset.admin && !isAdmin()){ active.classList.remove('active'); document.querySelector('nav button[data-view=dash]').classList.add('active'); document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); $("#view-dash").classList.add('active'); }
  refreshDynamic(); renderDash(); renderCustomers(); renderMobai(); renderPool(); renderVisits(); renderVisited(); renderWon(); renderUsers();
}

/* ===================== Dashboard ===================== */
function renderDash(){
  const cs=visibleCustomers();
  const won=cs.filter(c=>c.stage==="已成交").length;
  const active=cs.filter(c=>!["已成交","已流失"].includes(c.stage)).length;
  // upcoming follow ups within 7 days (customers + visits)
  const ups=collectFollowups().filter(f=>f.days!=null && f.days<=7).length;
  const poolN=poolCustomers().length;
  const vset=new Set();
  visibleVisits().filter(v=>(v.type||"拜访")==="拜访").forEach(v=>vset.add(v.customerId||("name:"+(v.company||custName(v.customerId)))));
  visibleCustomers().filter(isVisitedCust).forEach(c=>vset.add(c.id));
  $("#statCards").innerHTML=[
    ["潜在客户",cs.length,"var(--brand)"],
    ["公海客户",poolN,"#0ea5e9"],
    ["已拜访客户",vset.size,"var(--purple)"],
    ["跟进中客户",active,"var(--yellow)"],
    ["已成交",won,"var(--green)"],
    ["7天内待跟进",ups,"var(--orange)"]
  ].map(([k,v,c])=>`<div class="card"><div class="k">${k}</div><div class="v" style="color:${c}">${v}</div></div>`).join("");

  // funnel
  const fmax=Math.max(1,...STAGES.map(s=>cs.filter(c=>c.stage===s).length));
  $("#funnel").innerHTML=STAGES.map(s=>{
    const n=cs.filter(c=>c.stage===s).length;
    return `<div class="bar-row"><div class="lbl">${s}</div><div class="bar-track">
      <div class="bar-fill" style="width:${Math.max(n/fmax*100,n?6:0)}%;background:${STAGE_COLOR[s]}">${n||""}</div></div></div>`;
  }).join("");

  // region
  drawDist("#regionChart", REGIONS, "#2563eb", c=>c.region);
  // attr
  $("#attrChart").innerHTML=ATTRS.map(a=>{
    const n=cs.filter(c=>c.attr===a).length;
    const max=Math.max(1,...ATTRS.map(x=>cs.filter(c=>c.attr===x).length));
    return `<div class="bar-row"><div class="lbl">${a}</div><div class="bar-track">
      <div class="bar-fill" style="width:${Math.max(n/max*100,n?6:0)}%;background:${ATTR_COLOR[a]}">${n||""}</div></div></div>`;
  }).join("") || `<div class="empty">暂无数据</div>`;

  // team performance by owner
  const owners=[...new Set(cs.map(c=>c.owner).filter(Boolean))];
  if(owners.length){
    const omax=Math.max(1,...owners.map(o=>cs.filter(c=>c.owner===o).length));
    $("#teamChart").innerHTML=owners.map(o=>{
      const list=cs.filter(c=>c.owner===o);
      const w=list.filter(c=>c.stage==="已成交").length;
      return `<div class="bar-row"><div class="lbl">${esc(o)}</div><div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(list.length/omax*100,8)}%;background:#0ea5e9">${list.length} 家${w?'｜成交'+w:''}</div></div></div>`;
    }).join("");
  } else $("#teamChart").innerHTML=`<div class="empty">暂无负责人数据（在客户里填写「负责人」即可按业务员统计）</div>`;

  // followups
  const fu=collectFollowups().filter(f=>f.days!=null).sort((a,b)=>a.days-b.days).slice(0,12);
  $("#followups").innerHTML = fu.length? fu.map(f=>{
    const cls=f.days<0?"overdue":(f.days<=3?"soon":"");
    const tag=f.days<0?`逾期${-f.days}天`:(f.days===0?"今天":`${f.days}天后`);
    return `<div class="followup-item"><span class="date ${cls}">${f.date}</span>
      <span style="flex:1">${esc(f.label)}</span>
      <span class="${cls}" style="font-weight:600">${tag}</span></div>`;
  }).join("") : `<div class="empty">暂无待跟进</div>`;
}
function drawDist(sel,keys,color,getter){
  const cs=visibleCustomers();
  const counts=keys.map(k=>cs.filter(c=>getter(c)===k).length);
  const max=Math.max(1,...counts);
  const rows=keys.map((k,i)=>counts[i]?`<div class="bar-row"><div class="lbl">${k}</div><div class="bar-track">
    <div class="bar-fill" style="width:${Math.max(counts[i]/max*100,6)}%;background:${color}">${counts[i]}</div></div></div>`:"").join("");
  $(sel).innerHTML=rows||`<div class="empty">暂无数据</div>`;
}
function collectFollowups(){
  const list=[];
  visibleCustomers().forEach(c=>{ if(c.nextFollow) list.push({date:c.nextFollow,days:daysFromNow(c.nextFollow),label:"客户｜"+c.name+(c.contact?"（"+c.contact+"）":"")}); });
  visibleVisits().forEach(v=>{ if(v.nextFollow) list.push({date:v.nextFollow,days:daysFromNow(v.nextFollow),label:(v.type||"拜访")+"｜"+(custName(v.customerId)||v.title)}); });
  return list;
}

/* ===================== Customers ===================== */
let custView="list";
function renderCustomers(){
  const q=($("#custSearch").value||"").toLowerCase();
  const fo=$("#filterOwner").value, fs=$("#filterStage").value, fr=$("#filterRegion").value, fa=$("#filterAttr").value;
  let rows=visibleCustomers().filter(c=>{
    if(fo&&(c.owner||"")!==fo)return false;
    if(fs&&c.stage!==fs)return false;
    if(fr&&c.region!==fr)return false;
    if(fa&&c.attr!==fa)return false;
    if(q){const hay=[c.name,c.owner,c.contact,c.phone,c.product,c.address].join(" ").toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
  if(custView==="list"){ $("#custList").style.display=""; $("#custKanban").style.display="none"; renderCustTable(rows.filter(c=>c.stage!=="陌拜客户"&&c.stage!=="已成交")); }
  else { $("#custList").style.display="none"; $("#custKanban").style.display="flex"; renderKanban(rows); }
}
let sortKey="recency",sortDir=-1;
// 最近活动时间：取「最后编辑 / 最后跟进拜访 / 建立日期」三者中最新的，用于各列表默认置顶
function lastFollowDate(cid){ let m=""; (DB.visits||[]).forEach(v=>{ if(v.customerId===cid && (v.date||"")>m) m=v.date; }); return m; }
function recency(c){ let x=c.updatedAt||""; const cd=c.createDate||""; const f=lastFollowDate(c.id); if(cd>x)x=cd; if(f>x)x=f; return x; }
function poolRecency(p){ let x=p.updatedAt||""; const cd=p.createDate||""; if(cd>x)x=cd; return x; }
function renderCustTable(rows){
  rows=rows.slice().sort((a,b)=>{
    if(sortKey==="recency"){ const x=recency(a),y=recency(b); return x>y?-1:x<y?1:0; }
    let x=a[sortKey]||"",y=b[sortKey]||""; return (x>y?1:x<y?-1:0)*sortDir;
  });
  if(!rows.length){$("#custList").innerHTML=`<div class="empty">暂无客户，点击右上角「＋ 新增客户」或到「数据管理」导入 / 载入示例</div>`;return;}
  const total=rows.length, pageRows=pageSlice(rows,"customers");
  const pageIds=pageRows.map(c=>c.id);
  const cols=[["code","编号"],["name","公司名字"],["owner","负责人"],["stage","阶段"],["attr","属性"],["region","区域"],
             ["contact","联系人"],["phone","电话"],["product","主营产品"],["nextFollow","下次跟进"]];
  $("#custList").innerHTML=bulkBar("customers")+`<table><thead><tr>${selHead("customers",pageIds)}${cols.map(c=>`<th data-k="${c[0]}">${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>${
    pageRows.map(c=>{
      const d=daysFromNow(c.nextFollow);
      const fcls=d!=null&&d<0?"overdue":(d!=null&&d<=3?"soon":"");
      return `<tr>
        ${selCell("customers",c.id)}
        <td style="color:var(--muted)">${esc(c.code)}</td>
        <td class="namecol"><span class="link" onclick="showDetail('${c.id}')" title="${esc(c.name)}">${esc(c.name)}</span></td>
        <td>${c.owner?pill(c.owner,"#0ea5e9"):""}</td>
        <td>${pill(c.stage,STAGE_COLOR[c.stage])}</td>
        <td>${pill(c.attr,ATTR_COLOR[c.attr])}</td>
        <td>${esc(c.region||"")}</td>
        <td>${esc(c.contact||"")}</td>
        <td>${esc(c.phone||"")}</td>
        <td><div class="clip" title="${esc(c.product||"")}">${esc(c.product||"")}</div></td>
        <td class="${fcls}">${esc(c.nextFollow||"")}</td>
        <td><div class="row-act">
          <button class="btn ghost sm" onclick="openCustomer('${c.id}')">编辑</button>
          <button class="btn ghost sm" onclick="openVisit(null,'${c.id}')">+拜访</button>
        </div></td></tr>`;
    }).join("")
  }</tbody></table>`+pageBar(total,"customers");
  $("#custList").querySelectorAll("th[data-k]").forEach(th=>th.onclick=()=>{
    const k=th.dataset.k; if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=1;} renderCustomers();
  });
}

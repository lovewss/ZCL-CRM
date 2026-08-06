function renderVisited(){
  if(!CURRENT)return;
  const q=($("#visitedSearch").value||"").toLowerCase(), fo=$("#visitedOwner").value;
  const lastVisit=c=>DB.visits.filter(v=>v.customerId===c.id).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  let rows=visibleCustomers().filter(isVisitedCust);
  const owners=[...new Set(rows.map(c=>c.owner).filter(Boolean))].sort();
  const cur=$("#visitedOwner").value;
  $("#visitedOwner").innerHTML=`<option value="">全部负责人</option>`+owners.map(o=>`<option>${esc(o)}</option>`).join("");
  $("#visitedOwner").value=cur;
  if(fo)rows=rows.filter(c=>(c.owner||"")===fo);
  if(q)rows=rows.filter(c=>{const lv=lastVisit(c)||{};return [c.name,c.contact,c.phone,c.product,lv.visitor||""].join(" ").toLowerCase().includes(q);});
  rows.sort((a,b)=>{const x=recency(a),y=recency(b);return x>y?-1:x<y?1:0;});
  if(!rows.length){$("#visitedList").innerHTML=`<div class="empty">暂无已拜访客户。在客户详情里新增拜访即可。</div>`;return;}
  const total=rows.length, pageRows=pageSlice(rows,"visited"), pageIds=pageRows.map(c=>c.id);
  const cols=["公司名字","负责人","阶段","属性","区域","联系人","电话"];
  $("#visitedList").innerHTML=bulkBar("visited")+`<div style="padding:8px 12px;color:var(--muted);font-size:12px">共 ${total} 家已拜访客户</div><table><thead><tr>${selHead("visited",pageIds)}${cols.map(t=>`<th>${t}</th>`).join("")}<th>最近拜访</th><th>拜访次数</th><th></th></tr></thead><tbody>${
    pageRows.map(c=>{const vs=DB.visits.filter(v=>v.customerId===c.id);const lv=lastVisit(c)||{};
      return `<tr>
        ${selCell("visited",c.id)}
        <td class="namecol"><span class="link" onclick="showDetail('${c.id}')" title="${esc(c.name)}">${esc(c.name)}</span></td>
        <td>${c.owner?pill(c.owner,"#0ea5e9"):""}</td>
        <td>${pill(c.stage,STAGE_COLOR[c.stage])}</td>
        <td>${pill(c.attr,ATTR_COLOR[c.attr])}</td>
        <td>${esc(c.region||"")}</td>
        <td>${esc(c.contact||"")}</td>
        <td>${esc(c.phone||"")}</td>
        <td>${esc(lv.date||"")}</td>
        <td>${vs.length}</td>
        <td><div class="row-act"><button class="btn ghost sm" onclick="openCustomer('${c.id}')">编辑</button><button class="btn ghost sm" onclick="openVisit(null,'${c.id}')">+拜访</button></div></td>
      </tr>`;}).join("")
  }</tbody></table>`+pageBar(total,"visited");
}

/* 成交客户类目 —— 阶段=已成交 的客户，展示模式同潜在客户 */
function renderWon(){
  if(!CURRENT)return;
  const q=($("#wonSearch").value||"").toLowerCase(), fo=$("#wonOwner").value;
  let rows=visibleCustomers().filter(c=>c.stage==="已成交");
  const owners=[...new Set(rows.map(c=>c.owner).filter(Boolean))].sort();
  const cur=$("#wonOwner").value;
  $("#wonOwner").innerHTML=`<option value="">全部负责人</option>`+owners.map(o=>`<option>${esc(o)}</option>`).join("");
  $("#wonOwner").value=cur;
  if(fo)rows=rows.filter(c=>(c.owner||"")===fo);
  if(q)rows=rows.filter(c=>[c.name,c.contact,c.phone,c.product,c.region].join(" ").toLowerCase().includes(q));
  rows.sort((a,b)=>{const x=recency(a),y=recency(b);return x>y?-1:x<y?1:0;});
  if(!rows.length){$("#wonList").innerHTML=`<div class="empty">暂无成交客户。把客户「阶段」改为「已成交」即会归到这里。</div>`;return;}
  const total=rows.length, pageRows=pageSlice(rows,"won"), pageIds=pageRows.map(c=>c.id);
  const cols=["公司名字","负责人","属性","区域","联系人","电话","建立日期"];
  $("#wonList").innerHTML=bulkBar("won")+`<div style="padding:8px 12px;color:var(--muted);font-size:12px">共 ${total} 家成交客户</div><table><thead><tr>${selHead("won",pageIds)}${cols.map(t=>`<th>${t}</th>`).join("")}<th>主营产品</th><th></th></tr></thead><tbody>${
    pageRows.map(c=>{
      return `<tr>
        ${selCell("won",c.id)}
        <td class="namecol"><span class="link" onclick="showDetail('${c.id}')" title="${esc(c.name)}">${esc(c.name)}</span></td>
        <td>${c.owner?pill(c.owner,"#0ea5e9"):""}</td>
        <td>${pill(c.attr,ATTR_COLOR[c.attr])}</td>
        <td>${esc(c.region||"")}</td>
        <td>${esc(c.contact||"")}</td>
        <td>${esc(c.phone||"")}</td>
        <td>${esc(c.createDate||"")}</td>
        <td><div class="clip" title="${esc(c.product||"")}">${esc(c.product||"")}</div></td>
        <td><div class="row-act"><button class="btn ghost sm" onclick="openCustomer('${c.id}')">编辑</button><button class="btn ghost sm" onclick="openVisit(null,'${c.id}')">+拜访</button></div></td>
      </tr>`;}).join("")
  }</tbody></table>`+pageBar(total,"won");
}

function renderMobai(){
  if(!CURRENT)return;
  const q=($("#mobaiSearch").value||"").toLowerCase(), fo=$("#mobaiOwner").value;
  let rows=visibleCustomers().filter(c=>c.stage==="陌拜客户");
  const owners=[...new Set(rows.map(c=>c.owner).filter(Boolean))].sort();
  const cur=$("#mobaiOwner").value;
  $("#mobaiOwner").innerHTML=`<option value="">全部负责人</option>`+owners.map(o=>`<option>${esc(o)}</option>`).join("");
  $("#mobaiOwner").value=cur;
  if(fo)rows=rows.filter(c=>(c.owner||"")===fo);
  if(q)rows=rows.filter(c=>[c.name,c.contact,c.phone,c.product,c.region].join(" ").toLowerCase().includes(q));
  rows.sort((a,b)=>{const x=recency(a),y=recency(b);return x>y?-1:x<y?1:0;});
  if(!rows.length){$("#mobaiList").innerHTML=`<div class="empty">暂无陌拜客户。点右上角「＋ 新增陌拜客户」，或把客户「阶段」改为「陌拜客户」即会归到这里。</div>`;return;}
  const total=rows.length, pageRows=pageSlice(rows,"mobai"), pageIds=pageRows.map(c=>c.id);
  const cols=["公司名字","负责人","属性","区域","联系人","电话","建立日期"];
  $("#mobaiList").innerHTML=bulkBar("mobai")+`<div style="padding:8px 12px;color:var(--muted);font-size:12px">共 ${total} 家陌拜客户</div><table><thead><tr>${selHead("mobai",pageIds)}${cols.map(t=>`<th>${t}</th>`).join("")}<th>主营产品</th><th></th></tr></thead><tbody>${
    pageRows.map(c=>{
      return `<tr>
        ${selCell("mobai",c.id)}
        <td class="namecol"><span class="link" onclick="showDetail('${c.id}')" title="${esc(c.name)}">${esc(c.name)}</span></td>
        <td>${c.owner?pill(c.owner,"#0ea5e9"):""}</td>
        <td>${pill(c.attr,ATTR_COLOR[c.attr])}</td>
        <td>${esc(c.region||"")}</td>
        <td>${esc(c.contact||"")}</td>
        <td>${esc(c.phone||"")}</td>
        <td>${esc(c.createDate||"")}</td>
        <td><div class="clip" title="${esc(c.product||"")}">${esc(c.product||"")}</div></td>
        <td><div class="row-act"><button class="btn ghost sm" onclick="openCustomer('${c.id}')">编辑</button><button class="btn ghost sm" onclick="openVisit(null,'${c.id}')">+拜访</button></div></td>
      </tr>`;}).join("")
  }</tbody></table>`+pageBar(total,"mobai");
}

/* 刷新「负责人 / 来源」动态下拉与筛选 */
function refreshDynamic(){
  const base=CURRENT?visibleCustomers():DB.customers;
  const owners=[...new Set(base.map(c=>c.owner).filter(Boolean))].sort();
  const sources=[...SOURCES,...new Set(base.map(c=>c.source).filter(Boolean))];
  const cur=$("#filterOwner").value;
  $("#filterOwner").innerHTML=`<option value="">全部负责人</option>`+owners.map(o=>`<option>${esc(o)}</option>`).join("");
  $("#filterOwner").value=cur;
  $("#ownerList").innerHTML=owners.map(o=>`<option value="${esc(o)}">`).join("");
  $("#sourceList").innerHTML=[...new Set(sources)].map(s=>`<option value="${esc(s)}">`).join("");
}

/* ===================== 公海客户（独立资料库） ===================== */
function poolFields(){return ["name","region","attr","contact","phone","product","address","source","platformUrl","siteUrl","tradeContact","tradePhone","peerCase","createDate","note","origin"];}
function renderPool(){
  if(!CURRENT)return;
  const q=($("#poolSearch").value||"").toLowerCase(), fr=$("#poolRegion").value, fa=$("#poolAttr").value;
  let rows=poolCustomers().slice();
  if(fr)rows=rows.filter(c=>c.region===fr);
  if(fa)rows=rows.filter(c=>c.attr===fa);
  if(q)rows=rows.filter(c=>[c.name,c.contact,c.phone,c.product,c.region,c.origin].join(" ").toLowerCase().includes(q));
  rows.sort((a,b)=>{const x=poolRecency(a),y=poolRecency(b);return x>y?-1:x<y?1:0;});
  if(!rows.length){$("#poolList").innerHTML=`<div class="empty">公海暂无客户。到「数据管理 → 导入公海客户」批量导入，或在客户详情里点「放入公海」。</div>`;return;}
  const mine=new Set(DB.customers.filter(c=>c.owner===CURRENT.name).map(c=>c.name));
  const total=rows.length, pageRows=pageSlice(rows,"pool");
  const pageIds=pageRows.map(c=>c.id);
  $("#poolList").innerHTML=bulkBar("pool")+`<div style="padding:8px 12px;color:var(--muted);font-size:12px">共 ${total} 家公海客户（已按公司去重；点「捡入」领入你的潜在客户，捡入后从公海移除）</div><table><thead><tr>${selHead("pool",pageIds)}<th>公司名字</th><th>区域</th><th>属性</th><th>联系人</th><th>电话</th><th>主营产品</th><th></th></tr></thead><tbody>${
    pageRows.map(c=>`<tr>
      ${selCell("pool",c.id)}
      <td class="namecol"><span class="link" onclick="openPool('${c.id}')" title="${esc(c.name)}">${esc(c.name)}</span>${(c.note&&c.note.trim())?` <span title="有跟进记录（${c.note.split("\n").filter(s=>s.trim()).length} 条）" style="cursor:default">💬</span>`:''}</td>
      <td>${esc(c.region||"")}</td>
      <td>${pill(c.attr,ATTR_COLOR[c.attr])}</td>
      <td>${esc(c.contact||"")}</td>
      <td>${esc(c.phone||"")}</td>
      <td><div class="clip" title="${esc(c.product||"")}">${esc(c.product||"")}</div></td>
      <td><div style="display:flex;gap:6px;align-items:center">${mine.has(c.name)?'<span style="color:var(--muted);font-size:12px">已捡入</span>':`<button class="btn sm" onclick="claimPool('${c.id}')">捡入</button>`}<button class="btn ghost sm" onclick="openPool('${c.id}')">编辑</button></div></td>
    </tr>`).join("")
  }</tbody></table>`+pageBar(total,"pool");
}
// 捡入（领取）：把公海客户归入「我的潜在客户」，并从公海移除
/* ===== 跟进/拜访记录随客户流转：公海(note 文本) <-> 潜在(visits) 双向互转 ===== */
function customerVisitsToNote(cid){
  const vs=DB.visits.filter(v=>v.customerId===cid).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  return vs.map(v=>{
    const who=[v.visitor||"", v.decider?("→ "+v.decider):""].filter(Boolean).join(" ");
    const head=[v.date||"", v.type||"跟进", who].filter(Boolean).join(" ");
    let body=v.situation||"";
    const extra=[v.result?("结果:"+v.result):"", v.A?("A:"+v.A):"", v.M?("M:"+v.M):"", v.N?("N:"+v.N):"", v.T?("T:"+v.T):"", v.nextFollow?("下次:"+v.nextFollow):""].filter(Boolean).join("；");
    if(extra) body=(body?body+"｜":"")+extra;
    return `【${head}】${body}`;
  }).join("\n");
}
function poolNoteToVisits(noteText,cid){
  (noteText||"").split("\n").map(s=>s.trim()).filter(Boolean).forEach(l=>{
    const m=l.match(/^【(.+?)】([\s\S]*)$/);
    const head=m?m[1]:"", raw=m?m[2]:l;
    const dm=head.match(/\d{4}-\d{2}-\d{2}/); const date=dm?dm[0]:today();
    const type=/拜访/.test(head)?"拜访":"跟进";
    let rest=head.replace(/\d{4}-\d{2}-\d{2}/,"").replace(/拜访|跟进/g,"").trim();
    let visitor=rest, decider="";
    const am=rest.match(/^(.*?)→\s*(.*)$/); if(am){visitor=am[1].trim();decider=am[2].trim();}
    const parts=raw.split("｜");
    const rec={id:uid(),type,customerId:cid,date,visitor,decider,situation:(parts[0]||""),title:type+"｜"+date};
    if(parts[1]){ parts[1].split("；").forEach(kv=>{ const mm=kv.match(/^(结果|A|M|N|T|下次)\s*[:：]\s*([\s\S]+)$/); if(!mm)return; const k=mm[1],val=mm[2].trim(); if(k==="结果")rec.result=val; else if(k==="下次")rec.nextFollow=val; else rec[k]=val; }); }
    DB.visits.push(rec);
  });
}
function claimPool(poolId){
  const p=(DB.pool||[]).find(x=>x.id===poolId);if(!p)return;
  let c=DB.customers.find(x=>x.name===p.name && x.owner===CURRENT.name);
  if(!c){
    c={id:uid(),code:nextCode(),owner:CURRENT.name,stage:"潜在客户",visited:"未拜访",isPublic:false,updatedAt:new Date().toISOString()};
    ["name","region","attr","contact","phone","product","address","source","platformUrl","siteUrl","tradeContact","tradePhone","peerCase","createDate"].forEach(k=>c[k]=p[k]||"");
    DB.customers.push(c);
  }
  if(p.note) poolNoteToVisits(p.note, c.id);   // 公海跟进记录 → 客户跟进记录
  DB.pool=(DB.pool||[]).filter(x=>x.id!==poolId);   // 从公海移除
  save();refreshDynamic();renderPool();renderCustomers();renderVisits();renderVisited();renderDash();
  toast("已捡入「"+p.name+"」到你的潜在客户（含跟进记录）");
}
// 放入公海：把潜在客户移入公海资料库（去重），并从潜在客户中移除（不再保留）
function releaseToPool(id){
  const c=DB.customers.find(x=>x.id===id);if(!c)return;
  if(!confirm("确定把「"+c.name+"」放入公海？放入后将从你的潜在客户中移除，团队任何人都可在公海捡入。"))return;
  const flog=customerVisitsToNote(id);
  let p=(DB.pool||[]).find(x=>x.name===c.name);
  if(!p){
    p={id:uid(),origin:"手动放入"};
    ["name","region","attr","contact","phone","product","address","source","platformUrl","siteUrl","tradeContact","tradePhone","peerCase","createDate","note"].forEach(k=>p[k]=c[k]||"");
    DB.pool.push(p);
  }
  if(flog) p.note=flog;   // 客户跟进/拜访记录 → 公海
  p.updatedAt=new Date().toISOString();
  DB.visits=DB.visits.filter(v=>v.customerId!==id);   // 记录已转存公海
  DB.customers=DB.customers.filter(x=>x.id!==id);   // 从潜在客户移除
  save();refreshDynamic();closeModal("detailModal");renderPool();renderCustomers();renderVisits();renderDash();renderVisited();
  toast("已放入公海（跟进记录一并带走）");
}

/* 公海客户编辑（与潜在客户一致的编辑体验） */
let editPoolId=null, poolNote="";
// 跟进记录：一条条时间戳记录，存进公海记录的 note 字段（云端已映射，持久化）
function renderPoolFollow(){
  const box=$("#p_followLog"); if(!box)return;
  const lines=(poolNote||"").split("\n").map(s=>s.trim()).filter(Boolean);
  if(!lines.length){box.innerHTML=`<div style="color:var(--muted)">暂无跟进记录</div>`;return;}
  box.innerHTML=lines.map(l=>{
    const m=l.match(/^【(.+?)】([\s\S]*)$/);
    const head=m?m[1]:"", body=m?m[2]:l;
    return `<div style="padding:7px 9px;margin-bottom:6px;background:#f6f8ff;border:1px solid var(--line);border-radius:6px">
      ${head?`<div style="color:var(--brand);font-size:12px;margin-bottom:2px">${esc(head)}</div>`:""}
      <div>${esc(body)}</div></div>`;
  }).join("");
}
function addPoolFollow(){
  const inp=$("#p_followInput"); const txt=(inp.value||"").trim().replace(/\n/g," "); if(!txt)return;
  const who=CURRENT?CURRENT.name:""; const head=today()+(who?" "+who:"");
  poolNote=`【${head}】${txt}`+(poolNote?"\n"+poolNote:"");   // 新记录置顶
  inp.value=""; renderPoolFollow();
  // 编辑已存在的公海客户时立即持久化，无需等「保存」
  if(editPoolId){ const p=(DB.pool||[]).find(x=>x.id===editPoolId); if(p){p.note=poolNote;p.updatedAt=new Date().toISOString();save();renderPool();} }
}

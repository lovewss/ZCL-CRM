function renderKanban(rows){
  $("#custKanban").innerHTML=STAGES.map(s=>{
    const items=rows.filter(c=>c.stage===s);
    return `<div class="kcol" data-stage="${s}">
      <h4><span>${pill(s,STAGE_COLOR[s])}</span><span class="cnt">${items.length}</span></h4>
      ${items.map(c=>`<div class="kcard" draggable="true" data-id="${c.id}" onclick="showDetail('${c.id}')">
        <div class="name">${esc(c.name)}</div>
        <div class="meta">${pill(c.attr,ATTR_COLOR[c.attr])}${c.owner?pill(c.owner,"#0ea5e9"):''}${c.region?'<span>'+esc(c.region)+'</span>':''}</div>
      </div>`).join("")}
    </div>`;
  }).join("");
  // drag and drop
  let dragId=null;
  $("#custKanban").querySelectorAll(".kcard").forEach(card=>{
    card.addEventListener("dragstart",e=>{dragId=card.dataset.id;e.stopPropagation();});
  });
  $("#custKanban").querySelectorAll(".kcol").forEach(col=>{
    col.addEventListener("dragover",e=>{e.preventDefault();col.classList.add("drag-over");});
    col.addEventListener("dragleave",()=>col.classList.remove("drag-over"));
    col.addEventListener("drop",e=>{e.preventDefault();col.classList.remove("drag-over");
      const c=DB.customers.find(x=>x.id===dragId);
      if(c){c.stage=col.dataset.stage;c.updatedAt=new Date().toISOString();save();renderCustomers();renderMobai();renderWon();renderDash();toast("已移动到「"+col.dataset.stage+"」");}
    });
  });
}

/* ===================== Customer modal ===================== */
let editCustId=null;
// 负责人下拉：列出所有已有用户；current 若不在名单里也补进去，避免丢选中
function fillOwnerSelect(sel,current,blank){
  blank=(blank===undefined)?"（未分配 / 公共）":blank;
  const names=[...new Set((DB.users||[]).map(u=>u.name).filter(Boolean).concat(current?[current]:[]))];
  const el=$(sel); if(!el)return;
  el.innerHTML=`<option value="">${blank}</option>`+names.map(n=>`<option value="${esc(n)}"${n===current?" selected":""}>${esc(n)}</option>`).join("");
  el.value=current||"";
}
// 跟进对象：客户方对接人（取该客户的联系人 / 外贸部联系人，可留空）
function fillTargetSelect(cid,current,inputSel,listSel){
  inputSel=inputSel||"#lf_target"; listSel=listSel||"#lf_targetList";
  const c=DB.customers.find(x=>x.id===cid)||{};
  const names=[...new Set([c.contact,c.tradeContact,c.shareholder].filter(Boolean))];
  const dl=$(listSel); if(dl)dl.innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join("");
  const el=$(inputSel); if(el)el.value=current||c.contact||"";
}
function openCustomer(id,defaultStage){
  editCustId=id||null;
  const c=id?DB.customers.find(x=>x.id===id):{};
  $("#custModalTitle").textContent=id?"编辑客户":"新增客户";
  $("#custDeleteBtn").style.display=id?"":"none";
  $("#c_name").value=c.name||"";
  const ownerNow=c.owner||(id?"":(CURRENT?CURRENT.name:""));
  fillOwnerSelect("#c_owner",ownerNow);
  // 业务员不能改负责人（默认自己）；管理员可从已有用户里指定
  $("#c_owner").disabled=!isAdmin();
  $("#c_public").checked=!!c.isPublic;
  $("#c_stage").value=c.stage||defaultStage||"潜在客户"; $("#c_attr").value=c.attr||"";
  $("#c_region").value=c.region||""; $("#c_visited").value=c.visited||"未拜访"; setSourceSelect("#c_source",c.source||"");
  $("#c_contact").value=c.contact||""; $("#c_position").value=c.position||""; $("#c_phone").value=c.phone||"";
  $("#c_tradeContact").value=c.tradeContact||""; $("#c_tradePhone").value=c.tradePhone||"";
  $("#c_shareholder").value=c.shareholder||""; $("#c_shareholderPhone").value=c.shareholderPhone||"";
  $("#c_product").value=c.product||""; $("#c_address").value=c.address||""; $("#c_platformUrl").value=c.platformUrl||"";
  $("#c_siteUrl").value=c.siteUrl||""; $("#c_createDate").value=c.createDate||today(); $("#c_nextFollow").value=c.nextFollow||"";
  $("#c_peerCase").value=c.peerCase||""; $("#c_note").value=c.note||"";
  checkDupHint();
  openModal("custModal");
}
function saveCustomer(){
  const name=$("#c_name").value.trim();
  if(!name){toast("请填写公司名字");return;}
  const wasNew=!editCustId;
  // 新建时查重：提示已在谁的潜在客户 / 是否在公海；在公海可直接捡入
  if(!editCustId){
    const dupCust=DB.customers.filter(c=>c.name===name);
    const dupPool=(DB.pool||[]).find(p=>p.name===name);
    if(dupCust.length||dupPool){
      let msg="⚠️ 系统中已存在「"+name+"」：\n";
      if(dupCust.length){const os=[...new Set(dupCust.map(c=>c.owner||"（未分配）"))];msg+="· 已在潜在客户中，负责人："+os.join("、")+"\n";}
      if(dupPool)msg+="· 该客户在公海客户中\n";
      if(dupPool){
        if(confirm(msg+"\n是否直接从公海「捡入」到你的潜在客户？\n（确定＝捡入领取；取消＝返回，不新建）")){ closeModal("custModal"); claimPool(dupPool.id); return; }
        return;
      }
      if(!confirm(msg+"\n仍要新建一条重复记录吗？")) return;
    }
  }
  const ownerVal=isAdmin()?$("#c_owner").value.trim():(editCustId?DB.customers.find(x=>x.id===editCustId).owner:(CURRENT?CURRENT.name:""));
  const data={name,owner:ownerVal,isPublic:$("#c_public").checked,stage:$("#c_stage").value,attr:$("#c_attr").value,region:$("#c_region").value,
    visited:$("#c_visited").value,source:$("#c_source").value,contact:$("#c_contact").value,
    position:$("#c_position").value,phone:$("#c_phone").value,tradeContact:$("#c_tradeContact").value,tradePhone:$("#c_tradePhone").value,
    shareholder:$("#c_shareholder").value,shareholderPhone:$("#c_shareholderPhone").value,
    product:$("#c_product").value,address:$("#c_address").value,platformUrl:$("#c_platformUrl").value,siteUrl:$("#c_siteUrl").value,
    createDate:$("#c_createDate").value,nextFollow:$("#c_nextFollow").value,peerCase:$("#c_peerCase").value,
    note:$("#c_note").value};
  // 阶段进入「已拜访 / 已成交」即视为已拜访，联动 visited 标记
  if(data.stage==="已拜访"||data.stage==="已成交")data.visited="已拜访";
  data.updatedAt=new Date().toISOString();
  if(editCustId){Object.assign(DB.customers.find(x=>x.id===editCustId),data);}
  else{DB.customers.push(Object.assign({id:uid(),code:nextCode()},data));}
  save();refreshDynamic();closeModal("custModal");
  if(wasNew){ const tgt=(data.stage==="陌拜客户")?"mobai":"customers"; const b=document.querySelector('nav button[data-view='+tgt+']'); if(b)b.click(); }
  renderCustomers();renderMobai();renderWon();renderDash();toast("已保存");
}
function deleteCustomer(){
  if(!editCustId)return;
  if(!confirm("确定删除该客户？其拜访记录的关联将清空。"))return;
  DB.customers=DB.customers.filter(c=>c.id!==editCustId);
  DB.visits.forEach(v=>{if(v.customerId===editCustId)v.customerId=null;});
  save();closeModal("custModal");renderCustomers();toast("已删除");
}
// 新建客户时实时查重提示
function checkDupHint(){
  const el=$("#c_dupHint"); if(!el)return;
  if(editCustId){el.innerHTML="";return;}
  const name=$("#c_name").value.trim();
  if(!name){el.innerHTML="";return;}
  const exactCust=DB.customers.filter(c=>c.name===name);
  const exactPool=(DB.pool||[]).find(p=>p.name===name);
  if(exactCust.length||exactPool){
    const parts=[];
    if(exactCust.length){const os=[...new Set(exactCust.map(c=>c.owner||"（未分配）"))];parts.push("已在潜在客户 · 负责人："+os.join("、"));}
    if(exactPool)parts.push("在公海客户中");
    el.innerHTML=`<span style="color:var(--red)">⚠️ 已存在：${esc(parts.join("；"))}</span>`+(exactPool?` <span class="link" onclick="claimFromHint('${exactPool.id}')">立即捡入</span>`:"");
    return;
  }
  if(name.length>=4){
    const sim=[...new Set([...DB.customers.map(c=>c.name),...(DB.pool||[]).map(p=>p.name)])].filter(n=>n&&n!==name&&(n.includes(name)||name.includes(n))).slice(0,3);
    if(sim.length){el.innerHTML=`<span style="color:var(--orange)">可能已存在相似客户：${esc(sim.join("、"))}</span>`;return;}
  }
  el.innerHTML=`<span style="color:var(--green)">✓ 系统中暂无此客户</span>`;
}
function claimFromHint(poolId){ closeModal("custModal"); claimPool(poolId); }

/* ===================== Detail ===================== */
function showDetail(id){
  const c=DB.customers.find(x=>x.id===id);if(!c)return;
  $("#detailTitle").textContent=c.name;
  const vs=DB.visits.filter(v=>v.customerId===id).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const kv=(k,v)=>v?`<div class="k">${k}</div><div>${esc(v)}</div>`:"";
  $("#detailBody").innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <span style="color:var(--muted)">${esc(c.code)}</span>
      ${pill(c.stage,STAGE_COLOR[c.stage])}${pill(c.attr,ATTR_COLOR[c.attr])}
      ${pill(isVisitedCust(c)?"已拜访":"未拜访",isVisitedCust(c)?"#16a34a":"#dc2626")}
      ${c.isPublic?pill("公共客户","#0ea5e9"):""}
    </div>
    <div class="kv">
      ${kv("负责人",c.owner)}${kv("区域",c.region)}
      ${kv("客户来源",c.source)}${kv("联系人(A)",c.contact)}
      ${kv("职位",c.position)}${kv("电话",c.phone)}
      ${kv("外贸部联系人",c.tradeContact)}${kv("外贸部电话",c.tradePhone)}
      ${kv("股东联系人",c.shareholder)}${kv("股东电话",c.shareholderPhone)}
      ${kv("主营产品",c.product)}${kv("客户地址",c.address)}
      ${c.platformUrl?`<div class="k">平台网址</div><div><a href="${esc(c.platformUrl)}" target="_blank">${esc(c.platformUrl)}</a></div>`:""}
      ${c.siteUrl?`<div class="k">独立站</div><div><a href="${esc(c.siteUrl)}" target="_blank">${esc(c.siteUrl)}</a></div>`:""}
      ${kv("同行案例",c.peerCase)}${kv("建立日期",c.createDate)}${kv("下次跟进",c.nextFollow)}
      ${kv("备注",c.note)}
    </div>
    <div class="detail-section">
      <h4 style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span>📍 跟进 / 拜访记录（${vs.length}）</span>
        <span style="display:flex;gap:6px">
          <button class="btn sm" onclick="showLogForm('${id}','拜访')">＋ 新增拜访</button>
          <button class="btn ghost sm" onclick="showFollowForm('${id}')">＋ 跟进记录</button>
        </span>
      </h4>
      <div id="logForm" style="display:none;background:#f5f7ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px;margin-bottom:14px">
        <input type="hidden" id="lf_id">
        <div class="form-grid">
          <div class="field"><label>类型</label><select id="lf_type"><option>拜访</option><option>跟进</option></select></div>
          <div class="field"><label>日期</label><input id="lf_date" type="date"></div>
          <div class="field"><label>拜访人 / 跟进人</label><select id="lf_visitor"></select></div>
          <div class="field"><label>跟进对象（客户方对接人）</label><input id="lf_target" list="lf_targetList" placeholder="可下拉选择，也可直接输入"><datalist id="lf_targetList"></datalist></div>
          <div class="field"><label>跟进结果</label><select id="lf_result"></select></div>
          <div class="field full"><label>内容（拜访情况 / 跟进内容）</label><textarea id="lf_situation" placeholder="例如：电话沟通了独立站建站意向，客户要求下周报价…"></textarea></div>
          <div class="field full" style="border-top:1px dashed #c7d2fe;padding-top:8px"><label style="color:#4f46e5;font-weight:700">客户评估（ANMT）— 新增拜访时必填</label></div>
          <div class="field full"><label>A · 决策权 *（是否决策人 / 股权 / 能否拍板）</label><input id="lf_A" placeholder="如：非独立决策人，需与合伙人商量"></div>
          <div class="field full"><label>M · 资金实力 *（工厂 / 规模 / 营收 / 预算）</label><input id="lf_M" placeholder="如：有自己工厂，业务员3人，年营收约2.5亿"></div>
          <div class="field full"><label>N · 需求 *（痛点 / 关注点 / 现状）</label><input id="lf_N" placeholder="如：在意效果与ROI，关注AI赛道是否适合"></div>
          <div class="field full"><label>T · 采购时机 *（预计成交 / 决策时间）</label><input id="lf_T" placeholder="如：本月内 / 18号前回复"></div>
          <div class="field"><label>下次跟进</label><input id="lf_next" type="date"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
          <button class="btn ghost sm" onclick="cancelLog()">取消</button>
          <button class="btn sm" onclick="saveLog('${id}')">保存</button>
        </div>
      </div>
      <div id="logFollowForm" style="display:none;background:#f5f7ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <div style="flex:1;min-width:150px"><label style="font-size:12px;color:var(--muted)">跟进人</label><select id="ff_visitor" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:6px"></select></div>
          <div style="flex:1;min-width:150px"><label style="font-size:12px;color:var(--muted)">跟进对象</label><input id="ff_target" list="ff_targetList" placeholder="可下拉可手输" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:6px"><datalist id="ff_targetList"></datalist></div>
        </div>
        <div style="display:flex;gap:6px">
          <input id="ff_content" placeholder="填写本次跟进内容，回车或点「添加」" style="flex:1;padding:9px;border:1px solid var(--line);border-radius:6px" onkeydown="if(event.key==='Enter'){event.preventDefault();addFollowLog('${id}');}">
          <button class="btn sm" onclick="addFollowLog('${id}')">＋ 添加</button>
          <button class="btn ghost sm" onclick="cancelFollow()">取消</button>
        </div>
      </div>
      <div class="visit-log">${vs.length? vs.map(v=>`<div class="vitem">
        <div style="color:${v.type==='拜访'?'#7c3aed':'var(--brand)'};font-size:13px;font-weight:600;margin-bottom:3px">${esc(v.date||"")}${v.visitor?' '+esc(v.visitor):''}${v.decider?' <span style="color:var(--muted);font-weight:400">→ '+esc(v.decider)+'</span>':''} ${pill(v.type||'跟进',(v.type==='拜访')?'#7c3aed':'#0ea5e9')} ${pill(v.result,RESULT_COLOR[v.result])}</div>
        <div>${esc(v.situation||"")}</div>
        ${(v.A||v.M||v.N||v.T)?`<div style="font-size:12px;color:#374151;margin-top:4px;line-height:1.7;background:#f5f7ff;border-radius:6px;padding:6px 9px">
          ${v.A?`<div><b style="color:#4f46e5">A</b> 决策权：${esc(v.A)}</div>`:``}
          ${v.M?`<div><b style="color:#4f46e5">M</b> 资金：${esc(v.M)}</div>`:``}
          ${v.N?`<div><b style="color:#4f46e5">N</b> 需求：${esc(v.N)}</div>`:``}
          ${v.T?`<div><b style="color:#4f46e5">T</b> 时机：${esc(v.T)}</div>`:``}
        </div>`:``}
        ${v.nextFollow?`<div style="font-size:12px;color:var(--muted);margin-top:2px">下次跟进：${esc(v.nextFollow)}</div>`:``}
        <div style="margin-top:6px;display:flex;gap:6px"><button class="btn ghost sm" onclick="showLogForm('${id}',null,'${v.id}')">编辑</button><button class="btn ghost sm" onclick="deleteLog('${id}','${v.id}')">删除</button></div>
      </div>`).join("") : `<p class="hint">暂无记录，点击上方「新增拜访 / 跟进记录」直接添加。</p>`}</div>
    </div>`;
  $("#detailEditBtn").onclick=()=>{closeModal("detailModal");openCustomer(id);};
  const pb=$("#detailPoolBtn"); pb.style.display="";
  pb.textContent="🌊 放入公海"; pb.onclick=()=>releaseToPool(id);
  openModal("detailModal");
}

/* ===================== Visits ===================== */

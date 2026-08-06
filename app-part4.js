function renderVisits(){
  const q=($("#visitSearch").value||"").toLowerCase();
  const fr=$("#filterResult").value;
  let rows=visibleVisits().filter(v=>{
    if(fr&&v.result!==fr)return false;
    if(q){const hay=[v.title,custName(v.customerId),v.visitor,v.decider].join(" ").toLowerCase();if(!hay.includes(q))return false;}
    return true;
  }).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if(!rows.length){$("#visitList").innerHTML=`<div class="empty">暂无拜访记录</div>`;return;}
  const total=rows.length, pageRows=pageSlice(rows,"visits");
  $("#visitList").innerHTML=`<table><thead><tr>
    <th>拜访日期</th><th>主题</th><th>关联客户</th><th>拜访人</th><th>决策人</th><th>结果</th><th>下次跟进</th><th></th>
    </tr></thead><tbody>${pageRows.map(v=>{
      const d=daysFromNow(v.nextFollow);const fcls=d!=null&&d<0?"overdue":(d!=null&&d<=3?"soon":"");
      return `<tr>
        <td>${esc(v.date||"")}</td>
        <td>${pill(v.type||'拜访',(v.type==='跟进')?'#0ea5e9':'#7c3aed')} <span class="link" onclick="openVisit('${v.id}')">${esc(v.title)}</span></td>
        <td>${v.customerId?`<span class="link" onclick="showDetail('${v.customerId}')">${esc(custName(v.customerId))}</span>`:'<span style="color:var(--muted)">-</span>'}</td>
        <td>${esc(v.visitor||"")}</td>
        <td>${esc(v.decider||"")}</td>
        <td>${pill(v.result,RESULT_COLOR[v.result])}</td>
        <td class="${fcls}">${esc(v.nextFollow||"")}</td>
        <td><div class="row-act"><button class="btn ghost sm" onclick="openVisit('${v.id}')">编辑</button></div></td>
      </tr>`;
    }).join("")}</tbody></table>`+pageBar(total,"visits");
}
let editVisitId=null;
function openVisit(id,presetCust){
  editVisitId=id||null;
  const v=id?DB.visits.find(x=>x.id===id):{};
  $("#visitModalTitle").textContent=id?"编辑拜访":"新增拜访";
  $("#visitDeleteBtn").style.display=id?"":"none";
  // 关联客户：可输入搜索的下拉（仅自己的+公共客户；管理员全部）
  $("#vCustList").innerHTML=visibleCustomers().map(c=>`<option value="${esc(c.name)}">`).join("");
  const cid=v.customerId||presetCust||"";
  const cc=cid?DB.customers.find(x=>x.id===cid):null;
  $("#v_customer").value=cc?cc.name:"";
  $("#v_title").value=v.title||""; $("#v_date").value=v.date||today(); $("#v_visitor").value=v.visitor||"";
  $("#v_decider").value=v.decider||""; $("#v_position").value=v.position||""; $("#v_phone").value=v.phone||"";
  $("#v_address").value=v.address||""; $("#v_situation").value=v.situation||""; $("#v_result").value=v.result||"";
  $("#v_nextFollow").value=v.nextFollow||"";
  // auto-fill from customer if new
  if(!id&&cid){const c=DB.customers.find(x=>x.id===cid);if(c){if(!$("#v_phone").value)$("#v_phone").value=c.phone||"";if(!$("#v_address").value)$("#v_address").value=c.address||"";if(!$("#v_decider").value)$("#v_decider").value=c.contact||"";if(!$("#v_title").value)$("#v_title").value="拜访"+c.name;}}
  openModal("visitModal");
}
function saveVisit(){
  const title=$("#v_title").value.trim();
  if(!title){toast("请填写拜访主题");return;}
  const cName=$("#v_customer").value.trim();
  const matched=cName?visibleCustomers().find(c=>c.name===cName):null;
  const data={title,customerId:matched?matched.id:null,company:matched?"":cName,date:$("#v_date").value,visitor:$("#v_visitor").value,
    decider:$("#v_decider").value,position:$("#v_position").value,phone:$("#v_phone").value,
    address:$("#v_address").value,situation:$("#v_situation").value,result:$("#v_result").value,
    nextFollow:$("#v_nextFollow").value};
  if(editVisitId){Object.assign(DB.visits.find(x=>x.id===editVisitId),data);}
  else{DB.visits.push(Object.assign({id:uid()},data));}
  // mark customer visited
  if(data.customerId){const c=DB.customers.find(x=>x.id===data.customerId);if(c){c.visited="已拜访";c.updatedAt=new Date().toISOString();}}
  save();closeModal("visitModal");renderVisits();renderVisited();renderCustomers();renderDash();toast("已保存");
}
function deleteVisit(){
  if(!editVisitId)return;
  if(!confirm("确定删除该拜访记录？"))return;
  DB.visits=DB.visits.filter(v=>v.id!==editVisitId);
  save();closeModal("visitModal");renderVisits();toast("已删除");
}

/* ===== 详情内：内联跟进 / 拜访记录（不跳转） ===== */
function showLogForm(cid,type,visitId){
  const f=$("#logForm"); if(!f)return;
  fillSelect($("#lf_result"),RESULTS,"未设置");
  const v=visitId?(DB.visits.find(x=>x.id===visitId)||{}):{};
  $("#lf_id").value=visitId||"";
  $("#lf_type").value=v.type||type||"拜访";
  $("#lf_date").value=v.date||today();
  fillOwnerSelect("#lf_visitor", v.visitor||(CURRENT?CURRENT.name:""), "（选择跟进人）");
  fillTargetSelect(cid, v.decider||"");
  $("#lf_result").value=v.result||"";
  $("#lf_situation").value=v.situation||"";
  $("#lf_A").value=v.A||""; $("#lf_M").value=v.M||""; $("#lf_N").value=v.N||""; $("#lf_T").value=v.T||"";
  $("#lf_next").value=v.nextFollow||"";
  f.style.display="block";
  f.scrollIntoView({behavior:"smooth",block:"nearest"});
  $("#lf_situation").focus();
}
function cancelLog(){const f=$("#logForm");if(f)f.style.display="none";}
// 简洁跟进表单（公海同款卡片模式）：内容 + 跟进人 + 跟进对象
function showFollowForm(cid){
  const f=$("#logFollowForm"); if(!f)return;
  $("#ff_content").value="";
  fillOwnerSelect("#ff_visitor", CURRENT?CURRENT.name:"", "（选择跟进人）");
  fillTargetSelect(cid, "", "#ff_target", "#ff_targetList");
  cancelLog();
  f.style.display="block"; f.scrollIntoView({behavior:"smooth",block:"nearest"}); $("#ff_content").focus();
}
function cancelFollow(){const f=$("#logFollowForm");if(f)f.style.display="none";}
function addFollowLog(cid){
  const content=($("#ff_content").value||"").trim(); if(!content){toast("请填写跟进内容");return;}
  const c=DB.customers.find(x=>x.id===cid);
  DB.visits.push({id:uid(),type:"跟进",customerId:cid,date:today(),visitor:$("#ff_visitor").value,decider:$("#ff_target").value,
    situation:content,title:"跟进｜"+(c?c.name:"")+" "+today()});
  if(c)c.updatedAt=new Date().toISOString();
  save();showDetail(cid);renderVisits();renderVisited();renderCustomers();renderDash();toast("已添加跟进记录");
}
function saveLog(cid){
  const id=$("#lf_id").value, type=$("#lf_type").value;
  const c=DB.customers.find(x=>x.id===cid);
  const A=$("#lf_A").value.trim(), M=$("#lf_M").value.trim(), N=$("#lf_N").value.trim(), T=$("#lf_T").value.trim();
  if(type==="拜访"&&(!A||!M||!N||!T)){toast("新增拜访需填写 A / M / N / T 四项评估");return;}
  const title=(type==="跟进"?"跟进":"拜访")+"｜"+(c?c.name:"")+" "+$("#lf_date").value;
  const data={type,title,date:$("#lf_date").value,visitor:$("#lf_visitor").value,decider:$("#lf_target").value,
    result:$("#lf_result").value,situation:$("#lf_situation").value,A,M,N,T,nextFollow:$("#lf_next").value,customerId:cid};
  if(id){Object.assign(DB.visits.find(x=>x.id===id),data);}
  else{Object.assign(data,{id:uid(),phone:c?c.phone:"",address:c?c.address:"",position:c?c.position:""});DB.visits.push(data);}
  if(c){ if(type==="拜访")c.visited="已拜访"; c.updatedAt=new Date().toISOString(); }
  save();showDetail(cid);renderVisits();renderVisited();renderCustomers();renderDash();
  toast("已保存"+type+"记录");
}
function deleteLog(cid,vid){
  if(!confirm("确定删除该记录？"))return;
  DB.visits=DB.visits.filter(v=>v.id!==vid);
  save();showDetail(cid);renderVisits();renderDash();toast("已删除");
}

/* ===================== Modal util ===================== */
function openModal(id){$("#"+id).classList.add("show");}
function closeModal(id){$("#"+id).classList.remove("show");}
document.querySelectorAll(".modal-bg").forEach(m=>m.addEventListener("mousedown",e=>{if(e.target===m)m.classList.remove("show");}));

/* ===================== CSV import / export ===================== */
const CSV_FIELDS=[["code","编号"],["name","公司名字"],["owner","负责人"],["stage","客户阶段"],["attr","客户属性"],["region","区域"],
  ["visited","是否拜访"],["contact","联系人"],["position","职位"],["phone","电话"],
  ["tradeContact","外贸部联系人"],["tradePhone","外贸部联系电话"],["product","主营产品"],
  ["address","客户地址"],["source","客户来源"],["platformUrl","平台网址"],["siteUrl","独立站网址"],
  ["peerCase","同行案例"],["createDate","建立日期"],["nextFollow","下次跟进"],["note","备注"]];
// 兼容常见导出表头的别名（全角括号、冒号、不同叫法）
const HEADER_ALIASES={
  "name":["公司名称","公司","客户名称","客户名字","企业名称","单位名称","公司名","名称","公司全称","客户","Company","company","Name","name"],
  "owner":["业务员","跟进人","负责业务员","跟进业务员"],
  "contact":["联系人（A)","联系人(A)","联系人（A）","老板","决策人","决策人（A)","决策人(A)","联系人姓名","客户联系人"],
  "phone":["手机号","手机","联系电话","电话号码","决策人电话","联系方式","手机号码","客户电话"],
  "attr":["客户属性 "],
  "region":["区域 ","地区","所在区域"],
  "product":["主营产品 ","产品","经营产品","主营"],
  "address":["客户精准位置","精准位置","详细地址","地址","公司地址","客户位置","位置","客户地址 "],
  "source":["客户来源 ","资料来源"],
  "platformUrl":["阿里巴巴国际站","阿里国际站","阿里","阿里网址","阿里店铺","平台","店铺","平台网址 "],
  "siteUrl":["独立站网站","官网","网站","独立站","企业官网","独立站网址 "],
  "peerCase":["同行案例：","同行案例:"],
  "createDate":["建立日期 ","创建日期"],
  "note":["外贸占比/公司性质","公司性质","外贸占比","跟踪状态","跟进状态","备注 "],
  "tradeContact":["外贸联系人","经办","外贸经理","经理","外贸部经理"],
  "tradePhone":["外贸联系电话","外贸部电话","经理电话"]
};
function findCol(header,key,label){
  let i=header.indexOf(label); if(i>=0)return i;
  const al=HEADER_ALIASES[key]||[]; for(const a of al){i=header.indexOf(a);if(i>=0)return i;}
  return -1;
}
function csvCell(s){s=s==null?"":String(s);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function toCSV(headers,rows){return "﻿"+[headers.join(",")].concat(rows.map(r=>r.map(csvCell).join(","))).join("\r\n");}
function downloadFile(name,content,type){const b=new Blob([content],{type:type||"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href);}

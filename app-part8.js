function openPool(id){
  editPoolId=id||null;
  const p=id?(DB.pool||[]).find(x=>x.id===id):{};
  poolNote=(p&&p.note)||""; if($("#p_followInput"))$("#p_followInput").value=""; renderPoolFollow();
  $("#poolModalTitle").textContent=id?"编辑公海客户":"新增公海客户";
  $("#poolDeleteBtn").style.display=id?"":"none";
  $("#poolClaimBtn").style.display=id?"":"none";
  $("#p_name").value=p.name||""; $("#p_attr").value=p.attr||""; $("#p_region").value=p.region||""; $("#p_origin").value=p.origin||"";
  $("#p_contact").value=p.contact||""; $("#p_phone").value=p.phone||""; $("#p_tradeContact").value=p.tradeContact||""; $("#p_tradePhone").value=p.tradePhone||"";
  $("#p_shareholder").value=p.shareholder||""; $("#p_shareholderPhone").value=p.shareholderPhone||"";
  $("#p_product").value=p.product||""; $("#p_address").value=p.address||""; $("#p_platformUrl").value=p.platformUrl||""; $("#p_siteUrl").value=p.siteUrl||"";
  setSourceSelect("#p_source",p.source||""); $("#p_createDate").value=p.createDate||"";
  $("#poolClaimBtn").onclick=()=>{ if(editPoolId){closeModal("poolModal");claimPool(editPoolId);} };
  openModal("poolModal");
}
function savePool(){
  const name=$("#p_name").value.trim(); if(!name){toast("请填写公司名字");return;}
  if((DB.pool||[]).some(p=>p.name===name && p.id!==editPoolId)){toast("公海已有同名公司");return;}
  const data={name,attr:$("#p_attr").value,region:$("#p_region").value,origin:$("#p_origin").value,
    contact:$("#p_contact").value,phone:$("#p_phone").value,tradeContact:$("#p_tradeContact").value,tradePhone:$("#p_tradePhone").value,
    shareholder:$("#p_shareholder").value,shareholderPhone:$("#p_shareholderPhone").value,
    product:$("#p_product").value,address:$("#p_address").value,platformUrl:$("#p_platformUrl").value,siteUrl:$("#p_siteUrl").value,
    source:$("#p_source").value,createDate:$("#p_createDate").value,note:poolNote};
  data.updatedAt=new Date().toISOString();
  if(editPoolId){Object.assign(DB.pool.find(x=>x.id===editPoolId),data);}
  else{DB.pool.push(Object.assign({id:uid()},data));}
  save();closeModal("poolModal");renderPool();toast("已保存");
}
function deletePool(){
  if(!editPoolId)return;
  if(!confirm("确定从公海删除该客户？（不影响已捡入的潜在客户）"))return;
  DB.pool=DB.pool.filter(p=>p.id!==editPoolId);
  save();closeModal("poolModal");renderPool();toast("已删除");
}
// 公海 CSV 导入（适配各表表头）
const POOL_ALIASES={
  name:["公司名字","名称","公司名称","公司","客户名称","客户名字","企业名称","单位名称","公司名"],
  contact:["联系人（A)","联系人(A)","决策人（A)","决策人(A）","决策人(A)","联系人","决策人","老板","股东"],
  phone:["电话","决策人（A)电话","决策人(A)电话","联系电话","股东联系方式","手机号","手机","电话号码","手机号码"],
  attr:["客户属性"], region:["区域","地区","所在区域"], product:["主营产品","产品","经营产品"],
  address:["客户地址","公司地址","地址","客户精准位置","精准位置","详细地址","客户位置"], source:["客户来源","资料来源"],
  platformUrl:["平台网址","阿里网址","平台","阿里巴巴国际站","阿里国际站","阿里","店铺"], siteUrl:["独立站网址","独立站","独立站网站","官网","网站"],
  tradeContact:["外贸部联系人","外贸部经理","其他联系人","经办","外贸经理","经理"],
  tradePhone:["外贸部联系电话","外贸部经理人联系电话","其他联系人电话","经理电话"],
  peerCase:["同行案例：","同行案例:","同行案例"], createDate:["建立日期","日期","创建日期"]
};
function importPoolCSV(input,originName){
  const rows=Array.isArray(input)?input:parseCSV(input); if(rows.length<2)return {added:0,skip:0};
  const header=rows[0].map(h=>String(h||"").trim());
  const col={}; Object.keys(POOL_ALIASES).forEach(k=>{for(const a of POOL_ALIASES[k]){const i=header.indexOf(a);if(i>=0){col[k]=i;break;}}});
  if(col.name==null)return {error:"未找到「公司名字 / 名称」列"};
  const potentialNames=new Set(DB.customers.map(c=>c.name)); // 与潜在客户重复则跳过
  const poolByName={}; (DB.pool||[]).forEach(p=>poolByName[p.name]=p);
  const grabPhone=s=>{const m=String(s||"").match(/1[3-9]\d{9}/);return m?m[0]:"";};
  let added=0,updated=0,skip=0;
  for(let i=1;i<rows.length;i++){
    const r=rows[i]; const name=cleanName(r[col.name]); if(!name){continue;}
    if(potentialNames.has(name)){skip++;continue;}
    const f={};
    Object.keys(POOL_ALIASES).forEach(k=>{if(k!=="name"&&col[k]!=null)f[k]=String(r[col[k]]||"").trim();});
    if(!ATTRS.includes(f.attr))f.attr=f.attr||"";
    f.createDate=normDate(f.createDate);
    // 智能补全联系人/电话：优先取决策人栏"姓名 手机号"里的号，其次联系电话栏，再兜底外贸/其他联系人
    f.phone = grabPhone(f.contact) || grabPhone(f.phone) || grabPhone(f.tradePhone) || grabPhone(f.tradeContact) || f.phone || "";
    if(!f.contact) f.contact = f.tradeContact || "";
    if(f.contact) f.contact = f.contact.replace(/1[3-9]\d{9}/g,"").replace(/\s{2,}/g," ").trim();
    if(!f.tradePhone) f.tradePhone = grabPhone(f.tradeContact) || "";
    const ex=poolByName[name];
    if(ex){ // 已存在：补全空字段（不覆盖已有内容）
      let changed=false;
      ["contact","phone","attr","region","product","address","source","platformUrl","siteUrl","tradeContact","tradePhone","createDate"].forEach(k=>{ if(!ex[k]&&f[k]){ex[k]=f[k];changed=true;} });
      changed?updated++:skip++;
    } else {
      const p=Object.assign({id:uid(),name,origin:originName||"CSV导入"},f);
      DB.pool.push(p); poolByName[name]=p; added++;
    }
  }
  return {added,updated,skip};
}

/* ===================== 用户管理（管理员） ===================== */
function renderUserBox(){
  if(!CURRENT){$("#userBox").innerHTML="";return;}
  $("#userBox").innerHTML=`<span style="font-size:13px;color:var(--muted)">${esc(CURRENT.name)}（${isAdmin()?"主管":"业务员"}）</span>
    <button class="btn ghost sm" onclick="logout()">退出</button>`;
}
function renderUsers(){
  if(!isAdmin()){ $("#userList").innerHTML=`<div class="empty">仅管理员（主管）可访问</div>`; return; }
  $("#userList").innerHTML=`<table><thead><tr><th>姓名</th><th>登录用户名</th><th>角色</th><th>名下客户</th><th></th></tr></thead><tbody>${
    DB.users.map(u=>{
      const cnt=DB.customers.filter(c=>c.owner===u.name).length;
      return `<tr>
        <td style="font-weight:600">${esc(u.name)}</td>
        <td>${esc(u.username)}</td>
        <td>${pill(u.role==='admin'?'主管':'业务员', u.role==='admin'?'#7c3aed':'#0ea5e9')}</td>
        <td>${cnt}</td>
        <td><div style="display:flex;gap:6px"><button class="btn ghost sm" onclick="openUser('${u.id}')">编辑</button>${(CURRENT&&u.id!==CURRENT.id)?`<button class="btn ghost sm" style="color:var(--red)" onclick="delUser('${u.id}','${esc(u.name)}')">删除</button>`:'<span style="color:var(--muted);font-size:12px;align-self:center">（当前登录）</span>'}</div></td>
      </tr>`;
    }).join("")
  }</tbody></table>`;
}
let editUserId=null;
function openUser(id){
  if(!isAdmin())return;
  editUserId=id||null;
  const u=id?DB.users.find(x=>x.id===id):{};
  $("#userModalTitle").textContent=id?"编辑成员（姓名/角色）":"新增业务员账号";
  $("#userDeleteBtn").style.display="none";
  $("#u_name").value=u.name||""; $("#u_username").value=""; $("#u_password").value=""; $("#u_role").value=u.role||"sales";
  // 新增时填邮箱+密码建账号；编辑时只改姓名/角色（登录凭据不在这改）
  const uu=$("#u_username").parentElement, up=$("#u_password").parentElement;
  if(uu)uu.style.display=id?"none":""; if(up)up.style.display=id?"none":"";
  openModal("userModal");
}
async function saveUser(){
  const name=$("#u_name").value.trim(), role=$("#u_role").value;
  if(!name){toast("请填写姓名");return;}
  if(editUserId){ // 编辑：更新档案
    const old=DB.users.find(x=>x.id===editUserId), oldName=old.name;
    const {error}=await SB.from("profiles").update({name,role}).eq("id",editUserId);
    if(error){toast("保存失败："+error.message);return;}
    Object.assign(old,{name,role}); buildNameMaps();
    if(oldName!==name){ DB.customers.forEach(c=>{if(c.owner===oldName)c.owner=name;}); save(); }
    if(CURRENT&&CURRENT.id===editUserId){CURRENT=old;renderUserBox();}
    closeModal("userModal");renderUsers();refreshDynamic();renderCustomers();toast("已保存");
    return;
  }
  // 新增账号：用独立客户端注册，避免顶掉当前管理员登录
  const email=$("#u_username").value.trim(), pass=$("#u_password").value;
  if(!email||!pass){toast("请填写登录邮箱和密码");return;}
  if(pass.length<6){toast("密码至少 6 位");return;}
  toast("正在创建账号…");
  // 用「仅管理员可调用」的数据库函数创建账号（无需开放注册）
  const {error}=await SB.rpc("admin_create_user",{p_email:email,p_password:pass,p_name:name,p_role:role});
  if(error){ toast("创建失败："+error.message+(/admin_create_user|does not exist|schema cache/i.test(error.message)?"（请先在 Supabase 运行新增账号的 SQL）":"")); return; }
  const pf=await SB.from("profiles").select("*");
  DB.users=(pf.data||[]).map(r=>({id:r.id,name:r.name,role:r.role,username:r.name})); buildNameMaps();
  closeModal("userModal");renderUsers();refreshDynamic();
  toast("账号已创建："+email+"（"+name+" · "+(role==="admin"?"主管":"业务员")+"）");
}
function deleteUser(){ toast("请在用户列表里点该成员的「删除」按钮"); }
async function delUser(id,name){
  if(!isAdmin())return;
  if(CURRENT&&CURRENT.id===id){toast("不能删除当前登录的自己");return;}
  const cnt=DB.customers.filter(c=>c.owner===name).length;
  if(!confirm("确定删除账号「"+name+"」？\n删除后该账号无法再登录。"+(cnt?"\n其名下 "+cnt+" 家客户不会被删除，会保留（可由管理员转交他人）。":"")))return;
  toast("正在删除…");
  const {error}=await SB.rpc("admin_delete_user",{target:id});
  if(error){ toast("删除失败："+error.message+(/function.*admin_delete_user|does not exist|schema cache/i.test(error.message)?"（请先在 Supabase 运行删除账号的 SQL）":"")); return; }
  DB.users=DB.users.filter(u=>u.id!==id); buildNameMaps(); renderUsers(); refreshDynamic();
  toast("已删除账号："+name);
}
function clearAll(){if(!confirm("确定清空全部数据？此操作不可恢复（建议先导出备份）。"))return;
  DB={customers:[],visits:[],seq:0};save();refreshDynamic();renderDash();renderCustomers();renderVisits();toast("已清空");}

/* ===================== Init ===================== */
function initSelects(){
  fillSelect($("#c_stage"),STAGES);fillSelect($("#c_attr"),ATTRS,"未设置");fillSelect($("#c_region"),REGIONS,"未设置");
  fillSelect($("#c_position"),POSITIONS,"未设置");
  fillSelect($("#p_attr"),ATTRS,"未设置");fillSelect($("#p_region"),REGIONS,"未设置");
  fillSelect($("#v_position"),POSITIONS,"未设置");fillSelect($("#v_result"),RESULTS,"未设置");
  fillSelect($("#filterStage"),STAGES,"全部阶段");fillSelect($("#filterRegion"),REGIONS,"全部区域");
  fillSelect($("#filterAttr"),ATTRS,"全部属性");fillSelect($("#filterResult"),RESULTS,"全部结果");
  fillSelect($("#poolRegion"),REGIONS,"全部区域");fillSelect($("#poolAttr"),ATTRS,"全部属性");
  refreshDynamic();
}
["custSearch","filterOwner","filterStage","filterRegion","filterAttr"].forEach(id=>document.addEventListener("input",e=>{if(e.target.id===id){PAGE.customers=1;renderCustomers();}}));
["visitSearch","filterResult"].forEach(id=>document.addEventListener("input",e=>{if(e.target.id===id){PAGE.visits=1;renderVisits();}}));
["visitedSearch","visitedOwner"].forEach(id=>document.addEventListener("input",e=>{if(e.target.id===id){PAGE.visited=1;renderVisited();}}));
["poolSearch","poolRegion","poolAttr"].forEach(id=>document.addEventListener("input",e=>{if(e.target.id===id){PAGE.pool=1;renderPool();}}));
["wonSearch","wonOwner"].forEach(id=>document.addEventListener("input",e=>{if(e.target.id===id){PAGE.won=1;renderWon();}}));
["mobaiSearch","mobaiOwner"].forEach(id=>document.addEventListener("input",e=>{if(e.target.id===id){PAGE.mobai=1;renderMobai();}}));
$("#segList").onclick=()=>{custView="list";$("#segList").classList.add("active");$("#segKanban").classList.remove("active");renderCustomers();};
$("#segKanban").onclick=()=>{custView="kanban";$("#segKanban").classList.add("active");$("#segList").classList.remove("active");renderCustomers();};

initSelects();
// 恢复 Supabase 登录会话；无会话则显示登录页
(async function(){
  if(!SB){ showLogin(); $("#loginErr").textContent="Supabase SDK 未加载（需联网）"; return; }
  try{
    const {data:{session}}=await SB.auth.getSession();
    if(session&&session.user){ await afterAuth(session.user); return; }
  }catch(e){}
  showLogin();
})();
// 登录页回车提交
$("#login_pass").addEventListener("keydown",e=>{if(e.key==="Enter")login();});
$("#login_user").addEventListener("keydown",e=>{if(e.key==="Enter")$("#login_pass").focus();});

  if(window.mammoth)return Promise.resolve(window.mammoth);
  if(_mammothLoad)return _mammothLoad;
  _mammothLoad=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js";
    s.onload=()=>window.mammoth?resolve(window.mammoth):reject(new Error("Word 解析库加载失败"));
    s.onerror=()=>{_mammothLoad=null;reject(new Error("Word 解析库加载失败（需联网）"));};
    document.head.appendChild(s);
  });
  return _mammothLoad;
}
function readArrayBuffer(file){return new Promise((res,rej)=>{const rd=new FileReader();rd.onerror=()=>rej(new Error("文件读取失败"));rd.onload=()=>res(rd.result);rd.readAsArrayBuffer(file);});}
/* 从 Word 转出的 HTML 里取第一张表格 → 二维数组（首行表头） */
function htmlFirstTableRows(html){
  const doc=new DOMParser().parseFromString(html,"text/html");
  const table=doc.querySelector("table"); if(!table)return null;
  const rows=[];
  table.querySelectorAll("tr").forEach(tr=>{
    const cells=[...tr.querySelectorAll("th,td")].map(td=>td.textContent.replace(/\s+/g," ").trim());
    if(cells.some(c=>c!==""))rows.push(cells);
  });
  return rows.length?rows:null;
}
$("#poolWordImportFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    toast("正在解析 Word…");
    const mammoth=await ensureMammoth();
    const origin=file.name.replace(/\.docx?$/i,"").replace(/\s+[0-9a-f]{32}$/i,"").trim();
    const {value:html}=await mammoth.convertToHtml({arrayBuffer:await readArrayBuffer(file)});
    const rows=htmlFirstTableRows(html);
    if(rows){ // 表格：复用 Excel/CSV 公海导入逻辑
      const res=importPoolCSV(rows, origin);
      if(res.error){toast("Word 表格："+res.error);}
      else{ save();renderPool();refreshDynamic();toast("Word 导入完成（表格）：新增 "+res.added+" 家"+(res.updated?"，补全 "+res.updated+" 家":"")+(res.skip?"，跳过 "+res.skip+" 家":"")); }
    } else { // 无表格：先按阿里金品格式（序号独占一行），否则回退通用名单解析
      const {value:text}=await mammoth.extractRawText({arrayBuffer:await readArrayBuffer(file)});
      let recs=parseAliDocx(text);
      if(recs.length<2) { const alt=parseNameListTxt(text); if(alt.length>recs.length) recs=alt; }
      if(!recs.length){toast("未从该 Word 解析出公司（既无「公司名字」表格，也非可识别的名单格式）");e.target.value="";return;}
      const poolNames=new Set((DB.pool||[]).map(p=>p.name)), custNames=new Set(DB.customers.map(c=>c.name)), seen=new Set();
      let added=0,skip=0;
      recs.forEach(r=>{
        if(!r.name||poolNames.has(r.name)||custNames.has(r.name)||seen.has(r.name)){skip++;return;}
        seen.add(r.name);
        DB.pool.push(Object.assign({id:uid(),origin,attr:"",updatedAt:new Date().toISOString()},r));
        added++;
      });
      save();renderPool();refreshDynamic();
      toast("Word 导入完成（名单）：解析 "+recs.length+" 家，新增 "+added+" 家"+(skip?"，跳过 "+skip+" 家":""));
    }
  }catch(err){toast("导入失败："+err.message);}
  e.target.value="";
});

/* ===================== 业务员自助导入（归自己名下的潜在客户） ===================== */
// 自由文本：先阿里金品格式，回退通用名单
function parseFreeTextRecs(text){
  let r=parseAliDocx(text);
  if(r.length<2){ const alt=parseNameListTxt(text); if(alt.length>r.length) r=alt; }
  return r;
}
// 表格（Excel/CSV/Word表格）→ 客户记录（忽略「负责人」列）
function tableToCustomerRecs(rows){
  if(!rows||rows.length<2) return [];
  const header=rows[0].map(h=>String(h||"").trim());
  const map={}; CSV_FIELDS.forEach(f=>{const i=findCol(header,f[0],f[1]);if(i>=0)map[f[0]]=i;});
  if(map.name==null) return null;   // 无「公司名字」列
  const recs=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i], rec={};
    CSV_FIELDS.forEach(f=>{if(f[0]==="code"||f[0]==="owner")return;const idx=map[f[0]];if(idx!=null)rec[f[0]]=String(r[idx]||"").trim();});
    if((rec.name||"").trim()) recs.push(rec);
  }
  return recs;
}
// 把记录写入 DB.customers，负责人一律设为当前登录人
function addMyCustomers(recs){
  const owner=CURRENT?CURRENT.name:"";
  const existing=new Set(DB.customers.map(c=>c.name));
  let added=0,skip=0;
  (recs||[]).forEach(r=>{
    const name=cleanName(r.name); if(!name){skip++;return;}
    if(existing.has(name)){skip++;return;}
    let stage=STAGES.includes(r.stage)?r.stage:"潜在客户";
    let visited=r.visited==="已拜访"?"已拜访":"未拜访";
    DB.customers.push({id:uid(),code:nextCode(),name,owner,isPublic:false,stage,visited,
      attr:r.attr||"",region:r.region||"",contact:r.contact||"",position:r.position||"",phone:r.phone||"",
      tradeContact:r.tradeContact||"",tradePhone:r.tradePhone||"",product:r.product||"",address:r.address||"",
      source:r.source||"",platformUrl:r.platformUrl||"",siteUrl:r.siteUrl||"",peerCase:r.peerCase||"",
      note:r.note||"",createDate:normDate(r.createDate||""),nextFollow:normDate(r.nextFollow||"")});
    existing.add(name); added++;
  });
  if(added){ save(); refreshDynamic(); renderCustomers(); renderDash(); }
  return {added,skip};
}
function myImportDone(res){ toast("已导入到我的客户：新增 "+res.added+" 家"+(res.skip?"，跳过重复/无名 "+res.skip+" 家":"")+(res.added?"（负责人："+(CURRENT?CURRENT.name:"")+"）":"")); }
// Excel / CSV
$("#myImportFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const rows=await readTableFile(file);
    const recs=tableToCustomerRecs(rows);
    if(recs===null){toast("未找到「公司名字」列，请检查表头");e.target.value="";return;}
    if(!recs.length){toast("文件为空或无数据行");e.target.value="";return;}
    myImportDone(addMyCustomers(recs));
  }catch(err){toast("导入失败："+err.message);}
  e.target.value="";
});
// Word（.docx）：有表格按表格，否则按自由文本
$("#myWordFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    toast("正在解析 Word…");
    const mammoth=await ensureMammoth();
    const {value:html}=await mammoth.convertToHtml({arrayBuffer:await readArrayBuffer(file)});
    const rows=htmlFirstTableRows(html);
    let recs;
    if(rows){ recs=tableToCustomerRecs(rows); if(recs===null){toast("Word 表格未找到「公司名字」列");e.target.value="";return;} }
    else { const {value:text}=await mammoth.extractRawText({arrayBuffer:await readArrayBuffer(file)}); recs=parseFreeTextRecs(text); }
    if(!recs.length){toast("未从该 Word 解析出公司");e.target.value="";return;}
    myImportDone(addMyCustomers(recs));
  }catch(err){toast("导入失败："+err.message);}
  e.target.value="";
});
// TXT 名单
$("#myTxtFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const text=await readTxtFile(file);
    const recs=parseFreeTextRecs(text);
    if(!recs.length){toast("未从该 TXT 解析出公司，请确认是「一段一家公司」的名单格式");e.target.value="";return;}
    myImportDone(addMyCustomers(recs));
  }catch(err){toast("导入失败："+err.message);}
  e.target.value="";
});

/* ===================== Backup ===================== */
function exportBackup(){downloadFile("CRM备份_"+today()+".json",JSON.stringify(DB,null,2),"application/json");toast("备份已导出");}
$("#restoreFile").addEventListener("change",e=>{
  const file=e.target.files[0];if(!file)return;
  const rd=new FileReader();
  rd.onload=()=>{try{const d=JSON.parse(rd.result);
    if(!d.customers)throw new Error("格式不正确");
    if(!confirm("恢复备份将覆盖当前全部数据，确定？"))return;
    DB=Object.assign({customers:[],visits:[],seq:0},d);save();initSelects();renderDash();renderCustomers();renderVisits();toast("已恢复备份");
  }catch(err){toast("恢复失败："+err.message);}e.target.value="";};
  rd.readAsText(file,"utf-8");
});

/* ===================== Sample / clear ===================== */
function loadSample(){
  if(DB.customers.length && !confirm("将追加示例数据，继续？"))return;
  const samples=[
    {name:"宁波示例进出口有限公司",stage:"跟进中",attr:"A+M+",region:"慈溪",visited:"已拜访",contact:"张总",position:"A+",phone:"13800000001",product:"家用电器",address:"宁波市慈溪市××工业园1号",source:"阿里巴巴",platformUrl:"https://example.1688.com",siteUrl:"https://example.com",peerCase:"已合作同类客户A、B",createDate:"2026-06-01",nextFollow:addDays(2),note:"对独立站建站有意向，需二次报价"},
    {name:"余姚某塑料制品厂",stage:"潜在客户",attr:"A-M+",region:"余姚",visited:"未拜访",contact:"李经理",position:"外贸经理",phone:"13800000002",product:"塑料注塑件",address:"宁波市余姚市××路66号",source:"展会",createDate:"2026-06-20",nextFollow:addDays(-1),note:"展会换名片，待电话回访"},
    {name:"北仑精密机械有限公司",stage:"已报价",attr:"A+M-",region:"北仑",visited:"已拜访",contact:"王厂长",position:"小老板",phone:"13800000003",product:"精密五金件",address:"宁波市北仑区××大道88号",source:"转介绍",createDate:"2026-05-12",nextFollow:addDays(5),note:"已报价待回复"},
    {name:"慈溪小家电出口商",stage:"已成交",attr:"A+M+",region:"慈溪",visited:"已拜访",contact:"陈总",position:"A",phone:"13800000004",product:"小家电",address:"宁波市慈溪市观海卫镇",source:"官网",createDate:"2026-03-08",note:"已签年度合作"}
  ];
  samples.forEach(s=>DB.customers.push(Object.assign({id:uid(),code:nextCode()},s)));
  const c0=DB.customers[DB.customers.length-4];
  DB.visits.push({id:uid(),title:"首次上门拜访—"+c0.name,customerId:c0.id,date:"2026-06-15",visitor:"业务一部",decider:"张总",position:"A+",phone:c0.phone,address:c0.address,situation:"面谈顺利，客户对独立站建站及推广感兴趣，现以阿里平台为主。",result:"有意向",nextFollow:addDays(2)});
  save();renderDash();renderCustomers();renderVisits();toast("示例数据已载入");
}
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}

/* 从字符串里提取干净的网址 */
function cleanUrl(s){ if(!s)return""; s=String(s);
  const m=s.match(/https?:\/\/[^\s)\]，、）]+/); if(m)return m[0];
  const m2=s.match(/www\.[^\s)\]，、）]+/); return m2?("http://"+m2[0]):""; }


/* 已拜访客户类目 —— 按公司去重，每家一行（取最近一次拜访 + 拜访次数） */

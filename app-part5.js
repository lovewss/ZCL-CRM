function exportCustomersCSV(){
  const rows=DB.customers.map(c=>CSV_FIELDS.map(f=>c[f[0]]||""));
  downloadFile("客户库.csv",toCSV(CSV_FIELDS.map(f=>f[1]),rows));toast("已导出客户 CSV");
}
function exportVisitsCSV(){
  const h=["拜访主题","关联客户","拜访日期","拜访人","决策人","职位","电话","公司地址","拜访情况","跟进结果","下次跟进"];
  const rows=DB.visits.map(v=>[v.title,custName(v.customerId),v.date,v.visitor,v.decider,v.position,v.phone,v.address,v.situation,v.result,v.nextFollow]);
  downloadFile("拜访记录.csv",toCSV(h,rows));toast("已导出拜访 CSV");
}
function downloadTemplate(){
  const sample=["示例公司有限公司","跟进中","A+M+","慈溪","未拜访","张三","A+","13800000000","家用电器","××路1号","阿里巴巴","","","","2026-06-01","2026-07-01","备注示例"];
  const headers=CSV_FIELDS.filter(f=>f[0]!=="code").map(f=>f[1]);
  downloadFile("客户导入模板.csv",toCSV(headers,[sample]));toast("模板已下载");
}
function parseCSV(text){
  text=text.replace(/^﻿/,"");
  const rows=[];let row=[],cur="",q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}
    else{if(ch==='"')q=true;else if(ch===','){row.push(cur);cur="";}
      else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur="";}
      else if(ch==='\r'){}else cur+=ch;}
  }
  if(cur!==""||row.length){row.push(cur);rows.push(row);}
  return rows.filter(r=>r.some(c=>c.trim()!==""));
}
/* 读取表格文件：支持 .xlsx/.xls（Excel）与 .csv（自动识别 UTF-8 / GBK 编码） */
function readTableFile(file){
  return new Promise((resolve,reject)=>{
    const rd=new FileReader();
    rd.onerror=()=>reject(new Error("文件读取失败"));
    rd.onload=()=>{
      try{
        const buf=rd.result;
        if(/\.xlsx?$|\.xls$/i.test(file.name)){
          if(typeof XLSX==="undefined")return reject(new Error("Excel 解析库未加载，请检查网络后重试"));
          const wb=XLSX.read(buf,{type:"array"});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""}).map(r=>r.map(c=>String(c==null?"":c)));
          return resolve(rows.filter(r=>r.some(c=>String(c).trim()!=="")));
        }
        // CSV：先按 UTF-8 解码，若乱码或找不到关键表头则回退 GBK
        let text=new TextDecoder("utf-8").decode(buf);
        const looksBad=t=>{const first=(t.split(/\r?\n/)[0]||"");return t.includes("�")||!(first.includes("公司")||first.includes("名称")||first.includes("name"));};
        if(looksBad(text)){
          try{ const gbk=new TextDecoder("gb18030").decode(buf); if(!looksBad(gbk))text=gbk; else if(text.includes("�"))text=gbk; }catch(_){}
        }
        resolve(parseCSV(text));
      }catch(err){reject(err);}
    };
    rd.readAsArrayBuffer(file);
  });
}
/* 日期归一化：2026/6/1、2026.6.1、2026年6月1日 → 2026-06-01；无效 → 空 */
function normDate(s){
  s=String(s||"").trim(); if(!s)return "";
  const m=s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if(m)return m[1]+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[3]).padStart(2,"0");
  return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:"";
}
$("#importFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  {
    try{
      const rows=await readTableFile(file);
      if(rows.length<2){toast("文件为空或无数据行");return;}
      const header=rows[0].map(h=>h.trim());
      const map={};CSV_FIELDS.forEach(f=>{const i=findCol(header,f[0],f[1]);if(i>=0)map[f[0]]=i;});
      if(map.name==null){toast("未找到「公司名字」列，请检查表头");return;}
      const existing=new Set(DB.customers.map(c=>c.name));
      let added=0,skip=0;
      for(let i=1;i<rows.length;i++){
        const r=rows[i];let name=cleanName(r[map.name]);if(!name)continue;
        if(existing.has(name)){skip++;continue;}
        const obj={id:uid(),code:nextCode()};
        CSV_FIELDS.forEach(f=>{if(f[0]==="code")return;const idx=map[f[0]];if(idx!=null)obj[f[0]]=(r[idx]||"").trim();});
        obj.name=name;
        if(obj.visited==="已见访")obj.visited="已拜访"; if(obj.visited==="未见访")obj.visited="未拜访";
        if(!STAGES.includes(obj.stage))obj.stage="潜在客户";
        if(!obj.visited)obj.visited="未拜访";
        obj.createDate=normDate(obj.createDate); obj.nextFollow=normDate(obj.nextFollow);
        if(!obj.owner) obj.owner=CURRENT?CURRENT.name:"";   // 未指定负责人 → 归导入人
        DB.customers.push(obj);existing.add(name);added++;
      }
      save();refreshDynamic();renderCustomers();renderDash();toast("导入完成：新增 "+added+" 家"+(skip?"，跳过重复 "+skip+" 家":""));
    }catch(err){toast("导入失败："+err.message);}
    e.target.value="";
  }
});
$("#poolImportFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const rows=await readTableFile(file);
    const origin=file.name.replace(/\.(csv|xlsx?|xls)$/i,"").replace(/\s+[0-9a-f]{32}$/i,"").trim();
    const res=importPoolCSV(rows, origin);
    if(res.error){toast(res.error);} else { save();renderPool();toast("公海导入完成：新增 "+res.added+" 家"+(res.updated?"，补全 "+res.updated+" 家":"")+(res.skip?"，跳过 "+res.skip+" 家":"")); }
  }catch(err){toast("导入失败："+err.message);}
  e.target.value="";
});

/* ===== TXT 名单导入到公海：解析「一段一家公司」的自由文本 ===== */
function readTxtFile(file){
  return new Promise((resolve,reject)=>{
    const rd=new FileReader();
    rd.onerror=()=>reject(new Error("文件读取失败"));
    rd.onload=()=>{ try{ const buf=rd.result; let t=new TextDecoder("utf-8").decode(buf); if(t.includes("�")){ try{ t=new TextDecoder("gb18030").decode(buf); }catch(_){}} resolve(t); }catch(err){reject(err);} };
    rd.readAsArrayBuffer(file);
  });
}
const NL_REGIONS=["慈溪","余姚","北仑","镇海","江北","海曙","奉化","宁海","象山","绍兴"];
function nlRegion(a){ if(!a)return ""; for(const r of NL_REGIONS){ if(a.includes(r))return r; }
  if(/柯桥|越城|诸暨|新昌|上虞|嵊州|袍江|岳城/.test(a))return "绍兴";
  if(/鄞州|东钱湖|高新|首南|潘火|五乡/.test(a))return "市区";
  if(a.includes("宁波"))return "市区"; if(a.includes("杭州"))return "市外"; return ""; }
function nlPhone(s){ const m=String(s).match(/(?<!\d)1[3-9]\d{9}(?!\d)/); return m?m[0]:""; }
function nlAli(s){ const m=String(s).match(/https?:\/\/[A-Za-z0-9.\-]+\.alibaba\.com/); return m?m[0]:""; }
function nlUrl(s){ let m=String(s).match(/https?:\/\/[^\s，、）)]+/); if(m)return m[0].split(/[^\x00-\x7f]/)[0];
  m=String(s).match(/((?:www\.)?[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})*)/); return m?m[1]:""; }
const NL_STATUS=/(存续|在业|曾用名|小微企业|企业集团|高新技术企业|企业族群|注销|吊销)/;
function parseNameListTxt(text){
  text=String(text).replace(/\r\n/g,"\n");
  const blocks=("\n"+text).split(/\n(?=\d+[.、．]?[ \t　]*[一-龥A-Za-z])/).map(b=>b.trim()).filter(Boolean);
  const out=[];
  for(const b of blocks){
    const lines=b.split("\n").map(l=>l.trim()).filter(Boolean);
    if(!lines.length)continue;
    let name=lines[0].replace(/^\d+\.?\s*/,"").trim();
    if(!/(公司|厂|合伙|中心)/.test(name)){   // 金品格式：首行是英文名，找含公司/厂的中文行
      for(const l of lines.slice(0,6)){ const cn=l.split(NL_STATUS)[0].trim(); if(/(公司|厂|合伙|中心)/.test(cn)){ name=cn; break; } }
    } else { name=name.split(NL_STATUS)[0].trim(); }
    if(!/(公司|厂|合伙|中心)/.test(name))continue;
    name=cleanName(name); if(!name)continue;
    let contact="",phone="",addr="",addr2="",plat="",site="",site2="",prod=[],coll=false;
    for(const l of lines){
      if(l.startsWith("法定代表人")||l.startsWith("经营者")){ const m=l.match(/[：:]\s*([^\s，,、%0-9]+)/); if(m&&!contact)contact=m[1]; if(!phone)phone=nlPhone(l); }
      else if(l.startsWith("注册地址")){ addr=l.replace(/^注册地址[：:]\s*/,"").trim(); }
      else if(l.startsWith("地址")){ addr2=l.replace(/^地址[：:]\s*/,"").trim(); }
      else if(l.startsWith("阿里")){ plat=nlAli(l); }
      else if(l.startsWith("alibaba.com")){ const m=l.match(/([A-Za-z0-9\-]+\.[A-Za-z0-9.\-]*alibaba\.com[A-Za-z0-9./]*)/); if(m)plat="https://"+m[1]; }
      else if(l.startsWith("企业官网")){ const v=l.replace(/^企业官网[：:]\s*/,"").trim(); if(v&&v!=="--"&&v!=="-")site=nlUrl(v); }
      else if(l.startsWith("官网")){ const v=l.replace(/^官网[：:]\s*/,"").trim(); if(v&&v!=="--"&&v!=="-")site2=nlUrl(v); }
      else if(l.startsWith("主营产品")||l.startsWith("主要分类")){ prod.push(l.replace(/^(主营产品|主要分类)[：:]\s*/,"").trim()); coll=true; }
      else if(l==="产品"){ coll=true; }
      else if(coll){ if(/^(主营市场|主要市场|注册资本|资金数额|成立|年营业|企业官网|阿里|官网|网站|电话|邮箱|信用代码|联系|地址|信息|服务|中国制造|Tel|Fax|\+?86|\d{4}-)/.test(l))coll=false; else prod.push(l.trim()); }
    }
    if(!phone)phone=nlPhone(b);
    let product=prod.filter(Boolean).join("、").replace(/，/g,"、"); if(product.length>380)product=product.slice(0,380);
    const address=(addr||addr2).trim();
    out.push({name,region:nlRegion(address||name),contact,phone,product,address,platformUrl:plat,siteUrl:(site||site2)});
  }
  return out;
}
/* 阿里金品导出（Word）专用解析：每家以「序号.」独占一行分隔；裸阿里链接、裸产品行等 */
const ALI_NOISE=/^(营业|存续|在业|注销|吊销|标签|来自|年报|其他|暂无跟进|注册资本|成立时间|年营业额|企业官网|注册地址|地址|法定代表人|经营者|电话|邮箱|统一社会|信用代码|联系)/;
function parseAliDocx(text){
  const L=String(text).replace(/\r\n/g,"\n").split("\n").map(s=>s.trim());
  const idx=[]; L.forEach((l,i)=>{ if(/^\d{1,3}[.．、]?$/.test(l)) idx.push(i); });
  if(!idx.length) return [];
  const out=[];
  for(let k=0;k<idx.length;k++){
    const lines=L.slice(idx[k]+1, (k+1<idx.length)?idx[k+1]:L.length).filter(Boolean);
    if(!lines.length) continue;
    let name="";
    for(const l of lines){ if(/(公司|厂|合伙|中心)/.test(l) && !/alibaba\.com|https?:/i.test(l)){ name=l.split(/(存续|在业|注销|吊销|营业)/)[0].trim(); break; } }
    name=cleanName(name); if(!name) continue;
    let platformUrl="",note="",contact="",phone="",site="",address="",prodExplicit="";
    const prodBare=[]; let afterAddr=false;
    for(const l of lines){
      if(/alibaba\.com/i.test(l)){ if(!platformUrl){const m=l.match(/https?:\/\/[A-Za-z0-9.\-]+\.alibaba\.com[^\s，、）)]*/i); if(m)platformUrl=m[0];} const r=l.match(/\d+金\d*星?|\d+星/); if(r&&!note)note=r[0]; afterAddr=false; continue; }
      if(/^(法定代表人|经营者)[：:]/.test(l)){ const m=l.replace(/^(法定代表人|经营者)[：:]\s*/,"").match(/^([^\s\d%＊*]+)/); if(m&&!contact)contact=m[1]; if(!phone){const p=l.match(/1[3-9]\d{9}/);if(p)phone=p[0];} afterAddr=false; continue; }
      if(/^企业官网[：:]/.test(l)){ const v=l.replace(/^企业官网[：:]\s*/,"").trim(); if(v&&v!=="--"&&v!=="-"&&!site)site=nlUrl(v); afterAddr=false; continue; }
      if(/^(注册地址|地址)[：:]/.test(l)){ if(!address)address=l.replace(/^(注册地址|地址)[：:]\s*/,"").trim(); afterAddr=true; continue; }
      if(/^主营产品[：:]/.test(l)){ if(!prodExplicit)prodExplicit=l.replace(/^主营产品[：:]\s*/,"").trim(); afterAddr=false; continue; }
      if(!phone){ const p=l.match(/(?<!\d)1[3-9]\d{9}(?!\d)/); if(p)phone=p[0]; }
      if(afterAddr && !ALI_NOISE.test(l) && !/^\d/.test(l) && !/[%＊]|\*\*|·/.test(l)) prodBare.push(l);
    }
    let product=prodExplicit || prodBare.join("、"); if(product.length>380)product=product.slice(0,380);
    out.push({name,region:nlRegion(address||name),contact,phone,product,address,platformUrl,siteUrl:site,note});
  }
  return out;
}
$("#poolTxtImportFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const text=await readTxtFile(file);
    const recs=parseNameListTxt(text);
    if(!recs.length){toast("未从该 TXT 解析出公司，请确认是「一段一家公司」的名单格式");e.target.value="";return;}
    const origin=file.name.replace(/\.txt$/i,"").replace(/\s+[0-9a-f]{32}$/i,"").trim();
    const poolNames=new Set((DB.pool||[]).map(p=>p.name)), custNames=new Set(DB.customers.map(c=>c.name)), seen=new Set();
    let added=0,skip=0;
    recs.forEach(r=>{
      if(!r.name||poolNames.has(r.name)||custNames.has(r.name)||seen.has(r.name)){skip++;return;}
      seen.add(r.name);
      DB.pool.push(Object.assign({id:uid(),origin,attr:"",updatedAt:new Date().toISOString()},r));
      added++;
    });
    save();renderPool();refreshDynamic();
    toast("TXT 导入完成：解析 "+recs.length+" 家，新增 "+added+" 家"+(skip?"，跳过 "+skip+" 家":""));
  }catch(err){toast("导入失败："+err.message);}
  e.target.value="";
});

/* ===== Word（.docx）导入到公海：有表格→按表格逐行；无表格→按「一段一家公司」文本 ===== */
let _mammothLoad=null;
function ensureMammoth(){

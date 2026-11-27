/* مخطط التسجيل الذكي: جلب الشعب من Banner عبر متصفح الطالب.
   يعمل داخل صفحة Banner بعد الضغط على الإشارة المرجعية «شعب KFU».
   لا يرسل شيئاً إلا إلى صفحة المخطط نفسها، ولا يقرأ إلا جداول الشعب العامة.
   منطق التحليل مطابق لـ build_sections.py حتى يخرج الملف نفسه. */
(async()=>{
const ME=document.currentScript&&document.currentScript.src||'https://pluto066.github.io/ku-planner/bm.js';
const W=ME.replace(/bm\.js.*$/,''),O=new URL(W).origin;
const DEFCOLS=['00','01','02','06','08','09','22','33','74'],SEXES=['11','12'];
const DAYS='حنثرخ',TYPES=new Set(['نظري','عملي','بحث','اختياري','تدريب','محاضرة','معمل']);
const HOST_OK=/(^|\.)kfu\.edu\.sa$/.test(location.hostname)||location.hostname=='127.0.0.1';

/* ---------- الواجهة ---------- */
const old=document.getElementById('kubm');if(old)old.remove();
const box=document.createElement('div');box.id='kubm';box.dir='rtl';box.lang='ar';
box.innerHTML=`<style>
#kubm{all:initial;position:fixed;top:16px;left:16px;z-index:2147483647;width:min(400px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;
 background:#fff;color:#1d1719;border-radius:18px;padding:18px;font:14px/1.75 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;box-shadow:0 18px 50px rgba(30,5,12,.35),0 0 0 1px rgba(141,20,48,.18);direction:rtl;text-align:right}
#kubm *{box-sizing:border-box;font-family:inherit}
#kubm .h{display:flex;align-items:center;gap:10px;margin-bottom:10px}
#kubm .lg{width:34px;height:34px;border-radius:10px;background:linear-gradient(140deg,#56081b,#8a132e 58%,#ab2644);display:grid;place-items:center;color:#e3bd68;font-weight:800;flex:none}
#kubm .h b{display:block;font-size:15.5px}#kubm .h small{display:block;color:#807277;font-size:12px}
#kubm .x{margin-inline-start:auto;border:0;background:none;color:#807277;font-size:20px;cursor:pointer;padding:2px 6px;line-height:1}
#kubm .pb{height:8px;border-radius:8px;background:#f0e8e6;overflow:hidden;margin:6px 0 10px}
#kubm .pb i{display:block;height:100%;width:0;border-radius:8px;background:linear-gradient(90deg,#8d1430,#e3bd68);transition:width .3s}
#kubm .st{font-size:13px;color:#4a3f43;min-height:22px}
#kubm .big{font-size:26px;font-weight:800;color:#15803d;line-height:1.3}
#kubm .er{color:#b42318}
#kubm .bt{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
#kubm button.p{flex:1;border:0;border-radius:12px;padding:11px 14px;background:#8d1430;color:#fff;font-weight:700;font-size:14.5px;cursor:pointer}
#kubm button.p:disabled{background:#15803d;cursor:default}
#kubm button.s{border:1px solid #e9e0dd;border-radius:12px;padding:10px 12px;background:#fff;color:#8d1430;font-size:13px;cursor:pointer}
#kubm .nt{margin-top:10px;font-size:12px;color:#807277}
#kubm .ok{color:#15803d;font-weight:700}
</style><div class="h"><span class="lg">✓</span><div><b>تحديث الشعب من جهازك</b><small>مخطط التسجيل الذكي</small></div><button class="x" aria-label="إغلاق">×</button></div>
<div class="pb"><i></i></div><div class="st" id="kubst">جارٍ التحضير…</div><div id="kubout"></div>`;
document.body.appendChild(box);
const $k=s=>box.querySelector(s),setSt=(t,e)=>{const s=$k('#kubst');s.textContent=t;s.className='st'+(e?' er':'')},setP=p=>$k('.pb i').style.width=Math.round(p*100)+'%';
$k('.x').onclick=()=>box.remove();
if(!HOST_OK){setSt('افتح صفحة جدول الشعب في Banner أولاً، ثم اضغط «شعب KFU» وأنت فيها.',1);return}

/* ---------- أدوات مطابقة لسكربت البايثون ---------- */
const dec=b=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(b)}catch(e){return new TextDecoder('windows-1256').decode(b)}};
const AR='٠١٢٣٤٥٦٧٨٩',asc=s=>s.replace(/[٠-٩]/g,d=>AR.indexOf(d));
const isDig=s=>s.length>0&&/^[0-9٠-٩]+$/.test(s);
const toInt=s=>/^\s*[+-]?[0-9٠-٩]+\s*$/.test(s)?parseInt(asc(s.trim()),10):null;
const tm=x=>toInt(x.slice(0,2))*60+toInt(x.slice(2,4));
const norm=s=>s.replace(/\s+/g,' ').trim();
function rows(html){const d=new DOMParser().parseFromString(html,'text/html'),out=[];
 d.querySelectorAll('tr').forEach(tr=>{const td=[];for(const c of tr.children)if(c.tagName=='TD')td.push(norm(c.textContent));out.push(td)});return out}
const NMC={};
function banner(html,m,sx){for(const t of rows(html)){
 if(t.length!=13||!isDig(t[1]))continue;
 const u=toInt(t[5]),k=sx+':'+t[1];
 let o=m.get(k);if(!o){o={num:t[0],crn:t[1],sec:t[2],st:t[3],u:u==null?0:u,t:t[9],col:t[11],maj:t[12],m:[]};if(sx)o.sx=sx;m.set(k,o)}
 if(t[4]&&!(t[0] in NMC))NMC[t[0]]=t[4];
 const ab=t[8].split('-').map(x=>x.trim());
 if(ab.length!=2||!ab.every(x=>isDig(x.slice(0,4))))continue;
 for(const ch of t[6].split(/\s+/).filter(Boolean)){const d=DAYS.indexOf(ch);const q={d,s:tm(ab[0]),e:tm(ab[1])};
  if(d>=0&&!o.m.some(z=>z.d==q.d&&z.s==q.s&&z.e==q.e))o.m.push(q)}}}
function namesFrom(secs){const nums=new Set(secs.map(x=>x.num)),cnt={};
 for(const n of nums)if(NMC[n])(cnt[NMC[n]]=cnt[NMC[n]]||new Set()).add(n);
 const out={};for(const n of [...nums].sort()){const v=NMC[n];if(v&&!TYPES.has(v)&&/[؀-ۿ]{3}/.test(v)&&cnt[v].size<=3)out[n]=v}return out}
const URLF=(t,c,s)=>location.origin+'/PROD_ar/ws?p_trm_code='+t+'&p_col_code='+c+'&p_sex_code='+s;
async function get(u){let last;for(let a=0;a<2;a++){try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return dec(await r.arrayBuffer())}catch(e){last=e;if(!a)await new Promise(z=>setTimeout(z,1500))}}throw last}
const hasRows=html=>rows(html).some(t=>t.length==13&&isDig(t[1]));
async function anyRows(term){for(const c of ['22','08','06','00']){try{if(hasRows(await get(URLF(term,c,'11'))))return true}catch(e){}}return false}
const nextTerm=t=>{const y=+t.slice(0,4),k=+t.slice(4,6);return k<30?''+y+(k+10):(y+1)+'10'};
const nowZ=()=>new Date().toISOString().replace(/\.\d{3}Z$/,'Z');

/* ---------- الجلب ---------- */
let srv={};
try{srv=await (await fetch(W+'sections.json?'+Date.now(),{cache:'no-store'})).json()}catch(e){}
const cols=Array.isArray(srv.cols)&&srv.cols.length?srv.cols:DEFCOLS;
let term=new URLSearchParams(location.search).get('p_trm_code')||srv.term||'';
if(!/^\d{6}$/.test(term)){setSt('افتح صفحة جدول الشعب في Banner (الرابط في المخطط) ثم اضغط الزر.',1);return}
setSt('أتحقق من الفصل '+term+'…');setP(.04);
if(!(await anyRows(term))){const nx=nextTerm(term);if(await anyRows(nx))term=nx}
const jobs=[];for(const sx of SEXES)for(const c of cols)jobs.push({sx,c});
const pages=new Array(jobs.length),failed=[];let done=0;
async function worker(q){while(q.length){const i=q.shift(),j=jobs[i];
 try{pages[i]=await get(URLF(term,j.c,j.sx))}catch(e){failed.push(j.c+'/'+j.sx)}
 done++;setP(.05+.85*done/jobs.length);setSt('جلبت '+done+' من '+jobs.length+' صفحة…')}}
const q=jobs.map((_,i)=>i);await Promise.all([1,2,3,4].map(()=>worker(q)));
if(failed.length){setSt('تعذّر جلب: '+failed.join('، ')+'. لم أغيّر شيئاً، أعد المحاولة بعد قليل.',1);return}

/* التحليل بنفس ترتيب البايثون حتى تتطابق النتيجة */
setSt('أحلل الشعب…');
const m=new Map(),counts={};
jobs.forEach((j,i)=>{const n0=m.size;banner(pages[i],m,j.sx);const n=m.size-n0;if(n)counts[j.c+'-'+j.sx]=n});
const secs=[...m.values()].sort((a,b)=>((a.sx||'')<(b.sx||'')?-1:(a.sx||'')>(b.sx||'')?1:0)||(a.crn<b.crn?-1:a.crn>b.crn?1:0));
if(!secs.length){setSt('لم أجد أي شعبة في الفصل '+term+'. هل الجداول منشورة؟',1);return}
const same=srv.term==term&&JSON.stringify(srv.cols)==JSON.stringify(cols);
if(same&&srv.secs&&secs.length<.5*srv.secs.length){setSt('وجدت '+secs.length+' شعبة فقط مقابل '+srv.secs.length+' في الموقع. يبدو أن Banner لم يُرجع كل الصفحات، لم أغيّر شيئاً.',1);return}
const nums=new Set(secs.map(x=>x.num)),names={};
for(const [n,v] of Object.entries(srv.names||{}))if(nums.has(n))names[n]=v;
Object.assign(names,namesFrom(secs));
const now=nowZ(),changed=JSON.stringify(srv.secs||[])!==JSON.stringify(secs);
const ua=changed||!srv.updated_at?now:srv.updated_at;
const J={updated:ua.slice(0,10),updated_at:ua,checked_at:now,term,cols,sexes:SEXES,counts,names,secs};
window.__kuJ=J;setP(1);

/* ---------- النتيجة ---------- */
const tn={10:'الأول',20:'الثاني',30:'الصيفي'}[term.slice(4)]||'';
$k('#kubst').textContent='';
$k('#kubout').innerHTML=`<div class="big">${secs.length.toLocaleString('ar-SA')} شعبة</div>
<div>الفصل ${tn} ${term.slice(0,4)}هـ · ${changed?'<span class="ok">فيها تغييرات عن الموقع</span>':'مطابقة لما في الموقع'}</div>
<div class="bt"><button class="p" id="kubsend">أرسلها إلى المخطط</button><button class="s" id="kubdl" title="للمشرفين: لرفعه إلى المستودع">تنزيل sections.json</button></div>
<div class="nt" id="kubnt">تُحفظ في متصفحك فقط، ويستعملها المخطط ما دامت أحدث من شعب الموقع.</div>`;
const note=t=>$k('#kubnt').textContent=t;
$k('#kubdl').onclick=()=>{const b=new Blob([JSON.stringify(J)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='sections.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);note('نُزّل الملف. ارفعه إلى المستودع مكان القديم ليصل لكل الطلاب.')};
$k('#kubsend').onclick=()=>{
 const w=window.open(W+'#bmimport','ku_planner');
 if(!w){note('المتصفح منع فتح المخطط. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد الضغط.');return}
 let ok=false,n=0;note('أفتح المخطط وأرسل الشعب…');
 const on=e=>{if(e.origin!==O||!e.data)return;
  if(e.data.kubmReady&&!ok)w.postMessage({kuSecs:J},O);
  if(e.data.kuAck){ok=true;removeEventListener('message',on);note('وصلت إلى المخطط ✓ يمكنك إغلاق هذه النافذة.');$k('#kubsend').textContent='تم ✓';$k('#kubsend').disabled=true}};
 addEventListener('message',on);
 const iv=setInterval(()=>{if(ok||++n>40){clearInterval(iv);if(!ok)note('لم يؤكد المخطط الاستلام. أغلق تبويب المخطط الآخر إن كان مفتوحاً وأعد المحاولة.');return}try{w.postMessage({kuSecs:J},O)}catch(e){}},500);
};
})();

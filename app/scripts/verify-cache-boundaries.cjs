// Cache ownership and offline recovery checks. All API responses are fixtures.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const origin=process.env.UI_ORIGIN||'http://localhost:8081';
const scope=(user,school)=>JSON.stringify([school.id,user.id,user.role,user.admin_scope??null,user.department_id??null,user.section?.id??null]);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const scenario of ['own-offline','other-account','other-section','legacy']){
   const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
   const user={id:901,name:'Cache Student',username:'cache-student',initials:'CS',role:'student',department_id:null,section:{id:10,label:'BSIT 2-A'}};
   const school={id:901,name:'Cache Test School',code:'CACHE',settings:{setup_completed:true}};
   const cachedUser={...user,id:scenario==='other-account'?999:user.id,section:scenario==='other-section'?{id:11,label:'BSIT 2-B'}:user.section};
   const marker=scenario==='own-offline'?'Own offline class':'Private stale class';
   const dashboard={student:cachedUser,semester:{id:1,name:'First Semester'},period:null,teachers:[{offering_id:1,teacher:{id:1,name:'Prof. Cached',initials:'PC'},subject:{code:'TEST',name:marker},status:'pending',schedule:null}],subjects:[],progress:{completed:0,total:1,percent:0}};
   const envelope={savedAt:Date.now(),scope:scenario==='legacy'?undefined:scope(cachedUser,school),state:{mutations:[],queries:[{queryKey:['student','dashboard'],queryHash:'["student","dashboard"]',state:{data:dashboard,dataUpdatedAt:Date.now(),dataUpdateCount:1,error:null,errorUpdatedAt:0,errorUpdateCount:0,fetchFailureCount:0,fetchFailureReason:null,fetchMeta:null,isInvalidated:false,status:'success',fetchStatus:'idle'}}]}};
   await context.addInitScript(({envelope,user,school})=>{
    localStorage.setItem('teachwise_token','fixture-cache');localStorage.setItem('tw.onboarded','1');localStorage.setItem('tw.tourDone','1');
    localStorage.setItem('tw.user',JSON.stringify(user));localStorage.setItem('tw.userSchool',JSON.stringify(school));
    localStorage.setItem('teachwise_query_cache_v1',JSON.stringify(envelope));
    window.__staleCacheSeen=false;
    new MutationObserver(()=>{if(document.body?.innerText.includes('Private stale class'))window.__staleCacheSeen=true;}).observe(document,{subtree:true,childList:true,characterData:true});
   },{envelope,user,school});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',async route=>{
    const endpoint=new URL(route.request().url()).pathname.replace(/^\/api/,'');let body={data:[]};
    if(endpoint==='/auth/me'){await new Promise(r=>setTimeout(r,300));body={user,school,settings:{tips:false,seen_tips:[]},token_expires_at:null};}
    else if(endpoint==='/student/dashboard'){
     if(scenario==='own-offline')return route.abort('failed');
     await new Promise(r=>setTimeout(r,300));body={...dashboard,student:user,teachers:[],progress:{completed:0,total:0,percent:0}};
    }
    else if(endpoint==='/app/info')body={school,latest_version:'1.0.0',min_version:'1.0.0'};
    else if(endpoint==='/notifications')body={unread:0,data:[]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   });
   await page.goto(origin+'/student',{waitUntil:'networkidle'});
   if(scenario==='own-offline')await page.getByText(marker,{exact:true}).waitFor();
   else{
    await page.getByText('No classes to evaluate yet',{exact:true}).waitFor();
    assert.equal(await page.getByText(marker,{exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>window.__staleCacheSeen),false,scenario+' must never flash another account/group cache');
   }
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Cache checks passed: valid own-account offline recovery; other-account, other-section and unowned legacy caches rejected before rendering.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

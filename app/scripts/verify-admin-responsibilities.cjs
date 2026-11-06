// Role-specific navigation and controls; every API response is an isolated fixture.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const origin=process.env.UI_ORIGIN||'http://localhost:8081';
const output=path.resolve(__dirname,'../../.ui-checks/admin-responsibilities');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.UI_BROWSER||'msedge'});
 try{
  for(const dept of [false,true]){
   const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
   await context.addInitScript(()=>{localStorage.setItem('teachwise_token','fixture-admin');localStorage.setItem('tw.onboarded','1');localStorage.setItem('tw.tourDone','1');localStorage.setItem('teachwise_theme','light');});
   const page=await context.newPage();const errors=[];const requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   const user={id:901,id_number:'ADMIN-001',name:dept?'Test Dean':'Test School',initials:'TA',username:'testadmin',email:null,phone_number:null,role:'admin',department_id:dept?1:null,department:dept?'Computing':null,admin_scope:dept?'department':'school'};
   const school={id:901,code:'TEST',name:'Test School',short_name:'TEST',settings:{setup_completed:true,peer_evaluation:true}};
   await context.addInitScript(({dept,school})=>{
    const cached={semester:null,period:null,stats:{faculty:1,students:0,evaluations_submitted:0,average_rating:null},faculty:[{id:990,name:'Private former department teacher',initials:'PF',department:'Former department',responses:0,average:null}],periods:[],completion:{completed:0,expected:0,percent:0,by_section:[]}};
    localStorage.setItem('teachwise_query_cache_v1',JSON.stringify({savedAt:Date.now(),scope:JSON.stringify([school.id,901,'admin','department',dept?2:1,null]),state:{mutations:[],queries:[{queryKey:['admin','dashboard'],queryHash:'["admin","dashboard"]',state:{data:cached,dataUpdatedAt:Date.now(),status:'success',fetchStatus:'idle'}}]}}));
    window.__oldDepartmentSeen=false;
    new MutationObserver(()=>{if(document.body?.innerText.includes('Private former department teacher'))window.__oldDepartmentSeen=true;}).observe(document,{subtree:true,childList:true,characterData:true});
   },{dept,school});
   await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());const endpoint=url.pathname.replace(/^\/api/,'');requests.push(endpoint);let body={data:[]};
    if(endpoint==='/auth/me')body={user,school,settings:{tips:false,seen_tips:[]},token_expires_at:null};
    else if(endpoint==='/me/profile'&&route.request().method()==='PUT'){Object.assign(user,route.request().postDataJSON());body={user};}
    else if(endpoint==='/app/info')body={school,latest_version:'1.0.0',min_version:'1.0.0'};
    else if(endpoint==='/notifications')body={unread:0,data:[]};
    else if(endpoint==='/admin/dashboard')body={semester:{id:1,name:'First Semester'},period:null,stats:{faculty:0,students:0,evaluations_submitted:0,average_rating:null},faculty:[],periods:[],completion:{completed:0,expected:0,percent:0,by_section:[]}};
    else if(endpoint==='/admin/school')body={school,setup:{completed:true,steps:[],done:0,total:0}};
    else if(endpoint==='/admin/inbox')body={data:[],open_count:0,current_page:1,last_page:1};
    else if(endpoint==='/admin/password-requests')body={data:[],pending:0};
    else if(endpoint==='/admin/users')body={data:[],current_page:1,last_page:1,total:0};
    else if(endpoint==='/admin/departments')body={data:[{id:1,name:'Computing',code:'IT',programs:[],admins:['Test Dean'],teachers_count:0}]};
    else if(endpoint==='/admin/semesters')body={data:[{id:1,name:'First Semester',is_active:true,starts_on:null,ends_on:null}]};
    else if(endpoint==='/admin/questions')body={data:[{id:1,text:'Explains lessons clearly',category:'Clarity',type:'rating',audience:'student',is_active:true,sort_order:1}]};
    else if(endpoint==='/admin/transfers/options')body={departments:[{id:1,name:'Computing'}],sections:[]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   });
   const go=async href=>page.goto(origin+href,{waitUntil:'networkidle'});
   await go('/admin');
   assert.equal(await page.getByRole('menuitem',{name:'Approved IDs',exact:true}).count(),dept?1:0);
   assert.equal(await page.getByRole('button',{name:'Set up a period',exact:true}).count(),dept?0:1);
   await go('/admin/academics');
   assert.equal(await page.getByRole('button',{name:'Classes',exact:true}).count(),dept?1:0);
   assert.equal(await page.getByRole('button',{name:'Subjects',exact:true}).count(),dept?1:0);
   await page.getByRole('button',{name:'Semesters',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Add semester',exact:true}).count(),dept?0:1);
   await go('/admin/evaluation');
   assert.equal(await page.getByRole('button',{name:'Add period',exact:true}).count(),dept?0:2);
   await page.getByRole('radio',{name:'Questions',exact:true}).click();
   await page.getByText('Explains lessons clearly',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Add question',exact:true}).count(),dept?0:1);
   await page.screenshot({path:path.join(output,dept?'dean-read-only-questions.png':'school-questionnaire-setup.png')});
   await go('/admin/users');
   const invite=page.getByRole('button',{name:dept?'Invite teachers':'Invite administrators',exact:true});
   await invite.first().click();
   assert.equal(await page.getByRole('radiogroup',{name:'Role',exact:true}).count(),0,'Invite role cannot be escalated in the UI');
   assert.equal(await page.getByRole('dialog').getByText('Whole school',{exact:true}).count(),dept?0:1);
   await go('/admin/ids');
   if(dept)await page.getByRole('heading',{name:'Approved IDs',exact:true}).waitFor();
   else await page.waitForURL('**/admin');
   if(!dept)assert.equal(requests.includes('/admin/whitelist'),false,'School admins never fetch approved IDs');
   assert.equal(await page.evaluate(()=>window.__oldDepartmentSeen),false,'Previous department/role dashboard cannot flash on screen');
   await page.setViewportSize({width:390,height:844});
   await go('/admin/account');
   assert.equal(await page.getByText('Approved IDs',{exact:true}).count(),dept?1:0);
   for(const width of [1366,390]){
    await page.setViewportSize({width,height:900});
    await go('/admin/profile');
    if(dept){
     assert.equal(await page.getByRole('button',{name:'School / managing office',exact:true}).count(),0);
     await page.getByText('Department',{exact:true}).waitFor();
    }else{
     await page.getByText('ADMIN-001 · School administrator',{exact:true}).waitFor();
     assert.equal(await page.getByText('Department',{exact:true}).count(),0);
     await page.getByRole('button',{name:/^School \/ managing office/}).click();
     await page.getByRole('textbox',{name:'School / managing office',exact:true}).fill('ICTC Database Management Office');
     const saved=page.waitForResponse(r=>r.url().includes('/me/profile')&&r.request().method()==='PUT');
     await page.getByRole('button',{name:'Save',exact:true}).click();
     assert.equal((await saved).status(),200);
     await page.getByRole('textbox',{name:'School / managing office',exact:true}).waitFor({state:'hidden'});
     await page.getByText('ICTC Database Management Office',{exact:true}).first().waitFor();
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Long school-office name does not overflow');
     await page.screenshot({path:path.join(output,`school-office-profile-${width}.png`)});
    }
   }
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Administrator UI checks passed for school admins and deans, including phone navigation and read-only framework controls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

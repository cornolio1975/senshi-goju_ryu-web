"use client";
import React from "react";
// Bulletin board extension. Schedule inputs use Asia/Kuala_Lumpur (UTC+08:00).
export default function BulletinBoard({admin=false,csrf=''}) {
 const h=React.createElement;
 const [items,setItems]=React.useState([]),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[edit,setEdit]=React.useState(null),[clock,setClock]=React.useState(Date.now()),[offset,setOffset]=React.useState(0);
 const localDate=t=>new Date(t*1000+28800000).toISOString().slice(0,16);
 const display=t=>new Date(t*1000).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'});
 async function request(form){const r=await fetch('api.php',form?{method:'POST',body:form,cache:'no-store'}:{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(daReact.error||'Unable to load bulletin board');return data;}
 async function load(){try{let form;if(admin){form=new FormData();form.set('action','bulletins');form.set('csrf',csrf);}const data=await request(form);setItems(daReact.bulletins||[]);setOffset(daReact.server_time*1000-Date.now());}catch(e){setError(e.message);}}
 React.useEffect(()=>{load();const poll=setInterval(load,30000);const tick=setInterval(()=>setClock(Date.now()),1000);return()=>{clearInterval(poll);clearInterval(tick);};},[admin,csrf]);
 async function submit(e){e.preventDefault();const form=e.currentTarget;setBusy(true);setError('');try{const data=new FormData(form);daReact.set('csrf',csrf);await request(data);form.reset();setEdit(null);await load();setError('Bulletin saved.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function remove(id){if(!confirm('Delete this bulletin?'))return;setBusy(true);try{const f=new FormData();f.set('action','delete');f.set('type','bulletin');f.set('id',id);f.set('csrf',csrf);await request(f);if(edit?.id===id)setEdit(null);await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 const now=(clock+offset)/1000;
 const visible=admin?items:items.filter(x=>Number(x.launch)<=now&&Number(x.close)>now);
 const label=(text,element)=>h('label',null,text,element);
 const status=x=>!Number(x.enabled)?'Draft':now<x.launch?'Scheduled':now>=x.close?'Closed':'Live';
 return h('section',{id:'bulletins',className:admin?'bulletin-admin':'section bulletin-board'},
 h('p',{className:'eyebrow'},'CLUB & BRANCH UPDATES'),h('h2',null,'Bulletin ',h('em',null,'board.')),
 h('p',null,admin?'Write news for the whole club or a branch. Launch and closing times use Malaysia time (UTC+08:00).':'Latest news and announcements from our club and branches.'),
 error&&h('p',{role:'status'},error),
 admin&&h('form',{key:edit?.id||'new',onSubmit:submit,className:'bulletin-form'},h('h3',null,edit?'Edit bulletin':'New bulletin'),
 h('input',{type:'hidden',name:'action',value:'bulletin'}),h('input',{type:'hidden',name:'id',value:edit?.id||''}),
 label('Title',h('input',{name:'title',required:true,maxLength:200,defaultValue:edit?.title||''})),
 label('Club / branch',h('input',{name:'branch',required:true,maxLength:150,placeholder:'Whole club or branch name',defaultValue:edit?.branch||'Whole club',list:'bulletin-branches'})),
 h('datalist',{id:'bulletin-branches'},['Whole club','Dojo Shihan Kannan','Dojo Shihan Bala','Sensei Mohan'].map(x=>h('option',{key:x,value:x}))),
 label('News / details',h('textarea',{name:'body',required:true,rows:6,maxLength:8000,defaultValue:edit?.body||''})),
 h('div',{className:'bulletin-times'},label('Launch — Malaysia time',h('input',{type:'datetime-local',name:'launch',required:true,defaultValue:edit?localDate(edit.launch):localDate(Math.floor(now))})),label('Close — Malaysia time',h('input',{type:'datetime-local',name:'close',required:true,defaultValue:edit?localDate(edit.close):''}))),
 label('Publication',h('select',{name:'enabled',defaultValue:edit?String(edit.enabled):'1'},h('option',{value:'1'},'Publish according to schedule'),h('option',{value:'0'},'Save as draft'))),
 h('button',{className:'button',disabled:busy},edit?'SAVE CHANGES':'SAVE BULLETIN'),edit&&h('button',{type:'button',onClick:()=>setEdit(null)},'CANCEL EDIT')),
 h('div',{className:'event-grid'},visible.length?visible.map(x=>h('article',{key:x.id,className:'event bulletin-card'},h('p',{className:'eyebrow'},x.branch,admin?' · '+status(x):''),h('h3',null,x.title),h('p',{className:'preserve'},x.body),h('p',{className:'muted'},'Launch: '+display(x.launch)+' MYT',h('br'), 'Closes: '+display(x.close)+' MYT'),admin&&h('div',{className:'bulletin-actions'},h('button',{disabled:busy,onClick:()=>setEdit(x)},'EDIT'),h('button',{disabled:busy,onClick:()=>remove(x.id)},'DELETE')))):h('p',{className:'muted'},admin?'No bulletins yet. Create your first update above.':'No current announcements. Check back for club updates.')));
}

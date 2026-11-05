"use client";
import React from "react";

// Bulletin board extension. Schedule inputs use Asia/Kuala_Lumpur (UTC+08:00).
export default function BulletinBoard({admin=false,csrf='',branches=[],onAuditChange=null}) {
  const h=React.createElement;
  const [items,setItems]=React.useState([]);
  const [error,setError]=React.useState('');
  const [notice,setNotice]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [edit,setEdit]=React.useState(null);
  const [filter,setFilter]=React.useState('all');
  const [clock,setClock]=React.useState(Date.now());
  const [offset,setOffset]=React.useState(0);

  const localDate=t=>new Date(t*1000+28800000).toISOString().slice(0,16);
  const display=t=>new Date(t*1000).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'});

  async function request(form){
    const r=await fetch('api.php',form?{method:'POST',body:form,cache:'no-store'}:{cache:'no-store'});
    const data=await r.json();
    if(!r.ok)throw Error(data.error||'Unable to load bulletin board');
    return data;
  }

  async function load(){
    try{
      let form;
      if(admin){
        form=new FormData();
        form.set('action','bulletins');
        form.set('csrf',csrf);
      }
      const data=await request(form);
      setItems(data.bulletins||[]);
      if(data.server_time)setOffset(data.server_time*1000-Date.now());
    }catch(e){
      setError(e.message);
    }
  }

  React.useEffect(()=>{
    load();
    const poll=setInterval(load,30000);
    const tick=setInterval(()=>setClock(Date.now()),1000);
    return()=>{clearInterval(poll);clearInterval(tick);};
  },[admin,csrf]);

  async function submit(e){
    e.preventDefault();
    if(busy)return;
    const form=e.currentTarget;
    setBusy(true);
    setError('');
    setNotice('');
    try{
      const data=new FormData(form);
      data.set('csrf',csrf);
      await request(data);
      form.reset();
      setEdit(null);
      await load();
      if(onAuditChange)onAuditChange();
      setNotice(edit?'Announcement updated successfully.':'Announcement saved successfully.');
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  }

  async function quickStatus(id,mode){
    if(busy)return;
    setBusy(true);
    setError('');
    setNotice('');
    try{
      const f=new FormData();
      f.set('action','bulletin_status');
      f.set('id',id);
      f.set('status_mode',mode);
      f.set('csrf',csrf);
      await request(f);
      await load();
      if(onAuditChange)onAuditChange();
      setNotice('Announcement status updated to '+mode+'.');
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  }

  async function remove(id){
    if(!confirm('Delete this announcement permanently?'))return;
    setBusy(true);
    setError('');
    setNotice('');
    try{
      const f=new FormData();
      f.set('action','delete');
      f.set('type','bulletin');
      f.set('id',id);
      f.set('csrf',csrf);
      await request(f);
      if(edit?.id===id)setEdit(null);
      await load();
      if(onAuditChange)onAuditChange();
      setNotice('Announcement deleted.');
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  }

  async function removeAttachment(attId){
    if(!confirm('Remove this attachment?'))return;
    setBusy(true);
    setError('');
    try{
      const f=new FormData();
      f.set('action','delete');
      f.set('type','bulletin_attachment');
      f.set('id',attId);
      f.set('csrf',csrf);
      await request(f);
      await load();
      setNotice('Attachment removed.');
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  }

  const now=(clock+offset)/1000;
  const status=x=>{
    const mode=x.status_mode||(Number(x.enabled)?'scheduled':'draft');
    if(mode==='draft'||!Number(x.enabled)&&mode!=='hidden')return 'Draft';
    if(mode==='hidden')return 'Hidden';
    if(now>=Number(x.close))return 'Expired';
    if(mode==='published')return 'Live';
    if(now<Number(x.launch))return 'Scheduled';
    return 'Live';
  };

  const visible=admin
    ? items.filter(x=>filter==='all'||status(x).toLowerCase()===filter)
    : items.filter(x=>{
        const st=status(x);
        return st==='Live'&&Number(x.close)>now;
      });

  const branchOptions=Array.from(new Set(['Whole club','Club Headquarters','Dojo Shihan Kannan','Dojo Shihan Bala','Sensei Mohan',...(branches||[])]));
  const label=(text,element)=>h('label',null,text,element);

  return h('section',{id:'bulletins',className:admin?'bulletin-admin':'section bulletin-board'},
    h('p',{className:'eyebrow'},'CLUB & BRANCH UPDATES'),
    h('h2',null,'Bulletin ',h('em',null,'board.')),
    h('p',null,admin?'Publish announcements for Club Headquarters, the whole club, or individual branches. Launch and closing times use Malaysia time (UTC+08:00).':'Latest news, grading schedules and announcements from our club headquarters and training centres.'),
    error&&h('p',{role:'alert',className:'bulletin-status bulletin-error'},error),
    notice&&h('p',{role:'status',className:'bulletin-status bulletin-success'},notice),
    admin&&h('form',{key:edit?.id||'new',onSubmit:submit,className:'bulletin-form'},
      h('h3',null,edit?'Edit announcement':'New announcement'),
      h('input',{type:'hidden',name:'action',value:'bulletin'}),
      h('input',{type:'hidden',name:'id',value:edit?.id||''}),
      label('Title',h('input',{name:'title',required:true,maxLength:200,placeholder:'e.g. Grading Examination & Joint Training',defaultValue:edit?.title||''})),
      label('Club / branch',h('input',{name:'branch',required:true,maxLength:150,placeholder:'Whole club, Headquarters or branch name',defaultValue:edit?.branch||'Whole club',list:'bulletin-branches'})),
      h('datalist',{id:'bulletin-branches'},branchOptions.map(x=>h('option',{key:x,value:x}))),
      label('Announcement details',h('textarea',{name:'body',required:true,rows:6,maxLength:8000,placeholder:'Write full announcement details, venue, attire or schedule notes…',defaultValue:edit?.body||''})),
      h('div',{className:'bulletin-times'},
        label('Announcement image (optional · JPG, PNG or WebP)',h('input',{type:'file',name:'image',accept:'image/jpeg,image/png,image/webp'})),
        label('Attachment circular / poster (optional · PDF, JPG, PNG, WebP)',h('input',{type:'file',name:'attachment',accept:'application/pdf,image/jpeg,image/png,image/webp'}))
      ),
      edit?.image&&h('div',{className:'bulletin-image-preview'},
        h('img',{src:'api.php?bulletin_image='+edit.image,alt:'Current announcement image',className:'bulletin-thumb'}),
        h('label',{className:'checkbox-label'},h('input',{type:'checkbox',name:'remove_image',value:'1'}),' Remove current image')
      ),
      h('div',{className:'bulletin-times'},
        label('Launch — Malaysia time (MYT)',h('input',{type:'datetime-local',name:'launch',required:true,defaultValue:edit?localDate(edit.launch):localDate(Math.floor(now))})),
        label('Closing / Expiry — Malaysia time (MYT)',h('input',{type:'datetime-local',name:'close',required:true,defaultValue:edit?localDate(edit.close):localDate(Math.floor(now)+86400*14)}))
      ),
      label('Publication state',h('select',{name:'status_mode',defaultValue:edit?(edit.status_mode||(Number(edit.enabled)?'scheduled':'draft')):'scheduled'},
        h('option',{value:'scheduled'},'Scheduled / Live inside launch & close window'),
        h('option',{value:'published'},'Publish immediately (until closing time)'),
        h('option',{value:'draft'},'Save as draft'),
        h('option',{value:'hidden'},'Hidden (temporarily hide from public website)')
      )),
      h('div',{className:'bulletin-form-actions'},
        h('button',{type:'submit',className:'button',disabled:busy},busy?'SAVING…':edit?'SAVE CHANGES':'SAVE BULLETIN'),
        edit&&h('button',{type:'button',className:'button-secondary',onClick:()=>setEdit(null)},'CANCEL EDIT')
      )
    ),
    admin&&h('div',{className:'tabs',style:{marginBottom:'20px'}},
      [['all','ALL ('+items.length+')'],['live','LIVE'],['scheduled','SCHEDULED'],['draft','DRAFT'],['hidden','HIDDEN'],['expired','EXPIRED']].map(([k,lbl])=>
        h('button',{key:k,type:'button',className:filter===k?'selected':'',onClick:()=>setFilter(k)},lbl)
      )
    ),
    h('div',{className:'event-grid'},
      visible.length
        ? visible.map(x=>{
            const st=status(x);
            return h('article',{key:x.id,className:'event bulletin-card'},
              h('div',{className:'bulletin-card-head'},
                h('p',{className:'eyebrow'},x.branch,admin?' · ':null,admin&&h('span',{className:'status-badge status-'+st.toLowerCase()},st))
              ),
              h('h3',null,x.title),
              x.image&&h('img',{src:'api.php?bulletin_image='+x.image,alt:x.title,className:'bulletin-image',loading:'lazy'}),
              h('p',{className:'preserve'},x.body),
              x.attachments&&x.attachments.length>0&&h('div',{className:'bulletin-attachments'},
                x.attachments.map(a=>h('div',{key:a.id,className:'attachment-item'},
                  h('a',{href:'api.php?attachment='+a.id,target:'_blank',rel:'noopener noreferrer',className:'text-link'},'📎 '+a.name+' ↗'),
                  admin&&h('button',{type:'button',className:'button-tiny',disabled:busy,onClick:()=>removeAttachment(a.id)},'×')
                ))
              ),
              h('p',{className:'muted'},'Launch: '+display(x.launch)+' MYT',h('br'),'Closes: '+display(x.close)+' MYT'),
              admin&&h('div',{className:'bulletin-actions'},
                h('button',{type:'button',disabled:busy,onClick:()=>setEdit(x)},'EDIT'),
                st!=='Live'&&h('button',{type:'button',disabled:busy,onClick:()=>quickStatus(x.id,'published')},'PUBLISH NOW'),
                st!=='Hidden'&&h('button',{type:'button',disabled:busy,onClick:()=>quickStatus(x.id,'hidden')},'HIDE'),
                st!=='Draft'&&h('button',{type:'button',disabled:busy,onClick:()=>quickStatus(x.id,'draft')},'SET DRAFT'),
                h('button',{type:'button',disabled:busy,onClick:()=>remove(x.id)},'DELETE')
              )
            );
          })
        : h('p',{className:'muted'},admin?'No announcements match this filter.':'No current announcements. Check back soon for club updates.')
    )
  );
}

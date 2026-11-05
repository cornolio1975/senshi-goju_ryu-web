import{useEffect,useState}from'react';
import BulletinBoard from '../components/BulletinBoard';
import PasswordInput from '../components/PasswordInput';

const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export default function Admin(){
  const[d,D]=useState<any>({
    bulletins:[],folders:[],media:[],posts:[],dojos:[],instructors:[],dojo_instructors:[],locations:[],sessions:[],club_info:{},audit_logs:[]
  });
  const[auth,A]=useState(false);
  const[csrf,C]=useState('');
  const[status,S]=useState('');
  const[warnings,W]=useState<string[]>([]);
  const[busy,B]=useState(false);
  const[section,setSection]=useState('overview');

  // Edit states for each module
  const[editDojo,setEditDojo]=useState<any>(null);
  const[editInstructor,setEditInstructor]=useState<any>(null);
  const[editLocation,setEditLocation]=useState<any>(null);
  const[editSession,setEditSession]=useState<any>(null);
  const[editFolder,setEditFolder]=useState<any>(null);
  const[editMedia,setEditMedia]=useState<any>(null);
  const[editPost,setEditPost]=useState<any>(null);
  const[selDojosForInst,setSelDojosForInst]=useState<string[]>([]);

  async function load(){
    const r=await fetch('api.php?session=1',{cache:'no-store'});
    const s=await r.json();
    A(s.authenticated);
    C(s.csrf);
    if(s.authenticated){
      const fd=new FormData();
      fd.set('action','admin_data');
      fd.set('csrf',s.csrf);
      const ar=await fetch('api.php',{method:'POST',body:fd,cache:'no-store'});
      if(ar.ok){
        D(await ar.json());
        return;
      }
    }
    const c=await fetch('api.php',{cache:'no-store'});
    D(await c.json());
  }

  useEffect(()=>{
    load().catch(()=>S('Unable to connect to the server.'));
  },[]);

  useEffect(()=>{
    if(editInstructor){
      const assigned=(d.dojo_instructors||[]).filter((di:any)=>di.instructor_id===editInstructor.id).map((di:any)=>di.dojo_id);
      setSelDojosForInst(assigned);
    }else{
      setSelDojosForInst([]);
    }
  },[editInstructor,d.dojo_instructors]);

  async function save(e:any,onDone?:()=>void){
    e.preventDefault();
    if(busy)return;
    const f=e.currentTarget;
    B(true);
    S('Saving…');
    W([]);
    try{
      const data=new FormData(f);
      data.set('csrf',csrf);
      const r=await fetch('api.php',{method:'POST',body:data});
      const v=await r.json();
      if(!r.ok)throw Error(v.error||'Request failed');
      S('Saved successfully.');
      if(v.warnings&&v.warnings.length)W(v.warnings);
      const act=data.get('action');
      if(act!=='club_info')f.reset();
      if(onDone)onDone();
      await load();
    }catch(err){
      S((err as Error).message);
    }finally{
      B(false);
    }
  }

  async function deleteItem(type:string,id:string,confirmMsg:string){
    if(!confirm(confirmMsg))return;
    B(true);
    S('Deleting…');
    try{
      const fd=new FormData();
      fd.set('action','delete');
      fd.set('type',type);
      fd.set('id',id);
      fd.set('csrf',csrf);
      const r=await fetch('api.php',{method:'POST',body:fd});
      const v=await r.json();
      if(!r.ok)throw Error(v.error||'Delete failed');
      S('Deleted successfully.');
      await load();
    }catch(err){
      S((err as Error).message);
    }finally{
      B(false);
    }
  }

  async function quickSaveFields(fields:Record<string,string>,msg='Updated successfully.'){
    B(true);
    S('Updating…');
    W([]);
    try{
      const fd=new FormData();
      Object.entries(fields).forEach(([k,v])=>fd.set(k,v));
      fd.set('csrf',csrf);
      const r=await fetch('api.php',{method:'POST',body:fd});
      const v=await r.json();
      if(!r.ok)throw Error(v.error||'Update failed');
      S(msg);
      if(v.warnings&&v.warnings.length)W(v.warnings);
      await load();
    }catch(err){
      S((err as Error).message);
    }finally{
      B(false);
    }
  }

  // Compute instructor schedule conflicts across all published sessions
  const conflicts:string[]=[];
  const pubSessions=(d.sessions||[]).filter((s:any)=>s.status==='published'&&s.instructor_id);
  for(let i=0;i<pubSessions.length;i++){
    for(let j=i+1;j<pubSessions.length;j++){
      const a=pubSessions[i],b=pubSessions[j];
      if(a.instructor_id===b.instructor_id&&a.day_of_week===b.day_of_week&&a.start_time<b.end_time&&a.end_time>b.start_time){
        const inst=(d.instructors||[]).find((x:any)=>x.id===a.instructor_id);
        const locA=(d.locations||[]).find((x:any)=>x.id===a.location_id);
        const locB=(d.locations||[]).find((x:any)=>x.id===b.location_id);
        conflicts.push(`${inst?.name||'Instructor'} has overlapping classes on ${a.day_of_week}: ${a.start_time}–${a.end_time} (${locA?.venue_name||'Venue A'}) and ${b.start_time}–${b.end_time} (${locB?.venue_name||'Venue B'}).`);
      }
    }
  }

  const navItems=[
    ['overview','Dashboard Overview'],
    ['dojos','Manage Dojos'],
    ['instructors','Manage Instructors'],
    ['sessions','Training Locations & Sessions'],
    ['bulletins','Bulletin Board'],
    ['media','Media Centre'],
    ['events','Tournaments & Events'],
    ['club','Club Information'],
    ['security','Security & Audit Logs'],
  ];

  const dojoMap:Record<string,any>={};
  (d.dojos||[]).forEach((x:any)=>{dojoMap[x.id]=x;});
  const instMap:Record<string,any>={};
  (d.instructors||[]).forEach((x:any)=>{instMap[x.id]=x;});
  const locMap:Record<string,any>={};
  (d.locations||[]).forEach((x:any)=>{locMap[x.id]=x;});

  return (
    <main className="admin section">
      <div className="admin-top-bar">
        <div>
          <a className="text-link" href="./">← BACK TO THE CLUB WEBSITE</a>
          <p className="eyebrow">SENSHI GOJU-RYU · C SGR-13884 / CONTENT & DOJO MANAGEMENT</p>
          <h1>Admin <em>centre.</em></h1>
          <p>Manage training centres, instructors, class timetables, bulletin announcements, event albums and club records.</p>
        </div>
        <div className="admin-top-actions">
          <a className="button" href={d.club_info?.scms_url||'https://scms.spsportdatasolution.org/'} target="_blank" rel="noopener noreferrer">SCMS MANAGEMENT LOGIN ↗</a>
          {auth&&(
            <form onSubmit={save} className="inline-form">
              <input type="hidden" name="action" value="logout"/>
              <button className="button-secondary" disabled={busy}>SIGN OUT</button>
            </form>
          )}
        </div>
      </div>

      {status&&<p role="status" className="bulletin-status">{status}</p>}
      {warnings.map((w,i)=><p key={i} role="alert" className="bulletin-status bulletin-warning">⚠️ {w}</p>)}
      {auth&&conflicts.map((c,i)=><p key={'c'+i} role="alert" className="bulletin-status bulletin-warning">⚠️ Schedule Conflict: {c}</p>)}

      {!auth?(
        <form onSubmit={save} className="login-form">
          <h3>Administrator sign in</h3>
          <p>Sign in with your administrator password to manage Kelab Karate Do Senshi Goju-Ryu.</p>
          <input type="hidden" name="action" value="login"/>
          <label>Password<PasswordInput name="password" required autoComplete="current-password"/></label>
          <button className="button" disabled={busy}>{busy?'SIGNING IN…':'SIGN IN ↗'}</button>
        </form>
      ):(
        <>
          <nav className="admin-tabs" aria-label="Administration sections">
            {navItems.map(([key,label])=>(
              <button key={key} type="button" className={section===key?'selected':''} onClick={()=>setSection(key)}>
                {label}
              </button>
            ))}
          </nav>

          {/* 1. DASHBOARD OVERVIEW */}
          {section==='overview'&&(
            <section className="admin-panel">
              <h2>Dashboard <em>overview.</em></h2>
              <div className="stats-grid">
                <div className="stat-card" onClick={()=>setSection('dojos')}>
                  <span className="eyebrow">TRAINING CENTRES</span>
                  <strong>{(d.dojos||[]).length}</strong>
                  <span className="muted">{(d.dojos||[]).filter((x:any)=>Number(x.active)&&Number(x.published)).length} active & published</span>
                </div>
                <div className="stat-card" onClick={()=>setSection('instructors')}>
                  <span className="eyebrow">INSTRUCTORS</span>
                  <strong>{(d.instructors||[]).length}</strong>
                  <span className="muted">Shihan & Sensei roster</span>
                </div>
                <div className="stat-card" onClick={()=>setSection('sessions')}>
                  <span className="eyebrow">VENUES & SESSIONS</span>
                  <strong>{(d.locations||[]).length} / {(d.sessions||[]).length}</strong>
                  <span className="muted">{(d.locations||[]).length} locations · {(d.sessions||[]).length} class sessions</span>
                </div>
                <div className="stat-card" onClick={()=>setSection('bulletins')}>
                  <span className="eyebrow">BULLETIN BOARD</span>
                  <strong>{(d.bulletins||[]).length}</strong>
                  <span className="muted">Club & branch announcements</span>
                </div>
                <div className="stat-card" onClick={()=>setSection('media')}>
                  <span className="eyebrow">MEDIA CENTRE</span>
                  <strong>{(d.folders||[]).length} / {(d.media||[]).length}</strong>
                  <span className="muted">{(d.folders||[]).length} albums · {(d.media||[]).length} photos/videos</span>
                </div>
                <div className="stat-card" onClick={()=>setSection('events')}>
                  <span className="eyebrow">TOURNAMENTS & UPDATES</span>
                  <strong>{(d.posts||[]).length}</strong>
                  <span className="muted">Upcoming, past & president updates</span>
                </div>
              </div>

              <div className="admin-grid">
                <div className="admin-card">
                  <h3>Quick actions</h3>
                  <div className="bulletin-actions">
                    <button type="button" className="button" onClick={()=>setSection('bulletins')}>NEW ANNOUNCEMENT +</button>
                    <button type="button" className="button-secondary" onClick={()=>setSection('dojos')}>MANAGE DOJOS</button>
                    <button type="button" className="button-secondary" onClick={()=>setSection('sessions')}>ADD CLASS SESSION</button>
                    <button type="button" className="button-secondary" onClick={()=>setSection('media')}>UPLOAD MEDIA</button>
                  </div>
                </div>
                <div className="admin-card">
                  <h3>Recent administrative activity</h3>
                  {(d.audit_logs||[]).slice(0,5).length?(
                    <ul className="audit-mini-list">
                      {(d.audit_logs||[]).slice(0,5).map((log:any)=>(
                        <li key={log.id}>
                          <strong>{log.action}</strong> · {log.details||log.target_type} <span className="muted">({log.created?.slice(0,19).replace('T',' ')} UTC)</span>
                        </li>
                      ))}
                    </ul>
                  ):<p className="muted">No audit logs recorded yet.</p>}
                </div>
              </div>
            </section>
          )}

          {/* 2. MANAGE DOJOS */}
          {section==='dojos'&&(
            <section className="admin-panel">
              <h2>Manage <em>dojos.</em></h2>
              <p className="muted">Add, edit, reorder, activate/deactivate and publish training centres. Preserves Dojo Shihan Kannan, Dojo Shihan Bala and Sensei Mohan.</p>
              <div className="admin-grid">
                <form key={editDojo?.id||'new-dojo'} onSubmit={e=>save(e,()=>setEditDojo(null))}>
                  <h3>{editDojo?'Edit dojo':'Add new dojo'}</h3>
                  <input type="hidden" name="action" value="dojo"/>
                  <input type="hidden" name="id" value={editDojo?.id||''}/>
                  <label>Dojo / Training group name<input name="name" required maxLength={150} defaultValue={editDojo?.name||''} placeholder="e.g. Dojo Shihan Kannan"/></label>
                  <label>Description & overview<textarea name="description" rows={4} maxLength={2000} defaultValue={editDojo?.description||''} placeholder="Introduce this training group, focus and community…"/></label>
                  <label>WhatsApp enquiry number (e.g. 60123456789)<input name="whatsapp" maxLength={40} defaultValue={editDojo?.whatsapp||''} placeholder="60123456789"/></label>
                  <div className="bulletin-times">
                    <label>Display order<input type="number" name="sort_order" defaultValue={editDojo?.sort_order??((d.dojos||[]).length+1)}/></label>
                    <label>Status
                      <select name="active" defaultValue={editDojo?String(editDojo.active):'1'}>
                        <option value="1">Active</option>
                        <option value="0">Deactivated</option>
                      </select>
                    </label>
                  </div>
                  <label>Public visibility
                    <select name="published" defaultValue={editDojo?String(editDojo.published):'1'}>
                      <option value="1">Published on public website</option>
                      <option value="0">Unpublished (hidden)</option>
                    </select>
                  </label>
                  <div className="bulletin-form-actions">
                    <button className="button" disabled={busy}>{editDojo?'SAVE DOJO CHANGES':'ADD DOJO +'}</button>
                    {editDojo&&<button type="button" className="button-secondary" onClick={()=>setEditDojo(null)}>CANCEL</button>}
                  </div>
                </form>

                <div className="admin-card">
                  <h3>Existing dojos ({(d.dojos||[]).length})</h3>
                  <div className="item-list">
                    {(d.dojos||[]).map((dj:any,idx:number)=>(
                      <div key={dj.id} className="item-row">
                        <div>
                          <p className="eyebrow">ORDER #{dj.sort_order} · {Number(dj.active)?'ACTIVE':'INACTIVE'} · {Number(dj.published)?'PUBLISHED':'HIDDEN'}</p>
                          <h4>{dj.name}</h4>
                          {dj.description&&<p className="muted">{dj.description}</p>}
                          {dj.whatsapp&&<p className="muted">WhatsApp: {dj.whatsapp}</p>}
                        </div>
                        <div className="bulletin-actions">
                          <button type="button" disabled={busy} onClick={()=>setEditDojo(dj)}>EDIT</button>
                          <button type="button" disabled={busy} onClick={()=>quickSaveFields({
                            action:'dojo',id:dj.id,name:dj.name,description:dj.description||'',whatsapp:dj.whatsapp||'',
                            sort_order:String(Math.max(0,Number(dj.sort_order)-1)),active:String(dj.active),published:String(dj.published)
                          },'Moved dojo up.')}>↑</button>
                          <button type="button" disabled={busy} onClick={()=>quickSaveFields({
                            action:'dojo',id:dj.id,name:dj.name,description:dj.description||'',whatsapp:dj.whatsapp||'',
                            sort_order:String(Number(dj.sort_order)+1),active:String(dj.active),published:String(dj.published)
                          },'Moved dojo down.')}>↓</button>
                          <button type="button" disabled={busy} onClick={()=>quickSaveFields({
                            action:'dojo',id:dj.id,name:dj.name,description:dj.description||'',whatsapp:dj.whatsapp||'',
                            sort_order:String(dj.sort_order),active:Number(dj.active)?'0':'1',published:String(dj.published)
                          },Number(dj.active)?'Dojo deactivated.':'Dojo activated.')}>{Number(dj.active)?'DEACTIVATE':'ACTIVATE'}</button>
                          <button type="button" disabled={busy} onClick={()=>deleteItem('dojo',dj.id,`Delete dojo "${dj.name}" and its associated sessions?`)}>DELETE</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 3. MANAGE INSTRUCTORS */}
          {section==='instructors'&&(
            <section className="admin-panel">
              <h2>Manage <em>instructors.</em></h2>
              <p className="muted">Edit instructor names, ranks, biographies, contact details, photos and assigned dojos. An instructor can teach at multiple dojos and venues.</p>
              <div className="admin-grid">
                <form key={editInstructor?.id||'new-inst'} onSubmit={e=>save(e,()=>setEditInstructor(null))}>
                  <h3>{editInstructor?'Edit instructor':'Add instructor'}</h3>
                  <input type="hidden" name="action" value="instructor"/>
                  <input type="hidden" name="id" value={editInstructor?.id||''}/>
                  <input type="hidden" name="dojo_ids" value={selDojosForInst.join(',')}/>
                  <div className="bulletin-times">
                    <label>Instructor name<input name="name" required maxLength={150} defaultValue={editInstructor?.name||''} placeholder="e.g. Shihan Kannan"/></label>
                    <label>Rank / Title<input name="rank" maxLength={100} defaultValue={editInstructor?.rank||''} placeholder="e.g. Shihan / 6th Dan"/></label>
                  </div>
                  <label>Biography & experience<textarea name="bio" rows={4} maxLength={3000} defaultValue={editInstructor?.bio||''} placeholder="Instructor background, qualifications and teaching philosophy…"/></label>
                  <div className="bulletin-times">
                    <label>Phone / Email contact<input name="contact" maxLength={200} defaultValue={editInstructor?.contact||''} placeholder="Optional phone or email"/></label>
                    <label>WhatsApp number<input name="whatsapp" maxLength={40} defaultValue={editInstructor?.whatsapp||''} placeholder="e.g. 60123456789"/></label>
                  </div>
                  <label>Instructor photo (optional · JPG, PNG or WebP)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"/></label>
                  {editInstructor?.photo_id&&(
                    <div className="bulletin-image-preview">
                      <img src={'api.php?instructor_photo='+editInstructor.photo_id} alt={editInstructor.name} className="bulletin-thumb"/>
                      <label className="checkbox-label"><input type="checkbox" name="remove_photo" value="1"/> Remove photo</label>
                    </div>
                  )}
                  <fieldset className="checkbox-group">
                    <legend>Assign to Dojos (Instructor can teach at multiple dojos)</legend>
                    {(d.dojos||[]).map((dj:any)=>(
                      <label key={dj.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={selDojosForInst.includes(dj.id)}
                          onChange={ev=>{
                            if(ev.target.checked)setSelDojosForInst([...selDojosForInst,dj.id]);
                            else setSelDojosForInst(selDojosForInst.filter(x=>x!==dj.id));
                          }}
                        />
                        {' '+dj.name}
                      </label>
                    ))}
                  </fieldset>
                  <div className="bulletin-times">
                    <label>Display order<input type="number" name="sort_order" defaultValue={editInstructor?.sort_order??((d.instructors||[]).length+1)}/></label>
                    <label>Status
                      <select name="active" defaultValue={editInstructor?String(editInstructor.active):'1'}>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <div className="bulletin-form-actions">
                    <button className="button" disabled={busy}>{editInstructor?'SAVE INSTRUCTOR':'ADD INSTRUCTOR +'}</button>
                    {editInstructor&&<button type="button" className="button-secondary" onClick={()=>setEditInstructor(null)}>CANCEL</button>}
                  </div>
                </form>

                <div className="admin-card">
                  <h3>Instructors ({(d.instructors||[]).length})</h3>
                  <div className="item-list">
                    {(d.instructors||[]).map((inst:any)=>{
                      const assignedDojos=(d.dojo_instructors||[])
                        .filter((di:any)=>di.instructor_id===inst.id)
                        .map((di:any)=>dojoMap[di.dojo_id]?.name)
                        .filter(Boolean);
                      return (
                        <div key={inst.id} className="item-row">
                          <div className="inst-row-head">
                            {inst.photo_id&&<img src={'api.php?instructor_photo='+inst.photo_id} alt={inst.name} className="inst-avatar"/>}
                            <div>
                              <p className="eyebrow">{inst.rank||'INSTRUCTOR'} · {Number(inst.active)?'ACTIVE':'INACTIVE'}</p>
                              <h4>{inst.name}</h4>
                              {inst.bio&&<p className="muted">{inst.bio}</p>}
                              {assignedDojos.length>0&&<p className="muted">Dojos: {assignedDojos.join(', ')}</p>}
                              {(inst.contact||inst.whatsapp)&&<p className="muted">{inst.contact} {inst.whatsapp?'· WA: '+inst.whatsapp:''}</p>}
                            </div>
                          </div>
                          <div className="bulletin-actions">
                            <button type="button" disabled={busy} onClick={()=>setEditInstructor(inst)}>EDIT</button>
                            <button type="button" disabled={busy} onClick={()=>deleteItem('instructor',inst.id,`Delete instructor "${inst.name}"?`)}>DELETE</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 4. TRAINING LOCATIONS & SESSIONS */}
          {section==='sessions'&&(
            <section className="admin-panel">
              <h2>Training <em>locations & sessions.</em></h2>
              <p className="muted">Add unlimited training venues under each dojo, configure Google Maps & WhatsApp links, and schedule multiple training days and sessions per venue.</p>

              <div className="admin-grid">
                {/* LOCATION FORM */}
                <form key={editLocation?.id||'new-loc'} onSubmit={e=>save(e,()=>setEditLocation(null))}>
                  <h3>{editLocation?'Edit training location':'Add training location (venue)'}</h3>
                  <input type="hidden" name="action" value="location"/>
                  <input type="hidden" name="id" value={editLocation?.id||''}/>
                  <div className="bulletin-times">
                    <label>Dojo / Group
                      <select name="dojo_id" required defaultValue={editLocation?.dojo_id||(d.dojos?.[0]?.id||'')}>
                        {(d.dojos||[]).map((dj:any)=><option key={dj.id} value={dj.id}>{dj.name}</option>)}
                      </select>
                    </label>
                    <label>Lead instructor at venue (optional)
                      <select name="instructor_id" defaultValue={editLocation?.instructor_id||''}>
                        <option value="">Any / Multiple instructors</option>
                        {(d.instructors||[]).map((inst:any)=><option key={inst.id} value={inst.id}>{inst.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <label>Venue name<input name="venue_name" required maxLength={200} defaultValue={editLocation?.venue_name||''} placeholder="e.g. Saujana Puchong Main Dojo / Community Hall"/></label>
                  <label>Complete address<textarea name="address" rows={3} maxLength={500} defaultValue={editLocation?.address||''} placeholder="Full street address, postcode, city and state…"/></label>
                  <div className="bulletin-times">
                    <label>Google Maps directions URL<input name="maps_url" maxLength={1000} defaultValue={editLocation?.maps_url||''} placeholder="https://www.google.com/maps/search/?api=1&query=..."/></label>
                    <label>WhatsApp enquiry number<input name="whatsapp" maxLength={40} defaultValue={editLocation?.whatsapp||''} placeholder="e.g. 60123456789"/></label>
                  </div>
                  <label>Venue notes / landmarks<input name="notes" maxLength={1000} defaultValue={editLocation?.notes||''} placeholder="Parking, entrance or hall floor notes"/></label>
                  <div className="bulletin-times">
                    <label>Display order<input type="number" name="sort_order" defaultValue={editLocation?.sort_order??1}/></label>
                    <label>Status
                      <select name="active" defaultValue={editLocation?String(editLocation.active):'1'}>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <div className="bulletin-form-actions">
                    <button className="button" disabled={busy}>{editLocation?'SAVE LOCATION':'ADD LOCATION +'}</button>
                    {editLocation&&<button type="button" className="button-secondary" onClick={()=>setEditLocation(null)}>CANCEL</button>}
                  </div>
                </form>

                {/* SESSION FORM */}
                <form key={editSession?.id||'new-sess'} onSubmit={e=>save(e,()=>setEditSession(null))}>
                  <h3>{editSession?'Edit training session':'Add training session (class schedule)'}</h3>
                  <input type="hidden" name="action" value="session"/>
                  <input type="hidden" name="id" value={editSession?.id||''}/>
                  <div className="bulletin-times">
                    <label>Dojo / Group
                      <select name="dojo_id" required defaultValue={editSession?.dojo_id||(d.dojos?.[0]?.id||'')}>
                        {(d.dojos||[]).map((dj:any)=><option key={dj.id} value={dj.id}>{dj.name}</option>)}
                      </select>
                    </label>
                    <label>Training location (venue)
                      <select name="location_id" required defaultValue={editSession?.location_id||(d.locations?.[0]?.id||'')}>
                        <option value="">Select venue…</option>
                        {(d.locations||[]).map((loc:any)=><option key={loc.id} value={loc.id}>{loc.venue_name} ({dojoMap[loc.dojo_id]?.name||'Dojo'})</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="bulletin-times">
                    <label>Instructor leading session
                      <select name="instructor_id" defaultValue={editSession?.instructor_id||''}>
                        <option value="">Select instructor…</option>
                        {(d.instructors||[]).map((inst:any)=><option key={inst.id} value={inst.id}>{inst.name}</option>)}
                      </select>
                    </label>
                    <label>Training day
                      <select name="day_of_week" required defaultValue={editSession?.day_of_week||'Saturday'}>
                        {DAYS.map(day=><option key={day} value={day}>{day}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="bulletin-times">
                    <label>Start time<input type="time" name="start_time" required defaultValue={editSession?.start_time||'18:00'}/></label>
                    <label>End time<input type="time" name="end_time" required defaultValue={editSession?.end_time||'20:00'}/></label>
                  </div>
                  <div className="bulletin-times">
                    <label>Age groups<input name="age_group" maxLength={150} defaultValue={editSession?.age_group||'Children, Teenagers & Adults (6+ years)'}/></label>
                    <label>Fees<input name="fees" maxLength={200} defaultValue={editSession?.fees||''} placeholder="e.g. RM 60 / month (Contact dojo)"/></label>
                  </div>
                  <div className="bulletin-times">
                    <label>Availability<input name="availability" maxLength={150} defaultValue={editSession?.availability||'Open for enrolment'}/></label>
                    <label>Session state
                      <select name="status" defaultValue={editSession?.status||'published'}>
                        <option value="published">Published (Active)</option>
                        <option value="suspended">Temporarily Suspended</option>
                        <option value="unpublished">Unpublished (Hidden)</option>
                      </select>
                    </label>
                  </div>
                  <label>Class description & syllabus notes<textarea name="description" rows={3} maxLength={1000} defaultValue={editSession?.description||''} placeholder="e.g. Kihon, Kata (Sanchin/Tensho) and Kumite fundamentals…"/></label>
                  <div className="bulletin-form-actions">
                    <button className="button" disabled={busy||!(d.locations||[]).length}>{editSession?'SAVE SESSION':'ADD SESSION +'}</button>
                    {editSession&&<button type="button" className="button-secondary" onClick={()=>setEditSession(null)}>CANCEL</button>}
                  </div>
                </form>
              </div>

              <div className="admin-grid" style={{marginTop:'25px'}}>
                <div className="admin-card">
                  <h3>Training locations ({(d.locations||[]).length})</h3>
                  {(d.locations||[]).length?(
                    <div className="item-list">
                      {(d.locations||[]).map((loc:any)=>(
                        <div key={loc.id} className="item-row">
                          <div>
                            <p className="eyebrow">{dojoMap[loc.dojo_id]?.name||'Dojo'} · {Number(loc.active)?'ACTIVE':'INACTIVE'}</p>
                            <h4>{loc.venue_name}</h4>
                            {loc.address&&<p className="muted">{loc.address}</p>}
                            {loc.instructor_id&&instMap[loc.instructor_id]&&<p className="muted">Lead: {instMap[loc.instructor_id].name}</p>}
                            {loc.whatsapp&&<p className="muted">WhatsApp: {loc.whatsapp}</p>}
                          </div>
                          <div className="bulletin-actions">
                            <button type="button" disabled={busy} onClick={()=>setEditLocation(loc)}>EDIT</button>
                            <button type="button" disabled={busy} onClick={()=>deleteItem('location',loc.id,`Delete location "${loc.venue_name}" and its sessions?`)}>DELETE</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ):<p className="muted">No locations configured yet. Add a training venue above.</p>}
                </div>

                <div className="admin-card">
                  <h3>Training sessions ({(d.sessions||[]).length})</h3>
                  {(d.sessions||[]).length?(
                    <div className="item-list">
                      {(d.sessions||[]).map((s:any)=>(
                        <div key={s.id} className="item-row">
                          <div>
                            <p className="eyebrow">{dojoMap[s.dojo_id]?.name||'Dojo'} · <span className={'status-badge status-'+s.status}>{s.status.toUpperCase()}</span></p>
                            <h4>{s.day_of_week} · {s.start_time} – {s.end_time}</h4>
                            <p className="muted">Venue: {locMap[s.location_id]?.venue_name||'Unknown venue'}</p>
                            {s.instructor_id&&instMap[s.instructor_id]&&<p className="muted">Instructor: {instMap[s.instructor_id].name}</p>}
                            <p className="muted">Age group: {s.age_group} {s.fees?'· Fees: '+s.fees:''} · {s.availability}</p>
                            {s.description&&<p className="muted">{s.description}</p>}
                          </div>
                          <div className="bulletin-actions">
                            <button type="button" disabled={busy} onClick={()=>setEditSession(s)}>EDIT</button>
                            {s.status!=='published'&&<button type="button" disabled={busy} onClick={()=>quickSaveFields({...s,action:'session',status:'published'},'Session published.')}>PUBLISH</button>}
                            {s.status!=='suspended'&&<button type="button" disabled={busy} onClick={()=>quickSaveFields({...s,action:'session',status:'suspended'},'Session suspended.')}>SUSPEND</button>}
                            {s.status!=='unpublished'&&<button type="button" disabled={busy} onClick={()=>quickSaveFields({...s,action:'session',status:'unpublished'},'Session unpublished.')}>UNPUBLISH</button>}
                            <button type="button" disabled={busy} onClick={()=>deleteItem('session',s.id,'Remove this training session? The dojo and location will be kept.')}>REMOVE</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ):<p className="muted">No training sessions added yet.</p>}
                </div>
              </div>
            </section>
          )}

          {/* 5. BULLETIN BOARD */}
          {section==='bulletins'&&(
            <BulletinBoard
              admin
              csrf={csrf}
              branches={(d.dojos||[]).map((dj:any)=>dj.name)}
              onAuditChange={()=>load()}
            />
          )}

          {/* 6. MEDIA CENTRE */}
          {section==='media'&&(
            <section className="admin-panel">
              <h2>Media <em>centre.</em></h2>
              <p className="muted">Create event albums, upload multiple photographs or videos (up to 50 MB each), link hosted YouTube/Vimeo videos, select cover images, reorder and publish albums.</p>
              <div className="admin-grid">
                <form key={editFolder?.id||'new-folder'} onSubmit={e=>save(e,()=>setEditFolder(null))}>
                  <h3>{editFolder?'Edit event album':'Create event album'}</h3>
                  <input type="hidden" name="action" value="folder"/>
                  <input type="hidden" name="id" value={editFolder?.id||''}/>
                  <label>Album title<input required name="name" maxLength={100} defaultValue={editFolder?.name||''} placeholder="e.g. Selangor Open Championship 2026"/></label>
                  <div className="bulletin-times">
                    <label>Event date<input type="date" name="event_date" defaultValue={editFolder?.event_date||''}/></label>
                    <label>Display order<input type="number" name="sort_order" defaultValue={editFolder?.sort_order??0}/></label>
                  </div>
                  <label>Album description<textarea name="description" rows={3} maxLength={1000} defaultValue={editFolder?.description||''} placeholder="Describe the event, grading or tournament moments…"/></label>
                  <div className="bulletin-times">
                    <label>Album cover image
                      <select name="cover_media_id" defaultValue={editFolder?.cover_media_id||''}>
                        <option value="">Auto (first photo in album)</option>
                        {(d.media||[]).filter((m:any)=>!editFolder||m.folder===editFolder.id).filter((m:any)=>m.type.startsWith('image')).map((m:any)=>(
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>Visibility
                      <select name="published" defaultValue={editFolder?String(editFolder.published):'1'}>
                        <option value="1">Published</option>
                        <option value="0">Unpublished (Hidden)</option>
                      </select>
                    </label>
                  </div>
                  <div className="bulletin-form-actions">
                    <button className="button" disabled={busy}>{editFolder?'SAVE ALBUM':'CREATE FOLDER +'}</button>
                    {editFolder&&<button type="button" className="button-secondary" onClick={()=>setEditFolder(null)}>CANCEL</button>}
                  </div>
                </form>

                <form onSubmit={save}>
                  <h3>Upload photos, videos or hosted link</h3>
                  <input type="hidden" name="action" value="upload"/>
                  <label>Album
                    <select name="folder" required>
                      <option value="">Select album</option>
                      {(d.folders||[]).map((f:any)=><option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </label>
                  <label>Select one or more media files (JPG, PNG, WebP, MP4, WebM · Max 50 MB each)
                    <input type="file" name="files[]" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"/>
                  </label>
                  <label>Or link hosted video URL (HTTPS YouTube or Vimeo)
                    <input type="url" name="external_url" placeholder="https://www.youtube.com/watch?v=..."/>
                  </label>
                  <div className="bulletin-times">
                    <label>Custom title / caption (optional)<input name="title" maxLength={200} placeholder="Defaults to filename"/></label>
                    <label>Event date (optional)<input type="date" name="event_date"/></label>
                  </div>
                  <label>Description / caption<input name="description" maxLength={1000} placeholder="Optional photo/video caption"/></label>
                  <button className="button" disabled={busy||!(d.folders||[]).length}>UPLOAD MEDIA ↑</button>
                </form>
              </div>

              {editMedia&&(
                <form onSubmit={e=>save(e,()=>setEditMedia(null))} style={{marginTop:'25px'}}>
                  <h3>Edit media item: {editMedia.name}</h3>
                  <input type="hidden" name="action" value="media_edit"/>
                  <input type="hidden" name="id" value={editMedia.id}/>
                  <div className="bulletin-times">
                    <label>Title<input name="name" required maxLength={200} defaultValue={editMedia.name}/></label>
                    <label>Album
                      <select name="folder" defaultValue={editMedia.folder}>
                        {(d.folders||[]).map((f:any)=><option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="bulletin-times">
                    <label>Event date<input type="date" name="event_date" defaultValue={editMedia.event_date||''}/></label>
                    <label>Sort order<input type="number" name="sort_order" defaultValue={editMedia.sort_order??0}/></label>
                  </div>
                  <label>Description<input name="description" maxLength={1000} defaultValue={editMedia.description||''}/></label>
                  <div className="bulletin-times">
                    <label>Visibility
                      <select name="published" defaultValue={String(editMedia.published??1)}>
                        <option value="1">Published</option>
                        <option value="0">Hidden</option>
                      </select>
                    </label>
                    <label className="checkbox-label" style={{marginTop:'28px'}}>
                      <input type="checkbox" name="set_cover" value="1"/> Set as album cover image
                    </label>
                  </div>
                  <div className="bulletin-form-actions">
                    <button className="button" disabled={busy}>SAVE MEDIA CHANGES</button>
                    <button type="button" className="button-secondary" onClick={()=>setEditMedia(null)}>CANCEL</button>
                  </div>
                </form>
              )}

              <div className="admin-grid" style={{marginTop:'25px'}}>
                <div className="admin-card">
                  <h3>Albums ({(d.folders||[]).length})</h3>
                  <div className="item-list">
                    {(d.folders||[]).map((f:any)=>(
                      <div key={f.id} className="item-row">
                        <div>
                          <p className="eyebrow">{Number(f.published??1)?'PUBLISHED':'HIDDEN'} · ORDER #{f.sort_order??0}</p>
                          <h4>{f.name}</h4>
                          {f.event_date&&<p className="muted">Date: {f.event_date}</p>}
                          {f.description&&<p className="muted">{f.description}</p>}
                        </div>
                        <div className="bulletin-actions">
                          <button type="button" disabled={busy} onClick={()=>setEditFolder(f)}>EDIT</button>
                          <button type="button" disabled={busy} onClick={()=>deleteItem('folder',f.id,'Delete this album? Albums must be empty before deletion.')}>DELETE</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="admin-card">
                  <h3>Media files ({(d.media||[]).length})</h3>
                  <div className="item-list">
                    {(d.media||[]).map((m:any)=>(
                      <div key={m.id} className="item-row">
                        <div className="inst-row-head">
                          {m.type.startsWith('image')&&<img src={'api.php?media='+m.id} alt={m.name} className="inst-avatar"/>}
                          <div>
                            <p className="eyebrow">{m.type} · {Number(m.published??1)?'PUBLISHED':'HIDDEN'} · ORDER #{m.sort_order??0}</p>
                            <h4>{m.name}</h4>
                            {m.description&&<p className="muted">{m.description}</p>}
                          </div>
                        </div>
                        <div className="bulletin-actions">
                          <button type="button" disabled={busy} onClick={()=>setEditMedia(m)}>EDIT</button>
                          <button type="button" disabled={busy} onClick={()=>deleteItem('media',m.id,`Delete media "${m.name}"?`)}>DELETE</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 7. TOURNAMENTS & EVENTS */}
          {section==='events'&&(
            <section className="admin-panel">
              <h2>Tournaments & <em>club updates.</em></h2>
              <div className="admin-grid">
                <form key={editPost?.id||'new-post'} onSubmit={e=>save(e,()=>setEditPost(null))}>
                  <h3>{editPost?'Edit club update':'Publish club update'}</h3>
                  <input type="hidden" name="action" value="post"/>
                  <input type="hidden" name="id" value={editPost?.id||''}/>
                  <label>Section
                    <select name="kind" defaultValue={editPost?.kind||'upcoming'}>
                      <option value="upcoming">Upcoming tournament</option>
                      <option value="past">Past tournament achievement</option>
                      <option value="president">President’s message</option>
                    </select>
                  </label>
                  <label>Title<input required name="title" maxLength={200} defaultValue={editPost?.title||''}/></label>
                  <div className="bulletin-times">
                    <label>Date<input required type="date" name="date" defaultValue={editPost?.date?.slice(0,10)||''}/></label>
                    <label>Venue / Location (optional)<input name="venue" maxLength={200} defaultValue={editPost?.venue||''}/></label>
                  </div>
                  <label>Details<textarea required name="body" rows={7} maxLength={8000} defaultValue={editPost?.body||''}/></label>
                  <label>Visibility
                    <select name="published" defaultValue={String(editPost?.published??1)}>
                      <option value="1">Published</option>
                      <option value="0">Hidden</option>
                    </select>
                  </label>
                  <div className="bulletin-form-actions">
                    <button className="button" disabled={busy}>{editPost?'SAVE UPDATE':'PUBLISH UPDATE ↗'}</button>
                    {editPost&&<button type="button" className="button-secondary" onClick={()=>setEditPost(null)}>CANCEL</button>}
                  </div>
                </form>

                <div className="admin-card">
                  <h3>Published updates ({(d.posts||[]).length})</h3>
                  <div className="item-list">
                    {(d.posts||[]).map((p:any)=>(
                      <div key={p.id} className="item-row">
                        <div>
                          <p className="eyebrow">{p.kind.toUpperCase()} · {p.date?.slice(0,10)} · {Number(p.published??1)?'PUBLISHED':'HIDDEN'}</p>
                          <h4>{p.title}</h4>
                          {p.venue&&<p className="muted">Venue: {p.venue}</p>}
                          <p className="muted preserve">{p.body}</p>
                        </div>
                        <div className="bulletin-actions">
                          <button type="button" disabled={busy} onClick={()=>setEditPost(p)}>EDIT</button>
                          <button type="button" disabled={busy} onClick={()=>deleteItem('post',p.id,`Delete "${p.title}"?`)}>DELETE</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 8. CLUB INFORMATION */}
          {section==='club'&&(
            <section className="admin-panel">
              <h2>Club <em>information.</em></h2>
              <form onSubmit={save}>
                <h3>Official club profile & contact details</h3>
                <input type="hidden" name="action" value="club_info"/>
                <div className="bulletin-times">
                  <label>Official Club Name<input name="club_name" defaultValue={d.club_info?.club_name||'KELAB KARATE DO SENSHI GOJU-RYU'}/></label>
                  <label>Registration Number<input name="registration_no" defaultValue={d.club_info?.registration_no||'C SGR-13884'}/></label>
                </div>
                <label>Club Motto<input name="motto" defaultValue={d.club_info?.motto||'DISCIPLINE · RESPECT · STRENGTH · UNITY'}/></label>
                <label>Headquarters Address<textarea name="headquarters" rows={2} defaultValue={d.club_info?.headquarters||'No. 23, Jalan SP8/14, Saujana Puchong, 47100 Puchong, Selangor, Malaysia.'}/></label>
                <div className="bulletin-times">
                  <label>Google Maps URL<input name="maps_url" defaultValue={d.club_info?.maps_url||'https://www.google.com/maps/search/?api=1&query=No.+23+Jalan+SP8%2F14+Saujana+Puchong+47100'}/></label>
                  <label>Club WhatsApp Enquiry Number<input name="whatsapp" defaultValue={d.club_info?.whatsapp||''} placeholder="e.g. 60123456789"/></label>
                </div>
                <div className="bulletin-times">
                  <label>Phone Number<input name="phone" defaultValue={d.club_info?.phone||''}/></label>
                  <label>Email Address<input name="email" defaultValue={d.club_info?.email||''}/></label>
                </div>
                <div className="bulletin-times">
                  <label>President Name / Signature<input name="president_name" defaultValue={d.club_info?.president_name||'SENSHI GOJU-RYU'}/></label>
                  <label>President Title<input name="president_role" defaultValue={d.club_info?.president_role||'CLUB LEADERSHIP'}/></label>
                </div>
                <label>SCMS Management URL<input name="scms_url" defaultValue={d.club_info?.scms_url||'https://scms.spsportdatasolution.org/'}/></label>
                <button className="button" disabled={busy}>SAVE CLUB INFORMATION</button>
              </form>
            </section>
          )}

          {/* 9. SECURITY & AUDIT LOGS */}
          {section==='security'&&(
            <section className="admin-panel">
              <h2>Security & <em>audit logs.</em></h2>
              <div className="admin-grid">
                <form onSubmit={save}>
                  <h3>Change administrator password</h3>
                  <input type="hidden" name="action" value="password"/>
                  <label>Current password<PasswordInput name="current" required autoComplete="current-password"/></label>
                  <label>New password (at least 14 characters)<PasswordInput name="password" minLength={14} required autoComplete="new-password"/></label>
                  <button className="button" disabled={busy}>CHANGE PASSWORD</button>
                </form>

                <div className="admin-card">
                  <h3>Administrative audit log ({(d.audit_logs||[]).length})</h3>
                  <div className="audit-table-wrap">
                    <table className="audit-table">
                      <thead>
                        <tr><th>Timestamp (UTC)</th><th>Action</th><th>Target</th><th>Details</th></tr>
                      </thead>
                      <tbody>
                        {(d.audit_logs||[]).map((log:any)=>(
                          <tr key={log.id}>
                            <td>{log.created?.slice(0,19).replace('T',' ')}</td>
                            <td><code>{log.action}</code></td>
                            <td>{log.target_type}</td>
                            <td>{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

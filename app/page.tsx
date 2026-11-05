"use client";
import {useState,useEffect} from 'react';

const DEFAULT_DOJOS=[
  {id:'dojo_kannan',name:'Dojo Shihan Kannan',description:'Traditional Goju-Ryu karate training under Shihan Kannan. Open to children, teenagers and adults.',whatsapp:''},
  {id:'dojo_bala',name:'Dojo Shihan Bala',description:'Traditional Goju-Ryu karate training under Shihan Bala. Developing discipline, respect, strength and unity.',whatsapp:''},
  {id:'dojo_mohan',name:'Sensei Mohan',description:'Traditional Goju-Ryu karate classes led by Sensei Mohan for students of all levels.',whatsapp:''}
];

function cleanPhone(raw:string){
  return (raw||'').replace(/[^0-9]/g,'');
}

export default function Home(){
  const [dojo,setDojo]=useState(0);
  const [tab,setTab]=useState('upcoming');
  const [folder,setFolder]=useState('all');
  const [data,setData]=useState<any>({folders:[],media:[],posts:[],dojos:[],instructors:[],dojo_instructors:[],locations:[],sessions:[],club_info:{}});
  const [menu,setMenu]=useState(false);
  const [selected,setSelected]=useState<any>(null);

  useEffect(()=>{
    fetch('/api/content').then(r=>r.ok?r.json():Promise.reject()).then(setData).catch(()=>{});
  },[]);

  const dojos=data.dojos&&data.dojos.length?data.dojos:DEFAULT_DOJOS;
  const activeDojo=dojos[dojo]||dojos[0]||DEFAULT_DOJOS[0];
  const instMap:Record<string,any>={};
  (data.instructors||[]).forEach((i:any)=>{instMap[i.id]=i;});

  const dojoInstructors=(data.dojo_instructors||[])
    .filter((di:any)=>di.dojo_id===activeDojo.id)
    .map((di:any)=>instMap[di.instructor_id])
    .filter(Boolean);

  const dojoLocations=(data.locations||[]).filter((l:any)=>l.dojo_id===activeDojo.id);
  const dojoSessions=(data.sessions||[]).filter((s:any)=>s.dojo_id===activeDojo.id);

  const clubInfo=data.club_info||{};
  const hqAddress=clubInfo.headquarters||'No. 23, Jalan SP8/14, Saujana Puchong, 47100 Puchong, Selangor, Malaysia.';
  const mapsUrl=clubInfo.maps_url||'https://www.google.com/maps/search/?api=1&query=No.+23+Jalan+SP8%2F14+Saujana+Puchong+47100';
  const clubWhatsapp=cleanPhone(clubInfo.whatsapp||'');
  const scmsUrl=clubInfo.scms_url||'https://scms.spsportdatasolution.org/';

  return <>
    <header>
      <a className="brand" href="#">
        <img src="/club_logo.png" alt="Senshi Goju-Ryu club logo"/>
        <span>SENSHI <small>GOJU-RYU KARATE DO</small></span>
      </a>
      <button className="menu" aria-label="Toggle navigation" onClick={()=>setMenu(!menu)}>☰</button>
      <nav className={menu?'open':''}>
        {[['Updates','bulletins'],['Our Club','club'],['About Goju-Ryu','heritage'],['Training Centres','dojos'],['Tournaments','events'],['Media','media']].map(([n,id])=>(
          <a key={id} href={'#'+id} onClick={()=>setMenu(false)}>{n}</a>
        ))}
        <a className="nav-cta" href="#join" onClick={()=>setMenu(false)}>JOIN OUR CLUB ↗</a>
      </nav>
    </header>

    <main>
      <section className="hero">
        <div className="hero-lines"/>
        <div className="hero-copy">
          <p className="eyebrow"><span/> KARATE FOR OUR COMMUNITY. GROW STRONGER TOGETHER.</p>
          <h1>Build confidence.<br/><em>Learn karate.</em><br/>Grow together.</h1>
          <p className="intro">Traditional karate for children, teenagers and adults.<br/>A welcoming community in Puchong, Selangor.</p>
          <div className="actions">
            <a className="button" href="#dojos">FIND A TRAINING CENTRE <span>↗</span></a>
            <a className="text-link" href="#heritage">DISCOVER GOJU-RYU <span>→</span></a>
          </div>
          <div className="hero-foot">
            <span>PUCHONG, SELANGOR · MALAYSIA</span>
            <span>LOCAL COMMUNITY · SHARED VALUES</span>
          </div>
        </div>
        <div className="hero-art">
          <span className="vertical">DISCIPLINE · RESPECT · UNITY</span>
          <img className="hero-club-logo" src="/club_logo.png" alt="Kelab Karate Do Senshi Goju-Ryu official club logo"/>
          <h2 className="hero-club-name"><span>KELAB KARATE DO</span>SENSHI<br/>GOJU-RYU</h2>
          <p className="hero-club-location">PUCHONG, SELANGOR · MALAYSIA<span>REGISTERED CLUB · {clubInfo.registration_no||'C SGR-13884'}</span></p>
          <span className="art-index">BUILD CONFIDENCE. DEVELOP CHARACTER.</span>
        </div>
      </section>

      <div className="motto">DISCIPLINE <b>✦</b> RESPECT <b>✦</b> STRENGTH <b>✦</b> UNITY <b>✦</b></div>

      <section id="club" className="section club">
        <div>
          <p className="eyebrow">01 / YOUR LOCAL KARATE CLUB</p>
          <h2>A place to learn.<br/><em>A community to belong.</em></h2>
        </div>
        <div>
          <p className="body">KELAB KARATE DO SENSHI GOJU-RYU brings traditional karate to our local community. We welcome enquiries from Malaysian families, young people and adults who want to develop discipline, fitness and self-confidence. Respect and personal growth guide every step of the journey.</p>
          <div className="registration">
            <span>REGISTERED CLUB</span>
            <strong>{clubInfo.registration_no||'C SGR-13884'}</strong>
          </div>
          <p className="muted">
            Headquarters<br/>
            <span className="light">{hqAddress}</span>
          </p>
        </div>
      </section>

      <section id="heritage" className="section heritage">
        <div className="section-head">
          <div>
            <p className="eyebrow">02 / UNDERSTANDING GOJU-RYU</p>
            <h2>Strength and balance.<br/><em>One complete art.</em></h2>
          </div>
          <p className="body narrow">Goju-Ryu is a traditional karate style from Okinawa, Japan. Its name means “hard and soft”: strong, direct techniques work together with flexible, circular movements. Training develops breathing, posture and focus.</p>
        </div>
        <div className="philosophy">
          <article>
            <span className="principle-mark">GO</span>
            <div>
              <p className="eyebrow">GO / STRENGTH</p>
              <h3>Rooted in strength.</h3>
              <p>Decisive movement. Grounded stances. Sanchin develops structure, controlled breathing and the connection between mind and body.</p>
              <span className="tag">SANCHIN · STANCE, BREATHING & FOCUS</span>
            </div>
          </article>
          <article>
            <span className="principle-mark">JU</span>
            <div>
              <p className="eyebrow">JU / FLEXIBILITY</p>
              <h3>Fluid in response.</h3>
              <p>Yielding movement. Circular defence. Tensho explores flowing hand techniques, coordination and the balance of tension and relaxation.</p>
              <span className="tag">TENSHO · FLOW, CONTROL & BALANCE</span>
            </div>
          </article>
        </div>
      </section>

      <section className="section president">
        <span className="quote">“</span>
        <div>
          <p className="eyebrow">A MESSAGE FROM THE PRESIDENT</p>
          <h2>Character is our<br/><em>greatest achievement.</em></h2>
          {(data.posts||[]).filter((p:any)=>p.kind==='president').length
            ? (data.posts||[]).filter((p:any)=>p.kind==='president').map((p:any)=>(
                <div key={p.id}>
                  <h3>{p.title}</h3>
                  <p className="body preserve">{p.body}</p>
                </div>
              ))
            : <p className="body">Our president’s welcome and vision for the club will be published here. In every practice, our motto guides the way: discipline, respect, strength and unity.</p>}
          <p className="signature">{clubInfo.president_name||'SENSHI GOJU-RYU'} <span>{clubInfo.president_role||'CLUB LEADERSHIP'}</span></p>
        </div>
      </section>

      <section id="dojos" className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">03 / TRAIN WITH US</p>
            <h2>Find your <em>training centre.</em></h2>
          </div>
          <p className="muted">Explore our club’s training groups.<br/>Contact us for venues and class availability.</p>
        </div>
        <div className="dojo-grid">
          <div className="dojo-list">
            {dojos.map((dItem:any,i:number)=>(
              <button key={dItem.id||dItem.name} className={dojo===i?'active':''} onClick={()=>setDojo(i)}>
                <span>{String(i+1).padStart(2,'0')}</span>
                <strong>{dItem.name}</strong>
                <b>↗</b>
              </button>
            ))}
          </div>
          <article className="dojo-detail">
            <p className="eyebrow">SENSHI TRAINING DIRECTORY / {String(dojo+1).padStart(2,'0')}</p>
            <h3>{activeDojo.name}</h3>
            <p>{activeDojo.description||'A dojo is a karate training centre. Get in touch to learn about this group’s classes.'}</p>

            {dojoInstructors.length>0&&(
              <div className="dojo-instructors-box">
                <dt>INSTRUCTORS</dt>
                {dojoInstructors.map((inst:any)=>(
                  <div key={inst.id} className="public-instructor-card">
                    {inst.photo_id&&<img src={'/api/media/'+inst.photo_id} alt={inst.name} className="inst-avatar"/>}
                    <div>
                      <strong>{inst.name}</strong> {inst.rank&&<span className="tag">{inst.rank}</span>}
                      {inst.bio&&<p className="muted">{inst.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <dl>
              <dt>TRAINING VENUES & TIMETABLES</dt>
              {dojoLocations.length>0?(
                dojoLocations.map((loc:any)=>{
                  const locSessions=dojoSessions.filter((s:any)=>s.location_id===loc.id);
                  const locWa=cleanPhone(loc.whatsapp||activeDojo.whatsapp||clubWhatsapp);
                  return (
                    <dd key={loc.id} className="public-venue-card">
                      <strong>{loc.venue_name}</strong>
                      {loc.address&&<p className="muted">{loc.address}</p>}
                      {loc.notes&&<p className="muted">{loc.notes}</p>}
                      {locSessions.length>0?(
                        <ul className="public-session-list">
                          {locSessions.map((s:any)=>(
                            <li key={s.id}>
                              <span className="session-day">{s.day_of_week}: {s.start_time} – {s.end_time}</span>
                              {s.status==='suspended'&&<span className="status-badge status-suspended">TEMPORARILY SUSPENDED</span>}
                              {s.instructor_id&&instMap[s.instructor_id]&&<span> · {instMap[s.instructor_id].name}</span>}
                              <small>{s.age_group} {s.fees?'· '+s.fees:''} · {s.availability}</small>
                              {s.description&&<small className="muted">{s.description}</small>}
                            </li>
                          ))}
                        </ul>
                      ):<p className="muted">Class session times to be confirmed by dojo instructor.</p>}
                      <div className="venue-links">
                        {loc.maps_url&&<a className="text-link" href={loc.maps_url} target="_blank" rel="noopener noreferrer">GOOGLE MAPS DIRECTIONS ↗</a>}
                        {locWa&&<a className="text-link" href={'https://wa.me/'+locWa} target="_blank" rel="noopener noreferrer">WHATSAPP ENQUIRY ↗</a>}
                      </div>
                    </dd>
                  );
                })
              ):(
                <dd>To be confirmed by club administration.</dd>
              )}

              <dt>NEW MEMBERS & PARENTS</dt>
              <dd>Parents, beginners and returning students can contact our headquarters about class times, age groups, fees and joining requirements.</dd>
            </dl>
            <div className="venue-links">
              <a className="text-link" href="#join">ENQUIRE ABOUT TRAINING →</a>
              {cleanPhone(activeDojo.whatsapp||clubWhatsapp)&&(
                <a className="text-link" href={'https://wa.me/'+cleanPhone(activeDojo.whatsapp||clubWhatsapp)} target="_blank" rel="noopener noreferrer">WHATSAPP THIS DOJO ↗</a>
              )}
            </div>
          </article>
        </div>
      </section>

      <section id="events" className="section events">
        <div className="section-head">
          <div>
            <p className="eyebrow">04 / TOURNAMENTS & CLUB EVENTS</p>
            <h2>Our club in <em>action.</em></h2>
          </div>
          <div className="tabs">
            {['upcoming','past'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} className={tab===t?'selected':''}>{t==='past'?'PAST TOURNAMENTS':'UPCOMING'}</button>
            ))}
          </div>
        </div>
        <div className="event-grid">
          {(data.posts||[]).filter((p:any)=>p.kind===tab).length
            ? (data.posts||[]).filter((p:any)=>p.kind===tab).map((p:any)=>(
                <article className="event" key={p.id}>
                  <p className="eyebrow">{p.date.slice(0,10)}{p.venue?' · '+p.venue:''}</p>
                  <h3>{p.title}</h3>
                  <p className="preserve">{p.body}</p>
                </article>
              ))
            : (
              <div className="empty-event">
                <span className="event-mark">EVENTS</span>
                <div>
                  <p className="eyebrow">{tab==='upcoming'?'THE NEXT CHAPTER':'OUR TOURNAMENT JOURNEY'}</p>
                  <h3>{tab==='upcoming'?'The next challenge awaits.':'Every experience shapes us.'}</h3>
                  <p>{tab==='upcoming'?'Confirmed tournament dates, venues and registration details will appear here.':'Official past tournament reports and results will appear here once added by the club.'}</p>
                </div>
              </div>
            )}
        </div>
      </section>

      <section id="media" className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">05 / OUR COMMUNITY IN PHOTOS</p>
            <h2>Life at <em>Senshi.</em></h2>
          </div>
          <p className="muted">Our training. Our people. Our memories.</p>
        </div>
        <div className="folder-tabs">
          <button className={folder==='all'?'selected':''} onClick={()=>setFolder('all')}>All albums</button>
          {(data.folders||[]).map((f:any)=>(
            <button key={f.id} className={folder===f.id?'selected':''} onClick={()=>setFolder(f.id)}>{f.name}</button>
          ))}
        </div>
        {(data.media||[]).filter((m:any)=>folder==='all'||m.folder===folder).length
          ? (
            <div className="gallery">
              {(data.media||[]).filter((m:any)=>folder==='all'||m.folder===folder).map((m:any)=>(
                <button key={m.id} onClick={()=>{
                  if(m.external_url){window.open(m.external_url,'_blank','noopener,noreferrer');return;}
                  setSelected(m);
                }}>
                  {m.type.startsWith('video')
                    ? <div className="video-tile">▶<span>{m.name}</span></div>
                    : <img loading="lazy" src={'/api/media/'+m.id} alt={m.name}/>}
                  <span>
                    <strong>{m.name}</strong>
                    {m.description&&<small className="gallery-caption">{m.description}</small>}
                  </span>
                </button>
              ))}
            </div>
          )
          : (
            <div className="media-empty">
              <div className="album-art">▧</div>
              <h3>A story worth capturing.</h3>
              <p>Event photos and videos will be shared in organised albums.<br/>Visit again for moments from the dojo and beyond.</p>
            </div>
          )}
      </section>

      <section id="join" className="section join">
        <p className="eyebrow">TAKE YOUR FIRST STEP WITH SENSHI.</p>
        <h2>New to karate?<br/><em>You’re welcome here.</em></h2>
        <p>Looking for classes for yourself or your child?<br/>Contact our headquarters for training venues, timetables and joining details.</p>
        <div className="join-actions">
          <a className="button" href={mapsUrl} target="_blank" rel="noreferrer">VIEW OUR LOCATION ↗</a>
          {clubWhatsapp&&(
            <a className="button-secondary" href={'https://wa.me/'+clubWhatsapp} target="_blank" rel="noopener noreferrer">WHATSAPP ENQUIRY ↗</a>
          )}
        </div>
        <p className="address">{hqAddress}</p>
      </section>
    </main>

    <footer>
      <a className="brand" href="#">
        <img src="/club_logo.png" alt="Club logo"/>
        <span>SENSHI<small>GOJU-RYU KARATE DO</small></span>
      </a>
      <p>KELAB KARATE DO SENSHI GOJU-RYU<br/><span>REGISTRATION NO. {clubInfo.registration_no||'C SGR-13884'}</span></p>
      <div>
        <div className="admin-links">
          <a href="/admin">ADMIN CENTRE ↗</a>
          <a href={scmsUrl} target="_blank" rel="noopener noreferrer">SCMS MANAGEMENT LOGIN ↗</a>
        </div>
        <p>© {new Date().getFullYear()} Senshi Goju-Ryu.</p>
      </div>
    </footer>

    {selected&&(
      <div className="modal" role="dialog" aria-modal="true" aria-label={selected.name} onClick={()=>setSelected(null)}>
        <button autoFocus onClick={()=>setSelected(null)}>CLOSE ×</button>
        {selected.type.startsWith('video')
          ? <video controls autoPlay src={'/api/media/'+selected.id} onClick={e=>e.stopPropagation()}/>
          : <img src={'/api/media/'+selected.id} alt={selected.name}/>}
      </div>
    )}
  </>;
}

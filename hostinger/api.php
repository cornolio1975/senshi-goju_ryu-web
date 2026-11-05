<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function reply(array $data,int $status=200):never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data,JSON_THROW_ON_ERROR);
  exit;
}

function field(string $key,int $max,bool $required=true):string {
  $v=trim((string)($_POST[$key]??''));
  if($required&&$v==='')reply(['error'=>'Invalid '.$key.': field is required.'],400);
  if(mb_strlen($v)>$max)reply(['error'=>'Invalid '.$key.': maximum length is '.$max.' characters.'],400);
  return $v;
}

function ensureColumn(PDO $db,string $table,string $col,string $def):void {
  $cols=$db->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_COLUMN,1);
  if(!in_array($col,$cols,true)){
    $db->exec("ALTER TABLE $table ADD COLUMN $col $def");
  }
}

function logAudit(PDO $db,string $action,string $targetType,string $targetId,string $details=''):void {
  try {
    $id=bin2hex(random_bytes(16));
    $ip=hash('sha256',$_SERVER['REMOTE_ADDR']??'unknown');
    $q=$db->prepare('INSERT INTO audit_logs(id,actor,action,target_type,target_id,details,ip_hash,created) VALUES(?,?,?,?,?,?,?,?)');
    $q->execute([$id,'admin',$action,$targetType,$targetId,mb_substr($details,0,1000),$ip,gmdate('c')]);
  } catch (Throwable $e) {
    error_log('Senshi audit error: '.$e->getMessage());
  }
}

try {
  // Keep all database and media bytes outside public_html, isolated from sibling sites.
  $storage=isset($_ENV['SENSHI_STORAGE'])&&$_ENV['SENSHI_STORAGE']!==''?$_ENV['SENSHI_STORAGE']:(getenv('SENSHI_STORAGE')?:dirname(__DIR__,3).'/.senshi-goju-ryu');
  if(!is_dir($storage)&&!mkdir($storage,0700,true))throw new RuntimeException('Storage unavailable');
  $db=new PDO('sqlite:'.$storage.'/content.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');

  // Core and extended schema creation (idempotent, preserves existing data)
  $db->exec('
    CREATE TABLE IF NOT EXISTS bulletins(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,branch TEXT NOT NULL,launch INTEGER NOT NULL,close INTEGER NOT NULL,enabled INTEGER NOT NULL,updated TEXT NOT NULL,image TEXT NOT NULL DEFAULT "",status_mode TEXT NOT NULL DEFAULT "scheduled");
    CREATE TABLE IF NOT EXISTS bulletin_attachments(id TEXT PRIMARY KEY,bulletin_id TEXT NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,file_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS folders(id TEXT PRIMARY KEY,name TEXT NOT NULL,created TEXT NOT NULL,description TEXT NOT NULL DEFAULT "",event_date TEXT NOT NULL DEFAULT "",cover_media_id TEXT NOT NULL DEFAULT "",published INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,date TEXT NOT NULL,venue TEXT NOT NULL DEFAULT "",published INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,folder TEXT NOT NULL REFERENCES folders(id),name TEXT NOT NULL,type TEXT NOT NULL,created TEXT NOT NULL,description TEXT NOT NULL DEFAULT "",event_date TEXT NOT NULL DEFAULT "",external_url TEXT NOT NULL DEFAULT "",sort_order INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(ip TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS dojos(id TEXT PRIMARY KEY,name TEXT NOT NULL,slug TEXT NOT NULL DEFAULT "",description TEXT NOT NULL DEFAULT "",whatsapp TEXT NOT NULL DEFAULT "",sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,published INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS instructors(id TEXT PRIMARY KEY,name TEXT NOT NULL,rank TEXT NOT NULL DEFAULT "",bio TEXT NOT NULL DEFAULT "",contact TEXT NOT NULL DEFAULT "",whatsapp TEXT NOT NULL DEFAULT "",photo_id TEXT NOT NULL DEFAULT "",sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS dojo_instructors(id TEXT PRIMARY KEY,dojo_id TEXT NOT NULL REFERENCES dojos(id) ON DELETE CASCADE,instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT "Instructor",sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS training_locations(id TEXT PRIMARY KEY,dojo_id TEXT NOT NULL REFERENCES dojos(id) ON DELETE CASCADE,instructor_id TEXT NOT NULL DEFAULT "",venue_name TEXT NOT NULL,address TEXT NOT NULL DEFAULT "",maps_url TEXT NOT NULL DEFAULT "",whatsapp TEXT NOT NULL DEFAULT "",notes TEXT NOT NULL DEFAULT "",sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS training_sessions(id TEXT PRIMARY KEY,dojo_id TEXT NOT NULL REFERENCES dojos(id) ON DELETE CASCADE,location_id TEXT NOT NULL REFERENCES training_locations(id) ON DELETE CASCADE,instructor_id TEXT NOT NULL DEFAULT "",day_of_week TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,age_group TEXT NOT NULL DEFAULT "All ages",fees TEXT NOT NULL DEFAULT "",description TEXT NOT NULL DEFAULT "",availability TEXT NOT NULL DEFAULT "Open for enrolment",status TEXT NOT NULL DEFAULT "published",sort_order INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS club_info(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,details TEXT NOT NULL DEFAULT "",ip_hash TEXT NOT NULL DEFAULT "",created TEXT NOT NULL);
  ');

  // Safe migrations for existing tables
  ensureColumn($db,'bulletins','image','TEXT NOT NULL DEFAULT ""');
  ensureColumn($db,'bulletins','status_mode','TEXT NOT NULL DEFAULT "scheduled"');
  ensureColumn($db,'folders','description','TEXT NOT NULL DEFAULT ""');
  ensureColumn($db,'folders','event_date','TEXT NOT NULL DEFAULT ""');
  ensureColumn($db,'folders','cover_media_id','TEXT NOT NULL DEFAULT ""');
  ensureColumn($db,'folders','published','INTEGER NOT NULL DEFAULT 1');
  ensureColumn($db,'folders','sort_order','INTEGER NOT NULL DEFAULT 0');
  ensureColumn($db,'media','description','TEXT NOT NULL DEFAULT ""');
  ensureColumn($db,'media','event_date','TEXT NOT NULL DEFAULT ""');
  ensureColumn($db,'media','external_url','TEXT NOT NULL DEFAULT ""');
  ensureColumn($db,'media','sort_order','INTEGER NOT NULL DEFAULT 0');
  ensureColumn($db,'media','published','INTEGER NOT NULL DEFAULT 1');
  ensureColumn($db,'posts','venue','TEXT NOT NULL DEFAULT ""');
  ensureColumn($db,'posts','published','INTEGER NOT NULL DEFAULT 1');
  ensureColumn($db,'posts','sort_order','INTEGER NOT NULL DEFAULT 0');

  // Seed default dojos, instructors, and club_info if empty (preserving existing instructors)
  $nowSeed=gmdate('c');
  if((int)$db->query('SELECT COUNT(*) FROM dojos')->fetchColumn()===0){
    $seedDojos=[
      ['dojo_kannan','Dojo Shihan Kannan','dojo-shihan-kannan','Traditional Goju-Ryu karate training under Shihan Kannan. Open to children, teenagers and adults.',1],
      ['dojo_bala','Dojo Shihan Bala','dojo-shihan-bala','Traditional Goju-Ryu karate training under Shihan Bala. Developing discipline, respect, strength and unity.',2],
      ['dojo_mohan','Sensei Mohan','sensei-mohan','Traditional Goju-Ryu karate classes led by Sensei Mohan for students of all levels.',3],
    ];
    $qd=$db->prepare('INSERT OR IGNORE INTO dojos(id,name,slug,description,whatsapp,sort_order,active,published,updated) VALUES(?,?,?,?,?,?,1,1,?)');
    foreach($seedDojos as $sd)$qd->execute([$sd[0],$sd[1],$sd[2],$sd[3],'',$sd[4],$nowSeed]);
  }
  if((int)$db->query('SELECT COUNT(*) FROM instructors')->fetchColumn()===0){
    $seedInst=[
      ['inst_kannan','Shihan Kannan','Shihan','Senior Goju-Ryu karate instructor leading Dojo Shihan Kannan.',1,'dojo_kannan','Head Instructor'],
      ['inst_bala','Shihan Bala','Shihan','Senior Goju-Ryu karate instructor leading Dojo Shihan Bala.',2,'dojo_bala','Head Instructor'],
      ['inst_mohan','Sensei Mohan','Sensei','Dedicated Goju-Ryu karate instructor leading Sensei Mohan training group.',3,'dojo_mohan','Instructor'],
    ];
    $qi=$db->prepare('INSERT OR IGNORE INTO instructors(id,name,rank,bio,contact,whatsapp,photo_id,sort_order,active,updated) VALUES(?,?,?,?,?,?,?,1,?)');
    $qdi=$db->prepare('INSERT OR IGNORE INTO dojo_instructors(id,dojo_id,instructor_id,role,sort_order) VALUES(?,?,?,?,?)');
    foreach($seedInst as $si){
      $qi->execute([$si[0],$si[1],$si[2],$si[3],'','','',$si[4],$nowSeed]);
      $qdi->execute(['di_'.$si[0],$si[5],$si[0],$si[6],$si[4]]);
    }
  }
  if((int)$db->query('SELECT COUNT(*) FROM club_info')->fetchColumn()===0){
    $defaults=[
      'club_name'=>'KELAB KARATE DO SENSHI GOJU-RYU',
      'registration_no'=>'C SGR-13884',
      'motto'=>'DISCIPLINE · RESPECT · STRENGTH · UNITY',
      'headquarters'=>'No. 23, Jalan SP8/14, Saujana Puchong, 47100 Puchong, Selangor, Malaysia.',
      'maps_url'=>'https://www.google.com/maps/search/?api=1&query=No.+23+Jalan+SP8%2F14+Saujana+Puchong+47100',
      'whatsapp'=>'',
      'phone'=>'',
      'email'=>'',
      'president_name'=>'Club President',
      'president_role'=>'KELAB KARATE DO SENSHI GOJU-RYU · CLUB LEADERSHIP',
      'scms_url'=>'https://scms.spsportdatasolution.org/',
    ];
    $qci=$db->prepare('INSERT OR IGNORE INTO club_info(key,value,updated) VALUES(?,?,?)');
    foreach($defaults as $k=>$v)$qci->execute([$k,$v,$nowSeed]);
  }

  // Serve binary files (media, bulletin_image, attachment, instructor_photo)
  if(isset($_GET['media'])||isset($_GET['bulletin_image'])||isset($_GET['attachment'])||isset($_GET['instructor_photo'])) {
    $disposition='inline';
    $downloadName='';
    if(isset($_GET['bulletin_image'])){
      $id=(string)$_GET['bulletin_image'];
      if(!preg_match('/^[a-f0-9]{32}$/D',$id))reply(['error'=>'Not found'],404);
      $file=$storage.'/bimg_'.$id;
      if(!is_file($file))reply(['error'=>'Not found'],404);
      $m=['type'=>(new finfo(FILEINFO_MIME_TYPE))->file($file)?:'image/jpeg'];
    } elseif(isset($_GET['instructor_photo'])){
      $id=(string)$_GET['instructor_photo'];
      if(!preg_match('/^[a-f0-9]{32}$/D',$id))reply(['error'=>'Not found'],404);
      $file=$storage.'/iphoto_'.$id;
      if(!is_file($file))reply(['error'=>'Not found'],404);
      $m=['type'=>(new finfo(FILEINFO_MIME_TYPE))->file($file)?:'image/jpeg'];
    } elseif(isset($_GET['attachment'])){
      $id=(string)$_GET['attachment'];
      if(!preg_match('/^[a-f0-9]{32}$/D',$id))reply(['error'=>'Not found'],404);
      $q=$db->prepare('SELECT * FROM bulletin_attachments WHERE id=?');
      $q->execute([$id]);
      $att=$q->fetch(PDO::FETCH_ASSOC);
      if(!$att)reply(['error'=>'Not found'],404);
      $file=$storage.'/batt_'.$att['file_id'];
      if(!is_file($file))reply(['error'=>'Not found'],404);
      $m=['type'=>$att['mime']];
      $downloadName=preg_replace('/[^a-zA-Z0-9._-]/','_',$att['name']);
      if($att['mime']==='application/pdf'||!str_starts_with($att['mime'],'image/')){
        $disposition='inline; filename="'.$downloadName.'"';
      }
    } else {
      $id=(string)$_GET['media'];
      if(!preg_match('/^[a-f0-9]{32}$/D',$id))reply(['error'=>'Not found'],404);
      $q=$db->prepare('SELECT * FROM media WHERE id=?');
      $q->execute([$id]);
      $m=$q->fetch(PDO::FETCH_ASSOC);
      $file=$storage.'/'.$id;
      if(!$m||!is_file($file))reply(['error'=>'Not found'],404);
    }
    $size=filesize($file);$start=0;$end=$size-1;
    header('Content-Type: '.$m['type']);
    if($downloadName!=='')header('Content-Disposition: '.$disposition);
    header('Accept-Ranges: bytes');
    header('Cache-Control: public, max-age=3600');
    if(isset($_SERVER['HTTP_RANGE'])){
      if(!preg_match('/^bytes=(\d*)-(\d*)$/D',$_SERVER['HTTP_RANGE'],$r)||($r[1]===''&&$r[2]==='')){header('Content-Range: bytes */'.$size);http_response_code(416);exit;}
      if($r[1]===''){$start=max(0,$size-(int)$r[2]);}else{$start=(int)$r[1];if($r[2]!=='')$end=min($end,(int)$r[2]);}
      if($start>$end||$start>=$size){header('Content-Range: bytes */'.$size);http_response_code(416);exit;}
      http_response_code(206);header("Content-Range: bytes $start-$end/$size");
    }
    $length=$end-$start+1;header('Content-Length: '.$length);
    if($_SERVER['REQUEST_METHOD']==='HEAD')exit;
    $h=fopen($file,'rb');fseek($h,$start);
    while($length>0&&!feof($h)){$chunk=fread($h,min(65536,$length));if($chunk===false)break;echo $chunk;$length-=strlen($chunk);}
    fclose($h);exit;
  }

  // Public GET endpoint
  if($_SERVER['REQUEST_METHOD']==='GET'&&!isset($_GET['session'])){
    $nowTs=time();
    $data=[];
    $q=$db->prepare('SELECT id,title,body,branch,launch,close,image,status_mode FROM bulletins WHERE enabled=1 AND status_mode NOT IN ("draft","hidden") AND (status_mode="published" OR (launch<=? AND close>?)) AND close>? ORDER BY launch DESC');
    $q->execute([$nowTs,$nowTs,$nowTs]);
    $bulletins=$q->fetchAll(PDO::FETCH_ASSOC);
    $attAll=$db->query('SELECT id,bulletin_id,name,mime,size,created FROM bulletin_attachments ORDER BY created ASC')->fetchAll(PDO::FETCH_ASSOC);
    $attMap=[];
    foreach($attAll as $a){$attMap[$a['bulletin_id']][]=$a;}
    foreach($bulletins as &$b){$b['attachments']=$attMap[$b['id']]??[];}
    unset($b);
    $data['bulletins']=$bulletins;
    $data['server_time']=$nowTs;
    $data['folders']=$db->query('SELECT * FROM folders WHERE published=1 ORDER BY sort_order ASC, created DESC')->fetchAll(PDO::FETCH_ASSOC);
    $data['media']=$db->query('SELECT * FROM media WHERE published=1 ORDER BY sort_order ASC, created DESC')->fetchAll(PDO::FETCH_ASSOC);
    $data['posts']=$db->query('SELECT * FROM posts WHERE published=1 ORDER BY sort_order ASC, date DESC')->fetchAll(PDO::FETCH_ASSOC);
    $data['dojos']=$db->query('SELECT * FROM dojos WHERE active=1 AND published=1 ORDER BY sort_order ASC, name ASC')->fetchAll(PDO::FETCH_ASSOC);
    $data['instructors']=$db->query('SELECT * FROM instructors WHERE active=1 ORDER BY sort_order ASC, name ASC')->fetchAll(PDO::FETCH_ASSOC);
    $data['dojo_instructors']=$db->query('SELECT * FROM dojo_instructors ORDER BY sort_order ASC')->fetchAll(PDO::FETCH_ASSOC);
    $data['locations']=$db->query('SELECT * FROM training_locations WHERE active=1 ORDER BY sort_order ASC, venue_name ASC')->fetchAll(PDO::FETCH_ASSOC);
    $data['sessions']=$db->query('SELECT * FROM training_sessions WHERE status!="unpublished" ORDER BY sort_order ASC, start_time ASC')->fetchAll(PDO::FETCH_ASSOC);
    $ciRows=$db->query('SELECT key,value FROM club_info')->fetchAll(PDO::FETCH_KEY_PAIR);
    $data['club_info']=$ciRows?:[];
    reply($data);
  }

  // Session & Authentication setup
  $isHttps=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')||((int)($_SERVER['SERVER_PORT']??80)===443)||($_SERVER['HTTP_X_FORWARDED_PROTO']??'')==='https';
  ini_set('session.use_strict_mode','1');
  session_name('senshi_admin');
  session_set_cookie_params(['lifetime'=>0,'path'=>'/clubs/senshi_goju-ryu/','secure'=>$isHttps,'httponly'=>true,'samesite'=>'Strict']);
  session_start();
  if(!isset($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
  if(isset($_SESSION['last'])&&time()-$_SESSION['last']>1800)unset($_SESSION['auth']);
  if(isset($_GET['session']))reply(['authenticated'=>!empty($_SESSION['auth']),'csrf'=>$_SESSION['csrf']]);
  if($_SERVER['REQUEST_METHOD']!=='POST')reply(['error'=>'Method not allowed'],405);

  $origin=$_SERVER['HTTP_ORIGIN']??'';
  $allowedOrigins=['https://spsportdatasolution.org','http://localhost:8099','http://127.0.0.1:8099'];
  if(!in_array($origin,$allowedOrigins,true))reply(['error'=>'Invalid origin'],403);
  if(!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??'')))reply(['error'=>'Invalid security token. Refresh the page.'],403);

  $hash=$db->query("SELECT value FROM settings WHERE key='password'")->fetchColumn();
  if(!$hash){
    define('SENSHI_CONFIG',true);
    $cfg=require __DIR__.'/config.php';
    $hash=$cfg['hash'];
    $q=$db->prepare("INSERT OR IGNORE INTO settings VALUES('password',?)");
    $q->execute([$hash]);
  }

  $action=$_POST['action']??'';
  if($action==='login'){
    $ip=hash('sha256',$_SERVER['REMOTE_ADDR']??'unknown');
    $q=$db->prepare('SELECT * FROM attempts WHERE ip=?');
    $q->execute([$ip]);
    $a=$q->fetch(PDO::FETCH_ASSOC);
    if($a&&$a['until']>time()&&$a['count']>=5)reply(['error'=>'Too many attempts. Try again in 15 minutes.'],429);
    if(!password_verify((string)($_POST['password']??''),$hash)){
      $count=$a&&$a['until']>time()?(int)$a['count']+1:1;
      $q=$db->prepare('INSERT OR REPLACE INTO attempts VALUES(?,?,?)');
      $q->execute([$ip,$count,time()+900]);
      logAudit($db,'login_failed','auth','admin','Incorrect password attempt #'.$count);
      reply(['error'=>'Incorrect password'],401);
    }
    $db->prepare('DELETE FROM attempts WHERE ip=?')->execute([$ip]);
    session_regenerate_id(true);
    $_SESSION['auth']=true;
    $_SESSION['last']=time();
    $_SESSION['credential']=hash('sha256',$hash);
    $_SESSION['csrf']=bin2hex(random_bytes(32));
    logAudit($db,'login_success','auth','admin','Administrator signed in');
    reply(['success'=>true,'csrf'=>$_SESSION['csrf']]);
  }

  if(empty($_SESSION['auth'])||!hash_equals(hash('sha256',$hash),(string)($_SESSION['credential']??''))){
    reply(['error'=>'Administrator sign in required'],401);
  }
  $_SESSION['last']=time();

  if($action==='bulletins'){
    $bulletins=$db->query('SELECT * FROM bulletins ORDER BY launch DESC')->fetchAll(PDO::FETCH_ASSOC);
    $attAll=$db->query('SELECT id,bulletin_id,name,mime,size,created FROM bulletin_attachments ORDER BY created ASC')->fetchAll(PDO::FETCH_ASSOC);
    $attMap=[];
    foreach($attAll as $a){$attMap[$a['bulletin_id']][]=$a;}
    foreach($bulletins as &$b){$b['attachments']=$attMap[$b['id']]??[];}
    unset($b);
    reply(['bulletins'=>$bulletins,'server_time'=>time()]);
  }

  if($action==='admin_data'){
    $bulletins=$db->query('SELECT * FROM bulletins ORDER BY launch DESC')->fetchAll(PDO::FETCH_ASSOC);
    $attAll=$db->query('SELECT id,bulletin_id,name,mime,size,created FROM bulletin_attachments ORDER BY created ASC')->fetchAll(PDO::FETCH_ASSOC);
    $attMap=[];
    foreach($attAll as $a){$attMap[$a['bulletin_id']][]=$a;}
    foreach($bulletins as &$b){$b['attachments']=$attMap[$b['id']]??[];}
    unset($b);
    reply([
      'server_time'=>time(),
      'bulletins'=>$bulletins,
      'folders'=>$db->query('SELECT * FROM folders ORDER BY sort_order ASC, created DESC')->fetchAll(PDO::FETCH_ASSOC),
      'media'=>$db->query('SELECT * FROM media ORDER BY sort_order ASC, created DESC')->fetchAll(PDO::FETCH_ASSOC),
      'posts'=>$db->query('SELECT * FROM posts ORDER BY sort_order ASC, date DESC')->fetchAll(PDO::FETCH_ASSOC),
      'dojos'=>$db->query('SELECT * FROM dojos ORDER BY sort_order ASC, name ASC')->fetchAll(PDO::FETCH_ASSOC),
      'instructors'=>$db->query('SELECT * FROM instructors ORDER BY sort_order ASC, name ASC')->fetchAll(PDO::FETCH_ASSOC),
      'dojo_instructors'=>$db->query('SELECT * FROM dojo_instructors ORDER BY sort_order ASC')->fetchAll(PDO::FETCH_ASSOC),
      'locations'=>$db->query('SELECT * FROM training_locations ORDER BY sort_order ASC, venue_name ASC')->fetchAll(PDO::FETCH_ASSOC),
      'sessions'=>$db->query('SELECT * FROM training_sessions ORDER BY sort_order ASC, start_time ASC')->fetchAll(PDO::FETCH_ASSOC),
      'club_info'=>$db->query('SELECT key,value FROM club_info')->fetchAll(PDO::FETCH_KEY_PAIR)?:[],
      'audit_logs'=>$db->query('SELECT * FROM audit_logs ORDER BY created DESC LIMIT 200')->fetchAll(PDO::FETCH_ASSOC),
    ]);
  }

  if($action==='logout'){
    logAudit($db,'logout','auth','admin','Administrator signed out');
    $_SESSION=[];
    session_destroy();
    reply(['success'=>true]);
  }

  if($action==='password'){
    if(!password_verify((string)($_POST['current']??''),$hash))reply(['error'=>'Current password is incorrect'],403);
    $p=field('password',256);
    if(strlen($p)<14)reply(['error'=>'Use at least 14 characters'],400);
    $q=$db->prepare("UPDATE settings SET value=? WHERE key='password'");
    $q->execute([password_hash($p,PASSWORD_DEFAULT)]);
    logAudit($db,'password_change','auth','admin','Administrator changed password');
    $_SESSION=[];
    session_destroy();
    reply(['success'=>true]);
  }

  $id=bin2hex(random_bytes(16));
  $now=gmdate('c');

  // BULLETIN CREATE / UPDATE
  if($action==='bulletin'){
    $launch=field('launch',16);
    $close=field('close',16);
    $tz=new DateTimeZone('Asia/Kuala_Lumpur');
    $start=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i',$launch,$tz);
    $end=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i',$close,$tz);
    if(!$start||!$end||$start->format('Y-m-d\TH:i')!==$launch||$end->format('Y-m-d\TH:i')!==$close||$end<=$start){
      reply(['error'=>'Closing time must be after a valid launch time.'],400);
    }
    $title=field('title',200);
    $body=field('body',8000);
    $branch=field('branch',150);
    $statusMode=trim((string)($_POST['status_mode']??''));
    if(!in_array($statusMode,['draft','scheduled','published','hidden'],true)){
      $statusMode=(($_POST['enabled']??'1')==='1')?'scheduled':'draft';
    }
    $enabled=in_array($statusMode,['scheduled','published'],true)?1:0;

    $edit=trim((string)($_POST['id']??''));
    $existingImage='';
    if($edit!==''){
      if(!preg_match('/^[a-f0-9]{32}$/D',$edit))reply(['error'=>'Invalid bulletin'],400);
      $q=$db->prepare('SELECT id,image FROM bulletins WHERE id=?');
      $q->execute([$edit]);
      $row=$q->fetch(PDO::FETCH_ASSOC);
      if(!$row)reply(['error'=>'Bulletin not found'],404);
      $id=$edit;
      $existingImage=(string)($row['image']??'');
    } else {
      // Prevent accidental duplicate submission within 10 seconds
      $dupQ=$db->prepare('SELECT id FROM bulletins WHERE title=? AND branch=? AND launch=? AND close=? AND updated>=?');
      $dupQ->execute([$title,$branch,$start->getTimestamp(),$end->getTimestamp(),gmdate('c',time()-10)]);
      if($dupQ->fetchColumn())reply(['error'=>'This announcement was just saved. Duplicate submission prevented.'],409);
    }

    $imageId=$existingImage;
    if(($_POST['remove_image']??'')==='1'&&$imageId!==''){
      if(preg_match('/^[a-f0-9]{32}$/D',$imageId)&&is_file($storage.'/bimg_'.$imageId))unlink($storage.'/bimg_'.$imageId);
      $imageId='';
    }
    $f=$_FILES['image']??null;
    if($f&&$f['error']!==UPLOAD_ERR_NO_FILE){
      if($f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name'])||$f['size']<=0||$f['size']>50*1024*1024){
        reply(['error'=>'Image upload failed. Maximum file size is 50 MB.'],400);
      }
      $type=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
      if(!in_array($type,['image/jpeg','image/png','image/webp'],true)){
        reply(['error'=>'Unsupported image type. Use JPG, PNG or WebP.'],400);
      }
      $newImg=bin2hex(random_bytes(16));
      if(!move_uploaded_file($f['tmp_name'],$storage.'/bimg_'.$newImg))throw new RuntimeException('Image upload failed');
      chmod($storage.'/bimg_'.$newImg,0600);
      if($imageId!==''&&preg_match('/^[a-f0-9]{32}$/D',$imageId)&&is_file($storage.'/bimg_'.$imageId))unlink($storage.'/bimg_'.$imageId);
      $imageId=$newImg;
    }

    $q=$db->prepare('INSERT INTO bulletins(id,title,body,branch,launch,close,enabled,updated,image,status_mode) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,branch=excluded.branch,launch=excluded.launch,close=excluded.close,enabled=excluded.enabled,updated=excluded.updated,image=excluded.image,status_mode=excluded.status_mode');
    $q->execute([$id,$title,$body,$branch,$start->getTimestamp(),$end->getTimestamp(),$enabled,$now,$imageId,$statusMode]);

    // Optional attachment upload (PDF, JPEG, PNG, WebP)
    $attFile=$_FILES['attachment']??null;
    if($attFile&&$attFile['error']!==UPLOAD_ERR_NO_FILE){
      if($attFile['error']!==UPLOAD_ERR_OK||!is_uploaded_file($attFile['tmp_name'])||$attFile['size']<=0||$attFile['size']>50*1024*1024){
        reply(['error'=>'Attachment upload failed. Maximum file size is 50 MB.'],400);
      }
      $attMime=(new finfo(FILEINFO_MIME_TYPE))->file($attFile['tmp_name']);
      if(!in_array($attMime,['application/pdf','image/jpeg','image/png','image/webp'],true)){
        reply(['error'=>'Unsupported attachment type. Use PDF, JPG, PNG or WebP.'],400);
      }
      $attId=bin2hex(random_bytes(16));
      $fileId=bin2hex(random_bytes(16));
      if(!move_uploaded_file($attFile['tmp_name'],$storage.'/batt_'.$fileId))throw new RuntimeException('Attachment upload failed');
      chmod($storage.'/batt_'.$fileId,0600);
      $qa=$db->prepare('INSERT INTO bulletin_attachments(id,bulletin_id,file_id,name,mime,size,created) VALUES(?,?,?,?,?,?,?)');
      $qa->execute([$attId,$id,$fileId,mb_substr(basename($attFile['name']),0,200),$attMime,(int)$attFile['size'],$now]);
    }
    logAudit($db,$edit!==''?'bulletin_update':'bulletin_create','bulletin',$id,$title.' ('.$branch.', '.$statusMode.')');
  }

  // BULLETIN QUICK STATUS TOGGLE
  elseif($action==='bulletin_status'){
    $bId=field('id',32);
    $mode=field('status_mode',20);
    if(!in_array($mode,['draft','scheduled','published','hidden'],true))reply(['error'=>'Invalid status mode'],400);
    $enabled=in_array($mode,['scheduled','published'],true)?1:0;
    $q=$db->prepare('UPDATE bulletins SET status_mode=?,enabled=?,updated=? WHERE id=?');
    $q->execute([$mode,$enabled,$now,$bId]);
    logAudit($db,'bulletin_status','bulletin',$bId,'Changed status to '.$mode);
  }

  // DOJO SAVE / REORDER
  elseif($action==='dojo'){
    $edit=trim((string)($_POST['id']??''));
    if($edit!=='')$id=$edit;
    $name=field('name',150);
    $slug=strtolower((string)preg_replace('/[^a-zA-Z0-9]+/','-',$name));
    $description=field('description',2000,false);
    $whatsapp=field('whatsapp',40,false);
    $sortOrder=(int)($_POST['sort_order']??0);
    $active=($_POST['active']??'1')==='1'?1:0;
    $published=($_POST['published']??'1')==='1'?1:0;
    $q=$db->prepare('INSERT INTO dojos(id,name,slug,description,whatsapp,sort_order,active,published,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,description=excluded.description,whatsapp=excluded.whatsapp,sort_order=excluded.sort_order,active=excluded.active,published=excluded.published,updated=excluded.updated');
    $q->execute([$id,$name,$slug,$description,$whatsapp,$sortOrder,$active,$published,$now]);
    logAudit($db,$edit!==''?'dojo_update':'dojo_create','dojo',$id,$name);
  }

  // INSTRUCTOR SAVE
  elseif($action==='instructor'){
    $edit=trim((string)($_POST['id']??''));
    $existingPhoto='';
    if($edit!==''){
      $id=$edit;
      $qp=$db->prepare('SELECT photo_id FROM instructors WHERE id=?');
      $qp->execute([$id]);
      $existingPhoto=(string)$qp->fetchColumn();
    }
    $name=field('name',150);
    $rank=field('rank',100,false);
    $bio=field('bio',3000,false);
    $contact=field('contact',200,false);
    $whatsapp=field('whatsapp',40,false);
    $sortOrder=(int)($_POST['sort_order']??0);
    $active=($_POST['active']??'1')==='1'?1:0;
    $photoId=$existingPhoto;
    if(($_POST['remove_photo']??'')==='1'&&$photoId!==''){
      if(preg_match('/^[a-f0-9]{32}$/D',$photoId)&&is_file($storage.'/iphoto_'.$photoId))unlink($storage.'/iphoto_'.$photoId);
      $photoId='';
    }
    $pf=$_FILES['photo']??null;
    if($pf&&$pf['error']!==UPLOAD_ERR_NO_FILE){
      if($pf['error']!==UPLOAD_ERR_OK||!is_uploaded_file($pf['tmp_name'])||$pf['size']<=0||$pf['size']>20*1024*1024){
        reply(['error'=>'Photo upload failed. Maximum size is 20 MB.'],400);
      }
      $ptype=(new finfo(FILEINFO_MIME_TYPE))->file($pf['tmp_name']);
      if(!in_array($ptype,['image/jpeg','image/png','image/webp'],true))reply(['error'=>'Use JPG, PNG or WebP for instructor photo.'],400);
      $newPhoto=bin2hex(random_bytes(16));
      if(!move_uploaded_file($pf['tmp_name'],$storage.'/iphoto_'.$newPhoto))throw new RuntimeException('Photo upload failed');
      chmod($storage.'/iphoto_'.$newPhoto,0600);
      if($photoId!==''&&preg_match('/^[a-f0-9]{32}$/D',$photoId)&&is_file($storage.'/iphoto_'.$photoId))unlink($storage.'/iphoto_'.$photoId);
      $photoId=$newPhoto;
    }
    $q=$db->prepare('INSERT INTO instructors(id,name,rank,bio,contact,whatsapp,photo_id,sort_order,active,updated) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,rank=excluded.rank,bio=excluded.bio,contact=excluded.contact,whatsapp=excluded.whatsapp,photo_id=excluded.photo_id,sort_order=excluded.sort_order,active=excluded.active,updated=excluded.updated');
    $q->execute([$id,$name,$rank,$bio,$contact,$whatsapp,$photoId,$sortOrder,$active,$now]);

    // Optional dojo assignments (comma-separated dojo_ids)
    if(isset($_POST['dojo_ids'])){
      $db->prepare('DELETE FROM dojo_instructors WHERE instructor_id=?')->execute([$id]);
      $dojoIds=array_filter(array_map('trim',explode(',',(string)$_POST['dojo_ids'])));
      $role=field('role',100,false)?:'Instructor';
      $qdi=$db->prepare('INSERT INTO dojo_instructors(id,dojo_id,instructor_id,role,sort_order) VALUES(?,?,?,?,?)');
      $idx=0;
      foreach($dojoIds as $dId){
        $qdi->execute([bin2hex(random_bytes(16)),$dId,$id,$role,$idx++]);
      }
    }
    logAudit($db,$edit!==''?'instructor_update':'instructor_create','instructor',$id,$name.' ('.$rank.')');
  }

  // TRAINING LOCATION SAVE
  elseif($action==='location'){
    $edit=trim((string)($_POST['id']??''));
    if($edit!=='')$id=$edit;
    $dojoId=field('dojo_id',64);
    $instructorId=field('instructor_id',64,false);
    $venueName=field('venue_name',200);
    $address=field('address',500,false);
    $mapsUrl=field('maps_url',1000,false);
    $whatsapp=field('whatsapp',40,false);
    $notes=field('notes',1000,false);
    $sortOrder=(int)($_POST['sort_order']??0);
    $active=($_POST['active']??'1')==='1'?1:0;
    $q=$db->prepare('INSERT INTO training_locations(id,dojo_id,instructor_id,venue_name,address,maps_url,whatsapp,notes,sort_order,active,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET dojo_id=excluded.dojo_id,instructor_id=excluded.instructor_id,venue_name=excluded.venue_name,address=excluded.address,maps_url=excluded.maps_url,whatsapp=excluded.whatsapp,notes=excluded.notes,sort_order=excluded.sort_order,active=excluded.active,updated=excluded.updated');
    $q->execute([$id,$dojoId,$instructorId,$venueName,$address,$mapsUrl,$whatsapp,$notes,$sortOrder,$active,$now]);
    logAudit($db,$edit!==''?'location_update':'location_create','location',$id,$venueName);
  }

  // TRAINING SESSION SAVE (with schedule overlap detection)
  elseif($action==='session'){
    $edit=trim((string)($_POST['id']??''));
    if($edit!=='')$id=$edit;
    $dojoId=field('dojo_id',64);
    $locationId=field('location_id',64);
    $instructorId=field('instructor_id',64,false);
    $dayOfWeek=field('day_of_week',30);
    $startTime=field('start_time',10);
    $endTime=field('end_time',10);
    if($endTime<=$startTime)reply(['error'=>'Session end time must be after start time.'],400);
    $ageGroup=field('age_group',150,false)?:'All ages';
    $fees=field('fees',200,false);
    $description=field('description',1000,false);
    $availability=field('availability',150,false)?:'Open for enrolment';
    $status=field('status',30,false)?:'published';
    if(!in_array($status,['published','unpublished','suspended'],true))$status='published';
    $sortOrder=(int)($_POST['sort_order']??0);

    // Check overlapping instructor schedule on same day
    $warnings=[];
    if($instructorId!==''&&$status==='published'){
      $qo=$db->prepare('SELECT ts.*, tl.venue_name FROM training_sessions ts LEFT JOIN training_locations tl ON ts.location_id=tl.id WHERE ts.instructor_id=? AND ts.day_of_week=? AND ts.id!=? AND ts.status="published" AND ts.start_time<? AND ts.end_time>?');
      $qo->execute([$instructorId,$dayOfWeek,$id,$endTime,$startTime]);
      $overlaps=$qo->fetchAll(PDO::FETCH_ASSOC);
      foreach($overlaps as $ov){
        $warnings[]='Schedule conflict warning: Instructor is already scheduled on '.$dayOfWeek.' '.$ov['start_time'].'–'.$ov['end_time'].' at '.($ov['venue_name']?:'another venue').'.';
      }
    }

    $q=$db->prepare('INSERT INTO training_sessions(id,dojo_id,location_id,instructor_id,day_of_week,start_time,end_time,age_group,fees,description,availability,status,sort_order,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET dojo_id=excluded.dojo_id,location_id=excluded.location_id,instructor_id=excluded.instructor_id,day_of_week=excluded.day_of_week,start_time=excluded.start_time,end_time=excluded.end_time,age_group=excluded.age_group,fees=excluded.fees,description=excluded.description,availability=excluded.availability,status=excluded.status,sort_order=excluded.sort_order,updated=excluded.updated');
    $q->execute([$id,$dojoId,$locationId,$instructorId,$dayOfWeek,$startTime,$endTime,$ageGroup,$fees,$description,$availability,$status,$sortOrder,$now]);
    logAudit($db,$edit!==''?'session_update':'session_create','session',$id,$dayOfWeek.' '.$startTime.'-'.$endTime);
    reply(['success'=>true,'id'=>$id,'warnings'=>$warnings]);
  }

  // MEDIA FOLDER CREATE / UPDATE
  elseif($action==='folder'){
    $edit=trim((string)($_POST['id']??''));
    if($edit!=='')$id=$edit;
    $name=field('name',100);
    $description=field('description',1000,false);
    $eventDate=field('event_date',20,false);
    $coverMediaId=field('cover_media_id',64,false);
    $published=($_POST['published']??'1')==='1'?1:0;
    $sortOrder=(int)($_POST['sort_order']??0);
    $q=$db->prepare('INSERT INTO folders(id,name,created,description,event_date,cover_media_id,published,sort_order) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,event_date=excluded.event_date,cover_media_id=excluded.cover_media_id,published=excluded.published,sort_order=excluded.sort_order');
    $q->execute([$id,$name,$now,$description,$eventDate,$coverMediaId,$published,$sortOrder]);
    logAudit($db,$edit!==''?'folder_update':'folder_create','folder',$id,$name);
  }

  // MEDIA UPLOAD (Supports single or multiple files, or hosted video link)
  elseif($action==='upload'){
    $folder=field('folder',64);
    $q=$db->prepare('SELECT id FROM folders WHERE id=?');
    $q->execute([$folder]);
    if(!$q->fetchColumn())reply(['error'=>'Album not found'],400);
    $description=field('description',1000,false);
    $eventDate=field('event_date',20,false);
    $externalUrl=field('external_url',1000,false);
    $sortOrder=(int)($_POST['sort_order']??0);
    $published=($_POST['published']??'1')==='1'?1:0;

    if($externalUrl!==''){
      if(!preg_match('#^https://(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/#i',$externalUrl)){
        reply(['error'=>'Hosted video links must be valid HTTPS YouTube or Vimeo URLs.'],400);
      }
      $title=field('title',200,false)?:'Hosted Event Video';
      $q=$db->prepare('INSERT INTO media(id,folder,name,type,created,description,event_date,external_url,sort_order,published) VALUES(?,?,?,?,?,?,?,?,?,?)');
      $q->execute([$id,$folder,$title,'video/external',$now,$description,$eventDate,$externalUrl,$sortOrder,$published]);
      logAudit($db,'media_link','media',$id,$title.' -> '.$externalUrl);
      reply(['success'=>true,'id'=>$id]);
    }

    // Handle single file (`file`) or multiple files (`files[]` or `file`)
    $uploadedIds=[];
    $fileList=[];
    if(isset($_FILES['files'])&&is_array($_FILES['files']['name'])){
      $count=count($_FILES['files']['name']);
      for($i=0;$i<$count;$i++){
        if($_FILES['files']['error'][$i]===UPLOAD_ERR_NO_FILE)continue;
        $fileList[]=[
          'name'=>$_FILES['files']['name'][$i],
          'tmp_name'=>$_FILES['files']['tmp_name'][$i],
          'error'=>$_FILES['files']['error'][$i],
          'size'=>$_FILES['files']['size'][$i],
        ];
      }
    }
    if(isset($_FILES['file'])&&($_FILES['file']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE){
      $fileList[]=$_FILES['file'];
    }
    if(!$fileList)reply(['error'=>'Please select at least one photo or video file to upload.'],400);

    foreach($fileList as $f){
      if($f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name'])||$f['size']<=0||$f['size']>50*1024*1024){
        reply(['error'=>'Upload failed. Maximum file size is 50 MB per file.'],400);
      }
      $type=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
      if(!in_array($type,['image/jpeg','image/png','image/webp','video/mp4','video/webm'],true)){
        reply(['error'=>'Unsupported media type. Use JPG, PNG, WebP, MP4 or WebM.'],400);
      }
      $mId=bin2hex(random_bytes(16));
      if(!move_uploaded_file($f['tmp_name'],$storage.'/'.$mId))throw new RuntimeException('Upload failed');
      chmod($storage.'/'.$mId,0600);
      $customName=count($fileList)===1&&trim((string)($_POST['title']??''))!==''?field('title',200,false):mb_substr(basename($f['name']),0,200);
      try{
        $q=$db->prepare('INSERT INTO media(id,folder,name,type,created,description,event_date,external_url,sort_order,published) VALUES(?,?,?,?,?,?,?,?,?,?)');
        $q->execute([$mId,$folder,$customName,$type,$now,$description,$eventDate,'',$sortOrder,$published]);
        $uploadedIds[]=$mId;
      }catch(Throwable $e){
        unlink($storage.'/'.$mId);
        throw $e;
      }
    }
    logAudit($db,'media_upload','media',$uploadedIds[0]??$id,'Uploaded '.count($uploadedIds).' media item(s) to folder '.$folder);
    reply(['success'=>true,'ids'=>$uploadedIds]);
  }

  // MEDIA METADATA EDIT
  elseif($action==='media_edit'){
    $mId=field('id',64);
    $name=field('name',200);
    $folder=field('folder',64);
    $description=field('description',1000,false);
    $eventDate=field('event_date',20,false);
    $sortOrder=(int)($_POST['sort_order']??0);
    $published=($_POST['published']??'1')==='1'?1:0;
    $q=$db->prepare('UPDATE media SET name=?,folder=?,description=?,event_date=?,sort_order=?,published=? WHERE id=?');
    $q->execute([$name,$folder,$description,$eventDate,$sortOrder,$published,$mId]);
    if(($_POST['set_cover']??'')==='1'){
      $db->prepare('UPDATE folders SET cover_media_id=? WHERE id=?')->execute([$mId,$folder]);
    }
    logAudit($db,'media_update','media',$mId,$name);
  }

  // TOURNAMENT / PRESIDENT POST CREATE OR UPDATE
  elseif($action==='post'){
    $edit=trim((string)($_POST['id']??''));
    if($edit!=='')$id=$edit;
    $kind=field('kind',20);
    if(!in_array($kind,['past','upcoming','president'],true))reply(['error'=>'Invalid section'],400);
    $date=field('date',10);
    $dateObject=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
    if(!$dateObject||$dateObject->format('Y-m-d')!==$date)reply(['error'=>'Invalid date'],400);
    $title=field('title',200);
    $body=field('body',8000);
    $venue=field('venue',200,false);
    $published=($_POST['published']??'1')==='1'?1:0;
    $sortOrder=(int)($_POST['sort_order']??0);
    $q=$db->prepare('INSERT INTO posts(id,kind,title,body,date,venue,published,sort_order) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,body=excluded.body,date=excluded.date,venue=excluded.venue,published=excluded.published,sort_order=excluded.sort_order');
    $q->execute([$id,$kind,$title,$body,$date,$venue,$published,$sortOrder]);
    logAudit($db,$edit!==''?'post_update':'post_create','post',$id,$kind.': '.$title);
  }

  // CLUB INFORMATION UPDATE
  elseif($action==='club_info'){
    $allowedKeys=['club_name','registration_no','motto','headquarters','maps_url','whatsapp','phone','email','president_name','president_role','scms_url'];
    $q=$db->prepare('INSERT INTO club_info(key,value,updated) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated');
    foreach($allowedKeys as $k){
      if(isset($_POST[$k])){
        $val=trim((string)$_POST[$k]);
        if(mb_strlen($val)>1000)reply(['error'=>'Invalid '.$k],400);
        $q->execute([$k,$val,$now]);
      }
    }
    logAudit($db,'club_info_update','club_info','settings','Updated club profile information');
  }

  // DELETE OPERATIONS
  elseif($action==='delete'){
    $tables=[
      'bulletin'=>'bulletins',
      'bulletin_attachment'=>'bulletin_attachments',
      'folder'=>'folders',
      'post'=>'posts',
      'media'=>'media',
      'dojo'=>'dojos',
      'instructor'=>'instructors',
      'location'=>'training_locations',
      'session'=>'training_sessions',
    ];
    $typeKey=(string)($_POST['type']??'');
    $t=$tables[$typeKey]??null;
    if(!$t)reply(['error'=>'Invalid item type'],400);
    $deleteId=field('id',64);
    if($t==='folders'){
      $q=$db->prepare('SELECT COUNT(*) FROM media WHERE folder=?');
      $q->execute([$deleteId]);
      if($q->fetchColumn())reply(['error'=>'Delete media from this album first'],409);
    }
    if($t==='bulletins'){
      $q=$db->prepare('SELECT image FROM bulletins WHERE id=?');
      $q->execute([$deleteId]);
      $bimg=(string)$q->fetchColumn();
      if($bimg!==''&&preg_match('/^[a-f0-9]{32}$/D',$bimg)&&is_file($storage.'/bimg_'.$bimg))unlink($storage.'/bimg_'.$bimg);
      $qa=$db->prepare('SELECT file_id FROM bulletin_attachments WHERE bulletin_id=?');
      $qa->execute([$deleteId]);
      foreach($qa->fetchAll(PDO::FETCH_COLUMN) as $fid){
        if(preg_match('/^[a-f0-9]{32}$/D',(string)$fid)&&is_file($storage.'/batt_'.$fid))unlink($storage.'/batt_'.$fid);
      }
    }
    if($t==='bulletin_attachments'){
      $qa=$db->prepare('SELECT file_id FROM bulletin_attachments WHERE id=?');
      $qa->execute([$deleteId]);
      $fid=(string)$qa->fetchColumn();
      if($fid!==''&&preg_match('/^[a-f0-9]{32}$/D',$fid)&&is_file($storage.'/batt_'.$fid))unlink($storage.'/batt_'.$fid);
    }
    if($t==='instructors'){
      $qi=$db->prepare('SELECT photo_id FROM instructors WHERE id=?');
      $qi->execute([$deleteId]);
      $pid=(string)$qi->fetchColumn();
      if($pid!==''&&preg_match('/^[a-f0-9]{32}$/D',$pid)&&is_file($storage.'/iphoto_'.$pid))unlink($storage.'/iphoto_'.$pid);
    }
    $db->prepare("DELETE FROM $t WHERE id=?")->execute([$deleteId]);
    if($t==='media'&&preg_match('/^[a-f0-9]{32}$/D',$deleteId)&&is_file($storage.'/'.$deleteId))unlink($storage.'/'.$deleteId);
    logAudit($db,'delete',$typeKey,$deleteId,'Deleted '.$typeKey.' '.$deleteId);
    reply(['success'=>true]);
  }
  else reply(['error'=>'Invalid action'],400);

  reply(['success'=>true,'id'=>$id]);
}catch(Throwable $e){
  error_log('Senshi error: '.$e->getMessage());
  reply(['error'=>'Server could not complete the request. Please try again.'],500);
}

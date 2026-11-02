<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
function reply(array $data,int $status=200):never {http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_THROW_ON_ERROR);exit;}
function field(string $key,int $max):string {$v=trim((string)($_POST[$key]??''));if($v===''||mb_strlen($v)>$max)reply(['error'=>'Invalid '.$key],400);return $v;}
try {
// Keep all database and media bytes outside public_html, isolated from sibling sites.
$storage=dirname(__DIR__,3).'/.senshi-goju-ryu';
if(!is_dir($storage)&&!mkdir($storage,0700,true))throw new RuntimeException('Storage unavailable');
$db=new PDO('sqlite:'.$storage.'/content.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS folders(id TEXT PRIMARY KEY,name TEXT NOT NULL,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,date TEXT NOT NULL); CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,folder TEXT NOT NULL REFERENCES folders(id),name TEXT NOT NULL,type TEXT NOT NULL,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS attempts(ip TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);');
if(isset($_GET['media'])) {
$id=(string)$_GET['media'];if(!preg_match('/^[a-f0-9]{32}$/D',$id))reply(['error'=>'Not found'],404);
$q=$db->prepare('SELECT * FROM media WHERE id=?');$q->execute([$id]);$m=$q->fetch(PDO::FETCH_ASSOC);$file=$storage.'/'.$id;if(!$m||!is_file($file))reply(['error'=>'Not found'],404);
$size=filesize($file);$start=0;$end=$size-1;header('Content-Type: '.$m['type']);header('Accept-Ranges: bytes');header('Cache-Control: public, max-age=3600');
if(isset($_SERVER['HTTP_RANGE'])){if(!preg_match('/^bytes=(\d*)-(\d*)$/D',$_SERVER['HTTP_RANGE'],$r)||($r[1]===''&&$r[2]==='')){header('Content-Range: bytes */'.$size);http_response_code(416);exit;}if($r[1]===''){$start=max(0,$size-(int)$r[2]);}else{$start=(int)$r[1];if($r[2]!=='')$end=min($end,(int)$r[2]);}if($start>$end||$start>=$size){header('Content-Range: bytes */'.$size);http_response_code(416);exit;}http_response_code(206);header("Content-Range: bytes $start-$end/$size");}
$length=$end-$start+1;header('Content-Length: '.$length);if($_SERVER['REQUEST_METHOD']==='HEAD')exit;$h=fopen($file,'rb');fseek($h,$start);while($length>0&&!feof($h)){$chunk=fread($h,min(65536,$length));if($chunk===false)break;echo $chunk;$length-=strlen($chunk);}fclose($h);exit;
}
if($_SERVER['REQUEST_METHOD']==='GET'&&!isset($_GET['session'])){$data=[];foreach(['folders','media','posts'] as $t){$order=$t==='posts'?'date':'created';$data[$t]=$db->query("SELECT * FROM $t ORDER BY $order DESC")->fetchAll(PDO::FETCH_ASSOC);}reply($data);}
ini_set('session.use_strict_mode','1');session_name('senshi_admin');session_set_cookie_params(['lifetime'=>0,'path'=>'/clubs/senshi_goju-ryu/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);session_start();
if(!isset($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
if(isset($_SESSION['last'])&&time()-$_SESSION['last']>1800)unset($_SESSION['auth']);
if(isset($_GET['session']))reply(['authenticated'=>!empty($_SESSION['auth']),'csrf'=>$_SESSION['csrf']]);
if($_SERVER['REQUEST_METHOD']!=='POST')reply(['error'=>'Method not allowed'],405);
if(($_SERVER['HTTP_ORIGIN']??'')!=='https://spsportdatasolution.org')reply(['error'=>'Invalid origin'],403);
if(!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??'')))reply(['error'=>'Invalid security token. Refresh the page.'],403);
$hash=$db->query("SELECT value FROM settings WHERE key='password'")->fetchColumn();
if(!$hash){define('SENSHI_CONFIG',true);$cfg=require __DIR__.'/config.php';$hash=$cfg['hash'];$q=$db->prepare("INSERT OR IGNORE INTO settings VALUES('password',?)");$q->execute([$hash]);}
$action=$_POST['action']??'';
if($action==='login') {
$ip=hash('sha256',$_SERVER['REMOTE_ADDR']??'unknown');$q=$db->prepare('SELECT * FROM attempts WHERE ip=?');$q->execute([$ip]);$a=$q->fetch(PDO::FETCH_ASSOC);
if($a&&$a['until']>time()&&$a['count']>=5)reply(['error'=>'Too many attempts. Try again in 15 minutes.'],429);
if(!password_verify((string)($_POST['password']??''),$hash)){$count=$a&&$a['until']>time()?(int)$a['count']+1:1;$q=$db->prepare('INSERT OR REPLACE INTO attempts VALUES(?,?,?)');$q->execute([$ip,$count,time()+900]);reply(['error'=>'Incorrect password'],401);}
$db->prepare('DELETE FROM attempts WHERE ip=?')->execute([$ip]);session_regenerate_id(true);$_SESSION['auth']=true;$_SESSION['last']=time();$_SESSION['credential']=hash('sha256',$hash);$_SESSION['csrf']=bin2hex(random_bytes(32));reply(['success'=>true]);
}
if(empty($_SESSION['auth'])||!hash_equals(hash('sha256',$hash),(string)($_SESSION['credential']??'')))reply(['error'=>'Administrator sign in required'],401);
$_SESSION['last']=time();
if($action==='logout'){$_SESSION=[];session_destroy();reply(['success'=>true]);}
if($action==='password'){if(!password_verify((string)($_POST['current']??''),$hash))reply(['error'=>'Current password is incorrect'],403);$p=field('password',256);if(strlen($p)<14)reply(['error'=>'Use at least 14 characters'],400);$q=$db->prepare("UPDATE settings SET value=? WHERE key='password'");$q->execute([password_hash($p,PASSWORD_DEFAULT)]);$_SESSION=[];session_destroy();reply(['success'=>true]);}
$id=bin2hex(random_bytes(16));$now=gmdate('c');
if($action==='folder'){$q=$db->prepare('INSERT INTO folders VALUES(?,?,?)');$q->execute([$id,field('name',100),$now]);}
elseif($action==='post'){$kind=field('kind',20);if(!in_array($kind,['past','upcoming','president'],true))reply(['error'=>'Invalid section'],400);$date=field('date',10);$dateObject=DateTimeImmutable::createFromFormat('!Y-m-d',$date);if(!$dateObject||$dateObject->format('Y-m-d')!==$date)reply(['error'=>'Invalid date'],400);$q=$db->prepare('INSERT INTO posts VALUES(?,?,?,?,?)');$q->execute([$id,$kind,field('title',200),field('body',8000),$date]);}
elseif($action==='upload'){$folder=field('folder',32);$q=$db->prepare('SELECT id FROM folders WHERE id=?');$q->execute([$folder]);if(!$q->fetchColumn())reply(['error'=>'Album not found'],400);$f=$_FILES['file']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name'])||$f['size']<=0||$f['size']>50*1024*1024)reply(['error'=>'Upload failed. Maximum file size is 50 MB.'],400);$type=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);if(!in_array($type,['image/jpeg','image/png','image/webp','video/mp4','video/webm'],true))reply(['error'=>'Unsupported media type'],400);if(!move_uploaded_file($f['tmp_name'],$storage.'/'.$id))throw new RuntimeException('Upload failed');chmod($storage.'/'.$id,0600);try{$q=$db->prepare('INSERT INTO media VALUES(?,?,?,?,?)');$q->execute([$id,$folder,mb_substr(basename($f['name']),0,200),$type,$now]);}catch(Throwable $e){unlink($storage.'/'.$id);throw $e;}}
elseif($action==='delete'){$tables=['folder'=>'folders','post'=>'posts','media'=>'media'];$t=$tables[$_POST['type']??'']??null;if(!$t)reply(['error'=>'Invalid item type'],400);$deleteId=field('id',32);if($t==='folders'){$q=$db->prepare('SELECT COUNT(*) FROM media WHERE folder=?');$q->execute([$deleteId]);if($q->fetchColumn())reply(['error'=>'Delete media from this album first'],409);}$db->prepare("DELETE FROM $t WHERE id=?")->execute([$deleteId]);if($t==='media'&&preg_match('/^[a-f0-9]{32}$/D',$deleteId)&&is_file($storage.'/'.$deleteId))unlink($storage.'/'.$deleteId);reply(['success'=>true]);}
else reply(['error'=>'Invalid action'],400);
reply(['success'=>true,'id'=>$id]);
}catch(Throwable $e){error_log('Senshi error: '.$e->getMessage());reply(['error'=>'Server could not complete the request. Please try again.'],500);}

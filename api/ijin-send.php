<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/report_functions.php';

$p=json_decode((string)file_get_contents('php://input'),true)?:[];
$numbers=trim((string)($p['numbers']??''));
$message=trim((string)($p['message']??''));

if($numbers===''||$message===''){
    http_response_code(422);
    header('Content-Type: application/json');
    echo json_encode(['success'=>false,'message'=>'numbers dan message wajib diisi']);
    exit;
}

$ch=curl_init('http://127.0.0.1:3000/send');
curl_setopt_array($ch,[
    CURLOPT_POST=>true,
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_CONNECTTIMEOUT=>5,
    CURLOPT_TIMEOUT=>600,
    CURLOPT_HTTPHEADER=>['Content-Type:application/json'],
    CURLOPT_POSTFIELDS=>json_encode(['numbers'=>$numbers,'message'=>$message])
]);
$body=curl_exec($ch);
$err=curl_error($ch);
$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
curl_close($ch);

$result=json_decode((string)$body,true);

if($body===false||!is_array($result)){
    http_response_code(500);
    header('Content-Type:application/json');
    echo json_encode(['success'=>false,'message'=>$err?:'Respons gateway tidak valid']);
    exit;
}

try{
    $pdo=get_db('ijin');
    ensureGatewayReportTables($pdo);

    foreach((array)($result['data']??[]) as $item){
        $hp=trim((string)($item['number']??''));
        if($hp==='')continue;

        $local=str_starts_with($hp,'62')?'0'.substr($hp,2):$hp;
        $st=$pdo->prepare("UPDATE batal_praktek_detil_wa SET status=? WHERE no_hp=?");
        $st->execute([(string)($item['status']??2),$local]);
    }

    logGatewayIjinResults($pdo,$message,(array)($result['data']??[]));
    $result['report_logged']=true;
}catch(Throwable $e){
    $result['database_update_warning']=$e->getMessage();
}

header('Content-Type: application/json; charset=utf-8');
http_response_code($code?:200);
echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);

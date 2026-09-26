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

$ch=curl_init('http://127.0.0.1:9000/send');
curl_setopt_array($ch,[
    CURLOPT_POST=>true,
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_TIMEOUT=>120,
    CURLOPT_HTTPHEADER=>['Content-Type:application/json'],
    CURLOPT_POSTFIELDS=>json_encode(['numbers'=>$numbers,'message'=>$message])
]);
$body=curl_exec($ch);
$err=curl_error($ch);
$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
curl_close($ch);

header('Content-Type: application/json; charset=utf-8');

if($body===false){
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>$err]);
    exit;
}

$result=json_decode((string)$body,true);
if(!is_array($result)){
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Respons gateway tidak valid']);
    exit;
}

try{
    $pdo=get_db('lab');
    ensureGatewayReportTables($pdo);
    logGatewayLabResults($pdo,$message,(array)($result['data']??[]));
    $result['report_logged']=true;
}catch(Throwable $e){
    $result['report_log_warning']=$e->getMessage();
}

http_response_code($code?:200);
echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);

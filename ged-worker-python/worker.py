import os
import json
import tempfile
import requests
import boto3
import fitz  # PyMuPDF

from urllib.parse import urlparse
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# ── 1. CARREGA O .ENV DA RAIZ (uma pasta acima do worker) ANTES de ler variáveis ──
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
load_dotenv(dotenv_path=env_path)

# ── 2. CONFIGURAÇÕES ESSENCIAIS ──
SQS_QUEUE_URL = os.environ.get('AWS_SQS_OCR_QUEUE_URL')
S3_BUCKET = os.environ.get('AWS_S3_BUCKET')
WEBHOOK_URL = os.environ.get('GED_INTERNAL_WEBHOOK_URL')
INTERNAL_SECRET = os.environ.get('GED_INTERNAL_SECRET')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# ── 3. INICIALIZAÇÃO DOS CLIENTES AWS ──
sqs = boto3.client('sqs', region_name=AWS_REGION)
s3 = boto3.client('s3', region_name=AWS_REGION)


def extract_text_from_pdf(file_path: str) -> str:
    """Usa o PyMuPDF para extrair o texto inteiro de todas as páginas do PDF."""
    extracted_pages = []
    with fitz.open(file_path) as doc:
        for page in doc:
            extracted_pages.append(page.get_text())
    return "\n".join(extracted_pages).strip()


def notify_backend(document_id: int, revision_id: int, status: str, extracted_text: str = "") -> bool:
    """Notifica o backend Node.js com o resultado da extração local."""
    endpoint = WEBHOOK_URL.replace('{id}', str(document_id))
    headers = {'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET}

    payload = {
        "documentId": document_id,
        "revisionId": revision_id,
        "status": status,
        "extractedText": extracted_text,
    }

    resp = requests.post(endpoint, json=payload, headers=headers)
    resp.raise_for_status()
    return True


def process_document(document_id: int, revision_id: int, file_path: str) -> bool:
    # Extrai apenas a chave do S3, caso venha uma URL completa
    s3_key = file_path
    if file_path.startswith("http"):
        parsed_url = urlparse(file_path)
        s3_key = parsed_url.path.lstrip('/')

    print(f"[GED-OCR] Baixando do S3 e extraindo texto: {s3_key} (Document ID: {document_id}, Revision ID: {revision_id})")

    tmp_file = None
    try:
        # ── DOWNLOAD TEMPORÁRIO DO PDF DO S3 PARA DISCO LOCAL ──
        fd, tmp_file = tempfile.mkstemp(suffix='.pdf')
        os.close(fd)

        s3.download_file(Bucket=S3_BUCKET, Key=s3_key, Filename=tmp_file)

        # ── EXTRAÇÃO LOCAL E ULTRARRÁPIDA COM PyMuPDF ──
        extracted_text = extract_text_from_pdf(tmp_file)

        # ── ENVIA O TEXTO PARA O WEBHOOK DO BACKEND ──
        notify_backend(document_id, revision_id, "COMPLETED", extracted_text)

        print(f"[GED-OCR] Texto extraído e sincronizado. Doc {document_id} / Rev {revision_id} concluído.")
        return True

    except Exception as e:
        print(f"[GED-OCR] Falha na extração do Doc {document_id} / Rev {revision_id}: {str(e)}")
        try:
            # Notifica o backend sobre a falha para atualizar o status do OCR
            notify_backend(document_id, revision_id, "FAILED")
        except Exception as webhook_error:
            print(f"[GED-OCR] Webhook Fallback falhou: {str(webhook_error)}")
        return False

    finally:
        # Limpeza do arquivo temporário local
        if tmp_file and os.path.exists(tmp_file):
            try:
                os.remove(tmp_file)
            except OSError:
                pass


def main_loop() -> None:
    if not all([SQS_QUEUE_URL, S3_BUCKET, WEBHOOK_URL, INTERNAL_SECRET]):
        print(f"DEBUG: SQS_QUEUE_URL={SQS_QUEUE_URL}")
        print(f"DEBUG: S3_BUCKET={S3_BUCKET}")
        print(f"DEBUG: WEBHOOK_URL={WEBHOOK_URL}")
        print(f"DEBUG: INTERNAL_SECRET={INTERNAL_SECRET}")
        print("[GED-WORKER] ERRO DE AMBIENTE: Verifique as variáveis da AWS e Webhook no .env.")
        return

    print("[GED-WORKER] Listener SQS ativo via Long Polling (PyMuPDF). A aguardar documentos...")

    while True:
        try:
            response = sqs.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20
            )

            messages = response.get('Messages', [])

            for msg in messages:
                try:
                    body = json.loads(msg['Body'])
                    success = process_document(body['documentId'], body['revisionId'], body['filePath'])

                    if success:
                        sqs.delete_message(
                            QueueUrl=SQS_QUEUE_URL,
                            ReceiptHandle=msg['ReceiptHandle']
                        )
                except json.JSONDecodeError:
                    print(f"[GED-WORKER] Descarte: Payload não é JSON.")
                    sqs.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=msg['ReceiptHandle'])

        except ClientError as e:
            print(f"[GED-WORKER] AWS SQS Connection Error: {str(e)}")
        except KeyboardInterrupt:
            print("[GED-WORKER] Serviço de RPA encerrado.")
            break


if __name__ == '__main__':
    main_loop()

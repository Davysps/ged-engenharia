import os
import json
import boto3
import requests
from urllib.parse import urlparse
from botocore.exceptions import ClientError
from typing import Dict, Any, Tuple
from dotenv import load_dotenv

# 1. Carrega o .env da raiz do projeto (uma pasta acima do worker) ANTES de ler as variáveis
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
load_dotenv(dotenv_path=env_path)

# 2. Configurações Essenciais (Lendo exatamente os nomes que estão no seu .env)
SQS_QUEUE_URL = os.environ.get('AWS_SQS_OCR_QUEUE_URL')
S3_BUCKET = os.environ.get('AWS_S3_BUCKET') # CORRIGIDO: Removido o _NAME
WEBHOOK_URL = os.environ.get('GED_INTERNAL_WEBHOOK_URL') 
INTERNAL_SECRET = os.environ.get('GED_INTERNAL_SECRET')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Inicialização de Clientes AWS
sqs = boto3.client('sqs', region_name=AWS_REGION)
textract = boto3.client('textract', region_name=AWS_REGION)

class TextractParser:
    """Classe utilitária para extrair metadados estruturados da resposta do AWS Textract."""
    
    @staticmethod
    def _get_text(block: Dict[str, Any], block_map: Dict[str, Any]) -> str:
        """Navega pelos blocos filhos (WORD ou SELECTION_ELEMENT) e extrai o texto."""
        text = ""
        if 'Relationships' in block:
            for rel in block['Relationships']:
                if rel['Type'] == 'CHILD':
                    for child_id in rel['Ids']:
                        word = block_map.get(child_id)
                        if word:
                            if word['BlockType'] == 'WORD':
                                text += word['Text'] + " "
                            elif word['BlockType'] == 'SELECTION_ELEMENT':
                                if word['SelectionStatus'] == 'SELECTED':
                                    text += "X "
        return text.strip()

    @classmethod
    def extract_key_values(cls, textract_response: Dict[str, Any]) -> Dict[str, str]:
        """Constrói um dicionário Chave-Valor a partir dos blocos FORMS do Textract."""
        blocks = textract_response.get('Blocks', [])
        block_map = {block['Id']: block for block in blocks}
        
        key_map = {}
        value_map = {}

        # Separa as Chaves (Keys) e os Valores (Values)
        for block in blocks:
            if block['BlockType'] == 'KEY_VALUE_SET':
                if 'KEY' in block.get('EntityTypes', []):
                    key_map[block['Id']] = block
                else:
                    value_map[block['Id']] = block

        # Associa cada Chave ao seu Valor correspondente
        extracted_data = {}
        for key_id, key_block in key_map.items():
            value_block = None
            if 'Relationships' in key_block:
                for rel in key_block['Relationships']:
                    if rel['Type'] == 'VALUE':
                        for val_id in rel['Ids']:
                            value_block = value_map.get(val_id)
            
            if value_block:
                key_text = cls._get_text(key_block, block_map)
                val_text = cls._get_text(value_block, block_map)
                if key_text:
                    extracted_data[key_text.upper()] = val_text
                    
        return extracted_data

    @classmethod
    def find_engineering_metadata(cls, key_values: Dict[str, str]) -> Tuple[str, str, str]:
        """Aplica heurísticas para encontrar campos específicos do selo de engenharia."""
        project_number = None
        revision = None
        discipline = None

        # Iteramos pelas chaves extraídas tentando dar match com terminologias padrão
        for key, value in key_values.items():
            if not value:
                continue
                
            if "PROJETO" in key or "CÓDIGO" in key or "NÚMERO" in key or "NUMBER" in key:
                if not project_number: project_number = value
                
            elif "REV" in key or "REVISÃO" in key or "REVISION" in key:
                if not revision: revision = value
                
            elif "DISCIPLINA" in key or "ÁREA" in key or "DISCIPLINE" in key:
                if not discipline: discipline = value

        return project_number, revision, discipline

def process_document(document_id: int, file_path: str) -> bool:
    # Nova lógica para extrair apenas a chave do S3, caso receba uma URL completa
    s3_key = file_path
    if file_path.startswith("http"):
        parsed_url = urlparse(file_path)
        s3_key = parsed_url.path.lstrip('/') # Remove a barra inicial, ficando "contratos/arquivo.pdf"

    print(f"[GED-OCR] Analisando S3Key: {s3_key} (Document ID: {document_id})")
    
    try:
        response = textract.analyze_document(
            Document={'S3Object': {'Bucket': S3_BUCKET, 'Name': s3_key}},
            FeatureTypes=['FORMS']
        )
        
        raw_key_values = TextractParser.extract_key_values(response)
        project_number, revision, discipline = TextractParser.find_engineering_metadata(raw_key_values)
        
        extracted_data: Dict[str, Any] = {
            "projectNumber": project_number,
            "revision": revision,                     
            "discipline": discipline,                   
            "rawTextractPayload": response 
        }

        endpoint = WEBHOOK_URL.replace('{id}', str(document_id))
        headers = {'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET}
        payload = {"ocrStatus": "COMPLETED", "metadata": extracted_data}
        
        resp = requests.patch(endpoint, json=payload, headers=headers)
        resp.raise_for_status()
        
        print(f"[GED-OCR] Processamento e sincronização do Doc {document_id} concluídos.")
        return True

    except Exception as e:
        print(f"[GED-OCR] Falha fatal no Doc {document_id}: {str(e)}")
        try:
            endpoint = WEBHOOK_URL.replace('{id}', str(document_id))
            headers = {'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET}
            requests.patch(endpoint, json={"ocrStatus": "FAILED"}, headers=headers)
        except Exception as webhook_error:
            print(f"[GED-OCR] Webhook Fallback falhou: {str(webhook_error)}")
            
        return False

    except Exception as e:
        print(f"[GED-OCR] Falha fatal no Doc {document_id}: {str(e)}")
        
        try:
            # Notifica o Node.js sobre a quebra
            endpoint = WEBHOOK_URL.replace('{id}', str(document_id))
            headers = {'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET}
            requests.patch(endpoint, json={"ocrStatus": "FAILED"}, headers=headers)
        except Exception as webhook_error:
            print(f"[GED-OCR] Webhook Fallback falhou: {str(webhook_error)}")
            
        return False

def main_loop() -> None:
    if not all([SQS_QUEUE_URL, S3_BUCKET, WEBHOOK_URL, INTERNAL_SECRET]):
        print(f"DEBUG: SQS_QUEUE_URL={SQS_QUEUE_URL}")
        print(f"DEBUG: S3_BUCKET={S3_BUCKET}")
        print(f"DEBUG: WEBHOOK_URL={WEBHOOK_URL}")
        print(f"DEBUG: INTERNAL_SECRET={INTERNAL_SECRET}")
        print("[GED-WORKER] ERRO DE AMBIENTE: Verifique as variáveis da AWS e Webhook no .env.")
        return

    print("[GED-WORKER] Listener SQS ativo via Long Polling. A aguardar documentos...")
    
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
                    success = process_document(body['documentId'], body['filePath'])
                    
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
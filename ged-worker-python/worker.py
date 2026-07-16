import os
import time
import zipfile
import psycopg2
import boto3
import requests
import urllib.parse
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle

# Carrega variáveis de ambiente
load_dotenv()

# Configuração AWS S3 com Blindagem
s3_client = None
if os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY'):
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )
BUCKET_NAME = os.getenv('AWS_BUCKET_NAME')
WEBHOOK_BASE_URL = os.getenv('WEBHOOK_BASE_URL')

def gerar_capa_pdf(transmittal, documentos, output_path):
    """
    Gera uma Capa de Lote (GRD) padronizada usando ReportLab.
    """
    c = canvas.Canvas(output_path, pagesize=A4)
    largura, altura = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, altura - 50, "GUIA DE REMESSA DE DOCUMENTOS (GRD)")
    
    c.setFont("Helvetica", 10)
    c.drawString(50, altura - 75, f"Código da GRD: {transmittal['codigo']}")
    c.drawString(50, altura - 90, f"Data de Emissão: {transmittal['createdAt'].strftime('%d/%m/%Y')}")
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, altura - 120, "Informações do Envio")
    c.setFont("Helvetica", 10)
    c.drawString(50, altura - 140, f"Destinatário: {transmittal.get('destinatario') or 'Não especificado'}")
    c.drawString(50, altura - 155, f"Propósito: {transmittal.get('proposito', '').replace('_', ' ')}")
    c.drawString(50, altura - 170, f"Assunto: {transmittal['assunto']}")
    
    if transmittal.get('mensagem'):
        c.drawString(50, altura - 185, f"Observações: {transmittal['mensagem']}")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, altura - 220, "Relação de Documentos Transmitidos")

    dados_tabela = [["Código do Documento", "Título", "Revisão"]]
    for doc in documentos:
        dados_tabela.append([
            doc['codigoDocumento'],
            doc['titulo'][:40] + ('...' if len(doc['titulo']) > 40 else ''),
            doc['versionLabel']
        ])

    tabela = Table(dados_tabela, colWidths=[150, 250, 80])
    tabela.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))

    tabela.wrapOn(c, largura, altura)
    tabela.drawOn(c, 50, altura - 250 - (len(documentos) * 20))
    c.save()

def processar_transmittal(t_id):
    """
    Fluxo principal atómico para processar uma única GRD.
    """
    print(f"\n[WORKER] A iniciar processamento da GRD ID: {t_id}")
    temp_dir = f"/tmp/grd_{t_id}"
    os.makedirs(temp_dir, exist_ok=True)
    
    zip_filename = f"GRD_{t_id}_pacote.zip"
    zip_filepath = os.path.join(temp_dir, zip_filename)
    pdf_capa_filename = f"GRD_{t_id}_Capa.pdf"
    pdf_capa_filepath = os.path.join(temp_dir, pdf_capa_filename)

    conn = None
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('SELECT * FROM "Transmittal" WHERE id = %s', (t_id,))
        transmittal = cursor.fetchone()

        query_docs = """
            SELECT r."filePath", r."versionLabel", d."codigo_documento" AS "codigoDocumento", d.titulo
            FROM "TransmittalItem" ti
            JOIN "Revision" r ON ti."revisionId" = r.id
            JOIN "Document" d ON r."documentId" = d.id
            WHERE ti."transmittalId" = %s
        """
        cursor.execute(query_docs, (t_id,))
        documentos = cursor.fetchall()

        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for doc in documentos:
                file_path_db = doc['filePath']
                
                parsed_url = urllib.parse.urlparse(file_path_db)
                nome_arquivo = os.path.basename(parsed_url.path)
                if not nome_arquivo:
                    nome_arquivo = f"documento_{doc['codigoDocumento']}.pdf"
                    
                local_file_path = os.path.join(temp_dir, nome_arquivo)
                print(f"  -> A processar ficheiro: {file_path_db}")
                
                if file_path_db.startswith('http://') or file_path_db.startswith('https://'):
                    # BLINDAGEM AWS: Identifica se a URL pertence ao S3 para usar autenticação Boto3
                    if 'amazonaws.com' in parsed_url.netloc:
                        # Extrai o bucket (o que vem antes do .s3) e a key exata (remove a barra inicial)
                        extracted_bucket = parsed_url.netloc.split('.s3')[0]
                        extracted_key = parsed_url.path.lstrip('/')
                        
                        print(f"     [S3-AUTH] URL privada do S3 detetada. A autenticar e extrair via Boto3 (Bucket: {extracted_bucket})...")
                        if s3_client:
                            s3_client.download_file(extracted_bucket, extracted_key, local_file_path)
                            zipf.write(local_file_path, arcname=nome_arquivo)
                        else:
                            raise Exception("Ficheiro é privado no S3, mas as chaves AWS não estão configuradas no .env")
                    else:
                        print("     [WEB] URL pública detetada. A descarregar via HTTP Direto...")
                        resposta = requests.get(file_path_db, stream=True)
                        resposta.raise_for_status()
                        with open(local_file_path, 'wb') as f:
                            for chunk in resposta.iter_content(chunk_size=8192):
                                f.write(chunk)
                        zipf.write(local_file_path, arcname=nome_arquivo)
                else:
                    caminho_local_backend = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', file_path_db))
                    if os.path.exists(file_path_db):
                        print("     [OK] Ficheiro local encontrado.")
                        zipf.write(file_path_db, arcname=nome_arquivo)
                    elif os.path.exists(caminho_local_backend):
                        print("     [OK] Ficheiro encontrado na pasta do Backend.")
                        zipf.write(caminho_local_backend, arcname=nome_arquivo)
                    elif s3_client and BUCKET_NAME:
                        print("     [S3] A descarregar nativamente da AWS S3...")
                        s3_client.download_file(BUCKET_NAME, file_path_db, local_file_path)
                        zipf.write(local_file_path, arcname=nome_arquivo)
                    else:
                        raise Exception(f"Ficheiro inacessível ou credenciais S3 ausentes: {file_path_db}")

            print("  -> A gerar Capa Oficial (PDF)...")
            gerar_capa_pdf(transmittal, documentos, pdf_capa_filepath)
            zipf.write(pdf_capa_filepath, arcname=pdf_capa_filename)

        # Upload final / Simulação Local
        s3_zip_key = f"transmittals/{zip_filename}"
        s3_capa_key = f"transmittals/{pdf_capa_filename}"
        
        zip_url = ""
        pdf_url = ""

        if s3_client and BUCKET_NAME:
            print("  -> A enviar ZIP e Capa finalizados para o S3...")
            s3_client.upload_file(zip_filepath, BUCKET_NAME, s3_zip_key, ExtraArgs={'ACL': 'public-read'})
            s3_client.upload_file(pdf_capa_filepath, BUCKET_NAME, s3_capa_key, ExtraArgs={'ACL': 'public-read'})
            zip_url = f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION', 'us-east-1')}.amazonaws.com/{s3_zip_key}"
            pdf_url = f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION', 'us-east-1')}.amazonaws.com/{s3_capa_key}"
        else:
            print("  -> [DEV LOCAL] AWS não configurada. A salvar ficheiros na pasta local 'output'...")
            output_dir = os.path.join(os.path.dirname(__file__), 'output')
            os.makedirs(output_dir, exist_ok=True)
            import shutil
            shutil.copy2(zip_filepath, os.path.join(output_dir, zip_filename))
            shutil.copy2(pdf_capa_filepath, os.path.join(output_dir, pdf_capa_filename))
            zip_url = f"file:///{os.path.join(output_dir, zip_filename).replace(chr(92), '/')}"
            pdf_url = f"file:///{os.path.join(output_dir, pdf_capa_filename).replace(chr(92), '/')}"

        print("  -> A notificar o Backend Node.js...")
        response = requests.patch(
            f"{WEBHOOK_BASE_URL}/{t_id}/complete",
            json={"zipUrl": zip_url, "pdfCapaUrl": pdf_url}
        )
        response.raise_for_status()

        print(f"[WORKER] GRD {t_id} processada com SUCESSO!\n")

    except Exception as e:
        print(f"\n[ERRO CRÍTICO] Falha ao processar GRD {t_id}: {str(e)}")
        try:
            requests.patch(f"{WEBHOOK_BASE_URL}/{t_id}/complete", json={"errorMsg": str(e)})
        except:
            pass
    finally:
        if conn:
            conn.close()
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


def iniciar_worker():
    print("====================================================")
    print(" GED ENGENHARIA - PYTHON TRANSMITTAL WORKER INICIADO")
    print("====================================================\n")
    
    while True:
        conn = None
        try:
            conn = psycopg2.connect(os.getenv('DATABASE_URL'))
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute('SELECT id FROM "Transmittal" WHERE status = %s ORDER BY "createdAt" ASC LIMIT 1', ('EM_PROCESSAMENTO',))
            row = cursor.fetchone()
            
            if row:
                processar_transmittal(row['id'])
            else:
                time.sleep(10)
                
        except Exception as e:
            print(f"Erro de conexão com o Banco de Dados: {e}")
            time.sleep(10)
        finally:
            if conn:
                conn.close()

if __name__ == "__main__":
    iniciar_worker()
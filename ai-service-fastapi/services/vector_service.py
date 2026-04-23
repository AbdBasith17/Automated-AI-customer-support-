import os
import boto3
import fitz 
from langchain_experimental.text_splitter import SemanticChunker
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

class VectorService:
    def __init__(self):
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-001",  
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
        
        self.chunker = SemanticChunker(
            self.embeddings,
            breakpoint_threshold_type="percentile",
            breakpoint_threshold_amount=70
        )
        
        self.s3 = boto3.client(
            's3',
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_S3_REGION_NAME")
        )

    def process_from_s3(self, s3_key: str, bucket: str, collection_name: str, doc_metadata: dict):
        # 1. Fetch file from S3
        file_obj = self.s3.get_object(Bucket=bucket, Key=s3_key)
        file_content = file_obj['Body'].read()

        # 2. Extract text using PyMuPDF 
        
        pdf_document = fitz.open(stream=file_content, filetype="pdf")
        
        
        full_text = "".join([page.get_text() for page in pdf_document])
        
        pdf_document.close()

        # 3. Chunk  text
        chunks = self.chunker.split_text(full_text)

        # 4. Langchain Documents
        docs = [
            Document(page_content=chunk, metadata=doc_metadata) 
            for chunk in chunks
        ]

        # 5. Store in ChromaDB
        vector_db = Chroma.from_documents(
            documents=docs,
            embedding=self.embeddings,
            persist_directory=os.getenv("CHROMA_DB_PATH", "./chroma_db"),
            collection_name=collection_name
        )
        
        return len(docs)
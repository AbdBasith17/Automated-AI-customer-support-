import os
import uuid
import boto3
import tempfile
import chromadb
import logging
import pymupdf4llm
from docx import Document as DocxDocument
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

EMBED_BATCH_SIZE = 5  # kept small — Gemini is unreliable with large batches


class VectorService:
    def __init__(self):
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-2",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            output_dimensionality=768
        )

        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150,
        )

        self.s3 = boto3.client(
            's3',
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_S3_REGION_NAME")
        )

        self.chroma_client = chromadb.HttpClient(
            host=os.getenv("CHROMA_HOST", "chroma-db"),
            port=int(os.getenv("CHROMA_PORT", 8000))
        )

    def _extract_text(self, file_path: str, suffix: str) -> str:
        suffix = suffix.lower()
        if suffix == ".pdf":
            return pymupdf4llm.to_markdown(file_path)
        elif suffix == ".docx":
            doc = DocxDocument(file_path)
            return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        elif suffix in [".md", ".txt"]:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

    def _embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        all_embeddings = []
        for i, chunk in enumerate(chunks):
            embedding = self.embeddings.embed_query(chunk)
            all_embeddings.append(embedding)
            if (i + 1) % 10 == 0:
                logger.info(f"  Embedded {i + 1}/{len(chunks)} chunks")
        return all_embeddings

    def _store_in_chroma(
        self,
        collection_name: str,
        chunks: list[str],
        embeddings: list[list[float]],
        metadata: dict,
    ) -> None:
        """
        Insert directly via the chromadb client — no langchain_chroma
        embedding path involved, so no index mismatch possible.
        """
        collection = self.chroma_client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

        collection.add(
            ids=[str(uuid.uuid4()) for _ in chunks],
            documents=chunks,
            embeddings=embeddings,
            metadatas=[metadata] * len(chunks),
        )

    def process_from_s3(self, s3_key: str, bucket: str, collection_name: str, doc_metadata: dict) -> int:
        suffix = os.path.splitext(s3_key)[1].lower()

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            self.s3.download_fileobj(bucket, s3_key, tmp)
            tmp_path = tmp.name

        try:
            raw_text = self._extract_text(tmp_path, suffix)
            raw_chunks = self.splitter.split_text(raw_text)
            chunks = [c.strip() for c in raw_chunks if len(c.strip()) > 20]

            if not chunks:
                logger.warning(f"No valid chunks for {s3_key}")
                return 0

            metadata = {
                **doc_metadata,
                "source": doc_metadata.get("source", s3_key),
                "title": doc_metadata.get("title", s3_key.split('/')[-1]),
            }

            logger.info(f"Embedding {len(chunks)} chunks...")
            embeddings = self._embed_chunks(chunks)

            logger.info(f"Storing {len(chunks)} chunks in ChromaDB...")
            self._store_in_chroma(collection_name, chunks, embeddings, metadata)

            logger.info(f"Done — {len(chunks)} chunks stored for {s3_key}")
            return len(chunks)

        except Exception as e:
            logger.error(f"Error processing {s3_key}: {e}")
            raise

        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def delete_document_vectors(self, collection_name: str, document_id: str):
        try:
            collection = self.chroma_client.get_collection(name=collection_name)
          
            collection.delete(where={"document_id": document_id})
            logger.info(f"Deleted vectors for document_id: {document_id}")
        except Exception as e:
            logger.error(f"Error deleting vectors for {document_id}: {e}")
            raise
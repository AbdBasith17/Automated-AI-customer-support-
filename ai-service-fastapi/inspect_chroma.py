import chromadb
import os
from dotenv import load_dotenv

load_dotenv()

def inspect_db():
    # Connect to the Chroma server running in Docker
    # We use 'chroma-db' because that is the service name in your docker-compose
    client = chromadb.HttpClient(
        host=os.getenv("CHROMA_HOST", "chroma-db"), 
        port=int(os.getenv("CHROMA_PORT", 8000))
    )

    print("--- ChromaDB Inspection ---")
    
    # 1. List all collections
    collections = client.list_collections()
    print(f"Total Collections found: {len(collections)}")

    for coll in collections:
        print(f"\nCollection Name: {coll.name}")
        
        # 2. Get count of documents in this collection
        count = coll.count()
        print(f" - Document Count: {count}")

        if count > 0:
            # 3. Peek at the first document to verify structure
            sample = coll.peek(1)
            print(f" - Sample Metadata: {sample['metadatas'][0]}")
            print(f" - Sample Content (first 100 chars): {sample['documents'][0][:100]}...")
        else:
            print(" - [!] This collection is empty.")

if __name__ == "__main__":
    inspect_db()
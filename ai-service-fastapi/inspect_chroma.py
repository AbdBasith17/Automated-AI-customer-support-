import chromadb

# Since you exposed port 8000:8000 in docker-compose, 
# your host machine sees it at localhost:8000
client = chromadb.HttpClient(host='chroma-db', port=8000)
def verify_storage():
    try:
        # 1. Check Heartbeat (is the server alive?)
        print(f"Connection Heartbeat: {client.heartbeat()}")

        # 2. List all collections
        collections = client.list_collections()
        print(f"Found {len(collections)} collections.")

        for col_name in collections:
            # Note: list_collections returns a list of collection objects or names 
            # depending on version; we'll handle both.
            name = col_name.name if hasattr(col_name, 'name') else col_name
            print(f"\n--- Checking Collection: {name} ---")
            
            collection = client.get_collection(name=name)
            count = collection.count()
            print(f"Total Chunks: {count}")

            if count > 0:
                # Peek at the actual data
                results = collection.peek(limit=3)
                print("Last 3 IDs added:", results['ids'])
                print("Metadata Sample:", results['metadatas'][0] if results['metadatas'] else "No metadata")
            else:
                print("Result: Collection exists but is empty.")

    except Exception as e:
        print(f"Verification failed: {e}")

if __name__ == "__main__":
    verify_storage()
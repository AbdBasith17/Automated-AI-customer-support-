import os
import chromadb
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

class QueryService:
    def __init__(self):
        # 1. Embeddings (Gemini) - Must exactly match VectorService dimensions
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-2",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            output_dimensionality=768 
        )
        
        # 2. Query Rewriter (Groq LLaMA 3.1 8B - Fast & Cheap)
        self.rewriter_llm = ChatGroq(
            model="llama-3.1-8b-instant",
            groq_api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.1
        )

        # 3. Response Generator (Groq LLaMA 3.3 70B - High Reasoning)
        self.generator_llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=os.getenv("GROQ_API_KEY"),
            temperature=0
        )

        # 4. Shared Chroma Client (Matches VectorService setup)
        self.chroma_client = chromadb.HttpClient(
            host=os.getenv("CHROMA_HOST", "chroma-db"),
            port=int(os.getenv("CHROMA_PORT", 8000))
        )

    def _rewrite_query(self, original_query: str) -> str:
        """Transforms a conversational user question into a keyword-rich search term."""
        rewrite_prompt = ChatPromptTemplate.from_template(
            "You are an expert search engineer. Rewrite the following user question to be "
            "optimized for a vector database similarity search. Focus on technical terms. "
            "Return ONLY the rewritten text, no preamble.\n\n"
            "Question: {question}"
        )
        chain = rewrite_prompt | self.rewriter_llm | StrOutputParser()
        return chain.invoke({"question": original_query})

    def get_response(self, query: str, collection_name: str = "enterprise_docs"):
        try:
            # Step 1: Optimize the query for retrieval
            optimized_query = self._rewrite_query(query)
            
            # Step 2: Connect to existing Vector Store
            vector_db = Chroma(
                collection_name=collection_name,
                embedding_function=self.embeddings,
                client=self.chroma_client  # Uses the pre-initialized HTTP client
            )
            
            # Step 3: Retrieve top 5 chunks
            # Similarity search returns LangChain Document objects
            docs = vector_db.similarity_search(optimized_query, k=5)
            
            if not docs:
                return {
                    "answer": "I'm sorry, I couldn't find any relevant information in the system to answer that.",
                    "sources": [],
                    "rewritten_query": optimized_query
                }
            
            # Combine retrieved text and extract unique metadata titles/sources
            context_text = "\n\n".join([d.page_content for d in docs])
            
            # Match the metadata keys ('title' or 'source') we set in VectorService
            sources = list(set([
                d.metadata.get("title") or d.metadata.get("source") or "Internal Document" 
                for d in docs
            ]))

            # Step 4: Generate contextual answer
            template = """
            You are the Aion Core Assistant, a professional enterprise AI. 
            Use the provided context to answer the user's question accurately.
            
            Context:
            {context}

            User Question: {question}

            Instructions:
            - Provide a clear, professional, and technical response. 
            - If the context doesn't contain the answer, state that you don't have enough information.
            - Do not mention phrases like "According to the context" or "The database says".
            - Use bullet points if the answer involves multiple steps or facts.
            """
            
            gen_prompt = ChatPromptTemplate.from_template(template)
            gen_chain = gen_prompt | self.generator_llm | StrOutputParser()
            
            answer = gen_chain.invoke({
                "context": context_text, 
                "question": query # Use original query here so LLM sees user intent
            })

            return {
                "answer": answer,
                "sources": sources,
                "rewritten_query": optimized_query  
            }

        except Exception as e:
            print(f"!!! RAG ERROR: {e}")
            raise e
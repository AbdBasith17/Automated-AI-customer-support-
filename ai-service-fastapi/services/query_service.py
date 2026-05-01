import os
import chromadb
import requests
from typing import Dict, Any
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.tools import tool
from services.cache_service import CacheService

# --- STEP 1: Define the Ticket Tool ---
@tool
def create_support_ticket(summary: str, description: str):
    """
    Call this tool ONLY when you have enough detail to report a problem.
    - summary: A short, catchy title (e.g., 'Scooter Battery Failure').
    - description: A detailed technical report including the issue, symptoms, and user context.
    """
    return "GATE_TRIGGERED"

class QueryService:
    def __init__(self):
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-2",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            output_dimensionality=768
        )
        self.rewriter_llm = ChatGroq(
            model="llama-3.1-8b-instant",
            groq_api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.1
        )
        # Use Llama 70B for high-reasoning confidence checks
        self.generator_llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=os.getenv("GROQ_API_KEY"),
            temperature=0
        )
        
        # Bind the tool to the model
        self.tools = [create_support_ticket]
        self.generator_with_tools = self.generator_llm.bind_tools(self.tools)

        self.chroma_client = chromadb.HttpClient(
            host=os.getenv("CHROMA_HOST", "chroma-db"),
            port=int(os.getenv("CHROMA_PORT", 8000))
        )
        self.cache = CacheService()

    def _rewrite_query(self, original_query: str, chat_history: str = "") -> str:
        rewrite_prompt = ChatPromptTemplate.from_template(
            "You are an expert search engineer. Rephrase the follow-up question to be a standalone search term.\n\n"
            "History: {history}\nQuestion: {question}"
        )
        chain = rewrite_prompt | self.rewriter_llm | StrOutputParser()
        return chain.invoke({"history": chat_history, "question": original_query})

    def get_response(self, query: str, session_id: str, user_metadata: dict = None, collection_name: str = "enterprise_docs", chat_history: str = ""):
        try:
            # --- 1. DUPLICATE TICKET CHECK ---
            # We look for a ticket reference in the chat history to prevent duplicates
            has_existing_ticket = "Reference: KAN-" in chat_history or "ticket_created" in chat_history

            optimized_query = self._rewrite_query(query, chat_history)
            
            # Context search
            vector_db = Chroma(collection_name=collection_name, embedding_function=self.embeddings, client=self.chroma_client)
            docs = vector_db.similarity_search(optimized_query, k=5)
            context_text = "\n\n".join([d.page_content for d in docs]) if docs else ""

            # --- 2. UPDATED PROMPT ---
            template = """You are a senior support engineer for Aion Mobility.
            
            CUSTOMER: {full_name} ({email})
            TICKET STATUS: {ticket_status}

            RULES:
            1. Solve the issue using the provided Context first.
            2. TROUBLESHOOTING: You must provide at least 3-4 distinct troubleshooting attempts in the history before creating a ticket.
            3. DUPLICATE PREVENTION: If TICKET STATUS is 'Already Created', DO NOT use the ticket tool again. Instead, tell the user the team is already working on it.
            4. If the user asks for a status and a ticket exists, acknowledge the reference number in history and explain that updates will be sent to {email}.

            Chat History: {history}
            Context: {context}
            Question: {question}

            Answer:"""

            ticket_status = "Already Created" if has_existing_ticket else "None"
            email = user_metadata.get("email", "your email") if user_metadata else "your email"
            full_name = user_metadata.get("full_name", "Customer") if user_metadata else "Customer"

            gen_prompt = ChatPromptTemplate.from_template(template)
            chain = gen_prompt | self.generator_with_tools
            
            ai_msg = chain.invoke({
                "history": chat_history or "No history.",
                "context": context_text,
                "question": query,
                "full_name": full_name,
                "email": email,
                "ticket_status": ticket_status
            })

            # --- 3. HANDLE TOOL CALL (With Duplicate Guard) ---
            if ai_msg.tool_calls and not has_existing_ticket:
                tool_args = ai_msg.tool_calls[0]['args']
                
                # Combine User details for Jira
                jira_desc = f"CUSTOMER: {full_name} ({email})\n\nISSUE:\n{tool_args.get('description')}"
                
                jira_data = self._trigger_n8n_jira(tool_args.get('summary'), jira_desc, session_id)
                
                # CUSTOM SUCCESS MESSAGE
                return {
                    "answer": f"I've opened a support ticket for you. Reference: {jira_data.get('key')}. Our team will review this and contact you shortly through your registered email ({email}).",
                    "status": "ticket_created",
                    "ticket_key": jira_data.get("key")
                }
            
            # Default response (Troubleshooting or Status Update)
            return {
                "answer": ai_msg.content,
                "status": "success"
            }

        except Exception as e:
            print(f"QueryService Error: {e}")
            raise e
        
    def _trigger_n8n_jira(self, summary: str, session_id: str):
        webhook_url = os.getenv("N8N_WEBHOOK_URL")
        payload = {"query": summary, "session_id": session_id}
        try:
            response = requests.post(webhook_url, json=payload, timeout=15)
        
            # DEBUG: Print the status and body to your console to see the error
            print(f"n8n Status: {response.status_code}")
            print(f"n8n Response Body: {response.text}")

            if response.status_code == 200:
                data = response.json()
                return data if isinstance(data, dict) else data[0]
            
            return {"key": f"Error-{response.status_code}"}
        
        except Exception as e:
            print(f"n8n Webhook Error: {e}")
            return {"key": "Connection-Failed"}
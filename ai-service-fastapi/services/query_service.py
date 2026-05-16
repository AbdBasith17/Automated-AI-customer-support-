import os
import time
import json
import requests
from datetime import datetime, timezone
from typing import Dict, Any

import chromadb
from confluent_kafka import Producer as KafkaProducer
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.tools import tool
from services.cache_service import CacheService


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
        self.generator_llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=os.getenv("GROQ_API_KEY"),
            temperature=0
        )
        self.tools = [create_support_ticket]
        self.generator_with_tools = self.generator_llm.bind_tools(self.tools)

        self.chroma_client = chromadb.HttpClient(
            host=os.getenv("CHROMA_HOST", "chroma-db"),
            port=int(os.getenv("CHROMA_PORT", 8000))
        )
        self.cache = CacheService()

        self.kafka_producer = KafkaProducer({
            "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP", "kafka:9092"),
            "socket.timeout.ms": 5000,
            "delivery.timeout.ms": 10000,
        })

    # ── Rewrite helpers ───────────────────────────────────────────────────────

    def _needs_rewrite(self, query: str, chat_history: str) -> bool:
        if not chat_history or chat_history == "No history.":
            return False

        q = query.lower().strip()

        if len(q.split()) <= 4:
            return True

        reference_signals = [
            "it ", "this ", "that ", "the same", "same issue", "same problem",
            "still ", "again", "as before", "what about", "how about"
        ]
        if any(signal in q for signal in reference_signals):
            return True

        followup_signals = ["also", "another", "more", "else", "instead",
                            "besides", "additionally", "and what"]
        if any(q.startswith(w) or f" {w} " in q for w in followup_signals):
            return True

        return False

    def _rewrite_query(self, original_query: str, chat_history: str = "") -> str:
        if not self._needs_rewrite(original_query, chat_history):
            return original_query

        rewrite_prompt = ChatPromptTemplate.from_template(
            "You are a search query optimizer.\n"
            "Output ONLY the rephrased standalone search term. "
            "No explanation, no preamble, no quotes — just the search term itself.\n\n"
            "History: {history}\n"
            "Question: {question}\n\n"
            "Standalone search term:"
        )
        chain = rewrite_prompt | self.rewriter_llm | StrOutputParser()
        return chain.invoke({"history": chat_history, "question": original_query})

    # ── Topic extraction ──────────────────────────────────────────────────────

    def _extract_topic(self, query: str) -> str:
        try:
            topic_prompt = ChatPromptTemplate.from_template(
                "Classify this customer support query into a short 2-4 word topic category.\n"
                "Output ONLY the category label. Capitalize each word. No punctuation.\n\n"
                "Examples:\n"
                "  'my battery drains in 2 hours'     → Battery Drain Issue\n"
                "  'scooter not charging at all'       → Charging Failure\n"
                "  'cant log into the app'             → App Login Error\n"
                "  'motor making clicking noise'       → Motor Noise Problem\n"
                "  'GPS showing wrong location'        → GPS Inaccuracy\n"
                "  'how do i reset my password'        → Password Reset\n"
                "  'what is my warranty coverage'      → Warranty Inquiry\n\n"
                "Query: {query}\n\n"
                "Topic:"
            )
            chain = topic_prompt | self.rewriter_llm | StrOutputParser()
            topic = chain.invoke({"query": query}).strip()
            words = topic.split()
            return " ".join(words[:4]) if len(words) > 4 else topic
        except Exception as e:
            print(f"[TopicExtract] Error: {e}")
            return query[:50]

    # ── Kafka helper ──────────────────────────────────────────────────────────

    def _produce(self, topic: str, key: str, data: dict):
        try:
            self.kafka_producer.produce(topic, key=key, value=json.dumps(data))
            self.kafka_producer.poll(0)
        except Exception as e:
            print(f"[Kafka] produce error on {topic}: {e}")

    # ── Main response method ──────────────────────────────────────────────────

    def get_response(
        self,
        query: str,
        session_id: str,
        user_metadata: dict = None,
        collection_name: str = "enterprise_docs",
        chat_history: str = "",
        has_existing_ticket: bool = False    
    ):
        try:
            start_time = time.time()
            user_email = user_metadata.get("email", "anonymous") if user_metadata else "anonymous"
            full_name  = user_metadata.get("full_name", "Customer") if user_metadata else "Customer"

            # ── Cache check FIRST — before any LLM calls ──────────────────────
            user_scoped_query = f"{user_email}:{query}"
            cached_response = self.cache.get_cached_response(user_scoped_query)
            if cached_response:
                print(f"[Cache] Hit for {user_email}")
                self._produce("chat.messages.all", session_id, {
                    "session_id": session_id,
                    "role": "ai",
                    "user_email": user_email,
                    "latency_ms": int((time.time() - start_time) * 1000),
                    "cache_hit": True,
                    "sources_count": 0,
                    "topic": query[:50],    # raw query for cache hits — no LLM call needed
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                return cached_response

            # ── Topic extraction — only runs if we're generating a response ───
            topic = self._extract_topic(query)

            # ── Query rewrite — skipped when not needed ───────────────────────
            optimized_query = self._rewrite_query(query, chat_history)

            # ── ChromaDB retrieval ────────────────────────────────────────────
            vector_db = Chroma(
                collection_name=collection_name,
                embedding_function=self.embeddings,
                client=self.chroma_client
            )
            docs = vector_db.similarity_search(optimized_query, k=5)
            context_text = "\n\n".join([d.page_content for d in docs]) if docs else ""
            
            if not context_text:
                context_section = "No specific documentation found. Answer from general knowledge or ask the user to clarify their issue."
            else:
                context_section = context_text

            # ── Count AI turns for troubleshooting enforcement ────────────────
            ai_turn_count = chat_history.count("Ai:") if chat_history else 0

            # ── Prompt + generation ───────────────────────────────────────────
            template = """You are a senior support engineer for Aion Mobility.

            CUSTOMER: {full_name} ({email})
            TICKET STATUS: {ticket_status}

            RULES:
            1. Solve the issue using the provided Context only.
            2. TROUBLESHOOTING: You must provide at least 3-4 distinct troubleshooting attempts in the history before creating a ticket.
            3. DUPLICATE PREVENTION: If TICKET STATUS is 'Already Created', DO NOT use the ticket tool again. Instead, tell the user the team is already working on it.
            4. If the user asks for a status and a ticket exists, acknowledge the reference number in history and explain that updates will be sent to {email}.

            Chat History: {history}
            Context: {context}
            Question: {question}

            Answer:"""

            ticket_status = "Already Created" if has_existing_ticket else "None"

            gen_prompt = ChatPromptTemplate.from_template(template)
            chain = gen_prompt | self.generator_with_tools
            ai_msg = chain.invoke({
                "history": chat_history or "No history.",
                "context": context_section,
                "question": query,
                "full_name": full_name,
                "email": user_email,
                "ticket_status": ticket_status
            })

            # ── Ticket creation branch ────────────────────────────────────────
            if ai_msg.tool_calls and not has_existing_ticket:

                # Hard enforcement — LLM cannot skip troubleshooting steps
                if ai_turn_count < 3:
                    return {
                        "answer": (
                            "I want to make sure we've thoroughly explored all options before escalating. "
                            "Let me suggest a few more things to try first."
                        ),
                        "status": "success"
                    }

                tool_args = ai_msg.tool_calls[0]["args"]
                jira_desc = f"CUSTOMER: {full_name} ({user_email})\n\nISSUE:\n{tool_args.get('description')}"

                # n8n failure is now handled — never produces a bad ticket reference
                try:
                    jira_data = self._trigger_n8n_jira(tool_args.get("summary"), jira_desc, session_id)
                except Exception:
                    return {
                        "answer": (
                            "I wasn't able to create a support ticket right now due to a system issue. "
                            "Please try again in a moment."
                        ),
                        "status": "error"
                    }

                self._produce("support.tickets.created", session_id, {
                    "ticket_key": jira_data.get("key"),
                    "session_id": session_id,
                    "user_email": user_email,
                    "summary": tool_args.get("summary"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })

                return {
                    "answer": (
                        f"I've opened a support ticket for you. "
                        f"Reference: {jira_data.get('key')}. "
                        f"Our team will review this and contact you shortly "
                        f"through your registered email ({user_email})."
                    ),
                    "status": "ticket_created",
                    "ticket_key": jira_data.get("key"),
                    "summary":    tool_args.get("summary"), 
                }

            # ── Normal response ───────────────────────────────────────────────
            answer = ai_msg.content or (
                f"Our team is already working on your issue. "
                f"Updates will be sent to {user_email}."
            )

            final_response = {"answer": answer, "status": "success"}

            if not ai_msg.tool_calls:
                self.cache.set_cached_response(user_scoped_query, final_response)
                print(f"[Cache] Set for {user_email}")
            
            # topic = self._extract_topic(query)

            self._produce("chat.messages.all", session_id, {
                "session_id": session_id,
                "role": "ai",
                "user_email": user_email,
                "latency_ms": int((time.time() - start_time) * 1000),
                "cache_hit": False,
                "sources_count": len(docs),
                "topic": topic,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

            return final_response

        except Exception as e:
            print(f"[QueryService] Error: {e}")
            raise e

    def generate_resolution_announcement(
        self,
        ticket_key: str,
        notes: str = "",
        
    ) -> str:
        try:
            prompt = ChatPromptTemplate.from_template(
                "You are a friendly Aion Mobility support assistant.\n"
                "Write a SHORT chat message (2-3 sentences max) telling the customer "
                "their ticket has been resolved.\n\n"
                "Rules:\n"
                "- Use a warm, conversational tone — this appears directly in the chat UI\n"
                "- Layout instruction: Start by explicitly stating that the ticket has been resolved, then immediately detail the resolution notes.\n"
                "- Never use placeholders like [Name] or [Your Name]\n"
                "- Mention the ticket reference number right at the beginning\n"
                "- If resolution notes say 'Done' or are empty, just say the issue has been fixed\n"
                "- Do NOT write an email — write a short chat message\n"
                "- Sign off as 'Aion Support'\n\n"
                "Ticket: {ticket_key}\n"
                "Resolution notes: {notes}\n\n"
                "Chat message:"
            )

            chain = prompt | self.generator_llm | StrOutputParser()
            return chain.invoke({
                "ticket_key": ticket_key,
                
                "notes":      notes if notes and notes.lower() not in ("done", "") else "The issue has been fixed.",
            })

        except Exception as e:
            print(f"[ResolutionAnnouncement] Error: {e}")
            return (
                f"Great news! Your support ticket **{ticket_key}** has been resolved. "
                f"If you run into any further issues, feel free to reach out. — Aion Support"
            )
    # ── n8n / Jira webhook ────────────────────────────────────────────────────

    def _trigger_n8n_jira(self, summary: str, description: str, session_id: str):
        webhook_url = os.getenv("N8N_WEBHOOK_URL")
        payload = {"summary": summary, "description": description, "session_id": session_id}
        try:
            response = requests.post(webhook_url, json=payload, timeout=15)
            print(f"[n8n] Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    data = data[0]
                return data if isinstance(data, dict) else {"key": "Check-Jira"}
            raise Exception(f"n8n returned {response.status_code}")
        except Exception as e:
            print(f"[n8n] Webhook error: {e}")
            raise  
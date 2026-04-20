import pypdf
from docx import Document as DocxDocument
import io

class ParserService:
    @staticmethod
    def extract_text(file_content, file_type):
        text = ""
        if file_type == 'pdf':
            reader = pypdf.PdfReader(io.BytesIO(file_content))
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif file_type == 'docx':
            doc = DocxDocument(io.BytesIO(file_content))
            text = "\n".join([para.text for para in doc.paragraphs])
        elif file_type == 'txt':
            text = file_content.decode('utf-8')
        return text
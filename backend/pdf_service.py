import logging
import io
from fpdf import FPDF

logger = logging.getLogger(__name__)

class ReportPDF(FPDF):
    def header(self):
        # Logo or branding could go here
        self.set_font('Arial', 'B', 12)
        self.cell(0, 10, 'News Intelligence Report (EC Standard)', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def generate_pdf(report, references):
    """
    Generates a PDF using FPDF (Pure Python).
    No external system dependencies required.
    """
    pdf = ReportPDF()
    pdf.add_page()
    
    # Title
    pdf.set_font("Arial", "B", 24)
    # multi_cell title to avoid overflow
    pdf.multi_cell(0, 10, report.title or "Untitled Report", 0, 'C')
    pdf.ln(10)
    
    # Meta
    pdf.set_font("Arial", "I", 10)
    pdf.cell(0, 10, f"Date: {report.created_at.strftime('%Y-%m-%d')}", 0, 1, 'C')
    pdf.ln(10)
    
    # Body
    # FPDF doesn't render Markdown/HTML natively. 
    # We will strip markdown symbols for a clean text output.
    pdf.set_font("Times", "", 12)
    
    clean_text = report.content or ""
    # Simple markdown stripping
    clean_text = clean_text.replace('**', '').replace('##', '').replace('#', '')
    
    # Handle encoding: FPDF uses latin-1 by default. Replace unencodable chars.
    clean_text = clean_text.encode('latin-1', 'replace').decode('latin-1')
    
    pdf.multi_cell(0, 6, clean_text)
    pdf.ln(15)
    
    # References
    if references:
        pdf.add_page()
        pdf.set_font("Arial", "B", 16)
        pdf.cell(0, 10, "References", 0, 1)
        pdf.ln(5)
        
        pdf.set_font("Times", "", 10)
        for i, ref in enumerate(references):
            title = ref.translated_title or ref.raw_title
            source = ref.source.name if ref.source else "Unknown"
            
            # Encode/Decode to safe latin-1
            title = title.encode('latin-1', 'replace').decode('latin-1')
            source = source.encode('latin-1', 'replace').decode('latin-1')
            
            pdf.multi_cell(0, 5, f"{i+1}. {title} - {source}")
            pdf.ln(2)

    # Output to buffer
    try:
        # FPDF output returns check
        return pdf.output(dest='S').encode('latin-1') 
    except Exception as e:
        logger.error(f"FPDF Generation Error: {e}")
        # Fallback if version differs
        return pdf.output().encode('latin-1')

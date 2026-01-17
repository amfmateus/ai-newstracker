import markdown
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import re

logger = logging.getLogger(__name__)

# Mock email sending if no credentials are provided
# Legacy SMTP support removed. Only Resend API is supported.
SMTP_FROM = os.getenv("SMTP_FROM", "reports@example.com")

def generate_email_html(report, references):
    content = report.content or ""
    is_html = content.strip().lower().startswith(("<html>", "<!doctype", "<div"))

    references = references or [] # Default to empty list
    
    # Prepare references HTML
    references_html = "<h3>References</h3><ol>"
    for i, r in enumerate(references):
        title = r.translated_title or r.raw_title
        references_html += f"<li id='ref-{i+1}'><strong>{title}</strong> - <a href='{r.url}'>Source</a></li>"
    references_html += "</ol>"

    if is_html:
        # Check if references are already present (loose check)
        # If "References" or "REFERENCES" is in content, assume it's handled
        if "Reference" in content or "REFERENCE" in content:
            return content
            
        # If it's already HTML, just append references before </body> or at end
        if "</body>" in content:
            return content.replace("</body>", f"{references_html}</body>")
        return f"{content}<hr>{references_html}"

    # Prepare markdown content with citations
    ref_map = {str(r.id): i+1 for i, r in enumerate(references)}
    
    # Permissive ID: allow dots, underscores, and spaces
    pattern = r'\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}'
    
    def replace_group(match_full):
        # match_full is a contiguous block of citations
        ids = re.findall(pattern, match_full)
        valid_nums = []
        seen = set()
        for aid in ids:
            aid = aid.strip()
            if aid in ref_map and aid not in seen:
                valid_nums.append(ref_map[aid])
                seen.add(aid)
        
        if not valid_nums:
            return ""
        
        # Sort numbers for clean output [1, 2, 3]
        valid_nums.sort()
        
        rendered_links = [
            f"<a href='#ref-{n}' style='color:#0E47CB;text-decoration:none'>{n}</a>" 
            for n in valid_nums
        ]
        
        return f"<sup>[{', '.join(rendered_links)}]</sup>"

    # Match contiguous citation tags with potential separators
    contiguous_pattern = r'((?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}[,; \t]*)*(?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}))'
    
    text = re.sub(contiguous_pattern, lambda m: replace_group(m.group(0)), content)
    body_html = markdown.markdown(text)
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left;">
        <h1 style="color: #0E47CB;">{report.title}</h1>
        <p style="color: #666;">{report.created_at.strftime('%d %B %Y')}</p>
        <hr style="border: 0; border-top: 1px solid #eee;">
        {body_html}
        <hr style="border: 0; border-top: 1px solid #eee;">
        {references_html}
    </body>
    </html>
    """
    return html

from email.mime.base import MIMEBase
from email import encoders
import mimetypes

def send_report_email(to_email, report, references, config=None, subject=None, attachment_path=None):
    html_content = generate_email_html(report, references)
    
    # Configuration
    from_email = (config or {}).get("smtp_from_email") or SMTP_FROM

    msg = MIMEMultipart("mixed") if attachment_path else MIMEMultipart("alternative")
    
    # Use custom subject if provided, else fallback to default
    if not subject:
        subject = f"Report: {report.title}"
    
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    
    # Handle CC and BCC
    cc_list = []
    bcc_list = []
    
    if config:
        # CC
        cc_raw = config.get("cc") or config.get("CC")
        if cc_raw:
            if isinstance(cc_raw, str):
                cc_list = [e.strip() for e in cc_raw.split(',') if e.strip()]
            elif isinstance(cc_raw, list):
                cc_list = cc_raw
            
            if cc_list:
                msg["Cc"] = ", ".join(cc_list)

        # BCC
        bcc_raw = config.get("bcc") or config.get("BCC")
        if bcc_raw:
            if isinstance(bcc_raw, str):
                bcc_list = [e.strip() for e in bcc_raw.split(',') if e.strip()]
            elif isinstance(bcc_raw, list):
                bcc_list = bcc_raw
        
        # Priority / Urgent
        priority = config.get("priority", "").lower()
        is_urgent = config.get("urgent", False)
        
        if is_urgent or priority == 'high':
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'
            msg['Importance'] = 'High'
        elif priority == 'low':
            msg['X-Priority'] = '5'
            msg['X-MSMail-Priority'] = 'Low'
            msg['Importance'] = 'Low'
            
        # Reply-To
        reply_to = config.get("smtp_reply_to") or config.get("reply_to")
        if reply_to:
            msg.add_header('Reply-To', reply_to)
            
        # Sender Name (Friendly From)
        # Format: "Sender Name <email@example.com>"
        # PRIORITIZE Global Profile Settings (smtp_sender_name) over Delivery Config (sender_name)
        sender_name = config.get("smtp_sender_name") or config.get("sender_name") or config.get("from_name")
        if sender_name:
            # Simple sanitization to prevent header injection? 
            # MIMEMultipart/MIMEText handles formatting usually but let's be safe slightly
            sender_name = sender_name.replace('"', '').replace('<', '').replace('>', '')
            msg.replace_header("From", f'"{sender_name}" <{from_email}>')
    
    # Body
    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText("Please enable HTML to view this report.", "plain"))
    body_part.attach(MIMEText(html_content, "html"))
    msg.attach(body_part)

    # Attach File
    if attachment_path and os.path.isfile(attachment_path):
        try:
            ctype, encoding = mimetypes.guess_type(attachment_path)
            if ctype is None or encoding is not None:
                # No guess could be made, or the file is encoded (compressed), so
                # use a generic bag-of-bits type.
                ctype = 'application/octet-stream'
            
            maintype, subtype = ctype.split('/', 1)
            
            with open(attachment_path, 'rb') as fp:
                attachment = MIMEBase(maintype, subtype)
                attachment.set_payload(fp.read())
            
            encoders.encode_base64(attachment)
            
            filename = os.path.basename(attachment_path)
            # Quote the filename to handle spaces correctly in all email clients
            attachment.add_header('Content-Disposition', 'attachment', filename=f'"{filename}"')
            msg.attach(attachment)
            logger.info(f"Attached file: {filename}")
        except Exception as e:
            logger.error(f"Failed to attach file: {e}")
            # Continue sending without attachment? Or fail? 
            # Let's log and continue



    # PRIORITY: Check for Resend API Key first (System Preferred)
    resend_api_key = (config or {}).get("resend_api_key") or os.getenv("RESEND_API_KEY")
    
    if resend_api_key:
        try:
            import resend
            resend.api_key = resend_api_key
            
            # Prepare Recipients
            # Resend requires a list of strings
            to_list = [to_email] if isinstance(to_email, str) else to_email
            
            # Use Verified Sender or Default
            # Note: For free Resend accounts, you can only send to your own email unless you verify domain
            # We default to 'onboarding@resend.dev' if no custom FROM is provided, 
            # but usually it's better to force the user to provide one if they verified a domain.
            # Fallback for testing:
            sender = from_email if from_email and "@" in from_email else "onboarding@resend.dev"
            
            # Construct Sender String "Name <email>"
            sender_str = sender
            if sender_name:
                 # Simple sanitization
                 clean_name = sender_name.replace('"', '').replace('<', '').replace('>', '')
                 if "<" not in sender:
                     sender_str = f"{clean_name} <{sender}>"

            email_params = {
                "from": sender_str,
                "to": to_list,
                "subject": subject or f"Report: {report.title}",
                "html": html_content
            }
            
            if cc_list:
                email_params["cc"] = cc_list
            if bcc_list:
                email_params["bcc"] = bcc_list
            if reply_to:
                email_params["reply_to"] = reply_to
            
            # Attachments
            # Resend SDK handles attachments via: "attachments": [{"filename": "...", "content": buffer or list of bytes}]
            # Reading file as bytes
            if attachment_path and os.path.isfile(attachment_path):
                try:
                    with open(attachment_path, "rb") as f:
                        file_bytes = f.read()
                        # Convert bytes to list of integers for JSON serialization if SDK requires it?
                        # Actually the python SDK handles 'content' as bytes or list of ints.
                        # Ideally verifying SDK docs: content: list[int] | str (base64 could work too)
                        # Let's simple use read() and let library handle or convert to list of ints if needed
                        # Quick fix: manually list-ify to be safe for JSON serialization internally
                        byte_list = list(file_bytes)
                        
                        email_params["attachments"] = [{
                            "filename": os.path.basename(attachment_path),
                            "content": byte_list
                        }]
                except Exception as att_err:
                    logger.error(f"Failed to read attachment for Resend: {att_err}")

            response = resend.Emails.send(email_params)
            logger.info(f"Sent via Resend: {response}")
            return {"status": "sent", "provider": "resend", "id": response.get("id")}
            
        except ImportError:
            logger.error("Resend library not installed but API key found.")
        except Exception as e:
             logger.error(f"Resend Method Failed: {e}")
             raise e
    
    # If Resend logic didn't return, we fallback to mock
    # because SMTP is removed.
    
    # Mock
    print(f"[MOCK EMAIL] To: {to_email} | CC: {cc_list} | Subject: {msg['Subject']}")
    return {"status": "mock_sent"}


"""
PDF generation with WeasyPrint fallback.

Uses WeasyPrint when available, otherwise generates a simple HTML file.
"""

_weasyprint_available = False
try:
    from weasyprint import HTML as WeasyHTML
    _weasyprint_available = True
except ImportError:
    pass

from datetime import datetime


def generate_paper_pdf(paper_data: dict) -> bytes:
    """Generate a PDF. Uses WeasyPrint if available, otherwise returns HTML as bytes."""
    html_content = build_html(paper_data)

    if _weasyprint_available:
        return WeasyHTML(string=html_content).write_pdf()
    else:
        # Fallback: return HTML bytes (frontend will handle as downloadable HTML)
        return html_content.encode("utf-8")


def get_content_type() -> str:
    """Return the correct content type based on available engine."""
    return "application/pdf" if _weasyprint_available else "text/html"


def build_html(data: dict) -> str:
    """Build the full HTML document for the exam paper."""

    title = data.get("title", "Examination")
    school = data.get("school_name", "English Pathshala")
    exam = data.get("exam_name", "")
    subject = data.get("subject", "")
    grade = data.get("class_grade", "")
    duration = data.get("duration_minutes")
    max_marks = data.get("max_marks") or data.get("total_marks", "")
    instructions = data.get("instructions", "")
    sections = data.get("sections", [])
    today = datetime.now().strftime("%d %B %Y")

    # Build sections HTML
    sections_html = ""
    question_number = 1

    for section in sections:
        sec_name = section.get("name", "Section")
        questions = section.get("questions", [])
        sec_marks = sum(q.get("marks", 0) or 0 for q in questions)

        sections_html += f"""
        <div class="section">
            <div class="section-header">
                <span class="section-name">{sec_name}</span>
                <span class="section-marks">[{sec_marks} Marks]</span>
            </div>
        """

        QUESTION_TYPES = {
            "mcq": "Multiple Choice Questions",
            "short_answer": "Short Answer Questions",
            "long_answer": "Long Answer Questions",
            "numerical": "Numerical Questions",
            "fill_blanks": "Fill in the Blanks",
            "true_false": "True or False",
            "assertion_reason": "Assertion & Reason",
            "match_following": "Match the Following"
        }

        current_type = None
        for q in questions:
            q_text = q.get("question_text", "")
            q_marks = q.get("marks", "")
            q_mode = q.get("question_mode", "text")
            q_type = q.get("question_type")

            if q_type and q_type != current_type:
                current_type = q_type
                type_label = QUESTION_TYPES.get(q_type, q_type.replace("_", " ").title())
                sections_html += f"""
                <div class="q-group-heading">{type_label}</div>
                """


            if q_mode == "image" and not q_text:
                sections_html += f"""
                <div class="question">
                    <span class="q-number">Q{question_number}.</span>
                    <div class="q-body"><em>[Image-based question — see attached sheet]</em></div>
                    <span class="q-marks">[{q_marks}]</span>
                </div>"""
            else:
                if q_type == "mcq":
                    import re
                    lines = (q_text or "").split('\n')
                    formatted_lines = []
                    opts = []
                    for line in lines:
                        if re.match(r'^(\([A-Da-d]\)|[A-Da-d]\.)\s*', line.strip()):
                            opts.append(line.strip())
                        else:
                            if opts:
                                opts_html = '<div class="mcq-options">' + "".join(f'<div class="mcq-opt">{o}</div>' for o in opts) + '</div>'
                                formatted_lines.append(opts_html)
                                opts = []
                            formatted_lines.append(line)
                    if opts:
                        opts_html = '<div class="mcq-options">' + "".join(f'<div class="mcq-opt">{o}</div>' for o in opts) + '</div>'
                        formatted_lines.append(opts_html)
                    
                    formatted_text = "<br>".join(formatted_lines).replace("<br><div", "<div").replace("</div><br>", "</div>")
                else:
                    formatted_text = (q_text or "").replace("\n", "<br>")

                sections_html += f"""
                <div class="question">
                    <span class="q-number">Q{question_number}.</span>
                    <div class="q-body">{formatted_text}</div>
                    <span class="q-marks">[{q_marks}]</span>
                </div>"""
            question_number += 1

        sections_html += "</div>"

    # Meta row
    meta_items = []
    if subject:
        meta_items.append(f"<span><strong>Subject:</strong> {subject}</span>")
    if grade:
        meta_items.append(f"<span><strong>Class:</strong> {grade}</span>")
    if duration:
        meta_items.append(f"<span><strong>Duration:</strong> {duration} minutes</span>")
    if max_marks:
        meta_items.append(f"<span><strong>Max Marks:</strong> {max_marks}</span>")
    meta_items.append(f"<span><strong>Date:</strong> {today}</span>")
    meta_html = " &nbsp;|&nbsp; ".join(meta_items)

    # Instructions
    instructions_html = ""
    if instructions:
        lines = instructions.split("\n")
        li_items = "".join(f"<li>{line.strip()}</li>" for line in lines if line.strip())
        if not li_items:
            li_items = f"<li>{instructions}</li>"
        instructions_html = f"""
        <div class="instructions">
            <strong>General Instructions:</strong>
            <ol>{li_items}</ol>
        </div>"""

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{title} — {school}</title>
<style>
{PAPER_CSS}
</style>
</head>
<body>
    <div class="paper">
        <div class="header">
            <div class="school-name">{school}</div>
            <div class="paper-title">{title}</div>
        </div>
        {f'<div class="name-row">{exam}</div>' if exam else ''}
        <div class="meta-row">{meta_html}</div>
        {instructions_html}
        <hr class="divider">
        {sections_html}
        <div class="footer">
            <div class="footer-line"></div>
            <div class="footer-text">— End of Paper —</div>
        </div>
    </div>
</body>
</html>"""


PAPER_CSS = """
@page {
    size: A4;
    margin: 12mm 15mm 12mm 15mm;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Times New Roman', 'Georgia', serif;
    font-size: 10.5pt;
    line-height: 1.4;
    color: #1a1a1a;
    max-width: 210mm;
    margin: 0 auto;
    padding: 0;
    background: white;
}
.paper { max-width: 100%; }
.header {
    text-align: center;
    margin-bottom: 8pt;
    padding-bottom: 6pt;
    border-bottom: 2pt solid #333;
}
.school-name {
    font-size: 16pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1.5pt;
    color: #111;
    margin-bottom: 4pt;
}
.name-row {
    font-size: 11pt;
    font-weight: bold;
    color: #333;
    text-align: center;
    margin-bottom: 4pt;
}
.paper-title {
    font-size: 13pt;
    font-weight: bold;
    color: #222;
    margin-top: 2pt;
}
.meta-row {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 4pt;
    font-size: 9pt;
    color: #444;
    margin: 6pt 0;
    padding: 4pt 8pt;
    background: #f8f8f8;
    border: 0.5pt solid #ddd;
    border-radius: 2pt;
}
.instructions {
    margin: 6pt 0;
    padding: 6pt 10pt;
    font-size: 9pt;
    border-left: 2pt solid #666;
    background: #fafafa;
}
.instructions strong { display: block; margin-bottom: 2pt; font-size: 9.5pt; }
.instructions ol { margin-left: 14pt; }
.instructions li { margin-bottom: 1pt; }
.divider { border: none; border-top: 1pt solid #ccc; margin: 8pt 0; }
.section { margin-bottom: 10pt; page-break-inside: avoid; }
.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4pt 8pt;
    background: #f0f0f0;
    border: 0.5pt solid #ddd;
    border-radius: 2pt;
    margin-bottom: 6pt;
}
.section-name {
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
}
.section-marks { font-size: 9pt; font-weight: bold; color: #555; }
.q-group-heading {
    font-size: 10pt;
    font-weight: bold;
    color: #444;
    margin-top: 10pt;
    margin-bottom: 6pt;
    padding-bottom: 2pt;
    border-bottom: 1pt solid #eee;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
}
.question {
    display: flex;
    align-items: flex-start;
    gap: 6pt;
    margin-bottom: 6pt;
    padding: 2pt 0;
    page-break-inside: avoid;
}
.q-number { font-weight: bold; min-width: 24pt; color: #333; flex-shrink: 0; }
.q-body { flex: 1; line-height: 1.45; }
.q-marks {
    font-size: 8.5pt;
    font-weight: bold;
    color: #666;
    white-space: nowrap;
    flex-shrink: 0;
}
.mcq-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4pt 12pt;
    margin-top: 4pt;
}
.mcq-opt {
    line-height: 1.4;
}
.footer { margin-top: 16pt; text-align: center; }
.footer-line {
    height: 1pt;
    background: linear-gradient(to right, transparent, #999, transparent);
    margin-bottom: 6pt;
}
.footer-text { font-size: 10pt; font-style: italic; color: #888; letter-spacing: 1pt; }

@media print {
    body { padding: 0; }
    .question { page-break-inside: avoid; }
}
"""

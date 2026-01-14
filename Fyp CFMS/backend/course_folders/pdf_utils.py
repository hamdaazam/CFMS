"""
PDF utilities for course folder report generation.
"""

import io
import os
from datetime import datetime
from PyPDF2 import PdfMerger, PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import Table, TableStyle, Paragraph, Image as ReportLabImage, Frame
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Spacer
from reportlab.lib.colors import HexColor
from django.conf import settings
import re

def clean_html_for_pdf(html_content):
    """
    Clean HTML content for ReportLab Paragraph.
    Removes unsupported tags like <span>, <div>, <p> but keeps content.
    Handles basic entities.
    """
    if not html_content:
        return ""
    
    # 1. Replace &nbsp; with space
    html_content = html_content.replace('&nbsp;', ' ')
    
    # 2. Remove span, div, p tags (start and end) but keep content
    # Use re.IGNORECASE for case insensitivity
    # Remove start tags with attributes
    html_content = re.sub(r'<(span|div|p)[^>]*>', '', html_content, flags=re.IGNORECASE)
    # Remove end tags
    html_content = re.sub(r'</(span|div|p)>', '', html_content, flags=re.IGNORECASE)
    
    # 3. Ensure <br> is <br/>
    html_content = re.sub(r'<br\s*>', '<br/>', html_content, flags=re.IGNORECASE)
    
    # 4. Remove other potentially problematic tags if needed, or just let ReportLab handle basic ones (b, i, u)
    
    return html_content

def get_dict_value_safe(dictionary, key, default=None):
    """
    Safely get a value from a dictionary trying multiple key formats.
    Tries: original key, string version, integer version (if applicable).
    Also tries all keys in the dictionary to find a match by value comparison.
    """
    if not dictionary:
        return default
    
    # Try original key
    if key in dictionary:
        return dictionary[key]
    
    # Try string version
    str_key = str(key) if key is not None else None
    if str_key and str_key in dictionary:
        return dictionary[str_key]
    
    # Try integer version if key is numeric
    try:
        int_key = int(key) if key is not None else None
        if int_key is not None and int_key in dictionary:
            return dictionary[int_key]
    except (ValueError, TypeError):
        pass
    
    # Try all keys in dictionary - compare as strings
    # This handles cases where keys might be stored as "1" but we're looking for 1 or vice versa
    str_key_normalized = str(key).strip() if key is not None else None
    for dict_key in dictionary.keys():
        if str(dict_key).strip() == str_key_normalized:
            return dictionary[dict_key]
    
    return default

# Constants
# Assuming the backend is running from d:\Fyp Project Client\backend
# And the logo is in d:\Fyp Project Client\src\assets\cust logo.png
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # backend/
PROJECT_ROOT = os.path.dirname(BASE_DIR) # Fyp Project Client/
LOGO_PATH = os.path.join(PROJECT_ROOT, 'src', 'assets', 'cust logo.png')

def collect_folder_pdfs(folder):
    """
    Collect all PDFs for a course folder.
    Returns list of tuples: (section_name, pdf_bytes)
    """
    sections = []
    
    # 1. Title Page
    try:
        title_pdf = generate_title_page(folder)
        if title_pdf:
            sections.append(("Title Page", title_pdf))
        else:
            print("Title Page generation returned empty bytes")
    except Exception as e:
        print(f"Error generating Title Page: {e}")
    
    # 2. Course Outline
    try:
        outline_pdf = generate_course_outline_page(folder)
        if outline_pdf:
            sections.append(("Course Outline", outline_pdf))
    except Exception as e:
        print(f"Error generating Course Outline: {e}")
    
    # 3. Course Log
    try:
        log_pdf = generate_course_log_page(folder)
        if log_pdf:
            sections.append(("Course Log", log_pdf))
    except Exception as e:
        print(f"Error generating Course Log: {e}")
    
    # 4. Attendance Record (Uploaded PDF)
    try:
        # The frontend stores attendance in outline_content['attendanceFile'] as base64
        outline_content = folder.outline_content or {}
        attendance_file_data = outline_content.get('attendanceFile')
        
        if attendance_file_data and attendance_file_data.get('fileUrl'):
            import base64
            file_url = attendance_file_data.get('fileUrl', '')
            
            if file_url.startswith('data:application/pdf;base64,'):
                # Extract base64 part
                base64_str = file_url.split(',')[1]
                try:
                    attendance_bytes = base64.b64decode(base64_str)
                    if attendance_bytes:
                        # Overlay Header
                        attendance_bytes = add_header_to_pdf(attendance_bytes, "Attendance Record")
                        sections.append(("Attendance Record", attendance_bytes))
                    else:
                        sections.append(("Attendance Record", create_missing_page_placeholder("Attendance Record")))
                except Exception as e:
                    print(f"Error decoding Attendance base64: {e}")
                    sections.append(("Attendance Record", create_missing_page_placeholder("Attendance Record")))
            else:
                print("DEBUG: Attendance fileUrl format not recognized (not base64 PDF)")
                sections.append(("Attendance Record", create_missing_page_placeholder("Attendance Record")))
        else:
            print("DEBUG: No attendanceFile data in outline_content")
            sections.append(("Attendance Record", create_missing_page_placeholder("Attendance Record")))
            
    except Exception as e:
        print(f"Error fetching Attendance from outline_content: {e}")
        sections.append(("Attendance Record", create_missing_page_placeholder("Attendance Record")))

    # 5. Lecture Notes (Uploaded PDF)
    try:
        outline_content = folder.outline_content or {}
        notes_file_data = outline_content.get('lectureNotesFile')
        
        if notes_file_data and notes_file_data.get('fileUrl'):
            import base64
            file_url = notes_file_data.get('fileUrl', '')
            
            if file_url.startswith('data:application/pdf;base64,'):
                # Extract base64 part
                base64_str = file_url.split(',')[1]
                try:
                    notes_bytes = base64.b64decode(base64_str)
                    if notes_bytes:
                        # Overlay Header
                        notes_bytes = add_header_to_pdf(notes_bytes, "Lecture Notes")
                        sections.append(("Lecture Notes", notes_bytes))
                    else:
                         sections.append(("Lecture Notes", create_missing_page_placeholder("Lecture Notes")))
                except Exception as e:
                    print(f"Error decoding Lecture Notes base64: {e}")
                    sections.append(("Lecture Notes", create_missing_page_placeholder("Lecture Notes")))
            else:
                print("DEBUG: Lecture Notes fileUrl format not recognized (not base64 PDF)")
                sections.append(("Lecture Notes", create_missing_page_placeholder("Lecture Notes")))
        else:
            print("DEBUG: No lectureNotesFile data in outline_content")
            sections.append(("Lecture Notes", create_missing_page_placeholder("Lecture Notes")))
            
    except Exception as e:
        print(f"Error fetching Lecture Notes from outline_content: {e}")
        sections.append(("Lecture Notes", create_missing_page_placeholder("Lecture Notes")))

    # 6. Assignments
    try:
        assignment_sections = generate_assignment_section(folder)
        sections.extend(assignment_sections)
    except Exception as e:
        print(f"Error generating Assignment sections: {e}")

    # 7. Quizzes
    try:
        quiz_sections = generate_quiz_section(folder)
        sections.extend(quiz_sections)
    except Exception as e:
        print(f"Error generating Quiz sections: {e}")

    # 8. Midterm
    try:
        midterm_sections = generate_midterm_section(folder)
        sections.extend(midterm_sections)
    except Exception as e:
        print(f"Error generating Midterm sections: {e}")

    # 9. Final
    try:
        final_sections = generate_final_section(folder)
        sections.extend(final_sections)
    except Exception as e:
        print(f"Error generating Final sections: {e}")

    # 10. Project Report
    if folder.project_report_file:
        try:
            # Check if file exists in storage
            if folder.project_report_file.storage.exists(folder.project_report_file.name):
                with folder.project_report_file.open('rb') as f:
                    pdf_bytes = f.read()
                    if pdf_bytes:
                        pdf_bytes = add_header_to_pdf(pdf_bytes, "Project Report")
                        sections.append(("Project Report", pdf_bytes))
            else:
                print(f"DEBUG: Project Report file not found at {folder.project_report_file.name}")
                sections.append(("Project Report", create_missing_page_placeholder("Project Report")))
        except Exception as e:
            print(f"Error reading Project Report: {e}")
            sections.append(("Project Report", create_missing_page_placeholder("Project Report")))
    else:
        sections.append(("Project Report", create_missing_page_placeholder("Project Report")))

    # 11. Course Result
    if folder.course_result_file:
        try:
            if folder.course_result_file.storage.exists(folder.course_result_file.name):
                with folder.course_result_file.open('rb') as f:
                    pdf_bytes = f.read()
                    if pdf_bytes:
                        pdf_bytes = add_header_to_pdf(pdf_bytes, "Course Result")
                        sections.append(("Course Result", pdf_bytes))
            else:
                print(f"DEBUG: Course Result file not found at {folder.course_result_file.name}")
                sections.append(("Course Result", create_missing_page_placeholder("Course Result")))
        except Exception as e:
            print(f"Error reading Course Result: {e}")
            sections.append(("Course Result", create_missing_page_placeholder("Course Result")))
    else:
        sections.append(("Course Result", create_missing_page_placeholder("Course Result")))

    # 12. Course Review Report
    if folder.folder_review_report_file:
        try:
            if folder.folder_review_report_file.storage.exists(folder.folder_review_report_file.name):
                with folder.folder_review_report_file.open('rb') as f:
                    pdf_bytes = f.read()
                    if pdf_bytes:
                        pdf_bytes = add_header_to_pdf(pdf_bytes, "Course Review Report")
                        sections.append(("Course Review Report", pdf_bytes))
            else:
                print(f"DEBUG: Course Review Report file not found at {folder.folder_review_report_file.name}")
                sections.append(("Course Review Report", create_missing_page_placeholder("Course Review Report")))
        except Exception as e:
            print(f"Error reading Course Review Report: {e}")
            sections.append(("Course Review Report", create_missing_page_placeholder("Course Review Report")))
    else:
        sections.append(("Course Review Report", create_missing_page_placeholder("Course Review Report")))

    # 13. CLO Assessment
    if folder.clo_assessment_file:
        try:
            if folder.clo_assessment_file.storage.exists(folder.clo_assessment_file.name):
                with folder.clo_assessment_file.open('rb') as f:
                    pdf_bytes = f.read()
                    if pdf_bytes:
                        pdf_bytes = add_header_to_pdf(pdf_bytes, "CLO Assessment")
                        sections.append(("CLO Assessment", pdf_bytes))
            else:
                print(f"DEBUG: CLO Assessment file not found at {folder.clo_assessment_file.name}")
                sections.append(("CLO Assessment", create_missing_page_placeholder("CLO Assessment")))
        except Exception as e:
            print(f"Error reading CLO Assessment: {e}")
            sections.append(("CLO Assessment", create_missing_page_placeholder("CLO Assessment")))
    else:
        sections.append(("CLO Assessment", create_missing_page_placeholder("CLO Assessment")))
    
    return sections


def generate_assignment_section(folder):
    """
    Generate PDFs for all assignments (Question Paper & Model Solution & Samples).
    """
    sections = []
    outline_content = folder.outline_content or {}
    assignments = outline_content.get('assignments', [])
    assignment_records = outline_content.get('assignmentRecords', {})
    assignment_papers = outline_content.get('assignmentPapers', {})
    assignment_solutions = outline_content.get('assignmentSolutions', {})
    
    print(f"DEBUG: ========== ASSIGNMENT SECTION ==========")
    print(f"DEBUG: Total assignments found: {len(assignments)}")
    print(f"DEBUG: Assignment IDs in array: {[a.get('id') for a in assignments]}")
    print(f"DEBUG: Assignment names in array: {[a.get('name') for a in assignments]}")
    print(f"DEBUG: Assignment paper keys: {list(assignment_papers.keys())}")
    print(f"DEBUG: Assignment solution keys: {list(assignment_solutions.keys())}")
    print(f"DEBUG: Assignment papers data preview: {[(k, list(v.keys()) if isinstance(v, dict) else type(v).__name__) for k, v in list(assignment_papers.items())[:3]]}")
    print(f"DEBUG: Assignment solutions data preview: {[(k, list(v.keys()) if isinstance(v, dict) else type(v).__name__) for k, v in list(assignment_solutions.items())[:3]]}")
    
    # Sort assignments by name or creation date if needed. 
    # For now, assuming they are in the desired order.
    
    # Also try matching by index position - use dictionary keys in order
    # Get all keys and match by position
    paper_keys_list = list(assignment_papers.keys())
    solution_keys_list = list(assignment_solutions.keys())
    
    print(f"DEBUG: Paper keys in order: {paper_keys_list}")
    print(f"DEBUG: Solution keys in order: {solution_keys_list}")
    
    for idx, assignment in enumerate(assignments):
        assignment_id = assignment.get('id')
        # Ensure ID is a string for consistent dictionary key matching
        assignment_id_original = assignment_id
        assignment_id = str(assignment_id) if assignment_id is not None else None
        assignment_name = assignment.get('name', f"Assignment {assignment_id}")
        
        print(f"DEBUG: Processing {assignment_name} (ID: {assignment_id}, type: {type(assignment_id)})")
        
        # Strategy 1: Try to match by ID (exact match)
        paper_key = None
        sol_key = None
        paper_data = {}
        sol_data = {}
        
        # Try exact ID match first
        if assignment_id and assignment_id in assignment_papers:
            paper_key = assignment_id
            paper_data = assignment_papers[assignment_id]
            print(f"DEBUG: Exact ID match for paper: {assignment_id}")
        elif assignment_id_original and assignment_id_original in assignment_papers:
            paper_key = assignment_id_original
            paper_data = assignment_papers[assignment_id_original]
            print(f"DEBUG: Exact original ID match for paper: {assignment_id_original}")
        
        if assignment_id and assignment_id in assignment_solutions:
            sol_key = assignment_id
            sol_data = assignment_solutions[assignment_id]
            print(f"DEBUG: Exact ID match for solution: {assignment_id}")
        elif assignment_id_original and assignment_id_original in assignment_solutions:
            sol_key = assignment_id_original
            sol_data = assignment_solutions[assignment_id_original]
            print(f"DEBUG: Exact original ID match for solution: {assignment_id_original}")
        
        # Strategy 2: If no exact match, try string comparison
        if not paper_key:
            for key in assignment_papers.keys():
                if str(key).strip() == str(assignment_id).strip() or str(key).strip() == str(assignment_id_original).strip():
                    paper_key = key
                    paper_data = assignment_papers[key]
                    print(f"DEBUG: String match for paper: {key}")
                    break
        
        if not sol_key:
            for key in assignment_solutions.keys():
                if str(key).strip() == str(assignment_id).strip() or str(key).strip() == str(assignment_id_original).strip():
                    sol_key = key
                    sol_data = assignment_solutions[key]
                    print(f"DEBUG: String match for solution: {key}")
                    break
        
        # Strategy 3: If still no match, use index-based (position in array = position in dict keys)
        if not paper_key and idx < len(paper_keys_list):
            paper_key = paper_keys_list[idx]
            paper_data = assignment_papers[paper_key]
            print(f"DEBUG: ✓ Using index-based match for paper (idx={idx}): {paper_key}")
        elif not paper_key:
            print(f"DEBUG: ✗ No paper key found! idx={idx}, paper_keys_list length={len(paper_keys_list)}")
            # Try to use ANY key if we have data but no match
            if paper_keys_list:
                paper_key = paper_keys_list[0] if idx == 0 else (paper_keys_list[idx] if idx < len(paper_keys_list) else paper_keys_list[-1])
                paper_data = assignment_papers[paper_key]
                print(f"DEBUG: Fallback: Using key {paper_key} for paper")
        
        if not sol_key and idx < len(solution_keys_list):
            sol_key = solution_keys_list[idx]
            sol_data = assignment_solutions[sol_key]
            print(f"DEBUG: ✓ Using index-based match for solution (idx={idx}): {sol_key}")
        elif not sol_key:
            print(f"DEBUG: ✗ No solution key found! idx={idx}, solution_keys_list length={len(solution_keys_list)}")
            # Try to use ANY key if we have data but no match
            if solution_keys_list:
                sol_key = solution_keys_list[0] if idx == 0 else (solution_keys_list[idx] if idx < len(solution_keys_list) else solution_keys_list[-1])
                sol_data = assignment_solutions[sol_key]
                print(f"DEBUG: Fallback: Using key {sol_key} for solution")
        
        # Use the found keys for generation
        effective_paper_key = paper_key if paper_key else assignment_id
        effective_sol_key = sol_key if sol_key else assignment_id
        
        print(f"DEBUG: Paper data found: {bool(paper_data)} (key: {effective_paper_key}), Solution data found: {bool(sol_data)} (key: {effective_sol_key})")
        if paper_data:
            print(f"DEBUG: Paper data has keys: {list(paper_data.keys())}, questions: {len(paper_data.get('questions', []))}")
        if sol_data:
            print(f"DEBUG: Solution data has keys: {list(sol_data.keys())}, answers: {len(sol_data.get('answers', []))}")
        print(f"DEBUG: All paper keys: {list(assignment_papers.keys())}")
        print(f"DEBUG: All solution keys: {list(assignment_solutions.keys())}")
        
        # 1. Question Paper - Always generate
        try:
            # Pass the actual data we found to avoid re-lookup issues
            qp_bytes = generate_assignment_question_paper(folder, effective_paper_key, assignment_name, paper_data=paper_data)
            
            # Accept any non-empty PDF bytes (even if small, it's valid)
            if qp_bytes and len(qp_bytes) > 0:
                sections.append((f"{assignment_name} Question Paper", qp_bytes))
                print(f"DEBUG: ✓ Added {assignment_name} Question Paper ({len(qp_bytes)} bytes) using key: {effective_paper_key}")
            else:
                print(f"DEBUG: ✗ {assignment_name} Question Paper returned empty/None bytes - generating placeholder")
                sections.append((f"{assignment_name} Question Paper", create_missing_page_placeholder(f"{assignment_name} Question Paper")))
        except Exception as e:
            print(f"ERROR generating Question Paper for {assignment_name}: {e}")
            import traceback
            traceback.print_exc()
            # Add placeholder even on error
            sections.append((f"{assignment_name} Question Paper", create_missing_page_placeholder(f"{assignment_name} Question Paper")))
            
        # 2. Model Solution - Always generate
        try:
            # Pass the actual data we found to avoid re-lookup issues
            ms_bytes = generate_assignment_model_solution(folder, effective_sol_key, assignment_name, sol_data=sol_data)
            
            # Accept any non-empty PDF bytes (even if small, it's valid)
            if ms_bytes and len(ms_bytes) > 0:
                sections.append((f"{assignment_name} Model Solution", ms_bytes))
                print(f"DEBUG: ✓ Added {assignment_name} Model Solution ({len(ms_bytes)} bytes) using key: {effective_sol_key}")
            else:
                print(f"DEBUG: ✗ {assignment_name} Model Solution returned empty/None bytes - generating placeholder")
                sections.append((f"{assignment_name} Model Solution", create_missing_page_placeholder(f"{assignment_name} Model Solution")))
        except Exception as e:
            print(f"ERROR generating Model Solution for {assignment_name}: {e}")
            import traceback
            traceback.print_exc()
            # Add placeholder even on error
            sections.append((f"{assignment_name} Model Solution", create_missing_page_placeholder(f"{assignment_name} Model Solution")))

        # 3. Student Samples (Best, Average, Worst)
        records = get_dict_value_safe(assignment_records, assignment_id, {})
        
        # Helper to process sample
        def process_sample(sample_key, title_suffix):
            sample_data = records.get(sample_key)
            if sample_data and sample_data.get('fileData'):
                try:
                    import base64
                    file_url = sample_data.get('fileData', '')
                    if file_url.startswith('data:application/pdf;base64,'):
                        base64_str = file_url.split(',')[1]
                        pdf_bytes = base64.b64decode(base64_str)
                        if pdf_bytes:
                            # Overlay Header
                            header_title = f"{assignment_name} {title_suffix}"
                            pdf_bytes = add_header_to_pdf(pdf_bytes, header_title)
                            sections.append((header_title, pdf_bytes))
                        else:
                            sections.append((f"{assignment_name} {title_suffix}", create_missing_page_placeholder(f"{assignment_name} {title_suffix}")))
                    else:
                        print(f"DEBUG: {assignment_name} {sample_key} fileData format not recognized")
                        sections.append((f"{assignment_name} {title_suffix}", create_missing_page_placeholder(f"{assignment_name} {title_suffix}")))
                except Exception as e:
                    print(f"Error processing {assignment_name} {sample_key}: {e}")
                    sections.append((f"{assignment_name} {title_suffix}", create_missing_page_placeholder(f"{assignment_name} {title_suffix}")))
            else:
                 sections.append((f"{assignment_name} {title_suffix}", create_missing_page_placeholder(f"{assignment_name} {title_suffix}")))

        process_sample('best', 'Best Sample')
        process_sample('average', 'Average Sample')
        process_sample('worst', 'Worst Sample')
            
    return sections


def generate_assignment_question_paper(folder, assignment_id, assignment_name, paper_data=None):
    """Generate the Assignment Question Paper PDF."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    # Draw Section Header
    _draw_header(c, width, height, f"{assignment_name} Question Paper")
    
    # Fetch Data - use provided data or look it up
    if paper_data is None:
        outline_content = folder.outline_content or {}
        papers = outline_content.get('assignmentPapers', {})
        # Try multiple key formats
        paper_data = get_dict_value_safe(papers, assignment_id, {})
        if not paper_data:
            # Try all keys to find a match
            for key in papers.keys():
                if str(key).strip() == str(assignment_id).strip():
                    paper_data = papers[key]
                    print(f"DEBUG: Found paper data using key: {key} (type: {type(key)})")
                    break
    
    print(f"DEBUG: generate_assignment_question_paper - assignment_id: {assignment_id}, paper_data keys: {list(paper_data.keys()) if paper_data else 'None'}")
    
    # Defaults
    semester = paper_data.get('semester', folder.term.session_term if folder.term else "")
    instructor = paper_data.get('instructor', folder.faculty.user.full_name if (folder.faculty and folder.faculty.user) else "")
    max_marks = paper_data.get('maxMarks', "10")
    due_date = paper_data.get('date', "")
    instructions = paper_data.get('instructions', "Please attempt all questions.")
    questions = paper_data.get('questions', [])
    
    # --- Header Content ---
    # Shift down to avoid overlapping with the section header
    y_cursor = height - 1.0 * inch
    
    # Logo
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
        
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica", 11)
    dept_name = folder.department.name if folder.department else "Department of Software Engineering"
    c.drawCentredString(width / 2, y_cursor, dept_name)
    y_cursor -= 0.2 * inch
    
    course_str = f"{folder.course.code if folder.course else ''} - {folder.course.title if folder.course else ''}"
    c.drawCentredString(width / 2, y_cursor, course_str)
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, assignment_name)
    y_cursor -= 0.4 * inch
    
    # --- Info Grid ---
    # Semester | Max Marks
    # Instructor | Due Date
    
    c.setStrokeColor(colors.lightgrey)
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.2 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Semester:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, semester)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Marks:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, str(max_marks))
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Instructor:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, instructor)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Due Date:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, due_date)
    y_cursor -= 0.2 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    # --- Instructions ---
    c.setFillColor(colors.whitesmoke)
    c.rect(0.5*inch, y_cursor - 0.8*inch, width-1.0*inch, 0.8*inch, fill=1, stroke=1)
    c.setFillColor(colors.black)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.6*inch, y_cursor - 0.2*inch, "Instructions:")
    
    # Handle HTML in instructions
    p = Paragraph(clean_html_for_pdf(instructions), styles['Normal'])
    w, h = p.wrap(width - 1.2*inch, 0.6*inch)
    p.drawOn(c, 0.6*inch, y_cursor - 0.2*inch - h - 0.1*inch)
    
    y_cursor -= 1.2 * inch
    
    # --- Questions ---
    if questions and len(questions) > 0:
        print(f"DEBUG: Generating PDF with {len(questions)} questions")
        for idx, q in enumerate(questions, 1):
            if y_cursor < 1.5 * inch:
                c.showPage()
                _draw_header(c, width, height, f"{assignment_name} Question Paper")
                y_cursor = height - 1.0 * inch
                
            # Question Header
            c.setFont("Helvetica-Bold", 11)
            c.drawString(0.5*inch, y_cursor, f"Question {idx}:")
            
            # Marks
            marks = q.get('marks', '')
            if marks:
                c.drawRightString(width - 0.5*inch, y_cursor, f"Marks: {marks}")
                
            y_cursor -= 0.2 * inch
            
            # Question Text (HTML)
            q_text = q.get('questionText', '') or ''
            if q_text.strip():
                p = Paragraph(clean_html_for_pdf(q_text), styles['Normal'])
                w, h = p.wrap(width - 1.0*inch, height) # Allow wrapping
                
                if y_cursor - h < 1.0 * inch:
                     c.showPage()
                     _draw_header(c, width, height, f"{assignment_name} Question Paper")
                     y_cursor = height - 1.0 * inch
                     p.drawOn(c, 0.5*inch, y_cursor - h)
                     y_cursor -= (h + 0.3 * inch)
                else:
                     p.drawOn(c, 0.5*inch, y_cursor - h)
                     y_cursor -= (h + 0.3 * inch)
            else:
                # Empty question text - just show placeholder
                c.setFont("Helvetica", 10)
                c.setFillColor(colors.grey)
                c.drawString(0.5*inch, y_cursor, "(No question text provided)")
                y_cursor -= 0.3 * inch
    else:
        print(f"DEBUG: No questions found in paper_data, generating PDF with headers only")
        # No questions - still generate a valid PDF with headers
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.grey)
        c.drawString(0.5*inch, y_cursor, "No questions have been added to this assignment yet.")
        y_cursor -= 0.3 * inch
        
    c.showPage()
    c.save()
    buffer.seek(0)
    pdf_bytes = buffer.read()
    print(f"DEBUG: Generated assignment question paper PDF: {len(pdf_bytes)} bytes")
    return pdf_bytes


def generate_assignment_model_solution(folder, assignment_id, assignment_name, sol_data=None):
    """Generate or Fetch the Assignment Model Solution PDF."""
    
    # 1. Check for uploaded PDF - use provided data or look it up
    if sol_data is None:
        outline_content = folder.outline_content or {}
        solutions = outline_content.get('assignmentSolutions', {})
        # Try multiple key formats
        sol_data = get_dict_value_safe(solutions, assignment_id, {})
        if not sol_data:
            # Try all keys to find a match
            for key in solutions.keys():
                if str(key).strip() == str(assignment_id).strip():
                    sol_data = solutions[key]
                    print(f"DEBUG: Found solution data using key: {key} (type: {type(key)})")
                    break
    
    print(f"DEBUG: generate_assignment_model_solution - assignment_id: {assignment_id}, sol_data keys: {list(sol_data.keys()) if sol_data else 'None'}")
    
    pdf_url = sol_data.get('model_solution_pdf')
    
    print(f"DEBUG: Checking Model Solution PDF for {assignment_name}. URL: {pdf_url}")
    
    if pdf_url:
        try:
            # Handle full URLs by extracting the path
            if pdf_url.startswith('http'):
                from urllib.parse import urlparse
                parsed = urlparse(pdf_url)
                pdf_url = parsed.path # e.g., /media/folder_components/file.pdf
            
            # Determine the relative path from MEDIA_ROOT
            # If MEDIA_URL is /media/, we need to strip it from the start
            media_url = settings.MEDIA_URL
            if not media_url.startswith('/'):
                media_url = '/' + media_url
                
            relative_path = pdf_url
            if relative_path.startswith(media_url):
                relative_path = relative_path[len(media_url):]
            elif relative_path.startswith('/media/'): # Fallback hardcoded check
                relative_path = relative_path[7:]
            
            # Construct the full path using MEDIA_ROOT
            final_path = os.path.join(settings.MEDIA_ROOT, relative_path)
            
            print(f"DEBUG: Resolving PDF path. MEDIA_ROOT: {settings.MEDIA_ROOT}, Relative: {relative_path}")
            print(f"DEBUG: Final path to check: {final_path}")
            
            if os.path.exists(final_path):
                with open(final_path, 'rb') as f:
                    pdf_bytes = f.read()
                    
                if pdf_bytes:
                    print(f"DEBUG: Successfully read {len(pdf_bytes)} bytes from {final_path}")
                    return add_header_to_pdf(pdf_bytes, f"{assignment_name} Model Solution")
            else:
                print(f"DEBUG: Model solution PDF file not found at {final_path}")
                
        except Exception as e:
            print(f"Error reading model solution PDF: {e}")

    # 2. Fallback: Generate PDF from Q&A data
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    # Draw Section Header
    _draw_header(c, width, height, f"{assignment_name} Model Solution")
    
    # Defaults
    semester = sol_data.get('semester', "")
    instructor = sol_data.get('instructor', "")
    max_marks = sol_data.get('maxMarks', "10")
    date = sol_data.get('date', "")
    answers = sol_data.get('answers', [])
    
    # --- Header Content ---
    y_cursor = height - 1.0 * inch
    
    # Logo
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
        
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica", 11)
    dept_name = folder.department.name if folder.department else "Department of Software Engineering"
    c.drawCentredString(width / 2, y_cursor, dept_name)
    y_cursor -= 0.2 * inch
    
    course_str = f"{folder.course.code if folder.course else ''} - {folder.course.title if folder.course else ''}"
    c.drawCentredString(width / 2, y_cursor, course_str)
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, "Solution")
    y_cursor -= 0.2 * inch
    c.drawCentredString(width / 2, y_cursor, "ASSIGNMENT")
    y_cursor -= 0.4 * inch
    
    # --- Info Grid ---
    c.setStrokeColor(colors.lightgrey)
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.2 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Semester:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, semester)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Marks:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, str(max_marks))
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Instructor:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, instructor)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Date:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, date)
    y_cursor -= 0.2 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    # --- Answers ---
    if answers and len(answers) > 0:
        print(f"DEBUG: Generating model solution PDF with {len(answers)} answers")
        for idx, ans in enumerate(answers, 1):
            if y_cursor < 2.0 * inch:
                c.showPage()
                _draw_header(c, width, height, f"{assignment_name} Model Solution")
                y_cursor = height - 1.0 * inch
                
            # Question Header
            c.setFont("Helvetica-Bold", 11)
            c.drawString(0.5*inch, y_cursor, f"Question {idx}:")
            
            marks = ans.get('marks', '')
            if marks:
                c.drawRightString(width - 0.5*inch, y_cursor, f"Marks: {marks}")
            y_cursor -= 0.2 * inch
            
            # Question Text
            q_text = ans.get('questionText', '') or ''
            if q_text.strip():
                c.setFont("Helvetica-Bold", 10)
                c.drawString(0.5*inch, y_cursor, "Question:")
                y_cursor -= 0.15 * inch
                
                p_q = Paragraph(clean_html_for_pdf(q_text), styles['Normal'])
                w, h = p_q.wrap(width - 1.0*inch, height)
                p_q.drawOn(c, 0.5*inch, y_cursor - h)
                y_cursor -= (h + 0.2 * inch)
                
            # Answer Text
            ans_text = ans.get('answerText', '') or ''
            if ans_text.strip():
                c.setFont("Helvetica-Bold", 10)
                c.drawString(0.5*inch, y_cursor, "Answer:")
                y_cursor -= 0.15 * inch
                
                p_a = Paragraph(clean_html_for_pdf(ans_text), styles['Normal'])
                w, h = p_a.wrap(width - 1.0*inch, height)
                p_a.drawOn(c, 0.5*inch, y_cursor - h)
                y_cursor -= (h + 0.3 * inch)
            else:
                # Empty answer - show placeholder
                c.setFont("Helvetica", 10)
                c.setFillColor(colors.grey)
                c.drawString(0.5*inch, y_cursor, "(No answer provided)")
                y_cursor -= 0.3 * inch
    else:
        print(f"DEBUG: No answers found in sol_data, generating PDF with headers only")
        # No answers - still generate a valid PDF with headers
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.grey)
        c.drawString(0.5*inch, y_cursor, "No answers have been added to this model solution yet.")
        y_cursor -= 0.3 * inch
            
    c.showPage()
    c.save()
    buffer.seek(0)
    pdf_bytes = buffer.read()
    print(f"DEBUG: Generated assignment model solution PDF: {len(pdf_bytes)} bytes")
    return pdf_bytes



def generate_quiz_section(folder):
    """
    Generate PDFs for all quizzes (Question Paper & Model Solution & Samples).
    """
    sections = []
    outline_content = folder.outline_content or {}
    quizzes = outline_content.get('quizzes', [])
    quiz_records = outline_content.get('quizRecords', {})
    quiz_papers = outline_content.get('quizPapers', {})
    quiz_solutions = outline_content.get('quizSolutions', {})
    
    print(f"DEBUG: ========== QUIZ SECTION ==========")
    print(f"DEBUG: Total quizzes found: {len(quizzes)}")
    print(f"DEBUG: Quiz IDs in array: {[q.get('id') for q in quizzes]}")
    print(f"DEBUG: Quiz names in array: {[q.get('name') for q in quizzes]}")
    print(f"DEBUG: Quiz paper keys: {list(quiz_papers.keys())}")
    print(f"DEBUG: Quiz solution keys: {list(quiz_solutions.keys())}")
    print(f"DEBUG: Quiz papers data preview: {[(k, list(v.keys()) if isinstance(v, dict) else type(v).__name__) for k, v in list(quiz_papers.items())[:3]]}")
    print(f"DEBUG: Quiz solutions data preview: {[(k, list(v.keys()) if isinstance(v, dict) else type(v).__name__) for k, v in list(quiz_solutions.items())[:3]]}")
    
    # Also try matching by index position - use dictionary keys in order
    # Get all keys and match by position
    paper_keys_list = list(quiz_papers.keys())
    solution_keys_list = list(quiz_solutions.keys())
    
    print(f"DEBUG: Quiz paper keys in order: {paper_keys_list}")
    print(f"DEBUG: Quiz solution keys in order: {solution_keys_list}")
    
    for idx, quiz in enumerate(quizzes):
        quiz_id = quiz.get('id')
        # Ensure ID is a string for consistent dictionary key matching
        quiz_id_original = quiz_id
        quiz_id = str(quiz_id) if quiz_id is not None else None
        quiz_name = quiz.get('name', f"Quiz {quiz_id}")
        
        print(f"DEBUG: Processing {quiz_name} (ID: {quiz_id}, type: {type(quiz_id)})")
        
        # Strategy 1: Try to match by ID (exact match)
        paper_key = None
        sol_key = None
        paper_data = {}
        sol_data = {}
        
        # Try exact ID match first
        if quiz_id and quiz_id in quiz_papers:
            paper_key = quiz_id
            paper_data = quiz_papers[quiz_id]
            print(f"DEBUG: Exact ID match for quiz paper: {quiz_id}")
        elif quiz_id_original and quiz_id_original in quiz_papers:
            paper_key = quiz_id_original
            paper_data = quiz_papers[quiz_id_original]
            print(f"DEBUG: Exact original ID match for quiz paper: {quiz_id_original}")
        
        if quiz_id and quiz_id in quiz_solutions:
            sol_key = quiz_id
            sol_data = quiz_solutions[quiz_id]
            print(f"DEBUG: Exact ID match for quiz solution: {quiz_id}")
        elif quiz_id_original and quiz_id_original in quiz_solutions:
            sol_key = quiz_id_original
            sol_data = quiz_solutions[quiz_id_original]
            print(f"DEBUG: Exact original ID match for quiz solution: {quiz_id_original}")
        
        # Strategy 2: If no exact match, try string comparison
        if not paper_key:
            for key in quiz_papers.keys():
                if str(key).strip() == str(quiz_id).strip() or str(key).strip() == str(quiz_id_original).strip():
                    paper_key = key
                    paper_data = quiz_papers[key]
                    print(f"DEBUG: String match for quiz paper: {key}")
                    break
        
        if not sol_key:
            for key in quiz_solutions.keys():
                if str(key).strip() == str(quiz_id).strip() or str(key).strip() == str(quiz_id_original).strip():
                    sol_key = key
                    sol_data = quiz_solutions[key]
                    print(f"DEBUG: String match for quiz solution: {key}")
                    break
        
        # Strategy 3: If still no match, use index-based (position in array = position in dict keys)
        if not paper_key and idx < len(paper_keys_list):
            paper_key = paper_keys_list[idx]
            paper_data = quiz_papers[paper_key]
            print(f"DEBUG: ✓ Using index-based match for quiz paper (idx={idx}): {paper_key}")
        elif not paper_key:
            print(f"DEBUG: ✗ No quiz paper key found! idx={idx}, paper_keys_list length={len(paper_keys_list)}")
            # Try to use ANY key if we have data but no match
            if paper_keys_list:
                paper_key = paper_keys_list[0] if idx == 0 else (paper_keys_list[idx] if idx < len(paper_keys_list) else paper_keys_list[-1])
                paper_data = quiz_papers[paper_key]
                print(f"DEBUG: Fallback: Using key {paper_key} for quiz paper")
        
        if not sol_key and idx < len(solution_keys_list):
            sol_key = solution_keys_list[idx]
            sol_data = quiz_solutions[sol_key]
            print(f"DEBUG: ✓ Using index-based match for quiz solution (idx={idx}): {sol_key}")
        elif not sol_key:
            print(f"DEBUG: ✗ No quiz solution key found! idx={idx}, solution_keys_list length={len(solution_keys_list)}")
            # Try to use ANY key if we have data but no match
            if solution_keys_list:
                sol_key = solution_keys_list[0] if idx == 0 else (solution_keys_list[idx] if idx < len(solution_keys_list) else solution_keys_list[-1])
                sol_data = quiz_solutions[sol_key]
                print(f"DEBUG: Fallback: Using key {sol_key} for quiz solution")
        
        # Use the found keys for generation
        effective_paper_key = paper_key if paper_key else quiz_id
        effective_sol_key = sol_key if sol_key else quiz_id
        
        print(f"DEBUG: Paper data found: {bool(paper_data)} (key: {effective_paper_key}), Solution data found: {bool(sol_data)} (key: {effective_sol_key})")
        if paper_data:
            print(f"DEBUG: Quiz paper data has keys: {list(paper_data.keys())}, questions: {len(paper_data.get('questions', []))}")
        if sol_data:
            print(f"DEBUG: Quiz solution data has keys: {list(sol_data.keys())}, answers: {len(sol_data.get('answers', []))}")
        print(f"DEBUG: All quiz paper keys: {list(quiz_papers.keys())}")
        print(f"DEBUG: All quiz solution keys: {list(quiz_solutions.keys())}")
        
        # 1. Question Paper - Always generate
        try:
            # Pass the actual data we found to avoid re-lookup issues
            qp_bytes = generate_quiz_question_paper(folder, effective_paper_key, quiz_name, paper_data=paper_data)
            
            # Accept any non-empty PDF bytes (even if small, it's valid)
            if qp_bytes and len(qp_bytes) > 0:
                sections.append((f"{quiz_name} Question Paper", qp_bytes))
                print(f"DEBUG: ✓ Added {quiz_name} Question Paper ({len(qp_bytes)} bytes) using key: {effective_paper_key}")
            else:
                print(f"DEBUG: ✗ {quiz_name} Question Paper returned empty/None bytes - generating placeholder")
                sections.append((f"{quiz_name} Question Paper", create_missing_page_placeholder(f"{quiz_name} Question Paper")))
        except Exception as e:
            print(f"ERROR generating Question Paper for {quiz_name}: {e}")
            import traceback
            traceback.print_exc()
            # Add placeholder even on error
            sections.append((f"{quiz_name} Question Paper", create_missing_page_placeholder(f"{quiz_name} Question Paper")))
            
        # 2. Model Solution - Always generate
        try:
            # Pass the actual data we found to avoid re-lookup issues
            ms_bytes = generate_quiz_model_solution(folder, effective_sol_key, quiz_name, sol_data=sol_data)
            
            # Accept any non-empty PDF bytes (even if small, it's valid)
            if ms_bytes and len(ms_bytes) > 0:
                sections.append((f"{quiz_name} Model Solution", ms_bytes))
                print(f"DEBUG: ✓ Added {quiz_name} Model Solution ({len(ms_bytes)} bytes) using key: {effective_sol_key}")
            else:
                print(f"DEBUG: ✗ {quiz_name} Model Solution returned empty/None bytes - generating placeholder")
                sections.append((f"{quiz_name} Model Solution", create_missing_page_placeholder(f"{quiz_name} Model Solution")))
        except Exception as e:
            print(f"ERROR generating Model Solution for {quiz_name}: {e}")
            import traceback
            traceback.print_exc()
            # Add placeholder even on error
            sections.append((f"{quiz_name} Model Solution", create_missing_page_placeholder(f"{quiz_name} Model Solution")))

        # 3. Student Samples (Best, Average, Worst)
        records = get_dict_value_safe(quiz_records, quiz_id, {})
        
        # Helper to process sample
        def process_sample(sample_key, title_suffix):
            sample_data = records.get(sample_key)
            if sample_data and sample_data.get('fileData'):
                try:
                    import base64
                    file_url = sample_data.get('fileData', '')
                    if file_url.startswith('data:application/pdf;base64,'):
                        base64_str = file_url.split(',')[1]
                        pdf_bytes = base64.b64decode(base64_str)
                        if pdf_bytes:
                            # Overlay Header
                            header_title = f"{quiz_name} {title_suffix}"
                            pdf_bytes = add_header_to_pdf(pdf_bytes, header_title)
                            sections.append((header_title, pdf_bytes))
                        else:
                            sections.append((f"{quiz_name} {title_suffix}", create_missing_page_placeholder(f"{quiz_name} {title_suffix}")))
                    else:
                        print(f"DEBUG: {quiz_name} {sample_key} fileData format not recognized")
                        sections.append((f"{quiz_name} {title_suffix}", create_missing_page_placeholder(f"{quiz_name} {title_suffix}")))
                except Exception as e:
                    print(f"Error processing {quiz_name} {sample_key}: {e}")
                    sections.append((f"{quiz_name} {title_suffix}", create_missing_page_placeholder(f"{quiz_name} {title_suffix}")))
            else:
                 sections.append((f"{quiz_name} {title_suffix}", create_missing_page_placeholder(f"{quiz_name} {title_suffix}")))

        process_sample('best', 'Best Sample')
        process_sample('average', 'Average Sample')
        process_sample('worst', 'Worst Sample')
            
    return sections


def generate_quiz_question_paper(folder, quiz_id, quiz_name, paper_data=None):
    """Generate the Quiz Question Paper PDF."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    # Draw Section Header
    _draw_header(c, width, height, f"{quiz_name} Question Paper")
    
    # Fetch Data - use provided data or look it up
    if paper_data is None:
        outline_content = folder.outline_content or {}
        papers = outline_content.get('quizPapers', {})
        # Try multiple key formats
        paper_data = get_dict_value_safe(papers, quiz_id, {})
        if not paper_data:
            # Try all keys to find a match
            for key in papers.keys():
                if str(key).strip() == str(quiz_id).strip():
                    paper_data = papers[key]
                    print(f"DEBUG: Found quiz paper data using key: {key} (type: {type(key)})")
                    break
    
    print(f"DEBUG: generate_quiz_question_paper - quiz_id: {quiz_id}, paper_data keys: {list(paper_data.keys()) if paper_data else 'None'}")
    
    # Defaults
    semester = paper_data.get('semester', folder.term.session_term if folder.term else "")
    instructor = paper_data.get('instructor', folder.faculty.user.full_name if (folder.faculty and folder.faculty.user) else "")
    max_marks = paper_data.get('maxMarks', "10")
    date = paper_data.get('date', "")
    max_time = paper_data.get('maxTime', "90 min")
    instructions = paper_data.get('instructions', "Please attempt all questions carefully.")
    questions = paper_data.get('questions', [])
    
    # --- Header Content ---
    y_cursor = height - 1.0 * inch
    
    # Logo
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
        
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica", 11)
    dept_name = folder.department.name if folder.department else "Department of Software Engineering"
    c.drawCentredString(width / 2, y_cursor, dept_name)
    y_cursor -= 0.2 * inch
    
    course_str = f"{folder.course.code if folder.course else ''} - {folder.course.title if folder.course else ''}"
    c.drawCentredString(width / 2, y_cursor, course_str)
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, quiz_name)
    y_cursor -= 0.4 * inch
    
    # --- Info Grid ---
    c.setStrokeColor(colors.lightgrey)
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.2 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Semester:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, semester)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Marks:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, str(max_marks))
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Instructor:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, instructor)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Time:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, max_time)
    y_cursor -= 0.25 * inch

    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Date:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, date)
    y_cursor -= 0.2 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    # --- Instructions ---
    c.setFillColor(colors.whitesmoke)
    c.rect(0.5*inch, y_cursor - 0.8*inch, width-1.0*inch, 0.8*inch, fill=1, stroke=1)
    c.setFillColor(colors.black)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.6*inch, y_cursor - 0.2*inch, "Instructions:")
    
    p = Paragraph(clean_html_for_pdf(instructions), styles['Normal'])
    w, h = p.wrap(width - 1.2*inch, 0.6*inch)
    p.drawOn(c, 0.6*inch, y_cursor - 0.2*inch - h - 0.1*inch)
    
    y_cursor -= 1.2 * inch
    
    # --- Questions ---
    if questions and len(questions) > 0:
        print(f"DEBUG: Generating quiz PDF with {len(questions)} questions")
        for idx, q in enumerate(questions, 1):
            if y_cursor < 1.5 * inch:
                c.showPage()
                _draw_header(c, width, height, f"{quiz_name} Question Paper")
                y_cursor = height - 1.0 * inch
                
            c.setFont("Helvetica-Bold", 11)
            c.drawString(0.5*inch, y_cursor, f"Question {idx}:")
            
            marks = q.get('marks', '')
            if marks:
                c.drawRightString(width - 0.5*inch, y_cursor, f"Marks: {marks}")
                
            y_cursor -= 0.2 * inch
            
            q_text = q.get('questionText', '') or ''
            if q_text.strip():
                p = Paragraph(clean_html_for_pdf(q_text), styles['Normal'])
                w, h = p.wrap(width - 1.0*inch, height)
                
                if y_cursor - h < 1.0 * inch:
                     c.showPage()
                     _draw_header(c, width, height, f"{quiz_name} Question Paper")
                     y_cursor = height - 1.0 * inch
                     p.drawOn(c, 0.5*inch, y_cursor - h)
                     y_cursor -= (h + 0.3 * inch)
                else:
                     p.drawOn(c, 0.5*inch, y_cursor - h)
                     y_cursor -= (h + 0.3 * inch)
            else:
                # Empty question text - just show placeholder
                c.setFont("Helvetica", 10)
                c.setFillColor(colors.grey)
                c.drawString(0.5*inch, y_cursor, "(No question text provided)")
                y_cursor -= 0.3 * inch
    else:
        print(f"DEBUG: No questions found in quiz paper_data, generating PDF with headers only")
        # No questions - still generate a valid PDF with headers
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.grey)
        c.drawString(0.5*inch, y_cursor, "No questions have been added to this quiz yet.")
        y_cursor -= 0.3 * inch
             
    c.showPage()
    c.save()
    buffer.seek(0)
    pdf_bytes = buffer.read()
    print(f"DEBUG: Generated quiz question paper PDF: {len(pdf_bytes)} bytes")
    return pdf_bytes


def generate_quiz_model_solution(folder, quiz_id, quiz_name, sol_data=None):
    """Generate or Fetch the Quiz Model Solution PDF."""
    
    # 1. Check for uploaded PDF - use provided data or look it up
    if sol_data is None:
        outline_content = folder.outline_content or {}
        solutions = outline_content.get('quizSolutions', {})
        # Try multiple key formats
        sol_data = get_dict_value_safe(solutions, quiz_id, {})
        if not sol_data:
            # Try all keys to find a match
            for key in solutions.keys():
                if str(key).strip() == str(quiz_id).strip():
                    sol_data = solutions[key]
                    print(f"DEBUG: Found quiz solution data using key: {key} (type: {type(key)})")
                    break
    
    print(f"DEBUG: generate_quiz_model_solution - quiz_id: {quiz_id}, sol_data keys: {list(sol_data.keys()) if sol_data else 'None'}")
    
    pdf_url = sol_data.get('model_solution_pdf')
    
    print(f"DEBUG: Checking Model Solution PDF for {quiz_name}. URL: {pdf_url}")
    
    if pdf_url:
        try:
            if pdf_url.startswith('http'):
                from urllib.parse import urlparse
                parsed = urlparse(pdf_url)
                pdf_url = parsed.path
            
            media_url = settings.MEDIA_URL
            if not media_url.startswith('/'):
                media_url = '/' + media_url
                
            relative_path = pdf_url
            if relative_path.startswith(media_url):
                relative_path = relative_path[len(media_url):]
            elif relative_path.startswith('/media/'):
                relative_path = relative_path[7:]
            
            final_path = os.path.join(settings.MEDIA_ROOT, relative_path)
            
            print(f"DEBUG: Resolving PDF path. MEDIA_ROOT: {settings.MEDIA_ROOT}, Relative: {relative_path}")
            print(f"DEBUG: Final path to check: {final_path}")
            
            if os.path.exists(final_path):
                with open(final_path, 'rb') as f:
                    pdf_bytes = f.read()
                    
                if pdf_bytes:
                    print(f"DEBUG: Successfully read {len(pdf_bytes)} bytes from {final_path}")
                    return add_header_to_pdf(pdf_bytes, f"{quiz_name} Model Solution")
            else:
                print(f"DEBUG: Model solution PDF file not found at {final_path}")
                
        except Exception as e:
            print(f"Error reading model solution PDF: {e}")

    # 2. Fallback: Generate PDF from Q&A data
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    _draw_header(c, width, height, f"{quiz_name} Model Solution")
    
    semester = sol_data.get('semester', "")
    instructor = sol_data.get('instructor', "")
    max_marks = sol_data.get('maxMarks', "10")
    date = sol_data.get('date', "")
    answers = sol_data.get('answers', [])
    
    y_cursor = height - 1.0 * inch
    
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
        
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica", 11)
    dept_name = folder.department.name if folder.department else "Department of Software Engineering"
    c.drawCentredString(width / 2, y_cursor, dept_name)
    y_cursor -= 0.2 * inch
    
    course_str = f"{folder.course.code if folder.course else ''} - {folder.course.title if folder.course else ''}"
    c.drawCentredString(width / 2, y_cursor, course_str)
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, "Solution")
    y_cursor -= 0.2 * inch
    c.drawCentredString(width / 2, y_cursor, "QUIZ")
    y_cursor -= 0.4 * inch
    
    c.setStrokeColor(colors.lightgrey)
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.2 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Semester:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, semester)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Marks:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, str(max_marks))
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Instructor:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, instructor)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Date:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, date)
    y_cursor -= 0.2 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    # --- Answers ---
    if answers and len(answers) > 0:
        print(f"DEBUG: Generating quiz model solution PDF with {len(answers)} answers")
        for idx, ans in enumerate(answers, 1):
            if y_cursor < 2.0 * inch:
                c.showPage()
                _draw_header(c, width, height, f"{quiz_name} Model Solution")
                y_cursor = height - 1.0 * inch
                
            c.setFont("Helvetica-Bold", 11)
            c.drawString(0.5*inch, y_cursor, f"Question {idx}:")
            
            marks = ans.get('marks', '')
            if marks:
                c.drawRightString(width - 0.5*inch, y_cursor, f"Marks: {marks}")
            y_cursor -= 0.2 * inch
            
            q_text = ans.get('questionText', '') or ''
            if q_text.strip():
                c.setFont("Helvetica-Bold", 10)
                c.drawString(0.5*inch, y_cursor, "Question:")
                y_cursor -= 0.15 * inch
                
                p_q = Paragraph(clean_html_for_pdf(q_text), styles['Normal'])
                w, h = p_q.wrap(width - 1.0*inch, height)
                p_q.drawOn(c, 0.5*inch, y_cursor - h)
                y_cursor -= (h + 0.2 * inch)
                
            ans_text = ans.get('answerText', '') or ''
            if ans_text.strip():
                c.setFont("Helvetica-Bold", 10)
                c.drawString(0.5*inch, y_cursor, "Answer:")
                y_cursor -= 0.15 * inch
                
                p_a = Paragraph(clean_html_for_pdf(ans_text), styles['Normal'])
                w, h = p_a.wrap(width - 1.0*inch, height)
                p_a.drawOn(c, 0.5*inch, y_cursor - h)
                y_cursor -= (h + 0.3 * inch)
            else:
                # Empty answer - show placeholder
                c.setFont("Helvetica", 10)
                c.setFillColor(colors.grey)
                c.drawString(0.5*inch, y_cursor, "(No answer provided)")
                y_cursor -= 0.3 * inch
    else:
        print(f"DEBUG: No answers found in quiz sol_data, generating PDF with headers only")
        # No answers - still generate a valid PDF with headers
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.grey)
        c.drawString(0.5*inch, y_cursor, "No answers have been added to this model solution yet.")
        y_cursor -= 0.3 * inch
            
    c.showPage()
    c.save()
    buffer.seek(0)
    pdf_bytes = buffer.read()
    print(f"DEBUG: Generated quiz model solution PDF: {len(pdf_bytes)} bytes")
    return pdf_bytes



def generate_midterm_section(folder):
    """
    Generate PDFs for Midterm (Question Paper & Model Solution & Samples).
    """
    sections = []
    outline_content = folder.outline_content or {}
    midterm_records = outline_content.get('midtermRecords', {})
    
    # 1. Question Paper
    try:
        qp_bytes = generate_midterm_question_paper(folder)
        if qp_bytes:
            sections.append(("Midterm Question Paper", qp_bytes))
    except Exception as e:
        print(f"Error generating Midterm Question Paper: {e}")
        
    # 2. Model Solution
    try:
        ms_bytes = generate_midterm_model_solution(folder)
        if ms_bytes:
            sections.append(("Midterm Model Solution", ms_bytes))
    except Exception as e:
        print(f"Error generating Midterm Model Solution: {e}")

    # 3. Student Samples (Best, Average, Worst)
    # Helper to process sample
    def process_sample(sample_key, title_suffix):
        sample_data = midterm_records.get(sample_key)
        
        print(f"DEBUG: Processing Midterm {sample_key}. Data type: {type(sample_data)}")
        
        # Check if sample_data is a dictionary (new format) or just the fileData string (old format/direct)
        file_data_str = ""
        
        if isinstance(sample_data, dict):
            # Check for nested fileData (e.g. sample_data['fileData'] might be a dict or string)
            # Based on logs: DEBUG: Midterm best is dict. fileData length: 0
            # This suggests sample_data is a dict but sample_data['fileData'] is empty or missing.
            # However, the frontend sends: midtermRecords.best = { fileName, uploadDate, fileSize, fileData }
            # Let's try to access it directly.
            file_data_str = sample_data.get('fileData', '')
            
            # If empty, check if it's nested under another key or if we need to look deeper
            if not file_data_str and 'fileData' in sample_data:
                 print(f"DEBUG: Midterm {sample_key} has 'fileData' key but it evaluates to empty string.")
                 
            print(f"DEBUG: Midterm {sample_key} is dict. Keys: {list(sample_data.keys())}. fileData length: {len(file_data_str)}")
        elif isinstance(sample_data, str):
             file_data_str = sample_data
             print(f"DEBUG: Midterm {sample_key} is string. Length: {len(file_data_str)}")
        else:
             print(f"DEBUG: Midterm {sample_key} data is None or unknown type")

        if file_data_str:
            try:
                import base64
                if file_data_str.startswith('data:application/pdf;base64,'):
                    base64_str = file_data_str.split(',')[1]
                    pdf_bytes = base64.b64decode(base64_str)
                    if pdf_bytes:
                        # Overlay Header
                        header_title = f"Midterm {title_suffix}"
                        pdf_bytes = add_header_to_pdf(pdf_bytes, header_title)
                        sections.append((header_title, pdf_bytes))
                        print(f"DEBUG: Successfully added Midterm {sample_key}")
                    else:
                        sections.append((f"Midterm {title_suffix}", create_missing_page_placeholder(f"Midterm {title_suffix}")))
                else:
                    print(f"DEBUG: Midterm {sample_key} fileData format not recognized (doesn't start with data:application/pdf;base64,)")
                    sections.append((f"Midterm {title_suffix}", create_missing_page_placeholder(f"Midterm {title_suffix}")))
            except Exception as e:
                print(f"Error processing Midterm {sample_key}: {e}")
                sections.append((f"Midterm {title_suffix}", create_missing_page_placeholder(f"Midterm {title_suffix}")))
        else:
            print(f"DEBUG: No file data found for Midterm {sample_key}")
            sections.append((f"Midterm {title_suffix}", create_missing_page_placeholder(f"Midterm {title_suffix}")))

    process_sample('best', 'Best Sample')
    process_sample('average', 'Average Sample')
    process_sample('worst', 'Worst Sample')
            
    return sections


def generate_midterm_question_paper(folder):
    """Generate the Midterm Question Paper PDF."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    _draw_header(c, width, height, "Midterm Question Paper")
    
    outline_content = folder.outline_content or {}
    paper_data = outline_content.get('midtermPaper', {})
    
    semester = paper_data.get('semester', folder.term.session_term if folder.term else "")
    instructor = paper_data.get('instructor', folder.faculty.user.full_name if (folder.faculty and folder.faculty.user) else "")
    max_marks = paper_data.get('maxMarks', "50")
    date = paper_data.get('date', "")
    duration = paper_data.get('duration', "3 Hours")
    instructions = paper_data.get('instructions', "Attempt all questions.")
    questions = paper_data.get('questions', [])
    
    y_cursor = height - 1.0 * inch
    
    # Logo
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
        
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica", 11)
    dept_name = folder.department.name if folder.department else "Department of Software Engineering"
    c.drawCentredString(width / 2, y_cursor, dept_name)
    y_cursor -= 0.2 * inch
    
    course_str = f"{folder.course.code if folder.course else ''} - {folder.course.title if folder.course else ''}"
    c.drawCentredString(width / 2, y_cursor, course_str)
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, f"MIDTERM {semester}")
    y_cursor -= 0.2 * inch
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, y_cursor, "Mid Term Exam")
    y_cursor -= 0.4 * inch
    
    c.setStrokeColor(colors.lightgrey)
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.2 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Semester:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, semester)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Marks:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, str(max_marks))
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Date:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, date)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Time:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, duration)
    y_cursor -= 0.25 * inch

    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Instructor:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, instructor)
    y_cursor -= 0.2 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    # Instructions
    c.setFillColor(colors.whitesmoke)
    c.rect(0.5*inch, y_cursor - 0.8*inch, width-1.0*inch, 0.8*inch, fill=1, stroke=1)
    c.setFillColor(colors.black)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.6*inch, y_cursor - 0.2*inch, "Instructions:")
    
    p = Paragraph(clean_html_for_pdf(instructions), styles['Normal'])
    w, h = p.wrap(width - 1.2*inch, 0.6*inch)
    p.drawOn(c, 0.6*inch, y_cursor - 0.2*inch - h - 0.1*inch)
    
    y_cursor -= 1.2 * inch
    
    # Student Info Grid
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Name:")
    c.line(1.2*inch, y_cursor, 3.5*inch, y_cursor)
    
    c.drawString(4.0*inch, y_cursor, "Reg No.")
    c.line(4.8*inch, y_cursor, 7.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    # Questions
    for idx, q in enumerate(questions, 1):
        if y_cursor < 1.5 * inch:
            c.showPage()
            _draw_header(c, width, height, "Midterm Question Paper")
            y_cursor = height - 1.0 * inch
            
        c.setFont("Helvetica-Bold", 11)
        c.drawString(0.5*inch, y_cursor, f"Question {idx}:")
        
        # CLO and Marks
        clo = q.get('clo', '')
        marks = q.get('marks', '')
        meta_text = []
        if clo: meta_text.append(f"CLO: {clo}")
        if marks: meta_text.append(f"Marks: {marks}")
        
        if meta_text:
            c.drawRightString(width - 0.5*inch, y_cursor, " | ".join(meta_text))
            
        y_cursor -= 0.2 * inch
        
        q_text = q.get('questionText', '')
        p = Paragraph(clean_html_for_pdf(q_text), styles['Normal'])
        w, h = p.wrap(width - 1.0*inch, height)
        
        if y_cursor - h < 1.0 * inch:
             c.showPage()
             _draw_header(c, width, height, "Midterm Question Paper")
             y_cursor = height - 1.0 * inch
             p.drawOn(c, 0.5*inch, y_cursor - h)
             y_cursor -= (h + 0.3 * inch)
        else:
             p.drawOn(c, 0.5*inch, y_cursor - h)
             y_cursor -= (h + 0.3 * inch)
             
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()


def generate_midterm_model_solution(folder):
    """Generate or Fetch the Midterm Model Solution PDF."""
    
    outline_content = folder.outline_content or {}
    sol_data = outline_content.get('midtermSolution', {})
    
    # 1. Check for uploaded PDF
    pdf_url = sol_data.get('model_solution_pdf')
    
    if pdf_url:
        try:
            if pdf_url.startswith('http'):
                from urllib.parse import urlparse
                parsed = urlparse(pdf_url)
                pdf_url = parsed.path
            
            media_url = settings.MEDIA_URL
            if not media_url.startswith('/'):
                media_url = '/' + media_url
                
            relative_path = pdf_url
            if relative_path.startswith(media_url):
                relative_path = relative_path[len(media_url):]
            elif relative_path.startswith('/media/'):
                relative_path = relative_path[7:]
            
            final_path = os.path.join(settings.MEDIA_ROOT, relative_path)
            
            if os.path.exists(final_path):
                with open(final_path, 'rb') as f:
                    pdf_bytes = f.read()
                if pdf_bytes:
                    return add_header_to_pdf(pdf_bytes, "Midterm Model Solution")
        except Exception as e:
            print(f"Error reading Midterm model solution PDF: {e}")

    # 2. Fallback: Generate PDF
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    _draw_header(c, width, height, "Midterm Model Solution")
    
    semester = sol_data.get('semester', "")
    instructor = sol_data.get('instructor', "")
    max_marks = sol_data.get('maxMarks', "50")
    date = sol_data.get('date', "")
    answers = sol_data.get('answers', [])
    
    y_cursor = height - 1.0 * inch
    
    # Logo
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
        
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica", 11)
    dept_name = folder.department.name if folder.department else "Department of Software Engineering"
    c.drawCentredString(width / 2, y_cursor, dept_name)
    y_cursor -= 0.2 * inch
    
    course_str = f"{folder.course.code if folder.course else ''} - {folder.course.title if folder.course else ''}"
    c.drawCentredString(width / 2, y_cursor, course_str)
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, "Solution")
    y_cursor -= 0.2 * inch
    c.drawCentredString(width / 2, y_cursor, "MIDTERM")
    y_cursor -= 0.4 * inch
    
    c.setStrokeColor(colors.lightgrey)
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.2 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Semester:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, semester)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Marks:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, str(max_marks))
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Instructor:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, instructor)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Date:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, date)
    y_cursor -= 0.2 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    for idx, ans in enumerate(answers, 1):
        if y_cursor < 2.0 * inch:
            c.showPage()
            _draw_header(c, width, height, "Midterm Model Solution")
            y_cursor = height - 1.0 * inch
            
        c.setFont("Helvetica-Bold", 11)
        c.drawString(0.5*inch, y_cursor, f"Question {idx}:")
        
        marks = ans.get('marks', '')
        if marks:
            c.drawRightString(width - 0.5*inch, y_cursor, f"Marks: {marks}")
        y_cursor -= 0.2 * inch
        
        q_text = ans.get('questionText', '')
        if q_text:
            c.setFont("Helvetica-Bold", 10)
            c.drawString(0.5*inch, y_cursor, "Question:")
            y_cursor -= 0.15 * inch
            
            p_q = Paragraph(clean_html_for_pdf(q_text), styles['Normal'])
            w, h = p_q.wrap(width - 1.0*inch, height)
            p_q.drawOn(c, 0.5*inch, y_cursor - h)
            y_cursor -= (h + 0.2 * inch)
            
        ans_text = ans.get('answerText', '')
        if ans_text:
            c.setFont("Helvetica-Bold", 10)
            c.drawString(0.5*inch, y_cursor, "Answer:")
            y_cursor -= 0.15 * inch
            
            p_a = Paragraph(clean_html_for_pdf(ans_text), styles['Normal'])
            w, h = p_a.wrap(width - 1.0*inch, height)
            p_a.drawOn(c, 0.5*inch, y_cursor - h)
            y_cursor -= (h + 0.3 * inch)
            
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()


def generate_final_section(folder):
    """
    Generate PDFs for Final (Question Paper & Model Solution & Samples).
    """
    sections = []
    outline_content = folder.outline_content or {}
    final_records = outline_content.get('finalRecords', {})
    
    # 1. Question Paper
    try:
        qp_bytes = generate_final_question_paper(folder)
        if qp_bytes:
            sections.append(("Final Question Paper", qp_bytes))
    except Exception as e:
        print(f"Error generating Final Question Paper: {e}")
        
    # 2. Model Solution
    try:
        ms_bytes = generate_final_model_solution(folder)
        if ms_bytes:
            sections.append(("Final Model Solution", ms_bytes))
    except Exception as e:
        print(f"Error generating Final Model Solution: {e}")

    # 3. Student Samples (Best, Average, Worst)
    # 3. Student Samples (Best, Average, Worst)
    # Helper to process sample
    def process_sample(sample_key, title_suffix):
        sample_data = final_records.get(sample_key)
        
        print(f"DEBUG: Processing Final {sample_key}. Data type: {type(sample_data)}")

        # Check if sample_data is a dictionary (new format) or just the fileData string (old format/direct)
        file_data_str = ""
        
        if isinstance(sample_data, dict):
            file_data_str = sample_data.get('fileData', '')
            # If empty, check if it's nested under another key or if we need to look deeper
            if not file_data_str and 'fileData' in sample_data:
                 print(f"DEBUG: Final {sample_key} has 'fileData' key but it evaluates to empty string.")
            print(f"DEBUG: Final {sample_key} is dict. Keys: {list(sample_data.keys())}. fileData length: {len(file_data_str)}")
        elif isinstance(sample_data, str):
             file_data_str = sample_data
             print(f"DEBUG: Final {sample_key} is string. Length: {len(file_data_str)}")
        else:
             print(f"DEBUG: Final {sample_key} data is None or unknown type")
             
        if file_data_str:
            try:
                import base64
                if file_data_str.startswith('data:application/pdf;base64,'):
                    base64_str = file_data_str.split(',')[1]
                    pdf_bytes = base64.b64decode(base64_str)
                    if pdf_bytes:
                        # Overlay Header
                        header_title = f"Final {title_suffix}"
                        pdf_bytes = add_header_to_pdf(pdf_bytes, header_title)
                        sections.append((header_title, pdf_bytes))
                        print(f"DEBUG: Successfully added Final {sample_key}")
                    else:
                        sections.append((f"Final {title_suffix}", create_missing_page_placeholder(f"Final {title_suffix}")))
                else:
                    print(f"DEBUG: Final {sample_key} fileData format not recognized (doesn't start with data:application/pdf;base64,)")
                    sections.append((f"Final {title_suffix}", create_missing_page_placeholder(f"Final {title_suffix}")))
            except Exception as e:
                print(f"Error processing Final {sample_key}: {e}")
                sections.append((f"Final {title_suffix}", create_missing_page_placeholder(f"Final {title_suffix}")))
        else:
            print(f"DEBUG: No file data found for Final {sample_key}")
            sections.append((f"Final {title_suffix}", create_missing_page_placeholder(f"Final {title_suffix}")))

    process_sample('best', 'Best Sample')
    process_sample('average', 'Average Sample')
    process_sample('worst', 'Worst Sample')
            
    return sections


def generate_final_question_paper(folder):
    """Generate the Final Question Paper PDF."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    _draw_header(c, width, height, "Final Question Paper")
    
    outline_content = folder.outline_content or {}
    paper_data = outline_content.get('finalPaper', {})
    
    semester = paper_data.get('semester', folder.term.session_term if folder.term else "")
    instructor = paper_data.get('instructor', folder.faculty.user.full_name if (folder.faculty and folder.faculty.user) else "")
    max_marks = paper_data.get('maxMarks', "100")
    date = paper_data.get('date', "")
    duration = paper_data.get('duration', "3 Hours")
    instructions = paper_data.get('instructions', "Attempt all questions.")
    questions = paper_data.get('questions', [])
    
    y_cursor = height - 1.0 * inch
    
    # Logo
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
        
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica", 11)
    dept_name = folder.department.name if folder.department else "Department of Software Engineering"
    c.drawCentredString(width / 2, y_cursor, dept_name)
    y_cursor -= 0.2 * inch
    
    course_str = f"{folder.course.code if folder.course else ''} - {folder.course.title if folder.course else ''}"
    c.drawCentredString(width / 2, y_cursor, course_str)
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, f"FINAL {semester}")
    y_cursor -= 0.2 * inch
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, y_cursor, "Final Exam")
    y_cursor -= 0.4 * inch
    
    c.setStrokeColor(colors.lightgrey)
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.2 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Semester:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, semester)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Marks:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, str(max_marks))
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Date:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, date)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Time:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, duration)
    y_cursor -= 0.25 * inch

    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Instructor:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, instructor)
    y_cursor -= 0.2 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    # Instructions
    c.setFillColor(colors.whitesmoke)
    c.rect(0.5*inch, y_cursor - 0.8*inch, width-1.0*inch, 0.8*inch, fill=1, stroke=1)
    c.setFillColor(colors.black)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.6*inch, y_cursor - 0.2*inch, "Instructions:")
    
    p = Paragraph(clean_html_for_pdf(instructions), styles['Normal'])
    w, h = p.wrap(width - 1.2*inch, 0.6*inch)
    p.drawOn(c, 0.6*inch, y_cursor - 0.2*inch - h - 0.1*inch)
    
    y_cursor -= 1.2 * inch
    
    # Student Info Grid
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Name:")
    c.line(1.2*inch, y_cursor, 3.5*inch, y_cursor)
    
    c.drawString(4.0*inch, y_cursor, "Reg No.")
    c.line(4.8*inch, y_cursor, 7.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    # Questions
    for idx, q in enumerate(questions, 1):
        if y_cursor < 1.5 * inch:
            c.showPage()
            _draw_header(c, width, height, "Final Question Paper")
            y_cursor = height - 1.0 * inch
            
        c.setFont("Helvetica-Bold", 11)
        c.drawString(0.5*inch, y_cursor, f"Question {idx}:")
        
        # CLO and Marks
        clo = q.get('clo', '')
        marks = q.get('marks', '')
        meta_text = []
        if clo: meta_text.append(f"CLO: {clo}")
        if marks: meta_text.append(f"Marks: {marks}")
        
        if meta_text:
            c.drawRightString(width - 0.5*inch, y_cursor, " | ".join(meta_text))
            
        y_cursor -= 0.2 * inch
        
        q_text = q.get('questionText', '')
        p = Paragraph(clean_html_for_pdf(q_text), styles['Normal'])
        w, h = p.wrap(width - 1.0*inch, height)
        
        if y_cursor - h < 1.0 * inch:
             c.showPage()
             _draw_header(c, width, height, "Final Question Paper")
             y_cursor = height - 1.0 * inch
             p.drawOn(c, 0.5*inch, y_cursor - h)
             y_cursor -= (h + 0.3 * inch)
        else:
             p.drawOn(c, 0.5*inch, y_cursor - h)
             y_cursor -= (h + 0.3 * inch)
             
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()


def generate_final_model_solution(folder):
    """Generate or Fetch the Final Model Solution PDF."""
    
    outline_content = folder.outline_content or {}
    sol_data = outline_content.get('finalSolution', {})
    
    # 1. Check for uploaded PDF
    pdf_url = sol_data.get('model_solution_pdf')
    
    if pdf_url:
        try:
            if pdf_url.startswith('http'):
                from urllib.parse import urlparse
                parsed = urlparse(pdf_url)
                pdf_url = parsed.path
            
            media_url = settings.MEDIA_URL
            if not media_url.startswith('/'):
                media_url = '/' + media_url
                
            relative_path = pdf_url
            if relative_path.startswith(media_url):
                relative_path = relative_path[len(media_url):]
            elif relative_path.startswith('/media/'):
                relative_path = relative_path[7:]
            
            final_path = os.path.join(settings.MEDIA_ROOT, relative_path)
            
            if os.path.exists(final_path):
                with open(final_path, 'rb') as f:
                    pdf_bytes = f.read()
                if pdf_bytes:
                    return add_header_to_pdf(pdf_bytes, "Final Model Solution")
        except Exception as e:
            print(f"Error reading Final model solution PDF: {e}")

    # 2. Fallback: Generate PDF
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    _draw_header(c, width, height, "Final Model Solution")
    
    semester = sol_data.get('semester', "")
    instructor = sol_data.get('instructor', "")
    max_marks = sol_data.get('maxMarks', "100")
    date = sol_data.get('date', "")
    answers = sol_data.get('answers', [])
    
    y_cursor = height - 1.0 * inch
    
    # Logo
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
        
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica", 11)
    dept_name = folder.department.name if folder.department else "Department of Software Engineering"
    c.drawCentredString(width / 2, y_cursor, dept_name)
    y_cursor -= 0.2 * inch
    
    course_str = f"{folder.course.code if folder.course else ''} - {folder.course.title if folder.course else ''}"
    c.drawCentredString(width / 2, y_cursor, course_str)
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, "Solution")
    y_cursor -= 0.2 * inch
    c.drawCentredString(width / 2, y_cursor, "FINAL")
    y_cursor -= 0.4 * inch
    
    c.setStrokeColor(colors.lightgrey)
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.2 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Semester:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, semester)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Max Marks:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, str(max_marks))
    y_cursor -= 0.25 * inch
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.5*inch, y_cursor, "Instructor:")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*inch, y_cursor, instructor)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(4.0*inch, y_cursor, "Date:")
    c.setFont("Helvetica", 10)
    c.drawString(5.0*inch, y_cursor, date)
    y_cursor -= 0.2 * inch
    
    c.line(0.5*inch, y_cursor, width-0.5*inch, y_cursor)
    y_cursor -= 0.4 * inch
    
    for idx, ans in enumerate(answers, 1):
        if y_cursor < 2.0 * inch:
            c.showPage()
            _draw_header(c, width, height, "Final Model Solution")
            y_cursor = height - 1.0 * inch
            
        c.setFont("Helvetica-Bold", 11)
        c.drawString(0.5*inch, y_cursor, f"Question {idx}:")
        
        marks = ans.get('marks', '')
        if marks:
            c.drawRightString(width - 0.5*inch, y_cursor, f"Marks: {marks}")
        y_cursor -= 0.2 * inch
        
        q_text = ans.get('questionText', '')
        if q_text:
            c.setFont("Helvetica-Bold", 10)
            c.drawString(0.5*inch, y_cursor, "Question:")
            y_cursor -= 0.15 * inch
            
            p_q = Paragraph(clean_html_for_pdf(q_text), styles['Normal'])
            w, h = p_q.wrap(width - 1.0*inch, height)
            p_q.drawOn(c, 0.5*inch, y_cursor - h)
            y_cursor -= (h + 0.2 * inch)
            
        ans_text = ans.get('answerText', '')
        if ans_text:
            c.setFont("Helvetica-Bold", 10)
            c.drawString(0.5*inch, y_cursor, "Answer:")
            y_cursor -= 0.15 * inch
            
            p_a = Paragraph(clean_html_for_pdf(ans_text), styles['Normal'])
            w, h = p_a.wrap(width - 1.0*inch, height)
            p_a.drawOn(c, 0.5*inch, y_cursor - h)
            y_cursor -= (h + 0.3 * inch)
            
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()

    """
    Overlays a standard header onto the first page of the provided PDF.
    Dynamically adjusts to the page size of the source PDF.
    """
    try:
        original_reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()
        
        if len(original_reader.pages) > 0:
            first_page = original_reader.pages[0]
            
            # Get dimensions of the first page
            # Try to get width/height from mediabox
            try:
                mb = first_page.mediabox
                page_width = float(mb.width)
                page_height = float(mb.height)
            except Exception:
                # Fallback to A4 if dimensions can't be read
                page_width, page_height = A4
            
            print(f"DEBUG: Adding header '{title}' to page with dimensions: {page_width}x{page_height}")

            # Generate Header PDF with matching dimensions
            header_buffer = io.BytesIO()
            c = pdf_canvas.Canvas(header_buffer, pagesize=(page_width, page_height))
            
            # Draw header at the top
            _draw_header(c, page_width, page_height, title)
            c.showPage()
            c.save()
            header_buffer.seek(0)
            
            header_reader = PdfReader(header_buffer)
            header_page = header_reader.pages[0]
            
            # Merge header INTO the first page (overlay)
            first_page.merge_page(header_page)
            writer.add_page(first_page)
            
            # Add remaining pages
            for i in range(1, len(original_reader.pages)):
                writer.add_page(original_reader.pages[i])
                
            output_buffer = io.BytesIO()
            writer.write(output_buffer)
            output_buffer.seek(0)
            print(f"DEBUG: Successfully added header '{title}'")
            return output_buffer.read()
            
        return pdf_bytes
        
    except Exception as e:
        print(f"Error adding header to PDF: {e}")
        return pdf_bytes # Return original if failure


def create_section_header_page(title):
    """Generate a simple PDF page with a centered section title."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Draw Border
    c.setStrokeColor(colors.lightgrey)
    c.rect(0.5*inch, 0.5*inch, width-1*inch, height-1*inch)
    
    # Draw Title
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width / 2, height / 2, title)
    
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()


def _draw_header(c, width, height, title):
    """Draws the standard header for each page."""
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(colors.navy)
    c.drawString(0.5 * inch, height - 0.5 * inch, title)
    c.setFillColor(colors.black)


def _get_logo_image(width=1*inch, height=1*inch):
    """Returns a ReportLab Image object for the logo if it exists."""
    if os.path.exists(LOGO_PATH):
        return ReportLabImage(LOGO_PATH, width=width, height=height)
    return None


def generate_title_page(folder):
    """Generate the Title Page PDF."""
    try:
        buffer = io.BytesIO()
        c = pdf_canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Header
        _draw_header(c, width, height, "Title Page")
        
        # Main Content Area (Box)
        box_top = height - 1.0 * inch
        box_bottom = 1.0 * inch
        box_left = 0.5 * inch
        box_right = width - 0.5 * inch
        box_width = box_right - box_left
        
        # Draw Border
        c.setStrokeColor(colors.lightgrey)
        c.rect(box_left, box_bottom, box_width, box_top - box_bottom)
        
        # Content inside the box
        y_cursor = box_top - 0.5 * inch
        
        # Top Section: Course File Info & Logo
        # Left side text
        c.setFont("Helvetica-Bold", 12)
        
        # Safe access for program name
        program_name = 'N/A'
        try:
            if folder.program:
                program_name = folder.program.title
        except Exception:
            program_name = "Error loading Program"
        
        c.drawString(box_left + 0.2 * inch, y_cursor, f"COURSE FILE: {program_name}")
        y_cursor -= 0.2 * inch
        c.setFont("Helvetica", 10)
        c.drawString(box_left + 0.2 * inch, y_cursor, "Capital University of Science & Technology, Islamabad")
        
        # Right side Logo
        try:
            logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
            if logo:
                logo.drawOn(c, box_right - 1.2 * inch, y_cursor - 0.2 * inch)
        except Exception as e:
            print(f"Error drawing logo: {e}")
        
        y_cursor -= 1.0 * inch
        
        # Safe access for other fields
        course_title = "N/A"
        course_code = "N/A"
        try:
            if folder.course:
                course_title = folder.course.title or "N/A"
                course_code = folder.course.code or "N/A"
        except Exception:
            pass

        section = "N/A"
        try:
            section = folder.section or "N/A"
        except Exception:
            pass
        
        instructor_name = "N/A"
        try:
            if folder.faculty and folder.faculty.user:
                instructor_name = folder.faculty.user.full_name
        except Exception:
            pass
            
        semester = "N/A"
        try:
            if folder.term:
                semester = folder.term.session_term
        except Exception:
            pass
        
        # Table
        table_data = [
            ["Course Title", str(course_title)],
            ["Course Code", str(course_code)],
            ["Section", str(section)],
            ["Instructor", str(instructor_name)],
            ["Semester", str(semester)],
        ]
        
        t = Table(table_data, colWidths=[2.0 * inch, 4.5 * inch])
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('PADDING', (0, 0), (-1, -1), 12),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        # Center the table
        t.wrapOn(c, box_width, height)
        t.drawOn(c, box_left + (box_width - 6.5 * inch) / 2, y_cursor - 3.0 * inch)
        
        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer.read()
        
    except Exception as e:
        print(f"Error generating title page: {e}")
        return b""

def generate_course_outline_page(folder):
    """Generate the Course Outline PDF."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    normal_style = styles['Normal']
    
    # Constants for layout
    box_top = height - 1.0 * inch
    box_bottom = 0.5 * inch
    box_left = 0.5 * inch
    box_right = width - 0.5 * inch
    box_width = box_right - box_left
    
    def start_new_page():
        c.showPage()
        _draw_header(c, width, height, "Course Outline")
        c.setStrokeColor(colors.lightgrey)
        c.rect(box_left, box_bottom, box_width, box_top - box_bottom)
        return box_top - 0.5 * inch

    # Initial Page Setup
    _draw_header(c, width, height, "Course Outline")
    c.setStrokeColor(colors.lightgrey)
    c.rect(box_left, box_bottom, box_width, box_top - box_bottom)
    y_cursor = box_top - 0.3 * inch
    
    # --- Header Section (Logo + University Name) ---
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo_x = (width - 0.8*inch) / 2
        logo.drawOn(c, logo_x, y_cursor - 0.8*inch)
        y_cursor -= 1.0 * inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y_cursor, "Capital University of Science & Technology, Islamabad")
    y_cursor -= 0.2 * inch
    c.setFont("Helvetica", 10)
    dept_name = folder.department.name if folder.department else "Department"
    c.drawCentredString(width / 2, y_cursor, f"Department of {dept_name}")
    y_cursor -= 0.5 * inch
    
    # --- Basic Info Table ---
    # Safe access
    course_code = folder.course.code if folder.course else "N/A"
    course_title = folder.course.title if folder.course else "N/A"
    instructor_name = folder.faculty.user.full_name if (folder.faculty and folder.faculty.user) else "N/A"

    table1_data = [
        ["Course Code", course_code],
        ["Course Title", course_title],
        ["Instructor Name", instructor_name],
    ]
    
    t1 = Table(table1_data, colWidths=[2.0 * inch, 4.5 * inch])
    t1.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    
    t1.wrapOn(c, box_width, height)
    t1.drawOn(c, box_left + (box_width - 6.5 * inch) / 2, y_cursor - 1.5 * inch)
    y_cursor -= 1.8 * inch
    
    # --- Helper for Text Sections ---
    def draw_text_section(title, content, current_y):
        if current_y < 2.0 * inch:
            current_y = start_new_page()
            
        # Title Box
        c.setStrokeColor(colors.lightgrey)
        c.rect(box_left + 0.2*inch, current_y, box_width - 0.4*inch, 0.3*inch, fill=0)
        c.setFillColor(colors.whitesmoke)
        c.rect(box_left + 0.2*inch, current_y, box_width - 0.4*inch, 0.3*inch, fill=1)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(box_left + 0.3*inch, current_y + 0.1*inch, title)
        
        # Content
        p = Paragraph(clean_html_for_pdf(content) or "-", normal_style)
        w, h = p.wrap(box_width - 0.6*inch, height)
        
        if current_y - h - 0.5 * inch < box_bottom:
             current_y = start_new_page()
             c.setStrokeColor(colors.lightgrey)
             c.rect(box_left + 0.2*inch, current_y, box_width - 0.4*inch, 0.3*inch, fill=0)
             c.setFillColor(colors.whitesmoke)
             c.rect(box_left + 0.2*inch, current_y, box_width - 0.4*inch, 0.3*inch, fill=1)
             c.setFillColor(colors.black)
             c.setFont("Helvetica-Bold", 10)
             c.drawString(box_left + 0.3*inch, current_y + 0.1*inch, title)
        
        p.drawOn(c, box_left + 0.3*inch, current_y - h - 0.1*inch)
        
        # Border around content
        c.setStrokeColor(colors.lightgrey)
        c.rect(box_left + 0.2*inch, current_y - h - 0.2*inch, box_width - 0.4*inch, h + 0.2*inch)
        
        return current_y - h - 0.5*inch

    # --- Content Sections ---
    outline_content = folder.outline_content or {}
    
    y_cursor = draw_text_section("Introduction", outline_content.get('introduction', ''), y_cursor)
    y_cursor = draw_text_section("Objectives", outline_content.get('objectives', ''), y_cursor)
    y_cursor = draw_text_section("Contents/Weekly Plan", outline_content.get('weeklyPlan', ''), y_cursor)
    y_cursor = draw_text_section("Textbooks & Reference books", outline_content.get('textbooks', ''), y_cursor)
    
    # --- Grading Policy Table ---
    if y_cursor < 2.5 * inch:
        y_cursor = start_new_page()
        
    c.setStrokeColor(colors.lightgrey)
    c.rect(box_left + 0.2*inch, y_cursor, box_width - 0.4*inch, 0.3*inch, fill=0)
    c.setFillColor(colors.whitesmoke)
    c.rect(box_left + 0.2*inch, y_cursor, box_width - 0.4*inch, 0.3*inch, fill=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(box_left + 0.3*inch, y_cursor + 0.1*inch, "Grading policy/ Evaluation Criteria")
    
    grading_policy = outline_content.get('gradingPolicy', [])
    if not grading_policy:
        grading_policy = [
            {'assessment': 'Quiz', 'percentage': '20%'},
            {'assessment': 'Assignments', 'percentage': '20%'},
            {'assessment': 'Mid Term', 'percentage': '20%'},
            {'assessment': 'Final Term', 'percentage': '40%'},
        ]
        
    gp_data = []
    for item in grading_policy:
        gp_data.append([item.get('assessment', ''), item.get('percentage', '')])
        
    t_gp = Table(gp_data, colWidths=[4.0 * inch, 2.0 * inch])
    t_gp.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    
    w_gp, h_gp = t_gp.wrap(box_width - 0.4*inch, height)
    t_gp.drawOn(c, box_left + 0.2*inch, y_cursor - h_gp - 0.1*inch)
    
    c.setStrokeColor(colors.lightgrey)
    c.rect(box_left + 0.2*inch, y_cursor - h_gp - 0.2*inch, box_width - 0.4*inch, h_gp + 0.2*inch)
    
    y_cursor -= (h_gp + 0.5 * inch)

    # --- CLO - PLO Mapping Table ---
    if y_cursor < 3.0 * inch:
        y_cursor = start_new_page()

    c.setStrokeColor(colors.lightgrey)
    c.rect(box_left + 0.2*inch, y_cursor, box_width - 0.4*inch, 0.3*inch, fill=0)
    c.setFillColor(colors.whitesmoke)
    c.rect(box_left + 0.2*inch, y_cursor, box_width - 0.4*inch, 0.3*inch, fill=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(box_left + 0.3*inch, y_cursor + 0.1*inch, "Clo -PLO mapping")
    
    clo_headers = outline_content.get('cloHeaders', ['CLO1', 'CLO 2', 'CLO 3'])
    plo_mappings = outline_content.get('ploMappings', [])
    
    header_row = ["PLOs"] + clo_headers
    mapping_data = [header_row]
    
    for mapping in plo_mappings:
        row = [Paragraph(mapping.get('plo', ''), styles['Normal'])]
        for i in range(3):
            key = f'clo{i+1}'
            is_checked = mapping.get(key, False)
            row.append("X" if is_checked else "")
        mapping_data.append(row)
        
    if not plo_mappings:
        mapping_data.append(["No mappings defined", "", "", ""])

    col_widths = [3.0 * inch] + [1.0 * inch] * 3
    
    t_map = Table(mapping_data, colWidths=col_widths)
    t_map.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    
    w_map, h_map = t_map.wrap(box_width - 0.4*inch, height)
    
    if y_cursor - h_map - 0.2*inch < box_bottom:
         y_cursor = start_new_page()
         c.setStrokeColor(colors.lightgrey)
         c.rect(box_left + 0.2*inch, y_cursor, box_width - 0.4*inch, 0.3*inch, fill=0)
         c.setFillColor(colors.whitesmoke)
         c.rect(box_left + 0.2*inch, y_cursor, box_width - 0.4*inch, 0.3*inch, fill=1)
         c.setFillColor(colors.black)
         c.setFont("Helvetica-Bold", 10)
         c.drawString(box_left + 0.3*inch, y_cursor + 0.1*inch, "Clo -PLO mapping")
    
    t_map.drawOn(c, box_left + 0.2*inch, y_cursor - h_map - 0.1*inch)
    
    c.setStrokeColor(colors.lightgrey)
    c.rect(box_left + 0.2*inch, y_cursor - h_map - 0.2*inch, box_width - 0.4*inch, h_map + 0.2*inch)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()


def generate_course_log_page(folder):
    """Generate the Course Log PDF."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    
    # Header
    _draw_header(c, width, height, "Course Log")
    
    # Main Box
    box_top = height - 1.0 * inch
    box_bottom = 1.0 * inch
    box_left = 0.5 * inch
    box_right = width - 0.5 * inch
    box_width = box_right - box_left
    
    c.setStrokeColor(colors.lightgrey)
    c.rect(box_left, box_bottom, box_width, box_top - box_bottom)
    
    y_cursor = box_top - 0.3 * inch
    
    # Top Info Section
    # Left Text
    c.setFont("Helvetica-Bold", 12)
    c.drawString(box_left + 0.2 * inch, y_cursor, "Capital University of Science and Technology")
    y_cursor -= 0.2 * inch
    c.setFont("Helvetica", 10)
    
    # Safe access
    course_title = folder.course.title if folder.course else "N/A"
    course_code = folder.course.code if folder.course else "N/A"
    section = folder.section or "N/A"
    semester = folder.term.session_term if folder.term else "N/A"
    instructor_name = folder.faculty.user.full_name if (folder.faculty and folder.faculty.user) else "N/A"

    c.drawString(box_left + 0.2 * inch, y_cursor, f"Course Log: {course_title} ({course_code})")
    y_cursor -= 0.2 * inch
    c.drawString(box_left + 0.2 * inch, y_cursor, f"(Section-{section}) {semester}")
    y_cursor -= 0.2 * inch
    c.drawString(box_left + 0.2 * inch, y_cursor, f"Instructor: {instructor_name}")
    
    # Right Logo
    logo = _get_logo_image(width=0.8*inch, height=0.8*inch)
    if logo:
        logo.drawOn(c, box_right - 1.2 * inch, y_cursor)
        
    y_cursor -= 0.5 * inch
    
    # Table Header
    headers = ["Lecture No.", "Date", "Duration", "Topics Covered", "Evaluation Instruments Used"]
    col_widths = [0.8*inch, 1.0*inch, 0.8*inch, 2.5*inch, 1.5*inch]
    
    data = [headers]
    
    # 1. Try fetching from DB models
    db_entries = list(folder.log_entries.all().order_by('lecture_number'))
    
    if db_entries:
        for entry in db_entries:
            data.append([
                str(entry.lecture_number),
                entry.date.strftime('%Y-%m-%d'),
                f"{entry.duration / 60:.1f} hours" if entry.duration else "-",
                Paragraph(clean_html_for_pdf(entry.topics_covered), styles['Normal']),
                entry.evaluation_instrument or "-"
            ])
    else:
        # 2. Fallback to outline_content JSON
        outline = folder.outline_content or {}
        # Try different keys used in frontend
        json_logs = outline.get('courseLogEntries') or outline.get('courseLogs') or []
        
        if json_logs:
            for idx, entry in enumerate(json_logs, 1):
                # Handle various JSON structures
                date_str = entry.get('date', '-')
                duration = entry.get('duration', '-')
                topics = entry.get('topics', '') or entry.get('topicsCovered', '')
                # Check all possible keys for evaluation instruments
                eval_inst = (
                    entry.get('evaluationInstruments', '') or 
                    entry.get('evaluation', '') or 
                    entry.get('evaluationInstrument', '')
                )
                
                data.append([
                    str(entry.get('lectureNo', idx)),
                    date_str,
                    str(duration),
                    Paragraph(clean_html_for_pdf(topics), styles['Normal']),
                    eval_inst
                ])
    
    if len(data) == 1:
        # Add a placeholder row if no data
        data.append(["-", "-", "-", "No logs recorded", "-"])

    # Calculate available height for table (leave space for header and margins)
    available_height = y_cursor - box_bottom - 0.2*inch
    
    # Split data into chunks that fit on each page
    header_row = data[0]
    data_rows = data[1:]
    
    # Estimate row height (approximate)
    estimated_row_height = 0.25 * inch
    rows_per_page = max(1, int(available_height / estimated_row_height))
    
    print(f"DEBUG: Course log has {len(data_rows)} entries, estimated {rows_per_page} rows per page")
    
    # Process in chunks
    current_page = 0
    total_pages = (len(data_rows) + rows_per_page - 1) // rows_per_page if data_rows else 1
    
    for page_start in range(0, len(data_rows), rows_per_page):
        page_end = min(page_start + rows_per_page, len(data_rows))
        page_data = [header_row] + data_rows[page_start:page_end]
        
        # Start new page if not first
        if current_page > 0:
            c.showPage()
            _draw_header(c, width, height, "Course Log")
            c.setStrokeColor(colors.lightgrey)
            c.rect(box_left, box_bottom, box_width, box_top - box_bottom)
            y_cursor = box_top - 0.3 * inch
        
        # Create Table for this page
        t = Table(page_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (2, -1), 'CENTER'), # Center align Lecture No, Date, Duration
        ]))
        
        # Draw Table
        w, h = t.wrap(box_width - 0.4*inch, available_height)
        t.drawOn(c, box_left + 0.2*inch, y_cursor - h)
        
        current_page += 1
        print(f"DEBUG: Drew page {current_page}/{total_pages} with entries {page_start+1} to {page_end}")
    
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()



def add_header_to_pdf(pdf_bytes, title):
    """
    Overlays a standard header onto the first page of the provided PDF.
    Dynamically adjusts to the page size of the source PDF.
    """
    try:
        # Create the header PDF in memory
        header_buffer = io.BytesIO()
        
        source_pdf = PdfReader(io.BytesIO(pdf_bytes))
        if len(source_pdf.pages) == 0:
            return pdf_bytes
            
        first_page = source_pdf.pages[0]
        # Get dimensions
        page_width = float(first_page.mediabox.width)
        page_height = float(first_page.mediabox.height)
        
        # Now create the header canvas with the correct size
        c = pdf_canvas.Canvas(header_buffer, pagesize=(page_width, page_height))
        
        # Draw the header
        _draw_header(c, page_width, page_height, title)
        c.save()
        header_buffer.seek(0)
        
        header_pdf = PdfReader(header_buffer)
        header_page = header_pdf.pages[0]
        
        # Merge
        output = PdfWriter()
        
        # Process all pages
        for i, page in enumerate(source_pdf.pages):
            if i == 0:
                # Merge header onto the first page
                page.merge_page(header_page)
                output.add_page(page)
            else:
                output.add_page(page)
                
        out_buffer = io.BytesIO()
        output.write(out_buffer)
        return out_buffer.getvalue()
        
    except Exception as e:
        print(f"Error adding header to PDF: {e}")
        return pdf_bytes


def create_missing_page_placeholder(title):
    """Generate a placeholder PDF page indicating a missing document."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Draw Border
    c.setStrokeColor(colors.lightgrey)
    c.rect(0.5*inch, 0.5*inch, width-1*inch, height-1*inch)
    
    # Draw Title
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width / 2, height / 2 + 0.5*inch, title)
    
    c.setFont("Helvetica", 14)
    c.setFillColor(colors.red)
    c.drawCentredString(width / 2, height / 2 - 0.5*inch, "Document Missing")
    
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()


def merge_pdfs(pdf_bytes_list):
    """
    Merge multiple PDF byte streams into one.
    """
    if not pdf_bytes_list:
        raise ValueError("No PDFs to merge")
        
    merger = PdfMerger()
    
    for pdf_bytes in pdf_bytes_list:
        if pdf_bytes:
            merger.append(io.BytesIO(pdf_bytes))
    
    output = io.BytesIO()
    merger.write(output)
    output.seek(0)
    return output.read()


def generate_audit_report_pdf(folder, assignment, ratings, remarks):
    """
    Generate a professional Audit Report PDF matching the UI design.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.5*inch, leftMargin=0.5*inch,
        topMargin=0.5*inch, bottomMargin=0.5*inch
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom Styles
    styles.add(ParagraphStyle(
        name='AuditTitle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        spaceAfter=4,
        textColor=colors.black
    ))
    
    styles.add(ParagraphStyle(
        name='AuditSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.grey,
        spaceAfter=20
    ))
    
    styles.add(ParagraphStyle(
        name='HeaderTextStyle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.white,
        leading=14
    ))
    
    def create_header_table(text):
        p = Paragraph(f"<b>{text}</b>", styles['HeaderTextStyle'])
        t = Table([[p]], colWidths=[7.2*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HexColor('#334155')), # Slate-700
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        return t

    # 1. Header Section
    elements.append(Paragraph("Audit Report", styles['AuditTitle']))
    course_info = f"{folder.course.code} - {folder.course.title} | Section {folder.section}"
    elements.append(Paragraph(course_info, styles['AuditSubtitle']))
    elements.append(Spacer(1, 10))
    
    # 2. Status Card
    decision = (assignment.decision or 'PENDING').upper()
    if decision == 'APPROVED':
        bg_color = HexColor('#dcfce7') # Green-100
        text_color = HexColor('#166534') # Green-800
        status_text = "Audit Approved"
        icon = "✓"
    elif decision == 'REJECTED':
        bg_color = HexColor('#fee2e2') # Red-100
        text_color = HexColor('#991b1b') # Red-800
        status_text = "Audit Rejected"
        icon = "✗"
    else:
        bg_color = HexColor('#f3f4f6') # Gray-100
        text_color = HexColor('#4b5563') # Gray-600
        status_text = "Audit Pending"
        icon = "?"
        
    status_style = ParagraphStyle(
        name='StatusText',
        parent=styles['Normal'],
        fontSize=14,
        textColor=text_color,
        alignment=TA_LEFT,
        leading=16
    )
    
    # Using a Table for the card to get background color easily
    status_content = Paragraph(f"<b>{icon}  {status_text}</b><br/><font size=10>{decision}</font>", status_style)
    status_table = Table([[status_content]], colWidths=[7.2*inch])
    status_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(status_table)
    elements.append(Spacer(1, 20))
    
    # 3. Audit Summary
    # Header
    elements.append(create_header_table("Audit Summary"))
    
    # Content Table
    summary_data = [
        ["Course:", f"{folder.course.code} - {folder.course.title}"],
        ["Section:", folder.section],
        ["Faculty:", folder.faculty.user.full_name],
        ["Department:", folder.department.name],
        ["Term:", folder.term.session_term if folder.term else "-"],
        ["Auditor:", assignment.auditor.full_name],
        ["Decision:", decision]
    ]
    
    summary_table = Table(summary_data, colWidths=[2*inch, 5.2*inch])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#334155')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))
    
    # 4. Final Remarks
    elements.append(create_header_table("Final Remarks"))
    
    remarks_text = remarks or "No final remarks provided."
    remarks_para = Paragraph(clean_html_for_pdf(remarks_text), styles['Normal'])
    
    remarks_table = Table([[remarks_para]], colWidths=[7.2*inch])
    remarks_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (-1, -1), 1, colors.lightgrey),
    ]))
    elements.append(remarks_table)
    elements.append(Spacer(1, 20))
    
    # 5. Section-Specific Feedback
    feedback_map = folder.audit_member_feedback or {}
    if feedback_map:
        elements.append(create_header_table("Section-Specific Feedback"))
        elements.append(Spacer(1, 10))
        
        # Define sidebar order
        section_order = [
            'TITLE_PAGE', 'COURSE_OUTLINE', 'COURSE_LOG', 'ATTENDANCE', 'LECTURE_NOTES',
            'ASSIGNMENTS', 'QUIZZES', 'MIDTERM', 'FINAL', 'PROJECT_REPORT', 
            'COURSE_RESULT', 'CLO_ASSESSMENT', 'COURSE_REVIEW_REPORT', 'FOLDER_REVIEW_REPORT'
        ]
        
        # Sort keys: known sections first in order, then others alphabetically
        sorted_keys = sorted(feedback_map.keys(), key=lambda k: section_order.index(k) if k in section_order else 999)
        
        for section in sorted_keys:
            note = feedback_map[section]
            if not note: continue
            
            # Section Title Box
            section_title = Paragraph(f"<b>[{section}]</b>", styles['Normal'])
            elements.append(section_title)
            
            # Note Box
            note_para = Paragraph(clean_html_for_pdf(note), styles['Normal'])
            note_table = Table([[note_para]], colWidths=[7.0*inch])
            note_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), HexColor('#f9fafb')), # Gray-50
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]))
            elements.append(note_table)
            elements.append(Spacer(1, 10))
            
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()

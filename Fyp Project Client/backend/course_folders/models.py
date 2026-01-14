from django.db import models
from django.db.models import Q
from django.core.validators import FileExtensionValidator
from courses.models import Course, CourseAllocation
from users.models import User
from terms.models import Term
from departments.models import Department
from programs.models import Program


class CourseFolder(models.Model):
    """Main Course Folder entity"""
    
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('COMPLETED', 'Completed - Ready to Submit'),
        ('SUBMITTED', 'Submitted to Coordinator'),
        ('APPROVED_COORDINATOR', 'Approved by Coordinator'),
        ('REJECTED_COORDINATOR', 'Rejected by Coordinator'),
        ('ASSIGNED_TO_CONVENER', 'Assigned to Convener'),
        ('UNDER_AUDIT', 'Under Audit Review'),
        ('AUDIT_COMPLETED', 'Audit Completed'),
        ('REJECTED_BY_CONVENER', 'Rejected by Convener'),
        ('SUBMITTED_TO_HOD', 'Submitted to HOD'),
        ('APPROVED_BY_HOD', 'Approved by HOD (Final)'),
        ('REJECTED_BY_HOD', 'Rejected by HOD'),
    ]
    
    # Basic Information
    course_allocation = models.ForeignKey(
        CourseAllocation, 
        on_delete=models.CASCADE, 
        related_name='folders'
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='folders')
    faculty = models.ForeignKey('faculty.Faculty', on_delete=models.CASCADE, related_name='folders')
    term = models.ForeignKey(Term, on_delete=models.CASCADE, related_name='folders')
    section = models.CharField(max_length=10)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='folders')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='folders')
    
    # Status & Workflow
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    submitted_at = models.DateTimeField(null=True, blank=True)
    # Two-stage submission: Track if first activity (after midterm) is completed
    first_activity_completed = models.BooleanField(default=False, help_text='True when first submission cycle (after midterm) is approved by HOD')
    
    # Coordinator Review
    coordinator_reviewed_at = models.DateTimeField(null=True, blank=True)
    coordinator_reviewed_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='reviewed_folders'
    )
    coordinator_notes = models.TextField(blank=True)
    # Fine-grained per-section feedback left by coordinator during review
    coordinator_feedback = models.JSONField(default=dict, blank=True)
    # Coordinator final decision and remarks
    coordinator_decision = models.CharField(
        max_length=20,
        choices=[('APPROVED', 'Approved'), ('DISAPPROVED', 'Disapproved')],
        null=True,
        blank=True
    )
    coordinator_remarks = models.TextField(blank=True)
    
    # Convener Assignment
    convener_assigned_at = models.DateTimeField(null=True, blank=True)
    convener_assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='convener_assigned_folders'
    )
    convener_notes = models.TextField(blank=True)
    
    # Audit Process
    audit_completed_at = models.DateTimeField(null=True, blank=True)
    audit_report = models.TextField(blank=True)
    # Fine-grained per-section feedback left by audit members during review
    audit_member_feedback = models.JSONField(default=dict, blank=True)
    
    # HOD Final Approval
    hod_reviewed_at = models.DateTimeField(null=True, blank=True)
    hod_reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hod_reviewed_folders'
    )
    hod_decision = models.CharField(
        max_length=20,
        choices=[('APPROVED', 'Approved'), ('REJECTED', 'Rejected')],
        null=True,
        blank=True
    )
    hod_notes = models.TextField(blank=True)
    hod_final_feedback = models.TextField(blank=True, help_text='Final feedback for faculty member')
    
    # PDF Generation
    consolidated_pdf = models.FileField(
        upload_to='consolidated_pdfs/',
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])]
    )

    # Optional: Instructor uploaded full folder PDF (single file)
    uploaded_folder_pdf = models.FileField(
        upload_to='uploaded_folder_pdfs/',
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        max_length=500
    )
    uploaded_folder_pdf_checked_at = models.DateTimeField(null=True, blank=True)
    uploaded_folder_pdf_validation = models.JSONField(default=dict, blank=True)

    pdf_generated_at = models.DateTimeField(null=True, blank=True)
    pdf_generation_status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('PROCESSING', 'Processing'),
            ('COMPLETED', 'Completed'),
            ('FAILED', 'Failed')
        ],
        default='PENDING'
    )
    
    # Additional PDF Files
    project_report_file = models.FileField(
        upload_to='project_reports/',
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        max_length=500
    )
    course_result_file = models.FileField(
        upload_to='course_results/',
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        max_length=500
    )
    folder_review_report_file = models.FileField(
        upload_to='folder_review_reports/',
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        max_length=500
    )
    clo_assessment_file = models.FileField(
        upload_to='clo_assessments/',
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        max_length=500
    )
    
    # Metadata
    is_complete = models.BooleanField(default=False)
    completeness_check_notes = models.TextField(blank=True)
    
    # Course Outline Content (stored as JSON)
    outline_content = models.JSONField(null=True, blank=True, default=dict)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'course_folders'
        ordering = ['-created_at']
        unique_together = [['course_allocation', 'term']]
        verbose_name = 'Course Folder'
        verbose_name_plural = 'Course Folders'
    
    def __str__(self):
        return f"{self.course.code} - {self.section} - {self.term.session_term}"
    
    def check_completeness(self):
        """Check if all required components are uploaded"""
        required_components = [
            'COURSE_OUTLINE',
            'REFERENCE_BOOKS',
        ]

        # Check required uploaded components
        for comp_type in required_components:
            if not self.components.filter(component_type=comp_type).exists():
                return False, f"Missing {comp_type.replace('_', ' ').title()} document"

        # Ensure course logs are captured
        if not self.log_entries.exists():
            return False, "Course logs have not been recorded"

        attendance_component_exists = self.components.filter(component_type='ATTENDANCE').exists()
        attendance_per_log_complete = (
            self.log_entries.exists()
            and not self.log_entries.filter(Q(attendance_sheet__isnull=True) | Q(attendance_sheet='')).exists()
        )

        if not attendance_component_exists and not attendance_per_log_complete:
            return False, "Missing attendance records"
        
        # Check assessments (4 assignments, 4 quizzes, 1 midterm, 1 final)
        assignments_count = self.assessments.filter(assessment_type='ASSIGNMENT').count()
        quizzes_count = self.assessments.filter(assessment_type='QUIZ').count()
        midterm_count = self.assessments.filter(assessment_type='MIDTERM').count()
        final_count = self.assessments.filter(assessment_type='FINAL').count()
        
        if assignments_count < 4:
            return False, f"Need 4 assignments, have {assignments_count}"
        if quizzes_count < 4:
            return False, f"Need 4 quizzes, have {quizzes_count}"
        if midterm_count < 1:
            return False, "Missing midterm"
        if final_count < 1:
            return False, "Missing final exam"
        
        # Check each assessment has required documents
        for assessment in self.assessments.all():
            if not assessment.question_paper:
                return False, f"Missing question paper for {assessment.title}"
            if not assessment.model_solution:
                return False, f"Missing model solution for {assessment.title}"
            if not assessment.sample_scripts:
                return False, f"Missing sample scripts for {assessment.title}"
        
        return True, "All components complete"


class OutlineContentSnapshot(models.Model):
    """Lightweight history snapshots for outline_content to protect against accidental overwrites."""
    folder = models.ForeignKey(CourseFolder, on_delete=models.CASCADE, related_name='outline_snapshots')
    data = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'outline_content_snapshots'
        ordering = ['-created_at']
        verbose_name = 'Outline Content Snapshot'
        verbose_name_plural = 'Outline Content Snapshots'


class FolderComponent(models.Model):
    """Individual components of a course folder"""
    
    COMPONENT_TYPE_CHOICES = [
        ('TITLE_PAGE', 'Title Page'),
        ('COURSE_OUTLINE', 'Course Outline'),
        ('COURSE_LOG', 'Course Log'),
        ('ATTENDANCE', 'Attendance Record'),
        ('REFERENCE_BOOKS', 'Reference Books'),
        ('FINAL_RESULT', 'Final Result Document'),
        ('MODEL_SOLUTION', 'Model Solution'),
        ('AUDIT_FEEDBACK', 'Audit Feedback'),
        ('OTHER', 'Other'),
    ]
    
    folder = models.ForeignKey(CourseFolder, on_delete=models.CASCADE, related_name='components')
    component_type = models.CharField(max_length=30, choices=COMPONENT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    file = models.FileField(
        upload_to='folder_components/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        max_length=500
    )
    file_size = models.BigIntegerField(default=0)  # in bytes
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_components')
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'folder_components'
        ordering = ['order', 'created_at']
        verbose_name = 'Folder Component'
        verbose_name_plural = 'Folder Components'
    
    def __str__(self):
        return f"{self.folder} - {self.get_component_type_display()}"
    
    def save(self, *args, **kwargs):
        if self.file:
            self.file_size = self.file.size
        super().save(*args, **kwargs)


class Assessment(models.Model):
    """Assessments (Assignments, Quizzes, Midterm, Final)"""
    
    ASSESSMENT_TYPE_CHOICES = [
        ('ASSIGNMENT', 'Assignment'),
        ('QUIZ', 'Quiz'),
        ('MIDTERM', 'Midterm'),
        ('FINAL', 'Final Exam'),
    ]
    
    folder = models.ForeignKey(CourseFolder, on_delete=models.CASCADE, related_name='assessments')
    assessment_type = models.CharField(max_length=20, choices=ASSESSMENT_TYPE_CHOICES)
    title = models.CharField(max_length=200)  # e.g., "Assignment 1", "Quiz 2"
    number = models.IntegerField(default=1)  # 1, 2, 3, 4
    description = models.TextField(blank=True)
    max_marks = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    weightage = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # percentage
    
    # Required Documents
    question_paper = models.FileField(
        upload_to='assessments/questions/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        null=True,
        blank=True,
        max_length=500
    )
    model_solution = models.FileField(
        upload_to='assessments/solutions/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        null=True,
        blank=True,
        max_length=500
    )
    sample_scripts = models.FileField(
        upload_to='assessments/scripts/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        null=True,
        blank=True,
        max_length=500
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'assessments'
        ordering = ['assessment_type', 'number']
        verbose_name = 'Assessment'
        verbose_name_plural = 'Assessments'
    
    def __str__(self):
        return f"{self.folder} - {self.title}"


class CourseLogEntry(models.Model):
    """Individual lecture entries in course log"""
    
    folder = models.ForeignKey(CourseFolder, on_delete=models.CASCADE, related_name='log_entries')
    lecture_number = models.IntegerField()
    date = models.DateField()
    duration = models.IntegerField(default=60)  # minutes
    topics_covered = models.TextField()
    evaluation_instrument = models.CharField(max_length=200, blank=True)
    attendance_sheet = models.FileField(
        upload_to='attendance_sheets/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'xlsx', 'xls', 'csv'])],
        null=True,
        blank=True,
        max_length=500
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'course_log_entries'
        ordering = ['lecture_number']
        unique_together = [['folder', 'lecture_number']]
        verbose_name = 'Course Log Entry'
        verbose_name_plural = 'Course Log Entries'
    
    def __str__(self):
        return f"{self.folder} - Lecture {self.lecture_number}"


class AuditAssignment(models.Model):
    """Audit team member assignments"""
    
    folder = models.ForeignKey(CourseFolder, on_delete=models.CASCADE, related_name='audit_assignments')
    auditor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='audit_assignments')
    assigned_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_audits')
    assigned_at = models.DateTimeField(auto_now_add=True)
    feedback_submitted = models.BooleanField(default=False)
    feedback_submitted_at = models.DateTimeField(null=True, blank=True)
    feedback_file = models.FileField(
        upload_to='audit_feedback/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
        null=True,
        blank=True,
        max_length=500
    )
    remarks = models.TextField(blank=True)
    # New: fine-grained ratings and decision captured from audit UI
    ratings = models.JSONField(default=dict, blank=True)
    decision = models.CharField(
        max_length=20,
        choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')],
        default='PENDING'
    )
    
    class Meta:
        db_table = 'audit_assignments'
        unique_together = [['folder', 'auditor']]
        verbose_name = 'Audit Assignment'
        verbose_name_plural = 'Audit Assignments'
    
    def __str__(self):
        return f"{self.folder} - {self.auditor.full_name}"


class FolderStatusHistory(models.Model):
    """Track status changes of folders"""
    
    folder = models.ForeignKey(CourseFolder, on_delete=models.CASCADE, related_name='status_history')
    status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'folder_status_history'
        ordering = ['-created_at']
        verbose_name = 'Folder Status History'
        verbose_name_plural = 'Folder Status Histories'
    
    def __str__(self):
        return f"{self.folder} - {self.status} at {self.created_at}"


class Notification(models.Model):
    """System notifications for users"""
    
    NOTIFICATION_TYPE_CHOICES = [
        ('FOLDER_SUBMITTED', 'Folder Submitted'),
        ('FOLDER_APPROVED', 'Folder Approved'),
        ('FOLDER_RETURNED', 'Folder Returned'),
        ('AUDIT_ASSIGNED', 'Audit Assigned'),
        ('PDF_GENERATED', 'PDF Generated'),
        ('OTHER', 'Other'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    folder = models.ForeignKey(CourseFolder, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    is_read = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
    
    def __str__(self):
        return f"{self.user.full_name} - {self.title}"


class FolderDeadline(models.Model):
    """Deadline management for folder submissions"""
    
    DEADLINE_TYPE_CHOICES = [
        ('FIRST_SUBMISSION', 'First Submission (After Midterm)'),
        ('FINAL_SUBMISSION', 'Final Submission (After Final Term)'),
    ]
    
    deadline_type = models.CharField(max_length=30, choices=DEADLINE_TYPE_CHOICES)
    term = models.ForeignKey(Term, on_delete=models.CASCADE, related_name='folder_deadlines')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='folder_deadlines', null=True, blank=True)
    deadline_date = models.DateTimeField(help_text='Deadline date and time for submission')
    set_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='set_deadlines')
    notes = models.TextField(blank=True, help_text='Additional notes about the deadline')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'folder_deadlines'
        ordering = ['-deadline_date']
        verbose_name = 'Folder Deadline'
        verbose_name_plural = 'Folder Deadlines'
        unique_together = [['deadline_type', 'term', 'department']]
        indexes = [
            models.Index(fields=['deadline_type', 'term', 'department']),
            models.Index(fields=['deadline_date']),
        ]
    
    def __str__(self):
        dept_str = f" - {self.department.name}" if self.department else ""
        return f"{self.get_deadline_type_display()} - {self.term.session_term}{dept_str} - {self.deadline_date.strftime('%Y-%m-%d')}"
    
    def is_passed(self):
        """Check if deadline has passed"""
        from django.utils import timezone
        return timezone.now() > self.deadline_date
    
    def is_active(self):
        """Check if deadline is currently active (not passed)"""
        return not self.is_passed()


class FolderAccessRequest(models.Model):
    """Track requests from CONVENER/HOD to access approved folders"""
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    
    folder = models.ForeignKey(CourseFolder, on_delete=models.CASCADE, related_name='access_requests')
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='folder_access_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='approved_folder_access_requests'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, help_text='Notes from admin when approving/rejecting')
    
    class Meta:
        db_table = 'folder_access_requests'
        unique_together = [['folder', 'requested_by']]
        ordering = ['-requested_at']
        verbose_name = 'Folder Access Request'
        verbose_name_plural = 'Folder Access Requests'
    
    def __str__(self):
        return f"{self.requested_by.full_name} - {self.folder} - {self.status}"
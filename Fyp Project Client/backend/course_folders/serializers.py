from rest_framework import serializers
from .models import (
    CourseFolder, FolderComponent, Assessment, CourseLogEntry,
    AuditAssignment, FolderStatusHistory, Notification, FolderAccessRequest,
    FolderDeadline
)
from courses.serializers import CourseSerializer, CourseAllocationSerializer
from users.serializers import UserSerializer
from terms.serializers import TermSerializer
from departments.serializers import DepartmentSerializer
from programs.serializers import ProgramSerializer


class AssessmentSerializer(serializers.ModelSerializer):
    """Serializer for Assessment model"""
    
    class Meta:
        model = Assessment
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')


class CourseLogEntrySerializer(serializers.ModelSerializer):
    """Serializer for CourseLogEntry model"""
    
    class Meta:
        model = CourseLogEntry
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')


class FolderComponentSerializer(serializers.ModelSerializer):
    """Serializer for FolderComponent model"""
    uploaded_by_details = UserSerializer(source='uploaded_by', read_only=True)
    
    class Meta:
        model = FolderComponent
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'file_size', 'uploaded_by')


class AuditAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for AuditAssignment model"""
    auditor_details = UserSerializer(source='auditor', read_only=True)
    assigned_by_details = UserSerializer(source='assigned_by', read_only=True)
    
    class Meta:
        model = AuditAssignment
        fields = '__all__'
        read_only_fields = ('assigned_at', 'feedback_submitted_at')


class FolderStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer for FolderStatusHistory model"""
    changed_by_details = UserSerializer(source='changed_by', read_only=True)
    
    class Meta:
        model = FolderStatusHistory
        fields = '__all__'
        read_only_fields = ('created_at',)


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model"""
    
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ('created_at',)


class CourseFolderListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing folders"""
    course_details = CourseSerializer(source='course', read_only=True)
    faculty_name = serializers.CharField(source='faculty.user.full_name', read_only=True)
    term_name = serializers.CharField(source='term.session_term', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    program_name = serializers.CharField(source='program.title', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_auditors = serializers.SerializerMethodField()
    has_final_term_content = serializers.SerializerMethodField()
    can_edit_for_final_submission = serializers.SerializerMethodField()
    
    class Meta:
        model = CourseFolder
        fields = [
            'id', 'course_details', 'faculty_name', 'term_name', 'section',
            'department_name', 'program_name', 'status', 'status_display',
            'is_complete', 'submitted_at', 'created_at', 'updated_at',
            'pdf_generation_status', 'assigned_auditors', 'first_activity_completed',
            'hod_reviewed_at', 'has_final_term_content', 'can_edit_for_final_submission',
            'project_report_file', 'course_result_file', 'folder_review_report_file'
        ]
    
    def get_assigned_auditors(self, obj):
        """Get list of assigned auditor names for folders under audit"""
        if obj.status in ['UNDER_AUDIT', 'AUDIT_COMPLETED']:
            auditors = obj.audit_assignments.select_related('auditor').all()
            return [
                {
                    'id': a.auditor.id,
                    'name': a.auditor.full_name,
                    'cnic': a.auditor.cnic
                } 
                for a in auditors
            ]
        return []
    
    def get_has_final_term_content(self, obj):
        """Check if folder has final term content (indicating second submission is complete)"""
        try:
            # Check if required files for second submission exist
            has_required_files = bool(
                getattr(obj, 'project_report_file', None) and 
                getattr(obj, 'course_result_file', None) and 
                getattr(obj, 'folder_review_report_file', None)
            )
            
            # Also check outline_content for final term data (only if it exists and is accessible)
            try:
                outline = getattr(obj, 'outline_content', None) or {}
                if isinstance(outline, dict):
                    has_final_in_outline = bool(
                        outline.get('final') or 
                        outline.get('finalExam') or 
                        outline.get('finalPaper') or 
                        outline.get('finalSolution') or 
                        outline.get('finalRecords')
                    )
                else:
                    has_final_in_outline = False
            except Exception:
                has_final_in_outline = False
            
            return has_required_files or has_final_in_outline
        except Exception as e:
            # If there's any error, return False to be safe
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error checking final term content for folder {obj.id}: {e}")
            return False
    
    def get_can_edit_for_final_submission(self, obj):
        """Simplified: Check if folder can be edited for final submission - just check first_activity_completed"""
        if obj.status != 'APPROVED_BY_HOD':
            return False
        
        # Simple check: if first_activity_completed is True, allow editing for second submission
        return getattr(obj, 'first_activity_completed', False)


class CourseFolderBasicSerializer(serializers.ModelSerializer):
    """Ultra-lightweight serializer for Title Page and Course Outline - no nested serializers"""
    course_title = serializers.SerializerMethodField()
    course_code = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    semester = serializers.CharField(source='term.session_term', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    program_name = serializers.CharField(source='program.title', read_only=True)
    can_edit_for_final_submission = serializers.SerializerMethodField()
    
    class Meta:
        model = CourseFolder
        fields = [
            'id', 'course_title', 'course_code', 'section', 'instructor_name',
            'semester', 'department_name', 'program_name', 'status', 'outline_content',
            'coordinator_feedback', 'audit_member_feedback', 'coordinator_decision', 'coordinator_remarks',
            'project_report_file', 'course_result_file', 'clo_assessment_file', 'folder_review_report_file',
            'first_activity_completed', 'can_edit_for_final_submission'
        ]
    
    def get_course_title(self, obj):
        """Get course title with fallback to course_allocation.course"""
        if obj.course:
            return obj.course.title or ''
        if hasattr(obj, 'course_allocation') and obj.course_allocation and obj.course_allocation.course:
            return obj.course_allocation.course.title or ''
        return ''
    
    def get_course_code(self, obj):
        """Get course code with fallback to course_allocation.course"""
        if obj.course:
            return obj.course.code or ''
        if hasattr(obj, 'course_allocation') and obj.course_allocation and obj.course_allocation.course:
            return obj.course_allocation.course.code or ''
        return ''
    
    def get_instructor_name(self, obj):
        """Get instructor name from faculty.user"""
        try:
            if obj.faculty and obj.faculty.user:
                return obj.faculty.user.full_name or ''
        except Exception:
            pass
        return ''
    
    def get_can_edit_for_final_submission(self, obj):
        """Simplified: Check if folder can be edited for final submission - just check first_activity_completed"""
        if obj.status != 'APPROVED_BY_HOD':
            return False
        
        # Simple check: if first_activity_completed is True, allow editing for second submission
        return getattr(obj, 'first_activity_completed', False)


class FolderAccessRequestSerializer(serializers.ModelSerializer):
    """Serializer for FolderAccessRequest model"""
    requested_by_details = UserSerializer(source='requested_by', read_only=True)
    approved_by_details = UserSerializer(source='approved_by', read_only=True)
    folder_details = CourseFolderBasicSerializer(source='folder', read_only=True)
    
    class Meta:
        model = FolderAccessRequest
        fields = '__all__'
        read_only_fields = ('requested_at', 'approved_at', 'rejected_at')


class CourseFolderDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for folder with all related data - optimized with select_related"""
    course_details = CourseSerializer(source='course', read_only=True)
    faculty_details = serializers.SerializerMethodField()
    term_details = TermSerializer(source='term', read_only=True)
    department_details = DepartmentSerializer(source='department', read_only=True)
    program_details = ProgramSerializer(source='program', read_only=True)
    coordinator_reviewed_by_details = UserSerializer(source='coordinator_reviewed_by', read_only=True)
    hod_approved_by_details = UserSerializer(source='hod_approved_by', read_only=True)
    
    components = FolderComponentSerializer(many=True, read_only=True)
    assessments = AssessmentSerializer(many=True, read_only=True)
    log_entries = CourseLogEntrySerializer(many=True, read_only=True)
    audit_assignments = AuditAssignmentSerializer(many=True, read_only=True)
    status_history = FolderStatusHistorySerializer(many=True, read_only=True)
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    completeness_status = serializers.SerializerMethodField()
    
    # NEW: Course outline content (stored as JSON)
    outline_content = serializers.JSONField(required=False, allow_null=True)
    
    class Meta:
        model = CourseFolder
        fields = '__all__'
        read_only_fields = (
            'created_at', 'updated_at', 'submitted_at',
            'coordinator_reviewed_at', 'convenor_assigned_at',
            'audit_completed_at', 'hod_approved_at', 'pdf_generated_at'
        )
    
    def to_representation(self, instance):
        """Override to safely handle fields that might not exist in database yet (e.g., after model change but before migration)"""
        try:
            data = super().to_representation(instance)
        except Exception as e:
            # If serialization fails due to missing database column (migration not run),
            # log the error and provide a basic representation
            import logging
            logger = logging.getLogger(__name__)
            error_msg = str(e)
            if 'hod_final_feedback' in error_msg.lower() or 'column' in error_msg.lower():
                logger.warning(f'Serialization error likely due to missing migration. Folder ID: {instance.id}. Error: {error_msg}')
                logger.warning('Please run: python manage.py migrate')
            # Re-raise the error so it's visible - the migration needs to be run
            raise
        
        # Safely handle hod_final_feedback field (might not exist if migration hasn't been run)
        # Use getattr with try-except to handle database column that doesn't exist yet
        try:
            if 'hod_final_feedback' not in data:
                data['hod_final_feedback'] = getattr(instance, 'hod_final_feedback', '') or ''
        except (AttributeError, Exception):
            # Field doesn't exist in database yet (migration not run)
            data['hod_final_feedback'] = ''
        return data
    
    def get_faculty_details(self, obj):
        from faculty.serializers import FacultySerializer
        return FacultySerializer(obj.faculty).data
    
    def get_completeness_status(self, obj):
        is_complete, message = obj.check_completeness()
        return {
            'is_complete': is_complete,
            'message': message
        }


class CourseFolderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new folders"""
    
    class Meta:
        model = CourseFolder
        fields = [
            'course_allocation', 'course', 'faculty', 'term', 'section',
            'department', 'program'
        ]
        extra_kwargs = {
            'faculty': {'required': False}  # Will be auto-set from authenticated user
        }
    
    def validate(self, attrs):
        # Check if folder already exists for this allocation and term
        if CourseFolder.objects.filter(
            course_allocation=attrs['course_allocation'],
            term=attrs['term']
        ).exists():
            raise serializers.ValidationError(
                "A folder already exists for this course allocation and term."
            )
        return attrs


class CourseFolderUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating folder metadata"""
    
    class Meta:
        model = CourseFolder
        fields = [
            'coordinator_notes', 'completeness_check_notes', 'status'
        ]


class ComponentUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading folder components"""
    
    class Meta:
        model = FolderComponent
        fields = ['folder', 'component_type', 'title', 'file', 'description', 'order']
    
    def validate_file(self, value):
        # Check file size (20MB = 20 * 1024 * 1024 bytes)
        if value.size > 20 * 1024 * 1024:
            raise serializers.ValidationError("File size must not exceed 20MB.")
        return value


class AssessmentUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading assessment documents"""
    
    class Meta:
        model = Assessment
        fields = [
            'assessment_type', 'title', 'number', 'description',
            'max_marks', 'weightage', 'question_paper',
            'model_solution', 'sample_scripts'
        ]


class FolderDeadlineSerializer(serializers.ModelSerializer):
    """Serializer for FolderDeadline model"""
    term_name = serializers.CharField(source='term.session_term', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    set_by_name = serializers.CharField(source='set_by.full_name', read_only=True)
    is_passed = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    
    class Meta:
        model = FolderDeadline
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')
    
    def get_is_passed(self, obj):
        return obj.is_passed()
    
    def get_is_active(self, obj):
        return obj.is_active()
    
    def validate(self, attrs):
        # Check file sizes for each uploaded file
        max_size = 20 * 1024 * 1024  # 20MB
        
        for field in ['question_paper', 'model_solution', 'sample_scripts']:
            file = attrs.get(field)
            if file and file.size > max_size:
                raise serializers.ValidationError({
                    field: f"File size must not exceed 20MB."
                })
        
        return attrs

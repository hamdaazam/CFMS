from rest_framework import serializers
from .models import Course, CourseAllocation, CourseCoordinatorAssignment
from departments.serializers import DepartmentSerializer
from programs.serializers import ProgramSerializer


class CourseCoordinatorAssignmentSerializer(serializers.ModelSerializer):
    coordinator_name = serializers.CharField(source='coordinator.full_name', read_only=True)
    coordinator_email = serializers.EmailField(source='coordinator.email', read_only=True, allow_null=True, default=None)
    coordinator_cnic = serializers.CharField(source='coordinator.cnic', read_only=True, allow_null=True, default=None)
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    program_title = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.full_name', read_only=True, allow_null=True, default=None)

    class Meta:
        model = CourseCoordinatorAssignment
        fields = (
            'id', 'coordinator', 'coordinator_name',
            'coordinator_email', 'coordinator_cnic',
            'course', 'course_code', 'course_title',
            'department', 'department_name',
            'program', 'program_title',
            'term', 'is_active',
            'assigned_at', 'assigned_by', 'assigned_by_name'
        )
        read_only_fields = ('assigned_at', 'assigned_by')

    def get_program_title(self, obj):
        return obj.program.title if obj.program else None


class CourseSerializer(serializers.ModelSerializer):
    department_details = DepartmentSerializer(source='department', read_only=True)
    program_details = ProgramSerializer(source='program', read_only=True)
    coordinator_assignments = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Course
        fields = (
            'id', 'code', 'title', 'credit_hours', 'course_type',
            'department', 'department_details', 'program', 'program_details',
            'description', 'pre_requisites', 'is_active',
            'coordinator_assignments',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_coordinator_assignments(self, obj):
        assignments = obj.coordinator_assignments.filter(is_active=True)
        return CourseCoordinatorAssignmentSerializer(assignments, many=True).data


class CourseCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = (
            'code', 'title', 'credit_hours', 'course_type',
            'department', 'program', 'description', 'pre_requisites', 'is_active'
        )
    
    def validate_code(self, value):
        """Ensure course code is uppercase"""
        import re
        code = value.upper().strip()
        # Allow letters, digits, dash and no spaces
        if not re.fullmatch(r'[A-Z0-9-]+', code):
            raise serializers.ValidationError('Course code can only contain letters, numbers, and hyphens (no spaces).')
        return code

    def validate_title(self, value):
        import re
        title = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9 _.-]+", title):
            raise serializers.ValidationError('Title can only contain letters, numbers, spaces, dash, underscore and dot.')
        return title

    def validate(self, attrs):
        # Program must be provided (even though model allows null)
        if not attrs.get('program'):
            raise serializers.ValidationError({'program': 'Program is required.'})
        return attrs


class CourseAllocationSerializer(serializers.ModelSerializer):
    course_details = CourseSerializer(source='course', read_only=True)
    faculty_details = serializers.SerializerMethodField()
    department_details = DepartmentSerializer(source='department', read_only=True)
    program_details = ProgramSerializer(source='program', read_only=True)
    is_coordinator = serializers.BooleanField(write_only=True, required=False, default=False)
    
    def get_faculty_details(self, obj):
        return {
            'id': obj.faculty.id,
            'faculty_id': obj.faculty.faculty_id,
            'full_name': obj.faculty.user.full_name,
            'email': obj.faculty.user.email,
            'designation': obj.faculty.designation,
        }
    
    class Meta:
        model = CourseAllocation
        fields = (
            'id', 'course', 'course_details', 'faculty', 'faculty_details',
            'section', 'department', 'department_details', 'program', 'program_details',
            'term', 'is_active', 'is_coordinator', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def validate(self, data):
        """
        Check that the same course-section combination doesn't exist for the same term
        """
        course = data.get('course')
        section = data.get('section')
        term = data.get('term')
        faculty = data.get('faculty')
        
        # If term is not explicitly provided, determine the active term (same logic as save())
        if not term:
            from terms.models import Term
            active_term = Term.objects.filter(is_active=True).order_by('-start_date').first()
            term = active_term

        # Only validate uniqueness if term (active or provided) is available
        if term:
            # For updates, exclude the current instance
            instance = self.instance
            queryset = CourseAllocation.objects.filter(
                course=course,
                faculty=faculty,
                section=section,
                term=term,
                is_active=True
            )
            
            if instance:
                queryset = queryset.exclude(id=instance.id)
            
            if queryset.exists():
                raise serializers.ValidationError(
                    f"This instructor is already allocated to course {course.code} section {section} for the selected term."
                )
        
        return data
    
    def create(self, validated_data):
        # Extract is_coordinator flag before creating allocation
        is_coordinator = validated_data.pop('is_coordinator', False)
        
        # Create the course allocation
        allocation = super().create(validated_data)
        
        # If is_coordinator is True, create a CourseCoordinatorAssignment
        if is_coordinator:
            request_user = self.context.get('request').user if self.context.get('request') else None
            coordinator_user = allocation.faculty.user
            
            # Create or get existing coordinator assignment for this course
            assignment, created = CourseCoordinatorAssignment.objects.get_or_create(
                coordinator=coordinator_user,
                course=allocation.course,
                term=allocation.term,
                defaults={
                    'department': allocation.department,
                    'program': allocation.program,
                    'assigned_by': request_user,
                    'is_active': True
                }
            )
            
            # If assignment already exists, ensure it's active
            if not created:
                assignment.department = allocation.department
                assignment.program = allocation.program
                assignment.is_active = True
                if request_user:
                    assignment.assigned_by = request_user
                assignment.save()
        
        return allocation

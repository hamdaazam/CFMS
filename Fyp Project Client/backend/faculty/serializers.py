from rest_framework import serializers
from .models import Faculty
from courses.models import Course, CourseCoordinatorAssignment
from courses.serializers import CourseCoordinatorAssignmentSerializer
from users.models import User, RoleAssignmentRequest
from users.serializers import UserSerializer
from departments.serializers import DepartmentSerializer
from programs.serializers import ProgramSerializer


class FacultySerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    department_details = DepartmentSerializer(source='department', read_only=True)
    program_details = ProgramSerializer(source='program', read_only=True)
    
    # Add nested user fields for easier access
    user = serializers.SerializerMethodField()
    
    # Allow updating user data through faculty serializer
    user_data = serializers.DictField(write_only=True, required=False)
    coordinator_assignments = CourseCoordinatorAssignmentSerializer(
        source='user.coordinator_assignments', many=True, read_only=True
    )
    coordinator_course_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    
    def get_user(self, obj):
        return {
            'full_name': obj.user.full_name,
            'email': obj.user.email,
            'cnic': obj.user.cnic
        }
    
    class Meta:
        model = Faculty
        fields = (
            'id', 'user', 'user_details', 'user_data', 'faculty_id', 'department', 'department_details',
            'program', 'program_details', 'designation', 'phone', 'address',
            'date_of_joining', 'qualification', 'specialization', 'is_active',
            'coordinator_assignments', 'coordinator_course_ids',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_phone(self, value):
        if value is None or value == '':
            return value
        digits = ''.join(ch for ch in value if ch.isdigit())
        if len(digits) != 11:
            raise serializers.ValidationError('Phone number must be exactly 11 digits.')
        return digits
    
    def update(self, instance, validated_data):
        # Handle user data update if provided
        user_data = validated_data.pop('user_data', None)
        if user_data:
            user = instance.user
            
            # Validate CNIC if provided
            if 'cnic' in user_data:
                cnic = user_data['cnic'].replace('-', '').replace(' ', '').strip()
                if len(cnic) != 13 or not cnic.isdigit():
                    raise serializers.ValidationError({"user_data": {"cnic": "CNIC must be exactly 13 digits."}})
                
                # Check if CNIC is already taken by another user
                if User.objects.exclude(id=user.id).filter(cnic=cnic).exists():
                    raise serializers.ValidationError({"user_data": {"cnic": "This CNIC is already registered."}})
                
                user.cnic = cnic
            
            # Validate email if provided
            if 'email' in user_data:
                email = user_data['email']
                if email and User.objects.exclude(id=user.id).filter(email=email).exists():
                    raise serializers.ValidationError({"user_data": {"email": "This email is already registered."}})
                user.email = email or None
            
            # Update full name if provided
            if 'full_name' in user_data:
                user.full_name = user_data['full_name']
            
            # Update profile picture if provided
            if 'profile_picture' in user_data:
                user.profile_picture = user_data['profile_picture']
            
            user.save()
        
        course_ids = validated_data.pop('coordinator_course_ids', None)

        # Keep track of old designation before update
        old_designation = instance.designation

        # Update faculty fields
        instance = super().update(instance, validated_data)

        # Keep user role in sync with designation changes
        designation = validated_data.get('designation', instance.designation)

        requires_approval = designation in ['COORDINATOR', 'CONVENER']
        # If new designation requires HOD approval and was not already in such role, create request
        if requires_approval and old_designation not in ['COORDINATOR', 'CONVENER']:
            # Keep the user as FACULTY until HOD approves; create a request
            instance.user.role = 'FACULTY'
            instance.user.save(update_fields=['role', 'department', 'program'])
            # Prevent duplicate Convener in department
            if designation == 'CONVENER' and instance.department:
                if User.objects.filter(role='CONVENER', department=instance.department, is_active=True).exists():
                    raise serializers.ValidationError({'department': 'It is not possible to add two conveners in the same department.'})
                if RoleAssignmentRequest.objects.filter(role='CONVENER', department=instance.department, status='PENDING').exists():
                    raise serializers.ValidationError({'department': 'It is not possible to add two conveners in the same department.'})

            req = RoleAssignmentRequest.objects.create(
                requested_by=self.context.get('request').user if self.context.get('request') else None,
                target_user=instance.user,
                role=designation,
                department=instance.department,
                program=instance.program,
                coordinator_course_ids=course_ids or []
            )
            # Notifications for this new RoleAssignmentRequest are created centrally via the
            # post_save signal on RoleAssignmentRequest (users.signals.create_role_request_notifications)
        else:
            # Directly update role if no approval needed
            if designation and instance.user.role != designation:
                instance.user.role = designation
                instance.user.save(update_fields=['role'])

        # Handle coordinator course assignments when provided
        if course_ids is not None:
            self._sync_coordinator_courses(instance.user, course_ids, instance.department)

        # If designation changed away from coordinator, deactivate assignments
        if designation != 'COORDINATOR':
            CourseCoordinatorAssignment.objects.filter(
                coordinator=instance.user,
                is_active=True
            ).update(is_active=False)

        return instance

    def _sync_coordinator_courses(self, coordinator, course_ids, department):
        # Allow any role (FACULTY, CONVENER, HOD) to be a course coordinator
        # No role restriction check needed

        # Remove duplicates while preserving order
        unique_ids = []
        for cid in course_ids:
            if cid not in unique_ids:
                unique_ids.append(cid)

        courses = list(Course.objects.filter(id__in=unique_ids, department=department))
        if len(courses) != len(unique_ids):
            raise serializers.ValidationError({
                'coordinator_course_ids': 'One or more selected courses are invalid for the coordinator\'s department.'
            })

        # Deactivate assignments not in the new list
        CourseCoordinatorAssignment.objects.filter(
            coordinator=coordinator,
            is_active=True
        ).exclude(course_id__in=unique_ids).update(is_active=False)

        # (Re)activate assignments in the list
        request_user = self.context.get('request').user if self.context.get('request') else None
        for course in courses:
            assignment, created = CourseCoordinatorAssignment.objects.get_or_create(
                coordinator=coordinator,
                course=course,
                term=None,
                defaults={
                    'department': course.department,
                    'program': course.program,
                    'assigned_by': request_user
                }
            )
            if not assignment.is_active or assignment.program != course.program:
                assignment.department = course.department
                assignment.program = course.program
                assignment.is_active = True
                if request_user:
                    assignment.assigned_by = request_user
                assignment.save()


class FacultyCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    full_name = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)
    cnic = serializers.CharField(write_only=True, required=False)
    coordinator_course_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Faculty
        fields = (
            'email', 'full_name', 'password', 'cnic', 'faculty_id', 'department', 'program',
            'designation', 'phone', 'address', 'date_of_joining',
            'qualification', 'specialization', 'coordinator_course_ids'
        )
    
    def validate(self, attrs):
        email = attrs.get('email')
        cnic = attrs.get('cnic')
        full_name = attrs.get('full_name')
        # Sanitize and validate full_name (no special chars beyond space and basic punctuation)
        if full_name:
            import re
            cleaned_name = full_name.strip()
            if not re.fullmatch(r"[A-Za-z][A-Za-z .'-]*", cleaned_name):
                raise serializers.ValidationError({'full_name': 'Name can only contain letters, spaces, dot, apostrophe and hyphen, and must start with a letter.'})
            attrs['full_name'] = cleaned_name

        if not cnic:
            raise serializers.ValidationError({'cnic': 'CNIC is required.'})

        normalized_cnic = cnic.replace('-', '').replace(' ', '').strip()
        if len(normalized_cnic) != 13 or not normalized_cnic.isdigit():
            raise serializers.ValidationError({'cnic': 'CNIC must be exactly 13 digits.'})

        if User.objects.filter(cnic=normalized_cnic).exists():
            raise serializers.ValidationError({'cnic': 'A user with this CNIC already exists.'})

        attrs['cnic'] = normalized_cnic

        if email:
            trimmed_email = email.strip().lower()
            if User.objects.filter(email=trimmed_email).exists():
                raise serializers.ValidationError({'email': 'A user with this email already exists.'})
            attrs['email'] = trimmed_email

        designation = attrs.get('designation', 'FACULTY')
        department = attrs.get('department')
        program = attrs.get('program')
        coordinator_course_ids = attrs.get('coordinator_course_ids')

        if designation == 'COORDINATOR':
            if not department:
                raise serializers.ValidationError({'department': 'Coordinator must belong to a department.'})
            if not program:
                raise serializers.ValidationError({'program': 'Coordinator must be assigned to a program.'})
            if not coordinator_course_ids:
                raise serializers.ValidationError({'coordinator_course_ids': 'Select at least one course to assign the coordinator.'})

        return attrs

    def validate_phone(self, value):
        if value is None or value == '':
            return value
        digits = ''.join(ch for ch in value if ch.isdigit())
        if len(digits) != 11:
            raise serializers.ValidationError('Phone number must be exactly 11 digits.')
        return digits

    def create(self, validated_data):
        # Extract user data
        email = validated_data.pop('email')
        full_name = validated_data.pop('full_name')
        password = validated_data.pop('password')
        cnic = validated_data.pop('cnic', None)
        coordinator_course_ids = validated_data.pop('coordinator_course_ids', [])
        
        # Validate CNIC is provided
        if not cnic:
            raise serializers.ValidationError({"cnic": "CNIC is required"})
        
        designation = validated_data.get('designation', 'FACULTY')
        department = validated_data.get('department')
        program = validated_data.get('program')
        
        # If designation requires HOD approval (COORDINATOR or CONVENER), create user as FACULTY and create RoleAssignmentRequest
        requires_approval = designation in ['COORDINATOR', 'CONVENER']
        user_role = 'FACULTY' if requires_approval else designation
        # Create user with role matching the designation
        # Note: create_user expects (cnic, full_name, password, **extra_fields)
        user = User.objects.create_user(
            cnic=cnic,
            full_name=full_name,
            password=password,
            email=email,
            role=user_role,  # Set initial role; may be changed after HOD approval
            department=department,  # Link to department
            program=program  # Link to program
        )
        
        # Create faculty profile
        faculty = Faculty.objects.create(user=user, **validated_data)

        # If this is a coordinator/convener request, create a role request instead of assigning role immediately
        if requires_approval:
            # Create a RoleAssignmentRequest for HOD approval
            # Prevent duplicate convener in department
            if designation == 'CONVENER' and department:
                if User.objects.filter(role='CONVENER', department=department, is_active=True).exists():
                    raise serializers.ValidationError({'department': 'It is not possible to add two conveners in the same department.'})
                if RoleAssignmentRequest.objects.filter(role='CONVENER', department=department, status='PENDING').exists():
                    raise serializers.ValidationError({'department': 'It is not possible to add two conveners in the same department.'})

            req = RoleAssignmentRequest.objects.create(
                requested_by=self.context.get('request').user if self.context.get('request') else None,
                target_user=user,
                role=designation,
                department=department,
                program=program,
                coordinator_course_ids=coordinator_course_ids or []
            )
        # Create coordinator-course mappings if applicable and no approval required (rare)
        if not requires_approval and designation == 'COORDINATOR':
            if not coordinator_course_ids:
                raise serializers.ValidationError({'coordinator_course_ids': 'Select at least one course to assign the coordinator.'})

            courses = list(Course.objects.filter(id__in=coordinator_course_ids, department=department))
            if len(courses) != len(set(map(int, coordinator_course_ids))):
                raise serializers.ValidationError({
                    'coordinator_course_ids': 'One or more selected courses are invalid for the coordinator\'s department.'
                })

            request_user = self.context.get('request').user if self.context.get('request') else None
            for course in courses:
                CourseCoordinatorAssignment.objects.create(
                    coordinator=user,
                    course=course,
                    department=course.department,
                    program=course.program,
                    assigned_by=request_user
                )

        return faculty

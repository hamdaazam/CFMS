from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, RoleAssignmentRequest
from departments.serializers import DepartmentSerializer
from programs.serializers import ProgramSerializer


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    program_name = serializers.CharField(source='program.name', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    has_audit_access = serializers.SerializerMethodField()
    has_coordinator_access = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = (
            'id', 'cnic', 'email', 'full_name', 'role', 'role_display',
            'department', 'department_name', 'program', 'program_name',
            'is_active', 'date_joined', 'profile_picture',
            'has_audit_access', 'has_coordinator_access'
        )
        read_only_fields = ('id', 'date_joined')
        extra_kwargs = {
            'cnic': {'required': True},
            'email': {'required': False, 'allow_blank': True, 'allow_null': True}
        }

    def get_has_audit_access(self, obj: User) -> bool:
        # Anyone assigned an AuditAssignment should have access to audit member module,
        # even if their primary role is FACULTY/CONVENER/COORDINATOR/etc.
        try:
            from course_folders.models import AuditAssignment
            return obj.role in ['AUDIT_TEAM', 'AUDIT_MEMBER', 'EVALUATOR'] or AuditAssignment.objects.filter(auditor=obj).exists()
        except Exception:
            return obj.role in ['AUDIT_TEAM', 'AUDIT_MEMBER', 'EVALUATOR']

    def get_has_coordinator_access(self, obj: User) -> bool:
        # Anyone with an active CourseCoordinatorAssignment should be able to use coordinator review module,
        # even if their primary role is CONVENER/HOD/FACULTY.
        try:
            from courses.models import CourseCoordinatorAssignment
            return obj.role == 'COORDINATOR' or CourseCoordinatorAssignment.objects.filter(coordinator=obj, is_active=True).exists()
        except Exception:
            return obj.role == 'COORDINATOR'


class RoleAssignmentRequestSerializer(serializers.ModelSerializer):
    requested_by_details = UserSerializer(source='requested_by', read_only=True)
    target_user_details = UserSerializer(source='target_user', read_only=True)
    department_details = DepartmentSerializer(source='department', read_only=True)
    program_details = ProgramSerializer(source='program', read_only=True)

    class Meta:
        model = RoleAssignmentRequest
        fields = (
            'id', 'requested_by', 'requested_by_details', 'target_user', 'target_user_details', 'role',
            'department', 'department_details', 'program', 'program_details', 'coordinator_course_ids', 'status',
            'requested_at', 'decided_by', 'decided_at', 'decision_reason'
        )
        read_only_fields = ('id', 'status', 'requested_at', 'decided_by', 'decided_at')

    def validate(self, attrs):
        role = attrs.get('role')
        department = attrs.get('department')
        program = attrs.get('program')

        if role == 'CONVENER' and not department:
            raise serializers.ValidationError({'department': 'Convener must be assigned to a department.'})
        # Prevent duplicate convener in department
        if role == 'CONVENER' and department:
            from .models import RoleAssignmentRequest as RARModel
            # Check for existing active convener in department
            from .models import User as UserModel
            existing_convener = UserModel.objects.filter(role='CONVENER', department=department, is_active=True)
            if existing_convener.exists():
                raise serializers.ValidationError({'department': 'It is not possible to add two conveners in the same department.'})
            # Check for pending convener request in this department
            pending_convener = RARModel.objects.filter(role='CONVENER', department=department, status='PENDING')
            if pending_convener.exists():
                raise serializers.ValidationError({'department': 'It is not possible to add two conveners in the same department.'})
        # A Coordinator should always be associated with a program. Allow the department to be
        # omitted when creating a coordinator request because the program's department may be
        # used to derive the department (this is handled in the view logic).
        if role == 'COORDINATOR' and (not program):
            raise serializers.ValidationError({'program': 'Coordinator must be assigned to a program.'})

        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('cnic', 'email', 'full_name', 'role', 'department', 'program', 'password', 'password_confirm')
        extra_kwargs = {
            'cnic': {'required': True},
            'email': {'required': False, 'allow_blank': True, 'allow_null': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        
        # Validate CNIC format (13 digits, numbers only)
        cnic = attrs.get('cnic', '')
        if cnic:
            # Remove any spaces or dashes
            clean_cnic = cnic.replace('-', '').replace(' ', '').strip()

            # Check if it's exactly 13 digits
            if len(clean_cnic) != 13:
                raise serializers.ValidationError({"cnic": "CNIC must be exactly 13 digits."})
            
            # Check if all characters are digits
            if not clean_cnic.isdigit():
                raise serializers.ValidationError({"cnic": "CNIC must contain only numbers."})
            
            # Update the cleaned CNIC
            attrs['cnic'] = clean_cnic
        
        # Role-specific validations
        role = attrs.get('role')
        department = attrs.get('department')
        program = attrs.get('program')
        
        # Convener must have a department
        if role == 'CONVENER' and not department:
            raise serializers.ValidationError({"department": "Convener must be assigned to a department."})
        
        # Coordinator must have both department and program
        if role == 'COORDINATOR' and (not department or not program):
            raise serializers.ValidationError({
                "department": "Coordinator must be assigned to a department.",
                "program": "Coordinator must be assigned to a program."
            })
        
        # Students must have a program
        if role == 'STUDENT' and not program:
            raise serializers.ValidationError({"program": "Student must be assigned to a program."})
        
        # Restrict AUDIT_TEAM role assignment: only Convener can create
        request = self.context.get('request')
        requesting_user = getattr(request, 'user', None)
        if role == 'AUDIT_TEAM':
            if not requesting_user or requesting_user.role != 'CONVENER':
                raise serializers.ValidationError({'role': 'Only a Convener can assign AUDIT_TEAM role.'})

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            cnic=validated_data['cnic'],
            full_name=validated_data['full_name'],
            email=validated_data.get('email'),
            role=validated_data.get('role', 'STUDENT'),
            department=validated_data.get('department'),
            program=validated_data.get('program'),
            password=validated_data['password']
        )
        return user


class LoginSerializer(serializers.Serializer):
    cnic = serializers.CharField(max_length=13, min_length=13, required=False, help_text='13-digit National Identity Card Number')
    email = serializers.EmailField(required=False)
    password = serializers.CharField(write_only=True)

    def validate_cnic(self, value):
        """Validate CNIC format"""
        # Remove any spaces or dashes
        clean_cnic = value.replace('-', '').replace(' ', '').strip()
        
        # Check if it's exactly 13 digits
        if len(clean_cnic) != 13:
            raise serializers.ValidationError("CNIC must be exactly 13 digits.")
        
        # Check if all characters are digits
        if not clean_cnic.isdigit():
            raise serializers.ValidationError("CNIC must contain only numbers.")
        
        return clean_cnic

    def validate(self, attrs):
        cnic = attrs.get('cnic')
        email = attrs.get('email')
        password = attrs.get('password')

        user = None

        # Try CNIC first (backwards compatibility)
        if cnic and password:
            user = authenticate(request=self.context.get('request'), username=cnic, password=password)

        # Fallback to email-based authentication if CNIC not provided
        elif email and password:
            # Email lookup should be case-insensitive and trimmed
            clean_email = (email or '').strip()
            user_obj = User.objects.filter(email__iexact=clean_email).first()

            if user_obj and user_obj.check_password(password):
                user = user_obj

        if (cnic or email) and password:
            if not user:
                raise serializers.ValidationError('Invalid credentials.')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled.')
            if user.role == 'COORDINATOR':
                faculty_profile = getattr(user, 'faculty_profile', None)
                if not faculty_profile or not faculty_profile.is_active:
                    raise serializers.ValidationError('Coordinator profile is inactive. Please contact administration.')
                if not user.coordinator_assignments.filter(is_active=True).exists():
                    raise serializers.ValidationError('No active course coordinator assignment found. Please contact administration.')
        else:
            raise serializers.ValidationError('Must include "cnic" or "email" with "password".')

        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "New passwords do not match."})
        
        if attrs['old_password'] == attrs['new_password']:
            raise serializers.ValidationError({"new_password": "New password must be different from old password."})
        
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('full_name', 'email', 'cnic')
    
    def validate_cnic(self, value):
        """Validate CNIC format"""
        # Remove any spaces or dashes
        clean_cnic = value.replace('-', '').replace(' ', '').strip()
        
        # Check if it's exactly 13 digits
        if len(clean_cnic) != 13:
            raise serializers.ValidationError("CNIC must be exactly 13 digits.")
        
        # Check if all characters are digits
        if not clean_cnic.isdigit():
            raise serializers.ValidationError("CNIC must contain only numbers.")
        
        # Check if CNIC is already taken by another user
        user = self.context['request'].user
        if User.objects.exclude(id=user.id).filter(cnic=clean_cnic).exists():
            raise serializers.ValidationError("This CNIC is already registered.")
        
        return clean_cnic
    
    def validate_email(self, value):
        """Validate email uniqueness"""
        if not value:
            return value
        
        user = self.context['request'].user
        if User.objects.exclude(id=user.id).filter(email=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        
        return value


class UploadProfilePictureSerializer(serializers.Serializer):
    profile_picture = serializers.CharField(required=True)
    
    def validate_profile_picture(self, value):
        """Validate base64 image"""
        import base64
        import sys
        
        if not value:
            raise serializers.ValidationError("Profile picture is required.")
        
        # Store the original value (with data URL prefix)
        original_value = value
        
        # Check if it's a valid base64 string
        try:
            # Remove data URL prefix if present (e.g., "data:image/png;base64,")
            if ',' in value:
                header, data = value.split(',', 1)
                # Validate it's an image
                if not header.startswith('data:image/'):
                    raise serializers.ValidationError("Only image files are allowed.")
            else:
                data = value
            
            # Decode to check validity
            image_data = base64.b64decode(data)
            
            # Check file size (max 5MB)
            size_in_mb = sys.getsizeof(image_data) / (1024 * 1024)
            if size_in_mb > 5:
                raise serializers.ValidationError("Image size must be less than 5MB.")
            
        except Exception as e:
            raise serializers.ValidationError(f"Invalid image data: {str(e)}")
        
        # Return the original value with data URL prefix
        return original_value
    
    def save(self, **kwargs):
        user = self.context['request'].user
        user.profile_picture = self.validated_data['profile_picture']
        user.save()
        return user

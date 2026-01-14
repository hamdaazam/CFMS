from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.db.models import JSONField


class UserManager(BaseUserManager):
    def create_user(self, cnic, full_name, password=None, **extra_fields):
        """Create and return a regular user with CNIC as username"""
        if not cnic:
            raise ValueError('Users must have a CNIC')
        if not full_name:
            raise ValueError('Users must have a full name')
        
        # Normalize CNIC (remove dashes, spaces, keep only digits)
        cnic = cnic.replace('-', '').replace(' ', '').strip()

        # Validate CNIC: must be exactly 13 digits
        if len(cnic) != 13:
            raise ValueError('CNIC must be exactly 13 digits')
        if not cnic.isdigit():
            raise ValueError('CNIC must contain only numbers')
        
        user = self.model(cnic=cnic, full_name=full_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, cnic, full_name, password=None, **extra_fields):
        """Create and return a superuser with CNIC as username"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(cnic, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User Model with Role-Based Hierarchy:
    
    ADMIN (University Level)
     └── CONVENER (Department Level - Head of FYP process)
          ├── COORDINATOR (Program Level - e.g., BSCS, BSSE)
          │     ├── SUPERVISOR (Faculty guiding student groups)
          │     ├── EVALUATOR (Faculty evaluating projects)
          │     └── STUDENT (Project teams)
          └── Oversees all Coordinators under their department
    """
    
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),                    # System admin - manages everything
        ('HOD', 'HOD'),                        # Head of Department - final approval authority
        ('CONVENER', 'Convener'),              # Department-level - manages audit team
        ('COORDINATOR', 'Coordinator'),        # Program/Course-level - first reviewer
        ('FACULTY', 'Faculty'),                # General faculty member - creates folders
        ('AUDIT_TEAM', 'Audit Team'),          # Legacy audit team role (backward compatibility)
        ('AUDIT_MEMBER', 'Audit Member'),      # Distinct audit member role
        # ('SUPERVISOR', 'Supervisor'),        # Faculty supervising FYP groups (REMOVED)
        # ('EVALUATOR', 'Evaluator'),          # Faculty evaluating FYPs (REMOVED)
        # ('STUDENT', 'Student'),              # Students working on FYPs (REMOVED)
    ]

    # Primary fields
    cnic = models.CharField(
        max_length=13,
        unique=True,
        help_text='National Identity Card Number (e.g 3130456789112)',
        verbose_name='CNIC'
    )
    full_name = models.CharField(max_length=255, verbose_name='Full Name')
    email = models.EmailField(unique=True, blank=True, null=True, verbose_name='Email')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STUDENT')
    profile_picture = models.TextField(
        blank=True, 
        null=True,
        help_text='Base64 encoded profile picture (max 5MB)'
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    
    # Hierarchical relationships
    department = models.ForeignKey(
        'departments.Department', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='users',
        help_text='Department (for Convener, Coordinator, Supervisor, Evaluator)'
    )
    program = models.ForeignKey(
        'programs.Program',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
        help_text='Program (for Coordinator, Supervisor, Evaluator, Student)'
    )

    objects = UserManager()

    USERNAME_FIELD = 'cnic'  # Login with CNIC
    REQUIRED_FIELDS = ['full_name']  # Required when creating superuser

    class Meta:
        db_table = 'users_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-date_joined']

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()})"
    
    # Role checking methods
    @property
    def is_admin(self):
        return self.role == 'ADMIN'
    
    @property
    def is_hod(self):
        return self.role == 'HOD'
    
    @property
    def is_convener(self):
        return self.role == 'CONVENER'
    
    @property
    def is_coordinator(self):
        return self.role == 'COORDINATOR'
    
    @property
    def is_faculty(self):
        return self.role == 'FACULTY'
    
    @property
    def is_audit_team(self):
        return self.role == 'AUDIT_TEAM'

    @property
    def is_audit_member(self):
        return self.role == 'AUDIT_MEMBER'
    
    @property
    def is_supervisor(self):
        return self.role == 'SUPERVISOR'
    
    @property
    def is_evaluator(self):
        return self.role == 'EVALUATOR'
    
    @property
    def is_student(self):
        return self.role == 'STUDENT'
    
    # Permission helper methods
    def can_manage_users(self):
        """Who can create/manage users"""
        return self.role in ['ADMIN', 'HOD', 'CONVENER', 'COORDINATOR']
    
    def can_manage_department(self):
        """Only Admin can manage departments"""
        return self.role == 'ADMIN'
    
    def can_manage_programs(self):
        """Admin and HOD can manage programs"""
        return self.role in ['ADMIN', 'HOD']
    
    def can_create_folders(self):
        """Who can create course folders"""
        return self.role in ['FACULTY', 'COORDINATOR']
    
    def can_review_as_coordinator(self, course=None):
        """Who can review as coordinator - check via CourseCoordinatorAssignment"""
        from courses.models import CourseCoordinatorAssignment
        if course:
            return CourseCoordinatorAssignment.objects.filter(
                coordinator=self,
                course=course,
                is_active=True
            ).exists()
        # If no course specified, check if user has any active coordinator assignments
        return CourseCoordinatorAssignment.objects.filter(
            coordinator=self,
            is_active=True
        ).exists()
    
    def can_assign_audit(self):
        """Who can assign audit team"""
        return self.role == 'CONVENER'
    
    def can_audit_folders(self):
        """Who can audit folders"""
    # Allow both legacy and new role
        return self.role in ['AUDIT_TEAM', 'AUDIT_MEMBER']
    
    def can_final_approve(self):
        """Who has final approval authority"""
        return self.role == 'HOD'
    
    def get_hierarchy_level(self):
        """Return numeric hierarchy level (lower = more authority)"""
        hierarchy = {
            'ADMIN': 1,
            'HOD': 2,
            'CONVENER': 3,
            'COORDINATOR': 4,
            'FACULTY': 5,
            'AUDIT_TEAM': 5,
            'AUDIT_MEMBER': 5,
            'SUPERVISOR': 5,
            'EVALUATOR': 5,
            'STUDENT': 6,
        }
        return hierarchy.get(self.role, 999)


class RoleAssignmentRequest(models.Model):
    """Request by Admin to assign a role (CONVENER/COORDINATOR) to a user, requiring HOD approval."""

    ROLE_CHOICES = [
        ('CONVENER', 'Convener'),
        ('COORDINATOR', 'Coordinator'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    requested_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='role_requests_made')
    target_user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='role_requests_received')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    department = models.ForeignKey('departments.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='role_requests')
    program = models.ForeignKey('programs.Program', on_delete=models.SET_NULL, null=True, blank=True, related_name='role_requests')
    coordinator_course_ids = JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    requested_at = models.DateTimeField(auto_now_add=True)
    decided_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='role_requests_decided')
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'users_role_assignment_requests'
        verbose_name = 'Role Assignment Request'
        verbose_name_plural = 'Role Assignment Requests'

    def __str__(self):
        return f"{self.get_role_display()} request for {self.target_user.full_name} - {self.status}"

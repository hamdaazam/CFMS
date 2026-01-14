from django.db import models
from users.models import User
from departments.models import Department
from programs.models import Program


class Faculty(models.Model):
    # Using same role choices as User model for consistency
    DESIGNATION_CHOICES = [
        ('HOD', 'HOD'),
        ('CONVENER', 'Convener'),
        ('COORDINATOR', 'Coordinator'),
        ('FACULTY', 'Faculty'),
        ('AUDIT_TEAM', 'Audit Team'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='faculty_profile')
    faculty_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, related_name='faculty_members')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='faculty_members')
    designation = models.CharField(max_length=50, choices=DESIGNATION_CHOICES)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    date_of_joining = models.DateField(null=True, blank=True)
    qualification = models.CharField(max_length=100, blank=True, null=True)
    specialization = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'faculty_faculty'
        ordering = ['user__full_name']
        verbose_name = 'Faculty'
        verbose_name_plural = 'Faculty Members'

    def __str__(self):
        return f"{self.user.full_name} - {self.designation}"
    
    def generate_faculty_id(self):
        """Generate a unique faculty ID based on department short code"""
        if self.department and self.department.short_code:
            dept_code = self.department.short_code.upper()
        else:
            dept_code = "FAC"
        
        # Get the count of existing faculty in this department
        count = Faculty.objects.filter(
            department=self.department
        ).exclude(id=self.id).count() + 1
        
        # Generate ID like "CS-001", "SE-002", etc.
        faculty_id = f"{dept_code}-{count:03d}"
        
        # Check if this ID already exists
        while Faculty.objects.filter(faculty_id=faculty_id).exists():
            count += 1
            faculty_id = f"{dept_code}-{count:03d}"
        
        return faculty_id
    
    def save(self, *args, **kwargs):
        """Override save to auto-generate faculty_id if not provided"""
        if not self.faculty_id:
            self.faculty_id = self.generate_faculty_id()
        super().save(*args, **kwargs)

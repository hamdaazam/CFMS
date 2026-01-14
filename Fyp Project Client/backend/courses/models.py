from django.db import models
from django.conf import settings
from departments.models import Department
from programs.models import Program


class Course(models.Model):
    COURSE_TYPE_CHOICES = [
        ('THEORY', 'Theory'),
        ('LAB', 'Lab'),
        ('HYBRID', 'Hybrid'),
    ]

    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=200)
    credit_hours = models.IntegerField(default=3)
    course_type = models.CharField(max_length=10, choices=COURSE_TYPE_CHOICES, default='THEORY')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='courses')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='courses')
    description = models.TextField(blank=True)
    pre_requisites = models.TextField(blank=True, help_text='Comma-separated course codes')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'courses_course'
        ordering = ['code']
        verbose_name = 'Course'
        verbose_name_plural = 'Courses'

    def __str__(self):
        return f"{self.code} - {self.title}"


class CourseAllocation(models.Model):
    """Model to store course allocations to faculty members"""
    course = models.ForeignKey('Course', on_delete=models.CASCADE, related_name='allocations')
    faculty = models.ForeignKey('faculty.Faculty', on_delete=models.CASCADE, related_name='course_allocations')
    section = models.CharField(max_length=10)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='course_allocations')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='course_allocations')
    term = models.ForeignKey('terms.Term', on_delete=models.CASCADE, related_name='course_allocations', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'course_allocations'
        ordering = ['-created_at']
        # Ensure a faculty cannot be assigned the same course and section multiple times in the same term
        # Keep this constraint to prevent duplicated allocations
        unique_together = (('course', 'faculty', 'section', 'term'),)
        verbose_name = 'Course Allocation'
        verbose_name_plural = 'Course Allocations'

    def __str__(self):
        return f"{self.course.code} - {self.faculty.user.full_name} (Section {self.section})"
    
    def save(self, *args, **kwargs):
        """Override save to auto-assign active term if not provided"""
        if not self.term:
            # Auto-assign the most recent active term
            from terms.models import Term
            active_term = Term.objects.filter(is_active=True).order_by('-start_date').first()
            if active_term:
                self.term = active_term
        super().save(*args, **kwargs)


class CourseCoordinatorAssignment(models.Model):
    """Mapping between coordinators and the courses they supervise."""

    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='coordinator_assignments'
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='coordinator_assignments')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='coordinator_assignments')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='coordinator_assignments')
    term = models.ForeignKey(
        'terms.Term',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordinator_assignments'
    )
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordinator_assignment_actions'
    )

    class Meta:
        db_table = 'course_coordinator_assignments'
        verbose_name = 'Course Coordinator Assignment'
        verbose_name_plural = 'Course Coordinator Assignments'
        unique_together = ('coordinator', 'course', 'term')

    def __str__(self):
        term_label = self.term.session_term if self.term else 'All Terms'
        return f"{self.coordinator.full_name} → {self.course.code} ({term_label})"

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CourseAllocation
from course_folders.models import CourseFolder


@receiver(post_save, sender=CourseAllocation)
def create_course_folder_on_allocation(sender, instance, created, **kwargs):
    """
    Automatically create a course folder when a new course allocation is created
    """
    if created and instance.is_active:
        # Check if a folder already exists for this allocation
        existing_folder = CourseFolder.objects.filter(
            course_allocation=instance,
            faculty=instance.faculty,
            course=instance.course,
            term=instance.term,
        ).first()
        
        if not existing_folder:
            # Create a new folder
            CourseFolder.objects.create(
                course_allocation=instance,
                course=instance.course,
                faculty=instance.faculty,
                term=instance.term,
                section=instance.section or 'A',
                department=instance.department,
                program=instance.program,
                status='DRAFT',
                outline_content={}
            )

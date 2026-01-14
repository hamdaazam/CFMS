from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Faculty
from courses.models import CourseCoordinatorAssignment


@receiver(post_delete, sender=Faculty)
def deactivate_user_when_faculty_removed(sender, instance, **kwargs):
    """Ensure removed faculty accounts cannot continue to access the system."""
    user = getattr(instance, 'user', None)
    if not user:
        return

    # Mark user inactive to block authentication attempts
    if user.is_active:
        user.is_active = False
        user.save(update_fields=['is_active'])

    # Soft-disable any remaining coordinator assignments linked to the account
    CourseCoordinatorAssignment.objects.filter(coordinator=user, is_active=True).update(is_active=False)

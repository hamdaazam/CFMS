from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Faculty
from courses.models import CourseCoordinatorAssignment


@receiver(post_delete, sender=Faculty)
def hard_delete_user_when_faculty_removed(sender, instance, **kwargs):
    """Hard delete the associated user account and related data when faculty is removed."""
    user = getattr(instance, 'user', None)
    if not user:
        return

    # Hard delete any remaining coordinator assignments linked to the account
    CourseCoordinatorAssignment.objects.filter(coordinator=user).delete()

    # Hard delete the associated user account
    try:
        user.delete()
    except Exception:
        # User may have already been deleted (e.g. from the view's destroy method)
        pass

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import RoleAssignmentRequest
from users.models import User
from course_folders.models import Notification


@receiver(post_save, sender=RoleAssignmentRequest)
def create_role_request_notifications(sender, instance: RoleAssignmentRequest, created, **kwargs):
    """Create notifications for HOD(s) and Admins whenever a new RoleAssignmentRequest is created.

    This centralizes notification creation so requests created from any code path (views, admin,
    serializers) will behave consistently.
    """
    # Only create notifications for newly created requests that are still pending
    if not created or instance.status != 'PENDING':
        return

    # Determine department: use explicit or derive from program
    department = instance.department
    if department is None and instance.program is not None:
        try:
            department = instance.program.department
        except Exception:
            department = None

    # Build title and message including request id so notifications are unique and traceable
    title = f"Role Assignment Request #{instance.id}"
    message = f"A new {instance.role} request for {instance.target_user.full_name} has been submitted by {instance.requested_by.full_name if instance.requested_by else 'System'}. (Request ID: {instance.id})"

    # Notify HOD(s) of the derived or explicit department
    if department:
        hods = User.objects.filter(role='HOD', department=department)
        for hod in hods:
            # Avoid creating duplicate notifications for the exact same request
            if not Notification.objects.filter(user=hod, title__icontains=f"#{instance.id}").exists():
                Notification.objects.create(
                    user=hod,
                    notification_type='OTHER',
                    title=title,
                    message=message,
                )

    # Also notify all active Admin users so the request appears in Admin notifications
    admins = User.objects.filter(role='ADMIN', is_active=True)
    for admin in admins:
        if not Notification.objects.filter(user=admin, title__icontains=f"#{instance.id}").exists():
            Notification.objects.create(
                user=admin,
                notification_type='OTHER',
                title=title,
                message=message,
            )

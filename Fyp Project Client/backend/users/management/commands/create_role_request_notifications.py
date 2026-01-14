from django.core.management.base import BaseCommand
from users.models import RoleAssignmentRequest, User
from course_folders.models import Notification


class Command(BaseCommand):
    help = 'Create notifications for pending RoleAssignmentRequest objects that do not have notifications yet.'

    def handle(self, *args, **options):
        created = 0
        skipped = 0
        qs = RoleAssignmentRequest.objects.filter(status='PENDING')
        for req in qs:
            # Skip if notifications already exist for this request (we use request id in title)
            if Notification.objects.filter(title__icontains=f"#{req.id}").exists():
                skipped += 1
                continue

            # derive department
            department = req.department or (req.program.department if req.program else None)

            title = f"Role Assignment Request #{req.id}"
            message = f"A new {req.role} request for {req.target_user.full_name} has been submitted by {req.requested_by.full_name if req.requested_by else 'System'}. (Request ID: {req.id})"

            if department:
                hods = User.objects.filter(role='HOD', department=department)
                for hod in hods:
                    Notification.objects.create(
                        user=hod,
                        notification_type='OTHER',
                        title=title,
                        message=message,
                    )

            # Admin notifications
            admins = User.objects.filter(role='ADMIN', is_active=True)
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    notification_type='OTHER',
                    title=title,
                    message=message,
                )

            created += 1

        self.stdout.write(self.style.SUCCESS(f'Notifications created: {created}, skipped: {skipped}'))

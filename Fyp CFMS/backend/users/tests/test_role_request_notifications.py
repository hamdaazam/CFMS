from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User, RoleAssignmentRequest
from course_folders.models import Notification
from departments.models import Department


class RoleRequestNotificationTests(TestCase):
    def setUp(self):
        # Department
        self.dept = Department.objects.create(name='Test Dept')

        # Admin user
        self.admin = User.objects.create(
            full_name='Admin User',
            email='admin@example.com',
            cnic='1234567890123',
            role='ADMIN',
            is_active=True
        )

        # Another admin to ensure we notify all admins
        self.admin2 = User.objects.create(
            full_name='Admin Two',
            email='admin2@example.com',
            cnic='1234567890124',
            role='ADMIN',
            is_active=True
        )

        # HOD for department
        self.hod = User.objects.create(
            full_name='HOD User',
            email='hod@example.com',
            cnic='1234567890125',
            role='HOD',
            department=self.dept,
            is_active=True
        )

        # Target user
        self.target = User.objects.create(
            full_name='Target User',
            email='target@example.com',
            cnic='1234567890126',
            role='FACULTY',
            is_active=True
        )

        # Program under department
        from programs.models import Program
        self.program = Program.objects.create(title='Test Program', short_code='TP', department=self.dept)

        self.client = APIClient()

    def test_role_request_create_endpoint_notifies_hod_and_admins(self):
        # Admin creates a role assignment request via /api/users/role-requests/
        self.client.force_authenticate(self.admin)
        data = {
            'target_user': self.target.id,
            'role': 'COORDINATOR',
            'department': self.dept.id,
            'program': self.program.id,
        }
        resp = self.client.post('/api/auth/role-requests/', data, format='json')
        self.assertEqual(resp.status_code, 201)

        # A RoleAssignmentRequest should exist
        reqs = RoleAssignmentRequest.objects.filter(target_user=self.target)
        self.assertTrue(reqs.exists())

        # HOD should have a notification
        self.assertTrue(Notification.objects.filter(user=self.hod, title__icontains='Role Assignment').exists())

        # Admins should be notified
        self.assertTrue(Notification.objects.filter(user=self.admin).exists())
        self.assertTrue(Notification.objects.filter(user=self.admin2).exists())

    def test_partial_update_user_creates_request_and_notifies(self):
        # Admin triggers a role assignment via PATCH to /api/users/{id}/
        self.client.force_authenticate(self.admin)
        data = {
            'role': 'CONVENER',
            'department': self.dept.id
        }
        resp = self.client.patch(f'/api/auth/users/{self.target.id}/', data, format='json')
        # Backend returns 200 with message
        self.assertIn(resp.status_code, (200, 201))

        # Check request exists
        self.assertTrue(RoleAssignmentRequest.objects.filter(target_user=self.target, role='CONVENER').exists())

        # HOD and admins notified
        self.assertTrue(Notification.objects.filter(user=self.hod, title__icontains='Role Assignment').exists())
        self.assertTrue(Notification.objects.filter(user=self.admin).exists())

    def test_create_coordinator_request_with_program_notifies_hod(self):
        # Admin creates a coordinator request specifying only a program (no department)
        self.client.force_authenticate(self.admin)
        data = {
            'target_user': self.target.id,
            'role': 'COORDINATOR',
            'program': self.program.id
        }
        resp = self.client.post('/api/auth/role-requests/', data, format='json')
        self.assertEqual(resp.status_code, 201)

        # The request should exist
        self.assertTrue(RoleAssignmentRequest.objects.filter(target_user=self.target, role='COORDINATOR', program=self.program).exists())

        # HOD for the program's department should have notification
        self.assertTrue(Notification.objects.filter(user=self.hod, title__icontains='Role Assignment').exists())

    def test_management_command_creates_notifications_for_existing_requests(self):
        # Create a pending role request (signal creates notifications)
        req = RoleAssignmentRequest.objects.create(
            requested_by=self.admin,
            target_user=self.target,
            role='COORDINATOR',
            department=self.dept,
            program=self.program
        )

        # Ensure signal created notifications
        self.assertTrue(Notification.objects.filter(title__icontains=f'#{req.id}').exists())

        # Delete notifications to simulate old requests created earlier (no notifications)
        Notification.objects.filter(title__icontains=f'#{req.id}').delete()
        self.assertFalse(Notification.objects.filter(title__icontains=f'#{req.id}').exists())

        # Run management command to create missing notifications
        from django.core.management import call_command
        call_command('create_role_request_notifications')

        # Notifications should be created again for HOD and Admins
        self.assertTrue(Notification.objects.filter(title__icontains=f'#{req.id}', user=self.hod).exists())
        self.assertTrue(Notification.objects.filter(title__icontains=f'#{req.id}', user=self.admin).exists())

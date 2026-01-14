from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User
from faculty.models import Faculty
from departments.models import Department
from programs.models import Program


class FacultyDeleteTests(APITestCase):
    def setUp(self):
        # Create an admin user
        self.admin_user = User.objects.create_superuser(
            cnic="1234567890123",
            full_name="Admin User",
            password="password123",
            email="admin@example.com",
            role="ADMIN"
        )
        # Create department and program
        self.dept = Department.objects.create(name="CS", short_code="CS")
        self.prog = Program.objects.create(title="BSCS", short_code="BSCS", department=self.dept)

        # Create a regular user and faculty profile
        self.user = User.objects.create_user(
            cnic="9876543210987",
            full_name="Test Faculty",
            password="password123",
            email="faculty@example.com",
            role="FACULTY",
            department=self.dept,
            program=self.prog,
        )
        self.faculty = Faculty.objects.create(user=self.user, designation='FACULTY', department=self.dept, program=self.prog)

        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)

    def test_delete_by_numeric_id_succeeds(self):
        url = reverse('faculty-detail', kwargs={'pk': self.faculty.id})
        response = self.client.delete(url)
        self.assertIn(response.status_code, (status.HTTP_204_NO_CONTENT, status.HTTP_200_OK))
        # Verify the faculty and user are deleted
        self.assertFalse(Faculty.objects.filter(id=self.faculty.id).exists())
        self.assertFalse(User.objects.filter(id=self.user.id).exists())

    def test_delete_by_faculty_id_string_returns_404(self):
        # faculty_id is a string like 'CS-001'
        faculty_id_str = self.faculty.faculty_id
        url = f"/api/faculty/{faculty_id_str}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


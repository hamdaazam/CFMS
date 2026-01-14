from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User
from departments.models import Department
from programs.models import Program
from courses.models import Course, CourseAllocation
from terms.models import Term
from faculty.models import Faculty
from .models import CourseFolder, Notification


class FacultyNotificationTests(APITestCase):
	def setUp(self):
		# Create an admin user
		self.admin = User.objects.create_superuser(
			cnic='1111111111111', full_name='Admin', password='adminpass', email='a@a.com', role='ADMIN'
		)

		# Create department, program, term, course and a faculty user
		self.dept = Department.objects.create(name='TestDept', short_code='TD')
		self.prog = Program.objects.create(title='TestProg', short_code='TP', department=self.dept)
		from datetime import date
		self.term = Term.objects.create(session_term='2025-Fall', is_active=True, start_date=date(2025,8,1), end_date=date(2025,12,31))
		self.course = Course.objects.create(code='TST101', title='Test Course', department=self.dept, program=self.prog)

		# Create faculty user and profile
		self.fac_user = User.objects.create_user(cnic='2222222222222', full_name='Faculty User', password='facpass', email='f@f.com', role='FACULTY', department=self.dept, program=self.prog)
		self.faculty = Faculty.objects.create(user=self.fac_user, designation='Lecturer', department=self.dept, program=self.prog)

		# Create allocation so a folder can be created
		self.allocation = CourseAllocation.objects.create(course=self.course, faculty=self.faculty, section='A', department=self.dept, program=self.prog, term=self.term)

		self.client = APIClient()

	def test_admin_receives_notification_on_folder_create(self):
		self.client.force_authenticate(user=self.fac_user)
		# create a fresh allocation to avoid interference from other tests
		extra_course = Course.objects.create(code='TST201', title='Other Course', department=self.dept, program=self.prog)
		new_alloc = CourseAllocation.objects.create(course=extra_course, faculty=self.faculty, section='B', department=self.dept, program=self.prog, term=self.term)

		url = reverse('coursefolder-list')
		# Sanity-check that no folder exists already for this allocation and term
		existing = CourseFolder.objects.filter(course_allocation=new_alloc, term=self.term)
		if existing.exists():
			self.fail(f"Pre-existing folder found for allocation {new_alloc.id}, term {self.term.id}: {list(existing.values_list('id', flat=True))}")
		payload = {
			'course_allocation': new_alloc.id,
			'course': extra_course.id,
			'term': self.term.id,
			'section': 'B',
			'department': self.dept.id,
			'program': self.prog.id
		}

		resp = self.client.post(url, payload, format='json')
		if resp.status_code != status.HTTP_201_CREATED:
			self.fail(f"Failed to create folder via API: {resp.status_code} - {resp.data}")

		# Admin should have at least one notification for folder creation
		admin_notifications = Notification.objects.filter(user=self.admin, notification_type='OTHER', folder__course=self.course)
		self.assertTrue(admin_notifications.exists(), 'Admin did not receive folder create notification')

	def test_admin_receives_notification_on_folder_submit(self):
		# create folder first
		# Create a dedicated allocation for this test so uniqueness is not violated
		folder_alloc = CourseAllocation.objects.create(course=self.course, faculty=self.faculty, section='C', department=self.dept, program=self.prog, term=self.term)
		# Ensure no pre-existing folder for folder_alloc/term
		if CourseFolder.objects.filter(course_allocation=folder_alloc, term=self.term).exists():
			self.fail('Found an unexpected pre-existing folder for folder_alloc in test setup')
		folder = CourseFolder.objects.create(course_allocation=folder_alloc, course=self.course, faculty=self.faculty, term=self.term, section='C', department=self.dept, program=self.prog)

		self.client.force_authenticate(user=self.fac_user)
		url = reverse('coursefolder-submit', kwargs={'pk': folder.id})
		resp = self.client.post(url, {'skip_validation': '1'}, format='json')
		self.assertIn(resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))

		admin_notifications = Notification.objects.filter(user=self.admin, notification_type='FOLDER_SUBMITTED', folder=folder)
		self.assertTrue(admin_notifications.exists(), 'Admin did not receive folder submit notification')


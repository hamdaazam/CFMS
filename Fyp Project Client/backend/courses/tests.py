from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from datetime import date, timedelta

from departments.models import Department
from programs.models import Program
from terms.models import Term
from faculty.models import Faculty
from .models import CourseAllocation, Course
from .serializers import CourseAllocationSerializer


class CourseAllocationDuplicateTest(TestCase):
	def setUp(self):
		User = get_user_model()
		self.dept = Department.objects.create(name='Test Dept', short_code='TST')
		self.program = Program.objects.create(title='Test Program', short_code='TP', department=self.dept)
		today = date.today()
		self.term = Term.objects.create(
			session_term='2025-FA',
			start_date=today,
			end_date=today + timedelta(days=120),
			is_active=True
		)
		self.course = Course.objects.create(code='TST101', title='Test Course', department=self.dept, program=self.program)
		self.user = User.objects.create_user(cnic='1111111111111', full_name='Test Faculty', password='testpass')
		self.faculty = Faculty.objects.create(user=self.user, department=self.dept, program=self.program, designation='FACULTY')

	def test_duplicate_allocation_blocked(self):
		# Create initial allocation
		CourseAllocation.objects.create(
			course=self.course,
			faculty=self.faculty,
			section='A',
			department=self.dept,
			program=self.program,
			term=self.term
		)

		# Attempt to create duplicate allocation using serializer
		data = {
			'course': self.course.id,
			'faculty': self.faculty.id,
			'section': 'A',
			'department': self.dept.id,
			'program': self.program.id,
			'term': self.term.id,
		}
		serializer = CourseAllocationSerializer(data=data)
		valid = serializer.is_valid()
		self.assertFalse(valid)
		error_text = str(serializer.errors).lower()
		# Accept either the custom message or the default UniqueTogetherValidator message
		self.assertTrue(
			'already allocated' in error_text or 'the fields course, faculty, section, term must make a unique set' in error_text or 'unique' in error_text
		)


class CourseAllocationAPITest(TestCase):
	def setUp(self):
		User = get_user_model()
		self.dept = Department.objects.create(name='Test Dept', short_code='TST')
		self.program = Program.objects.create(title='Test Program', short_code='TP', department=self.dept)
		today = date.today()
		self.term = Term.objects.create(
			session_term='2025-FA',
			start_date=today,
			end_date=today + timedelta(days=120),
			is_active=True
		)
		self.course = Course.objects.create(code='TST101', title='Test Course', department=self.dept, program=self.program)
		self.user = User.objects.create_user(cnic='2222222222222', full_name='API Test Faculty', password='testpass')
		self.faculty = Faculty.objects.create(user=self.user, department=self.dept, program=self.program, designation='FACULTY')
		self.client = APIClient()
		self.client.force_authenticate(user=self.user)

	def test_api_duplicate_allocation_blocked(self):
		url = '/api/courses/allocations/'
		payload = {
			'course': self.course.id,
			'faculty': self.faculty.id,
			'section': 'A',
			'department': self.dept.id,
			'program': self.program.id,
			'term': self.term.id,
			'is_active': True,
		}
		# Create first allocation
		resp1 = self.client.post(url, payload, format='json')
		self.assertEqual(resp1.status_code, 201, f"Unexpected status {resp1.status_code}: {resp1.data}")

		# Attempt duplicate allocation
		resp2 = self.client.post(url, payload, format='json')
		self.assertEqual(resp2.status_code, 400)
		# Confirm error message contains 'unique' or 'already allocated'
		msg = str(resp2.data).lower()
		self.assertTrue(
			'already allocated' in msg or 'the fields course, faculty, section, term must make a unique set' in msg or 'unique' in msg
		)

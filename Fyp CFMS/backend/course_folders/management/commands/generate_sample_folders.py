from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from course_folders.models import CourseFolder, FolderComponent, Assessment, CourseLogEntry
from courses.models import Course, CourseAllocation
from terms.models import Term
from departments.models import Department
from programs.models import Program
from faculty.models import Faculty
from users.models import User


class Command(BaseCommand):
    help = 'Generate sample course folder data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Delete existing sample data before creating new',
        )

    def handle(self, *args, **options):
        if options['clean']:
            self.stdout.write('Cleaning existing data...')
            CourseFolder.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('✓ Cleaned existing data'))

        self.stdout.write('Generating sample data...')

        # Create sample term if not exists
        term, created = Term.objects.get_or_create(
            session_term='Fall 2024',
            defaults={
                'start_date': timezone.now().date(),
                'end_date': (timezone.now() + timedelta(days=120)).date(),
                'is_active': True
            }
        )
        if created:
            self.stdout.write(f'Created term: {term.session_term}')

        # Get first department and program
        department = Department.objects.first()
        program = Program.objects.first()

        if not department or not program:
            self.stdout.write(self.style.ERROR('Please create at least one department and program first'))
            return

        # Get all faculty members
        faculty_members = Faculty.objects.all()[:3]  # Get up to 3 faculty
        
        if not faculty_members:
            self.stdout.write(self.style.ERROR('Please create faculty members first'))
            return

        # Get all courses
        courses = Course.objects.all()[:5]  # Get up to 5 courses
        
        if not courses:
            self.stdout.write(self.style.ERROR('Please create courses first'))
            return

        # Create course allocations with terms if they don't exist
        allocations = []
        for i, course in enumerate(courses):
            faculty = faculty_members[i % len(faculty_members)]
            
            allocation, created = CourseAllocation.objects.get_or_create(
                course=course,
                faculty=faculty,
                term=term,
                section=f'A',
                defaults={
                    'department': department,
                    'program': program,
                    'is_active': True
                }
            )
            allocations.append(allocation)
            
            if created:
                self.stdout.write(f'Created allocation: {course.code} - {faculty.user.full_name}')

        # Create sample folders for each allocation
        folders_created = 0
        for allocation in allocations:
            # Check if folder already exists
            if CourseFolder.objects.filter(course_allocation=allocation, term=term).exists():
                self.stdout.write(f'Folder already exists for {allocation.course.code}')
                continue

            folder = CourseFolder.objects.create(
                course=allocation.course,
                course_allocation=allocation,
                faculty=allocation.faculty,
                term=term,
                section=allocation.section,
                department=department,
                program=program,
                status='DRAFT'
            )
            folders_created += 1

            # Create sample course log entries
            for i in range(1, 4):  # Create 3 sample logs
                CourseLogEntry.objects.create(
                    folder=folder,
                    lecture_number=i,
                    date=timezone.now().date() - timedelta(days=(10 - i * 3)),
                    duration=50,
                    topics_covered=f'Sample lecture {i} topics covered',
                    evaluation_instrument='Quiz' if i % 2 == 0 else 'Assignment'
                )

            self.stdout.write(f'Created folder with logs for {allocation.course.code}')

        self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully created {folders_created} course folders with sample data'))
        self.stdout.write(self.style.SUCCESS(f'✓ Term: {term.session_term}'))
        self.stdout.write(self.style.SUCCESS(f'✓ Department: {department.name}'))
        self.stdout.write(self.style.SUCCESS(f'✓ Program: {program.title if program else "N/A"}'))
        self.stdout.write(self.style.WARNING('\nNote: You still need to upload files (components and assessments) manually or via API'))

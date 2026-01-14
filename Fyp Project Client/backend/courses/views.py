from rest_framework import viewsets, filters, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
import pandas as pd
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from departments.models import Department
from programs.models import Program
from faculty.models import Faculty
from users.models import User
from .models import Course, CourseAllocation, CourseCoordinatorAssignment
from .serializers import (
    CourseSerializer,
    CourseCreateUpdateSerializer,
    CourseAllocationSerializer,
    CourseCoordinatorAssignmentSerializer,
)


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department', 'program', 'course_type', 'is_active']
    search_fields = ['code', 'title', 'description']
    ordering_fields = ['code', 'title', 'credit_hours', 'created_at']
    ordering = ['code']

    def get_queryset(self):
        # By default, only show active courses
        queryset = Course.objects.filter(is_active=True)
        
        # Apply filters from query params
        for field in ['department', 'program', 'course_type']:
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        
        # Allow explicit query for inactive courses
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None and is_active.lower() == 'false':
            queryset = Course.objects.filter(is_active=False)
        
        return queryset

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CourseCreateUpdateSerializer
        return CourseSerializer
    
    def destroy(self, request, *args, **kwargs):
        """
        Completely delete course from database
        """
        course = self.get_object()
        course.delete()
        
        return Response(
            {'message': 'Course deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )


class CourseAllocationViewSet(viewsets.ModelViewSet):
    queryset = CourseAllocation.objects.all()
    serializer_class = CourseAllocationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['course', 'faculty', 'department', 'program', 'term', 'section', 'is_active']
    search_fields = ['course__code', 'course__title', 'faculty__user__full_name', 'section']
    ordering_fields = ['created_at', 'course__code', 'section']
    ordering = ['-created_at']

    def get_queryset(self):
        # By default, only show active allocations
        queryset = CourseAllocation.objects.filter(is_active=True)
        
        # Apply filters from query params
        for field in ['course', 'faculty', 'department', 'program', 'term', 'section']:
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        
        # Allow explicit query for inactive allocations
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None and is_active.lower() == 'false':
            queryset = CourseAllocation.objects.filter(is_active=False)
        
        return queryset
    
    def destroy(self, request, *args, **kwargs):
        """
        Completely delete course allocation from database
        """
        allocation = self.get_object()
        allocation.delete()
        
        return Response(
            {'message': 'Course allocation deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )

    @action(detail=False, methods=['get'], url_path='my-courses')
    def my_courses(self, request):
        """
        Get courses allocated to the logged-in faculty member
        """
        user = request.user
        
        # Check if user has a faculty profile
        if not hasattr(user, 'faculty_profile'):
            return Response({
                'detail': 'User does not have a faculty profile',
                'courses': []
            }, status=200)
        
        # Get allocations for this faculty member
        allocations = CourseAllocation.objects.filter(
            faculty=user.faculty_profile,
            is_active=True
        ).select_related(
            'course',
            'course__department',
            'course__program',
            'department',
            'program',
            'term'
        ).order_by('-created_at')
        
        serializer = self.get_serializer(allocations, many=True)
        return Response({
            'count': allocations.count(),
            'results': serializer.data
        })

    @action(detail=False, methods=['get'], url_path='coordinator-assignments')
    def coordinator_assignments(self, request):
        """Return active coordinator-course assignments with optional filters."""
        queryset = CourseCoordinatorAssignment.objects.select_related(
            'course', 'department', 'program', 'coordinator', 'assigned_by'
        ).order_by('-assigned_at')

        # Default to active assignments unless explicitly requested otherwise
        if 'is_active' in request.query_params:
            active_param = request.query_params.get('is_active', 'true').lower()
            if active_param in ('false', '0', 'no'):
                queryset = queryset.filter(is_active=False)
            else:
                queryset = queryset.filter(is_active=True)
        else:
            queryset = queryset.filter(is_active=True)

        for field in ['coordinator', 'course', 'department', 'program', 'term']:
            value = request.query_params.get(field)
            if value not in (None, '', 'null'):
                queryset = queryset.filter(**{field: value})

        serializer = CourseCoordinatorAssignmentSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })


class IsAdminOrStaff(permissions.BasePermission):
    """
    Allow only admin/staff users (is_staff=True or role='ADMIN')
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, 'is_staff', False) or getattr(request.user, 'role', '') == 'ADMIN'


class CourseExcelUploadView(APIView):
    """
    Admin-only endpoint to bulk create courses from an Excel (.xlsx) file.
    Required columns (case-insensitive):
      - code
      - title
      - credit_hours
      - course_type (THEORY / LAB / HYBRID)
      - department (name)
      - program (title, optional)
    Optional columns:
      - description
      - pre_requisites
    """

    permission_classes = [IsAuthenticated, IsAdminOrStaff]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        file_obj = request.FILES.get('file') or request.FILES.get('excel_file')
        if not file_obj:
            return Response({'detail': 'No file provided. Upload an .xlsx file.'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.lower().endswith('.xlsx'):
            return Response({'detail': 'Invalid file type. Please upload a .xlsx Excel file.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(file_obj)
        except Exception as exc:
            return Response({'detail': f'Failed to read Excel file: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

        required_columns = ['code', 'title', 'credit_hours', 'course_type', 'department']
        missing = [col for col in required_columns if col not in df.columns.str.lower()]
        # Normalize columns to lowercase for safe access
        df.columns = [str(c).strip().lower() for c in df.columns]
        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            return Response({'detail': f'Missing required columns: {", ".join(missing)}'}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        skipped = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                code = str(row.get('code', '')).strip().upper()
                title = str(row.get('title', '')).strip()
                dept_name = str(row.get('department', '')).strip()
                program_title = str(row.get('program', '')).strip() if 'program' in df.columns else ''
                course_type_raw = str(row.get('course_type', '')).strip().upper()
                credit_hours_raw = row.get('credit_hours', 3)
                description = str(row.get('description', '')).strip() if 'description' in df.columns else ''
                pre_requisites = str(row.get('pre_requisites', '')).strip() if 'pre_requisites' in df.columns else ''

                if not code or not title or not dept_name or not course_type_raw:
                    skipped += 1
                    errors.append({'row': int(idx) + 2, 'error': 'Missing required fields'})
                    continue

                # Validate course type
                valid_types = {'THEORY', 'LAB', 'HYBRID'}
                if course_type_raw not in valid_types:
                    skipped += 1
                    errors.append({'row': int(idx) + 2, 'error': f'Invalid course_type "{course_type_raw}". Use THEORY/LAB/HYBRID.'})
                    continue

                # Parse credit hours
                try:
                    credit_hours = int(credit_hours_raw)
                except Exception:
                    skipped += 1
                    errors.append({'row': int(idx) + 2, 'error': 'credit_hours must be an integer'})
                    continue

                # Find department
                try:
                    department = Department.objects.get(name__iexact=dept_name)
                except Department.DoesNotExist:
                    skipped += 1
                    errors.append({'row': int(idx) + 2, 'error': f'Department "{dept_name}" not found'})
                    continue

                # Find program (optional)
                program = None
                if program_title:
                    try:
                        program = Program.objects.get(title__iexact=program_title, department=department)
                    except Program.DoesNotExist:
                        skipped += 1
                        errors.append({'row': int(idx) + 2, 'error': f'Program "{program_title}" not found in department "{dept_name}"'})
                        continue
                    except Program.MultipleObjectsReturned:
                        skipped += 1
                        errors.append({'row': int(idx) + 2, 'error': f'Multiple programs named "{program_title}" in department "{dept_name}"'})
                        continue

                # Skip if course code exists
                if Course.objects.filter(code__iexact=code).exists():
                    skipped += 1
                    continue

                Course.objects.create(
                    code=code,
                    title=title,
                    credit_hours=credit_hours,
                    course_type=course_type_raw,
                    department=department,
                    program=program,
                    description=description,
                    pre_requisites=pre_requisites
                )
                created += 1

            except Exception as exc:
                errors.append({'row': int(idx) + 2, 'error': str(exc)})
                skipped += 1

        return Response(
            {
                'created': created,
                'skipped': skipped,
                'errors': errors,
                'message': f'Courses created: {created}, skipped: {skipped}'
            },
            status=status.HTTP_200_OK
        )


class CourseAllocationExcelUploadView(APIView):
    """
    Admin-only endpoint to bulk create course allocations from an Excel (.xlsx) file.
    Required columns (case-insensitive):
      - course_code (or course)
      - faculty_name (or faculty_email)
      - section
      - department (name)
    Optional columns:
      - program (title)
      - coordinator (coordinator name - if provided, creates CourseCoordinatorAssignment)
    """
    
    permission_classes = [IsAuthenticated, IsAdminOrStaff]
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        file_obj = request.FILES.get('file') or request.FILES.get('excel_file')
        if not file_obj:
            return Response(
                {'detail': 'No file provided. Upload an .xlsx file.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not file_obj.name.lower().endswith('.xlsx'):
            return Response(
                {'detail': 'Invalid file type. Please upload a .xlsx Excel file.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            df = pd.read_excel(file_obj)
        except Exception as exc:
            return Response(
                {'detail': f'Failed to read Excel file: {exc}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Normalize columns to lowercase for safe access
        df.columns = [str(c).strip().lower() for c in df.columns]
        
        # Check for required columns (allow variations)
        has_course_code = 'course_code' in df.columns or 'course' in df.columns
        has_faculty_name = 'faculty_name' in df.columns or 'faculty' in df.columns or 'instructor' in df.columns
        has_faculty_email = 'faculty_email' in df.columns or 'email' in df.columns
        has_section = 'section' in df.columns
        has_department = 'department' in df.columns
        
        if not has_course_code:
            return Response(
                {'detail': 'Missing required column: course_code (or course)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not has_faculty_name and not has_faculty_email:
            return Response(
                {'detail': 'Missing required column: faculty_name (or faculty_email)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not has_section:
            return Response(
                {'detail': 'Missing required column: section'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not has_department:
            return Response(
                {'detail': 'Missing required column: department'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created = 0
        skipped = 0
        errors = []
        
        # Get active term (will be used if term not provided in Excel)
        from terms.models import Term
        active_term = Term.objects.filter(is_active=True).order_by('-start_date').first()
        
        for idx, row in df.iterrows():
            row_num = int(idx) + 2  # Excel row number (accounting for header)
            try:
                # Get course code
                course_code = str(row.get('course_code') or row.get('course', '')).strip().upper()
                if not course_code:
                    skipped += 1
                    errors.append({'row': row_num, 'error': 'Missing course_code'})
                    continue
                
                # Get faculty identifier (name or email)
                faculty_name = str(row.get('faculty_name') or row.get('faculty') or row.get('instructor', '')).strip()
                faculty_email = str(row.get('faculty_email') or row.get('email', '')).strip()
                
                if not faculty_name and not faculty_email:
                    skipped += 1
                    errors.append({'row': row_num, 'error': 'Missing faculty_name or faculty_email'})
                    continue
                
                # Get section
                section = str(row.get('section', '')).strip()
                if not section:
                    skipped += 1
                    errors.append({'row': row_num, 'error': 'Missing section'})
                    continue
                
                # Get department
                dept_name = str(row.get('department', '')).strip()
                if not dept_name:
                    skipped += 1
                    errors.append({'row': row_num, 'error': 'Missing department'})
                    continue
                
                # Get program (optional)
                program_title = str(row.get('program', '')).strip() if 'program' in df.columns else ''
                
                # Get coordinator identifier (name or email) (optional)
                coordinator_identifier = str(row.get('coordinator', '')).strip() if 'coordinator' in df.columns else ''
                
                # Find course
                try:
                    course = Course.objects.get(code__iexact=course_code, is_active=True)
                except Course.DoesNotExist:
                    skipped += 1
                    errors.append({'row': row_num, 'error': f'Course "{course_code}" not found'})
                    continue
                except Course.MultipleObjectsReturned:
                    course = Course.objects.filter(code__iexact=course_code, is_active=True).first()
                
                # Find department
                try:
                    department = Department.objects.get(name__iexact=dept_name)
                except Department.DoesNotExist:
                    skipped += 1
                    errors.append({'row': row_num, 'error': f'Department "{dept_name}" not found'})
                    continue
                
                # Find program (optional)
                program = None
                if program_title:
                    try:
                        program = Program.objects.get(title__iexact=program_title, department=department)
                    except Program.DoesNotExist:
                        # Program not found, but continue without it
                        pass
                    except Program.MultipleObjectsReturned:
                        program = Program.objects.filter(title__iexact=program_title, department=department).first()
                
                # Find faculty by name or email
                faculty = None
                if faculty_email:
                    try:
                        user = User.objects.get(email__iexact=faculty_email)
                        if hasattr(user, 'faculty_profile'):
                            faculty = user.faculty_profile
                        else:
                            skipped += 1
                            errors.append({'row': row_num, 'error': f'User with email "{faculty_email}" is not a faculty member'})
                            continue
                    except User.DoesNotExist:
                        pass
                    except User.MultipleObjectsReturned:
                        user = User.objects.filter(email__iexact=faculty_email).first()
                        if user and hasattr(user, 'faculty_profile'):
                            faculty = user.faculty_profile
                
                if not faculty and faculty_name:
                    # Try to find by name
                    try:
                        user = User.objects.get(full_name__iexact=faculty_name)
                        if hasattr(user, 'faculty_profile'):
                            faculty = user.faculty_profile
                        else:
                            skipped += 1
                            errors.append({'row': row_num, 'error': f'User "{faculty_name}" is not a faculty member'})
                            continue
                    except User.DoesNotExist:
                        skipped += 1
                        errors.append({'row': row_num, 'error': f'Faculty member "{faculty_name}" not found'})
                        continue
                    except User.MultipleObjectsReturned:
                        # Try to match by department as well
                        user = User.objects.filter(
                            full_name__iexact=faculty_name,
                            faculty_profile__department=department
                        ).first()
                        if user and hasattr(user, 'faculty_profile'):
                            faculty = user.faculty_profile
                        else:
                            skipped += 1
                            errors.append({'row': row_num, 'error': f'Multiple faculty members named "{faculty_name}" found. Please use email.'})
                            continue
                
                if not faculty:
                    skipped += 1
                    errors.append({'row': row_num, 'error': 'Could not find faculty member'})
                    continue
                
                # Check if allocation already exists (check with term if available, otherwise check all active allocations)
                if active_term:
                    existing_allocation = CourseAllocation.objects.filter(
                        course=course,
                        faculty=faculty,
                        section=section,
                        term=active_term,
                        is_active=True
                    ).first()
                else:
                    # If no active term, check for any active allocation with same course, faculty, and section
                    existing_allocation = CourseAllocation.objects.filter(
                        course=course,
                        faculty=faculty,
                        section=section,
                        is_active=True
                    ).first()
                
                if existing_allocation:
                    skipped += 1
                    term_info = f" (Term: {existing_allocation.term.session_term if existing_allocation.term else 'No Term'})" if existing_allocation.term else ""
                    errors.append({
                        'row': row_num,
                        'error': f'Allocation already exists for {course.code} - {faculty.user.full_name} (Section {section}){term_info}'
                    })
                    continue
                
                # Create course allocation
                allocation = CourseAllocation.objects.create(
                    course=course,
                    faculty=faculty,
                    section=section,
                    department=department,
                    program=program,
                    term=active_term,
                    is_active=True
                )
                
                # If coordinator identifier (name or email) is provided, create coordinator assignment
                if coordinator_identifier:
                    coordinator_user = None
                    coordinator_error = None
                    
                    # Check if identifier is an email (contains @)
                    if '@' in coordinator_identifier:
                        # Look up by email
                        try:
                            coordinator_user = User.objects.get(email__iexact=coordinator_identifier)
                        except User.DoesNotExist:
                            coordinator_error = f'Coordinator with email "{coordinator_identifier}" not found. Allocation created but coordinator assignment skipped.'
                        except User.MultipleObjectsReturned:
                            coordinator_user = User.objects.filter(email__iexact=coordinator_identifier).first()
                            if not coordinator_user:
                                coordinator_error = f'Multiple users with email "{coordinator_identifier}" found. Allocation created but coordinator assignment skipped.'
                    else:
                        # Look up by name
                        try:
                            coordinator_user = User.objects.get(full_name__iexact=coordinator_identifier)
                        except User.DoesNotExist:
                            coordinator_error = f'Coordinator "{coordinator_identifier}" not found. Allocation created but coordinator assignment skipped.'
                        except User.MultipleObjectsReturned:
                            # Try to match by department
                            coordinator_user = User.objects.filter(
                                full_name__iexact=coordinator_identifier,
                                faculty_profile__department=department
                            ).first()
                            if not coordinator_user:
                                coordinator_error = f'Multiple users named "{coordinator_identifier}" found. Please use email. Allocation created but coordinator assignment skipped.'
                    
                    if coordinator_error:
                        errors.append({
                            'row': row_num,
                            'error': coordinator_error
                        })
                    elif coordinator_user:
                        # Create or update coordinator assignment
                        assignment, created_assignment = CourseCoordinatorAssignment.objects.get_or_create(
                            coordinator=coordinator_user,
                            course=course,
                            term=active_term,
                            defaults={
                                'department': department,
                                'program': program,
                                'assigned_by': request.user,
                                'is_active': True
                            }
                        )
                        if not created_assignment:
                            # Update existing assignment
                            assignment.department = department
                            assignment.program = program
                            assignment.is_active = True
                            if request.user:
                                assignment.assigned_by = request.user
                            assignment.save()
                
                created += 1
                
            except Exception as exc:
                errors.append({'row': row_num, 'error': str(exc)})
                skipped += 1
        
        return Response(
            {
                'created': created,
                'skipped': skipped,
                'errors': errors,
                'message': f'Course allocations created: {created}, skipped: {skipped}'
            },
            status=status.HTTP_200_OK
        )

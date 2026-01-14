from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import Faculty
from .serializers import FacultySerializer, FacultyCreateSerializer
from users.models import User
from departments.models import Department
from programs.models import Program
import pandas as pd


class FacultyViewSet(viewsets.ModelViewSet):
    queryset = Faculty.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return FacultyCreateSerializer
        return FacultySerializer
    
    def get_queryset(self):
        queryset = Faculty.objects.select_related('user', 'department', 'program').filter(is_active=True)
        
        # Filter by department
        department_id = self.request.query_params.get('department', None)
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        
        # Filter by program
        program_id = self.request.query_params.get('program', None)
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        
        # Allow explicit query for inactive faculty (for admin purposes)
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            if is_active.lower() == 'false':
                queryset = Faculty.objects.select_related('user', 'department', 'program').filter(is_active=False)
            # Otherwise keep the default filter(is_active=True)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        faculty = serializer.save()
        
        # Return full faculty details
        output_serializer = FacultySerializer(faculty)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-profile')
    def my_profile(self, request):
        """
        Get the faculty profile for the logged-in user
        Endpoint: /api/faculty/my-profile/
        """
        user = request.user
        
        # Check if user has faculty profile
        if not hasattr(user, 'faculty_profile'):
            return Response({
                'detail': 'User does not have a faculty profile'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = FacultySerializer(user.faculty_profile)
        return Response(serializer.data)

    @action(detail=False, methods=['put', 'patch'], url_path='update-profile')
    def update_profile(self, request):
        """
        Update the faculty profile for the logged-in user
        Endpoint: /api/faculty/update-profile/
        """
        user = request.user
        
        # Check if user has faculty profile
        if not hasattr(user, 'faculty_profile'):
            return Response({
                'detail': 'User does not have a faculty profile'
            }, status=status.HTTP_404_NOT_FOUND)
        
        faculty = user.faculty_profile
        serializer = FacultySerializer(
            faculty, 
            data=request.data, 
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Profile updated successfully',
                'data': serializer.data
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        """
        Completely delete faculty and associated user from database
        """
        faculty = self.get_object()
        user = faculty.user
        
        # Delete the faculty record (this will cascade delete due to OneToOneField)
        faculty.delete()
        
        # Also delete the associated user account
        user.delete()
        
        return Response(
            {'message': 'Faculty and associated user deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )


class IsAdminOrStaff(permissions.BasePermission):
    """Permission class to allow only admin users (is_staff=True or role='ADMIN')"""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_staff or request.user.role == 'ADMIN'


class FacultyExcelUploadView(APIView):
    """
    Admin-only endpoint for bulk uploading faculty data from Excel file.
    
    Excel file should contain columns: name, email, department, role, cnic, program (optional), id (optional)
    - Accepts multipart/form-data
    - Creates User with role from Excel (FACULTY/CONVENER/HOD) if email/CNIC doesn't exist
    - Sets default password to 'Cust123' for all users
    - Creates Faculty record linked to the user
    - Skips duplicates safely (checks both email and CNIC)
    - Returns statistics: total created, skipped, and error rows
    """
    permission_classes = [IsAuthenticated, IsAdminOrStaff]
    
    def post(self, request):
        # Check if file is provided
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided. Please upload an Excel file.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        excel_file = request.FILES['file']
        
        # Validate file extension
        if not excel_file.name.endswith(('.xlsx', '.xls')):
            return Response(
                {'error': 'Invalid file format. Please upload an Excel file (.xlsx or .xls).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Statistics
        created_count = 0
        skipped_count = 0
        error_count = 0
        errors = []
        skipped_rows = []
        
        try:
            # Read Excel file
            df = pd.read_excel(excel_file)
            
            # Validate required columns
            required_columns = ['name', 'email', 'department', 'role', 'cnic']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response(
                    {
                        'error': f'Missing required columns: {", ".join(missing_columns)}',
                        'required_columns': required_columns,
                        'optional_columns': ['id', 'program'],
                        'found_columns': list(df.columns)
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Process each row
            for index, row in df.iterrows():
                row_num = index + 2  # Excel rows start at 1, plus header row
                name = None
                email = None
                department_name = None
                role = None
                program_name = None
                cnic = None
                excel_id = None
                
                try:
                    # Extract and clean data
                    name = str(row['name']).strip() if pd.notna(row['name']) else None
                    email = str(row['email']).strip().lower() if pd.notna(row['email']) else None
                    department_name = str(row['department']).strip() if pd.notna(row['department']) else None
                    role = str(row['role']).strip().upper() if pd.notna(row['role']) else None
                    
                    # Handle CNIC - may come as float from Excel scientific notation
                    cnic_raw = row['cnic']
                    if pd.isna(cnic_raw):
                        cnic = None
                    else:
                        # If it's a float (from scientific notation), convert to int first
                        if isinstance(cnic_raw, (int, float)):
                            # Convert float to int to remove decimal, then to string
                            cnic = str(int(float(cnic_raw)))
                        else:
                            # Already a string, just clean it
                            cnic = str(cnic_raw).strip()
                    
                    program_name = str(row['program']).strip() if 'program' in row and pd.notna(row['program']) else None
                    excel_id = str(row['id']).strip() if 'id' in row and pd.notna(row['id']) else None
                    
                    # Validate required fields
                    if not name or not email or not department_name or not role or not cnic:
                        error_count += 1
                        errors.append({
                            'row': row_num,
                            'email': email or 'N/A',
                            'name': name or 'N/A',
                            'error': 'Missing required field: name, email, department, role, or cnic'
                        })
                        continue
                    
                    # Validate and normalize CNIC
                    cnic = cnic.replace('-', '').replace(' ', '').replace('.', '').strip()
                    
                    # Remove any trailing zeros if it was a float (e.g., "1000000000000.0" -> "1000000000000")
                    if '.' in cnic:
                        cnic = cnic.split('.')[0]
                    
                    # Validate CNIC length and format
                    if len(cnic) != 13:
                        error_count += 1
                        errors.append({
                            'row': row_num,
                            'email': email,
                            'name': name,
                            'error': f'CNIC must be exactly 13 digits. Got {len(cnic)} characters: "{cnic}"'
                        })
                        continue
                    if not cnic.isdigit():
                        error_count += 1
                        errors.append({
                            'row': row_num,
                            'email': email,
                            'name': name,
                            'error': f'CNIC must contain only numbers. Got: "{cnic}"'
                        })
                        continue
                    
                    # Check if user with CNIC already exists
                    if User.objects.filter(cnic=cnic).exists():
                        skipped_count += 1
                        skipped_rows.append({
                            'row': row_num,
                            'email': email,
                            'name': name,
                            'reason': 'User with this CNIC already exists'
                        })
                        continue
                    
                    # Validate role
                    valid_roles = ['FACULTY', 'CONVENER', 'HOD']
                    if role not in valid_roles:
                        error_count += 1
                        errors.append({
                            'row': row_num,
                            'email': email,
                            'name': name,
                            'error': f'Invalid role "{role}". Must be one of: {", ".join(valid_roles)}'
                        })
                        continue
                    
                    # Validate email format
                    if '@' not in email:
                        error_count += 1
                        errors.append({
                            'row': row_num,
                            'email': email,
                            'name': name,
                            'error': 'Invalid email format'
                        })
                        continue
                    
                    # Check if user with email already exists
                    if User.objects.filter(email=email).exists():
                        skipped_count += 1
                        skipped_rows.append({
                            'row': row_num,
                            'email': email,
                            'name': name,
                            'reason': 'User with this email already exists'
                        })
                        continue
                    
                    # Find department by name (case-insensitive)
                    try:
                        department = Department.objects.get(name__iexact=department_name)
                    except Department.DoesNotExist:
                        error_count += 1
                        errors.append({
                            'row': row_num,
                            'email': email,
                            'name': name,
                            'error': f'Department "{department_name}" not found'
                        })
                        continue
                    except Department.MultipleObjectsReturned:
                        # If multiple departments found, take the first one
                        department = Department.objects.filter(name__iexact=department_name).first()
                    
                    # Find program by name if provided (case-insensitive)
                    program = None
                    if program_name:
                        try:
                            program = Program.objects.get(title__iexact=program_name, department=department)
                        except Program.DoesNotExist:
                            error_count += 1
                            errors.append({
                                'row': row_num,
                                'email': email,
                                'name': name,
                                'error': f'Program "{program_name}" not found in department "{department_name}"'
                            })
                            continue
                        except Program.MultipleObjectsReturned:
                            # If multiple programs found, take the first one
                            program = Program.objects.filter(title__iexact=program_name, department=department).first()
                    
                    # Set default password to Cust123
                    default_password = 'Cust123'
                    
                    # Create User with role from Excel
                    user = User.objects.create_user(
                        cnic=cnic,
                        full_name=name,
                        email=email,
                        role=role,  # Use role from Excel (FACULTY/CONVENER/HOD)
                        department=department,
                        program=program,  # Link program if provided
                        password=default_password
                    )
                    
                    # Map role to designation for Faculty model
                    # Faculty model uses designation field which should match role for these cases
                    designation_map = {
                        'FACULTY': 'FACULTY',
                        'CONVENER': 'CONVENER',
                        'HOD': 'HOD'
                    }
                    designation = designation_map.get(role, 'FACULTY')
                    
                    # Create Faculty record
                    Faculty.objects.create(
                        user=user,
                        department=department,
                        program=program,  # Link program if provided
                        designation=designation
                    )
                    
                    created_count += 1
                    
                except Exception as e:
                    error_count += 1
                    errors.append({
                        'row': row_num,
                        'email': email or 'N/A',
                        'name': name or 'N/A',
                        'error': str(e)
                    })
                    continue
            
            # Return response with statistics
            return Response({
                'message': 'Excel file processed successfully',
                'statistics': {
                    'total_rows': len(df),
                    'created': created_count,
                    'skipped': skipped_count,
                    'errors': error_count
                },
                'skipped_rows': skipped_rows if skipped_rows else None,
                'errors': errors if errors else None
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {
                    'error': f'Error processing Excel file: {str(e)}',
                    'detail': 'Please ensure the file is a valid Excel file with the correct format.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

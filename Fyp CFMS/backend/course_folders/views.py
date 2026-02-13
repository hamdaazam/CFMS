from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework import serializers
from django.utils import timezone
from django.db.models import Q, F
from .models import (
    CourseFolder, FolderComponent, Assessment, CourseLogEntry,
    AuditAssignment, FolderStatusHistory, Notification, FolderAccessRequest,
    FolderDeadline
)
from .serializers import (
    CourseFolderListSerializer, CourseFolderDetailSerializer,
    CourseFolderCreateSerializer, CourseFolderUpdateSerializer,
    CourseFolderBasicSerializer,
    FolderComponentSerializer, ComponentUploadSerializer,
    AssessmentSerializer, AssessmentUploadSerializer,
    CourseLogEntrySerializer, AuditAssignmentSerializer,
    FolderStatusHistorySerializer, NotificationSerializer, FolderAccessRequestSerializer,
    FolderDeadlineSerializer
)
from courses.models import CourseAllocation
from users.models import User
from django.core.files.base import ContentFile
import io
from datetime import datetime
from . import pdf_utils
import re

try:
    from PyPDF2 import PdfMerger, PdfReader
except Exception:  # pragma: no cover - environment fallback
    PdfMerger = None
    PdfReader = None

try:
    # Optional: for a nice cover page if installed
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
except Exception:  # pragma: no cover
    A4 = None
    canvas = None


class CourseFolderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Course Folder CRUD operations and workflow actions
    """
    permission_classes = [IsAuthenticated]

    def _get_coordinator_queryset(self, folder: CourseFolder):
        """Return coordinators mapped to the folder's course via CourseCoordinatorAssignment."""
        # Get coordinators via CourseCoordinatorAssignment (any role can be coordinator)
        from courses.models import CourseCoordinatorAssignment
        
        # Build query for coordinator assignments matching this folder
        coordinator_assignment_q = Q(
            course=folder.course,
            is_active=True
        )
        
        # Filter by term: either assignment has no term (applies to all) or matches folder's term
        if folder.term_id:
            coordinator_assignment_q &= (Q(term=folder.term) | Q(term__isnull=True))
        
        # Get coordinator assignments
        coordinator_assignments = CourseCoordinatorAssignment.objects.filter(coordinator_assignment_q)
        
        # Get coordinator user IDs
        coordinator_user_ids = coordinator_assignments.values_list('coordinator_id', flat=True)
        
        if not coordinator_user_ids:
            return User.objects.none()
        
        # Get users who are coordinators for this course
        coordinator_qs = User.objects.filter(
            id__in=coordinator_user_ids,
            is_active=True,
        )
        
        # Treat coordinators without an active faculty profile as unassigned
        coordinator_qs = coordinator_qs.filter(
            faculty_profile__isnull=False,
            faculty_profile__is_active=True,
        )

        return coordinator_qs.distinct()

    def _notify_admins(self, notification_type: str, title: str, message: str, folder: CourseFolder | None = None):
        """Create the same notification for all active admins to keep them informed of faculty actions.

        This central helper avoids duplicating notification creation logic across many endpoints.
        """
        try:
            admins = User.objects.filter(role='ADMIN', is_active=True)
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    notification_type=notification_type if notification_type in dict(Notification.NOTIFICATION_TYPE_CHOICES) else 'OTHER',
                    title=title,
                    message=message,
                    folder=folder
                )
        except Exception:
            # Non-fatal: do not block main flow if admin notification creation fails
            pass
    
    def get_queryset(self):
        user = self.request.user
        role = user.role

        # Capability-based: allow any user with audit access to fetch folders assigned to them for audit
        # via `assigned_to_me=1` regardless of their primary role.
        assigned_to_me = self.request.query_params.get('assigned_to_me')
        if assigned_to_me in ['1', 'true', 'True', 'yes'] and self._has_audit_access(user):
            qs = CourseFolder.objects.filter(audit_assignments__auditor=user).select_related(
                'course', 'faculty__user', 'term', 'department', 'program'
            ).distinct()
            return qs
        
        # Faculty-first access: some users may have AUDIT_MEMBER role but still have a faculty profile
        # and their own course allocations/folders. Allow them to access their own folders the same
        # way as faculty (capability-based multi-role).
        if role in ['FACULTY', 'AUDIT_MEMBER'] and getattr(user, 'faculty_profile', None):
            assigned_to_me = self.request.query_params.get('assigned_to_me')
            
            # If assigned_to_me is requested, show ONLY coordinator-assigned folders (for coordinator review)
            if assigned_to_me in ['1', 'true', 'True', 'yes']:
                from courses.models import CourseCoordinatorAssignment
                # Get coordinator assignments for this user
                coordinator_assignments = CourseCoordinatorAssignment.objects.filter(
                    coordinator=user,
                    is_active=True
                )
                
                if not coordinator_assignments.exists():
                    # No coordinator assignments, return empty queryset
                    base_qs = CourseFolder.objects.none()
                else:
                    # Build Q object for coordinator assignments - MUST match course exactly
                    coordinator_q = Q()
                    for assignment in coordinator_assignments:
                        # If assignment has a term, only match folders with that exact term
                        # If assignment has no term, match folders with any term for that course
                        if assignment.term_id:
                            coordinator_q |= Q(course_id=assignment.course_id, term_id=assignment.term_id)
                        else:
                            # Assignment applies to all terms for this course
                            coordinator_q |= Q(course_id=assignment.course_id)
                    
                    # CRITICAL: Only show folders for courses where this user is assigned as coordinator
                    # This ensures coordinators only see folders for their assigned courses
                    if coordinator_q:
                        base_qs = CourseFolder.objects.filter(coordinator_q)
                    else:
                        # No valid assignments found
                        base_qs = CourseFolder.objects.none()
            else:
                # Normal faculty view: show only their own folders
                base_qs = CourseFolder.objects.filter(faculty__user=user)
            
            qs = base_qs.select_related(
                'course', 'faculty__user', 'term', 'department', 'program'
            ).prefetch_related('components', 'assessments', 'log_entries')

            # Lightweight filters to speed up specific lookups
            status_param = self.request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)
            else:
                # If no status filter, include SUBMITTED folders AND folders coordinator can edit
                # BUT only if they are currently assigned as coordinator (already filtered by coordinator_q above)
                if assigned_to_me in ['1', 'true', 'True', 'yes']:
                    # Include folders coordinator can review or edit
                    # Note: base_qs is already filtered by CourseCoordinatorAssignment, so we only show folders
                    # where user is currently assigned as coordinator, not just folders they reviewed before
                    qs = qs.filter(
                        Q(status='SUBMITTED') |
                        Q(status__in=['APPROVED_COORDINATOR', 'REJECTED_COORDINATOR'])
                    )

            course_allocation_param = self.request.query_params.get('course_allocation')
            if course_allocation_param:
                qs = qs.filter(course_allocation_id=course_allocation_param)

            term_param = self.request.query_params.get('term')
            if term_param:
                qs = qs.filter(term_id=term_param)

            return qs.distinct()
        
        elif role == 'COORDINATOR':
            from courses.models import CourseCoordinatorAssignment
            
            # Check if coordinator wants only folders assigned to them
            assigned_to_me = self.request.query_params.get('assigned_to_me')
            if assigned_to_me in ['1', 'true', 'True', 'yes']:
                # Get folders based on CourseCoordinatorAssignment (primary method)
                coordinator_assignments = CourseCoordinatorAssignment.objects.filter(
                    coordinator=user,
                    is_active=True
                )
                
                # Build Q object for coordinator assignments - MUST match course exactly
                coordinator_q = Q()
                for assignment in coordinator_assignments:
                    # If assignment has a term, only match folders with that exact term
                    # If assignment has no term, match folders with any term for that course
                    if assignment.term_id:
                        coordinator_q |= Q(course_id=assignment.course_id, term_id=assignment.term_id)
                    else:
                        # Assignment applies to all terms for this course
                        coordinator_q |= Q(course_id=assignment.course_id)
                
                # CRITICAL: Only show folders for courses where this user is assigned as coordinator
                # This ensures coordinators only see folders for their assigned courses
                if coordinator_q:
                    qs = CourseFolder.objects.filter(coordinator_q)
                else:
                    # No coordinator assignments found
                    qs = CourseFolder.objects.none()
            else:
                # Fallback to program/department if assigned_to_me is not requested
                qs = CourseFolder.objects.filter(
                    Q(program=user.program) | Q(department=user.department)
                )
            
            qs = qs.select_related(
                'course', 'faculty__user', 'term', 'department', 'program'
            ).prefetch_related('components', 'assessments', 'log_entries')
            
            # Apply query param filters (status, program, department, term, course)
            status_param = self.request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)
            else:
                # If no status filter, include SUBMITTED folders AND folders coordinator can edit
                # BUT only if they are currently assigned as coordinator (already filtered by coordinator_q above)
                if assigned_to_me in ['1', 'true', 'True', 'yes']:
                    # Include folders coordinator can review or edit
                    # Note: qs is already filtered by CourseCoordinatorAssignment, so we only show folders
                    # where user is currently assigned as coordinator, not just folders they reviewed before
                    qs = qs.filter(
                        Q(status='SUBMITTED') |
                        Q(status__in=['APPROVED_COORDINATOR', 'REJECTED_COORDINATOR'])
                    )

            program_param = self.request.query_params.get('program')
            if program_param:
                qs = qs.filter(program_id=program_param)

            department_param = self.request.query_params.get('department')
            if department_param:
                qs = qs.filter(department_id=department_param)

            term_param = self.request.query_params.get('term')
            if term_param:
                qs = qs.filter(term_id=term_param)

            course_param = self.request.query_params.get('course')
            if course_param:
                qs = qs.filter(course_id=course_param)

            return qs.distinct()
        
        elif role == 'CONVENER':
            # Convener sees folders from their department by default; can request full scope via scope_all=1
            scope_all = self.request.query_params.get('scope_all') in ['1', 'true', 'True', 'yes']
            base_qs = CourseFolder.objects.all()
            if not scope_all and getattr(user, 'department_id', None):
                base_qs = base_qs.filter(department=user.department)
            qs = base_qs.select_related(
                'course', 'faculty__user', 'term', 'department', 'program'
            )
            
            # If assigned_to_me is requested, ONLY show folders where Convener is coordinator (not department folders)
            assigned_to_me = self.request.query_params.get('assigned_to_me')
            if assigned_to_me in ['1', 'true', 'True', 'yes']:
                from courses.models import CourseCoordinatorAssignment
                # Get coordinator assignments for this user
                coordinator_assignments = CourseCoordinatorAssignment.objects.filter(
                    coordinator=user,
                    is_active=True
                )
                
                if not coordinator_assignments.exists():
                    # No coordinator assignments, return empty queryset
                    qs = CourseFolder.objects.none()
                else:
                    # Build Q object for coordinator assignments - MUST match course exactly
                    coordinator_q = Q()
                    for assignment in coordinator_assignments:
                        # If assignment has a term, only match folders with that exact term
                        # If assignment has no term, match folders with any term for that course
                        if assignment.term_id:
                            coordinator_q |= Q(course_id=assignment.course_id, term_id=assignment.term_id)
                        else:
                            # Assignment applies to all terms for this course
                            coordinator_q |= Q(course_id=assignment.course_id)
                    
                    # CRITICAL: When assigned_to_me=1, ONLY show folders where user is coordinator
                    # Do NOT include department folders - only coordinator-assigned folders
                    qs = CourseFolder.objects.filter(coordinator_q).select_related(
                        'course', 'faculty__user', 'term', 'department', 'program'
                    ).distinct()
            
            status_param = self.request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)
                
                # If status is APPROVED_BY_HOD, also include folders where user has granted access
                if status_param == 'APPROVED_BY_HOD':
                    # Get folder IDs where user has APPROVED access request
                    approved_access_folder_ids = FolderAccessRequest.objects.filter(
                        requested_by=user,
                        status='APPROVED'
                    ).values_list('folder_id', flat=True)
                    
                    if approved_access_folder_ids:
                        # Combine department folders with granted access folders
                        qs = qs | CourseFolder.objects.filter(
                            id__in=approved_access_folder_ids,
                            status='APPROVED_BY_HOD'
                        ).select_related(
                            'course', 'faculty__user', 'term', 'department', 'program'
                        )
            else:
                # If no status filter, include SUBMITTED folders AND folders coordinator can edit
                # BUT only if they are currently assigned as coordinator (already filtered by coordinator_q above)
                if assigned_to_me in ['1', 'true', 'True', 'yes']:
                    # Include folders coordinator can review or edit
                    # Note: qs is already filtered by CourseCoordinatorAssignment, so we only show folders
                    # where user is currently assigned as coordinator, not just folders they reviewed before
                    qs = qs.filter(
                        Q(status='SUBMITTED') |
                        Q(status__in=['APPROVED_COORDINATOR', 'REJECTED_COORDINATOR'])
                    )
            term_param = self.request.query_params.get('term')
            if term_param:
                qs = qs.filter(term_id=term_param)
            return qs.distinct()
        
        elif role in ['AUDIT_TEAM', 'AUDIT_MEMBER', 'EVALUATOR']:
            # Audit team sees only assigned folders
            qs = CourseFolder.objects.filter(
                audit_assignments__auditor=user
            ).select_related(
                'course', 'faculty__user', 'term', 'department', 'program'
            ).prefetch_related('audit_assignments')

            # Optional: only pending assignments for me (hide already-submitted ones)
            assigned_to_me = self.request.query_params.get('assigned_to_me')
            if assigned_to_me in ['1', 'true', 'True', 'yes']:
                qs = qs.filter(
                    audit_assignments__auditor=user,
                    audit_assignments__feedback_submitted=False,
                    status='UNDER_AUDIT',
                )
            else:
                status_param = self.request.query_params.get('status')
                if status_param:
                    qs = qs.filter(status=status_param)
            return qs.distinct()
        
        elif role == 'HOD':
            # HOD sees all folders from their department
            qs = CourseFolder.objects.filter(
                department=user.department
            ).select_related(
                'course', 'faculty__user', 'term', 'department', 'program'
            )
            
            # If assigned_to_me is requested, ONLY show folders where HOD is coordinator (not department folders)
            assigned_to_me = self.request.query_params.get('assigned_to_me')
            if assigned_to_me in ['1', 'true', 'True', 'yes']:
                from courses.models import CourseCoordinatorAssignment
                # Get coordinator assignments for this user
                coordinator_assignments = CourseCoordinatorAssignment.objects.filter(
                    coordinator=user,
                    is_active=True
                )
                
                if not coordinator_assignments.exists():
                    # No coordinator assignments, return empty queryset
                    qs = CourseFolder.objects.none()
                else:
                    # Build Q object for coordinator assignments - MUST match course exactly
                    coordinator_q = Q()
                    for assignment in coordinator_assignments:
                        # If assignment has a term, only match folders with that exact term
                        # If assignment has no term, match folders with any term for that course
                        if assignment.term_id:
                            coordinator_q |= Q(course_id=assignment.course_id, term_id=assignment.term_id)
                        else:
                            # Assignment applies to all terms for this course
                            coordinator_q |= Q(course_id=assignment.course_id)
                    
                    # CRITICAL: When assigned_to_me=1, ONLY show folders where user is coordinator
                    # Do NOT include department folders - only coordinator-assigned folders
                    qs = CourseFolder.objects.filter(coordinator_q).select_related(
                        'course', 'faculty__user', 'term', 'department', 'program'
                    ).distinct()
            else:
                # Normal HOD view: show all folders from department
                qs = CourseFolder.objects.filter(
                    department=user.department
                ).select_related(
                    'course', 'faculty__user', 'term', 'department', 'program'
                )
            
            status_param = self.request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)
                
                # If status is APPROVED_BY_HOD, also include folders where user has granted access
                if status_param == 'APPROVED_BY_HOD':
                    # Get folder IDs where user has APPROVED access request
                    approved_access_folder_ids = FolderAccessRequest.objects.filter(
                        requested_by=user,
                        status='APPROVED'
                    ).values_list('folder_id', flat=True)
                    
                    if approved_access_folder_ids:
                        # Combine department folders with granted access folders
                        qs = qs | CourseFolder.objects.filter(
                            id__in=approved_access_folder_ids,
                            status='APPROVED_BY_HOD'
                        ).select_related(
                            'course', 'faculty__user', 'term', 'department', 'program'
                        )
            else:
                # If no status filter, include SUBMITTED folders AND folders coordinator can edit
                # BUT only if they are currently assigned as coordinator (already filtered by coordinator_q above)
                if assigned_to_me in ['1', 'true', 'True', 'yes']:
                    # Include folders coordinator can review or edit
                    # Note: qs is already filtered by CourseCoordinatorAssignment, so we only show folders
                    # where user is currently assigned as coordinator, not just folders they reviewed before
                    qs = qs.filter(
                        Q(status='SUBMITTED') |
                        Q(status__in=['APPROVED_COORDINATOR', 'REJECTED_COORDINATOR'])
                    )
            return qs.distinct()

        elif role == 'ADMIN':
            # Admin sees all folders
            qs = CourseFolder.objects.all().select_related(
                'course', 'faculty__user', 'term', 'department', 'program'
            )
            # Generic filters for admin
            for key, field in (
                ('status', 'status'),
                ('program', 'program_id'),
                ('department', 'department_id'),
                ('term', 'term_id'),
                ('course', 'course_id'),
            ):
                val = self.request.query_params.get(key)
                if val:
                    qs = qs.filter(**{field: val})
            return qs
        
        return CourseFolder.objects.none()

    def _has_audit_access(self, user):
        """Audit access is capability-based: either legacy role OR assigned to at least one AuditAssignment."""
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        if getattr(user, 'role', None) in ['AUDIT_TEAM', 'AUDIT_MEMBER', 'EVALUATOR']:
            return True
        try:
            return AuditAssignment.objects.filter(auditor=user).exists()
        except Exception:
            return False
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CourseFolderListSerializer
        elif self.action == 'create':
            return CourseFolderCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CourseFolderUpdateSerializer
        return CourseFolderDetailSerializer
    
    def retrieve(self, request, *args, **kwargs):
        """Optimized retrieve with select_related to reduce queries"""
        queryset = self.get_queryset().select_related(
            'course', 'course__department', 'course__program',
            'faculty', 'faculty__user', 'faculty__department', 'faculty__program',
            'term', 'department', 'program',
            'coordinator_reviewed_by', 'hod_reviewed_by'
        ).prefetch_related(
            'components', 'assessments', 'log_entries',
            'audit_assignments__auditor', 'status_history__changed_by'
        )
        instance = queryset.get(pk=kwargs['pk'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        # Auto-set faculty from authenticated user
        user = self.request.user
        if not hasattr(user, 'faculty_profile'):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'error': 'User does not have a faculty profile. Please contact admin to create a faculty record for your account.'
            })
        
        serializer.validated_data['faculty'] = user.faculty_profile
        
        # Ensure program is set from course_allocation if not provided
        course_allocation = serializer.validated_data.get('course_allocation')
        if course_allocation and not serializer.validated_data.get('program'):
            if course_allocation.program:
                serializer.validated_data['program'] = course_allocation.program
        
        folder = serializer.save()
        # Create status history entry
        FolderStatusHistory.objects.create(
            folder=folder,
            status='DRAFT',
            changed_by=self.request.user,
            notes='Folder created'
        )
        # Notify admins when a faculty creates a folder so they have oversight
        try:
            if getattr(self.request.user, 'role', None) == 'FACULTY':
                self._notify_admins(
                    'OTHER',
                    'New Course Folder Created',
                    f"Faculty {folder.faculty.user.full_name} created a new course folder for {folder.course.code} - {folder.section}",
                    folder
                )
        except Exception:
            pass
    
    @action(detail=False, methods=['get'])
    def my_folders(self, request):
        """Get current faculty member's folders"""
        user = request.user
        
        if not hasattr(user, 'faculty_profile'):
            return Response(
                {'error': 'User is not a faculty member'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        folders = CourseFolder.objects.filter(
            faculty=user.faculty_profile
        ).select_related('course', 'term', 'department', 'program')
        
        # Filter by status if provided
        folder_status = request.query_params.get('status')
        if folder_status:
            folders = folders.filter(status=folder_status)
        
        serializer = CourseFolderListSerializer(folders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='basic')
    def get_basic(self, request, pk=None):
        """Get basic folder info for Title Page and Course Outline - ultra fast, no nested serializers"""
        # Optimize query with select_related to avoid N+1 queries
        # Ensure course_allocation and its course are loaded for fallback logic in serializer
        folder = CourseFolder.objects.select_related(
            'course', 'course_allocation', 'course_allocation__course',
            'faculty', 'faculty__user', 'term', 'department', 'program'
        ).get(pk=pk)
        serializer = CourseFolderBasicSerializer(folder)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch', 'put'], url_path='save-outline')
    def save_outline(self, request, pk=None):
        """Save course outline content with server-side merge and snapshot.

        Behaviors:
        - Creates a snapshot before applying changes (for recovery).
        - If request contains 'section', only that top-level key is updated.
        - Otherwise, performs a deep merge (dicts are merged; lists/strings/numbers replaced).
        """
        folder = self.get_object()

        # Validate user can edit this folder
        user = request.user
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response(
                {'error': 'You can only edit your own folders'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Simplified editing logic:
        # 1. Folder is in DRAFT or REJECTED statuses (normal editing)
        # 2. Folder is APPROVED_BY_HOD and first_activity_completed = True (editing for second submission)
        allowed_edit_statuses = ['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD']
        if folder.status not in allowed_edit_statuses:
            if folder.status == 'APPROVED_BY_HOD' and getattr(folder, 'first_activity_completed', False):
                # Second submission - allow editing
                pass
            else:
                return Response(
                    {'error': f'Cannot edit folder with status {folder.status}. Folder must be in DRAFT, REJECTED, or APPROVED_BY_HOD (after first approval) status to edit.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        payload = request.data.get('outline_content')
        if payload is None:
            return Response({'error': 'outline_content payload is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Create a snapshot before update to prevent accidental total loss
        try:
            from .models import OutlineContentSnapshot
            OutlineContentSnapshot.objects.create(
                folder=folder,
                data=folder.outline_content or {},
                created_by=getattr(request, 'user', None)
            )
        except Exception:
            # Non-blocking if snapshotting fails
            pass

        def deep_merge(a, b):
            """Recursively merge dict b into dict a. Lists and scalars are replaced."""
            if not isinstance(a, dict) or not isinstance(b, dict):
                return b
            result = dict(a)
            for k, v in b.items():
                if k in result and isinstance(result[k], dict) and isinstance(v, dict):
                    result[k] = deep_merge(result[k], v)
                else:
                    # Replace for lists/scalars
                    result[k] = v
            return result

        current = folder.outline_content or {}
        incoming = payload if isinstance(payload, dict) else {}
        section = request.data.get('section')
        allowed_sections = {
            'courseDescription', 'creditHours', 'textbooks', 'objectives', 'learningOutcomes',
            'courseLogEntries', 'courseLogs', 'assignments', 'quizzes',
            # Midterm/Final variants used by the UI
            'midterm', 'midTerm', 'midtermPaper', 'midtermSolution', 'midtermRecords',
            'final', 'finalExam', 'finalPaper', 'finalSolution', 'finalRecords',
            'projectReport', 'courseResult', 'assignmentRecords', 'quizRecords'
        }

        if section:
            # Update just the targeted section; accept either wrapped or direct value
            value = incoming.get(section) if isinstance(incoming, dict) else None
            if value is None:
                value = incoming  # assume direct payload is the section value
            
            # DEBUG LOGGING
            if section in ['midtermRecords', 'finalRecords']:
                 print(f"DEBUG: update_outline for {section}. Payload keys: {value.keys() if isinstance(value, dict) else 'Not a dict'}")
                 if isinstance(value, dict):
                     for k, v in value.items():
                         if isinstance(v, dict):
                             has_file_data = 'fileData' in v
                             data_len = len(v.get('fileData', '')) if has_file_data else 0
                             print(f"DEBUG: Record {k} has fileData: {has_file_data}, Length: {data_len}")

            if section not in allowed_sections:
                # still allow arbitrary keys but keep it scoped to a single top-level key
                current[section] = value
            else:
                current[section] = value
            folder.outline_content = current
        else:
            # Merge whole document defensively
            # DEBUG LOGGING
            print(f"DEBUG: update_outline full merge. Incoming keys: {incoming.keys()}")
            if 'midtermRecords' in incoming:
                recs = incoming['midtermRecords']
                if isinstance(recs, dict):
                     for k, v in recs.items():
                         if isinstance(v, dict):
                             has_file_data = 'fileData' in v
                             data_len = len(v.get('fileData', '')) if has_file_data else 0
                             print(f"DEBUG: Full merge Midterm Record {k} has fileData: {has_file_data}, Length: {data_len}")
            
            folder.outline_content = deep_merge(current, incoming)

        folder.save(update_fields=['outline_content', 'updated_at'])
        
        # Refresh folder from DB to ensure we have latest data
        folder.refresh_from_db()
        
        # Return basic folder info along with saved outline content
        serializer = CourseFolderBasicSerializer(folder)
        response_data = serializer.data
        response_data['message'] = 'Course outline saved successfully'
        
        return Response(response_data)
    
    @action(detail=False, methods=['get'])
    def my_course_allocations(self, request):
        """Get faculty's course allocations for folder creation"""
        user = request.user
        
        if not hasattr(user, 'faculty_profile'):
            return Response(
                {'error': 'User is not a faculty member'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get allocations with terms
        allocations = CourseAllocation.objects.filter(
            faculty=user.faculty_profile,
            term__isnull=False,
            is_active=True
        ).select_related('course', 'term', 'department', 'program')
        
        # Check if folder already exists for each allocation
        result = []
        for alloc in allocations:
            folder_exists = CourseFolder.objects.filter(
                course_allocation=alloc,
                term=alloc.term
            ).exists()
            
            folder = None
            if folder_exists:
                folder_obj = CourseFolder.objects.filter(
                    course_allocation=alloc,
                    term=alloc.term
                ).first()
                if folder_obj:
                    # Use getattr to handle case where migration hasn't been applied yet
                    folder = {
                        'id': folder_obj.id, 
                        'status': folder_obj.status,
                        'first_activity_completed': getattr(folder_obj, 'first_activity_completed', False)
                    }
            
            result.append({
                'allocation_id': alloc.id,
                'course_code': alloc.course.code,
                'course_title': alloc.course.title,
                'section': alloc.section,
                'term': alloc.term.session_term if alloc.term else 'No Term',
                'term_id': alloc.term.id if alloc.term else None,
                'department': alloc.department.name,
                'department_id': alloc.department.id,
                'program': alloc.program.title if alloc.program else 'N/A',
                'program_id': alloc.program.id if alloc.program else None,
                'course_id': alloc.course.id,
                'folder_exists': folder_exists,
                'folder': folder
            })
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def my_audit_reports(self, request):
        """Return the current auditor's submitted audit assignments with folder + decision info.

        Optional query params:
          submitted: if '0' returns all assignments (default only submitted)
          decision: filter by decision ('APPROVED' / 'REJECTED' / 'PENDING')
          status: filter folders by current folder.status (e.g. AUDIT_COMPLETED, SUBMITTED_TO_HOD)
        """
        user = request.user
        if not self._has_audit_access(user):
            return Response({'error': 'Not permitted'}, status=status.HTTP_403_FORBIDDEN)

        submitted_param = request.query_params.get('submitted')
        decision_param = request.query_params.get('decision')
        status_param = request.query_params.get('status')

        assignments = AuditAssignment.objects.filter(auditor=user).select_related(
            'folder', 'folder__course', 'folder__term', 'folder__faculty__user'
        )

        # Default: only submitted assignments unless submitted=0 provided
        if submitted_param not in ['0', 'false', 'False']:
            assignments = assignments.filter(feedback_submitted=True)

        if decision_param:
            decision_upper = decision_param.upper()
            if decision_upper in ['APPROVED', 'REJECTED', 'PENDING']:
                assignments = assignments.filter(decision=decision_upper)

        if status_param:
            assignments = assignments.filter(folder__status=status_param)
        
        # CRITICAL: By default, only show folders that are actually in audit status (UNDER_AUDIT or AUDIT_COMPLETED)
        # This prevents showing folders that are coordinator-assigned or have moved beyond audit
        # Only apply this filter if no explicit status_param is provided
        if not status_param:
            assignments = assignments.filter(
                Q(folder__status='UNDER_AUDIT') | Q(folder__status='AUDIT_COMPLETED')
            )

        data = []
        for a in assignments.order_by('-feedback_submitted_at'):
            f = a.folder
            data.append({
                'assignment_id': a.id,
                'folder_id': f.id,
                'course': {
                    'code': f.course.code,
                    'title': f.course.title,
                },
                'section': f.section,
                'term': f.term.session_term,
                'faculty': f.faculty.user.full_name,
                'folder_status': f.status,
                'submitted': a.feedback_submitted,
                'submitted_at': a.feedback_submitted_at,
                'decision': a.decision,
                'remarks': a.remarks,
                'ratings': a.ratings or {},
                'file_url': request.build_absolute_uri(a.feedback_file.url) if a.feedback_file else None,
            })

        return Response(data)
    
    def _validate_submission_requirements(self, folder):
        """
        Validate folder submission requirements based on two-stage submission:
        
        FIRST SUBMISSION (after midterm):
        - Required: Course outline, Course log, Attendance, CLO Assessment
        - Optional: Lecture notes
        - At least 2 assignments with question paper, model solution, best/avg/worst records
        - At least 2 quizzes with question paper, model solution, best/avg/worst records
        - Midterm records: question paper, model solution, best/avg/worst records (mandatory)
        - NOT required: Course Review Report, Project Report, Course Result, Final Term
        
        SECOND SUBMISSION (after final):
        - All first submission requirements (course outline, course log, attendance, CLO assessment)
        - At least 4 assignments with question paper, model solution, best/avg/worst records
        - At least 4 quizzes with question paper, model solution, best/avg/worst records
        - Final term records: question paper, model solution, best/avg/worst records (mandatory)
        - All documents required: Course Review Report, Project Report, Course Result
        - Optional: Lecture notes (still optional in second submission)
        - Instructor can edit previous records from first submission
        """
        outline = folder.outline_content or {}
        errors = []
        
        # ===== CHECK 1: Empty Folder Check =====
        # Check if folder has any content at all
        # Title page is system-generated, no need to check for it
        # Course outline is stored as individual fields: introduction, objectives, courseDescription, learningOutcomes, etc.
        has_course_outline = bool(
            outline.get('courseOutline') or 
            outline.get('course_outline') or
            outline.get('introduction') or
            outline.get('objectives') or
            outline.get('courseDescription') or
            outline.get('learningOutcomes') or
            outline.get('creditHours') or
            outline.get('textbooks')
        )
        has_course_log = bool(outline.get('courseLogEntries') or outline.get('courseLogs') or folder.log_entries.exists())
        has_assignments = bool(outline.get('assignments', []))
        has_quizzes = bool(outline.get('quizzes', []))
        has_midterm = bool(
            outline.get('midterm') or outline.get('midTerm') or 
            outline.get('midtermPaper') or outline.get('midtermSolution') or 
            outline.get('midtermRecords')
        )
        has_final = bool(
            outline.get('final') or outline.get('finalExam') or 
            outline.get('finalPaper') or outline.get('finalSolution') or 
            outline.get('finalRecords')
        )
        
        # If folder is completely empty, reject immediately
        # Check if outline_content is empty or None
        if not outline or (isinstance(outline, dict) and len(outline) == 0):
            return False, [
                "Cannot submit an empty folder. Please add at least some content (course outline or course log) before submitting."
            ]
        
        # Also check if no content exists at all (title page is system-generated, so don't include it)
        if not any([has_course_outline, has_course_log, has_assignments, has_quizzes, has_midterm, has_final]):
            return False, [
                "Cannot submit an empty folder. Please add at least some content (course outline or course log) before submitting."
            ]
        
        # ===== CHECK 2: Basic Required Content (for both submissions) =====
        # Title page is system-generated, no need to validate
        
        # Course outline is stored as individual fields: introduction, objectives, courseDescription, learningOutcomes, etc.
        # Check if any course outline content exists
        if not has_course_outline:
            errors.append("Course Outline is required. Please add course outline content (Introduction, Objectives, Course Description, etc.).")
        
        if not has_course_log:
            errors.append("Course Log is required. Please add at least one course log entry.")
        elif not folder.log_entries.exists():
            # Check if log entries exist in database
            log_entries = outline.get('courseLogEntries', []) or outline.get('courseLogs', [])
            if not log_entries:
                errors.append("Course Log must have at least one entry. Please add course log entries.")
        
        # Check attendance (can be in components, per log entry, or in outline_content)
        # Check attendance (can be in components, per log entry, or in outline_content)
        # Check if there are attendance components with actual files
        attendance_components = folder.components.filter(component_type='ATTENDANCE')
        has_attendance_component = False
        for comp in attendance_components:
            if comp.file and comp.file.name:  # Check if file actually exists
                has_attendance_component = True
                break
        
        # Check if attendance sheets are attached to log entries (verify files exist)
        has_attendance_in_logs = False
        for log_entry in folder.log_entries.all():
            if log_entry.attendance_sheet and log_entry.attendance_sheet.name:
                has_attendance_in_logs = True
                break
        
        # Check if attendance is stored in outline_content (frontend stores it as attendanceFile with fileUrl/fileName)
        # Frontend stores attendance in outline_content['attendanceFile'] with fileUrl (base64), fileName, uploadedAt, id
        attendance_file_data = outline.get('attendanceFile', {})
        has_attendance_in_outline = False
        if isinstance(attendance_file_data, dict):
            # Check for fileUrl (base64 data URL) or fileName - these are the fields the frontend uses
            has_attendance_in_outline = bool(
                attendance_file_data.get('fileUrl') or 
                attendance_file_data.get('fileName') or
                attendance_file_data.get('file') or
                attendance_file_data.get('name')
            )
        # Also check other possible field names for backwards compatibility
        if not has_attendance_in_outline:
            has_attendance_in_outline = bool(
                outline.get('attendance') or
                outline.get('attendanceRecord') or
                outline.get('attendanceRecords')
            )
        
        has_attendance = has_attendance_component or has_attendance_in_logs or has_attendance_in_outline
        
        if not has_attendance:
            errors.append("Attendance record is required. Please upload attendance sheets (either as a component or attach to course log entries).")
        
        # ===== CHECK 3: Determine Submission Stage =====
        # Check if first activity is completed (first submission cycle approved by HOD)
        # This is the primary indicator for second submission
        # Use getattr to handle case where migration hasn't been applied yet
        first_activity_completed = getattr(folder, 'first_activity_completed', False)
        
        # Determine if this is first or second submission
        # Second submission happens when:
        # 1. first_activity_completed is True (first cycle was approved by HOD)
        # 2. AND folder status is APPROVED_BY_HOD (allowing resubmission for final term)
        is_second_submission = first_activity_completed and folder.status == 'APPROVED_BY_HOD'
        is_first_submission = not is_second_submission
        
        if is_second_submission:
            # SECOND SUBMISSION: After final term - full requirements
            required_assignments = 4
            required_quizzes = 4
            stage_name = "second submission (after final)"
            
            # For second submission, final exam is mandatory
            if not has_final:
                errors.append("Final term records are mandatory for second submission. Please upload final term records.")
        else:
            # FIRST SUBMISSION: After midterm - minimal requirements
            # Check if midterm exists (required for first submission)
            if not has_midterm:
                return False, [
                    "Cannot submit folder before midterm. Please upload midterm records first."
                ]
            required_assignments = 2
            required_quizzes = 2
            stage_name = "first submission (after midterm)"
        
        # ===== CHECK 4: Get assignments and quizzes =====
        assignments = outline.get('assignments', [])
        quizzes = outline.get('quizzes', [])
        assignment_records = outline.get('assignmentRecords', {})
        quiz_records = outline.get('quizRecords', {})
        
        # ===== CHECK 5: Validate Midterm Records for First Submission =====
        if is_first_submission:
            if not has_midterm:
                errors.append("Midterm records are mandatory for first submission. Please upload midterm records.")
            else:
                # Check if midterm has question paper, model solution, and records
                midterm_data = outline.get('midterm', {}) or outline.get('midTerm', {})
                midterm_records = outline.get('midtermRecords', {}) or midterm_data.get('records', {})
                
                # Check question paper
                if not (midterm_data.get('questionPaper') or midterm_data.get('question_paper') or outline.get('midtermPaper')):
                    errors.append("Midterm question paper is required.")
                
                # Check model solution
                if not (midterm_data.get('modelSolution') or midterm_data.get('model_solution') or outline.get('midtermSolution')):
                    errors.append("Midterm model solution is required.")
                
                # Check records (best, average, worst)
                if not midterm_records.get('best'):
                    errors.append("Midterm best solution record is required.")
                if not midterm_records.get('average'):
                    errors.append("Midterm average solution record is required.")
                if not midterm_records.get('worst'):
                    errors.append("Midterm worst solution record is required.")
        
        # ===== CHECK 6: Validate Final Term for Second Submission =====
        if not is_first_submission:
            if not has_final:
                errors.append("Final term records are mandatory for second submission. Please upload final term records.")
            else:
                # Check if final has question paper, model solution, and records
                final_data = outline.get('final', {}) or outline.get('finalExam', {})
                final_records = outline.get('finalRecords', {}) or final_data.get('records', {})
                
                # Check question paper
                if not (final_data.get('questionPaper') or final_data.get('question_paper') or outline.get('finalPaper')):
                    errors.append("Final term question paper is required.")
                
                # Check model solution
                if not (final_data.get('modelSolution') or final_data.get('model_solution') or outline.get('finalSolution')):
                    errors.append("Final term model solution is required.")
                
                # Check records (best, average, worst)
                if not final_records.get('best'):
                    errors.append("Final term best solution record is required.")
                if not final_records.get('average'):
                    errors.append("Final term average solution record is required.")
                if not final_records.get('worst'):
                    errors.append("Final term worst solution record is required.")
            
            # ===== CHECK 7: Validate CLO Assessment (required for BOTH submissions) =====
        # CLO Assessment is required for both first and second submissions
        if not folder.clo_assessment_file:
            if is_first_submission:
                errors.append("CLO Assessment is required for first submission (after midterm). Please upload the CLO assessment.")
            else:
                errors.append("CLO Assessment is required for second submission (after final term). Please upload the CLO assessment.")
        
        # ===== CHECK 8: Validate all required documents for second submission ONLY =====
        # These documents are NOT required for first submission (after midterm)
        # They are ONLY required for second submission (after final term)
        if not is_first_submission:
            if not folder.project_report_file:
                errors.append("Project Report is required for second submission (after final term). Please upload the project report.")
            if not folder.folder_review_report_file:
                errors.append("Course Review Report is required for second submission (after final term). Please upload the course review report.")
            if not folder.course_result_file:
                errors.append("Course Result is required for second submission (after final term). Please upload the course result.")
        
        # ===== CHECK 9: Validate Assignments Count and Records =====
        if len(assignments) < required_assignments:
            errors.append(
                f"For {stage_name}, at least {required_assignments} assignments are required. "
                f"Found {len(assignments)} assignment(s)."
            )
        else:
            # Get assignment papers to check for question papers
            assignment_papers = outline.get('assignmentPapers', {})
            assignment_solutions = outline.get('assignmentSolutions', {})
            
            # Check each required assignment has question paper, model solution, and best/avg/worst
            for i, assignment in enumerate(assignments[:required_assignments], 1):
                assignment_id = str(assignment.get('id', ''))
                records = assignment_records.get(assignment_id, {})
                assignment_name = assignment.get('name', f"Assignment {assignment_id}")
                
                # Check question paper - assignments store questions in assignmentPapers[assignment_id]['questions']
                paper_data = assignment_papers.get(assignment_id, {})
                questions = paper_data.get('questions', []) if isinstance(paper_data, dict) else []
                has_question_paper = (
                    assignment.get('questionPaper') or 
                    assignment.get('question_paper') or
                    (len(questions) > 0) or
                    bool(paper_data.get('questionPaper')) or
                    bool(paper_data.get('question_paper'))
                )
                
                if not has_question_paper:
                    errors.append(f"Assignment '{assignment_name}' (#{i}) is missing question paper. Please add questions to the assignment.")
                
                # Check model solution - check both assignment object and assignmentSolutions
                solution_data = assignment_solutions.get(assignment_id, {})
                has_model_solution = (
                    assignment.get('modelSolution') or 
                    assignment.get('model_solution') or
                    bool(solution_data) or
                    bool(paper_data.get('modelSolution')) or
                    bool(paper_data.get('model_solution'))
                )
                
                if not has_model_solution:
                    errors.append(f"Assignment '{assignment_name}' (#{i}) is missing model solution. Please add solution content.")
                
                # Check records (best, average, worst)
                missing = []
                if not records.get('best'):
                    missing.append('best')
                if not records.get('average'):
                    missing.append('average')
                if not records.get('worst'):
                    missing.append('worst')
                
                if missing:
                    errors.append(
                        f"Assignment '{assignment_name}' (#{i}) is missing required solution records: {', '.join(missing)}"
                    )
        
        # ===== CHECK 10: Validate Quizzes Count and Records =====
        if len(quizzes) < required_quizzes:
            errors.append(
                f"For {stage_name}, at least {required_quizzes} quizzes are required. "
                f"Found {len(quizzes)} quiz/quizzes."
            )
        else:
            # Get quiz papers to check for question papers
            quiz_papers = outline.get('quizPapers', {})
            quiz_solutions = outline.get('quizSolutions', {})
            
            # Check each required quiz has question paper, model solution, and best/avg/worst
            for i, quiz in enumerate(quizzes[:required_quizzes], 1):
                quiz_id = str(quiz.get('id', ''))
                records = quiz_records.get(quiz_id, {})
                quiz_name = quiz.get('name', f"Quiz {quiz_id}")
                
                # Check question paper - quizzes store questions in quizPapers[quiz_id]['questions']
                paper_data = quiz_papers.get(quiz_id, {})
                questions = paper_data.get('questions', []) if isinstance(paper_data, dict) else []
                has_question_paper = (
                    quiz.get('questionPaper') or 
                    quiz.get('question_paper') or
                    (len(questions) > 0) or
                    bool(paper_data.get('questionPaper')) or
                    bool(paper_data.get('question_paper'))
                )
                
                if not has_question_paper:
                    errors.append(f"Quiz '{quiz_name}' (#{i}) is missing question paper. Please add questions to the quiz.")
                
                # Check model solution - check both quiz object and quizSolutions
                solution_data = quiz_solutions.get(quiz_id, {})
                has_model_solution = (
                    quiz.get('modelSolution') or 
                    quiz.get('model_solution') or
                    bool(solution_data) or
                    bool(paper_data.get('modelSolution')) or
                    bool(paper_data.get('model_solution'))
                )
                
                if not has_model_solution:
                    errors.append(f"Quiz '{quiz_name}' (#{i}) is missing model solution. Please add solution content.")
                
                # Check records (best, average, worst)
                missing = []
                if not records.get('best'):
                    missing.append('best')
                if not records.get('average'):
                    missing.append('average')
                if not records.get('worst'):
                    missing.append('worst')
                
                if missing:
                    errors.append(
                        f"Quiz '{quiz_name}' (#{i}) is missing required solution records: {', '.join(missing)}"
                    )
        
        return len(errors) == 0, errors
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit folder for review (Faculty → Coordinator)"""
        folder = self.get_object()
        
        # Check if user owns this folder
        if folder.faculty.user != request.user:
            return Response(
                {'error': 'You do not have permission to submit this folder'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if folder can be submitted
        # Allow submission from:
        # - DRAFT: First time submission
        # - REJECTED statuses: Resubmission after rejection
        # - APPROVED_BY_HOD: Second submission after first approval cycle
        allowed_statuses = ['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD', 'APPROVED_BY_HOD']
        if folder.status not in allowed_statuses:
            return Response(
                {'error': f'Cannot submit folder with status {folder.status}. Folder must be in DRAFT, REJECTED, or APPROVED_BY_HOD status to submit.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ensure course coordinator exists before submission
        coordinator_qs = self._get_coordinator_queryset(folder)

        if not coordinator_qs.exists():
            return Response(
                {
                    'error': 'Course coordinator not assigned',
                    'details': 'No active coordinator is mapped to this course/program. Please contact your department before submitting the folder.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate submission requirements (two-stage submission: first after midterm, second after final)
        # VALIDATION IS MANDATORY - no skip option
        submission_valid, validation_errors = self._validate_submission_requirements(folder)
        if not submission_valid:
            return Response(
                {
                    'error': 'Submission validation failed',
                    'details': validation_errors,
                    'hint': 'Please ensure all required content is uploaded. For first submission (after midterm): Course outline, Course log, Attendance, CLO Assessment, at least 2 assignments (with question paper, model solution, best/avg/worst records), at least 2 quizzes (with question paper, model solution, best/avg/worst records), and midterm records (question paper, model solution, best/avg/worst). Lecture notes are optional. For second submission (after final): All first submission requirements PLUS at least 4 assignments, at least 4 quizzes, final term records, and all documents (project report, course review report, course result).'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check completeness (additional check beyond validation)
        is_complete, message = folder.check_completeness()
        # Note: is_complete is informational; validation_errors above are the blocking checks
        
        # Determine if this is first or second submission
        # Check if first activity is completed (first submission cycle approved by HOD)
        # Use getattr to handle case where migration hasn't been applied yet
        first_activity_completed = getattr(folder, 'first_activity_completed', False)
        is_second_submission = first_activity_completed and folder.status == 'APPROVED_BY_HOD'
        
        # Update folder status
        folder.status = 'SUBMITTED'
        # Update submitted_at timestamp (will be updated for second submission too)
        folder.submitted_at = timezone.now()
        folder.is_complete = is_complete  # retain True only if strict completeness satisfied
        folder.save()
        
        # Create status history with appropriate note
        if is_second_submission:
            submission_note = 'Folder submitted to Coordinator for review (second submission after final term - full approval cycle will repeat)'
        else:
            submission_note = 'Folder submitted to Coordinator for review (first submission after midterm)'
        
        FolderStatusHistory.objects.create(
            folder=folder,
            status='SUBMITTED',
            changed_by=request.user,
            notes=submission_note
        )
        
        # Notify coordinator (reuse coordinator queryset to pick primary contact)
        coordinator = coordinator_qs.order_by('id').first()
        
        if coordinator:
            Notification.objects.create(
                user=coordinator,
                notification_type='FOLDER_SUBMITTED',
                title='New Course Folder Submitted',
                message=f'Faculty {folder.faculty.user.full_name} has submitted a course folder for {folder.course.code} - {folder.section}',
                folder=folder
            )
        # also notify all active admins about the faculty submission
        try:
            if getattr(request.user, 'role', None) == 'FACULTY':
                self._notify_admins(
                    'FOLDER_SUBMITTED',
                    'Folder Submitted',
                    f'Faculty {folder.faculty.user.full_name} submitted {folder.course.code} - {folder.section} for review',
                    folder
                )
        except Exception:
            pass
        
        serializer = CourseFolderDetailSerializer(folder)
        return Response({
            'message': message,
            'folder': serializer.data,
            'strict_complete': is_complete
        })
    
    @action(detail=True, methods=['post'])
    def coordinator_review(self, request, pk=None):
        """Coordinator reviews and approves/rejects folder"""
        # Get folder directly instead of using get_object() to avoid queryset filtering issues
        # We'll check coordinator permission separately
        try:
            folder = CourseFolder.objects.select_related('course', 'term', 'faculty__user', 'department').get(pk=pk)
        except CourseFolder.DoesNotExist:
            return Response({'error': 'Folder not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            print(f"Error in coordinator_review get folder: {e}")
            print(traceback.format_exc())
            return Response({'error': f'Error retrieving folder: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Check if user is a coordinator for this course (via CourseCoordinatorAssignment)
        # Allow any role (FACULTY, CONVENER, HOD) to be a coordinator
        from courses.models import CourseCoordinatorAssignment
        # Check coordinator assignment - can be term-specific or term-agnostic (term__isnull=True)
        coordinator_assignments = CourseCoordinatorAssignment.objects.filter(
            coordinator=request.user,
            course=folder.course,
            is_active=True
        ).filter(
            Q(term=folder.term) | Q(term__isnull=True)
        )
        
        is_coordinator = coordinator_assignments.exists()
        
        if not is_coordinator:
            return Response(
                {
                    'error': 'Only course coordinators assigned to this course can review folders',
                    'details': f'User {request.user.email} is not assigned as coordinator for course {folder.course.code} in term {folder.term.session_term if folder.term else "N/A"}'
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if folder is in correct status for coordinator review
        # Allow reviewing SUBMITTED folders or editing previous decisions (APPROVED_COORDINATOR/REJECTED_COORDINATOR)
        # Only allow editing if the current user was the one who made the original decision
        can_edit_decision = (
            folder.status in ['APPROVED_COORDINATOR', 'REJECTED_COORDINATOR'] and
            folder.coordinator_reviewed_by == request.user
        )
        
        if folder.status not in ['SUBMITTED', 'APPROVED_COORDINATOR', 'REJECTED_COORDINATOR']:
            return Response(
                {'error': f'Cannot review folder with status {folder.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if folder.status in ['APPROVED_COORDINATOR', 'REJECTED_COORDINATOR'] and not can_edit_decision:
            return Response(
                {'error': 'You can only edit decisions you made. Only the coordinator who reviewed this folder can change the decision.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        action = request.data.get('action')  # 'approve' or 'reject'
        notes = request.data.get('notes', '')
        previous_status = folder.status
        is_editing = previous_status in ['APPROVED_COORDINATOR', 'REJECTED_COORDINATOR']
        
        if action == 'approve':
            folder.status = 'APPROVED_COORDINATOR'
            folder.coordinator_reviewed_at = timezone.now()
            folder.coordinator_reviewed_by = request.user
            folder.coordinator_notes = notes
            folder.save()
            
            # Create status history
            history_note = f'Approved by Coordinator: {notes}' if not is_editing else f'Decision changed to Approved by Coordinator: {notes}'
            FolderStatusHistory.objects.create(
                folder=folder,
                status='APPROVED_COORDINATOR',
                changed_by=request.user,
                notes=history_note
            )
            
            # Notify faculty (only if not editing, or if changing from rejected to approved)
            if not is_editing or previous_status == 'REJECTED_COORDINATOR':
                Notification.objects.create(
                    user=folder.faculty.user,
                    notification_type='FOLDER_APPROVED',
                    title='Course Folder Approved by Coordinator',
                    message=f'Your course folder for {folder.course.code} - {folder.section} has been approved by the Course Coordinator.' + (' (Decision updated)' if is_editing else ''),
                    folder=folder
                )
                
                # Notify convener
                convener = User.objects.filter(
                    role='CONVENER',
                    department=folder.department
                ).first()
                
                if convener:
                    Notification.objects.create(
                        user=convener,
                        notification_type='FOLDER_APPROVED',
                        title='Course Folder Approved - Awaiting Audit Assignment',
                        message=f'Course folder for {folder.course.code} - {folder.section} has been approved by coordinator. Please assign audit team.' + (' (Decision updated)' if is_editing else ''),
                        folder=folder
                    )
            
            return Response({
                'message': 'Folder approved successfully' + (' (decision updated)' if is_editing else ''),
                'folder': CourseFolderDetailSerializer(folder).data
            })
        
        elif action == 'reject':
            # Notes are optional for rejection as well (allow coordinators to reject without remarks)
            # Removed the requirement check - coordinators can reject without remarks
            
            folder.status = 'REJECTED_COORDINATOR'
            folder.coordinator_reviewed_at = timezone.now()
            folder.coordinator_reviewed_by = request.user
            folder.coordinator_notes = notes
            folder.save()
            
            # Create status history
            history_note = f'Rejected by Coordinator: {notes}' if not is_editing else f'Decision changed to Rejected by Coordinator: {notes}'
            FolderStatusHistory.objects.create(
                folder=folder,
                status='REJECTED_COORDINATOR',
                changed_by=request.user,
                notes=history_note
            )
            
            # Notify faculty (always notify on rejection, whether new or changed)
            Notification.objects.create(
                user=folder.faculty.user,
                notification_type='FOLDER_RETURNED',
                title='Course Folder Rejected by Coordinator',
                message=f'Your course folder for {folder.course.code} - {folder.section} was rejected by the Course Coordinator. Please check the remarks and resubmit.' + (' (Decision updated)' if is_editing else ''),
                folder=folder
            )
            
            return Response({
                'message': 'Folder rejected and returned to faculty' + (' (decision updated)' if is_editing else ''),
                'folder': CourseFolderDetailSerializer(folder).data
            })
        
        return Response(
            {'error': 'Invalid action. Use "approve" or "reject"'},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=True, methods=['post'])
    def coordinator_feedback(self, request, pk=None):
        """Save per-section feedback notes from coordinator during review.

        Expected payload: { "section": "COURSE_OUTLINE" | "COURSE_LOG" | "ATTENDANCE" | "ASSIGNMENTS" | "QUIZZES" | "MIDTERM" | "FINAL", "notes": "..." }
        """
        # Get folder directly instead of using get_object() to avoid queryset filtering issues
        # We'll check coordinator permission separately
        try:
            folder = CourseFolder.objects.select_related('course', 'term', 'faculty__user').get(pk=pk)
        except CourseFolder.DoesNotExist:
            return Response({'error': 'Folder not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            print(f"Error in coordinator_feedback get folder: {e}")
            print(traceback.format_exc())
            return Response({'error': f'Error retrieving folder: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Check if user is a coordinator for this course (via CourseCoordinatorAssignment)
        # Allow any role (FACULTY, CONVENER, HOD) to be a coordinator
        from courses.models import CourseCoordinatorAssignment
        # Check coordinator assignment - can be term-specific or term-agnostic (term__isnull=True)
        coordinator_assignments = CourseCoordinatorAssignment.objects.filter(
            coordinator=request.user,
            course=folder.course,
            is_active=True
        ).filter(
            Q(term=folder.term) | Q(term__isnull=True)
        )
        
        is_coordinator = coordinator_assignments.exists()
        
        if not is_coordinator:
            return Response({
                'error': 'Only course coordinators assigned to this course can add feedback',
                'details': f'User {request.user.email} is not assigned as coordinator for course {folder.course.code} in term {folder.term.session_term if folder.term else "N/A"}'
            }, status=status.HTTP_403_FORBIDDEN)

        # Typically allowed when folder is submitted to coordinator
        if folder.status not in ['SUBMITTED', 'APPROVED_COORDINATOR', 'REJECTED_COORDINATOR']:
            return Response({'error': f'Cannot add feedback on folder with status {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)

        section = request.data.get('section')
        notes = request.data.get('notes', '')
        if not section:
            return Response({'error': 'section is required'}, status=status.HTTP_400_BAD_REQUEST)

        valid_sections = {
            'TITLE_PAGE', 'COURSE_OUTLINE', 'COURSE_LOG', 'ATTENDANCE',
            'ASSIGNMENTS', 'QUIZZES', 'MIDTERM', 'FINAL', 'COURSE_RESULT', 'PROJECT_REPORT', 'FOLDER_REVIEW_REPORT'
        }
        # Accept arbitrary keys but normalize common aliases
        alias_map = {
            'TITLE': 'TITLE_PAGE',
            'OUTLINE': 'COURSE_OUTLINE',
            'LOG': 'COURSE_LOG',
            'RESULT': 'COURSE_RESULT',
            'PROJECT': 'PROJECT_REPORT',
        }
        key = str(section).strip().upper()
        key = alias_map.get(key, key)

        # Get existing feedback and create a new dict to ensure Django detects the change
        existing_feedback = folder.coordinator_feedback or {}
        feedback = dict(existing_feedback)  # Create a copy to ensure Django detects the change
        feedback[key] = (notes or '').strip()
        folder.coordinator_feedback = feedback
        try:
            folder.save(update_fields=['coordinator_feedback', 'updated_at'])
            
            # Refresh from database to ensure we return the saved value
            folder.refresh_from_db(fields=['coordinator_feedback'])
        except Exception as e:
            import traceback
            print(f"Error saving coordinator feedback: {e}")
            print(traceback.format_exc())
            return Response(
                {'error': f'Failed to save feedback: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'message': 'Feedback saved', 'coordinator_feedback': folder.coordinator_feedback})
    
    @action(detail=True, methods=['post'])
    def audit_member_feedback(self, request, pk=None):
        """Save per-section feedback notes from audit member during review.
        
        Expected payload: { "section": "COURSE_OUTLINE" | "COURSE_LOG" | "ATTENDANCE" | "ASSIGNMENTS" | "QUIZZES" | "MIDTERM" | "FINAL", "notes": "..." }
        """
        try:
            # Get folder directly to avoid queryset filtering issues
            folder = CourseFolder.objects.select_related('course', 'term', 'faculty__user').get(pk=pk)
        except CourseFolder.DoesNotExist:
            return Response({'error': 'Folder not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Error retrieving folder: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Check if user has audit access
        if not self._has_audit_access(request.user):
            return Response({'error': 'Only audit members can add feedback'}, status=status.HTTP_403_FORBIDDEN)
        
        # Verify user is assigned to this specific folder (unless they have legacy AUDIT_TEAM/AUDIT_MEMBER role)
        if request.user.role not in ['AUDIT_TEAM', 'AUDIT_MEMBER', 'EVALUATOR']:
            # For capability-based audit access, verify assignment
            is_assigned = AuditAssignment.objects.filter(
                folder=folder,
                auditor=request.user
            ).exists()
            if not is_assigned:
                return Response({'error': 'You are not assigned to audit this folder'}, status=status.HTTP_403_FORBIDDEN)
        
        # Typically allowed when folder is under audit or audit completed
        if folder.status not in ['UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD']:
            return Response({'error': f'Cannot add feedback on folder with status {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        section = request.data.get('section')
        notes = request.data.get('notes', '')
        if not section:
            return Response({'error': 'section is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        valid_sections = {
            'TITLE_PAGE', 'COURSE_OUTLINE', 'COURSE_LOG', 'ATTENDANCE', 'LECTURE_NOTES',
            'ASSIGNMENTS', 'QUIZZES', 'MIDTERM', 'FINAL', 'COURSE_RESULT', 'PROJECT_REPORT', 'CLO_ASSESSMENT', 'COURSE_REVIEW_REPORT', 'FOLDER_REVIEW_REPORT'
        }
        # Accept arbitrary keys but normalize common aliases
        alias_map = {
            'TITLE': 'TITLE_PAGE',
            'OUTLINE': 'COURSE_OUTLINE',
            'LOG': 'COURSE_LOG',
            'RESULT': 'COURSE_RESULT',
            'PROJECT': 'PROJECT_REPORT',
            'CLO': 'CLO_ASSESSMENT',
        }
        key = str(section).strip().upper()
        key = alias_map.get(key, key)
        
        # Create a new dict copy to ensure Django's JSONField detects the change
        existing_feedback = folder.audit_member_feedback or {}
        feedback = dict(existing_feedback)
        feedback[key] = (notes or '').strip()
        folder.audit_member_feedback = feedback
        folder.save(update_fields=['audit_member_feedback', 'updated_at'])
        
        # Refresh from DB to return the latest value
        folder.refresh_from_db(fields=['audit_member_feedback'])
        
        return Response({'message': 'Feedback saved', 'audit_member_feedback': folder.audit_member_feedback})
    
    @action(detail=True, methods=['post'])
    def assign_audit(self, request, pk=None):
        """Convener assigns audit team members"""
        folder = self.get_object()
        
        # Check if user is convener
        if request.user.role != 'CONVENER':
            return Response(
                {'error': 'Only conveners can assign audit team'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if folder is approved by coordinator
        if folder.status != 'APPROVED_COORDINATOR':
            return Response(
                {'error': f'Cannot assign audit for folder with status {folder.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract selected auditors
        auditor_ids = request.data.get('auditor_ids', [])
        if not auditor_ids:
            return Response(
                {'error': 'At least one auditor must be selected'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify auditors exist and have correct role
        # Anyone except HOD can be an audit member (capability-based), as long as they are active users.
        auditors = User.objects.filter(id__in=auditor_ids, is_active=True).exclude(role='HOD')
        if auditors.count() != len(auditor_ids):
            return Response(
                {'error': 'One or more selected auditors are invalid'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create audit assignments
        for auditor in auditors:
            AuditAssignment.objects.get_or_create(
                folder=folder,
                auditor=auditor,
                defaults={'assigned_by': request.user}
            )
            
            # Notify auditor
            Notification.objects.create(
                user=auditor,
                notification_type='AUDIT_ASSIGNED',
                title='Audit Assignment',
                message=f'You have been assigned to audit course folder: {folder.course.code} - {folder.section}',
                folder=folder
            )
        
        # Update folder status
        folder.status = 'UNDER_AUDIT'
        folder.convener_assigned_at = timezone.now()
        folder.convener_assigned_by = request.user
        folder.save()
        
        # Create status history
        FolderStatusHistory.objects.create(
            folder=folder,
            status='UNDER_AUDIT',
            changed_by=request.user,
            notes=f'Assigned to {auditors.count()} audit team member(s)'
        )
        
        return Response({
            'message': f'Audit team assigned successfully ({auditors.count()} members)',
            'folder': CourseFolderDetailSerializer(folder).data
        })

    @action(detail=True, methods=['post'])
    def unassign_audit(self, request, pk=None):
        """Convener unassigns audit team (reverts to APPROVED_COORDINATOR)"""
        folder = self.get_object()
        
        # Check if user is convener
        if request.user.role != 'CONVENER':
            return Response(
                {'error': 'Only conveners can unassign audit team'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if folder is under audit
        if folder.status != 'UNDER_AUDIT':
            return Response(
                {'error': f'Cannot unassign audit for folder with status {folder.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Remove assignments
        assignments = folder.audit_assignments.all()
        count = assignments.count()
        assignments.delete()
        
        # Update folder status
        folder.status = 'APPROVED_COORDINATOR'
        folder.convener_assigned_at = None
        folder.convener_assigned_by = None
        folder.save()
        
        # Create status history
        FolderStatusHistory.objects.create(
            folder=folder,
            status='APPROVED_COORDINATOR',
            changed_by=request.user,
            notes=f'Audit team unassigned (was {count} members)'
        )
        
        return Response({
            'message': 'Audit team unassigned successfully',
            'folder': CourseFolderDetailSerializer(folder).data
        })
    
    @action(detail=True, methods=['post'])
    def submit_audit_report(self, request, pk=None):
        """Audit team member submits report"""
        try:
            # Get folder directly to avoid queryset filtering issues
            folder = CourseFolder.objects.select_related('course', 'term', 'faculty__user', 'department').get(pk=pk)
        except CourseFolder.DoesNotExist:
            return Response({'error': 'Folder not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Error retrieving folder: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Check if user is audit team member assigned to this folder
        if not self._has_audit_access(request.user):
            return Response(
                {'error': 'Only audit team members can submit reports'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            assignment = AuditAssignment.objects.get(folder=folder, auditor=request.user)
        except AuditAssignment.DoesNotExist:
            return Response(
                {'error': 'You are not assigned to audit this folder'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # CRITICAL: Prevent audit decision changes only after folder has been reviewed by HOD (final approval/rejection)
        # Allow changes as long as folder is UNDER_AUDIT or AUDIT_COMPLETED (awaiting convener/HOD review)
        folder_status_upper = (folder.status or '').upper()
        
        # Block changes only if folder has been forwarded to HOD or approved/rejected by HOD
        if folder_status_upper in ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD']:
            return Response(
                {'error': 'This folder has already been reviewed by HOD (approved or rejected). You cannot change your audit decision at this stage.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Allow changes if folder is UNDER_AUDIT or AUDIT_COMPLETED
        if folder_status_upper not in ['UNDER_AUDIT', 'AUDIT_COMPLETED']:
            return Response(
                {'error': f'Cannot submit audit for folder with status {folder.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Note: We allow re-submission/changes as long as folder is UNDER_AUDIT or AUDIT_COMPLETED
        # This allows audit members to update their decision before HOD makes final decision
        
        # Ensure mandatory overall feedback exists
        overall_feedback = request.data.get('overall_feedback') or request.data.get('remarks') or ''
        if not overall_feedback:
            return Response({'error': 'Overall feedback is required'}, status=status.HTTP_400_BAD_REQUEST)

        remarks = overall_feedback
        # Optional: decision approve/reject and per-category ratings (JSON string or object)
        decision_val = request.data.get('decision')
        ratings_payload = request.data.get('ratings')
        # Ratings may include per-category and optional per-category comments
        ratings = {}
        if ratings_payload:
            try:
                import json
                ratings = ratings_payload if isinstance(ratings_payload, dict) else json.loads(ratings_payload)
            except Exception:
                ratings = {}
        feedback_file = request.FILES.get('feedback_file')
        
        # Update assignment
        assignment.feedback_submitted = True
        assignment.feedback_submitted_at = timezone.now()
        assignment.remarks = remarks
        if decision_val in ['approve', 'APPROVED', 'approved', 'Accept', 'ACCEPT']:
            assignment.decision = 'APPROVED'
        elif decision_val in ['reject', 'REJECTED', 'rejected', 'Decline', 'DECLINE']:
            assignment.decision = 'REJECTED'
        if ratings:
            assignment.ratings = ratings
        if feedback_file:
            assignment.feedback_file = feedback_file
        assignment.save()

        # Auto-generate a single-auditor PDF if none uploaded, including ratings and remarks
        if not feedback_file:
            try:
                pdf_bytes = self._build_single_auditor_pdf(folder, assignment, ratings, remarks)
                if pdf_bytes:
                    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"audit_{folder.id}_{request.user.id}_{ts}.pdf"
                    assignment.feedback_file.save(filename, ContentFile(pdf_bytes), save=True)
            except Exception:
                pass
        
        # Early route to Convener on any single REJECTED decision (don't wait for all auditors)
        if assignment.decision == 'REJECTED':
            folder.audit_completed_at = timezone.now()
            # Ensure we do not accidentally overwrite a later forwarding status
            if folder.status != 'AUDIT_COMPLETED':
                folder.status = 'AUDIT_COMPLETED'
            folder.save(update_fields=['audit_completed_at', 'status'])
            convener = User.objects.filter(role='CONVENER', department=folder.department).first()
            if convener:
                Notification.objects.create(
                    user=convener,
                    notification_type='FOLDER_RETURNED',
                    title='Audit Rejected by Auditor',
                    message=f'An auditor rejected {folder.course.code} - {folder.section}. Please review and take action.',
                    folder=folder
                )
            FolderStatusHistory.objects.create(
                folder=folder,
                status='AUDIT_COMPLETED',
                changed_by=request.user,
                notes='Audit marked completed due to rejection by an auditor'
            )
            # Early termination of audit cycle: a single rejection sends folder to convener.
            total_auditors = folder.audit_assignments.count()
            submitted_auditors = folder.audit_assignments.filter(feedback_submitted=True).count()
            return Response({
                'message': 'Audit report submitted and routed to Convener due to rejection',
                'submitted': submitted_auditors,
                'total': total_auditors,
                'status': folder.status,
                'file_url': request.build_absolute_uri(assignment.feedback_file.url) if assignment.feedback_file else None
            })

        # Check if all auditors have submitted (if no early rejection path already handled, this may forward to HOD)
        total_auditors = folder.audit_assignments.count()
        submitted_auditors = folder.audit_assignments.filter(feedback_submitted=True).count()
        
        # Only when ALL auditors have submitted AND none rejected do we auto-forward to HOD.
        if total_auditors > 0 and submitted_auditors == total_auditors:
            # All auditors have submitted - mark audit as complete
            folder.audit_completed_at = timezone.now()

            # Decide routing: if any REJECTED -> notify Convener; else forward to HOD automatically
            summary = self._compute_audit_summary(folder)
            any_rejected = summary.get('decisions', {}).get('REJECTED', 0) > 0
            if any_rejected:
                # Stay at AUDIT_COMPLETED for convener to review
                if folder.status != 'AUDIT_COMPLETED':
                    folder.status = 'AUDIT_COMPLETED'
                    folder.save(update_fields=['audit_completed_at', 'status'])
                convener = User.objects.filter(role='CONVENER', department=folder.department).first()
                if convener and not Notification.objects.filter(user=convener, folder=folder, notification_type='FOLDER_RETURNED').exists():
                    Notification.objects.create(
                        user=convener,
                        notification_type='FOLDER_RETURNED',
                        title='Audit Completed with Rejections',
                        message=f'Audit for {folder.course.code} - {folder.section} contains rejections. Please review and take action.',
                        folder=folder
                    )
            else:
                # No rejections: mark AUDIT_COMPLETED (convener must manually forward)
                if folder.status != 'AUDIT_COMPLETED':
                    folder.status = 'AUDIT_COMPLETED'
                folder.save(update_fields=['audit_completed_at', 'status'])
                # Notify convener it's ready (approval path)
                convener = User.objects.filter(role='CONVENER', department=folder.department).first()
                if convener and not Notification.objects.filter(user=convener, folder=folder, notification_type='FOLDER_APPROVED').exists():
                    Notification.objects.create(
                        user=convener,
                        notification_type='FOLDER_APPROVED',
                        title='Audit Completed - Ready for Review',
                        message=f'Audit for {folder.course.code} - {folder.section} has completed with no rejections. Please review and forward to HOD if satisfied.',
                        folder=folder
                    )
            
            # Create status history (only once per completion path)
            FolderStatusHistory.objects.create(
                folder=folder,
                status=folder.status,
                changed_by=request.user,
                notes='Audit cycle completed and routed accordingly'
            )
            
            # (Removed duplicate convener notification; convener already notified in rejection branch or HOD forwarding path.)
        
        return Response({
            'message': 'Audit report submitted successfully (awaiting convener review)',
            'submitted': submitted_auditors,
            'total': total_auditors,
            'file_url': request.build_absolute_uri(assignment.feedback_file.url) if assignment.feedback_file else None
        })
    
    @action(detail=True, methods=['post'])
    def convener_review(self, request, pk=None):
        """Convener reviews audit and forwards to HOD or rejects"""
        folder = self.get_object()
        
        # Check if user is convener
        if request.user.role != 'CONVENER':
            return Response(
                {'error': 'Only conveners can review audit reports'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Allow review if audit is completed OR if folder has been reviewed by convener but not yet by HOD
        # This allows convener to change their decision before HOD reviews
        folder_status_upper = (folder.status or '').upper()
        allowed_statuses = ['AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'REJECTED_BY_CONVENER']
        
        if folder_status_upper not in allowed_statuses:
            return Response(
                {'error': f'Cannot review folder with status {folder.status}. Folder must be in audit review stage or awaiting HOD decision.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prevent changes if HOD has already made a final decision
        if folder_status_upper in ['APPROVED_BY_HOD', 'REJECTED_BY_HOD']:
            return Response(
                {'error': 'Cannot change decision. Folder has already been reviewed by HOD.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        action = request.data.get('action')  # 'forward_to_hod' or 'reject'
        notes = request.data.get('notes', '')
        
        if action == 'forward_to_hod':
            folder.status = 'SUBMITTED_TO_HOD'
            folder.convener_notes = notes
            # Ensure consolidated PDF exists
            if not folder.consolidated_pdf:
                try:
                    # build cover and merge existing auditor PDFs
                    summary = self._compute_audit_summary(folder)
                    pdf_bytes_list = []
                    cover = self._build_cover_pdf_bytes(folder, summary)
                    if cover:
                        pdf_bytes_list.append(cover)
                    for a in folder.audit_assignments.all():
                        if a.feedback_file and hasattr(a.feedback_file, 'open'):
                            with a.feedback_file.open('rb') as f:
                                pdf_bytes_list.append(f.read())
                    if pdf_bytes_list and PdfMerger:
                        merged_bytes = self._merge_pdfs(pdf_bytes_list)
                        if merged_bytes:
                            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                            filename = f"consolidated_{folder.id}_{ts}.pdf"
                            folder.consolidated_pdf.save(filename, ContentFile(merged_bytes), save=False)
                            folder.pdf_generated_at = timezone.now()
                            folder.pdf_generation_status = 'COMPLETED'
                except Exception:
                    # Non-blocking if generation fails
                    folder.pdf_generation_status = 'FAILED'
            folder.save()
            
            # Create status history
            FolderStatusHistory.objects.create(
                folder=folder,
                status='SUBMITTED_TO_HOD',
                changed_by=request.user,
                notes=f'Forwarded to HOD: {notes}'
            )
            
            # Notify HOD
            hod = User.objects.filter(
                role='HOD',
                department=folder.department
            ).first()
            
            if hod:
                Notification.objects.create(
                    user=hod,
                    notification_type='FOLDER_SUBMITTED',
                    title='Course Folder Awaiting Final Approval',
                    message=f'Course folder for {folder.course.code} - {folder.section} has passed audit review and is awaiting your final decision.',
                    folder=folder
                )
            
            return Response({
                'message': 'Folder forwarded to HOD for final approval',
                'folder': CourseFolderDetailSerializer(folder).data
            })
        
        elif action == 'reject':
            if not notes:
                return Response(
                    {'error': 'Remarks are required when rejecting a folder'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            folder.status = 'REJECTED_BY_CONVENER'
            folder.convener_notes = notes
            folder.save()
            
            # Create status history
            FolderStatusHistory.objects.create(
                folder=folder,
                status='REJECTED_BY_CONVENER',
                changed_by=request.user,
                notes=f'Rejected by Convener: {notes}'
            )
            
            # Notify faculty
            Notification.objects.create(
                user=folder.faculty.user,
                notification_type='FOLDER_RETURNED',
                title='Course Folder Rejected After Audit',
                message=f'Your course folder for {folder.course.code} - {folder.section} was rejected after audit review. Please update it and resubmit.',
                folder=folder
            )
            
            return Response({
                'message': 'Folder rejected and returned to faculty',
                'folder': CourseFolderDetailSerializer(folder).data
            })
        
        return Response(
            {'error': 'Invalid action. Use "forward_to_hod" or "reject"'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def hod_final_decision(self, request, pk=None):
        """HOD makes final decision on folder - allows changing decisions"""
        folder = self.get_object()
        
        # Check if user is HOD
        if request.user.role != 'HOD':
            return Response(
                {'error': 'Only HOD can make final approval decision'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Allow HOD to make/change decision if folder is SUBMITTED_TO_HOD, APPROVED_BY_HOD, or REJECTED_BY_HOD
        # This allows HOD to change their decision if needed
        if folder.status not in ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD']:
            return Response(
                {'error': f'Cannot review folder with status {folder.status}. Folder must be submitted to HOD or have a previous HOD decision.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        decision = request.data.get('decision')  # 'approve' or 'reject'
        notes = request.data.get('notes', '')
        final_feedback = request.data.get('final_feedback', '')
        
        if decision == 'approve':
            folder.status = 'APPROVED_BY_HOD'
            folder.hod_reviewed_at = timezone.now()
            folder.hod_reviewed_by = request.user
            folder.hod_decision = 'APPROVED'
            folder.hod_notes = notes
            # Use setattr to safely set the field (handles case where migration hasn't been applied)
            if hasattr(folder, 'hod_final_feedback'):
                folder.hod_final_feedback = final_feedback
            
            # Mark first activity as completed if this is the first approval
            # Use getattr to handle case where migration hasn't been applied yet
            first_activity_completed = getattr(folder, 'first_activity_completed', False)
            if not first_activity_completed:
                folder.first_activity_completed = True
                # Notify faculty that first activity is completed and they can now prepare for final submission
                Notification.objects.create(
                    user=folder.faculty.user,
                    notification_type='FOLDER_APPROVED',
                    title='First Activity Completed - Ready for Final Submission',
                    message=f'Your course folder for {folder.course.code} - {folder.section} has been approved by the HOD. The first activity (after midterm) is now completed. You can now edit the folder and add final term content for the second submission.',
                    folder=folder
                )
            else:
                # This is the second approval (final submission)
                Notification.objects.create(
                    user=folder.faculty.user,
                    notification_type='FOLDER_APPROVED',
                    title='Course Folder Approved - Final',
                    message=f'Your course folder for {folder.course.code} - {folder.section} has been approved by the HOD. The review process is complete.',
                    folder=folder
                )
            
            folder.save()
            
            # Create status history
            # Refresh to get the updated first_activity_completed value
            folder.refresh_from_db()
            final_first_activity_completed = getattr(folder, 'first_activity_completed', False)
            submission_type = 'Second submission' if final_first_activity_completed else 'First submission'
            FolderStatusHistory.objects.create(
                folder=folder,
                status='APPROVED_BY_HOD',
                changed_by=request.user,
                notes=f'{submission_type} - Final approval by HOD: {notes}' if notes else f'{submission_type} - Final approval by HOD'
            )
            
            return Response({
                'message': f'Folder approved successfully ({submission_type} - Final)',
                'folder': CourseFolderDetailSerializer(folder).data,
                'first_activity_completed': final_first_activity_completed
            })
        
        elif decision == 'reject':
            # Notes are now optional for rejection as well
            folder.status = 'REJECTED_BY_HOD'
            folder.hod_reviewed_at = timezone.now()
            folder.hod_reviewed_by = request.user
            folder.hod_decision = 'REJECTED'
            folder.hod_notes = notes
            # Use setattr to safely set the field (handles case where migration hasn't been applied)
            if hasattr(folder, 'hod_final_feedback'):
                folder.hod_final_feedback = final_feedback
            folder.save()
            
            # Create status history
            FolderStatusHistory.objects.create(
                folder=folder,
                status='REJECTED_BY_HOD',
                changed_by=request.user,
                notes=f'Rejected by HOD: {notes}' if notes else 'Rejected by HOD'
            )
            
            # Notify faculty
            Notification.objects.create(
                user=folder.faculty.user,
                notification_type='FOLDER_RETURNED',
                title='Course Folder Rejected by HOD',
                message=f'Your course folder for {folder.course.code} - {folder.section} has been rejected by the HOD. Please check remarks and correct.',
                folder=folder
            )
            
            return Response({
                'message': 'Folder rejected by HOD',
                'folder': CourseFolderDetailSerializer(folder).data
            })
        
        return Response(
            {'error': 'Invalid decision. Use "approve" or "reject"'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=False, methods=['get'], url_path='approved-by-term')
    def approved_by_term(self, request):
        """
        Admin endpoint to view approved folders grouped by term.
        Returns folders that have been approved by HOD (final approval).
        """
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only admin can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        term_id = request.query_params.get('term')
        department_id = request.query_params.get('department')
        program_id = request.query_params.get('program')
        course_id = request.query_params.get('course')
        faculty_id = request.query_params.get('faculty')
        
        # Get only approved folders (final approval by HOD)
        queryset = CourseFolder.objects.filter(
            status='APPROVED_BY_HOD'
        ).select_related(
            'course', 'faculty__user', 'term', 'department', 'program', 'course_allocation'
        )
        
        # Apply filters
        if term_id:
            queryset = queryset.filter(term_id=term_id)
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if faculty_id:
            queryset = queryset.filter(faculty_id=faculty_id)
        
        # Order by term (newest first), then by course code
        queryset = queryset.order_by('-term__start_date', 'course__code', 'section')
        
        serializer = CourseFolderDetailSerializer(queryset, many=True)
        
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })
    
    @action(detail=True, methods=['post'], url_path='share-with-role')
    def share_with_role(self, request, pk=None):
        """
        Admin endpoint to share/send a folder to convener or HOD.
        This allows admin to grant access to specific folders upon request.
        """
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only admin can share folders'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        folder = self.get_object()
        
        # Only share approved folders
        if folder.status != 'APPROVED_BY_HOD':
            return Response(
                {'error': 'Only approved folders can be shared'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        target_role = request.data.get('role')  # 'CONVENER' or 'HOD'
        if target_role not in ['CONVENER', 'HOD']:
            return Response(
                {'error': 'Invalid role. Use "CONVENER" or "HOD"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get users with the target role in the same department
        target_users = User.objects.filter(
            role=target_role,
            department=folder.department
        )
        
        if not target_users.exists():
            return Response(
                {'error': f'No {target_role} found in department {folder.department.name}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create notifications for all users with the target role in the department
        notifications_created = []
        for user in target_users:
            notification = Notification.objects.create(
                user=user,
                notification_type='FOLDER_SHARED',
                title=f'Course Folder Shared - {folder.course.code}',
                message=f'Admin has shared the approved course folder for {folder.course.code} - {folder.section} (Term: {folder.term.session_term}) with you. Instructor: {folder.faculty.user.full_name}',
                folder=folder
            )
            notifications_created.append(notification.id)
        
        return Response({
            'message': f'Folder shared with {target_users.count()} {target_role}(s) in department {folder.department.name}',
            'notifications_sent': len(notifications_created),
            'folder': CourseFolderDetailSerializer(folder).data
        })
    
    @action(detail=True, methods=['post'], url_path='request-access')
    def request_access(self, request, pk=None):
        """
        Convener/HOD endpoint to request access to an approved folder.
        """
        folder = self.get_object()
        user = request.user
        
        # Only CONVENER and HOD can request access
        if user.role not in ['CONVENER', 'HOD']:
            return Response(
                {'error': 'Only CONVENER and HOD can request folder access'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only approved folders can be requested
        if folder.status != 'APPROVED_BY_HOD':
            return Response(
                {'error': 'Only approved folders can be requested'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if request already exists
        existing_request = FolderAccessRequest.objects.filter(
            folder=folder,
            requested_by=user
        ).first()
        
        if existing_request:
            if existing_request.status == 'PENDING':
                return Response(
                    {'error': 'You already have a pending request for this folder'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif existing_request.status == 'APPROVED':
                return Response(
                    {'error': 'You already have access to this folder'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                # REJECTED - allow new request
                existing_request.delete()
        
        # Create new request
        access_request = FolderAccessRequest.objects.create(
            folder=folder,
            requested_by=user,
            status='PENDING'
        )
        
        return Response({
            'message': 'Access request submitted successfully',
            'request': FolderAccessRequestSerializer(access_request).data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], url_path='my-access-requests')
    def my_access_requests(self, request):
        """Get current user's folder access requests"""
        user = request.user
        
        if user.role not in ['CONVENER', 'HOD']:
            return Response(
                {'error': 'Only CONVENER and HOD can view their access requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        requests = FolderAccessRequest.objects.filter(
            requested_by=user
        ).select_related('folder', 'folder__course', 'approved_by').order_by('-requested_at')
        
        serializer = FolderAccessRequestSerializer(requests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='folder-access-requests')
    def folder_access_requests(self, request):
        """Admin endpoint to view all folder access requests"""
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only admin can view all access requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        status_filter = request.query_params.get('status', 'PENDING')
        requests = FolderAccessRequest.objects.filter(
            status=status_filter
        ).select_related('folder', 'folder__course', 'requested_by', 'approved_by').order_by('-requested_at')
        
        serializer = FolderAccessRequestSerializer(requests, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='approve-access-request')
    def approve_access_request(self, request, pk=None):
        """Admin endpoint to approve/reject a folder access request"""
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only admin can approve/reject access requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        request_id = request.data.get('request_id')
        if not request_id:
            return Response(
                {'error': 'request_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            access_request = FolderAccessRequest.objects.get(id=request_id, folder_id=pk)
        except FolderAccessRequest.DoesNotExist:
            return Response(
                {'error': 'Access request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        action = request.data.get('action')  # 'approve' or 'reject'
        admin_notes = request.data.get('notes', '')
        
        if action == 'approve':
            access_request.status = 'APPROVED'
            access_request.approved_by = request.user
            access_request.approved_at = timezone.now()
            access_request.rejected_at = None
            access_request.admin_notes = admin_notes
            access_request.save()
            
            # Notify the requester
            Notification.objects.create(
                user=access_request.requested_by,
                notification_type='FOLDER_APPROVED',
                title=f'Folder Access Granted - {access_request.folder.course.code}',
                message=f'Your request to access the folder {access_request.folder.course.code} - {access_request.folder.section} has been approved.',
                folder=access_request.folder
            )
            
            return Response({
                'message': 'Access request approved successfully',
                'request': FolderAccessRequestSerializer(access_request).data
            })
        
        elif action == 'reject':
            if not admin_notes:
                return Response(
                    {'error': 'Notes are required when rejecting a request'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            access_request.status = 'REJECTED'
            access_request.approved_by = request.user
            access_request.rejected_at = timezone.now()
            access_request.approved_at = None
            access_request.admin_notes = admin_notes
            access_request.save()
            
            # Notify the requester
            Notification.objects.create(
                user=access_request.requested_by,
                notification_type='FOLDER_RETURNED',
                title=f'Folder Access Request Rejected - {access_request.folder.course.code}',
                message=f'Your request to access the folder {access_request.folder.course.code} - {access_request.folder.section} has been rejected. Reason: {admin_notes}',
                folder=access_request.folder
            )
            
            return Response({
                'message': 'Access request rejected',
                'request': FolderAccessRequestSerializer(access_request).data
            })
        
        return Response(
            {'error': 'Invalid action. Use "approve" or "reject"'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['get'])
    def check_completeness(self, request, pk=None):
        """Check if folder has all required components"""
        folder = self.get_object()
        is_complete, message = folder.check_completeness()
        
        return Response({
            'is_complete': is_complete,
            'message': message
        })

    def _compute_audit_summary(self, folder: CourseFolder):
        assignments = folder.audit_assignments.all()
        total = assignments.count()
        counts = {'APPROVED': 0, 'REJECTED': 0, 'PENDING': 0}
        # aggregate ratings by key
        sums = {}
        counts_by_key = {}
        for a in assignments:
            dec = (a.decision or 'PENDING').upper()
            if dec not in counts:
                dec = 'PENDING'
            counts[dec] += 1
            if isinstance(a.ratings, dict):
                for k, v in a.ratings.items():
                    try:
                        val = float(v)
                    except Exception:
                        continue
                    sums[k] = sums.get(k, 0.0) + val
                    counts_by_key[k] = counts_by_key.get(k, 0) + 1

        avg = {k: (sums[k] / counts_by_key[k]) for k in sums.keys() if counts_by_key.get(k)}
        if counts['REJECTED'] > 0:
            overall = 'REJECTED'
        elif counts['PENDING'] > 0:
            overall = 'PENDING'
        elif counts['APPROVED'] > 0:
            overall = 'APPROVED'
        else:
            overall = 'PENDING'

        return {
            'total_assignments': total,
            'decisions': counts,
            'overall_decision': overall,
            'average_ratings': avg,
        }

    def _build_cover_pdf_bytes(self, folder: CourseFolder, summary: dict) -> bytes:
        """Optionally build a single-page cover PDF summarizing audit using reportlab if available."""
        if canvas is None or A4 is None:
            return b''
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 50
        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, y, "Consolidated Audit Report")
        y -= 30
        c.setFont("Helvetica", 11)
        c.drawString(50, y, f"Course: {folder.course.code} - {folder.course.title}")
        y -= 18
        c.drawString(50, y, f"Section: {folder.section}    Term: {folder.term.session_term}")
        y -= 18
        c.drawString(50, y, f"Faculty: {folder.faculty.user.full_name}")
        y -= 24
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, "Summary")
        y -= 16
        c.setFont("Helvetica", 11)
        c.drawString(50, y, f"Assignments: {summary.get('total_assignments', 0)}")
        y -= 16
        decisions = summary.get('decisions', {})
        c.drawString(50, y, f"Approved: {decisions.get('APPROVED', 0)}  Rejected: {decisions.get('REJECTED', 0)}  Pending: {decisions.get('PENDING', 0)}")
        y -= 16
        c.drawString(50, y, f"Overall Decision: {summary.get('overall_decision', 'PENDING')}")
        y -= 24
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, "Average Ratings")
        y -= 16
        c.setFont("Helvetica", 11)
        for k, v in (summary.get('average_ratings') or {}).items():
            c.drawString(50, y, f"{k}: {round(v, 2)} / 5")
            y -= 14
            if y < 80:
                break  # keep cover concise
        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer.read()

    def _merge_pdfs(self, pdf_bytes_list: list[bytes]) -> bytes:
        if not PdfMerger:
            return b''
        merger = PdfMerger()
        for b in pdf_bytes_list:
            try:
                merger.append(PdfReader(io.BytesIO(b)))
            except Exception:
                continue
        out = io.BytesIO()
        merger.write(out)
        merger.close()
        out.seek(0)
        return out.read()

    def _build_single_auditor_pdf(self, folder: CourseFolder, assignment: AuditAssignment, ratings: dict, remarks: str) -> bytes:
        """Build a professional one-page PDF for a single auditor's submission using reportlab."""
        try:
            return pdf_utils.generate_audit_report_pdf(folder, assignment, ratings, remarks)
        except Exception as e:
            print(f"Error generating audit report PDF: {e}")
            return b''

    def _extract_pdf_text(self, file_obj) -> str:
        """Extract text from an uploaded PDF using PyPDF2."""
        if not PdfReader:
            return ""
        try:
            data = file_obj.read()
            reader = PdfReader(io.BytesIO(data))
            text_parts = []
            for page in getattr(reader, 'pages', []) or []:
                try:
                    txt = page.extract_text() or ""
                except Exception:
                    txt = ""
                if txt:
                    text_parts.append(txt)
            return "\n".join(text_parts)
        finally:
            try:
                file_obj.seek(0)
            except Exception:
                pass

    def _validate_uploaded_folder_pdf(self, folder: CourseFolder, extracted_text: str) -> dict:
        """
        Validate the uploaded 'single PDF folder' against required section headings.
        Best-effort text matching (case-insensitive, whitespace-normalized).
        """
        course_type = (getattr(folder.course, 'course_type', None) or 'THEORY').upper()

        theory_required = [
            "Title Page",
            "Course Outline",
            "Course Log",
            "Attendance Record",
            "Assignments",
            "Quizzes",
            "MID-TERM Examination",
            "FINAL-TERM Examination",
            "Complete Result",
            "Course CLOs Assessment",
            "Course Review Report",
        ]
        lab_required = [
            "Title Page",
            "Course Outline",
            "Lab Course Log",
            "Attendance Record",
            "Assignments",
            "Quizzes",
            "MID-TERM Examination",
            "FINAL-TERM Examination",
            "Complete Result",
        ]

        required = lab_required if course_type == 'LAB' else theory_required

        normalized = re.sub(r'\s+', ' ', (extracted_text or '').lower()).strip()

        def _find_pos(label: str):
            if not normalized:
                return None
            key = re.sub(r'\s+', ' ', label.lower()).strip()
            key2 = key.replace('-', ' ')
            pos = normalized.find(key)
            if pos == -1:
                pos = normalized.find(key2)
            return None if pos == -1 else pos

        found = []
        missing = []
        positions = {}
        for label in required:
            pos = _find_pos(label)
            if pos is None:
                missing.append(label)
            else:
                found.append(label)
                positions[label] = pos

        order_issues = []
        last_pos = -1
        for label in required:
            if label not in positions:
                continue
            if positions[label] < last_pos:
                order_issues.append(label)
            last_pos = max(last_pos, positions[label])

        return {
            'course_type': course_type,
            'required': required,
            'found': found,
            'missing': missing,
            'order_ok': len(order_issues) == 0,
            'order_issues': order_issues,
            'text_extracted': bool(normalized),
        }

    @action(detail=True, methods=['get'])
    def audit_reports(self, request, pk=None):
        """Return per-auditor reports (ratings/remarks/PDF URLs) and a computed summary for Convener/HOD/Admin."""
        folder = self.get_object()
        role = request.user.role
        if role not in ['CONVENER', 'HOD', 'ADMIN']:
            return Response({'error': 'Not permitted'}, status=status.HTTP_403_FORBIDDEN)
        if role in ['CONVENER', 'HOD'] and folder.department_id != request.user.department_id:
            return Response({'error': 'Out of scope'}, status=status.HTTP_403_FORBIDDEN)

        assignments = folder.audit_assignments.select_related('auditor').all()
        items = []
        for a in assignments:
            items.append({
                'id': a.id,
                'auditor': {
                    'id': a.auditor_id,
                    'name': a.auditor.full_name,
                },
                'submitted': a.feedback_submitted,
                'decision': a.decision,
                'remarks': a.remarks,
                'ratings': a.ratings or {},
                'file_url': request.build_absolute_uri(a.feedback_file.url) if a.feedback_file else None,
                'submitted_at': a.feedback_submitted_at,
            })

        summary = self._compute_audit_summary(folder)
        consolidated_url = request.build_absolute_uri(folder.consolidated_pdf.url) if folder.consolidated_pdf else None

        return Response({
            'folder': {
                'id': folder.id,
                'course': {'code': folder.course.code, 'title': folder.course.title},
                'section': folder.section,
                'term': folder.term.session_term,
                'faculty': folder.faculty.user.full_name,
                'status': folder.status,
                'consolidated_pdf_url': consolidated_url,
            },
            'assignments': items,
            'summary': summary,
        })

    @action(detail=True, methods=['post'])
    def generate_consolidated_pdf(self, request, pk=None):
        """Merge all auditor PDFs into a single consolidated PDF; optionally prepend a cover page."""
        if not PdfMerger:
            return Response({'error': 'PDF merger backend not available on server'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        folder = self.get_object()
        role = request.user.role
        if role not in ['CONVENER', 'HOD', 'ADMIN']:
            return Response({'error': 'Not permitted'}, status=status.HTTP_403_FORBIDDEN)
        if role in ['CONVENER', 'HOD'] and folder.department_id != request.user.department_id:
            return Response({'error': 'Out of scope'}, status=status.HTTP_403_FORBIDDEN)

        # collect PDFs from assignments
        pdf_bytes_list = []
        # optional cover page
        summary = self._compute_audit_summary(folder)
        cover = self._build_cover_pdf_bytes(folder, summary)
        if cover:
            pdf_bytes_list.append(cover)

        for a in folder.audit_assignments.all():
            if a.feedback_file and hasattr(a.feedback_file, 'open'):
                try:
                    with a.feedback_file.open('rb') as f:
                        pdf_bytes_list.append(f.read())
                except Exception:
                    continue

        if not pdf_bytes_list:
            return Response({'error': 'No auditor PDFs to merge'}, status=status.HTTP_400_BAD_REQUEST)

        merged_bytes = self._merge_pdfs(pdf_bytes_list)
        if not merged_bytes:
            return Response({'error': 'Failed to merge PDFs'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"consolidated_{folder.id}_{ts}.pdf"
        folder.consolidated_pdf.save(filename, ContentFile(merged_bytes), save=False)
        folder.pdf_generated_at = timezone.now()
        folder.pdf_generation_status = 'COMPLETED'
        folder.save()

        url = request.build_absolute_uri(folder.consolidated_pdf.url) if folder.consolidated_pdf else None
        # Notify convener/HOD
        Notification.objects.create(
            user=request.user,
            notification_type='PDF_GENERATED',
            title='Consolidated Audit PDF Generated',
            message=f'Consolidated audit PDF generated for {folder.course.code} - {folder.section}.',
            folder=folder,
        )
        # Keep admins informed when a (faculty) user generates audit PDFs
        try:
            if getattr(request.user, 'role', None) == 'FACULTY':
                self._notify_admins(
                    'PDF_GENERATED',
                    'Consolidated Audit PDF Generated',
                    f'Faculty {request.user.full_name} generated a consolidated audit PDF for {folder.course.code} - {folder.section}.',
                    folder
                )
        except Exception:
            pass

        return Response({'message': 'Consolidated PDF generated', 'url': url})

    @action(detail=True, methods=['post'])
    def generate_folder_report(self, request, pk=None):
        """
        Generate a comprehensive course folder report that merges:
        1. Generated PDFs (title page, outline, course log, assessment summary)
        2. All uploaded PDFs (attendance, question papers, model solutions, sample scripts)
        
        This creates a single merged PDF containing everything in the folder.
        """
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner, Coordinator, Convener, HOD, or Admin
        allowed_roles = ['FACULTY', 'COORDINATOR', 'CONVENER', 'HOD', 'ADMIN', 'AUDIT_TEAM', 'AUDIT_MEMBER']
        if user.role not in allowed_roles:
            return Response(
                {'error': 'You do not have permission to generate folder reports'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Faculty can only generate their own folder reports
        if user.role == 'FACULTY' and folder.faculty.user != user:
            return Response(
                {'error': 'You can only generate reports for your own folders'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            print(f"DEBUG: Generating report for folder {folder.id}")
            # Collect all PDF sections (generated + uploaded)
            try:
                pdf_sections = pdf_utils.collect_folder_pdfs(folder)
            except Exception as e:
                print(f"ERROR: Failed to collect PDF sections: {e}")
                import traceback
                traceback.print_exc()
                return Response(
                    {'error': f'Failed to collect PDF sections: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            if not pdf_sections:
                return Response(
                    {'error': 'No content available to generate report'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Extract just the PDF bytes for merging
            pdf_bytes_list = []
            for section_name, pdf_bytes in pdf_sections:
                if pdf_bytes and len(pdf_bytes) > 0:
                    pdf_bytes_list.append(pdf_bytes)
                else:
                    print(f"WARNING: Section '{section_name}' has empty or None PDF bytes")
            
            if not pdf_bytes_list:
                return Response(
                    {'error': 'No valid PDF content to merge'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Merge all PDFs
            try:
                merged_pdf = pdf_utils.merge_pdfs(pdf_bytes_list)
            except ImportError:
                return Response(
                    {'error': 'PDF merging is not available on this server. Please contact administrator.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception as e:
                print(f"ERROR: Failed to merge PDFs: {e}")
                import traceback
                traceback.print_exc()
                return Response(
                    {'error': f'Failed to merge PDFs: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Save the merged PDF
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"complete_folder_report_{folder.course.code}_{folder.section}_{timestamp}.pdf"
            
            # Store in consolidated_pdf field (or create a new field if preferred)
            folder.consolidated_pdf.save(filename, ContentFile(merged_pdf), save=False)
            folder.pdf_generated_at = timezone.now()
            folder.pdf_generation_status = 'COMPLETED'
            folder.save()
            
            # Create notification for user
            Notification.objects.create(
                user=user,
                notification_type='PDF_GENERATED',
                title='Complete Folder Report Generated',
                message=f'Complete folder report generated for {folder.course.code} - {folder.section}',
                folder=folder
            )
            # Notify admins when a faculty creates a full report
            try:
                if getattr(user, 'role', None) == 'FACULTY':
                    self._notify_admins(
                        'PDF_GENERATED',
                        'Complete Folder Report Generated',
                        f'Faculty {user.full_name} generated a complete folder report for {folder.course.code} - {folder.section}',
                        folder
                    )
            except Exception:
                pass
            
            # Build response with section information
            sections_info = [{'name': name, 'included': True} for name, _ in pdf_sections]
            
            url = request.build_absolute_uri(folder.consolidated_pdf.url) if folder.consolidated_pdf else None
            
            return Response({
                'message': 'Complete folder report generated successfully',
                'url': url,
                'filename': filename,
                'sections': sections_info,
                'total_sections': len(pdf_sections),
                'generated_at': folder.pdf_generated_at
            })
            
        except Exception as e:
            folder.pdf_generation_status = 'FAILED'
            folder.save()
            
            return Response(
                {'error': f'Failed to generate complete folder report: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    @action(detail=False, methods=['get'])
    def status_counts(self, request):
        """Diagnostic endpoint: counts of folders per status for convener/admin scope.

        Query params:
          scope_all=1 -> ignore department restriction (convener only)
        """
        user = request.user
        if user.role not in ['CONVENER', 'ADMIN']:
            return Response({'error': 'Not permitted'}, status=status.HTTP_403_FORBIDDEN)
        scope_all = request.query_params.get('scope_all') in ['1', 'true', 'True', 'yes']
        qs = CourseFolder.objects.all()
        if user.role == 'CONVENER' and not scope_all and getattr(user, 'department_id', None):
            qs = qs.filter(department_id=user.department_id)
        from collections import Counter
        counts = Counter(qs.values_list('status', flat=True))
        return Response({'counts': counts})

    @action(detail=False, methods=['get'])
    def audit_queue(self, request):
        """Return folders awaiting convener action (AUDIT_COMPLETED only) regardless of department if scope_all=1.

        Optional query params:
          scope_all=1 -> bypass department scope for convener
        """
        user = request.user
        if user.role not in ['CONVENER', 'ADMIN']:
            return Response({'error': 'Not permitted'}, status=status.HTTP_403_FORBIDDEN)
        scope_all = request.query_params.get('scope_all') in ['1', 'true', 'True', 'yes']
        base = CourseFolder.objects.filter(status='AUDIT_COMPLETED')
        if user.role == 'CONVENER' and not scope_all and getattr(user, 'department_id', None):
            base = base.filter(department_id=user.department_id)
        data = []
        for f in base.select_related('course', 'faculty__user', 'term', 'department', 'program'):
            data.append({
                'id': f.id,
                'course': {'code': f.course.code, 'title': f.course.title},
                'section': f.section,
                'faculty_name': f.faculty.user.full_name,
                'department_name': f.department.name,
                'term_name': f.term.session_term,
                'status': f.status,
            })
        return Response(data)

    # Project Report File Upload/Download
    def _check_folder_edit_permission(self, folder, user):
        """
        Simplified permission check for editing a folder.
        Returns (can_edit: bool, error_message: str).
        Simple logic: Allow editing if DRAFT/REJECTED or if APPROVED_BY_HOD with first_activity_completed=True (second submission).
        """
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return False, 'You can only edit your own folders'

        # Allowed statuses for editing (initial work or rejections)
        allowed_edit_statuses = ['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD']
        if folder.status in allowed_edit_statuses:
            return True, ''  # Always editable if in these statuses

        # Simple case: APPROVED_BY_HOD with first_activity_completed = True means second submission is allowed
        if folder.status == 'APPROVED_BY_HOD' and getattr(folder, 'first_activity_completed', False):
            return True, ''  # Editable for second submission

        # Default: not editable
        return False, f'Cannot edit folder with current status {folder.status}.'

    @action(detail=True, methods=['post'], url_path='upload-project-report', parser_classes=[MultiPartParser, FormParser])
    def upload_project_report(self, request, pk=None):
        """Upload project report PDF file"""
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner only (unless in DRAFT/REJECTED status)
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only upload files to your own folders'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if folder is editable using the same logic as edit action
        can_edit, error_msg = self._check_folder_edit_permission(folder, user)
        if not can_edit:
            return Response({'error': error_msg or f'Cannot upload file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'File is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file type
        if not file.name.endswith('.pdf'):
            return Response({'error': 'Only PDF files are allowed'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file size (20MB max)
        if file.size > 20 * 1024 * 1024:
            return Response({'error': 'File size must not exceed 20MB'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete old file if exists
        if folder.project_report_file:
            folder.project_report_file.delete(save=False)
        
        # Save new file
        folder.project_report_file = file
        folder.save()
        
        # Update outline_content with metadata
        outline = folder.outline_content or {}
        outline['projectReport'] = {
            'fileName': file.name,
            'uploadDate': timezone.now().isoformat(),
            'fileSize': file.size
        }
        folder.outline_content = outline
        folder.save()
        
        return Response({
            'message': 'Project report uploaded successfully',
            'file_url': request.build_absolute_uri(folder.project_report_file.url) if folder.project_report_file else None,
            'file_name': file.name,
            'file_size': file.size
        })

    @action(detail=True, methods=['post'], url_path='upload-folder-pdf', parser_classes=[MultiPartParser, FormParser])
    def upload_folder_pdf(self, request, pk=None):
        """
        Optional: Upload a single consolidated PDF for the entire folder and validate it
        against the department checklist (Theory vs Lab).
        """
        folder = self.get_object()
        user = request.user

        # Permission check: Faculty owner only
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only upload files to your own folders'}, status=status.HTTP_403_FORBIDDEN)

        # Check if folder is editable
        if folder.status not in ['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD']:
            return Response({'error': f'Cannot upload file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'File is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not file.name.lower().endswith('.pdf'):
            return Response({'error': 'Only PDF files are allowed'}, status=status.HTTP_400_BAD_REQUEST)

        # Allow slightly larger single-PDF upload
        if file.size > 30 * 1024 * 1024:
            return Response({'error': 'File size must not exceed 30MB'}, status=status.HTTP_400_BAD_REQUEST)

        extracted_text = self._extract_pdf_text(file)
        validation = self._validate_uploaded_folder_pdf(folder, extracted_text)

        # Replace old uploaded PDF if exists
        if folder.uploaded_folder_pdf:
            try:
                folder.uploaded_folder_pdf.delete(save=False)
            except Exception:
                pass

        folder.uploaded_folder_pdf = file
        folder.uploaded_folder_pdf_checked_at = timezone.now()
        folder.uploaded_folder_pdf_validation = validation
        folder.save()

        return Response({
            'message': 'Folder PDF uploaded',
            'file_url': request.build_absolute_uri(folder.uploaded_folder_pdf.url) if folder.uploaded_folder_pdf else None,
            'validation': validation,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='download-project-report')
    def download_project_report(self, request, pk=None):
        """Download project report PDF file"""
        folder = self.get_object()
        
        if not folder.project_report_file:
            return Response({'error': 'Project report file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        from django.http import FileResponse
        return FileResponse(folder.project_report_file.open('rb'), as_attachment=True, filename=folder.project_report_file.name.split('/')[-1])

    @action(detail=True, methods=['delete'], url_path='delete-project-report')
    def delete_project_report(self, request, pk=None):
        """Delete project report PDF file"""
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner only
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only delete files from your own folders'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if folder is editable using the same logic as edit action
        can_edit, error_msg = self._check_folder_edit_permission(folder, user)
        if not can_edit:
            return Response({'error': error_msg or f'Cannot delete file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not folder.project_report_file:
            return Response({'error': 'Project report file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Delete the file
        folder.project_report_file.delete(save=False)
        folder.project_report_file = None
        folder.save()
        
        # Remove from outline_content
        outline = folder.outline_content or {}
        if 'projectReport' in outline:
            del outline['projectReport']
        folder.outline_content = outline
        folder.save()
        
        return Response({'message': 'Project report deleted successfully'})

    # Course Result File Upload/Download
    @action(detail=True, methods=['post'], url_path='upload-course-result', parser_classes=[MultiPartParser, FormParser])
    def upload_course_result(self, request, pk=None):
        """Upload course result PDF file"""
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner only (unless in DRAFT/REJECTED status)
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only upload files to your own folders'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if folder is editable using the same logic as edit action
        can_edit, error_msg = self._check_folder_edit_permission(folder, user)
        if not can_edit:
            return Response({'error': error_msg or f'Cannot upload file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'File is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file type
        if not file.name.endswith('.pdf'):
            return Response({'error': 'Only PDF files are allowed'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file size (20MB max)
        if file.size > 20 * 1024 * 1024:
            return Response({'error': 'File size must not exceed 20MB'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete old file if exists
        if folder.course_result_file:
            folder.course_result_file.delete(save=False)
        
        # Save new file
        folder.course_result_file = file
        folder.save()
        
        # Update outline_content with metadata
        outline = folder.outline_content or {}
        outline['courseResult'] = {
            'fileName': file.name,
            'uploadDate': timezone.now().isoformat(),
            'fileSize': file.size
        }
        folder.outline_content = outline
        folder.save()
        
        return Response({
            'message': 'Course result uploaded successfully',
            'file_url': request.build_absolute_uri(folder.course_result_file.url) if folder.course_result_file else None,
            'file_name': file.name,
            'file_size': file.size
        })

    @action(detail=True, methods=['get'], url_path='download-course-result')
    def download_course_result(self, request, pk=None):
        """Download course result PDF file"""
        folder = self.get_object()
        
        if not folder.course_result_file:
            return Response({'error': 'Course result file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        from django.http import FileResponse
        return FileResponse(folder.course_result_file.open('rb'), as_attachment=True, filename=folder.course_result_file.name.split('/')[-1])

    @action(detail=True, methods=['delete'], url_path='delete-course-result')
    def delete_course_result(self, request, pk=None):
        """Delete course result PDF file"""
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner only
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only delete files from your own folders'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if folder is editable using the same logic as edit action
        can_edit, error_msg = self._check_folder_edit_permission(folder, user)
        if not can_edit:
            return Response({'error': error_msg or f'Cannot delete file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not folder.course_result_file:
            return Response({'error': 'Course result file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Delete the file
        folder.course_result_file.delete(save=False)
        folder.course_result_file = None
        folder.save()
        
        # Remove from outline_content
        outline = folder.outline_content or {}
        if 'courseResult' in outline:
            del outline['courseResult']
        folder.outline_content = outline
        folder.save()
        
        return Response({'message': 'Course result deleted successfully'})

    # CLO Assessment File Upload/Download
    @action(detail=True, methods=['post'], url_path='upload-clo-assessment', parser_classes=[MultiPartParser, FormParser])
    def upload_clo_assessment(self, request, pk=None):
        """Upload CLO assessment PDF file"""
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner only (unless in DRAFT/REJECTED status)
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only upload files to your own folders'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if folder is editable
        if folder.status not in ['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD']:
            return Response({'error': f'Cannot upload file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'File is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file type
        if not file.name.endswith('.pdf'):
            return Response({'error': 'Only PDF files are allowed'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file size (20MB max)
        if file.size > 20 * 1024 * 1024:
            return Response({'error': 'File size must not exceed 20MB'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Ensure the upload directory exists
        import os
        from django.conf import settings
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'clo_assessments')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Delete old file if exists
        if folder.clo_assessment_file:
            try:
                folder.clo_assessment_file.delete(save=False)
            except Exception as e:
                print(f"Warning: Could not delete old CLO assessment file: {e}")
        
        # Save new file
        folder.clo_assessment_file = file
        folder.save()
        
        # Update outline_content with metadata
        outline = folder.outline_content or {}
        outline['cloAssessment'] = {
            'fileName': file.name,
            'uploadDate': timezone.now().isoformat(),
            'fileSize': file.size
        }
        folder.outline_content = outline
        folder.save()
        
        return Response({
            'message': 'CLO assessment uploaded successfully',
            'file_url': request.build_absolute_uri(folder.clo_assessment_file.url) if folder.clo_assessment_file else None,
            'file_name': file.name,
            'file_size': file.size
        })

    @action(detail=True, methods=['get'], url_path='download-clo-assessment')
    def download_clo_assessment(self, request, pk=None):
        """Download CLO assessment PDF file"""
        folder = self.get_object()
        
        if not folder.clo_assessment_file:
            return Response({'error': 'CLO assessment file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if file actually exists on storage
        if not folder.clo_assessment_file.storage.exists(folder.clo_assessment_file.name):
            return Response({'error': 'CLO assessment file not found on server. The file may have been deleted.'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            from django.http import FileResponse
            return FileResponse(folder.clo_assessment_file.open('rb'), as_attachment=True, filename=folder.clo_assessment_file.name.split('/')[-1])
        except Exception as e:
            return Response({'error': f'Error reading file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['delete'], url_path='delete-clo-assessment')
    def delete_clo_assessment(self, request, pk=None):
        """Delete CLO assessment PDF file"""
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner only
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only delete files from your own folders'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if folder is editable
        if folder.status not in ['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD']:
            return Response({'error': f'Cannot delete file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not folder.clo_assessment_file:
            return Response({'error': 'CLO assessment file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Delete the file
        folder.clo_assessment_file.delete(save=False)
        folder.clo_assessment_file = None
        folder.save()
        
        # Remove from outline_content
        outline = folder.outline_content or {}
        if 'cloAssessment' in outline:
            del outline['cloAssessment']
        folder.outline_content = outline
        folder.save()
        
        return Response({'message': 'CLO assessment deleted successfully'})

    # Folder Review Report File Upload/Download
    @action(detail=True, methods=['post'], url_path='upload-folder-review-report', parser_classes=[MultiPartParser, FormParser])
    def upload_folder_review_report(self, request, pk=None):
        """Upload Folder Review Report PDF file"""
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner only (unless in DRAFT/REJECTED status)
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only upload files to your own folders'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if folder is editable using the same logic as edit action
        can_edit, error_msg = self._check_folder_edit_permission(folder, user)
        if not can_edit:
            return Response({'error': error_msg or f'Cannot upload file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'File is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file type
        if not file.name.endswith('.pdf'):
            return Response({'error': 'Only PDF files are allowed'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file size (20MB max)
        if file.size > 20 * 1024 * 1024:
            return Response({'error': 'File size must not exceed 20MB'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete old file if exists
        if folder.folder_review_report_file:
            folder.folder_review_report_file.delete(save=False)
        
        # Save new file
        folder.folder_review_report_file = file
        folder.save()
        
        # Update outline_content with metadata
        outline = folder.outline_content or {}
        outline['folderReviewReport'] = {
            'fileName': file.name,
            'uploadDate': timezone.now().isoformat(),
            'fileSize': file.size
        }
        folder.outline_content = outline
        folder.save()
        
        return Response({
            'message': 'Folder review report uploaded successfully',
            'file_url': request.build_absolute_uri(folder.folder_review_report_file.url) if folder.folder_review_report_file else None,
            'file_name': file.name,
            'file_size': file.size
        })

    @action(detail=True, methods=['get'], url_path='download-folder-review-report')
    def download_folder_review_report(self, request, pk=None):
        """Download Folder Review Report PDF file"""
        folder = self.get_object()
        
        if not folder.folder_review_report_file:
            return Response({'error': 'Folder review report file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        from django.http import FileResponse
        return FileResponse(folder.folder_review_report_file.open('rb'), as_attachment=True, filename=folder.folder_review_report_file.name.split('/')[-1])

    @action(detail=True, methods=['delete'], url_path='delete-folder-review-report')
    def delete_folder_review_report(self, request, pk=None):
        """Delete Folder Review Report PDF file"""
        folder = self.get_object()
        user = request.user
        
        # Permission check: Faculty owner only
        if hasattr(user, 'faculty_profile') and folder.faculty != user.faculty_profile:
            return Response({'error': 'You can only delete files from your own folders'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if folder is editable using the same logic as edit action
        can_edit, error_msg = self._check_folder_edit_permission(folder, user)
        if not can_edit:
            return Response({'error': error_msg or f'Cannot delete file when folder status is {folder.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not folder.folder_review_report_file:
            return Response({'error': 'Folder review report file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Delete the file
        folder.folder_review_report_file.delete(save=False)
        folder.folder_review_report_file = None
        folder.save()
        
        # Remove from outline_content
        outline = folder.outline_content or {}
        if 'folderReviewReport' in outline:
            del outline['folderReviewReport']
        folder.outline_content = outline
        folder.save()
        
        return Response({'message': 'Folder review report deleted successfully'})



class FolderComponentViewSet(viewsets.ModelViewSet):
    """ViewSet for folder components (file uploads)"""
    serializer_class = FolderComponentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return components scoped to the requesting user's access level."""
        queryset = FolderComponent.objects.select_related('folder', 'folder__faculty__user')

        # Limit scope based on role so users only see their accessible folders
        user = self.request.user
        role = getattr(user, 'role', None)

        if role == 'FACULTY':
            queryset = queryset.filter(folder__faculty__user=user)
        elif role == 'COORDINATOR':
            queryset = queryset.filter(
                Q(folder__program=user.program) | Q(folder__department=user.department)
            )
        elif role == 'CONVENER':
            queryset = queryset.filter(folder__department=user.department)
        elif role == 'HOD':
            queryset = queryset.filter(folder__department=user.department)
        elif role in ['AUDIT_TEAM', 'AUDIT_MEMBER', 'EVALUATOR']:
            queryset = queryset.filter(folder__audit_assignments__auditor=user)
        elif role != 'ADMIN':
            # Default to denying access for any other roles
            queryset = queryset.none()

        folder_id = self.request.query_params.get('folder')
        if folder_id:
            queryset = queryset.filter(folder_id=folder_id)

        return queryset.distinct()

    def perform_create(self, serializer):
        folder_id = self.request.data.get('folder')
        if not folder_id:
            raise serializers.ValidationError({'folder': 'Folder is required.'})

        try:
            folder = CourseFolder.objects.get(id=folder_id)
        except CourseFolder.DoesNotExist:
            raise serializers.ValidationError({'folder': 'Invalid folder selected.'})

        entry = serializer.save(folder=folder)
        # Notify admins when faculty creates a log entry
        try:
            if getattr(self.request.user, 'role', None) == 'FACULTY':
                self._notify_admins(
                    'OTHER',
                    'Course Log Entry Added',
                    f"Faculty {self.request.user.full_name} added a course log entry (lecture {entry.lecture_number}) for {folder.course.code} - {folder.section}",
                    folder
                )
        except Exception:
            pass
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ComponentUploadSerializer
        return FolderComponentSerializer
    
    def perform_create(self, serializer):
        comp = serializer.save(uploaded_by=self.request.user)
        # Inform admins when faculty uploads a new component for oversight
        try:
            if getattr(self.request.user, 'role', None) == 'FACULTY':
                self._notify_admins(
                    'OTHER',
                    'Folder Component Uploaded',
                    f"Faculty {self.request.user.full_name} uploaded '{comp.title}' to {comp.folder.course.code} - {comp.folder.section}",
                    comp.folder
                )
        except Exception:
            pass


class AssessmentViewSet(viewsets.ModelViewSet):
    """ViewSet for assessments"""
    serializer_class = AssessmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = Assessment.objects.select_related('folder', 'folder__faculty__user')

        user = self.request.user
        role = getattr(user, 'role', None)

        if role == 'FACULTY':
            queryset = queryset.filter(folder__faculty__user=user)
        elif role == 'COORDINATOR':
            queryset = queryset.filter(
                Q(folder__program=user.program) | Q(folder__department=user.department)
            )
        elif role in ['CONVENER', 'HOD']:
            queryset = queryset.filter(folder__department=user.department)
        elif role in ['AUDIT_TEAM', 'AUDIT_MEMBER', 'EVALUATOR']:
            queryset = queryset.filter(folder__audit_assignments__auditor=user)
        elif role != 'ADMIN':
            queryset = queryset.none()

        folder_id = self.request.query_params.get('folder')
        if folder_id:
            queryset = queryset.filter(folder_id=folder_id)

        return queryset.distinct()
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return AssessmentUploadSerializer
        return AssessmentSerializer

    def perform_create(self, serializer):
        folder_id = self.request.data.get('folder')
        if not folder_id:
            raise serializers.ValidationError({'folder': 'Folder is required.'})

        try:
            folder = CourseFolder.objects.get(id=folder_id)
        except CourseFolder.DoesNotExist:
            raise serializers.ValidationError({'folder': 'Invalid folder selected.'})

        assessment = serializer.save(folder=folder)
        # Notify admins if faculty created an assessment entry
        try:
            if getattr(self.request.user, 'role', None) == 'FACULTY':
                self._notify_admins(
                    'OTHER',
                    'Assessment Added',
                    f"Faculty {self.request.user.full_name} added assessment '{assessment.title}' for {folder.course.code} - {folder.section}",
                    folder
                )
        except Exception:
            pass


class CourseLogEntryViewSet(viewsets.ModelViewSet):
    """ViewSet for course log entries"""
    serializer_class = CourseLogEntrySerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = CourseLogEntry.objects.select_related('folder', 'folder__faculty__user')

        user = self.request.user
        role = getattr(user, 'role', None)

        if role == 'FACULTY':
            queryset = queryset.filter(folder__faculty__user=user)
        elif role == 'COORDINATOR':
            queryset = queryset.filter(
                Q(folder__program=user.program) | Q(folder__department=user.department)
            )
        elif role in ['CONVENER', 'HOD']:
            queryset = queryset.filter(folder__department=user.department)
        elif role in ['AUDIT_TEAM', 'AUDIT_MEMBER', 'EVALUATOR']:
            queryset = queryset.filter(folder__audit_assignments__auditor=user)
        elif role != 'ADMIN':
            queryset = queryset.none()

        folder_id = self.request.query_params.get('folder')
        if folder_id:
            queryset = queryset.filter(folder_id=folder_id)

        return queryset.distinct()

    @action(detail=True, methods=['post'], url_path='upload-attendance', parser_classes=[MultiPartParser, FormParser])
    def upload_attendance(self, request, pk=None):
        """Attach or replace attendance sheet for a specific lecture."""
        log_entry = self.get_object()
        attendance_file = request.FILES.get('attendance_sheet')

        if not attendance_file:
            return Response({'error': 'Attendance file is required'}, status=status.HTTP_400_BAD_REQUEST)

        if attendance_file.size > 20 * 1024 * 1024:
            return Response({'error': 'Attendance file must not exceed 20MB.'}, status=status.HTTP_400_BAD_REQUEST)

        if log_entry.attendance_sheet:
            log_entry.attendance_sheet.delete(save=False)

        log_entry.attendance_sheet = attendance_file
        log_entry.save()

        # Notify admins about attendance upload if performed by faculty
        try:
            if getattr(request.user, 'role', None) == 'FACULTY':
                self._notify_admins(
                    'OTHER',
                    'Attendance Uploaded',
                    f"Faculty {request.user.full_name} uploaded an attendance sheet for {log_entry.folder.course.code} - {log_entry.folder.section} (lecture {log_entry.lecture_number})",
                    log_entry.folder
                )
        except Exception:
            pass

        serializer = self.get_serializer(log_entry)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for user notifications"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'delete']
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Mark notification as read"""
        notification = self.get_object()
        notification.is_read = True
        notification.acknowledged_at = timezone.now()
        notification.save()
        
        serializer = self.get_serializer(notification)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        Notification.objects.filter(
            user=request.user,
            is_read=False
        ).update(
            is_read=True,
            acknowledged_at=timezone.now()
        )
        
        return Response({'message': 'All notifications marked as read'})


class FolderDeadlineViewSet(viewsets.ModelViewSet):
    """ViewSet for managing folder submission deadlines"""
    queryset = FolderDeadline.objects.all()
    serializer_class = FolderDeadlineSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter deadlines based on user role and query params"""
        user = self.request.user
        queryset = FolderDeadline.objects.all().select_related('term', 'department', 'set_by')
        
        # Filter by term if provided
        term_id = self.request.query_params.get('term')
        if term_id:
            queryset = queryset.filter(term_id=term_id)
        
        # Filter by department if provided
        department_id = self.request.query_params.get('department')
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        
        # Filter by deadline type if provided
        deadline_type = self.request.query_params.get('deadline_type')
        if deadline_type:
            queryset = queryset.filter(deadline_type=deadline_type)
        
        # For convener/HOD, show deadlines for their department
        if user.role in ['CONVENER', 'HOD']:
            if user.department:
                queryset = queryset.filter(department=user.department)
        
        return queryset.order_by('-deadline_date')
    
    def perform_create(self, serializer):
        """Set the user who created the deadline and notify faculty"""
        deadline = serializer.save(set_by=self.request.user)
        self._notify_faculty_about_deadline(deadline)
    
    def perform_update(self, serializer):
        """Update deadline and notify faculty if date changed"""
        old_deadline_date = serializer.instance.deadline_date
        deadline = serializer.save()
        # If deadline date changed, notify faculty again
        if old_deadline_date != deadline.deadline_date:
            self._notify_faculty_about_deadline(deadline)
    
    def _notify_faculty_about_deadline(self, deadline):
        """Notify all faculty with assigned courses about the deadline"""
        from courses.models import CourseAllocation
        
        # Get all faculty who have course allocations for this term and department
        allocations = CourseAllocation.objects.filter(
            term=deadline.term,
            is_active=True
        )
        
        if deadline.department:
            allocations = allocations.filter(department=deadline.department)
        
        # Get unique faculty users
        faculty_users = set()
        for allocation in allocations:
            if allocation.faculty and allocation.faculty.user:
                faculty_users.add(allocation.faculty.user)
        
        # Create notifications for each faculty member
        deadline_type_display = deadline.get_deadline_type_display()
        term_display = deadline.term.session_term
        dept_display = deadline.department.name if deadline.department else "All Departments"
        deadline_date_str = deadline.deadline_date.strftime('%Y-%m-%d %H:%M')
        
        title = f"Folder Submission Deadline Set: {deadline_type_display}"
        message = (
            f"A submission deadline has been set for {deadline_type_display}.\n\n"
            f"Term: {term_display}\n"
            f"Department: {dept_display}\n"
            f"Deadline: {deadline_date_str}\n\n"
        )
        if deadline.notes:
            message += f"Notes: {deadline.notes}"
        
        for faculty_user in faculty_users:
            Notification.objects.create(
                user=faculty_user,
                notification_type='OTHER',
                title=title,
                message=message
            )
    
    @action(detail=False, methods=['get'], url_path='current-for-folder')
    def current_for_folder(self, request):
        """Get current deadlines for a specific folder"""
        folder_id = request.query_params.get('folder_id')
        if not folder_id:
            return Response({'error': 'folder_id parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            folder = CourseFolder.objects.get(id=folder_id)
        except CourseFolder.DoesNotExist:
            return Response({'error': 'Folder not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get deadlines for this folder's term and department
        deadlines = FolderDeadline.objects.filter(
            term=folder.term,
            department=folder.department
        ).order_by('deadline_type', '-deadline_date')
        
        # Group by deadline_type and get the most recent for each type
        first_submission_deadline = deadlines.filter(deadline_type='FIRST_SUBMISSION').first()
        final_submission_deadline = deadlines.filter(deadline_type='FINAL_SUBMISSION').first()
        
        serializer = self.get_serializer([d for d in [first_submission_deadline, final_submission_deadline] if d], many=True)
        return Response(serializer.data)



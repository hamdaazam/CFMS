from rest_framework import status, generics, viewsets, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User
from .models import RoleAssignmentRequest
from .serializers import RoleAssignmentRequestSerializer
from rest_framework.decorators import action
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from course_folders.models import Notification
from rest_framework import permissions
from courses.models import CourseCoordinatorAssignment, Course
from programs.models import Program
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    ChangePasswordSerializer, UpdateProfileSerializer, UploadProfilePictureSerializer
)
from django_filters.rest_framework import DjangoFilterBackend


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserMeView(generics.RetrieveAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Password changed successfully."
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UpdateProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    def put(self, request):
        serializer = UpdateProfileSerializer(
            request.user, 
            data=request.data, 
            context={'request': request},
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Profile updated successfully.",
                "user": UserSerializer(request.user).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UploadProfilePictureView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = UploadProfilePictureSerializer(
            data=request.data, 
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Profile picture uploaded successfully.",
                "user": UserSerializer(request.user).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    """Generic user management endpoints used by admin/convener UIs.

    Supports filtering by role/department/program and search by name/email/CNIC.
    """
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated,)

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'department', 'program', 'is_active', 'cnic']
    search_fields = ['full_name', 'email', 'cnic']
    ordering_fields = ['date_joined', 'full_name']
    ordering = ['-date_joined']

    def get_queryset(self):
        """By default, only return active users"""
        queryset = User.objects.filter(is_active=True).order_by('-date_joined')
        
        # Allow explicit query for inactive users (for admin purposes)
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None and is_active.lower() == 'false':
            queryset = User.objects.filter(is_active=False).order_by('-date_joined')
        
        return queryset
    
    def destroy(self, request, *args, **kwargs):
        """Completely delete user from database"""
        user = self.get_object()
        user.delete()
        
        return Response(
            {'message': 'User deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )

    def partial_update(self, request, *args, **kwargs):
        """Intercept role changes to COORDINATOR/CONVENER and create a RoleAssignmentRequest instead of immediate assignment."""
        user = self.get_object()
        data = request.data
        new_role = data.get('role')
        if new_role in ['COORDINATOR', 'CONVENER'] and user.role != new_role:
            # Only Admin may request assignments
            if request.user.role != 'ADMIN':
                return Response({'detail': 'Only Admin can request role assignments.'}, status=status.HTTP_403_FORBIDDEN)

            # Create a role assignment request
            department_id = data.get('department') or (user.department.id if user.department else None)
            program_id = data.get('program') or (user.program.id if user.program else None)
            coordinator_course_ids = data.get('coordinator_course_ids', [])
            # Prevent duplicate convener request or existing convener in that department
            if new_role == 'CONVENER' and department_id is not None:
                # Active convener exists in department
                if User.objects.filter(role='CONVENER', department_id=department_id, is_active=True).exclude(id=user.id).exists():
                    return Response({'detail': 'It is not possible to add two conveners in the same department.'}, status=status.HTTP_400_BAD_REQUEST)
                # Pending convener request exists
                if RoleAssignmentRequest.objects.filter(role='CONVENER', department_id=department_id, status='PENDING').exists():
                    return Response({'detail': 'It is not possible to add two conveners in the same department.'}, status=status.HTTP_400_BAD_REQUEST)
            # If this is a COORDINATOR request and department is not provided but program is,
            # derive the department from the Program so HODs get notified and HOD can see it.
            if new_role == 'COORDINATOR' and department_id is None and program_id:
                try:
                    prog = Program.objects.get(id=program_id)
                    department_id = prog.department.id if prog.department else None
                except Program.DoesNotExist:
                    department_id = None

            # Create and save request; requester is current admin
            RoleAssignmentRequest.objects.create(
                requested_by=request.user,
                target_user=user,
                role=new_role,
                department_id=department_id,
                program_id=program_id,
                coordinator_course_ids=coordinator_course_ids or []
            )
            # Notifications are created centrally via the RoleAssignmentRequest post_save signal.
            return Response({'detail': 'Role assignment request created and sent to HOD for approval.'}, status=status.HTTP_200_OK)

        return super().partial_update(request, *args, **kwargs)


class IsHODOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (request.user.role in ['ADMIN', 'HOD'])


class RoleAssignmentRequestViewSet(viewsets.ModelViewSet):
    """API to manage role assignment requests.
    Admins can create requests. HOD can approve or reject for their department.
    """
    queryset = RoleAssignmentRequest.objects.all().order_by('-requested_at')
    serializer_class = RoleAssignmentRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'department', 'requested_by', 'target_user', 'role']

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter: If HOD, only see requests for their department; Admin sees all
        if self.request.user.role == 'HOD':
            return qs.filter(department=self.request.user.department)
        if self.request.user.role == 'ADMIN':
            return qs
        if self.request.user.role == 'CONVENER' or self.request.user.role == 'COORDINATOR':
            return qs.filter(requested_by=self.request.user)
        return RoleAssignmentRequest.objects.none()

    def create(self, request, *args, **kwargs):
        # Only Admin can create requests
        if not request.user.role == 'ADMIN':
            return Response({'detail': 'Only admin can request role assignments.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = serializer.save(requested_by=request.user)
        # If a coordinator request was created with only a program, make sure we set the department
        # from the program so HODs are notified and HOD-level filtering works.
        if not req.department and req.program:
            try:
                req.department = req.program.department
                req.save()
            except Exception:
                # Best-effort — continue without failing the request
                pass

        # Notifications are created centrally via the RoleAssignmentRequest post_save signal.
        # Optionally notify HOD user(s) — skip for now or create simple Notification
        return Response(self.get_serializer(req).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        req = self.get_object()
        # Only admin or the original requester may delete a pending request
        if request.user.role != 'ADMIN' and request.user != req.requested_by:
            return Response({'detail': 'Not authorized to delete this request.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        req = self.get_object()
        # Only HOD for the department can approve
        if request.user.role != 'HOD' or request.user.department != req.department:
            return Response({'detail': 'Only HOD of the department can approve this request.'}, status=status.HTTP_403_FORBIDDEN)

        if req.status != 'PENDING':
            return Response({'detail': 'Request already processed.'}, status=status.HTTP_400_BAD_REQUEST)

        # If approving a CONVENER, ensure there isn't already an active Convener for the department (excluding the target_user)
        if req.role == 'CONVENER' and req.department:
            if User.objects.filter(role='CONVENER', department=req.department, is_active=True).exclude(id=req.target_user.id).exists():
                return Response({'detail': 'It is not possible to add two conveners in the same department. Approve cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        # Grant the role and perform extra actions
        user = req.target_user
        if req.role == 'CONVENER':
            user.role = 'CONVENER'
            user.department = req.department or user.department
            user.save()
            # Update faculty profile if exists
            try:
                if hasattr(user, 'faculty_profile'):
                    faculty_profile = user.faculty_profile
                    faculty_profile.designation = 'CONVENER'
                    faculty_profile.department = req.department or faculty_profile.department
                    faculty_profile.save()
            except Exception:
                pass
        elif req.role == 'COORDINATOR':
            user.role = 'COORDINATOR'
            user.department = req.department or user.department
            user.program = req.program or user.program
            user.save()
            # Create CourseCoordinatorAssignment for provided course ids
            course_ids = req.coordinator_course_ids or []
            existing = set(CourseCoordinatorAssignment.objects.filter(coordinator=user).values_list('course_id', flat=True))
            request_user = request.user
            for cid in course_ids:
                try:
                    course = Course.objects.get(id=cid)
                except Course.DoesNotExist:
                    continue
                if course.id in existing:
                    continue
                CourseCoordinatorAssignment.objects.create(
                    coordinator=user,
                    course=course,
                    department=course.department,
                    program=course.program,
                    assigned_by=request_user
                )
            # Update faculty profile if exists
            try:
                if hasattr(user, 'faculty_profile'):
                    faculty_profile = user.faculty_profile
                    faculty_profile.designation = 'COORDINATOR'
                    faculty_profile.department = req.department or faculty_profile.department
                    faculty_profile.program = req.program or faculty_profile.program
                    faculty_profile.save()
            except Exception:
                pass

        req.status = 'APPROVED'
        req.decided_by = request.user
        req.decided_at = timezone.now()
        req.save()

        # If we just approved a convener, cancel any other pending convener requests for the same department
        if req.role == 'CONVENER' and req.department:
            other_qs = RoleAssignmentRequest.objects.filter(role='CONVENER', department=req.department, status='PENDING').exclude(id=req.id)
            # Iterate so we can add notifications for each rejected request
            for rj in other_qs:
                rj.status = 'REJECTED'
                rj.decided_by = request.user
                rj.decided_at = timezone.now()
                rj.decision_reason = 'Another convener was approved for this department.'
                rj.save()
                if rj.requested_by:
                    Notification.objects.create(
                        user=rj.requested_by,
                        notification_type='OTHER',
                        title='Role Request Rejected',
                        message=(f"Your convener request for {rj.target_user.full_name} was rejected because another convener was approved for the department."),
                    )
                    try:
                        if rj.requested_by.email:
                            send_mail(
                                subject='Role Request Rejected',
                                message=(f"Dear {rj.requested_by.full_name},\n\nYour convener request for {rj.target_user.full_name} was rejected because another convener was approved for the department.\n\nDecision reason: Another convener was approved for this department."),
                                from_email=settings.DEFAULT_FROM_EMAIL,
                                recipient_list=[rj.requested_by.email],
                                fail_silently=True,
                            )
                    except Exception:
                        pass

        # Notify the original requester and the target user of success
        if req.requested_by:
            Notification.objects.create(
                user=req.requested_by,
                notification_type='OTHER',
                title='Role Request Approved',
                message=(f"Your request for {req.role} on {req.target_user.full_name} has been approved."),
            )
            try:
                if req.requested_by.email:
                    send_mail(
                        subject='Role Request Approved',
                        message=(f"Dear {req.requested_by.full_name},\n\nYour request for {req.role} on {req.target_user.full_name} has been approved by {request.user.full_name}.\n\n"),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[req.requested_by.email],
                        fail_silently=True,
                    )
            except Exception:
                pass

        if req.target_user:
            Notification.objects.create(
                user=req.target_user,
                notification_type='OTHER',
                title='Role Request Approved',
                message=(f"Your role as {req.role} has been approved by {request.user.full_name}."),
            )
            try:
                if req.target_user.email:
                    send_mail(
                        subject='Role Assignment Approved',
                        message=(f"Dear {req.target_user.full_name},\n\nYour role as {req.role} has been approved by {request.user.full_name}.\n\n"),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[req.target_user.email],
                        fail_silently=True,
                    )
            except Exception:
                pass

        return Response({'detail': 'Request approved and role applied.'})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        req = self.get_object()
        if request.user.role != 'HOD' or request.user.department != req.department:
            return Response({'detail': 'Only HOD of the department can reject this request.'}, status=status.HTTP_403_FORBIDDEN)
        if req.status != 'PENDING':
            return Response({'detail': 'Request already processed.'}, status=status.HTTP_400_BAD_REQUEST)

        req.status = 'REJECTED'
        req.decided_by = request.user
        req.decided_at = timezone.now()
        req.decision_reason = request.data.get('decision_reason', '')
        req.save()

        # Notify requester and target user about the rejection
        if req.requested_by:
            Notification.objects.create(
                user=req.requested_by,
                notification_type='OTHER',
                title='Role Request Rejected',
                message=(f"Your {req.role} request for {req.target_user.full_name} was rejected. Reason: {req.decision_reason}"),
            )
            try:
                if req.requested_by.email:
                    send_mail(
                        subject='Role Request Rejected',
                        message=(f"Dear {req.requested_by.full_name},\n\nYour {req.role} request for {req.target_user.full_name} was rejected.\n\nReason: {req.decision_reason}\n\n"),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[req.requested_by.email],
                        fail_silently=True,
                    )
            except Exception:
                pass

        if req.target_user:
            Notification.objects.create(
                user=req.target_user,
                notification_type='OTHER',
                title='Role Request Rejected',
                message=(f"Your role request as {req.role} was rejected by HOD. Reason: {req.decision_reason}"),
            )
            try:
                if req.target_user.email:
                    send_mail(
                        subject='Role Request Rejected',
                        message=(f"Dear {req.target_user.full_name},\n\nYour request for role {req.role} was rejected by {request.user.full_name}.\n\nDecision reason: {req.decision_reason}\n\n"),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[req.target_user.email],
                        fail_silently=True,
                    )
            except Exception:
                pass

        return Response({'detail': 'Request rejected.'})

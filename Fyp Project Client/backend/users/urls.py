from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, LoginView, LogoutView, UserMeView,
    ChangePasswordView, UpdateProfileView, UploadProfilePictureView,
    UserViewSet
)
from .views import RoleAssignmentRequestViewSet

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserMeView.as_view(), name='user-me'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('update-profile/', UpdateProfileView.as_view(), name='update-profile'),
    path('upload-profile-picture/', UploadProfilePictureView.as_view(), name='upload-profile-picture'),
]

# DRF router for user management
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'role-requests', RoleAssignmentRequestViewSet, basename='role-request')

urlpatterns += router.urls

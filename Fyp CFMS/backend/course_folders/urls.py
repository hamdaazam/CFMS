from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseFolderViewSet,
    FolderComponentViewSet,
    AssessmentViewSet,
    CourseLogEntryViewSet,
    NotificationViewSet,
    FolderDeadlineViewSet
)

router = DefaultRouter()
router.register(r'folders', CourseFolderViewSet, basename='coursefolder')
router.register(r'components', FolderComponentViewSet, basename='foldercomponent')
router.register(r'assessments', AssessmentViewSet, basename='assessment')
router.register(r'logs', CourseLogEntryViewSet, basename='courselogentry')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'deadlines', FolderDeadlineViewSet, basename='folderdeadline')

urlpatterns = [
    path('', include(router.urls)),
]

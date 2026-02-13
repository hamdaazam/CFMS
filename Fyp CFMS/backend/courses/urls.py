from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseViewSet, 
    CourseAllocationViewSet, 
    CourseCoordinatorAssignmentViewSet,
    CourseExcelUploadView, 
    CourseAllocationExcelUploadView
)

router = DefaultRouter()
router.register(r'allocations', CourseAllocationViewSet, basename='course-allocation')
router.register(r'coordinator-assignments', CourseCoordinatorAssignmentViewSet, basename='coordinator-assignment')
router.register(r'', CourseViewSet, basename='course')

urlpatterns = [
    path('upload-excel/', CourseExcelUploadView.as_view(), name='course-excel-upload'),
    path('allocations/upload-excel/', CourseAllocationExcelUploadView.as_view(), name='course-allocation-excel-upload'),
    path('', include(router.urls)),
]

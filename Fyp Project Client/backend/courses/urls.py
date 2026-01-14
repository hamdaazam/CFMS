from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CourseViewSet, CourseAllocationViewSet, CourseExcelUploadView, CourseAllocationExcelUploadView

router = DefaultRouter()
router.register(r'allocations', CourseAllocationViewSet, basename='course-allocation')
router.register(r'', CourseViewSet, basename='course')

urlpatterns = [
    path('upload-excel/', CourseExcelUploadView.as_view(), name='course-excel-upload'),
    path('allocations/upload-excel/', CourseAllocationExcelUploadView.as_view(), name='course-allocation-excel-upload'),
    path('', include(router.urls)),
]

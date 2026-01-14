from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FacultyViewSet, FacultyExcelUploadView

router = DefaultRouter()
router.register(r'', FacultyViewSet, basename='faculty')

urlpatterns = [
    path('upload-excel/', FacultyExcelUploadView.as_view(), name='faculty-excel-upload'),
    path('', include(router.urls)),
]

from django.contrib import admin
from .models import Faculty


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('user', 'designation', 'department', 'program', 'phone', 'is_active')
    list_filter = ('designation', 'is_active', 'department', 'program')
    search_fields = ('user__full_name', 'user__email', 'phone')
    ordering = ('user__full_name',)

from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_code', 'created_at')
    search_fields = ('name', 'short_code')
    ordering = ('name',)

from django.contrib import admin
from .models import Program


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ('title', 'short_code', 'department', 'created_at')
    list_filter = ('department',)
    search_fields = ('title', 'short_code')
    ordering = ('title',)

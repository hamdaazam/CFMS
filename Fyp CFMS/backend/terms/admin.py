from django.contrib import admin
from .models import Term


@admin.register(Term)
class TermAdmin(admin.ModelAdmin):
    list_display = ('session_term', 'start_date', 'end_date', 'is_active', 'created_at')
    list_filter = ('is_active', 'start_date', 'end_date')
    search_fields = ('session_term',)
    ordering = ('-start_date',)

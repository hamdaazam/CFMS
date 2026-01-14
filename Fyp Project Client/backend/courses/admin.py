from django.contrib import admin
from .models import Course, CourseAllocation, CourseCoordinatorAssignment


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'credit_hours', 'course_type', 'department', 'program', 'is_active')
    list_filter = ('course_type', 'department', 'program', 'is_active')
    search_fields = ('code', 'title', 'description')
    ordering = ('code',)
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Course Information', {
            'fields': ('code', 'title', 'credit_hours', 'course_type', 'description')
        }),
        ('Department & Program', {
            'fields': ('department', 'program')
        }),
        ('Prerequisites', {
            'fields': ('pre_requisites',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CourseAllocation)
class CourseAllocationAdmin(admin.ModelAdmin):
    list_display = ('course', 'faculty_name', 'section', 'department', 'program', 'term', 'is_active', 'created_at')
    list_filter = ('department', 'program', 'term', 'is_active', 'created_at')
    search_fields = ('course__code', 'course__title', 'faculty__user__full_name', 'section')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')
    
    def faculty_name(self, obj):
        return obj.faculty.user.full_name
    faculty_name.short_description = 'Faculty'
    
    fieldsets = (
        ('Allocation Information', {
            'fields': ('course', 'faculty', 'section')
        }),
        ('Department & Program', {
            'fields': ('department', 'program', 'term')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CourseCoordinatorAssignment)
class CourseCoordinatorAssignmentAdmin(admin.ModelAdmin):
    list_display = ('course', 'coordinator', 'department', 'program', 'term', 'is_active', 'assigned_at')
    list_filter = ('department', 'program', 'term', 'is_active')
    search_fields = ('course__code', 'course__title', 'coordinator__full_name', 'coordinator__cnic')
    autocomplete_fields = ('course', 'coordinator', 'department', 'program', 'term', 'assigned_by')

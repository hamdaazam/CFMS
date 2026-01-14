from django.core.management.base import BaseCommand
from course_folders.models import CourseFolder


class Command(BaseCommand):
    help = 'Fix course folders that are missing program assignments by inheriting from their course allocations'

    def handle(self, *args, **options):
        # Check all folders first
        all_folders = CourseFolder.objects.all().select_related('course_allocation', 'program', 'course')
        self.stdout.write(f'📊 Total folders in database: {all_folders.count()}')
        
        # Display all folders with their program info
        self.stdout.write('\n📋 Current folder programs:')
        for folder in all_folders:
            program_name = folder.program.name if folder.program else 'NULL'
            allocation_program = folder.course_allocation.program.name if folder.course_allocation and folder.course_allocation.program else 'NULL'
            self.stdout.write(
                f'  Folder {folder.id}: program={program_name}, course_allocation.program={allocation_program}'
            )
        
        # Find folders without a program
        folders_without_program = CourseFolder.objects.filter(program__isnull=True).select_related('course_allocation')
        self.stdout.write(f'\n🔍 Folders without program: {folders_without_program.count()}')
        
        updated_count = 0
        skipped_count = 0
        
        for folder in folders_without_program:
            if folder.course_allocation and folder.course_allocation.program:
                folder.program = folder.course_allocation.program
                folder.save(update_fields=['program'])
                updated_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Updated folder {folder.id} ({folder.course.code} - {folder.section}) '
                        f'with program: {folder.course_allocation.program.name}'
                    )
                )
            else:
                skipped_count += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'⚠ Skipped folder {folder.id} ({folder.course.code} - {folder.section}) - '
                        f'no program in course allocation'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Complete! Updated {updated_count} folders, skipped {skipped_count} folders.'
            )
        )

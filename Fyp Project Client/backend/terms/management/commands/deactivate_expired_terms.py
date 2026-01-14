"""
Management command to automatically deactivate expired terms.

Usage:
    python manage.py deactivate_expired_terms

This command should be run daily via cron job or task scheduler:
- Windows Task Scheduler: Run daily at midnight
- Linux cron: Add to crontab: 0 0 * * * cd /path/to/project && python manage.py deactivate_expired_terms
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from terms.models import Term


class Command(BaseCommand):
    help = 'Deactivate terms whose end date has passed'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show which terms would be deactivated without actually deactivating them',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        today = timezone.now().date()
        
        # Find expired active terms
        expired_terms = Term.objects.filter(is_active=True, end_date__lt=today)
        count = expired_terms.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No expired terms found.'))
            return
        
        # Display terms to be deactivated
        self.stdout.write(self.style.WARNING(f'Found {count} expired term(s):'))
        for term in expired_terms:
            days_expired = (today - term.end_date).days
            self.stdout.write(f'  - {term.session_term} (ended {days_expired} day(s) ago on {term.end_date})')
        
        if dry_run:
            self.stdout.write(self.style.NOTICE('\n[DRY RUN] No changes made. Remove --dry-run to deactivate these terms.'))
        else:
            # Deactivate expired terms
            deactivated_count = Term.deactivate_expired_terms()
            self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully deactivated {deactivated_count} expired term(s).'))

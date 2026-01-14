from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta


class Term(models.Model):
    session_term = models.CharField(max_length=50, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'terms_term'
        ordering = ['-start_date']
        verbose_name = 'Term'
        verbose_name_plural = 'Terms'

    def __str__(self):
        return self.session_term
    
    def clean(self):
        """Validate term before saving"""
        super().clean()
        
        # Get today's date (timezone-aware)
        today = timezone.now().date()
        
        # Check if trying to activate a term with past end date
        if self.is_active and self.end_date < today:
            raise ValidationError({
                'is_active': 'Cannot activate a term whose end date has already passed.'
            })
    
    def save(self, *args, **kwargs):
        """Override save to enforce business rules"""
        today = timezone.now().date()
        
        # If marking this term as active, check if it's expired first
        if self.is_active and self.end_date < today:
            raise ValidationError('Cannot activate a term whose end date has already passed.')
        
        # Auto-deactivate if end date has passed (for existing terms being updated)
        if self.end_date < today:
            self.is_active = False
        
        # If marking this term as active, deactivate all other terms
        if self.is_active:
            # Deactivate all other terms
            Term.objects.exclude(pk=self.pk).update(is_active=False)
        
        super().save(*args, **kwargs)
    
    @classmethod
    def deactivate_expired_terms(cls):
        """Class method to deactivate terms whose end date has passed"""
        today = timezone.now().date()
        expired_terms = cls.objects.filter(is_active=True, end_date__lt=today)
        count = expired_terms.update(is_active=False)
        return count
    
    @property
    def is_expired(self):
        """Check if term has expired"""
        return self.end_date < timezone.now().date()
    
    @property
    def days_until_expiry(self):
        """Calculate days until term expires (negative if already expired)"""
        today = timezone.now().date()
        return (self.end_date - today).days

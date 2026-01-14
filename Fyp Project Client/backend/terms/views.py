from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Term
from .serializers import TermSerializer


class TermViewSet(viewsets.ModelViewSet):
    queryset = Term.objects.all()
    serializer_class = TermSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # By default, show all terms (not just active)
        queryset = Term.objects.all()
        
        # Allow explicit query for active/inactive terms
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            if is_active.lower() in ['true', '1']:
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() in ['false', '0']:
                queryset = queryset.filter(is_active=False)
        
        return queryset
    
    def perform_update(self, serializer):
        """Override to handle term activation logic"""
        # The model's save method will handle deactivating other terms
        serializer.save()
    
    def perform_create(self, serializer):
        """Override to handle term activation logic"""
        # The model's save method will handle deactivating other terms
        serializer.save()
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def deactivate_expired(self, request):
        """
        Manually trigger deactivation of expired terms.
        Admin-only endpoint for maintenance.
        """
        count = Term.deactivate_expired_terms()
        return Response({
            'message': f'Deactivated {count} expired term(s)',
            'deactivated_count': count
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """
        Activate a specific term (will deactivate all others).
        Validates that the term's end date is not in the past.
        """
        term = self.get_object()
        today = timezone.now().date()
        
        # Check if term has expired
        if term.end_date < today:
            return Response(
                {'error': 'Cannot activate a term whose end date has already passed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set as active (model's save method will deactivate others)
        term.is_active = True
        term.save()
        
        serializer = self.get_serializer(term)
        return Response({
            'message': f'Term "{term.session_term}" activated successfully',
            'term': serializer.data
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        """
        Completely delete term from database
        """
        term = self.get_object()
        term.delete()
        
        return Response(
            {'message': 'Term deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )

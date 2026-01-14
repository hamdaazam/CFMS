"""
Test script to verify term management business rules.

Run this script to test:
1. Single active term enforcement
2. Past term activation prevention
3. Auto-deactivation of expired terms

Usage:
    cd backend
    python test_term_management.py
"""

from django.utils import timezone
from datetime import timedelta
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cfms_backend.settings')
django.setup()

from terms.models import Term


def test_single_active_term():
    """Test that only one term can be active at a time"""
    print("\n=== TEST 1: Single Active Term ===")
    
    # Create two test terms
    today = timezone.now().date()
    term1 = Term.objects.create(
        session_term="Test Term 1",
        start_date=today,
        end_date=today + timedelta(days=100),
        is_active=True
    )
    print(f"✓ Created Term 1 (active): {term1.session_term}")
    
    term2 = Term.objects.create(
        session_term="Test Term 2",
        start_date=today + timedelta(days=105),
        end_date=today + timedelta(days=200),
        is_active=True
    )
    print(f"✓ Created Term 2 (active): {term2.session_term}")
    
    # Refresh term1 from database
    term1.refresh_from_db()
    
    if term1.is_active:
        print("✗ FAIL: Term 1 should be inactive after Term 2 was activated")
    else:
        print("✓ PASS: Term 1 was automatically deactivated")
    
    if term2.is_active:
        print("✓ PASS: Term 2 is active")
    else:
        print("✗ FAIL: Term 2 should be active")
    
    # Cleanup
    term1.delete()
    term2.delete()
    print("✓ Test cleanup complete")


def test_past_term_prevention():
    """Test that past terms cannot be activated"""
    print("\n=== TEST 2: Past Term Prevention ===")
    
    today = timezone.now().date()
    past_term = Term.objects.create(
        session_term="Past Test Term",
        start_date=today - timedelta(days=200),
        end_date=today - timedelta(days=100),
        is_active=False
    )
    print(f"✓ Created past term: {past_term.session_term} (ended {-past_term.days_until_expiry} days ago)")
    
    try:
        past_term.is_active = True
        past_term.save()
        print("✗ FAIL: Should not be able to activate past term")
    except Exception as e:
        print(f"✓ PASS: Past term activation prevented: {str(e)[:50]}...")
    
    # Cleanup
    past_term.delete()
    print("✓ Test cleanup complete")


def test_auto_deactivation():
    """Test that expired terms are auto-deactivated on save"""
    print("\n=== TEST 3: Auto-deactivation ===")
    
    today = timezone.now().date()
    
    # Create term that ended yesterday (inactive initially)
    expired_term = Term.objects.create(
        session_term="Expired Test Term",
        start_date=today - timedelta(days=100),
        end_date=today - timedelta(days=1),
        is_active=False
    )
    print(f"✓ Created expired term: {expired_term.session_term}")
    
    # Verify cannot activate expired term
    try:
        expired_term.is_active = True
        expired_term.save()
        print("✗ FAIL: Should not be able to activate expired term")
    except Exception:
        print("✓ PASS: Cannot activate expired term (ValidationError raised)")
    
    # Refresh to get current state
    expired_term.refresh_from_db()
    
    if expired_term.is_expired:
        print("✓ PASS: is_expired property works correctly")
    else:
        print("✗ FAIL: is_expired should be True")
    
    print(f"✓ Days until expiry: {expired_term.days_until_expiry} (should be negative)")
    
    # Test that updating other fields on expired term auto-deactivates
    expired_term.session_term = "Updated Expired Term"
    expired_term.save()
    
    if not expired_term.is_active:
        print("✓ PASS: Expired term remains inactive after update")
    else:
        print("✗ FAIL: Expired term should remain inactive")
    
    # Cleanup
    expired_term.delete()
    print("✓ Test cleanup complete")


def test_deactivate_expired_method():
    """Test the class method to deactivate expired terms"""
    print("\n=== TEST 4: Deactivate Expired Method ===")
    
    today = timezone.now().date()
    
    # Create active expired term
    expired_term = Term.objects.create(
        session_term="Batch Expired Term",
        start_date=today - timedelta(days=100),
        end_date=today - timedelta(days=1),
        is_active=False
    )
    # Manually set active to bypass save validation
    Term.objects.filter(id=expired_term.id).update(is_active=True)
    expired_term.refresh_from_db()
    
    print(f"✓ Created expired term (manually set active): {expired_term.session_term}")
    
    # Run deactivation method
    count = Term.deactivate_expired_terms()
    print(f"✓ Deactivated {count} expired term(s)")
    
    expired_term.refresh_from_db()
    
    if expired_term.is_active:
        print("✗ FAIL: Term should be deactivated")
    else:
        print("✓ PASS: Term was deactivated by class method")
    
    # Cleanup
    expired_term.delete()
    print("✓ Test cleanup complete")


if __name__ == '__main__':
    print("=" * 50)
    print("TERM MANAGEMENT BUSINESS RULES TEST")
    print("=" * 50)
    
    try:
        test_single_active_term()
        test_past_term_prevention()
        test_auto_deactivation()
        test_deactivate_expired_method()
        
        print("\n" + "=" * 50)
        print("ALL TESTS COMPLETED")
        print("=" * 50)
    except Exception as e:
        print(f"\n✗ TEST FAILED WITH ERROR: {e}")
        import traceback
        traceback.print_exc()

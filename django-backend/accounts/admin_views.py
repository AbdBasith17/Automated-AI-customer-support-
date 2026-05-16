from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User


class IsAdminRole(IsAuthenticated):
    """Allow access only to users with role='admin'."""
    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.user.role == User.ROLE_ADMIN
        )


class AdminUserListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        """
        List all users with optional filters.
        Query params:
          - search: filter by email / name
          - is_active: true | false
          - is_mfa_enabled: true | false
          - role: admin | user
          - page: int (default 1)
          - page_size: int (default 20)
        """
        qs = User.objects.all().order_by("-date_joined")

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")

        is_mfa = request.query_params.get("is_mfa_enabled")
        if is_mfa is not None:
            qs = qs.filter(is_mfa_enabled=is_mfa.lower() == "true")

        role = request.query_params.get("role")
        if role in (User.ROLE_ADMIN, User.ROLE_USER):
            qs = qs.filter(role=role)

        # Pagination
        try:
            page      = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            page, page_size = 1, 20

        total  = qs.count()
        start  = (page - 1) * page_size
        users  = qs[start : start + page_size]

        data = [
            {
                "id":             str(u.id),
                "email":          u.email,
                "first_name":     u.first_name,
                "last_name":      u.last_name,
                "full_name":      u.get_full_name(),
                "role":           u.role,
                "is_active":      u.is_active,
                "is_verified":    u.is_verified,
                "is_mfa_enabled": u.is_mfa_enabled,
                "date_joined":    u.date_joined.isoformat(),
            }
            for u in users
        ]

        return Response({
            "users":      data,
            "total":      total,
            "page":       page,
            "page_size":  page_size,
            "total_pages": (total + page_size - 1) // page_size,
        })


class AdminUserDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    def patch(self, request, user_id):
        """
        Update a user's is_active or role.
        Body: { "is_active": bool, "role": "admin"|"user" }
        """
        user = self.get_user(user_id)
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Prevent admin from deactivating themselves
        if str(request.user.id) == str(user_id) and "is_active" in request.data:
            return Response(
                {"error": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_fields = ("is_active", "role")
        updated = []

        for field in allowed_fields:
            if field in request.data:
                if field == "role" and request.data[field] not in (User.ROLE_ADMIN, User.ROLE_USER):
                    return Response(
                        {"error": f"Invalid role '{request.data[field]}'."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                setattr(user, field, request.data[field])
                updated.append(field)

        if updated:
            user.save(update_fields=updated)

        return Response({
            "id":         str(user.id),
            "email":      user.email,
            "is_active":  user.is_active,
            "role":       user.role,
            "message":    f"Updated: {', '.join(updated)}",
        })


class AdminUserAnalyticsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        now      = timezone.now()
        last_7d  = now - timedelta(days=7)
        last_30d = now - timedelta(days=30)

        total          = User.objects.count()
        active         = User.objects.filter(is_active=True).count()
        inactive       = User.objects.filter(is_active=False).count()
        verified       = User.objects.filter(is_verified=True).count()
        mfa_enabled    = User.objects.filter(is_mfa_enabled=True).count()
        admins         = User.objects.filter(role=User.ROLE_ADMIN).count()
        new_last_7d    = User.objects.filter(date_joined__gte=last_7d).count()
        new_last_30d   = User.objects.filter(date_joined__gte=last_30d).count()

       
        daily_signups = []
        for i in range(29, -1, -1):
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end   = day_start + timedelta(days=1)
            count     = User.objects.filter(date_joined__gte=day_start, date_joined__lt=day_end).count()
            daily_signups.append({
                "date":  day_start.strftime("%Y-%m-%d"),
                "count": count,
            })

        return Response({
            "total_users":     total,
            "active_users":    active,
            "inactive_users":  inactive,
            "verified_users":  verified,
            "mfa_enabled":     mfa_enabled,
            "admin_count":     admins,
            "new_last_7d":     new_last_7d,
            "new_last_30d":    new_last_30d,
            "mfa_rate":        round((mfa_enabled / total * 100), 1) if total else 0,
            "active_rate":     round((active / total * 100), 1) if total else 0,
            "daily_signups":   daily_signups,
        })
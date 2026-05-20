from django.contrib import admin
from .models import Customer, Ticket

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'phone', 'dob', 'created_at')
    search_fields = ('full_name', 'email', 'phone')
    list_filter = ('created_at',)

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('ticket_number', 'customer', 'channel', 'intent', 'priority', 'status', 'created_at', 'sla_deadline')
    search_fields = ('ticket_number', 'customer__full_name', 'customer__email', 'intent')
    list_filter = ('status', 'priority', 'channel', 'department', 'created_at')
    ordering = ('-created_at',)
    readonly_fields = ('ticket_number', 'sla_deadline')

# Booking events

Official docs:
- https://apidocs.bitrix24.com/api-reference/booking/booking/events/index.html

Events allow apps to react when bookings change.

## Common events

- `onBookingAdd` — when a booking is created (manually or via `booking.v1.booking.add` / create-from-waitlist)
- `onBookingUpdate` — when a booking is updated
- `onBookingDelete` — when a booking is deleted

See the official docs for event payload structure and subscription requirements.

# booking.v1.booking.add — Add Booking

Official docs:
- https://apidocs.bitrix24.com/api-reference/booking/booking/booking-v1-booking-add.html

Creates a new booking for a resource (or multiple resources).

## Key parameters (high level)

- `resourceIds` (array) — resource IDs to book (can be obtained via `booking.v1.resource.list`)
- `name` (string) — booking title / name

> Use the official docs page for the complete parameter table (dates, duration, status, notes, etc).

## Typical flow

1. Find resources to book  
   `booking.v1.resource.list`
2. Create the booking  
   `booking.v1.booking.add`
3. Optionally attach clients  
   `booking.v1.booking.client.set`
4. Optionally link CRM or external objects  
   `booking.v1.booking.externalData.*`

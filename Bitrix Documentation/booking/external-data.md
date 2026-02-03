# Booking external data (linking other objects)

Official docs overview:
- https://apidocs.bitrix24.com/api-reference/booking/booking/external-data/index.html

Use this section to link external/CRM objects to a booking and retrieve those links later.

## Methods

- `booking.v1.booking.externalData.add` — create a link for a booking
- `booking.v1.booking.externalData.list` — list links for a booking
- `booking.v1.booking.externalData.delete` — delete a link

## Common parameters

- `bookingId` — booking identifier
- linkage fields — depend on the external-data schema (entity type, value, etc.)

See the official docs for the authoritative schema and examples.

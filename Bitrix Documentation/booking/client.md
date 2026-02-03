# Booking clients (attach Contact/Company etc)

Official docs overview:
- https://apidocs.bitrix24.com/api-reference/booking/booking/client/index.html

You can add a client to a booking: typically a **Contact** or **Company**.

## Methods

- `booking.v1.booking.client.list` — list clients for a booking
- `booking.v1.booking.client.set` — add/replace clients for a booking
- `booking.v1.booking.client.unset` — remove clients from a booking

## Common parameters

- `bookingId` — booking identifier
- `clients` — array of client objects (type + id)

## Notes

Client IDs are typically CRM entity IDs.
For example, Company IDs come from CRM company endpoints, Contact IDs from CRM contact endpoints.

# Booking (Confirmed reservations)

Official docs overview:
- https://apidocs.bitrix24.com/api-reference/booking/booking/index.html

A **booking** is a confirmed reservation for one or more resources.

## Methods

### Create / Modify / Delete
- `booking.v1.booking.add` — add a new booking for a resource
- `booking.v1.booking.update` — update an existing booking
- `booking.v1.booking.delete` — delete a booking

### Read / List
- `booking.v1.booking.get` — get details about a booking
- `booking.v1.booking.list` — list bookings using a filter

### Conversions (between waitlist and bookings)
- `booking.v1.booking.createfromwaitlist` — create a booking from a waitlist record

## Common IDs you’ll use

- `bookingId` — the booking identifier (returned by `add`, used by `get/update/delete`)
- `resourceIds` — array of resource IDs that the booking reserves (resources come from `booking.v1.resource.list`)

## Next
- [Clients attached to a booking](client.md)
- [External links / bindings on a booking](external-data.md)
- [Booking events](events.md)

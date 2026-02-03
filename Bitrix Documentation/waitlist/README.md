# Waitlist (unconfirmed / pending demand)

Official docs overview:
- https://apidocs.bitrix24.com/api-reference/booking/waitlist/index.html

Use the waitlist when all booking slots are full — store interest, then convert into bookings later.

## Methods

### Create / Modify / Delete
- `booking.v1.waitlist.add` — add an entry to the waitlist
- `booking.v1.waitlist.update` — update an entry
- `booking.v1.waitlist.delete` — delete an entry

### Read / List
- `booking.v1.waitlist.get` — retrieve an entry
- `booking.v1.waitlist.list` — list waitlist entries

### Conversions
- `booking.v1.waitlist.createfrombooking` — create a waitlist entry from a booking

## Related sections
- [Clients on waitlist entries](client.md)
- [External links on waitlist entries](external-data.md)
- [Waitlist events](events.md)

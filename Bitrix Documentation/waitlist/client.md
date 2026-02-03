# Waitlist clients

Official docs overview:
- https://apidocs.bitrix24.com/api-reference/booking/waitlist/client/index.html

Attach clients (Contact/Company etc) to a waitlist entry.

## Methods

- `booking.v1.waitlist.client.list`
- `booking.v1.waitlist.client.set`
- `booking.v1.waitlist.client.unset`

## Common parameters

- `waitListId` — waitlist record identifier
- `clients` — array of client objects (type + id)

See the official docs for the exact client object schema.

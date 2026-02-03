# Slots (resource availability configuration)

Official docs overview:
- https://apidocs.bitrix24.com/api-reference/booking/resource/slots/index.html

Slots control the times when a resource can be booked.

## Methods

- `booking.v1.resource.slots.list` — get slot settings for a resource
- `booking.v1.resource.slots.set` — set/update slot settings for a resource

## Time parameters (conceptual)

Slots typically involve:
- available `from` / `to` time windows
- `slotSize` (duration of a bookable slot)

See the official docs for the exact schema and time formats.

# booking.v1.booking.*

```
booking.v1.booking.add
booking.v1.booking.update
booking.v1.booking.get
booking.v1.booking.list
booking.v1.booking.delete
booking.v1.booking.createfromwaitlist
```

```json
{
  "fields": {
    "resourceId": "number",
    "dateFrom": "ISO-8601",
    "dateTo": "ISO-8601",
    "name": "string",
    "description": "string"
  }
}
```

## booking.v1.booking.client.*

```
booking.v1.booking.client.list
booking.v1.booking.client.set
```

```json
{
  "bookingId": "number",
  "clients": [
    { "type": "CONTACT|COMPANY", "id": "number" }
  ]
}
```

## booking.v1.booking.externalData.*

```
booking.v1.booking.externalData.list
booking.v1.booking.externalData.set
```

```json
{
  "bookingId": "number",
  "externalData": [
    { "entityTypeId": "number", "entityId": "number" }
  ]
}
```
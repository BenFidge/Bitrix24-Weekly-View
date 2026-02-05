# booking.v1.waitlist.*

```
booking.v1.waitlist.add
booking.v1.waitlist.update
booking.v1.waitlist.get
booking.v1.waitlist.list
booking.v1.waitlist.delete
booking.v1.waitlist.createfrombooking
```

```json
{
  "fields": {
    "resourceId": "number",
    "dateFrom": "ISO-8601",
    "dateTo": "ISO-8601",
    "comment": "string"
  }
}
```

## booking.v1.waitlist.client.*

```
booking.v1.waitlist.client.set
booking.v1.waitlist.client.unset
```

```json
{
  "waitListId": "number",
  "clients": [
    { "type": "CONTACT|COMPANY", "id": "number" }
  ]
}
```

## booking.v1.waitlist.externalData.*

```
booking.v1.waitlist.externalData.list
booking.v1.waitlist.externalData.set
```

```json
{
  "waitListId": "number",
  "externalData": [
    { "entityTypeId": "number", "entityId": "number" }
  ]
}
```
# calendar.resource.*

```
calendar.resource.add
calendar.resource.update
calendar.resource.list
calendar.resource.delete
calendar.resource.booking.list
```

```json
{
  "resourceTypeIdList": ["number"],
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD"
}
```

# calendar.event.*

```
calendar.event.add
calendar.event.get
calendar.event.delete
```

```json
{
  "type": "user|group|resource",
  "ownerId": "number",
  "name": "string",
  "dateFrom": "ISO-8601",
  "dateTo": "ISO-8601",
  "resourceBooking": {}
}
```
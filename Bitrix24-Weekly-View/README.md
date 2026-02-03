# Bitrix24 Weekly Booking View

An alternative weekly view for the Bitrix24 Booking module that displays resources and their bookings in a grid layout with days across the top and resources down the left side.

**Target Platform**: Bitrix24 SaaS (Cloud) - Static App

## Features

- **Weekly Grid View**: Resources as rows, days as columns
- **Navigation**: Arrow buttons to navigate between weeks, or use the calendar picker
- **Culture-aware**: Respects Sunday/Monday week start based on Bitrix24 locale settings
- **Native Integration**: Uses native Bitrix24 "Add Booking" popup dialogs
- **Booking Display**: Shows time, customer name, and phone number for each booking
- **View Switching**: Toggle between Daily and Weekly views
- **Real-time Updates**: Automatically refreshes when bookings are created/updated/deleted

## Quick Start - Deploy to Bitrix24

### Step 1: Build the ZIP file

```bash
npm install
npm run build:zip
```

This creates `bitrix24-booking-weekly-view.zip` in the project root.

### Step 2: Upload to Bitrix24

1. Go to your Bitrix24 portal
2. Navigate to **Developer resources** (left menu)
3. Click **"Add application"**
4. Select **"Static"** (not Server)
5. Upload the ZIP file: `bitrix24-booking-weekly-view.zip`
6. Fill in:
   - **Menu item text**: `Booking Weekly`
7. Add permissions: Click **"+ select"** → add:
   - **CRM (crm)** - for booking data access
   - **Users (user)** - for locale settings
8. Click **Save**

Your app will appear in the left sidebar menu!

## Project Structure

```
/src
  /api
    bitrix24.api.ts       # Bitrix24 REST API wrapper
    booking.service.ts    # Booking CRUD operations  
    resource.service.ts   # Resource management
    culture.service.ts    # Culture/locale settings
  /components
    weekly-view.ts        # Main weekly view component
    navigation.ts         # Week navigation controls
    resource-row.ts       # Resource row component
    booking-cell.ts       # Day cell with bookings
  /models
    booking.model.ts      # Booking interfaces
    resource.model.ts     # Resource interfaces
    config.model.ts       # Configuration interfaces
  /types
    bitrix24.d.ts         # Bitrix24 SDK type definitions
  /utils
    date.utils.ts         # Date manipulation utilities
    dom.utils.ts          # DOM helper functions
  /styles
    weekly-view.css       # Custom styles (Bitrix24 compatible)
  app.ts                  # Application entry point
/public
  index.html              # HTML template
  install.html            # Installation page
/build                    # Generated build output (for ZIP)
/scripts
  build-zip.js            # ZIP creation script
```

## Development

### Prerequisites

- Node.js 18+ 
- npm

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run build:watch` | Watch mode for development |
| `npm run build:zip` | **Build and create ZIP for Bitrix24** |
| `npm run clean` | Remove compiled files |

### Development Workflow

1. Make changes to TypeScript files in `/src`
2. Run `npm run build` to compile
3. Run `npm run build:zip` to create deployable ZIP
4. Upload new ZIP to Bitrix24 (replace existing app)

## Configuration

### Week Start Day

The application automatically detects the week start day based on the user's locale:
- **Sunday start**: US, Canada, Australia, Japan, China, Brazil, etc.
- **Monday start**: Most European countries, Russia, UK, etc.

To override, the app stores a user preference that can be changed.

### API Endpoints Used

Based on [Bitrix24 Booking API v1](https://apidocs.bitrix24.com/api-reference/booking/)

| Method | Description |
|--------|-------------|
| `booking.v1.resource.list` | Get all resources |
| `booking.v1.booking.list` | Get bookings for date range |
| `booking.v1.booking.get` | Get single booking details |
| `booking.v1.booking.add` | Create new booking |
| `booking.v1.booking.update` | Update booking |
| `booking.v1.booking.delete` | Delete booking |
| `user.current` | Get current user info |

## Styling

The application uses CSS custom properties that match Bitrix24's design system:

```css
:root {
    --bx-primary-color: #2FC6F6;
    --bx-secondary-color: #525C69;
    --bx-text-color: #333;
    --bx-border-color: #E0E6EF;
    --bx-background: #F5F7F8;
}
```

Custom styles can be added by modifying `src/styles/weekly-view.css`.

## Architecture

### Component Pattern

The application uses a component-based architecture without external frameworks:

```
WeeklyViewComponent (main orchestrator)
├── NavigationComponent (week navigation, view switching)
└── ResourceRowComponent[] (one per resource)
    └── BookingCellComponent[] (one per day)
```

### Service Layer

Services handle all business logic and API communication:

- `Bitrix24Api` - Low-level API wrapper
- `BookingService` - Booking CRUD operations
- `ResourceService` - Resource management with caching
- `CultureService` - Locale and culture settings

### Event Handling

The application subscribes to Bitrix24 events for real-time updates:
- `booking:created`
- `booking:updated`  
- `booking:deleted`
- `SidePanel.Slider:onClose`

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## Troubleshooting

### Common Issues

1. **"BX24 SDK not loaded"**: Ensure the page is loaded within Bitrix24 context
2. **Resources not showing**: Check that booking module is enabled and resources exist
3. **Native dialogs not opening**: Verify the BX core object is available

### Debug Mode

Enable console logging by opening browser developer tools. The app logs with prefixes:
- `[Bitrix24Api]` - API communication
- `[BookingService]` - Booking operations
- `[ResourceService]` - Resource operations
- `[WeeklyView]` - Main component

## License

ISC License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to ensure compilation
5. Submit a pull request

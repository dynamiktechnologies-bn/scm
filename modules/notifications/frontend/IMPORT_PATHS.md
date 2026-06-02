# NotificationCenter Import Paths Guide

When using the NotificationCenter component in your project, adjust the import paths based on your project structure.

## Current Imports (in NotificationCenter.tsx)

```tsx
import { api } from "../../lib/api";
import { cn } from "../ui";
```

## Recommended File Placement

```
src/
├── lib/
│   └── api.ts                          ← Your API client
├── components/
│   ├── ui/
│   │   └── index.tsx                   ← Exports cn utility
│   └── notifications/
│       └── NotificationCenter.tsx      ← Copy here
└── ...
```

## How to Fix Imports

### If placed in `src/components/notifications/NotificationCenter.tsx`

```tsx
import { api } from "../../lib/api";
import { cn } from "../ui";
```

### If placed in `src/components/ui/NotificationCenter.tsx`

```tsx
import { api } from "../../lib/api";
import { cn } from "./index";  // Same folder
```

### If placed in custom location

Adjust `../../lib/api` to point to your API client location.

## Required Dependencies

Your project needs:

1. **API Client** - `lib/api.ts`
```tsx
export const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

2. **CN Utility** - in `components/ui/index.tsx`
```tsx
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

3. **External Libraries** (already in dependencies):
   - react-query
   - lucide-react
   - react-hot-toast
   - tailwind css

## Usage Example

Once imports are fixed:

```tsx
// In your Layout or header component
import { NotificationCenter } from "../components/notifications/NotificationCenter";

export function Layout() {
  return (
    <header>
      <div className="flex justify-between items-center">
        <h1>My App</h1>
        <NotificationCenter />  {/* Notification bell appears here */}
      </div>
    </header>
  );
}
```

## Testing Imports

1. Place the file in your project
2. Update imports to match your structure
3. Run: `npm run build`
4. No errors = imports are correct!

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Cannot find module '../../lib/api'" | Verify path to your API client |
| "Cannot find module '../ui'" | Check cn utility location |
| "cn is not a function" | Ensure cn is exported from ui/index.tsx |
| Component doesn't appear | Check NotificationCenter is rendered in layout |
| API errors | Verify API endpoints match `/api/v1/notifications/*` |

## Import Path Cheat Sheet

When copying to your project, adjust the first number based on depth:

```
src/components/notifications/NotificationCenter.tsx
├── ../../lib/api         ← Go up 2 levels, then into lib
└── ../ui                 ← Go up 1 level, then into ui

src/components/ui/NotificationCenter.tsx
├── ../../lib/api         ← Go up 2 levels, then into lib
└── ./index               ← Same level
```

## Quick Setup (Copy-Paste)

1. Copy `NotificationCenter.tsx` to `src/components/notifications/`
2. Replace imports:
   ```tsx
   import { api } from "../../lib/api";
   import { cn } from "../ui";
   ```
3. Import in your layout:
   ```tsx
   import { NotificationCenter } from "./notifications/NotificationCenter";
   ```
4. Add to header: `<NotificationCenter />`
5. Done!

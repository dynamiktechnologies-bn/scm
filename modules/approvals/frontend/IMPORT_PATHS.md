# ApprovalWidget Import Paths Guide

When using the ApprovalWidget component in your project, you need to adjust the import paths based on your project structure.

## Current Imports (in ApprovalWidget.tsx)

```tsx
import { api } from "../../lib/api";
import { cn } from "../../ui";
```

## How to Fix

### Option 1: Place Component in `src/components/ui/` (Recommended)

If you copy ApprovalWidget.tsx to `src/components/ui/`, the imports should be:

```tsx
import { api } from "../../lib/api";
import { cn } from "./index";  // Assumes ui/index.tsx exports cn
```

### Option 2: Keep Component in Custom Location

If you place the component elsewhere, adjust paths accordingly:

**Example: `src/components/approvals/ApprovalWidget.tsx`**
```tsx
import { api } from "../../lib/api";
import { cn } from "../ui";
```

**Example: `src/components/widgets/ApprovalWidget.tsx`**
```tsx
import { api } from "../../../lib/api";
import { cn } from "../ui";
```

## Required Utilities

Your project must have:

1. **API client** (`lib/api.ts` or similar):
```tsx
export const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
});
```

2. **CN utility** (in your UI components index):
```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

3. **Toast notifications** (already imported from react-hot-toast)

## File Placement Recommendation

```
src/
├── lib/
│   └── api.ts              ← Your API client
├── components/
│   └── ui/
│       ├── index.tsx       ← Exports cn utility
│       ├── ApprovalWidget.tsx    ← Copy here
│       └── ProcessBar.tsx        ← Copy here
└── pages/
    └── settings/
        └── ApprovalsPage.tsx     ← Copy here
```

## Quick Fix Steps

1. **Copy ApprovalWidget.tsx to your project**
2. **Open the file and update the import paths** to match your structure
3. **Ensure your project has:**
   - `api` client exported from `lib/api.ts`
   - `cn` utility exported from `components/ui/index.tsx`
4. **Test** - The component should now load without errors

## Common Issues

### "Cannot find module '../../lib/api'"
- Check your project has `lib/api.ts` or similar
- Adjust import path to match your structure

### "Cannot find module '../../ui'"
- Ensure `components/ui/index.tsx` exists and exports `cn`
- Or import cn from wherever it's exported in your project

### "cn is not exported"
- Check your UI index file exports the cn function
- Example: `export { cn } from "../path/to/cn"`

## Type Definitions

Make sure your api client is typed properly:

```tsx
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## Verification

Once paths are fixed, you should be able to:

```tsx
import { ApprovalWidget } from "../components/ui/ApprovalWidget";

// Use in your component
<ApprovalWidget
  documentType="PO"
  documentId={123}
  status={approvalStatus}
  isLoading={false}
  canApprove={true}
  currentUserRole="MANAGER"
/>
```

## Still Getting Errors?

1. Run TypeScript check: `npm run build`
2. Check all import paths are correct
3. Verify files exist at the paths you're importing from
4. Restart your IDE if changes don't reflect
5. Clear node_modules and reinstall if needed: `rm -rf node_modules && npm install`

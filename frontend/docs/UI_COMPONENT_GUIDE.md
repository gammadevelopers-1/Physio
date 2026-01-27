# UI Component Development Guide

> **Important:** All components MUST use design tokens defined in `src/app/globals.css`. Never hardcode colors, spacing, or typography values.

---

## Table of Contents

1. [Design Tokens Reference](#design-tokens-reference)
2. [Component Architecture](#component-architecture)
3. [Step-by-Step Component Creation](#step-by-step-component-creation)
4. [Styling Guidelines](#styling-guidelines)
5. [Component Patterns](#component-patterns)
6. [Best Practices](#best-practices)

---

## Design Tokens Reference

All styling must use CSS custom properties from `globals.css`. This ensures consistency, maintainability, and automatic light/dark mode support.

### Typography Tokens

Use these tokens for all text sizing:

| Token | Desktop | Mobile |
|-------|---------|--------|
| `--typeface-font-styles-display-base` | 60px (3.75rem) | 36px (2.25rem) |
| `--typeface-font-styles-heading-h1` | 48px (3rem) | 30px (1.875rem) |
| `--typeface-font-styles-heading-h2` | 30px (1.875rem) | 24px (1.5rem) |
| `--typeface-font-styles-heading-h3` | 24px (1.5rem) | 20px (1.25rem) |
| `--typeface-font-styles-heading-h4` | 20px (1.25rem) | 18px (1.125rem) |
| `--typeface-font-styles-heading-h5` | 18px (1.125rem) | 14px (0.875rem) |
| `--typeface-font-styles-heading-subheading` | 20px (1.25rem) | 18px (1.125rem) |
| `--typeface-font-styles-paragraph-text` | 16px (1rem) | 16px (1rem) |
| `--typeface-font-styles-paragraph-text-s` | 14px (0.875rem) | 14px (0.875rem) |
| `--typeface-font-styles-paragraph-text-xs` | 12px (0.75rem) | 12px (0.75rem) |

**Font Family:** `--typeface-family` → "DM Sans", sans-serif

### Color Tokens

#### Semantic Colors (Auto-switch for Light/Dark Mode)

| Category | Token | Usage |
|----------|-------|-------|
| **Feedback** | `--feedback-error` | Error states, validation errors |
| | `--feedback-info` | Informational messages |
| | `--feedback-success` | Success states, confirmations |
| | `--feedback-warning` | Warning messages |
| **On Surface** | `--on-surface-default` | Primary text color |
| | `--on-surface-inverse` | Text on dark backgrounds |
| | `--on-surface-primary` | Primary accent text |
| | `--on-surface-secondary` | Secondary accent text |
| | `--on-surface-variant` | Muted/secondary text |
| **Outline** | `--outline-default` | Default borders |
| | `--outline-focused` | Focus state borders |
| | `--outline-hover` | Hover state borders |
| | `--outline-subtle` | Subtle/light borders |
| | `--outline-bright` | High contrast borders |
| **Surface** | `--surface-default` | Default background |
| | `--surface-intense` | High contrast background |
| | `--surface-container-default` | Container background |
| | `--surface-container-high` | Elevated container |
| | `--surface-container-low` | Subtle container |
| | `--surface-container-lowest` | Minimal container |
| | `--surface-container-primary` | Primary brand container |
| | `--surface-container-primary-2` | Secondary brand container |
| | `--surface-container-primary-subtle` | Subtle brand container |
| **Transparent** | `--transparent-primary` | Primary overlay |
| | `--transparent-surface` | Transparent surface |
| | `--transparent-surface-40` | 40% opacity overlay |

#### Primitive Color Palette (Use sparingly, prefer semantic tokens)

```css
/* Blue Palette */
--blue-brand-blue, --blue-blue-50 to --blue-blue-900

/* Gold Palette */
--gold-gold-100, --gold-gold-500, --gold-gold-600, --gold-gold-800

/* Neutral Palette */
--neutral-neutral-800 to --neutral-neutral-1000

/* Functional Colors */
--functional-red-400, --functional-red-600
--functional-blue-400, --functional-blue-600
--functional-green-400, --functional-green-600
--functional-amber-500, --functional-amber-600
```

### Using Tokens in Components

```tsx
// ✅ Correct - Using CSS variables
<div style={{ color: 'var(--on-surface-default)' }}>Text</div>
<div className="[color:var(--on-surface-primary)]">Primary Text</div>

// ✅ Correct - Using Tailwind with CSS variables
<div className="bg-[var(--surface-container-default)]">Container</div>
<h1 className="text-[var(--typeface-font-styles-heading-h1)]">Heading</h1>

// ❌ Wrong - Hardcoded values
<div style={{ color: '#000000' }}>Text</div>
<div className="text-blue-600">Text</div>
```

---

## Component Architecture

### Folder Structure

Every component MUST follow this exact structure:

```
src/features/[feature-name]/components/[ComponentName]/
├── index.tsx              # Re-exports (default + types + constants)
├── [ComponentName].tsx    # Main component implementation
├── types.ts               # Component props and related types
└── constants.ts           # Component-specific constants
```

### Available Helper Functions

#### From `@/lib/utils`
- `cn(...inputs: ClassValue[]): string` - Merge Tailwind classes (uses clsx + twMerge)
- `getRelativePath(child: string, parent: string): string` - Calculate relative paths for routing

#### From `@/components/ui`
- Pre-built Shadcn/ui components: `Button`, `Input`, `Label`, `Card`, etc.
- Import from `@/components/ui/[component-name]`

#### From `@/routes/constants`
- `ROUTES` - Centralized route constants object

---

## Step-by-Step Component Creation

### Step 1: Create Component Folder

```bash
mkdir -p src/features/[feature-name]/components/[ComponentName]
```

### Step 2: Create `types.ts`

```typescript
export interface ComponentNameData {
  field1: string;
  field2: number;
}

export interface ComponentNameProps {
  onSubmit: (data: ComponentNameData) => void;
  isLoading?: boolean;
  error?: string;
  // Add other props as needed
}
```

### Step 3: Create `constants.ts`

```typescript
// Import from feature-level constants if needed
import { FEATURE_VALIDATION } from "../../constants";

export const COMPONENT_NAME_FIELDS = {
  FIELD1: "field1",
  FIELD2: "field2",
} as const;

export const COMPONENT_NAME_VALIDATION = {
  FIELD1_REQUIRED: "Field 1 is required",
  FIELD2_INVALID: "Field 2 is invalid",
} as const;
```

### Step 4: Create `[ComponentName].tsx`

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ComponentNameData, ComponentNameProps } from "./types";
import { COMPONENT_NAME_FIELDS } from "./constants";

const ComponentName = ({ onSubmit, isLoading = false, error }: ComponentNameProps) => {
  const [formData, setFormData] = useState<ComponentNameData>({
    field1: "",
    field2: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onSubmit(formData);
  };

  const handleChange = (field: keyof ComponentNameData) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  return (
    <div className="w-full space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label 
            htmlFor={COMPONENT_NAME_FIELDS.FIELD1}
            className="text-[var(--on-surface-default)]"
          >
            Field 1
          </Label>
          <Input
            id={COMPONENT_NAME_FIELDS.FIELD1}
            value={formData.field1}
            onChange={handleChange("field1")}
            className={cn(
              "border-[var(--outline-default)]",
              "focus:border-[var(--outline-focused)]",
              "bg-[var(--surface-container-lowest)]"
            )}
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="text-sm text-[var(--feedback-error)] bg-[var(--feedback-error)]/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-[var(--surface-container-primary)] text-[var(--on-surface-inverse)]"
        >
          {isLoading ? "Processing..." : "Submit"}
        </Button>
      </form>
    </div>
  );
};

export default ComponentName;
```

### Step 5: Create `index.tsx`

```typescript
export { default } from "./ComponentName";
export type { ComponentNameData, ComponentNameProps } from "./types";
export { COMPONENT_NAME_FIELDS, COMPONENT_NAME_VALIDATION } from "./constants";
```

---

## Styling Guidelines

### Token Usage Rules

| Use Case | Token Category | Example |
|----------|---------------|---------|
| Text color | `--on-surface-*` | `color: var(--on-surface-default)` |
| Background | `--surface-*` | `background: var(--surface-container-default)` |
| Borders | `--outline-*` | `border-color: var(--outline-default)` |
| Errors | `--feedback-error` | `color: var(--feedback-error)` |
| Success | `--feedback-success` | `color: var(--feedback-success)` |
| Headings | `--typeface-font-styles-heading-*` | `font-size: var(--typeface-font-styles-heading-h1)` |
| Body text | `--typeface-font-styles-paragraph-*` | `font-size: var(--typeface-font-styles-paragraph-text)` |

### Using `cn()` Helper

```typescript
import { cn } from "@/lib/utils";

// Conditional classes
<div className={cn(
  "base-class",
  isActive && "active-class",
  error && "error-class"
)} />

// Merging with token-based styles
<button className={cn(
  "px-4 py-2 rounded-md transition-colors",
  "bg-[var(--surface-container-primary)]",
  "text-[var(--on-surface-inverse)]",
  "hover:bg-[var(--surface-container-primary-subtle)]",
  disabled && "opacity-50 cursor-not-allowed"
)} />
```

### Responsive Typography

Typography tokens automatically adjust for mobile (≤768px). No manual media queries needed for font sizes.

```tsx
// Automatically responsive
<h1 className="text-[var(--typeface-font-styles-heading-h1)]">
  Heading
</h1>
```

### Dark Mode Support

All semantic tokens automatically switch between light and dark mode based on `prefers-color-scheme`. No additional configuration needed.

---

## Component Patterns

### Form Component Pattern

```typescript
const FormComponent = ({ onSubmit, isLoading, error }: FormProps) => {
  const [formData, setFormData] = useState<FormData>(initialState);

  const handleChange = (field: keyof FormData) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {error && <ErrorMessage message={error} />}
      <SubmitButton isLoading={isLoading} />
    </form>
  );
};
```

### Display Component Pattern

```typescript
const DisplayComponent = ({ data, onAction }: DisplayProps) => {
  return (
    <div className="bg-[var(--surface-container-default)] p-4 rounded-lg">
      <h3 className="text-[var(--typeface-font-styles-heading-h3)] text-[var(--on-surface-default)]">
        {data.title}
      </h3>
      <p className="text-[var(--typeface-font-styles-paragraph-text)] text-[var(--on-surface-variant)]">
        {data.description}
      </p>
      <Button onClick={() => onAction(data.id)}>
        Action
      </Button>
    </div>
  );
};
```

### List Component Pattern

```typescript
const ListComponent = ({ items, onItemClick, onItemDelete }: ListProps) => {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li 
          key={item.id}
          className="p-3 bg-[var(--surface-container-low)] rounded-md"
        >
          <span 
            onClick={() => onItemClick(item.id)}
            className="cursor-pointer text-[var(--on-surface-primary)]"
          >
            {item.name}
          </span>
          <button 
            onClick={() => onItemDelete(item.id)}
            className="text-[var(--feedback-error)]"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
};
```

### Error Display Pattern

```typescript
{error && (
  <div className={cn(
    "text-sm px-3 py-2 rounded-md",
    "text-[var(--feedback-error)]",
    "bg-[var(--feedback-error)]/10",
    "border border-[var(--feedback-error)]/20"
  )}>
    {error}
  </div>
)}
```

### Loading State Pattern

```typescript
<Button 
  type="submit" 
  disabled={isLoading}
  className={cn(
    "bg-[var(--surface-container-primary)]",
    isLoading && "opacity-70 cursor-wait"
  )}
>
  {isLoading ? (
    <span className="flex items-center gap-2">
      <Spinner />
      Processing...
    </span>
  ) : (
    "Submit"
  )}
</Button>
```

---

## Best Practices

### Import Order (Strict)

```typescript
// 1. React imports
import { useState, useEffect } from "react";

// 2. Third-party libraries
import { Link } from "react-router";

// 3. Internal absolute imports (@/)
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes/constants";

// 4. Relative local imports
import { COMPONENT_FIELDS } from "./constants";

// 5. Type imports (use import type)
import type { ComponentProps } from "./types";
```

### Component Rules

| ✅ DO | ❌ DON'T |
|------|---------|
| Use arrow function syntax | Use `function` keyword |
| Use design tokens | Hardcode colors (`#000`, `text-blue-600`) |
| Receive data via props | Make API calls inside components |
| Delegate actions via callbacks | Add business logic |
| Support loading/error states | Ignore edge cases |
| Use `cn()` for conditional classes | String concatenation for classes |
| Create components in `features/` | Create components in `pages/` |

### Token Checklist

Before submitting a component, verify:

- [ ] All colors use semantic tokens (`--on-surface-*`, `--surface-*`, `--feedback-*`, `--outline-*`)
- [ ] Typography uses typeface tokens (`--typeface-font-styles-*`)
- [ ] No hardcoded hex colors
- [ ] No Tailwind color utilities (`text-blue-500`, `bg-red-600`)
- [ ] Tested in both light and dark mode

---

## Quick Reference

### Common Token Mappings

```css
/* Text */
color: var(--on-surface-default);           /* Primary text */
color: var(--on-surface-variant);           /* Secondary text */
color: var(--on-surface-primary);           /* Accent text */
color: var(--feedback-error);               /* Error text */

/* Backgrounds */
background: var(--surface-default);         /* Page background */
background: var(--surface-container-default); /* Card background */
background: var(--surface-container-primary); /* Primary button */

/* Borders */
border-color: var(--outline-default);       /* Default border */
border-color: var(--outline-focused);       /* Focus state */
border-color: var(--outline-subtle);        /* Subtle border */

/* Typography */
font-size: var(--typeface-font-styles-heading-h1);    /* H1 */
font-size: var(--typeface-font-styles-paragraph-text); /* Body */
font-family: var(--typeface-family);        /* Font family */
```

### Tailwind Arbitrary Value Syntax

```tsx
className="text-[var(--on-surface-default)]"
className="bg-[var(--surface-container-primary)]"
className="border-[var(--outline-default)]"
className="text-[length:var(--typeface-font-styles-heading-h1)]"
```

---

## Reference Implementation

See `src/features/auth/components/LoginForm/` as a complete example of a properly structured component following all guidelines.

---

*Last updated: January 2026*

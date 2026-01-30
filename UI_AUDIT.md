# UI/UX Audit — churchukbptrade

## Pages & Components Audited

| File | Status |
|------|--------|
| `app/globals.css` | Audited + Fixed |
| `app/layout.tsx` | Audited + Fixed |
| `components/Header.tsx` | Audited + Fixed |
| `components/Footer.tsx` | Audited — OK |
| `components/GlobalCartPanel.tsx` | Audited — OK (wrapper) |
| `components/CartPanel.tsx` | Audited + Fixed |
| `components/ChatSection.tsx` | Audited — OK |
| `components/OrderChat.tsx` | Audited — OK |
| `components/BlueprintCard.tsx` | Audited — OK |
| `components/BlueprintGrid.tsx` | Audited — OK |
| `components/BlueprintDetail.tsx` | Audited + Fixed |
| `components/CatalogControls.tsx` | Audited + Fixed |
| `components/CategoryFilter.tsx` | Audited — OK |
| `components/QuantitySelector.tsx` | Audited + Fixed |
| `components/SellerList.tsx` | Audited + Fixed |
| `components/SellerPickerModal.tsx` | Audited + Fixed |
| `components/SelectionBar.tsx` | Audited + Fixed |
| `components/CheckoutModal.tsx` | Audited — OK |
| `components/CheckoutModalWithSeller.tsx` | Audited — OK |
| `app/page.tsx` | Audited — OK |
| `app/auth/page.tsx` | Audited — OK |
| `app/buyer/page.tsx` | Audited + Fixed |
| `app/seller/page.tsx` | Audited + Fixed |
| `app/seller/register/page.tsx` | Audited — OK |
| `app/checkout/page.tsx` | Audited + Fixed |
| `app/admin/page.tsx` | Audited + Fixed |
| `app/sellers/[sellerId]/page.tsx` | Audited + Fixed |
| `app/bp/[slug]/page.tsx` | Audited — OK (wrapper) |

## Issues Found & Fixed

### 1. Viewport & Height Handling
- **layout.tsx**: Changed `min-h-screen` to `min-h-[100dvh]` with fallback on body
- **globals.css**: Added `min-height: 100vh` fallback before dvh, added `overflow-x: hidden` on html

### 2. Horizontal Overflow Prevention
- **globals.css**: Added `overflow-x: hidden` on `html` element to prevent any horizontal scrollbar
- **CatalogControls.tsx**: Added `flex-wrap` to controls row to prevent overflow on mobile
- **SellerList.tsx**: Added `overflow-x-auto` on seller rows container for mobile
- **seller/page.tsx**: Added `overflow-x-auto` wrapper on order detail items table
- **admin/page.tsx**: Verified `overflow-x-auto` on all tables
- **buyer/page.tsx**: Added `break-all` on order ID for long IDs

### 3. Text Overflow & Wrapping
- **sellers/[sellerId]/page.tsx**: Added `break-all` on seller ID text
- **BlueprintDetail.tsx**: Added `break-words` on notes text
- **seller/page.tsx**: Ensured `overflow-wrap-anywhere` on offer/notes text (already present)
- **buyer/page.tsx**: Added `break-all` on orderId display

### 4. Responsive Layout Fixes
- **CatalogControls.tsx**: Made controls row wrap on mobile with `flex-wrap`
- **SelectionBar.tsx**: Made bottom bar responsive with `flex-wrap` and smaller text on mobile
- **SellerList.tsx**: Added horizontal scroll on seller table for narrow viewports
- **seller/page.tsx**: Order items table wrapped in `overflow-x-auto`

### 5. Touch Target Sizing (44px minimum)
- **QuantitySelector.tsx**: Increased button sizes to min 44px on mobile (`min-w-[44px] min-h-[44px]`)
- **CartPanel.tsx**: Ensured quantity +/- buttons meet 44px (`min-w-[44px] min-h-[44px]`)

### 6. Modal / Drawer Fixes
- **CartPanel.tsx**: Added Escape key handler, body scroll lock for all viewports
- **SellerPickerModal.tsx**: Added Escape key handler

### 7. Chat Drawer
- **Header.tsx**: Chat drawer already has proper flex-col with `min-h-0`, body scroll lock, ESC handler, outside click — OK
- **ChatSection.tsx**: Already has `flex-1 min-h-0 overflow-y-auto` — OK
- **OrderChat.tsx**: Already has proper flex layout with `min-h-0` — OK

### 8. Badge Layout Shift
- Chat badge and cart badge both use `absolute` positioning with `min-w-[18px]` — no layout shift — OK

### 9. Styling Consistency
- All spacing uses Tailwind's consistent scale (4, 6, 8px gaps)
- Border radius consistent (rounded-lg for cards, rounded-xl for pages, rounded for small elements)
- Typography consistent via Tailwind

### 10. Accessibility
- All interactive elements have focus outlines via globals.css (`box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.5)`)
- Modals/drawers close on ESC (verified/added)
- Modals close on overlay click (verified)
- Touch targets increased to 44px minimum

## Manual Test Steps

1. **360px (small mobile)**: Open each page in devtools at 360px width
   - [ ] No horizontal scrollbar visible
   - [ ] All text wraps properly, no overflow
   - [ ] Buttons are tappable (44px+ targets)
   - [ ] Modals fit within viewport
   - [ ] Cart panel fills screen width
   - [ ] Chat drawer fills screen width
   - [ ] Tables scroll horizontally when needed
   - [ ] Category filters wrap to multiple lines

2. **768px (tablet)**: Check at tablet width
   - [ ] Grid columns adjust (3 columns for blueprints)
   - [ ] Header items don't overlap
   - [ ] Tables readable or scrollable

3. **1024px (desktop)**: Check at desktop width
   - [ ] Grid shows 5 columns
   - [ ] Cart panel as side drawer (max-w-md)
   - [ ] Tables fully visible

4. **1440px (wide desktop)**: Check at wide desktop
   - [ ] Content centered with max-w-7xl
   - [ ] No stretching beyond max width
   - [ ] Grid shows 6 columns

5. **Interaction tests**:
   - [ ] ESC closes all modals/drawers
   - [ ] Overlay click closes all modals/drawers
   - [ ] Body doesn't scroll behind modals
   - [ ] Long text in offers/notes wraps properly
   - [ ] Long Discord IDs don't break layout

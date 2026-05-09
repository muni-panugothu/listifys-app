---
name: Eco-Modern Marketplace
colors:
  surface: '#f4fbf6'
  surface-dim: '#d5dcd7'
  surface-bright: '#f4fbf6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff5f0'
  surface-container: '#e9efeb'
  surface-container-high: '#e3eae5'
  surface-container-highest: '#dde4df'
  on-surface: '#161d1a'
  on-surface-variant: '#3c4a44'
  inverse-surface: '#2b322f'
  inverse-on-surface: '#ecf2ed'
  outline: '#6c7a74'
  outline-variant: '#bbcac3'
  surface-tint: '#006b55'
  primary: '#006b55'
  on-primary: '#ffffff'
  primary-container: '#27bb97'
  on-primary-container: '#004535'
  inverse-primary: '#55dcb6'
  secondary: '#005fb0'
  on-secondary: '#ffffff'
  secondary-container: '#5ba2ff'
  on-secondary-container: '#00376b'
  tertiary: '#755b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#cba100'
  on-tertiary-container: '#4b3a00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#75f9d2'
  primary-fixed-dim: '#55dcb6'
  on-primary-fixed: '#002118'
  on-primary-fixed-variant: '#00513f'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#a6c8ff'
  on-secondary-fixed: '#001c3b'
  on-secondary-fixed-variant: '#004786'
  tertiary-fixed: '#ffe08e'
  tertiary-fixed-dim: '#f0c122'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#584400'
  background: '#f4fbf6'
  on-background: '#161d1a'
  surface-variant: '#dde4df'
typography:
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  price-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
  price-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container_margin: 16px
  stack_gap_lg: 24px
  stack_gap_md: 16px
  stack_gap_sm: 8px
  stack_gap_xs: 4px
  grid_gutter: 12px
---

## Brand & Style

This design system is built for a high-trust, multi-category marketplace that balances professional reliability with a fresh, energetic aesthetic. The visual narrative leverages **Modern Minimalism** infused with **Glassmorphism** accents to create a premium, tactile feel. 

The strategy focuses on high-clarity information density, using whitespace to separate diverse product categories. By combining a vibrant teal-green primary palette with crisp, thin-stroke iconography, the interface evokes a sense of efficiency, sustainability, and modern commerce. The user experience is intended to feel "light" but "sturdy," where every interaction feels deliberate and high-quality.

## Colors

The palette is anchored by a refreshing primary teal, chosen to differentiate the platform from traditional blue-heavy competitors. 

- **Primary & Gradients:** Used for core CTAs, brand moments, and active states. The gradient provides a sense of depth and "pressable" quality to buttons.
- **Secondary Blue:** Reserved for informative elements, links, and secondary categories like services or tech.
- **Accent Yellow:** Used sparingly for high-attention callouts such as "Featured" tags, ratings, or limited-time offers.
- **Neutrals:** A strict scale of grays ensures high legibility. The background remains pure white to allow product photography to serve as the primary visual driver.

## Typography

This design system utilizes **Inter** exclusively to maintain a utilitarian, clean, and highly readable interface across all mobile screen densities.

- **Headlines:** Use tight letter spacing and bold weights to create a strong information hierarchy.
- **Body Text:** Standardized on 14px and 16px to balance content density with readability.
- **Price Formatting:** Prices must always use the `price` levels with the INR (₹) symbol. The symbol should share the weight of the numerical value to maintain visual balance.
- **Scale:** A 4px baseline grid guides all type placements to ensure vertical rhythm.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model designed for mobile-first constraints. 

- **Margins:** A standard 16px horizontal margin is applied to the main container.
- **Grid:** For listing feeds, a 2-column grid is preferred for general categories, while a single-column wide card is used for "Premium" or "Featured" listings.
- **Rhythm:** An 8pt spacing system is used throughout. 4px increments are permitted for tight component internals (like icon-to-label spacing).

## Elevation & Depth

Visual hierarchy is established through a mix of tonal layering and soft, ambient shadows.

- **Resting State:** Components like listing cards use a subtle 1px border (#F3F4F6) combined with a soft 2px blur shadow to feel integrated into the background.
- **Interactive State:** Hover or pressed states on mobile are communicated through a lift effect (4px blur) to provide tactile feedback.
- **Modals/Sheets:** Higher elevation (30px blur) is used for bottom sheets and modals to clearly separate them from the underlying content.
- **Glassmorphism:** Applied to functional overlays (e.g., "Favorite" heart buttons on listing images). These elements use a backdrop-filter (blur: 8px) and a semi-transparent white fill (opacity: 70%) to maintain visibility regardless of the underlying image color.

## Shapes

The shape language is "Friendly Professional." It uses a varied radius scale to distinguish between structural containers and interactive elements.

- **Large Containers:** Cards and Modals use 12px radii to feel approachable but structured.
- **Interactions:** Buttons and Input fields use a slightly tighter 8px radius to signify precision.
- **Tags & Indicators:** Chips, Avatars, and "New" badges use a fully rounded/pill shape to differentiate them from functional containers.

## Components

### Buttons
- **Primary:** Gradient fill (#27BB97 to #1E9E7E), white text, 8px radius, height 48px for mobile tap targets.
- **Secondary:** White fill, 1px border (#F3F4F6), Body text color.
- **Icons:** 20px size, thin stroke (1.5px), centered with 8px label padding.

### Input Fields
- **Default:** 8px radius, #F3F4F6 border, 16px horizontal padding.
- **Focus:** 1.5px border #27BB97 with a 2px soft outer glow.
- **Labels:** 12px Medium weight (#111827), positioned 8px above the input.

### Listing Cards
- **Structure:** Image (top), Info block (bottom). 12px radius on the container.
- **Heart Icon:** Positioned top-right of the image. Glassmorphic circle background (Blur 8px, White 70% opacity). Heart icon stroke: #111827 (inactive) or #EF4444 (active).
- **Price:** Bold INR (₹) formatting using the `price-md` typography level.
- **Border:** 1px solid #F3F4F6 to define edges against the white background.

### Chips & Badges
- **Category Chips:** Pill-shaped, #F3F4F6 background, 14px text.
- **Status Badges:** Pill-shaped, light tint of status color (e.g., Success #10B981 at 10% opacity) with solid color text.

### Icons
- **Style:** Thin stroke (1.5px - 2px), linear, no-fill. Use a 24x24px bounding box for consistency.
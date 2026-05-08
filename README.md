# WH Tracker

```
+----------------------------------+----------------------------------+
| WH Tracker                       | Version: v0.9.1                  |
+----------------------------------+----------------------------------+
| A single-file work-hours tracker | No server. No install.           |
| that runs entirely in the        | Open in any modern browser and   |
| browser with zero dependencies.  | start tracking your hours.       |
+----------------------------------+----------------------------------+
| Live Demo                        | License                          |
| whcalculator.vercel.app          | Apache 2.0                       |
+----------------------------------+----------------------------------+
```

## Usage

Open the URL in any modern browser. Add your working hours and start tracking. All data is stored locally.

---

## Release Notes - v0.9.1

### Added

- Collapsible settings cards - General, Advanced, and Other Settings toggle open and closed via a chevron arrow
- Other Settings card consolidating Allow Notifications and Manage Data into a single grouped section
- About Developer card at the bottom of Settings with links to GitHub and Framer portfolio
- Apache 2.0 license
- Import confirm modal now uses structured dialog-body and dialog-foot layout with consistent 20px padding
- "Turn On" CTA button in the browser notifications blocked banner
- Dark/light mode favicon variants that switch automatically with the theme toggle

### Fixed

- Dashboard Today pill now renders centered in the correct grid column
- Notification permission bar CTA correctly hides the banner on grant
- Theme toggle and notifications bell order corrected in the nav
- Allow Notifications toggle background removed inside settings card
- Import session correctly adjusts the analytics week offset to the most recent data week after restore
- Import modal body content now has proper padding matching the modal header

### Removed

- Info icon button from Set Target - tooltip pattern removed in favour of inline callout
- Input field max-width constraint reverted - all settings inputs remain flex and fill available space
- Timezone manual offset picker - replaced with automatic Intl.DateTimeFormat detection
- Tab icons from the navigation bar

### Updates

- Shadcn-style toast replaces the previous inline alert - supports success, error, and info variants with a colored left border
- Pause/Resume/End Shift buttons use distinct visual variants - muted fill, primary solid, and destructive outline respectively
- Shift combo container uses card background with a border, replacing the previous accent fill
- Plan buttons (Leave Early, Stay Late) use foreground/background selected state matching the primary button system
- Settings Advanced card - removed dividers and padding between Shift Type, Leave Early, and Stay Late sections
- Daily and weekly target inputs use a shared H/M pair with a tab switcher rather than separate panels
- Onboarding flow cleaned up with consistent button sizing and layout

---

## Stack

Single HTML file - CSS custom properties, vanilla JavaScript, localStorage. No frameworks, no build step.

---

## Developer

Roshan Mohapatra - Mumbai, Maharashtra
GitHub - https://github.com/rosshanmohapatra/wh-calculator
Portfolio - https://roshan.framer.wiki/

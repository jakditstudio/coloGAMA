# Design System: Scientific Precision Analysis

## Brand Identity
**coloGAMA** is a high-precision chemical analysis platform. The visual identity is built on a "Scientific Precision" aesthetic: clean, objective, and highly legible. It prioritizes the accurate presentation of colorimetric data while maintaining a modern, high-tech interface suitable for edge devices like Raspberry Pi.

## Color Palette

### Core Colors
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Primary (Violet)** | `#7C3AED` | Primary actions, active states, key highlights. |
| **Surface (White)** | `#FFFFFF` | Main background to ensure data color integrity. |
| **Surface-Dim** | `#F8F9FF` | Secondary backgrounds, sidebars, and card containers. |
| **Secondary (Lavender)** | `#DDD6FE` | Hover states, secondary buttons, subtle accents. |

### Status Colors
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Success** | `#10B981` | Capture complete, system ready. |
| **Warning** | `#F59E0B` | Processing in progress, low lighting. |
| **Error** | `#EF4444` | Camera disconnected, capture failed. |

### Typography
- **Primary Font:** `Inter`
- **Scale:** 
  - **Headings:** Bold, Slate 800 (`#1E293B`)
  - **Body:** Regular, Slate 500 (`#64748B`)
  - **Data/Monospace:** Used for raw RGB values and coordinates.

## Components & Patterns

### Layout Structure
- **Sidebar Navigation:** A slim, vertical navigation bar to maximize horizontal space for charts and capture previews.
- **Data Cards:** Elevated white cards with subtle borders (`#E2E8F0`) and soft shadows to separate analysis modules.

### Interaction Patterns
- **Primary Action:** Large, centered violet buttons with clear icons.
- **System Feedback:** Pulse animations during capture sequences to indicate hardware activity.
- **Touch Targets:** Minimum 44x44px for compatibility with Raspberry Pi touchscreen displays.

## Design Rationale
The "Scientific Precision" system uses a light-first approach to prevent UI color contamination. By keeping the interface primarily white and neutral, the RGB histograms and captured chemical samples remain the most saturated elements on the screen, aiding in visual verification.

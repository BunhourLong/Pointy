# Pointy — Goal

## What it is
A browser app that turns my index finger into a pen. The webcam tracks my fingertip in real time, and I control the pen with my voice: say **"draw"** to start a line, **"stop"** to lift the pen, and **"draw"** again to start a new line. The finger keeps being tracked while the pen is up, so I can move to a new spot without leaving a trail.

## Core experience
1. Open the page and allow camera + mic.
2. See a mirrored webcam feed with a cursor dot on my index fingertip.
3. Say "draw" → a line follows my finger.
4. Say "stop" → the line ends; the cursor still follows my finger.
5. Say "draw" → a new, separate line starts where my finger is now.
6. Say "clear" → canvas is wiped.

## Success criteria (MVP)
- Fingertip tracking at ≥ 25 fps on a normal laptop webcam.
- Lines look smooth (no visible jitter or zig-zag when holding still).
- "stop" ends the stroke with little visible overshoot.
- Voice commands keep working for a 10+ minute session without a page reload.
- Pinch gesture (thumb + index together) works as a fallback pen-down when voice is unavailable.

## Voice commands
| Say | Effect |
|---|---|
| draw / go / start | Pen down, begin new stroke |
| stop / up | Pen up, end current stroke |
| clear | Erase everything |
| undo | Remove last stroke |
| red / blue / green / black / white | Change pen color |
| thicker / thinner | Change pen width |

## Non-goals (for now)
- Multi-hand or multi-user drawing
- Saving to a backend / accounts
- Mobile support (desktop Chrome/Edge first)
- Shape recognition or AI cleanup of drawings

## Stretch goals
- Export drawing as PNG
- Eraser mode (open palm erases)
- Toggle between voice mode and pinch mode in the UI
- Offline voice via Vosk instead of the Web Speech API

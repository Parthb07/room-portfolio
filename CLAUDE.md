# room-portfolio — CLAUDE.md

## What this is
Single-page interactive portfolio. A rendered isometric image of my room
is displayed full-screen. The user drags to pan, scrolls to zoom, and
clicks on objects (hotspot zones) to open a side panel with info about
that object fetched from Supabase.

## Stack
- Vite (build tool, dev server)
- Tailwind CSS v4 via @tailwindcss/vite plugin
- Vanilla JS ES modules — no React, no TypeScript
- Supabase (Postgres + Storage) for object data and images
- Deploy: Vercel (auto-deploy on git push)

## File structure
src/
  main.js        — init, loads data, boots scene and panel
  scene.js       — drag to pan, scroll to zoom, day/night toggle
  hotspots.js    — SVG zone definitions and hover/click logic  
  panel.js       — renders panel content from Supabase row
  supabase.js    — Supabase client and fetch functions
  style.css      — Tailwind directives + any custom CSS
public/
  room-day.png   — Blender render, day lighting
  room-night.png — Blender render, night lighting

## Scene
- Render resolution: 3840x2160
- SVG hotspot coordinates are in pixels relative to the render
- Zones defined in hotspots.js as an array of objects with id + points

## Supabase
- Project URL: in .env as VITE_SUPABASE_URL
- Table: objects — columns: id, label, eyebrow, description, tags,
  thumbnail, images (text[]), links (jsonb)
- Storage bucket: media (public)
- Row Level Security: public read, no write

## Panel behaviour
- Slides in from the right (380px wide)
- Shows: eyebrow, title, description, tags, image gallery, links
- Closes on Escape, clicking outside, or close button
- Don't open panel if user was mid-drag

## Day/night
- Two images stacked, CSS opacity crossfade 1.4s
- body.night class toggles which is visible
- Toggle pill in HUD bottom-center

## Coding rules
- ES modules throughout
- No classes — plain functions and exported objects
- Tailwind for all styling, minimal custom CSS
- Comments only where the why isn't obvious
- Keep concerns separated — scene.js doesn't know about Supabase,
  panel.js doesn't know about drag logic
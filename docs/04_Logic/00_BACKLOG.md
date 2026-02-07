# 00. Product Backlog & Implementation Status
> Created: 2026-02-07 17:34
> Last Updated: 2026-02-07 23:50

This document tracks the entire development progress. Tasks are moved from **Backlog** to **Current Sprint** and finally to **Completed** (archived).

## 1. Current Sprint (High Priority)
**(Focus: MVP Database & API Setup)**
*   [ ] **Task 2.1**: Setup Tech Stack (React Router v7, Drizzle, Turso).
*   [ ] **Task 2.2**: Implement Database Schema (Tables: Users, Listings, Bookings).
*   [ ] **Task 2.3**: Configure Cloudinary & Storage Utilities.
*   [x] **Task 2.4**: Implement Auth Logic (Better Auth integration, Social Login UI, requireUser utility). → [Auth & Session Logic](./06_AUTH_AND_SESSION_LOGIC.md)

## 2. Backlog (Upcoming)
### Frontend Implementation
*   [x] **Task 2.5**: Implement Smart Search UI (Location Badges, Price Slider). → [Search & Filter Logic](./07_SEARCH_AND_FILTER_LOGIC.md)
*   [ ] **Task 2.8**: [REMOVED] Upgrade Location Selection to Interactive SVG Rural Map.
*   [ ] **Task 2.9**: Integrate Professional Map API (Kakao/Naver) for Property Detail Pages.
*   [ ] **Task 2.10**: Setup LangGraph & Gemini 2.5 Flash Integration (Environment & Orchestration). → [AI Concierge Logic](./08_AI_CONCIERGE_LOGIC.md)
*   [ ] **Task 2.11**: Implement AI Global Concierge Tools (Kakao, KTO API & DB Connectors). → [AI Concierge Spec](../03_Specs/04_AI_CONCIERGE_SPEC.md), [AI Concierge Logic](./08_AI_CONCIERGE_LOGIC.md)
*   [x] **Task 2.7**: Implement Global Layout (Header/Footer). → [UI Design](../01_Foundation/05_UI_DESIGN.md)
*   [ ] **Task 2.6**: Implement Search Results Page (Filters, Map View).
*   [ ] Implement Property Detail Page (Gallery Modal, Info Cards).
*   [ ] Implement Booking Flow (Date Selection, Guest Count, Payment Fake).

### Backend Logic
*   [ ] Create API: `loader` for Listing Details.
*   [ ] Create API: `action` for Booking Creation.
*   [ ] Implement Admin Dashboard Data Fetching (Revenue/Occupancy).

### Design System
*   [ ] Setup Shadcn/UI Components (Button, Card, Input, Dialog).
*   [ ] Configure Tailwind Theme (Colors, Fonts).

## 3. Completed (History)
**(Archived to `docs/04_Logic/00_ARCHIVE/`)**
*   [x] **Phase 1: Foundation** → [PHASE_1_FOUNDATION.md](00_ARCHIVE/PHASE_1_FOUNDATION.md)
*   [x] **Phase 2: Prototype** → [PHASE_2_PROTOTYPE.md](00_ARCHIVE/PHASE_2_PROTOTYPE.md)
*   [x] **Phase 3: Specs** → [PHASE_3_SPECS.md](00_ARCHIVE/PHASE_3_SPECS.md)

# RailOptAI 🚆

### AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways

> **Smart India Hackathon 2026 — Problem Statement: SIH26027**

RailOptAI is an AI-powered railway maintenance planning and optimization system designed to integrate maintenance activities across multiple departments, identify suitable maintenance blocks, prioritize critical jobs, and generate optimized weekly/monthly maintenance plans with minimal disruption to train operations.

---

## 🎯 Problem

Railway maintenance activities are handled across multiple departments and systems such as:

- TMS — Track Management System
- SMMS — Signalling Maintenance Management System
- TDMS — Traction Distribution Management System

At the same time, maintenance planning must consider:

- Train schedules
- Available maintenance windows
- Asset criticality
- Maintenance urgency
- Freight/traffic demand
- Maintenance duration
- Department coordination
- Safety and operational constraints

The goal is to create an integrated plan that maximizes asset availability while minimizing operational disruption.

---

## 💡 Proposed Solution

RailOptAI combines **AI-based maintenance prioritization** with **constraint-based optimization**.

### Core Workflow

```text
TMS / SMMS / TDMS
        │
        ▼
  Maintenance Data
        │
        ▼
 AI Priority Engine
        │
        ▼
 Priority Scores
        │
        │
Train Timetable ──► Available Blocks
        │
        ▼
 CP-SAT Optimization
        │
        ▼
 Optimized Maintenance Plan
        │
        ▼
 Backend + Database
        │
        ▼
    Dashboard
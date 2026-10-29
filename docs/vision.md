# Lift Progress Tracker — Product Vision

## Vision

Build and deploy a high-quality, multi-user application that helps people record body weight and strength training and understand their progress over time. The application should be dependable and comfortable to use in everyday life on both phones and PCs.

## Why this project exists

The primary goal is to learn advanced backend development by delivering a substantial, professionally engineered application. Building a useful fitness tracker for everyday use is also important, but the backend is the main learning focus.

This is intended to become a real, deployed service for real users. It is not a prototype, tutorial exercise, or throwaway personal-use implementation. Engineering and operational quality are part of the product, not optional polish.

## Intended users

The system is designed for multiple independent users. Each user’s account and data must be kept separate and protected through appropriate authentication and authorization. The product should not be designed around an assumption that only one person will use it.

## Product scope

At a high level, the application will let users:

- Record body weight over time and review its history.
- Define or reuse gym session plans and record completed sessions, exercises, sets, repetitions, and load.
- Review exercise histories and reports to understand training progress.
- Revisit past sessions.

Detailed workflows, exercise and set semantics, report calculations, and interface design will be defined during requirements and design work.

## Experience and platform direction

- Provide the complete application on both phone and PC. Every feature should be practical to use on either screen size; layouts and controls may adapt to the device.
- Build a responsive web application with a well-defined API boundary between the client and backend.
- The current front-end direction is React with TypeScript and React Router Framework Mode, configured as a client-rendered application without runtime server-side rendering.
- An installable Progressive Web App is the preferred direction for app-like home-screen access on supported devices. The initial version is online-only; offline entry and synchronization may be considered later.

## Backend and engineering vision

The backend is a first-class product component and the primary technical learning area. It should be designed and operated with production-quality practices, including more than the domain rules and basic data-entry endpoints.

Areas of interest include robust domain and data modeling, API design, authentication and authorization, user data isolation, security, observability, reliability, backups and recovery, automated testing, deployment, CI/CD, and operational documentation. The backend should remain independent of the current front end so other clients could be added later.

The project should have meaningful depth in these areas without adding complexity arbitrarily. The initial technology direction is NestJS with TypeScript for the backend, React with TypeScript for the frontend, PostgreSQL with Prisma for persistence, and a Docker-based deployment behind a same-origin reverse proxy. Hosting, identity provider, operational targets, and implementation sequencing remain open for requirements and architecture work.

## Initial boundaries

- The initial application requires an internet connection. Offline behavior is a possible later enhancement.
- Spreadsheet import and export are not part of the current scope.
- This vision establishes purpose and direction; it does not replace detailed product requirements, interaction design, or technical architecture.

## What success looks like

The project results in an implemented and deployed service that multiple users can access, use securely, and rely on for their training and weight history. It works well across phone and PC, and its backend demonstrates professional product and operational engineering beyond a minimal CRUD application.

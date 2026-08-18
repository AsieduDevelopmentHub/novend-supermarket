# Convex Guide

Version: 1.0.0

Convex is the application backend and source of truth.

It owns database, queries/mutations/actions, authentication, authorization,
business rules, file storage, and realtime.

## Function rules

- Authenticate, authorize (org + role + branch), validate, then mutate
- Mutations that change inventory write history and refuse negative stock
- Queries use `organizationId` indexes; avoid full-table scans
- Return only needed fields; strip cost prices for cashiers

## Schema

- Tables model business entities, not screens
- Invalid states should be unrepresentable
- Preserve history; prefer archive over delete

## Frontend

The UI talks to Convex only through generated `api` functions.

# Organization Mode — Design Document

Status: **Future** (parked for later implementation)
Created: 2026-07-16

---

## Overview

Organization Mode allows a consulting firm or PMO to sign up with multiple users under one account. 2-3 PMs create and manage projects. 10-20 resources (engineers, contractors, etc.) log in with limited access to raise issues and log time against assigned tasks.

This builds on the Solo Consultant mode (database-per-tenant isolation) — an Org is simply a tenant with multiple users instead of one.

---

## User Types

### PM (Project Manager)
- Full access to all features
- Creates projects, manages schedules, budgets, risks
- Invites resources to the organization
- Access to AI features, reports, analytics
- Roles: `project_manager`, `scrum_master`, `pmo`

### Resource (Team Member)
- Limited access — scoped to their assignments
- Can: view assigned tasks, log time, raise issues, view project schedules (read-only)
- Cannot: create projects, manage budgets, access AI features, see other PMs' projects, access admin/settings
- Roles: `team_member`

### Org Admin
- Typically the person who signed up (org owner)
- Manages members: invite, remove, change roles
- Manages billing and subscription
- Role: `admin`

---

## What Needs to Be Built

### 1. Invitation System
- New table: `org_invitations` (id, organization_id, email, role, invited_by, token, status, expires_at, created_at)
- PM/Admin sends invite via email with a unique token link
- Recipient clicks link → registration page pre-filled with org context
- On accept: user created in control plane DB, added to org, gets access to tenant DB
- Invites expire after 7 days, can be resent
- API: `POST /org/invitations`, `GET /org/invitations`, `DELETE /org/invitations/:id`, `POST /org/invitations/:token/accept`

### 2. Resource-Scoped UI
- Limited sidebar for resources: only "My Tasks", "Time Logging", "Issues"
- Dashboard shows only assigned tasks and time logging summary
- No access to: project creation, budgets, reports, AI chat, analytics, admin, settings
- Route guards: redirect resources away from unauthorized pages
- Already partially supported by role-based sidebar logic in `Sidebar.tsx`

### 3. Org Admin Panel
- New page: `/org/members` — list all org members with roles
- Invite new member (email + role picker)
- Remove member (with confirmation)
- Change member role (PM <-> Resource)
- View seat usage vs plan limits
- API: `GET /org/members`, `PUT /org/members/:id/role`, `DELETE /org/members/:id`

### 4. Per-Seat Billing
- Pricing model decision needed:
  - **Option A:** All seats equal price (simple)
  - **Option B:** PM seats (full price) + Resource seats (free or discounted) — recommended
  - **Option C:** PM seats paid, unlimited free resource seats (growth play)
- Stripe integration: update subscription quantity on member add/remove
- Enforce seat limits based on plan tier
- Show seat count on billing page

### 5. Resource Task View
- Filtered task list: only tasks where `assigned_to = current_user`
- Inline time logging from task view
- "Raise Issue" button on task cards → creates RAID item of type `issue`
- Read-only project schedule view (Gantt/table, no editing)

---

## Migration Path: Solo to Org

When a solo consultant wants to add team members:
1. Upgrade subscription from Solo to Org tier (in billing settings)
2. Invitation UI appears in settings/admin
3. Existing tenant database stays the same — no data migration
4. Invited resources join the existing tenant
5. Solo consultant becomes Org Admin automatically

---

## Database Changes

### Control Plane (`pmassist`)
```sql
CREATE TABLE org_invitations (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'team_member',
  invited_by VARCHAR(36) NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('pending', 'accepted', 'expired', 'cancelled') DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (invited_by) REFERENCES users(id)
);
```

### Tenant DBs
No schema changes — resources use the same tables (tasks, time_entries, raid_items, etc.) with existing role-based access controls.

---

## Existing Infrastructure That Supports This

| Component | Status |
|---|---|
| Multi-tenant database isolation | Built |
| Organization table + user association | Built (migration 050) |
| 13 user roles with scope mappings | Built |
| `requireProjectAccess` middleware | Built |
| Role-based MCP tool filtering | Built |
| Role-based sidebar rendering | Built |
| Time logging system | Built |
| RAID issue creation | Built |
| Stripe service skeleton | Built |

---

## Estimated Effort

| Component | Effort |
|---|---|
| Invitation system (table + API + emails) | Medium |
| Accept invite flow (registration variant) | Medium |
| Resource-scoped UI (sidebar + route guards) | Small |
| Org admin panel (member management page) | Medium |
| Per-seat Stripe billing | Medium |
| Resource task view (filtered + time log) | Small |
| **Total** | **~1 week of focused work** |

---

## Open Questions (Decide Before Building)

1. **Seat pricing model** — Option A, B, or C above?
2. **Can resources see all projects or only ones they're assigned to?** (Recommended: only assigned)
3. **Can a resource belong to multiple orgs?** (Recommended: no, keep it simple)
4. **Self-registration for resources?** (Recommended: invite-only, no self-signup for org members)
5. **Free tier for resources?** (Recommended: yes, to reduce friction for adoption)

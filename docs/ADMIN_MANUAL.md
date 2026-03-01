# PM Assistant – Admin Manual

This manual is for **system administrators** who manage **users**, **regions**, and **system configuration** for the PM Assistant.

---

## Roles and access

| Role           | Access                                                                 |
|----------------|------------------------------------------------------------------------|
| **admin**      | Full access: all regions, users, projects, region content, notices.   |
| **region_admin** | One region: region content, notices, region projects.                 |
| **manager** / **member** | Projects and schedules they’re assigned to.                      |
| **citizen**    | View-only: region info, notices, project status for their region.     |

Admins can impersonate or manage any region; region admins are restricted to their assigned region.

---

## User management

- **Create users** – Add users with the appropriate **role** and **region** (for region_admin / citizen).
- **Edit users** – Update roles, region, and account details.
- **Disable/delete users** – Follow your organization’s policy; disable before delete where supported.

User management may be done via an **admin UI**, **API**, or **database**, depending on deployment. Ensure strong passwords and secure storage (e.g. hashed passwords, HTTPS).

---

## Region management

- **Regions** correspond to geographic/admin units (e.g. Guyana’s 10 regions).
- Each region can have:
  - **Content sections** (About, Contact, Services, etc.)
  - **Notices** (announcements, project updates, etc.)
  - **Projects** linked to that region.
- **Admins** can manage all regions; **region admins** only their assigned region.

Use the **Region Admin** flow and **Manage Region** to configure content and notices. See [Region Admin Guide](./REGION_ADMIN_GUIDE.md).

---

## System configuration

- **Environment** – Use `.env` (or equivalent) for secrets, database URL, JWT secrets, and CORS. Never commit secrets.
- **Database** – Run migrations and backups. Use a dedicated DB user with least privilege.
- **API** – Backend base URL (e.g. `http://localhost:3001` in dev). Frontend and backend must agree on URL and CORS.
- **Logging** – Use structured logs (e.g. Winston/Pino) and, in production, error tracking (e.g. Sentry) if configured.

Refer to **README**, **DEPLOYMENT_GUIDE**, and **config-templates** for exact variables and steps.

---

## Security

- **Authentication** – HttpOnly cookies and JWT; tokens should expire and refresh appropriately.
- **Authorization** – Enforce roles and region checks on all sensitive endpoints.
- **HTTPS** – Use HTTPS in production.
- **CSP / headers** – Keep Content-Security-Policy and security headers enabled. See **SECURITY_GUIDE**.
- **Audit** – Log auth events, privilege changes, and sensitive actions.

---

## Backups and recovery

- **Database** – Regular backups (e.g. via **backup-database** or your DB tooling).
- **Recovery** – Use **recovery** and **restore** scripts as documented; test restores periodically.
- **Secrets** – Rotate JWT and cookie secrets per policy; update env and restart services.

---

## Health and monitoring

- **Health endpoints** – Use `/health` (or similar) for liveness/readiness.
- **Monitoring** – Monitor API latency, errors, and DB connectivity.
- **Alerts** – Alert on repeated failures, DB down, or auth issues.

---

## Troubleshooting

- **Users can’t log in** – Check credentials, token expiry, and cookie domain/path.
- **Region admin sees “Access Denied”** – Verify `region_id` and role.
- **Notices/sections don’t show** – Ensure they’re **published** and **visible**; check region and expiry.
- **API errors** – Check server logs, DB connectivity, and CORS. See **TROUBLESHOOTING_GUIDE**.

---

## References

- [User Guide](./USER_GUIDE.md) – Projects and schedules.
- [Region Admin Guide](./REGION_ADMIN_GUIDE.md) – Region content and notices.
- [Citizen Guide](./CITIZEN_GUIDE.md) – Viewing region info.
- **README**, **DEPLOYMENT_GUIDE**, **SECURITY_GUIDE**, **TESTING_GUIDE** – Setup, deployment, and operations.

# PM Assistant – User Guide

This guide explains how to use the PM Assistant as a **project manager** or **team member**: logging in, managing projects, and using schedules and AI task breakdown.

---

## Logging in

1. Open the PM Assistant in your browser (for example, `http://localhost:5173` in development).
2. If you see the **landing page** with regions, use **Sign in** (or go to `/login`).
3. Enter your **username** and **password** and click **Sign in**.
4. You’ll be redirected to the **Dashboard**.

If your session expires, you’ll be sent back to the login page. Sign in again to continue.

---

## Dashboard

- The **Dashboard** lists projects you can access.
- Use **Create New Project** to add a project.
- Open a project card to **view details** or **View Schedule** to manage its schedule.

---

## Creating projects

1. On the Dashboard, click **Create New Project**.
2. Fill in:
   - **Name** (required)
   - **Description** (optional)
   - **Status** (e.g. Planning, Active, Completed)
   - **Priority**, **Budget**, **Dates**, **Assigned PM** (optional)
3. Click **Create** (or **Save**).
4. The new project appears on the Dashboard.

You can **edit** or **delete** a project from its card or project page, if you have permission.

---

## Managing schedules

1. On the Dashboard, open a project and click **View Schedule** (or use the project’s **Schedule** tab).
2. On the **Schedule** page you can:
   - **Add phases** – Use **Add Phases** and pick a template (e.g. School Construction).
   - **Add tasks** – Add tasks under phases, set **due date**, **status**, **priority**, **assignee**.
   - **Save Schedule** – Persist changes to the server.
3. **Expand/collapse** phases (e.g. via the **>** chevron) to show or hide subtasks.
4. Use **Clear Schedule** only if you intend to remove all phases and tasks.

Always click **Save Schedule** after changes; otherwise they are lost when you leave or refresh.

---

## AI task breakdown

1. Open a project’s **Schedule** page.
2. Add at least one phase (e.g. from a template), then click **AI Task Breakdown** (or **AI** in the action bar).
3. Enter a short **project description** (e.g. “School construction with design, procurement, and construction phases”).
4. Click **Generate Tasks**.
5. Review the suggested tasks, adjust if needed, then **Save Schedule** to store them.

AI suggestions can be edited like any other task (name, dates, assignee, etc.).

---

## Monitoring and performance

- Use **Monitoring** (if available in the menu) to see system health, errors, and performance.
- Use **Performance** (if available) for high-level metrics and alerts.

---

## Tips

- **Save often** – Especially after adding or editing tasks.
- **Refresh** – If something looks wrong, refresh the page; your saved data will reload.
- **Errors** – If you see “Something went wrong”, use **Try Again** or **Refresh**, or **Go to Dashboard** and retry. If it persists, report it to your administrator.

---

## Need help?

- **Region-specific content** – See [Citizen Guide](./CITIZEN_GUIDE.md) if you only need to view region info and notices.
- **Region admins** – See [Region Admin Guide](./REGION_ADMIN_GUIDE.md) for managing region content and notices.
- **Administrators** – See [Admin Manual](./ADMIN_MANUAL.md) for user and system configuration.

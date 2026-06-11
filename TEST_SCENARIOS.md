# REG ARMS — Test Scenarios
**Step-by-step walkthrough from first login to resolution**

---

## Prerequisites
- Backend running on `http://localhost:8080`
- Frontend running on `http://localhost:5173`
- Flask AI service running on `http://localhost:5000`
- At least one ADMIN account exists in the database

> **Default Admin Credentials** (from seed data / first migration):
> - Email: `admin@reg.rw`
> - Password: `Admin@1234`

---

## SCENARIO 1 — Admin Sets Up the System

### 1.1 Log in as Admin
1. Go to `http://localhost:5173`
2. Enter admin credentials and click **Login**
3. ✅ You should land on the **Admin Dashboard** showing stats cards

### 1.2 Create a Staff Account
1. Click **Users** in the sidebar
2. Click **Add User**
3. Fill in:
   - First Name: `Claire`
   - Last Name: `Uwase`
   - Email: `claire@reg.rw`
   - Password: `Staff@1234`
   - Role: **STAFF**
4. Click **Save**
5. ✅ Claire should appear in the users list with role STAFF and status Active

### 1.3 Create a Technician Account
1. Still on Users page, click **Add User**
2. Fill in:
   - First Name: `Daniel`
   - Last Name: `Habimana`
   - Email: `tech@reg.rw`
   - Password: `Tech@1234`
   - Role: **TECHNICIAN**
3. Click **Save**
4. ✅ Daniel should appear in the users list with role TECHNICIAN

### 1.4 Create the Service Categories
1. Click **Categories** in the sidebar
2. Create the following categories one by one (click **Add Category** each time):

| Name | Default Priority | Description |
|------|-----------------|-------------|
| Power Outage | High | Complete loss of electricity supply |
| Safety Hazard | Critical | Life-threatening electrical hazards |
| Billing Dispute | Low | Invoice or payment issues |
| Meter Issues | Medium | Faulty or missing meter |
| New Connection | Medium | Request for new electricity connection |

3. ✅ All 5 categories should appear as Active

### 1.5 Check the Reports Page
1. Click **Reports** in the sidebar
2. Set date range to last 30 days and click **Generate**
3. ✅ Report shows (mostly empty for now — that's expected)

---

## SCENARIO 2 — Customer Registers and Submits a Request

### 2.1 Register as a Customer
1. Open a **new browser / incognito window**
2. Go to `http://localhost:5173`
3. Click **Create an account**
4. Fill in:
   - First Name: `Jean`
   - Last Name: `Bosco`
   - Email: `jean@gmail.com`
   - Password: `Customer@1234`
   - Phone: `0781234567`
   - Province: Kigali City
   - District: Gasabo
5. Click **Register**
6. ✅ Message: "Registration submitted — awaiting admin approval"

### 2.2 Admin Approves the Customer
1. Switch back to the **Admin browser**
2. Click **Users** → look for the **Pending Approvals** section (or filter by pending)
3. Find Jean Bosco and click **Approve**
4. ✅ Jean's account is now Active
5. ✅ Jean receives an approval email (check inbox or email logs)

### 2.3 Customer Logs In
1. Switch to the **Customer browser**
2. Log in with `jean@gmail.com` / `Customer@1234`
3. ✅ Lands on **Customer Dashboard**

### 2.4 Customer Submits a Low-Priority Request
1. Click **Submit Request** in the sidebar
2. Notice location and phone are **pre-filled** from profile
3. Fill in:
   - Title: `I have not received my electricity bill for 2 months`
   - Category: **Billing Dispute**
   - Description: `My account number is 00123456. I have not received a bill since January and I am worried about accumulating debt.`
4. Watch the **AI Priority Preview** appear → should show **Low**
5. Click **Submit Request**
6. ✅ Success message with request code (e.g. `REG-20260527-0001`)
7. ✅ Jean receives an acknowledgement email

### 2.5 Customer Submits a Critical Request
1. Click **Submit Request** again
2. Fill in:
   - Title: `Electric pole fell on the road near my house`
   - Category: **Safety Hazard**
   - Description: `A high voltage pole has fallen on Kimironko road after heavy rain. Sparks are visible and it is blocking traffic. This is very dangerous.`
3. Watch the **AI Priority Preview** → should show **Critical** (keyword: "high voltage", life-safety)
4. Click **Submit Request**
5. ✅ Second request submitted
6. ✅ Staff/Admin receive a real-time notification (bell icon in topbar)

---

## SCENARIO 3 — Staff Manages Requests

### 3.1 Log in as Staff
1. Open another **incognito window**
2. Log in with `claire@reg.rw` / `Staff@1234`
3. ✅ Lands on **Staff Dashboard** showing active request feed

### 3.2 View the Request List
1. Click **Requests** in the sidebar
2. ✅ Both Jean's requests should be visible
3. Click the **Critical** filter tab → only the Safety Hazard request shows
4. Notice the **red SLA chip** already counting down on the Critical request

### 3.3 Check AI Prediction on the Critical Request
1. Click on the fallen pole request to open detail
2. Scroll to the **AI Analysis** section
3. ✅ Should show: Priority = Critical, Confidence score, detected keywords (pole, high voltage, dangerous)
4. Notice the **SLA deadline** shown (2 hours from submission)

### 3.4 Check Technician Recommendations
1. Still on the Critical request detail
2. Click **Technician Recommendations** (or look for the matching panel)
3. ✅ Daniel Habimana should appear scored — but may score 0 on specialization since his profile is not set up yet
4. Keep this in mind — we'll fix this in Scenario 4

### 3.5 Manually Assign the Technician
1. Click **Assign Technician**
2. Select **Daniel Habimana**
3. Click **Assign**
4. ✅ Request status remains Pending but technician is assigned
5. ✅ Daniel receives a notification

### 3.6 Add an Internal Note
1. Scroll to the **Comments** section
2. Check the **Internal (staff only)** checkbox
3. Type: `Dispatched Daniel. Advise him to call Kimironko sub-station before arrival.`
4. Click **Post**
5. ✅ Comment appears with an "Internal" badge in red/amber
6. ✅ Customer Jean does NOT receive an email (internal comment)

### 3.7 Add a Public Comment
1. Uncheck **Internal**
2. Type: `Your request has been received and a technician has been dispatched. Please keep a safe distance from the fallen pole.`
3. Click **Post**
4. ✅ Jean receives an email notification with this comment

### 3.8 Set Technician Capacity
1. Click **Technicians** in the sidebar
2. Click on Daniel Habimana to open his profile
3. Click **Set Capacity**
4. Change Max Concurrent Tasks to `5`
5. Click **Save**
6. ✅ Max Workload updates to 5 in the detail panel immediately

---

## SCENARIO 4 — Technician Sets Up Profile and Works Tasks

### 4.1 Log in as Technician
1. Open another **incognito window** (you now have 3: admin, staff, customer)
2. Log in with `tech@reg.rw` / `Tech@1234`
3. ✅ Lands on **Technician Dashboard**

### 4.2 Set Up Professional Profile
1. Click **Profile** in the sidebar
2. Scroll to the **Professional Profile** section
3. Fill in:
   - Specialization: `High-voltage lines, Safety response, Pole maintenance`
   - Service Categories: click **Safety Hazard**, **Power Outage** (both turn red/active)
   - Province Coverage: click **Kigali City** (turns green)
   - District Coverage: **Gasabo** appears → click it (turns blue)
4. Click **Save Profile**
5. ✅ "Saved successfully" confirmation appears

### 4.3 Set Weekly Availability
1. Click **Availability** in the sidebar
2. For Monday through Friday: set Start Time `08:00`, End Time `17:00`, toggle **Working** ON
3. Leave Saturday and Sunday as not working
4. Click **Save Schedule**
5. ✅ Schedule saved

### 4.4 View Assigned Tasks
1. Click **Assigned Tasks** in the sidebar
2. ✅ Both requests should appear (the billing dispute and the fallen pole)
3. Notice the **Critical** priority border on the fallen pole request

### 4.5 Acknowledge the Critical Task
1. On the fallen pole request, click **Acknowledge & Start**
2. ✅ Status changes to **In Progress**
3. ✅ Staff (Claire) receives a notification

### 4.6 Add a Work Comment
1. Click **View Details** on the fallen pole request
2. In the Comments section, type: `On site. Pole has been secured. Coordinating with sub-station to isolate the line before restoration.`
3. Post the comment
4. ✅ Jean (customer) receives an email notification

### 4.7 Resolve the Request
1. Still on the request detail, change status to **Resolved**
2. Add resolution notes: `Pole restored and line re-energized. Road is now clear. Area is safe.`
3. ✅ Status changes to Resolved
4. ✅ Daniel's workload decrements
5. ✅ Jean receives a notification

---

## SCENARIO 5 — Customer Rates the Resolution

### 5.1 Customer Sees Resolved Request
1. Switch to **Jean's browser**
2. Click **My Requests**
3. ✅ The fallen pole request shows status **Resolved**
4. Click on it to open detail

### 5.2 Customer Rates the Service
1. Look for the **Rate this Resolution** section
2. Select **5 stars**
3. Optionally add feedback: `Very fast response, thank you!`
4. Click **Submit Rating**
5. ✅ Rating submitted

### 5.3 Verify Rating on Technician Profile
1. Switch to **Staff browser**
2. Click **Technicians** → click Daniel Habimana
3. ✅ Rating should now show `5.0 / 5`
4. ✅ Total Resolved shows `1`

---

## SCENARIO 6 — Staff Uses the Kanban Board

### 6.1 Open Kanban
1. In the **Staff browser**, click **Kanban Board**
2. ✅ Three columns: Pending, In Progress, Resolved
3. The billing dispute request should be in **Pending**

### 6.2 Drag to In Progress
1. Drag the billing dispute card from **Pending** to **In Progress**
2. ✅ Status updates, Jean receives a notification

### 6.3 Move to Resolved via Kanban
1. Drag it from **In Progress** to **Resolved**
2. ✅ Status updates to Resolved

---

## SCENARIO 7 — Admin Views Reports & Analytics

### 7.1 View Analytics
1. Switch to **Admin browser**
2. Click **Analytics**
3. ✅ Charts now have data points:
   - Priority distribution (Critical and Low visible)
   - Technician performance (Daniel: 1 resolved)
   - AI confidence distribution

### 7.2 Generate a Report
1. Click **Reports**
2. Set date range to cover today
3. Click **Generate**
4. ✅ Report shows: 2 requests, 1 Critical, 1 Low, 1 resolved

### 7.3 Export to CSV
1. Click **Export CSV**
2. ✅ File downloads with request data

### 7.4 View AI Predictions
1. Click **AI Predictions**
2. ✅ Shows 2 predictions made (one Critical, one Low)
3. Accuracy may show 0% or N/A until the 48-hour implicit confirmation scheduler runs

---

## SCENARIO 8 — Technician Checks Notifications

### 8.1 View Notifications
1. Switch to **Technician browser**
2. Click the **bell icon** in the topbar or click **Notifications**
3. ✅ Should see:
   - "You have been assigned a new request"
   - Any status updates
4. Click **Mark all as read**
5. ✅ Badge clears

---

## SCENARIO 9 — Edge Cases to Test

### 9.1 Duplicate Request Detection
1. In **Jean's browser**, click **Submit Request**
2. Use the same category (Billing Dispute) and same province (Kigali City)
3. ✅ A warning banner appears: "Similar open request found"
4. Jean can still submit — it is a warning, not a block

### 9.2 Category Auto-Suggestion
1. On the Submit Request form, clear the category
2. Start typing in the title: `my electricity is out`
3. ✅ Category suggestion appears: "Power Outage"
4. Click it to auto-select

### 9.3 Staff Priority Override
1. In **Staff browser**, open the billing dispute request
2. Change priority to **High** (manual override)
3. ✅ Priority shows HIGH with a "manually set" indicator
4. The AI prediction is preserved but not used for display

### 9.4 Technician Toggles Unavailable
1. In **Technician browser**, go to **Availability**
2. Toggle **Available** to OFF
3. Switch to **Staff browser** → click **Technicians**
4. ✅ Daniel shows as **Unavailable**
5. Go back to Technician → toggle back ON

### 9.5 Customer Cancels a Request
1. Submit a new request as Jean (any type)
2. Go to **My Requests** and click on it
3. Click **Cancel Request**
4. ✅ Status changes to Cancelled
5. ✅ Request disappears from active lists

### 9.6 Password Change
1. As any user, go to **Profile**
2. Fill in current password and new password (must be 8+ chars, uppercase, number, special char)
3. Watch the **password strength bar** as you type
4. Click **Update Password**
5. ✅ Log out and log back in with the new password

---

## SCENARIO 10 — Admin Manages Users

### 10.1 Deactivate a User
1. In **Admin browser**, click **Users**
2. Find Daniel Habimana
3. Click **Toggle Status** (deactivate)
4. ✅ Status changes to Inactive
5. Try to log in as Daniel → ✅ Login fails with "Account is inactive"
6. Toggle back to Active

### 10.2 View Pending Registrations
1. Open a new incognito window, register a new customer (e.g. `test@gmail.com`)
2. In **Admin browser**, click **Users** → filter for Pending
3. ✅ New registration appears
4. Click **Reject**
5. ✅ Account removed, rejection email sent

---

## Quick Checklist — What to Verify

| Feature | Expected Result |
|---------|----------------|
| Customer registration requires approval | ✅ |
| AI predicts Critical for Safety Hazard | ✅ |
| AI predicts Low for Billing Dispute | ✅ |
| Acknowledgement email sent on submit | ✅ |
| Email link goes to `/requests/{id}` not 404 | ✅ |
| Internal comments hidden from customer | ✅ |
| Public comment triggers customer email | ✅ |
| Staff can only set capacity (not specialization) | ✅ |
| Technician can edit own coverage/tags | ✅ |
| Submit form pre-fills location from profile | ✅ |
| SLA chip shows on Critical requests | ✅ |
| Kanban drag updates status | ✅ |
| Rating updates technician score | ✅ |
| Notifications appear in real-time | ✅ |
| Reports show correct counts | ✅ |
| CSV export downloads | ✅ |

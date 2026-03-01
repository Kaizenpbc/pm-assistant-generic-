# Testing Guide - Gantt Chart Features

**Date:** November 21, 2025  
**Features to Test:** Summary Task Auto-Calculation & Dependency Arrows

---

## 🚀 Starting the Application

### **Current Status:**
- ✅ Client: Fixed and ready (reinstalled node_modules)
- ⚠️ Server: Has a transform error that needs fixing

### **To Start:**

1. **Start Client** (Working ✅):
   ```bash
   cd src/client
   npm run dev
   ```
   - Should start on `http://localhost:5173/`

2. **Start Server** (Needs Fix ⚠️):
   ```bash
   npm run server:dev
   ```
   - Currently crashing with TransformError
   - May need to rebuild or check TypeScript config

### **Alternative: Use Mock Data**
The client can run in offline mode with mock data for testing UI features.

---

## 🧪 Test Plan

### **Feature 1: Summary Task Auto-Calculation** ✅

#### **Test 1.1: Gantt View - Drag Task Bar**
**Steps:**
1. Navigate to a project's Schedule page
2. Add phases using "Add Phases" button
3. Select a template (e.g., "Road Construction & Repair")
4. Select 2-3 phases with subtasks
5. Switch to Gantt view
6. Drag a subtask bar to change its dates

**Expected Result:**
- ✅ Parent phase dates update automatically
- ✅ Phase start = earliest subtask start
- ✅ Phase end = latest subtask end
- ✅ Console shows: "🔄 Subtask {id} changed, updating parent {parentId}"

#### **Test 1.2: List View - Edit Dates**
**Steps:**
1. Stay in List view
2. Expand a phase to show subtasks
3. Edit a subtask's start or finish date
4. Tab to next field or click away

**Expected Result:**
- ✅ Parent phase dates update automatically
- ✅ Console shows: "🔄 Subtask {id} date changed in List view, updating parent {parentId}"

#### **Test 1.3: Progress Update**
**Steps:**
1. Switch to Gantt view
2. Drag the progress bar on a subtask (e.g., from 0% to 50%)

**Expected Result:**
- ✅ Parent phase progress updates to average
- ✅ If 3 subtasks at 0%, 50%, 100%, parent shows 50%
- ✅ Console shows: "🔄 Subtask {id} progress changed, updating parent {parentId}"

---

### **Feature 2: Dependency Arrows** ✅

#### **Test 2.1: Basic Arrow Rendering**
**Steps:**
1. Create 2 tasks in the same phase (Task A, Task B)
2. In List view, expand the phase
3. For Task B, select Task A from the "Dependency" dropdown
4. Switch to Gantt view

**Expected Result:**
- ✅ Arrow from Task A to Task B
- ✅ Arrow color: Slate gray (`#94a3b8`)
- ✅ Arrow connects end of Task A to start of Task B
- ✅ Task B dates auto-calculate to start after Task A

#### **Test 2.2: Dependency Types**
Test FS, SS, FF, SF dependency types with expected date calculations.

#### **Test 2.3: Lag Time**
Test 2-day lag with FS dependency type.

#### **Test 2.4: Dependency Chain**
Test A → B → C chain with cascading date updates.

---

## 📊 Verification Checklist

### **Summary Task Auto-Calculation**
- [ ] Gantt drag updates parent dates
- [ ] List edit updates parent dates
- [ ] Progress update updates parent progress
- [ ] Console logs show update messages

### **Dependency Arrows**
- [ ] Arrows render in Gantt view
- [ ] Arrow color is slate gray
- [ ] All 4 dependency types work
- [ ] Lag time works
- [ ] Dependency chain works

---

**Testing By:** [Your Name]  
**Date:** November 21, 2025  
**Status:** Ready for Testing

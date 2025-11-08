# Manual Testing Checklist for New Vibe Routes

## Overview

This checklist covers manual testing for the UUID-based Vibe instance management system added in the `jchris/uuid-remotes` branch.

## Prerequisites

- ✅ Routes registered in `vibes.diy/pkg/app/routes.ts`
- Development server running: `cd vibes.diy/pkg && pnpm dev`
- Authenticated user session (logged in)
- At least one vibe available (e.g., "kanban-board")

## Test Scenarios

### 1. Access Instance List Page

**Route**: `/vibe/kanban-board` (or any other vibe slug)

#### Steps:

1. Navigate to `/vibe/kanban-board`
2. Verify page loads without errors
3. Check for UI elements:
   - [ ] Page title shows vibe name (e.g., "Kanban Board")
   - [ ] "Create New Instance" button visible
   - [ ] Empty state message if no instances exist
   - [ ] Instance list if instances exist

#### Expected Results:

- Page renders correctly
- No console errors
- UI is responsive

---

### 2. Create New Instance

#### Steps:

1. On instance list page, click "Create New Instance" button
2. Verify dialog/modal opens
3. Enter instance description: `"My Test Board"`
4. Click Create button (or press Enter)
5. Wait for creation to complete
6. Verify automatic navigation to instance viewer

#### Expected Results:

- [ ] Dialog opens with input field
- [ ] Input accepts text
- [ ] Create button disabled when empty
- [ ] Loading/Creating state shown during creation
- [ ] Successful navigation to `/vibe/kanban-board/{uuid}`
- [ ] UUID is valid format (e.g., `fireproof:abc123def456`)

#### Test Variations:

- Cancel creation (Escape key or Cancel button)
- Create with empty description (should be prevented)
- Create with very long description (100+ characters)
- Create multiple instances rapidly

---

### 3. View Instance List

#### Steps:

1. Navigate back to `/vibe/kanban-board`
2. Verify newly created instance appears in list
3. Check instance card/row display

#### Expected Results:

- [ ] Instance shows description: "My Test Board"
- [ ] Creation date/time displayed
- [ ] Sharing information shown (e.g., "Shared with 0 people")
- [ ] Action buttons visible: Edit, Open, Delete
- [ ] Instances sorted by creation date (newest first)

---

### 4. Edit Instance Description

#### Steps:

1. Click Edit button on an instance
2. Verify edit mode activates
3. Change description to: `"Updated Test Board"`
4. Press Enter or click Save
5. Verify description updates in place

#### Expected Results:

- [ ] Edit mode shows input with current description
- [ ] Input is focused and ready for editing
- [ ] Save on Enter key works
- [ ] Cancel on Escape key works
- [ ] Description updates without page reload
- [ ] Updated timestamp changes

#### Test Variations:

- Cancel edit without saving
- Edit to empty description (should be prevented)
- Edit multiple instances in sequence

---

### 5. Open Instance in Viewer

#### Steps:

1. Click "Open" button or click on instance row
2. Verify navigation to viewer page
3. Check URL format: `/vibe/kanban-board/{uuid}`

#### Expected Results:

- [ ] Navigates to instance viewer
- [ ] URL contains correct titleId and UUID
- [ ] No errors during navigation

---

### 6. View Instance in Iframe

**Route**: `/vibe/kanban-board/{uuid}`

#### Steps:

1. On instance viewer page, observe loading process
2. Wait for iframe to load
3. Interact with Vibe inside iframe

#### Expected Results:

- [ ] Loading overlay appears initially
- [ ] Loading spinner or progress indicator visible
- [ ] Loading message shows vibe name
- [ ] Iframe loads from correct Vibesbox URL
- [ ] Loading overlay disappears when iframe ready
- [ ] Vibe renders correctly inside iframe
- [ ] Vibe is interactive (can click, type, etc.)
- [ ] Full-screen iframe (no unnecessary borders/padding)

#### Check Developer Console:

- [ ] No CORS errors
- [ ] PostMessage communication working
- [ ] `preview-ready` message received
- [ ] No JavaScript errors

---

### 7. Delete Instance

#### Steps:

1. Return to instance list page
2. Click Delete button on an instance
3. Verify confirmation dialog appears
4. Confirm deletion
5. Verify instance removed from list

#### Expected Results:

- [ ] Confirmation dialog shows before deletion
- [ ] Dialog explains what will be deleted
- [ ] Cancel button aborts deletion
- [ ] Confirm button completes deletion
- [ ] Instance immediately removed from UI
- [ ] No page reload required
- [ ] Deletion is permanent (refresh page to verify)

#### Test Variations:

- Cancel deletion
- Delete last instance (verify empty state)
- Delete multiple instances

---

### 8. Browser Navigation

#### Steps:

1. Create instance → opens viewer
2. Click browser back button
3. Verify returns to instance list
4. Click browser forward button
5. Verify returns to instance viewer
6. Use back button to navigate to home
7. Navigate forward through history

#### Expected Results:

- [ ] Back button returns to instance list
- [ ] Forward button returns to instance viewer
- [ ] Browser history works correctly
- [ ] No state loss during navigation
- [ ] URL updates correctly
- [ ] Page doesn't reload unnecessarily

---

### 9. Direct URL Access

#### Steps:

1. Copy UUID from viewer URL
2. Close tab or navigate away
3. Directly navigate to `/vibe/kanban-board/{uuid}`
4. Verify instance loads correctly

#### Expected Results:

- [ ] Direct URL access works
- [ ] Instance loads without error
- [ ] All functionality available

#### Test Invalid URLs:

- [ ] `/vibe/invalid-vibe-slug` → appropriate error/empty state
- [ ] `/vibe/kanban-board/invalid-uuid` → error handling
- [ ] `/vibe/kanban-board/uuid-from-different-vibe` → error or no data

---

### 10. Multiple Instances Management

#### Steps:

1. Create 5-10 instances with different descriptions
2. Verify all instances appear in list
3. Edit different instances
4. Open different instances in new tabs
5. Delete some instances
6. Verify list updates correctly

#### Expected Results:

- [ ] All instances display correctly
- [ ] Can manage multiple instances simultaneously
- [ ] List stays synchronized
- [ ] No conflicts or race conditions

---

### 11. Sharing Information Display

#### Steps:

1. Check sharing section on instance cards
2. Verify shows correct number of shared users
3. (If sharing implemented) Share with another user
4. Verify shared status updates

#### Expected Results:

- [ ] Sharing count displays correctly
- [ ] "Shared with X people" text accurate
- [ ] Empty state: "Not shared" or "Shared with 0 people"

**Note**: Full sharing functionality may not be implemented yet (see line 155 in useVibeInstances.ts).

---

### 12. Error Handling

#### Test Error Scenarios:

##### Database Errors:

1. Simulate database failure (disconnect internet briefly)
2. Try to create/update/delete instance
3. Verify error message shown to user

##### Iframe Loading Errors:

1. Navigate to instance with invalid data
2. Verify error overlay appears
3. Check retry button works
4. Verify error message is helpful

##### Permission Errors:

1. (If multi-user) Try to edit/delete another user's instance
2. Verify permission denied message

#### Expected Results:

- [ ] Errors don't crash the app
- [ ] Error messages are clear and actionable
- [ ] Retry mechanisms work
- [ ] User can recover from errors

---

### 13. Performance & UX

#### Check Performance:

- [ ] Page loads quickly (<1s)
- [ ] Instance creation is fast (<500ms)
- [ ] List updates are smooth (no flicker)
- [ ] Iframe loads in reasonable time (<2s)
- [ ] No memory leaks (create/delete 20+ instances)

#### Check UX:

- [ ] Loading states provide feedback
- [ ] Buttons have hover states
- [ ] Form validation is clear
- [ ] Success feedback (visual confirmation)
- [ ] Keyboard navigation works
- [ ] Responsive on mobile (if applicable)

---

### 14. Console & Network Inspection

#### Check Developer Tools:

##### Console Tab:

- [ ] No errors in production code
- [ ] No debug console.log statements
- [ ] No unhandled promise rejections
- [ ] No React warnings

##### Network Tab:

- [ ] Database operations complete successfully
- [ ] Iframe URL is correct Vibesbox domain
- [ ] No failed requests
- [ ] PostMessage events visible (if logging enabled)

##### Application Tab:

- [ ] Fireproof database: `vibes-diy-instances`
- [ ] Documents have correct structure
- [ ] localStorage has sync preferences (if applicable)

---

### 15. Multi-User Scenarios (If Auth Available)

#### Steps:

1. Log in as User A
2. Create instance
3. Log out and log in as User B
4. Navigate to same vibe instance list
5. Verify User B doesn't see User A's instances
6. (If sharing implemented) Share from User A to User B
7. Verify User B can now access shared instance

#### Expected Results:

- [ ] Instance ownership respected
- [ ] Permissions enforced
- [ ] Sharing works as expected

---

### 16. Integration with Existing Vibe Route

#### Potential Conflict Check:

The new routes may conflict with the existing `/vibe/:vibeSlug` route.

#### Steps:

1. Navigate to `/vibe/some-catalog-vibe`
2. Verify correct behavior (which route matches?)
3. Test both catalog viewing and instance management
4. Document any routing conflicts

#### Expected Behavior (TBD):

This needs clarification from the developer:

- Does `/vibe/kanban-board` show instances OR catalog?
- How does the router distinguish between catalog and instances?
- Should there be a different URL pattern?

**Note**: Lines 29-35 in routes.ts show potential conflict between:

- `route("vibe/:titleId/:uuid", ...)` - instance viewer
- `route("vibe/:titleId", ...)` - instance list
- `route("vibe/:vibeSlug", ...)` - existing catalog route

The first matching route will be used. Needs testing and possible refactoring.

---

## Test Data

### Sample Instance Descriptions:

- "My Work Board"
- "Personal Projects"
- "Team Collaboration Space"
- "Testing Instance 123"
- "🎨 Design Ideas" (with emoji)
- "Very long description with many characters that might overflow the UI or cause layout issues in the component display"

### Sample Vibe Slugs to Test:

- kanban-board
- todo-list
- chat-app
- image-gallery
- data-dashboard

---

## Automated Test Status (as of Nov 8, 2025)

### Unit/Browser Tests (useVibeInstances hook):

- **File**: `vibes.diy/tests/app/useVibeInstances.test.tsx`
- **Status**: 23/29 passing, 6 skipped
- **Notes**: Skipped cases are environment‑sensitive (browser timing and internal implementation details). Remaining items are marked for follow‑up but are not blockers for manual QA of routes.

### Component Tests:

- **Status**: Not yet created
- **Planned**: Instance list route, instance viewer route

---

## Known Issues & TODOs

From code analysis:

1. **Sharing API** (line 155 in useVibeInstances.ts):
   - TODO: Implement Fireproof share API integration
   - Currently only updates sharedWith array

2. **Console Logs** (lines 47, 59, 69 in vibe.$titleId.tsx):
   - Should be removed before production

3. **Route Conflict** (routes.ts):
   - Need to resolve conflict between new `/vibe/:titleId` and existing `/vibe/:vibeSlug`
   - Consider different URL patterns

4. **Test Status**:
   - 23/29 passing with 6 skipped in the hook suite
   - Skips are intentional due to browser env timing; track in the test file comments

---

## Success Criteria

For this feature to be considered production-ready:

- [ ] All manual test scenarios pass
- [ ] No console errors in normal usage
- [ ] Performance is acceptable (<2s load times)
- [ ] Error handling is robust
- [ ] Route conflict resolved (if any)
- [ ] Automated tests pass (>80% coverage)
- [ ] Code review complete
- [ ] Debug console.log statements removed
- [ ] Sharing functionality implemented (or marked as future work)

---

## Testing Checklist Summary

Use this quick checklist to verify all major functionality:

- [ ] Can access instance list page
- [ ] Can create new instance
- [ ] Can view instance list
- [ ] Can edit instance description
- [ ] Can open instance in viewer
- [ ] Can view instance in iframe
- [ ] Can delete instance
- [ ] Browser back/forward works
- [ ] Direct URL access works
- [ ] Can manage multiple instances
- [ ] Error handling works
- [ ] No console errors
- [ ] Performance is good
- [ ] Route conflict resolved (if needed)

---

## Reporting Issues

When reporting issues, please include:

1. **URL** where issue occurred
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Console errors** (if any)
6. **Browser** and version
7. **Screenshots** (if applicable)

---

## Next Steps After Testing

1. Fix any identified bugs
2. Debug failing unit tests
3. Create component tests
4. Remove debug console.log statements
5. Resolve route conflict (if needed)
6. Implement sharing API integration
7. Run `pnpm check` before committing
8. Create pull request with test results

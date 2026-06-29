#!/usr/bin/env bash
cd "$(dirname "$0")"
: > _status.log

USER_SLUG="og"
gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "hvac-install-check" "poster" "HVAC install commissioning checklist. Fields: equipment model, serial number, each commissioning step with checkboxes, customer info, and a final sign-off summary. Designed for a tech on a jobsite."
gen "electrical-punch-log" "proof" "Electrical punch list tracker. Rooms as sections. Each item: location, description, status (open/in progress/done), and who's responsible. Designed for trim-out phase to closeout."
gen "plumbing-service-form" "broadsheet" "Plumbing service call form. Capture: customer name, address, problem description, parts used with quantity, labor notes, and a customer-facing summary to share after the visit."
gen "permit-status-tracker" "vault" "Permit and inspection tracker for a job. Fields: jurisdiction, permit type, required documents checklist, submission date, status, inspector notes, and next action."
gen "materials-order-builder" "terminal" "Materials and parts list builder per job type. Select job type, then build a standard parts list. Add job-specific extras. Export a clean list for the supply run."

wait
echo "ALL DONE" >> _status.log

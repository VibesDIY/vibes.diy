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

gen "intake-lot-logger" "terminal" "Electronics parts intake log. Log incoming lots: supplier, date received, MPN/SKU, quantity, condition, photos, bin assignment, QC status. Each lot gets a record."
gen "qc-inspection-form" "proof" "Quality control inspection form for electronics parts. Part number, condition checklist (visual, functional, accessories), pass/fail decision, notes, and inspector sign-off."
gen "parts-bin-locator" "vault" "Parts bin location tracker. SKU/MPN, description, quantity on hand, aisle, shelf, bin number. Searchable. Update quantity when picking or restocking."
gen "pick-pack-verify" "poster" "Pick and pack verification checklist for orders. Order ID, items to pick with bin locations, each item checkboxes, a photo confirmation step, and ready-to-ship sign-off."
gen "rma-returns-log" "capsule" "RMA and returns tracker for electronics parts. Order ID, return reason, condition on arrival, restock or quarantine decision, refurb notes, refund status."

wait
echo "ALL DONE" >> _status.log

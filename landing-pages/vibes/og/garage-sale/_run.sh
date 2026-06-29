#!/usr/bin/env bash
set -euo pipefail
USER_SLUG="og"
cd "$(dirname "$0")"
> _status.log

gen() {
  local slug="$1"; local prompt="$2"
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "group-sale-signup" "Neighborhood garage sale coordinator. Organizer sets date, address, neighborhood name. Neighbors sign up: name, spot type (table/blanket), item categories (clothes/toys/tools/misc), needs-change flag. Shows live participant list and spot count. Shared link, no login."

gen "yard-sale-listing" "Yard sale listing. Seller enters address, date, hours, item categories. Each listing stored with Fireproof doc._id. Parse ?listing= from URL on load; if present, show that sale as a shareable card with Google Maps link. If absent, show create form. No login."

gen "rate-my-thrift" "Thrift find sharing app. Post a find: photo (base64 upload), item name, price paid, where found, one-line brag. Store each find as a Fireproof document. On mount, read window.location.search for ?item= param; if present, fetch that doc by _id and show it in full-screen hero view with four emoji reaction buttons: 🔥 steal, 💎 gem, 😬 overpaid, 🤌 perfect — each reaction stored as a Fireproof doc linked to the item _id, counts shown in real time. Below hero show a 'Share this find' button that copies the current URL with ?item=<doc._id> appended. If no ?item= param on load, show the community feed of all finds sorted by newest first, with a 'Post your find' CTA at top. Dark background, photo-forward layout."

gen "sale-day-checklist" "Garage sale gear tracker. Shared list: folding tables, chairs, extension cords, price sticker rolls, grocery bags, poster board + markers, cash box — each with quantity needed. Neighbors enter name and quantity they can bring, claiming items. Shows unclaimed quantities. Shared link, no login."

gen "cash-box-tracker" "Multi-seller garage sale cash tracker. Sellers register name at start. Record transactions: seller name, item description, amount. Running total per seller shown live. End-of-day summary shows each seller's total. Shared link, no login."

wait
echo "ALL DONE" >> _status.log

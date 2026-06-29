#!/usr/bin/env bash

# Verify deployed apps for policy-analysis-decision-modeling cluster
echo "Verifying policy-analysis-decision-modeling apps..."
echo

for slug in cba-practice policy-capstone-workspace regulatory-analysis-workflow major-rule-analysis rulemaking-review; do
  url="https://${slug}--edu.prod-v2.vibesdiy.net/"
  echo "Checking $slug..."
  status=$(curl -sL "$url" | grep -E '"fsId"' | head -1)

  if echo "$status" | grep -q '"fsId":"z'; then
    echo "  Status: LIVE (has fsId)"
  elif echo "$status" | grep -q '"fsId":"pending'; then
    echo "  Status: PENDING"
  else
    echo "  Status: FAILED or NO RESPONSE"
    echo "  Response: $status"
  fi
done

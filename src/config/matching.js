const MATCH_WEIGHTS = Object.freeze({
  description: 0.35,
  category: 0.25,
  color: 0.15,
  location: 0.15,
  date: 0.10
});

const MATCH_THRESHOLDS = Object.freeze({
  minimum: 60,
  high: 80
});

const ELIGIBLE_REPORT_STATUSES = Object.freeze([
  "OPEN",
  "MATCHED",
  "CLAIM_IN_PROGRESS"
]);

module.exports = {
  ELIGIBLE_REPORT_STATUSES,
  MATCH_THRESHOLDS,
  MATCH_WEIGHTS
};


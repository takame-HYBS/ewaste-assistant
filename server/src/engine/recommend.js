// Transparent, rule-based recommendation engine.
//
// Design goals (from the project brief):
//  - Explainable: every point added or removed is recorded with a plain-language reason.
//  - Not overconfident: confidence is capped when key inputs are missing, and nothing here
//    claims to diagnose internal hardware faults. Output is guidance, not a repair assessment.
//  - Safe: hazard rules (e.g. swollen battery) override scoring and never produce DIY advice.
//
// The engine is a pure function: same input -> same output. It does no I/O.

export const ENGINE_VERSION = '1.0.0';

export const ACTIONS = ['reuse', 'repair', 'donate', 'parts_recovery', 'recycle']; // also tie-break order

// ---------------------------------------------------------------------------------------
// Tunable data. These are PLACEHOLDER figures (Philippine pesos) so the app works out of the
// box. Replace them with real local repair-shop pricing before relying on the cost rules.
// ---------------------------------------------------------------------------------------
export const CATEGORY_DEFAULTS = {
  phone:      { newPrice: 15000, lifespan: 4, repair: { screen: 3500, battery: 1500, water: 4000, other: 3000 } },
  laptop:     { newPrice: 35000, lifespan: 6, repair: { screen: 6000, battery: 3000, water: 8000, other: 5000 } },
  tablet:     { newPrice: 18000, lifespan: 5, repair: { screen: 4000, battery: 2000, water: 5000, other: 3500 } },
  peripheral: { newPrice: 2500,  lifespan: 5, repair: { screen: 800,  battery: 500,  water: 800,  other: 700 } },
};
const GENERIC = { newPrice: 5000, lifespan: 5, repair: { screen: 1500, battery: 800, water: 2000, other: 1500 } };

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const yes = (v) => v === true || v === 'yes' || v === 'true';
const no = (v) => v === false || v === 'no' || v === 'false';

/**
 * @param {object} input
 * @param {string} input.category        category key, e.g. 'phone'
 * @param {number} input.ageYears
 * @param {string} input.condition       working | minor_issues | major_issues | not_working
 * @param {number} [input.lifespanYears] overrides the category default (from the DB category row)
 * @param {object} [input.answers]       questionnaire answers (see ANSWER_KEYS in README)
 */
export function recommend(input) {
  const answers = input.answers || {};
  const defaults = CATEGORY_DEFAULTS[input.category] || GENERIC;
  const lifespan = num(input.lifespanYears) || defaults.lifespan;
  const age = Math.max(0, num(input.ageYears) ?? 0);
  const condition = input.condition;

  const scores = Object.fromEntries(ACTIONS.map((a) => [a, 0]));
  const explanation = [];
  const safetyNotes = [];
  const missing = [];
  let override = null;

  const add = (action, points, rule, text) => {
    scores[action] += points;
    explanation.push({ rule, action, points, text });
  };

  // ---- Derived figures -------------------------------------------------------------
  const currentValue = Math.round(defaults.newPrice * Math.max(0.1, 1 - age / (lifespan * 1.5)));

  // Cosmetic-only damage means nothing functional needs fixing, so repair economics don't apply.
  const cosmeticOnly = condition === 'minor_issues' && yes(answers.cosmetic_only);
  const needsRepairCost = condition !== 'working' && !cosmeticOnly;

  const userQuote = num(answers.repair_quote);
  let repairCost = null;
  let repairCostSource = null;
  if (userQuote !== null && userQuote >= 0) {
    repairCost = userQuote;
    repairCostSource = 'user_quote';
  } else if (needsRepairCost) {
    const kind = answers.screen_damage === 'cracked' || answers.screen_damage === 'dead' ? 'screen'
      : yes(answers.water_damage) ? 'water'
      : answers.battery_health === 'poor' && condition === 'minor_issues' ? 'battery'
      : 'other';
    repairCost = defaults.repair[kind];
    repairCostSource = 'rough_estimate';
  }
  const ratio = repairCost !== null && currentValue > 0 ? repairCost / currentValue : null;

  if (repairCostSource !== 'user_quote' && needsRepairCost) {
    missing.push('repair_quote');
  }
  if (answers.powers_on === undefined && condition !== 'working') missing.push('powers_on');

  // ---- Rule 1: safety overrides (checked before any scoring) -----------------------
  if (yes(answers.battery_swollen)) {
    override = 'recycle';
    safetyNotes.push(
      'A swollen or bulging battery is a fire hazard. Stop charging and using the device, keep it away from heat and ' +
      'flammable items, do not puncture or press on it, and take it to a qualified technician or an e-waste collection ' +
      'point that accepts batteries. Do not try to remove or replace the battery yourself.'
    );
    explanation.push({
      rule: 'safety.swollen_battery', action: 'recycle', points: null,
      text: 'You reported a swollen battery, so safe handling comes first. Recycling through a proper collection point is ' +
            'the safest default; a qualified shop may be able to replace the battery if you want the device back.',
    });
  }
  if (yes(answers.water_damage)) {
    safetyNotes.push(
      'Liquid damage can cause hidden corrosion and battery faults. If the device is off, leave it off and do not try to ' +
      'charge it; have a qualified technician inspect it before further use.'
    );
  }
  if (yes(answers.has_personal_data)) {
    safetyNotes.push(
      'Back up and securely erase personal data (factory reset, sign out of accounts) before donating, repairing or ' +
      'recycling. If the device will not power on, tell the repair or recycling partner so they can handle storage securely.'
    );
  }

  // ---- Rule 2: condition baselines --------------------------------------------------
  if (condition === 'working') {
    if (no(answers.still_needed)) {
      add('donate', 4, 'condition.working_not_needed', 'The device works and you no longer need it, so someone else can use it.');
      add('reuse', 1, 'condition.working_not_needed', 'Keeping it as a backup is possible but less useful if you do not need it.');
    } else {
      add('reuse', 5, 'condition.working_needed', 'The device works, so continued use is the most resource-efficient option.');
      add('donate', 1, 'condition.working_needed', 'Donating remains an option if you upgrade later.');
    }
    if (answers.battery_health === 'poor') {
      add('repair', 2, 'battery.poor_but_working', 'Weak battery on an otherwise working device: a professional battery replacement is often worthwhile.');
    }
  } else if (condition === 'minor_issues') {
    add('repair', 3, 'condition.minor', 'Minor issues are often inexpensive to fix.');
    add('reuse', 1, 'condition.minor', 'You may be able to keep using it as is.');
    add('donate', 1, 'condition.minor', 'It may still be useful to someone else once fixed or wiped.');
  } else if (condition === 'major_issues') {
    add('repair', 1, 'condition.major', 'Major issues can sometimes be repaired, but cost and parts availability matter.');
    add('parts_recovery', 1, 'condition.major', 'Working components may still be recoverable.');
    add('recycle', 1, 'condition.major', 'Recycling is the fallback if repair is not practical.');
  } else if (condition === 'not_working') {
    add('parts_recovery', 1, 'condition.not_working', 'A non-working device may still contain reusable components.');
    add('recycle', 2, 'condition.not_working', 'A device that does not work and is not worth fixing should be recycled properly.');
    if (answers.powers_on === 'sometimes') {
      add('repair', 1, 'power.intermittent', 'The device powers on sometimes, which can point to a fixable fault; a technician can tell you more.');
    }
  }

  // ---- Rule 3: repair economics (only when the device needs repair) -----------------
  if (needsRepairCost && ratio !== null) {
    const pct = Math.round(ratio * 100);
    const basis = repairCostSource === 'user_quote' ? 'your quote' : 'a rough estimate';
    if (ratio <= 0.5) {
      add('repair', 3, 'cost.cheap', `Repair cost (${basis}) is about ${pct}% of the device's estimated current value, which usually makes repair worthwhile.`);
    } else if (ratio <= 0.8) {
      add('repair', 1, 'cost.borderline', `Repair cost (${basis}) is about ${pct}% of the device's estimated value: borderline, so compare with replacement.`);
    } else {
      add('repair', -3, 'cost.expensive', `Repair cost (${basis}) is about ${pct}% of the device's estimated value, so repair is unlikely to pay off.`);
      add('parts_recovery', 2, 'cost.expensive', 'When repair does not pay off, recovering parts keeps value in circulation.');
      add('recycle', 2, 'cost.expensive', 'Proper recycling is the responsible alternative.');
    }
  }

  // ---- Rule 4: age vs. typical lifespan ---------------------------------------------
  if (age >= lifespan * 1.5) {
    add('repair', -2, 'age.very_old', `At ${age} years the device is well past the typical ~${lifespan}-year lifespan; parts and software support may be limited.`);
    add('recycle', 2, 'age.very_old', 'End-of-life devices are best recycled responsibly.');
  } else if (age >= lifespan) {
    add('repair', -1, 'age.old', `The device is at or beyond the typical ~${lifespan}-year lifespan, so repairs carry more risk.`);
    add('recycle', 1, 'age.old', 'Recycling becomes more appropriate as devices reach end of life.');
  }

  // ---- Rule 5: software support (phones, laptops, tablets) --------------------------
  if (no(answers.software_supported)) {
    if (condition === 'working') {
      add('donate', -1, 'software.unsupported', 'Without security updates, the device is a poor candidate for handing to someone else.');
      add('recycle', 1, 'software.unsupported', 'Devices that no longer receive security updates are better retired.');
    } else {
      add('repair', -1, 'software.unsupported', 'No security updates available: even after repair, the device would be risky to use online.');
      add('recycle', 1, 'software.unsupported', 'Devices that no longer receive security updates are better retired.');
    }
  }

  // ---- Rule 6: water damage and parts value ----------------------------------------
  if (yes(answers.water_damage)) {
    add('repair', -1, 'water.damage', 'Liquid damage often causes further faults later, which lowers the odds of a lasting repair.');
    add('parts_recovery', 1, 'water.damage', 'Undamaged components such as the screen or storage may still be recoverable.');
  }
  if (['laptop', 'tablet', 'phone'].includes(input.category) && ['major_issues', 'not_working'].includes(condition)) {
    add('parts_recovery', 1, 'parts.valuable_category', 'Phones, laptops and tablets usually contain components worth recovering.');
  }
  if (input.category === 'peripheral' && ['major_issues', 'not_working'].includes(condition)) {
    add('recycle', 1, 'parts.low_value', 'Small peripherals rarely justify repair; recycling recovers their materials.');
  }

  // ---- Rule 7: cosmetic-only damage on a working device -----------------------------
  if (cosmeticOnly) {
    add('reuse', 3, 'condition.cosmetic', 'Only cosmetic damage was reported, so the device can keep working as it is.');
    add('repair', -1, 'condition.cosmetic', 'Cosmetic damage rarely needs repair.');
  }

  // ---- Rule 8: unwanted device that is repairable -> donate once fixed --------------
  if (condition !== 'working' && no(answers.still_needed) && ratio !== null && ratio <= 0.5) {
    add('donate', 2, 'donate.repair_first', 'You no longer need it, and it is cheap to fix: a repair-then-donate path may help someone else.');
  }

  // ---- Pick a winner ----------------------------------------------------------------
  const ranking = ACTIONS
    .map((action, order) => ({ action, score: scores[action], order }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ action, score }) => ({ action, score }));

  let top = override || ranking[0].action;
  const margin = override ? null : ranking[0].score - ranking[1].score;

  // Confidence: honest about uncertainty. Missing key inputs cap it, ties lower it.
  let confidence;
  if (override) confidence = 'high';
  else if (margin >= 4) confidence = 'high';
  else if (margin >= 2) confidence = 'medium';
  else confidence = 'low';
  if (missing.length > 0 && confidence === 'high') confidence = 'medium';
  if (condition !== 'working' && repairCostSource !== 'user_quote' && confidence === 'high') confidence = 'medium';

  // If safety forced the result, reflect that in the ranking shown to the user.
  const finalRanking = override
    ? [{ action: override, score: null }, ...ranking.filter((r) => r.action !== override)]
    : ranking;

  const nextSteps = NEXT_STEPS[top] || [];

  return {
    engineVersion: ENGINE_VERSION,
    action: top,
    confidence,
    ranking: finalRanking,
    explanation,
    safetyNotes,
    nextSteps,
    repairCost,
    repairCostSource,
    currentValue,
    missingInputs: missing,
    disclaimer:
      'This is general guidance based on what you told us, not a diagnosis of the device. A qualified technician should ' +
      'confirm any repair decision, especially for batteries, power supplies, or liquid damage.',
  };
}

export const NEXT_STEPS = {
  reuse: [
    'Keep using the device; consider a case, screen protector or a battery check to extend its life.',
    'Back up your data regularly.',
  ],
  repair: [
    'Get a written quote from a qualified repair shop before committing.',
    'Ask about warranty on the repair and whether original or compatible parts are used.',
    'Back up and erase personal data first if the device will be left with the shop and it still powers on.',
  ],
  donate: [
    'Back up and factory-reset the device, and sign out of all accounts.',
    'Include the charger and any accessories.',
    'Contact the donation point first to confirm they accept this type of device.',
  ],
  parts_recovery: [
    'Ask a repair shop or refurbisher whether they buy or accept devices for parts.',
    'Remove personal data if the device still powers on.',
    'If nobody takes it for parts, use an authorised e-waste collection point.',
  ],
  recycle: [
    'Take the device to an authorised e-waste collection point; do not put it in household trash.',
    'Remove personal data first if the device powers on.',
    'Tell the collector if the battery is damaged or swollen so it can be handled separately.',
  ],
};

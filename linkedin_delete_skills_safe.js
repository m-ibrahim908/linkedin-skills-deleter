(() => {

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const log   = msg => console.log(`[SkillDeleter] ${msg}`);
const sleep = ms  => new Promise(r => setTimeout(r, ms));

function waitFor(fn, timeoutMs = DELAYS.waitForTimeout, intervalMs = DELAYS.waitForPollInterval) {
  return new Promise(resolve => {
    const iv = setInterval(() => {
      if (fn()) { clearInterval(iv); resolve(true); }
    }, intervalMs);
    setTimeout(() => { clearInterval(iv); resolve(false); }, timeoutMs);
  });
}

// ─── HUMAN-LIKE CLICK ────────────────────────────────────────────────────────
// Simulates mouse movement to element before clicking

async function humanClick(el) {
  // Step 1: Scroll element into view naturally
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(80 + Math.random() * 120); // brief pause after scroll like a human reading

  const rect = el.getBoundingClientRect();
  // Step 2: Target a random point within element (not dead center)
  const x = rect.left + rect.width  * (0.3 + Math.random() * 0.4);
  const y = rect.top  + rect.height * (0.3 + Math.random() * 0.4);
  const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };

  // Step 3: Simulate mouse approaching the element
  el.dispatchEvent(new MouseEvent('mouseover',  opts));
  el.dispatchEvent(new MouseEvent('mouseenter', opts));
  el.dispatchEvent(new MouseEvent('mousemove',  opts));

  // Step 4: Focus the element (tab navigation signal)
  try { el.focus({ preventScroll: true }); } catch(e) {}

  await sleep(30 + Math.random() * 80); // tiny pause between hover and click

  // Step 5: Full click sequence
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  await sleep(30 + Math.random() * 50); // humans don't release instantly
  el.dispatchEvent(new MouseEvent('mouseup',   opts));
  el.click();

  // Step 6: Mouse leaves element after click
  el.dispatchEvent(new MouseEvent('mouseleave', opts));
  el.dispatchEvent(new MouseEvent('mouseout',   opts));
}

// ─── PART 1: COLLECT SKILL LINKS FROM PROFILE PAGE ───────────────────────────
// Confirmed: profile page has all 94 skill edit links

function collectSkillLinks() {
  const skills = [];
  const seen = new Set();
  Array.from(document.querySelectorAll('a[aria-label]'))
    .filter(el => el.getAttribute('aria-label')?.match(/^Edit .+ skill$/))
    .forEach(el => {
      const match = el.getAttribute('aria-label').match(/^Edit (.+) skill$/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        skills.push({ skillName: match[1], url: el.href, element: el });
      }
    });
  return skills;
}

// ─── PART 2: COLLECT ASSOCIATIONS FROM PROFILE PAGE DOM ──────────────────────
// Confirmed: skill card (5 levels up from skill name span) contains associations

function collectAssociations(skillNames) {
  const assocMap = {};
  const skillSet = new Set(skillNames);

  document.querySelectorAll('span').forEach(el => {
    if (el.children.length !== 0) return;
    if (el.parentElement.tagName !== 'P') return;
    const skillName = el.innerText.trim();
    if (!skillSet.has(skillName)) return;

    const card = el.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
    if (!card) return;

    const associations = card.innerText.trim().split(/\r?\n/).map(l => l.trim()).filter(l =>
      l &&
      l !== skillName &&
      !skillSet.has(l) &&
      !/^\d+ endorsement/i.test(l) &&
      l !== 'Edit' &&
      !l.includes('|')
    );

    if (associations.length > 0) assocMap[skillName] = associations;
  });

  return assocMap;
}

// ─── PART 3: CHECK ENDORSEMENT VIA FETCH ─────────────────────────────────────
// Confirmed: endorsed skills have "endorsers" 2+ times in raw HTML

async function isEndorsed(url) {
  try {
    const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'text/html' } });
    if (!r.ok) return false;
    const html = await r.text();
    return (html.match(/endorsers/g) || []).length >= 2;
  } catch { return false; }
}

// ─── PART 4: BUILD TABLE ──────────────────────────────────────────────────────

async function buildTable(skills, assocMap) {
  const table = [];
  for (const { skillName, url, element } of skills) {
    log(`Scanning: "${skillName}"`);
    const endorsed    = await isEndorsed(url);
    const associations = assocMap[skillName] || [];
    const hasAssoc    = associations.length > 0;
    const blocked     = (endorsed && !CONFIG.deleteEndorsed) || (hasAssoc && !CONFIG.deleteAssociated);
    table.push({ skillName, url, element, endorsed, associations, hasAssoc, shouldDelete: !blocked });
    log(`  endorsed=${endorsed} associated=${hasAssoc} shouldDelete=${!blocked}`);
    await sleep(DELAYS.fetchInterval + Math.random() * 150);
  }
  return table;
}

// ─── PART 5: DELETE ON PROFILE PAGE ──────────────────────────────────────────
// Confirmed: clicking edit link on profile page opens dialog-content in main DOM
// with Delete skill button — no navigation, no iframe needed

async function deleteSkill(skillName, editElement) {
  // Re-query the element fresh — stored reference may be stale after fetch calls
  const freshElement = Array.from(document.querySelectorAll('a[aria-label]'))
    .find(el => el.getAttribute('aria-label') === `Edit ${skillName} skill`);
  if (!freshElement) { log(`  ⚠️  Could not find edit link for "${skillName}"`); return false; }

  // Click the edit link — this opens dialog-content briefly during navigation
  humanClick(freshElement);

  // Poll aggressively for Delete skill button — it appears during the navigation transition
  // We must click it before the page fully navigates away
  let deleteBtn = null;
  const btnFound = await new Promise(resolve => {
    const iv = setInterval(() => {
      const scope = document.querySelector('[data-testid="dialog-content"]');
      const btn = scope && Array.from(scope.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Delete skill');
      if (btn) { clearInterval(iv); deleteBtn = btn; resolve(true); }
    }, 100); // check every 100ms
    setTimeout(() => { clearInterval(iv); resolve(false); }, 8000);
  });

  if (!btnFound || !deleteBtn) { log(`  ⚠️  No Delete skill button`); return false; }

  deleteBtn.click();
  await sleep(200);

  // Wait for and click confirm Delete button
  const confirmAppeared = await waitFor(
    () => !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Delete'),
    8000
  );
  if (!confirmAppeared) { log(`  ⚠️  Confirm button never appeared`); return false; }

  humanClick(Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Delete'));

  // Wait for success toast
  // Use MutationObserver to catch the toast the instant it appears
  // (toast lasts < 1 second so polling misses it)
  const success = await new Promise(resolve => {
    let resolved = false;
    const done = (val) => { if (!resolved) { resolved = true; observer.disconnect(); resolve(val); } };

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            // Check the node itself and all its descendants
            const all = [node, ...node.querySelectorAll('*')];
            for (const el of all) {
              if (el.textContent.trim() === 'Deletion was successful.') {
                done(true);
                return;
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => done(false), DELAYS.toastTimeout);
  });

  // Wait for dialog to close before next skill
  await waitFor(() => !document.querySelector('[data-testid="dialog-content"]') && !document.querySelector('dialog'), 3000);
  await sleep(DELAYS.afterDialogClose + Math.random() * 400);

  return success;
}

// ─── PART 6: SUMMARY ──────────────────────────────────────────────────────────

function printSummary(table, live) {
  const toDelete   = table.filter(r => r.shouldDelete);
  const skipEnd    = table.filter(r => r.endorsed && !CONFIG.deleteEndorsed);
  const skipAssoc  = table.filter(r => r.hasAssoc && !CONFIG.deleteAssociated);
  const deleted    = table.filter(r => r.deleted);
  const failed     = table.filter(r => r.deleteFailed);
  const associated = table.filter(r => r.associations?.length > 0);
  const color      = live ? '#057642' : '#0a66c2';
  const title      = live ? 'LIVE RUN SUMMARY' : 'DRY RUN SUMMARY (no deletions occurred)';

  // Build association map: assoc → [skills]
  const byAssoc = {};
  associated.forEach(r => {
    r.associations.forEach(assoc => {
      if (!byAssoc[assoc]) byAssoc[assoc] = [];
      byAssoc[assoc].push(r.skillName);
    });
  });
  const assocLines = Object.entries(byAssoc)
    .map(([assoc, skills]) => `${assoc}:\n      · ${skills.join('\n      · ')}`);

  console.log(
    `%c ${title} %c\n\n` +
    (live
      ? `✅ Deleted:              ${deleted.length}\n⚠️  Failed:               ${failed.length}\n`
      : `🗑️  Would delete:        ${toDelete.length}\n`) +
    `⏭️  Skip (endorsed):      ${skipEnd.length}\n` +
    `🔗 Skip (associated):    ${skipAssoc.length}\n\n` +
    (!live && toDelete.length  ? `Will delete:\n  - ${toDelete.map(r => r.skillName).join('\n  - ')}\n\n` : '') +
    (live  && deleted.length   ? `Deleted:\n  - ${deleted.map(r => r.skillName).join('\n  - ')}\n\n` : '') +
    (live  && failed.length    ? `Failed:\n  - ${failed.map(r => r.skillName).join('\n  - ')}\n\n` : '') +
    (skipEnd.length            ? `Endorsed (kept):\n  - ${skipEnd.map(r => r.skillName).join('\n  - ')}\n\n` : '') +
    (skipAssoc.length          ? `Associated (kept):\n  - ${skipAssoc.map(r => r.skillName).join('\n  - ')}\n\n` : '') +
    (assocLines.length
      ? (CONFIG.deleteAssociated
          ? `Associated Skills (Deleted):\n  - ${assocLines.join('\n  - ')}\n\n`
          : `Associated Skills (Kept):\n  - ${assocLines.join('\n  - ')}\n\n`)
      : '') +
    (!live ? '👉 To run for real: change dryRun to false and run again.' : ''),
    `background:${color};color:#fff;font-size:15px;font-weight:bold;padding:4px 8px;`,
    'background:#fff;color:#000;font-size:13px;'
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function run() {
  if (!window.location.href.includes('/in/')) {
    log('⚠️  Run this on your LinkedIn profile page: linkedin.com/in/m-ibrahim2094/');
    return;
  }

  log(`=== LinkedIn Skill Deleter — ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE'} ===`);
  log(`deleteEndorsed: ${CONFIG.deleteEndorsed} | deleteAssociated: ${CONFIG.deleteAssociated}`);

  const allSkills = collectSkillLinks();
  const skills    = allSkills.slice(0, CONFIG.count ?? allSkills.length);
  log(`Found ${allSkills.length} skills. Processing ${skills.length}...`);

  if (skills.length === 0) { log('No skills found — make sure page is fully loaded.'); return; }

  // Collect associations from live DOM
  const assocMap = collectAssociations(allSkills.map(s => s.skillName));
  log(`Found associations for ${Object.keys(assocMap).length} skill(s)`);

  // Build table via fetch (endorsement) + DOM (associations)
  const table = await buildTable(skills, assocMap);

  if (CONFIG.dryRun) {
    printSummary(table, false);
    return;
  }

  // Execute deletions on profile page — no navigation, no iframes
  log('Scan complete. Executing deletions...');
  let consecutiveFails = 0;
  const CONSECUTIVE_FAIL_LIMIT = DELAYS.consecutiveFailLimit;

  for (const row of table) {
    if (!row.shouldDelete) continue;
    log(`Deleting: "${row.skillName}"`);
    const success  = await deleteSkill(row.skillName, row.element);
    row.deleted     = success;
    row.deleteFailed = !success;

    if (success) {
      consecutiveFails = 0; // reset on success
      log(`✅ Deleted "${row.skillName}"`);
    } else {
      consecutiveFails++;
      log(`⚠️  Failed  "${row.skillName}" (${consecutiveFails} consecutive fail${consecutiveFails > 1 ? 's' : ''})`);
      if (consecutiveFails >= CONSECUTIVE_FAIL_LIMIT) {
        log('');
        log('🚨 STOPPING — 3 consecutive failures detected.');
        log('   LinkedIn may have triggered a CAPTCHA or rate limit.');
        log('   Check your browser tab — complete any CAPTCHA manually,');
        log('   then wait 10–15 minutes before running again.');
        log('');
        break;
      }
    }

    await sleep(DELAYS.betweenSkills + Math.random() * DELAYS.betweenSkillsJitter);
  }

  printSummary(table, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// ───────── CONFIG ─────────

// DEVELOPER CONFIG

const DELAYS = {
  afterClickDelete:   200,  // ms after clicking Delete skill button before looking for confirm
  afterDialogClose:   200,  // ms after dialog closes before moving to next skill
  betweenSkills:      500,  // ms base delay between each skill deletion
  betweenSkillsJitter:2000, // ms random extra added to betweenSkills (actual = base + random * jitter)
  fetchInterval:      100,  // ms between endorsement fetch calls during scan
  waitForPollInterval:300,  // ms between each DOM poll in waitFor()
  waitForTimeout:   10000,  // ms max wait for any DOM element to appear
  toastTimeout:     15000,  // ms max wait for success toast after confirming delete
  consecutiveFailLimit: 3  // stop if this many deletions fail in a row (likely bot detection)
};


// ─────────────────────────────────────────────────────────────────────────────
// USER CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  dryRun:           true,  // true = build table only, no deletion. When set to false deletion will happen and all skills will be displayed after deletion in summary
  deleteEndorsed:   false, // true = also delete endorsed skills
  deleteAssociated: false, // true = also delete skills tied to experience/education
  count:            10     // number of skills to process — set to null to run all
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

run(); // do not edit below this line

})();

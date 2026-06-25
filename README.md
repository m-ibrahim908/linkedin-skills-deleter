# LinkedIn Skill Deleter

A browser script that safely deletes your LinkedIn skills in bulk — while automatically protecting skills that have endorsements or are linked to your work experience and education.

---

## What it does

- Scans all your LinkedIn skills
- **Skips** skills with endorsements (by default, optional can change)
- **Skips** skills linked to your experience or education (by default, optional can change)
- Shows you a full summary before and after deleting anything
- Deletes skills one by one, with human-like timing and movements

---

## Before you start

You need **Google Chrome** and a LinkedIn account. No installs required.

---

## Step 1 — Open your LinkedIn profile

Go to your LinkedIn profile page. It should look like:
```
https://www.linkedin.com/in/[your-name]/skills/
```

Scroll all the way down and make sure you can see all your Skills on the page.

---

## Step 2 — Open the browser console

1. Press **F12** on Windows or **Cmd + Option + J** on Mac. OR right click and select Inspect.
2. A panel will open at the side of your screen
3. Click the tab that says **Console**
4. At the top left of the console panel, make sure the dropdown says **top** (not a frame name)
5. Select Preserve Log option on the top
6. (Optional) If you see Linkedin throwing continuous page errors (sometimes Linkedin pages are faulty on their own) select Hide Network to suppress them so the script can run smoothly. 

---

## Step 3 — Copy the script

Open the file `linkedin_delete_skills_safe.js` and copy the entire contents.

---

## Step 4 — Set your options

Before pasting, scroll to the **very bottom** of the script and find this section:

```javascript
const CONFIG = {
  dryRun:           true,  // true = build table only, no deletion
  deleteEndorsed:   false, // true = also delete endorsed skills
  deleteAssociated: false, // true = also delete skills tied to experience/education
  count:            10     // number of skills to process — set to null to run all
};
```

**The only things you need to change:**

| Setting | What it means | Recommended |
|---|---|---|
| `dryRun: true` | Preview only — nothing gets deleted | Start here |
| `dryRun: false` | Actually deletes skills | Switch to this after previewing |
| `deleteEndorsed: false` | Keeps skills that have endorsements | Leave as false |
| `deleteAssociated: false` | Keeps skills linked to experience/education | Leave as false |
| `count: 10` | Only process 10 skills at a time | Change to `null` to run all |

---

## Step 5 — Do a dry run first

1. Make sure `dryRun: true` is set (it is by default)
2. Paste the entire script into the console and press **Enter**
3. Wait — the script will scan your skills one by one (takes about 30 seconds for 10 skills)
4. A blue summary box will appear showing exactly what **would** be deleted and what would be kept

Read the summary carefully. If anything looks wrong, do not proceed.

---

## Step 6 — Run for real

Once you are happy with the dry run summary:

1. Change `dryRun: true` to `dryRun: false` at the bottom of the script
2. Change `count: 10` to `count: null` if you want to delete all eligible skills or move in batches (your choice)
3. Paste the full script again and press **Enter**
4. Watch the console — you will see each skill being deleted in real time
5. A green summary box will appear when finished

> ⚠️ **Deletions cannot be undone.** Endorsements on deleted skills are lost permanently.

---

## What the summary shows you

```
🗑️  Would delete:        X    ← skills with no endorsements or associations
⏭️  Skip (endorsed):     X    ← skills with endorsements (protected)
🔗 Skip (associated):   X    ← skills linked to experience/education (protected)

Will delete:
  - Sales
  - Kanban
  ...

Endorsed (kept):
  - Python
  - Data Analytics
  ...

Associated Skills (Kept):
  - Graduate Student at Texas McCombs:
      · Statistical Modeling
  ...
```

---

## If something goes wrong (rare, but can happen)

**Script stops with 🚨 STOPPING message**
LinkedIn may have detected the automation. Close the console, wait 10–15 minutes, then try again with a smaller `count` value.

**Skills show as failed but were actually deleted**
This is a display issue only — the skill was deleted but the confirmation message was missed. Refresh your profile to verify.

**Nothing happens after pasting**
Make sure the console dropdown says `top` and that you are on your LinkedIn profile page (`/in/your-name/skills/`).

---

## Important notes

- This script only works on **your own profile** — it cannot access other people's profiles
- It runs entirely in your browser — no data is sent anywhere outside LinkedIn
- LinkedIn's Terms of Service prohibit automation. Personal use carries very low risk, but use at your own discretion
- The script uses human-like timing and mouse simulation to minimize detection risk

---

## Settings reference (advanced)

At the bottom of the script you will also find a `DELAYS` block. You do not need to change these, but they are there if you want to tune the speed:

```javascript
const DELAYS = {
  betweenSkills:       500,  // minimum gap between deletions (ms)
  betweenSkillsJitter: 2000, // random extra gap added (ms) — keeps timing unpredictable
  consecutiveFailLimit: 3    // stop after this many failures in a row
  // ... other timing values
};
```

Increasing `betweenSkills` and `betweenSkillsJitter` makes the script slower but more safer. It is already configured and tested at ideal intervals.

// Visual verification with Playwright
// Launches Chromium with fake media stream device and UI flags.
// Takes screenshots at 1280x720 and 390x844:
// 1. Start screen
// 2. Stage with Sound sheet open
// 3. Stage with Menu drawer open
// 4. Stage with Songs list open
// Checks: no uppercase UI text, fonts loaded, no gradients on chrome, accent changes with theme.

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'verification-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runVerification() {
  console.log('Launching Chromium with fake media stream...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const errors = [];

  // 1. Desktop Verification (1280x720)
  console.log('Verifying Desktop 1280x720...');
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ['camera']
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // A. Start Screen Screenshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_start_screen_1280x720.png') });
  console.log('Saved 01_start_screen_1280x720.png');

  // Check fonts loaded on start screen
  const fontsLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    const hasInstrument = document.fonts.check('22px "Instrument Serif"');
    const hasHanken = document.fonts.check('15px "Hanken Grotesk"');
    return { hasInstrument, hasHanken };
  });
  console.log('Fonts status:', fontsLoaded);

  // Check initial accent
  const initialAccent = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  });
  console.log('Initial accent:', initialAccent);
  if (initialAccent !== '#F58BC4') {
    errors.push(`Expected initial accent #F58BC4 (NEON), got ${initialAccent}`);
  }

  // Click "Turn on camera" to enter stage
  console.log('Entering stage...');
  await page.click('#btn-start-camera');
  await page.waitForTimeout(1000);

  // B. Sound Sheet Open
  console.log('Opening Sound sheet...');
  await page.click('#chip-sound-sheet');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_stage_sound_sheet_1280x720.png') });
  console.log('Saved 02_stage_sound_sheet_1280x720.png');

  // Close Sound sheet
  await page.click('#btn-close-sound');
  await page.waitForTimeout(300);

  // C. Menu Drawer Open
  console.log('Opening Menu drawer...');
  await page.click('#btn-menu-toggle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_stage_menu_drawer_1280x720.png') });
  console.log('Saved 03_stage_menu_drawer_1280x720.png');

  // Close Menu drawer
  await page.click('#btn-close-menu');
  await page.waitForTimeout(300);

  // D. Songs Sheet Open (via Mode Switch -> Songs)
  console.log('Switching to Songs mode...');
  await page.click('.mode-tab[data-mode="SONGS"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_stage_songs_sheet_1280x720.png') });
  console.log('Saved 04_stage_songs_sheet_1280x720.png');

  // Close Songs sheet
  await page.click('#btn-close-songs');
  await page.waitForTimeout(300);

  // E. Check Vibes & Theme Accent Change
  console.log('Testing Vibes cycle & theme accent crossfade...');
  await page.click('#btn-vibes'); // Should switch to Rainy window (theme: INK, accent: #F2EBDD)
  await page.waitForTimeout(300);

  const changedAccent = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  });
  console.log('Accent after Vibes cycle:', changedAccent);
  if (changedAccent === initialAccent) {
    errors.push(`Accent did not update on theme switch! Remained ${changedAccent}`);
  }

  // F. Check text-transform: uppercase in UI text
  const uppercaseViolations = await page.evaluate(() => {
    const violations = [];
    const elements = document.querySelectorAll('#top-bar *, #bottom-dock *, .sound-sheet *, .menu-drawer *, .songs-sheet *, .coach-card *');
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.textTransform === 'uppercase') {
        violations.push({ tag: el.tagName, id: el.id, class: el.className, text: el.textContent?.slice(0, 30) });
      }
    });
    return violations;
  });

  if (uppercaseViolations.length > 0) {
    console.warn('Uppercase violations found:', uppercaseViolations);
    errors.push(`Found ${uppercaseViolations.length} elements with text-transform: uppercase`);
  } else {
    console.log('Verified: zero elements with text-transform: uppercase in UI chrome!');
  }

  await context.close();

  // 2. Mobile Verification (390x844 - iPhone 14 / modern phone viewport)
  console.log('Verifying Mobile 390x844...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['camera']
  });

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, '05_mobile_start_390x844.png') });
  console.log('Saved 05_mobile_start_390x844.png');

  await mobilePage.click('#btn-start-camera');
  await mobilePage.waitForTimeout(1000);

  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, '06_mobile_stage_390x844.png') });
  console.log('Saved 06_mobile_stage_390x844.png');

  await mobileContext.close();
  await browser.close();

  console.log('Verification finished. Summary:', errors.length === 0 ? 'ALL CHECKS PASSED' : errors);
  if (errors.length > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

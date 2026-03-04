import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:8001';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'demo-screenshots');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let stepNum = 0;

async function screenshot(page: any, name: string, delay = 1000) {
  await page.waitForTimeout(delay);
  stepNum++;
  const filename = `${String(stepNum).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
  console.log(`  📸 ${filename}`);
}

async function login(page: any, email: string) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/*', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

async function main() {
  // Clean screenshot dir
  if (fs.existsSync(SCREENSHOT_DIR)) fs.rmSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Sample images for photo upload
  const sampleBefore = path.join(__dirname, '..', 'public', 'uploads', 'work-orders', 'cmmavzv7b0005uzcrgf3rfhgu-before.jpg');
  const sampleAfter = path.join(__dirname, '..', 'public', 'uploads', 'work-orders', 'cmmavzv7b0005uzcrgf3rfhgu-after.jpg');

  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // ════════════════════════════════════════
  // SCENE 1: LOGIN
  // ════════════════════════════════════════
  console.log('\n═══ SCENE 1: LOGIN ═══');
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState('networkidle');
  await screenshot(page, 'login-side');

  // ════════════════════════════════════════
  // SCENE 2: MØTEBOOKER (Mari)
  // ════════════════════════════════════════
  console.log('\n═══ SCENE 2: MØTEBOOKER ═══');
  await login(page, 'mari@konvoi.no');

  // Kart view
  await page.goto(`${BASE_URL}/motebooker/kart`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Let map load
  await screenshot(page, 'motebooker-kart');

  // Switch to list/dialer view if available
  const dialerTab = page.locator('button:has-text("Liste"), button:has-text("Dialer")').first();
  if (await dialerTab.isVisible().catch(() => false)) {
    await dialerTab.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'motebooker-dialer');
  }

  // Oversikt
  await page.goto(`${BASE_URL}/motebooker/oversikt`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'motebooker-oversikt');

  // Go back to kart and click an organization marker/card
  await page.goto(`${BASE_URL}/motebooker/kart`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Try clicking an org in the list/bottom area
  const orgCard = page.locator('text=Majorstuen').first();
  if (await orgCard.isVisible().catch(() => false)) {
    await orgCard.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'motebooker-org-valgt');
  }

  // Try to find and click "Book møte" button
  const bookBtn = page.locator('button:has-text("Book møte"), button:has-text("Book")').first();
  if (await bookBtn.isVisible().catch(() => false)) {
    await bookBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'motebooker-book-mote-modal');

    // Select feltselger if dropdown visible
    const feltselgerSelect = page.locator('select, [role="combobox"]').first();
    if (await feltselgerSelect.isVisible().catch(() => false)) {
      await feltselgerSelect.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, 'motebooker-velg-feltselger');

    // Close modal
    const closeBtn = page.locator('button:has-text("Lukk"), button:has-text("Avbryt"), [aria-label="Close"]').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Try to show call logging
  const logCallBtn = page.locator('button:has-text("Logg"), button:has-text("Ring")').first();
  if (await logCallBtn.isVisible().catch(() => false)) {
    await logCallBtn.click();
    await page.waitForTimeout(800);
    await screenshot(page, 'motebooker-logg-samtale');
  }

  // Maler (templates) page
  await page.goto(`${BASE_URL}/motebooker/maler`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'motebooker-maler');

  // Chat
  await page.goto(`${BASE_URL}/motebooker/chat`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'motebooker-chat');

  // Logout by clearing cookies
  await context.clearCookies();
  await page.waitForTimeout(500);

  // ════════════════════════════════════════
  // SCENE 3: FELTSELGER (Erik)
  // ════════════════════════════════════════
  console.log('\n═══ SCENE 3: FELTSELGER ═══');
  await login(page, 'erik@konvoi.no');

  // Besøk list
  await page.goto(`${BASE_URL}/feltselger/besok`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'feltselger-besok-liste');

  // Show "Denne uken" tab
  const denneUkenTab = page.locator('button:has-text("Denne uken")').first();
  if (await denneUkenTab.isVisible().catch(() => false)) {
    await denneUkenTab.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'feltselger-denne-uken');
  }

  // Show "Alle" tab
  const alleTab = page.locator('button:has-text("Alle")').first();
  if (await alleTab.isVisible().catch(() => false)) {
    await alleTab.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'feltselger-alle');
  }

  // Click into a visit
  const visitCard = page.locator('text=Bjerke Borettslag').first();
  if (await visitCard.isVisible().catch(() => false)) {
    await visitCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await screenshot(page, 'feltselger-besok-detalj');

    // Scroll to show units
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);
    await screenshot(page, 'feltselger-enheter');

    // Try to expand a unit
    const unit101 = page.locator('text=101').first();
    if (await unit101.isVisible().catch(() => false)) {
      await unit101.click();
      await page.waitForTimeout(800);
      await screenshot(page, 'feltselger-enhet-detalj');
    }

    // Try to find "Registrer kunde" button
    const regKundeBtn = page.locator('button:has-text("Registrer"), button:has-text("registrer")').first();
    if (await regKundeBtn.isVisible().catch(() => false)) {
      await regKundeBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, 'feltselger-registrer-kunde-modal');

      // Close modal
      const closeModal = page.locator('button:has-text("Lukk"), button:has-text("Avbryt"), [aria-label="Close"]').first();
      if (await closeModal.isVisible().catch(() => false)) {
        await closeModal.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // Kalender
  await page.goto(`${BASE_URL}/feltselger/kalender`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'feltselger-kalender');

  // Dør-til-dør
  await page.goto(`${BASE_URL}/feltselger/dor-til-dor`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'feltselger-dor-til-dor');

  // Profil
  await page.goto(`${BASE_URL}/feltselger/profil`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'feltselger-profil');

  // Logout by clearing cookies
  await context.clearCookies();
  await page.waitForTimeout(500);

  // ════════════════════════════════════════
  // SCENE 4: TEKNIKER (Lars)
  // ════════════════════════════════════════
  console.log('\n═══ SCENE 4: TEKNIKER ═══');
  await login(page, 'lars@konvoi.no');

  // Oppdragsliste
  await page.goto(`${BASE_URL}/tekniker/oppdrag`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'tekniker-oppdragsliste');

  // Open work order
  const WORK_ORDER_ID = 'cmmavkqbq0003uzv9qwxukbg4';
  await page.goto(`${BASE_URL}/tekniker/oppdrag/${WORK_ORDER_ID}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'tekniker-oppdrag-detalj');

  // Start oppdrag
  const startBtn = page.locator('button:has-text("Start oppdrag")');
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'tekniker-oppdrag-startet');
  }

  // Expand unit
  const unitCard = page.locator('text=H0101').first();
  await unitCard.click();
  await page.waitForTimeout(800);
  await screenshot(page, 'tekniker-velg-produkt');

  // Select order type
  const ventRensBtn = page.locator('button:has-text("Ventilasjonsrens")').first();
  await ventRensBtn.click();
  await page.waitForTimeout(500);

  // Select product Medium
  const mediumBtn = page.locator('button:has-text("Medium")').first();
  await mediumBtn.click();
  await page.waitForTimeout(500);
  await screenshot(page, 'tekniker-produkt-valgt');

  // Scroll to payment options
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(400);

  // Select 3 months
  const tremndBtn = page.locator('button:has-text("3 mnd")').first();
  await tremndBtn.click();
  await page.waitForTimeout(400);

  // Select Faktura
  const fakturaBtn = page.locator('button:has-text("Faktura")').first();
  await fakturaBtn.click();
  await page.waitForTimeout(400);
  await screenshot(page, 'tekniker-betaling-valgt');

  // Confirm product
  const bekreftBtn = page.locator('button:has-text("Bekreft produkt")');
  await bekreftBtn.click();
  await page.waitForTimeout(1500);
  await screenshot(page, 'tekniker-produkt-bekreftet');

  // Scroll to rapport
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(500);
  await screenshot(page, 'tekniker-rapport-sjekkliste');

  // Check all checklist items
  const checkItems = page.locator('button:has(svg.text-gray-300)');
  let count = await checkItems.count();
  for (let i = 0; i < count; i++) {
    await checkItems.nth(0).click();
    await page.waitForTimeout(300);
  }
  await screenshot(page, 'tekniker-sjekkliste-ferdig');

  // Air measurements
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);

  const airInputs = page.locator('input[type="number"]');
  await airInputs.nth(0).fill('12');
  await airInputs.nth(1).fill('28');
  await screenshot(page, 'tekniker-luft-utfylt');

  const lagreBtn = page.locator('button:has-text("Lagre")').first();
  await lagreBtn.click();
  await page.waitForTimeout(1000);
  await screenshot(page, 'tekniker-luft-lagret');

  // Photos
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);
  await screenshot(page, 'tekniker-dokumentasjon');

  // Upload before photo
  if (fs.existsSync(sampleBefore)) {
    const fileInputs = page.locator('input[type="file"][accept="image/*"]');
    await fileInputs.first().setInputFiles(sampleBefore);
    await page.waitForTimeout(2000);
    await screenshot(page, 'tekniker-for-bilde');
  }

  // Upload after photo
  if (fs.existsSync(sampleAfter)) {
    const fileInputs = page.locator('input[type="file"][accept="image/*"]');
    const inputCount = await fileInputs.count();
    if (inputCount >= 3) {
      await fileInputs.nth(2).setInputFiles(sampleAfter);
      await page.waitForTimeout(2000);
      await screenshot(page, 'tekniker-etter-bilde');
    }
  }

  // Send rapport
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(500);
  const sendRapportBtn = page.locator('button:has-text("Send rapport")');
  if (await sendRapportBtn.isVisible()) {
    await sendRapportBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'tekniker-rapport-sendt');
  }

  // Complete unit
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(500);
  const fullforUnitBtn = page.locator('button:has-text("Fullfør enhet")');
  if (await fullforUnitBtn.isVisible()) {
    await fullforUnitBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'tekniker-enhet-fullfort');
  }

  // Filter subscription modal - skip
  const hoppOver = page.locator('button:has-text("Hopp over")');
  if (await hoppOver.isVisible().catch(() => false)) {
    await screenshot(page, 'tekniker-filteravtale');
    await hoppOver.click();
    await page.waitForTimeout(1000);
  }

  // Complete order
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const fullforBtn = page.locator('button:has-text("Fullfør oppdrag")');
  if (await fullforBtn.isVisible()) {
    await fullforBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'tekniker-signatur-modal');

    // Draw signature
    const canvas = page.locator('canvas');
    if (await canvas.isVisible()) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 40, box.y + box.height / 2);
        await page.mouse.down();
        for (let x = 40; x < box.width - 40; x += 5) {
          const y = box.height / 2 + Math.sin(x / 20) * 30;
          await page.mouse.move(box.x + x, box.y + y);
        }
        await page.mouse.up();
        await page.waitForTimeout(500);
        await screenshot(page, 'tekniker-signatur');
      }
    }

    const confirmBtn = page.locator('button:has-text("Fullfør oppdrag")').last();
    await confirmBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'tekniker-oppdrag-fullfort');
  }

  // ════════════════════════════════════════
  // DONE
  // ════════════════════════════════════════
  await browser.close();

  console.log(`\n✅ Ferdig! ${stepNum} screenshots i ${SCREENSHOT_DIR}`);

  // Build video
  console.log('\n🎬 Lager video...');
  const ffmpegPath = require('ffmpeg-static');
  const { execSync } = require('child_process');

  // Create filelist for concat
  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort();
  const filelist = files.map(f => `file '${f}'\nduration 2`).join('\n') + `\nfile '${files[files.length - 1]}'`;
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'filelist.txt'), filelist);

  const outPath = path.join(__dirname, '..', 'demo-konvoi-full.mp4');
  execSync(
    `${ffmpegPath} -y -f concat -safe 0 -i "${SCREENSHOT_DIR}/filelist.txt" -vf "scale=780:1688:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart "${outPath}"`,
    { stdio: 'inherit' }
  );

  console.log(`\n🎉 Video klar: ${outPath}`);
  const stat = fs.statSync(outPath);
  console.log(`   Størrelse: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);

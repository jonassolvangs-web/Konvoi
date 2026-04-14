import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:8001';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'demo-screenshots');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Work order with status 'planlagt' and a clean unit
const WORK_ORDER_ID = 'cmmavkqbq0003uzv9qwxukbg4';

let stepNum = 0;

async function screenshot(page: any, name: string, delay = 800) {
  await page.waitForTimeout(delay);
  stepNum++;
  const filename = `${String(stepNum).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
  console.log(`📸 ${filename}`);
}

async function main() {
  // Clean screenshot dir
  if (fs.existsSync(SCREENSHOT_DIR)) fs.rmSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Create a sample image for upload
  const sampleImgPath = path.join(SCREENSHOT_DIR, 'sample-vent.jpg');
  const existingImg = path.join(__dirname, '..', 'public', 'uploads', 'work-orders', 'cmmavzv7b0005uzcrgf3rfhgu-before.jpg');
  if (fs.existsSync(existingImg)) {
    fs.copyFileSync(existingImg, sampleImgPath);
  }
  const sampleImgAfter = path.join(SCREENSHOT_DIR, 'sample-vent-after.jpg');
  const existingImgAfter = path.join(__dirname, '..', 'public', 'uploads', 'work-orders', 'cmmavzv7b0005uzcrgf3rfhgu-after.jpg');
  if (fs.existsSync(existingImgAfter)) {
    fs.copyFileSync(existingImgAfter, sampleImgAfter);
  }

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // ─── 1. LOGIN ───
  console.log('\n🔐 Logging in...');
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState('networkidle');
  await screenshot(page, 'login-side');

  await page.fill('input[type="email"]', 'lars@turbo.no');
  await page.fill('input[type="password"]', 'password123');
  await screenshot(page, 'login-utfylt');

  await page.click('button[type="submit"]');
  await page.waitForURL('**/*', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // ─── 2. OPPDRAGSLISTE ───
  console.log('\n📋 Oppdragsliste...');
  await page.goto(`${BASE_URL}/tekniker/oppdrag`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'oppdragsliste');

  // ─── 3. ÅPNE OPPDRAG ───
  console.log('\n📂 Åpner oppdrag...');
  await page.goto(`${BASE_URL}/tekniker/oppdrag/${WORK_ORDER_ID}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await screenshot(page, 'oppdrag-detalj');

  // ─── 4. START OPPDRAG ───
  console.log('\n▶️ Starter oppdrag...');
  const startBtn = page.locator('button:has-text("Start oppdrag")');
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'oppdrag-startet');
  }

  // ─── 5. EXPAND UNIT ───
  console.log('\n🏠 Ekspanderer enhet...');
  const unitCard = page.locator('text=H0101').first();
  await unitCard.click();
  await page.waitForTimeout(800);
  await screenshot(page, 'enhet-ekspandert-velg-produkt');

  // ─── 6. VELG ORDRETYPE ───
  console.log('\n📦 Velger ordretype...');
  const ventRensBtn = page.locator('button:has-text("Ventilasjonsrens")').first();
  await ventRensBtn.click();
  await page.waitForTimeout(500);
  await screenshot(page, 'ordretype-valgt');

  // ─── 7. VELG PRODUKT ───
  console.log('\n🛒 Velger produkt...');
  const mediumBtn = page.locator('button:has-text("Medium")').first();
  await mediumBtn.click();
  await page.waitForTimeout(500);
  await screenshot(page, 'produkt-medium-valgt');

  // ─── 8. SCROLL NED FOR NEDBETALING ───
  console.log('\n💳 Velger nedbetaling...');
  // Scroll down to see payment options
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);

  const tremndBtn = page.locator('button:has-text("3 mnd")').first();
  await tremndBtn.click();
  await page.waitForTimeout(500);
  await screenshot(page, 'nedbetaling-3mnd');

  // ─── 9. VELG BETALINGSMETODE ───
  console.log('\n🧾 Velger faktura...');
  const fakturaBtn = page.locator('button:has-text("Faktura")').first();
  await fakturaBtn.click();
  await page.waitForTimeout(500);
  await screenshot(page, 'betaling-faktura');

  // ─── 10. BEKREFT PRODUKT ───
  console.log('\n✅ Bekrefter produkt...');
  const bekreftBtn = page.locator('button:has-text("Bekreft produkt")');
  await bekreftBtn.click();
  await page.waitForTimeout(1500);
  await screenshot(page, 'produkt-bekreftet');

  // ─── 11. SCROLL TO RAPPORT ───
  console.log('\n📝 Viser rapport-seksjon...');
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(500);
  await screenshot(page, 'rapport-sjekkliste');

  // ─── 12. SJEKKLISTE ───
  console.log('\n☑️ Sjekkliste...');
  const checklistItems = page.locator('button:has(svg.text-gray-300)');
  const count = await checklistItems.count();
  for (let i = 0; i < Math.min(count, 5); i++) {
    await checklistItems.nth(0).click(); // Always click first unchecked
    await page.waitForTimeout(400);
  }
  await screenshot(page, 'sjekkliste-halvferdig');

  // Check remaining items
  const remaining = page.locator('button:has(svg.text-gray-300)');
  const remCount = await remaining.count();
  for (let i = 0; i < remCount; i++) {
    await remaining.nth(0).click();
    await page.waitForTimeout(300);
  }
  await screenshot(page, 'sjekkliste-ferdig');

  // ─── 13. LUFTMÅLINGER ───
  console.log('\n🌬️ Luftmålinger...');
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);

  const airBeforeInput = page.locator('input[placeholder="0"]').first();
  const airAfterInput = page.locator('input[placeholder="0"]').last();
  await airBeforeInput.fill('12');
  await airAfterInput.fill('28');
  await screenshot(page, 'luftmalinger-utfylt');

  const lagreBtn = page.locator('button:has-text("Lagre")').first();
  await lagreBtn.click();
  await page.waitForTimeout(1000);
  await screenshot(page, 'luftmalinger-lagret');

  // ─── 14. BILDER ───
  console.log('\n📷 Laster opp bilder...');
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);
  await screenshot(page, 'dokumentasjon-tom');

  // Upload before photo
  if (fs.existsSync(sampleImgPath)) {
    const beforeInput = page.locator('input[type="file"][accept="image/*"]').first();
    await beforeInput.setInputFiles(sampleImgPath);
    await page.waitForTimeout(2000);
    await screenshot(page, 'for-bilde-lastet-opp');
  }

  // Upload after photo
  if (fs.existsSync(sampleImgAfter)) {
    // After uploading before-image, the page re-renders. Find the after photo input
    const afterInputs = page.locator('input[type="file"][accept="image/*"]');
    const afterCount = await afterInputs.count();
    // The after-image inputs should be further down
    if (afterCount >= 3) {
      await afterInputs.nth(2).setInputFiles(sampleImgAfter);
      await page.waitForTimeout(2000);
      await screenshot(page, 'etter-bilde-lastet-opp');
    }
  }

  // ─── 15. SEND RAPPORT ───
  console.log('\n📧 Sender rapport...');
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);

  const sendRapportBtn = page.locator('button:has-text("Send rapport til kunde")');
  if (await sendRapportBtn.isVisible()) {
    await screenshot(page, 'send-rapport-knapp');
    await sendRapportBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'rapport-sendt');
  }

  // ─── 16. FULLFØR ENHET ───
  console.log('\n🏁 Fullfører enhet...');
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(500);

  const fullforBtn = page.locator('button:has-text("Fullfør enhet")');
  if (await fullforBtn.isVisible()) {
    await screenshot(page, 'fullfør-enhet-knapp');
    await fullforBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'enhet-fullfort');
  }

  // Handle filter subscription modal (skip)
  const hoppOverBtn = page.locator('button:has-text("Hopp over")');
  if (await hoppOverBtn.isVisible()) {
    await screenshot(page, 'filteravtale-modal');
    await hoppOverBtn.click();
    await page.waitForTimeout(1000);
  }

  // ─── 17. FULLFØR OPPDRAG ───
  console.log('\n🎉 Fullfører oppdrag...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const fullforOppdragBtn = page.locator('button:has-text("Fullfør oppdrag")');
  if (await fullforOppdragBtn.isVisible()) {
    await fullforOppdragBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'signatur-modal');

    // Draw a simple signature
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
        await screenshot(page, 'signatur-tegnet');
      }
    }

    const bekreftFullforBtn = page.locator('button:has-text("Fullfør oppdrag")').last();
    await bekreftFullforBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'oppdrag-fullfort');
  }

  // ─── DONE ───
  await browser.close();

  console.log(`\n✅ Ferdig! ${stepNum} screenshots lagret i ${SCREENSHOT_DIR}`);
  console.log('\nFor å lage video, kjør:');
  console.log(`ffmpeg -framerate 0.5 -pattern_type glob -i '${SCREENSHOT_DIR}/*.png' -vf "scale=780:1688:flags=lanczos,pad=780:1688:(ow-iw)/2:(oh-ih)/2:white" -c:v libx264 -pix_fmt yuv420p -r 30 demo.mp4`);
}

main().catch(console.error);

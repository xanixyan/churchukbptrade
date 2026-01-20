#!/usr/bin/env node
/**
 * Script to update blueprint images from extracted img_BP.zip
 * Maps image files to blueprint slugs and updates JSON files
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const TEMP_IMAGES_DIR = path.join(PROJECT_ROOT, 'temp_images');
const PUBLIC_BLUEPRINTS_DIR = path.join(PROJECT_ROOT, 'public', 'blueprints');
const CONTENT_BLUEPRINTS_DIR = path.join(PROJECT_ROOT, 'content', 'blueprints');

// Manual mapping from image filenames (without img_ prefix and extension) to blueprint slugs
const IMAGE_TO_SLUG_MAP = {
  'AngledGrip2': 'angled-grip-ii',
  'AngledGrip3': 'angled-grip-iii',
  'Anvil': 'anvil',
  'Aphelion': 'aphelion',
  'BarricadeKit': 'barricade-kit',
  'Bettina': 'bettina',
  'BlazeGranade': 'blaze-grenade',
  'blueStick': 'blue-light-stick',
  'BobCat': 'bobcat',
  'Burletta': 'burletta',
  'CombatMk3_Agressive': 'combat-mk3-aggressive',
  'CombatMk3_Flanking': 'combat-mk-3-flanking',
  'Compensator2': 'compensator-ii',
  'Compensator3': 'compensator-iii',
  'ComplexGunParts': 'complex-gun-parts',
  'DeadLine': 'deadline',
  'Defibrillator': 'defibrillator',
  'ELToro': 'il-toro',
  'Equalizer': 'equalizer',
  'ExplosiveMine': 'explosive-mine',
  'ExtendedBarrel': 'extended-barrel',
  'FireworksBox': 'fireworks-box',
  'GasMine': 'gas-mine',
  'GreenStick': 'green-light-stick',
  'HeavyGunParts': 'heavy-gun-parts',
  'HullCracker': 'hullcracker',
  'JoltMine': 'jolt-mine',
  'Jupiter': 'jupiter',
  'LightGunParts': 'light-gun-parts',
  'lightMag2': 'extended-light-magazine-ii',
  'lightMag3': 'extended-light-magazine-iii',
  'LightweightStock': 'lightweight-stock',
  'LootingMK3_Survivor': 'looting-mk3-survivor',
  'LureGranade': 'lure-grenade',
  'MediumGunParts': 'medium-gun-parts',
  'MediumMag2': 'extended-medium-magazine-ii',
  'MediumMag3': 'extended-medium-mag-iii',
  'MuzzleBrake2': 'muzzle-brake-ii',
  'MuzzleBrake3': 'muzzle-brake-iii',
  'Osprey': 'osprey',
  'PaddedStock': 'padded-stock',
  'PulseMine': 'pulse-mine',
  'RedLightStick': 'red-light-stick',
  'RemoteRaiderFlare': 'remote-raider-flare',
  'SeekerGranade': 'seeker-grenade',
  'ShotgunChoke2': 'shotgun-choke-ii',
  'ShotgunChoke3': 'shotgun-choke-iii',
  'ShotGunMag2': 'extended-shotgun-magazine-ii',
  'ShotGunMag3': 'extended-shotgun-magazine-iii',
  'ShotgunSilencer': 'shotgun-silencer',
  'Showstopper': 'showstopper',
  'Silencer1': 'silencer-i',
  'Silencer2': 'silencer-ii',
  'SmokeGranade': 'smoke-grenade',
  'SnapHook': 'snap-hook',
  'StableStock2': 'stable-stock-ii',
  'StableStock3': 'stable-stock-iii',
  'TacticalMk3_Defense': 'tactical-mk3-defensive',
  'TacticalMk3_Healing': 'tactical-mk3-healing',
  'TaggingGrenade': 'tagging-grenade',
  'Tempest': 'tempest',
  'Torrente': 'torrente',
  'TrailblazerGrenade': 'trailblazer-grenade',
  'TriggerNade': 'trigger-nade',
  'Venator': 'venator',
  'VerticalGrip2': 'vertical-grip-ii',
  'VerticalGrip3': 'vertical-grip-iii',
  'VitaShot': 'vita-shot',
  'VitaSpray': 'vita-spray',
  'Vulcano': 'vulcano',
  'Wolfpack': 'wolfpack',
  'YellowLightStick': 'yellow-light-stick',
};

function main() {
  console.log('Starting blueprint image update...\n');

  // Create public/blueprints directory
  if (!fs.existsSync(PUBLIC_BLUEPRINTS_DIR)) {
    fs.mkdirSync(PUBLIC_BLUEPRINTS_DIR, { recursive: true });
    console.log('Created directory:', PUBLIC_BLUEPRINTS_DIR);
  }

  // Get all image files
  const imageFiles = fs.readdirSync(TEMP_IMAGES_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${imageFiles.length} images in temp_images/\n`);

  let successCount = 0;
  let errorCount = 0;
  const unmappedImages = [];
  const unmappedSlugs = new Set(
    fs.readdirSync(CONTENT_BLUEPRINTS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  );

  // Process each image
  for (const imageFile of imageFiles) {
    // Extract the key from filename (remove img_ prefix and .png extension)
    const key = imageFile.replace(/^img_/, '').replace(/\.png$/, '');
    const slug = IMAGE_TO_SLUG_MAP[key];

    if (!slug) {
      unmappedImages.push(imageFile);
      console.error(`⚠ No mapping for image: ${imageFile}`);
      errorCount++;
      continue;
    }

    // Copy image to public/blueprints with normalized name
    const srcPath = path.join(TEMP_IMAGES_DIR, imageFile);
    const destPath = path.join(PUBLIC_BLUEPRINTS_DIR, `${slug}.png`);

    try {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied: ${imageFile} → ${slug}.png`);
    } catch (err) {
      console.error(`✗ Error copying ${imageFile}:`, err.message);
      errorCount++;
      continue;
    }

    // Update blueprint JSON
    const jsonPath = path.join(CONTENT_BLUEPRINTS_DIR, `${slug}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.error(`✗ Blueprint JSON not found: ${jsonPath}`);
      errorCount++;
      continue;
    }

    try {
      const blueprintData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      blueprintData.image = `/blueprints/${slug}.png`;
      blueprintData.updatedAt = new Date().toISOString();
      fs.writeFileSync(jsonPath, JSON.stringify(blueprintData, null, 2) + '\n');
      unmappedSlugs.delete(slug);
      successCount++;
    } catch (err) {
      console.error(`✗ Error updating ${slug}.json:`, err.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log(`  ✓ Successfully processed: ${successCount}`);
  console.log(`  ✗ Errors: ${errorCount}`);

  if (unmappedImages.length > 0) {
    console.log(`\nUnmapped images (${unmappedImages.length}):`);
    unmappedImages.forEach(img => console.log(`  - ${img}`));
  }

  if (unmappedSlugs.size > 0) {
    console.log(`\nBlueprints without images (${unmappedSlugs.size}):`);
    [...unmappedSlugs].forEach(slug => console.log(`  - ${slug}`));
  }

  console.log('\nDone!');
}

main();

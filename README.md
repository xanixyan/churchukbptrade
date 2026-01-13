# churchukbptrade

A dark, gamer-styled storefront for selling ARC Raiders blueprints. No payment processing - purchases are handled via Discord messaging.

## Features

- **Blueprint Catalog**: Browse all available blueprints with search and filters
- **Blueprint Details**: View individual blueprint info with buy option
- **Discord Purchase Flow**: Click "Buy" → Copy prefilled message → Send to Discord
- **Admin Panel**: Decap CMS at `/admin` for owner-only catalog management
- **Static Export**: Fully static site, deployable to Netlify

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Decap CMS (formerly Netlify CMS)
- Netlify Identity + Git Gateway

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── layout.tsx       # Root layout with header/footer
│   ├── page.tsx         # Catalog page (/)
│   ├── globals.css      # Global styles + Tailwind
│   └── bp/[slug]/
│       └── page.tsx     # Blueprint detail page
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── BlueprintCard.tsx
│   ├── BlueprintGrid.tsx
│   ├── BlueprintDetail.tsx
│   ├── CatalogControls.tsx
│   └── BuyModal.tsx
├── lib/
│   ├── types.ts         # TypeScript interfaces
│   └── blueprints.ts    # Blueprint loading functions
├── content/
│   └── blueprints/      # JSON files for each blueprint
├── public/
│   └── admin/
│       ├── index.html   # Decap CMS entry
│       └── config.yml   # CMS configuration
└── scripts/
    └── fandom-scrape.mjs # Optional wiki scraper
```

## Blueprint JSON Format

Each blueprint is stored as a JSON file in `content/blueprints/`:

```json
{
  "id": "BP-AR-002",
  "name": "Assault Rifle Mk2",
  "slug": "assault-rifle-mk2",
  "image": "https://example.com/image.png",
  "owned": true,
  "notes": "Great for mid-range combat."
}
```

## Deploy to Netlify

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/churchukbptrade.git
git push -u origin main
```

### Step 2: Deploy on Netlify

1. Go to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Build settings (should auto-detect):
   - **Build command**: `npm run build`
   - **Publish directory**: `out`
5. Click "Deploy site"

### Step 3: Enable Identity & Git Gateway

1. In Netlify dashboard, go to **Site settings** → **Identity**
2. Click **Enable Identity**
3. Under **Registration**, select **Invite only** (recommended)
4. Under **Services** → **Git Gateway**, click **Enable Git Gateway**
5. Go to **Identity** tab and click **Invite users**
6. Invite yourself (your email)

### Step 4: Accept Invite & Access Admin

1. Check your email for the invite
2. Click the invite link and set your password
3. Go to `https://your-site.netlify.app/admin/`
4. Log in with your credentials
5. You can now add/edit/delete blueprints!

## Importing Blueprints from Fandom

The project includes an automatic importer that fetches ALL ARC Raiders blueprints from the Fandom wiki.

### Quick Start

```bash
npm run import:blueprints
```

This will:
1. Fetch the Fandom wiki page: `https://arc-raiders.fandom.com/wiki/Blueprints`
2. Parse all blueprint names and high-resolution image URLs
3. Generate one JSON file per blueprint in `content/blueprints/`
4. **Preserve** your existing `owned` and `notes` values

### What Gets Created

For each blueprint, a file like `content/blueprints/anvil.json`:

```json
{
  "id": "BP-001",
  "name": "Anvil",
  "slug": "anvil",
  "image": "https://static.wikia.nocookie.net/arc-raiders/images/.../Anvil.png",
  "owned": false,
  "notes": ""
}
```

- **IDs**: `BP-001`, `BP-002`, etc. (alphabetical order by name)
- **Slugs**: Lowercase, hyphens instead of spaces
- **Images**: Highest resolution available from Fandom CDN
- **Default**: `owned: false`, `notes: ""`

### Sample Output

```
╔══════════════════════════════════════════════════════════════╗
║         ARC Raiders Blueprint Importer                       ║
║         Source: arc-raiders.fandom.com                       ║
╚══════════════════════════════════════════════════════════════╝

📡 Fetching: https://arc-raiders.fandom.com/wiki/Blueprints
  ✓ Fetched 156.2 KB

🔍 Parsing Fandom wiki page...
  Found 2 tables, extracted 45 blueprints
  ✓ Total blueprints found: 45

📝 Writing blueprint files...
  + Anvil (anvil)
  + Assault Rifle (assault-rifle)
  + Combat Armor (combat-armor)
  ...

╔══════════════════════════════════════════════════════════════╗
║                     Import Complete                          ║
╚══════════════════════════════════════════════════════════════╝

  📊 Summary:
     Total blueprints: 45
     Created:          42
     Updated:          3
     Unchanged:        0

  🖼️  Images:
     With image:    40
     Without image: 5
```

### Safe Update Logic

When you run the import again:

| Scenario | Action |
|----------|--------|
| New blueprint on wiki | Creates new file |
| Existing file, data changed | Updates `id`, `name`, `image`, `slug` only |
| Existing file, no changes | Skips (unchanged) |
| Your `owned`/`notes` values | **Always preserved** |

### Updating Your Catalog

When the wiki adds new blueprints:

```bash
npm run import:blueprints
```

- New blueprints appear with `owned: false`
- Your marked blueprints stay marked
- Nothing is deleted automatically

### After Import

1. Review files in `content/blueprints/`
2. Edit files to set `owned: true` for blueprints you have
3. Add pricing/notes as needed
4. Run `npm run dev` to see the catalog
5. Or use `/admin` CMS after deployment

### Troubleshooting

**"Could not find blueprint table — update selector"**
- The Fandom wiki layout may have changed
- Edit `scripts/import-blueprints.mjs` to update the HTML parsing

**Missing images**
- Some blueprints may not have images on the wiki yet
- Add image URLs manually in the JSON files or via CMS

## Purchase Flow

1. Visitor browses catalog at `/`
2. Clicks on a blueprint to see details at `/bp/[slug]`
3. Clicks "Buy (Copy message)"
4. Modal opens with prefilled Ukrainian message
5. Visitor copies message and contacts `churchuk` on Discord
6. Owner and buyer arrange trade in-game

## Customization

### Change Discord Username

Update the username in:
- `components/Header.tsx`
- `components/Footer.tsx`
- `components/BuyModal.tsx`

### Change Message Template

Edit the `message` variable in `components/BuyModal.tsx`

### Adjust Styling

The site uses a dark gamer theme with cyan/purple neon accents. Colors are defined in:
- `tailwind.config.ts` (theme colors)
- `app/globals.css` (CSS custom properties)

## License

Private project. All rights reserved.

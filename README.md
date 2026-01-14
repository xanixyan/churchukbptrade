# churchukbptrade

A dark, gamer-styled storefront for selling ARC Raiders blueprints. Orders are sent directly to Telegram.

## Features

- **Blueprint Catalog**: Browse all available blueprints with search and filters
- **Blueprint Details**: View individual blueprint info with buy option
- **Telegram Orders**: Select blueprints, enter your Discord nick, submit - order goes to Telegram
- **Anti-spam Protection**: Rate limiting and honeypot fields
- **Docker Ready**: Easy deployment with Docker

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Telegram Bot API

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/churchukbptrade.git
cd churchukbptrade
npm install
```

### 2. Set Up Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Message [@userinfobot](https://t.me/userinfobot) to get your chat ID

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_CHAT_ID=your_chat_id_here
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/
│   │   └── order/
│   │       └── route.ts     # Order API endpoint
│   ├── layout.tsx           # Root layout with header/footer
│   ├── page.tsx             # Catalog page (/)
│   ├── globals.css          # Global styles + Tailwind
│   └── bp/[slug]/
│       └── page.tsx         # Blueprint detail page
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── BlueprintCard.tsx
│   ├── BlueprintGrid.tsx
│   ├── CheckoutModal.tsx    # Order form modal
│   ├── CatalogControls.tsx
│   ├── QuantitySelector.tsx
│   └── SelectionBar.tsx
├── lib/
│   ├── types.ts             # TypeScript interfaces
│   ├── blueprints.ts        # Blueprint loading functions
│   ├── order.ts             # Order validation & Telegram
│   └── rate-limit.ts        # Rate limiting
├── content/
│   └── blueprints/          # JSON files for each blueprint
└── scripts/
    └── import-blueprints.mjs # Wiki importer
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

## Docker Deployment

### Quick Start (Production)

```bash
# Build and run
docker-compose up -d

# Site is available at http://localhost:3000
```

### Development with Docker

```bash
# Run with hot reload
docker-compose -f docker-compose.dev.yml up

# Site is available at http://localhost:3000 with live reload
```

### Manual Docker Commands

```bash
# Build production image
docker build -t churchukbptrade .

# Run container with environment variables
docker run -d -p 3000:3000 \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e TELEGRAM_ADMIN_CHAT_ID=your_chat_id \
  --name churchukbptrade \
  churchukbptrade

# View logs
docker logs churchukbptrade

# Stop and remove
docker stop churchukbptrade && docker rm churchukbptrade
```

### Docker Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Production multi-stage build |
| `Dockerfile.dev` | Development with hot reload |
| `docker-compose.yml` | Production orchestration |
| `docker-compose.dev.yml` | Development orchestration |
| `.dockerignore` | Files excluded from build |

## Deploy with Cloudflare

### Option 1: VPS + Docker + Cloudflare DNS

#### Step 1: Set up VPS

```bash
# On your VPS (Ubuntu/Debian)
sudo apt update
sudo apt install docker.io docker-compose git

# Clone your repo
git clone https://github.com/YOUR_USERNAME/churchukbptrade.git
cd churchukbptrade

# Create .env.local with your Telegram credentials
cat > .env.local << EOF
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_ADMIN_CHAT_ID=your_chat_id_here
EOF

# Build and run
docker-compose up -d
```

#### Step 2: Configure Cloudflare DNS

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain → **DNS**
3. Add an **A record**:
   - **Name**: `@` (or `www`)
   - **IPv4 address**: Your VPS IP
   - **Proxy status**: Proxied (orange cloud)
4. Save

#### Step 3: Enable HTTPS (Cloudflare handles this)

1. Go to **SSL/TLS** → **Overview**
2. Set mode to **Full** (or **Full (strict)** if you have SSL on server)

Your site is now live at `https://yourdomain.com`!

### Option 2: Cloudflare Tunnel (No open ports)

For maximum security - no need to expose ports:

```bash
# Install cloudflared on your server
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create churchukbptrade

# Configure tunnel (creates config)
cat > ~/.cloudflared/config.yml << EOF
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run churchukbptrade
```

Then add a CNAME record in Cloudflare DNS pointing to `YOUR_TUNNEL_ID.cfargotunnel.com`.

## Importing Blueprints from Fandom

The project includes an automatic importer that fetches ALL ARC Raiders blueprints from the Fandom wiki.

### Quick Start

```bash
npm run import:blueprints
```

This will:
1. Fetch the Fandom wiki page
2. Parse all blueprint names and image URLs
3. Generate one JSON file per blueprint in `content/blueprints/`
4. **Preserve** your existing `owned` and `notes` values

### After Import

1. Review files in `content/blueprints/`
2. Edit files to set `owned: true` for blueprints you have
3. Add pricing/notes as needed
4. Run `npm run dev` to see the catalog

## Order Flow

1. Visitor browses catalog at `/`
2. Clicks blueprints to select them
3. Adjusts quantities as needed
4. Clicks "Купити обране" (Buy selected)
5. Enters Discord nickname and offer
6. Clicks "Оформити замовлення" (Place order)
7. Order is sent to your Telegram
8. You contact the buyer on Discord

## Security Notes

- **NEVER** commit `.env.local` or any file containing tokens
- The `.gitignore` is configured to ignore `.env*.local` and `.env`
- Rate limiting: 3 orders per 5 minutes per IP
- Honeypot field to catch bots
- Input validation on both client and server

## Customization

### Change Discord Username

Update the username in:
- `components/Header.tsx`
- `components/Footer.tsx`

### Adjust Styling

The site uses a dark gamer theme with cyan/purple neon accents. Colors are defined in:
- `tailwind.config.ts` (theme colors)
- `app/globals.css` (CSS custom properties)

## License

Private project. All rights reserved.

# Inbound Sort Scanner — Simplified

A clean, elegant warehouse sorting app. Upload CSV → Scan cases/SKUs → Mark as sorted → Track progress. No authentication required, just pure functionality.

## Features

✅ CSV manifest upload  
✅ Case & SKU scanning workflow  
✅ Mark items as sorted  
✅ Real-time progress tracking  
✅ Elegant sidebar navigation  
✅ Mobile responsive  

## Quick Start (Local)

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (Vite) and backend runs on `http://localhost:3000`

## Deploy to Render + Neon

### 1. Create Neon Database
1. Go to https://neon.tech
2. Sign up and create a new project
3. Copy the connection string (looks like `postgresql://user:pass@...`)

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/inbound-sort-scanner.git
git push -u origin main
```

### 3. Deploy to Render
1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Set environment variables:
   - `DATABASE_URL`: Your Neon connection string
   - `NODE_ENV`: `production`
5. Build command: `npm install`
6. Start command: `npm start`
7. Click **Create Web Service**

### 4. Access Your App
Once deployed, you'll get a URL like `https://inbound-sort-scanner.onrender.com`

## CSV Format

```
case_id,sku,qty,sort_group,dealer
C001,SKU-A,20,GRP-1,Dealer Alpha
C001,SKU-A,15,GRP-2,Dealer Beta
C001,SKU-B,10,GRP-1,Dealer Alpha
C002,SKU-C,30,GRP-3,Dealer Gamma
```

## API Endpoints

- `POST /api/sessions` — Create session with CSV
- `GET /api/sessions` — List all sessions
- `GET /api/sessions/:id/cases` — Get cases in session
- `GET /api/sessions/:id/case/:caseId/skus` — Get SKUs for case
- `GET /api/sessions/:id/case/:caseId/sku/:sku` — Get sort destinations
- `PATCH /api/manifest/:id/done` — Mark row as done
- `GET /api/sessions/:id/progress` — Get completion stats

## Tech Stack

- **Backend**: Express.js + PostgreSQL
- **Frontend**: React + Tailwind CSS
- **Database**: Neon PostgreSQL
- **Hosting**: Render

## License

MIT

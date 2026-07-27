# AB PARC AUTO - CORS Proxy Deployment

## Quick Deploy to Render.com (FREE - 2 minutes)

### ✅ ONE CLICK DEPLOY

Click here:
```
https://render.com/deploy?repo=https://github.com/abrenov35/auto-ab
```

Or go to: https://render.com
- Click "New +" → "Web Service"
- Connect GitHub → Select abrenov35/auto-ab
- Auto-deploy ✅

### ⏱️ After Deploy (3 minutes)

1. Render creates your service
2. You get a URL like: `https://auto-ab-xxxxx.onrender.com`
3. Copy the URL

### 📝 Update index.html

Replace line 1457:
```javascript
// BEFORE
const APPS_SCRIPT_URL = "https://abrenov35-auto-ab.abrenov35.workers.dev";

// AFTER (use your Render URL)
const APPS_SCRIPT_URL = "https://auto-ab-xxxxx.onrender.com";
```

### 🚀 Push & Done

```bash
git add index.html
git commit -m "v6.3.106: Update CORS proxy to Render.com"
git push origin main
```

Pages redeploys automatically (2-3 min) → App works! ✅

---

## How It Works

```
Frontend (GitHub Pages)
    ↓ fetch("render-url")
    ↓
Render (Express CORS Proxy)
    ├─ Add CORS headers
    ├─ Proxy to GAS
    └─ Return response
    ↓
Google Apps Script (Backend)
```

---

## Monitoring

After deployment, check:
- Render Dashboard: https://dashboard.render.com
- Service logs, metrics, etc.
- Automatic redeploys on GitHub push

---

## Troubleshooting

**Service not starting?**
- Check Render logs in dashboard
- Verify PORT=8080 in environment

**CORS still broken?**
- Clear browser cache: Ctrl+Shift+Del
- Check network tab in F12
- Verify URL in index.html

**Need custom domain?**
- Render → Project Settings → Custom Domain
- Add your domain, update DNS

---

Free tier includes:
- Unlimited requests
- Auto-scaling
- Auto-deploy from GitHub
- HTTPS
- No card required

**Recommended!** Deploy now: https://render.com/deploy?repo=https://github.com/abrenov35/auto-ab

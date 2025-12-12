# Public Deployment Guide - FYP_Module-01

This guide shows you how to deploy your application to the cloud so **anyone can access it**.

## 🌐 Deployment Options

| Platform | Free Tier | Difficulty | Best For |
|----------|-----------|------------|----------|
| **Render.com** | ✅ Yes | Easy | Quick deployment, free tier |
| **Railway.app** | ✅ Yes ($5 credit) | Easy | Modern platform, great DX |
| **Vercel** | ✅ Yes | Medium | Frontend-focused |
| **Heroku** | ❌ No | Easy | Legacy option |
| **VPS (DigitalOcean, AWS)** | ❌ No | Hard | Full control |

---

## 🚀 Option 1: Render.com (Recommended)

### Prerequisites
- GitHub account
- Code pushed to GitHub repository
- Hugging Face API token

### Step-by-Step

1. **Sign up at [render.com](https://render.com)**

2. **Create New Web Service:**
   - Dashboard → "New" → "Web Service"
   - Connect GitHub account
   - Select your repository

3. **Configure Service:**
   ```
   Name: req2design (or your choice)
   Region: Choose closest to you
   Branch: main
   Root Directory: (leave empty)
   Runtime: Python 3
   Build Command: pip install -r requirements.txt && pip install -r requirements_api.txt && cd frontend && npm install && npm run build
   Start Command: python api_server.py
   ```

4. **Environment Variables:**
   Add these in "Environment" section:
   - `HF_API_TOKEN` = `hf_REDACTED`
   - `FLASK_ENV` = `production`
   - `PORT` = `8000`

5. **Deploy:**
   - Click "Create Web Service"
   - Wait for build (5-10 minutes)
   - Your app is live at: `https://your-app-name.onrender.com`

### Render Free Tier Notes
- App sleeps after 15 minutes of inactivity
- Wakes up automatically on first request (may take 30-60 seconds)
- Perfect for demos and testing
- Upgrade to paid plan for always-on service

---

## 🚂 Option 2: Railway.app

### Prerequisites
- GitHub account
- Railway account ([railway.app](https://railway.app))

### Method A: Using Railway Dashboard

1. **Sign up at [railway.app](https://railway.app)**

2. **New Project:**
   - Click "New Project"
   - "Deploy from GitHub repo"
   - Select your repository

3. **Configure:**
   - Railway auto-detects Python
   - Add environment variables:
     - `HF_API_TOKEN` = `hf_REDACTED`
     - `FLASK_ENV` = `production`

4. **Build Settings:**
   - Build Command: `pip install -r requirements.txt && pip install -r requirements_api.txt && cd frontend && npm install && npm run build`
   - Start Command: `python api_server.py`

5. **Deploy:**
   - Railway auto-deploys on push
   - Get your URL: `https://your-app-name.up.railway.app`

### Method B: Using Railway CLI

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set HF_API_TOKEN=hf_REDACTED
railway variables set FLASK_ENV=production

# Deploy
railway up
```

---

## ☁️ Option 3: Vercel (Frontend + Serverless Functions)

Vercel is great if you want to separate frontend and backend.

### Frontend Deployment

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy Frontend:**
   ```bash
   cd frontend
   vercel
   ```

3. **Set Environment Variable:**
   - In Vercel dashboard, add: `REACT_APP_API_URL` = your backend URL

### Backend Deployment

Deploy backend separately to Render/Railway, then point frontend to it.

---

## 🖥️ Option 4: VPS Deployment (DigitalOcean, AWS, etc.)

For full control, deploy to a VPS.

### Prerequisites
- VPS with Ubuntu 20.04+
- Domain name (optional)
- SSH access

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install python3 python3-pip nodejs npm nginx git -y

# Install PM2
sudo npm install -g pm2
```

### Step 2: Clone and Setup

```bash
# Clone repository
git clone https://github.com/your-username/FYP_Module-01.git
cd FYP_Module-01

# Install Python dependencies
pip3 install -r requirements.txt
pip3 install -r requirements_api.txt

# Build frontend
cd frontend
npm install
npm run build
cd ..
```

### Step 3: Environment Variables

```bash
# Create .env file
nano .env

# Add:
HF_API_TOKEN=hf_REDACTED
FLASK_ENV=production
PORT=8000
```

### Step 4: Run with PM2

```bash
# Start application
pm2 start api_server.py --name req2design --interpreter python3

# Save PM2 config
pm2 save
pm2 startup
```

### Step 5: Configure Nginx

Create `/etc/nginx/sites-available/req2design`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/req2design /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

---

## 🔧 Environment Variables

All platforms need these:

| Variable | Value | Required |
|----------|-------|----------|
| `HF_API_TOKEN` | `hf_REDACTED` | ✅ Yes |
| `FLASK_ENV` | `production` | ✅ Yes |
| `PORT` | `8000` | ⚠️ Auto-set on most platforms |

---

## 🔒 Security Best Practices

1. **Never commit tokens to Git**
   - ✅ `.env` is in `.gitignore`
   - ✅ Use platform environment variables

2. **HTTPS is automatic** on cloud platforms
   - Render, Railway provide free SSL
   - VPS: Use Let's Encrypt (free)

3. **Rate Limiting** (consider adding)
   ```python
   # Add to api_server.py
   from flask_limiter import Limiter
   limiter = Limiter(app, key_func=get_remote_address)
   ```

4. **CORS Configuration**
   - Already configured in `api_server.py`
   - Restrict origins in production if needed

---

## 📊 Platform Comparison

| Feature | Render | Railway | VPS |
|---------|--------|---------|-----|
| **Free Tier** | ✅ Yes | ✅ Yes | ❌ No |
| **HTTPS** | ✅ Auto | ✅ Auto | ⚙️ Manual |
| **Always On** | ❌ Sleeps | ✅ Yes | ✅ Yes |
| **Custom Domain** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Ease of Use** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Cost** | Free/Paid | Free/Paid | Paid only |

---

## 🐛 Troubleshooting

### Build Fails
- Check build logs in platform dashboard
- Verify all dependencies in `requirements.txt`
- Check Node.js version (needs 16+)

### App Crashes
- Check environment variables
- Verify `HF_API_TOKEN` is correct
- Check application logs

### Slow First Load (Render)
- Normal on free tier (app wakes from sleep)
- Takes 30-60 seconds on first request
- Upgrade to paid for always-on

### Frontend Not Loading
- Verify frontend build completed
- Check if `frontend/build` exists
- Review build logs

---

## 🎯 Recommended Approach

**For Quick Deployment:** Use **Render.com**
- Free tier available
- Easiest setup
- Automatic HTTPS
- Perfect for demos

**For Production:** Use **Railway** or **VPS**
- Always-on service
- Better performance
- More control

---

## 📝 Next Steps

1. **Deploy to Render** (easiest)
2. **Test your app** at the public URL
3. **Share with others!**
4. **Optional:** Set up custom domain
5. **Optional:** Add monitoring/analytics

---

**Your app will be publicly accessible once deployed! 🌐**

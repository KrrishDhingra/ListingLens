# PropertyReel — AI Property Walkthrough Videos

Turn property photos into cinematic AI video walkthroughs using **MiniMax Hailuo-2.3**.

Built with Next.js 14, Firebase, and deployed on Vercel.

---

## Features

- **Multi-image upload** (drag & drop, up to 20 photos)
- **5 AI video styles**: Walkthrough, Remove Furniture, Drone/Aerial, Day-to-Night, Virtual Staging
- **Resolution options**: 768P or 1080P
- **Duration options**: 6s or 10s
- **Custom notes** — add context to guide the AI
- **Firebase Storage** — images and videos stored and served from your bucket
- **Firestore** — job tracking with real-time status polling
- **Vercel-ready** — zero config deploy

---

## Setup

### 1. Clone & install

```bash
git clone <your-repo>
cd property-walkthrough
npm install
```

### 2. Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → New project
2. Enable **Firestore Database** (start in test mode for development)
3. Enable **Storage** (start in test mode for development)
4. Go to Project Settings → General → Your apps → Web → Copy config
5. Go to Project Settings → Service accounts → Generate new private key (for Admin SDK)

**Storage rules** (set in Firebase Console → Storage → Rules):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true; // tighten before going to production
    }
  }
}
```

### 3. MiniMax API key

1. Sign up at [platform.minimax.io](https://platform.minimax.io)
2. Go to Account → API Keys → Create key
3. Add credits to your account (video generation is ~$0.33/video at 1080P 6s)

### 4. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

| Variable | Where to find it |
|---|---|
| `MINIMAX_API_KEY` | platform.minimax.io → API Keys |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Same |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Same (looks like `yourproject.appspot.com`) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Same |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Same |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | From service account JSON → `client_email` |
| `FIREBASE_PRIVATE_KEY` | From service account JSON → `private_key` (keep the `\n` escapes) |

### 5. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

### 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo at [vercel.com/new](https://vercel.com/new).

**Add all env vars** in Vercel Dashboard → Your Project → Settings → Environment Variables.

Set `FIREBASE_PRIVATE_KEY` value by wrapping in double quotes and keeping `\n` literal:
```
"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

---

## Architecture

```
User uploads photos
      ↓
POST /api/generate
  → Upload images to Firebase Storage (public URLs)
  → Create job doc in Firestore (status: processing)
  → Call MiniMax Hailuo-2.3 image-to-video API
  → Store task_id in Firestore
      ↓
Client polls GET /api/status?jobId=xxx (every 5s)
  → Query MiniMax for task status
  → On success: download video, re-upload to Firebase Storage
  → Update Firestore job doc (status: success, videoUrl: ...)
      ↓
User plays or downloads video from Firebase CDN
```

---

## Cost estimate

| Config | Price |
|---|---|
| 1080P, 6s | ~$0.33/video |
| 768P, 10s | ~$0.32/video |
| 768P, 6s | ~$0.19/video |

Prices from MiniMax pay-as-you-go as of June 2026.

---

## Production checklist

- [ ] Tighten Firebase Storage rules (require auth)
- [ ] Add Firebase Authentication so users only see their own jobs
- [ ] Add rate limiting on `/api/generate`
- [ ] Set up Firestore security rules
- [ ] Enable Vercel Edge functions for faster polling
# ListingLens

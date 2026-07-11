# ListingLens — Agent Audit & Handoff Brief

## What This Is

A Next.js 14 (App Router, TypeScript, Tailwind) SaaS platform that lets real estate agents upload property photos and generate AI walkthrough videos using the **MiniMax Hailuo-2.3** API. Firebase handles storage (images + videos) and Firestore tracks job state. Deployed on Vercel.

**Live URL:** https://listing-lens-cyan.vercel.app  
**GitHub:** https://github.com/KrrishDhingra/ListingLens  
**Firebase project:** propai-ae727

---

## Project File Map

```
src/
  app/
    page.tsx                  # Main upload form (client)
    layout.tsx                # Root layout — wraps AuthProvider + Navbar
    login/page.tsx            # Google sign-in page
    jobs/page.tsx             # Video jobs dashboard (client, polls every 5s)
    api/
      generate/route.ts       # POST: upload images → Firebase Storage → MiniMax task
      status/route.ts         # GET: poll MiniMax task status + download video
                              # POST: list all jobs from Firestore

  components/
    Navbar.tsx                # Sticky nav with user avatar + sign out
    ImageUploader.tsx         # react-dropzone multi-image upload, max 20 photos
    StylePicker.tsx           # 5 video style cards
    JobCard.tsx               # Job status card with video player + download
    AuthGuard.tsx             # Redirects unauthenticated users to /login

  lib/
    auth-context.tsx          # Firebase Auth context (Google sign-in)
    firebase-client.ts        # Firebase client SDK (Storage + Firestore)
    firebase-admin.ts         # Firebase Admin SDK (lazy-init proxy pattern)
    minimax.ts                # MiniMax API: createVideoTask + queryVideoTask
    types.ts                  # Job interface
```

---

## Key Flows

### Video Generation Flow
1. User uploads images via `POST /api/generate` (FormData)
2. Server uploads images to Firebase Storage using **signed URLs** (not makePublic)
3. First image URL passed to MiniMax `POST /v1/video_generation` with a style prompt
4. MiniMax returns a `task_id` — stored in Firestore job doc
5. Client polls `GET /api/status?jobId=xxx` every 5s
6. Status route queries MiniMax `GET /v1/query/video_generation?task_id=xxx`
7. On success: downloads video via **`/v1/files/retrieve_content`** (NOT `/v1/files/retrieve`)
8. Re-uploads MP4 to Firebase Storage, saves signed URL in Firestore
9. Client shows video player + download button

---

## Bugs Fixed (Verify These Are Actually Resolved)

### 1. Firebase Admin build-time crash
- **Symptom:** Vercel build failed with `Cannot read properties of undefined (reading 'replace')` 
- **Root cause:** `FIREBASE_PRIVATE_KEY` was undefined at build time; firebase-admin tried to call `.replace()` on it during module initialisation
- **Fix applied:** `src/lib/firebase-admin.ts` now uses a lazy Proxy pattern — Admin SDK only initialises on first actual request, not at import time
- **Verify:** Build succeeds and `/api/generate` works at runtime

### 2. Video downloaded as 313 bytes (corrupted)
- **Symptom:** Videos stored in Firebase were 313B MP4 files, unplayable
- **Root cause:** Status route was calling `/v1/files/retrieve` which returns JSON metadata, not video bytes
- **Fix applied:** Changed to `/v1/files/retrieve_content` which streams the actual MP4
- **Verify:** After a successful generation, Firebase Storage `output.mp4` should be >1MB; a size check (`> 10000 bytes`) now throws an error if MiniMax returns garbage

### 3. 1080P + 10s combination
- **Symptom:** UI allowed selecting 1080P + 10s which MiniMax does not support
- **Fix applied (UI only):** When 1080P is selected, 10s button is disabled and duration auto-resets to 6s
- **⚠️ NOT YET SERVER-ENFORCED** — see Critical Issues below

---

## Critical Issues to Fix

### CRITICAL 1 — No server-side validation of resolution + duration
The UI disables 1080P + 10s but **nothing stops a direct API call or prompt injection** from sending `resolution=1080P&duration=10`. MiniMax will reject it but we get an unhelpful error instead of a clean validation.

**Fix needed in `src/app/api/generate/route.ts`:**
```ts
// After extracting resolution and duration from formData, add:
if (resolution === "1080P" && duration === 10) {
  return NextResponse.json(
    { error: "1080P is only available at 6s duration." },
    { status: 400 }
  );
}
// Also whitelist valid combos entirely:
const validCombos = [
  { resolution: "768P", duration: 6 },
  { resolution: "768P", duration: 10 },
  { resolution: "1080P", duration: 6 },
];
const isValid = validCombos.some(
  (c) => c.resolution === resolution && c.duration === duration
);
if (!isValid) {
  return NextResponse.json({ error: "Invalid resolution/duration combination." }, { status: 400 });
}
```

### CRITICAL 2 — No rate limiting
Any authenticated user can spam `/api/generate` indefinitely, running up MiniMax bills.

**Fix needed:**
- Add a `RATE_LIMIT_PER_USER_PER_DAY` env var (e.g. `5`)
- Before creating a video job, query Firestore for jobs created by this user in the last 24h
- If count >= limit, return 429
- Example Firestore query:
```ts
const since = Date.now() - 24 * 60 * 60 * 1000;
const recent = await adminDb
  .collection("jobs")
  .where("userId", "==", userId)
  .where("createdAt", ">", since)
  .get();
if (recent.size >= parseInt(process.env.RATE_LIMIT_PER_USER_PER_DAY || "5")) {
  return NextResponse.json({ error: "Daily limit reached." }, { status: 429 });
}
```
- Note: `userId` is not currently stored on job docs — needs to be added

### CRITICAL 3 — Kill switch env variable not implemented
The owner wants to be able to disable all video generation from Vercel env vars without a code deploy.

**Fix needed in `src/app/api/generate/route.ts` (at the very top of the POST handler):**
```ts
if (process.env.VIDEO_GENERATION_ENABLED === "0") {
  return NextResponse.json(
    { error: "Video generation is temporarily disabled." },
    { status: 503 }
  );
}
```
Add `VIDEO_GENERATION_ENABLED=1` to Vercel env vars. Setting it to `0` from the Vercel dashboard (no redeploy needed for env var changes) instantly disables all generation.

### CRITICAL 4 — Jobs are not scoped to users
All jobs in Firestore are visible to all authenticated users via `POST /api/status`. This means any signed-in user can see every other user's jobs and videos.

**Fix needed:**
- Store `userId: user.uid` on job creation in `generate/route.ts` (need to pass auth token from client)
- Filter Firestore queries by `userId` in `status/route.ts`
- Add Firestore security rules so users can only read/write their own docs

### CRITICAL 5 — Firebase Storage signed URLs expire in 7 days for images
Image signed URLs currently expire in 7 days. After that, the cover image and source images become inaccessible. For the video, a 1-year expiry was set, which is better but still temporary.

**Options:**
- Use `makePublic()` after setting Storage rules appropriately, OR
- Re-generate signed URLs on access (more complex), OR
- Store images in a bucket with uniform public access

---

## Env Variables Required

| Variable | Where Set | Purpose |
|---|---|---|
| `MINIMAX_API_KEY` | Vercel + `.env.local` | MiniMax API auth |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Vercel + `.env.local` | Firebase client |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Vercel + `.env.local` | Firebase client |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Vercel + `.env.local` | Firebase client |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Vercel + `.env.local` | Firebase client + server |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Vercel + `.env.local` | Firebase client |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Vercel + `.env.local` | Firebase client |
| `FIREBASE_PROJECT_ID` | Vercel + `.env.local` | Firebase Admin |
| `FIREBASE_CLIENT_EMAIL` | Vercel + `.env.local` | Firebase Admin |
| `FIREBASE_PRIVATE_KEY` | Vercel + `.env.local` | Firebase Admin (wrap in quotes, keep `\n`) |
| `VIDEO_GENERATION_ENABLED` | **Vercel only** | Set to `0` to kill all generation instantly |
| `RATE_LIMIT_PER_USER_PER_DAY` | **Vercel only** | Max videos per user per 24h (e.g. `5`) |

---

## MiniMax API Reference

- **Create task:** `POST https://api.minimax.io/v1/video_generation`
- **Query task:** `GET https://api.minimax.io/v1/query/video_generation?task_id=xxx`
- **Download video:** `GET https://api.minimax.io/v1/files/retrieve_content?file_id=xxx` ← use this, NOT `/retrieve`
- **Supported combos for MiniMax-Hailuo-2.3:**
  - 768P + 6s ✅
  - 768P + 10s ✅
  - 1080P + 6s ✅
  - 1080P + 10s ❌ NOT SUPPORTED

---

## Style Prompts (in minimax.ts)

Each video style maps to a pre-built camera direction + scene description using MiniMax's `[command]` syntax:

| Style | Command | Intent |
|---|---|---|
| walkthrough | `[Push in]` | Smooth cinematic interior push |
| remove_furniture | `[Push in]` | Empty/unfurnished room walkthrough |
| drone | `[Pedestal up]` | Rising aerial exterior reveal |
| day_to_night | `[Static shot]` | Time-lapse daylight to twilight |
| virtual_staging | `[Push in]` | Furnished interior with modern decor |

---

## Things to Verify End-to-End

- [ ] Sign in with Google works on production domain
- [ ] Image upload → Firebase Storage works (check signed URL is accessible)
- [ ] MiniMax task created (check Firestore `minimaxTaskId` is populated)
- [ ] Status polling transitions from `processing` → `success`
- [ ] Downloaded video in Firebase > 1MB and plays in browser
- [ ] Video signed URL accessible from browser (not expired)
- [ ] Jobs dashboard shows correct status badges
- [ ] 1080P + 10s blocked both at UI level AND server level
- [ ] `VIDEO_GENERATION_ENABLED=0` returns 503 immediately
- [ ] Rate limit kicks in after configured threshold
- [ ] Users can only see their own jobs

---

## Known Remaining Gaps (Not Yet Implemented)

1. No email notifications when video is ready
2. No Stripe/payment integration
3. No per-user job isolation in Firestore queries
4. No retry mechanism if MiniMax task fails transiently
5. No soft delete for jobs
6. Firebase Storage rules still wide open (`allow read, write: if true`)
7. No loading skeleton on Jobs page
8. `userId` not stored on job documents (needed for scoping + rate limiting)

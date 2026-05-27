# Harbill

## Run locally

1. Start MySQL in Laragon.
2. Configure `api/.env` from `api/.env.example`.
3. Prepare the database:

```powershell
cd api
npm install
npm run migrate
```

4. Run the API:

```powershell
npm run dev
```

5. Run the client in another terminal:

```powershell
cd client
npm install
npm run dev
```

API: http://localhost:3001
Client: http://localhost:5173

## Google Login

In Google Cloud Console, add this Authorized redirect URI:

```text
http://localhost:3001/auth/google/callback
```

Then set these values in `api/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

You can check API, DB, and Google config at:

```text
http://localhost:3001/health
```

## Optional Revenue

The client can show a small support link and an AdSense ad slot when these env values are set:

```env
VITE_SUPPORT_URL=https://ko-fi.com/yourname
VITE_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
VITE_ADSENSE_SLOT=1234567890
```

Leave them blank while developing or before AdSense approval. The app also caches common API reads in the browser for a few minutes to reduce database traffic.

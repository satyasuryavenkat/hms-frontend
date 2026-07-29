# HMS Frontend

Create React App frontend for the Hospital Management System.

## Local development

Requirements: Node.js 20 or newer and the HMS backend on port `8080`.

```powershell
npm ci
npm start
```

Requests to `/api` are proxied to `http://localhost:8080`. Copy `.env.example` to
`.env.local` only if you need to override the API URL.

## Deploy to Vercel

1. Push this directory to its own GitHub repository.
2. In Vercel, choose **Add New > Project** and import that repository.
3. Vercel detects Create React App. The committed `vercel.json` explicitly sets:
   - Build command: `npm run build`
   - Output directory: `build`
4. If the Render backend already exists, add this Production environment variable:

   ```text
   REACT_APP_API_BASE_URL=https://YOUR-BACKEND.onrender.com/api/v1
   ```

5. Deploy. Copy the final `https://YOUR-FRONTEND.vercel.app` origin into the
   backend's `CORS_ORIGINS` variable in Render, without a trailing slash.
6. If this was the first service deployed, create the Render backend next, then
   return to Vercel, add `REACT_APP_API_BASE_URL`, and redeploy. This two-pass
   sequence resolves the fact that each service needs the other's final URL.

`REACT_APP_*` variables are compiled into the browser bundle. They must never
contain database passwords, JWT secrets, or other server-side credentials.

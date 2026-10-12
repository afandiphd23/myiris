// Vercel serverless entry — kongsi Express app yang sama dengan server/app.ts.
// vercel.json rewrite /api/:path* → /api supaya semua endpoint berfungsi.
import { app } from "../server/app.js";

export default app;

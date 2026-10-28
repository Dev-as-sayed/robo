import { Router } from "express";
import { deletionPageHtml, deletionPageScript } from "./deletion-page";

const router = Router();

const pageCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

router.get("/delete", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Content-Security-Policy", pageCsp);
  res.type("html").send(deletionPageHtml);
});

router.get("/delete.js", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.type("application/javascript").send(deletionPageScript);
});

export default router;

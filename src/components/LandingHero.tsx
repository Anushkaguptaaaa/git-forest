"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export function LandingHero() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = username.trim().replace(/^@/, "");
    if (!cleaned) return;
    router.push(`/${encodeURIComponent(cleaned)}`);
  }

  return (
    <main className="landing">
      <div className="forest-bg absolute inset-0" aria-hidden />
      <div className="crt-overlay pointer-events-none absolute inset-0 z-20" aria-hidden />

      <div className="landing-inner">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="landing-content"
        >
          <p className="landing-eyebrow font-pixel">Public profiles · no login</p>
          <h1 className="brand-title font-display">Git Forest</h1>
          <p className="landing-lede">
            Every repository becomes a tree. Enter a GitHub username and wander a
            world grown from their public code.
          </p>

          <form onSubmit={onSubmit} className="landing-form">
            <label className="sr-only" htmlFor="username">
              GitHub username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="github username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pixel-input landing-input"
              spellCheck={false}
            />
            <button type="submit" className="pixel-btn landing-submit">
              Grow forest
            </button>
          </form>

          <p className="landing-try font-pixel">
            Try{" "}
            <button type="button" className="landing-link" onClick={() => router.push("/torvalds")}>
              torvalds
            </button>
            {" · "}
            <button type="button" className="landing-link" onClick={() => router.push("/gaearon")}>
              gaearon
            </button>
            {" · "}
            <button type="button" className="landing-link" onClick={() => router.push("/vercel")}>
              vercel
            </button>
          </p>
        </motion.div>
      </div>

      <footer className="landing-footer font-pixel">WASD · drag · scroll to explore</footer>
    </main>
  );
}

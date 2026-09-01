"use client";

import Link from "next/link";
import { useState } from "react";

export type ProductNavId = "home" | "app";

const LINKS: Array<{ id: ProductNavId; href: string; label: string }> = [
  { id: "home", href: "/", label: "Home" },
  { id: "app", href: "/app", label: "Product" },
];

export function SiteChrome({
  current,
  children,
}: {
  current: ProductNavId;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="topnav">
        <div className="container topnav-inner">
          <Link className="logo" href="/">
            Lokutara
          </Link>
          <nav aria-label="Primary">
            {LINKS.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className={current === link.id ? "is-current" : undefined}
                aria-current={current === link.id ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <a href="/#contact">Contact</a>
          </nav>
          <Link className="btn btn-secondary" href="/#contact">
            Book discovery
          </Link>
          <button
            type="button"
            className={`nav-toggle${open ? " is-open" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        <div className={`mobile-nav${open ? " is-open" : ""}`}>
          {LINKS.map((link) => (
            <Link key={link.id} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <a href="/#contact" onClick={() => setOpen(false)}>
            Contact
          </a>
          <Link className="btn btn-primary" href="/#contact" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>
            Book discovery
          </Link>
        </div>
      </header>
      {children}
      <footer className="pagefoot">
        <div className="container row-between">
          <p className="meta">Lokutara · one product, one dashboard</p>
          <p className="meta">
            <Link href="/privacy">Privacy</Link>
            {" · "}
            <Link href="/terms">Terms</Link>
            {" · "}
            <Link href="/safeguards">Safeguards</Link>
            {" · "}
            <Link href="/cookies">Cookies</Link>
          </p>
        </div>
      </footer>
    </>
  );
}

const year = 2026;

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 px-6 py-8 text-sm text-slate-500 dark:border-slate-800">
      <p id="footer-copy">© {year} Harbor Studio</p>
    </footer>
  );
}

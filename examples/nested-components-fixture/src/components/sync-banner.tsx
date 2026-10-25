export function SyncBanner({ visible }: { visible: boolean }) {
  return (
    <footer className="border-t border-stone-200 pt-6">
      {visible && (
        <p id="sync-banner" className="text-sm text-emerald-700">
          All notes are backed up locally.
        </p>
      )}
    </footer>
  );
}

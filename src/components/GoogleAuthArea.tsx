import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { loadGis, decodeJwt, toGoogleUser, type GoogleUser } from "../lib/googleAuth";

/** Butang Sign-In Google rasmi (GIS) dengan status + cuba semula bila skrip disekat. */
export function GisButton({ clientId, onLogin }: { clientId: string; onLogin: (u: GoogleUser) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    setFailed(false);
    loadGis()
      .then(() => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: any) => {
            const u = toGoogleUser(decodeJwt(String(resp?.credential ?? "")) ?? {});
            if (u) onLogin(u);
          },
        });
        (window as any).google.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "medium",
          text: "signin_with",
          shape: "rectangular",
        });
      })
      .catch((e: any) => {
        if (!cancelled) {
          setFailed(true);
          try {
            console.warn("[IRIS] GIS gagal dimuat:", e?.message ?? e);
          } catch {
            /* abaikan */
          }
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, attempt]);
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <div ref={ref} className="gis-btn min-h-[32px]" />
      {failed && (
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          title="Skrip Google disekat (adblocker/rangkaian) — klik untuk cuba semula"
          className="rounded border border-slate-600 px-3 py-1.5 text-[11px] text-slate-300 hover:border-sky-500 hover:text-white transition-colors"
        >
          G Sign-in disekat — cuba semula
        </button>
      )}
    </span>
  );
}

/** Paparan pengguna log masuk + butang keluar. */
export function UserChip({
  user,
  onLogout,
  logoutLabel,
  light = false,
}: {
  user: GoogleUser;
  onLogout: () => void;
  logoutLabel: string;
  light?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        light ? "border-slate-600 bg-slate-900/70 text-slate-100" : "border-slate-700 bg-slate-900 py-1 pl-1 pr-2 text-xs text-slate-200"
      }`}
    >
      {user.picture ? (
        <img src={user.picture} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-slate-950">
          {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-[160px] truncate">{user.name}</span>
      <button
        type="button"
        onClick={onLogout}
        title={logoutLabel}
        aria-label={logoutLabel}
        className="rounded p-1 text-slate-400 hover:text-white transition-colors"
      >
        <LogOut size={13} />
      </button>
    </span>
  );
}

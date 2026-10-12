import { useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import { loadGis, decodeJwt, toGoogleUser, type GoogleUser } from "../lib/googleAuth";

/** Butang Sign-In Google rasmi (GIS). Selamat jika skrip disekat — ruang kekal kosong. */
export function GisButton({ clientId, onLogin }: { clientId: string; onLogin: (u: GoogleUser) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
  return <div ref={ref} className="gis-btn min-h-[32px]" />;
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

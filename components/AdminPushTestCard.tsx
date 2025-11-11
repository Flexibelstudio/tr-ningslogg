// AdminPushTestCard.tsx
import React, { useState } from "react";
import { httpsCallable, getFunctions } from "firebase/functions";
import { getApp } from "firebase/app";
import { useAuth } from "../context/AuthContext";
import { ensureWebPushSubscription } from "../utils/push";
import { Button } from "./Button";

export const AdminPushTestCard: React.FC = () => {
  const auth = useAuth();
  const [participantId, setParticipantId] = useState<string>(auth.currentParticipantId || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const canSend = Boolean(auth.organizationId && (participantId?.trim().length > 0));

  const sendTest = async () => {
    setMsg("");
    if (!auth.organizationId) {
      setMsg("❌ Saknar organizationId.");
      return;
    }
    if (!participantId) {
      setMsg("❌ Ange participantId eller växla till medlemsvy.");
      return;
    }

    try {
      setBusy(true);
      // 1) Säkerställ subscription i Firestore
      await ensureWebPushSubscription(auth.organizationId, participantId);

      // 2) Anropa callable sendTestPush
      const fns = getFunctions(getApp());
      const call = httpsCallable(fns, "sendTestPush");
      await call({ orgId: auth.organizationId, participantId });

      setMsg("✅ Testnotis skickad! Kontrollera att den dök upp.");
    } catch (e: any) {
      setMsg("❌ Misslyckades: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-2">Pushnotiser – test</h3>
      <p className="text-sm text-gray-600 mb-3">
        Skicka en testnotis. Om du “visar som medlem” fylls participantId automatiskt.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end mb-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Participant ID</label>
          <input
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            placeholder="participantId"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-flexibel focus:border-flexibel"
          />
          {auth.currentParticipantId && (
            <p className="mt-1 text-[11px] text-gray-500">
              Aktuell medlemsvy: <code>{auth.currentParticipantId}</code> – du kan skriva över.
            </p>
          )}
        </div>

        <Button disabled={!canSend || busy} onClick={sendTest}>
          {busy ? "Skickar..." : "Skicka test-push"}
        </Button>
      </div>

      {msg && <div className="text-sm">{msg}</div>}

      <ul className="mt-3 text-xs text-gray-500 list-disc pl-4">
        <li>Notis-tillstånd måste vara godkänt (Notification.permission = "granted").</li>
        <li><code>sw.js</code> ska vara aktiv (DevTools → Application → Service Workers).</li>
        <li>Firestore: <code>organizations/&lt;orgId&gt;/userPushSubscriptions</code> ska få en rad.</li>
      </ul>
    </div>
  );
};

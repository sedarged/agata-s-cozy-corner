import { useEffect } from "react";
import { toast } from "sonner";

export function QuotaToastListener() {
  useEffect(() => {
    function onQuota(e: Event) {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined;
      toast.error(
        detail?.message ||
          "Brak miejsca na tym urządzeniu. Wykonaj kopię zapasową i usuń niepotrzebne pozycje.",
        {
          description: "Ustawienia → Kopia zapasowa pozwala wyeksportować dane.",
          duration: 8000,
        },
      );
    }
    window.addEventListener("agata:quota", onQuota);
    return () => window.removeEventListener("agata:quota", onQuota);
  }, []);
  return null;
}

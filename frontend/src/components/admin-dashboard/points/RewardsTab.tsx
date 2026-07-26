"use client";

/**
 * Shell for the Rewards tab in the admin Points dashboard. Owns the
 * Catalog / Redemptions panel switch + the create/edit modal. The
 * catalog grid and redemptions table live in their own files so this
 * file stays focused on state coordination.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { pointsAdminApi, type AdminReward } from "@/lib/api";
import RewardsCatalog from "./RewardsCatalog";
import RewardsRedemptions from "./RewardsRedemptions";
import RewardFormModal from "./RewardFormModal";

type Panel = "catalog" | "redemptions";

export default function RewardsTab() {
  const t = useTranslations("adminDashboard.points.rewards");
  const [panel, setPanel] = useState<Panel>("catalog");
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminReward | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await pointsAdminApi.listRewards();
      setRewards(list);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-[var(--color-surface-page)] rounded-lg p-1">
          <TabPill active={panel === "catalog"} onClick={() => setPanel("catalog")}>
            {t("panels.catalog")}
          </TabPill>
          <TabPill
            active={panel === "redemptions"}
            onClick={() => setPanel("redemptions")}
          >
            {t("panels.redemptions")}
          </TabPill>
        </div>
        {panel === "catalog" && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            {t("createBtn")}
          </button>
        )}
      </div>

      {panel === "catalog" ? (
        <RewardsCatalog
          rewards={rewards}
          loading={loading}
          onCreate={() => setCreating(true)}
          onEdit={(r) => setEditing(r)}
          onReload={load}
        />
      ) : (
        <RewardsRedemptions />
      )}

      {(creating || editing) && (
        <RewardFormModal
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm font-medium transition ${
        active
          ? "bg-white shadow-sm text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

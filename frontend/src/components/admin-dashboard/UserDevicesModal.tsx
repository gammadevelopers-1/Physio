"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { adminApi, User, TrustedDevice, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Smartphone, X, Loader2 } from "lucide-react";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";

interface UserDevicesModalProps {
  user: User;
  onClose: () => void;
}

function getUserName(user: User): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : user.email;
}

function getInitials(user: User): string {
  const first = user.firstName?.[0] || "";
  const last = user.lastName?.[0] || "";
  if (first || last) return (first + last).toUpperCase();
  return user.email[0].toUpperCase();
}

export default function UserDevicesModal({ user, onClose }: UserDevicesModalProps) {
  const t = useTranslations("securitySettings");
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.getUserTrustedDevices(user.id);
      setDevices(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleRevokeDevice = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      await adminApi.revokeUserDevice(user.id, deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      toast.success(t("trustedDevices.adminRevokeSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to revoke device");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await adminApi.revokeAllUserDevices(user.id);
      setDevices([]);
      setShowRevokeAllConfirm(false);
      toast.success(t("trustedDevices.adminRevokeAllSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to revoke devices");
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#002D87] flex items-center justify-center">
                <span className="text-sm font-medium text-white">{getInitials(user)}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1F2937]">{getUserName(user)}</h2>
                <p className="text-xs text-[#6B7280]">{t("trustedDevices.title")}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg">
              <X className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#002D87]" />
            </div>
          ) : (
            <TrustedDevicesSection
              devices={devices}
              revokingId={revokingId}
              revokingAll={revokingAll}
              showRevokeAllConfirm={showRevokeAllConfirm}
              onRevokeDevice={handleRevokeDevice}
              onRevokeAll={handleRevokeAll}
              onShowRevokeAllConfirm={setShowRevokeAllConfirm}
            />
          )}

          {/* Close Button */}
          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full h-10 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

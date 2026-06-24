"use client";

import { createContext, useContext, ReactNode } from "react";

export type ActorRole = "finance" | "admin";

const ActorRoleContext = createContext<ActorRole>("finance");

/**
 * Lets admin-side wrappers tell the finance-dashboard inner components
 * that the current actor is an admin (not a finance manager). Inner
 * components read this with `useActorRole()` and conditionally render
 * admin-only super-actions (force-status, replay webhook, bypass refund
 * policy, etc.) without prop-drilling.
 */
export function ActorRoleProvider({
  role,
  children,
}: {
  role: ActorRole;
  children: ReactNode;
}) {
  return (
    <ActorRoleContext.Provider value={role}>{children}</ActorRoleContext.Provider>
  );
}

export function useActorRole(): ActorRole {
  return useContext(ActorRoleContext);
}

export function useIsAdminActor(): boolean {
  return useContext(ActorRoleContext) === "admin";
}

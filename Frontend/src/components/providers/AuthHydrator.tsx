"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

export function AuthHydrator() {
  useEffect(() => {
    void useAuthStore.getState().hydrate();
  }, []);

  return null;
}

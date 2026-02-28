import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  
  // Bypass type checking by casting the api reference to any first
  const currentUserQuery = (api as any).users.currentUser;
  const userQuery = useQuery(currentUserQuery);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && userQuery !== undefined) {
      setIsLoading(false);
    }
  }, [isAuthLoading, userQuery]);

  return {
    isLoading,
    isAuthenticated,
    user: userQuery ?? null,
    signIn,
    signOut,
  };
}
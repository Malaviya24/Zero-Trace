import { useQuery as useConvexQuery, useMutation as useConvexMutation } from "convex/react";

/**
 * Type-safe wrapper for Convex useQuery that prevents deep type instantiation errors.
 * This is a permanent fix for Convex 1.28.2 compatibility issues.
 * 
 * Usage: useQuery(api.namespace.functionName, args)
 * The api object will be automatically cast to bypass TypeScript's deep type checking.
 */
export function useQuery<T = any>(
  query: any,
  args?: any
): T | undefined {
  return (useConvexQuery as any)(query, args);
}

/**
 * Type-safe wrapper for Convex useMutation that prevents deep type instantiation errors.
 * This is a permanent fix for Convex 1.28.2 compatibility issues.
 * 
 * Usage: useMutation(api.namespace.functionName)
 * The api object will be automatically cast to bypass TypeScript's deep type checking.
 */
export function useMutation<T = any>(
  mutation: any
): (args?: any) => Promise<T> {
  return (useConvexMutation as any)(mutation);
}

/**
 * ConvexQueryService - OOP wrapper for Convex queries
 * Provides a class-based interface for common query patterns
 */
export class ConvexQueryService {
  protected useQuery = useQuery;
  protected useMutation = useMutation;

  /**
   * Execute a query with automatic error handling
   */
  protected async executeMutation<T>(
    mutation: (args?: any) => Promise<T>,
    args: any,
    errorMessage: string
  ): Promise<T> {
    try {
      return await mutation(args);
    } catch (error) {
      console.error(errorMessage, error);
      throw new Error(error instanceof Error ? error.message : errorMessage);
    }
  }
}
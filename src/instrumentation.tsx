import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/app/AppUI";
import { Dialog } from "@radix-ui/react-dialog";
import { ChevronDown, ExternalLink } from "lucide-react";
import React, { useEffect, useState } from "react";

type SyncError = {
  error: string;
  stack: string;
  filename: string;
  lineno: number;
  colno: number;
};

type AsyncError = {
  error: string;
  stack: string;
};

type GenericError = SyncError | AsyncError;

const IS_DEV = import.meta.env.DEV;

function getSafeCurrentUrlForReporting(): string {
  try {
    const url = new URL(window.location.href);
    url.hash = "";
    return url.toString();
  } catch {
    return window.location.origin;
  }
}

function getSafeMonitoringEndpoint(): string | null {
  const rawEndpoint = import.meta.env.VITE_VLY_MONITORING_URL;
  if (!import.meta.env.VITE_VLY_APP_ID || !rawEndpoint) {
    return null;
  }

  try {
    const endpoint = new URL(rawEndpoint, window.location.origin);
    if (endpoint.protocol === "https:") return endpoint.toString();
    const isLocalHttp = endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname);
    return IS_DEV && isLocalHttp ? endpoint.toString() : null;
  } catch {
    return null;
  }
}

function normalizePromiseRejection(reason: unknown): AsyncError {
  if (reason instanceof Error) {
    return {
      error: reason.message || "Unhandled promise rejection",
      stack: reason.stack || "",
    };
  }

  if (typeof reason === "string") {
    return { error: reason, stack: "" };
  }

  return {
    error: "Unhandled promise rejection",
    stack: "",
  };
}

async function reportErrorToVly(errorData: {
  error: string;
  stackTrace?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
}) {
  const endpoint = getSafeMonitoringEndpoint();
  if (!endpoint) {
    return;
  }

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "omit",
      keepalive: true,
      referrerPolicy: "no-referrer",
      body: JSON.stringify({
        ...errorData,
        url: getSafeCurrentUrlForReporting(),
        projectSemanticIdentifier: import.meta.env.VITE_VLY_APP_ID,
      }),
    });
  } catch (error) {
    console.error("Failed to report error to Vly:", error);
  }
}

function ErrorDialog({
  error,
  setError,
}: {
  error: GenericError;
  setError: (error: GenericError | null) => void;
}) {
  const canOpenEditor = IS_DEV && Boolean(import.meta.env.VITE_VLY_APP_ID);
  const canShowDetails = IS_DEV && !!error.stack;

  return (
    <Dialog
      defaultOpen={true}
      onOpenChange={() => {
        setError(null);
      }}
    >
      <DialogContent className="max-w-4xl border-2 border-red-500 bg-[#120708] text-white">
        <DialogHeader>
          <DialogTitle>Runtime Error</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-white/80">
          Something went wrong while rendering this screen. Refresh the page or rejoin the room if the problem persists.
        </p>
        {canShowDetails ? (
          <div className="mt-4">
            <Collapsible>
              <CollapsibleTrigger>
                <div className="flex cursor-pointer items-center font-bold">
                  See error details <ChevronDown />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="max-w-[460px]">
                <div className="mt-2 max-h-60 max-w-full overflow-x-auto bg-neutral-900 p-3 text-sm text-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <pre className="whitespace-pre">{error.stack}</pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : null}
        {canOpenEditor ? (
          <DialogFooter>
            <a
              href={`https://vly.ai/project/${import.meta.env.VITE_VLY_APP_ID}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Button>
                <ExternalLink /> Open editor
              </Button>
            </a>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type ErrorBoundaryState = {
  hasError: boolean;
  error: GenericError | null;
};

class ErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
  },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void reportErrorToVly({
      error: error.message,
      stackTrace: error.stack,
    });

    this.setState({
      hasError: true,
      error: {
        error: error.message,
        stack: IS_DEV ? info.componentStack ?? error.stack ?? "" : "",
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorDialog error={{ error: "An error occurred", stack: "" }} setError={() => {}} />;
    }

    return this.props.children;
  }
}

export function InstrumentationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [error, setError] = useState<GenericError | null>(null);

  useEffect(() => {
    const handleError = async (event: ErrorEvent) => {
      try {
        event.preventDefault();
        setError({
          error: event.message,
          stack: IS_DEV ? event.error?.stack || "" : "",
          filename: event.filename || "",
          lineno: event.lineno,
          colno: event.colno,
        });

        await reportErrorToVly({
          error: event.message,
          stackTrace: event.error?.stack,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      } catch (error) {
        console.error("Error in handleError:", error);
      }
    };

    const handleRejection = async (event: PromiseRejectionEvent) => {
      try {
        const normalized = normalizePromiseRejection(event.reason);
        setError({
          error: normalized.error,
          stack: IS_DEV ? normalized.stack : "",
        });

        await reportErrorToVly({
          error: normalized.error,
          stackTrace: normalized.stack,
        });
      } catch (error) {
        console.error("Error in handleRejection:", error);
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return (
    <>
      <ErrorBoundary>{children}</ErrorBoundary>
      {error ? <ErrorDialog error={error} setError={setError} /> : null}
    </>
  );
}

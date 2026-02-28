import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Camera, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QRScannerProps {
  onClose: () => void;
}

export function QRScanner({ onClose }: QRScannerProps) {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Successfully scanned QR code
            console.log("QR Code scanned:", decodedText);
            
            // Extract room ID from URL or use directly
            let roomId = decodedText;
            try {
              const url = new URL(decodedText);
              const pathParts = url.pathname.split("/");
              const joinIndex = pathParts.indexOf("join");
              if (joinIndex !== -1 && pathParts[joinIndex + 1]) {
                roomId = pathParts[joinIndex + 1];
              }
            } catch {
              // Not a URL, use as-is
            }

            // Validate room ID format
            if (!roomId || roomId.trim().length === 0) {
              toast.error("Invalid QR code: No room ID found");
              return;
            }

            // Stop scanner and navigate
            scanner.stop().then(() => {
              toast.success("QR Code scanned successfully!");
              navigate(`/join/${roomId}`);
            }).catch((err) => {
              console.error("Failed to stop scanner:", err);
              navigate(`/join/${roomId}`);
            });
          },
          (errorMessage) => {
            // Scanning error (can be ignored for continuous scanning)
            console.debug("QR scan error:", errorMessage);
          }
        );

        setIsScanning(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to start QR scanner:", error);
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        
        if (errorMsg.includes("Permission") || errorMsg.includes("NotAllowedError")) {
          setError("Camera access denied. Please allow camera permissions in your browser settings.");
          toast.error("Camera access denied");
        } else if (errorMsg.includes("NotFoundError") || errorMsg.includes("NotReadableError")) {
          setError("No camera found or camera is already in use by another application.");
          toast.error("Camera not available");
        } else {
          setError("Failed to access camera. Please try again.");
          toast.error("Failed to start scanner");
        }
        
        setIsLoading(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
          })
          .catch((err) => console.error("Failed to stop scanner:", err));
      }
    };
  }, [navigate]);

  const handleClose = () => {
    if (scannerRef.current && isScanning) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current?.clear();
          onClose();
        })
        .catch((err) => {
          console.error("Failed to stop scanner:", err);
          onClose();
        });
    } else {
      onClose();
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Camera className="h-5 w-5 text-primary" />
            Scan QR Code
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Close scanner"
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Loading State */}
            {isLoading && !error && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Starting camera...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Scanner View */}
            <div
              id="qr-reader"
              className={`w-full rounded-lg overflow-hidden border-2 ${
                isScanning ? "border-primary" : "border-muted"
              } ${isLoading || error ? "hidden" : ""}`}
            />

            {/* Instructions */}
            {isScanning && !error && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Position the QR code within the frame to scan
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span>Scanning...</span>
                </div>
              </div>
            )}

            {/* Retry Button */}
            {error && (
              <Button
                onClick={handleRetry}
                className="w-full"
                variant="outline"
              >
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
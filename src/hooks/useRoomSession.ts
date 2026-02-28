import { useState, useEffect, useRef } from 'react';
import { RoomService } from '@/services/RoomService';
import { EncryptionService } from '@/services/EncryptionService';

/**
 * Custom hook for managing room sessions with OOP services
 */
export function useRoomSession(roomId: string | undefined, locationHash: string) {
  const [roomService, setRoomService] = useState<RoomService | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [sessionData, setSessionData] = useState<{
    displayName: string;
    avatar: string;
    participantId: string;
    encryptionKey: CryptoKey;
  } | null>(null);
  const [hasUrlKey, setHasUrlKey] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!roomId) {
      setIsRestoring(false);
      return;
    }

    const service = new RoomService(roomId);
    setRoomService(service);

    const initializeSession = async () => {
      try {
        // Try to restore existing session
        const restored = await service.restoreSession();
        if (!isMountedRef.current) return;
        
        if (restored) {
          setSessionData(restored);
          setIsRestoring(false);
          return;
        }

        // Try to initialize from URL
        const hasKey = await service.initializeFromUrl(locationHash);
        if (!isMountedRef.current) return;
        
        setHasUrlKey(hasKey);

        // Generate new identity if no session and we have a key
        if (hasKey && service.getEncryptionService().hasKey()) {
          const identity = EncryptionService.generateAnonymousIdentity();
          setSessionData({
            ...identity,
            participantId: '',
            encryptionKey: service.getEncryptionService().getKey()!,
          });
        }

        setIsRestoring(false);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        if (!isMountedRef.current) return;
        setIsRestoring(false);
      }
    };

    initializeSession();
  }, [roomId, locationHash]);

  return {
    roomService,
    isRestoring,
    sessionData,
    hasUrlKey,
    setSessionData,
  };
}
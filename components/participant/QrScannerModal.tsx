import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Modal } from '../Modal';
import { Workout, Exercise, WorkoutBlock, LiftType, LoggableMetric, SetDetail } from '../../types';
import jsQR from 'jsqr';
import { Button } from '../Button';

// --- NEW INTERFACES for QR Code data structure ---
interface QrCodeExercise {
  name: string;
  sets: number;
  reps: string;
  baseLiftType?: string;
  isBodyweight?: boolean;
  loggableMetrics?: LoggableMetric[];
}

interface QrCodeBlock {
  name: string;
  exercises: QrCodeExercise[];
}

interface QrCodeWorkout {
  title: string;
  blocks: QrCodeBlock[];
}
// --- END NEW INTERFACES ---

// --- NEW TRANSFORMER FUNCTION ---
const transformQrDataToWorkout = (qrData: QrCodeWorkout): Omit<Workout, 'id' | 'isPublished'> => {
    return {
      title: qrData.title,
      category: 'Workout', // Default category for scanned WODs
      coachNote: 'Pass skannat från QR-kod.',
      blocks: qrData.blocks.map((qrBlock): WorkoutBlock => {
        const nameLower = qrBlock.name.toLowerCase();
        const quickLogKeywords = ['amrap', 'rft', 'rounds for time', 'varv'];
        const isQuickLog = quickLogKeywords.some(keyword => nameLower.includes(keyword));

        return {
            id: crypto.randomUUID(),
            name: qrBlock.name,
            isQuickLogEnabled: isQuickLog,
            exercises: qrBlock.exercises.map((qrEx): Exercise => {
              let finalName = qrEx.name;
              let displayReps = qrEx.reps;
              let finalNotes = '';
              let finalLoggableMetrics: LoggableMetric[] = qrEx.isBodyweight ? ['reps'] : (qrEx.loggableMetrics || ['reps', 'weight']);
              let prefillNotePart = '';

              const prefixMetricRegex = /^([\d.]+)\s*(reps?|m|s|kcal|kg)\s+/i;
              const match = qrEx.name.match(prefixMetricRegex);

              if (match) {
                  const value = match[1];
                  const unit = match[2].toLowerCase();
                  
                  finalName = qrEx.name.substring(match[0].length).trim();
                  displayReps = `${value} ${unit}`;

                  let metric: LoggableMetric | null = null;
                  let metricKey: keyof Omit<SetDetail, 'id'|'isCompleted'> | null = null;
                  
                  if (unit.startsWith('rep')) { metric = 'reps'; metricKey = 'reps'; }
                  else if (unit === 'kg') { metric = 'weight'; metricKey = 'weight'; }
                  else if (unit === 'm') { metric = 'distance'; metricKey = 'distanceMeters'; }
                  else if (unit === 's') { metric = 'duration'; metricKey = 'durationSeconds'; }
                  else if (unit === 'kcal') { metric = 'calories'; metricKey = 'caloriesKcal'; }
                  
                  if (metric && metricKey) {
                      finalLoggableMetrics = [metric];
                      prefillNotePart = `;PREFILL:${String(metricKey)}=${value}`;
                  }
              }

              finalNotes = `${qrEx.sets} set x ${displayReps}${prefillNotePart}`;

              return {
                id: crypto.randomUUID(),
                name: finalName,
                notes: finalNotes,
                baseLiftType: qrEx.baseLiftType as LiftType,
                isBodyweight: qrEx.isBodyweight || false,
                loggableMetrics: finalLoggableMetrics,
              };
            }),
        };
      }),
    };
};
// --- END NEW TRANSFORMER FUNCTION ---


interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkoutScan: (workoutData: Omit<Workout, 'id' | 'isPublished'>) => void;
  onCheckinScan: (checkinData: { type: 'flexibel-checkin', locationId: string }) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onWorkoutScan, onCheckinScan }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const stopScan = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code) {
            stopScan(); // Stop scan loop and release camera *before* handling the result.
            try {
              // The QR code data might be a Base64 encoded JSON string, or just a raw JSON string.
              let jsonString = code.data;
              // A simple heuristic: if it doesn't look like JSON, try to decode it from Base64.
              if (!jsonString.trim().startsWith('{') && !jsonString.trim().startsWith('[')) {
                 jsonString = atob(code.data);
              }
              
              const qrCodeData = JSON.parse(jsonString);

              if (qrCodeData.type === 'flexibel-checkin' && qrCodeData.locationId) {
                onCheckinScan(qrCodeData);
                onClose();
                return; // Stop the tick function execution.
              } else if (
                typeof qrCodeData.title === 'string' &&
                Array.isArray(qrCodeData.blocks) &&
                qrCodeData.blocks.every((block: any) => 
                  typeof block.name === 'string' && Array.isArray(block.exercises)
                )
              ) {
                const workoutData = transformQrDataToWorkout(qrCodeData as QrCodeWorkout);
                onWorkoutScan(workoutData);
                onClose();
                return; // Stop the tick function execution.
              } else {
                setScanError("Okänd QR-kodstyp. Se till att det är en giltig kod för Flexibel.");
              }
            } catch (error) {
              console.error("QR Scan parse error:", error);
              setScanError("Kunde inte tolka QR-koden. Se till att det är en giltig pass- eller incheckningskod.");
            }
            // Do not request another animation frame if a code was found and handled (or errored).
            return;
          }
        }
      }
    }
    // Only request next frame if no code was found
    animationFrameId.current = requestAnimationFrame(tick);
  }, [onWorkoutScan, onCheckinScan, onClose, stopScan]);
  
  const startScan = useCallback(async () => {
    setScanError(null);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
                videoRef.current.play().catch(err => {
                    console.error("Video play failed:", err);
                    setScanError("Kunde inte starta videoströmmen.");
                });
                animationFrameId.current = requestAnimationFrame(tick);
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setScanError("Kunde inte komma åt kameran. Se till att du har gett appen tillstånd i webbläsarens inställningar.");
        }
    } else {
        setScanError("Din webbläsare stödjer inte kameraåtkomst.");
    }
  }, [tick]);

  useEffect(() => {
    if (isOpen) {
      startScan();
    } else {
      stopScan();
    }

    return () => {
      stopScan();
    };
  }, [isOpen, startScan, stopScan]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Skanna QR-kod" size="lg" showCloseButtonOnly>
        <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full h-full border-4 border-dashed border-white/50 rounded-lg" />
            </div>
             <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="mt-4 text-center">
            {scanError ? (
                <div className="p-3 bg-red-100 text-red-700 rounded-md">
                    <p className="font-semibold">Fel vid skanning</p>
                    <p className="text-sm">{scanError}</p>
                </div>
            ) : (
                <p className="text-lg text-gray-600">
                    Rikta kameran mot QR-koden.
                </p>
            )}
            <Button onClick={onClose} variant="secondary" className="mt-4">
                Avbryt
            </Button>
        </div>
    </Modal>
  );
};
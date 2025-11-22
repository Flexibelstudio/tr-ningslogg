
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { WorkoutLog, Workout, PostWorkoutSummaryData } from '../../../types';
import { WEIGHT_COMPARISONS } from '../../../constants';
import html2canvas from 'html2canvas';
import { Confetti } from '../../../components/participant/Confetti';

interface PostWorkoutSummaryModalProps {
  isOpen: boolean;
  onFinalize: () => void;
  log: WorkoutLog | null;
  workout: Workout | null; 
  onEditLog: () => void;
  isNewCompletion?: boolean;
}

const VolumeComparison: React.FC<{ summary: PostWorkoutSummaryData | undefined }> = ({ summary }) => {
    if (!summary) return null;

    if (summary.isFirstTimeLoggingWorkout) {
        return (
            <p className="mt-2 text-sm text-green-700 font-semibold animate-fade-in-down" style={{ animationDelay: '200ms' }}>
                Första gången! Nu har du en baslinje.
            </p>
        );
    }

    if (summary.volumeDifferenceVsPrevious !== undefined && summary.volumeDifferenceVsPrevious > 0) {
        return (
            <p className="mt-2 text-sm text-green-700 font-semibold animate-fade-in-down" style={{ animationDelay: '200ms' }}>
                +{summary.volumeDifferenceVsPrevious.toLocaleString('sv-SE')} kg mer än sist! 💪
            </p>
        );
    }

    return null;
};

export const PostWorkoutSummaryModal: React.FC<PostWorkoutSummaryModalProps> = ({
  isOpen,
  onFinalize,
  log,
  workout,
  onEditLog,
  isNewCompletion,
}) => {
  const shareableContentRef = useRef<HTMLDivElement>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [hasFinalized, setHasFinalized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSharingImage(false);
      setIsFinalizing(false);
      setHasFinalized(false);
    }
  }, [isOpen]);

  const quickLogResults = useMemo(() => {
    if (!log || !workout) return [];
    return log.entries
        .filter(e => e.exerciseId.startsWith('QUICK_LOG_BLOCK_ID::'))
        .map(entry => {
            const blockId = entry.exerciseId.split('::')[1];
            const block = workout.blocks.find(b => b.id === blockId);
            const rounds = entry.loggedSets[0]?.reps;
            return {
                blockName: block?.name || 'Snabbloggat block',
                rounds
            };
        })
        .filter(item => item.rounds !== undefined);
  }, [log, workout]);

  if (!isOpen || !log || !workout) {
    return null;
  }

  const summaryData = log.postWorkoutSummary;

  const generateShareText = () => {
    if (!summaryData) return "";
    const dateFormatted = new Date(log.completedDate).toLocaleDateString('sv-SE');
    let text = `Jag klarade passet "${workout.title}" den ${dateFormatted}! 💪\n`;
    
    if (summaryData.totalWeightLifted > 0) {
        text += `Total volym: ${summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg.\n`;
    }

    if (summaryData.animalEquivalent) {
      text += `Lyfte motsvarande ${summaryData.animalEquivalent.count} ${summaryData.animalEquivalent.unitName}! ${summaryData.animalEquivalent.emoji || ''}\n`;
    }
    
    if (summaryData.bodyweightRepsSummary && summaryData.bodyweightRepsSummary.length > 0) {
        const bodyweightText = summaryData.bodyweightRepsSummary.map(item => `${item.totalReps} ${item.exerciseName.toLowerCase()}`).join(', ');
        text += `\nSamt gjort ${bodyweightText}.\n`;
    }

    if (summaryData.newBaselines && summaryData.newBaselines.length > 0) {
      text += "\nNya Baslinjer Satta:\n";
      summaryData.newBaselines.forEach(b => {
        text += `- ${b.exerciseName}: ${b.value}\n`;
      });
    }

    if (summaryData.newPBs && summaryData.newPBs.length > 0) {
      text += "\nNya Rekord:\n";
      summaryData.newPBs.forEach(pb => {
        text += `- ${pb.exerciseName}: ${pb.achievement} ${pb.value}${pb.previousBest ? ` ${pb.previousBest}` : ''}\n`;
      });
    } else if (!summaryData.newBaselines || summaryData.newBaselines.length === 0) {
      text += "\nInga nya rekord denna gång, men grymt kämpat!\n";
    }
    text += "\nLoggat med Flexibel Träningslogg! #FlexibelHälsostudio";
    return text;
  };

  const handleShare = async () => {
    if (!summaryData) return;
    setIsSharingImage(true);

    const shareTitle = `Träningsresultat: ${workout.title}`;
    const fallbackText = generateShareText();
    let imageFile: File | null = null;

    if (shareableContentRef.current) {
      try {
        const canvas = await html2canvas(shareableContentRef.current, {
          useCORS: true,
          backgroundColor: '#ffffff', // Ensure white background for the image
          scale: 3, // Higher scale for better quality on retina displays
          logging: false,
        });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const fileName = `flexibel-pass-${workout.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
          imageFile = new File([blob], fileName, { type: 'image/png' });
        }
      } catch (error) {
        console.error('Error generating image for sharing:', error);
      }
    }

    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          files: [imageFile],
          title: shareTitle,
          text: fallbackText, 
        });
      } catch (error) {
          try {
            await navigator.share({ title: shareTitle, text: fallbackText });
          } catch (textShareError) {
            await navigator.clipboard.writeText(fallbackText);
            alert('Kunde inte dela. Resultatet har kopierats till urklipp!');
          }
      }
    } else if (navigator.share) { 
      try {
        await navigator.share({
          title: shareTitle,
          text: fallbackText,
        });
      } catch (error) {
        await navigator.clipboard.writeText(fallbackText);
        alert('Kunde inte dela. Resultatet har kopierats till urklipp!');
      }
    } else { 
      try {
        await navigator.clipboard.writeText(fallbackText);
        alert('Resultatet har kopierats till urklipp!');
      } catch (err) {
        alert('Kunde inte kopiera texten automatiskt.');
      }
    }
    setIsSharingImage(false);
  };

  const handleModalCloseWithFinalize = () => {
    setIsFinalizing(true);
    setHasFinalized(false); 
    
    setHasFinalized(true); 
    setTimeout(() => {
        onFinalize();
    }, 800);
  };

  if (!summaryData) return null;
  
  const animalWeightDetails = summaryData?.animalEquivalent
    ? WEIGHT_COMPARISONS.find(item => item.name === summaryData.animalEquivalent?.name)
    : null;

  let finalizeButtonText = "Klar";
  if (isFinalizing && !hasFinalized) finalizeButtonText = "Sparar..."; 
  if (hasFinalized) finalizeButtonText = "Sparat! ✓";

  const dateFormatted = new Date(log.completedDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Modal isOpen={isOpen} onClose={handleModalCloseWithFinalize} title="" size="lg" isClosable={false}>
      {isNewCompletion && isOpen && summaryData && <Confetti />}
      
      {/* SHAREABLE CARD CONTAINER */}
      <div className="flex justify-center bg-gray-50 p-2 sm:p-4 rounded-lg">
        <div 
            ref={shareableContentRef} 
            className="bg-white rounded-xl shadow-xl overflow-hidden w-full max-w-md border border-gray-200"
            style={{ minHeight: '400px' }}
        >
            {/* Header Stripe */}
            <div className="h-3 bg-flexibel w-full"></div>
            
            <div className="p-6 flex flex-col items-center text-center">
                
                {/* Header Info */}
                <div className="mb-6 w-full">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{dateFormatted}</p>
                    <h2 className="text-2xl font-bold text-gray-800 leading-tight">{workout.title}</h2>
                    <div className="h-1 w-12 bg-gray-200 mx-auto mt-3 rounded-full"></div>
                </div>

                {/* Main Visual (Animal or Generic) */}
                {summaryData.animalEquivalent ? (
                    <div className="relative mb-6 animate-fade-in-down">
                        <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center shadow-inner mx-auto">
                            <span className="text-7xl" role="img" aria-label={summaryData.animalEquivalent.name}>
                                {summaryData.animalEquivalent.emoji || '💪'}
                            </span>
                        </div>
                        {/* Badge */}
                        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow border border-gray-100 text-sm font-bold text-gray-700 whitespace-nowrap">
                            {summaryData.animalEquivalent.count > 1 ? `${summaryData.animalEquivalent.count} st!` : 'En hel!'}
                        </div>
                    </div>
                ) : (
                    <div className="mb-6 animate-fade-in-down">
                         <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center shadow-inner mx-auto text-flexibel">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                )}

                {/* Main Stats */}
                <div className="space-y-2 mb-6 animate-fade-in-down" style={{animationDelay: '100ms'}}>
                     {summaryData.animalEquivalent ? (
                         <>
                            <h3 className="text-xl font-bold text-gray-800">
                                Du lyfte {summaryData.animalEquivalent.article || 'en'} {summaryData.animalEquivalent.unitName.toLowerCase()}!
                            </h3>
                             <p className="text-sm text-gray-600 px-4">
                                Total volym: <strong>{summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg</strong>
                                {animalWeightDetails && ` (snittvikt ca ${animalWeightDetails.weightKg} kg)`}
                            </p>
                         </>
                     ) : (
                         <>
                             <h3 className="text-xl font-bold text-gray-800">Pass Slutfört!</h3>
                             {summaryData.totalWeightLifted > 0 && (
                                 <p className="text-4xl font-bold text-flexibel mt-2">
                                     {summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg
                                 </p>
                             )}
                         </>
                     )}
                     <VolumeComparison summary={summaryData} />
                </div>
                
                {/* Stats List */}
                <div className="w-full space-y-3 text-left">
                    {summaryData.bodyweightRepsSummary && summaryData.bodyweightRepsSummary.length > 0 && (
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-center text-gray-700">
                            {summaryData.bodyweightRepsSummary.map((item, i) => (
                                <span key={i}>
                                    {i > 0 && ', '}
                                    <strong>{item.totalReps}</strong> {item.exerciseName.toLowerCase()}
                                </span>
                            ))}
                        </div>
                    )}

                     {quickLogResults.length > 0 && (
                         <div className="space-y-2">
                             {quickLogResults.map((result, index) => (
                                 <div key={index} className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100 text-sm">
                                     <span className="font-semibold text-blue-800">{result.blockName}</span>
                                     <span className="bg-white px-2 py-0.5 rounded text-blue-800 font-bold shadow-sm">{result.rounds} varv</span>
                                 </div>
                             ))}
                         </div>
                     )}

                     {summaryData.newPBs && summaryData.newPBs.length > 0 && (
                         <div className="space-y-2">
                             <p className="text-xs font-bold text-gray-400 uppercase tracking-wide text-center mb-1">Nya Rekord 🏆</p>
                             {summaryData.newPBs.map((pb, index) => (
                                 <div key={index} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm flex justify-between items-center">
                                     <span className="font-semibold text-yellow-900 truncate pr-2">{pb.exerciseName}</span>
                                     <span className="flex-shrink-0 text-yellow-800">{pb.value}</span>
                                 </div>
                             ))}
                         </div>
                     )}

                     {summaryData.newBaselines && summaryData.newBaselines.length > 0 && (
                         <div className="space-y-2">
                             <p className="text-xs font-bold text-gray-400 uppercase tracking-wide text-center mb-1">Nya Baslinjer 📊</p>
                             {summaryData.newBaselines.map((b, index) => (
                                 <div key={index} className="p-2 bg-gray-50 border border-gray-200 rounded text-sm flex justify-between items-center">
                                     <span className="font-semibold text-gray-700 truncate pr-2">{b.exerciseName}</span>
                                     <span className="flex-shrink-0 text-gray-600">{b.value}</span>
                                 </div>
                             ))}
                         </div>
                     )}
                </div>

                 {/* Footer Branding */}
                 <div className="mt-8 pt-4 border-t border-gray-100 w-full flex justify-between items-center">
                     <span className="text-xs font-semibold text-gray-400">Träningslogg</span>
                     <span className="text-xs font-bold text-flexibel">#FlexibelHälsostudio</span>
                 </div>

            </div>
        </div>
      </div>
      
      <div className="mt-4 pt-6 border-t">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button 
              onClick={onEditLog} 
              variant="outline" 
              size="md"
              className="w-full"
              disabled={isFinalizing || isSharingImage}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
              </svg>
              Redigera
            </Button>
            <Button 
              onClick={handleShare} 
              variant="secondary" 
              size="md"
              className="w-full"
              disabled={isSharingImage || isFinalizing}
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              {isSharingImage ? 'Delar...' : 'Dela'}
            </Button>
            <Button onClick={handleModalCloseWithFinalize} variant="primary" size="md" className="w-full" disabled={isFinalizing || isSharingImage}>
              {finalizeButtonText}
            </Button>
          </div>
      </div>
    </Modal>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { WorkoutLog, Workout } from '../../types';
import { WEIGHT_COMPARISONS } from '../../constants';
import html2canvas from 'html2canvas';
import { Confetti } from './Confetti';

interface PostWorkoutSummaryModalProps {
  isOpen: boolean;
  onFinalize: () => void;
  log: WorkoutLog | null;
  workout: Workout | null; 
  onEditLog: () => void;
  isNewCompletion?: boolean;
}

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
          backgroundColor: '#ffffff',
          scale: 2,
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

  return (
    <Modal isOpen={isOpen} onClose={handleModalCloseWithFinalize} title="" size="lg" showCloseButtonOnly={true}>
      {isNewCompletion && isOpen && summaryData && <Confetti />}
      <div ref={shareableContentRef} className="bg-white p-6 rounded-lg">
        <div className="text-center space-y-4">

            <p className="text-xl text-gray-500 font-semibold">Pass Slutfört!</p>

            {summaryData.animalEquivalent && (
              <div className="my-6 animate-fade-in-down">
                <span className="text-9xl" role="img" aria-label={summaryData.animalEquivalent.name}>
                    {summaryData.animalEquivalent.emoji || '💪'}
                </span>
              </div>
            )}

            {summaryData.animalEquivalent && (
              <div className="animate-fade-in-down" style={{animationDelay: '100ms'}}>
                <h2 className="text-3xl font-bold text-gray-800">
                    Grattis! Du har lyft{' '}
                    {summaryData.animalEquivalent.count > 1
                        ? `${summaryData.animalEquivalent.count} ${summaryData.animalEquivalent.unitName.toLowerCase()}`
                        : `${summaryData.animalEquivalent.article || 'en'} ${summaryData.animalEquivalent.unitName.toLowerCase()}`
                    }!
                </h2>
                <p className="mt-2 text-lg text-gray-600">
                    Du lyfte {summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg på detta passet.
                    {animalWeightDetails && ` En ${animalWeightDetails.name.toLowerCase()} väger i snitt ${animalWeightDetails.weightKg} kg!`}
                </p>
              </div>
            )}
            
            {!summaryData.animalEquivalent && summaryData.totalWeightLifted > 0 && (
                <div className="my-6">
                    <p className="text-base text-gray-500 uppercase tracking-wide">Total Volym</p>
                    <p className="text-5xl font-bold text-flexibel">
                        {summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg
                    </p>
                </div>
            )}
        </div>
        
        <div className="space-y-4">
          {summaryData.bodyweightRepsSummary && summaryData.bodyweightRepsSummary.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg border text-center">
                <p className="text-base text-gray-500 uppercase tracking-wide">Kroppsviktsövningar</p>
                <p className="text-lg text-gray-800 mt-2">
                    Samt gjort{' '}
                    {summaryData.bodyweightRepsSummary.map((item, index) => (
                        <React.Fragment key={index}>
                        <span className="font-bold">{item.totalReps}</span> {item.exerciseName.toLowerCase()}
                        {index < summaryData.bodyweightRepsSummary!.length - 1 && ', '}
                        </React.Fragment>
                    ))}.
                </p>
            </div>
          )}

          {summaryData.newBaselines && summaryData.newBaselines.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-xl font-semibold text-gray-800 mb-3 text-center">📊 Ny Baslinje Satt!</h3>
              <ul className="space-y-2 text-left">
                {summaryData.newBaselines.map((baseline, index) => (
                  <li key={index} className="p-3 bg-blue-50 border border-blue-300 rounded-md text-base">
                    <span className="font-semibold text-blue-700">{baseline.exerciseName}:</span> Ny utgångspunkt satt till <span className="font-bold">{baseline.value}</span>. Bra start!
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summaryData.newPBs && summaryData.newPBs.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-xl font-semibold text-gray-800 mb-3 text-center">🏆 Nya Rekord!</h3>
              <ul className="space-y-2 text-left">
                {summaryData.newPBs.map((pb, index) => (
                  <li key={index} className="p-3 bg-yellow-50 border border-yellow-300 rounded-md text-base">
                    <span className="font-semibold text-yellow-700">{pb.exerciseName}:</span> {pb.achievement} <span className="font-bold">{pb.value}</span>
                    {pb.previousBest && <span className="text-sm text-yellow-600">{pb.previousBest}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
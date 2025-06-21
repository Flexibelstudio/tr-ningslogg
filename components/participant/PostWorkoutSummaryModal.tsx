import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { WorkoutLog, Workout } from '../../types';
import { MoodSelectorInput } from './MoodSelectorInput'; // Import MoodSelectorInput
import html2canvas from 'html2canvas';

interface PostWorkoutSummaryModalProps {
  isOpen: boolean;
  onFinalize: (moodRating: number | null) => void; // Changed from onClose to onFinalize
  log: WorkoutLog;
  workout: Workout; 
  onEditLog: () => void; 
}

export const PostWorkoutSummaryModal: React.FC<PostWorkoutSummaryModalProps> = ({
  isOpen,
  onFinalize,
  log,
  workout,
  onEditLog,
}) => {
  const summaryData = log.postWorkoutSummary;
  const [selectedMood, setSelectedMood] = useState<number | null>(log.moodRating || null);
  const shareableContentRef = useRef<HTMLDivElement>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);

  useEffect(() => {
    // Reset mood when modal is opened for a new log or log changes
    if (isOpen) {
      setSelectedMood(log.moodRating || null);
      setIsSharingImage(false);
    }
  }, [isOpen, log.moodRating]);

  const generateShareText = () => {
    if (!summaryData) return "";
    const dateFormatted = new Date(log.completedDate).toLocaleDateString('sv-SE');
    let text = `Jag klarade passet "${workout.title}" den ${dateFormatted}! 💪\n`;
    text += `Total volym: ${summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg.\n`;

    if (summaryData.animalEquivalent) {
      text += `Lyfte motsvarande ${summaryData.animalEquivalent.count} ${summaryData.animalEquivalent.unitName}! ${summaryData.animalEquivalent.emoji || ''}\n`;
    }

    if (summaryData.newPBs && summaryData.newPBs.length > 0) {
      text += "\nNya Rekord:\n";
      summaryData.newPBs.forEach(pb => {
        text += `- ${pb.exerciseName}: ${pb.achievement} ${pb.value}${pb.previousBest ? ` ${pb.previousBest}` : ''}\n`;
      });
    } else {
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
          backgroundColor: '#ffffff', // Ensure a background for transparency issues
          scale: 2, // Increase scale for better resolution
        });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const fileName = `flexibel-pass-${workout.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
          imageFile = new File([blob], fileName, { type: 'image/png' });
        }
      } catch (error) {
        console.error('Error generating image for sharing:', error);
        // Image generation failed, will fallback to text
      }
    }

    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          files: [imageFile],
          title: shareTitle,
          text: fallbackText, // Text can still be useful alongside the image
        });
        console.log('Image shared successfully');
      } catch (error) {
        console.error('Error sharing image:', error);
        // If image share fails, try sharing text only
        if (navigator.share) {
          try {
            await navigator.share({ title: shareTitle, text: fallbackText });
          } catch (textShareError) {
            console.error('Error sharing text after image share failed:', textShareError);
            // If all sharing fails, copy text to clipboard
            await navigator.clipboard.writeText(fallbackText);
            alert('Kunde inte dela. Resultatet har kopierats till urklipp!');
          }
        } else {
          await navigator.clipboard.writeText(fallbackText);
          alert('Kunde inte dela bilden. Resultatet har kopierats till urklipp!');
        }
      }
    } else if (navigator.share) { // Fallback to text sharing if image can't be shared
      try {
        await navigator.share({
          title: shareTitle,
          text: fallbackText,
        });
        console.log('Text shared successfully');
      } catch (error) {
        console.error('Error sharing text:', error);
        await navigator.clipboard.writeText(fallbackText);
        alert('Kunde inte dela. Resultatet har kopierats till urklipp!');
      }
    } else { // Fallback to clipboard if Web Share API is not supported
      try {
        await navigator.clipboard.writeText(fallbackText);
        alert('Resultatet har kopierats till urklipp!');
      } catch (err) {
        console.error('Kunde inte kopiera text: ', err);
        alert('Kunde inte kopiera texten automatiskt.');
      }
    }
    setIsSharingImage(false);
  };

  const handleModalClose = () => {
    onFinalize(selectedMood);
  };

  if (!isOpen || !summaryData) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Resultatöversikt" size="lg">
      <div ref={shareableContentRef} className="bg-white p-4 rounded-lg">
        <h2 className="text-3xl font-bold text-center mb-4" style={{color: '#51A1A1'}}>🎉 Pass Slutfört! 🎉</h2>
        <div className="text-center space-y-6">
          <div className="bg-gradient-to-br from-flexibel to-teal-600 text-white p-6 rounded-lg shadow-xl">
            <h3 className="text-3xl font-bold mb-1">Pass: {workout.title}</h3>
            <p className="text-xl">Vilken insats!</p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-base text-gray-500 uppercase">Total Volym (vikt * reps)</p>
              <p className="text-5xl font-bold text-flexibel">
                {summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg
              </p>
            </div>

            {summaryData.animalEquivalent && (
              <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                <span className="text-8xl block mb-2" aria-hidden="true">{summaryData.animalEquivalent.emoji || '💪'}</span>
                <p className="text-xl text-gray-700">
                  Du har lyft motsvarande
                </p>
                <p className="text-3xl font-semibold text-teal-700">
                  {summaryData.animalEquivalent.unitName
                    ? `${summaryData.animalEquivalent.count} ${summaryData.animalEquivalent.unitName}!`
                    : `${summaryData.animalEquivalent.name}!`}
                </p>
              </div>
            )}
          </div>

          {summaryData.newPBs && summaryData.newPBs.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-2xl font-semibold text-gray-800 mb-3">🏆 Nya Rekord!</h3>
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
          
          {log.postWorkoutComment && (
               <div className="mt-6 pt-4 border-t text-left">
                   <h4 className="text-lg font-semibold text-gray-700">Din passkommentar:</h4>
                   <p className="text-base text-gray-600 italic p-2 bg-gray-100 rounded">"{log.postWorkoutComment}"</p>
              </div>
          )}
        </div>
      </div> {/* End of shareableContentRef div */}
      
      {/* Non-shareable content below */}
      <div className="text-center p-2 space-y-6 mt-4">
          <div className="pt-4 border-t">
            <MoodSelectorInput 
              currentRating={selectedMood}
              onSelectRating={setSelectedMood}
              label="Passkänsla?"
            />
          </div>
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t">
            <Button 
              onClick={onEditLog} 
              variant="outline" 
              size="lg" 
              className="w-full sm:w-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
              </svg>
              Redigera Logg
            </Button>
            <Button 
              onClick={handleShare} 
              variant="secondary" 
              size="lg" 
              className="w-full sm:w-auto"
              disabled={isSharingImage}
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              {isSharingImage ? 'Delar bild...' : 'Dela Resultat'}
            </Button>
            <Button onClick={handleModalClose} variant="primary" size="lg" className="w-full sm:w-auto">
              Klar
            </Button>
          </div>
      </div>
    </Modal>
  );
};
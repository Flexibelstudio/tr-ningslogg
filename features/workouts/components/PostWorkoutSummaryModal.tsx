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
      <p
        className="mt-2 text-base text-green-700 font-semibold animate-fade-in-down"
        style={{ animationDelay: '200ms' }}
      >
        Första gången du loggar detta pass? Snyggt! Nu har du en baslinje att slå nästa gång.
      </p>
    );
  }

  if (summary.volumeDifferenceVsPrevious !== undefined && summary.volumeDifferenceVsPrevious > 0) {
    return (
      <p
        className="mt-2 text-base text-green-700 font-semibold animate-fade-in-down"
        style={{ animationDelay: '200ms' }}
      >
        +{summary.volumeDifferenceVsPrevious.toLocaleString('sv-SE')} kg mer än förra gången! 💪
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
          rounds,
        };
      })
      .filter(item => item.rounds !== undefined);
  }, [log, workout]);

  if (!isOpen || !log || !workout) {
    return null;
  }

  const summaryData = log.postWorkoutSummary;

  const generateShareText = () => {
    if (!summaryData) return '';
    const dateFormatted = new Date(log.completedDate).toLocaleDateString('sv-SE');
    let text = `Jag klarade passet "${workout.title}" den ${dateFormatted}! 💪\n`;

    if (summaryData.totalWeightLifted > 0) {
      text += `Total volym: ${summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg.\n`;
    }

    if (summaryData.animalEquivalent) {
      text += `Lyfte motsvarande ${summaryData.animalEquivalent.count} ${summaryData.animalEquivalent.unitName}! ${
        summaryData.animalEquivalent.emoji || ''
      }\n`;
    }

    if (summaryData.bodyweightRepsSummary && summaryData.bodyweightRepsSummary.length > 0) {
      const bodyweightText = summaryData.bodyweightRepsSummary
        .map(item => `${item.totalReps} ${item.exerciseName.toLowerCase()}`)
        .join(', ');
      text += `\nSamt gjort ${bodyweightText}.\n`;
    }

    if (summaryData.newBaselines && summaryData.newBaselines.length > 0) {
      text += '\nNya Baslinjer Satta:\n';
      summaryData.newBaselines.forEach(b => {
        text += `- ${b.exerciseName}: ${b.value}\n`;
      });
    }

    if (summaryData.newPBs && summaryData.newPBs.length > 0) {
      text += '\nNya Rekord:\n';
      summaryData.newPBs.forEach(pb => {
        text += `- ${pb.exerciseName}: ${pb.achievement} ${pb.value}${
          pb.previousBest ? ` ${pb.previousBest}` : ''
        }\n`;
      });
    } else if (!summaryData.newBaselines || summaryData.newBaselines.length === 0) {
      text += '\nInga nya rekord denna gång, men grymt kämpat!\n';
    }
    text += '\nLoggat med Flexibel Träningslogg! #FlexibelHälsostudio';
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
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
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

  let finalizeButtonText = 'Klar';
  if (isFinalizing && !hasFinalized) finalizeButtonText = 'Sparar...';
  if (hasFinalized) finalizeButtonText = 'Sparat! ✓';

  const hasPBs = summaryData.newPBs && summaryData.newPBs.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={handleModalCloseWithFinalize} title="" size="lg" isClosable={false}>
      {isNewCompletion && isOpen && summaryData && <Confetti />}

      {/* Delbart, Insta-vänligt kort */}
      <div className="flex justify-center">
        <div
          ref={shareableContentRef}
          className="w-full max-w-md mx-auto bg-gradient-to-b from-slate-50 to-white rounded-3xl shadow-xl border border-gray-200 px-6 py-6 sm:px-8 sm:py-8 relative overflow-hidden"
        >
          {/* “Logotyp” / branding högst upp */}
          <div className="flex justify-center mb-3">
            <div className="px-3 py-1 text-[10px] font-semibold tracking-[0.25em] uppercase text-gray-400 border border-gray-100 rounded-full bg-white/80">
              Flexibel Träningslogg
            </div>
          </div>

          {/* Liten rubrik */}
          <p className="text-[11px] font-semibold tracking-[0.3em] text-gray-400 uppercase text-center">
            Pass slutfört
          </p>

          {/* Stor emoji */}
          {summaryData.animalEquivalent && (
            <div className="flex justify-center my-3 animate-fade-in-down">
              <span
                className="text-7xl sm:text-8xl drop-shadow-sm"
                role="img"
                aria-label={summaryData.animalEquivalent.name}
              >
                {summaryData.animalEquivalent.emoji || '💪'}
              </span>
            </div>
          )}

          {/* Huvudbudskap */}
          <div className="mt-2 text-center animate-fade-in-down" style={{ animationDelay: '80ms' }}>
            {summaryData.animalEquivalent ? (
              <>
                <p className="text-[11px] font-medium tracking-[0.25em] text-gray-500 uppercase">
                  Du lyfte
                </p>
                <h2 className="mt-1 text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
                  {summaryData.animalEquivalent.count > 1
                    ? `${summaryData.animalEquivalent.count} ${summaryData.animalEquivalent.unitName.toUpperCase()}`
                    : `${(summaryData.animalEquivalent.article || 'En').toUpperCase()} ${summaryData.animalEquivalent.unitName.toUpperCase()}`}
                  !
                </h2>
                <p className="mt-2 text-base text-gray-600 font-semibold">
                  ({summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg totalt)
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
                  Du lyfte {summaryData.totalWeightLifted.toLocaleString('sv-SE')} kg!
                </h2>
              </>
            )}
          </div>

          {/* Tunn divider */}
          <div className="mt-5 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          {/* Kompakt rekord-ruta inuti kortet */}
          {hasPBs && (
            <div className="mt-4 rounded-2xl border border-yellow-300/80 bg-gradient-to-br from-yellow-50 to-amber-50 px-4 py-3 shadow-sm">
              <div className="flex items-center justify-center gap-2 text-yellow-900">
                <span className="text-xl">🏆</span>
                <p className="text-[11px] font-semibold tracking-[0.25em] uppercase">
                  Nytt rekord
                </p>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-yellow-900 text-center">
                {summaryData.newPBs!.slice(0, 3).map((pb, index) => (
                  <li key={index}>
                    <span className="font-semibold">{pb.exerciseName}:</span>{' '}
                    {pb.achievement} <span className="font-bold">{pb.value}</span>
                  </li>
                ))}
              </ul>
              {summaryData.newPBs!.length > 3 && (
                <p className="mt-2 text-[11px] text-yellow-800/80 text-center italic">
                  (+ fler rekord på detta pass)
                </p>
              )}
            </div>
          )}

          {/* Liten tagline längst ned */}
          <p className="mt-5 text-[10px] text-center text-gray-400 tracking-[0.18em] uppercase">
            Flexibel Hälsostudio • styrka • kondition • balans
          </p>
        </div>
      </div>

      {/* Övriga detaljer under kortet (inte med i den delbara bilden) */}
      <div className="mt-6 space-y-4">
        {/* Volym-jämförelse & djur-info */}
        <div className="text-center">
          <VolumeComparison summary={summaryData} />
          {animalWeightDetails && (
            <p className="mt-2 text-sm text-gray-500">
              En {animalWeightDetails.name.toLowerCase()} väger i snitt{' '}
              {animalWeightDetails.weightKg} kg.
            </p>
          )}
        </div>

        {summaryData.bodyweightRepsSummary && summaryData.bodyweightRepsSummary.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg border text-center">
            <p className="text-base text-gray-500 uppercase tracking-wide">Kroppsviktsövningar</p>
            <p className="text-lg text-gray-800 mt-2">
              Samt gjort{' '}
              {summaryData.bodyweightRepsSummary.map((item, index) => (
                <React.Fragment key={index}>
                  <span className="font-bold">{item.totalReps}</span>{' '}
                  {item.exerciseName.toLowerCase()}
                  {index < summaryData.bodyweightRepsSummary!.length - 1 && ', '}
                </React.Fragment>
              ))}
              .
            </p>
          </div>
        )}

        {quickLogResults.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-xl font-semibold text-gray-800 mb-3 text-center">
              ⏱️ Snabbloggade Block
            </h3>
            <ul className="space-y-2 text-left">
              {quickLogResults.map((result, index) => (
                <li
                  key={index}
                  className="p-3 bg-blue-50 border border-blue-300 rounded-md text-base flex justify-between"
                >
                  <span className="font-semibold text-blue-700">{result.blockName}</span>
                  <span className="font-bold">{result.rounds} varv</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summaryData.newBaselines && summaryData.newBaselines.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-xl font-semibold text-gray-800 mb-3 text-center">
              📊 Ny Baslinje Satt!
            </h3>
            <ul className="space-y-2 text-left">
              {summaryData.newBaselines.map((baseline, index) => (
                <li
                  key={index}
                  className="p-3 bg-blue-50 border border-blue-300 rounded-md text-base"
                >
                  <span className="font-semibold text-blue-700">{baseline.exerciseName}:</span>{' '}
                  Ny utgångspunkt satt till <span className="font-bold">{baseline.value}</span>. Bra
                  start!
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasPBs && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-xl font-semibold text-gray-800 mb-3 text-center">
              🏆 Nya Rekord (detaljer)
            </h3>
            <ul className="space-y-2 text-left">
              {summaryData.newPBs!.map((pb, index) => (
                <li
                  key={index}
                  className="p-3 bg-yellow-50 border border-yellow-300 rounded-md text-base"
                >
                  <span className="font-semibold text-yellow-700">{pb.exerciseName}:</span>{' '}
                  {pb.achievement} <span className="font-bold">{pb.value}</span>
                  {pb.previousBest && (
                    <span className="block text-sm text-yellow-600">
                      Tidigare: {pb.previousBest}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Knapp-rad */}
      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            onClick={onEditLog}
            variant="outline"
            size="md"
            className="w-full"
            disabled={isFinalizing || isSharingImage}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
              <path
                fillRule="evenodd"
                d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                clipRule="evenodd"
              />
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
            {isSharingImage ? 'Delar...' : 'Dela'}
          </Button>
          <Button
            onClick={handleModalCloseWithFinalize}
            variant="primary"
            size="md"
            className="w-full"
            disabled={isFinalizing || isSharingImage}
          >
            {finalizeButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

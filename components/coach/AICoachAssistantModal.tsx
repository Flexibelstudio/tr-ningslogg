import React, { useState, useCallback, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { LiftType, WorkoutBlock, ParticipantProfile, ParticipantGoalData, Exercise } from '../../types';
import { ALL_LIFT_TYPES } from '../../constants';
import { renderMarkdown } from '../../utils/textUtils';
import { callGeminiApiFn } from '../../firebaseClient';

interface AICoachAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantToAssign?: ParticipantProfile;
  participantGoal?: ParticipantGoalData | null;
  onAcceptSuggestion: (suggestion: { title: string; coachNote?: string; blocksData: WorkoutBlock[] }) => void;
}

interface FormData {
  specificRequests: string;
}

export const AICoachAssistantModal: React.FC<AICoachAssistantModalProps> = ({ 
    isOpen, 
    onClose, 
    participantToAssign,
    participantGoal,
    onAcceptSuggestion 
}) => {
  const [formData, setFormData] = useState<FormData>({ specificRequests: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSuggestion, setGeneratedSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        resetInternalState();
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetInternalState = () => {
    setFormData({ specificRequests: '' });
    setGeneratedSuggestion(null);
    setError(null);
    setIsLoading(false);
  };

  const handleGenerateSuggestion = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedSuggestion(null);

    const availableBaseLiftsString = ALL_LIFT_TYPES.join(', ');
    const isForSpecificMember = !!participantToAssign;

    const memberInfoPrompt = isForSpecificMember
      ? `
      **Medlemmens Information:**
      - Namn: ${participantToAssign.name}
      - Ålder: ${participantToAssign.age || 'Ej angett'}
      - Kön: ${participantToAssign.gender || 'Ej angett'}
      - Huvudmål: "${participantGoal?.fitnessGoals || 'Inget specifikt mål satt'}"
      - Mål (pass/vecka): ${participantGoal?.workoutsPerWeekTarget || 'Ej angett'}
      - Coach Recept: "${participantGoal?.coachPrescription || 'Ingen specifik plan från coach.'}"
      `
      : `
      **Uppdrag:** Skapa en generell och välstrukturerad passmall som kan återanvändas.
      `;

    const prompt = `
      Du är en expert AI-assistent för träningscoacher på Flexibel Hälsostudio. Din uppgift är att skapa ett skräddarsytt, vetenskapligt grundat och motiverande träningsprogram. Svaret MÅSTE vara på svenska.
      ${memberInfoPrompt}
      **Coachens Specifika Instruktioner för detta pass:**
      "${formData.specificRequests || 'Inga specifika instruktioner.'}"

      **Tillgängliga baslyft/kategorier att koppla övningar till:** ${availableBaseLiftsString}.

      **Ditt Uppdrag:**
      Skapa ett komplett programförslag. Ditt svar MÅSTE vara en enda textsträng och följa denna struktur med Markdown:

      **1. Titel:** Börja med en passande och inspirerande titel för passet. Exempel: \`**Titel:** Styrkefokus Underkropp - Vecka 1\`.
      **2. Coachanteckning (valfritt):** Efter titeln, om du vill, lägg till en rad som börjar med \`**Coachanteckning:** \` följt av en kort, övergripande anteckning till medlemmen.
      **3. Block:**
          - Använd H3-rubriker för varje block (t.ex. \`### Block A: Uppvärmning\`).
          - Lista övningarna inom blocket som punktlistor (\`* \`).
          - För VARJE övning, efter namnet, använd ett kolon med mellanslag (\`: \`) följt av detaljer. Dessa detaljer utgör "anteckningarna" för övningen och BÖR inkludera:
              - Förslag på set och reps (t.ex., \`3 set x 8-12 reps\`).
              - Korta, värdefulla tekniktips.
          - Om övningen är en variant av ett baslyft, inkludera en tagg i formatet \`(Baslyft: NamnPåBaslyft)\`.

      **Exempel på ett block:**
      ### Block B: Styrka
      * Knäböj: 3 set x 8 reps. Fokusera på att hålla bröstet uppe och gå djupt. (Baslyft: Knäböj)
      * Hantelrodd: 3 set x 10 reps per sida. Dra med ryggen, inte armarna. (Baslyft: Hantelrodd)
    `;

    try {
      const result = await callGeminiApiFn({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const { text, error } = result.data as { text?: string; error?: string };
      
      if (error) {
        throw new Error(`Cloud Function error: ${error}`);
      }

      setGeneratedSuggestion(text);
    } catch (err) {
      console.error("Error fetching AI coach suggestion:", err);
      setError("Kunde inte generera förslag från AI. Försök igen senare eller kontrollera din API-nyckel.");
    } finally {
      setIsLoading(false);
    }
  }, [formData, participantToAssign, participantGoal]);
  
  const parseAndAcceptSuggestion = () => {
    if (!generatedSuggestion) return;
  
    const lines = generatedSuggestion.split('\n').filter(line => line.trim() !== '');
  
    let workoutTitle = "AI-genererat Program";
    let coachNote: string | undefined = undefined;
    const blocksData: WorkoutBlock[] = [];
    let currentBlock: WorkoutBlock | null = null;
  
    // Find title and optional coach note first
    const titleLineIndex = lines.findIndex(line => line.toLowerCase().includes('**titel:**'));
    if (titleLineIndex !== -1) {
        workoutTitle = lines[titleLineIndex].replace(/\*\*Titel:\*\*/i, '').trim();
        lines.splice(titleLineIndex, 1);
    }

    const coachNoteLineIndex = lines.findIndex(line => line.toLowerCase().includes('**coachanteckning:**'));
    if (coachNoteLineIndex !== -1) {
        coachNote = lines[coachNoteLineIndex].replace(/\*\*Coachanteckning:\*\*/i, '').trim();
        lines.splice(coachNoteLineIndex, 1);
    }
  
    const blockHeadingRegex = /^###\s*(.*)/;
    const exerciseItemRegex = /^\s*[*-]\s+(.+)/;
    const baseLiftRegex = /\(Baslyft:\s*([a-zA-ZåäöÅÄÖ\s\/&'’]+?)\s*\)/i;
  
    for (const line of lines) {
      const trimmedLine = line.trim();
  
      const blockMatch = trimmedLine.match(blockHeadingRegex);
      if (blockMatch && blockMatch[1]) {
        if (currentBlock) {
          blocksData.push(currentBlock);
        }
        currentBlock = { id: crypto.randomUUID(), name: blockMatch[1].trim(), exercises: [] };
        continue;
      }
  
      if (currentBlock) {
        const exerciseMatch = trimmedLine.match(exerciseItemRegex);
        if (exerciseMatch && exerciseMatch[1]) {
          let fullExerciseText = exerciseMatch[1].trim();
          let exerciseName = fullExerciseText;
          let exerciseNotes = '';
          let baseLiftType: LiftType | undefined = undefined;
  
          const baseLiftNameMatch = fullExerciseText.match(baseLiftRegex);
          if (baseLiftNameMatch && baseLiftNameMatch[1]) {
            const potentialBaseLift = baseLiftNameMatch[1].trim();
            baseLiftType = ALL_LIFT_TYPES.find(lift => lift.toLowerCase() === potentialBaseLift.toLowerCase()) || undefined;
            fullExerciseText = fullExerciseText.replace(baseLiftRegex, '').trim();
          }
  
          const parts = fullExerciseText.split(': ');
          if (parts.length > 1) {
            exerciseName = parts[0].trim();
            exerciseNotes = parts.slice(1).join(': ').trim();
          } else {
            exerciseName = fullExerciseText;
          }
          
          const newExercise: Exercise = {
            id: crypto.randomUUID(),
            name: exerciseName,
            notes: exerciseNotes,
            baseLiftType,
          };
          currentBlock.exercises.push(newExercise);
        }
      }
    }
  
    if (currentBlock) {
      blocksData.push(currentBlock);
    }
    
    onAcceptSuggestion({ title: workoutTitle, coachNote, blocksData });
  };
  
  const handleClose = () => {
    resetInternalState();
    onClose();
  }

  const modalTitle = participantToAssign ? `AI Programassistent för ${participantToAssign.name}` : "AI Programassistent";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="xl">
      <div className="space-y-6">
        {participantToAssign ? (
            <div className="p-3 bg-gray-100 rounded-lg border">
                <h4 className="font-semibold text-gray-700">Skapar program för: {participantToAssign.name}</h4>
                <p className="text-sm text-gray-600"><strong>Mål:</strong> {participantGoal?.fitnessGoals || 'Inget specifikt mål'}</p>
            </div>
        ) : (
            <div className="p-3 bg-gray-100 rounded-lg border">
                <h4 className="font-semibold text-gray-700">Skapar en generell passmall</h4>
                <p className="text-sm text-gray-600">Ge instruktioner nedan för att skapa ett återanvändbart pass.</p>
            </div>
        )}
        
        <Textarea
          label="Specifika Instruktioner / Fokus för detta pass"
          name="specificRequests"
          value={formData.specificRequests}
          onChange={handleChange}
          placeholder="T.ex. 'Fokusera på underkropp, undvik hopp pga knäproblem, max 45 minuter.'"
          rows={3}
        />

        <Button onClick={handleGenerateSuggestion} disabled={isLoading} fullWidth variant="primary">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Genererar förslag...
            </div>
          ) : "Generera Förslag"}
        </Button>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="font-semibold">Fel:</p>
            <p>{error}</p>
          </div>
        )}

        {generatedSuggestion && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-xl font-semibold text-flexibel">AI Förslag:</h4>
            <div
              className="p-4 bg-gray-50 rounded-md max-h-[40vh] overflow-y-auto text-base text-gray-800 leading-relaxed prose prose-base max-w-none"
            >
              {renderMarkdown(generatedSuggestion)}
            </div>
          </div>
        )}
         <div className="flex justify-between items-center pt-6 border-t">
            <Button onClick={handleClose} variant="secondary">Stäng</Button>
            {generatedSuggestion && (
                <Button onClick={parseAndAcceptSuggestion} variant="primary">
                    Använd detta förslag
                </Button>
            )}
        </div>
      </div>
    </Modal>
  );
};